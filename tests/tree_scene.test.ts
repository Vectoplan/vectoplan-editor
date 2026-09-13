import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createTreeScene, treeInstancesFromChunk, treeYawFromId, raycastTreeScene, type TreeInstance } from "../src/frontend/render/tree_scene";

function tree(id = "a", x = 0): TreeInstance {
  return { id, objectInstanceId: `tree_${id.repeat(40)}`, position: [x, 2.25, 0],
    heightM: 8, crownDiameterM: 4, trunkDiameterM: .3, yawRadians: treeYawFromId(id), species: "Linde",
    source: { treeId: id, longitude: 13.4, latitude: 52.52 } };
}
test("tree points require the published contract and geographic identity, with no invented points", () => {
  const chunk = (features: unknown[]) => ({ raw: { metadata: { geodataOverlays: { schemaVersion: "geodata-overlays.v1",
    items: [{ renderMode: "tree-instances", geometry: { type: "TreeInstances", dimensions: "world-xyz", features } }] } } } }) as Parameters<typeof treeInstancesFromChunk>[0];
  assert.deepEqual(treeInstancesFromChunk(chunk([])), []);
  assert.equal(treeInstancesFromChunk(chunk([tree(), { ...tree(), position: [NaN, 2, 3] }, { ...tree(), objectInstanceId: "not-a-tree" }])).length, 1);
  assert.deepEqual(treeInstancesFromChunk({ raw: {} } as Parameters<typeof treeInstancesFromChunk>[0]), []);
  const large = treeInstancesFromChunk(chunk([{ ...tree(), heightM: 100, crownDiameterM: 60, trunkDiameterM: 10 }]))[0]!;
  assert.deepEqual([large.heightM, large.crownDiameterM, large.trunkDiameterM], [100, 60, 10], "published dimensions retain their scale");
  assert.equal(treeYawFromId("stable"), treeYawFromId("stable"));
  assert.notEqual(treeYawFromId("stable"), treeYawFromId("another"));
});
test("one low-poly tree is draped exactly and is hit as one object at trunk or crown", () => {
  const scene = new THREE.Scene(), trees = createTreeScene(scene);
  assert.equal(trees.sync([tree(), tree()]), 1, "vertical chunk duplicates never draw twice");
  const trunkHit = raycastTreeScene(scene, new THREE.Raycaster(new THREE.Vector3(0, 3, 10), new THREE.Vector3(0, 0, -1)));
  const crownHit = raycastTreeScene(scene, new THREE.Raycaster(new THREE.Vector3(0, 8, 10), new THREE.Vector3(0, 0, -1)));
  assert.equal(trunkHit?.tree.objectInstanceId, tree().objectInstanceId);
  assert.equal(crownHit?.tree.objectInstanceId, tree().objectInstanceId);
  const meshes: THREE.InstancedMesh[] = [];
  scene.traverse(object => { if (object instanceof THREE.InstancedMesh) meshes.push(object); });
  assert.equal(meshes.length, 2);
  assert.ok(meshes.every(mesh => mesh.geometry.getAttribute("position").count < 250));
  const bounds = new THREE.Box3().setFromObject(trees.group);
  assert.ok(Math.abs(bounds.min.y - 2.25) < .001);
  const identity = meshes[0]; trees.sync([tree()]);
  assert.equal(trees.group.children[0]!.children[0], identity, "unchanged streaming data keeps GPU buffers");
  trees.dispose(); assert.equal(scene.children.length, 0);
});
test("successful whole-tree removal survives scene resync and leaves its neighbour intact", () => {
  const scene = new THREE.Scene(), trees = createTreeScene(scene);
  trees.sync([tree(), tree("b", 4)]);
  trees.suppress(tree().objectInstanceId);
  assert.equal(trees.sync([tree(), tree("b", 4)]), 1);
  assert.equal(raycastTreeScene(scene, new THREE.Raycaster(new THREE.Vector3(0, 3, 10), new THREE.Vector3(0, 0, -1))), null);
  assert.equal(raycastTreeScene(scene, new THREE.Raycaster(new THREE.Vector3(4, 3, 10), new THREE.Vector3(0, 0, -1)))?.tree.id, "b");
  trees.dispose();
});
