import { mountCreativeInventoryPanel } from "../../src/frontend/inventory/creative_inventory_panel";
import { createEditorWorkspaceModeController } from "../../src/frontend/ui/editor_workspace_mode_controller";
import "../../src/frontend/styles/editor_workspace_modes.css";
import "../../src/frontend/styles/realtime_environment.css";

document.body.innerHTML = `<style>
body{margin:0;background:#dfe8f0;font:16px system-ui}#root{position:relative;width:100vw;height:100vh}
#status{position:absolute;top:90px;left:22px;white-space:pre-wrap;max-width:900px;z-index:10}
#open,#verify,#restore{position:relative;z-index:800;margin:12px 4px}
.vectoplan-user-inventory-frame{position:fixed;bottom:6px;left:50%;transform:translateX(-50%);width:812px;height:150px;border:0;z-index:100}
</style><div id="root" data-editor-workspace-mode="first-person">
<button id="open">Inventar (I)</button><button id="verify">Ego-Belegung vergleichen</button><button id="restore">Planung Slot 9 wiederherstellen</button>
<pre id="status">Library lädt …</pre>
<iframe class="vectoplan-user-inventory-frame" data-user-inventory-frame title="User-Inventar"></iframe></div>`;
const root = document.querySelector<HTMLElement>("#root")!;
root.dataset.creativeInventoryUrl = "http://127.0.0.1:5101/creative-inventar";
root.dataset.userInventoryUrl = "http://127.0.0.1:5101/user-inventar";
const hotbar = root.querySelector<HTMLIFrameElement>("iframe")!;
hotbar.src = root.dataset.userInventoryUrl;
const status = document.querySelector<HTMLElement>("#status")!;
const snapshots = new Map<string, any>();
let egoBefore: string | null = null;
let planningBefore: any = null;
let activeTool = "";
let restorePending = false;
let restoreMessage = "";
const slotSignature = (slot: any): string => JSON.stringify([slot.slot_index, slot.family_id, slot.variant_id, slot.empty]);
function signature(state: any): string {
  return JSON.stringify(state.slots.map((slot: any) => [slot.slot_index, slot.family_id, slot.variant_id, slot.empty]));
}
function draw(): void {
  const snapshot = snapshots.get(root.dataset.workspaceInventoryKey || "default");
  status.textContent = `Ansicht: ${root.dataset.editorWorkspaceMode}\nInventar: ${root.dataset.workspaceInventoryKey}\nAktives Werkzeug: ${activeTool || "keines"}\nSlots: ${snapshot?.slots?.map((slot: any) => slot.label || "leer").join(" | ") || "laden"}\n\nI öffnet dieselbe Library. In Planung ein Werkzeug in Slot 9 ziehen, auf Ego wechseln und Belegung vergleichen. Danach Planung aufrufen und Slot 9 wiederherstellen.\n${restoreMessage}`;
}
window.addEventListener("message", (event) => {
  if (event.source !== hotbar.contentWindow || !["vectoplan:user-inventory-load", "vectoplan:user-inventory-save", "vectoplan:user-inventory-state"].includes(event.data?.type)) return;
  const snapshot = event.data.detail;
  if (!snapshot?.slots?.length || !snapshot.loaded_from_api) return;
  snapshots.set(snapshot.inventory_key, snapshot);
  if (snapshot.inventory_key === "default" && egoBefore === null) egoBefore = signature(snapshot);
  if (snapshot.inventory_key === "planning" && !planningBefore) planningBefore = structuredClone(snapshot);
  if (restorePending && snapshot.inventory_key === "planning" && event.data.type === "vectoplan:user-inventory-save"
    && slotSignature(snapshot.slots[8]) === slotSignature(planningBefore.slots[8])) {
    restorePending = false;
    restoreMessage = "PASS: Ursprünglicher Planungs-Slot 9 wurde über die Library gespeichert.";
    const selected = planningBefore.slots.find((slot: any) => slot.selected)?.slot_index ?? 1;
    hotbar.contentWindow?.postMessage({ type: "vectoplan:user-inventory-select-slot", source: "vectoplan-editor",
      detail: { slotIndex: selected, persist: true } }, new URL(hotbar.src).origin);
  }
  draw();
});
window.addEventListener("vectoplan-editor:worldedit-tool-activate", (event: Event) => {
  const detail = (event as CustomEvent).detail;
  activeTool = detail.active === false ? "" : detail.tool || detail.toolId || "";
  draw();
});
const panel = mountCreativeInventoryPanel({ root });
createEditorWorkspaceModeController({ root, sceneRuntime: {
  getWorkspaceMode: () => root.dataset.editorWorkspaceMode,
  setWorkspaceMode: (mode: string) => {
    root.dataset.editorWorkspaceMode = mode;
    window.dispatchEvent(new CustomEvent("vectoplan-editor:workspace-mode-changed", { detail: { mode } }));
    draw();
  },
} as any, worldEditController: {} as any });
document.querySelector("#open")!.addEventListener("click", () => panel.open());
document.querySelector("#verify")!.addEventListener("click", () => {
  const current = snapshots.get("default");
  status.textContent = egoBefore && current && egoBefore === signature(current)
    ? "PASS: Ego-Hotbar unverändert; Planungsbelegung getrennt gespeichert."
    : "Noch kein Vergleich möglich oder Ego-Hotbar geändert.";
});
document.querySelector("#restore")!.addEventListener("click", () => {
  if (!planningBefore || root.dataset.editorWorkspaceMode !== "planning") {
    restoreMessage = "Zum Wiederherstellen zuerst die Planungsansicht mit geladenen Slots öffnen.";
    draw(); return;
  }
  restorePending = true;
  restoreMessage = "Ursprünglicher Slot 9 wird gespeichert …";
  draw();
  hotbar.contentWindow?.postMessage({ type: "vectoplan:user-inventory-set-slot", source: "vectoplan-editor", detail: {
    slotIndex: 9, item: structuredClone(planningBefore.slots[8]), select: false, persist: true,
  } }, new URL(hotbar.src).origin);
  window.setTimeout(() => {
    if (!restorePending) return;
    restoreMessage = "Wiederherstellung noch nicht bestätigt; Library-Status prüfen.";
    draw();
  }, 8000);
});
