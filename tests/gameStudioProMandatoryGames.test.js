// PRO 6 mục 25-27: 3 game bắt buộc chứng minh Template + Mechanics compose
// đúng qua ĐÚNG pipeline hiện có (applyTemplate -> compileProCampaign/
// compileEpisodeBlueprint -> buildRoutes/gameOverReasons) — không viết mô
// phỏng/engine riêng nào cho test này.
import test from 'node:test';
import assert from 'node:assert/strict';

import { newEmptyProGame } from '../src/lib/gameStudioPro/proModel.js';
import { applyTemplate, TEMPLATE_IDS } from '../src/lib/gameStudioPro/templateRegistry.js';
import { compileProCampaign, compileEpisodeBlueprint } from '../src/lib/gameStudioPro/proCompiler.js';
import { validateCampaign } from '../src/lib/gameStudioPro/campaignValidator.js';
import { newStoryBlueprint, newBlankEpisode } from '../src/lib/gameStudioPro/plannerModel.js';
import {
  newSceneBlueprint,
  addScene,
  addChoice,
  updateChoice,
  connectChoice,
  findScene,
  setRegistry,
  SCENE_ROLES,
} from '../src/lib/gameStudioPro/blueprintModel.js';
import { statCompare, statChange, grantFlag, grantItem } from '../src/lib/gameStudioPro/ruleModel.js';
import { buildRoutes } from '../src/lib/gameStudio/routeExplorer.js';
import { gameOverReasons } from '../src/lib/gameStudio/playerState.js';
import { addMilestone, addMilestoneThreshold } from '../src/lib/gameStudioPro/globalStateModel.js';

function statId(registry, displayName) {
  return registry.stats.find((e) => e.displayName === displayName).id;
}
function ep(order, id, title) {
  return { ...newBlankEpisode(order), id, title };
}

// ---------- Mandatory Game A — Cung Đấu (2 episodes) ----------

test('Mandatory Game A (Cung Đấu): saving the NPC raises Uy tín, which then gates promotion in episode 2', () => {
  let proDoc = newEmptyProGame();
  proDoc = applyTemplate(proDoc, TEMPLATE_IDS.PALACE);
  // compileProCampaign() đọc DUY NHẤT proDoc.globalState.registry (bài học
  // FIX1 PRO5 — không có registry thứ hai) — cờ mới phải được thêm ở ĐÂY,
  // rồi mirror xuống từng episode.sceneBlueprint.registry, KHÔNG phải ngược lại.
  let registry = proDoc.globalState.registry;
  const uyTinId = statId(registry, 'Uy tín');
  registry = { ...registry, flags: [{ id: 'flag_da_cuu', kind: 'flag', displayName: 'Đã cứu Tiểu Lan' }] };
  proDoc = { ...proDoc, globalState: { ...proDoc.globalState, registry } };

  // Tập 1 — Nhập cung: 1 lựa chọn "Cứu Tiểu Lan" -> Uy tín +10 + cờ, nối sang Tập 2.
  let bp1 = newSceneBlueprint(ep(1, 'ep1', 'Tập 1 — Nhập cung'));
  bp1 = setRegistry(bp1, registry);
  bp1 = addChoice(bp1, bp1.startSceneId, { text: 'Cứu Tiểu Lan' });
  const c1 = findScene(bp1, bp1.startSceneId).choices[0].id;
  bp1 = updateChoice(bp1, bp1.startSceneId, c1, {
    rules: { conditions: [], effects: [statChange(uyTinId, 10), grantFlag('flag_da_cuu')] },
  });
  bp1 = connectChoice(bp1, bp1.startSceneId, c1, 'episode', 'ep2');

  // Tập 2 — Nữ quan: 2 lựa chọn loại trừ nhau theo ngưỡng Uy tín >= 10 (đúng
  // mốc rank "Nữ quan" của template palace) dẫn tới 2 kết thúc khác nhau.
  let bp2 = newSceneBlueprint(ep(2, 'ep2', 'Tập 2 — Nữ quan'));
  bp2 = setRegistry(bp2, registry);
  bp2 = addScene(bp2, SCENE_ROLES.ENDING, { id: 'ep2__end_promoted', title: 'Được phong Nữ quan' });
  bp2 = addScene(bp2, SCENE_ROLES.ENDING, { id: 'ep2__end_stayed', title: 'Vẫn là Cung nữ' });
  bp2 = addChoice(bp2, bp2.startSceneId, { text: 'Diện kiến Hoàng hậu (đủ Uy tín)' });
  bp2 = addChoice(bp2, bp2.startSceneId, { text: 'Tiếp tục làm cung nữ' });
  const [promoteChoiceId, stayChoiceId] = findScene(bp2, bp2.startSceneId).choices.map((c) => c.id);
  bp2 = updateChoice(bp2, bp2.startSceneId, promoteChoiceId, { rules: { conditions: [statCompare(uyTinId, '>=', 10)], effects: [] } });
  bp2 = connectChoice(bp2, bp2.startSceneId, promoteChoiceId, 'scene', 'ep2__end_promoted');
  bp2 = updateChoice(bp2, bp2.startSceneId, stayChoiceId, { rules: { conditions: [statCompare(uyTinId, '<', 10)], effects: [] } });
  bp2 = connectChoice(bp2, bp2.startSceneId, stayChoiceId, 'scene', 'ep2__end_stayed');

  proDoc = {
    ...proDoc,
    storyBlueprint: { ...newStoryBlueprint('Cung đấu test'), episodes: [{ ...ep(1, 'ep1', 'Tập 1 — Nhập cung'), sceneBlueprint: bp1 }, { ...ep(2, 'ep2', 'Tập 2 — Nữ quan'), sceneBlueprint: bp2 }] },
    globalState: { ...proDoc.globalState, startEpisodeId: 'ep1' },
  };

  const validation = validateCampaign(proDoc);
  assert.deepEqual(validation.errors, []);

  const { meta, nodes } = compileProCampaign(proDoc);
  const { routes } = buildRoutes(nodes, meta.statsConfig);
  const promoted = routes.find((r) => r.endingId === 'ep2__end_promoted');
  assert.ok(promoted, 'tuyến "được phong Nữ quan" phải chơi-tới-được sau khi cứu Tiểu Lan');
  const lastStep = promoted.steps[promoted.steps.length - 1];
  assert.equal(lastStep.stateAfter.stats[uyTinId], 10, 'Uy tín phải là 10 khi tới kết thúc thăng chức');
  assert.ok(lastStep.stateAfter.flags.has('Đã cứu Tiểu Lan'), 'cờ carry-state xuyên tập phải còn nguyên ở Tập 2 (PRO5)');
  assert.equal(routes.find((r) => r.endingId === 'ep2__end_stayed'), undefined, '"vẫn là cung nữ" không chơi-tới-được vì Uy tín=10 đã đủ ngưỡng');
});

