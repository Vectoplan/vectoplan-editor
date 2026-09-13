import * as THREE from "three";
import "../../src/frontend/styles/world_edit.css";
import { createSceneRuntime, semanticObjectRefs } from "../../src/frontend/scene/scene_runtime";
import { createDefaultEditorBootstrap } from "../../src/frontend/bootstrap/default_bootstrap";
import { bindEditorDomRefs } from "../../src/frontend/dom/dom_refs";
import { createInitialEditorState } from "../../src/frontend/state/editor_state";
import { createEditorStore } from "../../src/frontend/state/editor_store";
import { createChunkRegistry } from "../../src/frontend/runtime/world/chunk_registry";
import { createRuntimeChunkContent } from "../../src/frontend/runtime/world/chunk_content";
import { createWorldEditController } from "../../src/frontend/world_edit/world_edit_controller";
import { createFlatRoofCalculation } from "../../src/frontend/world_edit/systems/roof/courtyard";

// Real SceneRuntime, frame loop, InputController, MouseInput, KeyboardInput,
// planning navigation and WorldEditController. Only transport is isolated.
// This page never reads/writes a user project or opens a multiplayer session.
document.body.innerHTML = `<style>body{font:14px system-ui;margin:12px;background:#edf2f5}pre{white-space:pre-wrap}
#audit{position:relative;width:1160px;height:700px}[data-editor-canvas-host]{width:100%;height:100%}
.editor-world-edit{display:none!important}[hidden]{display:none!important}</style>
<button id="run">Echte Szenen- und Paneleingaben prüfen</button>
<a href="?pointerLock=1">Echten Pointer-Lock-Wiedereinstieg prüfen</a><pre id="result">Bereit</pre>
<main id="audit"><div data-editor-canvas-host></div></main>`;
type Data = Record<string, any>;
const root = document.querySelector<HTMLElement>("#audit")!, output = document.querySelector<HTMLElement>("#result")!;
const checks: string[] = [], diagnostics: Data[] = [], posts: Data[] = [], errors: unknown[] = [];
const requests: string[] = [], pointerEvents: Data[] = [];
const pointerLockAudit = new URL(location.href).searchParams.get("pointerLock") === "1";
const NativeWorker = globalThis.Worker;
globalThis.Worker = class extends NativeWorker {
  constructor() { super(new URL("./chunk-mesh-worker.js", import.meta.url), { type: "module" }); }
} as typeof Worker;
class IsolatedSocket extends EventTarget {
  static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
  readyState = 0; onopen = null; onclose = null; onerror = null; onmessage = null;
  close(): void { this.readyState = 3; }
  send(): void { throw new Error("No multiplayer writes in the fixture"); }
}
globalThis.WebSocket = IsolatedSocket as unknown as typeof WebSocket;
const bootstrap = structuredClone(createDefaultEditorBootstrap(undefined, { enabled: false }));
(bootstrap.inventory as Data).enabled = false; (bootstrap.runtime.inventory as Data).enabled = false;
(bootstrap.input as Data).pointerLockEnabled = pointerLockAudit; (bootstrap.featureFlags as Data).physicsEnabled = false;
(bootstrap.camera as Data).spawn = { x: 8, y: 10, z: 23 };
(bootstrap.camera as Data).rotation = { pitch: -.45, yaw: 0, roll: 0 };
(bootstrap.runtime.chunk as Data).projectId = "input-fixture"; (bootstrap.runtime.chunk as Data).worldId = "input-fixture";
(bootstrap.runtime.chunk as Data).apiBaseUrl = "/isolated-input-fixture";
const isolatedProjectBase = "/isolated-input-fixture/projects/input-fixture/worlds/input-fixture";
(bootstrap.runtime.chunk as Data).routeHints = { commands: `${isolatedProjectBase}/commands` };
const registry = createChunkRegistry({ defaultChunkSize: 16 });
const footprint = [[2, 2], [12, 2], [12, 12], [2, 12]];
const calculation = createFlatRoofCalculation(footprint.map(([x, z]) => ({ x: x!, y: 7, z: z! })), 7000, [], 180) as Data;
calculation.input_fingerprint = "isolated-input-roof";
calculation.source = "lod2-original-surfaces";
const roofRef = { objectTypeId: "building_roof", objectKind: "semantic_footprint", objectInstanceId: "isolated-input-roof",
  anchor: { x: 2, y: 7, z: 2 }, dimensions: { x: 10, y: 1, z: 10 }, primaryChunkKey: "0:0:0",
  occupiedCells: [{ x: 2, y: 7, z: 2 }], fillBlockTypeId: "lod2_exterior_wall",
  footprint: { type: "Polygon", coordinateSpace: "world-cell-xz", coordinates: [footprint], baseY: 7, height: .18 },
  metadata: { voxelOccupancy: "none", lod2BuildingId: "isolated-input-building", roofCalculation: calculation,
    roofParameters: { roofType: "imported", eavesHeightMm: 7000, pitchDeg: 0, importedSource: {
      schemaVersion: "lod2-roof-source.v1", buildingId: "isolated-input-building", groundFootprints: [[footprint]],
      footprint: [footprint], baseY: 7, faces: calculation.geometry.faces,
      facadeSegments: footprint.map((start, index) => ({ start, end: footprint[(index + 1) % footprint.length], minimumY: 1, maximumY: 7 })),
    } } } };
