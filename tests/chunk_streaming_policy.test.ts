import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DEFAULT_VISIBLE_CHUNK_RADIUS, DEFAULT_CHUNK_SERVICE_MAX_LOADED_CHUNKS } from "../src/frontend/bootstrap/bootstrap_models";
import { normalizeChunkApiBatchResult } from "../src/frontend/api/chunk_api_normalize";
import { createRuntimeChunkContent } from "../src/frontend/runtime/world/chunk_content";
import { createChunkRegistry } from "../src/frontend/runtime/world/chunk_registry";
import { createChunkLoader } from "../src/frontend/runtime/world/chunk_loader";
import { createChunkSourceFailedResult, type ChunkSource } from "../src/frontend/runtime/world/chunk_source";
import { visibleChunkCoordinatesAround, type ChunkCoordinates } from "../src/frontend/runtime/world/chunk_coordinates";
import { configuredStreamingRadius, retainedSurfaceChunkKeys, streamingCoordinateBudget } from "../src/frontend/scene/chunk_streaming_policy";
import { structureStreamingStages } from '../src/frontend/scene/chunk_streaming_policy';
import { additionalSurfaceChunkCoordinates } from '../src/frontend/scene/structure_streaming';
import { createWorldRuntime } from '../src/frontend/runtime/world/world_runtime';
import { createDefaultEditorBootstrap } from '../src/frontend/bootstrap/default_bootstrap';
import { createInitialEditorState } from '../src/frontend/state/editor_state';
import { createEditorStore } from '../src/frontend/state/editor_store';

const center = { chunkX: 0, chunkY: 0, chunkZ: 0 };
function chunk(coordinate: ChunkCoordinates, metadata: Record<string, unknown> = {}) {
  const { chunkX, chunkY, chunkZ } = coordinate;
  const result = normalizeChunkApiBatchResult({ ok: true, chunks: [{ chunk: {
    projectId: "streaming-test", worldId: "earth", chunkKey: `${chunkX}:${chunkY}:${chunkZ}`,
    ...coordinate, chunkSize: 16, cellSize: 1, cells: Array(4096).fill(0), palette: [],
    source: "snapshot", metadata,
  } }] }, null, { projectId: "streaming-test", worldId: "earth", requestedChunks: [coordinate] });
  assert(result.ok);
  return createRuntimeChunkContent(result.chunks[0]!);
}
function fixtureLoader(failBatch = -1) {
  const registry = createChunkRegistry({ maxChunks: 8192 });
  const batches: readonly ChunkCoordinates[][] = [];
  const mutableBatches = batches as ChunkCoordinates[][];
  const source = {
    getRegistry: () => registry,
    getLoadedChunkKeys: () => registry.getChunkKeys(),
    getChunk: (key: string) => registry.getChunk(key),
    getLifecycleState: () => ({ status: "ready" }),
    loadChunks: async (coordinates: ChunkCoordinates[]) => {
      mutableBatches.push(coordinates);
      if (mutableBatches.length === failBatch) return createChunkSourceFailedResult({
        error: new Error("One optional data packet is offline."),
      });
      const chunks = coordinates.map((coordinate) => chunk(coordinate));
      registry.setChunks(chunks);
      return { chunks, result: null, failed: [], fromCacheCount: 0 };
    },
  } as unknown as ChunkSource;
  return { registry, batches, loader: createChunkLoader({ source, maxRadius: 32, verticalRadius: 0, maxChunksPerLoad: 256 }) };
}

test("immediately resolved source batches leave a frame boundary for camera input, including failed packets", async () => {
  const previousRaf = globalThis.requestAnimationFrame;
  let completedFrameCallbacks = 0;
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => setTimeout(() => {
    callback(performance.now());
    queueMicrotask(() => { completedFrameCallbacks++; });
  }, 0)) as unknown as typeof requestAnimationFrame;
  try {
    for (const failBatch of [-1, 2]) {
      const { loader, batches } = fixtureLoader(failBatch);
      const frameBoundaries: number[] = [];
      const result = await loader.loadAroundChunk(center, 3, {
        batchSize: 12, markVisible: true,
        onBatchLoaded: () => { frameBoundaries.push(completedFrameCallbacks); },
      });
      assert.equal(batches.length, 3);
      assert.equal(frameBoundaries.length, 3);
      assert.ok(frameBoundaries[1]! > frameBoundaries[0]!, "second packet cannot continue inside the previous frame's microtasks");
      assert.ok(frameBoundaries[2]! > frameBoundaries[1]!, "failed and successful packets both release the browser");
      assert.equal(result.failedChunkKeys.length, failBatch === 2 ? 12 : 0);
      loader.destroy();
    }
  } finally {
    if (previousRaf) globalThis.requestAnimationFrame = previousRaf;
    else delete (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame;
  }
});

