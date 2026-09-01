import test from 'node:test';
import assert from 'node:assert/strict';

import {
  newEmptyMechanicsState,
  ensureMechanicsState,
  isMechanicEnabled,
  toggleMechanic,
  enableMechanics,
  MECHANIC_IDS,
  MECHANIC_DEFS,
  SUPPORT_LEVELS,
  addCurrencyConfig,
  removeCurrencyConfig,
  addRankConfig,
  addRankLevel,
  removeRankLevel,
  addQuestNote,
  setSystemConfig,
  describeMechanicsForPrompt,
} from '../src/lib/gameStudioPro/mechanicsModel.js';
import { newEmptyRegistry, addStatEntity } from '../src/lib/gameStudioPro/entityRegistry.js';
import { showPopup, EFFECT_TYPES, explainEffect } from '../src/lib/gameStudioPro/ruleModel.js';
import { newEmptyGlobalState, addMilestone, addMilestoneThreshold, removeMilestone } from '../src/lib/gameStudioPro/globalStateModel.js';
import { compileEpisodeBlueprint } from '../src/lib/gameStudioPro/proCompiler.js';
import { validateChoiceRules } from '../src/lib/gameStudioPro/ruleValidator.js';
import {
  newSceneBlueprint,
  addChoice,
  updateChoice,
  connectChoice,
  addEnding,
  findScene,
  setRegistry,
} from '../src/lib/gameStudioPro/blueprintModel.js';
import { newBlankEpisode } from '../src/lib/gameStudioPro/plannerModel.js';

// ---------- Mechanic registry enable/disable/config persistence ----------

test('newEmptyMechanicsState/ensureMechanicsState shape', () => {
  const empty = newEmptyMechanicsState();
  assert.deepEqual(empty.enabled, []);
  assert.deepEqual(empty.configs.currency, []);
  assert.deepEqual(empty.configs.rank, []);
  assert.deepEqual(empty.configs.quest, []);
  assert.deepEqual(empty.configs.system, { name: '', notificationStyle: '' });

  // Dữ liệu cũ/thiếu trường vẫn được chuẩn hoá an toàn.
  assert.deepEqual(ensureMechanicsState(undefined), empty);
  assert.deepEqual(ensureMechanicsState({}).enabled, []);
  assert.deepEqual(ensureMechanicsState({ enabled: ['not_a_real_id', MECHANIC_IDS.CURRENCY] }).enabled, [MECHANIC_IDS.CURRENCY]);
});

test('toggleMechanic enable/disable is idempotent and only touches the given id', () => {
  let m = newEmptyMechanicsState();
  m = toggleMechanic(m, MECHANIC_IDS.CURRENCY, true);
  assert.ok(isMechanicEnabled(m, MECHANIC_IDS.CURRENCY));
  assert.ok(!isMechanicEnabled(m, MECHANIC_IDS.RANK));

  m = toggleMechanic(m, MECHANIC_IDS.RANK, true);
  assert.ok(isMechanicEnabled(m, MECHANIC_IDS.CURRENCY));
  assert.ok(isMechanicEnabled(m, MECHANIC_IDS.RANK));

  m = toggleMechanic(m, MECHANIC_IDS.CURRENCY, false);
  assert.ok(!isMechanicEnabled(m, MECHANIC_IDS.CURRENCY));
  assert.ok(isMechanicEnabled(m, MECHANIC_IDS.RANK));
});

test('enableMechanics is additive (union) — never disables an already-enabled mechanic', () => {
  let m = toggleMechanic(newEmptyMechanicsState(), MECHANIC_IDS.VITAL_STAT, true);
  m = enableMechanics(m, [MECHANIC_IDS.CURRENCY, MECHANIC_IDS.RANK]);
  assert.deepEqual([...m.enabled].sort(), [MECHANIC_IDS.CURRENCY, MECHANIC_IDS.RANK, MECHANIC_IDS.VITAL_STAT].sort());
  // Gọi lại lần nữa không nhân đôi / không xoá gì.
  m = enableMechanics(m, [MECHANIC_IDS.CURRENCY]);
  assert.equal(m.enabled.filter((x) => x === MECHANIC_IDS.CURRENCY).length, 1);
});

