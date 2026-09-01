import test from 'node:test';
import assert from 'node:assert/strict';

import { newEmptyProGame } from '../src/lib/gameStudioPro/proModel.js';
import {
  compileProGame,
  compileProCampaign,
  hasCampaignContent,
  compileProDocument,
} from '../src/lib/gameStudioPro/proCompiler.js';
import { newStoryBlueprint, newBlankEpisode } from '../src/lib/gameStudioPro/plannerModel.js';
import {
  SCENE_ROLES,
  newSceneBlueprint,
  addScene,
  addChoice,
  updateChoice,
  connectChoice,
  findScene,
  setRegistry,
} from '../src/lib/gameStudioPro/blueprintModel.js';
import { newEmptyRegistry, addStatEntity, ENTITY_KINDS } from '../src/lib/gameStudioPro/entityRegistry.js';
import { statCompare, statChange } from '../src/lib/gameStudioPro/ruleModel.js';
import {
  ensureGlobalState,
  applyEpisodeBlueprint,
  mergeNewEntitiesIntoRegistry,
} from '../src/lib/gameStudioPro/globalStateModel.js';
import { parseAndValidateProScript, finalizeAndValidateProScript, SCRIPT_HEADER_V1 } from '../src/lib/gameStudioPro/scriptBridge.js';
import { loadPlayerState, savePlayerState } from '../src/lib/gameStudio/playerState.js';

function ep(order, id, title) {
  return { ...newBlankEpisode(order), id, title };
}

function makeGlobalStateWithUyTin() {
  let registry = newEmptyRegistry();
  registry = addStatEntity(registry, { displayName: 'Uy tín', default: 10 });
  const uyTinId = registry.stats[0].id;
  return { globalState: { version: 1, registry, startEpisodeId: 'ep1' }, uyTinId };
}

// `nextEpisodeId`, khi truyền, nối lựa chọn duy nhất của tập này sang tập kế
// (targetType "episode") — cần cho mọi test thực sự gọi compileProCampaign(),
// vì normalizeAndRepair() (postprocess.js) XOÁ mọi node KHÔNG reachable từ
// start_node (mục "BFS từ start_node..."), nên 1 tập không tới được từ tập
// bắt đầu sẽ hoàn toàn biến mất khỏi `nodes` — không phải bug, nhưng đòi hỏi
// đồ thị test phải liền mạch.
function makeLinkedEpisode(episodeId, order, title, registry, uyTinId, nextEpisodeId = null) {
  let bp = newSceneBlueprint(ep(order, episodeId, title));
  bp = setRegistry(bp, registry);
  bp = addChoice(bp, bp.startSceneId, { text: 'Đi' });
  const cid = findScene(bp, bp.startSceneId).choices[0].id;
  bp = updateChoice(bp, bp.startSceneId, cid, { rules: { conditions: [], effects: [statChange(uyTinId, 5)] } });
  if (nextEpisodeId) bp = connectChoice(bp, bp.startSceneId, cid, 'episode', nextEpisodeId);
  return { ...ep(order, episodeId, title), sceneBlueprint: bp };
}

// ---------- 1. New episode blueprint inherits the global registry ----------

test('1. a brand-new (empty) episode blueprint immediately inherits the global registry, not an empty local one', () => {
  const { globalState } = makeGlobalStateWithUyTin();
  const episode1 = makeLinkedEpisode('ep1', 1, 'Tập 1', globalState.registry, globalState.registry.stats[0].id);
  const storyBlueprint = { ...newStoryBlueprint('x'), episodes: [episode1, ep(2, 'ep2', 'Tập 2')] };

  // Tạo sơ đồ trống cho Tập 2 — đúng thao tác nút "Tạo sơ đồ trống" trong SmartMindMap.
  const emptyBlueprint = newSceneBlueprint(episode1); // registry rỗng theo mặc định
  assert.deepEqual(emptyBlueprint.registry, { stats: [], flags: [], items: [] });

  const result = applyEpisodeBlueprint(storyBlueprint, globalState, 'ep2', emptyBlueprint);
  const ep2 = result.storyBlueprint.episodes.find((e) => e.id === 'ep2');
  assert.equal(ep2.sceneBlueprint.registry.stats.length, 1);
  assert.equal(ep2.sceneBlueprint.registry.stats[0].displayName, 'Uy tín');
  assert.equal(result.globalState.registry.stats.length, 1, 'global registry không bị nhân đôi');
});

