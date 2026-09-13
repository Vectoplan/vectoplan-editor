import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createWorldEditController } from '../../src/frontend/world_edit/world_edit_controller';
import { createConstructionCellMesh } from '../../src/frontend/scene/construction_cell_rendering';
import { createBlockMaterial } from '../../src/frontend/render/block_material';
import { createRoofCalculationMeshes } from '../../src/frontend/scene/roof_calculation_rendering';
import { createFlatRoofCalculation } from '../../src/frontend/world_edit/systems/roof/courtyard';

// The real controller, geometry builders, scene meshes and DOM controls run in
// the browser. Only the chunk transport/render queue is isolated: no project
// data is written by this audit. The separate backend tests cover cell guards.
document.body.innerHTML = `<main id="audit" style="position:relative;width:1200px;height:960px;font:14px system-ui">
  <button id="run">LoD2-Controller-Regression starten</button>
  <pre id="result" style="white-space:pre-wrap;max-width:1100px;min-height:110px">Bereit</pre>
  <div id="view" style="width:1100px;height:560px;position:relative"><small style="position:absolute;left:12px;top:10px;z-index:1;background:#fffe;padding:8px">
  Dieselbe Szene wie der Controller · Linke Maus dreht · Mausrad zoomt · Rechte Maus verschiebt<br>
  Links: geneigtes Dach mit Innenhof · Rechts: unverändertes Nachbargebäude · Magenta: geschützter Nutzerblock
  </small></div>
</main>`;
const root = document.querySelector<HTMLElement>('#audit')!;
const output = document.querySelector<HTMLElement>('#result')!;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdce6ee);
scene.add(new THREE.HemisphereLight(0xffffff, 0x6c7180, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-12, 40, 15); scene.add(sun);
const ground = new THREE.GridHelper(50, 50, 0xa1a8ac, 0xc1c8cc);
ground.position.set(14, 2.1, 6); scene.add(ground);
const camera = new THREE.PerspectiveCamera(50, 1.5, .1, 1000);
camera.position.set(35, 32, 42);
// The audit camera targets synthetic input hits. This independent orbit camera
// displays that exact scene without moving the controller's test raycaster.
const viewCamera = new THREE.PerspectiveCamera(42, 1100 / 560, .1, 1000);
viewCamera.position.set(27, 29, 36);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(1100, 560);
document.querySelector('#view')!.append(renderer.domElement);
const orbit = new OrbitControls(viewCamera, renderer.domElement);
orbit.target.set(13, 6, 6); orbit.enableDamping = true; orbit.update();
renderer.setAnimationLoop(() => { orbit.update(); renderer.render(scene, viewCamera); });
const rendered = new THREE.Group();
rendered.name = 'audit-persisted-objects';
scene.add(rendered);
const baseY = 2.15, eavesY = 7.35, storeyHeight = 2.645;
const outer = [[2.25, 2.25], [10.25, 2.25], [10.25, 10.25], [2.25, 10.25]];
const courtyard = [[5.25, 5.25], [5.25, 7.25], [7.25, 7.25], [7.25, 5.25]];
const other = [[22.25, 2.25], [28.25, 2.25], [28.25, 8.25], [22.25, 8.25]];
type RecordValue = Record<string, any>;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const key = (cell: { x: number; y: number; z: number }) => `${cell.x}:${cell.y}:${cell.z}`;
const commands: RecordValue[] = [];
const stored = new Map<string, RecordValue>();
let protectedCells: Array<{ x: number; y: number; z: number }> = [];
let omittedObjectId = '', mode = 'planning', reloadCount = 0;
let handler: (intent: RecordValue) => Promise<unknown>;
let manualBlock: THREE.Mesh | null = null;

function sourceRoof(buildingId: string, rings: number[][][]): RecordValue {
  const points = (ring: number[][]) => ring.map(([x, z]) => ({ x: x!, y: eavesY, z: z! }));
  const calculation = createFlatRoofCalculation(points(rings[0]!), eavesY * 1000,
    rings.slice(1).map(points), 180) as any;
  const height = (z: number) => eavesY + (z - 2.25) * .2;
  const faces = calculation.geometry.faces.map((face: any) => ({ ...face,
    polygon_3d_mm: face.polygon_3d_mm.map(([x, z]: number[]) => [x, z, height(z! / 1000) * 1000]),
  }));
  calculation.geometry.faces = faces;
  calculation.roof_build_up.top_faces = faces;
  calculation.summary.maximum_height_mm = Math.max(...faces.flatMap((f: any) => f.polygon_3d_mm.map((p: number[]) => p[2])));
  calculation.input_fingerprint = `source-${buildingId}`;
  const facadeSegments = rings.flatMap(ring => ring.map((start, i) => {
    const end = ring[(i + 1) % ring.length]!;
    return { start, end, minimumY: baseY, maximumY: Math.max(height(start[1]!), height(end[1]!)),
      topProfile: [[0, height(start[1]!)], [Math.hypot(end[0]! - start[0]!, end[1]! - start[1]!), height(end[1]!)]] };
  }));
  return { type: 'PlaceObject', objectTypeId: 'building_roof', objectInstanceId: `${buildingId}-source-roof`,
    position: { x: Math.floor(rings[0]![0]![0]!), y: Math.floor(eavesY), z: 2 },
    footprint: { type: 'Polygon', coordinates: rings, baseY: eavesY, height: 1.6 },
    metadata: { lod2BuildingId: buildingId, roofParameters: { roofType: 'imported', pitchDeg: 12,
      eavesHeightMm: eavesY * 1000, importedSource: { schemaVersion: 'lod2-roof-source.v1', buildingId,
        groundFootprints: [rings], footprint: rings, baseY: eavesY, faces, facadeSegments } },
      roofCalculation: calculation },
  };
}
const sourceA = sourceRoof('audit-courtyard', [outer, courtyard]);
const sourceB = sourceRoof('audit-neighbour', [other]);
stored.set(sourceA.objectInstanceId, sourceA);
stored.set(sourceB.objectInstanceId, sourceB);

function installCommittedGeometry(): void {
  rendered.clear();
  for (const command of stored.values()) {
    const object = new THREE.Group();
    object.userData = {
      semanticPlanningBuildArea: command.objectTypeId === 'planning_build_area',
      semanticRoof: command.objectTypeId === 'building_roof',
      semanticObjectRef: { ...clone(command), anchor: command.position },
    };
    if (command.metadata?.constructionCells?.length) {
      const mesh = createConstructionCellMesh(command.metadata.constructionCells,
        createBlockMaterial({ blockTypeId: command.runtimeBlockTypeId ?? command.blockTypeId }));
      if (mesh) object.add(mesh);
    }
    if (command.metadata?.roofCalculation) {
      createRoofCalculationMeshes(command.metadata.roofCalculation).meshes.forEach(mesh => object.add(mesh));
    }
    if (!command.metadata?.generatedFromAreaId) {
      // A source Roof ref carries the facade segments used by the LoD2 wall
      // renderer. Include them so the unconverted neighbour remains visible.
      for (const segment of command.metadata?.roofParameters?.importedSource?.facadeSegments ?? []) {
        const [ax, az] = segment.start, [bx, bz] = segment.end;
        const low = segment.minimumY, ay = segment.topProfile[0][1], by = segment.topProfile.at(-1)[1];
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([
          ax, low, az, ax, ay, az, bx, by, bz,
          ax, low, az, bx, by, bz, bx, low, bz,
        ], 3));
        geometry.computeVertexNormals();
        object.add(new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: 0xd8d4c9, side: THREE.DoubleSide })));
      }
    }
    rendered.add(object);
  }
  scene.updateMatrixWorld(true);
}
installCommittedGeometry();

