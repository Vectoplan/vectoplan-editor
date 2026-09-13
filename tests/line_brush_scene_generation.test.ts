import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { filterLod2BuildingGeometry, planningBuildingExpectedObjectChunks } from "../src/frontend/world_edit/systems/line_brush/building_scene_generation";

test("server-protected cells and empty components do not delay the scene handoff", () => {
  const a = { x: 0, y: 0, z: 0 }, b = { x: 16, y: 0, z: 0 }, c = { x: 32, y: 0, z: 0 };
  const placement = (id: string, cells: typeof a[]) => ({ ref: { objectInstanceId: id, anchor: cells[0]! },
    payload: { metadata: { renderProfile: "construction-grid" }, occupiedCells: cells } });
  const expected = planningBuildingExpectedObjectChunks([
    placement("walls", [a, b]), placement("empty-slab", [c]),
    { ref: { objectInstanceId: "roof", anchor: a }, payload: { metadata: { voxelOccupancy: "none" } } },
  ], [a, c]);
  assert.deepEqual([...expected.get("0:0:0")!], ["roof"]);
  assert.deepEqual([...expected.get("1:0:0")!], ["walls"]);
  assert.equal(expected.has("2:0:0"), false);
});

for (const indexed of [false, true]) test(`filtered shared LoD2 cap keeps neighbor wall/slab materials (${indexed ? "indexed" : "nonindexed"})`, () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(36), 3));
  geometry.setAttribute("lod2BuildingIndex", new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1], 1));
  geometry.addGroup(0, 6, 0); geometry.addGroup(6, 6, 1);
  if (indexed) geometry.setIndex(Array.from({ length: 12 }, (_, i) => i));
  const filtered = filterLod2BuildingGeometry(geometry, 0);
  assert.deepEqual(Array.from(filtered.index!.array), [3, 4, 5, 9, 10, 11]);
  assert.deepEqual(filtered.groups, [{ start: 0, count: 3, materialIndex: 0 }, { start: 3, count: 3, materialIndex: 1 }]);
  assert.deepEqual(geometry.groups, [{ start: 0, count: 6, materialIndex: 0 }, { start: 6, count: 6, materialIndex: 1 }]);
  const empty = filterLod2BuildingGeometry(filtered, 1);
  assert.equal(empty.index!.count, 0); assert.deepEqual(empty.groups, []);
  filtered.dispose(); empty.dispose(); geometry.dispose();
});
