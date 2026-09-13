import * as THREE from "three";
import { scaleSceneEditAction, reachableBuildingActionPosition, sceneEditActionTexture } from "../shared/scene_edit_actions";
import { STANDARD_STOREY_HEIGHT_METERS } from "./building_programs";

export interface LineBrushBuildingEditRef {
  readonly objectInstanceId: string;
  readonly anchor: { readonly x: number; readonly y: number; readonly z: number };
  readonly footprint: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface LineBrushBuildingEditVisuals {
  update(scene: THREE.Scene, active: boolean, selectedId?: string | null, additional?: readonly LineBrushBuildingEditRef[], camera?: THREE.Camera | null, viewportHeight?: number): void;
  pick(raycaster: THREE.Raycaster): LineBrushBuildingEditRef | null;
  pickAction(raycaster: THREE.Raycaster): { ref: LineBrushBuildingEditRef; action: "settings" | "delete" } | null;
  dispose(): void;
}

type Drawable = THREE.Mesh | THREE.Line;
type Materials = THREE.Material | THREE.Material[];
interface MaterialBinding { readonly original: Materials; readonly editing: Materials }
interface BuildingRecord { ref: LineBrushBuildingEditRef; readonly bounds: THREE.Box3 }
interface GearRecord { readonly sprite: THREE.Sprite; readonly remove: THREE.Sprite; ref: LineBrushBuildingEditRef }

const EDIT_COLOR = 0x3ba7e8;
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function parentRef(object: THREE.Object3D): LineBrushBuildingEditRef | null {
  const ref = record(object.userData.semanticObjectRef);
  if (ref.objectTypeId !== "planning_build_area" || typeof ref.objectInstanceId !== "string") return null;
  const metadata = record(ref.metadata);
  if (metadata.schemaVersion !== "vectoplan-planning-build-area.v1") return null;
  const anchor = record(ref.anchor);
  if (![anchor.x, anchor.y, anchor.z].every((value) => typeof value === "number" && Number.isFinite(value))) return null;
  return { objectInstanceId: ref.objectInstanceId, anchor: anchor as LineBrushBuildingEditRef["anchor"],
    footprint: record(ref.footprint), metadata };
}
function generatedAreaId(object: THREE.Object3D): string | null {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    const metadata = record(record(current.userData.semanticObjectRef).metadata);
    if (typeof metadata.generatedFromAreaId === "string") return metadata.generatedFromAreaId;
  }
  return null;
}
function editingMaterial(original: THREE.Material): THREE.Material {
  const material = original.clone();
  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
  material.depthTest = true;
  material.alphaTest = 0;
  const surface = material as THREE.Material & { color?: THREE.Color; map?: THREE.Texture | null; alphaMap?: THREE.Texture | null };
  surface.color?.set(EDIT_COLOR);
  // Keep relief/normal maps and lighting, but material color/alpha textures
  // must not turn a blue editing surface brown or make it see-through.
  if ("map" in surface) surface.map = null;
  if ("alphaMap" in surface) surface.alphaMap = null;
  material.needsUpdate = true;
  return material;
}
function materialList(value: Materials): THREE.Material[] { return Array.isArray(value) ? value : [value]; }

