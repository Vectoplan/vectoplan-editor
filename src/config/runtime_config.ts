// services/vectoplan-editor/src/frontend/config/runtime_config.ts
import type {
  EditorBootstrap,
  EditorBootstrapDefaults,
  EditorCameraBootstrap,
  EditorChunkServiceConfig,
  EditorFeatureFlags,
  EditorInputBootstrap,
  EditorPhysicsBootstrap,
  EditorRenderBootstrap,
  EditorRuntimeConfig,
} from "@bootstrap/bootstrap_models";
import {
  buildDefaultCameraBootstrap,
  buildDefaultChunkServiceConfig,
  buildDefaultFeatureFlags,
  buildDefaultInputBootstrap,
  buildDefaultPhysicsBootstrap,
  buildDefaultRenderBootstrap,
  buildDefaultRuntimeConfig,
  buildDefaultRuntimeInventoryConfig,
  buildDefaultRuntimeLibraryConfig,
  DEFAULT_CHUNK_PROXY_BASE_URL,
  DEFAULT_CREATIVE_LIBRARY_API_URL,
  DEFAULT_CREATIVE_LIBRARY_HEALTH_URL,
  DEFAULT_CREATIVE_LIBRARY_METADATA_URL,
  DEFAULT_EDITOR_INVENTORY_API_URL,
  DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
  DEFAULT_EDITOR_INVENTORY_METADATA_URL,
  DEFAULT_PROJECT_ID,
  DEFAULT_WORLD_ID,
} from "@bootstrap/bootstrap_models";
import type {
  PhysicsConfigPatch,
} from "../runtime/physics/physics_defaults";
import {
  createDefaultPhysicsConfig,
} from "../runtime/physics/physics_defaults";
import type {
  PhysicsRuntimeConfigPatch,
} from "../runtime/physics/physics_runtime";
import type {
  PlayerPhysicsControllerConfigPatch,
} from "../runtime/physics/player_physics_controller";

export type RuntimeConfigSource =
  | "bootstrap"
  | "defaults"
  | "override"
  | "cache"
  | "dataset"
  | "window"
  | "merged"
  | "unknown";

export type RuntimeConfigStatus =
  | "created"
  | "ready"
  | "degraded"
  | "failed";

export type RuntimeEnvironment =
  | "development"
  | "production"
  | "test"
  | string;

export interface RuntimeConfigWarning {
  readonly code: string;
  readonly message: string;
  readonly source: RuntimeConfigSource;
}

export interface RuntimeConfigError {
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
  readonly recoverable: boolean;
}

export interface RuntimeChunkConfig {
  readonly enabled: boolean;
  readonly apiBaseUrl: string;
  readonly browserBaseUrl: string;
  readonly projectId: string;
  readonly worldId: string;
  readonly preferBatchLoad: boolean;
  readonly reloadDirtyChunksAfterCommand: boolean;
  readonly maxBatchChunks: number;
  readonly visibleChunkRadius: number;
  readonly maxChunksPerRenderSync: number;
  readonly service: EditorChunkServiceConfig;
}

export interface RuntimeInputConfig {
  readonly pointerLockEnabled: boolean;
  readonly keyboardEnabled: boolean;
  readonly mouseEnabled: boolean;
  readonly wheelEnabled: boolean;
  readonly invertY: boolean;
  readonly sensitivity: number;
  readonly doubleTapWindowMs: number;
}

export interface RuntimeCameraConfig {
  readonly mode: "first-person";
  readonly fov: number;
  readonly near: number;
  readonly far: number;
  readonly spawn: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly rotation: {
    readonly pitch: number;
    readonly yaw: number;
    readonly roll: number;
  };
  readonly moveSpeed: number;
  readonly sprintMultiplier: number;
  readonly directMovementEnabled: boolean;
  readonly physicsFollowEnabled: boolean;
}

export interface RuntimeRenderConfig {
  readonly antialias: boolean;
  readonly alpha: boolean;
  readonly pixelRatioMax: number;
  readonly clearColor: string;
  readonly chunkWireframe: boolean;
  readonly showPreview: boolean;
  readonly showTargetHighlight: boolean;
  readonly visibleChunkRadius: number;
  readonly maxChunksPerRenderSync: number;
}

export interface RuntimePhysicsConfig {
  readonly enabled: boolean;
  readonly bootstrap: EditorPhysicsBootstrap;
  readonly physicsConfigPatch: PhysicsConfigPatch;
  readonly runtimeConfigPatch: PhysicsRuntimeConfigPatch;
  readonly controllerConfigPatch: PlayerPhysicsControllerConfigPatch;
}

export interface RuntimeFeatureConfig {
  readonly pointerLockEnabled: boolean;
  readonly firstPersonEnabled: boolean;
  readonly physicsEnabled: boolean;
  readonly playerCollisionEnabled: boolean;
  readonly flightModeEnabled: boolean;
  readonly crosshairEnabled: boolean;
  readonly hotbarEnabled: boolean;
  readonly statusBarEnabled: boolean;
  readonly debugOverlayEnabled: boolean;
  readonly creativeLibraryEnabled: boolean;
}

export interface RuntimeConfigFeatureFlags extends RuntimeFeatureConfig {
  readonly chunkServiceEnabled: true;
  readonly localWorldFallbackEnabled: false;
  readonly legacyFrontendEnabled: false;
  readonly chunkServiceInventoryEnabled: false;
  readonly chunkPaletteInventoryFallbackEnabled: false;
  readonly placeableBlocksPlaceholderRouteEnabled: false;
  readonly legacyChunkInventoryEnabled: false;
  readonly editorInventoryApiEnabled: boolean;
  readonly libraryInventoryEnabled: boolean;
  readonly onlyLibraryItemsPlaceable: true;
  readonly debugGrassDirtAllowed: false;
  readonly remoteCommandsEnabled: boolean;
  readonly dirtyChunkReloadEnabled: boolean;
  readonly loadingOverlayEnabled: boolean;
  readonly errorPanelEnabled: boolean;
}

export interface RuntimeInventoryConfig {
  readonly enabled: boolean;
  readonly source: string;
  readonly kind: string;
  readonly apiUrl: string;
  readonly inventoryUrl: string;
  readonly route: string;
  readonly healthUrl: string;
  readonly metadataUrl: string;
  readonly hotbarSize: number;
  readonly slotCount: number;
  readonly selectedSlot: number;
  readonly defaultSelectedSlot: number;
  readonly forceRefreshOnBoot: boolean;
  readonly includeEmptySlots: boolean;
  readonly allowEmptyFallback: boolean;
  readonly onlyLibraryItemsPlaceable: true;
  readonly debugGrassDirtAllowed: false;
  readonly allowChunkPlaceableFallback: false;
  readonly requestTimeoutMs: number;
  readonly cacheTtlMs: number;
  readonly staleCacheTtlMs: number;
}

export interface RuntimeLibraryConfig {
  readonly enabled: boolean;
  readonly source: "vectoplan-library";
  readonly apiUrl: string;
  readonly browserApiUrl: string;
  readonly inventoryRoute: string;
  readonly creativeLibraryRoute: string;
  readonly healthRoute: string;
  readonly metadataRoute: string;
  readonly browserCallsLibraryDirectly: false;
}

export interface RuntimeConfig {
  readonly kind: "vectoplan-editor-runtime-config.v1";
  readonly schemaVersion: "vectoplan-editor-runtime-config.v1";
  readonly status: RuntimeConfigStatus;
  readonly source: RuntimeConfigSource;
  readonly environment: RuntimeEnvironment;
  readonly buildMode: string;
  readonly buildVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly runtime: EditorRuntimeConfig;
  readonly chunk: RuntimeChunkConfig;
  readonly inventory: RuntimeInventoryConfig;
  readonly library: RuntimeLibraryConfig;
  readonly input: RuntimeInputConfig;
  readonly camera: RuntimeCameraConfig;
  readonly render: RuntimeRenderConfig;
  readonly physics: RuntimePhysicsConfig;
  readonly features: RuntimeFeatureConfig;
  readonly featureFlags: RuntimeConfigFeatureFlags;
  readonly warnings: readonly string[];
  readonly warningDetails: readonly RuntimeConfigWarning[];
  readonly lastError: RuntimeConfigError | null;
}

