import * as THREE from 'three';
import { GeographicPerspectiveCamera, renderGeographicScene } from '../../src/frontend/render/geographic_camera';
import { createWorldEditController } from '../../src/frontend/world_edit/world_edit_controller';
import { createConstructionCellMesh } from '../../src/frontend/scene/construction_cell_rendering';
import { createBlockMaterial } from '../../src/frontend/render/block_material';
import { createRoofCalculationMeshes } from '../../src/frontend/scene/roof_calculation_rendering';
import { createFlatRoofCalculation } from '../../src/frontend/world_edit/systems/roof/courtyard';

// Real controller, DOM controls, geographic camera and rendered/picked meshes.
// Only the chunk service and render queue are isolated; this writes no project.
// Count and height changes remain local until explicit confirmation. The
// final native captured drag is also confirmed manually, then validated.
document.body.innerHTML = `<style>
body{margin:12px;font:14px system-ui;background:#eef3f7}button{padding:8px;cursor:pointer}pre{white-space:pre-wrap}
#audit{position:relative;width:1160px;height:1000px}#view{width:1100px;height:620px;position:relative}
.editor-world-edit{display:none}.editor-storey-quick-settings{position:absolute;right:12px;top:230px;width:250px;background:#fff;border:1px solid #aac6dc;border-radius:12px;padding:12px;z-index:45;box-shadow:0 6px 24px #1233}
.editor-storey-quick-settings label{display:block;margin:10px 0}.editor-storey-quick-settings select{display:block;width:100%;padding:8px}.editor-storey-quick-settings header{display:flex;justify-content:space-between}.editor-storey-quick-settings header strong{display:block}
.editor-storey-quick-settings__counter{display:flex;justify-content:space-around;align-items:center}.editor-storey-quick-settings__counter output{display:block;text-align:center;font-weight:bold}.editor-storey-quick-settings small{display:block;font-size:11px}
[hidden]{display:none!important}#drag{padding:12px;background:#fff4cc;border:1px solid #e0be45;max-width:1060px}
</style><main id="audit"><button id="run">Geschoss-Controller-Prüfung starten</button>
<pre id="result">Bereit · zwei Gebäudeteile, Innenhof, schräges Originaldach und Nachbar</pre>
<div id="view"></div><pre id="drag" hidden></pre></main>`;
type Data = Record<string, any>;
const root = document.querySelector<HTMLElement>('#audit')!;
const output = document.querySelector<HTMLElement>('#result')!;
const dragOutput = document.querySelector<HTMLElement>('#drag')!;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xdde8ef);
scene.add(new THREE.HemisphereLight(0xffffff, 0x566274, 2));
const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(-10, 35, -10); scene.add(sun);
const ground = new THREE.GridHelper(54, 54, 0xa0aab3, 0xc6d0d8); ground.position.set(14, 2.1, 6); scene.add(ground);
const camera = new GeographicPerspectiveCamera(42, 1100 / 620, .1, 1000);
camera.position.set(30, 26, -35); camera.lookAt(14, 6, 6); camera.updateMatrixWorld(true);
const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setPixelRatio(1); renderer.setSize(1100, 620); document.querySelector('#view')!.append(renderer.domElement);
renderer.setAnimationLoop(() => renderGeographicScene(renderer, scene, camera));
const rendered = new THREE.Group(); scene.add(rendered);
const baseY = 2.15, eavesY = 7.35;
const outer = [[2.25,2.25],[10.25,2.25],[10.25,10.25],[2.25,10.25]];
const courtyard = [[5.25,5.25],[5.25,7.25],[7.25,7.25],[7.25,5.25]];
const annex = [[13.25,2.25],[19.25,2.25],[19.25,8.25],[13.25,8.25]];
const neighbour = [[23.25,2.25],[29.25,2.25],[29.25,8.25],[23.25,8.25]];
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const commands: Data[] = [], stored = new Map<string, Data>();
const checks: string[] = [];
let mode = 'planning', nativeDragArmed = false, nativeDragBefore: Data | null = null;
let nativeDragExpectedHeight = 0;
let handler: (intent: Data) => Promise<unknown>;
function roofSource(buildingId: string, id: string, rings: number[][][], footprints: number[][][][]): Data {
  const points = (ring: number[][]) => ring.map(([x,z]) => ({x:x!, y:eavesY, z:z!}));
  const calculation = createFlatRoofCalculation(points(rings[0]!), eavesY * 1000, rings.slice(1).map(points), 180) as any;
  const height = (z: number) => eavesY + (z - 2.25) * .2;
  const faces = calculation.geometry.faces.map((face: any) => ({...face,
    polygon_3d_mm: face.polygon_3d_mm.map(([x,z]: number[]) => [x,z,height(z! / 1000)*1000])}));
  calculation.geometry.faces = faces; calculation.roof_build_up.top_faces = faces;
  calculation.summary.maximum_height_mm = Math.max(...faces.flatMap((f: any) => f.polygon_3d_mm.map((p: number[]) => p[2])));
  calculation.input_fingerprint = id;
  const facadeSegments = rings.flatMap(ring => ring.map((start,i) => {
    const end = ring[(i+1)%ring.length]!;
    return {start,end,minimumY:baseY,maximumY:Math.max(height(start[1]!),height(end[1]!)),
      topProfile:[[0,height(start[1]!)],[Math.hypot(end[0]!-start[0]!,end[1]!-start[1]!),height(end[1]!)]]};
  }));
  return {type:'PlaceObject',objectTypeId:'building_roof',objectInstanceId:id,
    position:{x:Math.floor(rings[0]![0]![0]!),y:7,z:2}, footprint:{type:'Polygon',coordinates:rings,baseY:eavesY,height:1.6},
    metadata:{lod2BuildingId:buildingId,roofParameters:{roofType:'imported',pitchDeg:12,eavesHeightMm:eavesY*1000,
      importedSource:{schemaVersion:'lod2-roof-source.v1',buildingId,groundFootprints:footprints,footprint:rings,
        baseY:eavesY,faces,facadeSegments}},roofCalculation:calculation}};
}
const originals = [roofSource('audit-multi','audit-main-roof',[outer,courtyard],[[outer,courtyard],[annex]]),
  roofSource('audit-multi','audit-annex-roof',[annex],[[outer,courtyard],[annex]]),
  roofSource('audit-neighbour','audit-neighbour-roof',[neighbour],[[neighbour]])];
