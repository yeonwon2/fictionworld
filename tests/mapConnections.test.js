import test from 'node:test';
import assert from 'node:assert/strict';
import { connectFromCard, connectionPorts } from '../src/lib/gameStudio/mapConnections.js';
const base = () => ({ meta: { aiWorkshop: {} }, nodes: { start_node: { id:'start_node',text:'Intro',choices:[] } } });
test('create from introduction produces one scene and four blank choices, connected immediately', () => {
 const game=base();
 const {game:next,targetId}=connectFromCard(game,{sourceId:'start_node',create:true,portKeys:[],choiceCount:4});
 assert.equal(Object.keys(next.nodes).length,2);
 assert.equal(next.nodes.start_node.choices[0].targetNodeId,targetId);
 assert.equal(next.nodes[targetId].choices.length,4);
 assert.ok(next.nodes[targetId].choices.every(c=>c.text===''&&c.targetNodeId===''));
 assert.equal(game.nodes.start_node.choices.length,0);
});
test('connect all four answers, then redirect only one without changing prose, scores or siblings', () => {
 const first=connectFromCard(base(),{sourceId:'start_node',create:true,portKeys:[],choiceCount:4});
 const id=first.targetId;
 first.game.nodes[id].choices[0].statModifiers={gold:5};
 const second=connectFromCard(first.game,{sourceId:id,create:true,portKeys:connectionPorts(first.game.nodes[id]).map(p=>p.key),choiceCount:4});
 assert.ok(second.game.nodes[id].choices.every(c=>c.targetNodeId===second.targetId));
 const third=connectFromCard(second.game,{sourceId:id,choiceIndex:0,create:true,portKeys:['choice:0:targetNodeId'],choiceCount:2});
 assert.equal(third.game.nodes[id].choices[0].targetNodeId,third.targetId);
 assert.equal(third.game.nodes[id].choices[1].targetNodeId,second.targetId);
 assert.deepEqual(third.game.nodes[id].choices[0].statModifiers,{gold:5});
});
test('existing targets support merging and self loops without adding scenes', () => {
 const first=connectFromCard(base(),{sourceId:'start_node',create:true,portKeys:[],choiceCount:4});
 const next=connectFromCard(first.game,{sourceId:first.targetId,portKeys:['choice:1:targetNodeId','choice:3:targetNodeId'],targetId:first.targetId});
 assert.equal(Object.keys(next.game.nodes).length,2);
 assert.equal(next.game.nodes[first.targetId].choices[1].targetNodeId,first.targetId);
 assert.equal(next.game.nodes[first.targetId].choices[0].targetNodeId,'');
});
test('dice and combat expose real outcome destinations and leave other outcomes alone', () => {
 const game=base(); game.nodes.start_node.choices=[{text:'roll',diceRoll:{successTarget:'start_node',failTarget:'missing'},targetNodeId:'ignored'}];
 const next=connectFromCard(game,{sourceId:'start_node',choiceIndex:0,portKeys:['choice:0:failTarget'],targetId:'start_node'}).game;
 assert.equal(next.nodes.start_node.choices[0].diceRoll.failTarget,'start_node');
 assert.equal(next.nodes.start_node.choices[0].targetNodeId,'ignored');
 game.nodes.start_node.combat={winTarget:'missing'};
 assert.ok(connectionPorts(game.nodes.start_node).some(p=>p.key==='combat:winTarget'));
});
test('invalid source, target, unselected ports and scene sizes fail without mutation', () => {
 const first=connectFromCard(base(),{sourceId:'start_node',create:true,portKeys:[],choiceCount:4});
 for(const patch of [{portKeys:[]},{portKeys:['choice:8:targetNodeId']},{targetId:'missing'},{create:true,choiceCount:99}]) assert.throws(()=>connectFromCard(first.game,{sourceId:first.targetId,portKeys:['choice:0:targetNodeId'],targetId:'start_node',...patch}));
 assert.throws(()=>connectFromCard(base(),{sourceId:'missing',portKeys:[],targetId:'start_node'}));
});

