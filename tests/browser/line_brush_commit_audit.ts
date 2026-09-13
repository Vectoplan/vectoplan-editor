import * as THREE from "three";
import { createWorldEditController } from "../../src/frontend/world_edit/world_edit_controller";
import { createConstructionCellMesh } from "../../src/frontend/scene/construction_cell_rendering";
import { createRoofCalculationMeshes } from "../../src/frontend/scene/roof_calculation_rendering";
import berlinZip from "../fixtures/berlin-storey-parent.json.gz";

// Real Berlin generation 951. CAD requests are calculation-only; all project
// writes are intercepted, including rejected, delayed and lost-response saves.
type Data = Record<string, any>;
const original = JSON.parse(await new Response(new Blob([berlinZip]).stream()
  .pipeThrough(new DecompressionStream("gzip"))).text());
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
document.body.innerHTML = `<style>[hidden]{display:none!important}body{font:14px system-ui}pre{white-space:pre-wrap}
#audit{position:relative;width:1100px;min-height:850px}.editor-world-edit{display:none}</style>
<button id="run">Bestätigen vollständig prüfen</button><pre id="result">Bereit · tatsächlicher Berliner Viergeschosser</pre><main id="audit"></main>`;
const root = document.querySelector<HTMLElement>("#audit")!, output = document.querySelector<HTMLElement>("#result")!;
const checks: string[] = [];
const realFetch = window.fetch.bind(window);
let active: ReturnType<typeof fixture> | null = null;
window.fetch = (input, init) => active?.fetch(String(input), init) ?? realFetch(input, init);
const assert = (value: unknown, message: string): asserts value => { if (!value) throw new Error(message); };
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function pass(message: string): void { checks.push(`✓ ${message}`); output.textContent = checks.join("\n"); }
async function waitFor(check: () => boolean, message: string, milliseconds = 10000): Promise<void> {
  const until = performance.now() + milliseconds;
  while (performance.now() < until) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 25)); }
  throw new Error(`${message}; ${root.querySelector("[data-world-edit-status]")?.textContent}; ${root.dataset.warning ?? ""}`);
}
function fixture() {
  root.replaceChildren();
  const scene = new THREE.Scene(), rendered = new THREE.Group(); scene.add(rendered);
  let sceneTraversals = 0, sceneTraversalMs = 0;
  const traverse = scene.traverse.bind(scene);
  scene.traverse = callback => { const start = performance.now(); sceneTraversals++; traverse(callback); sceneTraversalMs += performance.now() - start; };
  const camera = new THREE.PerspectiveCamera(45, 1.5, .1, 2000);
  camera.position.set(-10, 45, -110); camera.lookAt(-15, 7, -70); camera.updateMatrixWorld(true);
  const stored = new Map<string, Data>(), posts: Data[] = [];
  for (const command of original.request.commands) stored.set(command.objectInstanceId, clone(command));
  const parentId = original.request.commands.find((c: Data) => c.objectTypeId === "planning_build_area").objectInstanceId;
  let handler: (value: Data) => Promise<unknown>;
  let roofMode: "normal" | "delay" | "hang" = "normal", saveMode: "normal" | "failed" | "delay" | "lost" = "normal";
  let delayReload = false, delayMeshes = false, reloadStarted = false, roofStarted = false;
  const releaseRoofs: (() => void)[] = [];
  let releaseSave: (() => void) | null = null, releaseReload: (() => void) | null = null;
  const receipts = new Map<string, Data>();
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
  const input = new Proxy({}, { get: () => () => Promise.resolve() });
  const runtime = new Proxy({ getScene: () => scene, getCamera: () => camera, getWorkspaceMode: () => "planning",
    getRenderer: () => null, getSelectedLibraryPlacement: () => ({ valid: false }), getInputController: () => input,
    getTargetCells: () => ({}), setWorldEditIntentHandler: (value: typeof handler) => { handler = value; },
    renderOnce: () => {}, reloadDirtyChunks: async () => {
      reloadStarted = true;
      if (delayReload) await new Promise<void>(resolve => { releaseReload = resolve; });
      if (!delayMeshes) install();
    },
  }, { get: (target, key) => key in target ? (target as Data)[key as string] : () => null });
  async function sendCommand(payload: Data): Promise<Data> {
    posts.push(clone(payload));
    assert(payload.type === "ObjectBatch", "Mutation umgeht atomare Generation");
    if (saveMode === "failed") return { ok: false, error: { statusCode: 409, message: "Test: Generation wurde zwischenzeitlich geändert" } };
    if (saveMode === "delay") await new Promise<void>(resolve => { releaseSave = resolve; });
    if (!receipts.has(payload.commandId)) {
      for (const [id, child] of stored) if (child.metadata?.generatedFromAreaId === parentId) stored.delete(id);
      for (const command of payload.commands) stored.set(command.objectInstanceId, clone(command));
      receipts.set(payload.commandId, { ok: true, changed: true, commandStatus: "applied", dirtyChunks: [] });
    }
    return saveMode === "lost" ? { ok: false, error: { statusCode: 504, message: "Test: Commitantwort verloren" } } : receipts.get(payload.commandId)!;
  }
  const controller = createWorldEditController({ root,
    bootstrap: { runtime: { chunk: { projectId: "commit-audit", worldId: "commit-audit", apiBaseUrl: "/commit-audit",
      routeHints: { commands: "/commit-audit/commands" } } } }, sceneRuntime: runtime,
    worldRuntime: { getRegistry: () => ({ getSnapshot: () => ({ entries: [] }), markChunksDirty: () => {} }), getSource: () => ({ sendCommand }) },
    logger: { warn: (...args: unknown[]) => { root.dataset.warning = JSON.stringify(args); }, debug: () => {} },
  } as any);
  const panel = () => root.querySelector<HTMLElement>("[data-editor-line-brush-quick-settings]")!;
  const button = () => root.querySelector<HTMLButtonElement>("[data-line-brush-generate]")!;
  function change(selector: string, value: string): void {
    const input = root.querySelector<HTMLInputElement>(selector)!; input.value = value; input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  async function openSceneSettings(name: string): Promise<void> {
    await waitFor(() => !!scene.getObjectByName(name), `Editier-Zahnrad fehlt: ${name}`);
    await frame();
    const gear = scene.getObjectByName(name)!;
    const world = gear.getWorldPosition(new THREE.Vector3()), projected = world.clone().project(camera);
    root.dataset.editorPlanningCursorX = String(projected.x); root.dataset.editorPlanningCursorY = String(projected.y);
    await handler({ action: "primary", targetPoint: world, position: world }); await handler({ action: "primary-release" });
    await waitFor(() => !panel().hidden && !button().disabled, "Bestätigungsfenster öffnet nicht");
  }
  async function open(): Promise<void> {
    controller.activate("room");
    const point = new THREE.Vector3(-19, 2, -70), ndc = point.clone().project(camera);
    root.dataset.editorPlanningCursorX = String(ndc.x); root.dataset.editorPlanningCursorY = String(ndc.y);
    await handler({ action: "primary", targetPoint: { x: point.x, y: point.y, z: point.z }, position: { x: -19, y: 2, z: -70 } });
    await handler({ action: "primary-release" });
    // Room selection starts the authoritative lookup asynchronously; completion
    // of the pointer intent alone does not mean that the edit handles exist.
    await waitFor(() => root.querySelector<HTMLInputElement>("[data-line-brush-storey-count]")?.value === "4"
      && !!scene.getObjectByName("vectoplan_world_edit_building_settings")
      && root.querySelector("[data-world-edit-status]")?.getAttribute("data-kind") !== "busy",
    "Berliner Bestandsübernahme stellt vier Geschosse und Editier-Zahnrad nicht bereit");
    await frame();
    await openSceneSettings("vectoplan_world_edit_building_settings");
  }
  return { scene, controller, panel, button, posts, parent: () => stored.get(parentId)!, change, open, openSceneSettings,
    stage: () => ({ roofStarted, reloadStarted, saveWaiting: releaseSave !== null, sceneTraversals, sceneTraversalMs }),
    setRoof: (value: typeof roofMode) => { roofMode = value; }, setSave: (value: typeof saveMode) => { saveMode = value; },
    slowReload: () => { delayReload = true; },
    slowMeshes: () => { delayMeshes = true; },
    releaseMeshes: () => { delayMeshes = false; install(); },
    release: () => { roofMode = "normal"; releaseRoofs.splice(0).forEach(resolve => resolve()); releaseSave?.(); releaseReload?.(); },
    fetch: async (url: string, init?: RequestInit): Promise<Response> => {
      if (url.includes("/commit-audit/planning-buildings/")) { const parent = stored.get(parentId)!;
        return new Response(JSON.stringify({ ok: true, parentRef: { ...parent, anchor: parent.position } })); }
      if (url.includes("/commit-audit/commands/")) return new Response(JSON.stringify(receipts.get(decodeURIComponent(url.split("/").at(-1)!)) ?? { ok: true, commandStatus: "unconfirmed" }));
      if (url.includes("/cad/automation/roof/calculate") && roofMode !== "normal") {
        roofStarted = true;
        await new Promise<void>((resolve, reject) => {
          if (init?.signal?.aborted) { reject(init.signal.reason); return; }
          init?.signal?.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
          releaseRoofs.push(resolve);
        });
      }
      return realFetch(url, init);
    },
    close: () => { controller.destroy(); },
  };
}
async function next(): Promise<ReturnType<typeof fixture>> {
  active?.close(); active = fixture(); await active.open(); return active;
}
async function idle(): Promise<void> {
  await waitFor(() => root.querySelector("[data-world-edit-status]")?.getAttribute("data-kind") !== "busy", "Busy wird nicht freigegeben", 15000);
  await frame();
}
async function auditSceneHandoff(): Promise<void> {
  const value = await next();
  value.change("[data-line-brush-roof-type]", "flat"); value.change("[data-line-brush-storey-count]", "5");
  value.slowMeshes(); value.button().click(); await idle();
  assert(value.parent().metadata.storeyCount === 5 && value.posts.length === 1, "Mesh-Handoff erreicht bestätigte fünf Geschosse nicht");
  value.controller.activate("selection"); value.controller.activate("room"); await frame();
  assert(!value.scene.getObjectByName("vectoplan_world_edit_building_settings"), "Werkzeugwechsel aktiviert bestätigten Entwurf ohne Auswahl erneut");
  assert(!value.scene.getObjectByName("vectoplan_world_edit_planning_build_area_move"), "Werkzeugwechsel stellt alten Verschiebegriff wieder her");
  await value.openSceneSettings(`vectoplan_world_edit_line_brush_settings:${value.parent().objectInstanceId}`);
  value.change("[data-line-brush-storey-count]", "6");
  value.releaseMeshes();
  await waitFor(() => root.querySelector("[data-world-edit-status]")?.textContent === "Baukörper gespeichert und Szene nachgeladen.", "Bereitgestellte Ersatzmeshes werden nicht übernommen");
  assert(!value.panel().hidden && root.querySelector<HTMLInputElement>("[data-line-brush-storey-count]")!.value === "6",
    "Ankunft vorheriger Generation verwirft erneut geöffneten Sechsgeschoss-Entwurf");
  assert(value.parent().metadata.storeyCount === 5 && value.posts.length === 1, "Erneutes Bearbeiten speichert vor Bestätigung");
  value.button().click(); await idle();
  assert(value.parent().metadata.storeyCount === 6 && value.posts.length === 2, "Erneut geöffneter Entwurf wird nicht vollständig bestätigt");
  pass("Mesh-Handoff: Werkzeugwechsel bleibt ohne Editiergriffe; explizites Wiederöffnen mit sechs Geschossen überlebt die Ankunft der vorherigen Generation");
}
async function auditExitLifecycle(): Promise<void> {
  let value = await next();
  value.change("[data-line-brush-roof-type]", "flat");
  value.button().click(); assert(value.panel().hidden, "Migration hält Bestätigungsfenster offen"); await idle();
  assert(value.parent().metadata.storeyHeightMeters === 3, "Alte Standardhöhe wird nicht auf drei Blöcke umgestellt");
  assert(JSON.stringify(value.parent().metadata.storeyProfile.heightProfile.boundariesByScope.all) === "[0,3,6,9,12]", "Migration erzeugt keine regelmäßigen Drei-Block-Geschosse");
  await value.openSceneSettings(`vectoplan_world_edit_line_brush_settings:${value.parent().objectInstanceId}`);
  value.button().click();
  assert(value.panel().hidden && value.posts.length === 1, "Unveränderte Bestätigung erzeugt erneut eine Generation");
  pass("Legacy-Bestand: Bestätigen speichert drei Blöcke je Geschoss; erneutes Bestätigen schließt ohne weiteren Write");
  await value.openSceneSettings(`vectoplan_world_edit_line_brush_settings:${value.parent().objectInstanceId}`);
  value.controller.deactivate();
  assert(!value.scene.getObjectByName("vectoplan_world_edit_planning_build_area"), "Sauberer Austritt behält Vorschaugeometrie");
  const clean = value.stage().sceneTraversals;
  await new Promise(resolve => setTimeout(resolve, 350));
  assert(value.stage().sceneTraversals === clean, "Sauberer Austritt hinterlässt Szenenscanner");
  assert(root.dataset.worldEditPlanningDraftPresent === "false"
    && root.dataset.worldEditPlanningGenerationPending === "false" && root.dataset.worldEditBusy === "false",
  "F8 meldet nach sauberem Austritt weiterhin Entwurf, Generation oder Busy");
  pass("Sauberer Austritt: Vorschau entfernt, danach 0 vollständige Szenentraversierungen in 350 ms");
  value = await next(); value.change("[data-line-brush-roof-type]", "flat"); value.change("[data-line-brush-storey-count]", "5");
  value.slowMeshes(); value.button().click(); await idle();
  const fallback = value.scene.getObjectByName("vectoplan_world_edit_planning_build_area");
  assert(fallback, "Langsamer Mesh-Handoff hat keine schützende Vorschau");
  value.controller.deactivate();
  assert(value.scene.getObjectByName("vectoplan_world_edit_planning_build_area") === fallback, "Austritt baut die komplette ausstehende Vorschau neu");
  assert(!value.scene.getObjectByName("vectoplan_world_edit_building_settings"), "Ausstehender Handoff behält aktive Editiergriffe");
  assert(root.dataset.worldEditActive !== "true" && root.dataset.worldEditPlanningDraftPresent === "true"
    && root.dataset.worldEditPlanningGenerationPending === "true" && root.dataset.worldEditBusy === "false",
  "F8 unterscheidet inaktiven Mesh-Handoff nicht vom vollständig beendeten Werkzeug");
  const pending = value.stage().sceneTraversals;
  await new Promise(resolve => setTimeout(resolve, 350));
  const scans = value.stage().sceneTraversals - pending;
  assert(scans > 0 && scans <= 12, `Ausstehender Handoff scannt weiterhin jeden Frame: ${scans} Scans / 350 ms`);
  value.releaseMeshes();
  await waitFor(() => !value.scene.getObjectByName("vectoplan_world_edit_planning_build_area"), "Abgeschlossener Handoff behält Vorschaugeometrie");
  const finished = value.stage().sceneTraversals;
  await new Promise(resolve => setTimeout(resolve, 350));
  assert(value.stage().sceneTraversals === finished, "Abgeschlossener Handoff hinterlässt Szenenscanner");
  assert(root.dataset.worldEditPlanningDraftPresent === "false" && root.dataset.worldEditPlanningGenerationPending === "false",
    "F8 Entwurfsstatus wird nach Mesh-Handoff nicht freigegeben");
  pass(`Ausstehender Handoff: gleiche Geometrie beim Austritt, ${scans} statt Frame-Scans / 350 ms, nach Mesh-Ankunft 0 Scans`);
}
document.querySelector<HTMLButtonElement>("#run")!.addEventListener("click", async event => {
  (event.currentTarget as HTMLButtonElement).disabled = true;
  try {
    if (new URLSearchParams(location.search).has("exit")) {
      await auditExitLifecycle();
      output.textContent = `PASS\n${checks.join("\n")}`; document.documentElement.dataset.auditResult = "pass";
      return;
    }
    if (new URLSearchParams(location.search).has("handoff")) {
      await auditSceneHandoff();
      output.textContent = `PASS\n${checks.join("\n")}`; document.documentElement.dataset.auditResult = "pass";
      return;
    }
    let value = await next();
    value.button().click(); assert(value.panel().hidden, "Migration schließt Fenster nicht sofort"); await idle();
    assert(value.posts.length === 1 && value.parent().metadata.storeyHeightMeters === 3, "Legacy-Standard bleibt trotz Bestätigung bei 2,645 m");
    await value.openSceneSettings(`vectoplan_world_edit_line_brush_settings:${value.parent().objectInstanceId}`);
    value.button().click(); assert(value.panel().hidden && value.posts.length === 1, "No-op schließt nicht ohne weitere Mutation");
    assert(!value.scene.getObjectByName("vectoplan_world_edit_building_settings"), "No-op behält Editierfokus");
    pass("Unverändert: Fenster und Editierfokus schließen ohne Generation");
    value = await next();
    root.querySelector<HTMLButtonElement>("[data-world-edit-reset]")!.click();
    value.button().click(); await frame();
    assert(!value.panel().hidden && !value.button().disabled && value.posts.length === 0, "Ungültiger leerer Pfad schließt/sperrt das Fenster");
    pass("Validation: leerer Pfad bleibt korrigierbar, Button frei, kein Write");
    value = await next(); value.change("[data-line-brush-roof-type]", "flat"); value.change("[data-line-brush-storey-count]", "5");
    value.setSave("delay"); value.button().click(); value.button().click();
    assert(value.panel().hidden, "Valider Entwurf wartet im offenen Fenster auf Speicherung");
    assert(!value.scene.getObjectByName("vectoplan_world_edit_building_settings"), "Annahme behält aktive Editiergriffe");
    await waitFor(() => value.stage().saveWaiting, "Verzögerte Speicherung startet nicht");
    assert(value.posts.length === 1, "Doppelklick startet zwei Generationen");
    value.release(); await idle(); assert(value.parent().metadata.storeyCount === 5, "Fünf Geschosse werden nicht gespeichert");
    pass("Langsamer Save: Fenster sofort zu, Editiergriffe frei, genau eine Generation mit fünf Geschossen");
    value = await next(); value.change("[data-line-brush-roof-type]", "flat"); value.change("[data-line-brush-storey-count]", "5");
    value.setSave("failed"); value.button().click(); await waitFor(() => !value.panel().hidden && !value.button().disabled, "409 stellt Entwurf/Bedienbarkeit nicht wieder her");
    assert(value.parent().metadata.storeyCount === 4 && value.posts.length === 1, "409 verändert gespeichertes Gebäude");
    assert(root.querySelector<HTMLInputElement>("[data-line-brush-storey-count]")!.value === "5", "409 verliert lokale fünf Geschosse");
    value.setSave("normal"); value.button().click(); await idle(); assert(value.parent().metadata.storeyCount === 5, "Korrigierbarer Entwurf lässt sich nicht bestätigen");
    pass("Sicherer Fehler: Original unverändert, Fünfgeschoss-Entwurf samt Fenster wiederhergestellt, Wiederholung erfolgreich");
    value = await next(); value.setRoof("delay"); value.change("[data-line-brush-storey-count]", "5"); value.button().click();
    assert(value.panel().hidden, "Langsame CAD-Vorbereitung hält Fenster offen");
    await waitFor(() => value.stage().roofStarted, "CAD-Vorbereitung startet nicht");
    assert(value.posts.length === 0, "Mutation startet vor fertig berechnetem Dach"); value.release(); await idle();
    assert(value.parent().metadata.storeyCount === 5, "Verzögertes echtes CAD-Dach verhindert Commit");
    pass("Langsame Vorbereitung: Fenster vor CAD-Antwort geschlossen; erst vollständige Geometrie wird mutiert");
    value = await next(); value.change("[data-line-brush-roof-type]", "flat"); value.change("[data-line-brush-storey-count]", "5");
    value.slowReload(); value.button().click(); await waitFor(() => value.stage().reloadStarted, "Langsamer Reload startet nicht");
    assert(value.panel().hidden && value.parent().metadata.storeyCount === 5, "Bestätigter Save wartet im Fenster auf Chunks"); value.release(); await idle();
    pass("Langsamer Reload: Bestätigung und Fokusfreigabe warten nicht auf Chunk-/Mesh-Nachladen");
    value = await next(); value.change("[data-line-brush-roof-type]", "flat"); value.change("[data-line-brush-storey-count]", "5");
    value.setSave("lost"); value.button().click(); await idle();
    assert(value.posts.length === 1 && value.parent().metadata.storeyCount === 5, "Verlorene Antwort erzeugt zweite Generation");
    pass("Ungewisser Commit: gespeicherte Generation über Receipt erkannt, keine neue Command-ID/Mutation");
    value = await next(); value.setRoof("hang"); value.change("[data-line-brush-storey-count]", "5"); value.button().click();
    pass("Prüfe ausbleibende CAD-Antwort mit produktivem 30-s-Zeitlimit …");
    await waitFor(() => !value.panel().hidden && !value.button().disabled, "Hängende CAD-Antwort bleibt dauerhaft busy", 35000);
    assert(value.posts.length === 0 && value.parent().metadata.storeyCount === 4, "CAD-Timeout verändert Original");
    assert(root.querySelector("[data-world-edit-status]")?.textContent?.includes("nicht rechtzeitig"), "Timeoutfehler bleibt unsichtbar");
    pass("CAD-Timeout: nach 30 s wieder korrigierbar; Entwurf erhalten und keine Mutation");
    await auditSceneHandoff();
    output.textContent = `PASS\n${checks.join("\n")}`; document.documentElement.dataset.auditResult = "pass";
  } catch (error) {
    output.textContent = `FAIL: ${String(error)}\n${checks.join("\n")}`; document.documentElement.dataset.auditResult = "fail";
  }
});
