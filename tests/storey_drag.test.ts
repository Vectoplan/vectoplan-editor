import assert from "node:assert/strict";
import test from "node:test";
import { storeyCountFromDrag } from "../src/frontend/world_edit/systems/storey/drag";
import { createStoreyPreviewQueue } from "../src/frontend/world_edit/systems/storey/preview_queue";

test("vertical dragging adds and removes whole floors at the projected camera scale", () => {
  assert.equal(storeyCountFromDrag(6, -60, 30), 8);
  assert.equal(storeyCountFromDrag(6, 60, 30), 4);
  assert.equal(storeyCountFromDrag(6, -120, 60), 8);
  assert.equal(storeyCountFromDrag(6, 10, 30), 6);
});
test("top view, invalid values and storey limits remain stable", () => {
  assert.equal(storeyCountFromDrag(6, -24, 0), 8);
  assert.equal(storeyCountFromDrag(1, 1000, 30), 1);
  assert.equal(storeyCountFromDrag(79, -1000, 30), 80);
  assert.equal(storeyCountFromDrag(6, NaN, 30), 6);
  assert.equal(storeyCountFromDrag(6, 30, Infinity), 6);
});

function frames() {
  let id = 0;
  const pending = new Map<number, FrameRequestCallback>();
  return { request: (callback: FrameRequestCallback) => { pending.set(++id, callback); return id; },
    cancel: (key: number) => { pending.delete(key); },
    tick: () => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(0)); },
    size: () => pending.size };
}
test("rapid downward drag previews once per frame and pointer-up flushes the final floor", () => {
  const clock = frames(), applied: number[] = [], queue = createStoreyPreviewQueue<number>(value => applied.push(value), clock);
  for (let pixels = 0; pixels <= 89; pixels++) queue.push(storeyCountFromDrag(6, pixels, 30));
  assert.equal(clock.size(), 1);
  assert.deepEqual(applied, []);
  clock.tick();
  assert.deepEqual(applied, [3]);
  queue.push(2); queue.push(1); queue.flush();
  assert.deepEqual(applied, [3, 1], "pointer-up must not lose the latest downward count");
  clock.tick();
  assert.deepEqual(applied, [3, 1], "queued RAF cannot apply twice after pointer-up");
});
test("cancelled count and boundary gestures never replay their queued lower value", () => {
  const clock = frames(), applied: number[] = [], queue = createStoreyPreviewQueue<number>(value => applied.push(value), clock);
  queue.push(2.395); queue.cancel(); clock.tick(); queue.flush();
  assert.deepEqual(applied, []);
  queue.push(2.145); queue.flush();
  assert.deepEqual(applied, [2.145], "a new gesture remains usable after cancellation");
});