test('config CRUD (currency/rank/quest/system) persists correctly and stays pure', () => {
  let registry = newEmptyRegistry();
  registry = addStatEntity(registry, { displayName: 'Tiền', default: 100 });
  const tienId = registry.stats[0].id;

  let m = newEmptyMechanicsState();
  const before = JSON.stringify(m);
  m = addCurrencyConfig(m, { entityId: tienId, unit: 'đồng', allowNegative: false });
  assert.equal(JSON.stringify(newEmptyMechanicsState()), before, 'addCurrencyConfig không mutate input gốc');
  assert.equal(m.configs.currency.length, 1);
  assert.equal(m.configs.currency[0].entityId, tienId);

  const currencyId = m.configs.currency[0].id;
  m = removeCurrencyConfig(m, currencyId);
  assert.equal(m.configs.currency.length, 0);

  m = addRankConfig(m, { label: 'Cấp bậc tài sản', entityId: tienId, levels: [{ label: 'Tay trắng', threshold: 0 }] });
  const rankId = m.configs.rank[0].id;
  assert.equal(m.configs.rank[0].levels.length, 1);
  assert.ok(m.configs.rank[0].levels[0].id, 'level từ template (chưa qua addRankLevel) vẫn được cấp id ổn định');

  m = addRankLevel(m, rankId, { label: 'Khá giả', threshold: 600 });
  assert.equal(m.configs.rank[0].levels.length, 2);
  const levelId = m.configs.rank[0].levels[1].id;
  m = removeRankLevel(m, rankId, levelId);
  assert.equal(m.configs.rank[0].levels.length, 1);

  m = addQuestNote(m, { title: 'Thu thập 3 vật phẩm', completionIntent: 'Có đủ 3 vật phẩm X' });
  assert.equal(m.configs.quest.length, 1);
  assert.equal(m.configs.quest[0].title, 'Thu thập 3 vật phẩm');

  m = setSystemConfig(m, { name: 'Hệ Thống Sinh Tồn' });
  assert.equal(m.configs.system.name, 'Hệ Thống Sinh Tồn');
  assert.equal(m.configs.system.notificationStyle, ''); // patch không xoá field khác
});

test('MECHANIC_DEFS declares an honest supportLevel for every mechanic (no fake support)', () => {
  for (const id of Object.values(MECHANIC_IDS)) {
    const def = MECHANIC_DEFS[id];
    assert.ok(def, `MECHANIC_DEFS thiếu định nghĩa cho "${id}"`);
    assert.ok(Object.values(SUPPORT_LEVELS).includes(def.supportLevel));
  }
  assert.equal(MECHANIC_DEFS[MECHANIC_IDS.RANK].supportLevel, SUPPORT_LEVELS.AUTHORING_ONLY);
  assert.equal(MECHANIC_DEFS[MECHANIC_IDS.QUEST].supportLevel, SUPPORT_LEVELS.DEFERRED_RUNTIME);
  assert.equal(MECHANIC_DEFS[MECHANIC_IDS.VITAL_STAT].supportLevel, SUPPORT_LEVELS.SUPPORTED);
});

// ---------- describeMechanicsForPrompt (Planner/External AI context — mục 18/19) ----------

