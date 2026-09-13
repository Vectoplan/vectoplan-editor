import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkRevisionScanReader } from '../src/frontend/scene/chunk_revision_reads';
import { createLod2RoofSourceResolver } from '../src/frontend/scene/lod2_roof_sources';
import { createChunkRegistry } from '../src/frontend/runtime/world/chunk_registry';
import { createRuntimeChunkContent } from '../src/frontend/runtime/world/chunk_content';
import { normalizeChunkApiBatchResult } from '../src/frontend/api/chunk_api_normalize';
import { trimLod2WallCaps, LOD2_WALL_SOURCE_CELL_ATTRIBUTE } from '../src/frontend/scene/lod2_wall_caps';
import { roofCalculationForScene, registerOptimisticRoofCalculation, clearOptimisticRoofCalculation } from '../src/frontend/world_edit/systems/roof/optimistic_calculations';

function chunk(x = 0, revision = 1, filled = true) {
  const cells = Array(4096).fill(0); cells[0] = filled ? 1 : 0;
  const value = normalizeChunkApiBatchResult({ ok: true, chunks: [{ chunk: { projectId: 'cache', worldId: 'world',
    chunkKey: `${x}:0:0`, chunkX: x, chunkY: 0, chunkZ: 0, chunkSize: 16, cellSize: 1, chunkRevision: revision,
    cells, palette: [{ blockTypeId: 'lod2_exterior_wall' }], objectRefs: [] } }] }, null, { projectId: 'cache', worldId: 'world' });
  assert(value.ok); return createRuntimeChunkContent(value.chunks[0]!);
}
function calculation(height: number, fingerprint: string) {
  return { ok: true, input_fingerprint: fingerprint, geometry: { faces: [{ polygon_3d_mm:
    [[0, 0, height * 1000], [1000, 0, height * 1000], [1000, 1000, height * 1000], [0, 1000, height * 1000]] }] } };
}
function ref(calc: unknown, facadeSegments: any[] = []): any {
  return { objectInstanceId: 'roof-cache-test', metadata: { lod2BuildingId: 'building', roofCalculation: calc,
    roofParameters: { eavesHeightMm: 2500, importedSource: { facadeSegments, facadeProfileMode: 'roof-clamped-v1' } } } };
}

test('one synchronous revision scan reads each shared neighbour once, next scan sees mining, replacement and removal', () => {
  const registry = createChunkRegistry(); registry.setChunks([chunk(), chunk(1)]);
  let reads = 0;
  const scan = () => chunkRevisionScanReader(key => { reads++; return registry.getChunk(key); });
  const first = scan();
  for (let i = 0; i < 100; i++) { assert.equal(first('0:0:0')!.cells[0], 1); first('1:0:0'); first('2:0:0'); }
  assert.equal(reads, 3, 'cached absence must also avoid repeated registry reads');
  registry.setChunk(chunk(0, 2, false)); registry.deleteChunk('1:0:0'); registry.setChunk(chunk(2));
  const afterMining = scan();
  assert.equal(afterMining('0:0:0')!.cells[0], 0);
  assert.equal(afterMining('1:0:0'), null); assert.equal(afterMining('2:0:0')!.cells[0], 1);
  assert.equal(reads, 6);
});

test('immutable facade descriptions are parsed once across columns; new snapshot updates heights', () => {
  const source = ref(calculation(.5, 'old'), [{ minimumY: 2 }, { minimumY: -1 }, { minimumY: 'invalid' }]);
  const live = createLod2RoofSourceResolver((_id, value) => value);
  const first = live.read(source, 1);
  for (let i = 0; i < 1000; i++) assert.equal(live.read(source, 1), first);
  assert.equal(first.storeyBaseY, -1); assert.equal(first.storeyEavesY, 2.5);
  assert.equal(first.facadeSegments, source.metadata.roofParameters.importedSource.facadeSegments);
  assert.equal(live.getParseCount(), 1);
  const replacement = ref(source.metadata.roofCalculation, [{ minimumY: 4 }]);
  assert.equal(live.read(replacement, 2).storeyBaseY, 4); assert.equal(live.getParseCount(), 2);
});

test('optimistic roof changes bypass the descriptor cache; caps retain geometry and original mining ownership', () => {
  const original = calculation(.5, 'original'), edited = calculation(.8, 'edited');
  const source = ref(original), resolver = createLod2RoofSourceResolver(roofCalculationForScene), wall = chunk();
  const before = trimLod2WallCaps(wall, [resolver.read(source, 1)]);
  const baseline = trimLod2WallCaps(wall, [{ buildingId: 'building', calculation: original }]);
  assert.deepEqual(before.geometry!.getAttribute('position').array, baseline.geometry!.getAttribute('position').array);
  assert.deepEqual(before.geometry!.getAttribute(LOD2_WALL_SOURCE_CELL_ATTRIBUTE).array, baseline.geometry!.getAttribute(LOD2_WALL_SOURCE_CELL_ATTRIBUTE).array);
  registerOptimisticRoofCalculation(source.objectInstanceId, edited);
  try {
    const descriptor = resolver.read(source, 1);
    assert.equal(descriptor.calculation, edited); assert.equal(resolver.getParseCount(), 1);
    const after = trimLod2WallCaps(wall, [descriptor]);
    assert(Math.abs(after.geometry!.boundingBox!.max.y - .8) < 1e-6);
    assert.equal(after.geometry!.getAttribute(LOD2_WALL_SOURCE_CELL_ATTRIBUTE).getX(0), 0);
    const mined = trimLod2WallCaps(chunk(0, 2, false), [descriptor]); assert.equal(mined.geometry, null);
    after.geometry!.dispose();
  } finally {
    clearOptimisticRoofCalculation(source.objectInstanceId, edited);
    assert.equal(resolver.read(source, 1).calculation, original);
    before.geometry!.dispose(); baseline.geometry!.dispose();
  }
});
