import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { GeographicPerspectiveCamera } from "../src/frontend/render/geographic_camera";
import { projectStoreyEdge, storeyDragHeightAtPoint } from "../src/frontend/world_edit/systems/storey/scene_projection";

const viewport = { left: 15, top: 27, width: 1000, height: 600 };
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
function camera() {
  const camera = new GeographicPerspectiveCamera(60, 1000 / 600, .1, 200);
  camera.position.set(0, 1.7, 0); camera.lookAt(0, 1.7, 1); camera.updateMatrixWorld(true);
  return camera;
}

test("a facade crossing the near plane retains its visible floor line in Ego", () => {
  const result = projectStoreyEdge(camera(), { x: -.04, y: 1.7, z: -2 }, { x: .04, y: 1.7, z: 2 }, viewport);
  assert.ok(result);
  for (const point of result.points) {
    assert.ok(point.x >= viewport.left && point.x <= viewport.left + viewport.width);
    close(point.y, viewport.top + viewport.height / 2);
  }
  assert.ok(result.pixelsPerMeter < -2, "drag scale stays usable despite behind-camera endpoint");
});

test("a long facade with both endpoints outside the viewport clips to both screen edges", () => {
  const result = projectStoreyEdge(camera(), { x: -100, y: 1.7, z: 2 }, { x: 100, y: 1.7, z: 2 }, viewport)!;
  assert.ok(result);
  close(result.points[0].x, viewport.left);
  close(result.points[1].x, viewport.left + viewport.width);
  close(result.points[0].y, viewport.top + viewport.height / 2);
});

test("entirely behind-camera or above-view lines produce no phantom handles", () => {
  assert.equal(projectStoreyEdge(camera(), { x: -1, y: 2, z: -4 }, { x: 1, y: 2, z: -4 }, viewport), null);
  assert.equal(projectStoreyEdge(camera(), { x: -1, y: 200, z: 4 }, { x: 1, y: 200, z: 4 }, viewport), null);
});

test("visible geographic projection and signed height derivative match actual camera geometry", () => {
  const eye = camera(); eye.position.set(6, 12, -10); eye.lookAt(0, 3, 4); eye.updateMatrixWorld(true);
  const a = { x: -1, y: 3, z: 4 }, b = { x: 1, y: 3, z: 4 };
  const result = projectStoreyEdge(eye, a, b, viewport)!;
  for (const [index, point] of [a, b].entries()) {
    const p = new THREE.Vector3(point.x, point.y, point.z).project(eye);
    close(result.points[index]!.x, viewport.left + (p.x + 1) * viewport.width / 2);
    close(result.points[index]!.y, viewport.top + (1 - p.y) * viewport.height / 2);
  }
  const before = new THREE.Vector3(0, 3, 4).project(eye), after = new THREE.Vector3(0, 3.00001, 4).project(eye);
  assert.ok(Math.abs(result.pixelsPerMeter - (before.y - after.y) * viewport.height / 2 / .00001) < .001);
});

test("drag displacement follows the clicked near-facade point rather than the building centroid", () => {
  const eye = camera(); eye.position.set(16.25, 5.65, 2); eye.lookAt(18.25, 5.65, 2.25); eye.updateMatrixWorld(true);
  const a = { x: 13.25, y: 5.65, z: 2.25 }, b = { x: 19.25, y: 5.65, z: 2.25 };
  const edge = projectStoreyEdge(eye, a, b, viewport)!;
  const start = { x: (edge.points[0].x + edge.points[1].x) / 2, y: edge.points[0].y };
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((start.x - viewport.left) / viewport.width * 2 - 1,
    1 - (start.y - viewport.top) / viewport.height * 2), eye);
  const clicked = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.25), new THREE.Vector3())!;
  for (const pixelsY of [-24, 24, -80]) {
    const delta = edge.heightDeltaForDrag(start, pixelsY);
    const moved = clicked.clone().add(new THREE.Vector3(0, delta, 0)).project(eye);
    close(viewport.top + (1 - moved.y) * viewport.height / 2, start.y + pixelsY);
  }
});

test("perspective drag remains exact under an oblique planning camera", () => {
  const eye = camera(); eye.position.set(6, 12, -10); eye.lookAt(0, 3, 4); eye.updateMatrixWorld(true);
  const a = { x: -1, y: 3, z: 4 }, b = { x: 1, y: 3, z: 4 };
  const edge = projectStoreyEdge(eye, a, b, viewport)!;
  const clicked = new THREE.Vector3(-.7, 3, 4), screen = clicked.clone().project(eye);
  const start = { x: viewport.left + (screen.x + 1) * viewport.width / 2,
    y: viewport.top + (1 - screen.y) * viewport.height / 2 };
  for (const pixelsY of [-100, 100]) {
    const delta = edge.heightDeltaForDrag(start, pixelsY);
    const moved = clicked.clone().add(new THREE.Vector3(0, delta, 0)).project(eye);
    close(viewport.top + (1 - moved.y) * viewport.height / 2, start.y + pixelsY);
  }
});

test("overlapping front/back lines choose the front facade across repeated moves and camera updates", () => {
  const eye = camera(); eye.position.set(16.25, 5.65, 2); eye.lookAt(18.25, 5.65, 2.25); eye.updateMatrixWorld(true);
  const front = projectStoreyEdge(eye, { x: 13.25, y: 5.65, z: 2.25 }, { x: 19.25, y: 5.65, z: 2.25 }, viewport)!;
  const back = projectStoreyEdge(eye, { x: 19.25, y: 5.65, z: 2.25 }, { x: 19.25, y: 5.65, z: 8.25 }, viewport)!;
  assert.ok(front && back);
  const lower = Math.max(...[front, back].map(edge => Math.min(...edge.points.map(p => p.x))));
  const upper = Math.min(...[front, back].map(edge => Math.max(...edge.points.map(p => p.x))));
  assert.ok(upper > lower);
  const start = { x: (lower + upper) / 2, y: viewport.top + viewport.height / 2 + .2 };
  assert.ok(front.distanceTo(start) < 1 && back.distanceTo(start) < 1);
  assert.ok(front.depthAt(start) < back.depthAt(start));
  const drag = (pixels: number) => storeyDragHeightAtPoint([back, front], 3.5, start, pixels);
  for (const pixels of [-8, -16, -24, -12]) {
    close(drag(pixels), 3.5 + front.heightDeltaForDrag(start, pixels));
    // A render/profile update must not change the frozen projection or add
    // intermediate height changes to the original gesture's base height.
    eye.position.y += .1; eye.updateMatrixWorld(true);
  }
});