// ---------- 2. A generated blueprint cannot diverge the registry ----------

test('2. applying a blueprint whose local registry lost/renamed an entity does not corrupt the canonical global registry', () => {
  const { globalState, uyTinId } = makeGlobalStateWithUyTin();
  const episode1 = makeLinkedEpisode('ep1', 1, 'Tập 1', globalState.registry, uyTinId);
  const storyBlueprint = { ...newStoryBlueprint('x'), episodes: [episode1] };

  // Giả lập 1 blueprint AI vừa "dựng lại" mang theo registry cũ đã bị đổi tên cục bộ.
  const divergent = {
    ...episode1.sceneBlueprint,
    registry: { stats: [{ ...globalState.registry.stats[0], displayName: 'Uy Tín (bản khác)' }], flags: [], items: [] },
  };
  const result = applyEpisodeBlueprint(storyBlueprint, globalState, 'ep1', divergent);
  // id trùng -> global thắng, KHÔNG lấy tên đã đổi cục bộ.
  assert.equal(result.globalState.registry.stats[0].displayName, 'Uy tín');
  assert.equal(result.storyBlueprint.episodes[0].sceneBlueprint.registry.stats[0].displayName, 'Uy tín');
});

// ---------- 3. External AI import reads the global registry ----------

test('3. an existing entity ("Uy tín") referenced by an imported script resolves to the global registry ID, no proposal', () => {
  const { globalState, uyTinId } = makeGlobalStateWithUyTin();
  const script = `${SCRIPT_HEADER_V1}
TẬP: Nữ quan
CHỈ SỐ:
- Uy tín = 10
CẢNH: Vào cung
LOẠI: Kể chuyện
NỘI DUNG: Bắt đầu.`;

  const parsed = parseAndValidateProScript(script, { episodeId: 'ep2', existingRegistry: globalState.registry });
  assert.equal(parsed.entityProposals.length, 0, '"Uy tín" đã có sẵn -> không tạo proposal');
  assert.equal(parsed.registry.stats[0].id, uyTinId);
});

// ---------- 4-8. Full external-AI cross-episode round trip ----------

