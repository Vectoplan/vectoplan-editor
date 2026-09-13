import assert from 'node:assert/strict';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { encodeChunkCommandTransport, CHUNK_COMMAND_COMPRESSION_THRESHOLD_BYTES,
  CHUNK_COMMAND_MAX_EXPANDED_BYTES, CHUNK_COMMAND_MAX_TRANSPORT_BYTES,
  CHUNK_COMMAND_TRANSPORT_SCHEMA, type CompressedChunkCommand } from '../src/frontend/api/chunk_command_transport';
import { createChunkApiClient } from '../src/frontend/api/chunk_api_client';

const threshold = CHUNK_COMMAND_COMPRESSION_THRESHOLD_BYTES;
const batch = (note: string) => ({ type: 'ObjectBatch' as const, userId: 'architect',
  sessionId: 'test', position: { x: -5, y: 2, z: 9 },
  commands: [{ type: 'PlaceObject', objectInstanceId: 'walls', objectTypeId: 'planning_building_storey_walls',
    position: { x: -5, y: 2, z: 9 }, metadata: { note } }],
});
const expanded = (wire: CompressedChunkCommand) => gunzipSync(Buffer.from(wire.transport.payload, 'base64'));
const config: any = { projectId: 'chk_prj_transport_audit', worldId: 'world_spawn',
  apiBaseUrl: 'http://localhost:5200/api/chunk', browserBaseUrl: 'http://localhost:5200/api/chunk',
  timeouts: { commandMs: 15000, requestMs: 10000, statusMs: 5000, chunkMs: 10000, batchMs: 10000 } };
const response = () => new Response(JSON.stringify({ ok: true, commandType: 'ObjectBatch',
  commandStatus: 'applied', changed: true, changedChunks: [], dirtyChunks: [] }), { status: 200,
  headers: { 'Content-Type': 'application/json' } });

test('large UTF-8 geometry round-trips byte for byte in the exact gzip JSON contract', async () => {
  const command = { ...batch('Straße 🏠 北京'), lod2BuildingEdit: { buildingId: 'Berlin-Ä', parentObjectInstanceId: 'parent' } };
  const cells = Array.from({ length: 6000 }, (_, index) => ({ x: -index || 0, y: 2, z: 9,
    logicalCellId: `Fassade-${index}-östlich`, minimumY: 2.15, maximumY: 2.645,
    footprintPolygons: [[[-index - .2, 9.1], [-index + .41, 9.1], [-index + .41, 9.64], [-index - .2, 9.64]]],
    materialBlockTypeId: 'lod2_exterior_wall', metadata: { label: 'Innenhof mit Tür 🏠' } }));
  Object.assign(command.commands[0]!.metadata, { constructionCells: cells });
  const originalJson = JSON.stringify(command);
  const wire = await encodeChunkCommandTransport(command) as CompressedChunkCommand;
  assert.deepEqual(Object.keys(wire).sort(), ['transport', 'type']);
  assert.equal(wire.transport.encoding, 'gzip-base64');
  assert.equal(wire.transport.schemaVersion, CHUNK_COMMAND_TRANSPORT_SCHEMA);
  assert.equal(wire.transport.uncompressedBytes, Buffer.byteLength(originalJson, 'utf8'));
  assert.ok(wire.transport.uncompressedBytes > originalJson.length, 'UTF-8 byte count differs from JS string length');
  assert.equal(expanded(wire).toString('utf8'), originalJson);
  assert.deepEqual(JSON.parse(expanded(wire).toString()), command);
  assert.equal(JSON.stringify(command), originalJson, 'source command is not mutated');
  assert.ok(Buffer.byteLength(JSON.stringify(wire)) < CHUNK_COMMAND_MAX_TRANSPORT_BYTES);
});

test('small batches and every other command remain unchanged; exactly 1 MiB starts compression', async () => {
  const command = batch('small');
  assert.equal(await encodeChunkCommandTransport(command), command);
  const other = { type: 'PlaceObject', metadata: { note: 'x'.repeat(threshold * 2) } };
  assert.equal(await encodeChunkCommandTransport(other), other);
  const empty = batch('');
  const overhead = Buffer.byteLength(JSON.stringify(empty));
  const below = batch('x'.repeat(threshold - overhead - 1));
  assert.equal(await encodeChunkCommandTransport(below), below);
  const exact = batch('x'.repeat(threshold - overhead));
  const wire = await encodeChunkCommandTransport(exact) as CompressedChunkCommand;
  assert.equal(wire.transport.uncompressedBytes, threshold);
  assert.equal(expanded(wire).toString(), JSON.stringify(exact));
});

test('multi-piece Base64 remains valid for incompressible data and all padding lengths', async () => {
  const command = batch(randomBytes(threshold).toString('base64'));
  const wire = await encodeChunkCommandTransport(command) as CompressedChunkCommand;
  assert.ok(wire.transport.payload.length > 24 * 1024 * 3);
  assert.equal(expanded(wire).toString(), JSON.stringify(command));
});

