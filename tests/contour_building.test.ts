import test from "node:test";
import assert from "node:assert/strict";
import { CONTOUR_BUILDING_SCHEMA_VERSION, contourBuildingFootprint, contourBuildingFromLod2, contourBuildingFromMetadata,
  createContourBuildingDraft, replaceContourBuildingRing, contourBuildingRoofs, translateContourRoofCalculation,
  refreshContourBuildingRoofs, contourBuildingHeightProfile, contourBuildingScopeTopHeights,
  contourBuildingStandardHeight } from "../src/frontend/world_edit/systems/line_brush/contour_building";
import { pathBrushDraftFromUnknown } from "../src/frontend/world_edit/systems/shared/path_brush_geometry";
import { buildLineBrushBuildingGeometry } from "../src/frontend/world_edit/systems/line_brush/building_geometry";
import { buildLineBrushBuildingLayout } from "../src/frontend/world_edit/systems/line_brush/building_layout";
import { lineBrushBuildingPreset } from "../src/frontend/world_edit/systems/line_brush/building_presets";
import { buildLineBrushRoofZones } from "../src/frontend/world_edit/systems/line_brush/building_roofs";
import { parcelGridPolygonArea } from "../src/frontend/world_edit/systems/parcel_grid/geometry";
import { buildLineBrushRoofWallCells } from "../src/frontend/world_edit/systems/line_brush/roof_walls";
import { createStoreyHeightProfile, moveStoreyBoundary, setStoreyTopHeight } from "../src/frontend/world_edit/systems/storey/height_profile";

const outer = [[0, 0], [12, 0], [12, 4], [8, 4], [8, 12], [0, 12]];
const hole = [[2, 2], [2, 5], [5, 5], [5, 2]];
const other = [[20, 0], [26, 0], [26, 6], [20, 6]];
const footprint = contourBuildingFootprint([[outer, hole], [other]])!;
const metadata = { schemaVersion: CONTOUR_BUILDING_SCHEMA_VERSION, footprint, activePolygonIndex: 0, activeRingIndex: 0, baseY: 2.15 };
const geometryArea = (calculation: any) => calculation.geometry.faces.reduce((sum: number, face: any) => sum
  + parcelGridPolygonArea(face.polygon_3d_mm.map((p: number[]) => [p[0]! / 1000, p[1]! / 1000])), 0);
function ref(id = "one", eaves = 10.2, rings = [[outer, hole], [other]]) {
  const faces = [{ face_ref: "source", polygon_3d_mm: [[0, 0, eaves * 1000], [30000, 0, eaves * 1000], [0, 30000, (eaves + 3) * 1000]] }];
  return { objectTypeId: "building_roof", objectInstanceId: id, anchor: { x: 0, y: 10, z: 0 },
    footprint: { type: "Polygon", coordinates: [outer], baseY: eaves, height: 3 }, metadata: { lod2BuildingId: "berlin", roofParameters: {
      roofType: "imported", pitchDeg: 35, eavesHeightMm: eaves * 1000, importedSource: { schemaVersion: "lod2-roof-source.v1",
        groundFootprints: rings, baseY: eaves, faces, facadeSegments: [{ start: [0, 0], end: [12, 0], minimumY: 2.15, maximumY: 13.2,
          topProfile: [[0, 13.2], [12, 13.2]] }] } },
      roofCalculation: { geometry: { faces }, summary: { maximum_height_mm: (eaves + 3) * 1000 }, input_fingerprint: id } } };
}

