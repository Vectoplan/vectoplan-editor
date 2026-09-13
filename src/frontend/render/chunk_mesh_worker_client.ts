import type {
  ChunkMeshWorkerChunk,
  ChunkMeshWorkerRequest,
  ChunkMeshWorkerResponse,
  ChunkMeshWorkerResult,
} from "./chunk_mesh_worker_models";

export interface ChunkMeshWorkerClient {
  readonly build: (chunk: ChunkMeshWorkerChunk) => Promise<ChunkMeshWorkerResult>;
  readonly destroy: () => void;
}

interface PendingBuild {
  readonly resolve: (result: ChunkMeshWorkerResult) => void;
  readonly reject: (error: Error) => void;
  readonly postedAtMs: number;
  readonly postedAtEpochMs: number;
}

export function createChunkMeshWorkerClient(): ChunkMeshWorkerClient {
  const worker = new Worker(new URL("./chunk_mesh_worker.ts", import.meta.url), {
    type: "module",
    name: "vectoplan-chunk-mesher",
  });
  const pending = new Map<number, PendingBuild>();
  let nextId = 1;
  let destroyed = false;

  worker.onmessage = (event: MessageEvent<ChunkMeshWorkerResponse>) => {
    const response = event.data;
    const build = pending.get(response.id);
    if (!build) return;
    pending.delete(response.id);
    if (response.ok && response.result) {
      const result = response.result, receivedAtMs = performance.now();
      build.resolve({ ...result, roundTripMs: Math.max(0, receivedAtMs - build.postedAtMs),
        workerQueueMs: Number.isFinite(result.workerStartedAtEpochMs)
          ? Math.max(0, result.workerStartedAtEpochMs! - build.postedAtEpochMs) : undefined,
        mainDeliveryDelayMs: Number.isFinite(result.workerFinishedAtEpochMs)
          ? Math.max(0, performance.timeOrigin + receivedAtMs - result.workerFinishedAtEpochMs!) : undefined,
      });
    }
    else build.reject(new Error(response.error ?? "Chunk mesh worker failed."));
  };
  worker.onerror = (event) => {
    const error = new Error(event.message || "Chunk mesh worker crashed.");
    for (const build of pending.values()) build.reject(error);
    pending.clear();
  };

  return {
    build(chunk): Promise<ChunkMeshWorkerResult> {
      if (destroyed) return Promise.reject(new Error("Chunk mesh worker is destroyed."));
      const id = nextId;
      nextId += 1;
      return new Promise((resolve, reject) => {
        const request: ChunkMeshWorkerRequest = { id, chunk };
        const transfers: Transferable[] = [chunk.cells.buffer];
        for (const mask of Object.values(chunk.boundaries)) transfers.push(mask.buffer);
        const postedAtMs = performance.now();
        pending.set(id, { resolve, reject, postedAtMs, postedAtEpochMs: performance.timeOrigin + postedAtMs });
        try { worker.postMessage(request, transfers); }
        catch (error) { pending.delete(id); reject(error); }
      });
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      worker.terminate();
      const error = new Error("Chunk mesh worker was destroyed.");
      for (const build of pending.values()) build.reject(error);
      pending.clear();
    },
  };
}
