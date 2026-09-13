import { parentPort } from 'node:worker_threads';

// Use the production message handler and transferable buffers in a real worker
// thread; only the webworker global surface is adapted to Node's parent port.
const workerScope = { onmessage: null as null | ((event: { data: unknown }) => void),
  postMessage: (data: unknown, options?: { transfer?: readonly ArrayBuffer[] }) => parentPort!.postMessage(data, options?.transfer) };
(globalThis as any).self = workerScope;
await import('../../src/frontend/render/chunk_mesh_worker');
parentPort!.on('message', data => workerScope.onmessage!({ data }));
