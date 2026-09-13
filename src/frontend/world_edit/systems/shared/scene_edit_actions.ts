import * as THREE from "three";

/** World anchors retain their object identity; their targets stay 36 CSS px wide. */
export function scaleSceneEditAction(sprite: THREE.Sprite, camera: THREE.Camera, viewportHeight: number, pixels = 44): number {
  const position = sprite.getWorldPosition(new THREE.Vector3()).applyMatrix4(camera.matrixWorldInverse);
  const projection = camera.projectionMatrix.elements;
  const perspective = Math.abs(projection[15]!) < 1e-9;
  const height = 2 * (perspective ? Math.max(.01, -position.z) : 1) / Math.abs(projection[5]!);
  const scale = height * pixels / Math.max(1, viewportHeight);
  sprite.scale.set(scale, scale, 1);
  return scale;
}

export function sceneEditActionTexture(action: "settings" | "delete"): THREE.DataTexture {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  const color = action === "delete" ? [220, 38, 38] : [37, 99, 235];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x + .5 - size / 2, dy = y + .5 - size / 2, radius = Math.hypot(dx, dy);
    const cog = radius >= 12 && radius <= (Math.cos(Math.atan2(dy, dx) * 8) > .15 ? 36 : 28);
    const bin = (Math.abs(dx) < 24 && dy > -20 && dy < -13)
      || (Math.abs(dx) < 11 && dy > -28 && dy < -20)
      || (Math.abs(dx) < 21 && dy >= -9 && dy < 28 && (Math.abs(dx) > 15 || dy > 22))
      || (dy > -4 && dy < 18 && (Math.abs(dx + 6) < 2 || Math.abs(dx - 6) < 2));
    const white = (action === "delete" ? bin : cog) || radius >= 49 && radius <= 53;
    const offset = (y * size + x) * 4;
    pixels[offset] = white ? 255 : color[0]!; pixels[offset + 1] = white ? 255 : color[1]!;
    pixels[offset + 2] = white ? 255 : color[2]!;
    pixels[offset + 3] = Math.round(Math.max(0, Math.min(1, 54 - radius)) * 255);
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  // Pixel rows above are painted top-to-bottom, like the CanvasTexture used
  // by the roof gear. DataTexture otherwise uploads row zero at the bottom.
  texture.flipY = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** A roof can be outside an Ego camera's view while the facade fills the screen.
 * Choose a visible point on that real facade instead of pinning unrelated icons
 * to a viewport edge. Homogeneous clipping also handles enormous courtyards. */
export function reachableBuildingActionPosition(preferred: THREE.Vector3, rings: readonly (readonly (readonly number[])[])[],
  baseY: number, topY: number, camera: THREE.Camera): THREE.Vector3 | null {
  const project = preferred.clone().project(camera);
  if (project.z >= -1 && project.z <= 1 && Math.abs(project.x) < .86 && Math.abs(project.y) < .86) return preferred.clone();
  const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const y = Math.max(baseY + .5, Math.min(topY, camera.position.y));
  let best: THREE.Vector3 | null = null, score = Infinity;
  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!, b = ring[(i + 1) % ring.length]!;
    const start = new THREE.Vector4(a[0]!, y, a[1]!, 1).applyMatrix4(matrix);
    const end = new THREE.Vector4(b[0]!, y, b[1]!, 1).applyMatrix4(matrix);
    let from = 0, to = 1;
    for (const axis of ["x", "y", "z"] as const) for (const sign of [-1, 1]) {
      const margin = axis === "z" ? 1 : .82;
      const first = margin * start.w + sign * start[axis], last = margin * end.w + sign * end[axis];
      if (first < 0 && last < 0) { from = 2; break; }
      if (first < 0) from = Math.max(from, first / (first - last));
      if (last < 0) to = Math.min(to, first / (first - last));
    }
    if (from > to) continue;
    const t = (from + to) / 2;
    const point = new THREE.Vector3(a[0]! + (b[0]! - a[0]!) * t, y, a[1]! + (b[1]! - a[1]!) * t);
    const p = point.clone().project(camera);
    const value = p.x * p.x + p.y * p.y;
    if (value < score) { score = value; best = point; }
  }
  return best;
}
