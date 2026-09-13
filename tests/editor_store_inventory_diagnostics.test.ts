import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultEditorBootstrap } from "../src/frontend/bootstrap/default_bootstrap";
import { createInitialEditorState, type EditorState } from "../src/frontend/state/editor_state";
import { createEditorStore } from "../src/frontend/state/editor_store";

function fixture() {
  let classifications = 0, serialized = 0;
  const item = Object.freeze({ get kind() { classifications++; return "library-item"; },
    enabled: true, placeable: true, runtimeBlockTypeId: "wall", libraryItemId: "wall-family",
    metadata: { toJSON() { serialized++; return { definition: "x".repeat(100_000) }; } } });
  const initial = createInitialEditorState({ bootstrap: createDefaultEditorBootstrap(), bootId: "diagnostics-test",
    buildMode: "test", buildVersion: "test" });
  const state = { ...initial, inventory: Object.freeze({ ...initial.inventory, status: "ready", items: Object.freeze([item]),
    selectedRuntimeBlockTypeId: "wall", selectedLibraryItemId: "wall-family" }),
    creativeLibrary: Object.freeze({ ...initial.creativeLibrary, items: Object.freeze([item]) }) } as unknown as EditorState;
  return { state, item, counts: () => ({ classifications, serialized }) };
}

test("chunk commits and snapshots reuse inventory scans while current lifecycle and flags remain observable", () => {
  const value = fixture(), store = createEditorStore({ initialState: value.state, maxHistoryEntries: 3 });
  const scans = value.counts(), before = store.getSnapshot();
  assert.ok(scans.serialized > 0 && scans.classifications > 0);
  for (let i = 0; i < 100; i++) store.patchState({ world: { ...value.state.world, chunkCount: i } },
    { action: "chunks/install", notify: false });
  store.patchState({ lifecycle: { ...value.state.lifecycle, status: "ready" },
    bootstrap: { ...value.state.bootstrap, featureFlags: { ...value.state.bootstrap.featureFlags,
      chunkServiceInventoryEnabled: true } } } as Partial<EditorState>, { action: "runtime/flags" });
  const after = store.getSnapshot();
  assert.deepEqual(value.counts(), scans, "Unchanged immutable inventory must not be classified or serialized again");
  assert.notEqual(after.diagnostics, before.diagnostics, "Full diagnostics must not be cached");
  assert.equal(after.diagnostics.lifecycleStatus, "ready");
  assert.equal(after.diagnostics.chunkInventoryFlagsEnabled, true);
  assert.ok(after.invariantWarnings.some(warning => warning.code === "chunk-inventory-flags-enabled"));
  assert.equal(after.diagnostics.inventoryLibraryItemCount, 1);
  assert.equal(after.diagnostics.inventoryPlaceableLibraryItemCount, 1);
  store.destroy();
});

test("new inventory identities refresh classification and selection; new creative raw data refreshes forbidden-ID warnings", () => {
  const value = fixture(), store = createEditorStore({ initialState: value.state, maxHistoryEntries: 0 });
  const scans = value.counts();
  store.patchState({ inventory: { ...value.state.inventory, items: [...value.state.inventory.items,
    { kind: "library-item", enabled: true, placeable: true, runtimeBlockTypeId: "roof", libraryItemId: "roof-family" }],
    selectedRuntimeBlockTypeId: null, selectedLibraryItemId: null } } as Partial<EditorState>, { action: "inventory/replace" });
  const replaced = store.getSnapshot();
  assert.ok(value.counts().serialized > scans.serialized);
  assert.equal(replaced.diagnostics.inventoryLibraryItemCount, 2);
  assert.equal(replaced.diagnostics.inventoryPlaceableLibraryItemCount, 2);
  assert.equal(replaced.diagnostics.selectedRuntimeBlockTypeId, null);
  assert.equal(replaced.diagnostics.selectedLibraryItemId, null);
  assert.ok(replaced.invariantWarnings.some(warning => warning.code === "missing-runtime-block-type-id"));
  store.patchState({ creativeLibrary: { ...value.state.creativeLibrary,
    raw: { nested: { definition: "debug_dirt" } } } } as Partial<EditorState>, { action: "library/replace" });
  assert.ok(store.getSnapshot().invariantWarnings.some(warning => warning.code === "forbidden-debug-block-ids-present"));
  store.patchState({ creativeLibrary: value.state.creativeLibrary }, { action: "library/clear-invalid" });
  assert.equal(store.getSnapshot().diagnostics.forbiddenDebugBlockIdsDetected, false);
  store.destroy();
});

test("diagnostic caches are scoped to a store and destroy still reports invalid state", () => {
  const value = fixture(), first = createEditorStore({ initialState: value.state, maxHistoryEntries: 0 });
  const scans = value.counts();
  const second = createEditorStore({ initialState: value.state, maxHistoryEntries: 0 });
  assert.ok(value.counts().serialized > scans.serialized, "Independent stores must own their cache lifetime");
  first.destroy();
  assert.equal(first.getSnapshot().diagnostics.stateValid, false);
  assert.equal(second.getSnapshot().diagnostics.stateValid, true);
  second.destroy();
});