function acceptPlace(command: RecordValue): void {
  const accepted = clone(command);
  if (accepted.metadata?.renderProfile === 'construction-grid') {
    const preserved = new Set(protectedCells.map(key));
    accepted.metadata.constructionCells = accepted.metadata.constructionCells.filter((cell: any) => !preserved.has(key(cell)));
    accepted.occupiedCells = accepted.occupiedCells.filter((cell: any) => !preserved.has(key(cell)));
    if (!accepted.occupiedCells.length) accepted.metadata.voxelOccupancy = 'none';
  }
  stored.set(accepted.objectInstanceId, accepted);
}
async function sendCommand(payload: RecordValue): Promise<RecordValue> {
  commands.push(clone(payload));
  if (payload.type === 'ObjectBatch') {
    if (!protectedCells.length) {
      // Simulate one complete child being superseded by user edits. Readiness
      // must not wait forever for a mesh that the server intentionally omits.
      const protectedChild = payload.commands.find((c: any) => c.objectTypeId === 'planning_building_floor_slab')
        ?? payload.commands.find((c: any) => c.metadata?.constructionCells?.length);
      omittedObjectId = protectedChild.objectInstanceId;
      protectedCells = clone(protectedChild.occupiedCells);
      const cell = protectedCells[0]!;
      manualBlock = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xd946ef }));
      manualBlock.name = 'audit-user-preserved-block';
      manualBlock.position.set(cell.x + .5, cell.y + .5, cell.z + .5);
      scene.add(manualBlock);
    }
    const marker = { validationVersion: 'lod2-building-edit.v1', buildingId: payload.lod2BuildingEdit.buildingId,
      preservedCells: clone(protectedCells) };
    for (const command of payload.commands) {
      acceptPlace(command.objectTypeId === 'planning_build_area'
        ? { ...command, metadata: { ...command.metadata, lod2BuildingEdit: marker } } : command);
    }
    return { ok: true, changed: true, lod2BuildingEdit: marker };
  }
  if (payload.type === 'RemoveObject') stored.delete(payload.objectInstanceId);
  if (payload.type === 'PlaceObject') acceptPlace(payload);
  return { ok: true, changed: true };
}
const input = new Proxy({}, { get: () => () => Promise.resolve() });
const runtime = new Proxy({
  getScene: () => scene, getCamera: () => camera, getRenderer: () => null,
  getWorkspaceMode: () => mode, setWorkspaceMode: (next: string) => { mode = next; },
  getSelectedLibraryPlacement: () => ({ valid: false, runtimeBlockTypeId: null, objectKind: null }),
  getInputController: () => input,
  getTargetCells: () => ({ sourceCell: null, placementCell: null, targetPoint: null }),
  setWorldEditIntentHandler: (next: typeof handler) => { handler = next; },
  // Intentionally fulfilled without installed meshes, as with a deferred
  // renderer/degraded request. The audit explicitly releases the render queue.
  reloadDirtyChunks: async () => { reloadCount++; },
}, { get: (target, property) => property in target ? (target as any)[property] : () => null });
const controller = createWorldEditController({ root,
  bootstrap: { runtime: { chunk: { projectId: 'lod2-audit', worldId: 'lod2-audit' } } },
  sceneRuntime: runtime, worldRuntime: {
    getRegistry: () => ({ getSnapshot: () => ({ entries: [] }) }),
    getSource: () => ({ sendCommand }),
  }, logger: { warn: (...args: unknown[]) => log(JSON.stringify(args)), debug: () => {} },
} as any);
const checks: string[] = [];
function log(text: string): void { output.textContent = [...checks, text].join('\n'); }
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function passed(message: string): void { checks.push(`✓ ${message}`); log('Läuft …'); }
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
async function waitFor(check: () => boolean, message: string): Promise<void> {
  for (let i = 0; i < 160; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 25)); }
  throw new Error(`${message}; Status: ${root.querySelector('[data-world-edit-status]')?.textContent}`);
}
const settled = async () => { await frame(); await waitFor(() => root.querySelector('[data-world-edit-status]')?.getAttribute('data-kind') !== 'busy', 'Speichern beendet nicht'); };
const preview = () => scene.getObjectByName('vectoplan_world_edit_planning_build_area');
const selectedFirstX = () => preview()?.children.find(child => child.userData.polygonAreaPointIndex === 0)?.position.x;
const batches = () => commands.filter(command => command.type === 'ObjectBatch');
const parentIn = (batch: RecordValue) => batch.commands.find((command: any) => command.objectTypeId === 'planning_build_area');
async function point(x: number, z: number): Promise<void> {
  // Explicit world hit is deliberately fractional; snapping before building
  // lookup would move the left facade hit outside this source GroundSurface.
  camera.lookAt(1000, 1000, 1000); camera.updateMatrixWorld(true);
  const hit = { x, y: baseY + 1, z };
  await handler({ action: 'primary', position: { x: Math.floor(x), y: 3, z: Math.floor(z) },
    targetPoint: hit, sourceCell: null, placementCell: null, trigger: 'audit', createdAt: 'audit' });
  await handler({ action: 'primary-release', position: null, targetPoint: null,
    sourceCell: null, placementCell: null, trigger: 'audit', createdAt: 'audit' });
  await settled();
}
function assertRoofAndCourtyard(batch: RecordValue, delta: number): void {
  const parent = parentIn(batch);
  assert(parent.metadata.contourBuilding.footprint.coordinates[0].length === 2, 'Innenhofring fehlt im gespeicherten Elternobjekt');
  assert(JSON.stringify(parent.metadata.contourBuilding.footprint.coordinates[0][1]) === JSON.stringify(courtyard), 'Innenhofkoordinaten wurden verändert');
  const roofs = batch.commands.filter((command: any) => command.metadata?.roofCalculation);
  assert(roofs.length > 0, 'Dach fehlt in der Generation');
  let area = 0;
  for (const roof of roofs) for (const face of roof.metadata.roofCalculation.geometry.faces) {
    const vertices = face.polygon_3d_mm as number[][];
    for (const [x, z, y] of vertices) {
      assert(Math.abs(y! / 1000 - (eavesY + (z! / 1000 - 2.25) * .2 + delta)) < 1e-5,
        `Dachneigung/Traufe driftet bei ${x},${z},${y}; Δ=${delta}`);
    }
    area += Math.abs(vertices.reduce((sum, p, i) => {
      const q = vertices[(i + 1) % vertices.length]!; return sum + p[0]! * q[1]! - q[0]! * p[1]!;
    }, 0)) / 2e6;
    const center = vertices.reduce((sum, p) => [sum[0]! + p[0]! / vertices.length / 1000,
      sum[1]! + p[1]! / vertices.length / 1000], [0, 0]);
    assert(!(center[0]! > 5.25 && center[0]! < 7.25 && center[1]! > 5.25 && center[1]! < 7.25), 'Dach verschließt den Innenhof');
  }
  assert(Math.abs(area - 60) < 1e-5, `Dachfläche muss 64−4=60 m² bleiben, erhalten ${area}`);
}
async function addStorey(): Promise<void> {
  camera.lookAt(6, 8, 6); camera.updateMatrixWorld(true);
  await frame();
  const handle = root.querySelector<HTMLButtonElement>('[data-storey-drag-handle]')!;
  assert(handle && !handle.hidden, 'Geschossgriff ist in dieser Ansicht nicht verfügbar');
  const before = batches().length;
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  await waitFor(() => batches().length === before + 1, 'Geschossgriff hat keine atomare Generation gespeichert');
  await settled();
}