/** Reversible scene decoration only: never mutate or dispose persisted materials/textures. */
export function createLineBrushBuildingEditVisuals(): LineBrushBuildingEditVisuals {
  const bindings = new Map<Drawable, MaterialBinding>();
  const gears = new Map<string, GearRecord>();
  const group = new THREE.Group();
  group.name = "vectoplan_world_edit_line_brush_building_settings";
  let texture: THREE.Texture | null = null;
  let deleteTexture: THREE.Texture | null = null;
  let disposed = false;

  function restore(object: Drawable, binding: MaterialBinding): void {
    // Respect an independent mesh/material replacement that happened during streaming.
    if (object.material === binding.editing) object.material = binding.original;
    materialList(binding.editing).forEach((material) => material.dispose());
    bindings.delete(object);
  }
  function removeGear(id: string, gear: GearRecord): void {
    group.remove(gear.sprite, gear.remove);
    gear.sprite.material.dispose(); gear.remove.material.dispose();
    gears.delete(id);
  }
  function clear(): void {
    for (const [object, binding] of bindings) restore(object, binding);
    for (const [id, gear] of gears) removeGear(id, gear);
    group.removeFromParent();
  }

  return {
    update(scene, active, selectedId, additional = [], camera, viewportHeight = 800) {
      if (disposed) return;
      if (!active) { clear(); return; }
      const buildings = new Map<string, BuildingRecord>();
      const areaByLod2Id = new Map(additional.map(ref => [record(record(ref.metadata.contourBuilding).source).buildingId, ref.objectInstanceId]));
      for (const ref of additional) if (ref.objectInstanceId !== selectedId) {
        const bounds = new THREE.Box3();
        const coordinates = record(record(ref.metadata.contourBuilding).footprint).coordinates;
        const contour = record(ref.metadata.contourBuilding);
        const topY = Number(record(contour.source).originalEavesY)
          || Number(contour.baseY ?? ref.metadata.baseY ?? ref.anchor.y) + Number(ref.metadata.storeyCount ?? 1) * STANDARD_STOREY_HEIGHT_METERS;
        for (const point of Array.isArray(coordinates) ? coordinates.flat(2) : []) {
          if (Array.isArray(point) && point.length >= 2) bounds.expandByPoint(new THREE.Vector3(Number(point[0]),
            topY, Number(point[1])));
        }
        buildings.set(ref.objectInstanceId, { ref, bounds });
      }
      scene.traverseVisible((object) => {
        const ref = parentRef(object);
        if (ref && ref.objectInstanceId !== selectedId && !buildings.has(ref.objectInstanceId)) {
          buildings.set(ref.objectInstanceId, { ref, bounds: new THREE.Box3() });
        }
      });
      const wanted = new Set<Drawable>();
      const meshBounds = new THREE.Box3();
      scene.traverseVisible((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
        const metadata = record(record(object.userData.semanticObjectRef).metadata);
        const areaId = generatedAreaId(object) ?? areaByLod2Id.get(metadata.lod2BuildingId);
        const building = areaId ? buildings.get(areaId) : undefined;
        if (!building && !(additional.length && object.userData.lod2WallCaps)) return;
        wanted.add(object);
        object.updateWorldMatrix(true, false);
        if (building) {
          if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
          if (object.geometry.boundingBox) building.bounds.union(meshBounds.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld));
        }
        let binding = bindings.get(object);
        if (binding && object.material !== binding.editing) { restore(object, binding); binding = undefined; }
        if (!binding) {
          const original = object.material;
          const editing = Array.isArray(original) ? original.map(editingMaterial) : editingMaterial(original);
          bindings.set(object, { original, editing });
          object.material = editing;
        }
      });
      for (const [object, binding] of bindings) if (!wanted.has(object)) restore(object, binding);
      for (const [id, gear] of gears) if (!buildings.has(id)) removeGear(id, gear);
      for (const [id, building] of buildings) {
        let gear = gears.get(id);
        if (!gear) {
          texture ??= sceneEditActionTexture("settings");
          deleteTexture ??= sceneEditActionTexture("delete");
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true,
            depthTest: false, depthWrite: false, toneMapped: false }));
          sprite.name = `vectoplan_world_edit_line_brush_settings:${id}`;
          sprite.userData = { worldEditLineBrushSettings: true, worldEditPlanningBuildAreaId: id };
          sprite.scale.set(1.65, 1.65, 1);
          sprite.renderOrder = 101;
          const remove = new THREE.Sprite(new THREE.SpriteMaterial({ map: deleteTexture, transparent: true,
            depthTest: false, depthWrite: false, toneMapped: false }));
          remove.name = `vectoplan_world_edit_line_brush_delete:${id}`;
          remove.userData = { worldEditLineBrushDelete: true, worldEditPlanningBuildAreaId: id };
          remove.scale.copy(sprite.scale); remove.renderOrder = 101;
          gear = { sprite, remove, ref: building.ref };
          gears.set(id, gear);
          group.add(sprite, remove);
        }
        gear.ref = building.ref;
        if (!building.bounds.isEmpty()) {
          building.bounds.getCenter(gear.sprite.position);
          gear.sprite.position.y = building.bounds.max.y + 0.72;
        } else {
          const height = Math.max(0, Number(building.ref.metadata.storeyCount) || 0)
            * Math.max(0, Number(building.ref.metadata.storeyHeightMeters) || STANDARD_STOREY_HEIGHT_METERS);
          gear.sprite.position.set(building.ref.anchor.x, building.ref.anchor.y + height + 0.72, building.ref.anchor.z);
        }
        const footprint = record(building.ref.footprint);
        const coordinates = footprint.coordinates as number[][][][] | undefined;
        const polygons = footprint.type === "MultiPolygon" ? coordinates : coordinates ? [coordinates as unknown as number[][][]] : [];
        const baseY = Number(record(building.ref.metadata.contourBuilding).baseY ?? building.ref.metadata.baseY ?? building.ref.anchor.y);
        const anchor = camera ? reachableBuildingActionPosition(gear.sprite.position, polygons.flat(), baseY,
          building.bounds.isEmpty() ? gear.sprite.position.y : building.bounds.max.y, camera) : gear.sprite.position;
        gear.sprite.visible = gear.remove.visible = !!anchor;
        if (anchor) gear.sprite.position.copy(anchor);
        const scale = camera ? scaleSceneEditAction(gear.sprite, camera, viewportHeight) : 1.65;
        const right = camera ? new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0) : new THREE.Vector3(1, 0, 0);
        gear.remove.position.copy(gear.sprite.position).addScaledVector(right, scale * 1.05);
        gear.remove.scale.copy(gear.sprite.scale);
      }
      if (gears.size > 0) {
        if (group.parent !== scene) { group.removeFromParent(); scene.add(group); }
        group.updateMatrixWorld(true);
      } else group.removeFromParent();
    },
    pick(raycaster) {
      const action = this.pickAction(raycaster);
      return action?.action === "settings" ? action.ref : null;
    },
    pickAction(raycaster) {
      if (disposed || !group.parent || !raycaster.camera) return null;
      const hit = raycaster.intersectObjects([...gears.values()].flatMap(gear => [gear.sprite, gear.remove]).filter(sprite => sprite.visible), false)[0];
      if (!hit) return null;
      const id = hit.object.userData.worldEditPlanningBuildAreaId;
      const gear = typeof id === "string" ? gears.get(id) : null;
      return gear ? { ref: gear.ref, action: hit.object === gear.remove ? "delete" : "settings" } : null;
    },
    dispose() {
      if (disposed) return;
      clear();
      texture?.dispose(); deleteTexture?.dispose();
      texture = null;
      disposed = true;
    },
  };
}
