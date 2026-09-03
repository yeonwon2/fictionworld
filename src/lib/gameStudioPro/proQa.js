// PRO 7 — canonical, human-readable QA for the complete Pro authoring model.
import { analyzeBlueprintGraph } from "./qaGraphAnalyzer.js";
import { SCENE_ROLES } from "./blueprintModel.js";
import { ensureGlobalState } from "./globalStateModel.js";
import { findEntityByIdAnyKind, ENTITY_KINDS } from "./entityRegistry.js";
import { CONDITION_TYPES, EFFECT_TYPES } from "./ruleModel.js";
import { validateChoiceRules } from "./ruleValidator.js";
import { compileProCampaign } from "./proCompiler.js";
import { validateProConfiguration } from "./configurationValidator.js";
import { countMeaningfulScenes, countPlayableScenes, derivePlanningConstraints, resolveEpisodeConstraints } from "./planningConstraints.js";

export const QA_SEVERITIES = { ERROR: "error", WARNING: "warning", INFO: "info" };

function makeIssue(severity, code, scope, context, copy = {}) {
  return {
    severity, code, scope,
    episodeId: context.episodeId || null, sceneId: context.sceneId || null,
    choiceId: context.choiceId || null, entityId: context.entityId || null,
    title: copy.title || code,
    message: copy.message || "",
    whyItMatters: copy.whyItMatters || "",
    suggestedFix: copy.suggestedFix || "",
  };
}

function allConditions(choice) {
  return [choice?.rules?.conditions || [], ...(choice?.conditionalOutcomes || []).map((b) => b?.conditions || [])];
}
function allEffects(choice) {
  return [choice?.rules?.effects || [], ...(choice?.conditionalOutcomes || []).map((b) => b?.effects || [])];
}
function normalizedText(value) { return String(value || "").trim().toLocaleLowerCase("vi").replace(/\s+/g, " "); }

function hasReachableImmediateDeath(graph, endings) {
  const deathEndingIds = new Set((endings || []).filter((ending) => ending?.tone === "death").map((ending) => ending.id));
  if (!deathEndingIds.size) return false;
  for (const sceneId of graph.reachableSceneIds) {
    const scene = graph.byId.get(sceneId);
    for (const choice of scene?.choices || []) {
      if (choice?.targetType === "ending" && deathEndingIds.has(choice.targetId)) return true;
      if ((choice?.conditionalOutcomes || []).some((branch) => branch?.targetType === "ending" && deathEndingIds.has(branch.targetId))) return true;
    }
  }
  return false;
}

// Tarjan over the tiny episode graph. Kept generic and linear so feasibility
// can fail open on repeatable cross-episode gains without path simulation.
function cyclicVertices(adjacency) {
  let nextIndex = 0;
  const indices = new Map(), low = new Map(), stack = [], onStack = new Set(), cyclic = new Set();
  function visit(id) {
    indices.set(id, nextIndex); low.set(id, nextIndex); nextIndex += 1; stack.push(id); onStack.add(id);
    for (const target of adjacency.get(id) || []) {
      if (!adjacency.has(target)) continue;
      if (!indices.has(target)) { visit(target); low.set(id, Math.min(low.get(id), low.get(target))); }
      else if (onStack.has(target)) low.set(id, Math.min(low.get(id), indices.get(target)));
    }
    if (low.get(id) !== indices.get(id)) return;
    const component = []; let member;
    do { member = stack.pop(); onStack.delete(member); component.push(member); } while (member !== id);
    if (component.length > 1 || (adjacency.get(component[0]) || new Set()).has(component[0])) for (const item of component) cyclic.add(item);
  }
  for (const id of adjacency.keys()) if (!indices.has(id)) visit(id);
  return cyclic;
}

