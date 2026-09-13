import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import * as THREE from 'three';
import { createConstructionCellMesh, constructionCellForIntersection, removeConstructionMeshInterfaces } from '../src/frontend/scene/construction_cell_rendering';
import { createConstructionMeshFromWorker, type PreparedConstructionMeshGroup } from '../src/frontend/scene/construction_mesh_worker_bridge';
import type { ChunkMeshWorkerResponse, ChunkMeshWorkerChunk } from '../src/frontend/render/chunk_mesh_worker_models';

export function workerChunk(groups: PreparedConstructionMeshGroup[]): ChunkMeshWorkerChunk {
  return { chunkKey: '0:0:0', chunkX: 0, chunkY: 0, chunkZ: 0, chunkSize: 16, cellSize: 1, cells: new Int32Array(4096),
    boundaries: Object.fromEntries(['negativeX', 'positiveX', 'negativeY', 'positiveY', 'negativeZ', 'positiveZ'].map(key => [key, new Uint8Array(256)])) as any,
    constructionGroups: groups.map(group => group.request) };
}
function group(id: number, cells: any[], building = 'one'): PreparedConstructionMeshGroup {
  return { request: { id, cells, scale: 1, interfaceKey: building }, blockTypeId: 'brick',
    ref: { objectInstanceId: `part-${id}`, metadata: { generatedFromAreaId: building } } as any };
}
async function build(groups: PreparedConstructionMeshGroup[]): Promise<THREE.Mesh[]> {
  const worker = new Worker(new URL('./chunk_mesh_node_worker.mjs', import.meta.url));
  try {
    const response = await new Promise<ChunkMeshWorkerResponse>((resolve, reject) => {
      worker.once('message', resolve); worker.once('error', reject); worker.postMessage({ id: 1, chunk: workerChunk(groups) });
    });
    assert(response.ok, response.error); assert(response.result!.constructionBuffers);
    return response.result!.constructionBuffers!.map(buffer => createConstructionMeshFromWorker(buffer, groups[buffer.id]!, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  } finally { await worker.terminate(); }
}
function synchronous(groups: PreparedConstructionMeshGroup[]): THREE.Mesh[] {
  const meshes = groups.flatMap(group => {
    const mesh = createConstructionCellMesh(group.request.cells, new THREE.MeshBasicMaterial(), group.request.scale);
    if (!mesh) return []; mesh.userData.semanticObjectRef = group.ref; return [mesh];
  });
  removeConstructionMeshInterfaces(meshes); return meshes;
}
function dispose(meshes: THREE.Mesh[]): void { for (const mesh of meshes) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); } }
function equalGeometry(actual: THREE.Mesh[], expected: THREE.Mesh[]): void {
  assert.equal(actual.length, expected.length);
  actual.forEach((mesh, index) => {
    for (const name of ['position', 'normal', 'uv']) assert.deepEqual(mesh.geometry.getAttribute(name).array, expected[index]!.geometry.getAttribute(name).array);
    assert.deepEqual(mesh.userData.constructionCellRanges, expected[index]!.userData.constructionCellRanges);
    assert.equal(mesh.userData.removedInteriorTriangleCount, expected[index]!.userData.removedInteriorTriangleCount);
    assert.equal(mesh.userData.removedObjectInterfaceTriangleCount, expected[index]!.userData.removedObjectInterfaceTriangleCount ?? 0);
  });
}
test('real chunk worker preserves variable-height prism geometry, UVs, object interfaces and original mining identity', async () => {
  const slab = { x: 0, y: 0, z: 0, minimumY: 0, maximumY: .25 };
  const wall = { x: 0, y: 0, z: 0, minimumY: .25, maximumY: 1 };
  const slope = { x: 1, y: 0, z: 0, footprintPolygons: [[[1, 0], [2, 0], [2, 1], [1, 1]]],
    maximumHeights: [[1, .7, .7, 1]], minimumY: 0, maximumY: 1 };
  const groups = [group(0, [slab]), group(1, [wall]), group(2, [slope])];
  const actual = await build(groups), expected = synchronous(groups);
  try {
    equalGeometry(actual, expected);
    for (const [mesh, height, owner] of [[actual[0]!, .1, slab], [actual[1]!, .6, wall]] as const) {
      mesh.updateMatrixWorld();
      const hit = new THREE.Raycaster(new THREE.Vector3(-1, height, .6), new THREE.Vector3(1, 0, 0)).intersectObject(mesh)[0]!;
      assert.equal(constructionCellForIntersection(hit), owner, 'worker clones must map back to original cell objects');
    }
  } finally { dispose(actual); dispose(expected); }
});
test('mined cells stay absent, neighbours regain exposed faces, coincident different buildings retain independent geometry', async () => {
  const left = { x: 0, y: 0, z: 0 }, right = { x: 1, y: 0, z: 0 };
  const joined = await build([group(0, [left, right])]), mined = await build([group(0, [right])]);
  const independent = await build([group(0, [left], 'a'), group(1, [left], 'b')]);
  try {
    assert.equal(joined[0]!.geometry.getAttribute('position').count / 3, 20);
    assert.equal(mined[0]!.geometry.getAttribute('position').count / 3, 12);
    mined[0]!.updateMatrixWorld();
    const hit = new THREE.Raycaster(new THREE.Vector3(-1, .4, .6), new THREE.Vector3(1, 0, 0)).intersectObject(mined[0]!)[0]!;
    assert.equal(constructionCellForIntersection(hit), right);
    assert.equal(independent.length, 2);
    assert(independent.every(mesh => mesh.geometry.getAttribute('position').count / 3 === 12));
  } finally { dispose(joined); dispose(mined); dispose(independent); }
});
test('empty construction payload still uses the existing voxel worker and returns no phantom meshes', async () => {
  assert.deepEqual(await build([]), []);
});