test("concave GroundSurface, courtyard and detached components survive common layout, storeys and roof zones", () => {
  const draft = createContourBuildingDraft(metadata)!;
  const layout = buildLineBrushBuildingLayout(draft, lineBrushBuildingPreset("standard"));
  assert.equal(draft.footprintMode, "contour");
  assert.deepEqual(layout.footprint, footprint);
  assert.deepEqual(layout.bySegment["0"], [[outer, hole]]);
  assert.equal(draft.estimatedAreaM2, 139);
  for (const type of ["flat", "gable", "hipped", "pyramid"] as const) {
    const zones = buildLineBrushRoofZones(draft, layout, type, true);
    assert.equal(zones.length, 2);
    assert.deepEqual(zones[0]!.polygon, [outer, hole]);
    assert.deepEqual(zones[0]!.interiorEdges, []);
  }
  const geometry = buildLineBrushBuildingGeometry({ draft, layout, baseY: 2.15, storeyCount: 3, alignToBuildingGrid: true });
  const area = geometry.storeys[0]!.slabCells.reduce((sum, cell) => sum
    + (cell.footprintPolygons ?? []).reduce((value, ring) => value + parcelGridPolygonArea(ring), 0), 0);
  assert.ok(Math.abs(area - draft.estimatedAreaM2) < 1e-5);
});

test("editing a courtyard ring retains the exterior and other solids, rejects crossing or out-of-bounds holes", () => {
  const points = [[2, 2], [2, 6], [6, 6], [6, 2]].map(([x, z]) => ({ x: x!, y: 2.15, z: z! }));
  const edited = replaceContourBuildingRing(metadata, points, 0, 1)!;
  assert.deepEqual(edited.footprint.coordinates[0]![0], outer);
  assert.deepEqual(edited.footprint.coordinates[1], [other]);
  assert.deepEqual(metadata.footprint, footprint);
  assert.equal(replaceContourBuildingRing(metadata, points.map(p => ({ ...p, x: p.x + 30 })), 0, 1), null);
  assert.equal(contourBuildingFootprint([[[[0, 0], [4, 4], [0, 4], [4, 0]]]]), null);
  const draft = createContourBuildingDraft(edited)!;
  assert.deepEqual(pathBrushDraftFromUnknown(JSON.parse(JSON.stringify(draft))), draft);
  assert.deepEqual(contourBuildingFromMetadata({ contourBuilding: edited }), edited);
});

test("LoD2 conversion deduplicates roof refs, retains original partial storeys/annexes and refuses missing GroundSurface", () => {
  const main = ref(), annex = ref("annex", 7.5);
  const converted = contourBuildingFromLod2([main, main, annex])!;
  assert.equal(converted.baseY, 2.15);
  assert.equal(converted.source!.originalStoreyCount, 3);
  assert.equal(converted.source!.roofs[1]!.storeyCount, 2);
  assert.equal(converted.source!.standardStoreyHeightMeters, 3);
  assert.deepEqual(converted.source!.roofObjectIds, ["one", "annex"]);
  assert.deepEqual(converted.source!.originalFootprint, footprint);
  const missing = JSON.parse(JSON.stringify(main)); delete missing.metadata.roofParameters.importedSource.groundFootprints;
  assert.equal(contourBuildingFromLod2([missing]), null);
});

test("a storey delta translates source roof facets, roof skin and structural members, never dimensions or source baselines", () => {
  const model = contourBuildingFromLod2([ref(), ref("annex", 7.5)])!;
  const before = JSON.stringify(model);
  const moved = contourBuildingRoofs(model, footprint, 1);
  assert.ok(Math.abs(moved[0]!.eavesY - moved[1]!.eavesY - 2.7) < 1e-10);
  const face = (moved[0]!.calculation.geometry as any).faces[0].polygon_3d_mm[0];
  assert.equal(face[2], 13200);
  assert.equal((moved[0]!.parameters.importedSource as any).baseY, 10.2);
  assert.equal((moved[0]!.parameters.importedSource as any).facadeSegments[0].minimumY, 2.15);
  assert.equal(JSON.stringify(model), before);
  const shifted: any = translateContourRoofCalculation({ roof_build_up: { top_faces: [{ polygon_3d_mm: [[0, 0, 12000], [1000, 0, 12000], [0, 1000, 13000]] }] },
    structure: { rafters: [{ start_3d_mm: [0, 0, 11000], end_3d_mm: [1000, 0, 12000], height_axis_3d: [0, 0, 1], section_mm: { height: 200 } }] } }, 2.645);
  assert.equal(shifted.roof_build_up.top_faces[0].polygon_3d_mm[0][2], 14645);
  assert.equal(shifted.structure.rafters[0].start_3d_mm[2], 13645);
  assert.deepEqual(shifted.structure.rafters[0].height_axis_3d, [0, 0, 1]);
  assert.equal(shifted.structure.rafters[0].section_mm.height, 200);
});

