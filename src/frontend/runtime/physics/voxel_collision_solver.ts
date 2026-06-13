// src/frontend/runtime/physics/voxel_collision_solver.ts

import type {
  CollisionFlags,
  CollisionTrace,
  PhysicsAabb,
  PhysicsAxis,
  PhysicsVector3,
} from "./physics_models";

import {
  createCollisionFlags,
  createPhysicsAabb,
  sanitizePhysicsBoolean,
  sanitizePhysicsNumber,
  sanitizePhysicsString,
  ZERO_PHYSICS_VECTOR,
} from "./physics_models";

import type {
  AabbAxisMotionLimit,
  AabbCellRef,
} from "./aabb";

import {
  AABB_DEFAULT_EPSILON,
  AABB_DEFAULT_SKIN_WIDTH,
  cloneAabb,
  computeNearestAllowedAxisDelta,
  createCeilingProbeAabb,
  createGroundProbeAabb,
  getAabbCellRange,
  getAabbDebugString,
  translateAabb,
  translateAabbAxis,
} from "./aabb";

import type {
  BlockCollisionAabbResult,
  BlockCollisionQuery,
  BlockCollisionQueryCellResult,
} from "./block_collision_query";

/**
 * Voxel collision solver for player/body movement.
 *
 * This file owns collision resolution only.
 *
 * It does not:
 * - read keyboard/mouse input
 * - apply gravity
 * - toggle flight
 * - mutate camera state
 * - load chunks
 * - perform HTTP calls
 * - render debug geometry
 *
 * The solver receives:
 * - current AABB
 * - requested movement delta
 * - collision query
 *
 * The solver returns:
 * - corrected AABB
 * - applied movement delta
 * - collision flags
 * - trace/debug metadata
 */

export interface VoxelCollisionQueryLike {
  readonly getBlockingBlockAabbsForAabb: (
    aabb: PhysicsAabb,
    options?: {
      readonly maxCells?: number;
      readonly includeTraceCells?: boolean;
    },
  ) => BlockCollisionAabbResult;

  readonly getCollisionCellsForAabb?: (
    aabb: PhysicsAabb,
    options?: {
      readonly includeAirCells?: boolean;
      readonly stopAtFirstSolid?: boolean;
      readonly includeTraceCells?: boolean;
      readonly maxCells?: number;
    },
  ) => {
    readonly checkedCellCount: number;
    readonly solidCellCount: number;
    readonly missingCellCount: number;
    readonly cells: readonly BlockCollisionQueryCellResult[];
    readonly solidCells: readonly BlockCollisionQueryCellResult[];
    readonly trace: CollisionTrace;
    readonly warnings: readonly string[];
  };

  readonly hasSolidCollision?: (aabb: PhysicsAabb) => boolean;
}

export interface VoxelCollisionSolverConfig {
  readonly enabled: boolean;
  readonly epsilon: number;
  readonly skinWidth: number;
  readonly maxCellsPerQuery: number;
  readonly includeTraceCells: boolean;
  readonly groundProbeDistance: number;
  readonly ceilingProbeDistance: number;
  readonly axisOrder: readonly PhysicsAxis[];
}

export interface VoxelCollisionSolverConfigPatch {
  readonly enabled?: unknown;
  readonly epsilon?: unknown;
  readonly skinWidth?: unknown;
  readonly maxCellsPerQuery?: unknown;
  readonly includeTraceCells?: unknown;
  readonly groundProbeDistance?: unknown;
  readonly ceilingProbeDistance?: unknown;
  readonly axisOrder?: readonly PhysicsAxis[] | null;
}

export interface VoxelCollisionMoveInput {
  readonly aabb: PhysicsAabb;
  readonly delta: Partial<PhysicsVector3>;
  readonly query: VoxelCollisionQueryLike | BlockCollisionQuery;
  readonly config?: VoxelCollisionSolverConfigPatch | null;
}

export interface VoxelCollisionAxisResult {
  readonly axis: PhysicsAxis;
  readonly requestedDelta: number;
  readonly appliedDelta: number;
  readonly blocked: boolean;
  readonly beforeAabb: PhysicsAabb;
  readonly afterAabb: PhysicsAabb;
  readonly collisionResult: BlockCollisionAabbResult;
  readonly motionLimit: AabbAxisMotionLimit;
  readonly warnings: readonly string[];
}

