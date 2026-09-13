import type { StoreyTargetScope } from "./quick_settings";
import { createStoreyPreviewQueue } from "./preview_queue";

export interface StoreyScenePoint { readonly x: number; readonly y: number }
export interface StoreySceneScope {
  readonly scope: StoreyTargetScope;
  readonly label: string;
  readonly paths: readonly (readonly StoreyScenePoint[])[];
  readonly labelPoint: StoreyScenePoint | null;
}
export interface StoreySceneBoundary {
  readonly index: number;
  readonly height: number;
  readonly paths: readonly (readonly StoreyScenePoint[])[];
  /** Signed screen-Y derivative, so dragging works with either camera pitch. */
  readonly pixelsPerMeter: number;
  /** Exact perspective motion at the grabbed facade point, in root pixels. */
  readonly heightFromDrag?: (start: StoreyScenePoint, pixelsY: number) => number;
}
export interface StoreySceneSnapshot {
  readonly scopes: readonly StoreySceneScope[];
  readonly boundaries: readonly StoreySceneBoundary[];
  readonly selectedScope: StoreyTargetScope;
  readonly selectedBoundary: number | null;
  readonly busy: boolean;
}

export function storeyBoundaryHeightFromDrag(height: number, pixels: number, pixelsPerMeter: number): number {
  if (![height, pixels, pixelsPerMeter].every(Number.isFinite) || Math.abs(pixelsPerMeter) < 2) return height;
  return Math.round((height + pixels / pixelsPerMeter) * 100) / 100;
}

/** Screen-projected controls share camera projection with the scene and retain
 * pointer capture while geometry is replaced by a live edit. */
