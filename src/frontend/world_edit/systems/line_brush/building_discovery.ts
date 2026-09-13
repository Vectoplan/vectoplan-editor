import * as THREE from "three";

const record = (value: unknown): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};

/** Discovery must not depend on a roof's primary mesh having been rendered.
 * Ground chunks contain its source reference even when its roof chunk is far above the camera. */
export function planningObjectReferences(scene: THREE.Scene | null, chunks: readonly unknown[] = []): Record<string, any>[] {
  const refs = new Map<string, Record<string, any>>();
  const add = (value: unknown) => {
    const ref = record(value);
    if (typeof ref.objectInstanceId === "string" && ["building_roof", "building_facade_source", "planning_build_area"].includes(ref.objectTypeId)) refs.set(ref.objectInstanceId, ref);
  };
  for (const value of chunks) {
    const chunk = record(value), raw = record(chunk.raw), nested = record(raw.raw);
    const values = raw.objectRefs ?? nested.objectRefs ?? record(nested.content).objectRefs ?? chunk.objectRefs ?? record(chunk.content).objectRefs;
    if (Array.isArray(values)) values.forEach(add);
  }
  scene?.traverseVisible(object => add(object.userData.semanticObjectRef));
  return [...refs.values()];
}

/** Exact clicked facet identity, including courtyard walls. Never infer a
 * building from its bounding box or the snapped cell centre outside its wall. */
export function planningBuildingIdentityAtRay(scene: THREE.Scene | null, raycaster: THREE.Raycaster):
  { parentId?: string; lod2BuildingId?: string } | null {
  if (!scene) return null;
  const targets: THREE.Object3D[] = [];
  scene.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh) || object.userData.worldEditPolygonAreaPoint) return;
    const metadata = record(record(object.userData.semanticObjectRef).metadata);
    if (object.userData.lod2WallCaps || metadata.lod2BuildingId || metadata.generatedFromAreaId) targets.push(object);
  });
  for (const hit of raycaster.intersectObjects(targets, false)) {
    const mesh = hit.object as THREE.Mesh;
    if (mesh.userData.lod2WallCaps && hit.face) {
      const attribute = mesh.geometry.getAttribute("lod2BuildingIndex");
      const ids = mesh.geometry.userData.lod2BuildingIds;
      const id = attribute && Array.isArray(ids) ? ids[attribute.getX(hit.face.a)] : null;
      if (typeof id === "string") return { lod2BuildingId: id };
    }
    for (let object: THREE.Object3D | null = mesh; object; object = object.parent) {
      const ref = record(object.userData.semanticObjectRef), metadata = record(ref.metadata);
      if (typeof metadata.generatedFromAreaId === "string") return { parentId: metadata.generatedFromAreaId };
      if (typeof metadata.lod2BuildingId === "string") return { lod2BuildingId: metadata.lod2BuildingId };
    }
  }
  return null;
}
