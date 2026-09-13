import { hideDomLoadingOverlay, type EditorDomRefs } from "../dom/dom_refs";
import { withLifecycleStatus, type EditorLifecycleStatus } from "../state/editor_state";
import type { EditorStore } from "../state/editor_store";

interface LifecycleUpdate {
  readonly reason?: string | null;
  readonly bootAttemptCount?: number;
}

/** The main runtime and action reducer share the same lifecycle invariants. */
export function updateEditorRuntimeLifecycle(
  store: EditorStore,
  status: EditorLifecycleStatus,
  input?: LifecycleUpdate,
): void {
  try {
    store.setState(
      (previous) => withLifecycleStatus(previous, status, input?.reason, input?.bootAttemptCount),
      { action: `main.lifecycle.${status}`, notify: true, captureHistory: false },
    );
  } catch {
    // Teardown can race with an already disposed store.
  }
}

/** Release the DOM gate before subscribers render the completed boot state. */
export function releaseEditorBoot(
  store: EditorStore,
  refs: EditorDomRefs,
  input?: LifecycleUpdate & { readonly status?: "ready" | "degraded" },
): void {
  refs.root.dataset.editorBootGate = "released";
  updateEditorRuntimeLifecycle(store, input?.status ?? "ready", input);
  hideDomLoadingOverlay(refs);
}
