import * as THREE from 'three';
import { constructionCellMaterialGroups, survivingConstructionCells } from './construction_cell_rendering';
import { isVplibParametricObjectRef } from './semantic_object_rendering';
import type { RuntimeChunkContent } from '../runtime/world/chunk_content';
import type { SemanticChunkObjectRef } from './scene_runtime';
import type { ConstructionMeshWorkerBuffer, ConstructionMeshWorkerGroup } from '../render/construction_mesh_worker_models';

export interface PreparedConstructionMeshGroup {
  readonly request: ConstructionMeshWorkerGroup;
  readonly ref: SemanticChunkObjectRef;
  readonly blockTypeId: string;
}

/** Keep full semantic refs and original cell objects on the main thread. Only
 * the chunk's surviving partition cells cross the worker boundary. */
export function prepareConstructionMeshGroups(chunk: RuntimeChunkContent, refs: readonly SemanticChunkObjectRef[]): PreparedConstructionMeshGroup[] {
  const groups: PreparedConstructionMeshGroup[] = [];
  for (const ref of refs) {
    if (ref.metadata.renderProfile !== 'construction-grid' || ref.objectTypeId === 'building_roof' || isVplibParametricObjectRef(ref)) continue;
    const cells = survivingConstructionCells(ref.metadata.constructionCells, ref.occupiedCells).filter(cell =>
      Math.floor(cell.x / chunk.chunkSize) === chunk.chunkX && Math.floor(cell.y / chunk.chunkSize) === chunk.chunkY
      && Math.floor(cell.z / chunk.chunkSize) === chunk.chunkZ);
    for (const [blockTypeId, materialCells] of constructionCellMaterialGroups(cells, ref.fillBlockTypeId, Boolean(ref.metadata.lod2BuildingId))) {
      const key = ref.metadata.generatedFromAreaId ?? ref.metadata.lod2BuildingId;
      groups.push({ ref, blockTypeId, request: { id: groups.length, cells: materialCells, scale: chunk.cellSize,
        interfaceKey: typeof key === 'string' && key ? key : null } });
    }
  }
  return groups;
}

/** No triangulation, culling, normal calculation or cell copies on the UI
 * thread. Restore mining ranges against the original input objects. */
export function createConstructionMeshFromWorker(buffer: ConstructionMeshWorkerBuffer, group: PreparedConstructionMeshGroup,
  material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(buffer.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(buffer.normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(buffer.uvs, 2));
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(...buffer.bounds.slice(0, 3)), new THREE.Vector3(...buffer.bounds.slice(3, 6)));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...buffer.sphere.slice(0, 3)), buffer.sphere[3]);
  const ranges = [];
  for (let index = 0; index < buffer.ranges.length; index += 3) ranges.push({ firstTriangle: buffer.ranges[index],
    endTriangle: buffer.ranges[index + 1], cell: group.request.cells[buffer.ranges[index + 2]] });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `construction:${group.ref.objectInstanceId}:${group.blockTypeId}`;
  Object.assign(mesh.userData, { semanticObjectRef: group.ref, objectInstanceId: group.ref.objectInstanceId,
    constructionGrid: true, constructionCells: group.request.cells, constructionCellRanges: ranges,
    constructionCellCount: buffer.cellCount, removedInteriorTriangleCount: buffer.removedInteriorTriangleCount,
    removedObjectInterfaceTriangleCount: buffer.removedObjectInterfaceTriangleCount, constructionMeshingThread: 'worker' });
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
