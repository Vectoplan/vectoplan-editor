import assert from "node:assert/strict";
import test from "node:test";
import { createInputState, pointerButtonsFromNativeEvent } from "../src/frontend/input/input_state";

test("explicit empty or unsupported button bitmasks never fall back to the changed button", () => {
  assert.deepEqual(pointerButtonsFromNativeEvent({ button: 0, buttons: 0 }), []);
  assert.deepEqual(pointerButtonsFromNativeEvent({ button: 2, buttons: 0 }), []);
  assert.deepEqual(pointerButtonsFromNativeEvent({ button: 0, buttons: 8 }), []);
  assert.deepEqual(pointerButtonsFromNativeEvent({ button: 0, buttons: 7 }), ["primary", "secondary", "middle"]);
  assert.deepEqual(pointerButtonsFromNativeEvent({ button: 2 }), ["secondary"], "legacy helper keeps the changed-button fallback");
});

test("native pointerup clears each released button and subsequent button=0 hover never starts dragging", () => {
  for (const [button, buttons, name] of [[0, 1, "primary"], [1, 4, "middle"], [2, 2, "secondary"]] as const) {
    const input = createInputState();
    assert.deepEqual(input.pointerDown({ button, buttons }).pointer.pressedButtons, [name]);
    const up = input.pointerUp({ button, buttons: 0 });
    assert.deepEqual(up.pointer.pressedButtons, [], `${name} remains pressed after release`);
    assert.equal(up.phase, "idle");
    const hover = input.pointerMove({ button: 0, buttons: 0, clientX: 30, clientY: 20 });
    assert.deepEqual(hover.pointer.pressedButtons, []);
    assert.equal(hover.phase, "active", "free cursor motion is not a drag");
    input.destroy();
  }
});

test("releasing one of several buttons keeps exactly the buttons in the current native bitmask", () => {
  const input = createInputState();
  input.pointerDown({ button: 0, buttons: 1 });
  input.pointerDown({ button: 2, buttons: 3 });
  assert.deepEqual(input.pointerUp({ button: 0, buttons: 2 }).pointer.pressedButtons, ["secondary"]);
  assert.equal(input.pointerMove({ button: -1, buttons: 2, clientX: 10 }).phase, "dragging");
  input.pointerDown({ button: 1, buttons: 6 });
  assert.deepEqual(input.pointerUp({ button: 2, buttons: 4 }).pointer.pressedButtons, ["middle"]);
  assert.deepEqual(input.pointerUp({ button: 1, buttons: 0 }).pointer.pressedButtons, []);
  input.destroy();
});

test("a hover with buttons=0 recovers a missed pointerup instead of manufacturing a primary drag", () => {
  const input = createInputState();
  input.pointerDown({ button: 0, buttons: 1 });
  const recovered = input.pointerMove({ button: 0, buttons: 0, clientX: 80, clientY: 100 });
  assert.deepEqual(recovered.pointer.pressedButtons, []);
  assert.notEqual(recovered.phase, "dragging");
  input.destroy();
});

test("legacy events without buttons merge down edges, retain state on move and remove only the released edge", () => {
  const input = createInputState();
  input.pointerDown({ button: 0 });
  assert.deepEqual(input.pointerDown({ button: 2 }).pointer.pressedButtons, ["primary", "secondary"]);
  assert.deepEqual(input.pointerMove({ button: 0, clientX: 10 }).pointer.pressedButtons, ["primary", "secondary"]);
  assert.deepEqual(input.pointerUp({ button: 2 }).pointer.pressedButtons, ["primary"]);
  assert.deepEqual(input.pointerUp({ button: 0 }).pointer.pressedButtons, []);
  assert.deepEqual(input.pointerMove({ button: 0, clientX: 20 }).pointer.pressedButtons, []);
  input.destroy();
});

test("a synthetic down edge may supply the single button but its explicit zero release still clears it", () => {
  const input = createInputState();
  assert.deepEqual(input.pointerDown({ button: 0, buttons: 0 }).pointer.pressedButtons, ["primary"]);
  assert.deepEqual(input.pointerUp({ button: 0, buttons: 0 }).pointer.pressedButtons, []);
  input.destroy();
});