document.querySelector<HTMLButtonElement>('#run')!.addEventListener('click', async event => {
  (event.currentTarget as HTMLButtonElement).disabled = true;
  try {
    const originalJson = JSON.stringify(sourceA), neighbourJson = JSON.stringify(sourceB);
    controller.activate('room');
    await point(2.251, 4.1);
    assert(selectedFirstX() === outer[0]![0], 'Exakter Fassadentreffer wählt LoD2-Gebäude nicht aus');
    assert(commands.length === 0, 'Initiale LoD2-Auswahl darf keine Schreiboperation senden');
    assert(JSON.stringify(sourceA) === originalJson, 'Initiale Auswahl mutiert Originaldaten');
    controller.activate('selection'); await settled();
    assert(commands.length === 0, 'Verlassen einer unveränderten LoD2-Auswahl darf nicht konvertieren');
    passed('Planung: exakte LoD2-Auswahl und Werkzeugwechsel ohne Schreiben');

    controller.deactivate(); mode = 'first-person'; controller.activate('storey');
    await point(2.251, 4.1);
    assert(commands.length === 0, 'Ego-Geschossauswahl darf nicht selbst speichern');
    await addStorey();
    const first = batches()[0]!;
    assert(first.lod2BuildingEdit?.buildingId === 'audit-courtyard', 'Gebäudeidentität fehlt im Backend-Guard');
    assert(parentIn(first).metadata.storeyCount === 3, 'Ein Geschoss muss die zwei ursprünglichen Geschosse auf drei erhöhen');
    assertRoofAndCourtyard(first, storeyHeight);
    assert(JSON.stringify(sourceB) === neighbourJson, 'Konvertierung verändert das Nachbargebäude');
    assert(!stored.has(sourceA.objectInstanceId), 'Abgelöste originale Dachreferenz wurde nicht pensioniert');
    assert(stored.has(sourceB.objectInstanceId), 'Nachbardach wurde fälschlich entfernt');
    passed('Ego: +1 Geschoss erhält schräge Dachflächen, relative Traufe und Innenhof');

    controller.activate('room'); await point(22.251, 4.1);
    assert(selectedFirstX() === outer[0]![0], 'Wechsel während ausstehender Meshes verliert die gespeicherte Vorschau');
    controller.activate('selection'); await settled();
    assert(preview(), 'Erfolgreiche HTTP-Antwort ohne Meshes darf die Ersatzdarstellung nicht entfernen');
    assert(reloadCount > 0, 'Konvertierung fordert keine neuen Chunks an');
    installCommittedGeometry();
    const omitted = rendered.children.find(object => object.userData.semanticObjectRef.objectInstanceId === omittedObjectId);
    assert(omitted && omitted.children.length === 0, 'Fixture muss einen vollständig geschützten, meshfreien Kindkörper enthalten');
    await waitFor(() => !preview(), 'Geschützte Zellen verhindern den Handoff zu den tatsächlichen Meshes');
    assert(manualBlock?.parent === scene && manualBlock.visible, 'Manuell geänderter Block ist verloren gegangen');
    const preserved = new Set(protectedCells.map(key));
    assert([...stored.values()].every(command => (command.metadata?.constructionCells ?? []).every((cell: any) => !preserved.has(key(cell)))),
      'Servergeschützte Positionen dürfen nicht von generierten Meshes überdeckt werden');
    assert(batches().length === 1, 'Mesh-Retry darf keinen zusätzlichen Save senden');
    passed('Save-Handoff wartet auf echte Meshes und akzeptiert vollständig geschützte Kindkörper');

    mode = 'planning'; controller.activate('room'); await point(22.251, 4.1);
    assert(selectedFirstX() === other[0]![0], 'Nach dem Handoff lässt sich das zweite Gebäude nicht auswählen');
    assert(batches().length === 1, 'Auswahl des zweiten Gebäudes darf keine neue Generation senden');
    controller.activate('storey'); await point(2.251, 4.1); await addStorey();
    const second = batches()[1]!;
    assert(parentIn(second).metadata.storeyCount === 4, 'Erneute Auswahl verliert die gespeicherte Geschosszahl');
    assertRoofAndCourtyard(second, 2 * storeyHeight);
    controller.activate('selection'); await settled(); installCommittedGeometry();
    await waitFor(() => !preview(), 'Zweiter Save übergibt nicht an die gespeicherten Meshes');
    passed('Mehrgebäude-Wechsel und zweites Geschoss in Planung behalten die ursprüngliche Dachhöhe als Basis');
    controller.destroy();
    output.textContent = `PASS\n${checks.join('\n')}`;
    document.documentElement.dataset.auditResult = 'pass';
  } catch (error) {
    output.textContent = `FAIL: ${String(error)}\n${checks.join('\n')}`;
    document.documentElement.dataset.auditResult = 'fail';
  }
});
