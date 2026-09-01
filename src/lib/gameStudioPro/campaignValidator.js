// Xưởng Game Pro — PRO 5: kiểm tra CẤP CAMPAIGN (nhiều tập + global state).
// Đây KHÔNG thay thế blueprintValidator.js (kiểm tra CẤP 1 TẬP) — nó GỌI LẠI
// validateSceneBlueprint() cho từng tập (đã nhận knownEpisodeIds từ PRO 5) và
// cộng thêm các kiểm tra chỉ có ý nghĩa ở cấp campaign: tập bắt đầu, đích
// chuyển tập, tập không tới được, campaign có kết thúc thật hay không. Thuần
// JS, không gọi AI — dùng để bật/tắt nút "Chơi thử toàn game"/"Xuất bản"
// giống cách blueprintValidator.js đã làm với "Chơi thử tập này".
import { ensureGlobalState, episodeTransitionSummary } from "./globalStateModel.js";
import { validateSceneBlueprint } from "./blueprintValidator.js";
import { compileProCampaign } from "./proCompiler.js";
import { graphReachable } from "../gameStudio/routeExplorer.js";
import { ensureMechanicsState, MECHANIC_IDS } from "./mechanicsModel.js";
import { findEntityByIdAnyKind, ENTITY_KINDS } from "./entityRegistry.js";

function checkDuplicateEntityIds(registry) {
  const seen = new Set();
  const dups = new Set();
  for (const e of [...(registry.stats || []), ...(registry.flags || []), ...(registry.items || [])]) {
    if (seen.has(e.id)) dups.add(e.id);
    else seen.add(e.id);
  }
  return [...dups];
}

// Phát hiện chu trình giữa các tập bằng DFS + recursion stack (thuần cấu
// trúc theo cạnh "episode transition", bỏ qua điều kiện) — chỉ CẢNH BÁO
// (mục 13 cho phép rẽ nhánh có điều kiện sau này hội tụ ngược, và ngay cả
// tuyến tính runtime cũng không cấm 1 game "quay vòng" một cách hợp lệ).
function findEpisodeCycles(adjacency, startId) {
  const visiting = new Set();
  const done = new Set();
  const cycles = [];
  function dfs(id, path) {
    if (done.has(id)) return;
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      cycles.push([...path.slice(start), id]);
      return;
    }
    visiting.add(id);
    for (const next of adjacency.get(id) || []) dfs(next, [...path, next]);
    visiting.delete(id);
    done.add(id);
  }
  if (startId) dfs(startId, [startId]);
  return cycles;
}

