import test from 'node:test';
import assert from 'node:assert/strict';
import { newEmptyProGame } from '../src/lib/gameStudioPro/proModel.js';
import { compileProGame } from '../src/lib/gameStudioPro/proCompiler.js';
import {
  newStoryBlueprint,
  newBlankEpisode,
  downgradeIfApproved,
  PLANNER_STATUS,
} from '../src/lib/gameStudioPro/plannerModel.js';
import {
  validateAIGamePlanResponse,
  validateAIEpisodePlanResponse,
  mergeGamePlanRegeneration,
  mergeEpisodeRegeneration,
  reorderEpisode,
  toggleEpisodeLock,
  removeEpisode,
  addBlankEpisode,
  desiredEpisodeCount,
} from '../src/lib/gameStudioPro/plannerAI.js';
import { validateGamePlan } from '../src/lib/gameStudioPro/plannerValidator.js';

// ---------- PRO 0 regression: PRO 1 must not touch the compiler/runtime shape ----------

test('compileProGame(newEmptyProGame()) is unchanged by PRO 1', () => {
  const { meta, nodes, warnings } = compileProGame(newEmptyProGame());
  assert.equal(warnings.length, 0);
  assert.equal(meta.builder, 'pro');
  assert.ok(nodes.start_node);
  assert.equal(nodes.start_node.choices.length, 2);
  assert.ok(nodes.ending_a.isEnding);
  assert.ok(nodes.ending_b.isEnding);
});

test('a populated storyBlueprint round-trips verbatim inside meta.pro and is never read by the compiler', () => {
  const proDoc = newEmptyProGame();
  proDoc.storyBlueprint = { ...newStoryBlueprint('ý tưởng test'), gamePlan: { title: 'X' }, episodes: [newBlankEpisode(1)] };
  const before = structuredClone(proDoc.storyBlueprint);
  const { meta, nodes } = compileProGame(proDoc);
  assert.deepEqual(meta.pro.storyBlueprint, before);
  // compiled nodes are exactly the same fixed 2-choice/2-ending shape regardless of storyBlueprint content
  assert.equal(Object.keys(nodes).length, 3);
});

// ---------- Defensive validation of AI responses ----------

test('validateAIGamePlanResponse repairs a partial/malformed response instead of crashing', () => {
  const result = validateAIGamePlanResponse({
    title: 'Hậu Cung Ký',
    // premise missing entirely
    suggestedStats: 'not an array', // wrong type — must be coerced, not thrown
    importantCharacters: [{ name: 'Lệ Phi' }, { notAName: true }, null],
    episodeSummaries: [{ title: 'Tập 1', summary: 'Nhập cung' }, { summary: 'thiếu title, bị loại' }],
  });
  assert.equal(result.title, 'Hậu Cung Ký');
  assert.equal(result.premise, '');
  assert.deepEqual(result.suggestedStats, []);
  assert.equal(result.importantCharacters.length, 1);
  assert.equal(result.episodeSummaries.length, 1);
});

test('validateAIGamePlanResponse throws a clear error only when genuinely unusable', () => {
  assert.throws(() => validateAIGamePlanResponse(null), /không trả về dữ liệu hợp lệ/);
  assert.throws(() => validateAIGamePlanResponse({}), /không trả về tên game/);
});

test('validateAIGamePlanResponse caps episodeSummaries at MAX_EPISODES', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ title: `Tập ${i + 1}`, summary: 's' }));
  const result = validateAIGamePlanResponse({ title: 'X', episodeSummaries: many });
  assert.equal(result.episodeSummaries.length, 12);
});

test('validateAIEpisodePlanResponse tags user origin correctly and drops dangerous keys', () => {
  const result = validateAIGamePlanResponse({
    title: 'X',
    suggestedStats: [
      { name: 'Sủng ái', description: 'user mentioned', origin: 'user' },
      { name: 'Quyền lực', description: 'ai suggested', origin: 'ai' },
      { name: 'Không rõ', description: 'no origin field' },
      { name: '__proto__', description: 'malicious' },
    ],
    episodeSummaries: [{ title: 'T1', summary: 's' }],
  });
  assert.equal(result.suggestedStats.length, 3);
  assert.equal(result.suggestedStats[0].origin, 'user');
  assert.equal(result.suggestedStats[1].origin, 'ai');
  assert.equal(result.suggestedStats[2].origin, 'ai'); // missing origin defaults to "ai", never silently "user"
});

