import test from 'node:test';
import assert from 'node:assert/strict';
import {planWritingBudget,writeBudgetedScopes,applyProseWriting} from '../src/lib/gameStudio/writingBudget.js';

const game=(count=20)=>({meta:{statsConfig:[{key:'p',label:'Điểm',default:50}],aiWorkshop:{type:'npc'}},nodes:Object.fromEntries(Array.from({length:count},(_,i)=>['s'+i,{id:'s'+i,text:'Nội dung cũ',speaker:'Người kể',systemPopup:{title:'Hệ thống',text:'Giữ'},choices:[{text:'Đi tiếp',targetNodeId:'s'+((i+1)%count),statModifiers:{p:5},statRequirements:{p:1},grantFlag:'seen',grantItem:'key',diceRoll:{successTarget:'win',failTarget:'lose'},npcCard:{name:'Tên cũ',tagline:'Thẻ',image:'art'}}]}]))});
const keys=g=>Object.keys(g.nodes).map(id=>'scene:'+id);
const response=k=>({key:k,text:'Lời văn mới',speaker:'Đổi trái phép',choices:[{index:0,text:'Lựa chọn mới',modifiers:[{key:'p',value:999}],targetNodeId:'hack',npcName:'Đổi tên'}]});
const expectedKeys=prompt=>JSON.parse(prompt.match(/mỗi key một lần: (\[[^\n]+?\])/)[1]);

test('adaptive budget groups more than four short scopes and predicts overflow before calls',()=>{
 const g=game(),short=planWritingBudget(g,keys(g),{maxCalls:1,targetChars:400});
 assert.ok(short.batches[0].length>4);assert.ok(short.remainingKeys.length>0);
 const long=planWritingBudget(g,keys(g),{maxCalls:1,targetChars:3000});
 assert.ok(long.batches[0].length<short.batches[0].length);
 assert.throws(()=>planWritingBudget(g,keys(g),{maxCalls:3}),/1–2/);
 const dupe=planWritingBudget(g,['scene:s0','choice:s0:0','scene:s0']);assert.equal(dupe.keys.length,1);
});
test('prose-only application locks every mechanical field, NPC identity and unselected content',()=>{
 const g=game(2),before=structuredClone(g);
 const result=applyProseWriting(g,['scene:s0'],{entries:[response('scene:s0')]});
 const expected=structuredClone(g);expected.nodes.s0.text='Lời văn mới';expected.nodes.s0.choices[0].text='Lựa chọn mới';expected.meta.sourceScriptOutdated=false;
 assert.deepEqual(result,expected);assert.deepEqual(g,before);
 const choice=applyProseWriting(g,['choice:s0:0'],{entries:[response('choice:s0:0')]});assert.equal(choice.nodes.s0.text,g.nodes.s0.text);
 assert.throws(()=>applyProseWriting(g,['scene:s0'],{entries:[{...response('scene:s0'),choices:[]}]}),/Sai số/);
});
test('one-call budget makes exactly one request, returns partial and leaves source unchanged',async()=>{
 const g=game(),before=structuredClone(g);let calls=0;
 const r=await writeBudgetedScopes(g,keys(g),'',async(prompt,options)=>{
  assert.equal(options.maxAttempts,1);options.onRequest();calls++;
  return {entries:expectedKeys(prompt).map(response)};
 },()=>{},()=>true,{maxCalls:1,targetChars:400});
 assert.equal(calls,1);assert.equal(r.calls,1);assert.ok(r.keys.length>4);assert.ok(r.remainingKeys.length);assert.deepEqual(g,before);
});
test('two calls complete a moderate selection and preserve completed results during missing-entry repair',async()=>{
 const g=game(8),requested=keys(g),prompts=[];
 const r=await writeBudgetedScopes(g,requested,'',async(prompt,options)=>{
  options.onRequest();prompts.push(prompt);const batch=expectedKeys(prompt);
  return {entries:(prompts.length===1?batch.slice(0,-1):batch).map(response)};
 },()=>{},()=>true,{maxCalls:2,targetChars:400});
 assert.equal(r.calls,2);assert.deepEqual(r.remainingKeys,[]);
 assert.deepEqual(expectedKeys(prompts[1]),[requested.at(-1)]);
 assert.match(prompts[1],/Lời văn mới/);
});
test('errors and cancellation do not trigger hidden calls or lose completed proposals',async()=>{
 const g=game(20);let tries=0;
 const r=await writeBudgetedScopes(g,keys(g),'',async(prompt,options)=>{
  options.onRequest();tries++;if(tries===2)throw new Error('HTTP 429');return {entries:expectedKeys(prompt).map(response)};
 },()=>{},()=>true,{maxCalls:2,targetChars:400});
 assert.equal(tries,2);assert.equal(r.calls,2);assert.ok(r.keys.length);assert.ok(r.remainingKeys.length);assert.match(r.notice,/429/);
 await assert.rejects(writeBudgetedScopes(g,keys(g),'',async()=>{throw new Error('Missing key');}),/Đã dùng 0\/2/);
 await assert.rejects(writeBudgetedScopes(g,keys(g),'',async()=>{throw new Error('must not run');},()=>{},()=>false),/đã dừng/);
});
