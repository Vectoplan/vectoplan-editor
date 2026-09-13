import type { SceneRuntimeHandle } from "../scene/scene_runtime";
import type { WorldEditControllerHandle } from "../world_edit/world_edit_controller";
import {
  EDITOR_WORKSPACE_MODES,
  type EditorWorkspaceMode,
} from "../modes/editor_workspace_mode";

const MODE_CHANGED_EVENT = "vectoplan-editor:workspace-mode-changed";

export interface EditorWorkspaceModeControllerOptions {
  readonly root: HTMLElement;
  readonly sceneRuntime: SceneRuntimeHandle;
  readonly worldEditController: WorldEditControllerHandle;
  readonly signal?: AbortSignal;
}

export interface EditorWorkspaceModeControllerHandle {
  readonly kind: "vectoplan-editor-workspace-mode-controller.v1";
  readonly element: HTMLElement;
  sync(): void;
  destroy(): void;
}

function createElement<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function createEditorWorkspaceModeController(
  options: EditorWorkspaceModeControllerOptions,
): EditorWorkspaceModeControllerHandle {
  const cleanup: Array<() => void> = [];
  let destroyed = false;

  const shell = createElement("div", "vp-workspace-modes");
  shell.dataset.editorWorkspaceControl = "true";
  shell.dataset.editorUiInteractive = "true";

  const switcher = createElement("section", "vp-workspace-switcher");
  switcher.dataset.editorWorkspaceControl = "true";
  switcher.setAttribute("aria-label", "Editor-Ansicht wechseln");
  const switcherLabel = createElement("span", "vp-workspace-switcher__label", "Arbeitsansicht");
  const switcherButtons = createElement("div", "vp-workspace-switcher__buttons");
  switcherButtons.setAttribute("role", "group");
  const modeButtons = new Map<EditorWorkspaceMode, HTMLButtonElement>();
  for (const mode of EDITOR_WORKSPACE_MODES) {
    const button = createElement("button", "vp-workspace-switcher__button") as HTMLButtonElement;
    button.type = "button";
    button.dataset.workspaceMode = mode.id;
    button.title = mode.description;
    button.append(
      createElement("strong", "", mode.shortLabel),
      createElement("small", "", mode.camera === "orbit" ? "Gottperspektive" : "First Person"),
    );
    button.addEventListener("click", () => options.sceneRuntime.setWorkspaceMode(mode.id, `workspace-switch:${mode.id}`));
    switcherButtons.append(button);
    modeButtons.set(mode.id, button);
  }
  const shortcut = createElement("kbd", "vp-workspace-switcher__shortcut", "G");
  shortcut.title = "Mit G zwischen beiden Ansichten wechseln";
  switcher.append(switcherLabel, switcherButtons, shortcut);

  shell.append(switcher);
  options.root.append(shell);

  function sync(): void {
    if (destroyed) return;
    const mode = options.sceneRuntime.getWorkspaceMode();
    shell.dataset.mode = mode;
    for (const [id, button] of modeButtons) {
      const selected = id === mode;
      button.dataset.active = String(selected);
      button.setAttribute("aria-pressed", String(selected));
    }

  }

  function handleModeChanged(): void {
    sync();
  }

  window.addEventListener(MODE_CHANGED_EVENT, handleModeChanged);
  cleanup.push(() => window.removeEventListener(MODE_CHANGED_EVENT, handleModeChanged));

  const handle: EditorWorkspaceModeControllerHandle = {
    kind: "vectoplan-editor-workspace-mode-controller.v1",
    element: shell,
    sync,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const dispose of cleanup.splice(0)) dispose();
      shell.remove();
    },
  };
  if (options.signal) {
    if (options.signal.aborted) handle.destroy();
    else options.signal.addEventListener("abort", () => handle.destroy(), { once: true });
  }
  sync();
  return handle;
}
