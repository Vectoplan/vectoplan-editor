import * as THREE from 'three';
import '../../src/frontend/styles/world_edit.css';
import { GeographicPerspectiveCamera, renderGeographicScene } from '../../src/frontend/render/geographic_camera';
import { createPlanningCameraController } from '../../src/frontend/camera/planning_camera_controller';
import { createWorldEditController } from '../../src/frontend/world_edit/world_edit_controller';
import { createConstructionCellMesh } from '../../src/frontend/scene/construction_cell_rendering';
import { createRoofCalculationMeshes } from '../../src/frontend/scene/roof_calculation_rendering';

// Real controller, planning navigation, renderer, ray picking and panel DOM.
// Transport/render queue are isolated; no project or library data is written.
document.body.innerHTML = `<style>
body{margin:12px;font:14px system-ui;background:#eef3f7}pre{white-space:pre-wrap}button{cursor:pointer}
#audit{position:relative;width:1160px;height:700px}#view{width:1160px;height:700px}
.editor-world-edit{display:none!important}[hidden]{display:none!important}
</style><button id="run">Panel und Szeneneingabe prüfen</button><pre id="result">Bereit</pre><main id="audit"><div id="view"></div></main>`;
type Data = Record<string, any>;
const root = document.querySelector<HTMLElement>('#audit')!, host = document.querySelector<HTMLElement>('#view')!;
const output = document.querySelector<HTMLElement>('#result')!, checks: string[] = [];
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xdce8ef);
scene.add(new THREE.HemisphereLight(0xffffff, 0x68777e, 2));
const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(-10, 35, -15); scene.add(sun);
scene.add(new THREE.GridHelper(70, 70, 0x9ca9b2, 0xbccbd5));
const camera = new GeographicPerspectiveCamera(45, 1160 / 700, .1, 1000);
camera.position.set(32, 32, -42); camera.lookAt(8, 1, 6); camera.updateMatrixWorld(true);
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(1); renderer.setSize(1160, 700); host.append(renderer.domElement);
const navigation = createPlanningCameraController({ root, host, camera, shouldYieldPrimaryPointer: () => true });
navigation.enable(new THREE.Vector3(8, 1, 6));
renderer.setAnimationLoop(() => renderGeographicScene(renderer, scene, camera));
const stored = new Map<string, Data>(), posts: Data[] = [], rendered = new THREE.Group(); scene.add(rendered);
let mode = 'planning', inputEnabled = true, disableCount = 0, exitResolve: (() => void) | null = null;
let delayExit = true, delaySave = false, saveResolve: (() => void) | null = null;
let delayReload = false, reloadResolve: (() => void) | null = null;
let target: { x: number; y: number; z: number } | null = null, handler: (intent: Data) => Promise<unknown>;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function install(): void {
  rendered.clear();
  for (const command of stored.values()) {
    const group = new THREE.Group(), ref = { ...command, anchor: command.position };
    group.userData = { semanticPlanningBuildArea: command.objectTypeId === 'planning_build_area', semanticObjectRef: ref };
    if (command.metadata?.constructionCells?.length) {
      const mesh = createConstructionCellMesh(command.metadata.constructionCells, new THREE.MeshLambertMaterial({ color: 0xd0c6b5 }));
      if (mesh) group.add(mesh);
    }
    if (command.metadata?.roofCalculation) createRoofCalculationMeshes(command.metadata.roofCalculation).meshes.forEach(mesh => {
      mesh.userData.semanticObjectRef = ref; mesh.userData.semanticRoof = true; group.add(mesh);
    });
    rendered.add(group);
  }
  scene.updateMatrixWorld(true);
}
async function sendCommand(payload: Data): Promise<Data> {
  posts.push(clone(payload));
  if (delaySave) await new Promise<void>(resolve => { saveResolve = resolve; });
  assert(payload.type === 'ObjectBatch', 'Eine Änderung umgeht die atomare Gebäudegeneration');
  const parent = payload.commands.find((command: Data) => command.objectTypeId === 'planning_build_area');
  for (const [id, command] of stored) if (command.metadata?.generatedFromAreaId === parent.objectInstanceId) stored.delete(id);
  for (const command of payload.commands) stored.set(command.objectInstanceId, clone(command));
  return { ok: true, changed: true };
}
const input = new Proxy({
  clear: () => {}, enable: () => { inputEnabled = true; }, disable: () => { inputEnabled = false; disableCount++; },
  requestPointerLock: async () => true,
  exitPointerLock: async () => { if (delayExit) await new Promise<void>(resolve => { exitResolve = resolve; }); return true; },
}, { get: (object, key) => key in object ? (object as any)[key] : () => null });
const runtime = new Proxy({ getScene: () => scene, getCamera: () => camera, getRenderer: () => renderer,
  getWorkspaceMode: () => mode, setWorkspaceMode: (value: string) => { mode = value; },
  getSelectedLibraryPlacement: () => ({ valid: false }), getInputController: () => input,
  getTargetCells: () => ({ targetPoint: target, sourceCell: null, placementCell: null }),
  setWorldEditIntentHandler: (value: typeof handler) => { handler = value; }, reloadDirtyChunks: async () => {
    if (delayReload) await new Promise<void>(resolve => { reloadResolve = resolve; });
    install();
  },
  renderOnce: () => renderGeographicScene(renderer, scene, camera),
}, { get: (object, key) => key in object ? (object as any)[key] : () => null });
const controller = createWorldEditController({ root, bootstrap: { runtime: { chunk: { projectId: 'panel-audit', worldId: 'panel-audit' } } },
  sceneRuntime: runtime, worldRuntime: { getRegistry: () => ({ getSnapshot: () => ({ entries: [] }) }), getSource: () => ({ sendCommand }) },
  logger: { warn: (...args: unknown[]) => { root.dataset.warning = JSON.stringify(args); }, debug: () => {} },
} as any);
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function pass(message: string): void { checks.push(`✓ ${message}`); output.textContent = checks.join('\n'); }
const frames = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
async function waitFor(check: () => boolean, message: string): Promise<void> {
  for (let i = 0; i < 350; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  throw new Error(`${message}; ${root.querySelector('[data-world-edit-status]')?.textContent}`);
}
const panel = () => root.querySelector<HTMLElement>('[data-editor-line-brush-quick-settings]')!;
const storeyPanel = () => root.querySelector<HTMLElement>('[data-editor-storey-quick-settings]')!;
const preview = () => scene.getObjectByName('vectoplan_world_edit_planning_build_area');
const points = () => preview()?.userData.storeyDraft?.points as { x: number; y: number; z: number }[];
function aim(point: THREE.Vector3 | { x: number; y: number; z: number }): void {
  target = { x: point.x, y: point.y, z: point.z };
  if (mode === 'first-person') { camera.lookAt(point.x, point.y, point.z); camera.updateMatrixWorld(true); }
  const ndc = new THREE.Vector3(point.x, point.y, point.z).project(camera);
  root.dataset.editorPlanningCursorX = String(ndc.x); root.dataset.editorPlanningCursorY = String(ndc.y);
}
async function intent(action: string): Promise<void> { assert(inputEnabled, 'Offenes Linienbrush-Panel sperrt Eingabecontroller'); await handler({ action, targetPoint: target, position: target }); }
async function point(x: number, z: number): Promise<void> { aim({ x, y: 0, z }); await intent('primary'); await intent('primary-release'); }
async function gear(): Promise<void> {
  const symbol = scene.getObjectByName('vectoplan_world_edit_building_settings')
    ?? scene.getObjectByName('vectoplan_world_edit_line_brush_building_settings')?.children.find(item => item.userData.worldEditLineBrushSettings);
  assert(symbol, 'Einstellungssymbol fehlt'); aim(symbol.getWorldPosition(new THREE.Vector3())); await intent('primary'); await intent('primary-release');
  await waitFor(() => !panel().hidden, 'Zahnrad öffnet Panel nicht');
}
function click(selector: string): void { const button = root.querySelector<HTMLButtonElement>(selector)!; assert(button && !button.disabled, `${selector} ist nicht bedienbar`); button.click(); }
function change(selector: string, value: string): void { const input = root.querySelector<HTMLInputElement>(selector)!; input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); }
function wheel(element: Element): void { element.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 85, clientX: 300, clientY: 300 })); }
function noStoreyFocus(): void {
  assert(storeyPanel().hidden, 'Geschosspanel wird nach Schließen wieder geöffnet');
  assert(root.querySelector<SVGElement>('[data-storey-scene-handles]')!.style.display === 'none', 'Geschosslinien bleiben nach Schließen aktiv');
}
document.querySelector<HTMLButtonElement>('#run')!.addEventListener('click', async event => {
  (event.currentTarget as HTMLButtonElement).disabled = true;
  try {
    controller.activate('room'); assert(panel().hidden, 'Werkzeugaktivierung öffnet das Linienbrush-Panel');
    await point(0, 0); await point(16, 0); await point(16, 12);
    assert(panel().hidden && points().length === 3, 'Punktsetzen öffnet Einstellungen');
    await gear(); assert(disableCount === 0 && inputEnabled, 'Zahnrad deaktiviert Szeneneingaben');
    assert(!panel().querySelector('[data-line-brush-template-title], [data-line-brush-new]'), 'Entfernte Summary/Neues-Gebäude-Schaltfläche bleibt sichtbar');
    assert(panel().querySelector('[data-line-brush-generate]')!.textContent === 'Bestätigen', 'Bestätigen-Beschriftung fehlt');
    assert(!['auto', 'scroll'].includes(getComputedStyle(panel()).overflowY) && panel().scrollHeight <= panel().clientHeight + 1, 'Linienbrush-Panel benötigt internes Scrollen');
    const before = camera.position.clone(); wheel(renderer.domElement); assert(camera.position.distanceTo(before) > .01, 'Kamerazoom bei offenem Panel blockiert');
    const after = camera.position.clone(); delayExit = false; exitResolve?.(); await frames();
    assert(camera.position.distanceTo(after) < 1e-7, 'Pointerlock-Abschluss setzt inzwischen bewegte Kamera zurück');
    wheel(panel()); assert(camera.position.distanceTo(after) < 1e-7, 'Panelinteraktion bewegt Kamera');
    pass('Nur Zahnrad öffnet kompaktes Panel; Kamera bleibt frei und Panelereignisse bleiben im Panel.');

    await point(24, 12); assert(points().length === 4 && !panel().hidden, 'Linksklick ergänzt bei offenem Panel keinen Punkt');
    aim(preview()!.children.find(item => item.userData.polygonAreaPointIndex === 3)!.position);
    await intent('secondary'); assert(points().length === 3 && !panel().hidden, 'Rechtsklick entfernt bei offenem Panel keinen Punkt');
    aim(preview()!.children.find(item => item.userData.polygonAreaPointIndex === 1)!.position);
    await intent('primary'); aim({ x: 19, y: 0, z: 0 }); await frames(); await intent('primary-release');
    assert(Math.abs(points()[1]!.x - 19) < 1e-6, 'Punktziehen bei offenem Panel bleibt blockiert');
    click('[data-line-brush-storey-increase]'); click('[data-line-brush-storey-increase]'); change('[data-line-brush-roof-type]', 'flat');
    assert(posts.length === 0, 'Offene Vorschau speichert vor Bestätigen');
    delayReload = true;
    click('[data-line-brush-generate]'); await waitFor(() => panel().hidden && reloadResolve !== null, 'Bestätigen wartet auf Chunkreload statt nach Commit zu schließen');
    delayReload = false; reloadResolve?.();
    await waitFor(() => !root.querySelector<HTMLButtonElement>('[data-line-brush-generate]')!.disabled, 'Chunkreload endet nicht');
    assert(posts.length === 1, 'Bestätigen erzeugt mehr als eine Generation');
    const parent = posts[0]!.commands.find((command: Data) => command.objectTypeId === 'planning_build_area');
    assert(parent.metadata.storeyCount === 3 && parent.metadata.buildingProgram.roof.type === 'flat'
      && parent.metadata.pathBrush.points[1].x === 19, 'Bestätigen verliert letzte Punkt-/Geschoss-/Dachänderung');
    pass('Linksklick ergänzt/zieht, Rechtsklick entfernt; Bestätigen speichert den letzten gesamten Zustand einmal.');
    await gear(); click('[data-line-brush-generate]');
    assert(panel().hidden && posts.length === 1, 'Unverändertes Bestätigen startet neue Generation oder bleibt offen');

    controller.activate('selection'); controller.activate('room'); assert(panel().hidden, 'Erneute Aktivierung öffnet Panel');
    mode = 'first-person'; navigation.disable(); camera.position.set(25, 20, -25); camera.updateMatrixWorld(true);
    await gear(); assert(inputEnabled && disableCount === 0, 'Ego-Zahnrad deaktiviert Eingabe');
    const old = points()[1]!.x;
    aim(preview()!.children.find(item => item.userData.polygonAreaPointIndex === 1)!.position); await intent('primary');
    aim({ x: old + 1, y: 0, z: 0 }); await frames(); await intent('primary-release');
    assert(points()[1]!.x === old + 1 && posts.length === 1 && !panel().hidden, 'Ego-Punktbearbeitung bei offenem Panel speichert oder blockiert');
    click('[data-line-brush-generate]'); await waitFor(() => panel().hidden, 'Ego-Bestätigen bleibt offen');
    assert(posts.length === 2, 'Ego-Bestätigen speichert nicht genau einmal');
    pass('Auch Ego behält Szeneneingabe und Punktbearbeitung bei offenem Panel.');

    controller.activate('storey'); assert(storeyPanel().hidden, 'Geschosswerkzeug öffnet ungefragt sein Panel');
    aim({ x: 10, y: 2, z: 0 }); await intent('primary'); await waitFor(() => !storeyPanel().hidden, 'Gebäudeklick öffnet Geschossmenü nicht');
    await frames(); assert(root.querySelector<SVGElement>('[data-storey-scene-handles]')!.style.display !== 'none', 'Selektierte Geschosslinien fehlen');
    click('[data-storey-close]'); await frames(); noStoreyFocus();
    // A late persistence completion must not silently re-select a dismissed building.
    aim({ x: 10, y: 2, z: 0 }); await handler({ action: 'primary', targetPoint: target, position: target });
    await waitFor(() => !storeyPanel().hidden, 'Erneute Gebäudeselektion öffnet Menü nicht');
    await frames(); assert(root.querySelector<SVGElement>('[data-storey-scene-handles]')!.style.display !== 'none', 'Griffe werden bei erneuter Selektion nicht reaktiviert');
    delaySave = true; click('[data-storey-add]'); assert(saveResolve === null, 'Geschossänderung speichert vor Bestätigen');
    click('[data-storey-confirm]'); await waitFor(() => saveResolve !== null, 'Geschoss-Commit startet nicht');
    delaySave = false; saveResolve?.(); await waitFor(() => root.querySelector('[data-world-edit-status]')?.getAttribute('data-kind') !== 'busy', 'Geschoss-Commit endet nicht');
    await frames(); noStoreyFocus();
    pass('Geschosspanel-Schließen und Bestätigen beenden Auswahl und Griffe; erneute Auswahl funktioniert.');
    output.textContent = checks.join('\n') + '\nPASS'; root.dataset.result = 'pass';
  } catch (error) {
    output.textContent = checks.join('\n') + '\nFAIL ' + (error instanceof Error ? error.stack : String(error)) + '\n' + (root.dataset.warning ?? ''); root.dataset.result = 'fail';
  }
});