test('validateAIEpisodePlanResponse repairs partial data and rejects genuinely empty responses', () => {
  const ok = validateAIEpisodePlanResponse({ title: 'Tập 1', summary: 'Nhập cung', stages: 'oops', planningIntents: [{ description: 'chết ngay nếu xúc phạm' }] });
  assert.equal(ok.title, 'Tập 1');
  assert.deepEqual(ok.stages, []);
  assert.equal(ok.planningIntents[0].type, 'other');
  assert.throws(() => validateAIEpisodePlanResponse({}), /không trả về tên hay tóm tắt/);
});

// ---------- Merge: locks respected, other episodes never touched ----------

test('mergeGamePlanRegeneration keeps locked episodes untouched and at their original order', () => {
  const locked = { ...newBlankEpisode(1), id: 'ep-locked', title: 'Tập 1 (khoá)', locked: true };
  const storyBlueprint = { ...newStoryBlueprint('idea'), gamePlan: { title: 'Old' }, episodes: [locked, { ...newBlankEpisode(2), id: 'ep-old' }] };
  const before = structuredClone(locked);
  const newEpisodes = [
    { id: 'ep-new-1', title: 'Tập mới A', summary: '', stages: [] },
    { id: 'ep-new-2', title: 'Tập mới B', summary: '', stages: [] },
  ];
  const merged = mergeGamePlanRegeneration(storyBlueprint, 'idea', storyBlueprint.settings, { title: 'New' }, newEpisodes);
  const stillLocked = merged.episodes.find((e) => e.id === 'ep-locked');
  assert.deepEqual(stillLocked, before);
  assert.equal(stillLocked.order, 1);
  // old non-locked episode is gone, replaced by the two new ones
  assert.equal(merged.episodes.some((e) => e.id === 'ep-old'), false);
  assert.equal(merged.episodes.length, 3);
  assert.equal(merged.status, PLANNER_STATUS.PLANNED);
  assert.deepEqual(merged.episodes.map((e) => e.order), [1, 2, 3]);
});

test('mergeEpisodeRegeneration replaces exactly one episode, others are byte-identical', () => {
  const ep1 = { ...newBlankEpisode(1), id: 'ep-1', title: 'Tập 1' };
  const ep2 = { ...newBlankEpisode(2), id: 'ep-2', title: 'Tập 2' };
  const ep3 = { ...newBlankEpisode(3), id: 'ep-3', title: 'Tập 3' };
  const storyBlueprint = { ...newStoryBlueprint('idea'), gamePlan: { title: 'G' }, episodes: [ep1, ep2, ep3], status: PLANNER_STATUS.APPROVED };
  const before1 = structuredClone(ep1);
  const before3 = structuredClone(ep3);
  const newEp2 = { ...ep2, title: 'Tập 2 (đã tạo lại)' };
  const merged = mergeEpisodeRegeneration(storyBlueprint, 'ep-2', newEp2);
  assert.deepEqual(merged.episodes.find((e) => e.id === 'ep-1'), before1);
  assert.deepEqual(merged.episodes.find((e) => e.id === 'ep-3'), before3);
  assert.equal(merged.episodes.find((e) => e.id === 'ep-2').title, 'Tập 2 (đã tạo lại)');
  assert.equal(merged.status, PLANNER_STATUS.PLANNED, 'regenerating an episode un-approves the plan');
});

// ---------- List helpers ----------

test('reorderEpisode swaps two adjacent episodes and keeps sequential order', () => {
  const episodes = [
    { ...newBlankEpisode(1), id: 'a' },
    { ...newBlankEpisode(2), id: 'b' },
    { ...newBlankEpisode(3), id: 'c' },
  ];
  const moved = reorderEpisode(episodes, 'b', 'up');
  assert.deepEqual(moved.map((e) => e.id), ['b', 'a', 'c']);
  assert.deepEqual(moved.map((e) => e.order), [1, 2, 3]);
  // no-op at the boundary
  assert.deepEqual(reorderEpisode(episodes, 'a', 'up').map((e) => e.id), ['a', 'b', 'c']);
});

test('toggleEpisodeLock flips only the targeted episode', () => {
  const episodes = [{ ...newBlankEpisode(1), id: 'a', locked: false }, { ...newBlankEpisode(2), id: 'b', locked: false }];
  const toggled = toggleEpisodeLock(episodes, 'a');
  assert.equal(toggled[0].locked, true);
  assert.equal(toggled[1].locked, false);
});

