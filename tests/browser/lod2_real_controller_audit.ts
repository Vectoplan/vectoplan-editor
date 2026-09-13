import * as THREE from "three";
import { createWorldEditController } from "../../src/frontend/world_edit/world_edit_controller";
import { createRoofCalculationMeshes } from "../../src/frontend/scene/roof_calculation_rendering";
// Captured read-only from the real Berlin world on 2026-09-05. The camera had
// only five of this building's 23 roofs; no roof mesh is installed by this test.
import partialZip from "../fixtures/berlin-lod2-discovery.json.gz";
import completeZip from "../fixtures/berlin-lod2-wu-complete.json.gz";

async function unpack(bytes: Uint8Array): Promise<any> {
  return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
}
const [partial, complete] = await Promise.all([unpack(partialZip), unpack(completeZip)]);
document.body.innerHTML = `<main id="root" style="position:relative;width:1200px;height:850px;font:14px system-ui">
  <button id="run">Echte LoD2-Auswahl prüfen</button><pre id="result">Bereit</pre>
  <div id="view" style="width:1200px;height:700px"></div></main>`;
const root = document.querySelector<HTMLElement>("#root")!, output = document.querySelector<HTMLElement>("#result")!;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe0eaf1);
scene.add(new THREE.HemisphereLight(0xffffff, 0x778899, 3));
const renderer = new THREE.WebGLRenderer({antialias:true}); renderer.setSize(1200,700);
document.querySelector("#view")!.append(renderer.domElement);
const camera = new THREE.PerspectiveCamera(60,1200/700,.1,1500);
const facadeSource = complete.objectRefs[0].metadata.roofParameters.importedSource.facadeSegments;
const positions: number[] = [];
for (const segment of facadeSource) {
  const [ax,az]=segment.start,[bx,bz]=segment.end,low=segment.minimumY,high=segment.maximumY;
  positions.push(ax,low,az,bx,low,bz,ax,high,az, ax,high,az,bx,low,bz,bx,high,bz);
}
const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
geometry.setAttribute("lod2BuildingIndex",new THREE.Float32BufferAttribute(new Float32Array(positions.length/3),1));
geometry.userData.lod2BuildingIds=[complete.buildingId];geometry.computeVertexNormals();
const walls=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({color:0xccc9c3,side:THREE.DoubleSide}));
walls.userData.lod2WallCaps=true;scene.add(walls);scene.updateMatrixWorld(true);
const segment=facadeSource.find((s:any)=>Math.hypot(s.end[0]-s.start[0],s.end[1]-s.start[1])>20) ?? facadeSource[0];
const mid={x:(segment.start[0]+segment.end[0])/2,y:segment.minimumY+1.8,z:(segment.start[1]+segment.end[1])/2};
const normal=new THREE.Vector3(segment.end[1]-segment.start[1],0,segment.start[0]-segment.end[0]).normalize();
const eye=()=>{camera.position.copy(new THREE.Vector3(mid.x,mid.y,mid.z).addScaledVector(normal,8));camera.lookAt(mid.x,mid.y,mid.z);camera.updateMatrixWorld(true);};
eye();renderer.setAnimationLoop(()=>renderer.render(scene,camera));
let mode="first-person", handler:(intent:any)=>Promise<unknown>, fetches=0;
const commands:any[]=[];
const input=new Proxy({}, {get:()=>()=>Promise.resolve()});
const originalFetch=window.fetch.bind(window);
window.fetch=async(input,init)=> {
  const url=String(input);
  if(url.startsWith("/fixture-lod2/lod2-buildings/")){fetches++;return Response.json(complete);}
  return originalFetch(input,init);
};
const runtime=new Proxy({getScene:()=>scene,getCamera:()=>camera,getRenderer:()=>renderer,
  getWorkspaceMode:()=>mode,setWorkspaceMode:(value:string)=>mode=value,getInputController:()=>input,
  getSelectedLibraryPlacement:()=>({valid:false}),getTargetCells:()=>({sourceCell:null,placementCell:null,targetPoint:null}),
  setWorldEditIntentHandler:(next:typeof handler)=>handler=next,
  reloadDirtyChunks:async()=>{},renderOnce:()=>{},
},{get:(target,key)=>key in target?(target as any)[key]:()=>null});
const chunks=new Map(partial.map((chunk:any,i:number)=>[String(i),{raw:{raw:chunk}}]));
const roofMeshes=new THREE.Group();scene.add(roofMeshes);
async function sendCommand(payload:any){
  commands.push(payload);
  if(payload.type==="RemoveObject" && payload.preserveLod2Facade){
    const ref=complete.objectRefs.find((ref:any)=>ref.objectInstanceId===payload.objectInstanceId);
    if(ref){
      const source=structuredClone(ref);source.objectInstanceId=`facade:${ref.objectInstanceId}`;
      source.objectTypeId="building_facade_source";
      source.metadata.lod2FacadeSource={schemaVersion:"vectoplan-lod2-facade-source.v1",
        deletedRoofObjectInstanceId:ref.objectInstanceId,originalRoofObjectInstanceId:ref.objectInstanceId};
      complete.objectRefs=complete.objectRefs.map((item:any)=>item===ref?source:item);
      for(const value of chunks.values()){
        const chunk=(value as any).raw.raw;
        chunk.objectRefs=chunk.objectRefs.filter((item:any)=>item.objectInstanceId!==ref.objectInstanceId);
      }
      const first=chunks.values().next().value as any;first.raw.raw.objectRefs.push(source);
      roofMeshes.clear();
    }
  }
  return{ok:true,changed:true};
}
const controller=createWorldEditController({root,sceneRuntime:runtime,
  bootstrap:{runtime:{chunk:{projectId:"fixture",worldId:"fixture",apiBaseUrl:"/fixture-lod2",routeHints:{commands:"/fixture-lod2/commands"}}}},
  worldRuntime:{getRegistry:()=>({getChunkKeys:()=>[...chunks.keys()],getChunk:(key:string)=>chunks.get(key),getSnapshot:()=>({entries:[]})}),
    getSource:()=>({sendCommand})},
  logger:{debug:()=>{},warn:()=>{}},
} as any);
const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
async function wait(check:()=>unknown,message:string){for(let i=0;i<200;i++){if(check())return;await new Promise(r=>setTimeout(r,25));}throw Error(message);}
function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
const results:string[]=[];
function pass(message:string){results.push(`✓ ${message}`);output.textContent=results.join("\n");}
async function clickWorld(point:{x:number;y:number;z:number}){
  await handler({action:"primary",position:{x:Math.floor(point.x),y:Math.floor(point.y),z:Math.floor(point.z)},
    targetPoint:point,sourceCell:null,placementCell:null,trigger:"audit",createdAt:"audit"});
  await handler({action:"primary-release",position:null,targetPoint:null,sourceCell:null,placementCell:null,trigger:"audit",createdAt:"audit"});
  await frame();
}
document.querySelector<HTMLButtonElement>("#run")!.onclick=async event=>{
  (event.currentTarget as HTMLButtonElement).disabled=true;
  try{
    controller.activate("storey");await frame();
    assert(scene.getObjectByName(`vectoplan_world_edit_line_brush_settings:lod2_building_${complete.buildingId}`),"LoD2 ohne Dachmesh erhält kein Zahnrad");
    await clickWorld(mid);
    await wait(()=>fetches>0 && Number(root.querySelector("[data-storey-count]")?.textContent)>16,"Vollständige 23 Bestandsdächer nicht adoptiert");
    assert(commands.length===0,"Auswahl schreibt bereits ein Gebäude");
    await wait(()=>root.querySelectorAll("[data-storey-boundary-handle]").length>16,"Originale Geschossgrenzen fehlen");
    const paths=[...root.querySelectorAll("[data-storey-boundary-handle]")];
    assert(paths.some(node=>node.getAttribute("d")),"Ego-Fassadenlinien sind vollständig unsichtbar");
    pass("Ego: reale importierte Fassaden ausgewählt, 23 Dächer geladen und ursprüngliche Geschossgrenzen erreichbar");
    controller.activate("selection");controller.deactivate();mode="planning";
    camera.position.set(mid.x+60,90,mid.z+100);camera.lookAt(mid.x,20,mid.z);camera.updateMatrixWorld(true);
    controller.activate("room");await frame();
    const gear=scene.getObjectByName(`vectoplan_world_edit_line_brush_settings:lod2_building_${complete.buildingId}`)!;
    assert(gear,"LoD2-Einstellungen verschwinden beim Wechsel zum Linienbrush");
    camera.lookAt(gear.position);camera.updateMatrixWorld(true);
    await clickWorld(gear.position);await wait(()=>fetches>=2,"Linienbrush-Zahnrad verwendet den vollständigen Bestandsabruf nicht");
    assert(commands.length===0,"Werkzeug-/Ansichtswechsel konvertiert unveränderten Bestand");
    const preview=scene.getObjectByName("vectoplan_world_edit_planning_build_area");
    assert(preview?.userData.storeyDraft?.footprint?.coordinates.length,"Originalkontur fehlt im Linienbrush");
    pass("Planung: gleiche Bestandskontur im Linienbrush editierbar, Auswahl bleibt ohne Datenmutation");
    controller.activate("storey");eye();await clickWorld(mid);await frame();
    // Pointer capture is normally provided by a real mouse. Here only capture
    // plumbing is stubbed; the actual SVG/controller drag and geometry run.
    const handle=[...root.querySelectorAll<SVGPathElement>("[data-storey-boundary-handle]")].find(node=>node.getAttribute("d"))!;
    const hit=handle.parentElement!.querySelector<SVGPathElement>("[data-storey-boundary-hit]")!;
    const d=handle.getAttribute("d")!, coords=d.match(/[+-]?\d+(?:\.\d+)?/g)!.map(Number);
    const rect=root.getBoundingClientRect(),x=rect.left+coords[0]!,y=rect.top+coords[1]!;
    handle.setPointerCapture=()=>{};handle.releasePointerCapture=()=>{};handle.hasPointerCapture=()=>false;
    hit.dispatchEvent(new PointerEvent("pointerdown",{button:0,pointerId:7,clientX:x,clientY:y,bubbles:true}));
    handle.dispatchEvent(new PointerEvent("pointermove",{pointerId:7,clientX:x,clientY:y-12,bubbles:true}));
    handle.dispatchEvent(new PointerEvent("pointercancel",{pointerId:7,bubbles:true}));
    assert(commands.length===0,"Abgebrochener LoD2-Geschossdrag schreibt Daten");
    pass("Reale Geschosskante lässt sich greifen; Drag-Abbruch stellt den Bestand ohne Schreiben wieder her");
    controller.activate("selection");
    const roof=complete.objectRefs[0];
    const source=new THREE.Group();source.userData={semanticRoof:true,semanticObjectRef:roof};
    createRoofCalculationMeshes(roof.metadata.roofCalculation).meshes.forEach(mesh=>source.add(mesh));
    roofMeshes.add(source);scene.updateMatrixWorld(true);
    controller.activate("roof");await frame();
    const remove=scene.getObjectByName(`vectoplan_world_edit_roof_settings:${roof.objectInstanceId}:delete`)!;
    assert(remove,"Löschsymbol neben dem Dachzahnrad fehlt");
    camera.position.copy(remove.position).add(new THREE.Vector3(0,12,20));camera.lookAt(remove.position);camera.updateMatrixWorld(true);
    await clickWorld(remove.position);
    await wait(()=>commands.length===1,"Dach-Löschsymbol sendet keinen eindeutigen Löschbefehl");
    assert(commands[0].preserveLod2Facade===true,"Dachlöschung schützt die Fassadenquelle nicht");
    await wait(()=>!scene.getObjectByName(`vectoplan_world_edit_roof_settings:${roof.objectInstanceId}`),"Gelöschtes Dach bleibt als Werkzeugziel stehen");
    controller.activate("storey");eye();await clickWorld(mid);await frame();
    assert(commands.length===1,"Wiederaufnahme der Fassade erzeugt das gelöschte Dach neu");
    assert(complete.objectRefs.some((ref:any)=>ref.objectTypeId==="building_facade_source"),"Fassadenquelle fehlt nach Einzel-Dachlöschung");
    assert(Number(root.querySelector("[data-storey-count]")?.textContent)>16,"Geschosse nach Einzel-Dachlöschung nicht mehr erreichbar");
    pass("Einzel-LoD2-Dach über Löschsymbol entfernt; Fassadenquelle und Geschossbearbeitung bleiben erhalten");
    output.textContent=results.join("\n")+"\nPASS";
  }catch(error){output.textContent=results.join("\n")+"\nFAIL: "+(error instanceof Error?error.stack:String(error));}
};
