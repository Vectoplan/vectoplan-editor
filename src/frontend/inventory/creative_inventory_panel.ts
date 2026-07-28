export interface CreativeInventoryPanelOptions {
  readonly root: HTMLElement;
  readonly creativeInventoryUrl?: string;
  readonly signal?: AbortSignal;
  readonly onClose?: () => void | Promise<void>;
}

export interface CreativeInventoryPanelHandle {
  readonly element: HTMLElement;
  open(): void;
  close(): void;
  destroy(): void;
}

const DEFAULT_CREATIVE_INVENTORY_URL = "http://127.0.0.1:5101/creative-inventar";

function resolveUrl(options: CreativeInventoryPanelOptions): string {
  const configured = options.creativeInventoryUrl
    ?? options.root.dataset.creativeInventoryUrl
    ?? options.root.dataset.libraryCreativeInventoryUrl;
  return configured?.trim() || DEFAULT_CREATIVE_INVENTORY_URL;
}

export function mountCreativeInventoryPanel(
  options: CreativeInventoryPanelOptions,
): CreativeInventoryPanelHandle {
  const existing = options.root.querySelector<HTMLElement>("[data-editor-creative-inventory-panel]");
  existing?.remove();

  const url = resolveUrl(options);
  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "editor-inventory-launcher";
  launcher.dataset.editorUiInteractive = "true";
  launcher.setAttribute("aria-controls", "editor-creative-inventory-panel");
  launcher.setAttribute("aria-expanded", "false");
  launcher.innerHTML = "<span aria-hidden=\"true\">[ ]</span><span>Inventar</span>";

  const panel = document.createElement("aside");
  panel.id = "editor-creative-inventory-panel";
  panel.className = "editor-creative-inventory-panel";
  panel.dataset.editorCreativeInventoryPanel = "true";
  panel.dataset.editorUiInteractive = "true";
  panel.hidden = true;
  panel.innerHTML = `
    <header class="editor-creative-inventory-panel__header">
      <div><strong>Creative Library</strong><span>Objekte in die User-Hotbar legen</span></div>
      <div class="editor-creative-inventory-panel__actions">
        <a href="#" data-editor-inventory-open-external target="_blank" rel="noopener noreferrer">Neuer Tab</a>
        <button type="button" data-editor-inventory-close aria-label="Inventar schliessen">X</button>
      </div>
    </header>
    <iframe
      class="editor-creative-inventory-panel__frame"
      data-editor-inventory-frame
      title="VECTOPLAN Creative Inventar"
      loading="lazy"
      referrerpolicy="same-origin"
    ></iframe>
  `;

  options.root.append(launcher, panel);
  const externalLink = panel.querySelector<HTMLAnchorElement>("[data-editor-inventory-open-external]");
  const frame = panel.querySelector<HTMLIFrameElement>("[data-editor-inventory-frame]");
  if (externalLink) externalLink.href = url;
  if (frame) frame.src = url;
  const closeButton = panel.querySelector<HTMLButtonElement>("[data-editor-inventory-close]");
  let destroyed = false;

  function open(): void {
    if (destroyed) return;
    try {
      if (document.pointerLockElement) void document.exitPointerLock();
    } catch {
      // Pointer-lock release is best effort.
    }
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    options.root.dataset.creativeInventoryOpen = "true";
    closeButton?.focus({ preventScroll: true });
  }

  function close(): void {
    if (destroyed || panel.hidden) return;
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    options.root.dataset.creativeInventoryOpen = "false";
    launcher.focus({ preventScroll: true });
    void options.onClose?.();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }

  launcher.addEventListener("click", open);
  closeButton?.addEventListener("click", close);
  document.addEventListener("keydown", handleKeyDown, true);

  const handle: CreativeInventoryPanelHandle = {
    element: panel,
    open,
    close,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      launcher.removeEventListener("click", open);
      closeButton?.removeEventListener("click", close);
      document.removeEventListener("keydown", handleKeyDown, true);
      launcher.remove();
      panel.remove();
      delete options.root.dataset.creativeInventoryOpen;
    },
  };

  options.signal?.addEventListener("abort", () => handle.destroy(), { once: true });
  return handle;
}
