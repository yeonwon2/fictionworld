import test from 'node:test';
import assert from 'node:assert/strict';

import { newEmptyProGame } from '../src/lib/gameStudioPro/proModel.js';
import { compileProGame, compileProCampaign, compileEpisodeBlueprint } from '../src/lib/gameStudioPro/proCompiler.js';
import { newStoryBlueprint, newBlankEpisode } from '../src/lib/gameStudioPro/plannerModel.js';
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
} from '../src/lib/gameStudioPro/blueprintModel.js';
import {
  newEmptyRegistry,
  addStatEntity,
  addRelationshipEntity,
  addFlagEntity,
  addItemEntity,
} from '../src/lib/gameStudioPro/entityRegistry.js';
import { statCompare, flagPresent, itemPresent, statChange, grantFlag, grantItem, removeItem } from '../src/lib/gameStudioPro/ruleModel.js';
import { validateCampaign } from '../src/lib/gameStudioPro/campaignValidator.js';
import {
  newEmptyGlobalState,
  ensureGlobalState,
  migrateEpisodeRegistriesToGlobal,
  syncRegistryToAllEpisodes,
  episodeTransitionSummary,
} from '../src/lib/gameStudioPro/globalStateModel.js';
import { buildRoutes, graphReachable } from '../src/lib/gameStudio/routeExplorer.js';
import { loadPlayerState, savePlayerState } from '../src/lib/gameStudio/playerState.js';

function ep(order, id, title) {
  return { ...newBlankEpisode(order), id, title };
}

// ---------- Global state shape ----------

test('newEmptyGlobalState() has an empty canonical registry and no start episode', () => {
  const gs = newEmptyGlobalState();
  assert.equal(gs.version, 1);
  assert.deepEqual(gs.registry, { stats: [], flags: [], items: [] });
  assert.equal(gs.startEpisodeId, null);
});

test('ensureGlobalState() adds a well-formed globalState to a bare proDoc without episodes', () => {
  const proDoc = { ...newEmptyProGame(), globalState: undefined, storyBlueprint: null };
  const next = ensureGlobalState(proDoc);
  assert.deepEqual(next.globalState.registry, { stats: [], flags: [], items: [] });
});

test('ensureGlobalState() is idempotent once a global registry already has data', () => {
  let registry = newEmptyRegistry();
  registry = addStatEntity(registry, { displayName: 'Uy tín', default: 10 });
  const proDoc = { ...newEmptyProGame(), globalState: { version: 1, registry, startEpisodeId: null } };
  const once = ensureGlobalState(proDoc);
  const twice = ensureGlobalState(once);
  assert.deepEqual(once.globalState, twice.globalState);
});

// ---------- Legacy per-episode registry migration ----------

function bareBlueprintWithStat(episodeId, displayName, kind = 'stat', extra = {}) {
  let r = newEmptyRegistry();
  if (kind === 'stat') r = addStatEntity(r, { displayName, ...extra });
  else if (kind === 'relationship') r = addRelationshipEntity(r, { displayName, ...extra });
  else if (kind === 'flag') r = addFlagEntity(r, displayName);
  const entity = kind === 'flag' ? r.flags[0] : r.stats[0];
  const episode = ep(1, episodeId, `Tập ${episodeId}`);
  let bp = newSceneBlueprint(episode);
  bp = setRegistry(bp, r);
  bp = addChoice(bp, bp.startSceneId, { text: 'Đi' });
  const cid = findScene(bp, bp.startSceneId).choices[0].id;
  bp = updateChoice(bp, bp.startSceneId, cid, { rules: { conditions: [statCompare(entity.id, '>=', 1)], effects: [] } });
  return { episode: { ...episode, sceneBlueprint: bp }, entity };
}

test('migration merges the same stat name+kind across episodes into one canonical entity and remaps rule references', () => {
  const a = bareBlueprintWithStat('epA', 'Uy tín', 'stat', { default: 10 });
  const b = bareBlueprintWithStat('epB', 'uy tín', 'stat', { default: 5 }); // different case/no diacritic-sensitive match still normalizes equal
  const storyBlueprint = { ...newStoryBlueprint('x'), episodes: [a.episode, b.episode] };

  const result = migrateEpisodeRegistriesToGlobal(storyBlueprint);
  assert.equal(result.registry.stats.length, 1);
  assert.equal(result.idRemap.get(b.entity.id), a.entity.id);

  const bChoice = findScene(result.storyBlueprint.episodes[1].sceneBlueprint, result.storyBlueprint.episodes[1].sceneBlueprint.startSceneId).choices[0];
  assert.equal(bChoice.rules.conditions[0].entityId, a.entity.id);
});

