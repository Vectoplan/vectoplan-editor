import { createAbortedError, createInvalidPayloadError } from './chunk_api_errors';

export const CHUNK_COMMAND_COMPRESSION_THRESHOLD_BYTES = 1024 * 1024;
export const CHUNK_COMMAND_MAX_EXPANDED_BYTES = 128 * 1024 * 1024;
export const CHUNK_COMMAND_MAX_TRANSPORT_BYTES = 16 * 1024 * 1024;
export const CHUNK_COMMAND_TRANSPORT_SCHEMA = 'vectoplan-command-transport.v1';

export interface CompressedChunkCommand {
  readonly type: 'ObjectBatch';
  readonly transport: {
    readonly encoding: 'gzip-base64';
    readonly schemaVersion: typeof CHUNK_COMMAND_TRANSPORT_SCHEMA;
    readonly uncompressedBytes: number;
    readonly payload: string;
  };
}

interface TransportOptions {
  /** Request, API-client and client-lifetime cancellation all own this work. */
  readonly signals?: readonly (AbortSignal | undefined)[];
  /** A caller may choose stricter limits, never exceed the server contract. */
  readonly maxExpandedBytes?: number;
  readonly maxTransportBytes?: number;
}

function boundedLimit(value: number | undefined, maximum: number): number {
  return Number.isFinite(value) && value! > 0 ? Math.min(maximum, Math.floor(value!)) : maximum;
}

function encodeBase64(bytes: Uint8Array): string {
  const pieces: string[] = [];
  // Each full piece is divisible by three, so only the final piece is padded.
  // Bounded argument lists also work for multi-megabyte geometry in browsers.
  const pieceLength = 24 * 1024;
  for (let offset = 0; offset < bytes.length; offset += pieceLength) {
    pieces.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + pieceLength))));
  }
  return pieces.join('');
}

/** Keep existing JSON proxies unchanged: gzip lives inside a small JSON body. */
export async function encodeChunkCommandTransport<T extends { readonly type: string }>(
  command: T, options: TransportOptions = {},
): Promise<T | CompressedChunkCommand> {
  const signals = options.signals?.filter((signal): signal is AbortSignal => Boolean(signal)) ?? [];
  const assertActive = (): void => {
    const aborted = signals.find(signal => signal.aborted);
    if (aborted) throw createAbortedError({ cause: aborted.reason });
  };
  assertActive();
  if (command.type !== 'ObjectBatch') return command;

  const maxExpandedBytes = boundedLimit(options.maxExpandedBytes, CHUNK_COMMAND_MAX_EXPANDED_BYTES);
  const maxTransportBytes = boundedLimit(options.maxTransportBytes, CHUNK_COMMAND_MAX_TRANSPORT_BYTES);
  const tooLarge = (stage: 'expanded' | 'transport', bytes: number, maximum: number) => createInvalidPayloadError({
    message: stage === 'expanded'
      ? 'Die Bearbeitung ist zu groß. Bitte das Gebäude in kleineren Schritten bearbeiten.'
      : 'Die komprimierte Bearbeitung ist für den Versand zu groß. Bitte den Umfang verkleinern.',
    details: { transportStage: stage, bytes, maximumBytes: maximum },
  });
  const json = JSON.stringify(command);
  // UTF-8 cannot be smaller than this JSON's UTF-16 code-unit count. Reject
  // obviously oversized input before allocating another complete byte buffer.
  if (json.length > maxExpandedBytes) throw tooLarge('expanded', json.length, maxExpandedBytes);
  const bytes = new TextEncoder().encode(json);
  if (bytes.length > maxExpandedBytes) throw tooLarge('expanded', bytes.length, maxExpandedBytes);
  assertActive();
  if (bytes.length < CHUNK_COMMAND_COMPRESSION_THRESHOLD_BYTES && bytes.length <= maxTransportBytes) return command;
  if (typeof CompressionStream === 'undefined') {
    if (bytes.length <= maxTransportBytes) return command;
    throw createInvalidPayloadError({
      message: 'Dieser Browser kann die große Bearbeitung nicht komprimieren. Bitte einen aktuellen Browser verwenden oder den Umfang verkleinern.',
      details: { compressionUnavailable: true, bytes: bytes.length, maximumBytes: maxTransportBytes },
    });
  }

  const wrapper: CompressedChunkCommand = { type: 'ObjectBatch', transport: {
    encoding: 'gzip-base64', schemaVersion: CHUNK_COMMAND_TRANSPORT_SCHEMA,
    uncompressedBytes: bytes.length, payload: '',
  } };
  // The empty envelope is ASCII. Account for Base64 growth and the exact byte
  // count's decimal digits before accumulating any compressed output.
  const envelopeBytes = JSON.stringify(wrapper).length;
  const maxGzipBytes = Math.floor(Math.max(0, maxTransportBytes - envelopeBytes) / 4) * 3;
  const cancellation = new AbortController();
  const listeners = signals.map(signal => {
    const listener = () => cancellation.abort(signal.reason);
    signal.addEventListener('abort', listener, { once: true });
    return { signal, listener };
  });
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  try {
    assertActive();
    let offset = 0;
    const source = new ReadableStream<BufferSource>({
      pull(controller) {
        if (offset >= bytes.length) { controller.close(); return; }
        const next = Math.min(bytes.length, offset + 64 * 1024);
        controller.enqueue(bytes.subarray(offset, next));
        offset = next;
      },
    });
    reader = source.pipeThrough(new CompressionStream('gzip'), { signal: cancellation.signal }).getReader();
    const parts: Uint8Array[] = [];
    let compressedBytes = 0;
    while (true) {
      const { value, done } = await reader.read();
      assertActive();
      if (done) break;
      compressedBytes += value.length;
      if (compressedBytes > maxGzipBytes) {
        throw tooLarge('transport', envelopeBytes + Math.ceil(compressedBytes / 3) * 4, maxTransportBytes);
      }
      parts.push(value);
    }
    const compressed = new Uint8Array(compressedBytes);
    let position = 0;
    for (const part of parts) { compressed.set(part, position); position += part.length; }
    assertActive();
    return { ...wrapper, transport: { ...wrapper.transport, payload: encodeBase64(compressed) } };
  } catch (error) {
    assertActive();
    throw error;
  } finally {
    listeners.forEach(({ signal, listener }) => signal.removeEventListener('abort', listener));
    cancellation.abort();
    if (reader) {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
}
