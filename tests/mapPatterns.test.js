import test from 'node:test';
import assert from 'node:assert/strict';
import { copyMapPattern, pasteMapPattern } from '../src/lib/gameStudio/mapPatterns.js';
const game = {meta:{},nodes:{start_node:{id:'start_node',choices:[{text:'Start',targetNodeId:'scene_1'}]},scene_1:{id:'scene_1',text:'Original main',choices:[{text:'A',targetNodeId:'scene_2',statModifiers:{gold:5}},{text:'B',targetNodeId:'scene_2'}]},scene_2:{id:'scene_2',text:'Original effect',workshopRole:'consequence',choices:[{text:'Tiếp tục',targetNodeId:'end',workshopContinuation:true,statModifiers:{}}]},end:{id:'end',isEnding:true,text:'End'}}};
test('copy snapshots scenes and included choices, never original introduction',()=>{
 const pattern=copyMapPattern(game,['start_node','scene_1','scene_2','scene_1']);
 assert.deepEqual(pattern.ids,['scene_1','scene_2']);
 assert.equal(pattern.exits.length,1);
 pattern.nodes.scene_1.text='Edit copy'; assert.equal(game.nodes.scene_1.text,'Original main');
 assert.throws(()=>copyMapPattern(game,['start_node']));
});
test('pasting repeated skeletons keeps internal convergence and connects group exits to next group entry',()=>{
 const pattern=copyMapPattern(game,['scene_1','scene_2']);
 const before=structuredClone(game);
 const result=pasteMapPattern(game,pattern,{count:3,chain:true,entryId:'scene_1',exitTokens:pattern.exits.map(p=>p.token),finalTarget:'end'});
 assert.equal(result.addedIds.length,6);
 for(let i=0;i<6;i+=2){const main=result.game.nodes[result.addedIds[i]],side=result.game.nodes[result.addedIds[i+1]]; assert.equal(main.text,''); assert.ok(main.choices.every(c=>c.targetNodeId===side.id)); assert.equal(side.workshopRole,'consequence');assert.equal(side.choices[0].text,'Tiếp tục');assert.equal(side.choices[0].targetNodeId,result.addedIds[i+2]||'end');}
 assert.deepEqual(game,before);
});
test('external links are disconnected by default, content retention is explicit, repeated paste IDs do not collide',()=>{
 const pattern=copyMapPattern(game,['scene_1']);
 const one=pasteMapPattern(game,pattern);
 assert.equal(one.game.nodes[one.firstId].choices[0].targetNodeId,'');
 assert.equal(one.game.nodes[one.firstId].text,'');
 const two=pasteMapPattern(one.game,pattern,{keepContent:true,keepExternal:true});
 assert.notEqual(one.firstId,two.firstId);
 assert.equal(two.game.nodes[two.firstId].choices[0].targetNodeId,'scene_2');
 assert.equal(two.game.nodes[two.firstId].text,'Original main');
});
test('remap dice outcomes and combat links including internal cycles',()=>{
 const g=structuredClone(game);g.nodes.scene_1.choices[0].diceRoll={successTarget:'scene_2',failTarget:'scene_1',stat:'gold'};g.nodes.scene_2.combat={winTarget:'scene_1',fleeTarget:'end'};
 const result=pasteMapPattern(g,copyMapPattern(g,['scene_1','scene_2']));
 assert.equal(result.game.nodes[result.addedIds[0]].choices[0].diceRoll.failTarget,result.addedIds[0]);
 assert.equal(result.game.nodes[result.addedIds[1]].combat.winTarget,result.addedIds[0]);
 assert.equal(result.game.nodes[result.addedIds[1]].combat.fleeTarget,'');
});
test('reject invalid counts and chain definitions without touching original game',()=>{
 const pattern=copyMapPattern(game,['scene_1','scene_2']);
 for(const options of [{count:0},{count:31},{count:1.5},{chain:true,exitTokens:[]},{chain:true,exitTokens:['wrong']},{entryId:'gone'},{finalTarget:'gone'}])assert.throws(()=>pasteMapPattern(game,pattern,options));
 assert.equal(Object.keys(game.nodes).length,4);
});
