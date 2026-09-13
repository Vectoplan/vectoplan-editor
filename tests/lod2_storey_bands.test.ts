import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { normalizeChunkApiBatchResult } from "../src/frontend/api/chunk_api_normalize";
import { createRuntimeChunkContent } from "../src/frontend/runtime/world/chunk_content";
import { lod2StoreyBands } from "../src/frontend/scene/lod2_storey_bands";
import { trimLod2WallCaps, LOD2_WALL_BUILDING_ATTRIBUTE, LOD2_WALL_SOURCE_CELL_ATTRIBUTE } from "../src/frontend/scene/lod2_wall_caps";
import { constructionCellMaterialGroups, createConstructionCellMesh, constructionCellForIntersection, removeConstructionMeshInterfaces } from "../src/frontend/scene/construction_cell_rendering";
import { createBlockMaterial } from "../src/frontend/render/block_material";
import { LOD2_EXISTING_WALL_COLOR } from "../src/frontend/scene/lod2_existing_appearance";

function wall(cells: number[]) {
  const result = normalizeChunkApiBatchResult({ ok: true, chunks: [{ chunk: { projectId: "test", worldId: "test", chunkX: 0, chunkY: 0, chunkZ: 0,
    chunkKey: "0:0:0", chunkSize: 16, cellSize: 1, cells, palette: [{ blockTypeId: "lod2_exterior_wall", solid: true, breakable: true, placeable: true }], objectRefs: [] } }] }, null, { projectId: "test", worldId: "test" });
  assert(result.ok); return createRuntimeChunkContent(result.chunks[0]!);
}
function source(id: string, x: number, z: number) {
  return { buildingId: id, storeyBaseY: .15, storeyEavesY: 8.2,
    calculation: { geometry: { faces: [{ polygon_3d_mm: [[x * 1000, z * 1000, 8200], [(x + 1) * 1000, z * 1000, 8200],
      [(x + 1) * 1000, (z + 1) * 1000, 8200], [x * 1000, (z + 1) * 1000, 8200]] }] } },
    facadeSegments: [{ start: [x + .1, z + .1], end: [x + .9, z + .1], minimumY: .15, maximumY: 8.2,
      topProfile: [[0, 8.2], [.8, 8.2]], bottomProfile: [[0, .15], [.8, .15]] }] };
}
test("new visible LoD2 slab bands use 3 m storeys, 25 cm slabs and preserve the partial top below eaves", () => {
  const bands = lod2StoreyBands(.15, 8.2, 0, 20);
  assert.equal(bands.length, 3);
  assert.ok(Math.abs(bands[1]![0] - 3.15) < 1e-10);
  assert.equal(lod2StoreyBands(.15, 9.2, 0, 20).at(-1)![1], 9.2);
  const legacy = lod2StoreyBands(.15, 8.2, 0, 20, 2.645);
  assert.equal(legacy.length, 4);
  assert.equal(legacy.at(-1)![1], 8.2);
  assert.deepEqual(lod2StoreyBands(.15, 8.2, 10, 20), []);
});
test("neutral facade surfaces retain source-cell ownership, per-building filtering and removed block gaps", () => {
  const cells = Array(4096).fill(0);
  for (let y = 0; y <= 8; y++) { cells[y * 16] = 1; cells[2 + y * 16 + 256 * 2] = 1; }
  cells[2 * 16] = 0;
  const chunk = wall(cells), before = [...chunk.cells];
  const caps = trimLod2WallCaps(chunk, [source("main", 0, 0), source("neighbour", 2, 2)]);
  const geometry = caps.geometry!;
  assert(geometry);
  assert.deepEqual([...chunk.cells], before);
  assert.equal(geometry.groups.length, 1);
  assert.equal(geometry.groups[0]!.materialIndex, 0);
  assert.deepEqual(new Set(geometry.userData.lod2BuildingIds), new Set(["main", "neighbour"]));
  const positions = geometry.getAttribute("position"), owners = geometry.getAttribute(LOD2_WALL_SOURCE_CELL_ATTRIBUTE);
  const buildings = geometry.getAttribute(LOD2_WALL_BUILDING_ATTRIBUTE);
  assert.equal(positions.count, owners.count); assert.equal(buildings.count, owners.count);
  for (let i = 0; i < positions.count; i++) {
    assert.notEqual(owners.getX(i), 32);
    if (geometry.userData.lod2BuildingIds[buildings.getX(i)] === "main") assert.ok(positions.getX(i) < 1);
  }
  let grouped = 0;
  for (const group of geometry.groups) { assert.equal(group.start, grouped); grouped += group.count; }
  assert.equal(grouped, positions.count);
  geometry.dispose();
});

