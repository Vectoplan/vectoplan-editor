import * as THREE from "three";
import type { RuntimeChunkContent } from "@runtime/world/chunk_content";
import { createTreeCrownGeometry, createTreeTrunkGeometry, type CrownForm } from "./tree_geometry";

export interface TreeInstance {
  readonly id: string;
  readonly objectInstanceId: string;
  readonly position: readonly [number, number, number];
  readonly heightM: number;
  readonly crownDiameterM: number;
  readonly trunkDiameterM: number;
  readonly yawRadians: number;
  readonly species: string;
  readonly appearance?: Readonly<{ crownForm: CrownForm; variation: number; crownRatio: number }>;
  readonly source: Readonly<{ treeId: string; longitude: number; latitude: number }>;
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, unknown> : {};
const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

/** Stable rotation does not change when chunks arrive in a different order. */
export function treeYawFromId(id: string): number {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296 * Math.PI * 2;
}

export function treeInstancesFromChunk(chunk: Pick<RuntimeChunkContent, "raw">): readonly TreeInstance[] {
  const contract = record(record(chunk.raw.metadata).geodataOverlays);
  if (contract.schemaVersion !== "geodata-overlays.v1") return [];
  const items = contract.items;
  const result: TreeInstance[] = [];
  for (const item of Array.isArray(items) ? items : []) {
    const overlay = record(item), geometry = record(overlay.geometry);
    if (overlay.renderMode !== "tree-instances" || geometry.type !== "TreeInstances" || geometry.dimensions !== "world-xyz") continue;
    for (const raw of Array.isArray(geometry.features) ? geometry.features : []) {
      const tree = record(raw), source = record(tree.source), position = tree.position, appearance=record(tree.appearance);
      if (typeof tree.objectInstanceId !== "string" || !/^tree_[a-f0-9]{40}$/.test(tree.objectInstanceId)
        || !Array.isArray(position) || position.length !== 3 || !position.every(v => typeof v === "number" && Number.isFinite(v))
        || typeof source.treeId !== "string" || !source.treeId || !Number.isFinite(source.longitude) || !Number.isFinite(source.latitude)) continue;
      result.push({ id: String(tree.id ?? source.treeId), objectInstanceId: tree.objectInstanceId,
        position: position as unknown as TreeInstance["position"], heightM: bounded(tree.heightM, 8, 1, 100),
        crownDiameterM: bounded(tree.crownDiameterM, 4, 0.5, 60), trunkDiameterM: bounded(tree.trunkDiameterM, 0.25, 0.08, 10),
        yawRadians: bounded(tree.yawRadians, treeYawFromId(tree.objectInstanceId), -Math.PI * 2, Math.PI * 2),
        species: typeof tree.species === "string" ? tree.species.slice(0, 160) : "Baum",
        appearance:{crownForm:['conifer','columnar'].includes(String(appearance.crownForm))?appearance.crownForm as CrownForm:'broadleaf',
          variation:bounded(appearance.variation,treeYawFromId(String(tree.objectInstanceId))/(Math.PI*2),0,1),
          crownRatio:bounded(appearance.crownRatio,.62,.4,.85)},
        source: { treeId: source.treeId, longitude: Number(source.longitude), latitude: Number(source.latitude) } });
    }
  }
  return result;
}

export interface TreeSceneHit { readonly tree: TreeInstance; readonly distance: number; readonly point: THREE.Vector3; readonly normal: THREE.Vector3 }
export function raycastTreeScene(root: THREE.Object3D | null | undefined, raycaster: THREE.Raycaster): TreeSceneHit | null {
  if (!root) return null;
  const meshes: THREE.InstancedMesh[] = [];
  root.traverseVisible(object => { if (object instanceof THREE.InstancedMesh && object.userData.treeInstances) meshes.push(object); });
  const hit = raycaster.intersectObjects(meshes, false)[0];
  const tree = hit && hit.instanceId !== undefined ? hit.object.userData.treeInstances[hit.instanceId] as TreeInstance : null;
  if (!hit || !tree) return null;
  // The tree is a single semantic object. Its anchor, not a leaf voxel, is
  // used for its removal command and persisted deletion marker.
  return { tree, distance: hit.distance, point: hit.point, normal: new THREE.Vector3(0, 1, 0) };
}

/** Two instanced draw calls per chunk-sized batch; all trees stay independently pickable. */
export function createTreeScene(parent: THREE.Object3D) {
  const group = new THREE.Group(); group.name = "vectoplan_baumkataster"; parent.add(group);
  const trunkGeometry = createTreeTrunkGeometry();
  const crownGeometries = {broadleaf:createTreeCrownGeometry('broadleaf'),conifer:createTreeCrownGeometry('conifer'),columnar:createTreeCrownGeometry('columnar')};
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x76563e, roughness: 1 });
  const crownMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .92, vertexColors: true });
  const batches = new Map<string, { signature: string; group: THREE.Group }>();
  const removed = new Set<string>();
  let lastTrees: readonly TreeInstance[] = [];
  function removeBatch(key: string): void {
    const batch = batches.get(key); if (!batch) return;
    batch.group.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    batch.group.removeFromParent(); batches.delete(key);
  }
  function sync(trees: readonly TreeInstance[]): number {
    lastTrees = trees;
    const unique = new Map(trees.filter(tree => !removed.has(tree.objectInstanceId)).map(tree => [tree.objectInstanceId, tree]));
    const byBatch = new Map<string, TreeInstance[]>();
    for (const tree of unique.values()) {
      const key = `${Math.floor(tree.position[0] / 32)}:${Math.floor(tree.position[2] / 32)}:${tree.appearance?.crownForm || 'broadleaf'}`;
      const items = byBatch.get(key) ?? []; items.push(tree); byBatch.set(key, items);
    }
    for (const key of batches.keys()) if (!byBatch.has(key)) removeBatch(key);
    for (const [key, items] of byBatch) {
      items.sort((a, b) => a.objectInstanceId.localeCompare(b.objectInstanceId));
      const signature = JSON.stringify(items);
      if (batches.get(key)?.signature === signature) continue;
      removeBatch(key);
      const batch = new THREE.Group(); batch.name = `baumkataster:${key}`;
      const trunk = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, items.length);
      const crown = new THREE.InstancedMesh(crownGeometries[items[0]!.appearance?.crownForm || 'broadleaf'], crownMaterial, items.length);
      for (const mesh of [trunk, crown]) { mesh.userData.treeInstances = items; mesh.castShadow = true; mesh.receiveShadow = true; }
      const transform = new THREE.Object3D();
      items.forEach((tree, index) => {
        const [x, y, z] = tree.position, crownHeight = tree.heightM * (tree.appearance?.crownRatio || .62), trunkHeight = tree.heightM * .58;
        transform.rotation.set(0, tree.yawRadians, 0);
        transform.position.set(x, y + trunkHeight / 2, z);
        transform.scale.set(tree.trunkDiameterM, trunkHeight, tree.trunkDiameterM); transform.updateMatrix(); trunk.setMatrixAt(index, transform.matrix);
        transform.position.set(x, y + tree.heightM - crownHeight / 2, z);
        transform.scale.set(tree.crownDiameterM, crownHeight, tree.crownDiameterM); transform.updateMatrix(); crown.setMatrixAt(index, transform.matrix);
        const variation=tree.appearance?.variation ?? treeYawFromId(tree.id)/(Math.PI*2);
        crown.setColorAt(index,new THREE.Color().setHSL(.235+variation*.045,.29+variation*.12,.30+variation*.085));
      });
      for (const mesh of [trunk, crown]) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); }
      batch.add(trunk, crown); group.add(batch); batches.set(key, { signature, group: batch });
    }
    group.updateMatrixWorld(true); group.userData.treeCount = unique.size;
    return unique.size;
  }
  return {
    group, sync,
    suppress(id: string): void { removed.add(id); sync(lastTrees); },
    dispose(): void {
      for (const key of batches.keys()) removeBatch(key);
      trunkGeometry.dispose(); Object.values(crownGeometries).forEach(g=>g.dispose()); trunkMaterial.dispose(); crownMaterial.dispose(); group.removeFromParent(); removed.clear();
    },
  };
}
