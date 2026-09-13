import { STANDARD_STOREY_HEIGHT_METERS } from "../line_brush/building_programs";

export type StoreyTargetScope = "all" | `segment:${number}`;

export interface StoreyQuickSettingsState {
  readonly buildingLabel: string;
  readonly storeyCount: number;
  readonly segmentCount: number;
  readonly segmentIndices?: readonly number[];
  readonly scope: StoreyTargetScope;
  readonly busy?: boolean;
  readonly dirty?: boolean;
  readonly boundaries?: readonly number[];
  readonly selectedBoundary?: number | null;
  readonly scopeLabel?: string;
  readonly defaultHeightMeters?: number;
}

export interface StoreyQuickSettingsHandle {
  readonly element: HTMLElement;
  readonly open: (state: StoreyQuickSettingsState) => void;
  readonly close: (restoreInput?: boolean) => void;
  readonly sync: (state: StoreyQuickSettingsState) => void;
  readonly getScope: () => StoreyTargetScope;
  readonly isOpen: () => boolean;
  readonly destroy: () => void;
}

export interface StoreyQuickSettingsOptions {
  readonly root: HTMLElement;
  readonly onAdd: (scope: StoreyTargetScope) => void;
  readonly onRemove: (scope: StoreyTargetScope) => void;
  readonly onConfirm?: () => void | Promise<void>;
  readonly onClose?: (restoreInput: boolean) => void;
  readonly onScopeChange?: (scope: StoreyTargetScope) => void;
  readonly onBoundarySelect?: (index: number) => void;
  readonly onBoundaryChange?: (index: number, height: number) => void;
}

function normalizedState(state: StoreyQuickSettingsState): StoreyQuickSettingsState {
  const segmentCount = Math.max(0, Math.trunc(Number(state.segmentCount) || 0));
  const segmentIndices = state.segmentIndices ?? Array.from({ length: segmentCount }, (_, index) => index);
  const requestedIndex = state.scope.startsWith("segment:")
    ? Number(state.scope.slice("segment:".length))
    : -1;
  return {
    buildingLabel: String(state.buildingLabel || "Linien-Brush-Baukörper").slice(0, 80),
    storeyCount: Math.max(0, Math.trunc(Number(state.storeyCount) || 0)),
    segmentCount,
    segmentIndices,
    scope: Number.isInteger(requestedIndex) && segmentIndices.includes(requestedIndex)
      ? `segment:${requestedIndex}`
      : "all",
    busy: state.busy === true,
    dirty: state.dirty === true,
    boundaries: state.boundaries,
    selectedBoundary: state.selectedBoundary,
    scopeLabel: state.scopeLabel,
    defaultHeightMeters: state.defaultHeightMeters,
  };
}

