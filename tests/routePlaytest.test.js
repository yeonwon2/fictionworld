import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRoutePlaytest, routePlaytestProgress } from '../src/lib/gameStudio/routePlaytest.js';
const game = { meta: {}, nodes: {
 start_node: { id:'start_node', choices:[{targetNodeId:'s',text:'Start'}] },
 s: { id:'s', choices:[{targetNodeId:'s',text:'Loop'},{targetNodeId:'end',text:'End',statRequirements:{gold:5}}] },
 end: { id:'end',isEnding:true,choices:[] },
 other: { id:'other',isEnding:true,choices:[] },
}};
const trail = ['scene:start_node','choice:start_node:0','scene:s','choice:s:0','scene:s','choice:s:1','scene:end'];
test('route retains repeated scene occurrences and exact choice indexes without mutating game',()=>{
 const before=structuredClone(game), route=makeRoutePlaytest(game,trail);
 assert.deepEqual(route.steps.map(s=>s.nodeId),['start_node','s','s','end']);
 assert.equal(routePlaytestProgress(route,{nodeId:'s',history:['start_node','s']},'scene').step.choiceIndex,1);
 assert.deepEqual(game,before);
});
test('rejects mid-story starts, stale routes, missing destinations, and unfinished choices',()=>{
 for(const route of [['scene:s'],['scene:start_node','scene:end'],['scene:start_node','choice:start_node:0'],['scene:start_node','missing:0']]) assert.throws(()=>makeRoutePlaytest(game,route));
});
test('reports completion, premature game over and real route divergence separately',()=>{
 const route=makeRoutePlaytest(game,trail);
 assert.equal(routePlaytestProgress(route,{nodeId:'end',history:['start_node','s','s']},'ending').state,'complete');
 assert.equal(routePlaytestProgress(route,{nodeId:'s',history:['start_node']},'gameover').state,'stopped');
 assert.equal(routePlaytestProgress(route,{nodeId:'other',history:['start_node','s']},'scene').state,'diverged');
 assert.equal(routePlaytestProgress(route,{nodeId:'s',history:['other']},'scene').state,'diverged');
 assert.equal(routePlaytestProgress(null,{nodeId:'s',history:[]},'scene'),null);
});
test('dice route validates its actual outcome edge without forcing the outcome',()=>{
 const dice=structuredClone(game); dice.nodes.s.choices[1].diceRoll={successTarget:'end',failTarget:'other',stat:'gold',difficulty:10};
 const route=makeRoutePlaytest(dice,['scene:start_node','choice:start_node:0','scene:s','choice:s:1','scene:end']);
 assert.equal(routePlaytestProgress(route,{nodeId:'other',history:['start_node','s']},'scene').state,'diverged');
});