test("reshaped concave/courtyard roofs preserve existing planes and completely cover new expansions without filling holes", () => {
  const model = contourBuildingFromLod2([ref()])!;
  const changed = contourBuildingFootprint([[[[-2, 0], [12, 0], [12, 4], [8, 4], [8, 12], [-2, 12]], hole], [other]])!;
  const roofs = contourBuildingRoofs(model, changed, 0);
  assert.equal(roofs.length, 2);
  assert.ok(Math.abs(roofs.reduce((sum, roof) => sum + geometryArea(roof.calculation), 0) - 163) < 1e-5);
  for (const roof of roofs) for (const face of (roof.calculation.geometry as any).faces) {
    for (const [x, z, y] of face.polygon_3d_mm) assert.ok(Math.abs(y - (10200 + z * .1)) < 1e-5);
    const center = face.polygon_3d_mm.reduce((p: number[], q: number[]) => [p[0]! + q[0]! / 3000, p[1]! + q[1]! / 3000], [0, 0]);
    assert.ok(!(center[0] > 2 && center[0] < 5 && center[1] > 2 && center[1] < 5));
  }
  const firstSource = (roofs[0]!.parameters.importedSource as any);
  assert.deepEqual(firstSource.footprint[1], [...hole, hole[0]]);
});

test("component storey changes keep disconnected LoD2 parts independent", () => {
  const first = ref("main"), second = ref("detached", 7.5);
  second.footprint.coordinates = [other];
  second.metadata.roofCalculation.geometry.faces = [{ face_ref: "detached", polygon_3d_mm: [[20000, 0, 7500], [26000, 0, 7500], [20000, 6000, 9500]] }];
  first.metadata.roofCalculation.geometry.faces = [{ face_ref: "main", polygon_3d_mm: [[6000, 6000, 10200], [8000, 6000, 10200], [6000, 8000, 11200]] }];
  const model = contourBuildingFromLod2([first, second])!;
  const moved = contourBuildingRoofs(model, footprint, 0, { "segment:1": 1 });
  assert.equal(moved[0]!.eavesY, 10.2);
  assert.ok(Math.abs(moved[1]!.eavesY - 10.5) < 1e-10);
});

test("roof infill closes courtyard-facing gables while preserving the courtyard hole", () => {
  const polygon = [[[0, 0], [12, 0], [12, 12], [0, 12]], hole] as const;
  const cells = buildLineBrushRoofWallCells([{ scope: "all", polygon, interiorEdges: [], eavesY: 10,
    calculation: { geometry: { faces: [{ polygon_3d_mm: [[0, 0, 12000], [12000, 0, 12000], [12000, 12000, 12000], [0, 12000, 12000]] }] } } }]);
  assert.ok(cells.some(cell => cell.footprintPolygons?.some(ring => ring.some(p => Math.abs(p[0] - 5) < 1e-6 && p[1] > 2 && p[1] < 5))),
    "the inner courtyard edge also needs the wall between eaves and roof underside");
});

