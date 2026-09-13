import test from "node:test";
import assert from "node:assert/strict";
import { createStoreyHeightProfile, normalizeStoreyHeightProfile, storeyScopeBoundaries, storeyScopeHeights,
  resizeStoreyHeightProfile, moveStoreyBoundary, setStoreyTopHeight, rebaseStoreyProfileTops, migrateLegacyLineBrushHeightProfile } from "../src/frontend/world_edit/systems/storey/height_profile";
import { createPathBrushDraft } from "../src/frontend/world_edit/systems/shared/path_brush_geometry";
import { buildLineBrushBuildingGeometry, createLineBrushBuildingGeometryBuilder } from "../src/frontend/world_edit/systems/line_brush/building_geometry";
import { coalesceLineBrushStoreys } from "../src/frontend/world_edit/systems/line_brush/storey_ownership";
import { createConstructionCellMesh, constructionCellKey } from "../src/frontend/scene/construction_cell_rendering";
import { MeshBasicMaterial, Raycaster, Vector3 } from "three";

test("new LoD2 profiles retain exact eaves and partial storeys while ordinary brush defaults to three blocks", () => {
  const original = createStoreyHeightProfile({baseCount: 4, defaultHeightMeters: 3, topHeightMeters: 9.18,
    scopeTopHeights: {"segment:0": 9.18, "segment:1": 5.1}});
  assert.deepEqual(storeyScopeBoundaries(original), [0, 3, 6, 9, 9.18]);
  assert.deepEqual(storeyScopeBoundaries(original, "segment:1"), [0, 3, 5.1]);
  assert.deepEqual(storeyScopeHeights(original), [3, 3, 3, .18]);
  assert.deepEqual(storeyScopeBoundaries(createStoreyHeightProfile({baseCount: 3})), [0, 3, 6, 9]);
  assert.deepEqual(normalizeStoreyHeightProfile(JSON.parse(JSON.stringify(original))), original);
  assert.equal(normalizeStoreyHeightProfile({baseCount: 4}), null);
  assert.equal(normalizeStoreyHeightProfile({...original, boundariesByScope: {all: [0, 3, 2]}}), null);
});

test("old uniform Linebrush floors migrate to three blocks while custom boundaries and heights survive", () => {
  const legacy = createStoreyHeightProfile({baseCount: 6, defaultHeightMeters: 2.645, scopeCounts: {"segment:0": 4}});
  const migrated = migrateLegacyLineBrushHeightProfile(legacy);
  assert.equal(migrated.defaultHeightMeters, 3);
  assert.deepEqual(storeyScopeBoundaries(migrated), [0, 3, 6, 9, 12, 15, 18]);
  assert.deepEqual(storeyScopeBoundaries(migrated, "segment:0"), [0, 3, 6, 9, 12]);
  assert.equal(storeyScopeBoundaries(resizeStoreyHeightProfile(migrated, "all", 10)).at(-1), 30);
  assert.equal(migrateLegacyLineBrushHeightProfile(migrated), migrated, "migration is idempotent");
  const moved = moveStoreyBoundary(legacy, "all", 1, 3.2);
  assert.equal(migrateLegacyLineBrushHeightProfile(moved), moved, "user-moved slab stays exact");
  const partial = createStoreyHeightProfile({baseCount: 4, defaultHeightMeters: 2.645, topHeightMeters: 8.05});
  assert.equal(migrateLegacyLineBrushHeightProfile(partial), partial, "partial top floor is retained");
  const custom = createStoreyHeightProfile({baseCount: 3, defaultHeightMeters: 4.2});
  assert.equal(migrateLegacyLineBrushHeightProfile(custom), custom, "custom standard is retained");
});

test("moving internal slabs changes adjacent heights, not the roof; top dragging changes only top storey", () => {
  const original = createStoreyHeightProfile({baseCount: 3, defaultHeightMeters: 3,
    scopeTopHeights: {"segment:0": 9, "segment:1": 7.2}});
  const moved = moveStoreyBoundary(original, "segment:0", 1, 4.2);
  assert.deepEqual(storeyScopeHeights(moved, "segment:0"), [4.2, 1.8, 3]);
  assert.deepEqual(storeyScopeBoundaries(moved, "segment:1"), storeyScopeBoundaries(original, "segment:1"));
  assert.equal(storeyScopeBoundaries(moved, "segment:0").at(-1), 9);
  const bounded = moveStoreyBoundary(original, "all", 1, 99);
  assert.deepEqual(storeyScopeBoundaries(bounded), [0, 5.75, 6, 9]);
  const top = setStoreyTopHeight(moved, "segment:0", 10.35);
  assert.deepEqual(storeyScopeBoundaries(top, "segment:0"), [0, 4.2, 6, 10.35]);
  assert.deepEqual(storeyScopeBoundaries(original, "segment:0"), [0, 3, 6, 9]);
});

test("count changes append/remove from the actual current top and preserve individual heights across JSON reload", () => {
  const original = createStoreyHeightProfile({baseCount: 3, defaultHeightMeters: 3, topHeightMeters: 7.2,
    scopeTopHeights: {"segment:1": 4.8}});
  const changed = moveStoreyBoundary(original, "all", 1, 3.6);
  const added = resizeStoreyHeightProfile(changed, "all", 4);
  assert.deepEqual(storeyScopeBoundaries(added), [0, 3.6, 6, 7.2, 10.2]);
  assert.deepEqual(storeyScopeBoundaries(added, "segment:1"), [0, 3.6, 4.8, 7.8]);
  const reloaded = normalizeStoreyHeightProfile(JSON.parse(JSON.stringify(added)))!;
  assert.deepEqual(resizeStoreyHeightProfile(reloaded, "all", 3), changed);
  assert.equal(resizeStoreyHeightProfile(original, "segment:1", 1).boundariesByScope["segment:1"]!.at(-1), 3);
});

