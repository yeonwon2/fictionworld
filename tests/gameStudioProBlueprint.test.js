import test from 'node:test';
import assert from 'node:assert/strict';
import { newEmptyProGame } from '../src/lib/gameStudioPro/proModel.js';
import { compileProGame, compileEpisodeBlueprint } from '../src/lib/gameStudioPro/proCompiler.js';
import { newBlankEpisode } from '../src/lib/gameStudioPro/plannerModel.js';
import {
  SCENE_ROLES,
  newSceneBlueprint,
  addScene,
  updateScene,
  removeScene,
  duplicateScene,
  addChoice,
  updateChoice,
  removeChoice,
  connectChoice,
  disconnectChoice,
  connectInstantEnding,
  toggleSceneLock,
  addEnding,
  countIncoming,
  findScene,
  autoLinkDanglingChoices,
  autoStitchUnreachableComponents,
} from '../src/lib/gameStudioPro/blueprintModel.js';
import { validateSceneBlueprint } from '../src/lib/gameStudioPro/blueprintValidator.js';
import { normalizeAIBlueprintResponse, applyNormalizedBlueprint, emptyBlueprintBase } from '../src/lib/gameStudioPro/blueprintAI.js';

function makeEpisode() {
  return { ...newBlankEpisode(1), id: 'ep_test1', title: 'Tập 1 — Nhập cung' };
}

// ---------- Blueprint creation / IDs ----------

test('newSceneBlueprint creates a single namespaced start scene', () => {
  const episode = makeEpisode();
  const bp = newSceneBlueprint(episode);
  assert.equal(bp.scenes.length, 1);
  assert.equal(bp.startSceneId, bp.scenes[0].id);
  assert.ok(bp.scenes[0].id.startsWith(`${episode.id}__s_`));
  assert.equal(bp.episodeId, episode.id);
});

test('autoLinkDanglingChoices repairs only empty targets using the next scene or a matching ending', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  const firstId = bp.scenes[0].id;
  bp = addChoice(bp, firstId, { text: 'Đi tiếp' });
  bp = addScene(bp, SCENE_ROLES.DECISION, { title: 'Cảnh cuối' });
  const lastId = bp.scenes[1].id;
  bp = addChoice(bp, lastId, { text: 'Khẳng định tình cảm với Nữ đế' });
  bp = addEnding(bp, { title: 'HE', tone: 'good' });
  const fixed = autoLinkDanglingChoices(bp);
  assert.equal(fixed.scenes[0].choices[0].targetId, lastId);
  assert.equal(fixed.scenes[1].choices[0].targetId, fixed.endings[0].id);
});

test('autoStitchUnreachableComponents connects an added cluster through a living ending without touching death', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  const start = bp.scenes[0].id;
  bp = addEnding(bp, { title: 'Sống', tone: 'good' });
  bp = addEnding(bp, { title: 'Chết', tone: 'death' });
  bp = addChoice(bp, start, { text: 'Sống', targetType: 'ending', targetId: bp.endings[0].id });
  bp = addChoice(bp, start, { text: 'Chết', targetType: 'ending', targetId: bp.endings[1].id });
  bp = addScene(bp, SCENE_ROLES.DECISION, { title: 'Cụm bổ sung' });
  const orphan = bp.scenes[1].id;
  bp = addChoice(bp, orphan, { text: 'Kết', targetType: 'ending', targetId: bp.endings[0].id });
  const fixed = autoStitchUnreachableComponents(bp);
  assert.equal(fixed.scenes[0].choices[0].targetId, orphan);
  assert.equal(fixed.scenes[0].choices[1].targetId, bp.endings[1].id);
});

test('scene/choice/ending IDs are unique even across many rapid creations', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  for (let i = 0; i < 50; i++) bp = addScene(bp, SCENE_ROLES.STORY);
  for (let i = 0; i < 10; i++) bp = addEnding(bp, { title: `Kết ${i}` });
  const sceneIds = bp.scenes.map((s) => s.id);
  assert.equal(new Set(sceneIds).size, sceneIds.length);
  const endingIds = bp.endings.map((e) => e.id);
  assert.equal(new Set(endingIds).size, endingIds.length);
});

