import test from "node:test";
import assert from "node:assert/strict";
import { storeyBoundaryHeightFromDrag } from "../src/frontend/world_edit/systems/storey/scene_handles";
test("a slab drag follows the camera's signed projection and snaps to centimetres", () => {
  assert.equal(storeyBoundaryHeightFromDrag(3, -36, -24), 4.5);
  assert.equal(storeyBoundaryHeightFromDrag(3, 36, 24), 4.5);
  assert.equal(storeyBoundaryHeightFromDrag(3, 8, -24), 2.67);
  assert.equal(storeyBoundaryHeightFromDrag(3, 36, 0), 3, "top-down degeneracy cannot create infinite heights");
  assert.equal(storeyBoundaryHeightFromDrag(3, NaN, -24), 3);
});
