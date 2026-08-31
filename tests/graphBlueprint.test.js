import test from 'node:test';import assert from 'node:assert/strict';
import {makeSkeletonPlan,applyBlueprint,blueprintPrompt} from '../src/lib/gameStudio/graphBlueprint.js';
import {resolveAutomaticEnding} from '../src/lib/gameStudio/automaticEnding.js';
import {gameOverReasons} from '../src/lib/gameStudio/playerState.js';
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

// Numeric rules from Dưới Bóng Phù Dung; no private story text or API call.
function phuDungBlueprint(){
 const plan=makeSkeletonPlan({count:30,choices:4,consequences:true});
 plan.stats=[['tac_hop',50],['thanh_vu',30],['chieu_dao',10]].map(([key,initial])=>({key,label:key,initial,isVital:false,deathThreshold:0}));
 const bounds=values=>Object.entries(values).map(([key,value])=>({key,value}));
 const rules=[
  ['bad',{}, {tac_hop:59}],
  ['nguyet_lao',{tac_hop:60},{thanh_vu:74,chieu_dao:74}],
  ['thanh_vu',{tac_hop:60,thanh_vu:75},{chieu_dao:74}],
  ['chieu_dao',{tac_hop:60,chieu_dao:75},{thanh_vu:74}],
  ['ba_nguoi',{tac_hop:60,thanh_vu:75,chieu_dao:75},{}],
 ];
 const blank=structuredClone(plan.nodes[1].choices[0]);
 const last=plan.nodes.find(n=>n.id==='new_lane_0_29');
 const effects=[{tac_hop:3,thanh_vu:4,chieu_dao:4},{tac_hop:1,thanh_vu:7},{tac_hop:1,chieu_dao:7},{tac_hop:5,thanh_vu:2,chieu_dao:2}];
 last.choices.forEach((c,i)=>{c.modifiers=bounds(effects[i]);plan.nodes.find(n=>n.id===c.target).choices[0].target='new_router';});
 plan.nodes.push({id:'new_router',title:'Xét kết thúc sau Đại điển',text:'',role:'router',endingType:'NORMAL_END',choices:rules.map(([name,min,max])=>({...blank,target:`new_end_${name}`,min:bounds(min),max:bounds(max)}))});
 rules.forEach(([name],i)=>plan.nodes.push({id:`new_end_${name}`,title:name,text:i===0?'KÝ CHỦ BỊ ĐÀO THẢI':'Lời kết',role:'ending',endingType:i===0?'BAD_END':'TRUE_END',choices:[]}));
 plan.connections=[{sourceId:'start_node',choiceIndex:-1,target:plan.nodes[0].id}];
 return plan;
}

test('Phu Dung blueprint preserves 30 scenes, 120 consequences and five three-stat endings',()=>{
 const original=base(),before=structuredClone(original);
 const {game,ids}=applyBlueprint(original,phuDungBlueprint());
 assert.deepEqual(original,before);
 assert.equal(ids.length,156);
 assert.equal(ids.filter(id=>game.nodes[id].workshopRole==='main').length,30);
 assert.equal(ids.filter(id=>game.nodes[id].workshopRole==='consequence').length,120);
 assert.equal(ids.filter(id=>game.nodes[id].endingType==='TRUE_END').length,4);
 assert.deepEqual(game.meta.initialStats,{tac_hop:50,thanh_vu:30,chieu_dao:10});
 assert.deepEqual(gameOverReasons(game.meta.initialStats,game.meta.statsConfig),[]);
 assert.deepEqual(gameOverReasons({tac_hop:-50},game.meta.statsConfig),[]);
 const router=Object.values(game.nodes).find(n=>n.automaticEnding);
 // All combinations around both thresholds, including extreme integer scores.
 for(const tac_hop of [-100,0,50,59,60,61,200])for(const thanh_vu of [-50,0,74,75,76,200])for(const chieu_dao of [-50,0,74,75,76,200]){
  const runtime={stats:{tac_hop,thanh_vu,chieu_dao}},snapshot=structuredClone(runtime);
  const target=resolveAutomaticEnding(game.nodes,router,runtime);
  const expected=tac_hop<60?'bad':thanh_vu<75?(chieu_dao<75?'nguyet_lao':'chieu_dao'):(chieu_dao<75?'thanh_vu':'ba_nguoi');
  assert.equal(game.nodes[target].endingLabel,expected);
  assert.deepEqual(runtime,snapshot);
 }
 // The last answer applies its delta before the consequence goes to the router.
 const last=Object.values(game.nodes).filter(n=>n.workshopRole==='main').at(-1);
 const expected=['ba_nguoi','thanh_vu','chieu_dao','nguyet_lao'];
 last.choices.forEach((choice,i)=>{
  const stats={tac_hop:59,thanh_vu:71,chieu_dao:71};
  for(const [key,delta] of Object.entries(choice.statModifiers))stats[key]+=delta;
  const consequence=game.nodes[choice.targetNodeId];
  assert.equal(consequence.workshopRole,'consequence');
  assert.equal(consequence.choices[0].targetNodeId,router.id);
  assert.equal(game.nodes[resolveAutomaticEnding(game.nodes,router,{stats})].endingLabel,expected[i]);
 });
});

test('OR is represented by disjoint branches to the same ending, without weakening ambiguity checks',()=>{
 const plan=phuDungBlueprint(),router=plan.nodes.find(n=>n.role==='router');
 const blank=router.choices[0];
 router.choices=[
  {...blank,target:'new_end_ba_nguoi',min:[{key:'tac_hop',value:60}],max:[]},
  {...blank,target:'new_end_ba_nguoi',min:[{key:'thanh_vu',value:75}],max:[{key:'tac_hop',value:59}]},
  {...blank,target:'new_end_bad',min:[],max:[{key:'tac_hop',value:59},{key:'thanh_vu',value:74}]},
 ];
 const {game}=applyBlueprint(base(),plan),node=Object.values(game.nodes).find(n=>n.automaticEnding);
 for(const tac_hop of [59,60,61])for(const thanh_vu of [74,75,76]){
  const target=resolveAutomaticEnding(game.nodes,node,{stats:{tac_hop,thanh_vu}});
  assert.equal(game.nodes[target].endingLabel,tac_hop>=60||thanh_vu>=75?'ba_nguoi':'bad');
 }
 node.choices[1].statRequirementsMax={};
 assert.throws(()=>resolveAutomaticEnding(game.nodes,node,{stats:{tac_hop:60,thanh_vu:75}}),/nhiều kết thúc/);
});

test('blueprint instructions distinguish supported multi-stat checkpoint rules from unsupported mechanics',()=>{
 const prompt=blueprintPrompt(base(),'Tạo game từ kịch bản của tôi');
 for(const instruction of ['KHÔNG phải engine chỉ hỗ trợ tuyến tính','3-way ending','OR có thể biểu diễn','isVital=false','156 ô','so sánh hai chỉ số động','không làm tròn luật điểm thập phân'])assert.ok(prompt.includes(instruction),instruction);
 assert.ok(!prompt.includes('OR phức tạp, luật nhiều thời điểm'));
 const plan=phuDungBlueprint();plan.unsupported=['Luật chưa biểu diễn được'];
 assert.throws(()=>applyBlueprint(base(),plan),/nhận định của bản đề xuất, không phải kết luận kiểm tra engine/);
});