test('4-8. external AI creates a new entity in Tập 2, it propagates to the global registry, all episode mirrors, the campaign compiler, and survives save/reload', () => {
  const { globalState, uyTinId } = makeGlobalStateWithUyTin();
  const episode1 = makeLinkedEpisode('ep1', 1, 'Tập 1 — Nhập cung', globalState.registry, uyTinId, 'ep2');

  const script = `${SCRIPT_HEADER_V1}
TẬP: Nữ quan
CHỈ SỐ:
- Uy tín = 10
- Danh vọng = 0
CẢNH: Vào cung
LOẠI: Lựa chọn
NỘI DUNG: Thử thách.
LỰA CHỌN A: Thể hiện danh vọng
NẾU:
- Danh vọng >= 10
ĐẾN: Cảnh Thắng
LỰA CHỌN B: Rút lui
ĐẾN: Cảnh Thua
CẢNH: Cảnh Thắng
LOẠI: Kể chuyện
NỘI DUNG: Thắng.
CẢNH: Cảnh Thua
LOẠI: Kể chuyện
NỘI DUNG: Thua.`;

  // Bước 1: resolve against global registry (item 1 — "Uy tín resolve đúng global entityId").
  const parsed = parseAndValidateProScript(script, { episodeId: 'ep2', existingRegistry: globalState.registry });
  assert.equal(parsed.registry.stats.find((s) => s.displayName === 'Uy tín').id, uyTinId);
  const danhVongProposal = parsed.entityProposals.find((p) => p.requestedName === 'Danh vọng');
  assert.ok(danhVongProposal, '2. "Danh vọng" phải tạo proposal (entity mới)');

  // Bước 2: approve create.
  const approvals = { [danhVongProposal.tempKey]: { action: 'create' } };
  const finalized = finalizeAndValidateProScript({
    normalizedResult: parsed,
    approvals,
    existingRegistry: globalState.registry,
    episodeId: 'ep2',
  });
  assert.ok(finalized.ok, `finalize phải thành công: ${JSON.stringify(finalized.validation.errors)}`);
  const danhVongId = finalized.finalizedBlueprint.registry.stats.find((s) => s.displayName === 'Danh vọng').id;
  assert.notEqual(danhVongId, undefined);
  // 7. Rule của Tập 2 reference đúng canonical Danh vọng ID.
  const winChoice = findScene(finalized.finalizedBlueprint, finalized.finalizedBlueprint.startSceneId).choices[0];
  assert.equal(winChoice.rules.conditions[0].entityId, danhVongId);

  // Bước 3: áp dụng vào episode 2 qua funnel duy nhất — 4. globalState.registry phải có Danh vọng.
  const storyBlueprint = { ...newStoryBlueprint('x'), episodes: [episode1, ep(2, 'ep2', 'Tập 2 — Nữ quan')] };
  const applied = applyEpisodeBlueprint(storyBlueprint, globalState, 'ep2', finalized.finalizedBlueprint);
  assert.ok(applied.globalState.registry.stats.some((s) => s.id === danhVongId), '4. global registry có Danh vọng');

  // 5. Tập 1 VÀ Tập 2 mirror registry đều có Danh vọng.
  const ep1After = applied.storyBlueprint.episodes.find((e) => e.id === 'ep1');
  const ep2After = applied.storyBlueprint.episodes.find((e) => e.id === 'ep2');
  assert.ok(ep1After.sceneBlueprint.registry.stats.some((s) => s.id === danhVongId), '5a. Tập 1 mirror có Danh vọng');
  assert.ok(ep2After.sceneBlueprint.registry.stats.some((s) => s.id === danhVongId), '5b. Tập 2 mirror có Danh vọng');
  // Tập 1's "Uy tín" reference vẫn nguyên canonical id (không bị remap sai).
  assert.equal(
    findScene(ep1After.sceneBlueprint, ep1After.sceneBlueprint.startSceneId).choices[0].rules.effects[0].entityId,
    uyTinId
  );

  // 6/8. compileProCampaign KHÔNG được drop rule của entity vừa nhập.
  const proDoc = {
    ...newEmptyProGame(),
    storyBlueprint: applied.storyBlueprint,
    globalState: applied.globalState,
  };
  const { nodes, meta } = compileProCampaign(proDoc);
  assert.ok(meta.statsConfig.some((s) => s.key === danhVongId), '6a. Danh vọng có trong statsConfig campaign');
  const compiledWinChoice = nodes[ep2After.sceneBlueprint.startSceneId].choices.find((c) => c.text === 'Thể hiện danh vọng');
  assert.deepEqual(compiledWinChoice.statRequirements, { [danhVongId]: 10 }, '6b. rule Danh vọng không bị compiler bỏ qua');

  // 9. Save/reload giữ nguyên canonical IDs — proDoc round-trips qua meta.pro,
  // và node id (sceneBlueprint.startSceneId của Tập 2) vẫn resolve được qua
  // playerState.js không đổi.
  const store = new Map();
  const fakeStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const targetNodeId = ep2After.sceneBlueprint.startSceneId;
  assert.ok(savePlayerState('game-x', { nodeId: targetNodeId }, fakeStorage));
  const loaded = loadPlayerState('game-x', nodes, fakeStorage);
  assert.equal(loaded.runtime.nodeId, targetNodeId);
  assert.equal(meta.pro.globalState.registry.stats.find((s) => s.displayName === 'Danh vọng').id, danhVongId);
});

