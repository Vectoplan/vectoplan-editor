import * as THREE from 'three';
import { createSceneRuntime } from '../../src/frontend/scene/scene_runtime';
import { createDefaultEditorBootstrap } from '../../src/frontend/bootstrap/default_bootstrap';
import { bindEditorDomRefs } from '../../src/frontend/dom/dom_refs';
import { createInitialEditorState } from '../../src/frontend/state/editor_state';
import { createEditorStore } from '../../src/frontend/state/editor_store';
import { createChunkRegistry } from '../../src/frontend/runtime/world/chunk_registry';
import { createRuntimeChunkContent } from '../../src/frontend/runtime/world/chunk_content';
import { constructionCellForIntersection } from '../../src/frontend/scene/construction_cell_rendering';

// Actual SceneRuntime, registry, WebGL renderer and meshing worker. Only the
// network/world loader is replaced; worker results are computed normally and
// their delivery is gated to reproduce packet/update races deterministically.
document.body.innerHTML = `<style>body{font:14px system-ui;margin:12px}pre{white-space:pre-wrap}
#audit{position:relative;width:1000px;height:620px}[data-editor-canvas-host]{width:100%;height:100%}
[hidden]{display:none!important}</style><button id="run">Chunk-Worker-Burst prüfen</button><pre id="result">Bereit</pre>
<main id="audit"><div data-editor-canvas-host></div></main>`;
type Data = Record<string, any>;
type Build = { key: string; cells: number[]; deliver?: () => void; response?: Data; released: boolean };
const root = document.querySelector<HTMLElement>('#audit')!, output = document.querySelector<HTMLElement>('#result')!;
const checks: string[] = [], builds: Build[] = [];
let automaticDelivery = false;
const NativeWorker = globalThis.Worker, NativeSocket = globalThis.WebSocket;
const nativeRequestIdleCallback = window.requestIdleCallback;
class GatedMesher {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly worker = new NativeWorker(new URL('./chunk-mesh-worker.js', import.meta.url), { type: 'module' });
  readonly pending = new Map<number, Build>();
  constructor() {
    this.worker.onmessage = event => {
      const build = this.pending.get(event.data.id)!;
      build.response = event.data;
      build.deliver = () => { build.released = true; this.onmessage?.(event); this.pending.delete(event.data.id); };
      if (automaticDelivery) build.deliver();
    };
    this.worker.onerror = event => this.onerror?.(event);
  }
  postMessage(message: Data, transfers: Transferable[]): void {
    const build = { key: message.chunk.chunkKey, cells: Array.from(message.chunk.cells) as number[], released: false };
    builds.push(build); this.pending.set(message.id, build); this.worker.postMessage(message, transfers);
  }
  terminate(): void { this.worker.terminate(); }
}
// Multiplayer is unrelated to this queue test; do not open a real session.
class IsolatedSocket extends EventTarget {
  static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
  readyState = 0; onopen = null; onclose = null; onerror = null; onmessage = null;
  close(): void { this.readyState = 3; }
  send(): void { throw new Error('This read-only fixture must not publish multiplayer data'); }
}
globalThis.Worker = GatedMesher as unknown as typeof Worker;
globalThis.WebSocket = IsolatedSocket as unknown as typeof WebSocket;
const bootstrap = structuredClone(createDefaultEditorBootstrap(undefined, { enabled: false }));
(bootstrap.inventory as Data).enabled = false; (bootstrap.runtime.inventory as Data).enabled = false;
(bootstrap.input as Data).pointerLockEnabled = false; (bootstrap.featureFlags as Data).physicsEnabled = false;
(bootstrap.camera as Data).spawn = { x: 8, y: 12, z: 8 };
const refs = bindEditorDomRefs(root), registry = createChunkRegistry({ defaultChunkSize: 16 });
const store = createEditorStore({ initialState: createInitialEditorState({ bootstrap, bootId: 'mesh-queue-audit',
  buildMode: 'test', buildVersion: 'test', createdAt: new Date().toISOString() }) });
