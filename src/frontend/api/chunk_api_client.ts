// services/vectoplan-editor/src/frontend/api/chunk_api_client.ts
import type { EditorChunkServiceConfig } from "@bootstrap/bootstrap_models";
import {
  chunkApiErrorToDetails,
  createAbortedError,
  createInvalidPayloadError,
  createUnknownBlockTypeError,
} from "./chunk_api_errors";
import {
  createHttpJsonClient,
  type HttpJsonClient,
  type HttpJsonRequestFailure,
  type HttpJsonRequestResult,
} from "./http_client";
import {
  buildBlocksResultFromChunkResult,
  buildStaticFallbackBlocksResult,
  normalizeChunkApiBatchResult,
  normalizeChunkApiBlocksResult,
  normalizeChunkApiChunkResult,
  normalizeChunkApiCommandResult,
  normalizeChunkApiConnectionTestResult,
  normalizeChunkApiPlaceableBlocksResult,
  normalizeChunkApiProjectBootstrapResult,
  normalizeChunkApiStatusResult,
} from "./chunk_api_normalize";
import {
  buildPlaceableBlocksPlaceholderResponse,
  CHUNK_API_CLIENT_KIND,
  CHUNK_API_CREATIVE_LIBRARY_HEALTH_ROUTE,
  CHUNK_API_CREATIVE_LIBRARY_METADATA_ROUTE,
  CHUNK_API_CREATIVE_LIBRARY_ROUTE,
  CHUNK_API_DEFAULT_PLACEABLE_BLOCKS,
  CHUNK_API_DEFAULT_PROJECT_ID,
  CHUNK_API_DEFAULT_SESSION_ID_PREFIX,
  CHUNK_API_DEFAULT_USER_ID,
  CHUNK_API_DEFAULT_WORLD_ID,
  CHUNK_API_EDITOR_INVENTORY_HEALTH_ROUTE,
  CHUNK_API_EDITOR_INVENTORY_METADATA_ROUTE,
  CHUNK_API_EDITOR_INVENTORY_ROUTE,
  isChunkApiFailedResult,
  normalizeChunkApiClientConfig,
  normalizeChunkApiCoordinates,
  normalizeChunkApiWorldPosition,
  type ChunkApiBatchChunkRequest,
  type ChunkApiBatchResult,
  type ChunkApiBlockDefinition,
  type ChunkApiBlocksResult,
  type ChunkApiChunkCoordinates,
  type ChunkApiChunkResult,
  type ChunkApiClient,
  type ChunkApiClientConfig,
  type ChunkApiCommandPayload,
  type ChunkApiCommandResult,
  type ChunkApiConnectionTestResult,
  type ChunkApiFailedResult,
  type ChunkApiHttpMethod,
  type ChunkApiLogger,
  type ChunkApiPlaceableBlockDefinition,
  type ChunkApiPlaceableBlocksResult,
  type ChunkApiProjectBootstrapResult,
  type ChunkApiRequestKind,
  type ChunkApiRequestOptions,
  type ChunkApiRemoveBlockCommandPayload,
  type ChunkApiSetBlockCommandPayload,
  type ChunkApiStatusResult,
  type ChunkApiWorldPosition,
  type CreateChunkApiClientOptions,
} from "./chunk_api_models";

interface InternalRequestOptions {
  readonly kind: ChunkApiRequestKind;
  readonly method?: ChunkApiHttpMethod;
  readonly url: string;
  readonly body?: unknown;
  readonly timeoutMs: number;
  readonly requestOverrides?: Partial<ChunkApiRequestOptions>;
}

interface FallbackBatchLoadResult {
  readonly chunks: readonly Exclude<ChunkApiChunkResult, ChunkApiFailedResult>[];
  readonly failedChunks: readonly ChunkApiChunkCoordinates[];
  readonly rawFailures: readonly ChunkApiFailedResult[];
}

type HttpJsonAnyResult = HttpJsonRequestResult<unknown> | HttpJsonRequestFailure;

type MutableRelatedRequestOverrides = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  allowNonOk?: boolean;
};

type ExtendedCommandRequestOverrides = Partial<ChunkApiRequestOptions> & {
  readonly userId?: string;
  readonly sessionId?: string;
  readonly validateBlockTypeId?: boolean;
  readonly allowForbiddenDebugBlockTypeId?: boolean;

  /**
   * Runtime/Library fields may accidentally be passed by higher layers.
   * They are stripped before HTTP request options are forwarded.
   */
  readonly runtimeBlockTypeId?: string | null;
  readonly blockTypeId?: string | null;
  readonly libraryItemId?: string | null;
  readonly familyId?: string | null;
  readonly packageId?: string | null;
  readonly vplibUid?: string | null;
  readonly variantId?: string | null;
  readonly revisionHash?: string | null;
  readonly libraryRef?: unknown;
  readonly placementCommand?: unknown;
  readonly commandMetadata?: unknown;
};

const PRODUCTIVE_INVENTORY_ROUTE = CHUNK_API_EDITOR_INVENTORY_ROUTE;
const LEGACY_PLACEABLE_BLOCKS_ROUTE_KIND = "placeable-blocks" as const;
const LEGACY_BLOCKS_ROUTE_KIND = "blocks" as const;
const FORBIDDEN_DEBUG_BLOCK_TYPE_IDS: readonly string[] = [
  "debug_grass",
  "debug_dirt",
];

function isHttpJsonRequestFailure(result: HttpJsonAnyResult): result is HttpJsonRequestFailure {
  try {
    return result.ok === false && "error" in result;
  } catch {
    return false;
  }
}

function isHttpJsonRequestSuccess(result: HttpJsonAnyResult): result is HttpJsonRequestResult<unknown> {
  try {
    return result.ok === true;
  } catch {
    return false;
  }
}

function logDebug(
  logger: ChunkApiLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.debug?.(message, details);
  } catch {
    // Logging must never break API calls.
  }
}

function logInfo(
  logger: ChunkApiLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.info?.(message, details);
  } catch {
    // Logging must never break API calls.
  }
}

function logWarn(
  logger: ChunkApiLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.warn?.(message, details);
  } catch {
    // Logging must never break API calls.
  }
}

function safeString(value: unknown, fallback = ""): string {
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

function normalizeBaseUrl(value: unknown, fallback = "/editor/api/chunk"): string {
  try {
    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return fallback;
    }

    if (trimmed === "/") {
      return "";
    }

    return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  } catch {
    return fallback;
  }
}