test('describeMechanicsForPrompt lists enabled mechanics with resolved entity labels', () => {
  let registry = newEmptyRegistry();
  registry = addStatEntity(registry, { displayName: 'Uy tín', default: 0 });
  const uyTinId = registry.stats[0].id;

  let m = enableMechanics(newEmptyMechanicsState(), [MECHANIC_IDS.RELATIONSHIP, MECHANIC_IDS.RANK]);
  m = addRankConfig(m, { label: 'Cấp bậc hậu cung', entityId: uyTinId, levels: [{ label: 'Cung nữ', threshold: 0 }, { label: 'Nữ quan', threshold: 10 }] });

  const lines = describeMechanicsForPrompt(m, registry);
  assert.ok(lines.some((l) => l.includes('Quan hệ')));
  assert.ok(lines.some((l) => l.includes('Uy tín') && l.includes('Cung nữ → Nữ quan')));
});

// ---------- SHOW_POPUP effect (mục "systemPopup" — Hệ thống/Chỉ dụ/Cơ hội hợp nhất) ----------

test('showPopup() compiles to choice.systemPopup — the exact runtime field GamePlayer already reads', () => {
  const episode = newBlankEpisode(1);
  let bp = newSceneBlueprint(episode);
  bp = setRegistry(bp, newEmptyRegistry());
  bp = addEnding(bp, { id: 'end_x', title: 'Kết thúc' });
  bp = addChoice(bp, bp.startSceneId, { text: 'Xem thông báo' });
  const choiceId = findScene(bp, bp.startSceneId).choices[0].id;
  bp = updateChoice(bp, bp.startSceneId, choiceId, {
    rules: { conditions: [], effects: [showPopup('Nhiệm vụ mới', 'Hãy cứu Tiểu Lan.')] },
  });
  bp = connectChoice(bp, bp.startSceneId, choiceId, 'ending', 'end_x');

  const { nodes } = compileEpisodeBlueprint(bp, { title: 'Test' });
  const compiledChoice = nodes['start_node'].choices[0];
  assert.deepEqual(compiledChoice.systemPopup, { title: 'Nhiệm vụ mới', text: 'Hãy cứu Tiểu Lan.' });
});

test('showPopup() with only a title (no text) still compiles — validator requires at least one', () => {
  const registry = newEmptyRegistry();
  const okResult = validateChoiceRules({ rules: { conditions: [], effects: [showPopup('Chỉ có tiêu đề', '')] }, conditionalOutcomes: [] }, registry);
  assert.deepEqual(okResult.errors, []);

  const emptyResult = validateChoiceRules({ rules: { conditions: [], effects: [showPopup('', '')] }, conditionalOutcomes: [] }, registry);
  assert.equal(emptyResult.errors.length, 1);
  assert.match(emptyResult.errors[0], /Thông báo/);
});

test('explainEffect renders SHOW_POPUP without needing an entity label', () => {
  assert.equal(explainEffect(showPopup('Chào mừng', 'Bạn đã vào cung.')), 'Thông báo: "Chào mừng"');
  assert.equal(EFFECT_TYPES.SHOW_POPUP, 'show_popup');
});

// ---------- Global milestone CRUD (AUTHORING_ONLY — mục "Global milestone rule") ----------

test('milestone CRUD stays pure and additive', () => {
  let registry = newEmptyRegistry();
  registry = addStatEntity(registry, { displayName: 'Tiền', default: 100 });
  const tienId = registry.stats[0].id;

  let globalState = { ...newEmptyGlobalState(), registry };
  const before = JSON.stringify(globalState);
  globalState = addMilestone(globalState, tienId);
  assert.equal(JSON.stringify({ ...newEmptyGlobalState(), registry }), before, 'addMilestone không mutate input gốc');
  assert.equal(globalState.milestones.length, 1);
  assert.equal(globalState.milestones[0].statEntityId, tienId);

  const milestoneId = globalState.milestones[0].id;
  globalState = addMilestoneThreshold(globalState, milestoneId, { at: 600, bonus: 50, label: 'Khá giả' });
  assert.equal(globalState.milestones[0].thresholds.length, 1);
  assert.equal(globalState.milestones[0].thresholds[0].at, 600);

  globalState = removeMilestone(globalState, milestoneId);
  assert.equal(globalState.milestones.length, 0);
});
