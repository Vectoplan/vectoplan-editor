import test from "node:test";
import assert from "node:assert/strict";
import {ShapeUtils, Vector2} from "three";
import {contourBuildingFromLod2, contourBuildingFromMetadata, contourBuildingScopes, contourRoofScopeIndex,
  contourBuildingHeightProfile, contourBuildingRoofs, refreshContourBuildingRoofs, replaceContourBuildingRing,
  createContourBuildingDraft, contourBuildingLayout, ensureContourBuildingPartitions,
  remapContourStoreyHeightProfile} from "../src/frontend/world_edit/systems/line_brush/contour_building";
import {parcelGridPolygonArea, intersectConvexParcelGridPolygons} from "../src/frontend/world_edit/systems/parcel_grid/geometry";
import {buildLineBrushBuildingGeometry} from "../src/frontend/world_edit/systems/line_brush/building_geometry";
import {pathBrushDraftFromUnknown} from "../src/frontend/world_edit/systems/shared/path_brush_geometry";
import {createStoreyHeightProfile, moveStoreyBoundary} from "../src/frontend/world_edit/systems/storey/height_profile";
import {contourStoreyClipper, contourRoofWallCells} from "../src/frontend/world_edit/systems/line_brush/contour_storeys";
import {buildLineBrushRoofZones} from "../src/frontend/world_edit/systems/line_brush/building_roofs";
const outer = [[0,0],[20,0],[20,12],[0,12]];
const hole = [[6,4],[6,8],[14,8],[14,4]];
function model(withHole = true) {
  const ground = [[outer, ...(withHole ? [hole] : [])]];
  const left = [[-1,-1],[9,-1],[13,13],[-1,13]], right = [[9,-1],[21,-1],[21,13],[13,13]];
  const roof = (id: string, ring: number[][], eaves: number) => {
    const faces = [{face_ref: id, polygon_3d_mm: ring.map(([x,z]) => [x!*1000,z!*1000,eaves*1000])}];
    return {objectTypeId: "building_roof", objectInstanceId: id, anchor: {x:0,y:eaves,z:0},
      footprint:{type:"Polygon",coordinates:[ring],baseY:eaves,height:1}, metadata:{lod2BuildingId:"partition-building",
        roofParameters:{roofType:"imported",eavesHeightMm:eaves*1000,pitchDeg:0,importedSource:{
          buildingId:"partition-building", groundFootprints:ground, faces, baseY:eaves,
          facadeSegments:outer.map((p,i)=>({start:p,end:outer[(i+1)%outer.length],minimumY:0,maximumY:9}))}},
        roofCalculation:{geometry:{faces},input_fingerprint:id}}};
  };
  const refs = [roof("left",left,6),roof("right",right,9)];
  return {metadata:contourBuildingFromLod2(refs)!,refs};
}
function triangles(footprint:any) {
  return footprint.coordinates.flatMap((polygon:number[][][])=>{
    const points=polygon.flat();
    return ShapeUtils.triangulateShape(polygon[0]!.map(p=>new Vector2(p[0],p[1])),polygon.slice(1).map(r=>r.map(p=>new Vector2(p[0],p[1]))))
      .map(indices=>indices.map(i=>points[i]!));
  });
}
function verifyCoverage(metadata:any) {
  const scopes=contourBuildingScopes(metadata), expected=triangles(metadata.footprint).reduce((n:number,t:any)=>n+parcelGridPolygonArea(t),0);
  const domains=scopes.map(scope=>triangles(scope.footprint));
  const actual=domains.flat().reduce((n:number,t:any)=>n+parcelGridPolygonArea(t),0);
  assert.ok(Math.abs(actual-expected)<1e-4,`complete real coverage ${actual}/${expected}`);
  domains.forEach((a:any,i:number)=>domains.slice(i+1).forEach((b:any)=>{
    const overlap=a.reduce((n:number,p:any)=>n+b.reduce((s:number,q:any)=>s+parcelGridPolygonArea(intersectConvexParcelGridPolygons(p,q)),0),0);
    assert.ok(overlap<1e-4,`no double owned plan area ${overlap}`);
  }));
}

