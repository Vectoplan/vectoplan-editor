import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker as NodeWorker } from 'node:worker_threads';
import { createChunkMeshWorkerClient } from '../src/frontend/render/chunk_mesh_worker_client';
import type { ChunkMeshWorkerChunk } from '../src/frontend/render/chunk_mesh_worker_models';

test('real worker transport separates meshing from delayed main-thread delivery without changing geometry', async () => {
  const previous = globalThis.Worker;
  class DelayedDeliveryWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror: ((event: { message: string }) => void) | null = null;
    worker = new NodeWorker(new URL('./chunk_mesh_node_worker.mjs', import.meta.url));
    constructor() {
      this.worker.on('message', data => setTimeout(() => this.onmessage?.({ data }), 60));
      this.worker.on('error', error => this.onerror?.({ message: error.message }));
    }
    postMessage(data: unknown, transfers: any[]): void { this.worker.postMessage(data, transfers); }
    terminate(): void { void this.worker.terminate(); }
  }
  globalThis.Worker = DelayedDeliveryWorker as any;
  const client = createChunkMeshWorkerClient();
  try {
    const cells = new Int32Array(4096); cells[0] = 1;
    const chunk: ChunkMeshWorkerChunk = { chunkKey: '0:0:0', chunkX: 0, chunkY: 0, chunkZ: 0, chunkSize: 16,
      cellSize: 1, cells, boundaries: Object.fromEntries(['negativeX','positiveX','negativeY','positiveY','negativeZ','positiveZ']
        .map(key => [key, new Uint8Array(256)])) as any };
    const result = await client.build(chunk);
    assert.equal(result.quadCount, 6);
    assert.equal(result.buffers[0]!.positions.length, 72);
    assert.equal(cells.byteLength, 0, 'voxel buffers must still transfer rather than clone');
    assert(result.mainDeliveryDelayMs! >= 45, `delivery delay missing: ${result.mainDeliveryDelayMs}`);
    assert(result.roundTripMs! >= result.mainDeliveryDelayMs!);
    assert(result.workerQueueMs! >= 0);
    assert(result.workerFinishedAtEpochMs! >= result.workerStartedAtEpochMs!);
    assert(result.roundTripMs! > result.buildMs + 40, 'delayed delivery must not be mistaken for worker CPU time');
  } finally { client.destroy(); globalThis.Worker = previous; }
});