export function createStoreyQuickSettings(options: StoreyQuickSettingsOptions): StoreyQuickSettingsHandle {
  const element = document.createElement("section");
  element.className = "editor-storey-quick-settings";
  element.dataset.editorStoreyQuickSettings = "true";
  element.dataset.editorUiInteractive = "true";
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-modal", "false");
  element.setAttribute("aria-label", "Geschosse und Deckenhöhen bearbeiten");
  element.hidden = true;
  element.innerHTML = `
    <header class="editor-storey-quick-settings__header">
      <div><span>WorldEdit</span><strong>Geschosse bearbeiten</strong></div>
      <button type="button" data-storey-close aria-label="Geschosseinstellungen schließen">×</button>
    </header>
    <div class="editor-storey-quick-settings__body">
      <div class="editor-storey-quick-settings__building">
        <span>Baukörper</span><strong data-storey-building>Linien-Brush-Baukörper</strong>
      </div>
      <label class="editor-storey-quick-settings__field">
        <span>Bereich</span>
        <select data-storey-scope><option value="all">Gesamter Baukörper</option></select>
      </label>
      <div class="editor-storey-quick-settings__metric">
        <span>Standardhöhe</span><output data-storey-height>${STANDARD_STOREY_HEIGHT_METERS.toFixed(3).replace(".", ",")} m</output>
        <small>Einzelne Deckenlinien im Gebäude nach oben oder unten ziehen, um unterschiedliche Geschosshöhen einzustellen.</small>
      </div>
      <label class="editor-storey-quick-settings__field">
        <span>Geschossgrenze</span>
        <select data-storey-boundary aria-label="Geschossgrenze auswählen"></select>
      </label>
      <label class="editor-storey-quick-settings__field">
        <span>Höhe über Gebäudebasis (m)</span>
        <input data-storey-boundary-height type="number" min="0.3" step="0.01" aria-label="Höhe der Geschossgrenze in Metern"
          style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;">
      </label>
      <div class="editor-storey-quick-settings__counter">
        <button type="button" data-storey-remove aria-label="Geschoss entfernen">−</button>
        <div><output data-storey-count>1</output><span>Geschosse</span></div>
        <button type="button" data-storey-add aria-label="Geschoss hinzufügen">+</button>
      </div>
      <p data-storey-draft-status role="status" style="font-size:12px;line-height:1.4;margin:12px 0;">Deckenlinien zeigen die Vorschau. Bestätigen übernimmt die Änderungen.</p>
      <button type="button" data-storey-confirm style="width:100%;padding:11px;border:0;border-radius:8px;background:#2563eb;color:white;font:600 14px system-ui;cursor:pointer;">Bestätigen</button>
    </div>
  `;
  options.root.append(element);

  const closeButton = element.querySelector<HTMLButtonElement>("[data-storey-close]");
  const scopeSelect = element.querySelector<HTMLSelectElement>("[data-storey-scope]");
  const addButton = element.querySelector<HTMLButtonElement>("[data-storey-add]");
  const removeButton = element.querySelector<HTMLButtonElement>("[data-storey-remove]");
  const confirmButton = element.querySelector<HTMLButtonElement>("[data-storey-confirm]")!;
  const draftStatus = element.querySelector<HTMLElement>("[data-storey-draft-status]")!;
  const buildingOutput = element.querySelector<HTMLElement>("[data-storey-building]");
  const countOutput = element.querySelector<HTMLOutputElement>("[data-storey-count]");
  const heightOutput = element.querySelector<HTMLOutputElement>("[data-storey-height]")!;
  const boundarySelect = element.querySelector<HTMLSelectElement>("[data-storey-boundary]")!;
  const boundaryInput = element.querySelector<HTMLInputElement>("[data-storey-boundary-height]")!;
  let state = normalizedState({ buildingLabel: "Linien-Brush-Baukörper", storeyCount: 1, segmentCount: 0, scope: "all" });

  function scope(): StoreyTargetScope {
    const value = scopeSelect?.value ?? "all";
    return /^segment:\d+$/.test(value) ? value as StoreyTargetScope : "all";
  }

  function render(next: StoreyQuickSettingsState): void {
    state = normalizedState(next);
    if (buildingOutput) buildingOutput.textContent = state.buildingLabel;
    if (countOutput) countOutput.textContent = String(state.storeyCount);
    if (scopeSelect) {
      const previous = state.scope;
      scopeSelect.replaceChildren(new Option("Gesamter Baukörper", "all"));
      for (const index of state.segmentIndices ?? []) {
        scopeSelect.add(new Option(`${state.scopeLabel ?? "Liniensegment"} ${index + 1}`, `segment:${index}`));
      }
      scopeSelect.value = previous;
      if (!scopeSelect.value) scopeSelect.value = "all";
      scopeSelect.disabled = state.busy === true;
    }
    if (addButton) addButton.disabled = state.busy === true;
    if (removeButton) removeButton.disabled = state.busy === true || state.storeyCount <= 1;
    if (closeButton) closeButton.disabled = state.busy === true;
    confirmButton.disabled = state.busy === true;
    confirmButton.textContent = state.busy ? "Wird gespeichert …" : "Bestätigen";
    draftStatus.textContent = state.busy ? "Die Änderungen werden übernommen."
      : state.dirty ? "Ungespeicherte Vorschau der Deckenlinien. Bestätigen übernimmt die Änderungen; × verwirft sie."
        : "Deckenlinien zeigen die Vorschau. Bestätigen übernimmt die Änderungen.";
    heightOutput.textContent = `${(state.defaultHeightMeters ?? STANDARD_STOREY_HEIGHT_METERS).toFixed(3).replace(".", ",")} m`;
    const boundaries = state.boundaries ?? [];
    const selected = Math.max(1, Math.min(boundaries.length - 1, state.selectedBoundary ?? 1));
    boundarySelect.replaceChildren(...boundaries.slice(1).map((height, index) => new Option(
      `${index + 1 === boundaries.length - 1 ? "Oberkante" : `Decke ${index + 1}`} · ${height.toFixed(2).replace(".", ",")} m`, String(index + 1))));
    boundarySelect.value = String(selected);
    boundarySelect.disabled = state.busy === true || boundaries.length < 2;
    if (document.activeElement !== boundaryInput) boundaryInput.value = String(boundaries[selected] ?? "");
    boundaryInput.disabled = state.busy === true || boundaries.length < 2;
    element.dataset.busy = String(state.busy === true);
  }

  closeButton?.addEventListener("click", () => {
    if (state.busy) return;
    element.hidden = true;
    options.onClose?.(true);
  });
  scopeSelect?.addEventListener("change", () => options.onScopeChange?.(scope()));
  addButton?.addEventListener("click", () => options.onAdd(scope()));
  removeButton?.addEventListener("click", () => options.onRemove(scope()));
  confirmButton.addEventListener("click", () => { if (!state.busy) void options.onConfirm?.(); });
  boundarySelect.addEventListener("change", () => options.onBoundarySelect?.(Number(boundarySelect.value)));
  boundaryInput.addEventListener("change", () => {
    const height = boundaryInput.valueAsNumber;
    if (Number.isFinite(height)) options.onBoundaryChange?.(Number(boundarySelect.value), height);
  });

  return {
    element,
    open(next): void {
      render(next);
      element.hidden = false;
    },
    close(restoreInput = false): void {
      if (element.hidden) return;
      element.hidden = true;
      options.onClose?.(restoreInput);
    },
    sync: render,
    getScope: scope,
    isOpen: () => !element.hidden,
    destroy(): void {
      element.remove();
    },
  };
}
