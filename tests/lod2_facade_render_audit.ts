// Read-only audit of actual serialized Berlin chunks; no fixture data is written.
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { normalizeChunkApiBatchResult } from "../src/frontend/api/chunk_api_normalize";
import { createRuntimeChunkContent } from "../src/frontend/runtime/world/chunk_content";
import { semanticObjectRefs, chunkWithoutSemanticObjectCells, appendLod2WallCaps, createChunkMeshRecord } from "../src/frontend/scene/scene_runtime";
import { trimLod2WallCaps, type Lod2RoofSurfaceSource } from "../src/frontend/scene/lod2_wall_caps";
import { createConstructionCellMesh, constructionCellMaterialGroups, survivingConstructionCells, removeConstructionMeshInterfaces } from "../src/frontend/scene/construction_cell_rendering";
import { createBlockMaterial } from "../src/frontend/render/block_material";

const raw = JSON.parse(readFileSync(process.argv[2]!, "utf8"));
const payloads = Array.isArray(raw) ? raw : raw.chunks;
const first = payloads[0].chunk ?? payloads[0];
const result = normalizeChunkApiBatchResult({ ok: true, chunks: payloads.map((chunk: any) => chunk.chunk ? chunk : { chunk }) }, null,
  { projectId: first.projectId, worldId: first.worldId });
if (!result.ok) throw Error("Invalid real runtime chunk export");
const chunks = result.chunks.map(chunk => createRuntimeChunkContent(chunk));
const refs = [...new Map(chunks.flatMap(chunk => semanticObjectRefs(chunk)).map(ref => [ref.objectInstanceId, ref])).values()];
const sources: Lod2RoofSurfaceSource[] = refs.filter(ref => ref.objectTypeId === "building_roof" && ref.metadata.lod2BuildingId).map(ref => {
  const parameters = ref.metadata.roofParameters as any, source = parameters?.importedSource ?? {};
  return { buildingId: String(ref.metadata.lod2BuildingId), calculation: ref.metadata.roofCalculation,
    facadeSegments: source.facadeSegments ?? [], repairFacadeRoofSeams: source.facadeProfileMode === "roof-clamped-v1",
    storeyBaseY: Number(source.baseY), storeyEavesY: Number(parameters.eavesHeightMm) / 1000 };
});
let triangles = 0, removed = 0, capChunks = 0, draws = 0, maxChunkMs = 0, constructionTriangles = 0, constructionRemoved = 0, objectInterfaceRemoved = 0;
const meshes: any[] = [], records: any[] = [];
const start = performance.now();
for (const chunk of chunks) {
  const at = performance.now();
  const chunkConstruction: any[] = [];
  const semantic = semanticObjectRefs(chunk);
  const caps = trimLod2WallCaps(chunkWithoutSemanticObjectCells(chunk, semantic), sources);
  if (caps.geometry) {
    capChunks++;
    const empty = { ...caps.chunk, cells: caps.chunk.cells.map(() => 0) };
    const record = appendLod2WallCaps(createChunkMeshRecord(empty), caps);
    records.push(record); meshes.push(...record.meshes);
    triangles += caps.geometry.getAttribute("position").count / 3;
    removed += caps.geometry.userData.removedInteriorTriangleCount ?? 0;
    draws += caps.geometry.groups.length;
  }
  for (const ref of semantic.filter(ref => ref.metadata.renderProfile === "construction-grid")) {
    const cells = survivingConstructionCells(ref.metadata.constructionCells, ref.occupiedCells).filter(cell =>
      Math.floor(cell.x / chunk.chunkSize) === chunk.chunkX && Math.floor(cell.y / chunk.chunkSize) === chunk.chunkY && Math.floor(cell.z / chunk.chunkSize) === chunk.chunkZ);
    for (const [id, group] of constructionCellMaterialGroups(cells, ref.fillBlockTypeId, Boolean(ref.metadata.lod2BuildingId))) {
      const material = createBlockMaterial({ blockTypeId: id });
      const mesh = createConstructionCellMesh(group, material, chunk.cellSize);
      if (mesh) {
        mesh.name = `construction:${ref.objectInstanceId}:${chunk.chunkKey}`;
        mesh.userData.semanticObjectRef = ref;
        constructionTriangles += mesh.geometry.getAttribute("position").count / 3;
        constructionRemoved += mesh.userData.removedInteriorTriangleCount ?? 0;
        meshes.push(mesh);
        chunkConstruction.push(mesh);
      } else material.dispose();
    }
  }
  objectInterfaceRemoved += removeConstructionMeshInterfaces(chunkConstruction);
  maxChunkMs = Math.max(maxChunkMs, performance.now() - at);
}
const totalMs = performance.now() - start;
const coincident = new Map<string, { mesh: string; normal: number[] }>(), examples: any[] = [];
let coincidentTrianglesAcrossMeshes = 0, coincidentSameFacing = 0, coincidentInteriorContacts = 0;
for (const mesh of meshes) {
  const positions = mesh.geometry.getAttribute("position");
  for (let vertex = 0; vertex < positions.count; vertex += 3) {
    const key = [0, 1, 2].map(index => [positions.getX(vertex + index), positions.getY(vertex + index), positions.getZ(vertex + index)]
      .map(value => Math.round(value * 1e4)).join(":")).sort().join("|");
    const u = [positions.getX(vertex + 1) - positions.getX(vertex), positions.getY(vertex + 1) - positions.getY(vertex), positions.getZ(vertex + 1) - positions.getZ(vertex)];
    const v = [positions.getX(vertex + 2) - positions.getX(vertex), positions.getY(vertex + 2) - positions.getY(vertex), positions.getZ(vertex + 2) - positions.getZ(vertex)];
    const normal = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
    const previous = coincident.get(key);
    if (previous && previous.mesh !== mesh.name) {
      coincidentTrianglesAcrossMeshes++;
      const opposing = normal.reduce((sum, value, index) => sum + value * previous.normal[index]!, 0) < 0;
      if (opposing) coincidentInteriorContacts++; else coincidentSameFacing++;
      if (examples.length < 5) examples.push([previous.mesh, mesh.name, opposing ? "opposing-interior" : "same-facing"]);
    } else coincident.set(key, { mesh: mesh.name, normal });
  }
}
console.log(JSON.stringify({ chunks: chunks.length, sourceRoofs: sources.length, capChunks, capDraws: draws,
  facadeTriangles: triangles, removedFacadeInteriorTriangles: removed, constructionTriangles: constructionTriangles - objectInterfaceRemoved, constructionRemoved, objectInterfaceRemoved,
  coincidentTrianglesAcrossMeshes, coincidentSameFacing, coincidentInteriorContacts, examples, totalMs: Math.round(totalMs), maxChunkMs: Math.round(maxChunkMs) }, null, 2));
meshes.forEach(mesh => { mesh.geometry.dispose(); (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material: any) => material.dispose()); });
