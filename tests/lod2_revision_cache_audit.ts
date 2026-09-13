// Read-only comparison of the old/new revision-scan work on the same actual
// Berlin chunks. Not an FPS benchmark: rendering, streaming and GPU are absent.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { normalizeChunkApiBatchResult } from '../src/frontend/api/chunk_api_normalize';
import { createRuntimeChunkContent } from '../src/frontend/runtime/world/chunk_content';
import { createChunkRegistry } from '../src/frontend/runtime/world/chunk_registry';
import { semanticObjectRefs } from '../src/frontend/scene/scene_runtime';
import { chunkRevisionScanReader } from '../src/frontend/scene/chunk_revision_reads';
import { createLod2RoofSourceResolver } from '../src/frontend/scene/lod2_roof_sources';
import { createLod2RoofIndex } from '../src/frontend/scene/lod2_roof_index';
import { roofCalculationForScene } from '../src/frontend/world_edit/systems/roof/optimistic_calculations';

const raw = JSON.parse(readFileSync(process.argv[2]!, 'utf8')), payloads = Array.isArray(raw) ? raw : raw.chunks;
const first = payloads[0].chunk ?? payloads[0];
const decoded = normalizeChunkApiBatchResult({ ok: true, chunks: payloads.map((c: any) => c.chunk ? c : { chunk: c }) },
  null, { projectId: first.projectId, worldId: first.worldId });
assert(decoded.ok);
const chunks = decoded.chunks.map(c => createRuntimeChunkContent(c)), registry = createChunkRegistry({ maxChunks: 8192 });
registry.setChunks(chunks); registry.setVisibleChunkKeys(chunks.map(c => c.chunkKey));
const index = createLod2RoofIndex(semanticObjectRefs), resolver = createLod2RoofSourceResolver(roofCalculationForScene);
const neighbourOffsets = [[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
function scan(optimized: boolean) {
  let reads = 0, facadeParses = 0;
  const read = (key: string) => { reads++; return registry.getChunk(key); };
  const scanRead = optimized ? chunkRevisionScanReader(read) : read;
  const visible = registry.getVisibleChunkKeys();
  // Old code also sorted the complete loaded-key set even with visible keys.
  const loaded = optimized && visible.length ? [] : registry.getChunkKeys();
  const tokens: string[] = [];
  for (const key of visible.length ? visible : loaded) {
    const c = scanRead(key)!;
    const neighbours = neighbourOffsets.map(([x,y,z]) => scanRead(`${c.chunkX+x!}:${c.chunkY+y!}:${c.chunkZ+z!}`)?.chunkRevision ?? 'missing');
    const roofs = index.query(registry,c).map(({ref,revision}) => {
      if (optimized) return resolver.read(ref,revision);
      facadeParses++;
      const source = (ref.metadata.roofParameters as any)?.importedSource ?? {}, parameters = ref.metadata.roofParameters as any ?? {};
      return { id: ref.objectInstanceId, calculation: roofCalculationForScene(ref.objectInstanceId,ref.metadata.roofCalculation,revision),
        facadeSegments: source.facadeSegments ?? [],
        storeyBaseY: Math.min(...(source.facadeSegments ?? []).map((s: any) => Number(s.minimumY)).filter(Number.isFinite)),
        storeyEavesY: Number(parameters.eavesHeightMm)/1000 };
    });
    tokens.push(JSON.stringify([key,neighbours,roofs.map(s => [s.id,(s.calculation as any)?.input_fingerprint,s.storeyBaseY,s.storeyEavesY])]));
  }
  return { reads, facadeParses, tokens };
}
assert.deepEqual(scan(true).tokens, scan(false).tokens);
function measure(optimized: boolean) {
  const times: number[] = []; let reads = 0, facadeParses = 0;
  for (let i=0;i<35;i++) { const start=performance.now(), result=scan(optimized); times.push(performance.now()-start); reads+=result.reads;facadeParses+=result.facadeParses; }
  times.sort((a,b)=>a-b); return { medianMs: times[17], maxMs: times.at(-1), totalMs:times.reduce((a,b)=>a+b), reads, facadeParses };
}
// Warm JIT equally, then compare exactly the same immutable city snapshot.
for(let i=0;i<5;i++){scan(false);scan(true);}
const before=measure(false),after=measure(true);
assert(after.reads<before.reads);
console.log(JSON.stringify({chunks:chunks.length,scans:35,before,after,actualCachedSourceParses:resolver.getParseCount(),equalRevisionInputs:true},null,2));