test("camera superseding a load during its frame boundary stops subsequent source packets", async () => {
  const { loader, registry, batches } = fixtureLoader();
  const newCameraChunk = chunk({ ...center, chunkX: 40 });
  registry.setChunks([newCameraChunk]);
  let current = true;
  await loader.loadAroundChunk(center, 3, {
    batchSize: 12, markVisible: true, shouldContinue: () => current,
    onBatchLoaded: () => {
      setTimeout(() => {
        current = false;
        registry.setVisibleChunkKeys([newCameraChunk.chunkKey], "new-camera-window");
      }, 0);
    },
  });
  assert.equal(batches.length, 1);
  assert.deepEqual(registry.getVisibleChunkKeys(), [newCameraChunk.chunkKey]);
  loader.destroy();
});

test("an unavailable middle packet retains earlier chunks and still loads later independent packets", async () => {
  const { registry, loader, batches } = fixtureLoader(2);
  const result = await loader.loadAroundChunk(center, 3, { batchSize: 12, markVisible: true });
  assert.equal(batches.length, 3);
  assert.equal(registry.getVisibleChunkKeys().length, 17);
  assert.equal(result.failedChunkKeys.length, 12);
  assert.equal(loader.getStatus(), "degraded");
  const recovered = await loader.loadAroundChunk(center, 3, { batchSize: 12, markVisible: true });
  assert.equal(recovered.failedChunkKeys.length, 0);
  assert.equal(registry.getVisibleChunkKeys().length, 29);
  assert.equal(batches.at(-1)!.length, 12);
  loader.destroy();
});

test("actual deployment defaults expose 448 m and a matching registry budget", () => {
  const compose = readFileSync("../../docker-compose.yml", "utf8");
  const defaults = readFileSync("src/bootstrap/defaults.py", "utf8");
  const radius = Number(compose.match(/CHUNKS_VIEW_DISTANCE:-([0-9]+)/)?.[1]);
  const capacity = Number(compose.match(/CHUNKS_MAX_LOADED_CHUNKS:-([0-9]+)/)?.[1]);
  assert.equal(radius, 28);
  assert.equal(capacity, 8192);
  assert.equal(DEFAULT_VISIBLE_CHUNK_RADIUS, radius);
  assert.equal(DEFAULT_CHUNK_SERVICE_MAX_LOADED_CHUNKS, capacity);
  assert.match(defaults, /DEFAULT_CHUNKS_VIEW_DISTANCE: Final\[int\] = 28/);
  assert.equal(configuredStreamingRadius(radius, capacity), 28);
  assert.equal(configuredStreamingRadius(14, 512), 7, "explicit low-memory configuration stays within its working budget");
});

test('a superseded cached warmup cannot overwrite the latest camera visibility', async () => {
  const { loader, registry } = fixtureLoader();
  await loader.loadAroundChunk(center, 3, { markVisible: false });
  const newest = chunk({ ...center, chunkX: 40 });
  registry.setChunks([newest]);
  let keepLoading = true;
  await loader.loadAroundChunk(center, 3, {
    markVisible: true, shouldContinue: () => keepLoading,
    onBatchLoaded: async () => {
      await Promise.resolve();
      registry.setVisibleChunkKeys([newest.chunkKey], 'new-camera-window');
      keepLoading = false;
    },
  });
  assert.deepEqual(registry.getVisibleChunkKeys(), [newest.chunkKey]);
  loader.destroy();
});

