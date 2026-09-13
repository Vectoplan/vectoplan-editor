import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import * as THREE from "three";
import { planningObjectReferences, planningBuildingIdentityAtRay } from "../src/frontend/world_edit/systems/line_brush/building_discovery";
import { contourBuildingFromLod2, createContourBuildingDraft, contourBuildingHeightProfile, contourBuildingRoofs, refreshContourBuildingRoofs } from "../src/frontend/world_edit/systems/line_brush/contour_building";
import { lod2ReferencePlanBounds, createLod2RoofIndex } from "../src/frontend/scene/lod2_roof_index";
import { appendLineBrushBuildingRoofPreview } from "../src/frontend/world_edit/systems/line_brush/building_preview";
import { createLineBrushBuildingEditVisuals } from "../src/frontend/world_edit/systems/line_brush/building_edit_visuals";
import { reachableBuildingActionPosition, scaleSceneEditAction } from "../src/frontend/world_edit/systems/shared/scene_edit_actions";

const fixture = (name: string) => JSON.parse(gunzipSync(readFileSync(`tests/fixtures/${name}.json.gz`)).toString());
test("real Berlin ground-chunk discovery works before any roof mesh exists, then adopts all 23 authoritative roofs", () => {
  const chunks = fixture("berlin-lod2-discovery");
  const refs = planningObjectReferences(new THREE.Scene(), chunks.map((chunk: unknown) => ({ raw: { raw: chunk } })));
  const partial = refs.filter(ref => ref.metadata.lod2BuildingId === "DEBE01YYK00000wu");
  assert.equal(partial.length, 5, "the live camera had only five of twenty-three roofs streamed");
  const complete = fixture("berlin-lod2-wu-complete");
  assert.equal(complete.objectRefs.length, 23);
  const original = JSON.stringify(complete);
  const contour = contourBuildingFromLod2(complete.objectRefs)!;
  assert.equal(contour.source!.roofs.length, 23);
  assert.equal(contour.source!.roofObjectIds.length, 23);
  assert.equal(contour.source!.standardStoreyHeightMeters, 3);
  const draft = createContourBuildingDraft(contour)!;
  const sourceGround = complete.objectRefs[0].metadata.roofParameters.importedSource.groundFootprints;
  const sourceVertices = new Set(sourceGround.flat(2).map((p: number[]) => p.join(":")));
  assert.equal(draft.footprint.coordinates.flat(2).every(p => sourceVertices.has(p.join(":"))), true);
  assert.ok(contourBuildingHeightProfile(contour).boundariesByScope.all!.length > 16, "upper streamed-out annexes retain their actual height");
  assert.equal(JSON.stringify(complete), original, "discovery must not mutate imported data");
});

test("a shared LoD2 wall mesh selects the actual hit building, including a facade outside the snapped cell centre", () => {
  const scene = new THREE.Scene(), geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([.25,0,0, .25,0,5, .25,8,0], 3));
  geometry.setAttribute("lod2BuildingIndex", new THREE.Float32BufferAttribute([1,1,1], 1));
  geometry.userData.lod2BuildingIds = ["neighbour", "DEBE01YYK00000wu"];
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.userData.lod2WallCaps = true; scene.add(mesh); scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(-4,2,1), new THREE.Vector3(1,0,0));
  assert.deepEqual(planningBuildingIdentityAtRay(scene, ray), { lod2BuildingId: "DEBE01YYK00000wu" });
});

test("distant LoD2 gears and delete targets stay readable and separately selectable", () => {
  const complete = fixture("berlin-lod2-wu-complete"), contour = contourBuildingFromLod2(complete.objectRefs)!;
  const draft = createContourBuildingDraft(contour)!, scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, .1, 2000);
  camera.position.set(0, 180, 400); camera.lookAt(-75, 20, -30); camera.updateMatrixWorld(true);
  const ref = { objectInstanceId: "lod2_building_DEBE01YYK00000wu", anchor: {x:-120,y:1,z:-80}, footprint: draft.footprint,
    metadata: { contourBuilding: contour, storeyCount: contour.source!.originalStoreyCount } };
  const visuals = createLineBrushBuildingEditVisuals(); visuals.update(scene,true,null,[ref],camera,800);
  const gear = scene.getObjectByName(`vectoplan_world_edit_line_brush_settings:${ref.objectInstanceId}`) as THREE.Sprite;
  const remove = scene.getObjectByName(`vectoplan_world_edit_line_brush_delete:${ref.objectInstanceId}`) as THREE.Sprite;
  assert.ok(gear.visible && remove.visible);
  const pixels = (sprite: THREE.Sprite) => {
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).multiplyScalar(sprite.scale.x/2);
    return sprite.position.clone().add(right).project(camera).distanceTo(sprite.position.clone().sub(right).project(camera))*400;
  };
  assert.ok(Math.abs(pixels(gear)-44)<1e-4);
  const ray = new THREE.Raycaster(); const ndc=remove.position.clone().project(camera);
  ray.setFromCamera(new THREE.Vector2(ndc.x,ndc.y),camera);
  assert.equal(visuals.pickAction(ray)?.action,"delete");
  assert.equal(visuals.pick(ray),null,"delete must never open settings instead");
  visuals.dispose();
});