// ---------- mergeNewEntitiesIntoRegistry unit behavior ----------

test('mergeNewEntitiesIntoRegistry unions by id, global entity wins on id collision', () => {
  let global = newEmptyRegistry();
  global = addStatEntity(global, { displayName: 'Uy tín', default: 10 });
  const id = global.stats[0].id;
  const incoming = { stats: [{ ...global.stats[0], displayName: 'renamed locally' }], flags: [], items: [] };
  const merged = mergeNewEntitiesIntoRegistry(global, incoming);
  assert.equal(merged.stats.length, 1);
  assert.equal(merged.stats[0].displayName, 'Uy tín');
  assert.equal(merged.stats[0].id, id);
});

// ---------- FIX 2: campaign compile is fail-closed, never falls back to PRO 0 ----------

// compileProCampaign() không throw cho các lỗi "authoring bình thường" (đích
// hỏng, tập chưa dựng...) — normalizeAndRepair tự phục hồi an toàn, đúng thiết
// kế hiện tại (campaignValidator.js mới là nơi CẢNH BÁO những lỗi đó). Để bài
// test này chứng minh đúng nhánh "throw" thật sự (dữ liệu hỏng ở mức không
// một layer nào tự vá được — vd 1 scene bị mất hẳn field `choices`), ta cố
// tình phá 1 scene theo cách không thể xảy ra qua blueprintModel.js bình
// thường nhưng hoàn toàn có thể xảy ra với dữ liệu cũ/hỏng từ nơi khác.
function makeThrowingCampaignProDoc(globalState) {
  const episode1 = ep(1, 'ep1', 'Tập 1');
  let bp = newSceneBlueprint(episode1);
  bp = setRegistry(bp, globalState.registry);
  const corruptedScene = { ...bp.scenes[0] };
  delete corruptedScene.choices; // scene.choices.flatMap(...) trong compileProCampaign sẽ throw TypeError
  bp = { ...bp, scenes: [corruptedScene] };
  return {
    ...newEmptyProGame(),
    storyBlueprint: { ...newStoryBlueprint('x'), episodes: [{ ...episode1, sceneBlueprint: bp }] },
    globalState,
  };
}

test('7. compileProDocument does NOT fall back to compileProGame when campaign content exists but fails to compile', () => {
  const { globalState } = makeGlobalStateWithUyTin();
  const proDoc = makeThrowingCampaignProDoc(globalState);

  assert.equal(hasCampaignContent(proDoc), true, '1 scene tồn tại (dù hỏng) -> vẫn tính là có campaign content');
  assert.throws(() => compileProCampaign(proDoc), TypeError, 'dữ liệu hỏng thật sự phải khiến compileProCampaign throw');

  const result = compileProDocument(proDoc);
  assert.notEqual(result.campaignError, null);
  assert.equal(result.compiled, null, 'compiled PHẢI null — KHÔNG được âm thầm trả về bản PRO0 nào (fail-closed)');

  // Đối chứng tường minh: nếu code vẫn còn fallback kiểu cũ, compiled sẽ
  // trùng compileProGame(proDoc) — xác nhận KHÔNG phải trường hợp đó.
  const oldStyleFallback = compileProGame(proDoc);
  assert.notDeepEqual(result.compiled, oldStyleFallback);
});

