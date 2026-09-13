import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmedBuildingGeneration } from '../src/frontend/world_edit/systems/line_brush/generation_receipt';

test('a timed out commit is confirmed by its receipt without a second generation', async () => {
  let posts = 0, polls = 0, pending = 0;
  const result = await confirmedBuildingGeneration({signal: new AbortController().signal,
    send: async () => { posts++; return {ok:false,error:{statusCode:504}}; },
    readReceipt: async () => ({ok:true,commandStatus:++polls === 1 ? 'unconfirmed' : 'applied'}),
    pending: () => { pending++; }, wait: async () => {}});
  assert.equal(result.ok,true); assert.equal(posts,1); assert.equal(polls,2); assert.equal(pending,1);
});

test('an unreceived request is retried only through the same closure', async () => {
  const command = {commandId:'same-generation',parentId:'same-parent'};
  const sent: unknown[] = [];
  await confirmedBuildingGeneration({signal:new AbortController().signal,
    send: async () => { sent.push(command); return {ok:sent.length === 2,error:{statusCode:0}}; },
    readReceipt:async () => ({ok:true,commandStatus:'unconfirmed'}),pending:()=>{},wait:async()=>{}});
  assert.equal(sent.length,2); assert.equal(sent[0],sent[1]);
});

test('validation failure is returned without retry while a lost transport is polled', async () => {
  let polls=0;
  const result=await confirmedBuildingGeneration({signal:new AbortController().signal,
    send:async()=>({ok:false,error:{statusCode:400}}),readReceipt:async()=>{polls++;return{ok:true,commandStatus:'applied'};},
    pending:()=>{},wait:async()=>{}});
  assert.equal(result.ok,false);assert.equal(polls,0);
  const recovered=await confirmedBuildingGeneration({signal:new AbortController().signal,
    send:async()=>{throw new Error('connection reset');},readReceipt:async()=>({ok:true,commandStatus:'applied'}),
    pending:()=>{},wait:async()=>{}});
  assert.equal(recovered.ok,true);
});

test('a local size validation failure never polls for a command that was not sent', async () => {
  let polls=0;
  const failure={ok:false,request:null,error:{code:'chunk_api_invalid_payload',details:{transportStage:'expanded'}}};
  const result=await confirmedBuildingGeneration({signal:new AbortController().signal,send:async()=>failure,
    readReceipt:async()=>{polls++;return{ok:true,commandStatus:'applied'};},pending:()=>{},wait:async()=>{}});
  assert.equal(result,failure);assert.equal(polls,0);
});
