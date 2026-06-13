// src/frontend/runtime/physics/player_physics_controller.ts

import type {
  CollisionFlags,
  PhysicsCameraBinding,
  PhysicsConfig,
  PhysicsDeltaSeconds,
  PhysicsEulerAngles,
  PhysicsStepInput,
  PhysicsStepPhase,
  PhysicsStepResult,
  PhysicsTimestampMs,
  PhysicsVector3,
  PlayerMovementIntent,
  PlayerMovementMode,
  PlayerPhysicsState,
} from "./physics_models";

import {
  addPhysicsVector3,
  clonePhysicsVector3,
  createCollisionFlags,
  createPhysicsCameraBinding,
  createPhysicsError,
  createPhysicsVector3,
  createPlayerAabbFromPosition,
  EMPTY_PLAYER_MOVEMENT_INTENT,
  normalizeMovementIntent,
  sanitizePhysicsBoolean,
  sanitizePhysicsNumber,
  scalePhysicsVector3,
  ZERO_PHYSICS_ANGLES,
  ZERO_PHYSICS_VECTOR,
} from "./physics_models";

import {
  DEFAULT_PHYSICS_CONFIG,
  createDefaultPhysicsConfig,
  mergePhysicsConfig,
  type PhysicsConfigPatch,
} from "./physics_defaults";

import {
  createInitialPlayerPhysicsState,
  markPlayerAirborne,
  markPlayerGrounded,
  patchAndNormalizePlayerPhysicsState,
  setPlayerFlying,
} from "./player_physics_state";

import type {
  VoxelCollisionMoveResult,
  VoxelCollisionQueryLike,
  VoxelCollisionSolverConfigPatch,
} from "./voxel_collision_solver";

import {
  createVoxelCollisionSolver,
  getAabbBasePositionFromResolvedAabb,
  type VoxelCollisionSolver,
} from "./voxel_collision_solver";

/**
 * Player physics controller.
 *
 * Owns:
 * - gravity
 * - walking
 * - sprinting
 * - jumping
 * - flying
 * - flight toggle
 * - velocity integration
 * - collision solver invocation
 *
 * Does not own:
 * - DOM input events
 * - keyboard repeat handling
 * - double-tap detection internals
 * - camera object mutation
 * - chunk loading
 * - rendering
 * - store mutation
 *
 * The controller receives already-normalized movement intent and returns a new
 * PlayerPhysicsState plus camera binding data.
 */

export interface PlayerPhysicsControllerConfig {
  readonly physics: PhysicsConfig;
  readonly collision: VoxelCollisionSolverConfigPatch;
  readonly yawForwardSign: 1 | -1;
  readonly preserveHorizontalVelocityWhenNoInput: boolean;
  readonly horizontalDampingPerSecond: number;
  readonly airborneHorizontalDampingPerSecond: number;
  readonly flyingDampingPerSecond: number;
}

export interface PlayerPhysicsControllerConfigPatch {
  readonly physics?: PhysicsConfigPatch | null;
  readonly collision?: VoxelCollisionSolverConfigPatch | null;
  readonly yawForwardSign?: unknown;
  readonly preserveHorizontalVelocityWhenNoInput?: unknown;
  readonly horizontalDampingPerSecond?: unknown;
  readonly airborneHorizontalDampingPerSecond?: unknown;
  readonly flyingDampingPerSecond?: unknown;
}

export interface PlayerPhysicsControllerStepInput {
  readonly nowMs: PhysicsTimestampMs;
  readonly deltaSeconds: PhysicsDeltaSeconds;
  readonly movementIntent?: Partial<PlayerMovementIntent> | null;
  readonly lookAngles?: Partial<PhysicsEulerAngles> | null;
  readonly query: VoxelCollisionQueryLike;
}

export interface PlayerPhysicsControllerStepResult extends PhysicsStepResult {
  readonly collisionResult: VoxelCollisionMoveResult | null;
  readonly modeBefore: PlayerMovementMode;
  readonly modeAfter: PlayerMovementMode;
}

export interface PlayerPhysicsControllerSnapshot {
  readonly player: PlayerPhysicsState;
  readonly config: PlayerPhysicsControllerConfig;
  readonly lastStep: PlayerPhysicsControllerStepResult | null;
  readonly revision: number;
}