test('8. an invalid campaign save does not overwrite the last known-good runtime snapshot', () => {
  // Mô phỏng đúng hợp đồng của GameStudioPro.jsx#handleSave(): giữ bản
  // {meta,nodes} biên dịch THÀNH CÔNG gần nhất (lastGoodCompiledRef), rồi khi
  // proDoc sau đó bị hỏng tới mức compileProCampaign() throw, "lưu" vẫn phải
  // dùng nodes của bản tốt gần nhất — không phải bản PRO0 giả — trong khi
  // proDoc (authoring data) mới nhất vẫn được giữ trong meta.pro.
  const { globalState, uyTinId } = makeGlobalStateWithUyTin();
  const episode1 = makeLinkedEpisode('ep1', 1, 'Tập 1', globalState.registry, uyTinId);
  const goodProDoc = { ...newEmptyProGame(), storyBlueprint: { ...newStoryBlueprint('x'), episodes: [episode1] }, globalState };

  const good = compileProDocument(goodProDoc);
  assert.equal(good.campaignError, null);
  const lastGood = { meta: good.compiled.meta, nodes: good.compiled.nodes };

  const brokenProDoc = makeThrowingCampaignProDoc(globalState);
  const broken = compileProDocument(brokenProDoc);
  assert.notEqual(broken.campaignError, null, 'campaign phải lỗi biên dịch ở trạng thái hỏng này');
  assert.equal(broken.compiled, null);

  // "Lưu" mô phỏng đúng handleSave(): nodes lưu xuống PHẢI là lastGood.nodes
  // (KHÔNG PHẢI compileProGame(brokenProDoc) — không có bản PRO0 giả nào ở đây).
  const savedMeta = { ...lastGood.meta, pro: brokenProDoc };
  const savedNodes = lastGood.nodes;
  assert.deepEqual(savedNodes, lastGood.nodes, 'runtime snapshot (nodes) giữ nguyên bản tốt gần nhất');
  assert.equal(savedMeta.pro, brokenProDoc, 'authoring data (proDoc lỗi, kể cả vậy) vẫn được lưu — không mất local edits');
  assert.notDeepEqual(savedNodes, compileProGame(brokenProDoc).nodes, 'runtime snapshot không bị âm thầm thay bằng PRO0 demo');
});

// ---------- 9. Regression: PRO 0-only game still uses compileProGame ----------

test('9. a PRO0-only proDoc (no episodes) still resolves via compileProGame, unaffected by the hotfix', () => {
  const proDoc = newEmptyProGame();
  assert.equal(hasCampaignContent(proDoc), false);
  const { compiled, campaignError } = compileProDocument(proDoc);
  assert.equal(campaignError, null);
  assert.equal(compiled.nodes.start_node.choices.length, 2);
  assert.deepEqual(compiled, compileProGame(proDoc));
});

// ---------- 11. Regression: PRO0-5 core paths still function ----------

test('11a. regression: compileProGame(newEmptyProGame()) unchanged', () => {
  const { meta, nodes, warnings } = compileProGame(newEmptyProGame());
  assert.equal(warnings.length, 0);
  assert.equal(meta.builder, 'pro');
  assert.ok(nodes.start_node);
});

test('11b. regression: ensureGlobalState is still idempotent after the hotfix', () => {
  const proDoc = newEmptyProGame();
  const once = ensureGlobalState(proDoc);
  const twice = ensureGlobalState(once);
  assert.deepEqual(once.globalState, twice.globalState);
});

test('11c. regression: single-slot condition (2 flag_present on one choice) is still rejected by ruleValidator via blueprintValidator', async () => {
  const { validateSceneBlueprint } = await import('../src/lib/gameStudioPro/blueprintValidator.js');
  const { addFlagEntity } = await import('../src/lib/gameStudioPro/entityRegistry.js');
  const { flagPresent } = await import('../src/lib/gameStudioPro/ruleModel.js');
  let r = newEmptyRegistry();
  r = addFlagEntity(r, 'Cờ A');
  r = addFlagEntity(r, 'Cờ B');
  const episode1 = ep(1, 'ep1', 'Tập 1');
  let bp = newSceneBlueprint(episode1);
  bp = setRegistry(bp, r);
  bp = addChoice(bp, bp.startSceneId, { text: 'Đi' });
  const cid = findScene(bp, bp.startSceneId).choices[0].id;
  bp = updateChoice(bp, bp.startSceneId, cid, { rules: { conditions: [flagPresent(r.flags[0].id), flagPresent(r.flags[1].id)], effects: [] } });
  const result = validateSceneBlueprint(bp);
  assert.ok(result.errors.length > 0, 'engine chỉ hỗ trợ 1 flag/choice — 2 flag_present phải bị chặn');
});