test('28-chunk ring is complete and backtracking reuses the cache without repeated visibility callbacks', async () => {
  const { loader, registry, batches } = fixtureLoader();
  const coordinates = visibleChunkCoordinatesAround(center, 28, { radial: true, verticalRadius: 0 });
  assert.equal(coordinates.length, 2453);
  assert.equal(streamingCoordinateBudget(28, true), 2453);
  assert.deepEqual(structureStreamingStages(28), [3, 7, 14, 21, 28]);
  let callbacks = 0;
  const options = { maxChunks: streamingCoordinateBudget(28, true), batchSize: 12, markVisible: true,
    onBatchLoaded: () => { callbacks++; } };
  await loader.loadAroundChunk(center, 28, options);
  assert.equal(registry.getVisibleChunkKeys().length, 2453);
  const initialRequests = batches.length, initialCallbacks = callbacks;
  await loader.loadAroundChunk(center, 28, options);
  assert.equal(batches.length, initialRequests); assert.equal(callbacks, initialCallbacks);
  const moved = { ...center, chunkX: 1 };
  const retain = retainedSurfaceChunkKeys(registry.getChunkKeys().map(key => registry.getChunk(key)!), new Set(registry.getVisibleChunkKeys()), moved, 28);
  await loader.loadAroundChunk(moved, 28, { ...options, retainVisibleChunkKeys: retain });
  assert.equal(batches.slice(initialRequests).flat().length, 57);
  const movedRequests = batches.length;
  await loader.loadAroundChunk(center, 28, options);
  assert.equal(batches.length, movedRequests, 'the old boundary must still be cached');
  loader.destroy();
});

test('a packet awaits its roof dependency before the next horizontal packet is requested', async () => {
  const { loader, batches } = fixtureLoader();
  const order: string[] = [];
  const roof = { chunkX: 25, chunkY: 3, chunkZ: 0 };
  await loader.loadAroundChunk(center, 3, { maxChunks: 29, batchSize: 12, markVisible: true,
    onBatchLoaded: async progress => {
      if (progress.batchIndex !== 0) return;
      order.push('ground');
      await loader.loadCoordinates([roof], { markVisible: false, onBatchLoaded: () => { order.push('roof'); } });
      assert.equal(batches.length, 2, 'horizontal continuation must wait for the roof request');
      order.push('continue');
    } });
  assert.deepEqual(order, ['ground', 'roof', 'continue']);
  assert.deepEqual(batches[1], [roof]); loader.destroy();
});

test('legacy roof refs expose their primary anchor without requiring terrain statistics', () => {
  const ground = chunk(center);
  const withRoof = { ...ground, raw: { ...ground.raw, objectRefs: [{ objectTypeId: 'building_roof', primaryChunkKey: '23:3:-1' }] } };
  assert.deepEqual(additionalSurfaceChunkCoordinates([withRoof], center), [{ chunkX: 23, chunkY: 3, chunkZ: -1 }]);
});

test('real WorldRuntime and ChunkServiceSource do not silently clamp the requested radius to eight', async () => {
  const bootstrap = structuredClone(createDefaultEditorBootstrap());
  (bootstrap.project as any).templateId = 'earth';
  const store = createEditorStore({ initialState: createInitialEditorState({ bootstrap, bootId: 'radius-world-runtime',
    buildMode: 'test', buildVersion: 'test', createdAt: new Date().toISOString() }) });
  const requested: ChunkCoordinates[] = [];
  const api = { testConnection: async () => ({ ok: true }),
    loadChunksBatch: async (projectId: string, worldId: string, coordinates: ChunkCoordinates[]) => {
      requested.push(...coordinates);
      return { ok: true, chunks: coordinates.map(coordinate => chunk(coordinate)), failed: [], fromCacheCount: 0 };
    } };
  const world = createWorldRuntime({ bootstrap, store, chunkApiClient: api as any });
  try {
    await world.loadAroundChunk(center, { radius: 28, maxChunks: streamingCoordinateBudget(28, true), batchSize: 12, markVisible: true });
    assert.equal(requested.length, 2453);
    assert(world.getRegistry().hasChunk('28:0:0'));
    assert.equal(world.getRegistry().getVisibleChunkKeys().length, 2453);
  } finally { await world.destroy(); store.destroy(); }
});