for (let x = -1; x <= 1; x++) for (let z = -1; z <= 2; z++) {
  const cells = new Array(4096).fill(0);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) cells[lx + lz * 256] = 1;
  // Cell 11 occupies [11,12]; cell 12 would protrude beyond the stored roof
  // and GroundSurface and make a genuine facade hit select outside the building.
  if (x === 0 && z === 0) for (let y = 1; y < 7; y++) for (let i = 2; i < 12; i++) {
    cells[i + y * 16 + 2 * 256] = 2; cells[i + y * 16 + 11 * 256] = 2;
    cells[2 + y * 16 + i * 256] = 2; cells[11 + y * 16 + i * 256] = 2;
  }
  registry.setChunk(createRuntimeChunkContent({ projectId: "input-fixture", worldId: "input-fixture", chunkKey: `${x}:0:${z}`,
    chunkX: x, chunkY: 0, chunkZ: z, chunkSize: 16, cellSize: 1, chunkRevision: 1, cells,
    palette: [{ cellValue: 1, blockTypeId: "fixture_ground", solid: true, breakable: true },
      { cellValue: 2, blockTypeId: "lod2_exterior_wall", solid: true, breakable: true }],
    stats: {}, metadata: {}, source: "chunk-service", objectRefs: x === 0 && z === 0 ? [roofRef] : [] } as any), { visible: true });
}
const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.href);
  requests.push(url.pathname);
  if (url.pathname === `${isolatedProjectBase}/lod2-buildings/isolated-input-building`) return Response.json({ ok: true,
    buildingId: "isolated-input-building", objectRefs: [roofRef], originalRoofObjectIds: [roofRef.objectInstanceId], parentRef: null });
  if (url.pathname.startsWith("/isolated-input-fixture") || /\/commands|\/planning-buildings\/|\/lod2-buildings\/|\/api\//.test(url.pathname)) {
    throw new Error(`Fixture has no handler for project request: ${url.pathname}`);
  }
  return nativeFetch(input, init);
};
const listeners = new Set<(event: Data) => void>();
const source = { subscribe: (listener: (event: Data) => void) => { listeners.add(listener); return () => listeners.delete(listener); },
  getLoadedChunkKeys: () => registry.getChunkKeys(), getSummary: () => ({ status: "ready", loadedChunkCount: registry.getStats().chunkCount }),
  getDirtyChunkKeys: () => [], markChunkDirty: () => [], sendCommand: async (payload: Data) => { posts.push(payload); return { ok: true, changed: false }; } };
const loader = { loadCoordinates: async () => ({ ok: true, chunks: [], failedChunkKeys: [] }), getSnapshot: () => ({
  status: "ready", loadedChunkKeys: registry.getChunkKeys(), visibleChunkKeys: registry.getChunkKeys(),
  dirtyChunkKeys: [], lastLoadedChunkKeys: [], lastFailedChunkKeys: [], lastError: null,
  pendingLoadCount: 0, activeBatchRequestCount: 0, queuedBatchRequestCount: 0,
}) };
const world = { initialize: async () => {}, getRegistry: () => registry, getSource: () => source, getLoader: () => loader,
  getStatus: () => "ready", getSnapshot: () => ({ status: "ready", loadedChunkKeys: registry.getChunkKeys() }),
  loadAroundChunk: async () => [], requestFullRefresh: async () => {}, reloadDirtyChunks: async () => {},
  sampleCell: registry.sampleCellByWorldPosition, getCollisionCell: registry.getCollisionCell };
