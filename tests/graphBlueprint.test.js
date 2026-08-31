import test from 'node:test';import assert from 'node:assert/strict';
import {makeSkeletonPlan,applyBlueprint} from '../src/lib/gameStudio/graphBlueprint.js';
import {createCanvasScene,setCardPosition} from '../src/lib/gameStudio/canvasEditing.js';
import {buildMindMap} from '../src/lib/gameStudio/mindMap.js';
const base=()=>({meta:{statsConfig:[],initialStats:{}},nodes:{start_node:{id:'start_node',text:'Dẫn truyện',choices:[]}}});
test('linear skeleton with effects has exact size and converges to next main scene',()=>{
 const plan=makeSkeletonPlan({count:3,choices:4,consequences:true});const before=base();plan.connections=[{sourceId:'start_node',choiceIndex:-1,target:plan.nodes[0].id}];
 const built=applyBlueprint(before,plan);assert.equal(built.ids.length,15);assert.equal(before.nodes.start_node.choices.length,0);
 const mains=built.ids.filter(id=>built.game.nodes[id].workshopRole==='main');
 built.game.nodes[mains[0]].choices.forEach(c=>{const side=built.game.nodes[c.targetNodeId];assert.equal(side.workshopRole,'consequence');assert.equal(side.choices[0].targetNodeId,mains[1]);});
 assert.equal(built.game.nodes.start_node.choices[0].targetNodeId,mains[0]);
});
test('parallel skeleton creates finite independent lanes and safe limits',()=>{
 const plan=makeSkeletonPlan({count:2,choices:3,kind:'parallel'});const built=applyBlueprint(base(),plan);assert.equal(built.ids.length,7);
 const lanes=built.game.nodes[built.firstId].choices.map(c=>c.targetNodeId);assert.equal(new Set(lanes).size,3);
 assert.throws(()=>makeSkeletonPlan({count:30,choices:12,consequences:true,kind:'parallel'}),/300/);
});
test('blueprint rejects missing targets and unsupported mechanics atomically',()=>{
 const plan=makeSkeletonPlan({count:1,choices:1}),game=base(),before=structuredClone(game);
 plan.nodes[0].choices[0].target='not_real';assert.throws(()=>applyBlueprint(game,plan),/Đích/);assert.deepEqual(game,before);
 plan.nodes[0].choices[0].target='';plan.unsupported=['Thua ở ngưỡng trên toàn cục'];assert.throws(()=>applyBlueprint(game,plan),/Chưa thể/);
 plan.unsupported=[];plan.stats=[{key:'favor',label:'Sủng ái',initial:0,isVital:true,deathThreshold:10}];assert.throws(()=>applyBlueprint(game,plan),/thua ngay/);
});
test('canvas positions persist independently from content and choices',()=>{
 const original=base(),created=createCanvasScene(original,{x:1200,y:700},{count:4,title:'Cảnh tại chuột'});
 assert.equal(created.game.nodes[created.targetId].choices.length,4);
 const moved=setCardPosition(created.game,{kind:'choice',sceneId:created.targetId,choiceIndex:2},{x:333,y:555});
 const graph=buildMindMap(moved.nodes),card=graph.cards.find(c=>c.key===`choice:${created.targetId}:2`);
 assert.equal(card.x,333);assert.equal(card.y,555);assert.equal(moved.nodes[created.targetId].workshopPosition.x,1200);
 assert.equal(Object.keys(original.nodes).length,1);
});

test('AI blueprint creates four named endings, a hidden router and survival rules',async()=>{
 const {resolveAutomaticEnding}=await import('../src/lib/gameStudio/automaticEnding.js');
 const {unfinishedWorkshop}=await import('../src/lib/gameStudio/aiMindMap.js');
 const game=base();game.nodes.start_node.choices=[{text:'Chốt quyết định',targetNodeId:'',statModifiers:{favor:5},grantFlag:'finished'}];
 const plan=makeSkeletonPlan({count:1,choices:4});
 plan.stats=[{key:'favor',label:'Sủng ái',initial:50,isVital:true,deathThreshold:9}];
 plan.gameOverTitle='Lãnh cung';plan.gameOverText='Bạn mất sự che chở.';
 const router=plan.nodes[0];router.role='router';
 const ranges=[[null,19],[20,49],[50,79],[80,null]];
 ranges.forEach(([min,max],i)=>{
  router.choices[i].target=`new_end_${i}`;
  router.choices[i].min=min===null?[]:[{key:'favor',value:min}];
  router.choices[i].max=max===null?[]:[{key:'favor',value:max}];
  plan.nodes.push({id:`new_end_${i}`,title:`Lời kết ${i+1}`,text:`Nội dung kết thúc ${i+1}`,role:'ending',endingType:i===0?'BAD_END':'GOOD_END',choices:[]});
 });
 plan.connections=[{sourceId:'start_node',choiceIndex:0,target:router.id}];
 const built=applyBlueprint(game,plan),node=built.game.nodes[built.firstId];
 assert.equal(built.ids.length,5);assert.equal(node.automaticEnding,true);
 assert.ok(!unfinishedWorkshop(built.game).some(message=>message.startsWith(built.firstId+':')));
 assert.equal(built.game.meta.statsConfig[0].deathThreshold,9);
 assert.equal(built.game.meta.gameOverTitle,'Lãnh cung');
 assert.equal(built.game.nodes.start_node.choices[0].grantFlag,'finished');
 assert.deepEqual(built.game.nodes.start_node.choices[0].statModifiers,{favor:5});
 for(const [score,index] of [[10,0],[19,0],[20,1],[49,1],[50,2],[79,2],[80,3],[150,3]]){
  const target=resolveAutomaticEnding(built.game.nodes,node,{stats:{favor:score}});
  assert.equal(built.game.nodes[target].endingLabel,`Lời kết ${index+1}`);
 }
 const moved=setCardPosition(built.game,{kind:'choice',sceneId:built.firstId,choiceIndex:2},{x:500,y:500});
 assert.doesNotThrow(()=>resolveAutomaticEnding(moved.nodes,moved.nodes[built.firstId],{stats:{favor:55}}));
 assert.equal(game.nodes.start_node.choices[0].targetNodeId,'');
});

test('automatic layout keeps new cards clear of manually placed scenes',()=>{
 const game=base();game.nodes.start_node.workshopPosition={x:450,y:60};game.nodes.start_node.choices=[{text:'Bắt đầu',targetNodeId:''}];
 const graph=buildMindMap(game.nodes),choice=graph.cards.find(c=>c.kind==='choice');
 assert.ok(choice.y>=370);
 assert.throws(()=>applyBlueprint(game,null),/không hợp lệ/);
});