test("expanding a source gable continues its ridge instead of spanning the addition with a flat triangle", () => {
  const ground = [[[0, 0], [10, 0], [10, 8], [0, 8]]];
  const roof = ref("gable", 10, [ground]);
  roof.footprint.coordinates = ground;
  const vertices = [[0, 0, 10000], [10000, 0, 10000], [10000, 4000, 14000], [0, 4000, 14000], [10000, 8000, 10000], [0, 8000, 10000]];
  roof.metadata.roofCalculation.geometry.faces = [[0, 1, 2], [0, 2, 3], [3, 2, 4], [3, 4, 5]].map((indices, index) => ({
    face_ref: `gable-${index}`, polygon_3d_mm: indices.map(i => vertices[i]!),
  }));
  const model = contourBuildingFromLod2([roof])!;
  const expanded = contourBuildingFootprint([[[[0, 0], [20, 0], [20, 8], [0, 8]]]])!;
  const result = contourBuildingRoofs(model, expanded, 0)[0]!;
  assert.ok(Math.abs(geometryArea(result.calculation) - 160) < 1e-8);
  const faces = (result.calculation.geometry as any).faces;
  assert.ok(faces.some((face: any) => face.polygon_3d_mm.some((p: number[]) => p[0]! > 10000 && Math.abs(p[1]! - 4000) < 1e-6 && Math.abs(p[2]! - 14000) < 1e-6)));
  for (const face of faces) for (const [x, z, y] of face.polygon_3d_mm) {
    assert.ok(Math.abs(y - (14000 - Math.abs(z - 4000))) < 1e-5, `the extended plane must remain the gable at ${x},${z}`);
  }
});

test("moving the whole building translates the exact roof and its editable source plan, without refitting slopes", () => {
  const model = contourBuildingFromLod2([ref()])!;
  const shifted = contourBuildingFootprint(footprint.coordinates.map(polygon => polygon.map(ring => ring.map(([x, z]) => [x + 40.5, z - 12.25]))))!;
  const roof = contourBuildingRoofs(model, shifted, 0)[0]!;
  const originalFace = (model.source!.roofs[0]!.calculation.geometry as any).faces[0].polygon_3d_mm;
  const face = (roof.calculation.geometry as any).faces[0].polygon_3d_mm;
  assert.deepEqual(face, originalFace.map(([x, z, y]: number[]) => [x! + 40500, z! - 12250, y]));
  assert.deepEqual((roof.parameters.importedSource as any).groundFootprints[0][0][0], [40.5, -12.25]);
  assert.equal((roof.calculation.geometry as any).faces.length, 1);
});

test("refresh after a separate roof edit adopts its current shape and partial-height baseline while preserving import cleanup provenance", () => {
  const model = contourBuildingFromLod2([ref()])!;
  const current = ref("generated-roof-current", 11.1);
  current.metadata.roofParameters.pitchDeg = 45;
  current.metadata.roofCalculation.geometry.faces[0]!.polygon_3d_mm[2]![2] = 16500;
  const refreshed = refreshContourBuildingRoofs(model, [current, current], 3);
  assert.equal(refreshed.source!.originalStoreyCount, 3, "UI count remains the explicit baseline even if a partial storey rounds differently");
  assert.equal(refreshed.source!.roofs[0]!.storeyCount, 3);
  assert.equal(refreshed.source!.originalComponentStoreyCounts!["0"], 3);
  assert.equal(refreshed.source!.roofs[0]!.parameters.pitchDeg, 45);
  assert.deepEqual(refreshed.source!.roofObjectIds, model.source!.roofObjectIds);
  assert.deepEqual(refreshed.source!.facadeSegments, model.source!.facadeSegments);
  assert.deepEqual(refreshed.source!.originalWallBounds, model.source!.originalWallBounds);
  const shifted = contourBuildingRoofs(refreshed, refreshed.footprint, 1)[0]!;
  assert.equal((shifted.calculation.geometry as any).faces[0].polygon_3d_mm[2][2], 19500);
  assert.equal(model.source!.roofs[0]!.parameters.pitchDeg, 35);
  assert.throws(() => refreshContourBuildingRoofs(model, [], 3), /fehlen/);
  assert.throws(() => refreshContourBuildingRoofs(model, [{ ...current, metadata: { roofParameters: current.metadata.roofParameters } }], 3), /vollständigen/);
});

