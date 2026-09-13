import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createSceneMeshIndex} from '../src/frontend/scene/scene_mesh_index';

test('camera picks reuse prepared cell addresses; replacing, hiding and mining meshes invalidates them', () => {
  const index=createSceneMeshIndex(), group=new THREE.Group(), mesh=new THREE.Mesh();
  mesh.userData={constructionGrid:true, constructionCells:[{x:4,y:3,z:2}]};
  const records=[{group,meshes:[mesh],chunkKey:'0:0:0'}];
  let scans=0;
  const isTerrain=()=>{scans++;return false;};
  const first=index.read(0,records,isTerrain);
  for(let frame=0;frame<120;frame++) {
    assert.equal(index.read(0,records,isTerrain).constructionAddresses,first.constructionAddresses);
  }
  assert.equal(scans,1);
  assert(first.constructionAddresses.has('4:3:2'));
  group.visible=false;
  assert.equal(index.read(1,records,isTerrain).constructionAddresses.size,0);
  group.visible=true;
  mesh.userData.constructionCells=[];
  assert.equal(index.read(2,records,isTerrain).constructionAddresses.size,0);
  assert.equal(index.read(3,[],isTerrain).constructionMeshes.length,0);
});
