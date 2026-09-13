/** Pointer events may arrive much faster than frames. Keep only the latest
 * draft value, but flush it before pointer-up so a downward gesture cannot
 * commit the penultimate count. Cancellation must never replay a queued value. */
export function createStoreyPreviewQueue<T>(apply: (value: T) => void, frames: {
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
} = { request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id) }) {
  let frame: number | null = null;
  let pending: { value: T } | null = null;
  function flush(): void {
    if (frame !== null) frames.cancel(frame);
    frame = null;
    const next = pending;
    pending = null;
    if (next) apply(next.value);
  }
  return {
    push(value: T): void {
      pending = { value };
      if (frame === null) frame = frames.request(flush);
    },
    flush,
    cancel(): void {
      if (frame !== null) frames.cancel(frame);
      frame = null;
      pending = null;
    },
  };
}
