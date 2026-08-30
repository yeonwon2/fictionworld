import test from 'node:test';
import assert from 'node:assert/strict';
import { saveOutcomeGate, saveOutcomeMode, outcomeWarnings, endingEntries } from '../src/lib/gameStudio/outcomeControls.js';
import { choiceAvailable } from '../src/lib/gameStudio/routeExplorer.js';
import { applySetup, workshopPrompt } from '../src/lib/gameStudio/aiMindMap.js';
const game = () => ({meta:{statsConfig:[{key:'trust',label:'Tin tưởng',default:0,isVital:false},{key:'scandal',label:'Tai tiếng',default:0,isVital:false}],initialStats:{trust:0,scandal:0},aiWorkshop:{type:'studio',idea:'Tình cảm',setupApproved:true}},nodes:{start_node:{id:'start_node',choices:[{text:'Kết thúc tốt',targetNodeId:'he',statModifiers:{trust:3}},{text:'Kết thúc xấu',targetNodeId:'be'},{text:'Tạm biệt',targetNodeId:'ne'}]},he:{id:'he',isEnding:true,endingType:'GOOD_END',text:'Hạnh phúc',choices:[]},be:{id:'be',isEnding:true,endingType:'BAD_END',text:'Chia xa',choices:[]},ne:{id:'ne',isEnding:true,endingType:'NORMAL_END',text:'Tạm biệt',choices:[]}}});
const state=(trust,scandal,flags=[])=>({stats:{trust,scandal},flags:new Set(flags),inventory:new Set(),items:new Set(),npcAffinity:{}});
test('HE gates use actual route evaluator and preserve score effects; BE and NE remain distinct',()=>{
 const original=game();
 let next=saveOutcomeGate(original,'start_node',0,{statRequirements:{trust:70},statRequirementsMax:{scandal:20},requiresFlag:'honest'});
 next=saveOutcomeGate(next,'start_node',1,{statRequirements:{scandal:21}});
 assert.equal(choiceAvailable(next.nodes.start_node.choices[0],state(70,20,['honest'])),true);
 assert.equal(choiceAvailable(next.nodes.start_node.choices[0],state(69,20,['honest'])),false);
 assert.equal(choiceAvailable(next.nodes.start_node.choices[0],state(80,21,['honest'])),false);
 assert.equal(choiceAvailable(next.nodes.start_node.choices[0],state(80,10)),false);
 assert.equal(choiceAvailable(next.nodes.start_node.choices[1],state(0,21)),true);
 assert.equal(choiceAvailable(next.nodes.start_node.choices[2],state(0,0)),true);
 assert.deepEqual(next.nodes.start_node.choices[0].statModifiers,{trust:3});
 assert.equal(original.nodes.start_node.choices[0].statRequirements,undefined);
});
test('contradictory gates and unknown stats are rejected without changing the game',()=>{
 const original=game(),before=structuredClone(original);
 assert.throws(()=>saveOutcomeGate(original,'start_node',0,{statRequirements:{trust:80},statRequirementsMax:{trust:50}}),/tối thiểu/);
 assert.throws(()=>saveOutcomeGate(original,'start_node',0,{requiresFlag:'x',requiresFlagAbsent:'x'}),/vừa/);
 assert.throws(()=>saveOutcomeGate(original,'start_node',0,{statRequirements:{unknown:1}}),/Không có chỉ số/);
 assert.deepEqual(original,before);
});
test('accumulation explicitly disables vital checks and AI cannot turn them back on',()=>{
 const original=game();original.meta.statsConfig[0].isVital=true;
 const next=saveOutcomeMode(original,'accumulation',original.meta.statsConfig,'Kết thúc lượt','Thử lại');
 assert.equal(next.meta.statsConfig.some(s=>s.isVital),false);
 assert.equal(next.meta.gameOverText,'Thử lại');
 const result={title:'Test',playerName:'An',bible:'Tình cảm',suggestions:'',stats:['trust','scandal'].map(key=>({key,label:key,initial:0,isVital:true,deathThreshold:10}))};
 assert.equal(applySetup(next,result).meta.statsConfig.some(s=>s.isVital),false);
 assert.match(workshopPrompt(next,null,''),/mọi chỉ số phải isVital=false/);
 assert.throws(()=>saveOutcomeMode(original,'survival',original.meta.statsConfig,'',''),/ngưỡng thua/);
});
test('outcome audit includes unguarded, unreachable, dice and potentially blocked routes',()=>{
 let next=game();
 next.nodes.he.combat={winTarget:'be'};
 next.nodes.start_node.choices[0].diceRoll={successTarget:'he',failTarget:'be'};
 assert.equal(endingEntries(next,'he')[0].special,true);
 assert.ok(outcomeWarnings(next).some(w=>w.includes('xúc xắc')));
 delete next.nodes.start_node.choices[0].diceRoll;
 next.nodes.start_node.choices.forEach(c=>{c.statRequirements={trust:1};});
 assert.ok(outcomeWarnings(next).some(w=>w.includes('mọi đáp án')));
 next.nodes.lonely={id:'lonely',isEnding:true,choices:[]};
 assert.ok(outcomeWarnings(next).some(w=>w.includes('lonely: chưa có đường')));
});
