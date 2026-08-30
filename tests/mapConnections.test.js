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