test('insert consequence keeps original destination and all effects on only the selected answer', async () => {
 const { insertConsequence } = await import('../src/lib/gameStudio/mapConnections.js');
 const game = base(); game.nodes.start_node.choices = [{ text:'A', targetNodeId:'scene_1', statModifiers:{gold:5}, requiresFlag:'ready', systemPopup:{title:'Notice',text:'Original'} },{text:'B',targetNodeId:'scene_1'}]; game.nodes.scene_1={id:'scene_1',text:'Next',isEnding:true,choices:[]};
 const before=structuredClone(game);
 const inserted=insertConsequence(game,{sourceId:'start_node',choiceIndex:0,portKey:'choice:0:targetNodeId',text:'Hệ quả của A'});
 assert.deepEqual(game,before);
 assert.equal(inserted.game.meta.aiWorkshop !== undefined,true);
 assert.deepEqual(inserted.game.nodes.start_node.choices[1],game.nodes.start_node.choices[1]);
 assert.deepEqual(inserted.game.nodes.start_node.choices[0],{...game.nodes.start_node.choices[0],targetNodeId:inserted.targetId});
 assert.deepEqual(inserted.game.nodes[inserted.targetId].choices,[{text:'Tiếp tục',targetNodeId:'scene_1',statModifiers:{},workshopContinuation:true}]);
});
test('consequences can be chained without changing the final destination or enabling AI mode for imported games', async () => {
 const { insertConsequence } = await import('../src/lib/gameStudio/mapConnections.js');
 const game=base(); delete game.meta.aiWorkshop; game.nodes.start_node.choices=[{text:'A',targetNodeId:'end'}]; game.nodes.end={id:'end',isEnding:true};
 const first=insertConsequence(game,{sourceId:'start_node',choiceIndex:0,portKey:'choice:0:targetNodeId'});
 const second=insertConsequence(first.game,{sourceId:first.targetId,choiceIndex:0,portKey:'choice:0:targetNodeId'});
 assert.equal(second.game.nodes[second.targetId].choices[0].targetNodeId,'end');
 assert.equal(second.game.nodes[first.targetId].choices[0].targetNodeId,second.targetId);
 assert.equal(second.game.meta.aiWorkshop,undefined);
});
test('inserting on dice affects only selected outcome; missing destinations require an explicit valid target', async () => {
 const { insertConsequence } = await import('../src/lib/gameStudio/mapConnections.js');
 const game=base();game.nodes.start_node.choices=[{text:'Roll',targetNodeId:'unused',diceRoll:{successTarget:'start_node',failTarget:'gone',difficulty:5}}];
 assert.throws(()=>insertConsequence(game,{sourceId:'start_node',choiceIndex:0,portKey:'choice:0:failTarget',targetId:'invalid'}));
 const result=insertConsequence(game,{sourceId:'start_node',choiceIndex:0,portKey:'choice:0:failTarget',targetId:'start_node'});
 assert.equal(result.game.nodes.start_node.choices[0].diceRoll.successTarget,'start_node');
 assert.equal(result.game.nodes.start_node.choices[0].targetNodeId,'unused');
 assert.equal(result.game.nodes[result.targetId].choices[0].targetNodeId,'start_node');
});
test('a consequence with no valid old target creates only one scene and leaves continuation unconnected', async () => {
 const { insertConsequence }=await import('../src/lib/gameStudio/mapConnections.js');
 const game=base(); delete game.meta.aiWorkshop; game.nodes.start_node.choices=[{text:'A',targetNodeId:'scene_1'}];
 const result=insertConsequence(game,{sourceId:'start_node',choiceIndex:0,portKey:'choice:0:targetNodeId'});
 const nextId=result.game.nodes[result.targetId].choices[0].targetNodeId;
 assert.equal(nextId,'');
 assert.equal(Object.keys(result.game.nodes).length,2);
 assert.equal(result.game.nodes[result.targetId].choices.length,1);
 assert.equal(result.game.meta.aiWorkshop,undefined);
 assert.equal(Object.keys(game.nodes).length,1);
});
test('bulk incoming links connect arbitrary scenes and self loops while preserving all gameplay data', async () => {
 const { connectIncoming }=await import('../src/lib/gameStudio/mapConnections.js');
 const game=base(); game.nodes.scene_1={id:'scene_1',choices:Array.from({length:4},(_,i)=>({text:`A${i}`,targetNodeId:'start_node',statModifiers:{gold:i},requiresFlag:'ready'}))};
 game.nodes.scene_2={id:'scene_2',choices:Array.from({length:4},()=>({text:'Loop',targetNodeId:''}))};
 const before=structuredClone(game);
 const selected=['scene_1','scene_2'].flatMap(id=>connectionPorts(game.nodes[id]).map(p=>({sourceId:id,portKey:p.key})));
 const next=connectIncoming(game,'scene_2',selected);
 assert.deepEqual(game,before);
 for(const id of ['scene_1','scene_2']) next.nodes[id].choices.forEach((c,i)=>assert.deepEqual(c,{...game.nodes[id].choices[i],targetNodeId:'scene_2'}));
 assert.equal(Object.keys(next.nodes).length,Object.keys(game.nodes).length);
});
test('bulk incoming links reject stale sources atomically and support dice outcomes without changing siblings', async () => {
 const { connectIncoming }=await import('../src/lib/gameStudio/mapConnections.js');
 const game=base();game.nodes.start_node.choices=[{text:'Roll',diceRoll:{successTarget:'gone',failTarget:'gone'},targetNodeId:'ignored'}];
 const selections=[{sourceId:'start_node',portKey:'choice:0:successTarget'}];
 const next=connectIncoming(game,'start_node',selections);
 assert.equal(next.nodes.start_node.choices[0].diceRoll.failTarget,'gone');
 assert.equal(next.nodes.start_node.choices[0].diceRoll.successTarget,'start_node');
 assert.throws(()=>connectIncoming(game,'start_node',[...selections,{sourceId:'gone',portKey:'choice:0:targetNodeId'}]));
 assert.equal(game.nodes.start_node.choices[0].diceRoll.successTarget,'gone');
 assert.throws(()=>connectIncoming(game,'start_node',[]));
});

