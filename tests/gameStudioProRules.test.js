import test from 'node:test';
import assert from 'node:assert/strict';

import {
  newEmptyRegistry,
  addStatEntity,
  addRelationshipEntity,
  addFlagEntity,
  addItemEntity,
  resolveEntity,
  findRelationshipNpcCollisions,
  ensureRegistry,
  ENTITY_KINDS,
} from '../src/lib/gameStudioPro/entityRegistry.js';
import {
  CONDITION_TYPES,
  EFFECT_TYPES,
  negateOperator,
  statCompare,
  flagPresent,
  explainCondition,
  explainEffect,
} from '../src/lib/gameStudioPro/ruleModel.js';
import {
  parseConditionsDeterministic,
  parseEffectsDeterministic,
  normalizeAIRuleClauses,
} from '../src/lib/gameStudioPro/ruleParser.js';
import { validateChoiceRules, validateBlueprintRules } from '../src/lib/gameStudioPro/ruleValidator.js';
import {
  SCENE_ROLES,
  newSceneBlueprint,
  addScene,
  addChoice,
  updateChoice,
  connectChoice,
  addEnding,
  findScene,
  setRegistry,
  newOutcomeBranch,
} from '../src/lib/gameStudioPro/blueprintModel.js';
import { validateSceneBlueprint } from '../src/lib/gameStudioPro/blueprintValidator.js';
import { compileEpisodeBlueprint } from '../src/lib/gameStudioPro/proCompiler.js';
import { choiceAvailable, buildRoutes } from '../src/lib/gameStudio/routeExplorer.js';
import { gameOverReasons } from '../src/lib/gameStudio/playerState.js';
import { newBlankEpisode } from '../src/lib/gameStudioPro/plannerModel.js';

function makeEpisode() {
  return { ...newBlankEpisode(1), id: 'ep_rules1', title: 'Tập luật' };
}

// ---------- Entity registry ----------

test('resolveEntity matches exactly and fuzzily (diacritics/case/whitespace tolerant)', () => {
  let r = newEmptyRegistry();
  r = addStatEntity(r, { displayName: 'Uy tín', default: 10 });
  assert.equal(resolveEntity(r, 'stat', 'Uy tín').status, 'matched');
  assert.equal(resolveEntity(r, 'stat', 'uy tin').status, 'matched');
  assert.equal(resolveEntity(r, 'stat', '  UY TÍN  ').status, 'matched');
  assert.equal(resolveEntity(r, 'stat', 'điểm uy tín').status, 'matched'); // chứa nhau -> khớp gần đúng duy nhất
});

test('resolveEntity reports ambiguous when 2+ near matches (neither an exact match), not_found when none', () => {
  let r = newEmptyRegistry();
  r = addStatEntity(r, { displayName: 'Uy tín Vương phi' });
  r = addStatEntity(r, { displayName: 'Uy tín Hoàng thất' });
  const amb = resolveEntity(r, 'stat', 'uy tín');
  assert.equal(amb.status, 'ambiguous');
  assert.equal(amb.candidates.length, 2);
  assert.equal(resolveEntity(r, 'stat', 'Danh vọng').status, 'not_found');
});

test('resolveEntity never silently creates a new entity (registry unaffected)', () => {
  let r = newEmptyRegistry();
  r = addStatEntity(r, { displayName: 'Uy tín' });
  const before = JSON.stringify(r);
  resolveEntity(r, 'stat', 'Danh vọng');
  assert.equal(JSON.stringify(r), before);
});

test('relationship entities carry a separate npc key from the display label', () => {
  let r = newEmptyRegistry();
  r = addRelationshipEntity(r, { displayName: 'Sủng ái Lệ Phi', npc: 'Lệ Phi' });
  const e = r.stats[0];
  assert.equal(e.kind, ENTITY_KINDS.RELATIONSHIP);
  assert.equal(e.displayName, 'Sủng ái Lệ Phi');
  assert.equal(e.npc, 'Lệ Phi');
});

test('findRelationshipNpcCollisions warns when two relationship entities target the same NPC', () => {
  let r = newEmptyRegistry();
  r = addRelationshipEntity(r, { displayName: 'Sủng ái Lệ Phi', npc: 'Lệ Phi' });
  r = addRelationshipEntity(r, { displayName: 'Ghen ghét Lệ Phi', npc: 'Lệ Phi' });
  assert.equal(findRelationshipNpcCollisions(r).length, 1);
  assert.equal(findRelationshipNpcCollisions(r)[0].length, 2);
});

test('ensureRegistry returns a valid empty registry for pre-PRO-3 blueprints', () => {
  assert.deepEqual(ensureRegistry({}), newEmptyRegistry());
  assert.deepEqual(ensureRegistry(null), newEmptyRegistry());
});

// ---------- Deterministic condition parser ----------

function reg() {
  let r = newEmptyRegistry();
  r = addStatEntity(r, { displayName: 'Uy tín', default: 10 });
  r = addRelationshipEntity(r, { displayName: 'Sủng ái Lệ Phi', npc: 'Lệ Phi' });
  r = addFlagEntity(r, 'Đã cứu Tiểu Lan');
  r = addItemEntity(r, 'Ngọc bội');
  return r;
}