// ---------- Mandatory Game B — Trọng Sinh Làm Giàu ----------

test('Mandatory Game B (Trọng Sinh): Tiền arithmetic composes correctly and gates the big-investment choice', () => {
  let proDoc = newEmptyProGame();
  proDoc = applyTemplate(proDoc, TEMPLATE_IDS.REBIRTH);
  const registry = proDoc.globalState.registry;
  const tienId = statId(registry, 'Tiền');
  assert.equal(registry.stats.find((e) => e.id === tienId).default, 100, 'Tiền khởi đầu = 100 theo mẫu spec');

  let bp = newSceneBlueprint(ep(1, 'ep1', 'Khởi nghiệp'));
  bp = setRegistry(bp, registry);
  bp = addScene(bp, SCENE_ROLES.CONSEQUENCE, { id: 'ep1__s_event', title: 'Sự kiện thị trường' });
  bp = addScene(bp, SCENE_ROLES.DECISION, { id: 'ep1__s_choice', title: 'Cơ hội đầu tư' });
  bp = addScene(bp, SCENE_ROLES.ENDING, { id: 'ep1__end_big', title: 'Đầu tư lớn thành công' });
  bp = addScene(bp, SCENE_ROLES.ENDING, { id: 'ep1__end_small', title: 'Tiếp tục tích luỹ' });

  // "Mua cổ phiếu": Tiền -50, đi tới cảnh sự kiện.
  bp = addChoice(bp, bp.startSceneId, { text: 'Mua cổ phiếu' });
  const buyChoiceId = findScene(bp, bp.startSceneId).choices[0].id;
  bp = updateChoice(bp, bp.startSceneId, buyChoiceId, { rules: { conditions: [], effects: [statChange(tienId, -50)] } });
  bp = connectChoice(bp, bp.startSceneId, buyChoiceId, 'scene', 'ep1__s_event');

  // "Sau sự kiện": Tiền +200, đi tự động (1 lựa chọn) tới cảnh quyết định.
  bp = addChoice(bp, 'ep1__s_event', { text: 'Tiếp tục' });
  const eventChoiceId = findScene(bp, 'ep1__s_event').choices[0].id;
  bp = updateChoice(bp, 'ep1__s_event', eventChoiceId, { rules: { conditions: [], effects: [statChange(tienId, 200)] } });
  bp = connectChoice(bp, 'ep1__s_event', eventChoiceId, 'scene', 'ep1__s_choice');

  // Cảnh quyết định: "đầu tư lớn" chỉ mở khi Tiền >= 200.
  bp = addChoice(bp, 'ep1__s_choice', { text: 'Đầu tư lớn (cần Tiền >= 200)' });
  bp = addChoice(bp, 'ep1__s_choice', { text: 'Tiếp tục tích luỹ nhỏ' });
  const [bigChoiceId, smallChoiceId] = findScene(bp, 'ep1__s_choice').choices.map((c) => c.id);
  bp = updateChoice(bp, 'ep1__s_choice', bigChoiceId, { rules: { conditions: [statCompare(tienId, '>=', 200)], effects: [] } });
  bp = connectChoice(bp, 'ep1__s_choice', bigChoiceId, 'scene', 'ep1__end_big');
  bp = updateChoice(bp, 'ep1__s_choice', smallChoiceId, { rules: { conditions: [statCompare(tienId, '<', 200)], effects: [] } });
  bp = connectChoice(bp, 'ep1__s_choice', smallChoiceId, 'scene', 'ep1__end_small');

  const { meta, nodes } = compileEpisodeBlueprint(bp, { title: 'Trọng sinh test' });
  const { routes } = buildRoutes(nodes, meta.statsConfig);
  const bigRoute = routes.find((r) => r.endingId === 'ep1__end_big');
  assert.ok(bigRoute, 'Tiền = 100-50+200 = 250 >= 200 -> lựa chọn đầu tư lớn phải mở được');
  const finalTien = bigRoute.steps[bigRoute.steps.length - 1].stateAfter.stats[tienId];
  assert.equal(finalTien, 250);
  assert.equal(routes.find((r) => r.endingId === 'ep1__end_small'), undefined, 'nhánh nhỏ bị khoá vì Tiền đã đủ 200');
});