export const DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG: PlayerPhysicsControllerConfig = Object.freeze({
  physics: DEFAULT_PHYSICS_CONFIG,
  collision: Object.freeze({
    enabled: true,
    includeTraceCells: false,
  }),
  yawForwardSign: 1,
  preserveHorizontalVelocityWhenNoInput: false,
  horizontalDampingPerSecond: 24,
  airborneHorizontalDampingPerSecond: 8,
  flyingDampingPerSecond: 18,
});

function createWarning(message: string): string {
  try {
    return String(message || "Unknown player-physics warning");
  } catch {
    return "Unknown player-physics warning";
  }
}

function normalizeDeltaSeconds(value: unknown): PhysicsDeltaSeconds {
  try {
    return sanitizePhysicsNumber(value, 0, {
      min: 0,
      max: 1,
    });
  } catch {
    return 0;
  }
}

function normalizeTimestampMs(value: unknown): PhysicsTimestampMs {
  try {
    return sanitizePhysicsNumber(value, 0, {
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });
  } catch {
    return 0;
  }
}

function normalizeAngles(value: Partial<PhysicsEulerAngles> | null | undefined): PhysicsEulerAngles {
  try {
    return {
      yaw: sanitizePhysicsNumber(value?.yaw, ZERO_PHYSICS_ANGLES.yaw),
      pitch: sanitizePhysicsNumber(value?.pitch, ZERO_PHYSICS_ANGLES.pitch),
      roll: sanitizePhysicsNumber(value?.roll, ZERO_PHYSICS_ANGLES.roll ?? 0),
    };
  } catch {
    return { ...ZERO_PHYSICS_ANGLES };
  }
}

function normalizeYawForwardSign(value: unknown): 1 | -1 {
  try {
    const numeric = sanitizePhysicsNumber(value, DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.yawForwardSign);
    return numeric < 0 ? -1 : 1;
  } catch {
    return DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.yawForwardSign;
  }
}

function normalizeDamping(value: unknown, fallback: number): number {
  try {
    return sanitizePhysicsNumber(value, fallback, {
      min: 0,
      max: 120,
    });
  } catch {
    return fallback;
  }
}

function clampVelocityComponent(value: unknown, min: number, max: number): number {
  try {
    return sanitizePhysicsNumber(value, 0, {
      min,
      max,
    });
  } catch {
    return 0;
  }
}

function applyExponentialDamping(value: number, dampingPerSecond: number, deltaSeconds: number): number {
  try {
    const safeDamping = Math.max(0, sanitizePhysicsNumber(dampingPerSecond, 0));
    const safeDelta = normalizeDeltaSeconds(deltaSeconds);

    if (safeDamping <= 0 || safeDelta <= 0) {
      return value;
    }

    const factor = Math.exp(-safeDamping * safeDelta);
    const damped = value * factor;

    return Math.abs(damped) < 0.00001 ? 0 : damped;
  } catch {
    return 0;
  }
}

function normalizeHorizontalInput(intent: PlayerMovementIntent): {
  readonly forward: number;
  readonly right: number;
  readonly hasInput: boolean;
} {
  try {
    const forward = sanitizePhysicsNumber(intent.forward, 0, {
      min: -1,
      max: 1,
    });
    const right = sanitizePhysicsNumber(intent.right, 0, {
      min: -1,
      max: 1,
    });

    const length = Math.sqrt(forward * forward + right * right);

    if (!Number.isFinite(length) || length <= 0) {
      return {
        forward: 0,
        right: 0,
        hasInput: false,
      };
    }

    const factor = length > 1 ? 1 / length : 1;

    return {
      forward: forward * factor,
      right: right * factor,
      hasInput: true,
    };
  } catch {
    return {
      forward: 0,
      right: 0,
      hasInput: false,
    };
  }
}

/**
 * Three.js-like FPS basis:
 * - yaw = 0 looks toward -Z
 * - positive X is right
 *
 * MovementIntent convention from physics_models:
 * - forward = -1 means forward
 * - forward =  1 means backward
 * - right   = -1 means left
 * - right   =  1 means right
 */
