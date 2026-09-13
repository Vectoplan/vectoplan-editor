import type * as THREE from 'three';

interface MeshRecord { readonly group: THREE.Group; readonly meshes: readonly THREE.Mesh[]; readonly chunkKey: string }
interface Cell { readonly x: number; readonly y: number; readonly z: number }

/** Prepared meshes are immutable between installs/visibility changes. Index
 * their mining cells once, instead of allocating a city-wide Set every pick. */
export function createSceneMeshIndex() {
  let revision = -1;
  let constructionMeshes: THREE.Mesh[] = [];
  let constructionAddresses = new Set<string>();
  let terrainMeshes: THREE.Mesh[] = [];
  return {
    read(nextRevision: number, records: Iterable<MeshRecord>, isTerrain: (key: string, mesh: THREE.Mesh) => boolean) {
      if (revision !== nextRevision) {
        revision = nextRevision;
        constructionMeshes = [];
        constructionAddresses = new Set();
        terrainMeshes = [];
        for (const record of records) for (const mesh of record.meshes) {
          if (isTerrain(record.chunkKey, mesh)) terrainMeshes.push(mesh);
          if (!record.group.visible || !mesh.visible || mesh.userData.constructionGrid !== true) continue;
          constructionMeshes.push(mesh);
          for (const cell of (mesh.userData.constructionCells ?? []) as readonly Cell[]) {
            constructionAddresses.add(`${cell.x}:${cell.y}:${cell.z}`);
          }
        }
      }
      return { constructionMeshes, constructionAddresses, terrainMeshes };
    },
  };
}
