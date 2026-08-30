import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKSHOP_TYPES, makeWorkshopTemplate, applySetup, applyWriting, addSceneChain, removeWorkshopScene, selectedScopes, workshopPrompt, orderedWritingKeys } from '../src/lib/gameStudio/aiMindMap.js';
import { buildMindMap, gameFromMindMap } from '../src/lib/gameStudio/mindMap.js';
const base = { meta: { title: 'Original', statsConfig: [], initialStats: {} }, nodes: {} };
const setup = { title: 'Game', playerName: 'An', bible: 'Bối cảnh và mục tiêu', stats: [{ key: 'capital', label: 'Vốn', initial: 100, isVital: true, deathThreshold: 0 }], primaryStat: 'capital', ranks: ['Tú nữ', 'Phi'], eras: [{ at: 1, label: 'Khởi nghiệp', bonus: 0 }, { at: 6, label: 'Mở rộng', bonus: 20 }], suggestions: '' };
const ready = (type = 'rebirth') => applySetup(makeWorkshopTemplate(base, type), setup);
const response = (game, keys) => ({ entries: selectedScopes(game, keys).map((s) => ({ key: s.key, text: s.choiceIndex === null ? `Nội dung ${s.id}` : '', speaker: '', systemTitle: '', systemText: '', choices: s.choiceIndexes.map((index) => ({ index, text: `Quyết định ${index}`, modifiers: [{ key: 'capital', value: 1 }] })) })), suggestions: '' });
test('all five templates have complete connections, five converging scenes and four distinct endings', () => {
  for (const type of Object.keys(WORKSHOP_TYPES)) {
    const game = makeWorkshopTemplate(base, type);
    assert.equal(Object.keys(game.nodes).length, 15);
    assert.equal(buildMindMap(game.nodes).errors.length, 0);
    for (let i = 1; i <= 5; i++) assert.deepEqual(new Set(game.nodes[`scene_${i}`].choices.map((c) => c.targetNodeId)), new Set([`scene_${i + 1}`]));
    assert.equal(new Set(game.nodes.scene_6.choices.map((c) => c.targetNodeId)).size, 4);
    assert.throws(() => gameFromMindMap(game), /chưa viết nội dung/);
  }
  assert.equal(Object.keys(base.nodes).length, 0);
});
test('setup supplies genre mechanics and refuses unsafe starting scores or removed keys', () => {
  assert.equal(ready().meta.rebirth.moneyStat, 'capital');
  assert.deepEqual(ready('palace').meta.palace.ranks, setup.ranks);
  assert.throws(() => applySetup(ready(), { ...setup, stats: [{ ...setup.stats[0], initial: 0 }] }), /Điểm ban đầu/);
  assert.throws(() => applySetup(ready(), { ...setup, stats: [{ ...setup.stats[0], key: 'other' }] }), /Không được bỏ/);
});
test('AI only fills selected scopes and cannot change links, gates, dice, or scene count', () => {
  const game = ready();
  Object.assign(game.nodes.scene_1.choices[0], { requiresFlag: 'met', diceRoll: { stat: 'capital', difficulty: 5, successTarget: 'scene_2', failTarget: 'scene_1' } });
  const before = structuredClone(game), keys = ['scene:scene_1'];
  const result = response(game, keys);
  Object.assign(result.entries[0], { id: 'evil', isEnding: true });
  result.entries[0].choices[0].targetNodeId = 'ending_1';
  const updated = applyWriting(game, keys, result);
  assert.deepEqual(game, before);
  assert.deepEqual(Object.keys(updated.nodes), Object.keys(game.nodes));
  assert.deepEqual(updated.nodes.scene_2, game.nodes.scene_2);
  assert.equal(updated.nodes.scene_1.isEnding, undefined);
  assert.equal(updated.nodes.scene_1.choices[0].targetNodeId, 'scene_2');
  assert.equal(updated.nodes.scene_1.choices[0].requiresFlag, 'met');
  assert.deepEqual(updated.nodes.scene_1.choices[0].diceRoll, game.nodes.scene_1.choices[0].diceRoll);
});
test('choice-only generation preserves scene prose and sibling choices; scene selection deduplicates its choices', () => {
  const game = ready(), keys = ['choice:scene_1:1'];
  const next = applyWriting(game, keys, response(game, keys));
  assert.equal(next.nodes.scene_1.text, game.nodes.scene_1.text);
  assert.deepEqual(next.nodes.scene_1.choices[0], game.nodes.scene_1.choices[0]);
  assert.equal(selectedScopes(game, [...keys, 'scene:scene_1']).length, 1);
});
test('malformed AI output is rejected atomically', () => {
  const game = ready(), keys = ['scene:scene_1'];
  for (const mutate of [r => r.entries.push(r.entries[0]), r => r.entries[0].choices.pop(), r => r.entries[0].choices[0].index = 8, r => r.entries[0].choices[0].modifiers[0].key = 'unknown', r => r.entries[0].choices[0].modifiers[0].value = NaN, r => r.entries[0].text = '', r => r.entries[0].key = 'scene:scene_2']) {
    const result = response(game, keys); mutate(result);
    assert.throws(() => applyWriting(game, keys, result));
    assert.equal(game.nodes.scene_1.text, '');
  }
});
test('structural editing supports chains and leaves deleted scene references visible for QA', () => {
  const game = ready();
  const added = addSceneChain(game, 'scene_1', 5, 4);
  assert.equal(added.game.nodes.scene_1.choices.length, 5);
  const first = added.game.nodes[added.firstId];
  assert.equal(new Set(first.choices.map(c => c.targetNodeId)).size, 1);
  const deleted = removeWorkshopScene(added.game, added.firstId);
  assert.ok(buildMindMap(deleted.nodes).errors.length);
  assert.throws(() => removeWorkshopScene(game, 'start_node'));
  assert.throws(() => addSceneChain(game, '', 0, 4));
});
test('finished canonical graph rebuild preserves all nodes and genre settings without parsing', () => {
  const game = ready(), keys = Object.keys(game.nodes).map(id => `scene:${id}`);
  const written = applyWriting(game, keys, response(game, keys));
  const built = gameFromMindMap(written);
  assert.deepEqual(built.nodes, written.nodes);
  assert.deepEqual(built.meta.rebirth, written.meta.rebirth);
  assert.equal(built.meta.mindMapRevision, 1);
});
test('prompt includes all edited context and rejects oversized input instead of silently dropping scenes', () => {
  const game = ready(); game.nodes.ending_4.text = 'Thông tin ở cuối truyện';
  assert.match(workshopPrompt(game, ['scene:scene_1']), /Thông tin ở cuối truyện/);
  game.nodes.ending_4.text = 'a'.repeat(240001);
  assert.throws(() => workshopPrompt(game, ['scene:scene_1']), /quá dài/);
});
test('deleted IDs are never reused by newly added scenes, so orphan links cannot silently attach elsewhere', () => {
  const game = ready();
  const deleted = removeWorkshopScene(game, 'scene_6');
  const { game: next, firstId } = addSceneChain(deleted, '', 1, 0);
  assert.notEqual(firstId, 'scene_6');
  assert.equal(next.nodes.scene_5.choices[0].targetNodeId, 'scene_6');
  assert.ok(buildMindMap(next.nodes).errors.length);
});
test('NPC templates retain route cards and fill only their character text', () => {
  const game = ready('npc'), keys = ['scene:scene_6'];
  const result = response(game, keys);
  result.entries[0].choices.forEach((c, i) => { c.npcName = `Nhân vật ${i}`; c.npcTagline = 'Bí mật riêng'; });
  const next = applyWriting(game, keys, result);
  assert.equal(next.nodes.scene_6.choices[0].npcCard.name, 'Nhân vật 0');
  assert.equal(next.nodes.scene_6.choices[0].targetNodeId, 'branch_1');
  assert.equal(next.nodes.scene_1.choices[0].npcCard, undefined);
});
test('system messages are restricted to system workshop and do not alter other mechanics', () => {
  const game = ready('system'), keys = ['scene:scene_1'];
  const result = response(game, keys);
  Object.assign(result.entries[0], { systemTitle: 'Nhiệm vụ', systemText: 'Hãy khám phá thế giới' });
  assert.equal(applyWriting(game, keys, result).nodes.scene_1.systemPopup.text, 'Hãy khám phá thế giới');
  assert.equal(applyWriting(ready(), keys, result).nodes.scene_1.systemPopup, undefined);
});
test('consequence prompts describe incoming decision and application rejects extra continuation rewards', () => {
 const game=ready(); game.nodes.scene_2.workshopRole='consequence'; game.nodes.scene_2.choices=[{text:'Tiếp tục',targetNodeId:'scene_3',statModifiers:{},workshopContinuation:true}];
 game.nodes.scene_1.choices[0].text='Giúp cô ấy';
 const prompt=workshopPrompt(game,['scene:scene_2']);
 assert.match(prompt,/Vai trò cảnh hệ quả/);assert.match(prompt,/choiceText":"Giúp cô ấy/);assert.match(prompt,/effectsAlreadyApplied/);
 const result=response(game,['scene:scene_2']);
 assert.throws(()=>applyWriting(game,['scene:scene_2'],result),/không được tự thêm điểm/);
 result.entries[0].choices[0].modifiers=[];
 assert.equal(applyWriting(game,['scene:scene_2'],result).nodes.scene_2.choices[0].targetNodeId,'scene_3');
});

