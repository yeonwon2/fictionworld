import test from 'node:test';import assert from 'node:assert/strict';
import {createScoreEndingRules} from '../src/lib/gameStudio/outcomeControls.js';
import {resolveAutomaticEnding} from '../src/lib/gameStudio/automaticEnding.js';
import {selectedScopes} from '../src/lib/gameStudio/aiMindMap.js';
import {routePlaytestProgress} from '../src/lib/gameStudio/routePlaytest.js';
const setup=()=>createScoreEndingRules({meta:{statsConfig:[{key:'points',label:'Điểm',default:0}]},nodes:{}},'points',[{title:'BE',type:'BAD_END',min:null},{title:'NE',type:'NORMAL_END',min:20},{title:'HE',type:'GOOD_END',min:80}]);
test('automatic endings resolve from updated scores without applying a second effect',()=>{
 const {game,checkpoint}=setup(),n=game.nodes[checkpoint];
 for(const [points,type] of [[19,'BAD_END'],[20,'NORMAL_END'],[79,'NORMAL_END'],[80,'GOOD_END'],[120,'GOOD_END']]){
  const rt={stats:{points},inventory:[],flags:[]},before=structuredClone(rt);
  assert.equal(game.nodes[resolveAutomaticEnding(game.nodes,n,rt)].endingType,type);
  assert.deepEqual(rt,before);
 }
 assert.equal(n.automaticEnding,true);
});
test('invalid automatic routes stop rather than guessing or dropping mechanics',()=>{
 const {game,checkpoint}=setup(),n=game.nodes[checkpoint];
 n.choices[0].statRequirementsMax={points:100};
 assert.throws(()=>resolveAutomaticEnding(game.nodes,n,{stats:{points:80}}),/nhiều kết thúc/);
 n.choices[0].statRequirementsMax={points:-1};
 assert.throws(()=>resolveAutomaticEnding(game.nodes,n,{stats:{points:10}}),/Không có kết thúc/);
 n.choices[0].grantFlag='x';
 assert.throws(()=>resolveAutomaticEnding(game.nodes,n,{stats:{points:80}}),/hiệu ứng/);
});
test('AI selects endings but not internal router; history still lets route test detect mismatch',()=>{
 const {game,checkpoint,ids}=setup();
 const scopes=selectedScopes(game,ids.map(id=>`scene:${id}`));
 assert.equal(scopes.length,3);assert.ok(scopes.every(s=>game.nodes[s.id].isEnding));
 const target=resolveAutomaticEnding(game.nodes,game.nodes[checkpoint],{stats:{points:80}});
 const rt={nodeId:target,history:['start_node',checkpoint]};
 assert.equal(routePlaytestProgress({steps:[{nodeId:'start_node'},{nodeId:checkpoint},{nodeId:target}]},rt,'ending').state,'complete');
 assert.equal(routePlaytestProgress({steps:[{nodeId:'start_node'},{nodeId:checkpoint},{nodeId:ids[1]}]},rt,'ending').state,'diverged');
});