test('renaming a scene does not change its ID', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  const id = bp.scenes[0].id;
  bp = updateScene(bp, id, { title: 'Tên mới' });
  assert.equal(bp.scenes[0].id, id);
  assert.equal(bp.scenes[0].title, 'Tên mới');
});

// ---------- Graph operations ----------

test('add/remove scene, removing a scene disconnects choices pointing to it', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  const startId = bp.startSceneId;
  bp = addScene(bp, SCENE_ROLES.STORY, { title: 'Cảnh 2' });
  const scene2 = bp.scenes[1];
  bp = addChoice(bp, startId, { text: 'Đi tiếp' });
  const choiceId = bp.scenes[0].choices[0].id;
  bp = connectChoice(bp, startId, choiceId, 'scene', scene2.id);
  assert.equal(findScene(bp, startId).choices[0].targetId, scene2.id);

  bp = removeScene(bp, scene2.id);
  assert.equal(bp.scenes.length, 1);
  assert.equal(findScene(bp, startId).choices[0].targetType, null);
  assert.equal(findScene(bp, startId).choices[0].targetId, null);
});

test('duplicateScene copies content with a new scene ID and fresh choice IDs', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  const startId = bp.startSceneId;
  bp = updateScene(bp, startId, { title: 'Gốc' });
  bp = addChoice(bp, startId, { text: 'X' });
  bp = duplicateScene(bp, startId);
  assert.equal(bp.scenes.length, 2);
  const copy = bp.scenes[1];
  assert.notEqual(copy.id, startId);
  assert.equal(copy.title, 'Gốc (bản sao)');
  assert.notEqual(copy.choices[0].id, bp.scenes[0].choices[0].id);
});

test('connect/disconnect a choice', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  bp = addScene(bp, SCENE_ROLES.STORY, { title: 'B' });
  const [a, b] = bp.scenes;
  bp = addChoice(bp, a.id);
  const cid = bp.scenes[0].choices[0].id;
  bp = connectChoice(bp, a.id, cid, 'scene', b.id);
  assert.equal(findScene(bp, a.id).choices[0].targetId, b.id);
  bp = disconnectChoice(bp, a.id, cid);
  assert.equal(findScene(bp, a.id).choices[0].targetType, null);
});

test('lock a scene', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  const id = bp.startSceneId;
  assert.equal(findScene(bp, id).locked, false);
  bp = toggleSceneLock(bp, id);
  assert.equal(findScene(bp, id).locked, true);
  bp = toggleSceneLock(bp, id);
  assert.equal(findScene(bp, id).locked, false);
});

test('countIncoming supports a convergence pattern (multiple incoming edges is not an error)', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  bp = addScene(bp, SCENE_ROLES.SIDE, { title: 'A' });
  bp = addScene(bp, SCENE_ROLES.STORY, { title: 'B' });
  bp = addScene(bp, SCENE_ROLES.CONVERGENCE, { title: 'Z' });
  const [start, a, b, z] = bp.scenes;
  bp = addChoice(bp, a.id);
  bp = connectChoice(bp, a.id, bp.scenes[1].choices[0].id, 'scene', z.id);
  bp = addChoice(bp, b.id);
  bp = connectChoice(bp, b.id, findScene(bp, b.id).choices[0].id, 'scene', z.id);
  assert.equal(countIncoming(bp, z.id), 2);
  const { errors } = validateSceneBlueprint(bp);
  assert.ok(!errors.some((e) => /hội tụ|convergence/i.test(e)));
});

test('connectInstantEnding creates and wires a death ending in one step', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  bp = addChoice(bp, bp.startSceneId, { text: 'Phản bác' });
  const cid = bp.scenes[0].choices[0].id;
  bp = connectInstantEnding(bp, bp.startSceneId, cid, { title: 'Chết', tone: 'death' });
  assert.equal(bp.endings.length, 1);
  assert.equal(bp.endings[0].tone, 'death');
  assert.equal(findScene(bp, bp.startSceneId).choices[0].targetType, 'ending');
  assert.equal(findScene(bp, bp.startSceneId).choices[0].targetId, bp.endings[0].id);
});