export interface ResolvedEditorRuntimeConfig {
  readonly kind: "vectoplan-editor-runtime-config.v1";
  readonly status: RuntimeConfigStatus;
  readonly source: RuntimeConfigSource;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: "vectoplan-editor-runtime-config.v1";

  readonly runtime: EditorRuntimeConfig;
  readonly chunk: RuntimeChunkConfig;
  readonly input: RuntimeInputConfig;
  readonly camera: RuntimeCameraConfig;
  readonly render: RuntimeRenderConfig;
  readonly physics: RuntimePhysicsConfig;
  readonly features: RuntimeFeatureConfig;

  readonly warnings: readonly RuntimeConfigWarning[];
  readonly lastError: RuntimeConfigError | null;
}

export interface RuntimeConfigOverrides {
  readonly source?: RuntimeConfigSource;
  readonly chunk?: Partial<RuntimeChunkConfig>;
  readonly input?: Partial<RuntimeInputConfig>;
  readonly camera?: Partial<RuntimeCameraConfig>;
  readonly render?: Partial<RuntimeRenderConfig>;
  readonly physics?: Partial<EditorPhysicsBootstrap>;
  readonly features?: Partial<RuntimeFeatureConfig>;
}

export interface ReadRuntimeConfigOptions {
  readonly rootElement?: HTMLElement | null;
  readonly defaults?: Partial<EditorBootstrapDefaults>;
  readonly overrides?: RuntimeConfigOverrides | null;
}

export interface RuntimeConfigCache {
  readonly kind: "vectoplan-editor-runtime-config-cache.v1";

  get(): ResolvedEditorRuntimeConfig;
  set(config: ResolvedEditorRuntimeConfig): ResolvedEditorRuntimeConfig;
  updateFromBootstrap(
    bootstrap: EditorBootstrap | null | undefined,
    overrides?: RuntimeConfigOverrides | null,
  ): ResolvedEditorRuntimeConfig;
  clear(): void;
  getRevision(): number;
}

export const RUNTIME_CONFIG_KIND = "vectoplan-editor-runtime-config.v1" as const;
export const RUNTIME_CONFIG_CACHE_KIND = "vectoplan-editor-runtime-config-cache.v1" as const;

const WINDOW_KEYS = {
  runtimeConfig: "__VECTOPLAN_EDITOR_RUNTIME_CONFIG__",
  buildMode: "__VECTOPLAN_EDITOR_BUILD_MODE__",
  buildVersion: "__VECTOPLAN_EDITOR_BUILD_VERSION__",

  chunkApiBaseUrl: "__VECTOPLAN_EDITOR_CHUNK_API_BASE_URL__",
  chunkBrowserBaseUrl: "__VECTOPLAN_EDITOR_CHUNK_BROWSER_BASE_URL__",
  chunkProxyBaseUrl: "__VECTOPLAN_EDITOR_CHUNK_PROXY_BASE_URL__",
  defaultProjectId: "__VECTOPLAN_EDITOR_DEFAULT_PROJECT_ID__",
  defaultWorldId: "__VECTOPLAN_EDITOR_DEFAULT_WORLD_ID__",

  inventoryApiUrl: "__VECTOPLAN_EDITOR_INVENTORY_API_URL__",
  inventoryUrl: "__VECTOPLAN_EDITOR_INVENTORY_URL__",
  inventoryRoute: "__VECTOPLAN_EDITOR_INVENTORY_ROUTE__",
  inventoryHealthUrl: "__VECTOPLAN_EDITOR_INVENTORY_HEALTH_URL__",
  inventoryMetadataUrl: "__VECTOPLAN_EDITOR_INVENTORY_METADATA_URL__",
  inventoryHotbarSize: "__VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE__",
  inventorySelectedSlot: "__VECTOPLAN_EDITOR_INVENTORY_SELECTED_SLOT__",
  inventoryForceRefresh: "__VECTOPLAN_EDITOR_INVENTORY_FORCE_REFRESH__",
  inventoryForceRefreshOnBoot: "__VECTOPLAN_EDITOR_INVENTORY_FORCE_REFRESH_ON_BOOT__",

  creativeLibraryRoute: "__VECTOPLAN_EDITOR_CREATIVE_LIBRARY_ROUTE__",
  libraryApiUrl: "__VECTOPLAN_EDITOR_LIBRARY_API_URL__",
  libraryBrowserApiUrl: "__VECTOPLAN_EDITOR_LIBRARY_BROWSER_API_URL__",
  libraryInventoryRoute: "__VECTOPLAN_EDITOR_LIBRARY_INVENTORY_ROUTE__",
  libraryHealthRoute: "__VECTOPLAN_EDITOR_LIBRARY_HEALTH_ROUTE__",
  libraryMetadataRoute: "__VECTOPLAN_EDITOR_LIBRARY_METADATA_ROUTE__",

  localWorldFallbackEnabled: "__VECTOPLAN_EDITOR_LOCAL_WORLD_FALLBACK_ENABLED__",
  legacyFrontendEnabled: "__VECTOPLAN_EDITOR_LEGACY_FRONTEND_ENABLED__",
} as const;

function nowIsoStringSafe(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
}

function safeString(value: unknown, fallback: string): string {
  try {
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  } catch {
    return fallback;
  }
}