test('deterministic parser: ">=" phrasing variants all yield the same canonical condition', () => {
  const r = reg();
  for (const text of ['Uy tín >= 20', 'Uy tín từ 20 trở lên', 'Uy tín không dưới 20', 'Uy tín ít nhất 20']) {
    const { items } = parseConditionsDeterministic(text, r);
    assert.equal(items.length, 1, text);
    assert.equal(items[0].status, 'ok', text);
    assert.deepEqual(items[0].condition, statCompare(r.stats[0].id, '>=', 20), text);
  }
});

test('deterministic parser: "dưới" yields "<"', () => {
  const r = reg();
  const { items } = parseConditionsDeterministic('Uy tín dưới 20', r);
  assert.equal(items[0].condition.operator, '<');
  assert.equal(items[0].condition.value, 20);
});

test('deterministic parser: item/flag presence', () => {
  const r = reg();
  assert.equal(parseConditionsDeterministic('có Ngọc bội', r).items[0].condition.type, CONDITION_TYPES.ITEM_PRESENT);
  assert.equal(parseConditionsDeterministic('đã có cờ Đã cứu Tiểu Lan', r).items[0].condition.type, CONDITION_TYPES.FLAG_PRESENT);
  // Câu trần không có động từ vẫn khớp được nếu đúng tên cờ đã đăng ký.
  assert.equal(parseConditionsDeterministic('Đã cứu Tiểu Lan', r).items[0].condition.type, CONDITION_TYPES.FLAG_PRESENT);
});

test('deterministic parser: unresolved entity asks before creating (not silently new)', () => {
  const r = reg();
  const { items } = parseConditionsDeterministic('Danh vọng >= 20', r);
  assert.equal(items[0].status, 'unresolved');
  assert.equal(items[0].text, 'Danh vọng');
});

test('deterministic parser: stat-vs-stat comparison is explicitly unsupported, not silently coerced', () => {
  const r = reg();
  const { items } = parseConditionsDeterministic('Uy tín cao hơn Sủng ái Lệ Phi', r);
  assert.equal(items[0].status, 'unsupported');
  assert.match(items[0].reason, /so sánh/i);
});

test('deterministic parser: OR is flagged unsupported, never silently turned into AND', () => {
  const r = reg();
  const { items, orDetected } = parseConditionsDeterministic('Uy tín >= 20 hoặc có Ngọc bội', r);
  assert.ok(orDetected);
  assert.equal(items[0].status, 'unsupported');
});

test('deterministic parser: AND across multiple clauses produces multiple ok items', () => {
  const r = reg();
  const { items } = parseConditionsDeterministic('Đã cứu Tiểu Lan và Uy tín >= 20', r);
  assert.equal(items.length, 2);
  assert.ok(items.every((i) => i.status === 'ok'));
});

// ---------- Deterministic effect parser ----------

test('deterministic effect parser: stat increase/decrease phrasing', () => {
  const r = reg();
  assert.deepEqual(parseEffectsDeterministic('Uy tín +5', r).items[0].effect.amount, 5);
  assert.deepEqual(parseEffectsDeterministic('tăng 5 Uy tín', r).items[0].effect.amount, 5);
  assert.deepEqual(parseEffectsDeterministic('mất 5 Uy tín', r).items[0].effect.amount, -5);
  assert.deepEqual(parseEffectsDeterministic('Uy tín -5', r).items[0].effect.amount, -5);
});

test('deterministic effect parser: relationship (quan hệ) stat change resolves to the relationship entity', () => {
  const r = reg();
  const { items } = parseEffectsDeterministic('tăng 8 Sủng ái Lệ Phi', r);
  assert.equal(items[0].status, 'ok');
  assert.equal(items[0].effect.amount, 8);
  const rel = r.stats.find((e) => e.kind === ENTITY_KINDS.RELATIONSHIP);
  assert.equal(items[0].effect.entityId, rel.id);
});

test('deterministic effect parser: item grant/remove, "mất X" without a number means remove item', () => {
  const r = reg();
  assert.equal(parseEffectsDeterministic('nhận Ngọc bội', r).items[0].effect.type, EFFECT_TYPES.GRANT_ITEM);
  assert.equal(parseEffectsDeterministic('mất Ngọc bội', r).items[0].effect.type, EFFECT_TYPES.REMOVE_ITEM);
});

test('deterministic effect parser: combined "mất 5 Uy tín và tăng 8 Sủng ái Lệ Phi và nhận Ngọc bội"', () => {
  const r = reg();
  const { items } = parseEffectsDeterministic('mất 5 Uy tín và tăng 8 Sủng ái Lệ Phi và nhận Ngọc bội', r);
  assert.equal(items.length, 3);
  assert.equal(items[0].effect.amount, -5);
  assert.equal(items[1].effect.amount, 8);
  assert.equal(items[2].effect.type, EFFECT_TYPES.GRANT_ITEM);
});