const store = createEditorStore({ initialState: createInitialEditorState({ bootstrap, bootId: "real-input-audit", buildMode: "test", buildVersion: "test", createdAt: new Date().toISOString() }) });
const logger = { warn: (...args: unknown[]) => errors.push(args), error: (...args: unknown[]) => errors.push(args), debug: () => {} };
const runtime = createSceneRuntime({ bootstrap, domRefs: bindEditorDomRefs(root), store, worldRuntime: world as any, chunkApiClient: {} as any, logger: logger as any });
let controller: ReturnType<typeof createWorldEditController>;
const panel = () => root.querySelector<HTMLElement>("[data-editor-line-brush-quick-settings]")!;
const canvas = () => runtime.getRenderer()!.domElement;
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
async function frames(count = 3) { for (let i = 0; i < count; i++) await frame(); }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function pass(message: string) { checks.push(`✓ ${message}`); output.textContent = checks.join("\n"); }
async function wait(check: () => boolean, message: string) {
  for (let i = 0; i < 300; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  throw new Error(message);
}
function state(label: string) { const input = runtime.getInputController()!; diagnostics.push({ label, mode: runtime.getWorkspaceMode(),
  input: input.getSnapshot(), mouse: input.getMouseInput().getSnapshot(), keyboard: input.getKeyboardInput().getSnapshot(),
  camera: runtime.getCamera()!.position.toArray(), rotation: runtime.getCamera()!.quaternion.toArray(), panel: !panel()?.hidden }); }
function pointer(type: string, x: number, y: number, button = 0, buttons = 0, dx = 0, dy = 0) {
  canvas().dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 47, pointerType: "mouse", isPrimary: true,
    clientX: x, clientY: y, button, buttons, movementX: dx, movementY: dy }));
}
async function clickWorld(point: THREE.Vector3) {
  const p = point.clone().project(runtime.getCamera()!), rect = canvas().getBoundingClientRect();
  const x = rect.left + (p.x + 1) * rect.width / 2, y = rect.top + (1 - p.y) * rect.height / 2;
  assert(p.z > -1 && p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1, "Fixture-Ziel liegt außerhalb der Kamera");
  pointer("pointermove", x, y); await frames(); pointer("pointerdown", x, y, 0, 1); await frames(); pointer("pointerup", x, y, 0, 0); await frames();
  assert(runtime.getInputController()!.getSnapshot().input.pointer.pressedButtons.length === 0,
    "Pointerup mit buttons=0 lässt im echten InputState eine Taste gedrückt");
}
async function drag(button: number, dx: number, dy: number) {
  const rect = canvas().getBoundingClientRect(), x = rect.left + 220, y = rect.top + 480, buttons = button === 1 ? 4 : button === 2 ? 2 : 1;
  canvas().tabIndex = 0; canvas().focus(); pointer("pointermove", x, y); await frames();
  pointer("pointerdown", x, y, button, buttons); await frame();
  for (let step = 1; step <= 4; step++) { pointer("pointermove", x + dx * step / 4, y + dy * step / 4, button, buttons, dx / 4, dy / 4); await frame(); }
  pointer("pointerup", x + dx, y + dy, button, 0); await frames();
}
async function buildingPanel() {
  runtime.setWorkspaceMode("planning", "real-input-audit"); controller.activate("room"); await frames(6);
  if (!panel().hidden) return;
  const find = () => {
    const scene = runtime.getScene()!; let result: THREE.Object3D | null = null;
    scene.traverse(object => { if (object.visible && (object.userData.worldEditLineBrushSettings || object.name === "vectoplan_world_edit_building_settings")) result ??= object; });
    return result;
  };
  await wait(() => !!find(), "Echte Gebäudeaktionen fehlen");
  await clickWorld(find()!.getWorldPosition(new THREE.Vector3()));
  await wait(() => !panel().hidden, "Echtes Pointerevent öffnet Linienbrush-Panel nicht");
}
async function ego(label: string) {
  runtime.setWorkspaceMode("first-person", `real-input-${label}`); await frames(); state(`${label}:before`);
  assert(!panel().hidden, "Panel verschwindet beim Wechsel nach Ego");
  const camera = runtime.getCamera()!, rotation = camera.quaternion.clone();
  await drag(1, 64, -12);
  assert(camera.quaternion.angleTo(rotation) > .005, `${label}: reale Ego-Mausbewegung erreicht die Kamera nicht`);
  const position = camera.position.clone();
  canvas().dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, code: "KeyW", key: "w" }));
  await frames(8);
  canvas().dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, code: "KeyW", key: "w" })); await frames();
  assert(camera.position.distanceTo(position) > .01, `${label}: reales WASD erreicht die Kamera nicht`);
  assert(!panel().hidden, "Ego-Bewegung schließt das Panel"); state(`${label}:after`); pass(`${label}: echte Ego-Maus- und WASD-Ereignisse bewegen die Kamera bei offenem Panel.`);
}
async function prepareNativePointerLockAudit() {
  await buildingPanel();
  runtime.setWorkspaceMode("first-person", "real-input-native-lock"); await frames();
  assert(runtime.getInputController()!.getPointerLock(), "Echte PointerLock-Instanz fehlt");
  assert(!panel().hidden && document.pointerLockElement === null, "Panel muss vor Canvas-Klick offen und die Maus frei sein");
  let phase = 1, locked = false, moved = false, walked = false, completing = false;
  let rotation = runtime.getCamera()!.quaternion.clone();
  const lockDiagnostics = document.createElement("pre");
  lockDiagnostics.id = "native-lock-diagnostics";
  output.insertAdjacentElement("afterend", lockDiagnostics);
  let lastNativeDown: Data | null = null;
  const describeLock = (reason: string) => {
    const input = runtime.getInputController()!.getSnapshot(), lock = input.pointerLock, mouse = input.mouse;
    const error = lock?.lastError;
    const errorText = error ? `${String(error.name ?? "Error")}: ${String(error.message ?? "unbekannt").slice(0, 240)}` : "keiner";
    lockDiagnostics.textContent = [
      `Klick: trusted=${String(lastNativeDown?.trusted ?? "–")}; target=${String(lastNativeDown?.target ?? "–")}; Canvas=${String(lastNativeDown?.canvas ?? "–")}; Benutzeraktivierung=${String(lastNativeDown?.activation ?? "–")}`,
      `PointerLock (${reason}): status=${lock?.status}; enabled=${lock?.enabled}; available=${lock?.available}; locked=${lock?.locked}; requests=${lock?.requestCount}; Erfolge=${lock?.successCount}; Fehler=${errorText}`,
      `Input: enabled=${input.enabled}; mouse=${mouse.enabled}/${mouse.status}; activation=${mouse.pointerLockActivationCount}; suppressed=${mouse.suppressedActionCount}; down/up=${mouse.pointerDownCount}/${mouse.pointerUpCount}; trigger=${input.lastTrigger}; Dokumentfokus=${document.hasFocus()}`,
    ].join("\n");
  };
  window.addEventListener("pointerdown", event => {
    if (!(event.target instanceof Element) || !root.contains(event.target)) return;
    lastNativeDown = { trusted: event.isTrusted, target: `${event.target.tagName.toLowerCase()}${event.target.id ? `#${event.target.id}` : ""}`,
      canvas: event.target === canvas(), activation: navigator.userActivation?.isActive ?? null };
    window.setTimeout(() => describeLock("250 ms nach Klick"), 250);
    window.setTimeout(() => describeLock("1500 ms nach Klick"), 1500);
  }, { capture: true });
  document.addEventListener("pointerlockerror", () => window.setTimeout(() => describeLock("Browser-pointerlockerror"), 0));
  const explain = () => {
    root.dataset.pointerLockResult = `ready-${phase}`;
    output.textContent = checks.join("\n") + `\nPointer-Lock ${phase}/2: Canvas links anklicken, Maus bewegen und W kurz gedrückt halten. Das Linienbrush-Panel bleibt offen.`;
    state(`native-lock-${phase}:ready`);
    describeLock("bereit");
  };
  const fail = (error: unknown) => {
    state(`native-lock-${phase}:failure`); root.dataset.pointerLockResult = "fail";
    output.textContent += `\nFAIL ${error instanceof Error ? error.message : String(error)}\nDiagnose: window.realInputAudit`;
  };
  const complete = async () => {
    if (!moved || !walked || completing) return;
    completing = true;
    try {
      assert(!panel().hidden && document.pointerLockElement === canvas(), "Navigation hat das Panel oder Pointer-Lock verloren");
      assert(posts.length === 0, "Canvas-Aktivierung löst einen Schreibbefehl aus");
      state(`native-lock-${phase}:passed`);
      pass(`Pointer-Lock ${phase}/2: echter Canvas-Klick sperrt den Zeiger; echte Mausbewegung und W bewegen die Ego-Kamera bei offenem Panel.`);
      document.exitPointerLock();
      await wait(() => document.pointerLockElement === null, "Native Mausfreigabe fehlt");
      if (phase === 2) {
        root.dataset.pointerLockResult = "pass"; root.dataset.result = "pass";
        output.textContent = checks.join("\n") + "\nPASS – zweimaliger nativer Pointer-Lock-Wiedereinstieg, keine Projektänderung";
        return;
      }
      phase = 2; locked = false; moved = false; walked = false;
      runtime.setWorkspaceMode("planning", "real-input-native-release"); await frames();
      await buildingPanel(); runtime.setWorkspaceMode("first-person", "real-input-native-reentry"); await frames();
      completing = false; explain();
    } catch (error) { fail(error); }
  };
  document.addEventListener("pointerlockchange", () => {
    locked = document.pointerLockElement === canvas();
    state(`native-lock-${phase}:change`);
    describeLock("Browser-pointerlockchange");
    if (locked) {
      rotation = runtime.getCamera()!.quaternion.clone();
      root.dataset.pointerLockResult = `locked-${phase}`;
      output.textContent = checks.join("\n") + `\nPointer-Lock ${phase}/2 aktiv. Jetzt Maus bewegen und W kurz gedrückt halten.`;
    }
  });
  window.addEventListener("pointermove", async event => {
    if (!event.isTrusted || !locked || completing || !(event.movementX || event.movementY)) return;
    await frames(2);
    moved ||= runtime.getCamera()!.quaternion.angleTo(rotation) > .005;
    await complete();
  });
  window.addEventListener("keydown", async event => {
    if (!event.isTrusted || event.code !== "KeyW" || event.repeat || !locked || completing) return;
    const position = runtime.getCamera()!.position.clone(); await frame();
    walked ||= runtime.getCamera()!.position.distanceTo(position) > 1e-7;
    await complete();
  });
  explain();
}
document.querySelector<HTMLButtonElement>("#run")!.onclick = async event => {
  (event.currentTarget as HTMLButtonElement).disabled = true;
  try {
    assert(semanticObjectRefs(registry.getChunk("0:0:0")!).some(ref => ref.objectInstanceId === roofRef.objectInstanceId),
      "Testdach erfüllt den produktiven SemanticObjectRef-Vertrag nicht");
    await runtime.initialize();
    controller = createWorldEditController({ root, bootstrap, sceneRuntime: runtime, worldRuntime: world as any, logger: logger as any });
    await wait(() => runtime.getSnapshot().pendingChunkMeshCount === 0, "Echte Worker-Geometrie noch nicht bereit");
    assert(root.dataset.sceneRuntimeChunkMeshingThread === "worker", "Fixture nutzt keinen echten Worker");
    let renderedRoof = false;
    runtime.getScene()!.traverseVisible(object => {
      if (object.userData.semanticRoof && object.userData.objectInstanceId === roofRef.objectInstanceId) renderedRoof = true;
    });
    assert(renderedRoof, "Gültiges Testdach wurde nicht über den produktiven Runtimepfad gerendert");
    for (const type of ["pointerdown", "pointerup", "pointercancel"]) window.addEventListener(type, event => {
      const pointerEvent = event as PointerEvent;
      pointerEvents.push({ type, trusted: pointerEvent.isTrusted, button: pointerEvent.button, buttons: pointerEvent.buttons,
        state: runtime.getInputController()!.getSnapshot().input.pointer.pressedButtons });
    });
    if (pointerLockAudit) { await prepareNativePointerLockAudit(); return; }
    await buildingPanel(); await ego("Linienbrush");
    runtime.setWorkspaceMode("planning", "real-input-planning"); await frames();
    let position = runtime.getCamera()!.position.clone(); await drag(1, 45, 18);
    assert(runtime.getCamera()!.position.distanceTo(position) > .1, "Planungs-Pan ist bei offenem Panel blockiert");
    position = runtime.getCamera()!.position.clone();
    const rect = canvas().getBoundingClientRect();
    canvas().dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 90, clientX: rect.left + 220, clientY: rect.top + 480 })); await frames();
    assert(runtime.getCamera()!.position.distanceTo(position) > .1, "Planungs-Zoom ist bei offenem Panel blockiert");
    position = runtime.getCamera()!.position.clone(); panel().dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 90 })); await frames();
    assert(runtime.getCamera()!.position.distanceTo(position) < 1e-7, "Scrollen im Panel bewegt die Kamera");
    pass("Planung: echte mittlere Maustaste und Mausrad funktionieren im Canvas; Panelereignisse bleiben im Panel.");
    controller.deactivate("real-input-release-primary"); await frames(); const rotation = runtime.getCamera()!.quaternion.clone(); await drag(0, 40, 16);
    assert(runtime.getCamera()!.quaternion.angleTo(rotation) > .005, "Planungs-Orbit funktioniert nach Werkzeugfreigabe nicht");
    pass("Planung: freigegebene primäre Mausgeste dreht die Kamera; im Linienbrush gehört sie der Punktbearbeitung.");
    runtime.resetPlanningView("real-input-storey-fixture-framing");
    controller.activate("storey"); await frames();
    const facadePoint = [new THREE.Vector3(2, 4, 7), new THREE.Vector3(12, 4, 7),
      new THREE.Vector3(7, 4, 2), new THREE.Vector3(7, 4, 12)].sort((left, right) =>
      left.distanceToSquared(runtime.getCamera()!.position) - right.distanceToSquared(runtime.getCamera()!.position))[0]!;
    await clickWorld(facadePoint);
    await wait(() => !root.querySelector<HTMLElement>("[data-editor-storey-quick-settings]")!.hidden, "Echter Fassadenklick öffnet Geschosspanel nicht");
    await buildingPanel(); await ego("Nach Geschosswerkzeug");
    runtime.setWorkspaceMode("planning", "real-input-roof"); runtime.resetPlanningView("real-input-roof-fixture-framing");
    controller.activate("roof");
    const findRoofGear = () => runtime.getScene()!.getObjectByName(`vectoplan_world_edit_roof_settings:${roofRef.objectInstanceId}`);
    try { await wait(() => !!findRoofGear()?.visible, "Dachaktion fehlt nach sechs Sekunden"); }
    catch (error) {
      let roofCount = 0, visibleRoofCount = 0;
      const names: string[] = [];
      runtime.getScene()!.traverse(object => {
        if (object.userData.semanticRoof) roofCount++;
        if (/roof.*settings|persisted_roof|roof_zone/.test(object.name) && names.length < 6) {
          let branchVisible = object.visible;
          for (let ancestor = object.parent; ancestor; ancestor = ancestor.parent) branchVisible &&= ancestor.visible;
          names.push(`${object.name}[sichtbar=${object.visible},Zweig=${branchVisible}]`);
        }
      });
      runtime.getScene()!.traverseVisible(object => { if (object.userData.semanticRoof) visibleRoofCount++; });
      throw new Error(`${error instanceof Error ? error.message : String(error)}; Dächer=${visibleRoofCount}/${roofCount}; Werkzeug=${root.dataset.worldEditTool}; Objekte=${names.join(", ") || "keine Dachaktionen"}`);
    }
    await clickWorld(findRoofGear()!.getWorldPosition(new THREE.Vector3()));
    await frames(); state("roof-panel");
    await buildingPanel(); await ego("Nach Dachwerkzeug");
    assert(posts.length === 0, "Reine Panel-/Kameraprüfung hat einen Schreibbefehl ausgelöst");
    output.textContent = checks.join("\n") + "\nPASS – echte Runtime/Input/Worker, keine Projektänderung"; root.dataset.result = "pass";
  } catch (error) {
    if (runtime.getInputController()) state("failure");
    output.textContent = checks.join("\n") + "\nFAIL " + (error instanceof Error ? error.message : String(error))
      + `\n${diagnostics.length} Zustände, ${errors.length} Hinweise; Details: window.realInputAudit`;
    root.dataset.result = "fail";
  }
};
(window as any).realInputAudit = { runtime, registry, diagnostics, posts, errors, requests, pointerEvents, get controller() { return controller; } };
