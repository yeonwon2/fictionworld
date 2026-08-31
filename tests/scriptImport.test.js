import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectScriptImport,applyScriptImport,importRepairPrompt,applyImportRepairs} from '../src/lib/gameStudio/scriptImport.js';
import {resolveAutomaticEnding} from '../src/lib/gameStudio/automaticEnding.js';
import {gameFromMindMap} from '../src/lib/gameStudio/mindMap.js';

const base=()=>({meta:{statsConfig:[]},nodes:{start_node:{id:'start_node',text:'Cũ',choices:[]}}});
test('complete local import can be played without an AI setup; genuine unapproved AI setups remain blocked',()=>{
 const blank=base();blank.nodes.start_node.text='';
 const imported=applyScriptImport(blank,inspectScriptImport(blank,fixture()),'start_node').game;
 assert.equal(Object.keys(gameFromMindMap(imported).nodes).length,157);
 for(const workspace of [{type:'studio'},{setupApproved:false}]){
  const pending=structuredClone(imported);pending.meta.aiWorkshop={...pending.meta.aiWorkshop,...workspace};
  assert.throws(()=>gameFromMindMap(pending),/duyệt bối cảnh/);
 }
});
function fixture(){
 const lines=['Thể loại: Tu chân','Chỉ số khởi đầu: Điểm = 50, Tình A = 30, Tình B = 10','Chỉ số sinh tử: Điểm < 60 khi kết thúc Đại điển','GIỚI THIỆU','Lời dẫn giữ nguyên.','→ Hệ thống: Chào mừng.'];
 for(let scene=1;scene<=30;scene++){
  lines.push(`CẢNH ${scene} — ${scene===30?'Đại điển':`Cảnh ${scene}`}`,`Lời cảnh ${scene}.`);
  for(let j=0;j<4;j++)lines.push(`${'ABCD'[j]} — Lựa chọn ${j}\nlời đáp án dòng hai.`,`→ Điểm ${j===3?'0':'+3'}`,`→ Đến cảnh ${scene}0${j+1}`);
  for(let j=0;j<4;j++)lines.push(`CẢNH ${scene}0${j+1} — DIỄN BIẾN ${scene}${'ABCD'[j]}`,`Hệ quả ${scene}/${j}.`,'A — Tiếp tục',scene===30?'→ Kết thúc theo chỉ số':`→ Đến cảnh ${scene+1}`);
 }
 const rules=[['bad','BAD_END',['Điểm < 60']],['a','TRUE_END',['Điểm ≥ 60','Tình A < 75','Tình B < 75']],['b','TRUE_END',['Điểm ≥ 60','Tình A ≥ 75','Tình B < 75']],['c','TRUE_END',['Điểm ≥ 60','Tình A < 75','Tình B ≥ 75']],['d','TRUE_END',['Điểm ≥ 60','Tình A ≥ 75','Tình B ≥ 75']]];
 for(const [id,type,conditions] of rules)lines.push(`KẾT THÚC ${id} — Lời kết ${id} [${type}]`,'Điều kiện:',...conditions,`Nguyên văn lời kết ${id}.`);
 return lines.join('\n');
}
test('imports 157 nodes and all five multi-stat endings locally without rewriting prose',()=>{
 const game=base(),before=structuredClone(game),report=inspectScriptImport(game,fixture());
 assert.deepEqual(report.issues,[]);assert.equal(report.plan.nodes.length,157);
 assert.equal(report.plan.nodes.find(n=>n.id==='new_import_s_1').choices[0].text,'Lựa chọn 0\nlời đáp án dòng hai.');
 assert.equal(report.plan.nodes.filter(n=>n.role==='consequence').length,120);
 const result=applyScriptImport(game,report,'start_node');assert.deepEqual(game,before);
 assert.ok(result.game.nodes.start_node.choices[0].targetNodeId);
 assert.ok(result.game.meta.statsConfig.every(s=>!s.isVital));
 const router=Object.values(result.game.nodes).find(n=>n.automaticEnding);
 for(const diem of [0,50,59,60,100])for(const tinh_a of [74,75,100])for(const tinh_b of [74,75,100]){
  const id=resolveAutomaticEnding(result.game.nodes,router,{stats:{diem,tinh_a,tinh_b}});
  const expected=diem<60?'bad':tinh_a<75?(tinh_b<75?'a':'c'):(tinh_b<75?'b':'d');
  assert.equal(result.game.nodes[id].text,`Nguyên văn lời kết ${expected}.`);
 }
 assert.equal(result.game.nodes[result.firstId].text,'Lời dẫn giữ nguyên.\n→ Hệ thống: Chào mừng.');
});
test('blocks missing/duplicate destinations, unsupported effects, unknown initial scores and ambiguous endings',()=>{
 for(const source of [
  fixture().replace('→ Đến cảnh 101','→ Đến cảnh nowhere'),
  fixture().replace('→ Đến cảnh 101','→ Đến cảnh 101\n→ Đến cảnh 102'),
  fixture().replace('→ Điểm +3','→ Tung xúc xắc 2D6'),
  fixture().replace('Chỉ số khởi đầu: Điểm = 50, Tình A = 30, Tình B = 10','Chỉ số khởi đầu: Tình A = 30, Tình B = 10'),
  fixture().replace('Điểm < 60\nNguyên văn','Điểm < 61\nNguyên văn'),
  fixture().replace('CẢNH 101 —','CẢNH 1 —'),
 ]){const report=inspectScriptImport(base(),source);assert.ok(report.issues.length);assert.throws(()=>applyScriptImport(base(),report),/Còn lỗi/);}
});
test('new empty workshop reuses its opening, and a wrong time checkpoint cannot silently move the death rule',()=>{
 const game=base();game.nodes.start_node.text='';
 const report=inspectScriptImport(game,fixture()),result=applyScriptImport(game,report,'start_node');
 assert.equal(Object.keys(result.game.nodes).length,157);
 assert.equal(result.firstId,'start_node');
 assert.match(result.game.nodes.start_node.text,/Lời dẫn giữ nguyên/);
 for(const n of Object.values(result.game.nodes))for(const c of n.choices)assert.ok(result.game.nodes[c.targetNodeId]);
 assert.equal(game.nodes.start_node.text,'');
 const wrong=inspectScriptImport(game,fixture().replace('khi kết thúc Đại điển','khi kết thúc Cảnh 1'));
 assert.ok(wrong.issues.some(i=>i.message.includes('mốc xét')));
});
test('never rounds strict fractional gates or silently treats OR as AND',()=>{
 const decimal=inspectScriptImport(base(),fixture().replace('→ Điểm +3','→ Điểm +0.5'));
 assert.ok(decimal.issues.some(i=>i.message.includes('thập phân')));
 const or=inspectScriptImport(base(),fixture().replace('Tình A < 75\nTình B < 75','Tình A < 75 OR Tình B < 75'));
 assert.ok(or.issues.some(i=>i.message.includes('Chưa hiểu điều kiện')));
});
test('reuse existing score defaults and do not overwrite existing source branches',()=>{
 const game=base();game.meta.statsConfig=[{key:'diem',label:'Điểm',default:88,isVital:false}];
 const source='SCENE 1 — Test\nVăn bản.\nA — Chọn\n→ Điểm +2\n→ Kết thúc good\nENDING good [GOOD_END]\nKết.';
 const report=inspectScriptImport(game,source);assert.deepEqual(report.issues,[]);assert.equal(report.plan.stats[0].initial,88);
 game.nodes.start_node.choices=[{text:'Cũ',targetNodeId:'old'}];
 assert.throws(()=>applyScriptImport(game,report,'start_node'),/không ghi đè/);
});
test('AI repairs only eligible physical lines and never receives full story prose',()=>{
 const source=fixture().replace('→ Điểm +3','→ Tăng Điểm lên 3 đơn vị');
 const report=inspectScriptImport(base(),source),line=report.issues.find(i=>i.repairable).line;
 const prompt=importRepairPrompt(report);assert.ok(!prompt.includes('Nguyên văn lời kết'));assert.ok(prompt.includes('Tăng Điểm'));
 const response={summary:'Chuẩn hóa delta',questions:[],patches:[{line,replacement:'→ Điểm +3'}]};
 const repaired=applyImportRepairs(report,response);assert.equal(repaired,fixture());assert.deepEqual(inspectScriptImport(base(),repaired).issues,[]);
 assert.throws(()=>applyImportRepairs(report,{...response,patches:[{line:1,replacement:'→ Điểm +999'}]}),/ngoài phạm vi/);
 assert.throws(()=>applyImportRepairs(report,{...response,patches:[{line,replacement:'CẢNH 999 — Chèn thêm'}]}),/không được chèn/);
 assert.throws(()=>applyImportRepairs(report,{...response,patches:[response.patches[0],response.patches[0]]}),/trùng/);
});