// ---------- Full required test scenario (section 26): "Tập 1 — Nhập cung" ----------
// main path, decision with 4 choices, side branch, convergence, non-lethal
// consequence, instant ending/death, gate intent placeholder.

function buildNhapCungBlueprint() {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  const intro = bp.startSceneId;
  bp = updateScene(bp, intro, { title: 'Nhập cung', role: SCENE_ROLES.STORY, intent: 'Nhân vật chính vừa nhập cung, làm quen cung quy.' });

  bp = addScene(bp, SCENE_ROLES.STORY, { title: 'Giúp Tiểu Lan', intent: 'Giữa tập, nhân vật chính giúp cung nữ Tiểu Lan.' });
  const helpTieuLan = bp.scenes[1];

  bp = addScene(bp, SCENE_ROLES.DECISION, { title: 'Lệ Phi hỏi tội', intent: 'Lệ Phi hỏi tội trước yến tiệc, 4 lựa chọn.' });
  const trial = bp.scenes[2];

  bp = addScene(bp, SCENE_ROLES.SIDE, { title: 'Nói đỡ cho Tiểu Lan', intent: 'Cảnh phụ mở ra khi bênh vực Tiểu Lan.' });
  const sideScene = bp.scenes[3];

  bp = addScene(bp, SCENE_ROLES.CONVERGENCE, { title: 'Trở lại yến tiệc', intent: 'Hội tụ lại tuyến chính sau nhánh phụ hoặc lựa chọn khác.' });
  const converge = bp.scenes[4];

  bp = addScene(bp, SCENE_ROLES.CONSEQUENCE, { title: 'Bị phạt', intent: 'Im lặng thì bị phạt nhưng không chết.' });
  const punished = bp.scenes[5];

  // Wire: intro -> help Tieu Lan -> trial
  bp = addChoice(bp, intro);
  bp = connectChoice(bp, intro, findScene(bp, intro).choices[0].id, 'scene', helpTieuLan.id);
  bp = addChoice(bp, helpTieuLan.id);
  bp = connectChoice(bp, helpTieuLan.id, findScene(bp, helpTieuLan.id).choices[0].id, 'scene', trial.id);

  // Trial: A xin lỗi -> converge, B nói đỡ -> side (with gate intent), C im lặng -> punished, D phản bác -> instant death
  bp = addChoice(bp, trial.id, { text: 'A. Xin lỗi' });
  bp = addChoice(bp, trial.id, { text: 'B. Nói đỡ cho Tiểu Lan' });
  bp = addChoice(bp, trial.id, { text: 'C. Im lặng' });
  bp = addChoice(bp, trial.id, { text: 'D. Phản bác' });
  let trialChoices = findScene(bp, trial.id).choices;
  bp = connectChoice(bp, trial.id, trialChoices[0].id, 'scene', converge.id);
  bp = connectChoice(bp, trial.id, trialChoices[1].id, 'scene', sideScene.id);
  bp = updateChoice(bp, trial.id, trialChoices[1].id, { gateIntent: 'Chỉ đặc biệt hiệu quả nếu trước đó đã cứu Tiểu Lan.' });
  bp = connectChoice(bp, trial.id, trialChoices[2].id, 'scene', punished.id);
  trialChoices = findScene(bp, trial.id).choices;
  bp = connectInstantEnding(bp, trial.id, trialChoices[3].id, { title: 'Chết vì phản bác', tone: 'death' });

  // Side branch converges back to the main line.
  bp = addChoice(bp, sideScene.id);
  bp = connectChoice(bp, sideScene.id, findScene(bp, sideScene.id).choices[0].id, 'scene', converge.id);

  // Punished (non-lethal) also rejoins the main line.
  bp = addChoice(bp, punished.id);
  bp = connectChoice(bp, punished.id, findScene(bp, punished.id).choices[0].id, 'scene', converge.id);

  // Convergence scene ends the episode.
  bp = addEnding(bp, { title: 'Qua được yến tiệc', tone: 'neutral' });
  const neutralEndingId = bp.endings[bp.endings.length - 1].id;
  bp = addChoice(bp, converge.id);
  bp = connectChoice(bp, converge.id, findScene(bp, converge.id).choices[0].id, 'ending', neutralEndingId);

  return { episode, bp, trial, sideScene, converge, punished };
}