// ---------- AI response normalization (must tolerate malformed input) ----------

test('normalizeAIRuleClauses tolerates garbage without crashing', () => {
  const r = reg();
  assert.deepEqual(normalizeAIRuleClauses(null, r, 'condition'), []);
  assert.deepEqual(normalizeAIRuleClauses({}, r, 'condition'), []);
  assert.deepEqual(normalizeAIRuleClauses({ clauses: 'not an array' }, r, 'condition'), []);
  assert.deepEqual(normalizeAIRuleClauses({ clauses: [null, 42, { kind: 'not_a_real_kind' }] }, r, 'condition'), []);
});

test('normalizeAIRuleClauses resolves a valid clause against the registry', () => {
  const r = reg();
  const items = normalizeAIRuleClauses({ clauses: [{ kind: 'stat_compare', entity: 'Uy tín', operator: '>=', value: 20 }] }, r, 'condition');
  assert.equal(items.length, 1);
  assert.equal(items[0].status, 'ok');
  assert.equal(items[0].condition.value, 20);
});

test('normalizeAIRuleClauses surfaces AI-declared unsupported clauses with a reason, does not guess', () => {
  const r = reg();
  const items = normalizeAIRuleClauses({ clauses: [{ kind: 'unsupported', entity: 'bộ đếm 10 giây', reason: 'timer thời gian thực chưa hỗ trợ' }] }, r, 'condition');
  assert.equal(items[0].status, 'unsupported');
  assert.match(items[0].reason, /timer/);
});

test('normalizeAIRuleClauses rejects a stat_compare with NaN value instead of guessing 0', () => {
  const r = reg();
  const items = normalizeAIRuleClauses({ clauses: [{ kind: 'stat_compare', entity: 'Uy tín', operator: '>=', value: 'not a number' }] }, r, 'condition');
  assert.equal(items[0].status, 'unsupported');
});

// ---------- Rule validator ----------

test('validateChoiceRules errors on a reference to a non-existent entity', () => {
  const r = newEmptyRegistry();
  const choice = { rules: { conditions: [statCompare('stat_missing', '>=', 20)], effects: [] }, conditionalOutcomes: [] };
  const { errors } = validateChoiceRules(choice, r);
  assert.ok(errors.some((e) => /không tồn tại/.test(e)));
});

test('validateChoiceRules errors when two DIFFERENT flags are both required present on one choice (engine has only 1 slot)', () => {
  let r = newEmptyRegistry();
  r = addFlagEntity(r, 'Cờ A');
  r = addFlagEntity(r, 'Cờ B');
  const choice = { rules: { conditions: [flagPresent(r.flags[0].id), flagPresent(r.flags[1].id)], effects: [] }, conditionalOutcomes: [] };
  const { errors } = validateChoiceRules(choice, r);
  assert.ok(errors.some((e) => /chỉ hỗ trợ yêu cầu 1 cờ/.test(e)));
});

test('validateChoiceRules errors when the same flag is required both present and absent', () => {
  let r = newEmptyRegistry();
  r = addFlagEntity(r, 'Cờ A');
  const id = r.flags[0].id;
  const choice = { rules: { conditions: [flagPresent(id), { type: CONDITION_TYPES.FLAG_ABSENT, entityId: id }], effects: [] }, conditionalOutcomes: [] };
  const { errors } = validateChoiceRules(choice, r);
  assert.ok(errors.some((e) => /vừa bắt buộc đã có vừa bắt buộc chưa có/.test(e)));
});

test('validateChoiceRules errors on an impossible min > max stat range', () => {
  let r = newEmptyRegistry();
  r = addStatEntity(r, { displayName: 'Uy tín' });
  const id = r.stats[0].id;
  const choice = { rules: { conditions: [statCompare(id, '>=', 30), statCompare(id, '<=', 10)], effects: [] }, conditionalOutcomes: [] };
  const { errors } = validateChoiceRules(choice, r);
  assert.ok(errors.some((e) => /lớn hơn tối đa/.test(e)));
});

test('validateChoiceRules passes valid, well-formed rules with no errors', () => {
  let r = newEmptyRegistry();
  r = addStatEntity(r, { displayName: 'Uy tín' });
  const id = r.stats[0].id;
  const choice = { rules: { conditions: [statCompare(id, '>=', 20)], effects: [{ type: EFFECT_TYPES.STAT_CHANGE, entityId: id, amount: -5 }] }, conditionalOutcomes: [] };
  const { errors } = validateChoiceRules(choice, r);
  assert.deepEqual(errors, []);
});

test('validateChoiceRules propagates an explicit "unsupported" IR node as an error, never silently drops it', () => {
  let r = newEmptyRegistry();
  const choice = { rules: { conditions: [{ type: CONDITION_TYPES.UNSUPPORTED, raw: 'X hoặc Y', reason: 'OR chưa hỗ trợ' }], effects: [] }, conditionalOutcomes: [] };
  const { errors } = validateChoiceRules(choice, r);
  assert.ok(errors.some((e) => /chưa được hỗ trợ/.test(e)));
});

