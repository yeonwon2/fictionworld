import test from 'node:test';
import assert from 'node:assert/strict';
import {aiCall,saveAIProfile,activateAIProfile} from '../src/lib/aiCall.js';
const memory=new Map();
globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
for(const provider of ['gemini','custom']){
 test(`${provider}: transport respects one-call cap, counts failed requests and optionally retries JSON once`,async t=>{
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
  const profile=saveAIProfile({name:'Test',provider,key:'test-only',model:'test-model',custom:{providerId:'other',key:'test-only',model:'test-model',baseUrl:'https://example.test/v1'}});activateAIProfile(profile.id);
  let fetched=0,observed=0;
  // Use unambiguously malformed text for both transports.
  globalThis.fetch=async()=>{fetched++;return {ok:true,json:async()=>provider==='gemini'?{candidates:[{content:{parts:[{text:'not json'}]},finishReason:'MAX_TOKENS'}]}:{choices:[{message:{content:'not json'},finish_reason:'length'}]}};};
  const options={jsonSchema:{type:'object'},useCache:false,maxAttempts:1,onRequest:()=>{observed++;}};
  await assert.rejects(aiCall('test',options),/Đã dừng sau 1 lượt/);assert.equal(fetched,1);assert.equal(observed,1);
  fetched=0;observed=0;
  await assert.rejects(aiCall('test',{...options,maxAttempts:2}),/lần hai/);assert.equal(fetched,2);assert.equal(observed,2);
  fetched=0;observed=0;globalThis.fetch=async()=>{fetched++;return {ok:false,status:429,text:async()=>'quota'};};
  await assert.rejects(aiCall('test',{...options,maxAttempts:2}),/429/);assert.equal(fetched,1);assert.equal(observed,1);
  await assert.rejects(aiCall('test',{...options,onRequest:()=>{throw new Error('Stopped');}}),/Stopped/);assert.equal(fetched,1);
 });
}

test('identical concurrent calls dedupe and cache avoids another provider call',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});memory.clear();
 const profile=saveAIProfile({name:'Dedupe',provider:'gemini',key:'test-only',model:'test-model'});activateAIProfile(profile.id);
 let fetched=0;globalThis.fetch=async()=>{fetched++;await new Promise(resolve=>setTimeout(resolve,10));return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"ok":true}'}]}}]})};};
 const options={jsonSchema:{type:'object'},maxAttempts:1};
 const [a,b]=await Promise.all([aiCall('dedupe-unique',options),aiCall('dedupe-unique',options)]);
 assert.deepEqual(a,b);assert.equal(fetched,1);
 await aiCall('dedupe-unique',options);assert.equal(fetched,1);
});