test("one concave/courtyard GroundSurface exposes disjoint roof domains with stable identity and exact full coverage",()=>{
  const {metadata,refs}=model();
  assert.equal(metadata.footprint.coordinates.length,1);
  assert.equal(contourBuildingScopes(metadata).length,2);
  verifyCoverage(metadata);
  const reordered=contourBuildingFromLod2([...refs].reverse())!;
  assert.deepEqual(reordered.storeyPartitions,metadata.storeyPartitions);
  assert.deepEqual(contourBuildingFromMetadata(JSON.parse(JSON.stringify(metadata))),metadata);
  const draft=createContourBuildingDraft(metadata)!,layout=contourBuildingLayout(draft);
  assert.deepEqual(draft.footprint,metadata.footprint);
  assert.equal(draft.segments.length,2);
  assert.equal(Object.keys(layout.bySegment).length,2);
  assert.deepEqual(pathBrushDraftFromUnknown(JSON.parse(JSON.stringify(draft))),draft);
  const parametric = buildLineBrushRoofZones(draft,layout,"hipped",true);
  assert.deepEqual(new Set(parametric.map(zone=>zone.scope)),new Set(["segment:0","segment:1"]));
  assert.ok(parametric.some(zone=>zone.interiorEdges.length>0));
  for(const scope of contourBuildingScopes(metadata)) {
    const geometry=buildLineBrushBuildingGeometry({draft,layout,baseY:0,storeyCount:1,
      storeyHeightsMeters:[3],alignToBuildingGrid:true,segmentScope:scope.index});
    const floorArea=geometry.storeys[0]!.slabCells.reduce((s,c)=>s+c.footprintPolygons!.reduce((n,p)=>n+parcelGridPolygonArea(p),0),0);
    const scopeArea=triangles(scope.footprint).reduce((s:number,p:any)=>s+parcelGridPolygonArea(p),0);
    assert.ok(Math.abs(floorArea-scopeArea)<1e-4);
  }
});

test("roof domains use the full building facade grid and never add room-high walls along an internal partition",()=>{
  const {metadata}=model(false),draft=createContourBuildingDraft(metadata)!,layout=contourBuildingLayout(draft);
  const allWalls=contourBuildingScopes(metadata).flatMap(scope=>buildLineBrushBuildingGeometry({draft,layout,baseY:0,
    storeyCount:1,storeyHeightsMeters:[3],alignToBuildingGrid:true,segmentScope:scope.index}).wallCells);
  for(const cell of allWalls) for(const ring of cell.footprintPolygons!) {
    const x=ring.reduce((s,p)=>s+p[0],0)/ring.length,z=ring.reduce((s,p)=>s+p[1],0)/ring.length;
    assert.ok(x<=1.001||x>=18.999||z<=1.001||z>=10.999,`unexpected interior wall ${x},${z}`);
  }
});

test("a partition height change moves only its roof and survives new generated IDs, reordered refetch and custom floor counts",()=>{
  const {metadata,refs}=model();
  const left=metadata.source!.roofs.find(r=>r.objectInstanceId==="left")!,right=metadata.source!.roofs.find(r=>r.objectInstanceId==="right")!;
  const a=contourRoofScopeIndex(metadata,left),b=contourRoofScopeIndex(metadata,right);
  const moved=contourBuildingRoofs(metadata,metadata.footprint,0,{}, {[`segment:${a}`]:3,[`segment:${b}`]:0});
  assert.equal(moved.find(r=>r.objectInstanceId==="left")!.eavesY,9);
  assert.equal(moved.find(r=>r.objectInstanceId==="right")!.eavesY,9);
  const profile=contourBuildingHeightProfile(metadata);
  assert.equal(profile.boundariesByScope[`segment:${a}`]!.length-1,2);
  assert.equal(profile.boundariesByScope[`segment:${b}`]!.length-1,3);
  const current=refs.map(ref=>({...ref,objectInstanceId:`new:${ref.objectInstanceId}`})).reverse();
  const refreshed=refreshContourBuildingRoofs(metadata,current,3,profile);
  assert.deepEqual(refreshed.storeyPartitions!.map(p=>p.id),metadata.storeyPartitions!.map(p=>p.id));
  assert.equal(contourRoofScopeIndex(refreshed,refreshed.source!.roofs.find(r=>r.objectInstanceId==="new:left")!),a);
  assert.equal(refreshed.source!.originalPartitionStoreyCounts![metadata.storeyPartitions![a]!.id],2);
  assert.deepEqual(refreshed.source!.roofObjectIds,metadata.source!.roofObjectIds);
});

test("contour expansion continues partition seams, preserves IDs and covers all new roof area without filling a courtyard",()=>{
  const {metadata}=model();
  const expanded=replaceContourBuildingRing(metadata,[[-4,0],[24,0],[24,16],[-4,16]].map(([x,z])=>({x:x!,z:z!,y:0})))!;
  assert(expanded);verifyCoverage(expanded);
  assert.deepEqual(expanded.storeyPartitions!.map(p=>p.id),metadata.storeyPartitions!.map(p=>p.id));
  assert.deepEqual(expanded.footprint.coordinates[0]![1],metadata.footprint.coordinates[0]![1]);
  const roofs=contourBuildingRoofs(expanded,expanded.footprint,0,{}, {"segment:0":1.2,"segment:1":0});
  assert.ok(roofs.length>=2);
  for(const roof of roofs) assert.ok((roof.parameters.importedSource as any).storeyPartitionId);
  const roofArea=roofs.reduce((sum,roof)=>sum+(roof.calculation.geometry as any).faces.reduce((n:number,face:any)=>n+
    parcelGridPolygonArea(face.polygon_3d_mm.map(([x,z]:number[])=>[x!/1000,z!/1000])),0),0);
  assert.ok(Math.abs(roofArea-(28*16-32))<1e-4);
});