originals.forEach(value => stored.set(value.objectInstanceId,value));
function install(): void {
  rendered.clear();
  for (const command of stored.values()) {
    const object = new THREE.Group(), ref = {...clone(command),anchor:command.position};
    object.userData = {semanticPlanningBuildArea:command.objectTypeId==='planning_build_area',
      semanticRoof:command.objectTypeId==='building_roof',semanticObjectRef:ref};
    if (command.metadata?.constructionCells?.length) {
      const mesh = createConstructionCellMesh(command.metadata.constructionCells,
        createBlockMaterial({blockTypeId:command.runtimeBlockTypeId??command.blockTypeId}));
      if (mesh) object.add(mesh);
    }
    if (command.metadata?.roofCalculation) createRoofCalculationMeshes(command.metadata.roofCalculation).meshes.forEach(mesh => {
      mesh.userData.semanticObjectRef = ref; mesh.userData.semanticRoof = true; object.add(mesh);
    });
    if (!command.metadata?.generatedFromAreaId) for (const segment of command.metadata?.roofParameters?.importedSource?.facadeSegments??[]) {
      const [ax,az]=segment.start,[bx,bz]=segment.end,low=segment.minimumY,ay=segment.topProfile[0][1],by=segment.topProfile.at(-1)[1];
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute([ax,low,az,ax,ay,az,bx,by,bz,ax,low,az,bx,by,bz,bx,low,bz],3));
      geometry.computeVertexNormals();
      const wall = new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({color:0xd8d4c9,side:THREE.DoubleSide}));
      wall.userData.semanticObjectRef=ref; wall.userData.lod2WallCaps=true; object.add(wall);
    }
    rendered.add(object);
  }
  scene.updateMatrixWorld(true);
}
install();
async function sendCommand(payload: Data): Promise<Data> {
  commands.push(clone(payload));
  if (payload.type==='ObjectBatch') {
    const owner = payload.commands.find((command: Data) => command.objectTypeId === 'planning_build_area')?.objectInstanceId;
    for (const [id, value] of stored) if (value.metadata?.generatedFromAreaId === owner
      || payload.lod2BuildingEdit?.buildingId && value.metadata?.lod2BuildingId === payload.lod2BuildingEdit.buildingId) stored.delete(id);
    const marker={validationVersion:'lod2-building-edit.v1',buildingId:payload.lod2BuildingEdit?.buildingId,preservedCells:[]};
    for (const command of payload.commands) stored.set(command.objectInstanceId,clone(command.objectTypeId==='planning_build_area'
      ? {...command,metadata:{...command.metadata,lod2BuildingEdit:marker}}:command));
    if (nativeDragArmed) { nativeDragArmed=false; setTimeout(() => void verifyNativeDrag(payload),50); }
    return {ok:true,changed:true,lod2BuildingEdit:marker};
  }
  if (payload.type==='RemoveObject') stored.delete(payload.objectInstanceId);
  if (payload.type==='PlaceObject') stored.set(payload.objectInstanceId,clone(payload));
  return {ok:true,changed:true};
}
const input = new Proxy({}, {get:()=>()=>Promise.resolve()});
const runtime = new Proxy({getScene:()=>scene,getCamera:()=>camera,getRenderer:()=>renderer,
  getWorkspaceMode:()=>mode,setWorkspaceMode:(next:string)=>{mode=next;},getSelectedLibraryPlacement:()=>({valid:false}),
  getInputController:()=>input,getTargetCells:()=>({sourceCell:null,placementCell:null,targetPoint:null}),
  setWorldEditIntentHandler:(next:typeof handler)=>{handler=next;},reloadDirtyChunks:async()=>{install();},
  renderOnce:()=>renderGeographicScene(renderer,scene,camera),
}, {get:(target,property)=>property in target?(target as any)[property]:()=>null});
const controller=createWorldEditController({root,bootstrap:{runtime:{chunk:{projectId:'storey-audit',worldId:'storey-audit'}}},
  sceneRuntime:runtime,worldRuntime:{getRegistry:()=>({getSnapshot:()=>({entries:[]})}),getSource:()=>({sendCommand})},
  logger:{warn:(...args:unknown[])=>{root.dataset.lastWarning=JSON.stringify(args);},debug:()=>{}}} as any);