function safeBoolean(value: unknown, fallback: boolean): boolean {
  try {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }

    if (typeof value !== "string") {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();

    if (["1", "true", "yes", "y", "on", "enabled"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "n", "off", "disabled"].includes(normalized)) {
      return false;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function safeNumber(
  value: unknown,
  fallback: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): number {
  try {
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseFloat(value.trim())
          : Number.NaN;

    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, numeric));
  } catch {
    return fallback;
  }
}

function safeInteger(
  value: unknown,
  fallback: number,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  try {
    return Math.trunc(safeNumber(value, fallback, min, max));
  } catch {
    return fallback;
  }
}

function createWarning(
  code: string,
  message: string,
  source: RuntimeConfigSource,
): RuntimeConfigWarning {
  return {
    code: safeString(code, "runtime_config_warning"),
    message: safeString(message, "Runtime config warning."),
    source,
  };
}

function createError(
  code: string,
  message: string,
  cause?: unknown,
  recoverable = true,
): RuntimeConfigError {
  return {
    code: safeString(code, "runtime_config_error"),
    message: safeString(message, "Runtime config error."),
    cause,
    recoverable,
  };
}

function normalizeSource(value: unknown): RuntimeConfigSource {
  try {
    if (
      value === "bootstrap" ||
      value === "defaults" ||
      value === "override" ||
      value === "cache" ||
      value === "dataset" ||
      value === "window" ||
      value === "merged" ||
      value === "unknown"
    ) {
      return value;
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function windowRecord(): Record<string, unknown> {
  try {
    return typeof window !== "undefined"
      ? window as unknown as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function readWindowValue(key: string): unknown {
  try {
    return windowRecord()[key];
  } catch {
    return undefined;
  }
}

function readDatasetValue(root: HTMLElement | null | undefined, keys: readonly string[], fallback: unknown = undefined): unknown {
  try {
    if (!root) {
      return fallback;
    }

    for (const key of keys) {
      const value = root.dataset[key];

      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function runtimeEnvironmentFromBuildMode(buildMode: string): RuntimeEnvironment {
  const normalized = buildMode.trim().toLowerCase();

  if (normalized === "production" || normalized === "test" || normalized === "development") {
    return normalized;
  }

  return normalized || "development";
}

function routeUrl(value: unknown, fallback: string): string {
  const raw = safeString(value, fallback);

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
}

function getBootstrapRuntime(
  bootstrap: EditorBootstrap | null | undefined,
): EditorRuntimeConfig {
  try {
    if (bootstrap?.runtime) {
      return bootstrap.runtime;
    }

    return buildDefaultRuntimeConfig(
      {
        apiBaseUrl: String(DEFAULT_CHUNK_PROXY_BASE_URL),
        browserBaseUrl: String(DEFAULT_CHUNK_PROXY_BASE_URL),
        projectId: String(DEFAULT_PROJECT_ID),
        worldId: String(DEFAULT_WORLD_ID),
      },
      buildDefaultPhysicsBootstrap(),
      buildDefaultRuntimeInventoryConfig(),
      buildDefaultRuntimeLibraryConfig(),
    );
  } catch {
    return buildDefaultRuntimeConfig(
      {
        apiBaseUrl: String(DEFAULT_CHUNK_PROXY_BASE_URL),
        browserBaseUrl: String(DEFAULT_CHUNK_PROXY_BASE_URL),
        projectId: String(DEFAULT_PROJECT_ID),
        worldId: String(DEFAULT_WORLD_ID),
      },
      buildDefaultPhysicsBootstrap(),
      buildDefaultRuntimeInventoryConfig(),
      buildDefaultRuntimeLibraryConfig(),
    );
  }
}

function getBootstrapPhysics(
  bootstrap: EditorBootstrap | null | undefined,
): EditorPhysicsBootstrap {
  try {
    return buildDefaultPhysicsBootstrap(
      bootstrap?.runtime?.physics ?? bootstrap?.physics ?? undefined,
    );
  } catch {
    return buildDefaultPhysicsBootstrap();
  }
}

function getBootstrapFeatures(
  bootstrap: EditorBootstrap | null | undefined,
  physics: EditorPhysicsBootstrap,
): EditorFeatureFlags {
  try {
    return buildDefaultFeatureFlags({
      ...(bootstrap?.featureFlags ?? {}),
      physicsEnabled: bootstrap?.featureFlags?.physicsEnabled ?? physics.enabled,
      playerCollisionEnabled: bootstrap?.featureFlags?.playerCollisionEnabled ?? physics.enabled,
      flightModeEnabled: bootstrap?.featureFlags?.flightModeEnabled ?? physics.enabled,
      debugOverlayEnabled: bootstrap?.featureFlags?.debugOverlayEnabled ?? physics.debug.enabled,
      chunkServiceInventoryEnabled: false,
      chunkPaletteInventoryFallbackEnabled: false,
      placeableBlocksPlaceholderRouteEnabled: false,
      legacyChunkInventoryEnabled: false,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
    });
  } catch {
    return buildDefaultFeatureFlags({
      physicsEnabled: physics.enabled,
      playerCollisionEnabled: physics.enabled,
      flightModeEnabled: physics.enabled,
      debugOverlayEnabled: physics.debug.enabled,
      chunkServiceInventoryEnabled: false,
      chunkPaletteInventoryFallbackEnabled: false,
      placeableBlocksPlaceholderRouteEnabled: false,
      legacyChunkInventoryEnabled: false,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
    });
  }
}

function getBootstrapInput(
  bootstrap: EditorBootstrap | null | undefined,
): EditorInputBootstrap {
  try {
    return buildDefaultInputBootstrap(bootstrap?.input);
  } catch {
    return buildDefaultInputBootstrap();
  }
}

function getBootstrapCamera(
  bootstrap: EditorBootstrap | null | undefined,
  physics: EditorPhysicsBootstrap,
): EditorCameraBootstrap {
  try {
    return buildDefaultCameraBootstrap({
      ...(bootstrap?.camera ?? {}),
      physicsFollowEnabled: bootstrap?.camera?.physicsFollowEnabled ?? physics.enabled,
      directMovementEnabled: bootstrap?.camera?.directMovementEnabled ?? !physics.enabled,
    });
  } catch {
    return buildDefaultCameraBootstrap({
      physicsFollowEnabled: physics.enabled,
      directMovementEnabled: !physics.enabled,
    });
  }
}

function getBootstrapRender(
  bootstrap: EditorBootstrap | null | undefined,
): EditorRenderBootstrap {
  try {
    return buildDefaultRenderBootstrap(bootstrap?.render);
  } catch {
    return buildDefaultRenderBootstrap();
  }
}

export function editorPhysicsBootstrapToPhysicsConfigPatch(
  physics: EditorPhysicsBootstrap | null | undefined,
): PhysicsConfigPatch {
  try {
    const safePhysics = buildDefaultPhysicsBootstrap(physics ?? undefined);

    return {
      enabled: safePhysics.enabled,
      timing: {
        fixedTimeStepSeconds: safePhysics.timing.fixedTimeStepSeconds,
        maxFrameDeltaSeconds: safePhysics.timing.maxFrameDeltaSeconds,
        maxSubSteps: safePhysics.timing.maxSubSteps,
      },
      movement: {
        walkSpeed: safePhysics.movement.walkSpeed,
        sprintSpeed: safePhysics.movement.sprintSpeed,
        airControlSpeed: safePhysics.movement.airControlSpeed,
        flySpeed: safePhysics.movement.flySpeed,
        flySprintSpeed: safePhysics.movement.flySprintSpeed,
        jumpVelocity: safePhysics.movement.jumpVelocity,
        gravity: safePhysics.movement.gravity,
        maxFallSpeed: safePhysics.movement.maxFallSpeed,
        groundSnapDistance: safePhysics.movement.groundSnapDistance,
      },
      input: {
        doubleTapWindowMs: safePhysics.input.doubleTapWindowMs,
        allowJumpBeforeFlightToggle: safePhysics.input.allowJumpBeforeFlightToggle,
      },
      collider: {
        kind: safePhysics.collider.kind,
        width: safePhysics.collider.width,
        height: safePhysics.collider.height,
        eyeHeight: safePhysics.collider.eyeHeight,
        skinWidth: safePhysics.collider.skinWidth,
      },
      missingChunks: {
        policy: safePhysics.missingChunks.policy,
        blockHorizontalMovement: safePhysics.missingChunks.blockHorizontalMovement,
        blockVerticalMovement: safePhysics.missingChunks.blockVerticalMovement,
      },
      debug: {
        enabled: safePhysics.debug.enabled,
        exposeToStore: safePhysics.debug.exposeToStore,
        includeCollisionCells: safePhysics.debug.includeCollisionCells,
      },
    };
  } catch {
    return createDefaultPhysicsConfig();
  }
}

export function editorPhysicsBootstrapToControllerConfigPatch(
  physics: EditorPhysicsBootstrap | null | undefined,
): PlayerPhysicsControllerConfigPatch {
  try {
    const safePhysics = buildDefaultPhysicsBootstrap(physics ?? undefined);
    const physicsConfig = editorPhysicsBootstrapToPhysicsConfigPatch(safePhysics);

    return {
      physics: physicsConfig,
      collision: {
        enabled: safePhysics.enabled,
        epsilon: 0.000001,
        skinWidth: safePhysics.collider.skinWidth,
        includeTraceCells: safePhysics.debug.includeCollisionCells,
        groundProbeDistance: Math.max(0.01, safePhysics.movement.groundSnapDistance),
        ceilingProbeDistance: Math.max(0.01, safePhysics.collider.skinWidth * 4),
        maxCellsPerQuery: 262_144,
      },
      yawForwardSign: 1,
      preserveHorizontalVelocityWhenNoInput: false,
      horizontalDampingPerSecond: 24,
      airborneHorizontalDampingPerSecond: 8,
      flyingDampingPerSecond: 18,
    };
  } catch {
    return {
      physics: createDefaultPhysicsConfig(),
      collision: {
        enabled: true,
      },
    };
  }
}

export function editorPhysicsBootstrapToRuntimeConfigPatch(
  physics: EditorPhysicsBootstrap | null | undefined,
): PhysicsRuntimeConfigPatch {
  try {
    const safePhysics = buildDefaultPhysicsBootstrap(physics ?? undefined);
    const physicsConfig = editorPhysicsBootstrapToPhysicsConfigPatch(safePhysics);
    const controller = editorPhysicsBootstrapToControllerConfigPatch(safePhysics);

    return {
      enabled: safePhysics.enabled,
      physics: physicsConfig,
      controller,
      fixedTimeStepSeconds: safePhysics.timing.fixedTimeStepSeconds,
      maxFrameDeltaSeconds: safePhysics.timing.maxFrameDeltaSeconds,
      maxSubSteps: safePhysics.timing.maxSubSteps,
      exposeWarnings: true,
      failClosedWithoutQuery: true,
    };
  } catch {
    return {
      enabled: true,
      physics: createDefaultPhysicsConfig(),
      controller: {
        physics: createDefaultPhysicsConfig(),
      },
      fixedTimeStepSeconds: 1 / 60,
      maxFrameDeltaSeconds: 0.25,
      maxSubSteps: 8,
      exposeWarnings: true,
      failClosedWithoutQuery: true,
    };
  }
}

export function createRuntimeChunkConfig(
  runtime: EditorRuntimeConfig,
  render: EditorRenderBootstrap,
  overrides?: Partial<RuntimeChunkConfig> | null,
): RuntimeChunkConfig {
  try {
    const chunk = runtime.chunk;

    return {
      enabled: true,
      apiBaseUrl: safeString(overrides?.apiBaseUrl, chunk.apiBaseUrl),
      browserBaseUrl: safeString(overrides?.browserBaseUrl, chunk.browserBaseUrl),
      projectId: safeString(overrides?.projectId, chunk.projectId),
      worldId: safeString(overrides?.worldId, chunk.worldId),
      preferBatchLoad: safeBoolean(overrides?.preferBatchLoad, chunk.preferBatchLoad),
      reloadDirtyChunksAfterCommand: safeBoolean(
        overrides?.reloadDirtyChunksAfterCommand,
        chunk.reloadDirtyChunksAfterCommand,
      ),
      maxBatchChunks: safeInteger(overrides?.maxBatchChunks, chunk.maxBatchChunks, 1, 4096),
      visibleChunkRadius: safeInteger(overrides?.visibleChunkRadius, render.visibleChunkRadius, 0, 32),
      maxChunksPerRenderSync: safeInteger(
        overrides?.maxChunksPerRenderSync,
        render.maxChunksPerRenderSync,
        1,
        4096,
      ),
      service: {
        ...chunk,
        apiBaseUrl: safeString(overrides?.apiBaseUrl, chunk.apiBaseUrl),
        browserBaseUrl: safeString(overrides?.browserBaseUrl, chunk.browserBaseUrl),
        projectId: safeString(overrides?.projectId, chunk.projectId),
        worldId: safeString(overrides?.worldId, chunk.worldId),
        preferBatchLoad: safeBoolean(overrides?.preferBatchLoad, chunk.preferBatchLoad),
        reloadDirtyChunksAfterCommand: safeBoolean(
          overrides?.reloadDirtyChunksAfterCommand,
          chunk.reloadDirtyChunksAfterCommand,
        ),
        maxBatchChunks: safeInteger(overrides?.maxBatchChunks, chunk.maxBatchChunks, 1, 4096),
      },
    };
  } catch {
    const fallback = buildDefaultChunkServiceConfig();

    return {
      enabled: true,
      apiBaseUrl: fallback.apiBaseUrl,
      browserBaseUrl: fallback.browserBaseUrl,
      projectId: fallback.projectId,
      worldId: fallback.worldId,
      preferBatchLoad: fallback.preferBatchLoad,
      reloadDirtyChunksAfterCommand: fallback.reloadDirtyChunksAfterCommand,
      maxBatchChunks: fallback.maxBatchChunks,
      visibleChunkRadius: 1,
      maxChunksPerRenderSync: 256,
      service: fallback,
    };
  }
}

export function createRuntimeInputConfig(
  input: EditorInputBootstrap,
  physics: EditorPhysicsBootstrap,
  overrides?: Partial<RuntimeInputConfig> | null,
): RuntimeInputConfig {
  try {
    return {
      pointerLockEnabled: safeBoolean(overrides?.pointerLockEnabled, input.pointerLockEnabled),
      keyboardEnabled: safeBoolean(overrides?.keyboardEnabled, input.keyboardEnabled),
      mouseEnabled: safeBoolean(overrides?.mouseEnabled, input.mouseEnabled),
      wheelEnabled: safeBoolean(overrides?.wheelEnabled, input.wheelEnabled),
      invertY: safeBoolean(overrides?.invertY, input.invertY),
      sensitivity: safeNumber(overrides?.sensitivity, input.sensitivity, 0.00001, 0.1),
      doubleTapWindowMs: safeInteger(
        overrides?.doubleTapWindowMs,
        physics.input.doubleTapWindowMs,
        80,
        800,
      ),
    };
  } catch {
    const fallback = buildDefaultInputBootstrap();

    return {
      pointerLockEnabled: fallback.pointerLockEnabled,
      keyboardEnabled: fallback.keyboardEnabled,
      mouseEnabled: fallback.mouseEnabled,
      wheelEnabled: fallback.wheelEnabled,
      invertY: fallback.invertY,
      sensitivity: fallback.sensitivity,
      doubleTapWindowMs: 280,
    };
  }
}

export function createRuntimeCameraConfig(
  camera: EditorCameraBootstrap,
  physics: EditorPhysicsBootstrap,
  overrides?: Partial<RuntimeCameraConfig> | null,
): RuntimeCameraConfig {
  try {
    const physicsFollowEnabled = safeBoolean(
      overrides?.physicsFollowEnabled,
      camera.physicsFollowEnabled ?? physics.enabled,
    );

    return {
      mode: "first-person",
      fov: safeNumber(overrides?.fov, camera.fov, 10, 140),
      near: safeNumber(overrides?.near, camera.near, 0.001, 10_000),
      far: safeNumber(overrides?.far, camera.far, 1, 1_000_000),
      spawn: {
        x: safeNumber(overrides?.spawn?.x, camera.spawn.x),
        y: safeNumber(overrides?.spawn?.y, camera.spawn.y),
        z: safeNumber(overrides?.spawn?.z, camera.spawn.z),
      },
      rotation: {
        pitch: safeNumber(overrides?.rotation?.pitch, camera.rotation.pitch, -Math.PI / 2, Math.PI / 2),
        yaw: safeNumber(overrides?.rotation?.yaw, camera.rotation.yaw, -Math.PI * 4, Math.PI * 4),
        roll: safeNumber(overrides?.rotation?.roll, camera.rotation.roll, -Math.PI * 2, Math.PI * 2),
      },
      moveSpeed: safeNumber(overrides?.moveSpeed, camera.moveSpeed, 0, 1000),
      sprintMultiplier: safeNumber(overrides?.sprintMultiplier, camera.sprintMultiplier, 1, 100),
      directMovementEnabled: safeBoolean(
        overrides?.directMovementEnabled,
        camera.directMovementEnabled ?? !physicsFollowEnabled,
      ),
      physicsFollowEnabled,
    };
  } catch {
    const fallback = buildDefaultCameraBootstrap();

    return {
      mode: "first-person",
      fov: fallback.fov,
      near: fallback.near,
      far: fallback.far,
      spawn: fallback.spawn,
      rotation: fallback.rotation,
      moveSpeed: fallback.moveSpeed,
      sprintMultiplier: fallback.sprintMultiplier,
      directMovementEnabled: !physics.enabled,
      physicsFollowEnabled: physics.enabled,
    };
  }
}

export function createRuntimeRenderConfig(
  render: EditorRenderBootstrap,
  overrides?: Partial<RuntimeRenderConfig> | null,
): RuntimeRenderConfig {
  try {
    return {
      antialias: safeBoolean(overrides?.antialias, render.antialias),
      alpha: safeBoolean(overrides?.alpha, render.alpha),
      pixelRatioMax: safeNumber(overrides?.pixelRatioMax, render.pixelRatioMax, 0.25, 8),
      clearColor: safeString(overrides?.clearColor, render.clearColor),
      chunkWireframe: safeBoolean(overrides?.chunkWireframe, render.chunkWireframe),
      showPreview: safeBoolean(overrides?.showPreview, render.showPreview),
      showTargetHighlight: safeBoolean(overrides?.showTargetHighlight, render.showTargetHighlight),
      visibleChunkRadius: safeInteger(overrides?.visibleChunkRadius, render.visibleChunkRadius, 0, 32),
      maxChunksPerRenderSync: safeInteger(
        overrides?.maxChunksPerRenderSync,
        render.maxChunksPerRenderSync,
        1,
        4096,
      ),
    };
  } catch {
    const fallback = buildDefaultRenderBootstrap();

    return {
      antialias: fallback.antialias,
      alpha: fallback.alpha,
      pixelRatioMax: fallback.pixelRatioMax,
      clearColor: fallback.clearColor,
      chunkWireframe: fallback.chunkWireframe,
      showPreview: fallback.showPreview,
      showTargetHighlight: fallback.showTargetHighlight,
      visibleChunkRadius: fallback.visibleChunkRadius,
      maxChunksPerRenderSync: fallback.maxChunksPerRenderSync,
    };
  }
}

export function createRuntimeFeatureConfig(
  features: EditorFeatureFlags,
  physics: EditorPhysicsBootstrap,
  overrides?: Partial<RuntimeFeatureConfig> | null,
): RuntimeFeatureConfig {
  try {
    return {
      pointerLockEnabled: safeBoolean(overrides?.pointerLockEnabled, features.pointerLockEnabled),
      firstPersonEnabled: safeBoolean(overrides?.firstPersonEnabled, features.firstPersonEnabled),
      physicsEnabled: safeBoolean(overrides?.physicsEnabled, features.physicsEnabled ?? physics.enabled),
      playerCollisionEnabled: safeBoolean(
        overrides?.playerCollisionEnabled,
        features.playerCollisionEnabled ?? physics.enabled,
      ),
      flightModeEnabled: safeBoolean(overrides?.flightModeEnabled, features.flightModeEnabled ?? physics.enabled),
      crosshairEnabled: safeBoolean(overrides?.crosshairEnabled, features.crosshairEnabled),
      hotbarEnabled: safeBoolean(overrides?.hotbarEnabled, features.hotbarEnabled),
      statusBarEnabled: safeBoolean(overrides?.statusBarEnabled, features.statusBarEnabled),
      debugOverlayEnabled: safeBoolean(overrides?.debugOverlayEnabled, features.debugOverlayEnabled),
      creativeLibraryEnabled: safeBoolean(overrides?.creativeLibraryEnabled, features.creativeLibraryEnabled),
    };
  } catch {
    return {
      pointerLockEnabled: true,
      firstPersonEnabled: true,
      physicsEnabled: physics.enabled,
      playerCollisionEnabled: physics.enabled,
      flightModeEnabled: physics.enabled,
      crosshairEnabled: true,
      hotbarEnabled: true,
      statusBarEnabled: true,
      debugOverlayEnabled: physics.debug.enabled,
      creativeLibraryEnabled: true,
    };
  }
}

export function createRuntimePhysicsConfig(
  physicsInput: EditorPhysicsBootstrap,
  overrides?: Partial<EditorPhysicsBootstrap> | null,
): RuntimePhysicsConfig {
  try {
    const bootstrap = buildDefaultPhysicsBootstrap({
      ...physicsInput,
      ...(overrides ?? {}),
      timing: {
        ...physicsInput.timing,
        ...(overrides?.timing ?? {}),
      },
      movement: {
        ...physicsInput.movement,
        ...(overrides?.movement ?? {}),
      },
      input: {
        ...physicsInput.input,
        ...(overrides?.input ?? {}),
      },
      collider: {
        ...physicsInput.collider,
        ...(overrides?.collider ?? {}),
      },
      missingChunks: {
        ...physicsInput.missingChunks,
        ...(overrides?.missingChunks ?? {}),
      },
      debug: {
        ...physicsInput.debug,
        ...(overrides?.debug ?? {}),
      },
    });

    const physicsConfigPatch = editorPhysicsBootstrapToPhysicsConfigPatch(bootstrap);
    const controllerConfigPatch = editorPhysicsBootstrapToControllerConfigPatch(bootstrap);
    const runtimeConfigPatch = editorPhysicsBootstrapToRuntimeConfigPatch(bootstrap);

    return {
      enabled: bootstrap.enabled,
      bootstrap,
      physicsConfigPatch,
      runtimeConfigPatch,
      controllerConfigPatch,
    };
  } catch {
    const bootstrap = buildDefaultPhysicsBootstrap();
    const physicsConfigPatch = editorPhysicsBootstrapToPhysicsConfigPatch(bootstrap);

    return {
      enabled: bootstrap.enabled,
      bootstrap,
      physicsConfigPatch,
      runtimeConfigPatch: editorPhysicsBootstrapToRuntimeConfigPatch(bootstrap),
      controllerConfigPatch: editorPhysicsBootstrapToControllerConfigPatch(bootstrap),
    };
  }
}

export function createResolvedRuntimeConfig(
  bootstrap: EditorBootstrap | null | undefined,
  overrides?: RuntimeConfigOverrides | null,
): ResolvedEditorRuntimeConfig {
  const createdAt = nowIsoStringSafe();
  const warnings: RuntimeConfigWarning[] = [];
  let lastError: RuntimeConfigError | null = null;

  try {
    const source = normalizeSource(overrides?.source ?? (bootstrap ? "bootstrap" : "defaults"));
    const baseRuntime = getBootstrapRuntime(bootstrap);
    const basePhysics = getBootstrapPhysics(bootstrap);
    const physics = createRuntimePhysicsConfig(basePhysics, overrides?.physics);
    const features = createRuntimeFeatureConfig(
      getBootstrapFeatures(bootstrap, physics.bootstrap),
      physics.bootstrap,
      overrides?.features,
    );
    const input = createRuntimeInputConfig(
      getBootstrapInput(bootstrap),
      physics.bootstrap,
      overrides?.input,
    );
    const camera = createRuntimeCameraConfig(
      getBootstrapCamera(bootstrap, physics.bootstrap),
      physics.bootstrap,
      overrides?.camera,
    );
    const render = createRuntimeRenderConfig(
      getBootstrapRender(bootstrap),
      overrides?.render,
    );
    const chunk = createRuntimeChunkConfig(
      {
        ...baseRuntime,
        physics: physics.bootstrap,
      },
      render,
      overrides?.chunk,
    );

    if (!features.physicsEnabled || !physics.enabled) {
      warnings.push(createWarning(
        "physics_disabled",
        "Physics runtime is disabled. Camera direct movement may be used if enabled.",
        source,
      ));
    }

    if (camera.physicsFollowEnabled && !features.physicsEnabled) {
      warnings.push(createWarning(
        "camera_follow_without_physics",
        "Camera physics follow is enabled but physics is disabled.",
        source,
      ));
    }

    if (camera.directMovementEnabled && physics.enabled) {
      warnings.push(createWarning(
        "direct_camera_movement_with_physics",
        "Direct camera movement is enabled while physics is enabled. SceneRuntime should avoid applying both movement systems.",
        source,
      ));
    }

    if (physics.bootstrap.missingChunks.policy === "treat_as_air") {
      warnings.push(createWarning(
        "missing_chunks_treated_as_air",
        "Physics missing chunk policy is treat_as_air. The player can fall through unloaded terrain.",
        source,
      ));
    }

    return {
      kind: RUNTIME_CONFIG_KIND,
      status: warnings.length > 0 ? "degraded" : "ready",
      source,
      createdAt,
      updatedAt: createdAt,
      schemaVersion: RUNTIME_CONFIG_KIND,
      runtime: {
        ...baseRuntime,
        chunk: chunk.service,
        physics: physics.bootstrap,
      },
      chunk,
      input,
      camera,
      render,
      physics,
      features,
      warnings,
      lastError,
    };
  } catch (cause) {
    const physicsBootstrap = buildDefaultPhysicsBootstrap();
    const render = buildDefaultRenderBootstrap();
    const fallbackRuntime = buildDefaultRuntimeConfig(
      buildDefaultChunkServiceConfig(),
      physicsBootstrap,
      buildDefaultRuntimeInventoryConfig(),
      buildDefaultRuntimeLibraryConfig(),
    );

    lastError = createError(
      "runtime_config_create_failed",
      "Failed to create resolved runtime config. Defaults were used.",
      cause,
      true,
    );

    const physics = createRuntimePhysicsConfig(physicsBootstrap);

    return {
      kind: RUNTIME_CONFIG_KIND,
      status: "failed",
      source: "defaults",
      createdAt,
      updatedAt: createdAt,
      schemaVersion: RUNTIME_CONFIG_KIND,
      runtime: fallbackRuntime,
      chunk: createRuntimeChunkConfig(fallbackRuntime, render),
      input: createRuntimeInputConfig(buildDefaultInputBootstrap(), physicsBootstrap),
      camera: createRuntimeCameraConfig(buildDefaultCameraBootstrap(), physicsBootstrap),
      render: createRuntimeRenderConfig(render),
      physics,
      features: createRuntimeFeatureConfig(buildDefaultFeatureFlags(), physicsBootstrap),
      warnings: [
        createWarning(
          "runtime_config_defaults_used",
          "Runtime config fallback defaults were used.",
          "defaults",
        ),
      ],
      lastError,
    };
  }
}

function createRuntimeInventoryConfig(input: {
  readonly rootElement?: HTMLElement | null;
  readonly defaults?: Partial<EditorBootstrapDefaults>;
}): RuntimeInventoryConfig {
  const rootElement = input.rootElement ?? null;
  const hotbarSize = safeInteger(
    readWindowValue(WINDOW_KEYS.inventoryHotbarSize)
      ?? readDatasetValue(rootElement, ["inventoryHotbarSize", "inventorySlotCount"]),
    9,
    1,
    64,
  );
  const selectedSlot = safeInteger(
    readWindowValue(WINDOW_KEYS.inventorySelectedSlot)
      ?? readDatasetValue(rootElement, ["inventorySelectedSlot", "inventoryDefaultSelectedSlot"]),
    0,
    0,
    Math.max(0, hotbarSize - 1),
  );
  const apiUrl = routeUrl(
    readWindowValue(WINDOW_KEYS.inventoryApiUrl)
      ?? readWindowValue(WINDOW_KEYS.inventoryRoute)
      ?? readDatasetValue(rootElement, ["inventoryApiUrl", "inventoryRoute", "libraryInventoryRoute"]),
    DEFAULT_EDITOR_INVENTORY_API_URL,
  );

  return {
    enabled: true,
    source: "library",
    kind: "vplib",
    apiUrl,
    inventoryUrl: routeUrl(readWindowValue(WINDOW_KEYS.inventoryUrl) ?? readDatasetValue(rootElement, ["inventoryUrl"]), apiUrl),
    route: routeUrl(readWindowValue(WINDOW_KEYS.inventoryRoute) ?? readDatasetValue(rootElement, ["inventoryRoute"]), apiUrl),
    healthUrl: routeUrl(
      readWindowValue(WINDOW_KEYS.inventoryHealthUrl) ?? readDatasetValue(rootElement, ["inventoryHealthUrl"]),
      DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
    ),
    metadataUrl: routeUrl(
      readWindowValue(WINDOW_KEYS.inventoryMetadataUrl) ?? readDatasetValue(rootElement, ["inventoryMetadataUrl"]),
      DEFAULT_EDITOR_INVENTORY_METADATA_URL,
    ),
    hotbarSize,
    slotCount: hotbarSize,
    selectedSlot,
    defaultSelectedSlot: selectedSlot,
    forceRefreshOnBoot: safeBoolean(
      readWindowValue(WINDOW_KEYS.inventoryForceRefreshOnBoot)
        ?? readWindowValue(WINDOW_KEYS.inventoryForceRefresh)
        ?? readDatasetValue(rootElement, ["inventoryForceRefreshOnBoot", "inventoryForceRefresh"]),
      false,
    ),
    includeEmptySlots: true,
    allowEmptyFallback: true,
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,
    allowChunkPlaceableFallback: false,
    requestTimeoutMs: 10_000,
    cacheTtlMs: 5_000,
    staleCacheTtlMs: 60_000,
  };
}

function createRuntimeLibraryConfig(rootElement?: HTMLElement | null): RuntimeLibraryConfig {
  const apiUrl = routeUrl(
    readWindowValue(WINDOW_KEYS.libraryApiUrl)
      ?? readDatasetValue(rootElement, ["libraryApiUrl", "creativeLibraryApiUrl", "creativeLibraryRoute"]),
    DEFAULT_CREATIVE_LIBRARY_API_URL,
  );

  return {
    enabled: true,
    source: "vectoplan-library",
    apiUrl,
    browserApiUrl: routeUrl(
      readWindowValue(WINDOW_KEYS.libraryBrowserApiUrl)
        ?? readDatasetValue(rootElement, ["libraryBrowserApiUrl", "creativeLibraryBrowserApiUrl"]),
      apiUrl,
    ),
    inventoryRoute: routeUrl(
      readWindowValue(WINDOW_KEYS.libraryInventoryRoute)
        ?? readDatasetValue(rootElement, ["libraryInventoryRoute", "inventoryRoute"]),
      DEFAULT_EDITOR_INVENTORY_API_URL,
    ),
    creativeLibraryRoute: routeUrl(
      readWindowValue(WINDOW_KEYS.creativeLibraryRoute)
        ?? readDatasetValue(rootElement, ["creativeLibraryRoute"]),
      DEFAULT_CREATIVE_LIBRARY_API_URL,
    ),
    healthRoute: routeUrl(
      readWindowValue(WINDOW_KEYS.libraryHealthRoute)
        ?? readDatasetValue(rootElement, ["libraryHealthUrl", "creativeLibraryHealthUrl"]),
      DEFAULT_CREATIVE_LIBRARY_HEALTH_URL,
    ),
    metadataRoute: routeUrl(
      readWindowValue(WINDOW_KEYS.libraryMetadataRoute)
        ?? readDatasetValue(rootElement, ["libraryMetadataUrl", "creativeLibraryMetadataUrl"]),
      DEFAULT_CREATIVE_LIBRARY_METADATA_URL,
    ),
    browserCallsLibraryDirectly: false,
  };
}

function createRuntimeConfigFeatureFlags(
  features: RuntimeFeatureConfig,
  inventory: RuntimeInventoryConfig,
  library: RuntimeLibraryConfig,
): RuntimeConfigFeatureFlags {
  return {
    chunkServiceEnabled: true,
    localWorldFallbackEnabled: false,
    legacyFrontendEnabled: false,
    chunkServiceInventoryEnabled: false,
    chunkPaletteInventoryFallbackEnabled: false,
    placeableBlocksPlaceholderRouteEnabled: false,
    legacyChunkInventoryEnabled: false,
    editorInventoryApiEnabled: inventory.enabled,
    libraryInventoryEnabled: inventory.enabled,
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,
    remoteCommandsEnabled: true,
    dirtyChunkReloadEnabled: true,
    pointerLockEnabled: features.pointerLockEnabled,
    firstPersonEnabled: features.firstPersonEnabled,
    physicsEnabled: features.physicsEnabled,
    playerCollisionEnabled: features.playerCollisionEnabled,
    flightModeEnabled: features.flightModeEnabled,
    crosshairEnabled: features.crosshairEnabled,
    hotbarEnabled: features.hotbarEnabled,
    statusBarEnabled: features.statusBarEnabled,
    loadingOverlayEnabled: true,
    errorPanelEnabled: true,
    debugOverlayEnabled: features.debugOverlayEnabled,
    creativeLibraryEnabled: features.creativeLibraryEnabled && library.enabled,
  };
}

export function readRuntimeConfig(options?: ReadRuntimeConfigOptions): RuntimeConfig {
  const createdAt = nowIsoStringSafe();
  const rootElement = options?.rootElement ?? null;
  const buildMode = safeString(
    readWindowValue(WINDOW_KEYS.buildMode)
      ?? readDatasetValue(rootElement, ["editorBuildMode", "buildMode"]),
    options?.defaults?.buildMode ?? "development",
  );
  const buildVersion = safeString(
    readWindowValue(WINDOW_KEYS.buildVersion)
      ?? readDatasetValue(rootElement, ["editorBuildVersion", "buildVersion"]),
    options?.defaults?.buildVersion ?? "dev",
  );
  const apiBaseUrl = routeUrl(
    readWindowValue(WINDOW_KEYS.chunkApiBaseUrl)
      ?? readWindowValue(WINDOW_KEYS.chunkProxyBaseUrl)
      ?? readDatasetValue(rootElement, ["chunkServiceApiBaseUrl", "chunkApiBaseUrl", "chunkProxyBaseUrl"]),
    options?.defaults?.chunkProxyBaseUrl ?? DEFAULT_CHUNK_PROXY_BASE_URL,
  );
  const browserBaseUrl = routeUrl(
    readWindowValue(WINDOW_KEYS.chunkBrowserBaseUrl)
      ?? readDatasetValue(rootElement, ["chunkServiceBrowserBaseUrl", "chunkBrowserBaseUrl"]),
    apiBaseUrl,
  );
  const projectId = safeString(
    readWindowValue(WINDOW_KEYS.defaultProjectId)
      ?? readDatasetValue(rootElement, ["chunkServiceProjectId", "projectId"]),
    options?.defaults?.projectId ?? DEFAULT_PROJECT_ID,
  );
  const worldId = safeString(
    readWindowValue(WINDOW_KEYS.defaultWorldId)
      ?? readDatasetValue(rootElement, ["chunkServiceWorldId", "worldId"]),
    options?.defaults?.worldId ?? DEFAULT_WORLD_ID,
  );

  const physicsBootstrap = buildDefaultPhysicsBootstrap();
  const renderBootstrap = buildDefaultRenderBootstrap();
  const chunkService = buildDefaultChunkServiceConfig({
    apiBaseUrl,
    browserBaseUrl,
    projectId,
    worldId,
  });
  const runtimeBase = buildDefaultRuntimeConfig(
    chunkService,
    physicsBootstrap,
    buildDefaultRuntimeInventoryConfig(),
    buildDefaultRuntimeLibraryConfig(),
  );

  const resolved = createResolvedRuntimeConfig(
    {
      runtime: runtimeBase,
      physics: physicsBootstrap,
      featureFlags: buildDefaultFeatureFlags(),
      input: buildDefaultInputBootstrap(),
      camera: buildDefaultCameraBootstrap(),
      render: renderBootstrap,
    } as EditorBootstrap,
    options?.overrides ?? null,
  );

  const inventory = createRuntimeInventoryConfig({
    rootElement,
    defaults: options?.defaults,
  });
  const library = createRuntimeLibraryConfig(rootElement);
  const features = resolved.features;
  const featureFlags = createRuntimeConfigFeatureFlags(features, inventory, library);
  const warnings = [
    ...resolved.warnings.map((warning) => warning.message),
    ...(safeBoolean(readWindowValue(WINDOW_KEYS.localWorldFallbackEnabled), false)
      ? ["Local world fallback is disabled in the current editor runtime."]
      : []),
    ...(safeBoolean(readWindowValue(WINDOW_KEYS.legacyFrontendEnabled), false)
      ? ["Legacy frontend is disabled in the current editor runtime."]
      : []),
  ];

  return {
    kind: RUNTIME_CONFIG_KIND,
    schemaVersion: RUNTIME_CONFIG_KIND,
    status: warnings.length > 0 ? "degraded" : "ready",
    source: "merged",
    environment: runtimeEnvironmentFromBuildMode(buildMode),
    buildMode,
    buildVersion,
    createdAt,
    updatedAt: createdAt,
    runtime: {
      ...resolved.runtime,
      chunk: {
        ...resolved.runtime.chunk,
        apiBaseUrl,
        browserBaseUrl,
        projectId,
        worldId,
      },
      inventory: buildDefaultRuntimeInventoryConfig({
        apiUrl: inventory.apiUrl,
        inventoryUrl: inventory.inventoryUrl,
        route: inventory.route,
        healthUrl: inventory.healthUrl,
        metadataUrl: inventory.metadataUrl,
        hotbarSize: inventory.hotbarSize,
        slotCount: inventory.slotCount,
        selectedSlot: inventory.selectedSlot,
        defaultSelectedSlot: inventory.defaultSelectedSlot,
        forceRefreshOnBoot: inventory.forceRefreshOnBoot,
        includeEmptySlots: inventory.includeEmptySlots,
        allowEmptyFallback: inventory.allowEmptyFallback,
        requestTimeoutMs: inventory.requestTimeoutMs,
        cacheTtlMs: inventory.cacheTtlMs,
        staleCacheTtlMs: inventory.staleCacheTtlMs,
      }),
      library: buildDefaultRuntimeLibraryConfig(library),
    },
    chunk: {
      ...resolved.chunk,
      apiBaseUrl,
      browserBaseUrl,
      projectId,
      worldId,
      service: {
        ...resolved.chunk.service,
        apiBaseUrl,
        browserBaseUrl,
        projectId,
        worldId,
      },
    },
    inventory,
    library,
    input: resolved.input,
    camera: resolved.camera,
    render: resolved.render,
    physics: resolved.physics,
    features,
    featureFlags,
    warnings,
    warningDetails: resolved.warnings,
    lastError: resolved.lastError,
  };
}

export function runtimeConfigToBootstrapDefaults(config: RuntimeConfig): EditorBootstrapDefaults {
  return {
    buildMode: config.buildMode,
    buildVersion: config.buildVersion,
    chunkProxyBaseUrl: config.chunk.apiBaseUrl,
    projectId: config.chunk.projectId,
    worldId: config.chunk.worldId,
    localWorldFallbackEnabled: false,
  };
}

export function installRuntimeConfigWindowGlobals(config: RuntimeConfig): void {
  try {
    const target = windowRecord();

    target[WINDOW_KEYS.runtimeConfig] = config;
    target[WINDOW_KEYS.buildMode] = config.buildMode;
    target[WINDOW_KEYS.buildVersion] = config.buildVersion;

    target[WINDOW_KEYS.chunkApiBaseUrl] = config.chunk.apiBaseUrl;
    target[WINDOW_KEYS.chunkBrowserBaseUrl] = config.chunk.browserBaseUrl;
    target[WINDOW_KEYS.chunkProxyBaseUrl] = config.chunk.apiBaseUrl;
    target[WINDOW_KEYS.defaultProjectId] = config.chunk.projectId;
    target[WINDOW_KEYS.defaultWorldId] = config.chunk.worldId;

    target[WINDOW_KEYS.inventoryApiUrl] = config.inventory.apiUrl;
    target[WINDOW_KEYS.inventoryUrl] = config.inventory.inventoryUrl;
    target[WINDOW_KEYS.inventoryRoute] = config.inventory.route;
    target[WINDOW_KEYS.inventoryHealthUrl] = config.inventory.healthUrl;
    target[WINDOW_KEYS.inventoryMetadataUrl] = config.inventory.metadataUrl;
    target[WINDOW_KEYS.inventoryHotbarSize] = config.inventory.hotbarSize;
    target[WINDOW_KEYS.inventorySelectedSlot] = config.inventory.selectedSlot;
    target[WINDOW_KEYS.inventoryForceRefresh] = config.inventory.forceRefreshOnBoot;
    target[WINDOW_KEYS.inventoryForceRefreshOnBoot] = config.inventory.forceRefreshOnBoot;

    target[WINDOW_KEYS.libraryApiUrl] = config.library.apiUrl;
    target[WINDOW_KEYS.libraryBrowserApiUrl] = config.library.browserApiUrl;
    target[WINDOW_KEYS.libraryInventoryRoute] = config.library.inventoryRoute;
    target[WINDOW_KEYS.creativeLibraryRoute] = config.library.creativeLibraryRoute;
    target[WINDOW_KEYS.libraryHealthRoute] = config.library.healthRoute;
    target[WINDOW_KEYS.libraryMetadataRoute] = config.library.metadataRoute;

    target[WINDOW_KEYS.localWorldFallbackEnabled] = false;
    target[WINDOW_KEYS.legacyFrontendEnabled] = false;
  } catch {
    // Window globals are diagnostic only.
  }
}

export function shouldUsePhysicsRuntime(config: ResolvedEditorRuntimeConfig | RuntimeConfig): boolean {
  try {
    return Boolean(
      config.physics.enabled &&
      config.features.physicsEnabled &&
      config.features.playerCollisionEnabled,
    );
  } catch {
    return false;
  }
}

export function shouldUseFlightMode(config: ResolvedEditorRuntimeConfig | RuntimeConfig): boolean {
  try {
    return Boolean(
      shouldUsePhysicsRuntime(config) &&
      config.features.flightModeEnabled,
    );
  } catch {
    return false;
  }
}

export function shouldUseDirectCameraMovement(config: ResolvedEditorRuntimeConfig | RuntimeConfig): boolean {
  try {
    return Boolean(
      config.camera.directMovementEnabled &&
      !shouldUsePhysicsRuntime(config),
    );
  } catch {
    return false;
  }
}

export function shouldCameraFollowPhysics(config: ResolvedEditorRuntimeConfig | RuntimeConfig): boolean {
  try {
    return Boolean(
      config.camera.physicsFollowEnabled &&
      shouldUsePhysicsRuntime(config),
    );
  } catch {
    return false;
  }
}

export function getRuntimeVisibleChunkRadius(config: ResolvedEditorRuntimeConfig | RuntimeConfig): number {
  try {
    return safeInteger(
      config.chunk.visibleChunkRadius,
      config.render.visibleChunkRadius,
      0,
      32,
    );
  } catch {
    return 1;
  }
}

export function runtimeConfigToPhysicsConfigPatch(
  config: ResolvedEditorRuntimeConfig | RuntimeConfig,
): PhysicsConfigPatch {
  try {
    return config.physics.physicsConfigPatch;
  } catch {
    return createDefaultPhysicsConfig();
  }
}

export function runtimeConfigToPhysicsRuntimeConfigPatch(
  config: ResolvedEditorRuntimeConfig | RuntimeConfig,
): PhysicsRuntimeConfigPatch {
  try {
    return config.physics.runtimeConfigPatch;
  } catch {
    return editorPhysicsBootstrapToRuntimeConfigPatch(buildDefaultPhysicsBootstrap());
  }
}

export function runtimeConfigToPlayerControllerConfigPatch(
  config: ResolvedEditorRuntimeConfig | RuntimeConfig,
): PlayerPhysicsControllerConfigPatch {
  try {
    return config.physics.controllerConfigPatch;
  } catch {
    return editorPhysicsBootstrapToControllerConfigPatch(buildDefaultPhysicsBootstrap());
  }
}

export function runtimeConfigToDebugSummary(
  config: ResolvedEditorRuntimeConfig | RuntimeConfig,
): Record<string, unknown> {
  try {
    return {
      kind: config.kind,
      status: config.status,
      source: config.source,
      chunk: {
        apiBaseUrl: config.chunk.apiBaseUrl,
        projectId: config.chunk.projectId,
        worldId: config.chunk.worldId,
        visibleChunkRadius: config.chunk.visibleChunkRadius,
        maxBatchChunks: config.chunk.maxBatchChunks,
      },
      inventory: "inventory" in config
        ? {
            apiUrl: config.inventory.apiUrl,
            route: config.inventory.route,
            hotbarSize: config.inventory.hotbarSize,
            selectedSlot: config.inventory.selectedSlot,
            onlyLibraryItemsPlaceable: config.inventory.onlyLibraryItemsPlaceable,
            debugGrassDirtAllowed: config.inventory.debugGrassDirtAllowed,
          }
        : null,
      physics: {
        enabled: config.physics.enabled,
        mode: config.physics.bootstrap.mode,
        fixedTimeStepSeconds: config.physics.bootstrap.timing.fixedTimeStepSeconds,
        maxSubSteps: config.physics.bootstrap.timing.maxSubSteps,
        walkSpeed: config.physics.bootstrap.movement.walkSpeed,
        sprintSpeed: config.physics.bootstrap.movement.sprintSpeed,
        flySpeed: config.physics.bootstrap.movement.flySpeed,
        missingChunkPolicy: config.physics.bootstrap.missingChunks.policy,
      },
      camera: {
        physicsFollowEnabled: config.camera.physicsFollowEnabled,
        directMovementEnabled: config.camera.directMovementEnabled,
        spawn: config.camera.spawn,
      },
      features: config.features,
      warnings: config.warnings,
      lastError: config.lastError,
    };
  } catch {
    return {
      kind: RUNTIME_CONFIG_KIND,
      status: "failed",
      error: "runtime_config_debug_summary_failed",
    };
  }
}

export function createRuntimeConfigCache(
  initialConfig?: ResolvedEditorRuntimeConfig | null,
): RuntimeConfigCache {
  let revision = 0;
  let current = initialConfig ?? createResolvedRuntimeConfig(null, {
    source: "defaults",
  });

  return {
    kind: RUNTIME_CONFIG_CACHE_KIND,

    get(): ResolvedEditorRuntimeConfig {
      try {
        return current;
      } catch {
        current = createResolvedRuntimeConfig(null, {
          source: "defaults",
        });
        return current;
      }
    },

    set(config: ResolvedEditorRuntimeConfig): ResolvedEditorRuntimeConfig {
      try {
        current = {
          ...config,
          source: config.source === "unknown" ? "cache" : config.source,
          updatedAt: nowIsoStringSafe(),
        };
        revision += 1;
        return current;
      } catch {
        current = createResolvedRuntimeConfig(null, {
          source: "defaults",
        });
        revision += 1;
        return current;
      }
    },

    updateFromBootstrap(
      bootstrap: EditorBootstrap | null | undefined,
      overrides?: RuntimeConfigOverrides | null,
    ): ResolvedEditorRuntimeConfig {
      try {
        current = createResolvedRuntimeConfig(bootstrap, {
          ...(overrides ?? {}),
          source: overrides?.source ?? "bootstrap",
        });
        revision += 1;
        return current;
      } catch {
        current = createResolvedRuntimeConfig(null, {
          source: "defaults",
        });
        revision += 1;
        return current;
      }
    },

    clear(): void {
      try {
        current = createResolvedRuntimeConfig(null, {
          source: "defaults",
        });
        revision += 1;
      } catch {
        revision += 1;
      }
    },

    getRevision(): number {
      return revision;
    },
  };
}

export function isResolvedEditorRuntimeConfig(value: unknown): value is ResolvedEditorRuntimeConfig {
  try {
    const candidate = value as ResolvedEditorRuntimeConfig | null | undefined;

    return Boolean(
      candidate &&
        candidate.kind === RUNTIME_CONFIG_KIND &&
        candidate.chunk &&
        candidate.input &&
        candidate.camera &&
        candidate.render &&
        candidate.physics &&
        candidate.features,
    );
  } catch {
    return false;
  }
}

export function getRuntimeConfigMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.config.runtime_config",
    runtimeConfigKind: RUNTIME_CONFIG_KIND,
    runtimeConfigCacheKind: RUNTIME_CONFIG_CACHE_KIND,
    supportsMainRuntimeConfigExports: true,
    productiveInventoryRoute: DEFAULT_EDITOR_INVENTORY_API_URL,
    creativeLibraryRoute: DEFAULT_CREATIVE_LIBRARY_API_URL,
    rules: {
      readRuntimeConfigExported: true,
      installRuntimeConfigWindowGlobalsExported: true,
      runtimeConfigToBootstrapDefaultsExported: true,
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      legacyChunkInventoryDisabled: true,
      localWorldFallbackDisabled: true,
      legacyFrontendDisabled: true,
      inventoryForceRefreshWindowKeySupported: true,
    },
  };
}