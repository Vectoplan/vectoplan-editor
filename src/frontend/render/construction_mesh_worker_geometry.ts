import * as THREE from 'three';
import { createConstructionCellMesh, removeConstructionMeshInterfaces } from '../scene/construction_cell_rendering';
import type { ConstructionMeshWorkerBuffer, ConstructionMeshWorkerGroup } from './construction_mesh_worker_models';

/** CPU geometry only: this runs in the existing chunk worker without a renderer,
 * DOM, textures or library materials. Reuse the synchronous mesher so preview,
 * persisted geometry, interface culling and mining use exactly the same rules. */
export function buildConstructionMeshBuffers(groups: readonly ConstructionMeshWorkerGroup[]): ConstructionMeshWorkerBuffer[] {
  if (!groups.length) return [];
  const placeholder = new THREE.MeshBasicMaterial();
  const built: Array<{ group: ConstructionMeshWorkerGroup; mesh: THREE.Mesh }> = [];
  try {
    for (const group of groups) {
      const mesh = createConstructionCellMesh(group.cells, placeholder, group.scale);
      if (!mesh) continue;
      mesh.userData.semanticObjectRef = { metadata: { generatedFromAreaId: group.interfaceKey } };
      built.push({ group, mesh });
    }
    removeConstructionMeshInterfaces(built.map(({ mesh }) => mesh));
    return built.map(({ group, mesh }): ConstructionMeshWorkerBuffer => {
      const geometry = mesh.geometry;
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox!, sphere = geometry.boundingSphere!;
      const cellIndices = new Map(group.cells.map((cell, index) => [cell, index]));
      const sourceRanges = mesh.userData.constructionCellRanges as Array<{ firstTriangle: number; endTriangle: number; cell: ConstructionMeshWorkerGroup['cells'][number] }>;
      const ranges = new Uint32Array(sourceRanges.length * 3);
      sourceRanges.forEach((range, index) => {
        ranges.set([range.firstTriangle, range.endTriangle, cellIndices.get(range.cell)!], index * 3);
      });
      return { id: group.id,
        positions: geometry.getAttribute('position').array as Float32Array,
        normals: geometry.getAttribute('normal').array as Float32Array,
        uvs: geometry.getAttribute('uv').array as Float32Array,
        ranges, cellCount: mesh.userData.constructionCellCount,
        removedInteriorTriangleCount: mesh.userData.removedInteriorTriangleCount ?? 0,
        removedObjectInterfaceTriangleCount: mesh.userData.removedObjectInterfaceTriangleCount ?? 0,
        bounds: [bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z],
        sphere: [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius] };
    });
  } finally {
    for (const { mesh } of built) mesh.geometry.dispose();
    placeholder.dispose();
  }
}

export function constructionMeshTransfers(buffers: readonly ConstructionMeshWorkerBuffer[]): ArrayBuffer[] {
  return buffers.flatMap(buffer => [buffer.positions.buffer, buffer.normals.buffer, buffer.uvs.buffer, buffer.ranges.buffer] as ArrayBuffer[]);
}