// ---------- explain (mục 26) ----------

test('explainCondition/explainEffect produce human-readable Vietnamese, no technical field names', () => {
  assert.equal(explainCondition(statCompare('x', '>=', 20), 'Uy tín'), 'Uy tín từ 20');
  assert.equal(explainEffect({ type: EFFECT_TYPES.STAT_CHANGE, amount: -5 }, 'Uy tín'), 'Uy tín -5');
});

test('negateOperator produces exact boolean complements on an integer domain', () => {
  assert.equal(negateOperator('>='), '<');
  assert.equal(negateOperator('<'), '>=');
  assert.equal(negateOperator('>'), '<=');
  assert.equal(negateOperator('<='), '>');
  assert.equal(negateOperator('=='), null); // không có đối lập an toàn ("!=" chưa có field runtime)
});

// ---------- Compiler mapping (choice.rules -> runtime fields) ----------

function blueprintWithRegistry() {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  let r = newEmptyRegistry();
  r = addStatEntity(r, { displayName: 'Uy tín', default: 10 });
  r = addStatEntity(r, { displayName: 'Sinh tồn', default: 100, isVital: true, deathThreshold: 0 });
  r = addRelationshipEntity(r, { displayName: 'Sủng ái Lệ Phi', npc: 'Lệ Phi' });
  r = addFlagEntity(r, 'Đã cứu Tiểu Lan');
  r = addItemEntity(r, 'Ngọc bội');
  bp = setRegistry(bp, r);
  return { episode, bp, r };
}

test('compiler maps a stat condition/effect to statRequirements/statModifiers keyed by the entity id', () => {
  const { bp, r } = blueprintWithRegistry();
  const uyTin = r.stats.find((e) => e.displayName === 'Uy tín');
  let next = addScene(bp, SCENE_ROLES.STORY, { title: 'Kết' });
  const target = next.scenes[1];
  next = addChoice(next, next.startSceneId, { text: 'Đi' });
  const cid = findScene(next, next.startSceneId).choices[0].id;
  next = connectChoice(next, next.startSceneId, cid, 'scene', target.id);
  next = updateChoice(next, next.startSceneId, cid, {
    rules: { conditions: [statCompare(uyTin.id, '>=', 20)], effects: [{ type: EFFECT_TYPES.STAT_CHANGE, entityId: uyTin.id, amount: -5 }] },
  });
  const { nodes, meta } = compileEpisodeBlueprint(next, { title: 't' });
  const compiledChoice = nodes.start_node.choices[0];
  assert.deepEqual(compiledChoice.statRequirements, { [uyTin.id]: 20 });
  assert.deepEqual(compiledChoice.statModifiers, { [uyTin.id]: -5 });
  const statCfg = meta.statsConfig.find((s) => s.key === uyTin.id);
  assert.equal(statCfg.label, 'Uy tín');
  assert.equal(statCfg.default, 10);
  assert.equal(meta.initialStats[uyTin.id], 10);
});

test('compiler maps a relationship condition/effect to requiresNpcAffinity/npcAffinity keyed by the npc name, not the entity id', () => {
  const { bp, r } = blueprintWithRegistry();
  const rel = r.stats.find((e) => e.kind === ENTITY_KINDS.RELATIONSHIP);
  let next = addScene(bp, SCENE_ROLES.STORY, { title: 'Kết' });
  const target = next.scenes[1];
  next = addChoice(next, next.startSceneId);
  const cid = findScene(next, next.startSceneId).choices[0].id;
  next = connectChoice(next, next.startSceneId, cid, 'scene', target.id);
  next = updateChoice(next, next.startSceneId, cid, {
    rules: { conditions: [], effects: [{ type: EFFECT_TYPES.STAT_CHANGE, entityId: rel.id, amount: 8 }] },
  });
  const { nodes, meta } = compileEpisodeBlueprint(next, { title: 't' });
  assert.deepEqual(nodes.start_node.choices[0].npcAffinity, { 'Lệ Phi': 8 });
  // Relationship KHÔNG tạo entry statsConfig — dùng hẳn hệ npcAffinity riêng.
  assert.equal(meta.statsConfig.some((s) => s.key === rel.id), false);
});

test('compiler maps flag/item conditions+effects to the raw display-name string fields the runtime reads', () => {
  const { bp, r } = blueprintWithRegistry();
  const flag = r.flags[0];
  const item = r.items[0];
  let next = addScene(bp, SCENE_ROLES.STORY, { title: 'Kết' });
  const target = next.scenes[1];
  next = addChoice(next, next.startSceneId);
  const cid = findScene(next, next.startSceneId).choices[0].id;
  next = connectChoice(next, next.startSceneId, cid, 'scene', target.id);
  next = updateChoice(next, next.startSceneId, cid, {
    rules: {
      conditions: [{ type: CONDITION_TYPES.FLAG_PRESENT, entityId: flag.id }, { type: CONDITION_TYPES.ITEM_PRESENT, entityId: item.id }],
      effects: [{ type: EFFECT_TYPES.GRANT_FLAG, entityId: flag.id }, { type: EFFECT_TYPES.REMOVE_ITEM, entityId: item.id }],
    },
  });
  const { nodes } = compileEpisodeBlueprint(next, { title: 't' });
  const c = nodes.start_node.choices[0];
  assert.equal(c.requiresFlag, 'Đã cứu Tiểu Lan');
  assert.equal(c.requiresItem, 'Ngọc bội');
  assert.deepEqual(c.grantFlags, ['Đã cứu Tiểu Lan']);
  assert.equal(c.removeItem, 'Ngọc bội');
});