test('migration does NOT merge same name across different kinds — keeps both, warns', () => {
  const a = bareBlueprintWithStat('epA', 'Danh vọng', 'stat');
  const b = bareBlueprintWithStat('epB', 'Danh vọng', 'flag');
  const storyBlueprint = { ...newStoryBlueprint('x'), episodes: [a.episode, b.episode] };

  const result = migrateEpisodeRegistriesToGlobal(storyBlueprint);
  assert.equal(result.registry.stats.length, 1);
  assert.equal(result.registry.flags.length, 1);
  assert.ok(result.warnings.some((w) => w.includes('Danh vọng')));
});

test('migration does NOT merge relationships with the same label but different NPC — keeps both, warns', () => {
  const a = bareBlueprintWithStat('epA', 'Sủng ái', 'relationship', { npc: 'Lệ Phi' });
  const b = bareBlueprintWithStat('epB', 'Sủng ái', 'relationship', { npc: 'Lệ Phi Nương' });
  const storyBlueprint = { ...newStoryBlueprint('x'), episodes: [a.episode, b.episode] };

  const result = migrateEpisodeRegistriesToGlobal(storyBlueprint);
  assert.equal(result.registry.stats.length, 2); // relationships live in the "stats" collection
  assert.ok(result.warnings.some((w) => w.toLowerCase().includes('quan hệ')));
});

test('syncRegistryToAllEpisodes mirrors one registry object into every episode with a blueprint', () => {
  const a = bareBlueprintWithStat('epA', 'Uy tín');
  const noBlueprintEpisode = ep(2, 'epB', 'Tập chưa dựng');
  const storyBlueprint = { ...newStoryBlueprint('x'), episodes: [a.episode, noBlueprintEpisode] };
  const registry = newEmptyRegistry();
  const next = syncRegistryToAllEpisodes(storyBlueprint, registry);
  assert.equal(next.episodes[0].sceneBlueprint.registry, registry);
  assert.equal(next.episodes[1].sceneBlueprint, undefined);
});

// ---------- Mandatory 3-episode scenario (Nhập cung / Nữ quan / Hậu cung) ----------

