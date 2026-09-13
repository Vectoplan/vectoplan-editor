import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCadParcelGrid,type CadParcelGridInput} from '../src/frontend/world_edit/systems/parcel_grid/cad_adapter';
import {intersectConvexParcelGridPolygons,parcelGridPolygonArea} from '../src/frontend/world_edit/systems/parcel_grid/geometry';
test('CAD retains the validated building datum and exclusions after one parcel edge changes',()=>{
  const building=[[0,0],[10,0],[10,6],[0,6]] as const;
  const grid={schemaVersion:'vectoplan-lod2-construction-grid.v1',referenceMode:'lod2-existing-building',coordinateSpace:'world-cell-xz',
    buildingId:'existing',origin:[0,0],axisU:[1,0],axisV:[0,1],widthM:10,depthM:6,columns:5,rows:3,stepU:2,stepV:2,
    rotationDegrees:0,uAnchors:[0,10],vAnchors:[0,6],fingerprint:'a'.repeat(64),
    facades:[{id:'south',start:[0,0],end:[10,0],inward:[0,1],lengthM:10,columnCount:5,columnWidthM:2},
      {id:'north',start:[10,6],end:[0,6],inward:[0,-1],lengthM:10,columnCount:5,columnWidthM:2}]};
  const input:CadParcelGridInput={parcels:[{parcelId:'p',rings:[[[-4,-4],[16,-4],[16,10],[-4,10]]]}],visiblePoints:[],
    boundarySegments:[{id:'south',parcelId:'p',start:[-4,-4],end:[16,-4],inward:[0,1],length:20,depth:2}],
    objectRefs:[{objectInstanceId:'roof',objectTypeId:'building_roof',footprint:{coordinateSpace:'world-cell-xz',type:'Polygon',coordinates:[building]},
      metadata:{lod2BuildingId:'existing',roofParameters:{importedSource:{groundFootprints:[[building]],constructionGrid:grid}}}}]};
  const first=buildCadParcelGrid(input);
  assert.equal(first.reference?.source,'persisted-construction-grid');
  assert.equal(first.reference?.stepU,2,'must not replace the validated two-metre spacing with derived one-metre cells');
  const changed=buildCadParcelGrid({...input,boundarySegments:input.boundarySegments.map(s=>({...s,depth:4}))});
  assert.deepEqual(changed.reference,first.reference);
  const facadeDepths=[{parcelId:'building:existing',start:[10,0.0000001] as const,end:[0,0] as const,depth:3}];
  const fromBuilding=buildCadParcelGrid({...input,facadeDepths});
  assert.deepEqual(fromBuilding.reference,first.reference,'extending the facade must preserve origin, axes and spacing');
  assert.deepEqual(fromBuilding.facadeGuides?.map(g=>g.depth),[3,1],'only the grabbed facade extends');
  assert.deepEqual(fromBuilding.facadeGuides?.map(g=>g.divisions),[5,5],'saved facade column counts stay authoritative');
  const facadeArea=(result:ReturnType<typeof buildCadParcelGrid>)=>result.cells
    .filter(c=>c.boundaryKind==='building-facade').reduce((sum,c)=>sum+parcelGridPolygonArea(c.polygon),0);
  assert.ok(facadeArea(fromBuilding)>facadeArea(first)+19.99,'the new outward rows must actually appear');
  const collapsed=buildCadParcelGrid({...input,facadeDepths:facadeDepths.map(g=>({...g,depth:0}))});
  assert.equal(collapsed.facadeGuides?.[0]?.depth,1,'the original wall-adjacent row stays intact');
  for(const result of [first,changed,fromBuilding,collapsed]) {
    assert.ok(Math.abs(result.coveredArea!-(280-60))<1e-5);
    assert.ok(result.cells.every(cell=>parcelGridPolygonArea(intersectConvexParcelGridPolygons(cell.polygon,building))<1e-6));
  }
});
test('holes in selected land stay outside the CAD grid',()=>{
  const result=buildCadParcelGrid({parcels:[{parcelId:'hole',rings:[[[0,0],[10,0],[10,10],[0,10]],[[4,4],[4,6],[6,6],[6,4]]]}],
    boundarySegments:[],objectRefs:[],visiblePoints:[]});
  assert.ok(Math.abs(result.coveredArea!-96)<1e-6);
});