test('compiler is pure — does not mutate the source blueprint', () => {
  const { bp } = blueprintWithRegistry();
  const before = JSON.parse(JSON.stringify(bp));
  compileEpisodeBlueprint(bp, { title: 't' });
  assert.deepEqual(bp, before);
});

test('a pre-PRO-3 blueprint with no registry field still compiles (regression)', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  delete bp.registry; // simulate a blueprint saved before PRO 3
  bp = addChoice(bp, bp.startSceneId, { text: 'Đi' });
  bp = addScene(bp, SCENE_ROLES.ENDING, { title: 'Hết' });
  bp = connectChoice(bp, bp.startSceneId, findScene(bp, bp.startSceneId).choices[0].id, 'scene', bp.scenes[1].id);
  const { meta, nodes } = compileEpisodeBlueprint(bp, { title: 't' });
  assert.deepEqual(meta.statsConfig, []);
  assert.ok(nodes.start_node);
});

// ---------- Conditional outcomes (mục 22, ƯU TIÊN CAO) ----------

test('conditionalOutcomes: 1 branch + auto-negated else compiles to two mutually exclusive structural choices', () => {
  const { bp, r } = blueprintWithRegistry();
  const uyTin = r.stats.find((e) => e.displayName === 'Uy tín');
  let next = addEnding(bp, { title: 'Bị xử tử', tone: 'death' });
  const deathEndingId = next.endings[0].id;
  next = addScene(next, SCENE_ROLES.STORY, { title: 'Tiếp' });
  const nextSceneId = next.scenes[1].id;
  next = addChoice(next, next.startSceneId, { text: 'Phản bác Lệ Phi' });
  const cid = findScene(next, next.startSceneId).choices[0].id;
  // Nhánh: Uy tín < 20 -> ending chết. Base (else): không tự khai điều kiện,
  // hiệu ứng Uy tín-10, đích cảnh tiếp theo — compiler phải tự suy ra "else"
  // là Uy tín >= 20.
  next = updateChoice(next, next.startSceneId, cid, {
    targetType: 'scene',
    targetId: nextSceneId,
    rules: { conditions: [], effects: [{ type: EFFECT_TYPES.STAT_CHANGE, entityId: uyTin.id, amount: -10 }] },
    conditionalOutcomes: [newOutcomeBranch({ conditions: [statCompare(uyTin.id, '<', 20)], targetType: 'ending', targetId: deathEndingId })],
  });
  const { nodes } = compileEpisodeBlueprint(next, { title: 't' });
  const choices = nodes.start_node.choices;
  assert.equal(choices.length, 2);
  const deathBranch = choices.find((c) => c.targetNodeId === deathEndingId);
  const elseBranch = choices.find((c) => c.targetNodeId !== deathEndingId);
  assert.deepEqual(deathBranch.statRequirementsMax, { [uyTin.id]: 19 }); // "<20" trên miền nguyên -> statRequirementsMax 19
  assert.deepEqual(elseBranch.statRequirements, { [uyTin.id]: 20 }); // đối lập tự suy ra: ">=20"
  assert.deepEqual(elseBranch.statModifiers, { [uyTin.id]: -10 });

  // Đúng đặc tả mục 29: Uy tín 19 vs 20 phải cho kết quả khác nhau, loại trừ lẫn nhau.
  const at19 = { stats: { [uyTin.id]: 19 }, items: new Set(), flags: new Set(), npcAffinity: {} };
  const at20 = { stats: { [uyTin.id]: 20 }, items: new Set(), flags: new Set(), npcAffinity: {} };
  assert.equal(choiceAvailable(deathBranch, at19), true);
  assert.equal(choiceAvailable(elseBranch, at19), false);
  assert.equal(choiceAvailable(deathBranch, at20), false);
  assert.equal(choiceAvailable(elseBranch, at20), true);
});

test('conditionalOutcomes: flag_present branch auto-negates to flag_absent for the else branch', () => {
  const { bp, r } = blueprintWithRegistry();
  const flag = r.flags[0];
  let next = addScene(bp, SCENE_ROLES.STORY, { title: 'A' });
  next = addScene(next, SCENE_ROLES.STORY, { title: 'B' });
  const [sceneA, sceneB] = [next.scenes[1], next.scenes[2]];
  next = addChoice(next, next.startSceneId, { text: 'Hành động' });
  const cid = findScene(next, next.startSceneId).choices[0].id;
  next = updateChoice(next, next.startSceneId, cid, {
    targetType: 'scene',
    targetId: sceneB.id,
    conditionalOutcomes: [newOutcomeBranch({ conditions: [{ type: CONDITION_TYPES.FLAG_PRESENT, entityId: flag.id }], targetType: 'scene', targetId: sceneA.id })],
  });
  const { nodes } = compileEpisodeBlueprint(next, { title: 't' });
  const choices = nodes.start_node.choices;
  const withFlag = choices.find((c) => c.targetNodeId === sceneA.id);
  const withoutFlag = choices.find((c) => c.targetNodeId === sceneB.id);
  assert.equal(withFlag.requiresFlag, 'Đã cứu Tiểu Lan');
  assert.equal(withoutFlag.requiresFlagAbsent, 'Đã cứu Tiểu Lan');
});