export interface VoxelCollisionMoveResult {
  readonly ok: boolean;
  readonly originalAabb: PhysicsAabb;
  readonly finalAabb: PhysicsAabb;
  readonly requestedDelta: PhysicsVector3;
  readonly appliedDelta: PhysicsVector3;
  readonly remainingDelta: PhysicsVector3;
  readonly blockedAxes: readonly PhysicsAxis[];
  readonly axisResults: readonly VoxelCollisionAxisResult[];
  readonly collisionFlags: CollisionFlags;
  readonly groundCheck: VoxelCollisionProbeResult;
  readonly ceilingCheck: VoxelCollisionProbeResult;
  readonly trace: CollisionTrace;
  readonly warnings: readonly string[];
}

export interface VoxelCollisionProbeResult {
  readonly collides: boolean;
  readonly checkedCellCount: number;
  readonly solidCellCount: number;
  readonly missingCellCount: number;
  readonly cells: readonly BlockCollisionQueryCellResult[];
  readonly trace: CollisionTrace;
  readonly warnings: readonly string[];
}

export interface VoxelCollisionSolverSnapshot {
  readonly config: VoxelCollisionSolverConfig;
  readonly lastResult: VoxelCollisionMoveResult | null;
  readonly revision: number;
}

export const DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG: VoxelCollisionSolverConfig = Object.freeze({
  enabled: true,
  epsilon: AABB_DEFAULT_EPSILON,
  skinWidth: AABB_DEFAULT_SKIN_WIDTH,
  maxCellsPerQuery: 262_144,
  includeTraceCells: false,
  groundProbeDistance: 0.04,
  ceilingProbeDistance: 0.04,
  axisOrder: Object.freeze(["x", "z", "y"] as const),
});

export const EMPTY_VOXEL_COLLISION_TRACE: CollisionTrace = Object.freeze({
  checkedCellCount: 0,
  solidCellCount: 0,
  missingCellCount: 0,
  cells: [],
});

function createWarning(message: string): string {
  try {
    return sanitizePhysicsString(message, "Unknown voxel-collision warning");
  } catch {
    return "Unknown voxel-collision warning";
  }
}

