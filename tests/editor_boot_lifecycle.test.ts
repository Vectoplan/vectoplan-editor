import assert from "node:assert/strict";
import test from "node:test";
import { releaseEditorBoot, updateEditorRuntimeLifecycle } from "../src/frontend/bootstrap/editor_boot_lifecycle";
import { createDefaultEditorBootstrap } from "../src/frontend/bootstrap/default_bootstrap";
import { createInitialEditorState } from "../src/frontend/state/editor_state";
import { createEditorStore } from "../src/frontend/state/editor_store";
import { createLoadingOverlay } from "../src/frontend/ui/loading_overlay";
import { createLibraryInventorySource } from "../src/frontend/inventory/library_inventory_source";
import { createHotbarController } from "../src/frontend/inventory/hotbar_controller";
import { buildEmptyInventoryState } from "../src/frontend/api/editor_inventory_normalize";
import { selectRuntimeReadiness } from "../src/frontend/state/state_selectors";
import type { EditorDomRefs } from "../src/frontend/dom/dom_refs";

function element() {
  return { dataset: {} as Record<string, string>, hidden: false, textContent: "",
    setAttribute() {}, removeAttribute() {} };
}

function boot() {
  const refs = { root: element(), loadingOverlay: element(), loadingText: element(), liveRegion: element() } as unknown as EditorDomRefs;
  refs.root.dataset.editorBootGate = "locked";
  const store = createEditorStore({ initialState: createInitialEditorState({
    bootstrap: createDefaultEditorBootstrap(), bootId: "real-boot-coordinator",
    buildMode: "test", buildVersion: "test", createdAt: new Date().toISOString(),
  }) });
  const overlay = createLoadingOverlay({ refs, store, minVisibleMs: 0 });
  updateEditorRuntimeLifecycle(store, "initializing", { bootAttemptCount: 1 });
  return { refs, store, overlay };
}

// This exercises main.ts's actual coordinator with the real store, subscribed DOM
// overlay and asynchronous inventory controller; lifecycle/ready reducer alone
// missed the original bug because main previously bypassed that action entirely.
for (const status of ["ready", "degraded"] as const) {
  test(`boot completion (${status}) remains visible with empty geodata and failing optional inventory`, async () => {
    const { refs, store, overlay } = boot();
    const requests: Array<{ resolve: (value: unknown) => void; reject: (reason: Error) => void }> = [];
    const source = createLibraryInventorySource({ autoLoad: false,
      client: { loadInventory: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) } as never });
    const hotbar = createHotbarController({ inventorySource: source, store, domRefs: refs, renderToDom: false,
      enableKeyboardShortcuts: false, enableWheelSelection: false, enableSlotClickSelection: false });
    try {
      const initialInventory = hotbar.load();
      assert.equal(refs.loadingOverlay!.hidden, false, "initial boot stays covered until its first frame");
      assert.equal(store.peekState().ui.loading, true);
      requests.shift()!.reject(new Error("Optional inventory unavailable"));
      await initialInventory;
      assert.equal(store.peekState().world.loadedChunkKeys.length, 0);
      assert.equal(selectRuntimeReadiness(store.peekState()).canInteract, false);
      let notifiedWithOpenGate = false;
      const unsubscribe = store.subscribe((state) => {
        if (state.lifecycle.status === status) notifiedWithOpenGate = refs.root.dataset.editorBootGate === "released";
      });
      releaseEditorBoot(store, refs, { status, reason: "first-frame", bootAttemptCount: 1 });
      unsubscribe();
      assert.equal(notifiedWithOpenGate, true);
      assert.equal(refs.loadingOverlay!.hidden, true);
      assert.equal(overlay.getSnapshot().visible, false);
      assert.equal(store.peekState().ui.loading, false);
      assert.equal(store.peekState().ui.loadingMessage, null);
      for (const key of ["planning", "default", "planning"]) {
        source.setInventoryKey(key);
        const reload = hotbar.reload("workspace-inventory-mode-change");
        assert.equal(store.peekState().inventory.status, "connecting");
        assert.equal(refs.loadingOverlay!.hidden, true, "pending mode inventory cannot restore the fullscreen loader");
        assert.equal(overlay.getSnapshot().visible, false);
        const selectedSlot = key === "planning" ? 4 : 2;
        requests.shift()!.resolve({ ok: true, state: buildEmptyInventoryState({ hotbarSize: 9, selectedSlot }) });
        await reload;
        assert.equal(hotbar.getSnapshot().selectedSlotIndex, selectedSlot);
        assert.equal(refs.loadingOverlay!.hidden, true, "an empty loadout is also non-blocking");
      }
      store.setState((state) => ({ ...state, world: { ...state.world, connection: { ...state.world.connection, status: "connecting" } } }));
      assert.equal(refs.loadingOverlay!.hidden, true, "reconnecting world does not recreate boot UI");
      assert.equal(store.peekState().lifecycle.bootAttemptCount, 1);
    } finally {
      hotbar.destroy(); source.destroy(); overlay.dispose(); store.destroy();
    }
  });
}

test("a deliberate project loading request after boot still appears", () => {
  const { refs, store, overlay } = boot();
  releaseEditorBoot(store, refs);
  store.setState((state) => ({ ...state, ui: { ...state.ui, loading: true, loadingMessage: "Projektwechsel" } }));
  assert.equal(refs.loadingOverlay!.hidden, false);
  assert.equal(refs.loadingText!.textContent, "Projektwechsel");
  overlay.dispose(); store.destroy();
});
