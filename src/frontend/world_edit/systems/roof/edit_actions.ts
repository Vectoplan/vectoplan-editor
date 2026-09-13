import * as THREE from "three";
import { roofFaceTriangles } from "../../../scene/roof_calculation_rendering";
import { scaleSceneEditAction } from "../shared/scene_edit_actions";

export const ROOF_EDIT_ACTION_RANGE_METERS = 80;
export interface RoofEditAction {
  readonly id: string;
  readonly settings: THREE.Sprite;
  readonly remove?: THREE.Sprite | null;
  readonly calculation: unknown;
  readonly selected?: boolean;
}

interface Surface { readonly triangles: readonly THREE.Triangle[]; readonly bounds: THREE.Box3 }
const surfaces = new WeakMap<object, { version: string; surface: Surface }>();

function roofActionSurface(value: unknown): Surface {
  if (!value || typeof value !== "object") return { triangles: [], bounds: new THREE.Box3() };
  const calculation = value as Record<string, any>;
  const version = String(calculation.input_fingerprint ?? calculation.calculation_id ?? "");
  const cached = surfaces.get(value);
  if (cached?.version === version) return cached.surface;
  const triangles: THREE.Triangle[] = [], bounds = new THREE.Box3();
  for (const face of (calculation.geometry?.faces ?? []).slice(0, 8192)) {
    const points: THREE.Vector3[] = [];
    for (const point of (face?.polygon_3d_mm ?? []).slice(0, 2048)) {
      if (!Array.isArray(point) || point.length < 3 || !point.slice(0, 3).every(Number.isFinite)) continue;
      points.push(new THREE.Vector3(point[0] / 1000, point[2] / 1000, point[1] / 1000));
    }
    for (const triangle of roofFaceTriangles(points)) {
      triangles.push(triangle); bounds.expandByPoint(triangle.a); bounds.expandByPoint(triangle.b); bounds.expandByPoint(triangle.c);
    }
  }
  const surface = { triangles, bounds }; surfaces.set(value, { version, surface }); return surface;
}

/** Actual three-dimensional roof distance, independent of its marker/centroid. */
export function nearestRoofActionPoint(calculation: unknown, point: THREE.Vector3): { point: THREE.Vector3; distance: number } | null {
  const surface = roofActionSurface(calculation), nearest = new THREE.Vector3(), candidate = new THREE.Vector3();
  let distanceSquared = Infinity;
  for (const triangle of surface.triangles) {
    triangle.closestPointToPoint(point, candidate);
    const distance = point.distanceToSquared(candidate);
    if (distance < distanceSquared) { distanceSquared = distance; nearest.copy(candidate); }
  }
  return Number.isFinite(distanceSquared) ? { point: nearest, distance: Math.sqrt(distanceSquared) } : null;
}

function projectedAction(point: THREE.Vector3, camera: THREE.Camera): THREE.Vector3 | null {
  const projected = point.clone().project(camera);
  return projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) <= .92 && Math.abs(projected.y) <= .92 ? projected : null;
}

/** Only sprites are filtered. Roof surfaces remain selectable; selection
 * promotes that roof's own controls even beyond the normal distance limit. */
export function updateRoofEditActions(actions: readonly RoofEditAction[], camera: THREE.Camera, viewportHeight: number): void {
  camera.updateWorldMatrix(true, false);
  const eye = camera.getWorldPosition(new THREE.Vector3());
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const height = Math.max(1, viewportHeight), width = height * Math.abs(camera.projectionMatrix.elements[5]! / camera.projectionMatrix.elements[0]!);
  const candidates: Array<{ action: RoofEditAction; distance: number; x: number; y: number }> = [];
  for (const action of actions) {
    const { settings, remove } = action;
    settings.visible = false; if (remove) remove.visible = false;
    const surface = roofActionSurface(action.calculation);
    if (!action.selected && surface.bounds.distanceToPoint(eye) > ROOF_EDIT_ACTION_RANGE_METERS) continue;
    const nearest = nearestRoofActionPoint(action.calculation, eye);
    if (!action.selected && (!nearest || nearest.distance > ROOF_EDIT_ACTION_RANGE_METERS)) continue;
    const preferred = (settings.userData.actionAnchor ??= settings.position.clone()) as THREE.Vector3;
    let anchor = preferred, projected = projectedAction(anchor, camera);
    if (!projected && nearest) { anchor = nearest.point.clone().add(new THREE.Vector3(0, .72, 0)); projected = projectedAction(anchor, camera); }
    if (!projected && !action.selected) continue;
    settings.position.copy(anchor);
    const scale = scaleSceneEditAction(settings, camera, height);
    if (remove) { remove.position.copy(anchor).addScaledVector(right, scale * 1.05); remove.scale.copy(settings.scale); }
    candidates.push({ action, distance: nearest?.distance ?? Infinity, x: (projected?.x ?? 3) * width / 2, y: (projected?.y ?? 3) * height / 2 });
  }
  candidates.sort((a, b) => Number(Boolean(b.action.selected)) - Number(Boolean(a.action.selected)) || a.distance - b.distance || a.action.id.localeCompare(b.action.id));
  const shown: typeof candidates = [];
  for (const candidate of candidates) {
    // The settings/delete pair spans 90px; keep an 8px gap to other pairs.
    if (!candidate.action.selected && shown.some(other => Math.abs(candidate.x - other.x) < 98 && Math.abs(candidate.y - other.y) < 52)) continue;
    candidate.action.settings.visible = true;
    if (candidate.action.remove) candidate.action.remove.visible = true;
    shown.push(candidate);
  }
  for (const { settings, remove } of actions) { settings.updateMatrixWorld(); remove?.updateMatrixWorld(); }
}