test("LoD2 slab and wall materials form one neutral material group without altering ordinary buildings", () => {
  const cells = [{ x: 0, y: 0, z: 0, materialBlockTypeId: "vp.hochbau.decken.massivdecken.decke_stahlbeton" },
    { x: 1, y: 0, z: 0, materialBlockTypeId: "wall-brick" }];
  assert.equal(constructionCellMaterialGroups(cells, "fallback").size, 2);
  const groups = constructionCellMaterialGroups(cells, "fallback", true);
  assert.deepEqual([...groups.keys()], ["lod2_exterior_wall"]);
  const material = createBlockMaterial({ blockTypeId: [...groups.keys()][0]! });
  assert.equal(`#${material.color.getHexString()}`, LOD2_EXISTING_WALL_COLOR);
  assert.equal(material.map, null); assert.equal(material.transparent, false);
  assert.equal(material.alphaHash, false); assert.equal(material.dithering, false);
  material.dispose();
});

test("shared block faces are removed but mining exposes the neighbour with correct hit ownership", () => {
  const first = { x: 0, y: 0, z: 0 }, second = { x: 1, y: 0, z: 0 };
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const joined = createConstructionCellMesh([first, second], material)!;
  assert.equal(joined.geometry.getAttribute("position").count / 3, 20);
  assert.equal(joined.userData.removedInteriorTriangleCount, 4);
  const ray = new THREE.Raycaster(new THREE.Vector3(-1, .4, .6), new THREE.Vector3(1, 0, 0));
  joined.updateMatrixWorld();
  assert.equal(constructionCellForIntersection(ray.intersectObject(joined)[0]!), first);
  const mined = createConstructionCellMesh([second], material)!;
  assert.equal(mined.geometry.getAttribute("position").count / 3, 12);
  mined.updateMatrixWorld();
  assert.equal(constructionCellForIntersection(ray.intersectObject(mined)[0]!), second);
  joined.geometry.dispose(); mined.geometry.dispose(); material.dispose();
});

test("identical source facade triangles are emitted once and adjoining storeys have no closed interior surfaces", () => {
  const cells = Array(4096).fill(0); cells[0] = 1; cells[16] = 1;
  const input = source("main", 0, 0);
  const caps = trimLod2WallCaps(wall(cells), [input, input]);
  assert(caps.geometry);
  assert.equal(caps.geometry.getAttribute("position").count / 3, 20);
  assert.equal(caps.geometry.userData.removedInteriorTriangleCount, 4);
  const positions = caps.geometry.getAttribute("position");
  for (let index = 0; index < positions.count; index += 3) {
    assert.ok(![0, 1, 2].every(offset => positions.getY(index + offset) === 1), "shared horizontal slab closure must be absent");
  }
  caps.geometry.dispose();
});

test("separate wall and slab objects share no double face and retain their own mining target", () => {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const lower = { x: 0, y: 0, z: 0, minimumY: 0, maximumY: .25 };
  const upper = { x: 0, y: 0, z: 0, minimumY: .25, maximumY: 1 };
  const slab = createConstructionCellMesh([lower], material)!, wallMesh = createConstructionCellMesh([upper], material)!;
  for (const mesh of [slab, wallMesh]) mesh.userData.semanticObjectRef = { metadata: { generatedFromAreaId: "building-a" } };
  assert.equal(removeConstructionMeshInterfaces([slab, wallMesh]), 4);
  assert.equal(slab.geometry.getAttribute("position").count / 3, 10);
  assert.equal(wallMesh.geometry.getAttribute("position").count / 3, 10);
  for (const [mesh, y, expected] of [[slab, .1, lower], [wallMesh, .5, upper]] as const) {
    mesh.updateMatrixWorld();
    const hit = new THREE.Raycaster(new THREE.Vector3(-1, y, .6), new THREE.Vector3(1, 0, 0)).intersectObject(mesh)[0]!;
    assert.equal(constructionCellForIntersection(hit), expected);
  }
  slab.geometry.dispose(); wallMesh.geometry.dispose(); material.dispose();
});