// PRO 6: kiểm tra mechanics/configs — CỘNG THÊM vào validator hiện có, KHÔNG
// thay thế (mục "Validator additions" của AGENTS.md PRO 6). Chỉ kiểm tra
// CẤU HÌNH (entity còn tồn tại đúng loại, ladder hợp lệ) — không kiểm tra
// runtime thật vì currency/rank/quest hoặc SUPPORTED-qua-stat-thường (không
// cần thêm gì) hoặc AUTHORING_ONLY/DEFERRED_RUNTIME (không có gì để kiểm tra
// ở runtime).
function checkMechanics(proDoc) {
  const errors = [];
  const warnings = [];
  const mechanics = ensureMechanicsState(proDoc.mechanics);
  const registry = proDoc.globalState.registry;

  for (const currency of mechanics.configs.currency) {
    const entity = findEntityByIdAnyKind(registry, currency.entityId);
    if (!entity) {
      errors.push(`Cơ chế Tiền tệ trỏ tới chỉ số không tồn tại/đã bị xoá (id: ${currency.entityId}).`);
    } else if (entity.kind !== ENTITY_KINDS.STAT) {
      errors.push(`Cơ chế Tiền tệ trỏ tới "${entity.displayName}" nhưng đây không phải một chỉ số.`);
    } else if (!currency.allowNegative) {
      warnings.push(`"${entity.displayName}" được đánh dấu không cho âm, nhưng runtime hiện KHÔNG tự động chặn âm — hãy tự thêm điều kiện chặn ở các lựa chọn có thể trừ.`);
    }
  }

  for (const rank of mechanics.configs.rank) {
    const entity = findEntityByIdAnyKind(registry, rank.entityId);
    if (!entity) {
      errors.push(`Cơ chế Cấp bậc "${rank.label}" trỏ tới chỉ số không tồn tại/đã bị xoá (id: ${rank.entityId}).`);
    } else if (entity.kind !== ENTITY_KINDS.STAT) {
      errors.push(`Cơ chế Cấp bậc "${rank.label}" trỏ tới "${entity.displayName}" nhưng đây không phải một chỉ số.`);
    }
    if (rank.levels.length === 0) {
      warnings.push(`Cơ chế Cấp bậc "${rank.label}" chưa có mốc cấp bậc nào.`);
      continue;
    }
    const thresholds = rank.levels.map((lv) => lv.threshold);
    if (new Set(thresholds).size !== thresholds.length) {
      errors.push(`Cơ chế Cấp bậc "${rank.label}" có 2 mốc trùng ngưỡng.`);
    }
    const sorted = [...thresholds].sort((a, b) => a - b);
    if (thresholds.some((t, i) => t !== sorted[i])) {
      warnings.push(`Cơ chế Cấp bậc "${rank.label}" có các mốc chưa được sắp xếp tăng dần theo ngưỡng.`);
    }
  }

  if (mechanics.enabled.includes(MECHANIC_IDS.VITAL_STAT)) {
    const hasVital = (registry.stats || []).some((e) => e.kind === ENTITY_KINDS.STAT && e.isVital);
    if (!hasVital) warnings.push('Cơ chế "Chỉ số sinh tử" đã bật nhưng chưa có chỉ số nào được đánh dấu là chỉ số sinh tử.');
  }

  if (mechanics.enabled.includes(MECHANIC_IDS.QUEST) && mechanics.configs.quest.length > 0) {
    warnings.push('Cơ chế "Nhiệm vụ" chỉ là ghi chú tác giả — game CHƯA tự thực thi/theo dõi nhiệm vụ này khi chơi.');
  }

  return { errors, warnings };
}

// PRO 6: kiểm tra hình dạng globalState.milestones — AUTHORING_ONLY (xem
// newEmptyGlobalState() trong globalStateModel.js), compiler KHÔNG đọc trường
// này nên không có gì để kiểm tra ở mức runtime, chỉ kiểm tra cấu hình có hợp
// lệ để tác giả tự tái hiện thủ công hay không.
function checkMilestones(proDoc) {
  const errors = [];
  const warnings = [];
  const registry = proDoc.globalState.registry;
  for (const m of proDoc.globalState.milestones || []) {
    const entity = findEntityByIdAnyKind(registry, m.statEntityId);
    if (!entity) {
      errors.push(`Milestone trỏ tới chỉ số không tồn tại/đã bị xoá (id: ${m.statEntityId}).`);
      continue;
    }
    if (entity.kind !== ENTITY_KINDS.STAT) {
      errors.push(`Milestone trỏ tới "${entity.displayName}" nhưng đây không phải một chỉ số.`);
    }
    if (m.thresholds.length === 0) {
      warnings.push(`Milestone theo "${entity.displayName}" chưa có mốc nào.`);
      continue;
    }
    const ats = m.thresholds.map((t) => t.at);
    if (new Set(ats).size !== ats.length) {
      errors.push(`Milestone theo "${entity.displayName}" có 2 mốc trùng ngưỡng.`);
    }
    if (m.thresholds.some((t) => !Number.isFinite(t.at) || !Number.isFinite(t.bonus))) {
      errors.push(`Milestone theo "${entity.displayName}" có mốc với ngưỡng/thưởng không phải số hợp lệ.`);
    }
  }
  return { errors, warnings };
}