test("adopting independent roof edits preserves custom interior levels and exact thin top remainders", () => {
  const original = moveStoreyBoundary(createStoreyHeightProfile({baseCount: 3, defaultHeightMeters: 3}), "all", 1, 4.2);
  const higher = rebaseStoreyProfileTops(original, {all: 11.75});
  assert.deepEqual(storeyScopeBoundaries(higher), [0, 4.2, 6, 11.75]);
  const lower = rebaseStoreyProfileTops(original, {all: 4.23});
  assert.deepEqual(storeyScopeBoundaries(lower), [0, 4.2, 4.23]);
  assert.deepEqual(storeyScopeBoundaries(rebaseStoreyProfileTops(original, {all: 6})), [0, 4.2, 6]);
  assert.deepEqual(storeyScopeBoundaries(original), [0, 4.2, 6, 9]);
});

test("variable-height geometry uses exact boundaries, closes short partial walls and preserves tiny slabs", () => {
  const draft = createPathBrushDraft([{x: 0, y: 0, z: 0}, {x: 12, y: 0, z: 0}], {kind: "building", width: 6})!;
  const original = buildLineBrushBuildingGeometry({draft, baseY: .13, storeyCount: 2, alignToBuildingGrid: true});
  assert.deepEqual(original.storeys.map(s => s.semanticHeightMeters), [3, 3]);
  const changed = buildLineBrushBuildingGeometry({draft, baseY: .13, storeyCount: 4,
    storeyHeightsMeters: [3.8, 2.2, .62, .12], alignToBuildingGrid: true});
  assert.deepEqual(changed.storeys.map(s => s.semanticBaseY), [.13, 3.93, 6.13, 6.75]);
  assert.deepEqual(changed.storeys.map(s => s.semanticTopY), [3.93, 6.13, 6.75, 6.87]);
  const partial = changed.storeys[2]!;
  assert(partial.wallCells.length > 0);
  assert.ok(partial.wallCells.every(cell => cell.minimumY! >= 6.38 - 1e-9 && cell.maximumY! <= 6.75 + 1e-9));
  const tiny = changed.storeys[3]!;
  assert.equal(tiny.wallCells.length, 0);
  assert.ok(tiny.slabCells.every(cell => cell.maximumY === 6.87));
  assert.throws(() => buildLineBrushBuildingGeometry({draft, baseY: 0, storeyCount: 2, storeyHeightsMeters: [3]}), /one positive/);
});

test("variable floors sharing integer addresses retain every prism/material under exactly one owner", () => {
  const draft = createPathBrushDraft([{x: 0, y: 0, z: 0}, {x: 8, y: 0, z: 0}], {kind: "building", width: 4})!;
  const build = createLineBrushBuildingGeometryBuilder();
  const boundaries = [0, 3, 3.6, 4.1];
  const specs = boundaries.slice(0, -1).map((baseY, index) => ({storeyIndex: index, scope: "all",
    footprint: draft.footprint, storey: build({draft, baseY, storeyCount: 1,
      storeyHeightsMeters: [boundaries[index + 1]! - baseY], alignToBuildingGrid: true}).storeys[0]!}));
  const input = specs.reduce((n, spec) => n + spec.storey.wallCells.length + spec.storey.slabCells.length, 0);
  const merged = coalesceLineBrushStoreys(specs, {wallBlockTypeId: "wall", slabBlockTypeId: "slab"});
  const seen = new Map<string, string>(); let fragments = 0, mixed = 0;
  merged.forEach((spec, i) => {
    for (const kind of ["wallCells", "slabCells"] as const) for (const cell of spec.storey[kind]) {
      const key = `${cell.x}:${cell.y}:${cell.z}`, owner = `${i}:${kind}`;
      assert.equal(seen.get(key) ?? owner, owner); seen.set(key, owner); fragments++;
      if (cell.materialBlockTypeId) { mixed++; assert.equal(cell.materialBlockTypeId, "wall"); }
    }
  });
  assert.equal(fragments, input); assert(mixed > 0);
});

test("preview and persistence renderer retain vertically distinct fragments at the same logical/integer owner", () => {
  const base = {x: 0, y: 3, z: 0, logicalCellId: "one-facade-cell",
    footprintPolygons: [[[0, 0], [1, 0], [1, 1], [0, 1]]] as const};
  const lower = {...base, minimumY: 3, maximumY: 3.2}, upper = {...base, minimumY: 3.6, maximumY: 3.9};
  assert.notEqual(constructionCellKey(lower), constructionCellKey(upper));
  const material = new MeshBasicMaterial();
  const mesh = createConstructionCellMesh([lower, upper, lower], material)!;
  assert.equal(mesh.geometry.getAttribute("position").count, 72, "two full 12-triangle prisms, duplicated lower removed");
  mesh.updateMatrixWorld(true);
  for (const height of [3.1, 3.75]) {
    const hit = new Raycaster(new Vector3(.5, height, -2), new Vector3(0, 0, 1)).intersectObject(mesh)[0];
    assert(hit, `vertical fragment ${height} remains selectable`);
  }
  mesh.geometry.dispose(); material.dispose();
});
