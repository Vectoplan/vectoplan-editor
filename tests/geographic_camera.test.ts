import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { GeographicPerspectiveCamera, cameraHorizontalSign, cameraRelativeMovement, renderGeographicScene } from '../src/frontend/render/geographic_camera';
import { planningKeyboardPanOffset, planningScreenPlanePanOffset } from '../src/frontend/camera/planning_camera_controller';
import { headingFromYaw, bearingTo } from '../src/frontend/scene/navigation_compass';

function northUpCamera() {
  const camera = new GeographicPerspectiveCamera(45, 1, .1, 1000);
  camera.position.set(0, 30, -10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
  return camera;
}

test('north +Z and east +X project up/right and retain their exact picking locations', () => {
  const camera = northUpCamera();
  for (const method of ['updateMatrixWorld', 'updateWorldMatrix']) {
    if (method === 'updateMatrixWorld') camera.updateMatrixWorld(true); else camera.updateWorldMatrix(true, false);
    assert.ok(new THREE.Vector3(5, 0, 0).project(camera).x > 0);
    assert.ok(new THREE.Vector3(0, 0, 5).project(camera).y > 0);
    const target = new THREE.Vector3(5.25, 0, 3.71), projected = target.clone().project(camera);
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(projected.x, projected.y), camera);
    const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    assert.ok(hit!.distanceTo(target) < 1e-8);
    const identity = camera.matrixWorld.clone().multiply(camera.matrixWorldInverse);
    identity.elements.forEach((value: number, index: number) => assert.ok(Math.abs(value - (index % 5 === 0 ? 1 : 0)) < 1e-8));
  }
});

test('GPU view matches logical UI projection and restores scene/camera matrices, even on rendering failure', () => {
  const scene = new THREE.Scene(), camera = northUpCamera(); scene.add(camera);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), new THREE.MeshBasicMaterial());
  wall.position.set(5, 3, 4); scene.add(wall);
  const held = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .2), new THREE.MeshBasicMaterial());
  held.position.set(.58, -.5, -.95); camera.add(held);
  scene.updateMatrixWorld(true);
  const wallMatrix = wall.matrixWorld.clone(), cameraMatrix = camera.matrixWorld.clone();
  const worldPoint = new THREE.Vector3(5, 3, 4), expected = worldPoint.clone().project(camera);
  const heldWorld = new THREE.Vector3().setFromMatrixPosition(held.matrixWorld);
  assert.ok(heldWorld.clone().project(camera).x > 0, 'held item remains on the right');
  for (const fail of [false, true]) {
    const renderer = { render(_scene: THREE.Scene, gpuCamera: THREE.Camera) {
      assert.ok(gpuCamera.matrixWorld.determinant() > 0, 'GPU camera is proper-handed');
      assert.ok(wall.matrixWorld.determinant() < 0, 'Three sees the reflected object and adjusts face culling');
      const actual = new THREE.Vector3().setFromMatrixPosition(wall.matrixWorld).project(gpuCamera);
      assert.ok(actual.distanceTo(expected) < 1e-8);
      assert.ok(new THREE.Vector3().setFromMatrixPosition(held.matrixWorld).project(gpuCamera).x > 0);
      if (fail) throw new Error('test renderer failure');
    } };
    if (fail) assert.throws(() => renderGeographicScene(renderer as any, scene, camera), /test renderer failure/);
    else renderGeographicScene(renderer as any, scene, camera);
    assert.deepEqual(wall.matrixWorld.elements, wallMatrix.elements);
    assert.deepEqual(camera.matrixWorld.elements, cameraMatrix.elements);
    assert.equal(scene.matrixWorldAutoUpdate, true);
  }
});

test('Ego strafe, planning keyboard/pan and horizontal look follow displayed camera right', () => {
  const camera = northUpCamera(), original = { right: 1, forward: 0, physics: { right: 1, forward: 0 } };
  const intent = cameraRelativeMovement(original, camera);
  assert.equal(intent.right, -1); assert.equal(intent.physics.right, -1); assert.equal(original.right, 1);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  const pan = planningScreenPlanePanOffset(right, up, 30, 45, 600, 20, 0);
  assert.ok(new THREE.Vector3(pan.x, pan.y, pan.z).dot(right) < 0, 'drag pans camera opposite screen motion');
  const keyboard = planningKeyboardPanOffset(Math.PI, 30, 100, cameraHorizontalSign(camera), 0);
  assert.ok(new THREE.Vector3(keyboard.x, 0, keyboard.z).dot(right) > 0, 'D moves the focus to screen right');
  const oldHeading = headingFromYaw(0), yawDelta = -10 * .002 * cameraHorizontalSign(camera);
  assert.ok(headingFromYaw(yawDelta) > oldHeading, 'mouse-right increases clockwise bearing');
});

test('compass bearings use the same north/east axes as EarthGrid and OSM', () => {
  const origin = { x: 0, y: 0, z: 0 };
  assert.equal(headingFromYaw(0), 180);
  assert.equal(headingFromYaw(Math.PI), 0);
  assert.equal(bearingTo(origin, { x: 0, y: 0, z: 1 }), 0);
  assert.equal(bearingTo(origin, { x: 1, y: 0, z: 0 }), 90);
});
