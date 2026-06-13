// services/vectoplan-editor/src/frontend/runtime/world/chunk_service_source.ts
import type { EditorBootstrap } from "@bootstrap/bootstrap_models";
import type {
  ChunkApiBatchChunkRequest,
  ChunkApiBatchResult,
  ChunkApiBlocksResult,
  ChunkApiChunkCoordinates,
  ChunkApiChunkResult,
  ChunkApiClient,
  ChunkApiCommandPayload,
  ChunkApiCommandResult,
  ChunkApiFailedResult,
  ChunkApiWorldPosition,
} from "@api/chunk_api_models";
import {
  isChunkApiFailedResult,
  normalizeChunkApiCoordinates,
  normalizeChunkApiWorldPosition,
} from "@api/chunk_api_models";
import type {
  EditorInventoryLibraryRef,
  EditorInventoryPlacementCommand,
} from "@api/editor_inventory_models";
import type { EditorLogger } from "@utils/logger";
import { createEditorId } from "@utils/ids";
import { safeBoolean, safeInteger, safeString, uniqueStrings } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import {
  BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
  DEBUG_GRASS_DIRT_ALLOWED,
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
  LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
  ONLY_LIBRARY_ITEMS_PLACEABLE,
  PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
  createEditorLibraryPlacementContext,
  editorInventoryContractDiagnostics,
  editorInventoryContractRules,
  getEditorInventoryContractMetadata,
  hasLibraryIdentity as contractHasLibraryIdentity,
  isForbiddenDebugBlockTypeId,
  isValidEditorLibraryPlacementContext,
  libraryRefFromPlacementCommand as contractLibraryRefFromPlacementCommand,
  mergeContractMetadata,
  normalizeContractText,
  normalizeEditorInventoryLibraryRef,
  normalizeEditorInventoryPlacementCommand,
  normalizeOptionalContractInteger,
  normalizeOptionalContractText,
  normalizeRuntimeBlockTypeId as normalizeContractRuntimeBlockTypeId,
  runtimeBlockTypeIdFromPlacementCommand as contractRuntimeBlockTypeIdFromPlacementCommand,
} from "../../contracts/editor_inventory_contract";
import {
  assertValidChunkSourcePlacementContext,
  createChunkSourceEvent,
  createChunkSourceFailedResult,
  createChunkSourceLifecycleState,
  createChunkSourceMetadata,
  createChunkSourcePlacementContextForRemove,
  createChunkSourcePlacementContextFromLibraryInput,
  createChunkSourcePlacementContextFromSetBlock,
  createChunkSourceSummary,
  createLegacyDiagnosticInventoryResult,
  DEFAULT_CHUNK_SOURCE_CAPABILITIES,
  notifyChunkSourceListeners,
  PRODUCTIVE_CHUNK_SOURCE_INVENTORY_ROUTE,
  updateChunkSourceLifecycleState,
  type ChunkSource,
  type ChunkSourceCommandOptions,
  type ChunkSourceCommandResult,
  type ChunkSourceDirtyOptions,
  type ChunkSourceEvent,
  type ChunkSourceEventListener,
  type ChunkSourceInventoryResult,
  type ChunkSourceLifecycleState,
  type ChunkSourceLibraryPlacementInput,
  type ChunkSourceLoadChunkOptions,
  type ChunkSourceLoadChunkResult,
  type ChunkSourceLoadChunksOptions,
  type ChunkSourceLoadChunksResult,
  type ChunkSourceMetadata,
  type ChunkSourcePlacementContext,
  type ChunkSourceSummary,
  type ChunkSourceUnsubscribe,
} from "./chunk_source";
import {
  chunkCoordinatesFromKey,
  sortChunkKeys,
  type ChunkCoordinates,
} from "./chunk_coordinates";
import type { RuntimeChunkContent } from "./chunk_content";
import {
  createChunkRegistry,
  type ChunkRegistryHandle,
} from "./chunk_registry";
import {
  createChunkEditSession,
  type ChunkEditLibraryPlacementInput,
  type ChunkEditSessionHandle,
} from "./chunk_edit_session";

export interface CreateChunkServiceSourceOptions {
  readonly client: ChunkApiClient;
  readonly bootstrap?: EditorBootstrap;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;
  readonly registry?: ChunkRegistryHandle;
  readonly editSession?: ChunkEditSessionHandle;
  readonly id?: string;
  readonly label?: string;
  readonly projectId?: string;
  readonly worldId?: string;
  readonly apiBaseUrl?: string;
  readonly sourceKind?: string;
  readonly mode?: string;
  readonly maxChunks?: number;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly autoInitialize?: boolean;
}

