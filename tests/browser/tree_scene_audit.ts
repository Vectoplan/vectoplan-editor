import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createTreeScene, treeInstancesFromChunk, raycastTreeScene, type TreeInstance } from '../../src/frontend/render/tree_scene';

document.body.style.cssText='margin:0;font:14px system-ui;background:#e9eef3';
document.body.innerHTML=`<main id="host" style="height:100vh;position:relative"><aside style="position:absolute;left:20px;top:20px;padding:20px;background:#fffef8;border-radius:12px;box-shadow:0 4px 20px #0002;z-index:2;max-width:370px"><strong>Baumkataster · Darstellungsprüfung</strong><p id="status">Prüfung läuft …</p><button id="remove">Linken Baum vollständig entfernen</button> <button id="resync">Quelldaten erneut laden</button><p id="result"></p><small>Zwei Testpunkte auf geneigtem Gelände.<br>Isolierte Prüfung ohne Änderung an Nutzerprojekten.</small></aside></main>`;
const host=document.querySelector<HTMLElement>('#host')!,status=document.querySelector<HTMLElement>('#status')!,result=document.querySelector<HTMLElement>('#result')!;
const scene=new THREE.Scene();scene.background=new THREE.Color('#e9eef3');
const camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,500);camera.position.set(24,19,28);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;
host.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xcfe6ff,0x635543,2.5));
const sun=new THREE.DirectionalLight(0xfff5d6,3);sun.position.set(-12,25,16);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:1,far:70});sun.shadow.bias=-.0002;scene.add(sun);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,4,0);controls.maxPolarAngle=Math.PI*.48;controls.update();
const groundY=(x:number,z:number)=>1+.16*x+.08*z;
const geometry=new THREE.BufferGeometry();
geometry.setAttribute('position',new THREE.Float32BufferAttribute([[-12,-10],[-12,10],[12,10],[12,-10]].flatMap(([x,z])=>[x!,groundY(x!,z!),z!]),3));
geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
const ground=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xbbc598,roughness:1}));ground.receiveShadow=true;scene.add(ground);
const lines:number[]=[];
for(let i=-10;i<=10;i+=2){lines.push(i,groundY(i,-10)+.01,-10,i,groundY(i,10)+.01,10);lines.push(-12,groundY(-12,i)+.01,i,12,groundY(12,i)+.01,i);}
const gridGeometry=new THREE.BufferGeometry();gridGeometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
scene.add(new THREE.LineSegments(gridGeometry,new THREE.LineBasicMaterial({color:0x87926f,transparent:true,opacity:.25})));
const sourceTrees=[
  {id:'fixture-left',objectInstanceId:`tree_${'a'.repeat(40)}`,position:[-4,groundY(-4,0),0],heightM:8,crownDiameterM:5,trunkDiameterM:.38,yawRadians:.37,species:'Linde',source:{treeId:'fixture-left',longitude:13.405,latitude:52.52}},
  {id:'fixture-right',objectInstanceId:`tree_${'b'.repeat(40)}`,position:[5,groundY(5,-2),-2],heightM:11,crownDiameterM:6,trunkDiameterM:.46,yawRadians:1.41,species:'Ahorn',source:{treeId:'fixture-right',longitude:13.4051,latitude:52.5201}},
];
const chunk={raw:{metadata:{geodataOverlays:{schemaVersion:'geodata-overlays.v1',items:[{id:'baumkataster',datasetId:'baumkataster',renderMode:'tree-instances',geometry:{type:'TreeInstances',dimensions:'world-xyz',features:sourceTrees}}]}}}} as Parameters<typeof treeInstancesFromChunk>[0];
const trees=createTreeScene(scene),points=treeInstancesFromChunk(chunk);
const assert=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
const hitAt=(tree:TreeInstance,height:number)=>raycastTreeScene(trees.group,new THREE.Raycaster(new THREE.Vector3(tree.position[0],tree.position[1]+height,tree.position[2]+15),new THREE.Vector3(0,0,-1),0,30));
function report(){status.textContent=`${trees.group.userData.treeCount} sichtbare Bäume · Stamm und Krone als ganzes Objekt treffbar`;}
try{
  assert(points.length===2,'Punktvertrag nicht gelesen');
  assert(trees.sync([...points,...points])===2,'Doppelte Instanzen bei Chunküberlappung');
  for(const point of points){
    assert(hitAt(point,.8)?.tree.objectInstanceId===point.objectInstanceId,'Stammtreffer fehlt');
    assert(hitAt(point,point.heightM*.72)?.tree.objectInstanceId===point.objectInstanceId,'Kronentreffer fehlt');
    assert(Math.abs(point.position[1]-groundY(point.position[0],point.position[2]))<1e-6,'Baum schwebt über Gelände');
  }
  const meshes:THREE.InstancedMesh[]=[];trees.group.traverse(object=>{if(object instanceof THREE.InstancedMesh)meshes.push(object);});
  assert(meshes.length===4,'Je32m-Gruppe werden zwei InstancedMeshes erwartet');
  assert(meshes.every(mesh=>mesh.geometry.getAttribute('position').count<250),'Baum ist nicht low-poly');
  document.documentElement.dataset.auditResult='pass';report();
}catch(error){document.documentElement.dataset.auditResult='fail';status.textContent=String(error);}
document.querySelector('#remove')!.addEventListener('click',()=>{
  const target=hitAt(points[0]!,.8);
  if(target)trees.suppress(target.tree.objectInstanceId);
  const gone=!hitAt(points[0]!,.8)&&!hitAt(points[0]!,points[0]!.heightM*.72);
  const neighbour=hitAt(points[1]!,.8)?.tree.objectInstanceId===points[1]!.objectInstanceId;
  document.documentElement.dataset.removalResult=gone&&neighbour?'pass':'fail';
  result.textContent=gone&&neighbour?'PASS: Stamm und Krone entfernt; Nachbar unverändert.':'FAIL: Abbauprüfung';report();
});
document.querySelector('#resync')!.addEventListener('click',()=>{
  const count=trees.sync(points),expected=document.documentElement.dataset.removalResult==='pass'?1:2;
  document.documentElement.dataset.resyncResult=count===expected?'pass':'fail';
  result.textContent=count===expected?'PASS: Wiederholte Quelldaten ändern den Löschzustand nicht.':'FAIL: Wiederherstellung';report();
});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