function buildMandatoryCampaign() {
  let registry = newEmptyRegistry();
  registry = addStatEntity(registry, { displayName: 'Uy tín', default: 10 });
  registry = addRelationshipEntity(registry, { displayName: 'Sủng ái Lệ Phi', npc: 'Lệ Phi', default: 0 });
  registry = addFlagEntity(registry, 'Đã cứu Tiểu Lan');
  registry = addItemEntity(registry, 'Ngọc bội');
  const uyTinId = registry.stats.find((e) => e.displayName === 'Uy tín').id;
  const relId = registry.stats.find((e) => e.displayName === 'Sủng ái Lệ Phi').id;
  const flagId = registry.flags[0].id;
  const itemId = registry.items[0].id;

  // ---- Tập 1 — Nhập cung ----
  const episode1 = ep(1, 'ep1', 'Tập 1 — Nhập cung');
  let bp1 = newSceneBlueprint(episode1);
  bp1 = setRegistry(bp1, registry);
  const ep1Start = bp1.startSceneId;
  bp1 = addScene(bp1, SCENE_ROLES.DECISION, { title: 'Lấy Ngọc bội?' });
  const ep1S2 = bp1.scenes[bp1.scenes.length - 1].id;
  bp1 = addScene(bp1, SCENE_ROLES.STORY, { title: 'Kết thúc Tập 1' });
  const ep1S3 = bp1.scenes[bp1.scenes.length - 1].id;

  bp1 = addChoice(bp1, ep1Start, { text: 'Cứu Tiểu Lan' });
  let cid = findScene(bp1, ep1Start).choices[0].id;
  bp1 = connectChoice(bp1, ep1Start, cid, 'scene', ep1S2);
  bp1 = updateChoice(bp1, ep1Start, cid, { rules: { conditions: [], effects: [statChange(uyTinId, 10), grantFlag(flagId)] } });

  bp1 = addChoice(bp1, ep1Start, { text: 'Bỏ qua' });
  cid = findScene(bp1, ep1Start).choices[1].id;
  bp1 = connectChoice(bp1, ep1Start, cid, 'scene', ep1S2);

  bp1 = addChoice(bp1, ep1S2, { text: 'Lấy Ngọc bội' });
  cid = findScene(bp1, ep1S2).choices[0].id;
  bp1 = connectChoice(bp1, ep1S2, cid, 'scene', ep1S3);
  bp1 = updateChoice(bp1, ep1S2, cid, { rules: { conditions: [], effects: [grantItem(itemId)] } });

  bp1 = addChoice(bp1, ep1S2, { text: 'Bỏ qua' });
  cid = findScene(bp1, ep1S2).choices[1].id;
  bp1 = connectChoice(bp1, ep1S2, cid, 'scene', ep1S3);

  bp1 = addChoice(bp1, ep1S3, { text: 'Sang Tập 2' });
  cid = findScene(bp1, ep1S3).choices[0].id;
  bp1 = connectChoice(bp1, ep1S3, cid, 'episode', 'ep2');

  // ---- Tập 2 — Nữ quan ----
  const episode2 = ep(2, 'ep2', 'Tập 2 — Nữ quan');
  let bp2 = newSceneBlueprint(episode2);
  bp2 = setRegistry(bp2, registry);
  const ep2Start = bp2.startSceneId;
  bp2 = addScene(bp2, SCENE_ROLES.STORY, { title: 'Dâng Ngọc bội' });
  const ep2S2 = bp2.scenes[bp2.scenes.length - 1].id;
  bp2 = addScene(bp2, SCENE_ROLES.STORY, { title: 'Kết thúc Tập 2' });
  const ep2S3 = bp2.scenes[bp2.scenes.length - 1].id;

  bp2 = addChoice(bp2, ep2Start, { text: 'Vào route đặc biệt' });
  cid = findScene(bp2, ep2Start).choices[0].id;
  bp2 = connectChoice(bp2, ep2Start, cid, 'scene', ep2S2);
  bp2 = updateChoice(bp2, ep2Start, cid, { rules: { conditions: [flagPresent(flagId)], effects: [] } });

  bp2 = addChoice(bp2, ep2S2, { text: 'Dâng Ngọc bội' });
  cid = findScene(bp2, ep2S2).choices[0].id;
  bp2 = connectChoice(bp2, ep2S2, cid, 'scene', ep2S3);
  bp2 = updateChoice(bp2, ep2S2, cid, { rules: { conditions: [itemPresent(itemId)], effects: [removeItem(itemId), statChange(relId, 8)] } });

  bp2 = addChoice(bp2, ep2S3, { text: 'Sang Tập 3' });
  cid = findScene(bp2, ep2S3).choices[0].id;
  bp2 = connectChoice(bp2, ep2S3, cid, 'episode', 'ep3');

  // ---- Tập 3 — Hậu cung ----
  const episode3 = ep(3, 'ep3', 'Tập 3 — Hậu cung');
  let bp3 = newSceneBlueprint(episode3);
  bp3 = setRegistry(bp3, registry);
  const ep3Start = bp3.startSceneId;
  bp3 = addEnding(bp3, { title: 'Kết tốt — Được sủng ái', text: 'Kết tốt.', tone: 'good' });
  const goodEnding = bp3.endings[0];
  bp3 = addEnding(bp3, { title: 'Kết thường', text: 'Kết thường.', tone: 'neutral' });
  const neutralEnding = bp3.endings[1];

  bp3 = addChoice(bp3, ep3Start, { text: 'Được sủng ái' });
  cid = findScene(bp3, ep3Start).choices[0].id;
  bp3 = connectChoice(bp3, ep3Start, cid, 'ending', goodEnding.id);
  bp3 = updateChoice(bp3, ep3Start, cid, { rules: { conditions: [statCompare(relId, '>=', 5)], effects: [] } });

  bp3 = addChoice(bp3, ep3Start, { text: 'Bình thường' });
  cid = findScene(bp3, ep3Start).choices[1].id;
  bp3 = connectChoice(bp3, ep3Start, cid, 'ending', neutralEnding.id);
  bp3 = updateChoice(bp3, ep3Start, cid, { rules: { conditions: [statCompare(relId, '<', 5)], effects: [] } });

  const storyBlueprint = {
    ...newStoryBlueprint('cung đấu 3 tập'),
    gamePlan: { title: 'Cung Đấu Ký' },
    episodes: [
      { ...episode1, sceneBlueprint: bp1 },
      { ...episode2, sceneBlueprint: bp2 },
      { ...episode3, sceneBlueprint: bp3 },
    ],
  };
  const proDoc = {
    ...newEmptyProGame(),
    title: 'Cung Đấu Ký',
    storyBlueprint,
    globalState: { version: 1, registry, startEpisodeId: 'ep1' },
  };
  return { proDoc, uyTinId, relId, flagId, itemId, ep1Start, ep1S2, ep1S3, ep2Start, ep2S2, ep2S3, ep3Start, goodEnding, neutralEnding };
}

