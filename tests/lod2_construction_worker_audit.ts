// Read-only benchmark and exact mining/geometry comparison of actual Berlin
// chunks through the production chunk worker in a real worker thread.
import { readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { normalizeChunkApiBatchResult } from '../src/frontend/api/chunk_api_normalize';
import { createRuntimeChunkContent } from '../src/frontend/runtime/world/chunk_content';
import { semanticObjectRefs } from '../src/frontend/scene/scene_runtime';
import { prepareConstructionMeshGroups, createConstructionMeshFromWorker } from '../src/frontend/scene/construction_mesh_worker_bridge';
import { createConstructionCellMesh, removeConstructionMeshInterfaces } from '../src/frontend/scene/construction_cell_rendering';
import type { ChunkMeshWorkerResponse } from '../src/frontend/render/chunk_mesh_worker_models';

const raw = JSON.parse(readFileSync(process.argv[2]!, 'utf8'));
const payloads = Array.isArray(raw) ? raw : raw.chunks, first = payloads[0].chunk ?? payloads[0];
const result = normalizeChunkApiBatchResult({ ok: true, chunks: payloads.map((chunk: any) => chunk.chunk ? chunk : { chunk }) }, null,
  { projectId: first.projectId, worldId: first.worldId });
assert(result.ok);
const chunks = result.chunks.map(chunk => createRuntimeChunkContent(chunk));
const worker = new Worker(new URL('./chunk_mesh_node_worker.mjs', import.meta.url));
const rows: any[] = [];
let id = 0, triangles = 0, miningRanges = 0;
const material = new THREE.MeshBasicMaterial();
try {
  for (const chunk of chunks) {
    let at = performance.now();
    const groups = prepareConstructionMeshGroups(chunk, semanticObjectRefs(chunk));
    const prepareMs = performance.now() - at;
    const message = { id: ++id, chunk: { chunkKey: chunk.chunkKey, chunkX: chunk.chunkX, chunkY: chunk.chunkY,
      chunkZ: chunk.chunkZ, chunkSize: chunk.chunkSize, cellSize: chunk.cellSize, cells: new Int32Array(4096),
      boundaries: Object.fromEntries(['negativeX', 'positiveX', 'negativeY', 'positiveY', 'negativeZ', 'positiveZ'].map(key => [key, new Uint8Array(256)])),
      constructionGroups: groups.map(group => group.request) } };
    let postMs = 0;
    const response = await new Promise<ChunkMeshWorkerResponse>((resolve, reject) => {
      const error = (error: Error) => reject(error);
      worker.once('error', error);
      worker.once('message', response => { worker.off('error', error); resolve(response); });
      at = performance.now(); worker.postMessage(message); postMs = performance.now() - at;
    });
    assert(response.ok, response.error);
    at = performance.now();
    const actual = response.result!.constructionBuffers!.map(buffer => createConstructionMeshFromWorker(buffer, groups[buffer.id]!, material));
    const conversionMs = performance.now() - at;
    at = performance.now();
    const expected = groups.flatMap(group => {
      const mesh = createConstructionCellMesh(group.request.cells, material, group.request.scale);
      if (!mesh) return []; mesh.userData.semanticObjectRef = group.ref; return [mesh];
    });
    removeConstructionMeshInterfaces(expected);
    const syncMs = performance.now() - at;
    assert.equal(actual.length, expected.length, chunk.chunkKey);
    actual.forEach((mesh, index) => {
      const other = expected[index]!;
      for (const name of ['position', 'normal', 'uv']) assert.deepEqual(mesh.geometry.getAttribute(name).array, other.geometry.getAttribute(name).array, `${chunk.chunkKey}/${name}`);
      const ranges = mesh.userData.constructionCellRanges;
      assert.deepEqual(ranges, other.userData.constructionCellRanges);
      for (const [index, range] of ranges.entries()) assert.equal(range.cell, other.userData.constructionCellRanges[index].cell);
      triangles += mesh.geometry.getAttribute('position').count / 3; miningRanges += ranges.length;
    });
    rows.push({ chunk: chunk.chunkKey, groups: groups.length, prepareMs, postMs, conversionMs, syncMs,
      workerMs: response.result!.constructionBuildMs, mainMs: prepareMs + postMs + conversionMs });
    for (const mesh of [...actual, ...expected]) mesh.geometry.dispose();
  }
  const sum = (key: string) => Math.round(rows.reduce((sum, row) => sum + row[key], 0) * 100) / 100;
  const max = (key: string) => Math.round(Math.max(...rows.map(row => row[key])) * 100) / 100;
  console.log(JSON.stringify({ chunks: chunks.length, groups: sum('groups'), triangles, miningRanges, exactGeometryAndMining: true,
    totals: Object.fromEntries(['prepareMs', 'postMs', 'conversionMs', 'syncMs', 'workerMs', 'mainMs'].map(key => [key, sum(key)])),
    maximum: Object.fromEntries(['mainMs', 'syncMs', 'workerMs'].map(key => [key, max(key)])),
    worstMainChunks: rows.sort((a, b) => b.mainMs - a.mainMs).slice(0, 3) }, null, 2));
} finally { await worker.terminate(); material.dispose(); }