test("deleting an entire first region retains later scope indices; moving all contours translates each exact domain",()=>{
  const {metadata}=model(false);
  const cut=replaceContourBuildingRing(metadata,[[15,0],[20,0],[20,12],[15,12]].map(([x,z])=>({x:x!,z:z!,y:0})))!;
  assert(cut);verifyCoverage(cut);
  assert.equal(cut.storeyPartitions!.length,2);
  assert.deepEqual(contourBuildingScopes(cut).map(s=>s.index),[1]);
  assert.deepEqual(createContourBuildingDraft(cut)!.segments.map(s=>s.index),[1]);
  const moved=replaceContourBuildingRing(metadata,outer.map(([x,z])=>({x:x!+100,z:z!-50,y:0})))!;
  moved.storeyPartitions!.forEach((scope,i)=>assert.deepEqual(scope.footprint.coordinates,metadata.storeyPartitions![i]!.footprint.coordinates
    .map(polygon=>polygon.map(ring=>ring.map(([x,z])=>[x+100,z-50])))));
});

test("legacy component profiles migrate to persistent roof scopes without losing individual interior boundaries",()=>{
  const {metadata}=model();
  const old={...metadata,storeyPartitions:undefined};
  const profile=moveStoreyBoundary(createStoreyHeightProfile({baseCount:3,defaultHeightMeters:2.645}),"all",1,3.2);
  const upgraded=ensureContourBuildingPartitions(old);
  const remapped=remapContourStoreyHeightProfile(profile,old,upgraded);
  assert.deepEqual(remapped.boundariesByScope.all,profile.boundariesByScope.all);
  assert.deepEqual(remapped.boundariesByScope["segment:0"],[0,3.2,5.29,6]);
  assert.deepEqual(remapped.boundariesByScope["segment:1"],[0,3.2,5.29,9]);
});

test("raising the lower roof domain above its neighbour does not cut its upper floor under the neighbour overhang",()=>{
  const {metadata,refs}=model(false);
  const widened=JSON.parse(JSON.stringify(refs));
  widened[0].metadata.roofCalculation.geometry.faces[0].polygon_3d_mm=[[0,0,6000],[12000,0,6000],[12000,12000,6000],[0,12000,6000]];
  widened[1].metadata.roofCalculation.geometry.faces[0].polygon_3d_mm=[[8000,0,9000],[20000,0,9000],[20000,12000,9000],[8000,12000,9000]];
  const current=contourBuildingFromLod2(widened)!;
  const scopes=contourBuildingScopes(current),roofs=contourBuildingRoofs(current,current.footprint,0,{}, {"segment:0":6,"segment:1":0});
  const draft=createContourBuildingDraft(current)!,layout=contourBuildingLayout(draft);
  const raw=buildLineBrushBuildingGeometry({draft,layout,baseY:9,storeyCount:1,storeyHeightsMeters:[3],alignToBuildingGrid:true,segmentScope:0}).storeys[0]!;
  const zones=roofs.map(roof=>({calculation:roof.calculation,eavesY:roof.eavesY,scope:`segment:${contourRoofScopeIndex(current,roof)}`,
    polygon:roof.footprint.coordinates as any,
    footprint:scopes.find(scope=>scope.index===contourRoofScopeIndex(current,roof))!.footprint}));
  const clip=contourStoreyClipper(zones);
  const clipped=clip(raw);
  const slabArea=clipped.slabCells.reduce((sum,cell)=>sum+cell.footprintPolygons!.reduce((s,p)=>s+parcelGridPolygonArea(p),0),0);
  assert.ok(Math.abs(slabArea-144)<1e-5,`the whole raised 12x12m region keeps its floor: ${slabArea}`);
  const walls=contourRoofWallCells(current.footprint,zones).filter(cell=>cell.logicalCellId?.startsWith("contour-step:"));
  assert.ok(walls.length>0,"the exposed three-metre level difference is closed");
  assert.ok(walls.every(cell=>cell.footprintPolygons!.every(ring=>ring.every(([x])=>x>=11-1e-6&&x<=12+1e-6))),
    "the exposed wall sits inside its persistent x=12m boundary, not the neighbour overhang at8m");
  assert.equal(metadata.source!.roofs[0]!.eavesY,6);
});