export function validateCampaign(proDocRaw) {
  const errors = [];
  const warnings = [];
  const proDoc = ensureGlobalState(proDocRaw);
  const episodes = proDoc.storyBlueprint?.episodes || [];

  if (episodes.length === 0) {
    errors.push("Chưa có tập nào trong Bản thiết kế — hãy lập kế hoạch ở tab \"Kế hoạch\" trước.");
    return { errors, warnings };
  }

  const knownEpisodeIds = new Set(episodes.map((e) => e.id));
  const episodesWithBlueprint = episodes.filter((e) => e.sceneBlueprint?.scenes?.length);

  const dupIds = checkDuplicateEntityIds(proDoc.globalState.registry);
  if (dupIds.length > 0) {
    errors.push(`Trùng id entity trong registry toàn game: ${dupIds.join(", ")}.`);
  }

  const mechanicsResult = checkMechanics(proDoc);
  errors.push(...mechanicsResult.errors);
  warnings.push(...mechanicsResult.warnings);

  const milestonesResult = checkMilestones(proDoc);
  errors.push(...milestonesResult.errors);
  warnings.push(...milestonesResult.warnings);

  for (const ep of episodes) {
    if (!ep.sceneBlueprint?.scenes?.length) {
      warnings.push(`Tập "${ep.title}" chưa có sơ đồ cảnh.`);
      continue;
    }
    const result = validateSceneBlueprint(ep.sceneBlueprint, { knownEpisodeIds });
    for (const e of result.errors) errors.push(`Tập "${ep.title}": ${e}`);
    for (const w of result.warnings) warnings.push(`Tập "${ep.title}": ${w}`);
  }

  if (episodesWithBlueprint.length === 0) {
    errors.push("Chưa có tập nào có sơ đồ cảnh — chưa thể biên dịch campaign.");
    return { errors, warnings };
  }

  const requestedStartId = proDoc.globalState.startEpisodeId;
  let startEpisodeId = null;
  if (requestedStartId) {
    const startEp = episodes.find((e) => e.id === requestedStartId);
    if (!startEp) errors.push("Tập bắt đầu đã chọn không tồn tại.");
    else if (!startEp.sceneBlueprint?.scenes?.length) errors.push(`Tập bắt đầu đã chọn ("${startEp.title}") chưa có sơ đồ cảnh.`);
    else startEpisodeId = startEp.id;
  } else {
    warnings.push("Chưa xác định tập bắt đầu — đang dùng tập có thứ tự nhỏ nhất đã có sơ đồ làm mặc định.");
  }
  if (!startEpisodeId) {
    startEpisodeId = [...episodesWithBlueprint].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0].id;
  }

  // Reachability CẤP TẬP (thuần cấu trúc, giống graphReachable ở
  // routeExplorer.js nhưng ở granularity episode) — dùng để cảnh báo tập mồ
  // côi và phát hiện chu trình.
  const adjacency = new Map(episodes.map((e) => [e.id, episodeTransitionSummary(proDoc.storyBlueprint, e.id).outgoing]));
  const reachableEpisodes = new Set([startEpisodeId]);
  const queue = [startEpisodeId];
  while (queue.length) {
    const id = queue.shift();
    for (const next of adjacency.get(id) || []) {
      if (knownEpisodeIds.has(next) && !reachableEpisodes.has(next)) {
        reachableEpisodes.add(next);
        queue.push(next);
      }
    }
  }
  for (const ep of episodesWithBlueprint) {
    if (!reachableEpisodes.has(ep.id)) {
      warnings.push(`Tập "${ep.title}" không thể tới được từ tập bắt đầu.`);
    }
  }
  const cycles = findEpisodeCycles(adjacency, startEpisodeId);
  for (const cycle of cycles) {
    const titles = cycle.map((id) => episodes.find((e) => e.id === id)?.title || id);
    warnings.push(`Có vòng lặp giữa các tập: ${titles.join(" → ")}.`);
  }

  // Biên dịch thật + kiểm tra có kết thúc GAME thật (isEnding) nào tới được
  // không — tái dùng graphReachable() (routeExplorer.js), không viết BFS
  // runtime thứ hai.
  try {
    const proDocForCompile = { ...proDoc, globalState: { ...proDoc.globalState, startEpisodeId } };
    const { nodes } = compileProCampaign(proDocForCompile);
    const { endings } = graphReachable(nodes);
    if (endings.length === 0) {
      errors.push("Campaign chưa có kết thúc game thật nào mà người chơi có thể tới được.");
    }
  } catch (e) {
    errors.push(`Không biên dịch được campaign: ${e.message}`);
  }

  return { errors, warnings };
}