function appendQuery(
  url: string,
  query: Record<string, string | number | boolean | null | undefined>,
): string {
  try {
    const pairs = Object.entries(query).filter(([, value]) => value !== undefined && value !== null);

    if (pairs.length === 0) {
      return url;
    }

    const separator = url.includes("?") ? "&" : "?";
    const queryText = pairs
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join("&");

    return `${url}${separator}${queryText}`;
  } catch {
    return url;
  }
}

function createClientConfig(config: EditorChunkServiceConfig): ChunkApiClientConfig {
  try {
    return normalizeChunkApiClientConfig(config);
  } catch {
    const apiBaseUrl = normalizeBaseUrl(config.apiBaseUrl);
    const browserBaseUrl = normalizeBaseUrl(config.browserBaseUrl, apiBaseUrl);
    const projectId = config.projectId || CHUNK_API_DEFAULT_PROJECT_ID;
    const worldId = config.worldId || CHUNK_API_DEFAULT_WORLD_ID;
    const encodedProjectId = encodeURIComponent(projectId);
    const encodedWorldId = encodeURIComponent(worldId);
    const projectBase = `${apiBaseUrl}/projects/${encodedProjectId}`;
    const worldBase = `${projectBase}/worlds/${encodedWorldId}`;

    return {
      apiBaseUrl,
      browserBaseUrl,
      projectId,
      worldId,
      sourceKind: "vectoplan-chunk",
      mode: "editor-proxy",
      preferBatchLoad: true,
      reloadDirtyChunksAfterCommand: true,
      maxBatchChunks: 256,
      routeHints: {
        status: `${apiBaseUrl}/_status`,
        connectionTest: `${apiBaseUrl}/_test/connection`,
        projects: `${apiBaseUrl}/projects`,
        project: projectBase,
        projectBootstrap: `${projectBase}/bootstrap`,
        worlds: `${projectBase}/worlds`,
        world: worldBase,

        blocks: `${worldBase}/blocks`,
        placeableBlocks: `${apiBaseUrl}/placeable-blocks`,

        editorInventory: CHUNK_API_EDITOR_INVENTORY_ROUTE,
        editorInventoryHealth: CHUNK_API_EDITOR_INVENTORY_HEALTH_ROUTE,
        editorInventoryMetadata: CHUNK_API_EDITOR_INVENTORY_METADATA_ROUTE,

        creativeLibrary: CHUNK_API_CREATIVE_LIBRARY_ROUTE,
        creativeLibraryHealth: CHUNK_API_CREATIVE_LIBRARY_HEALTH_ROUTE,
        creativeLibraryMetadata: CHUNK_API_CREATIVE_LIBRARY_METADATA_ROUTE,

        chunk: `${worldBase}/chunks`,
        chunksBatch: `${worldBase}/chunks/batch`,
        commands: `${worldBase}/commands`,
      },
      timeouts: config.timeouts,
    };
  }
}