test('conditionalOutcomes: multiple branches with explicit conditions are compiled as-is (no unsafe auto-negation)', () => {
  const { bp, r } = blueprintWithRegistry();
  const uyTin = r.stats.find((e) => e.displayName === 'Uy tín');
  let next = addEnding(bp, { title: 'Xấu', tone: 'bad' });
  let ending1 = next.endings[0].id;
  next = addEnding(next, { title: 'Tốt', tone: 'good' });
  let ending2 = next.endings[1].id;
  next = addChoice(next, next.startSceneId, { text: 'X' });
  const cid = findScene(next, next.startSceneId).choices[0].id;
  next = updateChoice(next, next.startSceneId, cid, {
    targetType: 'ending',
    targetId: ending1, // else / catch-all
    conditionalOutcomes: [
      newOutcomeBranch({ conditions: [statCompare(uyTin.id, '>=', 50)], targetType: 'ending', targetId: ending2 }),
    ],
  });
  const { nodes } = compileEpisodeBlueprint(next, { title: 't' });
  const choices = nodes.start_node.choices;
  const highBranch = choices.find((c) => c.targetNodeId === ending2);
  const elseBranch = choices.find((c) => c.targetNodeId === ending1);
  assert.deepEqual(highBranch.statRequirements, { [uyTin.id]: 50 });
  // Chỉ 1 nhánh (không phải >1) mới auto-negate — đây đúng ca đó nên vẫn auto áp dụng.
  assert.deepEqual(elseBranch.statRequirementsMax, { [uyTin.id]: 49 });
});

test('validateChoiceRules errors when a conditionalOutcomes branch has no target', () => {
  const r = newEmptyRegistry();
  const choice = { rules: { conditions: [], effects: [] }, conditionalOutcomes: [newOutcomeBranch()] };
  const { errors } = validateChoiceRules(choice, r);
  assert.ok(errors.some((e) => /chưa nối tới cảnh/.test(e)));
});