export function createYawMovementVector(
  intent: PlayerMovementIntent,
  angles: PhysicsEulerAngles,
  options: {
    readonly yawForwardSign?: 1 | -1;
  } = {},
): PhysicsVector3 {
  try {
    const normalized = normalizeHorizontalInput(intent);

    if (!normalized.hasInput) {
      return { ...ZERO_PHYSICS_VECTOR };
    }

    const yaw = sanitizePhysicsNumber(angles.yaw, 0);
    const yawForwardSign = normalizeYawForwardSign(options.yawForwardSign);

    const forwardAmount = -normalized.forward * yawForwardSign;
    const rightAmount = normalized.right;

    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);

    const forwardVector = {
      x: -sinYaw,
      y: 0,
      z: -cosYaw,
    };

    const rightVector = {
      x: cosYaw,
      y: 0,
      z: -sinYaw,
    };

    const x = forwardVector.x * forwardAmount + rightVector.x * rightAmount;
    const z = forwardVector.z * forwardAmount + rightVector.z * rightAmount;
    const length = Math.sqrt(x * x + z * z);

    if (!Number.isFinite(length) || length <= 0) {
      return { ...ZERO_PHYSICS_VECTOR };
    }

    const factor = length > 1 ? 1 / length : 1;

    return {
      x: x * factor,
      y: 0,
      z: z * factor,
    };
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

export function createPlayerPhysicsControllerConfig(
  patch: PlayerPhysicsControllerConfigPatch | null | undefined = undefined,
): PlayerPhysicsControllerConfig {
  try {
    return {
      physics: mergePhysicsConfig(DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.physics, patch?.physics),
      collision: {
        ...DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.collision,
        ...(patch?.collision ?? {}),
      },
      yawForwardSign: normalizeYawForwardSign(patch?.yawForwardSign),
      preserveHorizontalVelocityWhenNoInput: sanitizePhysicsBoolean(
        patch?.preserveHorizontalVelocityWhenNoInput,
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.preserveHorizontalVelocityWhenNoInput,
      ),
      horizontalDampingPerSecond: normalizeDamping(
        patch?.horizontalDampingPerSecond,
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.horizontalDampingPerSecond,
      ),
      airborneHorizontalDampingPerSecond: normalizeDamping(
        patch?.airborneHorizontalDampingPerSecond,
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.airborneHorizontalDampingPerSecond,
      ),
      flyingDampingPerSecond: normalizeDamping(
        patch?.flyingDampingPerSecond,
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.flyingDampingPerSecond,
      ),
    };
  } catch {
    return {
      physics: createDefaultPhysicsConfig(),
      collision: { ...DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.collision },
      yawForwardSign: DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.yawForwardSign,
      preserveHorizontalVelocityWhenNoInput:
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.preserveHorizontalVelocityWhenNoInput,
      horizontalDampingPerSecond:
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.horizontalDampingPerSecond,
      airborneHorizontalDampingPerSecond:
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.airborneHorizontalDampingPerSecond,
      flyingDampingPerSecond:
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.flyingDampingPerSecond,
    };
  }
}

export function mergePlayerPhysicsControllerConfig(
  base: PlayerPhysicsControllerConfig | null | undefined,
  patch: PlayerPhysicsControllerConfigPatch | null | undefined,
): PlayerPhysicsControllerConfig {
  try {
    const safeBase = base ?? DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG;

    return createPlayerPhysicsControllerConfig({
      physics: patch?.physics
        ? mergePhysicsConfig(safeBase.physics, patch.physics)
        : safeBase.physics,
      collision: {
        ...safeBase.collision,
        ...(patch?.collision ?? {}),
      },
      yawForwardSign: patch?.yawForwardSign ?? safeBase.yawForwardSign,
      preserveHorizontalVelocityWhenNoInput:
        patch?.preserveHorizontalVelocityWhenNoInput ??
        safeBase.preserveHorizontalVelocityWhenNoInput,
      horizontalDampingPerSecond:
        patch?.horizontalDampingPerSecond ?? safeBase.horizontalDampingPerSecond,
      airborneHorizontalDampingPerSecond:
        patch?.airborneHorizontalDampingPerSecond ?? safeBase.airborneHorizontalDampingPerSecond,
      flyingDampingPerSecond:
        patch?.flyingDampingPerSecond ?? safeBase.flyingDampingPerSecond,
    });
  } catch {
    return createPlayerPhysicsControllerConfig(patch);
  }
}

export function resolvePlayerMovementMode(
  state: PlayerPhysicsState,
  collisionFlags: CollisionFlags,
): PlayerMovementMode {
  try {
    if (state.flying) {
      return "flying";
    }

    if (collisionFlags.grounded) {
      return "grounded";
    }

    return "airborne";
  } catch {
    return "airborne";
  }
}

export function computeGroundVelocity(params: {
  readonly currentVelocity: PhysicsVector3;
  readonly intent: PlayerMovementIntent;
  readonly angles: PhysicsEulerAngles;
  readonly config: PlayerPhysicsControllerConfig;
  readonly deltaSeconds: PhysicsDeltaSeconds;
}): PhysicsVector3 {
  try {
    const movement = createYawMovementVector(params.intent, params.angles, {
      yawForwardSign: params.config.yawForwardSign,
    });

    const hasInput = Math.abs(movement.x) > 0 || Math.abs(movement.z) > 0;
    const speed = params.intent.sprintHeld
      ? params.config.physics.movement.sprintSpeed
      : params.config.physics.movement.walkSpeed;

    if (hasInput) {
      return {
        x: movement.x * speed,
        y: params.currentVelocity.y,
        z: movement.z * speed,
      };
    }

    if (params.config.preserveHorizontalVelocityWhenNoInput) {
      return {
        x: applyExponentialDamping(
          params.currentVelocity.x,
          params.config.horizontalDampingPerSecond,
          params.deltaSeconds,
        ),
        y: params.currentVelocity.y,
        z: applyExponentialDamping(
          params.currentVelocity.z,
          params.config.horizontalDampingPerSecond,
          params.deltaSeconds,
        ),
      };
    }

    return {
      x: 0,
      y: params.currentVelocity.y,
      z: 0,
    };
  } catch {
    return {
      x: 0,
      y: params.currentVelocity.y,
      z: 0,
    };
  }
}

export function computeAirborneVelocity(params: {
  readonly currentVelocity: PhysicsVector3;
  readonly intent: PlayerMovementIntent;
  readonly angles: PhysicsEulerAngles;
  readonly config: PlayerPhysicsControllerConfig;
  readonly deltaSeconds: PhysicsDeltaSeconds;
}): PhysicsVector3 {
  try {
    const movement = createYawMovementVector(params.intent, params.angles, {
      yawForwardSign: params.config.yawForwardSign,
    });

    const hasInput = Math.abs(movement.x) > 0 || Math.abs(movement.z) > 0;
    const targetSpeed = params.config.physics.movement.airControlSpeed;

    if (!hasInput) {
      return {
        x: applyExponentialDamping(
          params.currentVelocity.x,
          params.config.airborneHorizontalDampingPerSecond,
          params.deltaSeconds,
        ),
        y: params.currentVelocity.y,
        z: applyExponentialDamping(
          params.currentVelocity.z,
          params.config.airborneHorizontalDampingPerSecond,
          params.deltaSeconds,
        ),
      };
    }

    /**
     * Lightweight air control:
     * move horizontal velocity toward intent direction without instantly
     * replacing momentum as strongly as grounded movement.
     */
    const blend = Math.min(1, params.deltaSeconds * 8);

    return {
      x: params.currentVelocity.x * (1 - blend) + movement.x * targetSpeed * blend,
      y: params.currentVelocity.y,
      z: params.currentVelocity.z * (1 - blend) + movement.z * targetSpeed * blend,
    };
  } catch {
    return clonePhysicsVector3(params.currentVelocity);
  }
}

export function computeFlyingVelocity(params: {
  readonly currentVelocity: PhysicsVector3;
  readonly intent: PlayerMovementIntent;
  readonly angles: PhysicsEulerAngles;
  readonly config: PlayerPhysicsControllerConfig;
  readonly deltaSeconds: PhysicsDeltaSeconds;
}): PhysicsVector3 {
  try {
    const movement = createYawMovementVector(params.intent, params.angles, {
      yawForwardSign: params.config.yawForwardSign,
    });

    const speed = params.intent.sprintHeld
      ? params.config.physics.movement.flySprintSpeed
      : params.config.physics.movement.flySpeed;

    let vertical = 0;

    if (params.intent.ascendHeld) {
      vertical += 1;
    }

    if (params.intent.descendHeld) {
      vertical -= 1;
    }

    const hasInput = Math.abs(movement.x) > 0 || Math.abs(movement.z) > 0 || vertical !== 0;

    if (!hasInput) {
      return {
        x: applyExponentialDamping(
          params.currentVelocity.x,
          params.config.flyingDampingPerSecond,
          params.deltaSeconds,
        ),
        y: applyExponentialDamping(
          params.currentVelocity.y,
          params.config.flyingDampingPerSecond,
          params.deltaSeconds,
        ),
        z: applyExponentialDamping(
          params.currentVelocity.z,
          params.config.flyingDampingPerSecond,
          params.deltaSeconds,
        ),
      };
    }

    return {
      x: movement.x * speed,
      y: vertical * speed,
      z: movement.z * speed,
    };
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

export function applyGravityToVelocity(
  velocity: PhysicsVector3,
  config: PhysicsConfig,
  deltaSeconds: PhysicsDeltaSeconds,
): PhysicsVector3 {
  try {
    const gravity = sanitizePhysicsNumber(config.movement.gravity, DEFAULT_PHYSICS_CONFIG.movement.gravity);
    const maxFallSpeed = sanitizePhysicsNumber(
      config.movement.maxFallSpeed,
      DEFAULT_PHYSICS_CONFIG.movement.maxFallSpeed,
    );

    const nextY = Math.max(
      maxFallSpeed,
      sanitizePhysicsNumber(velocity.y, 0) + gravity * normalizeDeltaSeconds(deltaSeconds),
    );

    return {
      x: velocity.x,
      y: nextY,
      z: velocity.z,
    };
  } catch {
    return clonePhysicsVector3(velocity);
  }
}

export function applyJumpToVelocity(
  velocity: PhysicsVector3,
  config: PhysicsConfig,
): PhysicsVector3 {
  try {
    return {
      x: velocity.x,
      y: sanitizePhysicsNumber(config.movement.jumpVelocity, DEFAULT_PHYSICS_CONFIG.movement.jumpVelocity, {
        min: 0,
        max: 100,
      }),
      z: velocity.z,
    };
  } catch {
    return clonePhysicsVector3(velocity);
  }
}

export function computeNextVelocity(params: {
  readonly state: PlayerPhysicsState;
  readonly intent: PlayerMovementIntent;
  readonly angles: PhysicsEulerAngles;
  readonly config: PlayerPhysicsControllerConfig;
  readonly deltaSeconds: PhysicsDeltaSeconds;
  readonly nowMs: PhysicsTimestampMs;
}): {
  readonly state: PlayerPhysicsState;
  readonly velocity: PhysicsVector3;
  readonly warnings: readonly string[];
} {
  try {
    const warnings: string[] = [];
    let state = params.state;
    let velocity = clonePhysicsVector3(state.velocity);

    if (params.intent.toggleFlightRequested) {
      state = setPlayerFlying(state, !state.flying, params.nowMs);
      velocity = clonePhysicsVector3(state.velocity);
    }

    if (state.flying) {
      velocity = computeFlyingVelocity({
        currentVelocity: velocity,
        intent: params.intent,
        angles: params.angles,
        config: params.config,
        deltaSeconds: params.deltaSeconds,
      });

      return {
        state,
        velocity,
        warnings,
      };
    }

    if (state.grounded) {
      velocity = computeGroundVelocity({
        currentVelocity: {
          ...velocity,
          y: 0,
        },
        intent: params.intent,
        angles: params.angles,
        config: params.config,
        deltaSeconds: params.deltaSeconds,
      });

      if (params.intent.jumpPressed) {
        velocity = applyJumpToVelocity(velocity, params.config.physics);
        state = markPlayerAirborne(state, {
          preserveVerticalVelocity: true,
        });

        state = patchAndNormalizePlayerPhysicsState(state, {
          lastJumpAtMs: params.nowMs,
          velocity,
        });
      }
    } else {
      velocity = computeAirborneVelocity({
        currentVelocity: velocity,
        intent: params.intent,
        angles: params.angles,
        config: params.config,
        deltaSeconds: params.deltaSeconds,
      });
    }

    velocity = applyGravityToVelocity(velocity, params.config.physics, params.deltaSeconds);

    velocity = {
      x: clampVelocityComponent(
        velocity.x,
        -params.config.physics.movement.sprintSpeed * 4,
        params.config.physics.movement.sprintSpeed * 4,
      ),
      y: clampVelocityComponent(
        velocity.y,
        params.config.physics.movement.maxFallSpeed,
        Math.max(params.config.physics.movement.jumpVelocity * 2, 1),
      ),
      z: clampVelocityComponent(
        velocity.z,
        -params.config.physics.movement.sprintSpeed * 4,
        params.config.physics.movement.sprintSpeed * 4,
      ),
    };

    return {
      state,
      velocity,
      warnings,
    };
  } catch (error) {
    return {
      state: params.state,
      velocity: clonePhysicsVector3(params.state.velocity),
      warnings: [
        createWarning(
          error instanceof Error
            ? error.message
            : "Failed to compute next player velocity.",
        ),
      ],
    };
  }
}

export function createDeltaFromVelocity(
  velocity: PhysicsVector3,
  deltaSeconds: PhysicsDeltaSeconds,
): PhysicsVector3 {
  try {
    return scalePhysicsVector3(velocity, normalizeDeltaSeconds(deltaSeconds));
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

export function reconcileVelocityAfterCollision(params: {
  readonly requestedVelocity: PhysicsVector3;
  readonly collisionResult: VoxelCollisionMoveResult;
  readonly deltaSeconds: PhysicsDeltaSeconds;
}): PhysicsVector3 {
  try {
    const requested = clonePhysicsVector3(params.requestedVelocity);
    const result = params.collisionResult;
    const dt = normalizeDeltaSeconds(params.deltaSeconds);

    if (dt <= 0) {
      return { ...ZERO_PHYSICS_VECTOR };
    }

    const velocityFromAppliedDelta = scalePhysicsVector3(result.appliedDelta, 1 / dt);

    return {
      x: result.blockedAxes.includes("x") ? 0 : velocityFromAppliedDelta.x,
      y:
        result.blockedAxes.includes("y") ||
        result.collisionFlags.grounded ||
        result.collisionFlags.hitCeiling
          ? 0
          : velocityFromAppliedDelta.y,
      z: result.blockedAxes.includes("z") ? 0 : velocityFromAppliedDelta.z,
    };
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

export function reconcileStateAfterCollision(params: {
  readonly state: PlayerPhysicsState;
  readonly velocity: PhysicsVector3;
  readonly collisionResult: VoxelCollisionMoveResult;
  readonly nowMs: PhysicsTimestampMs;
}): PlayerPhysicsState {
  try {
    const result = params.collisionResult;
    const position = getAabbBasePositionFromResolvedAabb(result.finalAabb);
    const velocity = reconcileVelocityAfterCollision({
      requestedVelocity: params.velocity,
      collisionResult: result,
      deltaSeconds: 1,
    });

    const nextMode = params.state.flying
      ? "flying"
      : result.collisionFlags.grounded
        ? "grounded"
        : "airborne";

    let next = patchAndNormalizePlayerPhysicsState(params.state, {
      position,
      velocity,
      movementMode: nextMode,
      grounded: nextMode === "grounded",
      flying: nextMode === "flying",
      collisionFlags: result.collisionFlags,
    });

    if (nextMode === "grounded") {
      next = markPlayerGrounded(next, params.nowMs);
    }

    return next;
  } catch {
    return params.state;
  }
}

export function createFailedPhysicsStepResult(params: {
  readonly phase: PhysicsStepPhase;
  readonly previousState: PlayerPhysicsState;
  readonly angles: PhysicsEulerAngles;
  readonly message: string;
  readonly cause?: unknown;
}): PlayerPhysicsControllerStepResult {
  try {
    const camera = createPhysicsCameraBinding(params.previousState, params.angles);

    return {
      ok: false,
      phase: params.phase,
      previousState: params.previousState,
      nextState: params.previousState,
      camera,
      collisionTrace: undefined,
      error: createPhysicsError("PLAYER_PHYSICS_STEP_FAILED", params.message, {
        cause: params.cause,
        recoverable: true,
      }),
      warnings: [createWarning(params.message)],
      collisionResult: null,
      modeBefore: params.previousState.movementMode,
      modeAfter: params.previousState.movementMode,
    };
  } catch {
    return {
      ok: false,
      phase: "failed",
      previousState: params.previousState,
      nextState: params.previousState,
      camera: {
        bodyPosition: params.previousState.position,
        eyePosition: params.previousState.position,
        angles: params.angles,
      },
      error: createPhysicsError("PLAYER_PHYSICS_STEP_FAILED", "Player physics step failed.", {
        recoverable: true,
      }),
      warnings: ["Player physics step failed."],
      collisionResult: null,
      modeBefore: params.previousState.movementMode,
      modeAfter: params.previousState.movementMode,
    };
  }
}

export class PlayerPhysicsController {
  private state: PlayerPhysicsState;
  private config: PlayerPhysicsControllerConfig;
  private readonly collisionSolver: VoxelCollisionSolver;
  private lastStep: PlayerPhysicsControllerStepResult | null;
  private revision: number;

  public constructor(options: {
    readonly initialState?: PlayerPhysicsState | null;
    readonly config?: PlayerPhysicsControllerConfigPatch | null;
  } = {}) {
    this.config = createPlayerPhysicsControllerConfig(options.config);
    this.state =
      options.initialState ??
      createInitialPlayerPhysicsState(
        {
          position: { x: 0, y: 8, z: 0 },
          movementMode: "airborne",
        },
        this.config.physics,
      );

    this.collisionSolver = createVoxelCollisionSolver(this.config.collision);
    this.lastStep = null;
    this.revision = 0;
  }

  public getState(): PlayerPhysicsState {
    try {
      return this.state;
    } catch {
      return createInitialPlayerPhysicsState(null, this.config.physics);
    }
  }

  public setState(state: PlayerPhysicsState): PlayerPhysicsState {
    try {
      this.state = state;
      this.revision += 1;
      return this.state;
    } catch {
      return this.state;
    }
  }

  public patchState(patch: Parameters<typeof patchAndNormalizePlayerPhysicsState>[1]): PlayerPhysicsState {
    try {
      this.state = patchAndNormalizePlayerPhysicsState(this.state, patch);
      this.revision += 1;
      return this.state;
    } catch {
      return this.state;
    }
  }

  public updateConfig(config: PlayerPhysicsControllerConfigPatch | null | undefined): PlayerPhysicsControllerConfig {
    try {
      this.config = mergePlayerPhysicsControllerConfig(this.config, config);
      this.collisionSolver.updateConfig(this.config.collision);
      this.revision += 1;
      return this.config;
    } catch {
      this.config = createPlayerPhysicsControllerConfig(config);
      this.collisionSolver.updateConfig(this.config.collision);
      this.revision += 1;
      return this.config;
    }
  }

  public getConfig(): PlayerPhysicsControllerConfig {
    try {
      return {
        ...this.config,
        physics: createDefaultPhysicsConfig(this.config.physics),
        collision: {
          ...this.config.collision,
        },
      };
    } catch {
      return createPlayerPhysicsControllerConfig();
    }
  }

  public setFlying(flying: boolean, nowMs: PhysicsTimestampMs | null = null): PlayerPhysicsState {
    try {
      this.state = setPlayerFlying(this.state, flying, nowMs);
      this.revision += 1;
      return this.state;
    } catch {
      return this.state;
    }
  }

  public reset(state: PlayerPhysicsState): PlayerPhysicsState {
    try {
      this.state = state;
      this.lastStep = null;
      this.collisionSolver.reset();
      this.revision += 1;
      return this.state;
    } catch {
      return this.state;
    }
  }

  public step(input: PlayerPhysicsControllerStepInput): PlayerPhysicsControllerStepResult {
    const previousState = this.state;
    const modeBefore = previousState.movementMode;
    const nowMs = normalizeTimestampMs(input.nowMs);
    const deltaSeconds = normalizeDeltaSeconds(input.deltaSeconds);
    const intent = normalizeMovementIntent(input.movementIntent ?? EMPTY_PLAYER_MOVEMENT_INTENT);
    const angles = normalizeAngles(input.lookAngles);

    try {
      if (!this.config.physics.enabled) {
        const camera = createPhysicsCameraBinding(previousState, angles);

        const result: PlayerPhysicsControllerStepResult = {
          ok: true,
          phase: "idle",
          previousState,
          nextState: previousState,
          camera,
          collisionResult: null,
          modeBefore,
          modeAfter: previousState.movementMode,
          warnings: [createWarning("Player physics controller is disabled.")],
        };

        this.lastStep = result;
        return result;
      }

      if (deltaSeconds <= 0) {
        const camera = createPhysicsCameraBinding(previousState, angles);

        const result: PlayerPhysicsControllerStepResult = {
          ok: true,
          phase: "idle",
          previousState,
          nextState: previousState,
          camera,
          collisionResult: null,
          modeBefore,
          modeAfter: previousState.movementMode,
          warnings: [],
        };

        this.lastStep = result;
        return result;
      }

      const velocityResult = computeNextVelocity({
        state: previousState,
        intent,
        angles,
        config: this.config,
        deltaSeconds,
        nowMs,
      });

      const stateBeforeCollision = patchAndNormalizePlayerPhysicsState(velocityResult.state, {
        velocity: velocityResult.velocity,
      });

      const currentAabb = createPlayerAabbFromPosition(
        stateBeforeCollision.position,
        stateBeforeCollision.collider,
      );

      const delta = createDeltaFromVelocity(velocityResult.velocity, deltaSeconds);

      const collisionResult = this.collisionSolver.move({
        aabb: currentAabb,
        delta,
        query: input.query,
        config: {
          ...this.config.collision,
          skinWidth: stateBeforeCollision.collider.skinWidth,
          includeTraceCells:
            Boolean(this.config.collision.includeTraceCells) ||
            this.config.physics.debug.includeCollisionCells,
        },
      });

      let nextState = reconcileStateAfterCollision({
        state: stateBeforeCollision,
        velocity: velocityResult.velocity,
        collisionResult,
        nowMs,
      });

      /**
       * reconcileVelocityAfterCollision above uses a normalized dt=1 when called
       * through reconcileStateAfterCollision for safe shape preservation. Correct
       * the actual velocity here using the real frame dt.
       */
      const correctedVelocity = reconcileVelocityAfterCollision({
        requestedVelocity: velocityResult.velocity,
        collisionResult,
        deltaSeconds,
      });

      nextState = patchAndNormalizePlayerPhysicsState(nextState, {
        velocity: correctedVelocity,
        movementMode: resolvePlayerMovementMode(nextState, collisionResult.collisionFlags),
        grounded: collisionResult.collisionFlags.grounded && !nextState.flying,
        flying: nextState.flying,
        collisionFlags: collisionResult.collisionFlags,
      });

      if (!nextState.flying && collisionResult.collisionFlags.grounded) {
        nextState = markPlayerGrounded(nextState, nowMs);
      }

      this.state = nextState;
      this.revision += 1;

      const camera = createPhysicsCameraBinding(nextState, angles);
      const warnings = [
        ...velocityResult.warnings,
        ...collisionResult.warnings,
      ];

      const result: PlayerPhysicsControllerStepResult = {
        ok: collisionResult.ok,
        phase: collisionResult.ok ? "commit" : "failed",
        previousState,
        nextState,
        camera,
        collisionTrace: collisionResult.trace,
        error: collisionResult.ok
          ? undefined
          : createPhysicsError("PLAYER_COLLISION_FAILED", "Player collision resolution failed.", {
              recoverable: true,
            }),
        warnings,
        collisionResult,
        modeBefore,
        modeAfter: nextState.movementMode,
      };

      this.lastStep = result;
      return result;
    } catch (error) {
      const result = createFailedPhysicsStepResult({
        phase: "failed",
        previousState,
        angles,
        message:
          error instanceof Error
            ? error.message
            : "Player physics controller step failed.",
        cause: error,
      });

      this.lastStep = result;
      return result;
    }
  }

  public stepFromPhysicsInput(
    input: PhysicsStepInput & {
      readonly query: VoxelCollisionQueryLike;
    },
  ): PlayerPhysicsControllerStepResult {
    try {
      this.updateConfig({
        physics: input.config,
      });

      return this.step({
        nowMs: input.nowMs,
        deltaSeconds: input.deltaSeconds,
        movementIntent: input.movementIntent,
        lookAngles: input.lookAngles,
        query: input.query,
      });
    } catch (error) {
      return createFailedPhysicsStepResult({
        phase: "failed",
        previousState: this.state,
        angles: input.lookAngles,
        message:
          error instanceof Error
            ? error.message
            : "Failed to step player physics from PhysicsStepInput.",
        cause: error,
      });
    }
  }

  public getCameraBinding(angles: PhysicsEulerAngles = ZERO_PHYSICS_ANGLES): PhysicsCameraBinding {
    try {
      return createPhysicsCameraBinding(this.state, angles);
    } catch {
      return createPhysicsCameraBinding(this.state, ZERO_PHYSICS_ANGLES);
    }
  }

  public getLastStep(): PlayerPhysicsControllerStepResult | null {
    try {
      return this.lastStep;
    } catch {
      return null;
    }
  }

  public snapshot(): PlayerPhysicsControllerSnapshot {
    try {
      return {
        player: this.state,
        config: this.getConfig(),
        lastStep: this.lastStep,
        revision: this.revision,
      };
    } catch {
      return {
        player: createInitialPlayerPhysicsState(null, this.config.physics),
        config: createPlayerPhysicsControllerConfig(),
        lastStep: null,
        revision: 0,
      };
    }
  }
}

export function createPlayerPhysicsController(options: {
  readonly initialState?: PlayerPhysicsState | null;
  readonly config?: PlayerPhysicsControllerConfigPatch | null;
} = {}): PlayerPhysicsController {
  try {
    return new PlayerPhysicsController(options);
  } catch {
    return new PlayerPhysicsController();
  }
}