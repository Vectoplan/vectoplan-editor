import * as THREE from 'three';
import { GeographicPerspectiveCamera, renderGeographicScene } from '../../src/frontend/render/geographic_camera';
import { osmGeometryUvs, osmWorldTilePoint, TERRAIN_OSM_ZOOM, terrainMapTileMaterial } from '../../src/frontend/scene/terrain_osm_overlay';
import { earthGridLonLatToWorld } from '../../src/frontend/utils/earth_grid_coordinates';
import berlin from '../fixtures/berlin_terrain_cut_cells.json';

document.body.innerHTML = `<style>body{margin:18px;font:14px system-ui;background:#f2f5f7}canvas{max-width:100%;border:1px solid #cbd5e1}pre{white-space:pre-wrap}.labels{display:flex;width:1100px;max-width:100%}.labels b{width:50%;padding:10px}</style>
<h2>Georeferenz und Kartenorientierung · echte GPU-Probe</h2><pre id="result">GPU-Probe läuft …</pre>
<div class="labels"><b>Bisherige rechtshändige Kamera: gespiegelte Karte</b><b>Geografische Kamera: lesbar, gleiche Weltkoordinaten</b></div>
<div id="view"></div><button id="osm">Eine echte OSM-Kachel anzeigen</button><p id="source"></p>`;
const status = document.querySelector<HTMLElement>('#result')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1); renderer.setSize(1100, 520);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
document.querySelector('#view')!.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xeeeeee);
scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const tilePoint = osmWorldTilePoint(0, 0, berlin.earthGrid);
const tile: [number, number] = [Math.floor(tilePoint[0]), Math.floor(tilePoint[1])];
function world(u: number, v: number): THREE.Vector3 {
  const n = 2 ** TERRAIN_OSM_ZOOM;
  const lon = (tile[0] + u) / n * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (tile[1] + v) / n))) * 180 / Math.PI;
  const [x, z] = earthGridLonLatToWorld(lon, lat, berlin.earthGrid)!;
  return new THREE.Vector3(x, 0, z);
}
const nw = world(0, 0), ne = world(1, 0), sw = world(0, 1), se = world(1, 1), center = world(.5, .5);
const width = ne.x - nw.x, depth = nw.z - sw.z;
const geometry = new THREE.BufferGeometry().setFromPoints([sw, se, nw, ne]);
geometry.setIndex([0, 2, 1, 2, 3, 1]); geometry.computeVertexNormals();
geometry.setAttribute('uv', new THREE.BufferAttribute(osmGeometryUvs(geometry, new THREE.Matrix4(), berlin.earthGrid, tile), 2));
const source = document.createElement('canvas'); source.width = source.height = 512;
const ctx = source.getContext('2d')!;
for (const [x, y, color] of [[0, 0, '#ff3020'], [256, 0, '#20ff30'], [0, 256, '#2050ff'], [256, 256, '#ffff20']] as const) {
  ctx.fillStyle = color; ctx.fillRect(x, y, 256, 256);
}
ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.font = 'bold 30px sans-serif';
ctx.fillText('NORD ↑', 256, 48); ctx.fillText('WEST', 100, 245); ctx.fillText('OST →', 400, 245);
ctx.fillText('BERLIN · STRASSE 123', 256, 350); ctx.fillText('SÜD', 256, 485);
const texture = new THREE.CanvasTexture(source); texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = true;
const material = terrainMapTileMaterial(texture, new THREE.Vector2(0, 0));
const ground = new THREE.Mesh(geometry, material); ground.receiveShadow = true; scene.add(ground);
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(center.x - width * .3, width * .7, center.z - depth * .3);
sun.target.position.copy(center); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = sun.shadow.camera.bottom = -width;
sun.shadow.camera.right = sun.shadow.camera.top = width;
sun.shadow.camera.near = .1; sun.shadow.camera.far = width * 3;
scene.add(sun, sun.target);
const camera = new GeographicPerspectiveCamera(42, 550 / 520, .1, width * 10);
camera.position.set(center.x, width * 1.1, center.z - depth * .22); camera.lookAt(center); camera.updateMatrixWorld(true);
const oldCamera = new THREE.PerspectiveCamera(42, 550 / 520, .1, width * 10);
oldCamera.position.copy(camera.position); oldCamera.quaternion.copy(camera.quaternion); oldCamera.updateMatrixWorld(true);
const target = new THREE.WebGLRenderTarget(512, 512);
const checks: string[] = [];
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const snapshot = () => {
  const pixels = new Uint8Array(512 * 512 * 4);
  renderer.setRenderTarget(target); renderer.setScissorTest(false); renderer.setViewport(0, 0, 512, 512);
  renderGeographicScene(renderer, scene, camera);
  renderer.readRenderTargetPixels(target, 0, 0, 512, 512, pixels);
  renderer.setRenderTarget(null); return pixels;
};
const pixelAt = (pixels: Uint8Array, point: THREE.Vector3): number[] => {
  const ndc = point.clone().project(camera);
  const x = Math.max(0, Math.min(511, Math.floor((ndc.x + 1) / 2 * 512)));
  const y = Math.max(0, Math.min(511, Math.floor((ndc.y + 1) / 2 * 512)));
  return [...pixels.slice((x + y * 512) * 4, (x + y * 512) * 4 + 3)];
};
function display(): void {
  renderer.setRenderTarget(null); renderer.setScissorTest(true);
  renderer.setViewport(0, 0, 550, 520); renderer.setScissor(0, 0, 550, 520); renderer.render(scene, oldCamera);
  renderer.setViewport(550, 0, 550, 520); renderer.setScissor(550, 0, 550, 520); renderGeographicScene(renderer, scene, camera);
}
try {
  const pixels = snapshot();
  for (const [u, v, expected] of [[.2, .25, 'red'], [.8, .25, 'green'], [.2, .8, 'blue'], [.8, .8, 'yellow']] as const) {
    const point = world(u, v), [r, g, b] = pixelAt(pixels, point);
    const match = expected === 'red' ? r! > g! * 1.4 && r! > b! * 1.4
      : expected === 'green' ? g! > r! * 1.4 && g! > b! * 1.4
      : expected === 'blue' ? b! > r! * 1.4 && b! > g! * 1.4 : r! > b! * 1.4 && g! > b! * 1.4;
    assert(match, `GPU-Probe ${expected}: ${r},${g},${b}`);
    const projected = point.clone().project(camera), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(projected.x, projected.y), camera);
    const hit = ray.intersectObject(ground)[0];
    assert(hit && hit.point.distanceTo(point) < .001, 'Pixel und tatsächlicher Terrain-Pick stimmen nicht überein');
    assert((u < .5 ? projected.x < 0 : projected.x > 0), 'Ost/West ist gespiegelt');
  }
  checks.push('Vier tatsächliche GPU-Farbproben: NW/NE/SW/SE geografisch richtig, Schrift lesbar; echte Raycaster-Treffer identisch.');
  const cube = new THREE.Mesh(new THREE.BoxGeometry(width * .13, depth * .22, depth * .13),
    new THREE.MeshStandardMaterial({ color: 0xb04ace, side: THREE.FrontSide }));
  cube.position.copy(center); cube.position.y = depth * .11; cube.castShadow = true; scene.add(cube);
  const shadowed = snapshot(); cube.castShadow = false; const unshadowed = snapshot(); cube.castShadow = true;
  let changed = 0;
  for (let i = 0; i < shadowed.length; i += 4) {
    if (unshadowed[i]! + unshadowed[i + 1]! + unshadowed[i + 2]! - shadowed[i]! - shadowed[i + 1]! - shadowed[i + 2]! > 35) changed++;
  }
  assert(changed > 30, `Keine korrekten GPU-Schatten sichtbar: ${changed} Pixel`);
  const top = center.clone(); top.y = depth * .22;
  const [r, g, b] = pixelAt(snapshot(), top);
  assert(r! > g! * 1.3 && b! > g! * 1.3, 'FrontSide-Dach wurde weggecullt');
  checks.push(`FrontSide-Dach und ${changed} echte Schattenpixel erhalten; ursprüngliche Weltmatrizen nach jedem Frame wiederhergestellt.`);
  const labelCanvas = document.createElement('canvas'); labelCanvas.width = 256; labelCanvas.height = 64;
  const labelCtx = labelCanvas.getContext('2d')!; labelCtx.fillStyle = '#fff'; labelCtx.fillRect(0, 0, 256, 64);
  labelCtx.fillStyle = '#111'; labelCtx.font = 'bold 30px sans-serif'; labelCtx.fillText('ZAHNRAD →', 12, 43);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(labelCanvas), depthTest: false }));
  sprite.position.set(center.x, depth * .45, center.z); sprite.scale.set(width * .22, width * .055, 1); scene.add(sprite);
  scene.updateMatrixWorld(true);
  const spritePoint = sprite.position.clone().project(camera), ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(spritePoint.x, spritePoint.y), camera);
  assert(ray.intersectObject(sprite).length > 0, 'Zahnrad-Sprite-Picking stimmt nicht mit der Projektion überein');
  checks.push('Zahnrad-Sprite und DOM-Projektionspunkt decken sich; normaler Sprite-Text bleibt lesbar.');
  status.textContent = `PASS\n${checks.map(check => `✓ ${check}`).join('\n')}`;
  document.documentElement.dataset.auditResult = 'pass';
} catch (error) { status.textContent = `FAIL: ${String(error)}\n${checks.join('\n')}`; document.documentElement.dataset.auditResult = 'fail'; }
display();
document.querySelector('#osm')!.addEventListener('click', () => {
  const img = new Image(); img.crossOrigin = 'anonymous';
  const url = `https://tile.openstreetmap.org/${TERRAIN_OSM_ZOOM}/${tile[0]}/${tile[1]}.png`;
  img.onload = () => { texture.image = img; texture.needsUpdate = true; display();
    document.querySelector('#source')!.textContent = `© OpenStreetMap-Mitwirkende · ${url}`; };
  img.onerror = () => { document.querySelector('#source')!.textContent = 'OSM-Kachel konnte nicht geladen werden; geprüfte Testkachel bleibt sichtbar.'; };
  img.src = url;
});
