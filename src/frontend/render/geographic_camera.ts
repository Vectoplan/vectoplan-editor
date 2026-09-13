import * as THREE from 'three';

/** The persisted Earth grid is X east / Y up / Z north, a left-handed basis.
 * Keep world coordinates intact and reflect the camera's horizontal basis.
 * Three's normal Camera explicitly removes scale from its view matrix; the
 * overrides retain this deliberate reflection for project(), unproject() and
 * Raycaster.setFromCamera(), so UI handles and picking use the displayed image.
 */
export class GeographicPerspectiveCamera extends THREE.PerspectiveCamera {
  // This workspace consumes Three's JavaScript package without @types/three.
  [property: string]: any;
  constructor(fov?: number, aspect?: number, near?: number, far?: number) {
    super(fov, aspect, near, far);
    this.scale.x = -1;
  }

  updateMatrixWorld(force?: boolean): void {
    super.updateMatrixWorld(force);
    this.matrixWorldInverse.copy(this.matrixWorld).invert();
  }

  updateWorldMatrix(updateParents: boolean, updateChildren: boolean): void {
    super.updateWorldMatrix(updateParents, updateChildren);
    this.matrixWorldInverse.copy(this.matrixWorld).invert();
  }
}

export function cameraHorizontalSign(camera: THREE.Camera): number {
  return camera.scale.x < 0 ? -1 : 1;
}

export function cameraRelativeMovement<T extends { readonly right: number; readonly physics: { readonly right: number } }>(
  intent: T, camera: THREE.Camera,
): T {
  const sign = cameraHorizontalSign(camera);
  return sign === 1 ? intent : { ...intent, right: intent.right * sign,
    physics: { ...intent.physics, right: intent.physics.right * sign } };
}

const reflection = new THREE.Matrix4().makeScale(-1, 1, 1);
const renderStates = new WeakMap<THREE.Camera, { camera: THREE.PerspectiveCamera; sceneWorld: THREE.Matrix4 }>();

/** Reflect scene and a proper render-camera together only for the GPU pass.
 * Their product equals the logical reflected view. Object determinants expose
 * the reflection to Three's existing face-culling/normal/shadow implementation,
 * including FrontSide roofs, InstancedMesh and camera-attached held items.
 * After the pass every world matrix is restored for collision and WorldEdit.
 */
export function renderGeographicScene(renderer: THREE.WebGLRenderer, scene: THREE.Scene,
  camera: THREE.PerspectiveCamera): void {
  if (!(camera instanceof GeographicPerspectiveCamera)) { renderer.render(scene, camera); return; }
  camera.updateWorldMatrix(true, false);
  let state = renderStates.get(camera);
  if (!state) { state = { camera: new THREE.PerspectiveCamera(), sceneWorld: new THREE.Matrix4() }; renderStates.set(camera, state); }
  const renderCamera = state.camera;
  renderCamera.copy(camera, false);
  renderCamera.matrixWorld.premultiply(reflection);
  renderCamera.matrix.copy(renderCamera.matrixWorld);
  renderCamera.matrixWorld.decompose(renderCamera.position, renderCamera.quaternion, renderCamera.scale);
  renderCamera.matrixWorldInverse.copy(renderCamera.matrixWorld).invert();
  renderCamera.matrixAutoUpdate = false;
  renderCamera.matrixWorldAutoUpdate = false;

  state.sceneWorld.copy(scene.matrixWorld);
  const autoUpdate = scene.matrixWorldAutoUpdate;
  try {
    scene.matrixWorldAutoUpdate = false;
    scene.matrixWorld.premultiply(reflection);
    scene.updateMatrixWorld(true);
    renderer.render(scene, renderCamera);
  } finally {
    scene.matrixWorld.copy(state.sceneWorld);
    scene.matrixWorldAutoUpdate = autoUpdate;
    scene.updateMatrixWorld(true);
    // Context cameras need not be attached to the scene.
    camera.updateWorldMatrix(true, false);
  }
}
