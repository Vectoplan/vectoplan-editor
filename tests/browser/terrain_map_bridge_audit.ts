import * as THREE from 'three';
import { createTerrainMapBridge } from '../../src/frontend/scene/terrain_map_bridge';
import { createTerrainOsmOverlay, osmWorldTilePoint } from '../../src/frontend/scene/terrain_osm_overlay';
import { GeographicPerspectiveCamera, renderGeographicScene } from '../../src/frontend/render/geographic_camera';
import berlin from '../fixtures/berlin_terrain_cut_cells.json';

const rendererUrl = new URLSearchParams(location.search).get('renderer') || 'http://127.0.0.1:5191/map/terrain';
document.body.style.cssText = 'margin:0;background:#ddd';
const host = document.createElement('div'); host.style.cssText = 'position:relative;width:768px;height:768px'; document.body.append(host);
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(768, 768); host.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#ddd'); scene.add(new THREE.AmbientLight(0xffffff, 3));
const groundGeometry = new THREE.PlaneGeometry(100, 100); groundGeometry.rotateX(-Math.PI / 2);
const ground = new THREE.Mesh(groundGeometry, new THREE.MeshStandardMaterial({ color: '#eee' })); scene.add(ground);
const camera = new GeographicPerspectiveCamera(45, 1, .1, 500); camera.position.set(0, 145, -.1); camera.lookAt(0, 0, 0);
const meshes = [ground];
const overlay = createTerrainOsmOverlay({ host, getFrame: () => berlin.earthGrid, getCamera: () => camera,
  getMeshes: () => meshes, rendererUrl });
function animate() { overlay.update(); renderGeographicScene(renderer, scene, camera); requestAnimationFrame(animate); } animate();
const states: unknown[] = [];
const bridge = createTerrainMapBridge(rendererUrl, state => states.push(state));
const point = osmWorldTilePoint(0, 0, berlin.earthGrid);
(window as any).terrainAudit = {
  states,
  async tile() {
    const result = await bridge.tile(19, Math.floor(point[0]), Math.floor(point[1]));
    const image = result.image as HTMLCanvasElement;
    const pixels = image.getContext('2d')!.getImageData(0, 0, 256, 256).data;
    let mean = 0; const colors = new Set();
    for (let i = 0; i < pixels.length; i += 4) { mean += (pixels[i]! + pixels[i + 1]! + pixels[i + 2]!) / 3; colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`); }
    return { provider: result.provider, mean: mean / (256 * 256), colors: colors.size, dataUrl: image.toDataURL() };
  },
  destroy() { overlay.destroy(); bridge.destroy(); },
};