// ---------- Mandatory Game C — Hệ Thống ----------

test('Mandatory Game C (Hệ Thống): completing the quest grants points+item+flag; failing it can kill via the existing vital-stat mechanism', () => {
  let proDoc = newEmptyProGame();
  proDoc = applyTemplate(proDoc, TEMPLATE_IDS.SYSTEM);
  const registry = proDoc.globalState.registry;
  const sinhTonId = statId(registry, 'Sinh tồn');
  const diemId = statId(registry, 'Điểm hệ thống');
  assert.ok(registry.stats.find((e) => e.id === sinhTonId).isVital, 'Sinh tồn phải là chỉ số sinh tử (mechanic Vital Stat)');

  let bp = newSceneBlueprint(ep(1, 'ep1', 'Nhiệm vụ đầu tiên'));
  bp = setRegistry(bp, { ...registry, items: [{ id: 'item_thuong', kind: 'item', displayName: 'Phần thưởng hệ thống' }] });
  bp = addScene(bp, SCENE_ROLES.ENDING, { id: 'ep1__end_success', title: 'Hoàn thành nhiệm vụ' });

  bp = addChoice(bp, bp.startSceneId, { text: 'Hoàn thành nhiệm vụ' });
  bp = addChoice(bp, bp.startSceneId, { text: 'Thất bại nhiệm vụ' });
  const [successId, failId] = findScene(bp, bp.startSceneId).choices.map((c) => c.id);
  bp = setRegistry(bp, {
    ...registry,
    items: [{ id: 'item_thuong', kind: 'item', displayName: 'Phần thưởng hệ thống' }],
    flags: [{ id: 'flag_nv1', kind: 'flag', displayName: 'Đã hoàn thành nhiệm vụ 1' }],
  });
  bp = updateChoice(bp, bp.startSceneId, successId, {
    rules: { conditions: [], effects: [statChange(diemId, 10), grantItem('item_thuong'), grantFlag('flag_nv1')] },
  });
  bp = connectChoice(bp, bp.startSceneId, successId, 'scene', 'ep1__end_success');
  // "Thất bại nhiệm vụ" trừ đúng toàn bộ Sinh tồn khởi đầu (100) để chạm deathThreshold=0.
  bp = updateChoice(bp, bp.startSceneId, failId, { rules: { conditions: [], effects: [statChange(sinhTonId, -100)] } });
  bp = connectChoice(bp, bp.startSceneId, failId, 'scene', 'ep1__end_success'); // đích không quan trọng — sẽ chết trước khi tới

  const { meta, nodes } = compileEpisodeBlueprint(bp, { title: 'Hệ thống test' });
  const { routes } = buildRoutes(nodes, meta.statsConfig);

  const successRoute = routes.find((r) => r.endingId === 'ep1__end_success' && r.steps[0].choice.text === 'Hoàn thành nhiệm vụ');
  assert.ok(successRoute);
  const successState = successRoute.steps[successRoute.steps.length - 1].stateAfter;
  assert.equal(successState.stats[diemId], 10);
  assert.ok(successState.items.has('Phần thưởng hệ thống'));
  assert.ok(successState.flags.has('Đã hoàn thành nhiệm vụ 1'));

  // "Thất bại nhiệm vụ" -> Sinh tồn chạm 0 -> gameOverReasons() (playerState.js,
  // KHÔNG viết logic chết mới) phải nhận diện đây là game over.
  const deathRoute = routes.find((r) => r.steps[0].choice.text === 'Thất bại nhiệm vụ');
  assert.ok(deathRoute, 'buildRoutes vẫn ghi nhận tuyến này (chết = 1 dạng kết thúc hợp lệ, không phải lỗi)');
  const deathState = deathRoute.steps[deathRoute.steps.length - 1].stateAfter;
  assert.equal(deathState.stats[sinhTonId], 0);
  const reasons = gameOverReasons(deathState.stats, meta.statsConfig);
  assert.equal(reasons.length, 1);
  assert.equal(reasons[0].key, sinhTonId);
});