test('mandatory 3-episode scenario: campaign compiles to one unified graph starting at Tập 1', () => {
  const { proDoc, ep1Start } = buildMandatoryCampaign();
  const { meta, nodes } = compileProCampaign(proDoc);
  assert.ok(nodes.start_node, 'start_node phải tồn tại');
  assert.equal(nodes.start_node.choices.map((c) => c.text).sort().join(','), ['Bỏ qua', 'Cứu Tiểu Lan'].join(','));
  assert.equal(nodes[ep1Start], undefined, 'scene bắt đầu của tập bắt đầu phải được đổi tên thành start_node, không còn id gốc');
  assert.ok(meta.statsConfig.some((s) => s.label === 'Uy tín'));
});

test('mandatory 3-episode scenario: carries stats/flags/items across episode transitions to the good ending', () => {
  const { proDoc, uyTinId, relId, ep1S3, ep2S3 } = buildMandatoryCampaign();
  const { nodes, meta } = compileProCampaign(proDoc);
  const { routes } = buildRoutes(nodes, meta.statsConfig);

  const successRoute = routes.find((r) => r.status === 'ok' && nodes[r.endingId]?.title === 'Kết tốt — Được sủng ái');
  assert.ok(successRoute, 'phải có ít nhất 1 tuyến hoàn chỉnh tới "Kết tốt"');

  // Trạng thái ngay khi vừa sang Tập 2 (mục 22: "Tập 2 bắt đầu phải thấy").
  const enterEp2Step = successRoute.steps.find((s) => s.sceneId === ep1S3);
  assert.equal(enterEp2Step.stateAfter.stats[uyTinId], 20);
  assert.ok(enterEp2Step.stateAfter.flags.has('Đã cứu Tiểu Lan'));
  assert.ok(enterEp2Step.stateAfter.items.has('Ngọc bội'));

  // Trạng thái ngay khi vừa sang Tập 3.
  const enterEp3Step = successRoute.steps.find((s) => s.sceneId === ep2S3);
  assert.equal(enterEp3Step.stateAfter.stats[uyTinId], 20);
  assert.equal(enterEp3Step.stateAfter.npcAffinity['Lệ Phi'], 8);
  assert.ok(!enterEp3Step.stateAfter.items.has('Ngọc bội'));
  assert.ok(enterEp3Step.stateAfter.flags.has('Đã cứu Tiểu Lan'));

  // Trạng thái cuối cùng (ngay trước khi vào "Kết tốt").
  const finalState = successRoute.steps[successRoute.steps.length - 1].stateAfter;
  assert.equal(finalState.stats[uyTinId], 20);
  assert.equal(finalState.npcAffinity['Lệ Phi'], 8);
  assert.ok(!finalState.items.has('Ngọc bội'));
});

test('mandatory 3-episode scenario: a real (isEnding) game ending is structurally reachable', () => {
  const { proDoc } = buildMandatoryCampaign();
  const { nodes } = compileProCampaign(proDoc);
  const { endings } = graphReachable(nodes);
  assert.ok(endings.length >= 1);
});

// ---------- Save/reload representation (item 14/24) ----------

test('a saved mid-campaign node (deep in episode 3) round-trips through the existing playerState.js unmodified', () => {
  const { proDoc, ep3Start } = buildMandatoryCampaign();
  const { nodes } = compileProCampaign(proDoc);
  const store = new Map();
  const fakeStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  const runtime = { nodeId: ep3Start, stats: {}, flags: [], inventory: [], npcAffinity: {}, history: [] };
  assert.ok(savePlayerState('game-1', runtime, fakeStorage));
  const loaded = loadPlayerState('game-1', nodes, fakeStorage);
  assert.equal(loaded.runtime.nodeId, ep3Start);
});

