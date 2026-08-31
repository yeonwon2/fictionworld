import test from 'node:test';
import assert from 'node:assert/strict';
import {branchScope,exportBranch,reviewBranch,applyBranch} from '../src/lib/gameStudio/branchExchange.js';
const fixture=()=>({meta:{title:'Nhánh thử',initialStats:{trust:0}},nodes:{start_node:{text:'Mở',choices:[{text:'A',targetNodeId:'a'},{text:'B',targetNodeId:'b'}]},a:{text:'A riêng',choices:[{text:'Hội tụ',targetNodeId:'end',statModifiers:{trust:2}},{text:'Vòng',targetNodeId:'a'},{text:'Quay lại',targetNodeId:'start_node'}],systemPopup:{title:'Hệ thống',text:'Xin chào'}},b:{text:'B riêng',choices:[{text:'Tiếp',targetNodeId:'end'}]},end:{text:'Kết thúc chung',isEnding:true,choices:[]}}});
const root={sceneId:'start_node',choiceIndex:0};
test('branch includes descendants once, excludes sibling, identifies shared ending and keeps back links',()=>{
 assert.deepEqual(branchScope(fixture(),root),{ids:['a','end'],shared:['end'],missing:[]});
});
test('roundtrip is lossless; edits preserve all mechanics, sibling and source nodes',async()=>{
 const game=fixture(),doc=await exportBranch(game,root);
 assert.equal((await reviewBranch(game,JSON.stringify(doc))).changes.length,0);
 doc.scenes[0].node.text='Nội dung mới\nCó "dấu ngoặc" và tiếng Việt';doc.scenes[0].node.systemPopup.text='Thông báo mới';
 const {game:next}=await applyBranch(game,JSON.stringify(doc));
 assert.deepEqual(next.nodes.b,game.nodes.b);assert.deepEqual(next.nodes.start_node,game.nodes.start_node);assert.deepEqual(next.nodes.a.choices,game.nodes.a.choices);
 assert.equal(next.nodes.a.text,doc.scenes[0].node.text);assert.equal(game.nodes.a.text,'A riêng');
});
test('shared edits require explicit consent; protected fields cannot bypass validation',async()=>{
 const game=fixture(),doc=await exportBranch(game,root);doc.scenes[1].node.text='Chung mới';
 await assert.rejects(reviewBranch(game,JSON.stringify(doc)),/dùng chung/);
 assert.equal((await applyBranch(game,JSON.stringify(doc),true)).game.nodes.end.text,'Chung mới');
 doc.scenes[1].shared=false;await assert.rejects(reviewBranch(game,JSON.stringify(doc)),/bảo vệ/);
});
test('rejects missing, duplicate, foreign IDs, deleted content, changed edges and stale games atomically',async()=>{
 const game=fixture(),original=JSON.stringify(game);
 const mutations=[d=>d.scenes.pop(),d=>d.scenes.push(d.scenes[0]),d=>d.scenes[1].id='b',d=>d.scenes[0].node.choices[0].targetNodeId='b',d=>delete d.scenes[0].node.text,d=>d.scenes[0].node.choices[0].statModifiers.trust=500];
 for(const mutate of mutations){const doc=await exportBranch(game,root);mutate(doc);await assert.rejects(applyBranch(game,JSON.stringify(doc)));assert.equal(JSON.stringify(game),original);}
 const doc=await exportBranch(game,root);game.nodes.b.text='Đã sửa';await assert.rejects(applyBranch(game,JSON.stringify(doc)),/đã thay đổi/);
});
test('dice and combat paths, missing targets and multiple subbranches are preserved',()=>{
 const game=fixture();game.nodes.a.choices=[{text:'Dice',diceRoll:{successTarget:'x',failTarget:'y'}}];game.nodes.x={text:'X',combat:{winTarget:'end',loseTarget:'lose',fleeTarget:'missing'}};game.nodes.y={text:'Y',choices:[]};game.nodes.lose={isEnding:true,text:'Thua'};
 const scope=branchScope(game,root);assert.deepEqual(scope.ids,['a','x','y','end','lose']);assert.deepEqual(scope.missing,['missing']);
});

import {exportBranchScript} from '../src/lib/gameStudio/branchExchange.js';
test('readable script supports multiline prose, dialogue quotes, choices and system messages without JSON escaping',async()=>{
 const game=fixture(),script=await exportBranchScript(game,root);
 assert.match(script,/### Lời truyện/);assert.match(script,/Đi tới: end/);assert.match(script,/Thay đổi điểm/);
 const edited=script.replace('\nA riêng\n','\nCô nói: "Chào em."\n\nMột đoạn mới.\n').replace('\nHội tụ\n','\nCùng đi tiếp\n').replace('\nXin chào\n','\nNhiệm vụ đã mở\n');
 const {game:next,changes}=await applyBranch(game,edited);
 assert.equal(changes.length,3);assert.equal(next.nodes.a.text,'Cô nói: "Chào em."\n\nMột đoạn mới.');assert.equal(next.nodes.a.choices[0].text,'Cùng đi tiếp');assert.equal(next.nodes.a.choices[0].targetNodeId,'end');assert.deepEqual(next.nodes.b,game.nodes.b);
 assert.equal((await reviewBranch(game,script)).changes.length,0);
});
test('script rejects missing markers, extra scenes, modified links, shared edits and stale input',async()=>{
 const game=fixture(),script=await exportBranchScript(game,root);
 for(const bad of [script.replace('<!-- /FW-TEXT -->',''),script.replace('Đi tới: end','Đi tới: b'),script+'\n## CẢNH khác',script.replace('["a","text"]','["b","text"]')])await assert.rejects(applyBranch(game,bad));
 const shared=script.replace('\nKết thúc chung\n','\nKết thúc mới\n');await assert.rejects(applyBranch(game,shared),/dùng chung/);assert.equal((await applyBranch(game,shared,true)).game.nodes.end.text,'Kết thúc mới');
 game.nodes.b.text='Sửa bên ngoài';await assert.rejects(applyBranch(game,script),/đã thay đổi/);
});
test('script preserves CRLF content and accepts an outer markdown fence',async()=>{
 const game=fixture();game.nodes.a.text='A\r\nB';const script=await exportBranchScript(game,root);
 assert.equal((await reviewBranch(game,'```markdown\n'+script+'\n```')).changes.length,0);
 assert.equal((await reviewBranch(game,script.replace(/\r?\n/g,'\r\n'))).changes.length,0);
});
