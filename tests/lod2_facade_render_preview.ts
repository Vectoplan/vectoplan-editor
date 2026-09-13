import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { normalizeChunkApiBatchResult } from "../src/frontend/api/chunk_api_normalize";
import { createRuntimeChunkContent } from "../src/frontend/runtime/world/chunk_content";
import { semanticObjectRefs, chunkWithoutSemanticObjectCells, appendLod2WallCaps, appendSemanticObjectMeshes, createChunkMeshRecord, createRenderer } from "../src/frontend/scene/scene_runtime";
import { GeographicPerspectiveCamera, renderGeographicScene } from "../src/frontend/render/geographic_camera";
import { trimLod2WallCaps, type Lod2RoofSurfaceSource } from "../src/frontend/scene/lod2_wall_caps";

async function main() {
  const payloads = await (await fetch("./berlin-render-chunks.json")).json();
  const first = payloads[0];
  const result = normalizeChunkApiBatchResult({ ok: true, chunks: payloads.map((chunk: any) => ({ chunk })) }, null,
    { projectId: first.projectId, worldId: first.worldId });
  if (!result.ok) throw Error("Invalid Berlin snapshot export");
  const chunks = result.chunks.map(chunk => createRuntimeChunkContent(chunk));
  const refs = [...new Map(chunks.flatMap(chunk => semanticObjectRefs(chunk)).map(ref => [ref.objectInstanceId, ref])).values()];
  const sources: Lod2RoofSurfaceSource[] = refs.filter(ref => ref.objectTypeId === "building_roof" && ref.metadata.lod2BuildingId).map(ref => {
    const parameters = ref.metadata.roofParameters as any, source = parameters?.importedSource ?? {};
    return { buildingId: String(ref.metadata.lod2BuildingId), calculation: ref.metadata.roofCalculation,
      facadeSegments: source.facadeSegments ?? [], repairFacadeRoofSeams: source.facadeProfileMode === "roof-clamped-v1",
      storeyBaseY: Number(source.baseY), storeyEavesY: Number(parameters.eavesHeightMm) / 1000 };
  });
  const scene = new THREE.Scene(); scene.background = new THREE.Color("#82b6d1");
  const camera = new GeographicPerspectiveCamera(65, innerWidth / innerHeight, .05, 1000);
  const renderer = createRenderer(document.createElement("canvas"), { render: { alpha: false, clearColor: "#82b6d1" } } as any);
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  document.body.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1f2937, .65), new THREE.AmbientLight(0xffffff, .55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(-80, 130, -60); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.near = 1; sun.shadow.camera.far = 300;
  sun.shadow.camera.left = -130; sun.shadow.camera.right = 130; sun.shadow.camera.top = 130; sun.shadow.camera.bottom = -130;
  sun.shadow.bias = -.0002; sun.shadow.normalBias = .025; scene.add(sun, sun.target);
  const facadeBounds = new THREE.Box3(), buildBounds = new THREE.Box3();
  const byCoordinate = new Map(chunks.map(chunk => [chunk.chunkKey, chunk]));
  const occupied = (x: number, y: number, z: number): boolean => {
    const size = first.chunkSize, cx = Math.floor(x / size), cy = Math.floor(y / size), cz = Math.floor(z / size);
    const chunk = byCoordinate.get(`${cx}:${cy}:${cz}`);
    return Boolean(chunk && Number(chunk.cells[x - cx * size + size * (y - cy * size) + size * size * (z - cz * size)]) > 0);
  };
  let removed = 0, capDraws = 0, capTriangles = 0;
  for (const chunk of chunks) {
    const semantic = semanticObjectRefs(chunk);
    const caps = trimLod2WallCaps(chunkWithoutSemanticObjectCells(chunk, semantic), sources, occupied);
    const record = appendLod2WallCaps(appendSemanticObjectMeshes(createChunkMeshRecord(caps.chunk, occupied), chunk, semantic), caps);
    scene.add(record.group);
    for (const mesh of record.meshes) {
      if (mesh.userData.lod2WallCaps) {
        facadeBounds.expandByObject(mesh); capDraws++; capTriangles += mesh.geometry.getAttribute("position").count / 3;
      }
      if (mesh.userData.constructionGrid) buildBounds.expandByObject(mesh);
      removed += Number(mesh.userData.removedObjectInterfaceTriangleCount ?? 0) + Number(mesh.geometry.userData.removedInteriorTriangleCount ?? 0);
    }
  }
  const panel = document.createElement("div"); panel.style.cssText = "position:fixed;left:12px;top:12px;background:#fff;padding:12px;border-radius:8px;font:13px system-ui;z-index:2";
  panel.innerHTML = `<strong>Reale Berliner Snapshots – Fassadenprüfung</strong><p>${chunks.length} Chunks · ${capDraws} Fassaden-Draws · ${capTriangles} Fassadendreiecke · ${removed} entfernte Innenflächen</p>`;
  document.body.append(panel);
  const focus = (bounds: THREE.Box3) => {
    const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
    if (bounds.isEmpty()) return;
    controls.target.copy(center); camera.position.copy(center).add(new THREE.Vector3(.85, .48, .95).multiplyScalar(Math.max(size.x, size.y, size.z) * .8));
    controls.update(); sun.target.position.copy(center);
  };
  const button = (label: string, handler: () => void) => { const item = document.createElement("button"); item.textContent = label; item.onclick = handler; item.style.marginRight = "8px"; panel.append(item); };
  button("LoD2-Fassade", () => focus(facadeBounds)); button("Entworfene Gebäude", () => focus(buildBounds));
  button("Kamera bewegen", () => { controls.autoRotate = !controls.autoRotate; controls.autoRotateSpeed = .6; });
  button("Schatten ein/aus", () => { renderer.shadowMap.enabled = !renderer.shadowMap.enabled; });
  focus(facadeBounds);
  document.body.dataset.auditReady = "true";
  renderer.setAnimationLoop(() => { controls.update(); renderGeographicScene(renderer, scene, camera); });
  addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
}
main().catch(error => { document.body.dataset.auditError = String(error); document.body.append(String(error)); console.error(error); });
