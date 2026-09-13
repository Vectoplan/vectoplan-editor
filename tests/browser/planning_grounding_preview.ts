import * as THREE from 'three';
import { createWorldEditController } from '../../src/frontend/world_edit/world_edit_controller';

// Production generation, real CAD, loopback plan export. This fixture never
// sends a command to the Chunk service or changes a saved user object.
type Data=Record<string,any>;
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
document.body.innerHTML='<style>[hidden]{display:none!important}body{font:14px system-ui}#audit{position:relative;width:1100px;min-height:800px}pre{white-space:pre-wrap}.editor-world-edit{display:none}</style><main id="audit"><button id="run">Bodenanpassungen vorbereiten</button><pre id="result">Bereit – ausschließlich Planexport, keine Projektänderung</pre></main>';
const root=document.querySelector<HTMLElement>('#audit')!,output=document.querySelector('#result')!;
const originalFetch=window.fetch.bind(window),receiver='http://127.0.0.1:5113';
const assert=(value:unknown,message:string)=>{if(!value)throw new Error(message);};
let current:Data,handler:(intent:Data)=>Promise<unknown>;
window.fetch=async(input,init)=>{
  const url=String(input);
  if(url.includes('/ground-fixture/planning-buildings/')) return new Response(JSON.stringify({ok:true,parentRef:current}));
  if(url.includes('/ground-fixture/commands/')) return new Response(JSON.stringify({ok:true,commandStatus:'applied',dirtyChunks:[]}));
  return originalFetch(input,init);
};
async function waitFor(check:()=>boolean):Promise<void>{for(let i=0;i<2400;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,25));}throw new Error(`Zeitüberschreitung: ${root.querySelector('[data-world-edit-status]')?.textContent}`);}
document.querySelector('#run')!.addEventListener('click',async()=>{
  (document.querySelector('#run') as HTMLButtonElement).disabled=true;
  try{
    const inputs=await(await originalFetch(`${receiver}/input`)).json();
    const results:Data[]=[];
    for(const record of inputs){
      current=clone(record.parent);
      current.objectTypeId='planning_build_area';
      const source=clone(current),baseline=record.terrain.baselineY;
      current.metadata.baseY=baseline;
      current.metadata.pathBrush.points=current.metadata.pathBrush.points.map((point:Data)=>({...point,y:baseline}));
      current.footprint.baseY=baseline;current.anchor.y=Math.floor(baseline);
      const scene=new THREE.Scene(),group=new THREE.Group();
      group.userData={semanticPlanningBuildArea:true,semanticObjectRef:current};scene.add(group);
      const points=current.metadata.pathBrush.points;
      const target={x:(points[0].x+points[1].x)/2,y:baseline,z:(points[0].z+points[1].z)/2};
      const camera=new THREE.PerspectiveCamera(45,1.5,.1,2000);
      camera.position.set(target.x,80,target.z-70);camera.lookAt(target.x,baseline,target.z);camera.updateMatrixWorld(true);
      const input=new Proxy({}, {get:()=>()=>Promise.resolve()});
      let exported=false;
      const runtime=new Proxy({getScene:()=>scene,getCamera:()=>camera,getWorkspaceMode:()=>'planning',getRenderer:()=>null,
        getSelectedLibraryPlacement:()=>({valid:false}),getInputController:()=>input,getTargetCells:()=>({}),
        setWorldEditIntentHandler:(next:typeof handler)=>{handler=next;},reloadDirtyChunks:async()=>{}},
        {get:(object,key)=>key in object?(object as any)[key]:()=>null});
      const send=async(payload:Data)=>{
        assert(payload.type==='ObjectBatch','Unerwarteter Mutationspfad');
        const parent=payload.commands.find((child:Data)=>child.objectTypeId==='planning_build_area');
        assert(parent.objectInstanceId===source.objectInstanceId,'Keeper-ID verändert');
        assert(parent.metadata.storeyCount===source.metadata.storeyCount,'Geschosszahl verändert');
        assert(parent.metadata.wallBlockTypeId===source.metadata.wallBlockTypeId,'Wandmaterial verändert');
        assert(parent.metadata.buildingProgram.roof.type===source.metadata.buildingProgram.roof.type,'Dachform verändert');
        for(const key of ['pitchDegrees','overhangMillimeters']) assert(parent.metadata.buildingProgram.roof[key]===source.metadata.buildingProgram.roof[key],`Dachparameter ${key} verändert`);
        const oldScopes=source.metadata.storeyProfile?.heightProfile?.boundariesByScope??{
          all:Array.from({length:source.metadata.storeyCount+1},(_,i)=>i*source.metadata.storeyHeightMeters)};
        const newScopes=parent.metadata.storeyProfile.heightProfile.boundariesByScope;
        for(const [scope,values] of Object.entries(oldScopes)) assert((values as number[]).length===newScopes[scope]?.length
          && (values as number[]).every((height,i)=>Math.abs(height-newScopes[scope][i])<1e-6),'Einzelgeschossgrenzen verändert');
        assert(JSON.stringify(parent.metadata.pathBrush.points.map(({x,z}:Data)=>[x,z]))===JSON.stringify(source.metadata.pathBrush.points.map(({x,z}:Data)=>[x,z])),'Kontur verändert');
        const cells=payload.commands.flatMap((child:Data)=>child.metadata?.constructionCells??[]);
        assert(Math.abs(Math.min(...cells.map((cell:Data)=>cell.minimumY))-baseline)<1e-6,'Prismen haben nicht die DGM-Basis');
        assert(cells.every((cell:Data)=>[cell.x,cell.y,cell.z].every(Number.isInteger)),'Zellrouting nicht ganzzahlig');
        const saved=await originalFetch(`${receiver}/plan`,{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({sourceSha256:record.parentSha256,terrain:record.terrain,payload})});
        const receipt=await saved.json();assert(receipt.ok,'Planempfänger: '+JSON.stringify(receipt));
        results.push({parent:source.objectInstanceId,count:parent.metadata.storeyCount,roof:parent.metadata.buildingProgram.roof.type,
          oldBaseY:source.metadata.baseY??source.anchor.y,newBaseY:baseline,...receipt});
        exported=true;return {ok:true,dirtyChunks:[]};
      };
      const controller=createWorldEditController({root,bootstrap:{runtime:{chunk:{projectId:'ground-fixture',worldId:'ground-fixture',apiBaseUrl:'/ground-fixture',routeHints:{commands:'/ground-fixture/commands'}}}},
        sceneRuntime:runtime,worldRuntime:{getRegistry:()=>({getSnapshot:()=>({entries:[]}),markChunksDirty:()=>{}}),getSource:()=>({sendCommand:send})},
        logger:{warn:(...args:unknown[])=>{root.dataset.warning=JSON.stringify(args);},debug:()=>{}}}as any);
      controller.activate('room');
      const ndc=new THREE.Vector3(target.x,target.y,target.z).project(camera);root.dataset.editorPlanningCursorX=String(ndc.x);root.dataset.editorPlanningCursorY=String(ndc.y);
      await handler({action:'primary',targetPoint:target,position:{x:Math.floor(target.x),y:Math.floor(target.y),z:Math.floor(target.z)}});
      await handler({action:'primary-release'});
      await waitFor(()=>root.querySelector<HTMLInputElement>('[data-line-brush-storey-count]')?.value===String(source.metadata.storeyCount));
      await waitFor(()=>root.querySelector('[data-world-edit-status]')?.getAttribute('data-kind')!=='busy');
      root.querySelector<HTMLButtonElement>('[data-line-brush-generate]')!.click();
      await waitFor(()=>exported);await waitFor(()=>root.querySelector('[data-world-edit-status]')?.getAttribute('data-kind')!=='busy');
      controller.destroy();
      output.textContent=JSON.stringify(results,null,2);
    }
    root.dataset.result='pass';output.textContent+='\nPASS – beide Pläne lokal exportiert, keine Projektänderung';
  }catch(error){root.dataset.result='fail';output.textContent+='\nFAIL '+(error instanceof Error?error.stack:String(error))+'\n'+(root.dataset.warning??'');}
});
