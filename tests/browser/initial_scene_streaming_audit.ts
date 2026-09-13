import * as THREE from 'three';
import { createSceneRuntime } from '../../src/frontend/scene/scene_runtime';
import { createWorldRuntime } from '../../src/frontend/runtime/world/world_runtime';
import { visibleChunkCoordinatesAround } from '../../src/frontend/runtime/world/chunk_coordinates';
import { createDefaultEditorBootstrap } from '../../src/frontend/bootstrap/default_bootstrap';
import { normalizeChunkApiBatchResult } from '../../src/frontend/api/chunk_api_normalize';
import { createChunkSourceFailedResult } from '../../src/frontend/runtime/world/chunk_source';
import { bindEditorDomRefs } from '../../src/frontend/dom/dom_refs';
import { createInitialEditorState } from '../../src/frontend/state/editor_state';
import { createEditorStore } from '../../src/frontend/state/editor_store';
import { createLoadingOverlay } from '../../src/frontend/ui/loading_overlay';
import { releaseEditorBoot, updateEditorRuntimeLifecycle } from '../../src/frontend/bootstrap/editor_boot_lifecycle';

// Real SceneRuntime + WorldRuntime + ChunkServiceSource + loader + registry +
// renderer/worker. Only the HTTP transport and multiplayer socket are isolated.
document.body.innerHTML = `<style>body{font:14px system-ui;margin:12px}pre{white-space:pre-wrap}
.scene{position:relative;width:1000px;height:620px}[data-editor-canvas-host]{width:100%;height:100%}
[data-editor-loading-overlay]{position:absolute;inset:0;background:#f0f5fc;display:grid;place-items:center;z-index:100}
[hidden]{display:none!important}#failure{position:absolute;left:-2000px}</style>
<button id="run">Erststart, Dächer und Ansichtswechsel prüfen</button><pre id="result">Bereit</pre>
<main id="main" class="scene"><div data-editor-canvas-host></div><div data-editor-loading-overlay>Nahe Gebäude und Dächer werden geladen…</div></main>
<main id="failure" class="scene"><div data-editor-canvas-host></div><div data-editor-loading-overlay>Nahe Gebäude und Dächer werden geladen…</div></main>`;
const output = document.querySelector<HTMLElement>('#result')!, checks: string[] = [];
const NativeWorker = globalThis.Worker, NativeSocket = globalThis.WebSocket;
globalThis.Worker = class extends NativeWorker {
  constructor() { super(new URL('./chunk-mesh-worker.js', import.meta.url), { type: 'module' }); }
} as typeof Worker;
class IsolatedSocket extends EventTarget {
  static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
  readyState = 0; onopen = null; onclose = null; onerror = null; onmessage = null;
  close(): void { this.readyState = 3; }
  send(): void { throw new Error('Read-only fixture'); }
}
globalThis.WebSocket = IsolatedSocket as unknown as typeof WebSocket;
const assert = (value: unknown, message: string): void => { if (!value) throw Error(message); };
const pass = (message: string): void => { checks.push(`✓ ${message}`); output.textContent = checks.join('\n'); };
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate: () => boolean, message: string): Promise<void> {
  for (let i = 0; i < 1500; i++) { if (predicate()) return; await pause(20); }
  throw Error(message);
}
function fixture(host: HTMLElement, failRoof = false) {
  const bootstrap = structuredClone(createDefaultEditorBootstrap(undefined, { enabled: false }));
  (bootstrap.inventory as any).enabled = false; (bootstrap.runtime.inventory as any).enabled = false;
  (bootstrap.project as any).templateId = 'earth'; (bootstrap.render as any).visibleChunkRadius = failRoof ? 3 : 7;
  (bootstrap.input as any).pointerLockEnabled = false; (bootstrap.featureFlags as any).physicsEnabled = false;
  (bootstrap.camera as any).spawn = { x: 8, y: 8, z: 8 };
  const refs = bindEditorDomRefs(host);
  refs.root.dataset.editorBootGate = 'locked';
  const store = createEditorStore({ initialState: createInitialEditorState({ bootstrap, bootId: `initial-roof-${failRoof}`,
    buildMode: 'test', buildVersion: 'test', createdAt: new Date().toISOString() }) });
  const overlay = createLoadingOverlay({ refs, store, minVisibleMs: 0 });
  updateEditorRuntimeLifecycle(store, 'initializing', { bootAttemptCount: 1 });
  const requested: string[] = []; let connectionCount = 0, roofWaiting = false, releaseRoof: () => void = () => {};
  const roofGate = new Promise<void>(resolve => { releaseRoof = resolve; });
  const roofKey = '23:3:-1';
  const roof = { objectInstanceId: 'delayed-primary-roof', objectTypeId: 'building_roof', objectKind: 'semantic_footprint',
    primaryChunkKey: roofKey, occupiedCells: [{ x: 368, y: 48, z: -16 }], fillBlockTypeId: 'queue_stone',
    footprint: { type: 'Polygon', coordinateSpace: 'world-cell-xz', coordinates: [[[2, 2], [10, 2], [10, 10], [2, 10], [2, 2]]], baseY: 17 },
    metadata: { roofCalculation: { ok: true, geometry: { faces: [{ face_ref: 'roof', polygon_3d_mm: [[2000, 2000, 17000], [10000, 2000, 17000],
      [10000, 10000, 18000], [2000, 10000, 18000]] }] } } } };
  const payload = (coordinate: any) => {
    const key = `${coordinate.chunkX}:${coordinate.chunkY}:${coordinate.chunkZ}`, cells = new Array(4096).fill(0);
    if (coordinate.chunkY === 0) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) cells[x + z * 256] = 1;
    if (key === '0:0:0') for (let y = 1; y < 16; y++) for (let x = 2; x <= 10; x++) cells[x + y * 16 + 2 * 256] = 1;
    // An upper chunk contains a repeated legacy roof ref. The far primary
    // anchor must be discovered transitively before the first scene is shown.
    return { projectId: bootstrap.runtime.chunk.projectId, worldId: bootstrap.runtime.chunk.worldId, ...coordinate,
      chunkKey: key, chunkSize: 16, cellSize: 1, cells, chunkRevision: 1,
      palette: [{ blockTypeId: 'queue_stone', solid: true, breakable: true, placeable: true, metadata: { color: '#c8c0ab' } }],
      objectRefs: key === '0:1:0' || key === roofKey ? [roof] : [], metadata: key === '0:0:0'
        ? { structureStreaming: { schemaVersion: 'structure-streaming.v1', chunkCoordinates: [{ chunkX: 0, chunkY: 1, chunkZ: 0 }] } } : {} };
  };
  const api = { testConnection: async () => { connectionCount++; return { ok: true }; },
    loadChunksBatch: async (projectId: string, worldId: string, coordinates: any[]) => {
      const keys = coordinates.map(c => `${c.chunkX}:${c.chunkY}:${c.chunkZ}`); requested.push(...keys);
      if (keys.includes(roofKey)) {
        roofWaiting = true;
        if (failRoof) return createChunkSourceFailedResult({ error: Error('Only the roof endpoint is temporarily unavailable') });
        await roofGate;
      }
      return normalizeChunkApiBatchResult({ ok: true, chunks: coordinates.map(coordinate => ({ chunk: payload(coordinate) })) }, null, { projectId, worldId });
    },
    loadChunk: async () => createChunkSourceFailedResult({ error: Error('The isolated roof endpoint is unavailable') }),
    sendCommand: () => { throw Error('No fixture writes'); } };
  const world = createWorldRuntime({ bootstrap, store, chunkApiClient: api as any });
  const runtime = createSceneRuntime({ bootstrap, domRefs: refs, store, worldRuntime: world, chunkApiClient: api as any });
  let ready = false;
  const start = () => runtime.initialize().then(() => {
    ready = true; releaseEditorBoot(store, refs, { status: host.dataset.initialSceneCompleteness === 'degraded' ? 'degraded' : 'ready' });
  });
  return { host, refs, world, runtime, store, overlay, requested, start, releaseRoof,
    get ready() { return ready; }, get roofWaiting() { return roofWaiting; }, get connectionCount() { return connectionCount; } };
}
document.querySelector<HTMLButtonElement>('#run')!.addEventListener('click', async event => {
  (event.currentTarget as HTMLButtonElement).disabled = true;
  const main = fixture(document.querySelector<HTMLElement>('#main')!);
  try {
    const boot = main.start();
    await waitFor(() => main.roofWaiting, 'Transitiv referenzierter Dachanker wurde nicht angefordert');
    await pause(1700);
    assert(!main.ready && main.runtime.getStatus() === 'initializing', 'Erststart zeigt Wände vor dem verspäteten Dach');
    assert(!main.refs.loadingOverlay!.hidden, 'Ladebildschirm verschwindet bereits nach dem alten1,5s-Zeitfenster');
    assert(main.requested.filter(key => key.endsWith(':0:0')).every(key => Math.abs(Number(key.split(':')[0])) <= 3), 'Horizontpakete verdrängen die nahe Dachabhängigkeit');
    pass('Verspäteter Dachanker wird über Obergeschoss gefunden; Erststart bleibt nach1,7s bis zum Dach vollständig abgedeckt.');
    main.releaseRoof(); await boot; main.runtime.pause('initial-audit');
    assert(main.host.dataset.initialSceneCompleteness === 'ready', `Nahszene unvollständig: ${main.host.dataset.initialSceneCompleteness}`);
    let roofVisible = false;
    main.runtime.getScene()!.traverse(object => { if (object.userData.semanticRoof && object.userData.objectInstanceId === 'delayed-primary-roof'
      && object.visible && object.parent?.visible) roofVisible = true; });
    assert(roofVisible, 'Erststart meldet bereit, aber das Dachmesh seines entfernten Primärchunks fehlt');
    // Background prefetch can already enqueue new work after initialize resolves;
    // assert the installed near meshes rather than unrelated later queue entries.
    const renderedKeys = new Set<string>();
    main.runtime.getScene()!.traverse(object => {
      if (object instanceof THREE.Mesh && object.visible && object.parent?.visible && typeof object.userData.chunkKey === 'string') renderedKeys.add(object.userData.chunkKey);
    });
    const missingNearMeshes = visibleChunkCoordinatesAround({ chunkX: 0, chunkY: 0, chunkZ: 0 }, 7, { radial: true, verticalRadius: 0 })
      .filter(c => !renderedKeys.has(`${c.chunkX}:${c.chunkY}:${c.chunkZ}`));
    assert(!missingNearMeshes.length, `Freigabe vor Installation von ${missingNearMeshes.length} nahen Gelände-Meshes`);
    pass('Vor Freigabe: kompletter112m-Nahbereich, sichtbares Dach des entfernten Primärchunks und abgeschlossene echte Workerqueue.');
    const scene = main.runtime.getScene(), canvas = main.refs.canvas, initializedAt = main.runtime.getSnapshot().initializedAt;
    for (const mode of ['planning', 'first-person', 'planning'] as const) {
      main.runtime.setWorkspaceMode(mode, 'initial-audit-mode');
      await pause(30);
      assert(main.refs.loadingOverlay!.hidden && main.host.dataset.editorBootGate === 'released', 'Ansichtswechsel stellt den Vollbildloader wieder her');
      assert(main.runtime.getScene() === scene && main.refs.canvas === canvas && main.runtime.getSnapshot().initializedAt === initializedAt,
        'Ansichtswechsel erzeugt Runtime oder Canvas neu');
    }
    assert(main.connectionCount === 1, 'Ansichtswechsel initialisiert die Welt erneut');
    main.runtime.getCamera()!.position.set(30, 28, -28); main.runtime.getCamera()!.lookAt(6, 6, 6); main.runtime.renderOnce('audit-result');
    pass('Ego↔Planung verwendet dieselbe Szene, Kamera-Runtime und Canvas; kein erneuter Weltstart oder Vollbildloader.');
    const failed = fixture(document.querySelector<HTMLElement>('#failure')!, true);
    try {
      await failed.start(); failed.runtime.pause('failed-audit');
      assert(failed.ready && failed.host.dataset.initialSceneCompleteness === 'degraded', 'Fehlender Dachendpunkt wird als vollständig ausgegeben oder blockiert endlos');
      assert(failed.refs.loadingOverlay!.hidden && failed.world.getRegistry().hasChunk('0:0:0'), 'Ein fehlendes Dach verwirft die bereits geladene Umgebung');
      pass('Teilweise fehlender Dachendpunkt: geladene Welt bleibt erhalten, Erststart endet nachvollziehbar eingeschränkt.');
    } finally { await failed.runtime.destroy('audit-cleanup'); await failed.world.destroy(); failed.overlay.dispose(); failed.store.destroy(); }
    output.textContent = checks.join('\n') + '\nPASS'; main.host.dataset.result = 'pass';
  } catch (error) { output.textContent = checks.join('\n') + '\nFAIL ' + (error instanceof Error ? error.stack : String(error)); main.host.dataset.result = 'fail'; }
  finally { main.releaseRoof(); globalThis.Worker = NativeWorker; globalThis.WebSocket = NativeSocket; }
});
