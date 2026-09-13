// Read-only profile: load the actual saved Berlin response into memory only.
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import * as THREE from "three";
import { normalizeChunkApiBatchResult } from "../src/frontend/api/chunk_api_normalize";
import { createRuntimeChunkContent } from "../src/frontend/runtime/world/chunk_content";
import type { ChunkRegistryHandle } from "../src/frontend/runtime/world/chunk_registry";
import { createGeodataOverlayScene } from "../src/frontend/render/geodata_overlay_scene";

const input = JSON.parse(readFileSync(process.argv[2]!, "utf8"));
const raw = Array.isArray(input) ? input : input.chunks.map((entry: any) => entry.chunk ?? entry);
const result = normalizeChunkApiBatchResult({ ok: true, chunks: raw.map((chunk: any) => ({ chunk })) }, null,
  { projectId: raw[0].projectId, worldId: raw[0].worldId });
if (!result.ok) throw Error("Invalid real Berlin runtime export");
const chunks = new Map(result.chunks.map(chunk => { const runtime = createRuntimeChunkContent(chunk); return [runtime.chunkKey, runtime] as const; }));
const allKeys = [...chunks.keys()];
let visible = allKeys;
const registry = { getVisibleChunkKeys: () => visible, getChunk: (key: string) => chunks.get(key) ?? null,
  hasChunk: (key: string) => chunks.has(key) } as unknown as ChunkRegistryHandle;
const overlay = createGeodataOverlayScene({ parent: new THREE.Group() });
const rounds: unknown[] = [];
function measure(reason: string, repetitions = 1) {
  const times: number[] = [];
  const geometries = () => {
    const values = new Set<string>();
    overlay.getGroup().traverse((object: any) => { if (object.geometry) values.add(object.geometry.uuid); });
    return values;
  };
  const previous = geometries();
  let stats: unknown;
  for (let index = 0; index < repetitions; index++) { const start = performance.now(); stats = overlay.syncFromRegistry(registry, reason); times.push(performance.now() - start); }
  const snapshot = overlay.getSnapshot();
  if (snapshot.lastError) throw Error(JSON.stringify(snapshot.lastError));
  const current = geometries();
  rounds.push({ reason, visibleChunks: visible.length, repetitions, totalMs: times.reduce((sum, value) => sum + value, 0),
    maxMs: Math.max(...times), averageMs: times.reduce((sum, value) => sum + value, 0) / repetitions,
    geometriesReused: [...current].filter(id => previous.has(id)).length,
    geometriesCreated: [...current].filter(id => !previous.has(id)).length,
    geometriesRetired: [...previous].filter(id => !current.has(id)).length, stats });
}
try {
  measure("cold-real96");
  measure("unchanged-real96", 20);
  const key = allKeys[0]!, chunk = chunks.get(key)!;
  // A new in-memory revision exercises the normal recompute path while the
  // actual persisted cells, geometries and backend are left untouched.
  chunks.set(key, { ...chunk, chunkRevision: Number(chunk.chunkRevision) + 1, loadedAt: "read-only-profile-new-revision" });
  measure("one-in-memory-revision");
  visible = allKeys.slice(0, 48); measure("visible-half");
  visible = allKeys; measure("visible-restored");
  measure("unchanged-restored", 20);
  console.log(JSON.stringify({ schemaVersion: "geodata-real-profile.v1", chunks: chunks.size, readOnly: true, rounds }, null, 2));
} finally { overlay.dispose("readonly-profile-complete"); }