test('expanded UTF-8 and complete Base64 envelope budgets are checked before sending', async () => {
  assert.equal(CHUNK_COMMAND_MAX_EXPANDED_BYTES, 134217728);
  assert.equal(CHUNK_COMMAND_MAX_TRANSPORT_BYTES, 16777216);
  const multibyte = batch('ä'.repeat(threshold / 2));
  assert.ok(JSON.stringify(multibyte).length < threshold);
  await assert.rejects(encodeChunkCommandTransport(multibyte, { maxExpandedBytes: threshold }),
    (error: any) => error.code === 'chunk_api_invalid_payload' && error.details.transportStage === 'expanded');
  await assert.rejects(encodeChunkCommandTransport(batch('x'.repeat(threshold)), { maxTransportBytes: 512 }),
    (error: any) => error.code === 'chunk_api_invalid_payload' && error.details.transportStage === 'transport');
  const fitting = await encodeChunkCommandTransport(batch('x'.repeat(threshold))) as CompressedChunkCommand;
  const wireBytes = Buffer.byteLength(JSON.stringify(fitting));
  assert.ok(await encodeChunkCommandTransport(batch('x'.repeat(threshold)), { maxTransportBytes: wireBytes }));
  await assert.rejects(encodeChunkCommandTransport(batch('x'.repeat(threshold)), { maxTransportBytes: wireBytes - 1 }),
    (error: any) => error.details.transportStage === 'transport');
});

test('browsers without compression keep fitting commands and explain an oversized request', async context => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'CompressionStream')!;
  context.after(() => Object.defineProperty(globalThis, 'CompressionStream', descriptor));
  Object.defineProperty(globalThis, 'CompressionStream', { ...descriptor, value: undefined });
  const command = batch('x'.repeat(threshold));
  assert.equal(await encodeChunkCommandTransport(command), command);
  await assert.rejects(encodeChunkCommandTransport(command, { maxTransportBytes: threshold }),
    (error: any) => error.code === 'chunk_api_invalid_payload' && error.details.compressionUnavailable === true);
});

test('cancellation before and during compression propagates without leaving the compression running', async () => {
  const before = new AbortController(); before.abort('already cancelled');
  await assert.rejects(encodeChunkCommandTransport(batch('small'), { signals: [before.signal] }),
    (error: any) => error.code === 'chunk_api_request_aborted');
  const request = new AbortController();
  const result = encodeChunkCommandTransport(batch('x'.repeat(threshold * 3)), { signals: [request.signal] });
  request.abort('cancel while gzip is pending');
  await assert.rejects(result, (error: any) => error.code === 'chunk_api_request_aborted');
});

test('sendCommand uses JSON transport, 120s only for compressed batches, and respects explicit timeouts', async context => {
  const requests: RequestInit[] = [], timeouts: number[] = [];
  const realSetTimeout = globalThis.setTimeout;
  context.mock.method(globalThis, 'setTimeout', ((callback: any, milliseconds: number, ...args: any[]) => {
    timeouts.push(milliseconds); return realSetTimeout(callback, milliseconds, ...args);
  }) as typeof globalThis.setTimeout);
  context.mock.method(globalThis, 'fetch', async (_url: any, init: RequestInit) => { requests.push(init); return response(); });
  const client = createChunkApiClient({ config }); context.after(() => client.destroy());
  const small = batch('small'), large = batch('x'.repeat(threshold));
  assert.equal((await client.sendCommand(small as any)).ok, true);
  assert.equal((await client.sendCommand(large as any)).ok, true);
  assert.equal((await client.sendCommand(large as any, { timeoutMs: 42000 })).ok, true);
  assert.equal(requests.length, 3);
  assert.equal(requests[0]!.body, JSON.stringify(small));
  assert.equal(expanded(JSON.parse(String(requests[1]!.body))).toString(), JSON.stringify(large));
  assert.equal(new Headers(requests[1]!.headers).get('Content-Encoding'), null);
  assert.match(new Headers(requests[1]!.headers).get('Content-Type')!, /application\/json/);
  assert.deepEqual(timeouts, [15000, 120000, 42000]);
});

test('request cancellation and client destruction during compression prevent all HTTP writes', async context => {
  let writes = 0;
  context.mock.method(globalThis, 'fetch', async () => { writes++; return response(); });
  const command = batch('x'.repeat(threshold * 3));
  const client = createChunkApiClient({ config }); context.after(() => client.destroy());
  const request = new AbortController();
  const cancelled = client.sendCommand(command as any, { signal: request.signal });
  request.abort();
  const cancelledResult = await cancelled;
  assert.equal(cancelledResult.ok, false);
  assert.equal(cancelledResult.error?.code, 'chunk_api_request_aborted');
  const destroyed = client.sendCommand(command as any);
  client.destroy('test closure');
  const destroyedResult = await destroyed;
  assert.equal(destroyedResult.ok, false);
  assert.equal(destroyedResult.error?.code, 'chunk_api_request_aborted');
  assert.equal(writes, 0);
});

test('an uncertain HTTP mutation failure never retries a compressed batch', async context => {
  let writes = 0;
  context.mock.method(globalThis, 'fetch', async () => { writes++; throw new TypeError('Response connection lost'); });
  const client = createChunkApiClient({ config }); context.after(() => client.destroy());
  assert.equal((await client.sendCommand(batch('x'.repeat(threshold)) as any)).ok, false);
  assert.equal(writes, 1);
});