// ---------- Full mandatory scenario (mục 30) ----------
// Sinh tồn=100 (vital, ngưỡng chết 0), Uy tín=10, Sủng ái Lệ Phi=0 (quan hệ).
// A: "Giúp Tiểu Lan" -> Uy tín+10, set cờ "Đã cứu Tiểu Lan".
// B: "Nhờ Tiểu Lan làm chứng" — chỉ mở nếu có cờ "Đã cứu Tiểu Lan".
// C: "Nhặt Ngọc bội" -> nhận "Ngọc bội".
// D: "Đưa Ngọc bội" — chỉ mở nếu có "Ngọc bội"; hiệu ứng Sủng ái Lệ Phi+8, mất "Ngọc bội".
// E: "Phản bác Lệ Phi" — Uy tín<20 -> Ending "Bị xử tử"; Uy tín>=20 -> Uy tín-10, sang cảnh tiếp.
function buildMandatoryScenario() {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  let r = newEmptyRegistry();
  r = addStatEntity(r, { displayName: 'Sinh tồn', default: 100, isVital: true, deathThreshold: 0 });
  r = addStatEntity(r, { displayName: 'Uy tín', default: 10 });
  r = addRelationshipEntity(r, { displayName: 'Sủng ái Lệ Phi', npc: 'Lệ Phi' });
  r = addFlagEntity(r, 'Đã cứu Tiểu Lan');
  r = addItemEntity(r, 'Ngọc bội');
  bp = setRegistry(bp, r);
  const sinhTon = r.stats.find((e) => e.displayName === 'Sinh tồn');
  const uyTin = r.stats.find((e) => e.displayName === 'Uy tín');
  const relLePhi = r.stats.find((e) => e.kind === ENTITY_KINDS.RELATIONSHIP);
  const flagTieuLan = r.flags[0];
  const itemNgocBoi = r.items[0];

  const sceneA = bp.startSceneId;
  bp = addScene(bp, SCENE_ROLES.STORY, { title: 'B — Nhờ làm chứng' });
  const sceneB = bp.scenes[1].id;
  bp = addScene(bp, SCENE_ROLES.STORY, { title: 'C — Nhặt Ngọc bội' });
  const sceneC = bp.scenes[2].id;
  bp = addScene(bp, SCENE_ROLES.STORY, { title: 'D — Đưa Ngọc bội' });
  const sceneD = bp.scenes[3].id;
  bp = addScene(bp, SCENE_ROLES.STORY, { title: 'E — Phản bác' });
  const sceneE = bp.scenes[4].id;
  bp = addScene(bp, SCENE_ROLES.ENDING, { title: 'Qua ải', intent: 'Sống sót qua yến tiệc.' });
  const finalEnding = bp.scenes[5].id;

  bp = addEnding(bp, { title: 'Bị xử tử', tone: 'death' });
  const deathEndingId = bp.endings[0].id;

  // A: Giúp Tiểu Lan -> Uy tín+10, set cờ, sang B (đủ Uy tín để sống ở E).
  bp = addChoice(bp, sceneA, { text: 'Giúp Tiểu Lan' });
  let cid = findScene(bp, sceneA).choices[0].id;
  bp = connectChoice(bp, sceneA, cid, 'scene', sceneB);
  bp = updateChoice(bp, sceneA, cid, {
    rules: { conditions: [], effects: [{ type: EFFECT_TYPES.STAT_CHANGE, entityId: uyTin.id, amount: 10 }, { type: EFFECT_TYPES.GRANT_FLAG, entityId: flagTieuLan.id }] },
  });
  // Nhánh thay thế: bỏ qua Tiểu Lan hẳn -> thẳng tới E mà không tăng Uy tín,
  // để tuyến "Bị xử tử" (Uy tín<20) THẬT SỰ tồn tại trong đồ thị (không chỉ
  // đúng về luật ở 1 lựa chọn cô lập — buildRoutes() phải đi được tới đó).
  bp = addChoice(bp, sceneA, { text: 'Bỏ qua, không giúp Tiểu Lan' });
  cid = findScene(bp, sceneA).choices[1].id;
  bp = connectChoice(bp, sceneA, cid, 'scene', sceneE);

  // B: Nhờ Tiểu Lan làm chứng — chỉ mở nếu có cờ. Sang C.
  bp = addChoice(bp, sceneB, { text: 'Nhờ Tiểu Lan làm chứng' });
  cid = findScene(bp, sceneB).choices[0].id;
  bp = connectChoice(bp, sceneB, cid, 'scene', sceneC);
  bp = updateChoice(bp, sceneB, cid, { rules: { conditions: [{ type: CONDITION_TYPES.FLAG_PRESENT, entityId: flagTieuLan.id }], effects: [] } });

  // C: Nhặt Ngọc bội -> nhận vật phẩm. Sang D.
  bp = addChoice(bp, sceneC, { text: 'Nhặt Ngọc bội' });
  cid = findScene(bp, sceneC).choices[0].id;
  bp = connectChoice(bp, sceneC, cid, 'scene', sceneD);
  bp = updateChoice(bp, sceneC, cid, { rules: { conditions: [], effects: [{ type: EFFECT_TYPES.GRANT_ITEM, entityId: itemNgocBoi.id }] } });

  // D: Đưa Ngọc bội — chỉ mở nếu có vật phẩm; Sủng ái+8, mất vật phẩm. Sang E.
  bp = addChoice(bp, sceneD, { text: 'Đưa Ngọc bội' });
  cid = findScene(bp, sceneD).choices[0].id;
  bp = connectChoice(bp, sceneD, cid, 'scene', sceneE);
  bp = updateChoice(bp, sceneD, cid, {
    rules: {
      conditions: [{ type: CONDITION_TYPES.ITEM_PRESENT, entityId: itemNgocBoi.id }],
      effects: [{ type: EFFECT_TYPES.STAT_CHANGE, entityId: relLePhi.id, amount: 8 }, { type: EFFECT_TYPES.REMOVE_ITEM, entityId: itemNgocBoi.id }],
    },
  });

  // E: Phản bác Lệ Phi — rẽ nhánh theo Uy tín.
  bp = addChoice(bp, sceneE, { text: 'Phản bác Lệ Phi' });
  cid = findScene(bp, sceneE).choices[0].id;
  bp = updateChoice(bp, sceneE, cid, {
    targetType: 'scene',
    targetId: finalEnding,
    rules: { conditions: [], effects: [{ type: EFFECT_TYPES.STAT_CHANGE, entityId: uyTin.id, amount: -10 }] },
    conditionalOutcomes: [newOutcomeBranch({ conditions: [statCompare(uyTin.id, '<', 20)], targetType: 'ending', targetId: deathEndingId })],
  });

  return { bp, r, ids: { sceneA, sceneB, sceneC, sceneD, sceneE, finalEnding, deathEndingId, uyTin, sinhTon, relLePhi, flagTieuLan, itemNgocBoi } };
}

test('mandatory scenario: structurally valid with zero rule errors', () => {
  const { bp } = buildMandatoryScenario();
  const { errors } = validateSceneBlueprint(bp);
  assert.deepEqual(errors, []);
});

