import assert from 'node:assert/strict';
import test from 'node:test';
import { createChunkRegistry } from '../src/frontend/runtime/world/chunk_registry';
import { createRuntimeChunkContent } from '../src/frontend/runtime/world/chunk_content';

const chunk = (x: number) => createRuntimeChunkContent({ chunkSize:16, cells:[], palette:[], stats:{},
  chunkX:x, chunkY:0, chunkZ:0, chunkKey:`${x}:0:0` } as any);

test('camera reads and content revisions reuse immutable sorted membership', () => {
  const registry = createChunkRegistry({ maxChunks:8 });
  registry.setChunks([chunk(10),chunk(-2),chunk(1)], { visible:true });
  const keys=registry.getChunkKeys(), visible=registry.getVisibleChunkKeys();
  assert.deepEqual(keys,['-2:0:0','1:0:0','10:0:0']);
  assert.equal(Object.isFrozen(keys),true);
  registry.getChunk('1:0:0'); registry.setChunk(chunk(1),{visible:true});
  registry.setVisibleChunkKeys(['10:0:0','-2:0:0','1:0:0']);
  assert.equal(registry.getChunkKeys(),keys);
  assert.equal(registry.getVisibleChunkKeys(),visible);
  registry.deleteChunk('1:0:0'); registry.setChunk(chunk(2),{visible:true});
  assert.deepEqual(registry.getChunkKeys(),['-2:0:0','2:0:0','10:0:0']);
  assert.deepEqual(keys,['-2:0:0','1:0:0','10:0:0'],'older consumers keep an immutable snapshot');
});

test('visibility, dirty flags, failure placeholders, eviction and clear invalidate only the affected membership', () => {
  const registry=createChunkRegistry({maxChunks:16});
  registry.setChunks(Array.from({length:16},(_,i)=>chunk(i)),{visible:true});
  const keys=registry.getChunkKeys();
  registry.setVisibleChunkKeys(['1:0:0','99:0:0']);
  assert.equal(registry.getChunkKeys(),keys);
  assert.deepEqual(registry.getVisibleChunkKeys(),['1:0:0','99:0:0']);
  registry.markChunkDirty('1:0:0'); assert.deepEqual(registry.getDirtyChunkKeys(),['1:0:0']);
  registry.clearDirtyChunk('1:0:0'); assert.deepEqual(registry.getDirtyChunkKeys(),[]);
  registry.markChunkFailed('99:0:0',new Error('missing'));
  assert.ok(registry.getChunkKeys().includes('99:0:0'));
  assert.equal(registry.getChunkKeys().length,16);
  assert.deepEqual(registry.getFailedChunkKeys(),['99:0:0']);
  assert.deepEqual(new Set(registry.getChunkKeys()),new Set(registry.getSnapshot().entries.map(e=>e.chunkKey)));
  registry.clear();
  assert.deepEqual(registry.getChunkKeys(),[]);
  assert.deepEqual(registry.getVisibleChunkKeys(),[]);
  assert.deepEqual(registry.getFailedChunkKeys(),[]);
});