function normalizeAxis(value: unknown): PhysicsAxis | null {
  try {
    if (value === "x" || value === "y" || value === "z") {
      return value;
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeAxisOrder(value: readonly PhysicsAxis[] | null | undefined): readonly PhysicsAxis[] {
  try {
    const result: PhysicsAxis[] = [];

    for (const item of value ?? []) {
      const axis = normalizeAxis(item);

      if (axis && !result.includes(axis)) {
        result.push(axis);
      }
    }

    for (const fallbackAxis of DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.axisOrder) {
      if (!result.includes(fallbackAxis)) {
        result.push(fallbackAxis);
      }
    }

    return Object.freeze(result);
  } catch {
    return DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.axisOrder;
  }
}

function getDeltaForAxis(delta: PhysicsVector3, axis: PhysicsAxis): number {
  try {
    return sanitizePhysicsNumber(delta[axis], 0);
  } catch {
    return 0;
  }
}

function setDeltaForAxis(delta: PhysicsVector3, axis: PhysicsAxis, value: number): PhysicsVector3 {
  try {
    if (axis === "x") {
      return {
        x: value,
        y: delta.y,
        z: delta.z,
      };
    }

    if (axis === "y") {
      return {
        x: delta.x,
        y: value,
        z: delta.z,
      };
    }

    return {
      x: delta.x,
      y: delta.y,
      z: value,
    };
  } catch {
    return delta;
  }
}

function addDeltaForAxis(delta: PhysicsVector3, axis: PhysicsAxis, value: number): PhysicsVector3 {
  try {
    return setDeltaForAxis(
      delta,
      axis,
      getDeltaForAxis(delta, axis) + sanitizePhysicsNumber(value, 0),
    );
  } catch {
    return delta;
  }
}

function normalizeMoveDelta(value: Partial<PhysicsVector3> | null | undefined): PhysicsVector3 {
  try {
    return {
      x: sanitizePhysicsNumber(value?.x, 0),
      y: sanitizePhysicsNumber(value?.y, 0),
      z: sanitizePhysicsNumber(value?.z, 0),
    };
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

function createEmptyProbeResult(warnings: readonly string[] = []): VoxelCollisionProbeResult {
  try {
    return {
      collides: false,
      checkedCellCount: 0,
      solidCellCount: 0,
      missingCellCount: 0,
      cells: [],
      trace: {
        ...EMPTY_VOXEL_COLLISION_TRACE,
      },
      warnings,
    };
  } catch {
    return {
      collides: false,
      checkedCellCount: 0,
      solidCellCount: 0,
      missingCellCount: 0,
      cells: [],
      trace: {
        checkedCellCount: 0,
        solidCellCount: 0,
        missingCellCount: 0,
        cells: [],
      },
      warnings: [],
    };
  }
}

function combineTraces(
  traces: readonly (CollisionTrace | null | undefined)[],
  includeCells: boolean,
): CollisionTrace {
  try {
    let checkedCellCount = 0;
    let solidCellCount = 0;
    let missingCellCount = 0;
    const cells = [];

    for (const trace of traces) {
      if (!trace) {
        continue;
      }

      checkedCellCount += Math.max(0, Math.floor(sanitizePhysicsNumber(trace.checkedCellCount, 0)));
      solidCellCount += Math.max(0, Math.floor(sanitizePhysicsNumber(trace.solidCellCount, 0)));
      missingCellCount += Math.max(0, Math.floor(sanitizePhysicsNumber(trace.missingCellCount, 0)));

      if (includeCells && Array.isArray(trace.cells)) {
        cells.push(...trace.cells);
      }
    }

    return {
      checkedCellCount,
      solidCellCount,
      missingCellCount,
      cells: includeCells ? cells : undefined,
    };
  } catch {
    return {
      ...EMPTY_VOXEL_COLLISION_TRACE,
    };
  }
}

function createFallbackCollisionAabbResult(
  aabb: PhysicsAabb,
  warning: string,
): BlockCollisionAabbResult {
  try {
    return {
      collides: true,
      blockingAabbs: [cloneAabb(aabb)],
      cellsResult: {
        ok: false,
        range: getAabbCellRange(aabb),
        checkedCellCount: 0,
        solidCellCount: 1,
        missingCellCount: 1,
        cells: [],
        solidCells: [],
        trace: {
          checkedCellCount: 0,
          solidCellCount: 1,
          missingCellCount: 1,
          cells: [],
        },
        warnings: [createWarning(warning)],
      },
    };
  } catch {
    return {
      collides: true,
      blockingAabbs: [],
      cellsResult: {
        ok: false,
        range: {
          minX: 0,
          minY: 0,
          minZ: 0,
          maxX: 0,
          maxY: 0,
          maxZ: 0,
        },
        checkedCellCount: 0,
        solidCellCount: 1,
        missingCellCount: 1,
        cells: [],
        solidCells: [],
        trace: {
          checkedCellCount: 0,
          solidCellCount: 1,
          missingCellCount: 1,
          cells: [],
        },
        warnings: [createWarning(warning)],
      },
    };
  }
}

function safeGetBlockingAabbs(
  query: VoxelCollisionQueryLike,
  aabb: PhysicsAabb,
  config: VoxelCollisionSolverConfig,
): BlockCollisionAabbResult {
  try {
    if (!query || typeof query.getBlockingBlockAabbsForAabb !== "function") {
      return createFallbackCollisionAabbResult(aabb, "Collision query was unavailable.");
    }

    return query.getBlockingBlockAabbsForAabb(aabb, {
      maxCells: config.maxCellsPerQuery,
      includeTraceCells: config.includeTraceCells,
    });
  } catch (error) {
    return createFallbackCollisionAabbResult(
      aabb,
      error instanceof Error
        ? error.message
        : "Collision query failed while collecting blocking AABBs.",
    );
  }
}

function safeProbe(
  query: VoxelCollisionQueryLike,
  probeAabb: PhysicsAabb,
  config: VoxelCollisionSolverConfig,
): VoxelCollisionProbeResult {
  try {
    if (typeof query.getCollisionCellsForAabb === "function") {
      const result = query.getCollisionCellsForAabb(probeAabb, {
        includeAirCells: false,
        stopAtFirstSolid: false,
        includeTraceCells: config.includeTraceCells,
        maxCells: config.maxCellsPerQuery,
      });

      return {
        collides: result.solidCells.length > 0,
        checkedCellCount: result.checkedCellCount,
        solidCellCount: result.solidCellCount,
        missingCellCount: result.missingCellCount,
        cells: result.solidCells,
        trace: result.trace,
        warnings: result.warnings,
      };
    }

    const blocking = safeGetBlockingAabbs(query, probeAabb, config);

    return {
      collides: blocking.collides,
      checkedCellCount: blocking.cellsResult.checkedCellCount,
      solidCellCount: blocking.cellsResult.solidCellCount,
      missingCellCount: blocking.cellsResult.missingCellCount,
      cells: blocking.cellsResult.solidCells,
      trace: blocking.cellsResult.trace,
      warnings: blocking.cellsResult.warnings,
    };
  } catch (error) {
    return createEmptyProbeResult([
      createWarning(
        error instanceof Error
          ? error.message
          : "Collision probe failed.",
      ),
    ]);
  }
}

export function createVoxelCollisionSolverConfig(
  patch: VoxelCollisionSolverConfigPatch | null | undefined = undefined,
): VoxelCollisionSolverConfig {
  try {
    return {
      enabled: sanitizePhysicsBoolean(patch?.enabled, DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.enabled),
      epsilon: sanitizePhysicsNumber(patch?.epsilon, DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.epsilon, {
        min: 0,
        max: 0.1,
      }),
      skinWidth: sanitizePhysicsNumber(
        patch?.skinWidth,
        DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.skinWidth,
        {
          min: 0,
          max: 0.25,
        },
      ),
      maxCellsPerQuery: Math.max(
        1,
        Math.floor(
          sanitizePhysicsNumber(
            patch?.maxCellsPerQuery,
            DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.maxCellsPerQuery,
            {
              min: 1,
              max: 262_144,
            },
          ),
        ),
      ),
      includeTraceCells: sanitizePhysicsBoolean(
        patch?.includeTraceCells,
        DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.includeTraceCells,
      ),
      groundProbeDistance: sanitizePhysicsNumber(
        patch?.groundProbeDistance,
        DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.groundProbeDistance,
        {
          min: 0,
          max: 0.5,
        },
      ),
      ceilingProbeDistance: sanitizePhysicsNumber(
        patch?.ceilingProbeDistance,
        DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.ceilingProbeDistance,
        {
          min: 0,
          max: 0.5,
        },
      ),
      axisOrder: normalizeAxisOrder(patch?.axisOrder),
    };
  } catch {
    return { ...DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG };
  }
}

export function mergeVoxelCollisionSolverConfig(
  base: VoxelCollisionSolverConfig | null | undefined,
  patch: VoxelCollisionSolverConfigPatch | null | undefined,
): VoxelCollisionSolverConfig {
  try {
    return createVoxelCollisionSolverConfig({
      ...(base ?? DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG),
      ...(patch ?? {}),
    });
  } catch {
    return createVoxelCollisionSolverConfig(patch);
  }
}

export function resolveAabbMovementAxis(
  aabb: PhysicsAabb,
  axis: PhysicsAxis,
  requestedDelta: unknown,
  query: VoxelCollisionQueryLike,
  config: VoxelCollisionSolverConfig,
): VoxelCollisionAxisResult {
  try {
    const safeAabb = cloneAabb(aabb);
    const delta = sanitizePhysicsNumber(requestedDelta, 0);
    const warnings: string[] = [];

    if (!config.enabled || Math.abs(delta) <= config.epsilon) {
      const noMoveResult = safeGetBlockingAabbs(query, safeAabb, config);
      const motionLimit: AabbAxisMotionLimit = {
        axis,
        requestedDelta: delta,
        allowedDelta: 0,
        blocked: false,
        blockingCell: null,
      };

      return {
        axis,
        requestedDelta: delta,
        appliedDelta: 0,
        blocked: false,
        beforeAabb: safeAabb,
        afterAabb: safeAabb,
        collisionResult: noMoveResult,
        motionLimit,
        warnings,
      };
    }

    const targetAabb = translateAabbAxis(safeAabb, axis, delta);
    const collisionResult = safeGetBlockingAabbs(query, targetAabb, config);

    warnings.push(...collisionResult.cellsResult.warnings);

    const motionLimit = computeNearestAllowedAxisDelta(
      safeAabb,
      collisionResult.blockingAabbs,
      axis,
      delta,
      config.epsilon,
    );

    const appliedDelta =
      Math.abs(motionLimit.allowedDelta) <= config.epsilon
        ? 0
        : motionLimit.allowedDelta;

    const afterAabb = translateAabbAxis(safeAabb, axis, appliedDelta);
    const blocked = motionLimit.blocked || Math.abs(appliedDelta - delta) > config.epsilon;

    return {
      axis,
      requestedDelta: delta,
      appliedDelta,
      blocked,
      beforeAabb: safeAabb,
      afterAabb,
      collisionResult,
      motionLimit: {
        ...motionLimit,
        allowedDelta: appliedDelta,
        blocked,
      },
      warnings,
    };
  } catch (error) {
    const safeAabb = cloneAabb(aabb);
    const collisionResult = createFallbackCollisionAabbResult(
      safeAabb,
      error instanceof Error
        ? error.message
        : `Collision resolution failed on ${axis}-axis.`,
    );

    return {
      axis,
      requestedDelta: sanitizePhysicsNumber(requestedDelta, 0),
      appliedDelta: 0,
      blocked: true,
      beforeAabb: safeAabb,
      afterAabb: safeAabb,
      collisionResult,
      motionLimit: {
        axis,
        requestedDelta: sanitizePhysicsNumber(requestedDelta, 0),
        allowedDelta: 0,
        blocked: true,
        blockingCell: null,
      },
      warnings: collisionResult.cellsResult.warnings,
    };
  }
}

export function resolveAabbMovement(
  input: VoxelCollisionMoveInput,
): VoxelCollisionMoveResult {
  try {
    const config = createVoxelCollisionSolverConfig(input.config);
    const originalAabb = cloneAabb(input.aabb);
    const requestedDelta = normalizeMoveDelta(input.delta);
    const warnings: string[] = [];

    if (!config.enabled) {
      const finalAabb = translateAabb(originalAabb, requestedDelta);
      const groundCheck = createEmptyProbeResult();
      const ceilingCheck = createEmptyProbeResult();

      return {
        ok: true,
        originalAabb,
        finalAabb,
        requestedDelta,
        appliedDelta: requestedDelta,
        remainingDelta: { ...ZERO_PHYSICS_VECTOR },
        blockedAxes: [],
        axisResults: [],
        collisionFlags: createCollisionFlags(),
        groundCheck,
        ceilingCheck,
        trace: {
          ...EMPTY_VOXEL_COLLISION_TRACE,
        },
        warnings: [createWarning("Voxel collision solver is disabled.")],
      };
    }

    let currentAabb = originalAabb;
    let appliedDelta = { ...ZERO_PHYSICS_VECTOR };
    const axisResults: VoxelCollisionAxisResult[] = [];
    const blockedAxes: PhysicsAxis[] = [];

    for (const axis of config.axisOrder) {
      const deltaForAxis = getDeltaForAxis(requestedDelta, axis);

      const axisResult = resolveAabbMovementAxis(
        currentAabb,
        axis,
        deltaForAxis,
        input.query,
        config,
      );

      axisResults.push(axisResult);
      warnings.push(...axisResult.warnings);

      currentAabb = axisResult.afterAabb;
      appliedDelta = addDeltaForAxis(appliedDelta, axis, axisResult.appliedDelta);

      if (axisResult.blocked && !blockedAxes.includes(axis)) {
        blockedAxes.push(axis);
      }
    }

    const groundCheck = safeProbe(
      input.query,
      createGroundProbeAabb(currentAabb, config.groundProbeDistance),
      config,
    );

    const ceilingCheck = safeProbe(
      input.query,
      createCeilingProbeAabb(currentAabb, config.ceilingProbeDistance),
      config,
    );

    warnings.push(...groundCheck.warnings, ...ceilingCheck.warnings);

    const hitWallX = blockedAxes.includes("x");
    const hitWallZ = blockedAxes.includes("z");
    const hitCeiling = blockedAxes.includes("y") && requestedDelta.y > 0;
    const hitGroundFromMovement = blockedAxes.includes("y") && requestedDelta.y < 0;
    const grounded = groundCheck.collides || hitGroundFromMovement;

    const collisionFlags = createCollisionFlags({
      grounded,
      hitCeiling: hitCeiling || ceilingCheck.collides,
      hitWallX,
      hitWallZ,
      hitHorizontalWall: hitWallX || hitWallZ,
      touchedSolid:
        grounded ||
        hitCeiling ||
        hitWallX ||
        hitWallZ ||
        axisResults.some((result) => result.collisionResult.collides),
      blockedByMissingChunk:
        groundCheck.missingCellCount > 0 ||
        ceilingCheck.missingCellCount > 0 ||
        axisResults.some((result) => result.collisionResult.cellsResult.missingCellCount > 0),
    });

    const remainingDelta = {
      x: requestedDelta.x - appliedDelta.x,
      y: requestedDelta.y - appliedDelta.y,
      z: requestedDelta.z - appliedDelta.z,
    };

    const trace = combineTraces(
      [
        ...axisResults.map((result) => result.collisionResult.cellsResult.trace),
        groundCheck.trace,
        ceilingCheck.trace,
      ],
      config.includeTraceCells,
    );

    return {
      ok: true,
      originalAabb,
      finalAabb: currentAabb,
      requestedDelta,
      appliedDelta,
      remainingDelta,
      blockedAxes,
      axisResults,
      collisionFlags,
      groundCheck,
      ceilingCheck,
      trace,
      warnings,
    };
  } catch (error) {
    const originalAabb = cloneAabb(input?.aabb);
    const warnings = [
      createWarning(
        error instanceof Error
          ? error.message
          : "Voxel collision movement resolution failed.",
      ),
    ];

    return {
      ok: false,
      originalAabb,
      finalAabb: originalAabb,
      requestedDelta: normalizeMoveDelta(input?.delta),
      appliedDelta: { ...ZERO_PHYSICS_VECTOR },
      remainingDelta: normalizeMoveDelta(input?.delta),
      blockedAxes: ["x", "y", "z"],
      axisResults: [],
      collisionFlags: createCollisionFlags({
        hitCeiling: true,
        hitWallX: true,
        hitWallZ: true,
        hitHorizontalWall: true,
        touchedSolid: true,
        blockedByMissingChunk: true,
      }),
      groundCheck: createEmptyProbeResult(warnings),
      ceilingCheck: createEmptyProbeResult(warnings),
      trace: {
        ...EMPTY_VOXEL_COLLISION_TRACE,
      },
      warnings,
    };
  }
}

export function getAabbBasePositionFromResolvedAabb(
  aabb: PhysicsAabb,
): PhysicsVector3 {
  try {
    const safe = cloneAabb(aabb);

    return {
      x: (safe.min.x + safe.max.x) / 2,
      y: safe.min.y,
      z: (safe.min.z + safe.max.z) / 2,
    };
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

export function createResolvedAabbFromBasePosition(
  basePosition: PhysicsVector3,
  width: unknown,
  height: unknown,
): PhysicsAabb {
  try {
    const safeWidth = Math.max(0.01, sanitizePhysicsNumber(width, 0.6));
    const safeHeight = Math.max(0.01, sanitizePhysicsNumber(height, 1.8));
    const halfWidth = safeWidth / 2;

    return createPhysicsAabb(
      {
        x: sanitizePhysicsNumber(basePosition.x, 0) - halfWidth,
        y: sanitizePhysicsNumber(basePosition.y, 0),
        z: sanitizePhysicsNumber(basePosition.z, 0) - halfWidth,
      },
      {
        x: sanitizePhysicsNumber(basePosition.x, 0) + halfWidth,
        y: sanitizePhysicsNumber(basePosition.y, 0) + safeHeight,
        z: sanitizePhysicsNumber(basePosition.z, 0) + halfWidth,
      },
    );
  } catch {
    return createPhysicsAabb(ZERO_PHYSICS_VECTOR, ZERO_PHYSICS_VECTOR);
  }
}

export function isMovementResultBlocked(
  result: VoxelCollisionMoveResult | null | undefined,
): boolean {
  try {
    return Boolean(result && result.blockedAxes.length > 0);
  } catch {
    return true;
  }
}

export function isMovementResultGrounded(
  result: VoxelCollisionMoveResult | null | undefined,
): boolean {
  try {
    return Boolean(result?.collisionFlags.grounded);
  } catch {
    return false;
  }
}

export function getMovementResultDebugString(
  result: VoxelCollisionMoveResult | null | undefined,
): string {
  try {
    if (!result) {
      return "VoxelCollisionMoveResult(null)";
    }

    return [
      `ok=${result.ok}`,
      `requested=(${result.requestedDelta.x.toFixed(3)},${result.requestedDelta.y.toFixed(3)},${result.requestedDelta.z.toFixed(3)})`,
      `applied=(${result.appliedDelta.x.toFixed(3)},${result.appliedDelta.y.toFixed(3)},${result.appliedDelta.z.toFixed(3)})`,
      `blocked=${result.blockedAxes.join(",") || "none"}`,
      `grounded=${result.collisionFlags.grounded}`,
      `final=${getAabbDebugString(result.finalAabb)}`,
    ].join(" ");
  } catch {
    return "VoxelCollisionMoveResult(invalid)";
  }
}

export class VoxelCollisionSolver {
  private config: VoxelCollisionSolverConfig;
  private lastResult: VoxelCollisionMoveResult | null;
  private revision: number;

  public constructor(config: VoxelCollisionSolverConfigPatch | null | undefined = undefined) {
    this.config = createVoxelCollisionSolverConfig(config);
    this.lastResult = null;
    this.revision = 0;
  }

  public updateConfig(config: VoxelCollisionSolverConfigPatch | null | undefined): VoxelCollisionSolverConfig {
    try {
      this.config = mergeVoxelCollisionSolverConfig(this.config, config);
      this.revision += 1;
      return this.config;
    } catch {
      this.config = createVoxelCollisionSolverConfig(config);
      this.revision += 1;
      return this.config;
    }
  }

  public getConfig(): VoxelCollisionSolverConfig {
    try {
      return {
        ...this.config,
        axisOrder: [...this.config.axisOrder],
      };
    } catch {
      return createVoxelCollisionSolverConfig();
    }
  }

  public move(input: Omit<VoxelCollisionMoveInput, "config"> & {
    readonly config?: VoxelCollisionSolverConfigPatch | null;
  }): VoxelCollisionMoveResult {
    try {
      const result = resolveAabbMovement({
        ...input,
        config: mergeVoxelCollisionSolverConfig(this.config, input.config),
      });

      this.lastResult = result;
      this.revision += 1;

      return result;
    } catch {
      const result = resolveAabbMovement({
        ...input,
        config: this.config,
      });

      this.lastResult = result;
      this.revision += 1;

      return result;
    }
  }

  public probeGround(
    aabb: PhysicsAabb,
    query: VoxelCollisionQueryLike,
  ): VoxelCollisionProbeResult {
    try {
      return safeProbe(
        query,
        createGroundProbeAabb(aabb, this.config.groundProbeDistance),
        this.config,
      );
    } catch {
      return createEmptyProbeResult([createWarning("Ground probe failed.")]);
    }
  }

  public probeCeiling(
    aabb: PhysicsAabb,
    query: VoxelCollisionQueryLike,
  ): VoxelCollisionProbeResult {
    try {
      return safeProbe(
        query,
        createCeilingProbeAabb(aabb, this.config.ceilingProbeDistance),
        this.config,
      );
    } catch {
      return createEmptyProbeResult([createWarning("Ceiling probe failed.")]);
    }
  }

  public getLastResult(): VoxelCollisionMoveResult | null {
    try {
      return this.lastResult;
    } catch {
      return null;
    }
  }

  public reset(): void {
    try {
      this.lastResult = null;
      this.revision += 1;
    } catch {
      this.lastResult = null;
      this.revision = 0;
    }
  }

  public snapshot(): VoxelCollisionSolverSnapshot {
    try {
      return {
        config: this.getConfig(),
        lastResult: this.lastResult,
        revision: this.revision,
      };
    } catch {
      return {
        config: createVoxelCollisionSolverConfig(),
        lastResult: null,
        revision: 0,
      };
    }
  }
}

export function createVoxelCollisionSolver(
  config: VoxelCollisionSolverConfigPatch | null | undefined = undefined,
): VoxelCollisionSolver {
  try {
    return new VoxelCollisionSolver(config);
  } catch {
    return new VoxelCollisionSolver();
  }
}