export function runProQa(rawDoc) {
  const doc = ensureGlobalState(rawDoc || {});
  const episodes = Array.isArray(doc.storyBlueprint?.episodes) ? doc.storyBlueprint.episodes : [];
  const registry = doc.globalState?.registry || { stats: [], relationships: [], flags: [], items: [] };
  const issues = [];
  const add = (severity, code, scope, context, copy) => issues.push(makeIssue(severity, code, scope, context, copy));
  const entityUse = new Map();
  const possibleFlagGrants = new Set(), possibleItemGrants = new Set();
  const statPositive = new Map();
  const positiveGainSources = new Map();
  const graphByEpisode = new Map();
  const episodeIds = new Set(episodes.map((e) => e?.id).filter(Boolean));
  const orderById = new Map(episodes.map((e, i) => [e?.id, Number.isFinite(e?.order) ? e.order : i + 1]));
  const episodeAdj = new Map(episodes.map((e) => [e?.id, new Set()]));

  function useEntity(id, kind) {
    if (!id) return;
    if (!entityUse.has(id)) entityUse.set(id, new Set());
    entityUse.get(id).add(kind);
  }

  if (!episodes.length) add("error", "CAMPAIGN_NO_EPISODES", "campaign", {}, {
    title: "Game chưa có tập nào", message: "Bản thiết kế chưa có tập để kiểm tra.", whyItMatters: "Không thể biên dịch hoặc chơi campaign.", suggestedFix: "Tạo ít nhất một tập trong Kế hoạch."
  });
  const requestedStart = doc.globalState?.startEpisodeId;
  if (requestedStart && !episodeIds.has(requestedStart)) add("error", "INVALID_START_EPISODE", "campaign", {}, {
    title: "Tập bắt đầu không tồn tại", message: "Tập được chọn làm điểm bắt đầu đã bị xoá hoặc đổi.", whyItMatters: "Người chơi không có điểm vào campaign hợp lệ.", suggestedFix: "Chọn lại tập bắt đầu trong Kế hoạch."
  });

  for (const episode of episodes) {
    const epCtx = { episodeId: episode?.id };
    const bp = episode?.sceneBlueprint;
    if (!bp || !Array.isArray(bp.scenes) || !bp.scenes.length) {
      add("error", "EPISODE_MISSING_BLUEPRINT", "episode", epCtx, { title: `Tập “${episode?.title || "chưa đặt tên"}” chưa có sơ đồ`, message: "Tập này chưa có cảnh nào.", whyItMatters: "Campaign không thể đi qua tập này.", suggestedFix: "Dựng hoặc nhập sơ đồ cho tập." });
      continue;
    }
    const graph = analyzeBlueprintGraph(bp);
    graphByEpisode.set(episode.id, graph);
    const sceneName = (id) => graph.byId.get(id)?.title || id || "cảnh chưa đặt tên";
    if (!bp.startSceneId || !graph.byId.has(bp.startSceneId)) add("error", "MISSING_START_SCENE", "episode", epCtx, { title: `Tập “${episode.title}” chưa có cảnh bắt đầu`, message: "Không tìm thấy cảnh mở đầu hợp lệ.", whyItMatters: "Người chơi không thể bắt đầu tập.", suggestedFix: "Chọn một cảnh hiện có làm cảnh bắt đầu." });
    for (const id of graph.duplicateSceneIds) add("error", "DUPLICATE_SCENE_ID", "scene", { ...epCtx, sceneId: id }, { title: "Hai cảnh dùng cùng mã", message: `Mã cảnh “${id}” xuất hiện nhiều lần trong tập “${episode.title}”.`, whyItMatters: "Đường nối có thể trỏ nhầm cảnh và compiler có thể ghi đè dữ liệu.", suggestedFix: "Tạo mã riêng cho từng cảnh." });
    for (const edge of graph.brokenEdges) {
      const choice = graph.byId.get(edge.sceneId)?.choices?.find((c) => c?.id === edge.choiceId);
      const choiceLabel = choice?.text?.trim() || "lựa chọn chưa có nội dung";
      const unknown = edge.reason !== "missing";
      add("error", unknown ? "TARGET_NOT_FOUND" : "MISSING_TARGET", "scene", { ...epCtx, sceneId: edge.sceneId, choiceId: edge.choiceId }, {
        title: unknown ? "Đường nối trỏ tới nội dung không tồn tại" : "Lựa chọn chưa có đường đi",
        message: `Cảnh “${sceneName(edge.sceneId)}” có lựa chọn “${choiceLabel}” ${unknown ? "trỏ tới một cảnh/kết thúc đã mất" : "nhưng không đi tới đâu"}.`,
        whyItMatters: "Người chơi có thể bị kẹt hoặc compiler phải thay bằng kết thúc lỗi.", suggestedFix: "Mở cảnh này và nối lựa chọn tới một cảnh, tập hoặc kết thúc hợp lệ."
      });
    }
    for (const id of graph.unreachableSceneIds) add("warning", "UNREACHABLE_SCENE", "scene", { ...epCtx, sceneId: id }, { title: "Cảnh không thể đi tới", message: `Không có đường nào từ đầu tập tới cảnh “${sceneName(id)}”.`, whyItMatters: "Nội dung này sẽ không xuất hiện khi chơi.", suggestedFix: "Nối một lựa chọn hợp lệ vào cảnh, hoặc giữ lại có chủ đích để hoàn thiện sau." });
    for (const [id, incoming] of graph.incoming) if (id !== bp.startSceneId && incoming.length === 0) add("warning", "NO_INCOMING_EDGE", "scene", { ...epCtx, sceneId: id }, { title: "Cảnh không có lối vào", message: `Cảnh “${sceneName(id)}” không được lựa chọn nào dẫn tới.`, whyItMatters: "Cảnh gần như mồ côi và không thể được chơi.", suggestedFix: "Nối cảnh từ một lựa chọn trước đó." });
    for (const id of graph.unreachableEndingIds) add("warning", "UNREACHABLE_ENDING", "scene", { ...epCtx }, { title: "Kết thúc không thể đạt", message: `Kết thúc “${bp.endings?.find((e) => e.id === id)?.title || id}” không có đường hợp lệ từ đầu tập.`, whyItMatters: "Người chơi không thể thấy kết thúc đã viết.", suggestedFix: "Nối một lựa chọn reachable tới kết thúc này." });
    for (const cycle of graph.cycles.filter((c) => !c.hasExit)) add("error", "INFINITE_CYCLE_NO_EXIT", "scene", { ...epCtx, sceneId: cycle.sceneIds[0] }, { title: "Vòng lặp không có lối thoát", message: `Nhóm cảnh ${cycle.sceneIds.map((id) => `“${sceneName(id)}”`).join(", ")} chỉ dẫn vòng quanh nhau.`, whyItMatters: "Người chơi có thể bị kẹt vĩnh viễn.", suggestedFix: "Thêm ít nhất một lựa chọn đi ra khỏi vòng lặp hoặc tới kết thúc." });

    for (const scene of graph.byId.values()) {
      const ctx = { ...epCtx, sceneId: scene.id };
      const choices = Array.isArray(scene.choices) ? scene.choices : [];
      if (scene.role === SCENE_ROLES.DECISION && choices.length < 2) add("warning", "DECISION_TOO_FEW_CHOICES", "scene", ctx, { title: "Cảnh quyết định có quá ít lựa chọn", message: `Cảnh “${sceneName(scene.id)}” chỉ có ${choices.length} lựa chọn.`, whyItMatters: "Cảnh được mô tả là quyết định nhưng người chơi không thực sự được chọn.", suggestedFix: "Thêm ít nhất hai lựa chọn có ý nghĩa." });
      if (scene.role === SCENE_ROLES.CONVERGENCE && (graph.incoming.get(scene.id)?.length || 0) < 2) add("warning", "CONVERGENCE_TOO_FEW_INCOMING", "scene", ctx, { title: "Cảnh hội tụ chưa thực sự hội tụ", message: `Cảnh “${sceneName(scene.id)}” chỉ có ${(graph.incoming.get(scene.id)?.length || 0)} lối vào.`, whyItMatters: "Ý đồ gom nhiều nhánh chưa được thể hiện trong graph.", suggestedFix: "Nối ít nhất hai nhánh khác nhau vào cảnh hội tụ." });
      if ((scene.role === SCENE_ROLES.CONSEQUENCE || scene.role === SCENE_ROLES.SIDE) && (graph.incoming.get(scene.id)?.length || 0) === 0) add("warning", scene.role === SCENE_ROLES.CONSEQUENCE ? "ORPHAN_CONSEQUENCE" : "ORPHAN_SIDE_SCENE", "scene", ctx, { title: scene.role === SCENE_ROLES.CONSEQUENCE ? "Cảnh hệ quả không có nguồn" : "Cảnh nhánh phụ không có nguồn", message: `Cảnh “${sceneName(scene.id)}” không được lựa chọn nào mở ra.`, whyItMatters: "Nội dung có vai trò đặc biệt nhưng không bao giờ chạy.", suggestedFix: "Nối từ cảnh quyết định phù hợp." });
      if (scene.role === SCENE_ROLES.ENDING && choices.length) add("warning", "ENDING_HAS_OUTGOING_CHOICES", "scene", ctx, { title: "Cảnh kết thúc vẫn có lựa chọn", message: `Cảnh kết thúc “${sceneName(scene.id)}” còn ${choices.length} lựa chọn nhưng runtime coi cảnh này là terminal.`, whyItMatters: "Các lựa chọn sẽ không được người chơi sử dụng.", suggestedFix: "Xoá lựa chọn khỏi cảnh kết thúc hoặc đổi vai trò cảnh." });
      if (scene.role !== SCENE_ROLES.ENDING && graph.deadEndSceneIds.has(scene.id)) add("error", "DEAD_END_SCENE", "scene", ctx, { title: "Cảnh cụt không phải kết thúc", message: `Cảnh “${sceneName(scene.id)}” không có đường đi tiếp hợp lệ.`, whyItMatters: "Người chơi sẽ bị dừng ngoài ý muốn.", suggestedFix: "Thêm đường nối tới cảnh, tập hoặc kết thúc." });
      if ((graph.outgoing.get(scene.id) || []).includes(scene.id)) add("warning", "SELF_LOOP", "scene", ctx, { title: "Cảnh tự quay lại chính nó", message: `Cảnh “${sceneName(scene.id)}” có lựa chọn dẫn lại chính cảnh này.`, whyItMatters: "Có thể tạo vòng lặp khó thoát hoặc lặp hiệu ứng.", suggestedFix: "Kiểm tra đây có phải chủ đích và bảo đảm có lựa chọn thoát." });

      const seenText = new Set();
      for (const choice of choices) {
        const choiceCtx = { ...ctx, choiceId: choice?.id };
        const text = normalizedText(choice?.text);
        if (text && seenText.has(text)) add("warning", "DUPLICATE_CHOICE_TEXT", "scene", choiceCtx, { title: "Hai lựa chọn có cùng nội dung", message: `Cảnh “${sceneName(scene.id)}” lặp lựa chọn “${choice.text.trim()}”.`, whyItMatters: "Người chơi khó hiểu sự khác nhau giữa các hướng đi.", suggestedFix: "Viết lại nhãn lựa chọn hoặc gộp chúng." });
        seenText.add(text);
        const ruleResult = validateChoiceRules(choice, registry);
        for (const message of ruleResult.errors) add("error", "RULE_INVALID", "rule", choiceCtx, { title: "Luật của lựa chọn không hợp lệ", message: `Cảnh “${sceneName(scene.id)}”: ${message}`, whyItMatters: "Luật có thể không compile hoặc luôn khoá lựa chọn.", suggestedFix: "Mở phần Luật thật và sửa/xoá điều kiện hoặc hệ quả được nêu." });
        for (const conditions of allConditions(choice)) for (const cond of conditions) {
          useEntity(cond?.entityId, "condition");
          if (cond?.type === CONDITION_TYPES.FLAG_PRESENT && cond.entityId) useEntity(cond.entityId, "flag_check");
          if (cond?.type === CONDITION_TYPES.ITEM_PRESENT && cond.entityId) useEntity(cond.entityId, "item_check");
        }
        for (const effects of allEffects(choice)) for (const eff of effects) {
          useEntity(eff?.entityId, "effect");
          if (eff?.type === EFFECT_TYPES.GRANT_FLAG) { possibleFlagGrants.add(eff.entityId); useEntity(eff.entityId, "flag_grant"); }
          if (eff?.type === EFFECT_TYPES.GRANT_ITEM) { possibleItemGrants.add(eff.entityId); useEntity(eff.entityId, "item_grant"); }
          if (eff?.type === EFFECT_TYPES.REMOVE_ITEM) useEntity(eff.entityId, "item_remove");
          if (eff?.type === EFFECT_TYPES.STAT_CHANGE && Number.isFinite(eff.amount)) {
            if (eff.amount > 0) {
              statPositive.set(eff.entityId, (statPositive.get(eff.entityId) || 0) + eff.amount);
              if (!positiveGainSources.has(eff.entityId)) positiveGainSources.set(eff.entityId, []);
              positiveGainSources.get(eff.entityId).push({ episodeId: episode.id, sceneId: scene.id });
            }
          }
        }
      }
      if (scene.id === bp.startSceneId) {
        for (const c of choices.filter((choice) => choice?.targetType === "ending" && bp.endings?.find((e) => e.id === choice.targetId)?.tone === "death")) {
          if (!(episode.planningIntents || []).some((i) => i?.type === "instant_failure")) add("warning", "UNSIGNALLED_START_INSTANT_DEATH", "scene", { ...ctx, choiceId: c.id }, { title: "Lựa chọn chết ngay ở cảnh đầu chưa được báo trước trong kế hoạch", message: `Cảnh mở đầu “${sceneName(scene.id)}” có lựa chọn dẫn thẳng tới cái chết.`, whyItMatters: "Người chơi có thể bị kết thúc quá sớm ngoài ý đồ đã duyệt.", suggestedFix: "Thêm tín hiệu/ghi chú instant failure, hoặc dời kết thúc chết về sau." });
        }
      }
      const groupedTargets = new Map();
      for (const c of choices) if (c?.targetType && c?.targetId) {
        const key = `${c.targetType}:${c.targetId}`; if (!groupedTargets.has(key)) groupedTargets.set(key, []); groupedTargets.get(key).push(c);
      }
      for (const sameTarget of groupedTargets.values()) if (sameTarget.length > 1) {
        const signatures = new Set(sameTarget.map((c) => JSON.stringify({ conditions: c.rules?.conditions || [], effects: c.rules?.effects || [] })));
        if (signatures.size === 1) add("warning", "CHOICES_SAME_OUTCOME", "scene", ctx, { title: "Nhiều lựa chọn dẫn tới cùng một kết quả", message: `Cảnh “${sceneName(scene.id)}” có ${sameTarget.length} lựa chọn cùng đích và cùng luật.`, whyItMatters: "Các lựa chọn có thể chỉ khác câu chữ mà không khác hậu quả.", suggestedFix: "Tạo khác biệt về đích, điều kiện hoặc hệ quả nếu đây không phải chủ đích." });
      }
    }
    for (const edge of graph.validEdges.filter((e) => e.targetType === "episode")) {
      episodeAdj.get(episode.id)?.add(edge.targetId);
      if (!episodeIds.has(edge.targetId)) add("error", "BROKEN_EPISODE_TRANSITION", "scene", { ...epCtx, sceneId: edge.sceneId, choiceId: edge.choiceId }, { title: "Chuyển tới tập không tồn tại", message: `Một lựa chọn trong cảnh “${sceneName(edge.sceneId)}” trỏ tới tập đã mất.`, whyItMatters: "Campaign không thể tiếp tục qua lựa chọn này.", suggestedFix: "Chọn lại tập đích hoặc tạo tập còn thiếu." });
      else if ((orderById.get(edge.targetId) || 0) < (orderById.get(episode.id) || 0)) add("warning", "BACKWARD_EPISODE_TRANSITION", "scene", { ...epCtx, sceneId: edge.sceneId, choiceId: edge.choiceId }, { title: "Chuyển ngược về tập trước", message: `Tập “${episode.title}” chuyển ngược về một tập có thứ tự trước đó.`, whyItMatters: "Có thể tạo vòng lặp campaign hoặc lặp trạng thái.", suggestedFix: "Xác nhận đây là chủ đích; nếu không, chọn tập kế tiếp." });
    }
    const stageExpected = (episode.stages || []).reduce((n, s) => n + (Number.isFinite(s?.approximateSceneCount) ? s.approximateSceneCount : 0), 0);
    // Game ngắn từng có thể được AI chia thành nhiều tập rồi gộp lại. Khi đó
    // ràng buộc trên episode còn giữ con số đã chia nhỏ (vd. 2), trong khi
    // ràng buộc toàn game vẫn là yêu cầu thật của người dùng (vd. 25).
    const constraints = episodes.length === 1
      ? derivePlanningConstraints(`${doc.storyBlueprint?.idea || ""}\n${doc.storyBlueprint?.gamePlan?.coreGameplayLoop || ""}\n${episode.summary || ""}`, episode.stages)
      : resolveEpisodeConstraints(episode);
    const expected = constraints?.targetSceneCount || stageExpected;
    const actual = constraints?.desiredChoicesPerDecision ? countPlayableScenes(bp) : countMeaningfulScenes(bp);
    if (expected > 0 && Math.abs(actual - expected) > Math.max(3, Math.ceil(expected * 0.4))) add("warning", "SCENE_COUNT_MISMATCH", "episode", epCtx, { title: "Số cảnh lệch nhiều so với kế hoạch", message: `Kế hoạch dự kiến khoảng ${expected} cảnh chơi nhưng sơ đồ hiện có ${actual}.`, whyItMatters: "Nhịp độ hoặc phạm vi tập có thể đã lệch khỏi kế hoạch.", suggestedFix: "Cập nhật kế hoạch hoặc bổ sung/rút gọn cảnh chơi; cảnh hệ quả và cảnh nối không tính vào chỉ tiêu này." });
    const intentTypes = new Set((episode.planningIntents || []).map((i) => i?.type));
    const roleHas = (role) => [...graph.byId.values()].some((s) => s.role === role);
    const hasImmediateDeath = hasReachableImmediateDeath(graph, bp.endings);
    const hasGate = [...graph.byId.values()].some((s) => (s.choices || []).some((c) => allConditions(c).some((list) => list.length)));
    const hasItemGate = [...graph.byId.values()].some((s) => (s.choices || []).some((c) => allConditions(c).some((list) => list.some((x) => x?.type === CONDITION_TYPES.ITEM_PRESENT))));
    const intentChecks = [
      ["instant_failure", hasImmediateDeath, "PLANNER_INSTANT_FAILURE_MISSING", "Kế hoạch có thất bại tức thì nhưng chưa có lựa chọn/kết quả ở một cảnh reachable dẫn trực tiếp tới kết thúc chết."],
      ["side_branch", roleHas(SCENE_ROLES.SIDE), "PLANNER_SIDE_BRANCH_MISSING", "Kế hoạch có nhánh phụ nhưng graph chưa có cảnh Nhánh phụ."],
      ["convergence", roleHas(SCENE_ROLES.CONVERGENCE), "PLANNER_CONVERGENCE_MISSING", "Kế hoạch có hội tụ nhưng graph chưa có cảnh Hội tụ."],
      ["relationship_or_flag_gate", hasGate, "PLANNER_GATE_MISSING", "Kế hoạch có cổng điều kiện nhưng graph chưa có luật điều kiện."],
      ["item_gate", hasItemGate, "PLANNER_ITEM_GATE_MISSING", "Kế hoạch có cổng vật phẩm nhưng graph chưa có điều kiện vật phẩm."],
      ["non_lethal_failure", roleHas(SCENE_ROLES.CONSEQUENCE), "PLANNER_NON_LETHAL_FAILURE_MISSING", "Kế hoạch có thất bại không chết nhưng graph chưa có cảnh Hệ quả."],
    ];
    for (const [intent, ok, code, message] of intentChecks) if (intentTypes.has(intent) && !ok) add("warning", code, "episode", epCtx, { title: "Sơ đồ chưa khớp ghi chú kế hoạch", message, whyItMatters: "Một ý đồ đã duyệt chưa được thể hiện trong cấu trúc thật.", suggestedFix: "Bổ sung cảnh/luật tương ứng hoặc cập nhật ghi chú kế hoạch." });
  }

  const startEpisodeId = requestedStart && episodeIds.has(requestedStart) ? requestedStart : [...episodes].sort((a, b) => (a.order || 0) - (b.order || 0))[0]?.id;
  const reachableEpisodes = new Set(startEpisodeId ? [startEpisodeId] : []), queue = startEpisodeId ? [startEpisodeId] : [];
  for (let i = 0; i < queue.length; i += 1) for (const next of episodeAdj.get(queue[i]) || []) if (episodeIds.has(next) && !reachableEpisodes.has(next)) { reachableEpisodes.add(next); queue.push(next); }
  const cyclicEpisodeIds = cyclicVertices(episodeAdj);
  const unboundedStats = new Set();
  for (const [entityId, sources] of positiveGainSources) for (const source of sources) {
    const graph = graphByEpisode.get(source.episodeId);
    if (!reachableEpisodes.has(source.episodeId) || !graph?.reachableSceneIds.has(source.sceneId)) continue;
    const onSceneCycle = graph.cycles.some((cycle) => cycle.sceneIds.includes(source.sceneId));
    if (onSceneCycle || cyclicEpisodeIds.has(source.episodeId)) unboundedStats.add(entityId);
  }

  // Conservative feasibility: acyclic positive modifiers are summed even if
  // mutually exclusive (an over-estimate). Any reachable repeatable gain makes
  // the upper bound unknown/unbounded, so QA must fail open rather than block.
  for (const episode of episodes) for (const scene of episode?.sceneBlueprint?.scenes || []) for (const choice of scene?.choices || []) {
    for (const conditions of allConditions(choice)) for (const cond of conditions) {
      const entity = findEntityByIdAnyKind(registry, cond?.entityId);
      const ctx = { episodeId: episode.id, sceneId: scene.id, choiceId: choice.id, entityId: cond?.entityId };
      if (cond?.type === CONDITION_TYPES.FLAG_PRESENT && !possibleFlagGrants.has(cond.entityId)) add("warning", "FLAG_NEVER_GRANTED", "rule", ctx, { title: `Cờ “${entity?.displayName || cond.entityId}” không bao giờ được trao`, message: `Lựa chọn ở cảnh “${scene.title || scene.id}” yêu cầu cờ này nhưng toàn campaign không có hệ quả nào trao nó.`, whyItMatters: "Lựa chọn có thể luôn bị khoá.", suggestedFix: "Thêm hệ quả trao cờ ở một đường đi trước đó, hoặc bỏ điều kiện." });
      if (cond?.type === CONDITION_TYPES.ITEM_PRESENT && !possibleItemGrants.has(cond.entityId)) add("warning", "ITEM_NEVER_GRANTED", "rule", ctx, { title: `Vật phẩm “${entity?.displayName || cond.entityId}” không bao giờ nhận được`, message: `Lựa chọn ở cảnh “${scene.title || scene.id}” yêu cầu vật phẩm này nhưng toàn campaign không có nơi trao nó.`, whyItMatters: "Lựa chọn có thể luôn bị khoá.", suggestedFix: "Trao vật phẩm ở một đường đi trước đó, hoặc bỏ điều kiện." });
      if (cond?.type === CONDITION_TYPES.STAT_COMPARE && entity && (entity.kind === ENTITY_KINDS.STAT || entity.kind === ENTITY_KINDS.RELATIONSHIP) && [">", ">=", "=="].includes(cond.operator)) {
        const initial = Number.isFinite(entity.default) ? entity.default : null;
        const max = initial === null || unboundedStats.has(entity.id) ? null : initial + (statPositive.get(entity.id) || 0);
        const needed = cond.operator === ">" ? cond.value + 1 : cond.value;
        if (max !== null && Number.isFinite(needed) && max < needed) add("error", "STAT_REQUIREMENT_IMPOSSIBLE", "rule", ctx, { title: `Điều kiện “${entity.displayName}” không thể đạt`, message: `Campaign bắt đầu ở ${initial} và tổng mọi mức cộng dương chỉ lên tối đa ${max}, nhưng lựa chọn yêu cầu ${cond.operator} ${cond.value}.`, whyItMatters: "Lựa chọn chắc chắn luôn bị khoá theo các modifier hiện có.", suggestedFix: "Giảm ngưỡng, tăng giá trị khởi đầu hoặc thêm hệ quả tăng chỉ số trước đó." });
      }
    }
  }

  const allEntities = [...(registry.stats || []), ...(registry.relationships || []), ...(registry.flags || []), ...(registry.items || [])];
  for (const entity of allEntities) if (!(entityUse.get(entity.id)?.size)) add("info", `ORPHAN_${String(entity.kind || "entity").toUpperCase()}`, "entity", { entityId: entity.id }, { title: `“${entity.displayName || entity.id}” chưa được dùng`, message: "Thực thể này đã được tạo nhưng chưa xuất hiện trong điều kiện hoặc hệ quả nào.", whyItMatters: "Danh mục thừa làm dự án khó quản lý, dù không chặn game.", suggestedFix: "Dùng thực thể trong luật, hoặc xoá thủ công nếu chắc chắn không cần." });
  for (const item of registry.items || []) if (entityUse.get(item.id)?.has("effect") && !possibleItemGrants.has(item.id)) add("warning", "ITEM_REMOVED_BUT_NEVER_GRANTED", "entity", { entityId: item.id }, { title: `Vật phẩm “${item.displayName}” bị dùng/xoá nhưng không được trao`, message: "Không có hệ quả nào đưa vật phẩm này vào túi.", whyItMatters: "Hệ quả xoá vật phẩm có thể không bao giờ có tác dụng.", suggestedFix: "Thêm nơi nhận vật phẩm hoặc bỏ hệ quả xoá." });
  for (const item of registry.items || []) if (entityUse.get(item.id)?.has("item_grant") && !entityUse.get(item.id)?.has("item_check") && !entityUse.get(item.id)?.has("item_remove")) add("info", "ITEM_GRANTED_NEVER_USED", "entity", { entityId: item.id }, { title: `Vật phẩm “${item.displayName}” được trao nhưng chưa bao giờ dùng`, message: "Không có điều kiện hoặc hệ quả nào kiểm tra/xoá vật phẩm này.", whyItMatters: "Vật phẩm có thể là nội dung thừa.", suggestedFix: "Dùng vật phẩm ở một lựa chọn hoặc giữ lại có chủ đích." });
  for (const flag of registry.flags || []) if (entityUse.get(flag.id)?.has("flag_grant") && !entityUse.get(flag.id)?.has("flag_check")) add("info", "FLAG_GRANTED_NEVER_CHECKED", "entity", { entityId: flag.id }, { title: `Cờ “${flag.displayName}” được trao nhưng chưa bao giờ kiểm tra`, message: "Không có lựa chọn nào đọc cờ này.", whyItMatters: "Cờ không ảnh hưởng đường chơi hiện tại.", suggestedFix: "Dùng cờ trong điều kiện hoặc bỏ hệ quả trao cờ." });
  for (const stat of registry.stats || []) {
    if (!Number.isFinite(stat.default)) add("error", "STAT_DEFAULT_INVALID", "entity", { entityId: stat.id }, { title: `Giá trị đầu của “${stat.displayName}” không hợp lệ`, message: "Chỉ số cần một giá trị số ban đầu.", whyItMatters: "Điều kiện và modifier không thể tính ổn định.", suggestedFix: "Đặt giá trị đầu là một số hữu hạn." });
    if (stat.isVital && !Number.isFinite(stat.deathThreshold)) add("error", "VITAL_STAT_CONFIG_INVALID", "entity", { entityId: stat.id }, { title: `Ngưỡng sinh tử của “${stat.displayName}” không hợp lệ`, message: "Chỉ số được đánh dấu sinh tử nhưng thiếu ngưỡng số.", whyItMatters: "Game-over có thể chạy sai.", suggestedFix: "Đặt death threshold hợp lệ hoặc tắt chỉ số sinh tử." });
  }

  const configTitles = {
    RANK_ENTITY_MISSING: "Cấp bậc trỏ tới chỉ số đã xoá", RANK_ENTITY_WRONG_KIND: "Cấp bậc trỏ sai loại thực thể",
    CURRENCY_ENTITY_MISSING: "Tiền tệ trỏ tới chỉ số đã xoá", CURRENCY_ENTITY_WRONG_KIND: "Tiền tệ trỏ sai loại thực thể",
    RANK_DUPLICATE_THRESHOLD: "Cấp bậc có mốc trùng nhau", RANK_THRESHOLD_ORDER_WARNING: "Mốc cấp bậc chưa đúng thứ tự",
    VITAL_MECHANIC_WITHOUT_VITAL_STAT: "Đã bật sinh tử nhưng chưa có chỉ số sinh tử",
    MILESTONE_ENTITY_MISSING: "Milestone trỏ tới chỉ số đã xoá", MILESTONE_ENTITY_WRONG_KIND: "Milestone trỏ sai loại thực thể",
    MILESTONE_DUPLICATE_THRESHOLD: "Milestone có mốc trùng nhau", MILESTONE_VALUE_INVALID: "Giá trị milestone không hợp lệ",
  };
  for (const finding of validateProConfiguration(doc)) add(finding.severity, finding.code, "entity", { entityId: finding.entityId }, {
    title: configTitles[finding.code] || "Cấu hình gameplay cần kiểm tra", message: finding.message,
    whyItMatters: finding.severity === "error" ? "Cấu hình này không thể được biên dịch hoặc kiểm tra đáng tin cậy." : "Cấu hình vẫn lưu được nhưng có thể không hoạt động như mong đợi.",
    suggestedFix: "Mở phần Cơ chế/Trạng thái toàn game và sửa cấu hình được nêu."
  });

  for (const ep of episodes) if (ep?.sceneBlueprint?.scenes?.length && !reachableEpisodes.has(ep.id)) add("warning", "UNREACHABLE_EPISODE", "episode", { episodeId: ep.id }, { title: `Tập “${ep.title}” không thể đi tới`, message: "Không có chuỗi chuyển tập từ tập bắt đầu tới tập này.", whyItMatters: "Toàn bộ nội dung tập sẽ không xuất hiện khi chơi campaign.", suggestedFix: "Thêm chuyển tập từ một tập reachable." });
  const ordered = [...episodes].sort((a, b) => (a.order || 0) - (b.order || 0));
  const last = ordered[ordered.length - 1];
  if (last?.sceneBlueprint) {
    const g = analyzeBlueprintGraph(last.sceneBlueprint);
    if (!g.reachableEndingIds.size && ![...g.reachableSceneIds].some((id) => g.byId.get(id)?.role === SCENE_ROLES.ENDING)) add("error", "LAST_EPISODE_NO_ENDING", "episode", { episodeId: last.id }, { title: "Tập cuối chưa có kết thúc game", message: `Tập cuối “${last.title}” không có kết thúc reachable.`, whyItMatters: "Campaign không có hồi kết hợp lệ.", suggestedFix: "Nối một đường reachable tới cảnh/kết thúc game." });
  }
  try { if (episodes.some((e) => e?.sceneBlueprint?.scenes?.length)) compileProCampaign(doc); }
  catch (error) { add("error", "CAMPAIGN_COMPILE_FAILED", "campaign", {}, { title: "Campaign không biên dịch được", message: error?.message || "Lỗi compiler không xác định.", whyItMatters: "Không thể chơi hoặc xuất bản an toàn.", suggestedFix: "Sửa các lỗi cấu trúc/luật phía trên rồi kiểm tra lại." }); }

  // Stable deterministic order and exact duplicate suppression.
  const seen = new Set();
  const unique = issues.filter((issue) => { const key = [issue.code, issue.episodeId, issue.sceneId, issue.choiceId, issue.entityId, issue.message].join("|"); if (seen.has(key)) return false; seen.add(key); return true; });
  const rank = { error: 0, warning: 1, info: 2 };
  unique.sort((a, b) => rank[a.severity] - rank[b.severity] || String(a.episodeId || "").localeCompare(String(b.episodeId || "")) || String(a.sceneId || "").localeCompare(String(b.sceneId || "")) || a.code.localeCompare(b.code));
  return { issues: unique, summary: { error: unique.filter((x) => x.severity === "error").length, warning: unique.filter((x) => x.severity === "warning").length, info: unique.filter((x) => x.severity === "info").length }, blocking: unique.some((x) => x.severity === "error"), checkedAt: new Date().toISOString() };
}
