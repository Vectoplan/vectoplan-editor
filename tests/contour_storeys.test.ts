import test from "node:test";
import assert from "node:assert/strict";
import { contourRoofWallCells, contourStoreyClipper, CONTOUR_ROOF_TRIANGLE_LIMIT } from "../src/frontend/world_edit/systems/line_brush/contour_storeys";
import { contourBuildingFootprint } from "../src/frontend/world_edit/systems/line_brush/contour_building";
import { parcelGridPolygonArea } from "../src/frontend/world_edit/systems/parcel_grid/geometry";

type Point = readonly [number, number];
const rectangle = (x0: number, z0: number, x1: number, z1: number): Point[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const calc = (ring: readonly Point[], height: number) => ({ geometry: { faces: [{ polygon_3d_mm: ring.map(p => [p[0] * 1000, p[1] * 1000, height * 1000]) }] } });
const area = (cells: readonly any[]) => cells.reduce((sum, cell) => sum + cell.footprintPolygons.reduce((total: number, polygon: Point[]) => total + parcelGridPolygonArea(polygon), 0), 0);
const storey = (minimumY: number, maximumY: number) => ({ wallCells: [{ x: 4, y: 4, z: 4, logicalCellId: "persisted-owner", minimumY, maximumY,
  footprintPolygons: [rectangle(4, 4, 5, 5)] }], slabCells: [], occupiedCells: [], storeyIndex: 0 } as any);

test("overlapping roof projections cannot duplicate storeys or refill the void above a lower annex", () => {
  const ring = rectangle(0, 0, 12, 12);
  const clip = contourStoreyClipper([{ calculation: calc(ring, 9), eavesY: 9 }, { calculation: calc(ring, 6.2), eavesY: 6.2 }]);
  const result = clip(storey(4, 8));
  assert.ok(Math.abs(area(result.wallCells) - 1) < 1e-8);
  assert.equal(result.wallCells[0]!.maximumY, 6.2);
  assert.equal(result.wallCells[0]!.logicalCellId, "persisted-owner");
  assert.deepEqual([result.wallCells[0]!.x, result.wallCells[0]!.y, result.wallCells[0]!.z], [4, 4, 4]);
  assert.equal(clip(storey(7, 8)).wallCells.length, 0);
});

test("a shared construction polygon reuses its roof-domain cuts across vertical cells and floors", () => {
  const clip = contourStoreyClipper([{ calculation: calc(rectangle(0, 0, 12, 12), 6.2), eavesY: 6.2 }]);
  const firstInput = storey(1, 2), secondInput = { ...firstInput,
    wallCells: [{ ...firstInput.wallCells[0], y: 5, minimumY: 5, maximumY: 7 }] };
  const first = clip(firstInput), second = clip(secondInput);
  assert.strictEqual(first.wallCells[0]!.footprintPolygons![0], second.wallCells[0]!.footprintPolygons![0]);
  assert.equal(first.wallCells[0]!.maximumY, 2); assert.equal(second.wallCells[0]!.maximumY, 6.2);
  assert.notStrictEqual(first.wallCells[0], second.wallCells[0]);
  assert.equal(second.wallCells[0]!.y, 5);
});

test("roof-to-wall infill is on ground contours, never on an original roof overhang", () => {
  const footprint = contourBuildingFootprint([[rectangle(0, 0, 12, 12), rectangle(3, 3, 6, 6)]])!;
  const roofRing = rectangle(-2, -2, 14, 14);
  const cells = contourRoofWallCells(footprint, [{ scope: "all", polygon: [roofRing], calculation: calc(roofRing, 12), eavesY: 10 }]);
  assert(cells.length);
  for (const cell of cells) for (const polygon of cell.footprintPolygons!) for (const [x, z] of polygon) {
    assert.ok(x >= -1e-7 && x <= 12 + 1e-7 && z >= -1e-7 && z <= 12 + 1e-7);
    assert.ok(!(x > 3 + 1e-7 && x < 6 - 1e-7 && z > 3 + 1e-7 && z < 6 - 1e-7));
  }
  assert.ok(cells.some(cell => cell.footprintPolygons!.some(polygon => polygon.some(p => p[0] === 6 && p[1] > 3 && p[1] < 6))));
});

test("a stepped annex has a wall from its lower roof to the higher roof, including partial shared edges", () => {
  const ground = contourBuildingFootprint([[rectangle(0, 0, 12, 6)]])!;
  const high = rectangle(0, 0, 6, 6), lowA = rectangle(6, 0, 12, 3), lowB = rectangle(6, 3, 12, 6);
  const zones = [high, lowA, lowB].map((ring, i) => ({ scope: "all", polygon: [ring], calculation: calc(ring, i === 0 ? 12 : 7), eavesY: i === 0 ? 10 : 7 }));
  const walls = contourRoofWallCells(ground, zones);
  const seam = walls.filter(cell => cell.footprintPolygons!.some(polygon => polygon.every(([x, z]) => x >= 5 - 1e-6 && x <= 6 + 1e-6 && z >= 1 && z <= 5)));
  assert.ok(seam.length > 0);
  assert.equal(Math.min(...seam.map(cell => cell.minimumY!)), 7);
  assert.equal(Math.max(...seam.map(cell => cell.maximumY!)), 12);
  assert.ok(seam.every(cell => cell.roofZoneIndex === 0));
});

test("a continuous equal-height roof seam adds no internal wall", () => {
  const ground = contourBuildingFootprint([[rectangle(0, 0, 12, 6)]])!;
  const left = rectangle(0, 0, 6, 6), right = rectangle(6, 0, 12, 6);
  const walls = contourRoofWallCells(ground, [left, right].map(ring => ({ scope: "all", polygon: [ring], calculation: calc(ring, 10), eavesY: 10 })));
  assert.equal(walls.length, 0);
});

test("overlarge original roofs fail before generating a partial editable structure", () => {
  const faces = Array.from({ length: CONTOUR_ROOF_TRIANGLE_LIMIT + 1 }, (_, index) => {
    const x = index % 32 * 1000, z = Math.floor(index / 32) * 1000;
    return { polygon_3d_mm: [[x, z, 10000], [x + 1000, z, 10000], [x, z + 1000, 10000]] };
  });
  assert.throws(() => contourStoreyClipper([{ eavesY: 10,
    calculation: { geometry: { faces } } }]), /1\.000/);
});