test('a main scene after a consequence never inherits consequence role and creates only requested choices', () => {
 const game = base();
 game.nodes.side = {id:'side',workshopRole:'consequence',workshopTitle:'Hệ quả A',text:'Result',choices:[{text:'Tiếp tục',targetNodeId:'',statModifiers:{}}]};
 const result = connectFromCard(game,{sourceId:'side',create:true,portKeys:['choice:0:targetNodeId'],choiceCount:4,role:'main'});
 assert.equal(Object.keys(result.game.nodes).length,Object.keys(game.nodes).length+1);
 assert.equal(result.game.nodes[result.targetId].workshopRole,'main');
 assert.equal(result.game.nodes[result.targetId].workshopTitle,undefined);
 assert.equal(result.game.nodes[result.targetId].choices.length,4);
 assert.ok(result.game.nodes[result.targetId].choices.every(c=>c.targetNodeId===''));
 assert.equal(result.game.nodes.side.workshopRole,'consequence');
 const side = connectFromCard(result.game,{sourceId:result.targetId,choiceIndex:0,create:true,portKeys:['choice:0:targetNodeId'],choiceCount:0,role:'side'});
 assert.equal(side.game.nodes[side.targetId].workshopRole,'side');
 assert.deepEqual(side.game.nodes[side.targetId].choices,[]);
});

test('four consequence paths converge into exactly one new main scene without touching other links', async () => {
 const { createMergeScene } = await import('../src/lib/gameStudio/mapConnections.js');
 const game = base();
 for (let i=1;i<=4;i++) game.nodes[`result_${i}`]={id:`result_${i}`,workshopRole:'consequence',choices:[{text:'Tiếp tục',targetNodeId:'',statModifiers:{gold:i}}]};
 const selection=[1,2,3,4].map(i=>({sourceId:`result_${i}`,portKey:'choice:0:targetNodeId'}));
 const result=createMergeScene(game,selection,4);
 assert.equal(Object.keys(result.game.nodes).length,6);
 assert.equal(result.game.nodes[result.targetId].choices.length,4);
 for(let i=1;i<=4;i++) {
  assert.equal(result.game.nodes[`result_${i}`].choices[0].targetNodeId,result.targetId);
  assert.deepEqual(result.game.nodes[`result_${i}`].choices[0].statModifiers,{gold:i});
  assert.equal(game.nodes[`result_${i}`].choices[0].targetNodeId,'');
 }
 assert.deepEqual(result.game.nodes.start_node,game.nodes.start_node);
 assert.throws(()=>createMergeScene(game,[...selection,{sourceId:'missing',portKey:'choice:0:targetNodeId'}],4));
 assert.equal(Object.keys(game.nodes).length,5);
});

test('adding answers preserves original content and mechanics and does not create scenes', async () => {
 const { appendChoices } = await import('../src/lib/gameStudio/mapConnections.js');
 const game=base();
 game.nodes.start_node.choices=[{text:'Bắt đầu',targetNodeId:'x',statModifiers:{gold:2}}];
 const next=appendChoices(game,'start_node',3);
 assert.deepEqual(Object.keys(next.nodes),Object.keys(game.nodes));
 assert.equal(next.nodes.start_node.choices.length,4);
 assert.deepEqual(next.nodes.start_node.choices[0],game.nodes.start_node.choices[0]);
 assert.ok(next.nodes.start_node.choices.slice(1).every(c=>c.text===''&&c.targetNodeId===''));
 assert.equal(game.nodes.start_node.choices.length,1);
 assert.throws(()=>appendChoices(game,'start_node',0));
});
