import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreCandidates, readScoreProposals, applyScoreProposals, balancePrompt} from '../src/lib/gameStudio/scoreBalance.js';
const base = () => ({meta:{statsConfig:[{key:'favor',label:'Thiện cảm'}],sourceScript:'old'},nodes:{
 scene_1:{text:'Một cuộc tranh luận',choices:[{text:'Xúc phạm nhân vật',targetNodeId:'scene_2',statModifiers:{favor:5,money:8},requiresFlag:'met'},{text:'An ủi',targetNodeId:'scene_2',statModifiers:{favor:3}}]},
 scene_2:{text:'Thử vận may',choices:[{text:'Mạo hiểm',diceRoll:{successTarget:'end',failTarget:'end',successMods:{favor:8},failMods:{favor:2}}}]},
 effect:{workshopRole:'consequence',choices:[{text:'Tiếp tục',statModifiers:{favor:0}}]},
 router:{automaticEnding:true,choices:[{text:'HE',targetNodeId:'end',statRequirements:{favor:80}}]},end:{isEnding:true,text:'Kết thúc',choices:[]},
}});
test('approved score edits preserve unapproved rows, prose, links, other stats and gates',()=>{
 const game=base(),before=structuredClone(game),cs=scoreCandidates(game,'favor');
 const {rows}=readScoreProposals({proposals:cs.map(c=>({id:c.id,value:-5,reason:'Hành động làm mất lòng tin',targetNodeId:'evil',text:'evil'}))},cs);
 const next=applyScoreProposals(game,JSON.stringify(game),rows,[rows[0].id]);
 const expected=structuredClone(game);expected.nodes.scene_1.choices[0].statModifiers.favor=-5;expected.meta.sourceScriptOutdated=true;
 assert.deepEqual(next,expected);assert.deepEqual(game,before);
 assert.throws(()=>applyScoreProposals(game,JSON.stringify(game),rows,[]),/ít nhất/);
});
test('scope excludes automatic routing and consequence continuation; dice edits target actual result only',()=>{
 const game=base(),cs=scoreCandidates(game,'favor');assert.equal(cs.length,4);
 assert.equal(scoreCandidates(game,'favor',['scene:scene_1']).length,2);
 assert.equal(scoreCandidates(game,'favor',['choice:scene_1:1']).length,1);
 const fail=cs.find(c=>c.field==='failMods');
 const {rows}=readScoreProposals({proposals:[{id:fail.id,value:-9,reason:'Thất bại làm mất thiện cảm'}]},cs);
 const next=applyScoreProposals(game,JSON.stringify(game),rows,[fail.id]);
 assert.equal(next.nodes.scene_2.choices[0].diceRoll.failMods.favor,-9);
 assert.equal(next.nodes.scene_2.choices[0].diceRoll.successMods.favor,8);
});
test('reject stale state, unknown and duplicate AI ids, nonfinite values; count missing separately',()=>{
 const game=base(),cs=scoreCandidates(game,'favor'),p={id:cs[0].id,value:-2,reason:'Lý do'};
 const result=readScoreProposals({proposals:[p,{id:cs[1].id,value:cs[1].oldValue,reason:'Đã phù hợp'}]},cs);
 assert.equal(result.rows.length,1);assert.equal(result.missing,2);assert.equal(result.unchanged,1);
 assert.throws(()=>readScoreProposals({proposals:[p,p]},cs),/trùng/);
 assert.throws(()=>readScoreProposals({proposals:[{...p,id:'unknown'}]},cs),/sai/);
 assert.throws(()=>readScoreProposals({proposals:[{...p,value:Infinity}]},cs),/không hợp lệ/);
 const stamp=JSON.stringify(game);game.nodes.scene_1.text='Changed';
 assert.throws(()=>applyScoreProposals(game,stamp,result.rows,[p.id]),/đã thay đổi/);
 assert.throws(()=>applyScoreProposals(game,JSON.stringify(game),result.rows,['unknown']),/không hợp lệ/);
});
test('prompt sends current graph and endings, rejects excess context without silent truncation',()=>{
 const game=base(),cs=scoreCandidates(game,'favor');
 const prompt=balancePrompt(game,cs,'favor','Cân bằng');assert.ok(prompt.includes('Một cuộc tranh luận'));assert.ok(prompt.includes('statRequirements'));assert.ok(!prompt.includes('sourceScript'));
 game.nodes.scene_1.text='x'.repeat(240001);assert.throws(()=>balancePrompt(game,cs,'favor',''),/quá dài/);
});

test('missing AI rows are retried without repeating accepted or unchanged decisions', async()=>{
 const {collectScoreProposals}=await import('../src/lib/gameStudio/scoreBalance.js');
 const candidates=scoreCandidates(base(),'favor'),calls=[];
 const result=await collectScoreProposals(candidates,[],async batch=>{
  calls.push(batch.map(c=>c.id));
  const selected=calls.length===1?batch.slice(0,2):batch;
  return {proposals:selected.map(c=>({id:c.id,value:c.oldValue,reason:'Giữ nguyên'}))};
 });
 assert.equal(result.accepted.length,4);assert.equal(calls.length,2);
 assert.deepEqual(calls[1],candidates.slice(2).map(c=>c.id));
});
test('resume after provider failure retains earlier proposals and never rechecks them',async()=>{
 const {collectScoreProposals}=await import('../src/lib/gameStudio/scoreBalance.js');
 const candidates=Array.from({length:25},(_,i)=>({...scoreCandidates(base(),'favor')[0],id:String(i)}));
 let calls=0;
 const first=await collectScoreProposals(candidates,[],async batch=>{
  if(++calls===2)throw new Error('quota');
  return {proposals:batch.map(c=>({id:c.id,value:-3,reason:'Điều chỉnh'}))};
 });
 assert.equal(first.accepted.length,20);assert.equal(first.error,'quota');
 const second=await collectScoreProposals(candidates,first.accepted,async batch=>{
  assert.ok(batch.every(c=>Number(c.id)>=20));
  return {proposals:batch.map(c=>({id:c.id,value:-4,reason:'Điều chỉnh'}))};
 });
 assert.equal(second.accepted.length,25);assert.equal(second.accepted[0].value,-3);
});
test('empty responses have a bounded retry budget',async()=>{
 const {collectScoreProposals}=await import('../src/lib/gameStudio/scoreBalance.js');let calls=0;
 const result=await collectScoreProposals(scoreCandidates(base(),'favor'),[],async()=>{calls++;return {proposals:[]};});
 assert.equal(calls,6);assert.equal(result.accepted.length,0);
});
test('one invalid or duplicate AI row cannot discard the valid rows from its batch',async()=>{
 const {collectScoreProposals}=await import('../src/lib/gameStudio/scoreBalance.js');
 const candidates=scoreCandidates(base(),'favor');let calls=0;
 const result=await collectScoreProposals(candidates,[],async batch=>{
  calls++;
  const proposals=batch.map(c=>({id:c.id,value:-3,reason:'Đổi điểm'}));
  if(calls===1){proposals[1].value='invalid';proposals.push({...proposals[2]}, {id:'not_allowed',value:5,reason:'Extra'});}
  else assert.deepEqual(batch.map(c=>c.id),[candidates[1].id,candidates[2].id]);
  return {proposals};
 });
 assert.equal(result.accepted.length,4);assert.equal(calls,2);
});