test('mandatory scenario: compiles and both endings are structurally reachable via buildRoutes (real runtime walk)', () => {
  const { bp, ids } = buildMandatoryScenario();
  const { nodes, meta, warnings } = compileEpisodeBlueprint(bp, { title: 'Tập luật bắt buộc' });
  assert.deepEqual(warnings.filter((w) => /Thiếu cảnh/.test(w)), []);
  const { routes } = buildRoutes(nodes, meta.statsConfig);
  const reachedEndings = new Set(routes.filter((rt) => rt.endingId).map((rt) => rt.endingId));
  assert.ok(reachedEndings.has(ids.deathEndingId), 'phải có tuyến tới "Bị xử tử"');
  assert.ok(reachedEndings.has(ids.finalEnding), 'phải có tuyến qua được ải (Uy tín đủ 20)');
});

test('mandatory scenario: flag gate — scene B choice locked until "Giúp Tiểu Lan" was chosen', () => {
  const { bp, ids } = buildMandatoryScenario();
  const { nodes } = compileEpisodeBlueprint(bp, { title: 't' });
  const bChoice = nodes[ids.sceneB].choices[0];
  const withoutFlag = { stats: {}, items: new Set(), flags: new Set(), npcAffinity: {} };
  const withFlag = { stats: {}, items: new Set(), flags: new Set(['Đã cứu Tiểu Lan']), npcAffinity: {} };
  assert.equal(choiceAvailable(bChoice, withoutFlag), false);
  assert.equal(choiceAvailable(bChoice, withFlag), true);
});

test('mandatory scenario: item gate — scene D choice locked until "Ngọc bội" is held, and is consumed by the effect', () => {
  const { bp, ids } = buildMandatoryScenario();
  const { nodes } = compileEpisodeBlueprint(bp, { title: 't' });
  const dChoice = nodes[ids.sceneD].choices[0];
  assert.equal(choiceAvailable(dChoice, { stats: {}, items: new Set(), flags: new Set(), npcAffinity: {} }), false);
  assert.equal(choiceAvailable(dChoice, { stats: {}, items: new Set(['Ngọc bội']), flags: new Set(), npcAffinity: {} }), true);
  assert.equal(dChoice.removeItem, 'Ngọc bội');
  assert.deepEqual(dChoice.npcAffinity, { 'Lệ Phi': 8 });
});

test('mandatory scenario: Uy tín 19 vs 20 boundary at scene E gives different, mutually exclusive outcomes', () => {
  const { bp, ids } = buildMandatoryScenario();
  const { nodes } = compileEpisodeBlueprint(bp, { title: 't' });
  const [branch1, branch2] = nodes[ids.sceneE].choices;
  const deathBranch = [branch1, branch2].find((c) => c.targetNodeId === ids.deathEndingId);
  const surviveBranch = [branch1, branch2].find((c) => c.targetNodeId !== ids.deathEndingId);
  const st = (uyTin) => ({ stats: { [ids.uyTin.id]: uyTin }, items: new Set(), flags: new Set(), npcAffinity: {} });
  assert.equal(choiceAvailable(deathBranch, st(19)), true);
  assert.equal(choiceAvailable(surviveBranch, st(19)), false);
  assert.equal(choiceAvailable(deathBranch, st(20)), false);
  assert.equal(choiceAvailable(surviveBranch, st(20)), true);
  assert.equal(surviveBranch.statModifiers[ids.uyTin.id], -10);
});

test('mandatory scenario: vital stat config reaches game over exactly at the configured threshold', () => {
  const { bp, ids } = buildMandatoryScenario();
  const { meta } = compileEpisodeBlueprint(bp, { title: 't' });
  const sinhTonCfg = meta.statsConfig.find((s) => s.key === ids.sinhTon.id);
  assert.equal(sinhTonCfg.isVital, true);
  assert.equal(sinhTonCfg.deathThreshold, 0);
  assert.deepEqual(gameOverReasons({ [ids.sinhTon.id]: 100 }, meta.statsConfig), []);
  assert.equal(gameOverReasons({ [ids.sinhTon.id]: 0 }, meta.statsConfig).length, 1);
  assert.equal(gameOverReasons({ [ids.sinhTon.id]: -5 }, meta.statsConfig).length, 1);
});

// ---------- Save / reload round-trip (mục 28) ----------

test('save/reload: canonical rules survive a JSON round-trip unchanged, no AI re-parse needed', () => {
  const { bp } = buildMandatoryScenario();
  const roundTripped = JSON.parse(JSON.stringify(bp));
  assert.deepEqual(roundTripped, bp);
  const { errors } = validateSceneBlueprint(roundTripped);
  assert.deepEqual(errors, []);
  const a = compileEpisodeBlueprint(bp, { title: 't' });
  const b = compileEpisodeBlueprint(roundTripped, { title: 't' });
  assert.deepEqual(a.nodes, b.nodes);
  assert.deepEqual(a.meta, b.meta);
});

// ---------- PRO 0/1/2 regression ----------

test('validateBlueprintRules on a blueprint with no rules at all returns no errors (pure PRO 2 blueprints unaffected)', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  bp = addChoice(bp, bp.startSceneId, { text: 'chưa nối' }); // topology issue only, not a rule issue
  const { errors } = validateBlueprintRules(bp, ensureRegistry(bp));
  assert.deepEqual(errors, []);
});
