import test from 'node:test';import assert from 'node:assert/strict';
import {makeSkeletonPlan,applyBlueprint,blueprintPrompt,normalizeBlueprintIds,normalizeBlueprintConnections,normalizeBlueprintEntry,normalizeBlueprintSemantics,verifyUnsupportedClaims,enforceExplicitBlueprintRules,blueprintRequestContract,validateBlueprintAgainstRequest} from '../src/lib/gameStudio/graphBlueprint.js';
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
test('AI node IDs are normalized locally and all internal targets follow the new IDs',()=>{
 const plan=makeSkeletonPlan({count:2,choices:1});
 plan.nodes[0].id='scene 1';
 plan.nodes[1].id='scene 1';
 plan.nodes[0].choices[0].target='scene 1';
 plan.connections=[{sourceId:'start_node',choiceIndex:-1,target:'scene 1'}];
 const source=structuredClone(plan),normalized=normalizeBlueprintIds(base(),plan);
 assert.deepEqual(plan,source);
 assert.equal(new Set(normalized.nodes.map(node=>node.id)).size,2);
 assert.ok(normalized.nodes.every(node=>/^new_[a-zA-Z0-9_]+$/.test(node.id)));
 assert.equal(normalized.nodes[0].choices[0].target,normalized.nodes[0].id);
 assert.equal(normalized.connections[0].target,normalized.nodes[0].id);
 const built=applyBlueprint(base(),plan);
 assert.equal(built.ids.length,2);
 assert.equal(built.game.nodes.start_node.choices[0].targetNodeId,built.ids[0]);
});
test('false AI capability warnings are removed but genuine unsupported rules stay blocking',()=>{
 const plan=makeSkeletonPlan({count:2,choices:1});
 plan.unsupported=[
  'Cơ chế giới hạn 6 tháng thực tế chỉ có thể mô phỏng bằng cách đếm số bước (cảnh) thay vì thời gian thực; Engine không hỗ trợ kiểm tra AND/OR phức tạp cho nhiều chỉ số ngoài hệ thống min/max',
  'So sánh động giữa hai chỉ số chưa được hỗ trợ',
 ];
 const checked=verifyUnsupportedClaims(plan,'Câu chuyện diễn ra trong 6 tháng, kết thúc sau cảnh cuối');
 assert.deepEqual(checked.unsupported,['So sánh động giữa hai chỉ số chưa được hỗ trợ']);
 assert.equal(plan.unsupported.length,2);
 const narrativeOnly=verifyUnsupportedClaims({...plan,unsupported:[plan.unsupported[0]]},'Kể câu chuyện 6 tháng với ending theo điểm');
 assert.deepEqual(narrativeOnly.unsupported,[]);
 assert.doesNotThrow(()=>applyBlueprint(base(),narrativeOnly));
 const realTime=verifyUnsupportedClaims({...plan,unsupported:[plan.unsupported[0]]},'Game phải đếm ngược real-time trong 6 tháng');
 assert.equal(realTime.unsupported.length,1);
});
test('AI connections and explicit fatal threshold are normalized without another request',()=>{
 const game=base(),plan=makeSkeletonPlan({count:1,choices:1});
 plan.connections=[{sourceId:'start_node',choiceIndex:0,target:plan.nodes[0].id},{sourceId:plan.nodes[0].id,choiceIndex:0,target:plan.nodes[0].id}];
 plan.stats=[{key:'thien_cam',label:'Thiện cảm',initial:-90,isVital:true,deathThreshold:-199}];
 const connected=normalizeBlueprintConnections(game,plan);
 assert.equal(connected.connections.length,1);
 assert.equal(connected.connections[0].choiceIndex,-1);
 const enforced=enforceExplicitBlueprintRules(connected,'Thiện cảm khởi đầu: -100. Nếu Thiện cảm giảm xuống -200 hoặc thấp hơn, kết thúc ngay.');
 assert.deepEqual(enforced.stats[0],{key:'thien_cam',label:'Thiện cảm',initial:-100,isVital:true,deathThreshold:-200});
 const built=applyBlueprint(game,enforced);
 assert.equal(built.game.nodes.start_node.choices[0].targetNodeId,built.firstId);
 assert.equal(built.game.meta.statsConfig[0].deathThreshold,-200);
});
test('duplicate AI edits for one source port keep only the final destination',()=>{
 const game=base(),plan=makeSkeletonPlan({count:2,choices:1});
 plan.connections=[{sourceId:'start_node',choiceIndex:-1,target:plan.nodes[0].id},{sourceId:'start_node',choiceIndex:-1,target:plan.nodes[1].id}];
 const fixed=normalizeBlueprintConnections(game,plan);
 assert.deepEqual(fixed.connections,[{sourceId:'start_node',choiceIndex:-1,target:plan.nodes[1].id}]);
});
test('new-game entry always starts at the first authored main scene',()=>{
 const plan=makeSkeletonPlan({count:2,choices:1});plan.nodes[0].title='Xuyên không';plan.connections=[{sourceId:'start_node',choiceIndex:-1,target:plan.nodes[1].id}];
 const fixed=normalizeBlueprintEntry(base(),plan);assert.equal(fixed.connections[0].target,plan.nodes[0].id);assert.deepEqual(validateBlueprintAgainstRequest(fixed,'2 cảnh chính, mỗi cảnh 1 lựa chọn'),[]);
});
test('full-game regeneration rewires an occupied opening to the new first main scene',()=>{
 const game=base();game.nodes.start_node.choices=[{text:'Bản thử cũ',targetNodeId:'old_scene'}];game.nodes.old_scene={id:'old_scene',text:'Cũ',choices:[]};
 const plan=makeSkeletonPlan({count:30,choices:4});plan.connections=[];
 const fixed=normalizeBlueprintEntry(game,plan,'Game khoảng 30 cảnh chính.');
 assert.deepEqual(fixed.connections,[{sourceId:'start_node',choiceIndex:0,target:plan.nodes[0].id}]);
 assert.doesNotMatch(blueprintPrompt(game,'Game khoảng 30 cảnh chính.'),/Bản thử cũ/);
});
test('request contract rejects representative samples and accepts the complete reachable graph',()=>{
 const request='Game khoảng 30 cảnh chính. Mỗi cảnh có 4 lựa chọn. GOOD END, BAD END, DEATH END.';
 assert.deepEqual(blueprintRequestContract(request),{mainSceneCount:30,choicesPerMain:4,requiresGood:true,requiresBad:true,requiresDeath:true});
 const sample=makeSkeletonPlan({count:2,choices:4});sample.connections=[{sourceId:'start_node',choiceIndex:-1,target:sample.nodes[0].id}];
 assert.match(validateBlueprintAgainstRequest(sample,request).join(' '),/30 cảnh chính.*chỉ có 2/);
 const complete=makeSkeletonPlan({count:30,choices:4});complete.connections=[{sourceId:'start_node',choiceIndex:-1,target:complete.nodes[0].id}];
 for(const [id,title,endingType] of [['new_good','GOOD END','GOOD_END'],['new_bad','BAD END','BAD_END'],['new_death','DEATH END','BAD_END']])complete.nodes.push({id,title,text:title,role:'ending',endingType,choices:[]});
 complete.nodes.at(-4).choices.forEach((choice,index)=>{choice.target=['new_good','new_bad','new_death','new_good'][index];});
 assert.deepEqual(validateBlueprintAgainstRequest(complete,request),[]);
 const prompt=blueprintPrompt(base(),request);assert.match(prompt,/ĐÚNG 30/);assert.match(prompt,/ĐÚNG 4 choices/);assert.match(prompt,/Không được trả vài cảnh mẫu/);
});
test('quality gate allows outline prose but still reports fake branching and mathematically impossible Good End',()=>{
 const plan=makeSkeletonPlan({count:30,choices:4});plan.connections=[{sourceId:'start_node',choiceIndex:-1,target:plan.nodes[0].id}];
 plan.stats=[{key:'thien_cam',label:'Thiện cảm',initial:-100,isVital:true,deathThreshold:-200}];
 for(const node of plan.nodes){node.title=`Cảnh ${node.id}`;node.text='Tiếp tục diễn biến...';node.choices.forEach((choice,index)=>{choice.text=`Lựa chọn ${index+1}`;choice.modifiers=[{key:'thien_cam',value:[5,2,-2,-10][index]}];});}
 const request='30 cảnh chính, mỗi cảnh có 4 lựa chọn. Văn phải đủ dài, không viết cảnh ngắn. Có nhánh phụ. Quyết định trong quá khứ phải ảnh hưởng cảnh sau. Không được thiết kế theo kiểu lựa chọn nào cũng cộng. Thiện cảm khởi đầu -100 và phải vượt 100.';
 const errors=validateBlueprintAgainstRequest(plan,request).join(' ');
 assert.doesNotMatch(errors,/quá ngắn/);assert.match(errors,/nhánh phụ/);assert.match(errors,/cờ sự kiện/);assert.match(errors,/bất khả thi/);
});
test('local semantic repair converts a mislabeled side branch and wires its past-decision flag',()=>{
 const plan=makeSkeletonPlan({count:30,choices:4});
 const side={id:'new_side_wrong',title:'Nhánh phụ: Thuốc chữa trị',text:'Tìm thuốc',role:'main',endingType:'NORMAL_END',choices:[{text:'Quay lại',target:plan.nodes[1].id,min:[],max:[],modifiers:[],requiresFlag:'',requiresFlagAbsent:'',requiresItem:'',grantFlag:'',grantItem:''}]};
 plan.nodes.push(side);plan.nodes[0].choices[0].target=side.id;
 const fixed=normalizeBlueprintSemantics(plan,'30 cảnh chính. Có nhánh phụ. Quyết định trong quá khứ phải ảnh hưởng cảnh sau.');
 assert.equal(fixed.nodes.find(node=>node.id===side.id).role,'side');
 assert.match(fixed.nodes[0].choices[0].grantFlag,/da_di_nhanh/);
 assert.equal(fixed.nodes[1].choices[0].requiresFlag,fixed.nodes[0].choices[0].grantFlag);
});
test('quality gate requires direct choice Death End and a side branch that rejoins the main route',()=>{
 const request='Có lựa chọn là DeađEn ngay. Một số cảnh chọn xong dẫn tới nhánh phụ, rồi mới quay ngược lại mạch chính.';
 const plan=makeSkeletonPlan({count:2,choices:2});
 plan.connections=[{sourceId:'start_node',choiceIndex:-1,target:plan.nodes[0].id}];
 let errors=validateBlueprintAgainstRequest(plan,request).join(' ');
 assert.match(errors,/nối trực tiếp vào ô kết thúc tử vong/);
 assert.match(errors,/Nhánh phụ chưa hoàn chỉnh/);
 const returnChoice={text:'Trở lại chính điện',target:plan.nodes[1].id,min:[],max:[],modifiers:[],requiresFlag:'',requiresFlagAbsent:'',requiresItem:'',grantFlag:'',grantItem:''};
 plan.nodes.push(
  {id:'new_side',title:'Giấu thuốc giải',text:'Một hậu quả riêng có nội dung.',role:'side',endingType:'NORMAL_END',choices:[returnChoice]},
  {id:'new_death',title:'DEATH END — Trúng độc',text:'Nàng chết ngay vì lựa chọn liều lĩnh.',role:'ending',endingType:'BAD_END',choices:[]},
 );
 plan.nodes[0].choices[0].target='new_side';
 plan.nodes[0].choices[1].target='new_death';
 assert.deepEqual(validateBlueprintAgainstRequest(plan,request),[]);
 const originalWording='Có lựa chọn có thể gây hậu quả nghiêm trọng. DEATH END — KHÔNG THỂ CỨU VÃN.';
 assert.match(validateBlueprintAgainstRequest(makeSkeletonPlan({count:1,choices:1}),originalWording).join(' '),/nối trực tiếp vào ô kết thúc tử vong/);
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
