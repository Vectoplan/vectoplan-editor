import * as THREE from "three";
import { GeographicPerspectiveCamera, renderGeographicScene } from "../../src/frontend/render/geographic_camera";
import { createRenderer } from "../../src/frontend/scene/scene_runtime";
import { createRoofCalculationMeshes } from "../../src/frontend/scene/roof_calculation_rendering";
import { scaleSceneEditAction, sceneEditActionTexture } from "../../src/frontend/world_edit/systems/shared/scene_edit_actions";
import { updateRoofEditActions, type RoofEditAction } from "../../src/frontend/world_edit/systems/roof/edit_actions";

document.body.style.cssText = "margin:0;overflow:hidden;background:#dfe7eb;font:14px system-ui";
const renderer = createRenderer(document.createElement("canvas"), { render: { alpha: false, clearColor: "#dfe7eb" } } as any);
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25)); document.body.append(renderer.domElement);
const camera = new GeographicPerspectiveCamera(65, innerWidth / innerHeight, .05, 1000);
const scene = new THREE.Scene(); scene.background = new THREE.Color("#dfe7eb");
scene.add(new THREE.HemisphereLight(0xffffff, 0x778899, 2));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ color: 0xd5d9d5, side: THREE.DoubleSide }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);
const grid = new THREE.GridHelper(600, 60, 0x98a8a8, 0xc1cccc); scene.add(grid);
const textures = { settings: sceneEditActionTexture("settings"), delete: sceneEditActionTexture("delete") };
function sprite(action: "settings" | "delete"): THREE.Sprite {
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: textures[action], transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
}
const definitions = [
  { id: "Nahes Dach", x: -12, z: 0 }, { id: "Dahinter, überlappend", x: -12, z: -16 },
  { id: "Zweites nahes Dach", x: 25, z: 12 }, { id: "Entferntes Dach", x: 0, z: -145 },
];
const actions: RoofEditAction[] = definitions.map(({ id, x, z }) => {
  const calculation = { geometry: { faces: [{ polygon_3d_mm: [[x - 9, z - 6, 10], [x + 9, z - 6, 10], [x + 9, z + 6, 10], [x - 9, z + 6, 10]].map(point => point.map(value => value * 1000)) }] } };
  const roof = createRoofCalculationMeshes(calculation); scene.add(...roof.meshes);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 12), new THREE.MeshStandardMaterial({ color: 0xc4c2bb }));
  walls.position.set(x, 5, z); scene.add(walls);
  const settings = sprite("settings"), remove = sprite("delete"); settings.position.set(x, 10.72, z); scene.add(settings, remove);
  return { id, settings, remove, calculation };
});

// Read pixels from a real GPU pass with the same reflected camera and renderer
// as production. The wide bottom of the bin must be below its narrow handle.
function checkDeleteOrientation(): { ok: boolean; upper: number[]; lower: number[] } {
  const target = new THREE.WebGLRenderTarget(256, 256), checkScene = new THREE.Scene();
  checkScene.background = new THREE.Color(0x101820);
  const checkCamera = new GeographicPerspectiveCamera(65, 1, .05, 1000);
  checkCamera.position.set(0, 0, 5); checkCamera.lookAt(0, 0, 0); checkCamera.updateMatrixWorld(true);
  const icon = sprite("delete"); checkScene.add(icon); scaleSceneEditAction(icon, checkCamera, 256, 128);
  renderer.setRenderTarget(target); renderGeographicScene(renderer, checkScene, checkCamera);
  const upper = new Uint8Array(4), lower = new Uint8Array(4);
  renderer.readRenderTargetPixels(target, 144, 152, 1, 1, upper);
  renderer.readRenderTargetPixels(target, 144, 104, 1, 1, lower);
  renderer.setRenderTarget(null); icon.material.dispose(); target.dispose();
  return { ok: upper[1]! < 120 && lower[1]! > 220, upper: [...upper], lower: [...lower] };
}
const orientation = checkDeleteOrientation();
const panel = document.createElement("div"); panel.style.cssText = "position:fixed;left:14px;top:14px;padding:14px;max-width:510px;background:white;border-radius:8px;z-index:2";
panel.innerHTML = `<b>Dachaktionen – echte GeographicCamera</b><p>80 m zur Dachfläche · nächste überlappende Aktion zuerst</p>
  <p>GPU-Ausrichtung Papierkorb: <b>${orientation.ok ? "PASS – aufrecht" : "FAIL"}</b></p><div id="buttons"></div><pre id="status" style="font-size:12px"></pre>`;
document.body.append(panel);
let selected = false, rotate = false, angle = 0;
function view(ego: boolean) { camera.position.set(0, ego ? 12 : 28, 62); camera.lookAt(0, 10, -12); camera.updateMatrixWorld(true); }
view(false);
for (const [label, handler] of [
  ["Planung", () => view(false)], ["Ego", () => view(true)],
  ["Fernes Dach auswählen", () => { selected = !selected; }], ["Kamera bewegen", () => { rotate = !rotate; }],
] as const) { const button = document.createElement("button"); button.textContent = label; button.onclick = handler; button.style.marginRight = "6px"; panel.querySelector("#buttons")!.append(button); }
renderer.setAnimationLoop(() => {
  if (rotate) { angle += .002; camera.position.set(Math.sin(angle) * 65, 28, Math.cos(angle) * 65); camera.lookAt(0, 10, -12); }
  camera.updateMatrixWorld(true);
  updateRoofEditActions(actions.map((action, index) => ({ ...action, selected: selected && index === 3 })), camera, innerHeight);
  renderGeographicScene(renderer, scene, camera);
  panel.querySelector("#status")!.textContent = actions.map(action => `${action.settings.visible ? "sichtbar" : "verborgen"}  ${action.id}`).join("\n");
});
document.body.dataset.auditReady = "true"; document.body.dataset.orientation = orientation.ok ? "pass" : "fail";
(window as any).roofActionAudit = { orientation, actions, camera, renderer };
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