test('required scenario: Tập 1 — Nhập cung blueprint is structurally valid', () => {
  const { bp, trial, sideScene, converge, punished } = buildNhapCungBlueprint();
  const { errors, warnings } = validateSceneBlueprint(bp);
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 0, warnings.join(' | '));

  assert.equal(findScene(bp, trial.id).choices.length, 4);
  assert.equal(countIncoming(bp, converge.id), 3); // A (direct), side branch, non-lethal consequence
  assert.equal(findScene(bp, trial.id).choices[1].gateIntent, 'Chỉ đặc biệt hiệu quả nếu trước đó đã cứu Tiểu Lan.');
  assert.equal(findScene(bp, trial.id).choices[3].targetType, 'ending');
  assert.ok(bp.endings.some((e) => e.tone === 'death'));
  assert.equal(sideScene.role, SCENE_ROLES.SIDE);
  assert.equal(converge.role, SCENE_ROLES.CONVERGENCE);
  assert.equal(punished.role, SCENE_ROLES.CONSEQUENCE);
});

test('required scenario compiles to playable runtime nodes with no reachable dead links', () => {
  const { bp } = buildNhapCungBlueprint();
  const { nodes, warnings } = compileEpisodeBlueprint(bp, { title: 'Tập 1 — Nhập cung' });
  assert.ok(nodes.start_node);
  assert.equal(nodes.start_node.isEnding, false);
  const brokenLinkWarnings = warnings.filter((w) => /Thiếu cảnh/.test(w));
  assert.deepEqual(brokenLinkWarnings, []);
  const endingNodes = Object.values(nodes).filter((n) => n.isEnding);
  assert.ok(endingNodes.length >= 2); // the neutral ending + the instant death ending
});

// ---------- Validator: structural errors/warnings ----------

test('validateSceneBlueprint flags an unconnected choice and a dangling target as errors', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  bp = addChoice(bp, bp.startSceneId, { text: 'chưa nối' });
  bp = addChoice(bp, bp.startSceneId, { text: 'đích ma', targetType: 'scene', targetId: 'khong_ton_tai' });
  const { errors } = validateSceneBlueprint(bp);
  assert.equal(errors.length, 2);
});

test('validateSceneBlueprint warns about a decision scene with fewer than 2 choices', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  bp = updateScene(bp, bp.startSceneId, { role: SCENE_ROLES.DECISION });
  bp = addEnding(bp, { title: 'Kết' });
  bp = addChoice(bp, bp.startSceneId);
  bp = connectChoice(bp, bp.startSceneId, findScene(bp, bp.startSceneId).choices[0].id, 'ending', bp.endings[0].id);
  const { warnings } = validateSceneBlueprint(bp);
  assert.ok(warnings.some((w) => /Lựa chọn/.test(w) && /1 lựa chọn/.test(w)));
});

test('validateSceneBlueprint requires a resolvable start scene', () => {
  const episode = makeEpisode();
  const bp = { ...newSceneBlueprint(episode), startSceneId: 'ma_khong_ton_tai' };
  const { errors } = validateSceneBlueprint(bp);
  assert.ok(errors.some((e) => /cảnh bắt đầu/.test(e)));
});

// ---------- Compiler ----------

test('compileEpisodeBlueprint does not mutate the source blueprint', () => {
  const { bp } = buildNhapCungBlueprint();
  const before = JSON.parse(JSON.stringify(bp));
  compileEpisodeBlueprint(bp, { title: 'x' });
  assert.deepEqual(bp, before);
});

test('compileEpisodeBlueprint throws a clear error on an empty blueprint', () => {
  assert.throws(() => compileEpisodeBlueprint({ scenes: [], endings: [] }), /trống/);
});

