import type { RuntimeChunkContent } from '../runtime/world/chunk_content';

/** A synchronous scan reads overlapping neighbour sets. Registry reads touch
 * LRU metadata, so reuse each result only for this scan, never across edits. */
export function chunkRevisionScanReader(read: (key: string) => RuntimeChunkContent | null) {
  const values = new Map<string, RuntimeChunkContent | null>();
  return (key: string): RuntimeChunkContent | null => {
    if (values.has(key)) return values.get(key)!;
    const value = read(key); values.set(key, value); return value;
  };
}
