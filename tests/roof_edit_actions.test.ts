import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { GeographicPerspectiveCamera } from "../src/frontend/render/geographic_camera";
import { nearestRoofActionPoint, updateRoofEditActions, type RoofEditAction } from "../src/frontend/world_edit/systems/roof/edit_actions";

const roof = (points: number[][]) => ({ geometry: { faces: [{ polygon_3d_mm: points.map(([x, y, z]) => [x! * 1000, z! * 1000, y! * 1000]) }] } });
const flat = (z: number, y = 10) => roof([[-8, y, z - 8], [8, y, z - 8], [8, y, z + 8], [-8, y, z + 8]]);
function camera() {
  const result = new GeographicPerspectiveCamera(65, 1200 / 800, .05, 1000);
  result.position.set(0, 15, 65); result.lookAt(0, 10, 0); result.updateMatrixWorld(true); return result;
}
function action(id: string, calculation: unknown, position: THREE.Vector3, selected = false): RoofEditAction {
  const settings = new THREE.Sprite(new THREE.SpriteMaterial()), remove = new THREE.Sprite(new THREE.SpriteMaterial());
  settings.position.copy(position); return { id, settings, remove, calculation, selected };
}
const dispose = (actions: RoofEditAction[]) => actions.forEach(item => { item.settings.material.dispose(); item.remove?.material.dispose(); });

test("roof actions use the nearest real surface within 80m, including height and long roofs", () => {
  const view = camera();
  const near = action("near", flat(0), new THREE.Vector3(0, 10.72, 0));
  const far = action("far", flat(-60), new THREE.Vector3(0, 10.72, -60));
  const high = action("high", flat(60, 120), new THREE.Vector3(0, 120.72, 60));
  const long = action("long", roof([[-10, 10, -250], [10, 10, -250], [10, 10, 60], [-10, 10, 60]]), new THREE.Vector3(0, 10.72, -200));
  updateRoofEditActions([near, far, high], view, 800);
  assert.equal(near.settings.visible, true); assert.equal(far.settings.visible, false); assert.equal(high.settings.visible, false);
  updateRoofEditActions([long], view, 800);
  assert.equal(long.settings.visible, true, "a distant centroid must not hide a roof whose surface reaches the camera");
  dispose([near, far, high, long]);
});

test("empty courtyards are not mistaken for nearby roof surfaces", () => {
  const calculation = roof([[0, 0, 0], [300, 0, 0], [300, 0, 300], [250, 0, 300],
    [250, 0, 50], [50, 0, 50], [50, 0, 300], [0, 0, 300]]);
  const closest = nearestRoofActionPoint(calculation, new THREE.Vector3(150, 1, 200))!;
  assert.ok(Math.abs(closest.distance - Math.sqrt(10001)) < 1e-6);
});

test("overlapping pairs prefer the nearer roof while selected controls remain reachable beyond the limit", () => {
  const view = camera();
  const near = action("near", flat(0), new THREE.Vector3(0, 10.72, 0));
  const behind = action("behind", flat(-10), new THREE.Vector3(0, 10.72, -10));
  updateRoofEditActions([behind, near], view, 800);
  assert.equal(near.settings.visible, true); assert.equal(behind.settings.visible, false); assert.equal(behind.remove!.visible, false);
  const selected = action("selected", flat(-200), new THREE.Vector3(0, 10.72, -200), true);
  updateRoofEditActions([near, selected], view, 800);
  assert.equal(selected.settings.visible, true); assert.equal(selected.remove!.visible, true);
  dispose([near, behind, selected]);
});

test("camera movement reveals nearby controls again and keeps both actions 44px wide in geographic view", () => {
  const view = camera();
  const target = action("moving", flat(-60), new THREE.Vector3(0, 10.72, -60));
  updateRoofEditActions([target], view, 800); assert.equal(target.settings.visible, false);
  view.position.z = 0; view.lookAt(0, 10, -60); view.updateMatrixWorld(true);
  updateRoofEditActions([target], view, 800);
  assert.equal(target.settings.visible, true); assert.equal(target.remove!.visible, true);
  const left = target.settings.position.clone().project(view), right = target.remove!.position.clone().project(view);
  assert.ok(right.x > left.x, "delete remains to the screen-right with the reflected geographic camera");
  assert.ok(Math.abs((right.x - left.x) * 600 - 46.2) < .01);
  dispose([target]);
});
