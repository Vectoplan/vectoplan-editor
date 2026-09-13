import assert from "node:assert/strict";
import test from "node:test";
import { workspaceInventoryKey, workspaceInventoryUrl } from "../src/frontend/inventory/workspace_inventory";
import { createLibraryInventorySource } from "../src/frontend/inventory/library_inventory_source";
import { buildEmptyInventoryState } from "../src/frontend/api/editor_inventory_normalize";
import { worldEditToolIdFromSlot } from "../src/frontend/inventory/creative_inventory_panel";
import { createHotbarController } from "../src/frontend/inventory/hotbar_controller";
import { createDefaultEditorBootstrap } from "../src/frontend/bootstrap/default_bootstrap";
import { createInitialEditorState, type EditorState } from "../src/frontend/state/editor_state";
import { applyEditorAction } from "../src/frontend/state/state_actions";
import { selectShouldShowLoadingOverlay, selectInventoryReady } from "../src/frontend/state/state_selectors";

function initialEditorState(): EditorState {
  return createInitialEditorState({ bootstrap: createDefaultEditorBootstrap(), bootId: "inventory-loading-test",
    buildMode: "test", buildVersion: "test", createdAt: new Date().toISOString() });
}

test("initial inventory loading retains the boot overlay", () => {
  const state = applyEditorAction(initialEditorState(), { kind: "inventory/loading" });
  assert.equal(selectShouldShowLoadingOverlay(state), true);
  assert.equal(state.inventory.status, "connecting");
  assert.match(state.ui.loadingMessage ?? "", /Library-\/VPLIB-Inventar/);
});

test("pending workspace inventory changes keep a running editor visible", async () => {
  for (const lifecycle of ["ready", "degraded"] as const) {
    let state = applyEditorAction(initialEditorState(), { kind: "lifecycle/ready" });
    state = { ...state, lifecycle: { ...state.lifecycle, status: lifecycle } };
    const requests: Array<(value: unknown) => void> = [];
    const source = createLibraryInventorySource({ autoLoad: false,
      client: { loadInventory: () => new Promise((resolve) => requests.push(resolve)) } as never });
    const hotbar = createHotbarController({ inventorySource: source, renderToDom: false,
      store: { setState: (update: (previous: EditorState) => EditorState) => { state = update(state); } } as never,
      domRefs: { root: { dataset: {} } } as never,
      enableKeyboardShortcuts: false, enableWheelSelection: false, enableSlotClickSelection: false });
    for (const key of ["planning", "default"]) {
      source.setInventoryKey(key);
      const load = hotbar.reload("workspace-inventory-mode-change");
      assert.equal(state.inventory.status, "connecting", "readiness must wait for the new inventory");
      assert.equal(selectInventoryReady(state), false);
      assert.equal(selectShouldShowLoadingOverlay(state), false, "mode changes must not cover the scene");
      requests.shift()!({ ok: true, state: buildEmptyInventoryState({ hotbarSize: 9, selectedSlot: key === "planning" ? 4 : 2 }) });
      await load;
      assert.notEqual(state.inventory.status, "connecting");
      assert.equal(selectShouldShowLoadingOverlay(state), false);
      assert.equal(hotbar.getSnapshot().selectedSlotIndex, key === "planning" ? 4 : 2);
    }
    hotbar.destroy();
    source.destroy();
  }
});

test("background inventory loading preserves an explicitly requested loading screen", () => {
  const ready = applyEditorAction(initialEditorState(), { kind: "lifecycle/ready" });
  const explicit = { ...ready, ui: { ...ready.ui, loading: true, loadingMessage: "Projekt wird gewechselt." } };
  const loading = applyEditorAction(explicit, { kind: "inventory/loading" });
  assert.equal(selectShouldShowLoadingOverlay(loading), true);
  assert.equal(loading.ui.loadingMessage, "Projekt wird gewechselt.");
});

test("workspace URLs keep identity and isolate the planning loadout", () => {
  const ego = workspaceInventoryUrl("/user-inventar?user_id=7", "first-person", "http://localhost:5101");
  const planning = workspaceInventoryUrl(ego, "planning", "http://localhost:5101");
  assert.equal(new URL(planning).searchParams.get("user_id"), "7");
  assert.equal(new URL(planning).searchParams.get("inventory_key"), "planning");
  assert.equal(new URL(workspaceInventoryUrl(planning, "first-person", "http://localhost:5101")).searchParams.get("inventory_key"), "default");
  assert.equal(workspaceInventoryKey("planning"), "planning");
});

test("late responses cannot replace a newly selected workspace inventory", async () => {
  const requests: Array<{ url: string; finish: (value: unknown) => void }> = [];
  const client = { loadInventory: (options: { url: string }) => new Promise((finish) => requests.push({ url: options.url, finish })) };
  const source = createLibraryInventorySource({ client: client as never, autoLoad: false });
  const egoLoad = source.load();
  source.setInventoryKey("planning");
  const planningLoad = source.load();
  assert.equal(new URL(requests[0].url).searchParams.get("inventory_key"), "default");
  assert.equal(new URL(requests[1].url).searchParams.get("inventory_key"), "planning");
  requests[1].finish({ ok: true, state: buildEmptyInventoryState({ selectedSlot: 4, hotbarSize: 9 }) });
  await planningLoad;
  assert.equal(source.getSelectedSlotIndex(), 4);
  requests[0].finish({ ok: true, state: buildEmptyInventoryState({ selectedSlot: 1, hotbarSize: 9 }) });
  await egoLoad;
  assert.equal(source.getSelectedSlotIndex(), 4);
  source.destroy();
});

test("canonical planning slots activate line brush and storey in both views", () => {
  for (const tool of ["room", "storey", "selection", "roof", "stair", "parcel-grid"]) {
    assert.equal(worldEditToolIdFromSlot({ family_id: `world-edit.${tool}`, variant_id: tool }), tool);
  }
  assert.equal(worldEditToolIdFromSlot({ family_id: "brick", object_kind: "block" }), null);
});

test("hotbar mode changes restore that inventory's saved selection", async () => {
  const client = { loadInventory: async (options: { url: string }) => ({
    ok: true, state: buildEmptyInventoryState({ hotbarSize: 9,
      selectedSlot: new URL(options.url).searchParams.get("inventory_key") === "planning" ? 4 : 2,
    }),
  }) };
  const source = createLibraryInventorySource({ client: client as never, autoLoad: false });
  const hotbar = createHotbarController({ inventorySource: source, renderToDom: false,
    store: { setState: () => undefined } as never,
    domRefs: { root: { dataset: {} } } as never,
    enableKeyboardShortcuts: false, enableWheelSelection: false, enableSlotClickSelection: false,
  });
  await hotbar.load();
  assert.equal(hotbar.getSnapshot().selectedSlotIndex, 2);
  source.setInventoryKey("planning");
  await hotbar.reload("workspace-inventory-mode-change");
  assert.equal(hotbar.getSnapshot().selectedSlotIndex, 4);
  source.setInventoryKey("default");
  await hotbar.reload("workspace-inventory-mode-change");
  assert.equal(hotbar.getSnapshot().selectedSlotIndex, 2);
  hotbar.destroy();
});