test('removeEpisode drops only the targeted episode', () => {
  const episodes = [{ ...newBlankEpisode(1), id: 'a' }, { ...newBlankEpisode(2), id: 'b' }];
  assert.deepEqual(removeEpisode(episodes, 'a').map((e) => e.id), ['b']);
});

test('addBlankEpisode appends a new episode with the next sequential order, leaves others untouched', () => {
  const episodes = [{ ...newBlankEpisode(1), id: 'a' }, { ...newBlankEpisode(2), id: 'b' }];
  const before = structuredClone(episodes);
  const next = addBlankEpisode(episodes);
  assert.equal(next.length, 3);
  assert.equal(next[2].order, 3);
  assert.deepEqual(next.slice(0, 2), before);
  const firstOfEmpty = addBlankEpisode([])[0];
  assert.equal(firstOfEmpty.order, 1);
  assert.equal(firstOfEmpty.locked, false);
  assert.deepEqual(firstOfEmpty.stages, []);
});

test('desiredEpisodeCount: short game is always 1, long game respects estimate and cap', () => {
  assert.equal(desiredEpisodeCount({ gameLength: 'short' }), 1);
  assert.equal(desiredEpisodeCount({ gameLength: 'long', estimatedEpisodes: 8 }), 8);
  assert.equal(desiredEpisodeCount({ gameLength: 'long', estimatedEpisodes: 999 }), 12);
  assert.equal(desiredEpisodeCount({ gameLength: 'long' }, 3), 3);
  assert.equal(desiredEpisodeCount({ gameLength: 'long' }, 0), 5);
});

// ---------- Approve status downgrade ----------

test('downgradeIfApproved resets approved back to planned, leaves other statuses alone', () => {
  assert.equal(downgradeIfApproved({ status: PLANNER_STATUS.APPROVED }).status, PLANNER_STATUS.PLANNED);
  assert.equal(downgradeIfApproved({ status: PLANNER_STATUS.PLANNED }).status, PLANNER_STATUS.PLANNED);
  assert.equal(downgradeIfApproved({ status: PLANNER_STATUS.DRAFT }).status, PLANNER_STATUS.DRAFT);
});

// ---------- Planner validator (non-AI) ----------

test('validateGamePlan warns on a long game with zero episodes', () => {
  const sb = { settings: { gameLength: 'long' }, gamePlan: { title: 'X' }, episodes: [] };
  const { warnings } = validateGamePlan(sb);
  assert.ok(warnings.some((w) => w.includes('chưa có tập nào')));
});

test('validateGamePlan warns on episode missing goal or stages', () => {
  const sb = { gamePlan: { title: 'X' }, episodes: [{ title: 'Tập 1', goal: '', stages: [] }] };
  const { warnings } = validateGamePlan(sb);
  assert.ok(warnings.some((w) => w.includes('Tập 1: chưa có mục tiêu')));
  assert.ok(warnings.some((w) => w.includes('Tập 1: chưa có giai đoạn')));
});

test('validateGamePlan warns when endingStrategy is missing but episodes exist', () => {
  const sb = { gamePlan: { title: 'X', endingStrategy: '' }, episodes: [{ title: 'Tập 1', goal: 'g', stages: [{}] }] };
  const { warnings } = validateGamePlan(sb);
  assert.ok(warnings.some((w) => w.includes('định hướng kết thúc')));
});

test('validateGamePlan warns when an episode references a stat not in suggestedStats', () => {
  const sb = {
    gamePlan: { title: 'X', endingStrategy: 'e', suggestedStats: [{ name: 'Sủng ái' }] },
    episodes: [{ title: 'Tập 1', goal: 'g', stages: [{}], relevantStats: ['Sủng ái', 'Quyền lực'] }],
  };
  const { warnings } = validateGamePlan(sb);
  assert.ok(warnings.some((w) => w.includes('Quyền lực') && w.includes('chưa có trong danh sách')));
  assert.ok(!warnings.some((w) => w.includes('"Sủng ái"')));
});

test('validateGamePlan blocks only on a missing title; warnings never block', () => {
  assert.equal(validateGamePlan({ gamePlan: null, episodes: [] }).blockers.length, 1);
  assert.equal(validateGamePlan({ gamePlan: { title: 'X' }, episodes: [] }).blockers.length, 0);
});
