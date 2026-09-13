import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { GeographicPerspectiveCamera, renderGeographicScene } from '../../src/frontend/render/geographic_camera';
import { createGeodataOverlayScene } from '../../src/frontend/render/geodata_overlay_scene';

// Real registry -> draping -> wide-line shader -> reflected geographic GPU pass.
const scene = new THREE.Scene(); scene.background = new THREE.Color('#eeeeee');
const entry = { cellValue: 1, blockTypeId: 'terrain', solid: true, metadata: { role: 'terrain' } };
const chunk: any = { chunkKey: '0:0:0', chunkX: 0, chunkY: 0, chunkZ: 0, chunkSize: 2, cellSize: 1,
  cells: Array(8).fill(1), palette: [entry], paletteByCellValue: new Map([[1, entry]]),
  loadedAt: 'gpu-audit', chunkRevision: 1, raw: { metadata: { geodataOverlays: {
    schemaVersion: 'geodata-overlays.v1', items: [{ id: 'parcel-boundaries', datasetId: 'flurstuecke',
      tileKey: '0:0', renderMode: 'surface-lines', semanticRole: 'parcel-boundary',
      geometry: { dimensions: 'world-xz', coordinates: [[[0.1, 0.5], [1.9, 0.5]], [[0.1, 1.5], [1.9, 1.5]]] },
      style: { color: '#1687ff', lineWidth: 3, opacity: 1 } }],
  } } } };
const overlays = createGeodataOverlayScene({ parent: scene });
const stats = overlays.syncFromRegistry({ getVisibleChunkKeys: () => [chunk.chunkKey], getChunk: () => chunk,
  hasChunk: () => true } as any);
const drawable = overlays.getGroup().getObjectByName('geodata_overlay_parcel-boundaries') as LineSegments2;
if (!drawable) throw Error('No boundary drawable');
const material = drawable.material as LineMaterial;
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(512, 512);
document.body.append(renderer.domElement);
const camera = new GeographicPerspectiveCamera(45, 1, .1, 100);
camera.position.set(1, 5, -.5); camera.lookAt(1, 2, 1);
const target = new THREE.WebGLRenderTarget(512, 512);
function bluePixels(side: number): number {
  material.side = side; material.needsUpdate = true;
  renderer.setRenderTarget(target); renderGeographicScene(renderer, scene, camera);
  const pixels = new Uint8Array(512 * 512 * 4); renderer.readRenderTargetPixels(target, 0, 0, 512, 512, pixels);
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 2]! > pixels[i]! + 60 && pixels[i + 2]! > pixels[i + 1]! + 20) count++;
  return count;
}
const productionSide = material.side;
const before = bluePixels(THREE.FrontSide), after = bluePixels(THREE.DoubleSide);
renderer.setRenderTarget(null); material.side = productionSide; material.needsUpdate = true;
renderGeographicScene(renderer, scene, camera);
(window as any).boundaryAudit = { before, after, production: bluePixels(productionSide), stats };
document.body.append(Object.assign(document.createElement('pre'), { textContent: JSON.stringify((window as any).boundaryAudit, null, 2) }));