export interface CreateChunkServiceSourceFromBootstrapOptions {
  readonly bootstrap: EditorBootstrap;
  readonly client: ChunkApiClient;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;
  readonly registry?: ChunkRegistryHandle;
  readonly editSession?: ChunkEditSessionHandle;
  readonly maxChunks?: number;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly autoInitialize?: boolean;
}

export interface ChunkServiceSourceLibraryPlacementInput
  extends ChunkEditLibraryPlacementInput,
    ChunkSourceLibraryPlacementInput {
  readonly runtimeBlockTypeId?: string | null;
  readonly blockTypeId?: string | null;
  readonly libraryItemId?: string | null;
  readonly inventoryItemId?: string | null;
  readonly inventorySlotIndex?: number | null;
  readonly familyId?: string | null;
  readonly packageId?: string | null;
  readonly vplibUid?: string | null;
  readonly variantId?: string | null;
  readonly revisionHash?: string | null;
  readonly objectKind?: string | null;
  readonly libraryRef?: EditorInventoryLibraryRef | null;
  readonly placementCommand?: EditorInventoryPlacementCommand | null;
  readonly commandMetadata?: Record<string, unknown> | null;
}

export interface ChunkServiceSource extends ChunkSource {
  readonly kind: "chunk-service";
  readonly serviceKind: "vectoplan-editor-chunk-service-source.v1";

  /**
   * Semantischer Library-/VPLIB-Placement-Pfad.
   *
   * Der Chunk-Service erhält weiterhin einen kompatiblen SetBlock-Command mit
   * `blockTypeId = runtimeBlockTypeId`. Die Library-Identität wird an die
   * Edit-Session weitergegeben und bleibt dort in History/Snapshot erhalten.
   */
  placeLibraryItem(
    position: ChunkApiWorldPosition,
    placement: ChunkServiceSourceLibraryPlacementInput,
    commandOptions?: ChunkSourceCommandOptions,
  ): Promise<ChunkSourceCommandResult | ChunkApiFailedResult>;
}

type SourceRequestOverrides = {
  readonly signal?: AbortSignal;
};

type LibraryAwareCommandOptions = ChunkSourceCommandOptions & {
  readonly runtimeBlockTypeId?: string | null;
  readonly blockTypeId?: string | null;
  readonly libraryItemId?: string | null;
  readonly inventoryItemId?: string | null;
  readonly inventorySlotIndex?: number | null;
  readonly familyId?: string | null;
  readonly packageId?: string | null;
  readonly vplibUid?: string | null;
  readonly variantId?: string | null;
  readonly revisionHash?: string | null;
  readonly objectKind?: string | null;
  readonly libraryRef?: EditorInventoryLibraryRef | null;
  readonly placementCommand?: EditorInventoryPlacementCommand | null;
  readonly commandMetadata?: Record<string, unknown> | null;
  readonly includeLibraryMetadataInCommand?: boolean;
  readonly requireLibraryIdentity?: boolean;
  readonly validateAgainstLegacyBlockCatalog?: boolean;
};

const CHUNK_SERVICE_SOURCE_KIND = "vectoplan-editor-chunk-service-source.v1" as const;

const MAX_CHUNK_SERVICE_SOURCE_CACHE_ENTRIES = 512;

const TEXT_CACHE = new Map<string, string>();
const OPTIONAL_TEXT_CACHE = new Map<string, string | null>();
const RUNTIME_BLOCK_TYPE_ID_CACHE = new Map<string, string | null>();
const ERROR_MESSAGE_CACHE = new Map<string, ChunkApiFailedResult>();

function setCachedValue<K, V>(
  cache: Map<K, V>,
  key: K,
  value: V,
): V {
  try {
    if (cache.size > MAX_CHUNK_SERVICE_SOURCE_CACHE_ENTRIES) {
      cache.clear();
    }

    cache.set(key, value);
  } catch {
    // Cache is best-effort.
  }

  return value;
}

export function clearChunkServiceSourceCaches(): void {
  try {
    TEXT_CACHE.clear();
    OPTIONAL_TEXT_CACHE.clear();
    RUNTIME_BLOCK_TYPE_ID_CACHE.clear();
    ERROR_MESSAGE_CACHE.clear();
  } catch {
    // Cache clearing must never break runtime.
  }
}

function logDebug(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.debug?.(message, details);
  } catch {
    // Logging must never break source runtime.
  }
}

function logInfo(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.info?.(message, details);
  } catch {
    // Logging must never break source runtime.
  }
}

function logWarn(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.warn?.(message, details);
  } catch {
    // Logging must never break source runtime.
  }
}

function safeNow(): string {
  try {
    return nowIsoString();
  } catch {
    try {
      return new Date().toISOString();
    } catch {
      return "1970-01-01T00:00:00.000Z";
    }
  }
}

function requestOverridesFromSignal(signal?: AbortSignal): SourceRequestOverrides | undefined {
  if (!signal) {
    return undefined;
  }

  return {
    signal,
  };
}