// ---------- Regression guard: applying a template never breaks blank PRO0 compile ----------

test('applying any template to a brand-new PRO doc never breaks the plain compileProGame() path', async () => {
  const { compileProGame } = await import('../src/lib/gameStudioPro/proCompiler.js');
  for (const templateId of ['blank', 'palace', 'system', 'rebirth', 'survival', 'adventure', 'visual_novel']) {
    const proDoc = applyTemplate(newEmptyProGame(), templateId);
    const { nodes } = compileProGame(proDoc);
    assert.equal(nodes['start_node'].choices.length, 2, `template "${templateId}" không được đụng tới compileProGame() PRO0`);
  }
});

// ---------- Milestone validation (AUTHORING_ONLY — validateCampaign checks shape only) ----------

test('validateCampaign flags a milestone pointing at a deleted/unknown entity, and accepts a valid one', () => {
  let proDoc = newEmptyProGame();
  proDoc = applyTemplate(proDoc, TEMPLATE_IDS.REBIRTH);
  const tienId = statId(proDoc.globalState.registry, 'Tiền');

  let bp = newSceneBlueprint(ep(1, 'ep1', 'Tập 1'));
  bp = setRegistry(bp, proDoc.globalState.registry);
  bp = addEndingViaScene(bp);
  proDoc = { ...proDoc, storyBlueprint: { ...newStoryBlueprint('x'), episodes: [{ ...ep(1, 'ep1', 'Tập 1'), sceneBlueprint: bp }] } };

  let withValidMilestone = { ...proDoc, globalState: addMilestone(proDoc.globalState, tienId) };
  const midId = withValidMilestone.globalState.milestones[0].id;
  withValidMilestone = { ...withValidMilestone, globalState: addMilestoneThreshold(withValidMilestone.globalState, midId, { at: 600, bonus: 50 }) };
  assert.deepEqual(validateCampaign(withValidMilestone).errors, []);

  const withBrokenMilestone = { ...proDoc, globalState: addMilestone(proDoc.globalState, 'stat_khong_ton_tai') };
  const result = validateCampaign(withBrokenMilestone);
  assert.ok(result.errors.some((e) => e.includes('Milestone')), 'milestone trỏ tới entity không tồn tại phải bị báo lỗi');
});

function addEndingViaScene(bp) {
  bp = addScene(bp, SCENE_ROLES.ENDING, { id: 'ep1__end_x', title: 'Kết' });
  bp = addChoice(bp, bp.startSceneId, { text: 'Đi' });
  const cid = findScene(bp, bp.startSceneId).choices[0].id;
  return connectChoice(bp, bp.startSceneId, cid, 'scene', 'ep1__end_x');
}
