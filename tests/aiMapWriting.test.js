import test from 'node:test';import assert from 'node:assert/strict';
import {collectWritingEntries,writeMapScopes} from '../src/lib/gameStudio/aiMapWriting.js';
const entry=(key)=>({key,text:`Nội dung ${key}`,speaker:'',systemTitle:'',systemText:'',choices:[]});
const game=()=>({meta:{statsConfig:[],aiWorkshop:{idea:'Truyện',type:'studio'}},nodes:Object.fromEntries(['a','b','c','d','e'].map(id=>[id,{id,isEnding:true,text:'Cũ',choices:[]}]))});
test('collector keeps exact valid keys and rejects duplicate, foreign and malformed entries',()=>{
 const r=collectWritingEntries(game(),['scene:a','scene:b'],{entries:[entry('scene:a'),entry('scene:b'),entry('scene:b'),entry('scene:e')]});
 assert.deepEqual(r.entries.map(e=>e.key),['scene:a']);assert.deepEqual(r.missing,['scene:b']);
 const bad=entry('scene:b');bad.choices=[{index:0,text:'extra',modifiers:[]}];
 assert.deepEqual(collectWritingEntries(game(),['scene:b'],{entries:[bad]}).missing,['scene:b']);
});
test('only missing scopes are retried with context from accepted entries',async()=>{
 const g=game(),before=structuredClone(g),prompts=[];
 const r=await writeMapScopes(g,['scene:a','scene:b'],'',async prompt=>{prompts.push(prompt);return {entries:prompts.length===1?[entry('scene:a')]:[entry('scene:b')],suggestions:''};});
 assert.equal(prompts.length,2);assert.match(prompts[1],/Nội dung scene:a/);
 assert.match(prompts[1],/mỗi key xuất hiện một lần: \["scene:b"\]/);
 assert.deepEqual(r.remainingKeys,[]);assert.equal(r.result.entries.length,2);assert.deepEqual(g,before);
});
test('failed repair keeps earlier output for review and stops later groups',async()=>{
 let calls=0;
 const r=await writeMapScopes(game(),['scene:a','scene:b','scene:c','scene:d','scene:e'],'',async()=>{calls++;return {entries:calls===1?[entry('scene:a')]:[],suggestions:''};});
 assert.equal(calls,2);assert.deepEqual(r.keys,['scene:a']);assert.deepEqual(r.remainingKeys,['scene:b','scene:c','scene:d','scene:e']);assert.match(r.notice,/1\/5/);
});
test('network failure preserves prior batches without retrying quota; empty failures identify pending keys',async()=>{
 let calls=0;
 const r=await writeMapScopes(game(),['scene:a','scene:b','scene:c','scene:d','scene:e'],'',async()=>{if(++calls===2)throw new Error('HTTP 429');return {entries:['a','b','c','d'].map(k=>entry(`scene:${k}`))};});
 assert.equal(calls,2);assert.equal(r.keys.length,4);assert.deepEqual(r.remainingKeys,['scene:e']);assert.match(r.notice,/429/);
 await assert.rejects(writeMapScopes(game(),['scene:a'],'',async()=>({entries:[]})),/scene:a/);
});
