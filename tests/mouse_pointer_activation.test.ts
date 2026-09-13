import assert from "node:assert/strict";
import test from "node:test";
import { createInputState } from "../src/frontend/input/input_state";
import { createMouseInput } from "../src/frontend/input/mouse_input";
import type { PointerLockHandle } from "../src/frontend/input/pointer_lock";

function fixture(settings: { enabled?: boolean; available?: boolean; locked?: boolean; requireLock?: boolean;
  suppress?: boolean; requestOnDown?: boolean; pendingRequest?: boolean } = {}) {
  const input = createInputState();
  const calls: string[] = [];
  let enabled = settings.enabled ?? true, available = settings.available ?? true, locked = settings.locked ?? false;
  let requests = 0, resolveLock: (() => void) | null = null;
  const pointerLock = {
    isLocked: () => locked, isEnabled: () => enabled, isAvailable: () => available,
    requestLockFromEvent: async () => {
      requests++;
      if (settings.pendingRequest) await new Promise<void>(resolve => { resolveLock = resolve; });
      locked = true; input.setPointerLock(true, true); return true;
    },
  } as unknown as PointerLockHandle;
  const mouse = createMouseInput({ inputState: input, target: {} as HTMLElement, pointerLock,
    capturePointer: false, focusOnPointerDown: false, dispatchToStore: false, ignoreEditableTargets: false,
    requirePointerLockForActions: settings.requireLock ?? false,
    suppressPrimaryActionOnPointerLockActivation: settings.suppress ?? true,
    requestPointerLockOnPointerDown: settings.requestOnDown ?? true,
    onPrimaryDown: () => calls.push("primary-down"), onPrimaryUp: () => calls.push("primary-up"),
    onPrimaryClick: () => calls.push("primary-click"), onSecondaryDown: () => calls.push("secondary-down"),
    onPointerMove: () => calls.push("move"),
  });
  const event = (type: string, button = 0, buttons = type === "pointerdown" ? 1 : 0, pointerId?: number) =>
    Object.assign(new Event(type, { cancelable: true }), { button, buttons, clientX: 10, clientY: 20,
      ...(pointerId === undefined ? {} : { pointerId }) }) as unknown as PointerEvent;
  return { input, mouse, calls, requests: () => requests, setEnabled: (value: boolean) => { enabled = value; },
    event, finishRequest: async () => { resolveLock?.(); await Promise.resolve(); },
    dispose: () => { mouse.destroy(); input.destroy(); } };
}

test("Ego re-entry activation down/up/click is suppressed even when ordinary actions do not require lock", () => {
  const value = fixture({ requireLock: false });
  value.mouse.handlePointerDown(value.event("pointerdown", 0, 1, 7));
  value.mouse.handlePointerUp(value.event("pointerup", 0, 0, 7));
  // Native click may be a MouseEvent with no pointerId.
  value.mouse.handleClick(value.event("click"));
  assert.equal(value.requests(), 1);
  assert.deepEqual(value.calls, [], "canvas activation must not reopen the settings gear");
  assert.equal(value.mouse.getSnapshot().suppressedActionCount, 3);
  assert.deepEqual(value.input.getSnapshot().pointer.pressedButtons, []);
  value.mouse.handlePointerMove(value.event("pointermove"));
  assert.deepEqual(value.calls, ["move"], "unpressed camera look remains available after activation");
  value.dispose();
});

test("an asynchronous pointer-lock request still suppresses its activation gesture before lock arrives", async () => {
  const value = fixture({ requireLock: false, pendingRequest: true });
  value.mouse.handlePointerDown(value.event("pointerdown", 0, 1, 9));
  assert.equal(value.input.getSnapshot().pointer.pointerLocked, false);
  value.mouse.handlePointerUp(value.event("pointerup", 0, 0, 9));
  value.mouse.handleClick(value.event("click"));
  assert.deepEqual(value.calls, []);
  await value.finishRequest();
  assert.equal(value.input.getSnapshot().pointer.pointerLocked, true);
  assert.equal(value.requests(), 1);
  value.dispose();
});

test("planning with a disabled pointer-lock handle and unavailable browser lock never consumes primary clicks", () => {
  for (const state of [{ enabled: false }, { available: false }]) {
    const value = fixture({ ...state, requireLock: false });
    value.mouse.handlePointerDown(value.event("pointerdown"));
    value.mouse.handlePointerUp(value.event("pointerup"));
    value.mouse.handleClick(value.event("click"));
    assert.equal(value.requests(), 0);
    assert.equal(value.mouse.getSnapshot().pointerLockActivationCount, 0);
    assert.deepEqual(value.calls, ["primary-down", "primary-up", "primary-click"]);
    value.dispose();
  }
});

test("disabling the lock for planning cannot carry a previous Ego activation suppression into the new mode", () => {
  const value = fixture();
  value.mouse.handlePointerDown(value.event("pointerdown", 0, 1, 3));
  value.setEnabled(false);
  value.mouse.handlePointerUp(value.event("pointerup", 0, 0, 3));
  value.mouse.handlePointerDown(value.event("pointerdown", 0, 1, 3));
  assert.deepEqual(value.calls, ["primary-up", "primary-down"]);
  value.dispose();
});

test("already-locked editing and explicitly unsuppressed activation still deliver normal actions", () => {
  for (const state of [{ locked: true, requireLock: true }, { suppress: false }]) {
    const value = fixture(state);
    value.mouse.handlePointerDown(value.event("pointerdown"));
    value.mouse.handlePointerUp(value.event("pointerup"));
    value.mouse.handleClick(value.event("click"));
    assert.deepEqual(value.calls, ["primary-down", "primary-up", "primary-click"]);
    assert.equal(value.requests(), "locked" in state ? 0 : 1);
    value.dispose();
  }
});

test("requiring lock still blocks unlocked actions, while optional lock does not suppress secondary buttons", () => {
  const strict = fixture({ requireLock: true, requestOnDown: false });
  strict.mouse.handlePointerDown(strict.event("pointerdown"));
  assert.deepEqual(strict.calls, []);
  assert.equal(strict.requests(), 0);
  strict.dispose();
  const optional = fixture({ requireLock: false });
  optional.mouse.handlePointerDown(optional.event("pointerdown", 2, 2));
  assert.deepEqual(optional.calls, ["secondary-down"]);
  assert.equal(optional.requests(), 0);
  optional.dispose();
});
