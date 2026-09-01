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
import { validateProConfiguration } from "./configurationValidator.js";

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

  for (const finding of validateProConfiguration(proDoc)) {
    (finding.severity === "error" ? errors : warnings).push(finding.message);
  }

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