const listeners = new Set<(event: Data) => void>();
const source = { subscribe: (listener: (event: Data) => void) => { listeners.add(listener); return () => listeners.delete(listener); },
  getLoadedChunkKeys: () => registry.getChunkKeys(), getSummary: () => ({ status: 'ready', loadedChunkCount: registry.getStats().chunkCount }),
  getDirtyChunkKeys: () => [], markChunkDirty: () => [], sendCommand: () => { throw new Error('Fixture cannot write'); } };
const loader = { loadCoordinates: async () => ({ ok: true, chunks: [] }), getSnapshot: () => ({ pendingCount: 0, queuedCount: 0 }) };
const world = { initialize: async () => {}, getRegistry: () => registry, getSource: () => source, getLoader: () => loader,
  getStatus: () => 'ready', getSnapshot: () => ({ status: 'ready', loadedChunkKeys: registry.getChunkKeys() }),
  loadAroundChunk: async () => [], requestFullRefresh: async () => {}, reloadDirtyChunks: async () => {},
  sampleCell: registry.sampleCellByWorldPosition, getCollisionCell: registry.getCollisionCell };
const errors: unknown[] = [];
const runtime = createSceneRuntime({ bootstrap, domRefs: refs, store, worldRuntime: world as any, chunkApiClient: {} as any,
  logger: { warn: (...args: unknown[]) => errors.push(args), error: (...args: unknown[]) => errors.push(args) } as any });
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function pass(message: string): void { checks.push(`✓ ${message}`); output.textContent = checks.join('\n'); }
async function waitFor(check: () => boolean, message: string): Promise<void> {
  for (let i = 0; i < 450; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  throw new Error(`${message}; status=${runtime.getStatus()}, queue=${runtime.getSnapshot().pendingChunkMeshCount}, builds=${builds.map(b => b.key).join(',')}`);
}
function put(x: number, revision: number, occupied: number[][], objectRefs: Data[] = []): void {
  const cells = new Array(4096).fill(0); occupied.forEach(([x, y, z]) => { cells[x! + 16 * (y! + 16 * z!)] = 1; });
  registry.setChunk(createRuntimeChunkContent({ projectId: 'queue-fixture', worldId: 'world-fixture',
    chunkKey: `${x}:0:0`, chunkX: x, chunkY: 0, chunkZ: 0, chunkSize: 16, cellSize: 1,
    chunkRevision: revision, cells, palette: [{ cellValue: 1, blockTypeId: 'queue_stone', label: 'Stein', solid: true, breakable: true, placeable: true }],
    stats: {}, metadata: {}, source: 'chunk-service', objectRefs } as any), { visible: true });
}
function burst(count = 64): void { for (let i = 0; i < count; i++) for (const listener of listeners) listener({ type: 'chunks-loaded', payload: { chunks: [] } }); }
async function nextBuild(key: string, after: number): Promise<Build> {
  await waitFor(() => builds.slice(after).some(build => build.key === key && !!build.response), `Workerantwort für ${key} fehlt`);
  const build = builds.slice(after).find(build => build.key === key && !!build.response)!;
  assert(build.response!.ok && build.response!.result.buffers.length > 0, 'Echter Mesher liefert keine Geometrie'); return build;
}
function rendered(key: string): THREE.Group | undefined {
  return runtime.getScene()?.getObjectByName('vectoplan-editor-chunks')?.children.find(group => group.userData.chunkKey === key) as THREE.Group | undefined;
}
async function release(build: Build): Promise<void> { build.deliver!(); await new Promise(resolve => setTimeout(resolve, 40)); }
document.querySelector<HTMLButtonElement>('#run')!.addEventListener('click', async event => {
  (event.currentTarget as HTMLButtonElement).disabled = true;
  try {
    put(0, 1, [[15, 0, 0]]);
    const initializing = runtime.initialize();
    const first = await nextBuild('0:0:0', 0); burst();
    assert(runtime.getSnapshot().pendingChunkMeshCount === 1, 'Progressive Pakete erzeugen keine reproduzierbare in-flight Doppelanforderung');
    await release(first); await initializing; runtime.pause('queue-audit');
    await waitFor(() => !!rendered('0:0:0'), 'Gültiges fertiges Mesh wurde trotz unveränderter Revision verworfen');
    assert(builds.filter(build => build.key === '0:0:0').length === 1, '64 redundante Pakete starten unnötigen Zweitbau');
    assert(root.dataset.sceneRuntimeChunkMeshingThread === 'worker', 'Regression lief unbemerkt im Mainthread-Fallback');
    pass('64 Fortschrittspakete während echtem Workerbau: fertiger Chunk wird sofort installiert, genau ein Bau.');

    let start = builds.length; put(3, 1, [[0, 0, 0]]); burst(1);
    const stale = await nextBuild('3:0:0', start); put(3, 2, [[0, 0, 0], [0, 1, 0]]); burst();
    await release(stale); assert(!rendered('3:0:0'), 'Zwischenzeitlich überholte Zellrevision wurde sichtbar installiert');
    start = builds.indexOf(stale) + 1; const fresh = await nextBuild('3:0:0', start); await release(fresh);
    await waitFor(() => !!rendered('3:0:0'), 'Neueste Zellrevision wird nicht installiert');
    const bounds = new THREE.Box3().setFromObject(rendered('3:0:0')!);
    assert(Math.abs(bounds.max.y - 2) < 1e-6, 'Installierte Geometrie enthält die zuletzt hinzugefügte Zelle nicht');
    pass('Echte Zelländerung während Bau: veraltetes Ergebnis verworfen, neueste Geometrie mit zusätzlicher Zelle installiert.');

    start = builds.length; put(0, 3, [[15, 0, 0]]); burst(1);
    const oldBoundary = await nextBuild('0:0:0', start); put(1, 1, [[0, 0, 0]]); burst();
    await release(oldBoundary);
    assert(String(rendered('0:0:0')!.userData.chunkRevision).startsWith('1:'), 'Neue Nachbargrenze hat überholtes Mesh nicht invalidiert');
    const newBoundary = await nextBuild('0:0:0', builds.indexOf(oldBoundary) + 1);
    assert(oldBoundary.response!.result.quadCount === 6 && newBoundary.response!.result.quadCount === 5, 'Echter Worker berücksichtigt die neu verdeckte Nachbarfläche nicht');
    await release(newBoundary);
    automaticDelivery = true; builds.filter(build => build.deliver && !build.released).forEach(build => build.deliver!());
    await waitFor(() => !!rendered('1:0:0') && runtime.getSnapshot().pendingChunkMeshCount === 0
      && root.dataset.sceneRuntimeChunkMeshWorkerBusy === 'false', 'Queue läuft nach dem Burst nicht leer');
    pass('Nachbarpaket invalidiert betroffene Grenzfläche: 6→5 Quads; neue Nachbargeometrie erscheint und Queue läuft leer.');
    assert(builds.length === 6, `Unerwartete Wiederholungsbauten: ${builds.length} statt 6`);

    const slab = { x: 80, y: 0, z: 0, minimumY: 0, maximumY: .25,
      footprintPolygons: [[[80, 0], [81, 0], [81, 1], [80, 1]]] };
    const wall = { ...slab, minimumY: .25, maximumY: 1 };
    const part = (id: string, cell: typeof slab) => ({ objectInstanceId: id, objectKind: 'block_composite',
      objectTypeId: 'planning_building_storey_walls', primaryChunkKey: '5:0:0', fillBlockTypeId: 'queue_stone',
      occupiedCells: [{ x: 80, y: 0, z: 0 }], footprint: { type: 'MultiPolygon', coordinateSpace: 'world-cell-xz', coordinates: [] },
      metadata: { renderProfile: 'construction-grid', voxelOccupancy: 'blocks', generatedFromAreaId: 'worker-building', constructionCells: [cell] } });
    put(5, 1, [[0, 0, 0]], [part('worker-slab', slab), part('worker-wall', wall)]); burst();
    await waitFor(() => !!rendered('5:0:0'), 'Construction-Workerergebnis erscheint nicht in der echten SceneRuntime');
    const construction = rendered('5:0:0')!.children.filter(mesh => mesh.userData.constructionGrid) as THREE.Mesh[];
    assert(construction.length === 2 && construction.every(mesh => mesh.userData.constructionMeshingThread === 'worker'),
      'Gebäudegeometrie wurde nicht über Worker aufgebaut und in die Szene übernommen');
    assert(construction.every(mesh => mesh.geometry.getAttribute('position').count / 3 === 10), 'Objektinterfaces wurden im Worker nicht entfernt');
    for (const [id, height, original] of [['worker-slab', .1, slab], ['worker-wall', .6, wall]] as const) {
      const mesh = construction.find(mesh => mesh.userData.objectInstanceId === id)!; mesh.updateMatrixWorld();
      const hit = new THREE.Raycaster(new THREE.Vector3(79, height, .6), new THREE.Vector3(1, 0, 0)).intersectObject(mesh)[0];
      assert(!!hit && constructionCellForIntersection(hit) === original, 'Worker-Mining-Zuordnung verliert die originale Geschoss-/Wandzelle');
    }
    pass('Echte SceneRuntime übernimmt Gebäudeprismen aus dem Worker: Interfaces entfernt, Fassaden-/Deckenabbau trifft Originalzellen.');
    await waitFor(() => runtime.getSnapshot().pendingChunkMeshCount === 0 && root.dataset.sceneRuntimeChunkMeshWorkerBusy === 'false', 'Vorbereitende Queue ist nicht abgeschlossen');
    let starvedIdleCalls = 0;
    window.requestIdleCallback = (() => { starvedIdleCalls++; return 999_999; }) as typeof window.requestIdleCallback;
    const burstStart = performance.now(), dispatchStart = builds.length;
    const independentColumns = Array.from({ length: 12 }, (_, index) => 20 + index * 2);
    independentColumns.forEach(x => put(x, 1, [[1, 1, 1]])); burst(1);
    await waitFor(() => independentColumns.every(x => !!rendered(`${x}:0:0`))
      && runtime.getSnapshot().pendingChunkMeshCount === 0, 'Workerqueue wartet auf ausbleibende Browser-Leerlaufcallbacks');
    assert(starvedIdleCalls === 0, 'Ausgelagerte Workerarbeit wurde weiterhin als Mainthread-Leerlaufarbeit geplant');
    assert(builds.length - dispatchStart === 12, 'Leerlaufregression erzeugt unnötige Wiederholungsbauten');
    window.requestIdleCallback = nativeRequestIdleCallback;
    pass(`Ohne einen einzigen Browser-Leerlaufcallback: 12 echte Workerjobs und Chunkmeshes fertig (${Math.round(performance.now() - burstStart)} ms).`);
    const renderer = runtime.getRenderer()!;
    const nativeRender = renderer.render;
    let renderCalls = 0;
    renderer.render = function (...args: Parameters<typeof nativeRender>) {
      renderCalls++; return nativeRender.apply(this, args);
    };
    try {
      runtime.start('render-burst-audit');
      for (let i = 0; i < 24; i++) runtime.renderOnce('streaming-progress-audit');
      assert(renderCalls === 0, 'Streaming renderOnce rendert synchron zusätzlich zum laufenden Frame');
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      assert(renderCalls === 1, 'Laufender Frame übernimmt den gesamten Renderburst nicht genau einmal');
      runtime.pause('render-burst-audit');
      runtime.renderOnce('paused-preview-audit');
      assert(renderCalls === 2, 'Pausierte Vorschau rendert nach der Optimierung nicht mehr');
      pass('24 Renderanforderungen während laufender Kamera: ein echtes WebGL-Bild; pausierte Vorschau aktualisiert weiterhin sofort.');
    } finally { runtime.pause('render-burst-audit-complete'); renderer.render = nativeRender; }
    assert(runtime.getSnapshot().lastError === null, 'SceneRuntime meldet Fehler');
    runtime.getCamera()!.position.set(28, 24, -28); runtime.getCamera()!.lookAt(24, 0, 0); runtime.renderOnce('queue-audit-final');
    output.textContent = checks.join('\n') + '\nPASS'; root.dataset.result = 'pass';
  } catch (error) {
    output.textContent = checks.join('\n') + '\nFAIL ' + (error instanceof Error ? error.stack : String(error)) + '\n' + JSON.stringify(errors); root.dataset.result = 'fail';
  } finally {
    automaticDelivery = true; builds.filter(build => build.deliver && !build.released).forEach(build => build.deliver!());
    globalThis.Worker = NativeWorker; globalThis.WebSocket = NativeSocket;
    window.requestIdleCallback = nativeRequestIdleCallback;
  }
});