export function createStoreySceneHandles(options: {
  root: HTMLElement;
  snapshot(): StoreySceneSnapshot | null;
  selectScope(scope: StoreyTargetScope): void;
  selectBoundary(index: number): void;
  begin(index: number): void;
  preview(index: number, height: number): void;
  commit(): Promise<void>;
  cancel(): void;
}) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.dataset.storeySceneHandles = "true";
  svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:32;overflow:hidden;pointer-events:none;";
  options.root.append(svg);
  const scopeNodes = new Map<StoreyTargetScope, SVGGElement>();
  const boundaryNodes = new Map<number, SVGPathElement>();
  let enabled = false, frame = 0, committing = false;
  const preview = createStoreyPreviewQueue<{ index: number; height: number }>(value => options.preview(value.index, value.height));
  let gesture: { id: number; node: SVGPathElement; index: number; y: number; height: number; scale: number; next: number;
    heightFromPixels?: (pixels: number) => number } | null = null;
  const path = (paths: readonly (readonly StoreyScenePoint[])[]) => paths.filter(p => p.length > 1)
    .map(points => points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")).join(" ");
  function interactive(element: SVGElement): void { element.dataset.editorUiInteractive = "true"; }
  function cancel(): void {
    preview.cancel();
    if (!gesture) return;
    const old = gesture; gesture = null;
    if (old.node.hasPointerCapture(old.id)) old.node.releasePointerCapture(old.id);
    options.cancel();
  }
  function render(): void {
    const state = enabled ? options.snapshot() : null;
    svg.style.display = state ? "" : "none";
    if (state) {
      const scopes = new Set(state.scopes.map(s => s.scope));
      for (const [key, node] of scopeNodes) if (!scopes.has(key)) { node.remove(); scopeNodes.delete(key); }
      for (const scope of state.scopes) {
        let group = scopeNodes.get(scope.scope);
        if (!group) {
          group = document.createElementNS(ns, "g"); interactive(group);
          group.dataset.storeyScopeHandle = scope.scope;
          const outline = document.createElementNS(ns, "path");
          outline.setAttribute("fill", "none"); outline.setAttribute("stroke-width", "3");
          outline.style.cssText = "pointer-events:stroke;cursor:pointer;";
          const text = document.createElementNS(ns, "text");
          text.setAttribute("text-anchor", "middle");
          text.style.cssText = "font:600 12px system-ui;paint-order:stroke;stroke:white;stroke-width:4;stroke-linejoin:round;pointer-events:all;cursor:pointer;";
          group.append(outline, text); svg.append(group); scopeNodes.set(scope.scope, group);
          group.addEventListener("pointerdown", event => {
            if (event.button !== 0 || committing || options.snapshot()?.busy) return;
            event.preventDefault(); event.stopPropagation(); options.selectScope(scope.scope);
          });
        }
        const selected = scope.scope === state.selectedScope;
        group.children[0]!.setAttribute("d", path(scope.paths));
        group.children[0]!.setAttribute("stroke", selected ? "#f59e0b" : "#1684ef");
        const text = group.children[1]!;
        text.textContent = scope.labelPoint ? scope.label : "";
        text.setAttribute("fill", selected ? "#92400e" : "#0759a8");
        text.setAttribute("x", String(scope.labelPoint?.x ?? 0));
        text.setAttribute("y", String(scope.labelPoint?.y ?? 0));
      }
      const indices = new Set(state.boundaries.map(b => b.index));
      for (const [key, node] of boundaryNodes) if (!indices.has(key) && gesture?.node !== node) { node.parentElement?.remove(); boundaryNodes.delete(key); }
      for (const boundary of state.boundaries) {
        let node = boundaryNodes.get(boundary.index);
        if (!node) {
          const group = document.createElementNS(ns, "g"); interactive(group);
          const halo = document.createElementNS(ns, "path");
          halo.setAttribute("fill", "none"); halo.setAttribute("stroke", "#ffffff"); halo.setAttribute("stroke-width", "6");
          halo.style.pointerEvents = "none";
          const hit = document.createElementNS(ns, "path"); interactive(hit);
          hit.dataset.storeyBoundaryHit = String(boundary.index);
          hit.setAttribute("fill", "none"); hit.setAttribute("stroke", "transparent"); hit.setAttribute("stroke-width", "14");
          hit.style.cssText = "pointer-events:stroke;cursor:ns-resize;touch-action:none;";
          node = document.createElementNS(ns, "path"); interactive(node);
          node.dataset.storeyBoundaryHandle = String(boundary.index);
          node.setAttribute("fill", "none"); node.setAttribute("stroke-linejoin", "round");
          node.style.cssText = "pointer-events:stroke;cursor:ns-resize;touch-action:none;";
          const title = document.createElementNS(ns, "title"); node.append(title);
          group.append(halo, hit, node); svg.append(group); boundaryNodes.set(boundary.index, node);
          const target = node;
          group.addEventListener("pointerdown", event => {
            const current = options.snapshot();
            const value = current?.boundaries.find(b => b.index === boundary.index);
            if (event.button !== 0 || !value || current?.busy || committing) return;
            event.preventDefault(); event.stopPropagation();
            options.selectBoundary(value.index); options.begin(value.index);
            const rect = options.root.getBoundingClientRect();
            const start = { x: event.clientX - rect.left, y: event.clientY - rect.top };
            gesture = { id: event.pointerId, node: target, index: value.index, y: event.clientY,
              height: value.height, scale: value.pixelsPerMeter, next: value.height,
              ...(value.heightFromDrag ? { heightFromPixels: (pixels: number) => value.heightFromDrag!(start, pixels) } : {}) };
            target.setPointerCapture(event.pointerId);
          });
          target.addEventListener("pointermove", event => {
            if (!gesture || gesture.id !== event.pointerId) return;
            event.preventDefault(); event.stopPropagation();
            const pixels = event.clientY - gesture.y;
            const height = gesture.heightFromPixels
              ? Math.round(gesture.heightFromPixels(pixels) * 100) / 100
              : storeyBoundaryHeightFromDrag(gesture.height, pixels, gesture.scale);
            if (height !== gesture.next) { gesture.next = height; preview.push({ index: gesture.index, height }); }
          });
          target.addEventListener("pointerup", event => {
            if (!gesture || gesture.id !== event.pointerId) return;
            event.preventDefault(); event.stopPropagation();
            const changed = Math.abs(gesture.next - gesture.height) > 0.001;
            preview.flush();
            gesture = null; target.releasePointerCapture(event.pointerId);
            if (changed) { committing = true; void options.commit().finally(() => { committing = false; }); }
            else options.cancel();
          });
          target.addEventListener("pointercancel", cancel);
          target.addEventListener("lostpointercapture", cancel);
        }
        node.setAttribute("d", path(boundary.paths));
        const siblings = node.parentElement!.children;
        siblings[0]!.setAttribute("d", node.getAttribute("d")!);
        siblings[1]!.setAttribute("d", node.getAttribute("d")!);
        node.setAttribute("stroke", state.selectedBoundary === boundary.index ? "#f59e0b" : "#1684ef");
        node.setAttribute("stroke-width", state.selectedBoundary === boundary.index ? "5" : "3");
        node.firstChild!.textContent = `Decke ${boundary.index} · ${boundary.height.toFixed(2).replace(".", ",")} m · zum Verschieben ziehen`;
      }
    }
    if (enabled) frame = requestAnimationFrame(render);
  }
  function key(event: KeyboardEvent): void {
    if (event.key === "Escape" && gesture) { event.preventDefault(); event.stopImmediatePropagation(); cancel(); }
  }
  window.addEventListener("keydown", key, true);
  return {
    setEnabled(value: boolean): void {
      if (value === enabled) return;
      enabled = value; cancelAnimationFrame(frame); if (!value) cancel(); render();
    },
    destroy(): void { enabled = false; cancel(); cancelAnimationFrame(frame); window.removeEventListener("keydown", key, true); svg.remove(); },
  };
}
