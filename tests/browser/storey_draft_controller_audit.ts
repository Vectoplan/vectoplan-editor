import * as THREE from "three";
import { createWorldEditController } from "../../src/frontend/world_edit/world_edit_controller";
import { createConstructionCellMesh } from "../../src/frontend/scene/construction_cell_rendering";
import { createRoofCalculationMeshes } from "../../src/frontend/scene/roof_calculation_rendering";
import berlinZip from "../fixtures/berlin-storey-parent.json.gz";

// Real historical Berlin generation 951, 1,545 construction cells, 10 children.
// Every mutation is intercepted locally. No live project or dataset is changed.
type Data = Record<string, any>;
const source = JSON.parse(await new Response(new Blob([berlinZip]).stream()
  .pipeThrough(new DecompressionStream("gzip"))).text());
document.body.innerHTML = `<style>[hidden]{display:none!important}body{font:14px system-ui}
#audit{position:relative;width:1100px;min-height:850px}pre{white-space:pre-wrap}.editor-world-edit{display:none}
.editor-storey-quick-settings{position:absolute;right:12px;top:210px;z-index:45;background:white;padding:16px;width:270px;border:1px solid #aaa}
</style><main id="audit"><button id="run">Berliner Geschossentwurf prüfen</button><pre id="result">Bereit</pre></main>`;
const root = document.querySelector<HTMLElement>("#audit")!, output = document.querySelector<HTMLElement>("#result")!;
const scene = new THREE.Scene(), rendered = new THREE.Group(); scene.add(rendered);
const camera = new THREE.PerspectiveCamera(45, 1.5, .1, 2000);
camera.position.set(-10, 45, -110); camera.lookAt(-15, 7, -70); camera.updateMatrixWorld(true);
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const stored = new Map<string, Data>(), posts: Data[] = [], previewReasons: string[] = [], checks: string[] = [];
let handler: (value: Data) => Promise<unknown>, rejectNext = false;
let delayReload = true, releaseReload: (() => void) | null = null;
const initialParent = source.request.commands.find((command: Data) => command.objectTypeId === "planning_build_area");
const parentId = initialParent.objectInstanceId;
for (const command of source.request.commands) stored.set(command.objectInstanceId, clone(command));
function install(): void {
  rendered.clear();
  for (const command of stored.values()) {
    const group = new THREE.Group(), ref = { ...command, anchor: command.position };
    group.userData = { semanticPlanningBuildArea: command.objectTypeId === "planning_build_area", semanticObjectRef: ref };
    if (command.metadata?.constructionCells?.length) {
      const mesh = createConstructionCellMesh(command.metadata.constructionCells, new THREE.MeshBasicMaterial());
      if (mesh) group.add(mesh);
    }
    if (command.metadata?.roofCalculation) for (const mesh of createRoofCalculationMeshes(command.metadata.roofCalculation).meshes) {
      mesh.userData.semanticRoof = true; mesh.userData.semanticObjectRef = ref; group.add(mesh);
    }
    rendered.add(group);
  }
  scene.updateMatrixWorld(true);
}
install();
const fetchOriginal = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = String(input);
  if (url.includes("/storey-fixture/planning-buildings/")) {
    const parent = stored.get(parentId)!;
    return new Response(JSON.stringify({ ok: true, parentRef: { ...parent, anchor: parent.position } }));
  }
  return fetchOriginal(input, init);
};
const input = new Proxy({}, { get: () => () => Promise.resolve() });
const runtime = new Proxy({ getScene: () => scene, getCamera: () => camera, getWorkspaceMode: () => "planning",
  getRenderer: () => null, getSelectedLibraryPlacement: () => ({ valid: false }), getInputController: () => input,
  getTargetCells: () => ({}), setWorldEditIntentHandler: (next: typeof handler) => { handler = next; },
  renderOnce: (reason: string) => { previewReasons.push(reason); }, reloadDirtyChunks: async () => {
    if (delayReload) await new Promise<void>(resolve => { releaseReload = resolve; });
    install();
  },
}, { get: (target, key) => key in target ? (target as Data)[key as string] : () => null });
async function sendCommand(payload: Data): Promise<Data> {
  posts.push(clone(payload));
  assert(payload.type === "ObjectBatch", "Änderung verlässt die atomare Generation");
  if (rejectNext) { rejectNext = false; return { ok: false, error: { statusCode: 409, message: "Test: veraltete Generation" } }; }
  // A deliberately asynchronous reply exposes duplicate-confirm races.
  await new Promise(resolve => setTimeout(resolve, 60));
  for (const [id, child] of stored) if (child.metadata?.generatedFromAreaId === parentId) stored.delete(id);
  for (const command of payload.commands) stored.set(command.objectInstanceId, clone(command));
  install();
  return { ok: true, changed: true, commandStatus: "applied", dirtyChunks: [] };
}
const controller = createWorldEditController({ root,
  bootstrap: { runtime: { chunk: { projectId: "storey-fixture", worldId: "storey-fixture", apiBaseUrl: "/storey-fixture",
    routeHints: { commands: "/storey-fixture/commands" } } } },
  sceneRuntime: runtime,
  worldRuntime: { getRegistry: () => ({ getSnapshot: () => ({ entries: [] }), markChunksDirty: () => {} }), getSource: () => ({ sendCommand }) },
  logger: { warn: (...args: unknown[]) => { root.dataset.warning = JSON.stringify(args); }, debug: () => {} },
} as any);
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function pass(message: string): void { checks.push(`✓ ${message}`); output.textContent = checks.join("\n"); }
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
async function waitFor(check: () => boolean, message: string): Promise<void> {
  for (let i = 0; i < 600; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 25)); }
  throw new Error(`${message}; ${root.querySelector("[data-world-edit-status]")?.textContent}; ${root.dataset.warning ?? ""}`);
}
const query = <T extends Element = HTMLElement,>(selector: string) => root.querySelector<T>(selector)!;
const panel = () => query<HTMLElement>("[data-editor-storey-quick-settings]");
const count = () => Number(query("[data-storey-count]").textContent);
const click = (selector: string) => query<HTMLButtonElement>(selector).click();
async function idle(): Promise<void> {
  await waitFor(() => query("[data-world-edit-status]")?.getAttribute("data-kind") !== "busy", "Controller bleibt beschäftigt");
  await frame();
}
async function select(): Promise<void> {
  const point = new THREE.Vector3(-19, 3, -70), ndc = point.clone().project(camera);
  root.dataset.editorPlanningCursorX = String(ndc.x); root.dataset.editorPlanningCursorY = String(ndc.y);
  await handler({ action: "primary", targetPoint: { x: point.x, y: point.y, z: point.z }, position: { x: -19, y: 3, z: -70 } });
  await handler({ action: "primary-release" });
  await waitFor(() => !panel().hidden, "Berliner Parent wird nicht ausgewählt"); await idle();
}
function pointerCapture(node: Element): void {
  // Synthetic DOM events have no native active pointer. Only capture itself is
  // adapted; production listeners, queue, profiles and controller all run.
  const ids = new Set<number>();
  node.setPointerCapture = id => { ids.add(id); }; node.releasePointerCapture = id => { ids.delete(id); };
  node.hasPointerCapture = id => ids.has(id);
}
function pointer(node: Element, type: string, y: number): void {
  node.dispatchEvent(new PointerEvent(type, { button: 0, pointerId: 33, clientX: 300, clientY: y, bubbles: true }));
}
function dragPixels(): number {
  const parent = stored.get(parentId)!, pts = parent.metadata.pathBrush.points;
  const x = pts.reduce((s: number, p: Data) => s + p.x, 0) / pts.length;
  const z = pts.reduce((s: number, p: Data) => s + p.z, 0) / pts.length;
  const top = new THREE.Vector3(x, parent.position.y + count() * 2.645, z).project(camera);
  const below = new THREE.Vector3(x, parent.position.y + (count() - 1) * 2.645, z).project(camera);
  return Math.max(12, Math.abs(top.y - below.y) * root.getBoundingClientRect().height / 2);
}
document.querySelector<HTMLButtonElement>("#run")!.addEventListener("click", async event => {
  (event.currentTarget as HTMLButtonElement).disabled = true;
  try {
    controller.activate("storey"); await select();
    assert(count() === 4 && posts.length === 0, "Realer Viergeschosser wird falsch geladen oder bereits gespeichert");
    await frame();
    const body = scene.getObjectByName("vectoplan_world_edit_planning_build_area");
    const rebuilds = previewReasons.filter(reason => reason === "world-edit.planning-build-area-preview").length;
    const handle = query<HTMLButtonElement>("[data-storey-drag-handle]"); pointerCapture(handle);
    const pixels = dragPixels(), started = performance.now();
    pointer(handle, "pointerdown", 200);
    for (let i = 1; i <= 240; i++) pointer(handle, "pointermove", 200 + pixels * i / 240);
    pointer(handle, "pointerup", 200 + pixels);
    const milliseconds = performance.now() - started;
    await frame(); await frame();
    assert(count() === 3, `Letzter Abwärtswert verloren: ${count()} statt 3`);
    assert(posts.length === 0, "Loslassen speichert bereits");
    assert(scene.getObjectByName("vectoplan_world_edit_planning_build_area") === body, "Drag baut volle Blockgeometrie neu");
    click("[data-storey-remove]"); click("[data-storey-remove]"); click("[data-storey-add]"); click("[data-storey-add]");
    assert(count() === 3 && posts.length === 0, "Schnelle +/- Klicks werden verloren oder gespeichert");
    assert(previewReasons.filter(reason => reason === "world-edit.planning-build-area-preview").length === rebuilds,
      "Lokale +/- Änderungen regenerieren die komplette Geometrie");
    pass(`Echter Berliner Parent: 240 Abwärtsereignisse in ${milliseconds.toFixed(1)} ms, letzter Wert 3; kein Save und kein Block-Neuaufbau`);
    const height = query<HTMLInputElement>("[data-storey-boundary-height]"); height.value = "2.395";
    height.dispatchEvent(new Event("change", { bubbles: true }));
    assert(posts.length === 0, "Numerische Deckengrenze speichert automatisch");
    click("[data-storey-confirm]"); click("[data-storey-confirm]");
    await waitFor(() => posts.length === 1 && panel().hidden && releaseReload !== null, "Bestätigen schließt nicht vor langsamem Chunkreload");
    assert(query<HTMLButtonElement>("[data-storey-drag-handle]").hidden, "Griff bleibt während Chunkreload ausgewählt");
    delayReload = false; releaseReload!(); await idle();
    const parent = stored.get(parentId)!;
    assert(parent.metadata.storeyCount === 3, "Bestätigung speichert falsche Geschossanzahl");
    assert(parent.metadata.storeyProfile.heightProfile.boundariesByScope.all[1] === 2.395, "Grenzvorschau fehlt im finalen Save");
    assert(query<HTMLButtonElement>("[data-storey-drag-handle]").hidden, "Griff bleibt nach Bestätigen ausgewählt");
    pass("Bestätigen: genau eine atomare Generation trotz Doppelklick; drei Geschosse und 2,395-m-Decke gespeichert, Menü und Auswahl bereits vor Chunkreload geschlossen");
    await select(); await frame();
    const cancelHandle = query<HTMLButtonElement>("[data-storey-drag-handle]"); pointerCapture(cancelHandle);
    pointer(cancelHandle, "pointerdown", 200); pointer(cancelHandle, "pointermove", 200 + dragPixels());
    pointer(cancelHandle, "pointercancel", 200 + dragPixels()); await frame();
    assert(count() === 3 && posts.length === 1, "Abbruch spielt wartenden Abwärtswert erneut ab");
    click("[data-storey-remove]"); assert(count() === 2, "Lokaler Rückbau fehlt");
    click("[data-storey-close]"); await select();
    assert(count() === 3 && posts.length === 1, "Schließen verwirft den Entwurf nicht");
    pass("Abbruch: wartende Dragwerte gelöscht; × verwirft den lokalen Rückbau ohne Save");
    click("[data-storey-remove]"); rejectNext = true; click("[data-storey-confirm]");
    await waitFor(() => posts.length === 2, "Fehlerversuch fehlt"); await idle();
    assert(!panel().hidden && count() === 2, "Fehlgeschlagene Bestätigung verliert den Entwurf");
    assert(stored.get(parentId)!.metadata.storeyCount === 3, "Fehlgeschlagener Save verändert den gespeicherten Parent");
    click("[data-storey-confirm]"); await waitFor(() => posts.length === 3 && panel().hidden, "Erneute Bestätigung hängt");
    assert(stored.get(parentId)!.metadata.storeyCount === 2, "Erneute Bestätigung speichert falsche Anzahl");
    pass("Abgewiesene Generation: lokaler Entwurf bleibt korrigierbar; erneute Bestätigung übernimmt genau zwei Geschosse");
    await select(); click("[data-storey-remove]"); controller.activate("selection"); await idle();
    assert(posts.length === 3, "Werkzeugwechsel speichert den unbestätigten Entwurf");
    controller.activate("storey"); await select();
    assert(count() === 2, "Werkzeugwechsel erhält unbestätigte Anzahl");
    pass("Werkzeugwechsel verwirft unbestätigte Geschossänderung und erzeugt keine weitere Generation");
    output.textContent = `PASS\n${checks.join("\n")}`; document.documentElement.dataset.auditResult = "pass";
  } catch (error) {
    output.textContent = `FAIL: ${String(error)}\n${checks.join("\n")}`; document.documentElement.dataset.auditResult = "fail";
  }
});