// ---------- compileProCampaign purity / stable IDs ----------

test('compileProCampaign is pure and deterministic — same input compiles to the same output twice', () => {
  const { proDoc } = buildMandatoryCampaign();
  const a = compileProCampaign(structuredClone(proDoc));
  const b = compileProCampaign(structuredClone(proDoc));
  assert.deepEqual(a.nodes, b.nodes);
  assert.deepEqual(a.meta.statsConfig, b.meta.statsConfig);
});

test('reordering episodes does not change any compiled node id (start episode pinned by globalState.startEpisodeId)', () => {
  const { proDoc } = buildMandatoryCampaign();
  const before = compileProCampaign(proDoc);
  const reordered = {
    ...proDoc,
    storyBlueprint: {
      ...proDoc.storyBlueprint,
      episodes: [proDoc.storyBlueprint.episodes[2], proDoc.storyBlueprint.episodes[0], proDoc.storyBlueprint.episodes[1]].map((e, i) => ({ ...e, order: i + 1 })),
    },
  };
  const after = compileProCampaign(reordered);
  assert.deepEqual(Object.keys(before.nodes).sort(), Object.keys(after.nodes).sort());
});

test('renaming an entity displayName does not change any compiled scene/ending id', () => {
  const { proDoc, uyTinId } = buildMandatoryCampaign();
  const before = compileProCampaign(proDoc);
  const renamed = {
    ...proDoc,
    globalState: {
      ...proDoc.globalState,
      registry: {
        ...proDoc.globalState.registry,
        stats: proDoc.globalState.registry.stats.map((e) => (e.id === uyTinId ? { ...e, displayName: 'Danh Vọng' } : e)),
      },
    },
  };
  const after = compileProCampaign(renamed);
  assert.deepEqual(Object.keys(before.nodes).sort(), Object.keys(after.nodes).sort());
  assert.equal(after.meta.statsConfig.find((s) => s.key === uyTinId).label, 'Danh Vọng');
});

// ---------- Campaign validator ----------

test('validateCampaign errors when no episode has a blueprint yet', () => {
  const storyBlueprint = { ...newStoryBlueprint('x'), episodes: [ep(1, 'ep1', 'Tập 1')] };
  const result = validateCampaign({ storyBlueprint, globalState: newEmptyGlobalState() });
  assert.ok(result.errors.length > 0);
});

test('validateCampaign errors on an episode-transition choice pointing at an unknown episode', () => {
  const episode1 = ep(1, 'ep1', 'Tập 1');
  let bp = newSceneBlueprint(episode1);
  bp = addChoice(bp, bp.startSceneId, { text: 'Đi' });
  const cid = findScene(bp, bp.startSceneId).choices[0].id;
  bp = connectChoice(bp, bp.startSceneId, cid, 'episode', 'ep_missing');
  const storyBlueprint = { ...newStoryBlueprint('x'), episodes: [{ ...episode1, sceneBlueprint: bp }] };
  const result = validateCampaign({ storyBlueprint, globalState: { ...newEmptyGlobalState(), startEpisodeId: 'ep1' } });
  assert.ok(result.errors.some((e) => e.includes('tập không tồn tại')));
});

test('validateCampaign warns on an episode unreachable from the start episode', () => {
  const { proDoc } = buildMandatoryCampaign();
  // Thêm 1 tập thứ 4 không tập nào trỏ tới.
  const orphan = { ...ep(4, 'ep4', 'Tập lạc'), sceneBlueprint: (() => {
    const e = ep(4, 'ep4', 'Tập lạc');
    let bp = newSceneBlueprint(e);
    bp = addEnding(bp, { title: 'Kết', text: '' });
    bp = addChoice(bp, bp.startSceneId, { text: 'Đi' });
    const cid = findScene(bp, bp.startSceneId).choices[0].id;
    bp = connectChoice(bp, bp.startSceneId, cid, 'ending', bp.endings[0].id);
    return bp;
  })() };
  const storyBlueprint = { ...proDoc.storyBlueprint, episodes: [...proDoc.storyBlueprint.episodes, orphan] };
  const result = validateCampaign({ ...proDoc, storyBlueprint });
  assert.ok(result.warnings.some((w) => w.includes('không thể tới được')));
});