function createSessionId(): string {
  try {
    const randomPart =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    return `${CHUNK_API_DEFAULT_SESSION_ID_PREFIX}_${Date.now()}_${randomPart}`;
  } catch {
    return `${CHUNK_API_DEFAULT_SESSION_ID_PREFIX}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

function makeRequestOptions(input: InternalRequestOptions): ChunkApiRequestOptions {
  const overrides = input.requestOverrides ?? {};
  const method = overrides.method ?? input.method ?? "GET";
  const base: ChunkApiRequestOptions = {
    kind: overrides.kind ?? input.kind,
    method,
    url: overrides.url ?? input.url,
    timeoutMs: overrides.timeoutMs ?? input.timeoutMs,
    allowNonOk: overrides.allowNonOk ?? false,
  };

  const withBody: ChunkApiRequestOptions =
    input.body === undefined && overrides.body === undefined
      ? base
      : {
          ...base,
          body: overrides.body ?? input.body,
        };

  const withHeaders: ChunkApiRequestOptions =
    overrides.headers === undefined
      ? withBody
      : {
          ...withBody,
          headers: overrides.headers,
        };

  const withSignal: ChunkApiRequestOptions =
    overrides.signal === undefined
      ? withHeaders
      : {
          ...withHeaders,
          signal: overrides.signal,
        };

  return withSignal;
}

function failedFromUnknown(input: {
  readonly error: unknown;
  readonly request?: ChunkApiFailedResult["request"];
  readonly source?: ChunkApiFailedResult["source"];
  readonly raw?: unknown;
}): ChunkApiFailedResult {
  return {
    ok: false,
    request: input.request ?? null,
    source: input.source ?? input.request?.source ?? "client-fallback",
    raw: input.raw ?? input.error ?? null,
    error: chunkApiErrorToDetails(input.error),
  };
}

function requestFailureToFailedResult(
  failure: HttpJsonRequestFailure,
  source: ChunkApiFailedResult["source"] = "editor-proxy",
): ChunkApiFailedResult {
  return {
    ok: false,
    request: failure.request,
    source,
    raw: failure.rawText,
    error: failure.error,
  };
}

function requestSuccessRaw(result: HttpJsonRequestResult<unknown>): unknown {
  try {
    return result.data;
  } catch {
    return null;
  }
}

function destroyedFailure(destroyed: boolean): ChunkApiFailedResult | null {
  if (!destroyed) {
    return null;
  }

  return failedFromUnknown({
    error: createAbortedError({
      cause: new Error("Chunk API client has been destroyed."),
    }),
    source: "client-fallback",
  });
}

function requestOverridesForRelatedRoute(
  options?: Partial<ChunkApiRequestOptions>,
): Partial<ChunkApiRequestOptions> | undefined {
  try {
    if (!options) {
      return undefined;
    }

    const related: MutableRelatedRequestOverrides = {};

    if (options.signal !== undefined) {
      related.signal = options.signal;
    }

    if (options.headers !== undefined) {
      related.headers = options.headers;
    }

    if (options.allowNonOk !== undefined) {
      related.allowNonOk = options.allowNonOk;
    }

    return Object.keys(related).length > 0 ? related : undefined;
  } catch {
    return undefined;
  }
}

function isForbiddenDebugBlockTypeId(value: unknown): boolean {
  const blockTypeId = safeString(value, "").trim();

  return FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.includes(blockTypeId);
}

function sanitizeBlockTypeId(value: unknown): string {
  const normalized = safeString(value, "").trim();

  if (!normalized || isForbiddenDebugBlockTypeId(normalized)) {
    return "";
  }

  return normalized;
}

function filterForbiddenBlockDefinitions<T extends ChunkApiBlockDefinition>(
  blocks: readonly T[],
): readonly T[] {
  try {
    return blocks.filter((block) => {
      const blockTypeId = safeString(block.blockTypeId, "").trim();

      return blockTypeId.length > 0 && !isForbiddenDebugBlockTypeId(blockTypeId);
    });
  } catch {
    return [];
  }
}

function uniqueBlockDefinitions(
  blocks: readonly ChunkApiBlockDefinition[],
): readonly ChunkApiBlockDefinition[] {
  try {
    const seen = new Set<string>();
    const result: ChunkApiBlockDefinition[] = [];

    for (const block of blocks) {
      const blockTypeId = sanitizeBlockTypeId(block.blockTypeId);

      if (!blockTypeId || seen.has(blockTypeId)) {
        continue;
      }

      seen.add(blockTypeId);
      result.push({
        ...block,
        blockTypeId,
      });
    }

    return result;
  } catch {
    return filterForbiddenBlockDefinitions(blocks);
  }
}

function blockIsPlaceable(block: ChunkApiBlockDefinition): block is ChunkApiPlaceableBlockDefinition {
  try {
    return block.placeable === true && !isForbiddenDebugBlockTypeId(block.blockTypeId);
  } catch {
    return false;
  }
}

function toPlaceableBlockDefinition(
  block: ChunkApiBlockDefinition | ChunkApiPlaceableBlockDefinition,
): ChunkApiPlaceableBlockDefinition | null {
  try {
    const blockTypeId = sanitizeBlockTypeId(block.blockTypeId);

    if (!blockTypeId || block.placeable !== true) {
      return null;
    }

    return {
      ...block,
      blockTypeId,
      placeable: true as const,
    };
  } catch {
    return null;
  }
}

function placeableBlocksFromBlocks(
  blocks: readonly ChunkApiBlockDefinition[],
): readonly ChunkApiPlaceableBlockDefinition[] {
  try {
    const result: ChunkApiPlaceableBlockDefinition[] = [];

    for (const block of blocks) {
      if (!blockIsPlaceable(block)) {
        continue;
      }

      const placeable = toPlaceableBlockDefinition(block);

      if (placeable) {
        result.push(placeable);
      }
    }

    return result;
  } catch {
    return [];
  }
}

function sanitizePlaceableBlocks(
  blocks: readonly ChunkApiPlaceableBlockDefinition[],
): readonly ChunkApiPlaceableBlockDefinition[] {
  try {
    const result: ChunkApiPlaceableBlockDefinition[] = [];

    for (const block of filterForbiddenBlockDefinitions(blocks)) {
      const placeable = toPlaceableBlockDefinition(block);

      if (placeable) {
        result.push(placeable);
      }
    }

    return result;
  } catch {
    return [];
  }
}

function sanitizeBlocksResult(
  result: ChunkApiBlocksResult,
  reason: string,
): ChunkApiBlocksResult {
  const blocks = uniqueBlockDefinitions(filterForbiddenBlockDefinitions(result.blocks));
  const placeableBlocks = sanitizePlaceableBlocks(
    result.placeableBlocks.length > 0
      ? result.placeableBlocks
      : placeableBlocksFromBlocks(blocks),
  );

  return {
    ...result,
    raw: {
      reason,
      originalRaw: result.raw,
      legacyDiagnosticOnly: true,
      productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
      forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    },
    blocks: uniqueBlockDefinitions([...blocks, ...placeableBlocks]),
    placeableBlocks,
    collectionKind: result.collectionKind ?? "combined",
    inventoryRouteKind: LEGACY_PLACEABLE_BLOCKS_ROUTE_KIND,
    creativeLibraryRouteKind: LEGACY_BLOCKS_ROUTE_KIND,
    inventoryBlockCount: placeableBlocks.length,
    creativeLibraryBlockCount: blocks.length,
  };
}

function sanitizePlaceableBlocksResult(
  result: ChunkApiPlaceableBlocksResult,
  reason: string,
): ChunkApiPlaceableBlocksResult {
  const blocks = uniqueBlockDefinitions(filterForbiddenBlockDefinitions(result.blocks));
  const placeableBlocks = sanitizePlaceableBlocks(
    result.placeableBlocks.length > 0
      ? result.placeableBlocks
      : placeableBlocksFromBlocks(blocks),
  );

  return {
    ...result,
    raw: {
      reason,
      originalRaw: result.raw,
      legacyDiagnosticOnly: true,
      productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
      forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    },
    blocks: uniqueBlockDefinitions([...blocks, ...placeableBlocks]),
    placeableBlocks,
    collectionKind: result.collectionKind ?? "inventory",
    inventoryRouteKind: LEGACY_PLACEABLE_BLOCKS_ROUTE_KIND,
    creativeLibraryRouteKind: LEGACY_BLOCKS_ROUTE_KIND,
    inventoryBlockCount: placeableBlocks.length,
    creativeLibraryBlockCount: blocks.length,
  };
}

function collectKnownBlockTypeIds(blocks: readonly ChunkApiBlockDefinition[]): readonly string[] {
  try {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const block of blocks) {
      const blockTypeId = sanitizeBlockTypeId(block.blockTypeId);

      if (!blockTypeId || seen.has(blockTypeId)) {
        continue;
      }

      seen.add(blockTypeId);
      result.push(blockTypeId);
    }

    return result;
  } catch {
    return [];
  }
}

function commandOptionsWithoutEditorFields(
  options?: ExtendedCommandRequestOverrides,
): Partial<ChunkApiRequestOptions> | undefined {
  if (!options) {
    return undefined;
  }

  const {
    userId: _userId,
    sessionId: _sessionId,
    validateBlockTypeId: _validateBlockTypeId,
    allowForbiddenDebugBlockTypeId: _allowForbiddenDebugBlockTypeId,
    runtimeBlockTypeId: _runtimeBlockTypeId,
    blockTypeId: _blockTypeId,
    libraryItemId: _libraryItemId,
    familyId: _familyId,
    packageId: _packageId,
    vplibUid: _vplibUid,
    variantId: _variantId,
    revisionHash: _revisionHash,
    libraryRef: _libraryRef,
    placementCommand: _placementCommand,
    commandMetadata: _commandMetadata,
    ...requestOptions
  } = options;

  return requestOptions;
}

function validateOutgoingCommand(command: ChunkApiCommandPayload): ChunkApiFailedResult | null {
  try {
    if (command.type !== "SetBlock") {
      return null;
    }

    const blockTypeId = (command as ChunkApiSetBlockCommandPayload).blockTypeId;

    if (isForbiddenDebugBlockTypeId(blockTypeId)) {
      return failedFromUnknown({
        error: createInvalidPayloadError({
          message: `Forbidden debug block type '${blockTypeId}' cannot be placed from the editor.`,
          details: {
            blockTypeId,
            forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
            productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
          },
        }),
        source: "client-fallback",
      });
    }

    if (!sanitizeBlockTypeId(blockTypeId)) {
      return failedFromUnknown({
        error: createUnknownBlockTypeError({
          blockTypeId: String(blockTypeId),
        }),
        source: "client-fallback",
      });
    }

    return null;
  } catch (error) {
    return failedFromUnknown({
      error,
      source: "client-fallback",
    });
  }
}

async function tryFallbackBatchLoad(
  chunks: readonly ChunkApiBatchChunkRequest[],
  loadChunk: (coordinates: ChunkApiChunkCoordinates) => Promise<ChunkApiChunkResult | ChunkApiFailedResult>,
): Promise<FallbackBatchLoadResult> {
  const loadedChunks: Exclude<ChunkApiChunkResult, ChunkApiFailedResult>[] = [];
  const failedChunks: ChunkApiChunkCoordinates[] = [];
  const rawFailures: ChunkApiFailedResult[] = [];

  for (const chunk of chunks) {
    const coordinates = normalizeChunkApiCoordinates(chunk);

    try {
      const result = await loadChunk(coordinates);

      if (isChunkApiFailedResult(result)) {
        failedChunks.push(coordinates);
        rawFailures.push(result);
        continue;
      }

      loadedChunks.push(result);
    } catch (error) {
      failedChunks.push(coordinates);
      rawFailures.push(
        failedFromUnknown({
          error,
          source: "client-fallback",
        }),
      );
    }
  }

  return {
    chunks: loadedChunks,
    failedChunks,
    rawFailures,
  };
}

function createNoChunkLoadedFailure(input: {
  readonly raw?: unknown;
  readonly reason: string;
  readonly source?: ChunkApiFailedResult["source"];
}): ChunkApiFailedResult {
  return failedFromUnknown({
    error: createInvalidPayloadError({
      message: "No chunks could be loaded.",
      details: {
        reason: input.reason,
      },
    }),
    raw: input.raw ?? null,
    source: input.source ?? "editor-proxy",
  });
}

function mergeCreativeCatalogAndInventory(input: {
  readonly creative: ChunkApiBlocksResult;
  readonly inventory: ChunkApiPlaceableBlocksResult | ChunkApiBlocksResult | null;
  readonly rawReason: string;
}): ChunkApiBlocksResult {
  const inventoryBlocks = input.inventory?.placeableBlocks.length
    ? sanitizePlaceableBlocks(input.inventory.placeableBlocks)
    : input.creative.placeableBlocks.length
      ? sanitizePlaceableBlocks(input.creative.placeableBlocks)
      : placeableBlocksFromBlocks(input.creative.blocks);

  const creativeBlocks = input.creative.blocks.length > 0
    ? uniqueBlockDefinitions([
        ...input.creative.blocks,
        ...inventoryBlocks,
      ])
    : uniqueBlockDefinitions([
        ...(input.inventory?.blocks ?? []),
        ...inventoryBlocks,
      ]);

  return sanitizeBlocksResult(
    {
      ...input.creative,
      raw: {
        reason: input.rawReason,
        creativeRaw: input.creative.raw,
        inventoryRaw: input.inventory?.raw ?? null,
        backendContract: {
          blocks: "legacy-diagnostic/full-block-catalog",
          placeableBlocks: "legacy-diagnostic/placeable-block-catalog",
          productiveInventory: PRODUCTIVE_INVENTORY_ROUTE,
        },
      },
      blocks: creativeBlocks,
      placeableBlocks: inventoryBlocks,
      usedPaletteFallback: input.creative.usedPaletteFallback || (input.inventory?.usedPaletteFallback ?? false),
      collectionKind: "combined",
      inventoryRouteKind: LEGACY_PLACEABLE_BLOCKS_ROUTE_KIND,
      creativeLibraryRouteKind: LEGACY_BLOCKS_ROUTE_KIND,
      inventoryBlockCount: inventoryBlocks.length,
      creativeLibraryBlockCount: creativeBlocks.length,
    },
    input.rawReason,
  );
}

function ensureBlocksResultHasInventory(
  result: ChunkApiBlocksResult,
): ChunkApiBlocksResult {
  const inventoryBlocks = result.placeableBlocks.length > 0
    ? sanitizePlaceableBlocks(result.placeableBlocks)
    : placeableBlocksFromBlocks(result.blocks);

  return sanitizeBlocksResult(
    {
      ...result,
      blocks: uniqueBlockDefinitions([
        ...result.blocks,
        ...inventoryBlocks,
      ]),
      placeableBlocks: inventoryBlocks,
      collectionKind: result.collectionKind ?? "combined",
      inventoryRouteKind: result.inventoryRouteKind ?? LEGACY_PLACEABLE_BLOCKS_ROUTE_KIND,
      creativeLibraryRouteKind: result.creativeLibraryRouteKind ?? LEGACY_BLOCKS_ROUTE_KIND,
      inventoryBlockCount: inventoryBlocks.length,
      creativeLibraryBlockCount: result.blocks.length,
    },
    "ensure-legacy-blocks-result-has-inventory",
  );
}

export function createChunkApiClient(options: CreateChunkApiClientOptions): ChunkApiClient {
  const config = createClientConfig(options.config);

  const httpClientOptions = {
    defaultHeaders: {
      "X-Vectoplan-Editor-Frontend": "src/frontend",
      "X-Vectoplan-Editor-Project": config.projectId,
      "X-Vectoplan-Editor-World": config.worldId,
      "X-Vectoplan-Editor-Inventory-Truth": PRODUCTIVE_INVENTORY_ROUTE,
      "X-Vectoplan-Editor-Legacy-Chunk-Inventory": "diagnostic-only",
    },
    ...(options.logger === undefined ? {} : { logger: options.logger }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  };

  const httpClient: HttpJsonClient = createHttpJsonClient(httpClientOptions);

  let destroyed = false;
  let cachedBlocks: ChunkApiBlocksResult | null = null;
  let cachedPlaceableBlocks: ChunkApiPlaceableBlocksResult | null = null;

  async function requestRaw(
    input: InternalRequestOptions,
  ): Promise<HttpJsonRequestResult<unknown> | HttpJsonRequestFailure> {
    const destroyedResult = destroyedFailure(destroyed);

    if (destroyedResult) {
      return {
        ok: false,
        request: null,
        error: destroyedResult.error,
        rawText: null,
        headers: null,
      };
    }

    const requestOptions = makeRequestOptions(input);
    return httpClient.requestJson<unknown>(requestOptions);
  }

  async function loadStatus(
    requestOverrides?: Partial<ChunkApiRequestOptions>,
  ): Promise<ChunkApiStatusResult | ChunkApiFailedResult> {
    try {
      const result = await requestRaw({
        kind: "status",
        method: "GET",
        url: config.routeHints.status,
        timeoutMs: config.timeouts.statusMs,
        requestOverrides,
      });

      if (isHttpJsonRequestFailure(result)) {
        return requestFailureToFailedResult(result, "editor-proxy");
      }

      return normalizeChunkApiStatusResult(requestSuccessRaw(result), result.request, {
        projectId: config.projectId,
        worldId: config.worldId,
        source: "editor-proxy",
      });
    } catch (error) {
      return failedFromUnknown({
        error,
        source: "editor-proxy",
      });
    }
  }

  async function testConnection(
    requestOverrides?: Partial<ChunkApiRequestOptions>,
  ): Promise<ChunkApiConnectionTestResult | ChunkApiFailedResult> {
    try {
      const result = await requestRaw({
        kind: "connection-test",
        method: "GET",
        url: config.routeHints.connectionTest,
        timeoutMs: Math.min(config.timeouts.statusMs, 5_000),
        requestOverrides,
      });

      if (isHttpJsonRequestSuccess(result)) {
        const normalized = normalizeChunkApiConnectionTestResult(requestSuccessRaw(result), result.request, {
          projectId: config.projectId,
          worldId: config.worldId,
          source: "editor-proxy",
        });

        if (!isChunkApiFailedResult(normalized)) {
          return normalized;
        }

        logWarn(options.logger, "Chunk connection test returned invalid payload. Falling back to status route.", {
          error: normalized.error,
        });
      } else {
        logWarn(options.logger, "Chunk connection test route failed. Falling back to status route.", {
          error: result.error,
        });
      }

      const statusResult = await loadStatus(requestOverrides);

      if (isChunkApiFailedResult(statusResult)) {
        return statusResult;
      }

      return {
        ok: true,
        request: statusResult.request,
        source: "editor-proxy",
        raw: statusResult.raw,
        error: null,
        editorProxyReachable: statusResult.proxyReachable,
        chunkServiceReachable: statusResult.upstreamReachable,
        projectId: config.projectId,
        worldId: config.worldId,
        diagnostics: {
          fallback: "status-route",
          status: {
            service: statusResult.service,
            route: statusResult.route,
            moduleVersion: statusResult.moduleVersion,
            proxyReachable: statusResult.proxyReachable,
            upstreamReachable: statusResult.upstreamReachable,
          },
          inventoryTruth: PRODUCTIVE_INVENTORY_ROUTE,
          legacyChunkInventory: "diagnostic-only",
        },
      };
    } catch (error) {
      return failedFromUnknown({
        error,
        source: "editor-proxy",
      });
    }
  }

  async function loadProjectBootstrap(
    requestOverrides?: Partial<ChunkApiRequestOptions>,
  ): Promise<ChunkApiProjectBootstrapResult | ChunkApiFailedResult> {
    try {
      const result = await requestRaw({
        kind: "project-bootstrap",
        method: "GET",
        url: config.routeHints.projectBootstrap,
        timeoutMs: config.timeouts.requestMs,
        requestOverrides,
      });

      if (isHttpJsonRequestSuccess(result)) {
        const normalized = normalizeChunkApiProjectBootstrapResult(requestSuccessRaw(result), result.request, {
          projectId: config.projectId,
          worldId: config.worldId,
          source: "editor-proxy",
        });

        if (!isChunkApiFailedResult(normalized)) {
          return normalized;
        }

        logWarn(options.logger, "Project bootstrap route returned invalid payload. Using client bootstrap fallback.", {
          error: normalized.error,
        });
      } else {
        logWarn(options.logger, "Project bootstrap route failed. Using client bootstrap fallback.", {
          error: result.error,
        });
      }

      return normalizeChunkApiProjectBootstrapResult(
        {
          ok: true,
          projectId: config.projectId,
          worldId: config.worldId,
          defaultWorldId: config.worldId,
          spawnWorldId: config.worldId,
          routeHints: {
            ...config.routeHints,
            editorInventory: PRODUCTIVE_INVENTORY_ROUTE,
          },
        },
        result.request,
        {
          projectId: config.projectId,
          worldId: config.worldId,
          source: "client-fallback",
        },
      );
    } catch (error) {
      return failedFromUnknown({
        error,
        source: "editor-proxy",
      });
    }
  }

  async function loadPlaceableBlocks(
    requestOverrides?: Partial<ChunkApiRequestOptions>,
  ): Promise<ChunkApiPlaceableBlocksResult | ChunkApiFailedResult> {
    if (cachedPlaceableBlocks && requestOverrides?.allowNonOk !== true) {
      return cachedPlaceableBlocks;
    }

    const fallbackBlocks = sanitizePlaceableBlocks(CHUNK_API_DEFAULT_PLACEABLE_BLOCKS);

    try {
      const result = await requestRaw({
        kind: "placeable-blocks",
        method: "GET",
        url: config.routeHints.placeableBlocks,
        timeoutMs: Math.min(config.timeouts.blocksMs, 5_000),
        requestOverrides,
      });

      if (isHttpJsonRequestSuccess(result)) {
        const normalized = normalizeChunkApiPlaceableBlocksResult(
          requestSuccessRaw(result),
          result.request,
          {
            projectId: config.projectId,
            worldId: config.worldId,
            source: "editor-proxy",
            blockSource: "chunk-service-placeable-blocks-route",
            fallbackBlocks,
          },
        );

        if (!isChunkApiFailedResult(normalized)) {
          cachedPlaceableBlocks = sanitizePlaceableBlocksResult(
            {
              ...normalized,
              collectionKind: "inventory",
              inventoryRouteKind: LEGACY_PLACEABLE_BLOCKS_ROUTE_KIND,
              creativeLibraryRouteKind: LEGACY_BLOCKS_ROUTE_KIND,
              inventoryBlockCount: normalized.placeableBlocks.length,
              creativeLibraryBlockCount: normalized.blocks.length,
            },
            "legacy-placeable-blocks-route",
          );
          return cachedPlaceableBlocks;
        }

        logWarn(options.logger, "Editor placeable-blocks route returned invalid payload. Using empty diagnostic fallback.", {
          error: normalized.error,
          productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
        });
      } else {
        logWarn(options.logger, "Editor placeable-blocks route failed. Using empty diagnostic fallback.", {
          error: result.error,
          productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
        });
      }

      const placeholder = buildPlaceableBlocksPlaceholderResponse({
        projectId: config.projectId,
        worldId: config.worldId,
      });

      const fallback = normalizeChunkApiPlaceableBlocksResult(placeholder, result.request, {
        projectId: config.projectId,
        worldId: config.worldId,
        source: "client-fallback",
        blockSource: "static-client-fallback",
        fallbackBlocks,
      });

      if (isChunkApiFailedResult(fallback)) {
        return fallback;
      }

      cachedPlaceableBlocks = sanitizePlaceableBlocksResult(
        {
          ...fallback,
          collectionKind: "fallback",
          inventoryRouteKind: LEGACY_PLACEABLE_BLOCKS_ROUTE_KIND,
          creativeLibraryRouteKind: LEGACY_BLOCKS_ROUTE_KIND,
          inventoryBlockCount: fallback.placeableBlocks.length,
          creativeLibraryBlockCount: fallback.blocks.length,
        },
        "legacy-placeable-blocks-fallback",
      );
      return cachedPlaceableBlocks;
    } catch (error) {
      const placeholder = buildPlaceableBlocksPlaceholderResponse({
        projectId: config.projectId,
        worldId: config.worldId,
      });

      const fallback = normalizeChunkApiPlaceableBlocksResult(placeholder, null, {
        projectId: config.projectId,
        worldId: config.worldId,
        source: "client-fallback",
        blockSource: "static-client-fallback",
        fallbackBlocks,
      });

      if (isChunkApiFailedResult(fallback)) {
        return failedFromUnknown({
          error,
          source: "client-fallback",
        });
      }

      cachedPlaceableBlocks = sanitizePlaceableBlocksResult(
        {
          ...fallback,
          collectionKind: "fallback",
          inventoryRouteKind: LEGACY_PLACEABLE_BLOCKS_ROUTE_KIND,
          creativeLibraryRouteKind: LEGACY_BLOCKS_ROUTE_KIND,
          inventoryBlockCount: fallback.placeableBlocks.length,
          creativeLibraryBlockCount: fallback.blocks.length,
        },
        "legacy-placeable-blocks-exception-fallback",
      );
      return cachedPlaceableBlocks;
    }
  }

  async function loadBlocks(
    requestOverrides?: Partial<ChunkApiRequestOptions>,
  ): Promise<ChunkApiBlocksResult | ChunkApiFailedResult> {
    if (cachedBlocks && requestOverrides?.allowNonOk !== true) {
      return cachedBlocks;
    }

    let inventoryResult: ChunkApiPlaceableBlocksResult | ChunkApiFailedResult | null = null;

    try {
      const result = await requestRaw({
        kind: "blocks",
        method: "GET",
        url: config.routeHints.blocks,
        timeoutMs: Math.min(config.timeouts.blocksMs, 8_000),
        requestOverrides,
      });

      if (isHttpJsonRequestSuccess(result)) {
        const normalizedCreative = normalizeChunkApiBlocksResult(requestSuccessRaw(result), result.request, {
          projectId: config.projectId,
          worldId: config.worldId,
          source: "editor-proxy",
          blockSource: "chunk-service-creative-library-route",
          allowFallback: false,
        });

        if (!isChunkApiFailedResult(normalizedCreative)) {
          inventoryResult = await loadPlaceableBlocks(requestOverridesForRelatedRoute(requestOverrides));

          if (!isChunkApiFailedResult(inventoryResult)) {
            cachedBlocks = mergeCreativeCatalogAndInventory({
              creative: normalizedCreative,
              inventory: inventoryResult,
              rawReason: "legacy-blocks-route-and-legacy-placeable-blocks-route",
            });
            return cachedBlocks;
          }

          logWarn(options.logger, "Placeable-blocks diagnostic route failed while full blocks route succeeded. Inferring placeable blocks from full catalog.", {
            error: inventoryResult.error,
            productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
          });

          cachedBlocks = ensureBlocksResultHasInventory({
            ...normalizedCreative,
            collectionKind: "combined",
            inventoryRouteKind: LEGACY_PLACEABLE_BLOCKS_ROUTE_KIND,
            creativeLibraryRouteKind: LEGACY_BLOCKS_ROUTE_KIND,
            creativeLibraryBlockCount: normalizedCreative.blocks.length,
          });
          return cachedBlocks;
        }

        logWarn(options.logger, "Chunk blocks route returned invalid payload. Trying legacy placeable-blocks fallback.", {
          error: normalizedCreative.error,
          productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
        });
      } else {
        logWarn(options.logger, "Chunk blocks route failed. Trying legacy placeable-blocks fallback.", {
          error: result.error,
          productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
        });
      }

      inventoryResult = await loadPlaceableBlocks(requestOverridesForRelatedRoute(requestOverrides));

      if (!isChunkApiFailedResult(inventoryResult)) {
        cachedBlocks = ensureBlocksResultHasInventory({
          ...inventoryResult,
          raw: {
            reason: "blocks-route-failed-legacy-placeable-route-used",
            originalRaw: inventoryResult.raw,
            productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
          },
          collectionKind: "inventory",
          inventoryRouteKind: LEGACY_PLACEABLE_BLOCKS_ROUTE_KIND,
          creativeLibraryRouteKind: LEGACY_BLOCKS_ROUTE_KIND,
          inventoryBlockCount: inventoryResult.placeableBlocks.length,
          creativeLibraryBlockCount: inventoryResult.blocks.length,
        });
        return cachedBlocks;
      }

      logWarn(options.logger, "Legacy placeable-blocks fallback failed. Trying chunk palette diagnostic fallback.", {
        error: inventoryResult.error,
        productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
      });

      const chunkResult = await loadChunk({
        chunkX: 0,
        chunkY: 0,
        chunkZ: 0,
      }, requestOverridesForRelatedRoute(requestOverrides));

      if (!isChunkApiFailedResult(chunkResult)) {
        const paletteBlocks = buildBlocksResultFromChunkResult(chunkResult);

        if (!isChunkApiFailedResult(paletteBlocks)) {
          cachedBlocks = ensureBlocksResultHasInventory({
            ...paletteBlocks,
            collectionKind: "fallback",
            inventoryRouteKind: LEGACY_PLACEABLE_BLOCKS_ROUTE_KIND,
            creativeLibraryRouteKind: LEGACY_BLOCKS_ROUTE_KIND,
            inventoryBlockCount: paletteBlocks.placeableBlocks.length,
            creativeLibraryBlockCount: paletteBlocks.blocks.length,
          });
          return cachedBlocks;
        }
      }

      const staticFallback = buildStaticFallbackBlocksResult({
        projectId: config.projectId,
        worldId: config.worldId,
        raw: {
          reason: "blocks-route-placeable-route-and-palette-fallback-failed",
          productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
          chunkResult: isChunkApiFailedResult(chunkResult) ? chunkResult.error : null,
          placeableBlocksResult: inventoryResult.error,
        },
      });

      cachedBlocks = ensureBlocksResultHasInventory({
        ...staticFallback,
        collectionKind: "fallback",
        inventoryRouteKind: LEGACY_PLACEABLE_BLOCKS_ROUTE_KIND,
        creativeLibraryRouteKind: LEGACY_BLOCKS_ROUTE_KIND,
      });
      return cachedBlocks;
    } catch (error) {
      const staticFallback = buildStaticFallbackBlocksResult({
        projectId: config.projectId,
        worldId: config.worldId,
        raw: {
          reason: "blocks-load-exception",
          productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
          error: String(error),
        },
      });

      cachedBlocks = ensureBlocksResultHasInventory({
        ...staticFallback,
        collectionKind: "fallback",
        inventoryRouteKind: LEGACY_PLACEABLE_BLOCKS_ROUTE_KIND,
        creativeLibraryRouteKind: LEGACY_BLOCKS_ROUTE_KIND,
      });
      return cachedBlocks;
    }
  }

  async function loadChunk(
    coordinates: ChunkApiChunkCoordinates,
    requestOverrides?: Partial<ChunkApiRequestOptions>,
  ): Promise<ChunkApiChunkResult | ChunkApiFailedResult> {
    const normalizedCoordinates = normalizeChunkApiCoordinates(coordinates);

    try {
      const url = appendQuery(config.routeHints.chunk, {
        chunkX: normalizedCoordinates.chunkX,
        chunkY: normalizedCoordinates.chunkY,
        chunkZ: normalizedCoordinates.chunkZ,
      });

      const result = await requestRaw({
        kind: "chunk",
        method: "GET",
        url,
        timeoutMs: config.timeouts.chunkMs,
        requestOverrides,
      });

      if (isHttpJsonRequestFailure(result)) {
        return requestFailureToFailedResult(result, "editor-proxy");
      }

      return normalizeChunkApiChunkResult(requestSuccessRaw(result), result.request, {
        projectId: config.projectId,
        worldId: config.worldId,
        source: "editor-proxy",
        fallbackCoordinates: normalizedCoordinates,
      });
    } catch (error) {
      return failedFromUnknown({
        error,
        source: "editor-proxy",
      });
    }
  }

  async function loadChunksBatch(
    chunks: readonly ChunkApiBatchChunkRequest[],
    requestOverrides?: Partial<ChunkApiRequestOptions>,
  ): Promise<ChunkApiBatchResult | ChunkApiFailedResult> {
    const normalizedChunks = chunks.map((chunk) => normalizeChunkApiCoordinates(chunk));

    if (normalizedChunks.length === 0) {
      return failedFromUnknown({
        error: createInvalidPayloadError({
          message: "Chunk batch request was empty.",
          details: {
            reason: "empty_batch_chunk_request",
          },
        }),
        source: "client-fallback",
      });
    }

    if (normalizedChunks.length === 1 || !config.preferBatchLoad) {
      const fallback = await tryFallbackBatchLoad(
        normalizedChunks,
        (coordinates) => loadChunk(coordinates, requestOverrides),
      );

      if (fallback.chunks.length === 0) {
        return fallback.rawFailures[0] ?? createNoChunkLoadedFailure({
          reason: "individual-load-failed",
          source: "editor-proxy",
        });
      }

      return {
        ok: true,
        request: fallback.chunks[0]?.request ?? null,
        source: "client-fallback",
        raw: {
          fallback: "individual-load",
          failedChunks: fallback.failedChunks,
        },
        error: null,
        projectId: config.projectId,
        worldId: config.worldId,
        chunks: fallback.chunks.map((result) => result.chunk),
        failedChunks: fallback.failedChunks,
      };
    }

    try {
      const limitedChunks = normalizedChunks.slice(0, config.maxBatchChunks);

      const result = await requestRaw({
        kind: "chunks-batch",
        method: "POST",
        url: config.routeHints.chunksBatch,
        body: {
          chunks: limitedChunks,
        },
        timeoutMs: config.timeouts.batchMs,
        requestOverrides,
      });

      if (isHttpJsonRequestSuccess(result)) {
        const normalized = normalizeChunkApiBatchResult(requestSuccessRaw(result), result.request, {
          projectId: config.projectId,
          worldId: config.worldId,
          requestedChunks: limitedChunks,
          source: "editor-proxy",
        });

        if (!isChunkApiFailedResult(normalized)) {
          return normalized;
        }

        logWarn(options.logger, "Chunk batch route returned invalid payload. Falling back to individual chunk loads.", {
          error: normalized.error,
        });
      } else {
        logWarn(options.logger, "Chunk batch route failed. Falling back to individual chunk loads.", {
          error: result.error,
        });
      }

      const fallback = await tryFallbackBatchLoad(
        limitedChunks,
        (coordinates) => loadChunk(coordinates, requestOverridesForRelatedRoute(requestOverrides)),
      );

      if (fallback.chunks.length === 0) {
        if (fallback.rawFailures[0]) {
          return fallback.rawFailures[0];
        }

        if (isHttpJsonRequestFailure(result)) {
          return requestFailureToFailedResult(result, "editor-proxy");
        }

        return createNoChunkLoadedFailure({
          reason: "batch-success-invalid-and-individual-load-failed",
          raw: requestSuccessRaw(result),
          source: "editor-proxy",
        });
      }

      return {
        ok: true,
        request: result.request,
        source: "client-fallback",
        raw: {
          fallback: "individual-load-after-batch-failure",
          batchError: isHttpJsonRequestFailure(result) ? result.error : null,
          failedChunks: fallback.failedChunks,
        },
        error: null,
        projectId: config.projectId,
        worldId: config.worldId,
        chunks: fallback.chunks.map((chunkResult) => chunkResult.chunk),
        failedChunks: fallback.failedChunks,
      };
    } catch (error) {
      return failedFromUnknown({
        error,
        source: "editor-proxy",
      });
    }
  }

  async function sendCommand(
    command: ChunkApiCommandPayload,
    requestOverrides?: Partial<ChunkApiRequestOptions>,
  ): Promise<ChunkApiCommandResult | ChunkApiFailedResult> {
    try {
      const invalidCommand = validateOutgoingCommand(command);

      if (invalidCommand) {
        return invalidCommand;
      }

      const result = await requestRaw({
        kind: "command",
        method: "POST",
        url: config.routeHints.commands,
        body: command,
        timeoutMs: config.timeouts.commandMs,
        requestOverrides,
      });

      if (isHttpJsonRequestFailure(result)) {
        return requestFailureToFailedResult(result, "editor-proxy");
      }

      return normalizeChunkApiCommandResult(requestSuccessRaw(result), result.request, {
        projectId: config.projectId,
        worldId: config.worldId,
        source: "editor-proxy",
      });
    } catch (error) {
      return failedFromUnknown({
        error,
        source: "editor-proxy",
      });
    }
  }

  async function validateLegacyBlockTypeIdIfRequested(
    blockTypeId: string,
    requestOverrides?: ExtendedCommandRequestOverrides,
  ): Promise<ChunkApiFailedResult | null> {
    if (requestOverrides?.validateBlockTypeId !== true) {
      return null;
    }

    const blocks = await loadBlocks(commandOptionsWithoutEditorFields(requestOverrides));

    if (isChunkApiFailedResult(blocks)) {
      return null;
    }

    const knownBlockTypeIds = collectKnownBlockTypeIds([
      ...blocks.blocks,
      ...blocks.placeableBlocks,
    ]);

    if (knownBlockTypeIds.length === 0 || knownBlockTypeIds.includes(blockTypeId)) {
      return null;
    }

    return failedFromUnknown({
      error: createUnknownBlockTypeError({
        blockTypeId,
        knownBlockTypeIds,
      }),
      source: "client-fallback",
    });
  }

  async function sendSetBlock(
    position: ChunkApiWorldPosition,
    blockTypeId: string,
    requestOverrides?: ExtendedCommandRequestOverrides & Partial<Pick<ChunkApiSetBlockCommandPayload, "userId" | "sessionId">>,
  ): Promise<ChunkApiCommandResult | ChunkApiFailedResult> {
    try {
      const normalizedBlockTypeId = safeString(blockTypeId, "").trim();

      if (normalizedBlockTypeId.length === 0) {
        return failedFromUnknown({
          error: createUnknownBlockTypeError({
            blockTypeId: String(blockTypeId),
          }),
          source: "client-fallback",
        });
      }

      if (
        requestOverrides?.allowForbiddenDebugBlockTypeId !== true
        && isForbiddenDebugBlockTypeId(normalizedBlockTypeId)
      ) {
        return failedFromUnknown({
          error: createInvalidPayloadError({
            message: `Forbidden debug block type '${normalizedBlockTypeId}' cannot be placed from the editor.`,
            details: {
              blockTypeId: normalizedBlockTypeId,
              forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
              productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
            },
          }),
          source: "client-fallback",
        });
      }

      const validationFailure = await validateLegacyBlockTypeIdIfRequested(
        normalizedBlockTypeId,
        requestOverrides,
      );

      if (validationFailure) {
        return validationFailure;
      }

      return sendCommand(
        {
          type: "SetBlock",
          userId: requestOverrides?.userId ?? CHUNK_API_DEFAULT_USER_ID,
          sessionId: requestOverrides?.sessionId ?? createSessionId(),
          position: normalizeChunkApiWorldPosition(position),
          blockTypeId: normalizedBlockTypeId,
        },
        commandOptionsWithoutEditorFields(requestOverrides),
      );
    } catch (error) {
      return failedFromUnknown({
        error,
        source: "editor-proxy",
      });
    }
  }

  async function sendRemoveBlock(
    position: ChunkApiWorldPosition,
    requestOverrides?: ExtendedCommandRequestOverrides & Partial<Pick<ChunkApiRemoveBlockCommandPayload, "userId" | "sessionId">>,
  ): Promise<ChunkApiCommandResult | ChunkApiFailedResult> {
    try {
      return sendCommand(
        {
          type: "RemoveBlock",
          userId: requestOverrides?.userId ?? CHUNK_API_DEFAULT_USER_ID,
          sessionId: requestOverrides?.sessionId ?? createSessionId(),
          position: normalizeChunkApiWorldPosition(position),
        },
        commandOptionsWithoutEditorFields(requestOverrides),
      );
    } catch (error) {
      return failedFromUnknown({
        error,
        source: "editor-proxy",
      });
    }
  }

  const client: ChunkApiClient = {
    kind: CHUNK_API_CLIENT_KIND,
    config,

    getConfig(): ChunkApiClientConfig {
      return config;
    },

    loadStatus,
    testConnection,
    loadProjectBootstrap,

    /**
     * Legacy/diagnostic only.
     *
     * Productive hotbar inventory must use /editor/api/inventory.
     */
    loadPlaceableBlocks,

    /**
     * Legacy/diagnostic only.
     *
     * Productive hotbar inventory must use /editor/api/inventory.
     */
    loadBlocks,

    loadChunk,
    loadChunksBatch,
    sendCommand,
    sendSetBlock,
    sendRemoveBlock,

    destroy(reason?: string): void {
      if (destroyed) {
        return;
      }

      destroyed = true;

      try {
        httpClient.destroy(reason ?? "chunk-api-client-destroyed");
      } catch (error) {
        logWarn(options.logger, "Chunk API HTTP client destroy failed.", {
          error,
          reason: reason ?? "unknown",
        });
      }

      cachedBlocks = null;
      cachedPlaceableBlocks = null;

      logInfo(options.logger, "Chunk API client destroyed.", {
        reason: reason ?? "unknown",
      });
    },
  };

  logDebug(options.logger, "Chunk API client created.", {
    apiBaseUrl: config.apiBaseUrl,
    projectId: config.projectId,
    worldId: config.worldId,
    statusRoute: config.routeHints.status,
    blocksRoute: config.routeHints.blocks,
    placeableBlocksRoute: config.routeHints.placeableBlocks,
    productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
    legacyChunkInventory: "diagnostic-only",
    sendSetBlockValidationDefault: "skip-legacy-block-catalog-validation",
    forbiddenDebugBlockTypeIds: FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
    backendContract: {
      blocks: "legacy-diagnostic/full-block-catalog",
      placeableBlocks: "legacy-diagnostic/placeable-block-catalog",
      productiveInventory: PRODUCTIVE_INVENTORY_ROUTE,
    },
  });

  return client;
}

export function getChunkApiClientMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.api.chunk_api_client",
    clientKind: CHUNK_API_CLIENT_KIND,
    productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
    legacyPlaceableBlocksRouteKind: LEGACY_PLACEABLE_BLOCKS_ROUTE_KIND,
    legacyBlocksRouteKind: LEGACY_BLOCKS_ROUTE_KIND,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    rules: {
      chunkApiClientOwnsWorldAndCommands: true,
      loadBlocksIsLegacyDiagnosticOnly: true,
      loadPlaceableBlocksIsLegacyDiagnosticOnly: true,
      sendSetBlockUsesRuntimeBlockTypeId: true,
      sendSetBlockSkipsLegacyCatalogValidationByDefault: true,
      sendSetBlockBlocksDebugGrassDirt: true,
      hotbarInventoryUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
    },
  };
}