test('batch writing orders source scenes before their consequences even when selected backwards', () => {
 const game=ready();
 assert.deepEqual(orderedWritingKeys(game,['scene:scene_3','scene:scene_2','scene:scene_1']),['scene:scene_1','scene:scene_2','scene:scene_3']);
 game.nodes.scene_3.choices[0].targetNodeId='scene_1';
 assert.equal(new Set(orderedWritingKeys(game,['scene:scene_3','scene:scene_2','scene:scene_1'])).size,3);
});

test('ordinary stats can start at zero without a death threshold; vital stats remain guarded', () => {
 const game=makeWorkshopTemplate(base,'studio',true);
 for (const deathThreshold of [null,undefined]) {
  const next=applySetup(game,{...setup,stats:[{key:'trust',label:'Tin tưởng',initial:0,isVital:false,deathThreshold}]});
  assert.equal(next.meta.statsConfig[0].deathThreshold,0);
  assert.equal(next.meta.initialStats.trust,0);
 }
 assert.throws(()=>applySetup(game,{...setup,stats:[{key:'trust',label:'Tin tưởng',initial:0,isVital:true,deathThreshold:0}]}),/Tin tưởng.*thua ngay/);
});

test('invalid AI starting score can be reviewed but cannot be applied until corrected', async () => {
 const {setupReviewError}=await import('../src/lib/gameStudio/aiMindMap.js');
 const game=makeWorkshopTemplate(base,'studio',true);
 const result={...setup,stats:[{key:'trust',label:'Tin tưởng',initial:0,isVital:true,deathThreshold:0}]};
 const before=structuredClone(result);
 assert.match(setupReviewError(game,result),/thua ngay/);
 assert.deepEqual(result,before);
 assert.throws(()=>applySetup(game,result),/thua ngay/);
 result.stats[0].isVital=false;
 assert.equal(setupReviewError(game,result),'');
 assert.equal(applySetup(game,result).meta.aiWorkshop.setupApproved,true);
 assert.throws(()=>setupReviewError(game,{...before,bible:''}),/bối cảnh thống nhất/);
});
