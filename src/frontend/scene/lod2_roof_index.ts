import type { ChunkRegistryHandle } from '../runtime/world/chunk_registry';
import type { RuntimeChunkContent } from '../runtime/world/chunk_content';
import type { SemanticChunkObjectRef } from './scene_runtime';

/** A narrow roof wing can carry the complete facade source of a courtyard.
 * Index every source facade column, not only that wing's roof projection. */
export function lod2ReferencePlanBounds(ref: SemanticChunkObjectRef): { minX:number; minZ:number; maxX:number; maxZ:number } {
  const source=(ref.metadata.roofParameters as any)?.importedSource;
  const points:number[][]=[];
  const collect=(value:unknown):void=>{
    if(!Array.isArray(value))return;
    if(value.length>=2 && value.every(item=>typeof item==='number' && Number.isFinite(item)))points.push(value as number[]);
    else value.forEach(collect);
  };
  collect(ref.footprint?.coordinates);
  collect(source?.groundFootprints?.coordinates ?? source?.groundFootprints);
  for(const facade of source?.facadeSegments??[]){collect(facade.start);collect(facade.end);}
  return {minX:points.length?Math.min(...points.map(p=>p[0]!)):ref.anchor.x,
    minZ:points.length?Math.min(...points.map(p=>p[1]!)):ref.anchor.z,
    maxX:points.length?Math.max(...points.map(p=>p[0]!)):ref.anchor.x+ref.dimensions.x,
    maxZ:points.length?Math.max(...points.map(p=>p[1]!)):ref.anchor.z+ref.dimensions.z};
}

/** One spatial rebuild per content revision, instead of N full registry scans.
 * Store raw refs, resolving optimistic calculation overrides at query time.
 */
export function createLod2RoofIndex(readRefs:(chunk:RuntimeChunkContent)=>readonly SemanticChunkObjectRef[]) {
  let revision=-1;
  let owner:ChunkRegistryHandle|null=null;
  let builds=0;
  const columns=new Map<string,{ref:SemanticChunkObjectRef;revision:RuntimeChunkContent['chunkRevision']}[]>();
  return {
    query(registry:ChunkRegistryHandle,chunk:RuntimeChunkContent) {
      if(!chunk.paletteByBlockTypeId.has('lod2_exterior_wall'))return [];
      const next=registry.getContentRevision();
      if(owner!==registry || revision!==next) {
        owner=registry;revision=next;columns.clear();builds++;
        const authoritative=new Map<string,{ref:SemanticChunkObjectRef;chunk:RuntimeChunkContent}>();
        for(const key of registry.getChunkKeys()) {
          const other=registry.getChunk(key);
          if(!other?.raw.objectRefs.length)continue;
          for(const ref of readRefs(other)) {
            if(!['building_roof','building_facade_source'].includes(ref.objectTypeId) || !ref.metadata.lod2BuildingId)continue;
            if(!authoritative.has(ref.objectInstanceId) || ref.primaryChunkKey===other.chunkKey)
              authoritative.set(ref.objectInstanceId,{ref,chunk:other});
          }
        }
        for(const {ref,chunk:other} of authoritative.values()) {
            const size=other.chunkSize;
            const {minX,minZ,maxX,maxZ}=lod2ReferencePlanBounds(ref);
            const x0=Math.floor(minX/size),z0=Math.floor(minZ/size),x1=Math.floor(maxX/size),z1=Math.floor(maxZ/size);
            if(![x0,x1,z0,z1].every(Number.isFinite) || (x1-x0+1)*(z1-z0+1)>4096)continue;
            for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++) {
              const column=`${size}:${x}:${z}`,items=columns.get(column)??[];
              items.push({ref,revision:other.chunkRevision});columns.set(column,items);
            }
        }
      }
      return columns.get(`${chunk.chunkSize}:${chunk.chunkX}:${chunk.chunkZ}`)??[];
    },
    getBuildCount:()=>builds,
  };
}
