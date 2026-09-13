import * as THREE from "three";

interface Point3 { readonly x: number; readonly y: number; readonly z: number }
export interface StoreyViewport { readonly left: number; readonly top: number; readonly width: number; readonly height: number }
interface Point2 { readonly x: number; readonly y: number }
export interface StoreyProjectedEdge {
  readonly points: readonly [Point2, Point2];
  readonly pixelsPerMeter: number;
  readonly distanceTo: (point: Point2) => number;
  readonly depthAt: (point: Point2) => number;
  readonly heightDeltaForDrag: (start: Point2, pixelsY: number) => number;
}

/** Front/back floor edges overlap in a horizontal Ego view. Select the nearest
 * facade in depth when the screen distances differ only by subpixel rounding. */
export function storeyDragHeightAtPoint(edges: readonly StoreyProjectedEdge[], height: number,
  start: Point2, pixelsY: number): number {
  const closest = Math.min(...edges.map(edge => edge.distanceTo(start)));
  let nearest: StoreyProjectedEdge | undefined;
  for (const edge of edges) {
    if (edge.distanceTo(start) > closest + 1) continue;
    if (!nearest || edge.depthAt(start) < nearest.depthAt(start)) nearest = edge;
  }
  return height + (nearest?.heightDeltaForDrag(start, pixelsY) ?? 0);
}

/** Clip before perspective division. Near-camera facades can span the viewport
 * even when their original endpoints are both outside it or behind the eye. */
export function projectStoreyEdge(camera: THREE.Camera, a: Point3, b: Point3, viewport: StoreyViewport): StoreyProjectedEdge | null {
  const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const start = new THREE.Vector4(a.x, a.y, a.z, 1).applyMatrix4(viewProjection);
  const end = new THREE.Vector4(b.x, b.y, b.z, 1).applyMatrix4(viewProjection);
  if (![...start.toArray(), ...end.toArray()].every(Number.isFinite)) return null;
  let from = 0, to = 1;
  // WebGL homogeneous clip planes: -w <= x,y,z <= w.
  for (const axis of ["x", "y", "z"] as const) for (const sign of [-1, 1]) {
    const first = start.w + sign * start[axis], last = end.w + sign * end[axis];
    if (first < 0 && last < 0) return null;
    if (first < 0) from = Math.max(from, first / (first - last));
    if (last < 0) to = Math.min(to, first / (first - last));
    if (from > to) return null;
  }
  const p = start.clone().lerp(end, from), q = start.clone().lerp(end, to);
  if (p.w <= 0 || q.w <= 0) return null;
  const screen = (point: THREE.Vector4): Point2 => ({
    x: viewport.left + (point.x / point.w + 1) * viewport.width / 2,
    y: viewport.top + (1 - point.y / point.w) * viewport.height / 2,
  });
  // Derivative at a visible point, not an offscreen/behind-camera centroid.
  // dy/dh = (dy_clip/dh * w - y_clip * dw/dh) / w².
  const mid = start.clone().lerp(end, (from + to) / 2), m = viewProjection.elements;
  const pixelsPerMeter = -(m[5]! * mid.w - mid.y * m[7]!) / (mid.w * mid.w) * viewport.height / 2;
  const first = screen(p), last = screen(q);
  const dx = last.x - first.x, dy = last.y - first.y;
  const screenFraction = (point: Point2) => Math.max(0, Math.min(1,
    ((point.x - first.x) * dx + (point.y - first.y) * dy) / (dx * dx + dy * dy || 1)));
  const clipAnchor = (point: Point2) => {
    const t = screenFraction(point);
    const worldT = t * p.w / (q.w * (1 - t) + p.w * t);
    return p.clone().lerp(q, worldT);
  };
  return { points: [first, last], pixelsPerMeter,
    distanceTo: (point) => {
      const t = screenFraction(point);
      return Math.hypot(point.x - first.x - t * dx, point.y - first.y - t * dy);
    },
    depthAt: (point) => clipAnchor(point).w,
    heightDeltaForDrag: (point, pixelsY) => {
      // Perspective-correct interpolation recovers the clicked facade point.
      // A building centroid can be at a completely different depth in Ego.
      const anchor = clipAnchor(point);
      const desiredY = anchor.y / anchor.w - pixelsY * 2 / viewport.height;
      const denominator = desiredY * m[7]! - m[5]!;
      if (Math.abs(denominator) < 1e-9) return 0;
      const delta = (anchor.y - desiredY * anchor.w) / denominator;
      return Number.isFinite(delta) && anchor.w + delta * m[7]! > 0 ? delta : 0;
    },
  };
}