test("movement can interrupt distant work after a small batch and resume without reloading completed chunks", async () => {
  const { registry, loader, batches } = fixtureLoader();
  const options = { maxChunks: streamingCoordinateBudget(14, true), batchSize: 12, markVisible: true };
  await loader.loadAroundChunk(center, 14, { ...options, shouldContinue: () => batches.length < 2 });
  assert.equal(registry.getChunkKeys().length, 24);
  assert.equal(registry.getVisibleChunkKeys().length, 24);
  await loader.loadAroundChunk(center, 14, options);
  assert.equal(registry.getVisibleChunkKeys().length, 613);
  assert.equal(batches.reduce((sum, batch) => sum + batch.length, 0), 613);
  loader.destroy();
});

test("requested radius 14 produces 613 surface columns without the old hidden radius-eight cap", () => {
  const coordinates = visibleChunkCoordinatesAround(center, 14, { radial: true, verticalRadius: 0 });
  assert.equal(coordinates.length, 613);
  assert(coordinates.some((coordinate) => coordinate.chunkX === 14));
  assert(coordinates.every((coordinate) => coordinate.chunkY === 0));
  assert.equal(streamingCoordinateBudget(14, true), coordinates.length);
  assert.equal(streamingCoordinateBudget(14, false), 639, "underground detail remains a small local reserve");
});

test("startup and camera movement retain the entire distant ring in 12-chunk near-first batches", async () => {
  const { registry, loader, batches } = fixtureLoader();
  const loadOptions = { maxChunks: streamingCoordinateBudget(14, true), batchSize: 12, markVisible: true };
  const initial = await loader.loadAroundChunk(center, 14, loadOptions);
  assert(initial.ok);
  assert.equal(registry.getVisibleChunkKeys().length, 613);
  assert(batches.every((batch) => batch.length <= 12));
  assert(batches[0]!.every((coordinate) => Math.hypot(coordinate.chunkX, coordinate.chunkZ) <= 2));
  assert(registry.hasChunk("14:0:0"));
  const initialBatchCount = batches.length;
  const moved = { ...center, chunkX: 1 };
  const retained = retainedSurfaceChunkKeys(registry.getChunkKeys().map((key) => registry.getChunk(key)!), new Set(registry.getVisibleChunkKeys()), moved, 14);
  const afterMovement = await loader.loadAroundChunk(moved, 14, { ...loadOptions, retainVisibleChunkKeys: retained });
  assert(afterMovement.ok);
  assert(registry.hasChunk("15:0:0"));
  assert(registry.getVisibleChunkKeys().includes("-14:0:0"), "old boundary stays visible for one chunk of backtracking");
  assert(registry.getVisibleChunkKeys().length >= 613, "movement must not truncate the ring to the HTTP budget256");
  const additionalDownloads = batches.slice(initialBatchCount).reduce((sum, batch) => sum + batch.length, 0);
  assert.equal(additionalDownloads, 29, "crossing a chunk boundary downloads only its new crescent");
  loader.destroy();
});

test("cached visibility changes retain upper floors and distant roof anchors, then release them outside the reserve", async () => {
  const { registry, loader } = fixtureLoader();
  const roofCoordinate = { chunkX: 22, chunkY: 3, chunkZ: 0 };
  const ground = chunk({ chunkX: 13, chunkY: 0, chunkZ: 0 }, {
    structureStreaming: { schemaVersion: "structure-streaming.v1", chunkCoordinates: [roofCoordinate] },
  });
  const roof = chunk(roofCoordinate);
  const upper = chunk({ chunkX: 13, chunkY: 2, chunkZ: 0 });
  registry.setChunks([ground, roof, upper, chunk(center)]);
  registry.setVisibleChunkKeys([ground.chunkKey, roof.chunkKey, upper.chunkKey]);
  const retained = retainedSurfaceChunkKeys(registry.getChunkKeys().map((key) => registry.getChunk(key)!), new Set(registry.getVisibleChunkKeys()), center, 14);
  assert(retained.includes(roof.chunkKey));
  assert(retained.includes(upper.chunkKey));
  await loader.loadAroundChunk(center, 0, { markVisible: true, retainVisibleChunkKeys: retained });
  assert(registry.getVisibleChunkKeys().includes(roof.chunkKey), "cached loader path must preserve anchors too");
  const departed = retainedSurfaceChunkKeys(registry.getChunkKeys().map((key) => registry.getChunk(key)!), new Set(registry.getVisibleChunkKeys()), { ...center, chunkX: -4 }, 14);
  assert(!departed.includes(roof.chunkKey));
  assert(!departed.includes(upper.chunkKey));
  loader.destroy();
});