test('an ending-role scene compiles as a terminal node with no choices', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  bp = addScene(bp, SCENE_ROLES.ENDING, { title: 'Hết chuyện', intent: 'Câu chuyện khép lại.' });
  const endingScene = bp.scenes[1];
  bp = addChoice(bp, bp.startSceneId);
  bp = connectChoice(bp, bp.startSceneId, findScene(bp, bp.startSceneId).choices[0].id, 'scene', endingScene.id);
  const { nodes } = compileEpisodeBlueprint(bp);
  assert.equal(nodes[endingScene.id].isEnding, true);
  assert.deepEqual(nodes[endingScene.id].choices, []);
});

// ---------- PRO 0 / PRO 1 regression ----------

test('compileProGame is unaffected by the presence of episode.sceneBlueprint data', () => {
  const proDoc = newEmptyProGame();
  const { bp } = buildNhapCungBlueprint();
  proDoc.storyBlueprint = { status: 'approved', gamePlan: { title: 'X' }, episodes: [{ ...newBlankEpisode(1), sceneBlueprint: bp }] };
  const before = compileProGame(newEmptyProGame());
  const after = compileProGame(proDoc);
  assert.deepEqual(after.nodes, before.nodes);
  assert.equal(after.warnings.length, 0);
});

// ---------- AI response normalization (malformed input must not crash) ----------

test('normalizeAIBlueprintResponse throws a clear error when the AI returns no usable scenes', () => {
  assert.throws(() => normalizeAIBlueprintResponse({ scenes: [] }, 'ep_x'), /không trả về cảnh nào/);
  assert.throws(() => normalizeAIBlueprintResponse({}, 'ep_x'), /không trả về cảnh nào/);
  assert.throws(() => normalizeAIBlueprintResponse(null, 'ep_x'), /không trả về cảnh nào/);
});

test('normalizeAIBlueprintResponse tolerates malformed scenes/choices instead of crashing', () => {
  const raw = {
    scenes: [
      { ref: 's1', title: 'Mở đầu', role: 'not_a_real_role', intent: 'x', isStart: true, choices: [
        { target: 's2', targetKind: 'scene' },
        { target: '', targetKind: 'scene' }, // invalid, dropped
        null, // invalid, dropped
      ] },
      { ref: 's2', title: 'Kế tiếp', role: SCENE_ROLES.STORY, intent: 'y', choices: [] },
      { notARef: true }, // invalid, dropped
    ],
    endings: 'not an array',
  };
  const normalized = normalizeAIBlueprintResponse(raw, 'ep_x');
  assert.equal(normalized.scenes.length, 2);
  assert.equal(normalized.scenes[0].role, SCENE_ROLES.STORY); // unknown role defaulted
  assert.equal(normalized.scenes[0].choices.length, 1); // malformed choices dropped
  assert.equal(normalized.scenes[0].choices[0].targetType, 'scene');
  assert.equal(normalized.endings.length, 0);
  assert.ok(normalized.startSceneId);
});

test('normalizeAIBlueprintResponse rejects AI attempts to redefine a protected scene, but choices can still target it', () => {
  const raw = {
    scenes: [
      { ref: 'protected_id', title: 'AI cố ghi đè', role: SCENE_ROLES.STORY, intent: 'z' },
      { ref: 's1', title: 'Cảnh mới', role: SCENE_ROLES.STORY, intent: 'a', isStart: true, choices: [
        { target: 'protected_id', targetKind: 'scene' },
      ] },
    ],
  };
  const normalized = normalizeAIBlueprintResponse(raw, 'ep_x', { rejectSceneRefs: new Set(['protected_id']) });
  assert.equal(normalized.scenes.length, 1);
  assert.equal(normalized.scenes[0].title, 'Cảnh mới');
  assert.equal(normalized.scenes[0].choices[0].targetType, 'scene');
  assert.equal(normalized.scenes[0].choices[0].targetId, 'protected_id');
});

