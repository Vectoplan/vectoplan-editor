import { sortChunkKeys } from './chunk_coordinates';

/** Chunk membership changes far less often than camera and renderer reads.
 * Keep a sorted, immutable view until membership actually changes. */
export class OrderedChunkKeys extends Set<string> {
  private ordered: readonly string[] | null = null;

  override add(key: string): this {
    if (!this.has(key)) this.ordered = null;
    return super.add(key);
  }

  override delete(key: string): boolean {
    const removed = super.delete(key);
    if (removed) this.ordered = null;
    return removed;
  }

  override clear(): void {
    if (this.size) this.ordered = null;
    super.clear();
  }

  snapshot(): readonly string[] {
    return this.ordered ??= Object.freeze(sortChunkKeys([...this]));
  }
}