function assert(value:unknown,message:string):asserts value {if(!value)throw new Error(message);}
function pass(message:string):void {checks.push(`✓ ${message}`);output.textContent=checks.join('\n');}
const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
async function waitFor(check:()=>boolean,message:string):Promise<void>{
  for(let i=0;i<200;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,25));}
  throw new Error(`${message}; ${root.querySelector('[data-world-edit-status]')?.textContent}; ${root.dataset.lastWarning??''}`);
}
const panel=()=>root.querySelector<HTMLElement>('[data-editor-storey-quick-settings]')!;
const batches=()=>commands.filter(command=>command.type==='ObjectBatch');
const parent=(batch:Data)=>batch.commands.find((command:any)=>command.objectTypeId==='planning_build_area');
const latest=()=>batches().at(-1)!;
const profile=(batch:Data)=>parent(batch).metadata.storeyProfile.heightProfile.boundariesByScope as Record<string,number[]>;
const scope=(name:string)=>root.querySelector<SVGGElement>(`[data-storey-scope-handle="${name}"]`)!;
const closePanel=()=>root.querySelector<HTMLButtonElement>('[data-storey-close]')!.click();
async function idle():Promise<void>{await frame();await waitFor(()=>root.querySelector('[data-world-edit-status]')?.getAttribute('data-kind')!=='busy','Speichern endet nicht');}
async function clickWorld(point:THREE.Vector3,gear=false):Promise<void>{
  camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);
  const ndc=point.clone().project(camera);root.dataset.editorPlanningCursorX=String(ndc.x);root.dataset.editorPlanningCursorY=String(ndc.y);
  if(mode==='first-person'){camera.lookAt(point);camera.updateMatrixWorld(true);}
  const ray=new THREE.Raycaster();ray.setFromCamera(mode==='planning'?new THREE.Vector2(ndc.x,ndc.y):new THREE.Vector2(),camera);
  const hit=gear?null:ray.intersectObjects(rendered.children,true)[0]?.point??point;
  await handler({action:'primary',position:hit?{x:Math.floor(hit.x),y:Math.floor(hit.y),z:Math.floor(hit.z)}:null,
    targetPoint:hit,sourceCell:null,placementCell:null,trigger:'audit',createdAt:'audit'});
  await handler({action:'primary-release',position:null,targetPoint:null,sourceCell:null,placementCell:null,trigger:'audit',createdAt:'audit'});
  await idle();
}
function roofs(batch:Data):string{
  return JSON.stringify(batch.commands.filter((c:any)=>c.metadata?.roofCalculation).flatMap((c:any)=>
    c.metadata.roofCalculation.geometry.faces.map((face:any)=>face.polygon_3d_mm)).sort((a:any,b:any)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
function roofHeights(batch:Data,mainDelta:number,annexDelta:number):void{
  const contour=parent(batch).metadata.contourBuilding;
  assert(JSON.stringify(contour.footprint.coordinates[0][1])===JSON.stringify(courtyard),'Innenhofkoordinaten verloren');
  let area=0,main=0,wing=0;
  for(const command of batch.commands.filter((c:any)=>c.metadata?.roofCalculation))for(const face of command.metadata.roofCalculation.geometry.faces){
    const polygon=face.polygon_3d_mm as number[][];
    for(const [x,z,y]of polygon){
      const delta=x!<11000?mainDelta:annexDelta;
      assert(Math.abs(y!/1000-(eavesY+(z!/1000-2.25)*.2+delta))<1e-5,`Dach driftet bei ${x},${z},${y}, Δ=${delta}`);
      if(x!<11000)main++;else wing++;
    }
    area+=Math.abs(polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length]!;return sum+p[0]!*q[1]!-q[0]!*p[1]!;},0))/2e6;
  }
  assert(main>0&&wing>0,'Ein Gebäudeteil verliert sein Dach');assert(Math.abs(area-96)<1e-5,`Innenhof/Dachfläche verändert: ${area}`);
}
async function change(action:()=>void):Promise<Data>{
  const count=batches().length, selected=root.querySelector<HTMLSelectElement>('[data-storey-scope]')!.value;
  action();await frame();
  assert(batches().length===count,'Vorschau speichert vor Bestätigen');
  root.querySelector<HTMLButtonElement>('[data-storey-confirm]')!.click();
  await waitFor(()=>batches().length===count+1&&panel().hidden,'Bestätigen speichert/schließt nicht genau einmal');await idle();
  const result=latest();
  await clickWorld(new THREE.Vector3(9.5,4,2.25));
  if(selected!=='all')await selectScope(selected);
  return result;
}
async function selectScope(name:string):Promise<void>{
  await waitFor(()=>Boolean(scope(name)),'Gebäudeteil hat keine sichtbare SVG-Auswahl');
  scope(name).dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true}));await frame();
  assert(root.querySelector<HTMLSelectElement>('[data-storey-scope]')!.value===name,'SVG-Auswahl und Menübereich stimmen nicht überein');
}
async function setBoundary(index:number,height:number):Promise<Data>{
  const select=root.querySelector<HTMLSelectElement>('[data-storey-boundary]')!;
  select.value=String(index);select.dispatchEvent(new Event('change',{bubbles:true}));
  return change(()=>{const field=root.querySelector<HTMLInputElement>('[data-storey-boundary-height]')!;
    field.value=String(height);field.dispatchEvent(new Event('change',{bubbles:true}));});
}
function assertBlue(generated=false):void{
  let surfaces=0,walls=0,roofs=0;
  const bluePalette=new Set([0x3ba7e8,0x2387c4,0x94c9e8,0xa9d8ef]);
  // A selected generated building is drawn by the canonical editing preview;
  // its persisted meshes are deliberately hidden. Validate the visible body,
  // not an arbitrary mesh count (which changes with geometry batching).
  scene.traverseVisible(object=>{if(!(object instanceof THREE.Mesh))return;
    if(generated?!object.userData.lineBrushBuildingPreview
      :object.userData.semanticObjectRef?.metadata?.lod2BuildingId!=='audit-multi')return;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    assert(materials.every(material=>bluePalette.has(material.color?.getHex())&&material.opacity===1
      &&!material.transparent&&material.depthWrite),`Sichtbare Gebäudefläche ist nicht deckend blau: ${object.name}`);
    surfaces++;
    if(generated&&object.name.includes(':walls'))walls++;
    if(generated&&object.userData.lineBrushRoofPreview)roofs++;
  });
  assert(surfaces>0&&(!generated||walls>0&&roofs>0),`Sichtbare blaue Gebäudeflächen fehlen (${surfaces} Flächen, ${walls} Wände, ${roofs} Dächer)`);
}
async function waitForGeneratedRoof():Promise<void>{
  // Production debounces uncached roof preview generation by 120 ms, while
  // structure meshes and controls appear synchronously. Assert the completed
  // render state explicitly; do not infer readiness from one animation frame.
  await waitFor(()=>{
    let visibleRoof=false;
    scene.traverseVisible(object=>{if(object instanceof THREE.Mesh&&object.userData.lineBrushRoofPreview)visibleRoof=true;});
    return visibleRoof;
  },'Die asynchrone Dachvorschau wird nicht sichtbar');
}
function fail(error:unknown):void{output.textContent=`FAIL: ${String(error)}\n${checks.join('\n')}`;document.documentElement.dataset.auditResult='fail';}
async function verifyNativeDrag(batch:Data):Promise<void>{
  try{
    const before=nativeDragBefore!,old=profile(before)['segment:1']!,next=profile(batch)['segment:1']!;
    assert(Math.abs(next[1]!-old[1]!)>=.005,'Echte Mausbewegung verändert die innere Deckenlinie nicht');
    assert(Math.abs(next[1]!-nativeDragExpectedHeight)<.011,
      `Ego-Drag folgt nicht dem angeklickten Fassadenpunkt: ${next[1]} m statt ${nativeDragExpectedHeight} m`);
    assert(next.at(-1)===old.at(-1),'Innere Deckenlinie verschiebt das Dach');
    assert(JSON.stringify(profile(batch)['segment:0'])===JSON.stringify(profile(before)['segment:0']),'Innere Deckenlinie verändert anderen Gebäudeteil');
    assert(roofs(batch)===roofs(before),'Maus-Drag verändert Dachflächen');await idle();
    pass(`Echter PointerCapture-Drag: Decke ${old[1]!.toFixed(2)} → ${next[1]!.toFixed(2)} m; Nachbarteil und Dach unverändert`);
    output.textContent=`PASS\n${checks.join('\n')}`;dragOutput.textContent='Echter Maus-Drag bestanden.';document.documentElement.dataset.auditResult='pass';
  }catch(error){fail(error);}
}
document.querySelector<HTMLButtonElement>('#run')!.addEventListener('click',async event=>{
  (event.currentTarget as HTMLButtonElement).disabled=true;
  try{
    const neighbourBefore=JSON.stringify(stored.get('audit-neighbour-roof'));
    controller.activate('storey');await frame();await frame();
    assert(panel().hidden,'Werkzeugaktivierung öffnet sofort das Einstellungsmenü');assert(commands.length===0,'Werkzeugaktivierung schreibt Daten');assertBlue();
    const gears=scene.getObjectByName('vectoplan_world_edit_line_brush_building_settings')!;
    const gear=gears?.children.find(child=>String(child.userData.worldEditPlanningBuildAreaId).includes('audit-multi'));
    assert(gear,'LoD2-Gebäude hat kein Einstellungs-Sprite');await clickWorld(gear.getWorldPosition(new THREE.Vector3()),true);
    assert(!panel().hidden,'Einstellungs-Sprite öffnet kein Menü');assert(commands.length===0,'Einstellungs-Sprite konvertiert bereits');
    closePanel();await clickWorld(new THREE.Vector3(9.5,4,2.25));assert(!panel().hidden,'Blauer Gebäudekörper öffnet kein Menü');
    pass('Geografische Kamera: Aktivierung bleibt menüfrei, LoD2 deckend blau, Zahnrad und Körper öffnen Einstellungen ohne Write');
    await selectScope('segment:0');
    const added=await change(()=>root.querySelector<HTMLButtonElement>('[data-storey-add]')!.click());
    assert(profile(added)['segment:0']!.length===4&&profile(added)['segment:1']!.length===3,'+ Geschoss trifft nicht ausschließlich Teil 1');
    roofHeights(added,3,0);
    const removed=await change(()=>root.querySelector<HTMLButtonElement>('[data-storey-remove]')!.click());
    assert(profile(removed)['segment:0']!.length===3&&profile(removed)['segment:1']!.length===3,'− Geschoss verändert falschen Bereich');
    roofHeights(removed,0,0);assert(JSON.stringify(stored.get('audit-neighbour-roof'))===neighbourBefore,'Nachbargebäude wurde verändert');
    pass('SVG-Bereichsauswahl: +/− verändert genau einen Gebäudeteil, erhält Nachbarteil, Innenhof und geneigte Originaldächer');
    await selectScope('segment:1');const interior=await setBoundary(1,3.5);
    assert(profile(interior)['segment:1']![1]===3.5,'Numerische innere Geschossgrenze wird nicht übernommen');
    assert(profile(interior)['segment:1']!.at(-1)===5.2,'Innere Grenze verändert Gesamthöhe');
    assert(profile(interior)['segment:0']![1]===3,'Innere Grenze verändert anderen Teil');assert(roofs(interior)===roofs(removed),'Innere Grenze verschiebt Dach');
    const top=await setBoundary(2,6.05);roofHeights(top,0,.85);
    assert(profile(top)['segment:1']![1]===3.5,'Oberkante verschiebt untere Decke');
    pass('Variable Höhe: innere Decke 3,50 m erhält das Dach; Oberkante 6,05 m verschiebt nur das Dach des gewählten Teils um 0,85 m');
    const savedProfile=JSON.stringify(profile(top));controller.activate('selection');await idle();install();
    await waitFor(()=>!scene.getObjectByName('vectoplan_world_edit_planning_build_area'),'Gespeichertes Gebäude bleibt als Draft zurück');
    mode='first-person';controller.activate('storey');await frame();
    assert(panel().hidden,'Erneute Aktivierung in Ego öffnet Einstellungen');
    await clickWorld(new THREE.Vector3(9.5,4,2.25));assert(!panel().hidden,'Ego-Körperklick öffnet Einstellungen nicht');
    await waitForGeneratedRoof();assertBlue(true);
    await selectScope('segment:1');
    const boundary=root.querySelector<HTMLSelectElement>('[data-storey-boundary]')!;
    assert(boundary.options[0]!.text.includes('3,50')&&boundary.options[1]!.text.includes('6,05'),'Re-Select verliert variable Höhen');
    assert(JSON.stringify(profile(latest()))===savedProfile,'Re-Select verändert gespeichertes HeightProfile');
    pass('Save/Handoff und Re-Select in Ego: generierte Gebäude wieder blau, Menü erst nach Klick, HeightProfile 3,50/6,05 m erhalten');
    // The final native gesture deliberately uses an Ego close-up: the long
    // front facade crosses behind the eye. Rejecting that whole edge used to
    // remove its visible floor line; homogeneous clipping must retain it.
    mode='first-person';camera.position.set(16.25,5.65,2.0);camera.lookAt(18.25,5.65,2.25);camera.updateMatrixWorld(true);
    closePanel();await frame();await clickWorld(new THREE.Vector3(18.25,5.65,2.25));
    await selectScope('segment:1');await frame();
    // Publish every layout-changing status before reading the projected path.
    // The extra status line moves the canvas by one text line; scene handles
    // update that canvas offset on RAF. Measuring earlier gives stale Y values.
    output.textContent=`AUTOMATIK PASS · nativer Maus-Drag noch offen\n${checks.join('\n')}`;
    dragOutput.hidden=false;
    await frame();await frame();
    const line=root.querySelector<SVGPathElement>('[data-storey-boundary-handle="1"]')!;
    assert(line,'Innere SVG-Deckenlinie fehlt');
    const eyeEndpoint=new THREE.Vector3(13.25,5.65,2.25).project(camera);
    assert(eyeEndpoint.z>1||eyeEndpoint.z< -1,'Ego-Nahsicht prüft keine abgeschnittene Fassade');
    const hit=root.querySelector<SVGPathElement>('[data-storey-boundary-hit="1"]')!;
    assert(hit?.getAttribute('d')===line.getAttribute('d')&&Number(hit.getAttribute('stroke-width'))>=12,'Deckenlinie hat keinen gut treffbaren Dragbereich');
    const path=line.getAttribute('d')!;
    const match=/M([\d.-]+),([\d.-]+) L([\d.-]+),([\d.-]+)/.exec(path)!;assert(match,'Deckenlinie hat keinen projizierten Pfad');
    const rootRect=root.getBoundingClientRect();
    const x=Math.round(rootRect.left+(Number(match[1])+Number(match[3]))/2);
    const y=Math.round(rootRect.top+(Number(match[2])+Number(match[4]))/2);
    // Independently recover the clicked front-facade point with the camera ray.
    // 24 px can mean only a few centimetres in Ego; a fixed >3 cm assertion
    // incorrectly rejected valid close-up gestures and missed centroid scaling.
    const canvasRect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();
    const front=new THREE.Plane(new THREE.Vector3(0,0,1),-2.25);
    const facadeAt=(clientY:number)=>{
      ray.setFromCamera(new THREE.Vector2((x-canvasRect.left)/canvasRect.width*2-1,
        1-(clientY-canvasRect.top)/canvasRect.height*2),camera);
      return ray.ray.intersectPlane(front,new THREE.Vector3())!;
    };
    const grabbed=facadeAt(y),moved=facadeAt(y-24);
    assert(grabbed&&moved&&grabbed.x>=13.25&&grabbed.x<=19.25,'Native Probe trifft nicht die erwartete vordere Fassade');
    nativeDragExpectedHeight=Math.round((3.5+moved.y-grabbed.y)*100)/100;
    nativeDragBefore=clone(latest());nativeDragArmed=true;
    dragOutput.textContent=`Automatik bestanden. Ego-Nahsicht: sichtbarer Teil der angeschnittenen Fassade bleibt greifbar. Echte innere Deckenlinie mit linker Maus ziehen:\nStart: ${x}, ${y} → Ziel: ${x}, ${y-24}\nErwartet gemäß Kamerastrahl: ${nativeDragExpectedHeight.toFixed(2)} m. Danach im Geschossfenster Bestätigen anklicken; dann muss PASS erscheinen. Diese Probe nutzt echtes PointerCapture; keine Projektwrites.`;
    dragOutput.dataset.startX=String(x);dragOutput.dataset.startY=String(y);dragOutput.dataset.endY=String(y-24);
    document.documentElement.dataset.auditResult='awaiting-native-drag';
  }catch(error){fail(error);}
});