test("Ego keeps building actions on a visible facade when the original roof is above the viewport", () => {
  const camera = new THREE.PerspectiveCamera(60,1,.1,1000);
  camera.position.set(0,2,0);camera.lookAt(0,2,-10);camera.updateMatrixWorld(true);
  const anchor=reachableBuildingActionPosition(new THREE.Vector3(0,70,-20),[[[-40,-20],[40,-20],[40,-50],[-40,-50]]],0,70,camera)!;
  const projected=anchor.clone().project(camera);
  assert.equal(anchor.y,2);assert.ok(Math.abs(projected.x)<.9 && Math.abs(projected.y)<.9);
  const sprite=new THREE.Sprite();sprite.position.copy(anchor);sprite.updateMatrixWorld();
  assert.ok(scaleSceneEditAction(sprite,camera,800)>0);
});

test("a deleted real LoD2 roof remains discoverable as a facade source and stays deleted after a storey edit", () => {
  const complete=fixture("berlin-lod2-wu-complete");
  const old=complete.objectRefs[0], original=old.objectInstanceId;
  old.objectTypeId="building_facade_source";old.objectInstanceId="preserved-facade";
  old.metadata.lod2FacadeSource={schemaVersion:"vectoplan-lod2-facade-source.v1",deletedRoofObjectInstanceId:original,originalRoofObjectInstanceId:original};
  const refs=planningObjectReferences(null,[{objectRefs:complete.objectRefs}]);
  const contour=contourBuildingFromLod2(refs)!;
  assert.ok(contour.source!.roofObjectIds.includes(original));
  assert.ok(!contour.source!.roofObjectIds.includes("preserved-facade"),"import cleanup identity remains the original roof");
  const refreshed=refreshContourBuildingRoofs(contour,refs,contour.source!.originalStoreyCount);
  const shifted=contourBuildingRoofs(refreshed,contour.footprint,1);
  assert.equal(shifted.filter(roof=>roof.facadeSource).length,1);
  assert.equal(shifted.filter(roof=>!roof.facadeSource).length,22);
  const source=shifted.find(roof=>roof.facadeSource)!;
  assert.equal(source.eavesY,contour.source!.roofs.find(roof=>roof.facadeSource)!.eavesY+3);
  const preview=new THREE.Group();
  appendLineBrushBuildingRoofPreview(preview,[{scope:"all",calculation:source.calculation as any,facadeOnly:true}],"all");
  assert.equal(preview.children.length,0,"facade height reference must not create a roof mesh");
});

test("real roof-part bounds index the whole ground/facade source and work without a visible roof", () => {
  const full=fixture("berlin-lod2-wu-complete"), ref=full.objectRefs[0];
  ref.objectTypeId="building_facade_source";ref.dimensions={x:1,y:1,z:1};
  const bounds=lod2ReferencePlanBounds(ref);
  const facade=ref.metadata.roofParameters.importedSource.facadeSegments;
  assert.ok(facade.every((edge:any)=>[edge.start,edge.end].every(([x,z]:number[])=>x!>=bounds.minX && x!<=bounds.maxX && z!>=bounds.minZ && z!<=bounds.maxZ)));
  const chunk:any={raw:{objectRefs:[ref]},chunkSize:16,chunkKey:"0:0:0",chunkRevision:1};
  const registry:any={getContentRevision:()=>1,getChunkKeys:()=>["source"],getChunk:()=>chunk};
  const index=createLod2RoofIndex(()=>[ref]);
  const target:any={chunkSize:16,chunkX:Math.floor(bounds.minX/16),chunkZ:Math.floor(bounds.minZ/16),paletteByBlockTypeId:new Map([["lod2_exterior_wall",1]])};
  assert.equal(index.query(registry,target).length,1);
  index.query(registry,target);assert.equal(index.getBuildCount(),1);
});

test("contour edits never merge deleted roof triangles into a surviving neighbouring roof", () => {
  const base=fixture("berlin-lod2-discovery").flatMap((c:any)=>c.objectRefs).find((r:any)=>r.metadata.lod2BuildingId==="DEBE01AL3r50000q");
  const refs=base.metadata.roofCalculation.geometry.faces.map((face:any,index:number)=>{
    const ref=structuredClone(base);ref.objectInstanceId=`original-${index}`;
    ref.footprint.coordinates=[face.polygon_3d_mm.map(([x,z]:number[])=>[x!/1000,z!/1000])];
    ref.metadata.roofCalculation.geometry.faces=[face];
    if(index===0){ref.objectTypeId="building_facade_source";ref.metadata.lod2FacadeSource={originalRoofObjectInstanceId:"original-0"};}
    return ref;
  });
  const contour=contourBuildingFromLod2(refs)!, changed=structuredClone(contour.footprint) as any;
  changed.coordinates[0][0][0][0]+=.35;
  const roofs=contourBuildingRoofs(contour,changed,0);
  assert.ok(roofs.some(roof=>roof.facadeSource));assert.ok(roofs.some(roof=>!roof.facadeSource));
  const deleted=refs[0].metadata.roofCalculation.geometry.faces[0].polygon_3d_mm.map(([x,z]:number[])=>[x!/1000,z!/1000]);
  for(const roof of roofs.filter(roof=>!roof.facadeSource))for(const face of (roof.calculation.geometry as any).faces){
    const p=face.polygon_3d_mm.reduce((sum:number[],v:number[])=>[sum[0]!+v[0]!/3000,sum[1]!+v[1]!/3000],[0,0]);
    const sides=deleted.map((a:number[],i:number)=>{const b=deleted[(i+1)%3];return(b[0]-a[0]!)*(p[1]-a[1]!)-(b[1]-a[1]!)*(p[0]-a[0]!);});
    assert.ok(!(sides.every((v:number)=>v>1e-6)||sides.every((v:number)=>v< -1e-6)),"deleted roof reappeared during contour adaptation");
  }
});
