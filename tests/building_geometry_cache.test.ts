import test from "node:test";
import assert from "node:assert/strict";
import { createLineBrushBuildingGeometryBuilder, buildLineBrushBuildingGeometry, reserveLineBrushBuildingCellBudget,
  CONTOUR_BUILDING_MAX_OPERATION_CELLS } from "../src/frontend/world_edit/systems/line_brush/building_geometry";
import { createPathBrushDraft } from "../src/frontend/world_edit/systems/shared/path_brush_geometry";
import { buildLineBrushBuildingLayout } from "../src/frontend/world_edit/systems/line_brush/building_layout";
import { lineBrushBuildingPreset } from "../src/frontend/world_edit/systems/line_brush/building_presets";

function input(endX = 12) {
  const draft = createPathBrushDraft([{ x: 0, y: 0, z: 0 }, { x: endX, y: 0, z: 4 }], { kind: "building", width: 6 })!;
  return { draft, layout: buildLineBrushBuildingLayout(draft, lineBrushBuildingPreset("standard")), alignToBuildingGrid: true, baseY: .35, storeyCount: 1 };
}
test("one operation reuses exact 2D cells while every storey keeps fresh owners and heights", () => {
  const build = createLineBrushBuildingGeometryBuilder(), firstInput = input();
  const ground = build(firstInput), upper = build({ ...firstInput, baseY: firstInput.baseY + 2.645 });
  assert.strictEqual(ground.footprintCells, upper.footprintCells);
  assert.strictEqual(ground.exteriorFootprintCells, upper.exteriorFootprintCells);
  assert.notStrictEqual(ground.slabCells[0], upper.slabCells[0]);
  assert.notEqual(ground.slabCells[0]!.y, upper.slabCells[0]!.y);
  assert.deepEqual(ground, buildLineBrushBuildingGeometry(firstInput));
  assert.deepEqual(upper, buildLineBrushBuildingGeometry({ ...firstInput, baseY: firstInput.baseY + 2.645 }));
});
test("changed contours, scopes and other operations cannot reuse an obsolete construction plan", () => {
  const build = createLineBrushBuildingGeometryBuilder(), firstInput = input();
  const original = build(firstInput), changed = build(input(16));
  assert.notStrictEqual(original.footprintCells, changed.footprintCells);
  assert.notEqual(original.footprintCells.length, changed.footprintCells.length);
  const scoped = build({ ...firstInput, segmentScope: 0 });
  assert.notStrictEqual(original.footprintCells, scoped.footprintCells);
  assert.ok(scoped.footprintCells.every(cell => cell.logicalCellId!.startsWith("segment:0:")));
  assert.notStrictEqual(original.footprintCells, createLineBrushBuildingGeometryBuilder()(firstInput).footprintCells);
});
test("large contour aggregate is explicit and bounded; ordinary brush and individual child limits remain 65,536", () => {
  assert.throws(() => reserveLineBrushBuildingCellBudget(65_000, 802), (error: any) => error.cellLimit === 65_536);
  assert.equal(reserveLineBrushBuildingCellBudget(165_380, 13_137, CONTOUR_BUILDING_MAX_OPERATION_CELLS), 178_517);
  assert.throws(() => reserveLineBrushBuildingCellBudget(262_000, 145, CONTOUR_BUILDING_MAX_OPERATION_CELLS),
    (error: any) => error.cellLimit === 262_144 && error.requestedCells === 262_145);
  assert.throws(() => reserveLineBrushBuildingCellBudget(0, 1, 1_048_577), RangeError);
  assert.throws(() => createLineBrushBuildingGeometryBuilder()({ ...input(), storeyCount: 10_000 }),
    (error: any) => error.cellLimit === 65_536);
});