test('normalizeAIBlueprintResponse keeps the same real ID for a scene matching keepIdSceneRefs (scene redesign in place)', () => {
  const raw = { scenes: [{ ref: 'target_scene_id', title: 'Đã sửa', role: SCENE_ROLES.DANGER, intent: 'w' }] };
  const normalized = normalizeAIBlueprintResponse(raw, 'ep_x', { keepIdSceneRefs: new Set(['target_scene_id']) });
  assert.equal(normalized.scenes[0].id, 'target_scene_id');
});

// Regression: first-time "Dựng sơ đồ tập" used to keep newSceneBlueprint()'s
// placeholder "Mở đầu" scene alongside every AI-generated scene (discovered
// live in the browser — a mocked AI response with 6 scenes produced 7).
test('emptyBlueprintBase always starts with zero scenes, even with no existingBlueprint (first-time generation)', () => {
  const episode = makeEpisode();
  const base = emptyBlueprintBase(episode, null);
  assert.deepEqual(base.scenes, []);
  assert.deepEqual(base.endings, []);
  assert.equal(base.episodeId, episode.id);
});

test('emptyBlueprintBase clears an existing blueprint (used when regenerating with no locked scenes)', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  bp = addScene(bp, SCENE_ROLES.STORY, { title: 'sẽ bị xoá' });
  const base = emptyBlueprintBase(episode, bp);
  assert.deepEqual(base.scenes, []);
});

test('first-time generation ends up with exactly the AI-provided scenes, not the skeleton scene plus them', () => {
  const episode = makeEpisode();
  const normalized = normalizeAIBlueprintResponse(
    {
      scenes: [
        { ref: 's1', title: 'A', role: SCENE_ROLES.STORY, intent: 'x', isStart: true, choices: [] },
        { ref: 's2', title: 'B', role: SCENE_ROLES.STORY, intent: 'y', choices: [] },
      ],
    },
    episode.id
  );
  const base = emptyBlueprintBase(episode, null);
  const result = applyNormalizedBlueprint(base, normalized, { replaceIds: new Set(), replaceStartScene: true });
  assert.equal(result.scenes.length, 2);
  assert.deepEqual(result.scenes.map((s) => s.title).sort(), ['A', 'B']);
});

test('applyNormalizedBlueprint replaces only the targeted scene and preserves user notes', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  bp = updateScene(bp, bp.startSceneId, { notes: 'ghi chú tay của người dùng' });
  bp = addScene(bp, SCENE_ROLES.STORY, { title: 'Khác' });
  const other = bp.scenes[1];

  const normalized = { scenes: [{ id: bp.startSceneId, title: 'Đã AI sửa', role: SCENE_ROLES.DANGER, intent: 'mới', choices: [] }], endings: [], startSceneId: null };
  const next = applyNormalizedBlueprint(bp, normalized, { replaceIds: new Set([bp.startSceneId]) });
  assert.equal(next.scenes.length, 2);
  assert.ok(next.scenes.some((s) => s.id === other.id)); // untouched scene preserved by reference-equal id
  const updated = next.scenes.find((s) => s.id === bp.startSceneId);
  assert.equal(updated.title, 'Đã AI sửa');
  assert.equal(updated.notes, 'ghi chú tay của người dùng');
});

// ---------- Save / reload round-trip ----------

test('save/reload: generate, edit, add side scene, connect, lock — graph is identical after a JSON round-trip', () => {
  const { bp } = buildNhapCungBlueprint();
  const locked = toggleSceneLock(bp, bp.startSceneId);
  const roundTripped = JSON.parse(JSON.stringify(locked));
  assert.deepEqual(roundTripped, locked);
  assert.equal(roundTripped.scenes[0].locked, true);
  const { errors } = validateSceneBlueprint(roundTripped);
  assert.deepEqual(errors, []);
});

test('removeChoice removes exactly the targeted choice', () => {
  const episode = makeEpisode();
  let bp = newSceneBlueprint(episode);
  bp = addChoice(bp, bp.startSceneId, { text: 'A' });
  bp = addChoice(bp, bp.startSceneId, { text: 'B' });
  const [c1, c2] = findScene(bp, bp.startSceneId).choices;
  bp = removeChoice(bp, bp.startSceneId, c1.id);
  const remaining = findScene(bp, bp.startSceneId).choices;
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, c2.id);
});