test("stored pre-3m contours retain their old standard through normalization, refetch and roof translation", () => {
  const imported = contourBuildingFromLod2([ref()])!;
  const legacy = JSON.parse(JSON.stringify(imported));
  delete legacy.source.standardStoreyHeightMeters;
  legacy.source.originalStoreyCount = 4; legacy.source.roofs[0].storeyCount = 4;
  const model = contourBuildingFromMetadata(legacy)!;
  assert.equal(contourBuildingStandardHeight(model), 2.645);
  assert.deepEqual(contourBuildingHeightProfile(model).boundariesByScope.all, [0, 2.645, 5.29, 7.935, 8.05]);
  const refreshed = refreshContourBuildingRoofs(model, [ref("current", 11.1)], 4);
  assert.equal(refreshed.source!.roofs[0]!.storeyCount, 4);
  assert.equal(contourBuildingStandardHeight(refreshed), 2.645);
  assert.ok(Math.abs(contourBuildingRoofs(refreshed, refreshed.footprint, 1)[0]!.eavesY - 13.745) < 1e-9);
});

test("variable-height roof edits move each true component by explicit metres and keep source surfaces immutable", () => {
  const first = ref("main"), second = ref("detached", 7.5);
  second.footprint.coordinates = [other];
  second.metadata.roofCalculation.geometry.faces = [{face_ref: "detached", polygon_3d_mm: [[20000, 0, 7500], [26000, 0, 7500], [20000, 6000, 9500]]}];
  first.metadata.roofCalculation.geometry.faces = [{face_ref: "main", polygon_3d_mm: [[6000, 6000, 10200], [8000, 6000, 10200], [6000, 8000, 11200]]}];
  const model = contourBuildingFromLod2([first, second])!;
  const tops = contourBuildingScopeTopHeights(model);
  assert.ok(Math.abs(tops["segment:0"]! - 8.05) < 1e-9);
  assert.ok(Math.abs(tops["segment:1"]! - 5.35) < 1e-9);
  const profile = contourBuildingHeightProfile(model);
  assert.deepEqual(profile.boundariesByScope["segment:1"], [0, 3, 5.35]);
  const moved = contourBuildingRoofs(model, model.footprint, 0, {}, {"segment:0": .75, "segment:1": -.4});
  assert.ok(Math.abs(moved[0]!.eavesY - 10.95) < 1e-9);
  assert.ok(Math.abs(moved[1]!.eavesY - 7.1) < 1e-9);
  const unchanged = contourBuildingRoofs(model, model.footprint, 0, {}, {all: 0});
  assert.deepEqual((unchanged[0]!.calculation.geometry as any).faces, first.metadata.roofCalculation.geometry.faces);
  assert.equal(model.source!.roofs[0]!.eavesY, 10.2);
});

test("roof refetch counts variable storeys from persisted boundaries instead of dividing their height by 3m", () => {
  const model = contourBuildingFromLod2([ref()])!;
  const profile = setStoreyTopHeight(moveStoreyBoundary(createStoreyHeightProfile({baseCount: 3,
    defaultHeightMeters: 3}), "all", 1, 4.2), "all", 12);
  const current = ref("changed-roof", 14.15);
  const refreshed = refreshContourBuildingRoofs(model, [current], 3, profile);
  assert.equal(refreshed.source!.originalStoreyCount, 3);
  assert.equal(refreshed.source!.originalComponentStoreyCounts!["0"], 3);
  assert.equal(refreshed.source!.roofs[0]!.storeyCount, 3, "three tall storeys are not four standard storeys");
  assert.equal(refreshed.source!.originalEavesY, 14.15);
});