// Lưu ý: KHÔNG có test "no reachable real ending" riêng — normalizeAndRepair
// (postprocess.js, dùng chung bởi mọi compiler Pro) tự động biến mọi cảnh cụt
// (không lựa chọn/mồ côi) thành 1 kết thúc tổng hợp, nên trên thực tế luôn có
// ít nhất 1 kết thúc thật sau khi normalizeAndRepair chạy — validateCampaign's
// check "endings.length === 0" là phòng thủ (an toàn nếu hành vi
// normalizeAndRepair đổi sau này), không phản ánh 1 tình huống dựng được bằng
// blueprintModel.js hiện tại.

test('validateCampaign surfaces per-episode blueprint errors prefixed with the episode title', () => {
  const episode1 = ep(1, 'ep1', 'Tập Lỗi');
  let bp = newSceneBlueprint(episode1);
  bp = addChoice(bp, bp.startSceneId, { text: 'Đi' }); // chưa nối đi đâu -> lỗi cấu trúc
  const storyBlueprint = { ...newStoryBlueprint('x'), episodes: [{ ...episode1, sceneBlueprint: bp }] };
  const result = validateCampaign({ storyBlueprint, globalState: { ...newEmptyGlobalState(), startEpisodeId: 'ep1' } });
  assert.ok(result.errors.some((e) => e.startsWith('Tập "Tập Lỗi"')));
});

// ---------- episodeTransitionSummary ----------

test('episodeTransitionSummary reports outgoing/incoming episode transitions purely from choice targets', () => {
  const { proDoc } = buildMandatoryCampaign();
  const ep1Summary = episodeTransitionSummary(proDoc.storyBlueprint, 'ep1');
  assert.deepEqual(ep1Summary.outgoing, ['ep2']);
  assert.deepEqual(ep1Summary.incoming, []);
  const ep2Summary = episodeTransitionSummary(proDoc.storyBlueprint, 'ep2');
  assert.deepEqual(ep2Summary.incoming, ['ep1']);
});

// ---------- Regression: PRO 0/2 compiler paths untouched ----------

test('regression: compileProGame(newEmptyProGame()) is unchanged by PRO 5', () => {
  const { meta, nodes, warnings } = compileProGame(newEmptyProGame());
  assert.equal(warnings.length, 0);
  assert.equal(meta.builder, 'pro');
  assert.ok(nodes.start_node);
  assert.equal(nodes.start_node.choices.length, 2);
});

test('regression: compileEpisodeBlueprint still compiles a single isolated episode without episodesById', () => {
  const episode = ep(1, 'ep_solo', 'Tập đơn lẻ');
  let bp = newSceneBlueprint(episode);
  bp = addEnding(bp, { title: 'Kết', text: 'Hết.' });
  bp = addChoice(bp, bp.startSceneId, { text: 'Đi' });
  const cid = findScene(bp, bp.startSceneId).choices[0].id;
  bp = connectChoice(bp, bp.startSceneId, cid, 'ending', bp.endings[0].id);
  const { nodes } = compileEpisodeBlueprint(bp, { title: 'Tập đơn lẻ' });
  assert.ok(nodes.start_node);
  assert.equal(nodes.start_node.choices[0].targetNodeId, bp.endings[0].id);
});

test('compileEpisodeBlueprint synthesizes a readable ending for an unresolvable "episode" target when episodesById is given', () => {
  const episode = ep(1, 'ep_solo', 'Tập đơn lẻ');
  const target = ep(2, 'ep_next', 'Tập kế');
  let bp = newSceneBlueprint(episode);
  bp = addChoice(bp, bp.startSceneId, { text: 'Sang tập kế' });
  const cid = findScene(bp, bp.startSceneId).choices[0].id;
  bp = connectChoice(bp, bp.startSceneId, cid, 'episode', 'ep_next');
  const { nodes } = compileEpisodeBlueprint(bp, { title: 'Tập đơn lẻ', episodesById: { ep_next: target } });
  const targetId = nodes.start_node.choices[0].targetNodeId;
  assert.ok(nodes[targetId].isEnding);
  assert.ok(nodes[targetId].text.includes('Tập kế'));
});
