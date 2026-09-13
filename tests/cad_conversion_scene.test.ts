import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { CadConversionScene, cadStationLayout } from "../src/frontend/reconstruction_preview/cad_conversion_scene";

function build(item: Record<string, unknown>) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 4), new THREE.MeshStandardMaterial());
  mesh.position.set(Number(item.x || 0), 1.5, 0);
  return mesh;
}
function progress(phase: string, objects: unknown[], state = "completed") {
  return {eventType:"cad.progress", data:{phase, objects, state, geometryCount:objects.length}};
}

test("one scene contains three separate stations with a shared metric scale", () => {
  const scene = new CadConversionScene(build);
  scene.apply(progress("import", [{id:"same",x:500000}]));
  scene.apply(progress("bridge", [{id:"same",x:500000}]));
  scene.apply(progress("output", [{id:"same",x:500000}]));
  assert.equal(scene.root.children.length, 3);
  const snapshots = scene.snapshot();
  assert.deepEqual(snapshots.map(s=>s.objects), [1,1,1]);
  assert(snapshots[0].offset[0] < snapshots[1].offset[0]);
  assert(snapshots[1].offset[0] < snapshots[2].offset[0]);
  assert.deepEqual(snapshots[0].origin, snapshots[2].origin);
  for (const stage of Object.values(scene.stations)) assert.deepEqual(stage.content.scale.toArray(), [1,1,1]);
  assert(scene.bounds.max.x - scene.bounds.min.x < 100);
  scene.destroy();
});

test("a changed export position remains visibly different after layout", () => {
  const scene = new CadConversionScene(build);
  scene.apply(progress("import", [{id:"shape",x:100}]));
  scene.apply(progress("output", [{id:"shape",x:102}]));
  const source = scene.stations.import.objects.get("shape")!.getWorldPosition(new THREE.Vector3());
  const output = scene.stations.output.objects.get("shape")!.getWorldPosition(new THREE.Vector3());
  const stationDistance = scene.stations.output.group.position.x - scene.stations.import.group.position.x;
  assert(Math.abs((output.x - source.x) - stationDistance - 2) < 1e-9);
  scene.destroy();
});

test("replaying progress does not duplicate geometry and a reset clears all stations", () => {
  const scene = new CadConversionScene(build);
  const event = progress("import", [{id:"a"},{id:"b"}], "running");
  scene.apply(event); scene.apply(event);
  assert.equal(scene.stations.import.objects.size, 2);
  scene.reset({targetLabel:"AutoCAD · .dwg",sourceFilename:"project.ndw"});
  assert.deepEqual(scene.snapshot().map(s=>s.objects), [0,0,0]);
  assert.equal(scene.stations.output.title, "AutoCAD · .dwg");
  assert.equal(scene.stations.import.detail, "project.ndw");
  scene.destroy();
});

test("missing output preview and blocked workers never copy source geometry into output", () => {
  const scene = new CadConversionScene(build);
  scene.apply(progress("import", [{id:"a"}]));
  scene.apply({eventType:"workflow.stage",stage:{id:"target_reimport",state:"skipped"},data:{message:"Reader fehlt"}});
  assert.equal(scene.stations.output.state, "skipped");
  assert.equal(scene.stations.output.objects.size, 0);
  scene.apply({jobStatus:"blocked",data:{error:{message:"Worker fehlt"}}});
  assert.equal(scene.stations.bridge.state, "failed");
  assert.equal(scene.stations.import.objects.size, 1);
  scene.destroy();
});

test("empty or flat geometry still produces finite separated work positions", () => {
  for (const bounds of [new THREE.Box3(),new THREE.Box3(new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,0))]) {
    const layout = cadStationLayout(bounds);
    assert(layout.width > 0 && layout.depth > 0 && layout.gap > 0);
    assert(layout.origin.toArray().every(Number.isFinite));
    assert(layout.offsets.every(Number.isFinite));
  }
});