function normalizeText(value: unknown, fallback = ""): string {
  try {
    if (typeof value === "string") {
      const cached = TEXT_CACHE.get(value);

      if (cached !== undefined) {
        return cached || fallback;
      }

      return setCachedValue(TEXT_CACHE, value, normalizeContractText(value, fallback));
    }

    return normalizeContractText(value, fallback);
  } catch {
    return fallback;
  }
}

function normalizeOptionalText(value: unknown): string | null {
  try {
    if (typeof value === "string") {
      const cached = OPTIONAL_TEXT_CACHE.get(value);

      if (cached !== undefined) {
        return cached;
      }

      return setCachedValue(OPTIONAL_TEXT_CACHE, value, normalizeOptionalContractText(value));
    }

    return normalizeOptionalContractText(value);
  } catch {
    return null;
  }
}

function normalizeChunkKey(value: unknown): string {
  try {
    const normalized = normalizeText(value, "");

    if (normalized.length > 0) {
      return normalized;
    }

    return "0:0:0";
  } catch {
    return "0:0:0";
  }
}

function chunkCoordinatesFromDirtyKey(chunkKey: string): ChunkCoordinates {
  try {
    return chunkCoordinatesFromKey(chunkKey);
  } catch {
    return {
      chunkX: 0,
      chunkY: 0,
      chunkZ: 0,
    };
  }
}

function uniqueDirtyKeys(values: readonly unknown[]): readonly string[] {
  try {
    return sortChunkKeys(uniqueStrings(values));
  } catch {
    return [];
  }
}

function isDestroyedLifecycle(lifecycle: ChunkSourceLifecycleState): boolean {
  return lifecycle.status === "destroyed" || lifecycle.status === "destroying";
}

function createFailedFromDestroyed(): ChunkApiFailedResult {
  return createChunkSourceFailedResult({
    error: new Error("ChunkServiceSource is destroyed."),
    fallbackMessage: "ChunkServiceSource is destroyed.",
    source: "client-fallback",
  });
}

function createFailedFromUnknown(error: unknown, fallbackMessage: string): ChunkApiFailedResult {
  return createChunkSourceFailedResult({
    error,
    fallbackMessage,
    source: "unknown",
  });
}

function createFailedFromMessage(
  message: string,
  source: ChunkApiFailedResult["source"] = "client-fallback",
  details?: Record<string, unknown>,
): ChunkApiFailedResult {
  const cacheKey = `${source}:${message}:${JSON.stringify(details ?? {})}`;

  const cached = ERROR_MESSAGE_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  return setCachedValue(ERROR_MESSAGE_CACHE, cacheKey, createChunkSourceFailedResult({
    error: new Error(message),
    fallbackMessage: message,
    source,
    details: {
      ...(details ?? {}),
      productiveInventoryRoute: PRODUCTIVE_CHUNK_SOURCE_INVENTORY_ROUTE,
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
      legacyChunkBlocksAreDiagnosticOnly: LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
      onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
      debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
      forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    },
  }));
}

function createSyntheticChunkResult(chunk: RuntimeChunkContent): ChunkApiChunkResult {
  return {
    ok: true,
    request: null,
    source: "client-fallback",
    raw: chunk.raw,
    error: null,
    projectId: chunk.projectId,
    universeId: chunk.universeId,
    worldId: chunk.worldId,
    chunkKey: chunk.chunkKey,
    chunk: chunk.raw as ChunkApiChunkResult["chunk"],
    flags: {
      snapshotBacked: chunk.source === "snapshot",
      providerGenerated: chunk.source === "generated",
      materialized: chunk.source === "snapshot",
      createdSnapshot: false,
    },
    routeHints: {
      editorInventory: PRODUCTIVE_CHUNK_SOURCE_INVENTORY_ROUTE,
    },
  };
}

function createSyntheticBatchResult(
  chunks: readonly RuntimeChunkContent[],
  projectId: string,
  worldId: string,
): ChunkApiBatchResult {
  return {
    ok: true,
    request: null,
    source: "client-fallback",
    raw: {
      synthetic: true,
      source: "chunk-service-source-cache",
      chunks: chunks.map((chunk) => chunk.raw),
      productiveInventoryRoute: PRODUCTIVE_CHUNK_SOURCE_INVENTORY_ROUTE,
    },
    error: null,
    projectId,
    worldId,
    chunks: chunks.map((chunk) => chunk.raw as ChunkApiBatchResult["chunks"][number]),
    failedChunks: [],
  };
}

function isForbiddenDebugBlockTypeId(value: unknown): boolean {
  return isForbiddenDebugBlockTypeIdContract(value);
}

function isForbiddenDebugBlockTypeIdContract(value: unknown): boolean {
  return isForbiddenDebugBlockTypeId(value);
}