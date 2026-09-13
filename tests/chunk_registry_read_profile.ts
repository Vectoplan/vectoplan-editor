import { performance } from 'node:perf_hooks';
import { createChunkRegistry } from '../src/frontend/runtime/world/chunk_registry';
import { createRuntimeChunkContent } from '../src/frontend/runtime/world/chunk_content';

// Match the final F8 capture's registry size without network or persisted writes.
const registry = createChunkRegistry({ maxChunks: 8192 });
const chunk = createRuntimeChunkContent({ chunkSize: 16, cells: [], palette: [], stats: {},
  chunkX: 0, chunkY: 0, chunkZ: 0, chunkKey: '0:0:0' } as any);
for (let i=0; i<1300; i++) registry.setChunk({ ...chunk, chunkKey:`${i%40}:0:${Math.floor(i/40)}` }, { visible:true });
let keys = 0;
const start = performance.now();
for (let i=0; i<300; i++) {
  keys += registry.getChunkKeys().length + registry.getVisibleChunkKeys().length;
  if (i%10===0) {
    const key=`${i%40}:0:${Math.floor(i/40)}`;
    registry.getChunk(key); // Access timestamps do not change membership.
    registry.setChunk({ ...chunk, chunkKey:key }, { visible:true });
  }
}
console.log(JSON.stringify({ reads:600, returnedKeys:keys, durationMs:performance.now()-start }));
