import * as THREE from 'three';
import { createWorldEditController } from '../../src/frontend/world_edit/world_edit_controller';
import { createConstructionCellMesh } from '../../src/frontend/scene/construction_cell_rendering';
import { createRoofCalculationMeshes } from '../../src/frontend/scene/roof_calculation_rendering';

// Actual captured Berlin parent and generations; isolated transport, no project writes.
type Data = Record<string, any>;
document.body.innerHTML='<style>[hidden]{display:none!important}body{font:14px system-ui}#audit{position:relative;width:1100px;min-height:800px}pre{white-space:pre-wrap}.editor-world-edit{display:none}</style><main id="audit"><button id="run">Persistenz-Regression starten</button><pre id="result">Bereit</pre></main>';
const root=document.querySelector<HTMLElement>('#audit')!,output=document.querySelector('#result')!;
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
const scene=new THREE.Scene(),rendered=new THREE.Group();scene.add(rendered);
const camera=new THREE.PerspectiveCamera(45,1.5,.1,2000);camera.position.set(-10,70,-100);camera.lookAt(-15,2,-70);camera.updateMatrixWorld(true);
const stored=new Map<string,Data>(),posts:Data[]=[],receipts=new Map<string,Data>();
let handler:(intent:Data)=>Promise<unknown>,controller:ReturnType<typeof createWorldEditController>,loseNext=true;
const checks:string[]=[];
const assert=(value:unknown,message:string)=>{if(!value)throw new Error(message);};
const pass=(message:string)=>{checks.push(`✓ ${message}`);output.textContent=checks.join('\n');};
const input=new Proxy({}, {get:()=>()=>Promise.resolve()});
function install():void{
  rendered.clear();
  for(const command of stored.values()){
    const group=new THREE.Group(),ref={...command,anchor:command.position};
    group.userData={semanticPlanningBuildArea:command.objectTypeId==='planning_build_area',semanticObjectRef:ref};
    if(command.metadata?.constructionCells?.length){const mesh=createConstructionCellMesh(command.metadata.constructionCells,new THREE.MeshBasicMaterial());if(mesh)group.add(mesh);}
    if(command.metadata?.roofCalculation)createRoofCalculationMeshes(command.metadata.roofCalculation).meshes.forEach(mesh=>{mesh.userData.semanticRoof=true;mesh.userData.semanticObjectRef=ref;group.add(mesh);});
    rendered.add(group);
  }
  scene.updateMatrixWorld(true);
}
async function send(payload:Data):Promise<Data>{
  posts.push(clone(payload));assert(payload.type==='ObjectBatch','Es wurde außerhalb der atomaren Generation mutiert');
  if(receipts.has(payload.commandId))return receipts.get(payload.commandId)!;
  const parent=payload.commands.find((c:Data)=>c.objectTypeId==='planning_build_area');
  const id=parent.objectInstanceId;
  for(const [key,child]of stored)if(child.metadata?.generatedFromAreaId===id)stored.delete(key);
  payload.commands.forEach((child:Data)=>stored.set(child.objectInstanceId,clone(child)));
  const receipt={ok:true,commandStatus:'applied',dirtyChunks:[]};receipts.set(payload.commandId,receipt);install();
  if(loseNext){loseNext=false;return {ok:false,error:{statusCode:504,message:'Simulierte verlorene Antwort nach Commit'}};}
  return receipt;
}
const originalFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
  const url=String(input);
  if(url.includes('/fixture/commands/'))return new Response(JSON.stringify(receipts.get(decodeURIComponent(url.split('/').at(-1)!))??{ok:true,commandStatus:'unconfirmed'}));
  if(url.includes('/fixture/planning-buildings/')){const parent=stored.get(decodeURIComponent(url.split('/').at(-1)!));return new Response(JSON.stringify({ok:true,parentRef:{...parent,anchor:parent?.position}}));}
  return originalFetch(input,init);
};
async function waitFor(check:()=>boolean,message:string):Promise<void>{for(let i=0;i<600;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,25));}throw new Error(`${message}; ${root.querySelector('[data-world-edit-status]')?.textContent}`);}
async function idle():Promise<void>{await waitFor(()=>root.querySelector('[data-world-edit-status]')?.getAttribute('data-kind')!=='busy','Controller bleibt beschäftigt');await new Promise(resolve=>setTimeout(resolve,80));}
async function point(x:number,y:number,z:number):Promise<void>{
  const ndc=new THREE.Vector3(x,y,z).project(camera);root.dataset.editorPlanningCursorX=String(ndc.x);root.dataset.editorPlanningCursorY=String(ndc.y);
  await handler({action:'primary',targetPoint:{x,y,z},position:{x:Math.floor(x),y:Math.floor(y),z:Math.floor(z)}});
  await handler({action:'primary-release'});
}
function click(selector:string):void{root.querySelector<HTMLButtonElement>(selector)!.click();}
function change(selector:string,value:string):void{const field=root.querySelector<HTMLInputElement>(selector)!;field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));}
document.querySelector('#run')!.addEventListener('click',async()=>{
  try{
    const source=await(await originalFetch('/static/qa/berlin-planning-fixture.json')).json();
    source.sort((a:Data,b:Data)=>a.id-b.id);
    assert(source[0].id===951&&source[0].request.commands.at(-1).metadata.storeyCount===4,'Historische Ausgangsgeneration951fehlt');
    for(const command of source[0].request.commands)stored.set(command.objectInstanceId,clone(command));
    // Include a real orphan generation whose parent was not adopted by the browser.
    for(const command of source[1].request.commands)if(command.objectTypeId!=='planning_build_area')stored.set(command.objectInstanceId,clone(command));
    install();
    const runtime=new Proxy({getScene:()=>scene,getCamera:()=>camera,getWorkspaceMode:()=>'planning',getRenderer:()=>null,
      getSelectedLibraryPlacement:()=>({valid:false}),getInputController:()=>input,getTargetCells:()=>({}),
      setWorldEditIntentHandler:(next:typeof handler)=>{handler=next;},reloadDirtyChunks:async()=>install()},
      {get:(target,key)=>key in target?(target as any)[key]:()=>null});
    controller=createWorldEditController({root,bootstrap:{runtime:{chunk:{projectId:'fixture',worldId:'fixture',apiBaseUrl:'/fixture',routeHints:{commands:'/fixture/commands'}}}},
      sceneRuntime:runtime,worldRuntime:{getRegistry:()=>({getSnapshot:()=>({entries:[]}),markChunksDirty:()=>{}}),getSource:()=>({sendCommand:send})},
      logger:{warn:(...args:unknown[])=>{root.dataset.warning=JSON.stringify(args);},debug:()=>{}}}as any);
    controller.activate('room');await point(-19,2,-70);
    await waitFor(()=>root.querySelector<HTMLInputElement>('[data-line-brush-storey-count]')!.value==='4','Aktueller Berliner Parent wird nicht ausgewählt');await idle();
    assert(root.querySelector<HTMLInputElement>('[data-line-brush-storey-count]')!.value==='4','Gespeicherte vier Geschosse nicht geladen');
    // Both clicks occur in one task: the second must not be dropped because
    // the first starts a persistence request or disables the remaining fields.
    click('[data-line-brush-storey-increase]');click('[data-line-brush-storey-increase]');
    assert(root.querySelector<HTMLInputElement>('[data-line-brush-storey-count]')!.value==='6','Zwei schnelle Panelklicks übernehmen nicht beide Geschosse');
    assert(posts.length===0,'Panel-Geschossänderungen dürfen vor Erzeugen keine Generation senden');
    assert(root.querySelector('[data-world-edit-status]')?.getAttribute('data-kind')!=='busy','Panel-Geschossänderung setzt Controller auf beschäftigt');
    assert(!root.querySelector<HTMLSelectElement>('[data-line-brush-roof-type]')!.disabled,'Panel-Geschossänderung blockiert Dachauswahl');
    change('[data-line-brush-roof-type]','flat');
    await idle();
    assert(posts.length===0,'Panel-/Dachänderung speichert vor Erzeugen asynchron');
    assert(root.querySelector<HTMLSelectElement>('[data-line-brush-roof-type]')!.value==='flat','Dachwahl nach schnellen Geschossklicks geht verloren');
    pass('Linienbrush-Panel: zweimal + und Dachwahl bleiben ohne Mutation und ohne Busy-Sperre in der lokalen Vorschau.');
    click('[data-line-brush-generate]');await waitFor(()=>posts.length===1,'Save nicht gestartet');
    assert(root.querySelector<HTMLInputElement>('[data-line-brush-storey-count]')!.value==='6','Unbestätigter Commit setzt sechs auf vier zurück');
    await waitFor(()=>root.querySelector<HTMLElement>('[data-editor-line-brush-quick-settings]')!.hidden,'Erzeugen schließt Einstellungen nicht');await idle();
    const parent=posts[0]!.commands.find((c:Data)=>c.objectTypeId==='planning_build_area');
    assert(parent.metadata.storeyCount===6,'Letzter Vorschauzustand mit sechs Geschossen nicht gespeichert');
    assert(parent.metadata.buildingProgram.roof.type==='flat','Letzte Dachwahl wird nicht mit demselben Generate gespeichert');
    assert(posts.length===1,'Verlorene Antwort erzeugt zweite Generation');
    assert([...stored.values()].filter(c=>c.objectTypeId==='planning_build_area').length===1,'Parent dupliziert');
    assert([...stored.values()].filter(c=>c.metadata?.generatedFromAreaId===parent.objectInstanceId).length===parent.metadata.generatedObjects.length,'Alte Dach-/Wandgeneration bleibt erhalten');
    pass('Realer Berliner Parent: 4→6 und Flachdach, verlorene Commit-Antwort bestätigt, nur eine Generation, Menü schließt.');
    controller.activate('room');await idle();
    await point(100,1.375,100);await point(114,1.375,100);
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    await waitFor(()=>posts.length===2,'Neues Gebäude ohne Auswahl wird nicht erzeugt');await idle();
    const second=posts[1]!.commands.find((c:Data)=>c.objectTypeId==='planning_build_area');
    assert(second.objectInstanceId!==parent.objectInstanceId,'Neues Gebäude ersetzt ausgewähltes Gebäude');
    assert(second.metadata.baseY===1.375,'Präzise Geländeoberfläche wurde gerundet/um einen Block angehoben');
    assert(Math.min(...posts[1]!.commands.flatMap((c:Data)=>c.metadata?.constructionCells??[]).map((c:Data)=>c.minimumY??c.minY??Infinity))===1.375,'Wände schweben über der gewählten Oberfläche');
    pass('Neues Gebäude ohne Auswahl; eigene ID und Wandunterkante exakt auf 1,375 m Geländeoberfläche.');
    output.textContent=checks.join('\n')+'\nPASS';root.dataset.result='pass';
  }catch(error){output.textContent=checks.join('\n')+'\nFAIL '+(error instanceof Error?error.stack:String(error))+'\n'+(root.dataset.warning??'');root.dataset.result='fail';}
});
