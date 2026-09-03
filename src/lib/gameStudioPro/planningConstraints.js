import { MAX_SCENES_PER_EPISODE, SCENE_ROLES } from "./blueprintModel.js";

export const DEFAULT_TARGET_SCENE_COUNT = 12;

const clampScenes = (value) => Math.max(1, Math.min(MAX_SCENES_PER_EPISODE, Math.round(value)));

export function derivePlanningConstraints(idea = "", stages = []) {
  const text = String(idea || "");
  // Số cảnh CHÍNH/CHƠI là quy mô toàn game; các dải như “nhánh phụ 1–2
  // cảnh” chỉ mô tả một nhánh con và không được phép ghi đè mục tiêu đó.
  const mainScene = text.match(/(?:(đúng|khoảng|tầm|xấp xỉ|gần)\s*)?(\d+)\s*cảnh\s*(?:chính|chơi)/i);
  const range = text.match(/(\d+)\s*[-–—]\s*(\d+)\s*cảnh/i);
  const single = text.match(/(?:(khoảng|tầm|xấp xỉ|gần)\s*)?(\d+)\s*cảnh/i);
  const stageTotal = (stages || []).reduce((sum, stage) => sum + (Number(stage?.approximateSceneCount) || 0), 0);
  let target;
  let precision = "default";
  if (mainScene) {
    target = clampScenes(Number(mainScene[2]));
    precision = mainScene[1] && !/^đúng$/i.test(mainScene[1]) ? "approximate" : "exact";
  } else if (range) {
    const low = clampScenes(Number(range[1]));
    const high = clampScenes(Number(range[2]));
    target = clampScenes((low + high) / 2);
    precision = "range";
  } else if (single) {
    target = clampScenes(Number(single[2]));
    precision = single[1] ? "approximate" : "exact";
  } else if (stageTotal > 0) {
    target = clampScenes(stageTotal);
    precision = "planned";
  } else {
    target = DEFAULT_TARGET_SCENE_COUNT;
  }
  const tolerance = precision === "exact" ? Math.max(1, Math.round(target * 0.05)) : Math.max(2, Math.round(target * 0.1));
  const choiceMatch = text.match(/(?:mỗi\s+(?:cảnh|cảnh chơi|cảnh quyết định)[^\d]{0,30}|)([2-6])\s*(?:lựa chọn|đáp án)(?:\s*(?:mỗi|cho)\s*(?:cảnh|cảnh quyết định))?/i);
  return {
    targetSceneCount: target,
    minimumSceneCount: Math.max(1, target - tolerance),
    maximumSceneCount: Math.min(MAX_SCENES_PER_EPISODE, target + tolerance),
    precision,
    desiredChoicesPerDecision: choiceMatch ? Number(choiceMatch[1]) : null,
    sourceIdea: text,
  };
}

// Ý tưởng người dùng mô tả quy mô cho TOÀN BỘ game (vd "khoảng 30 cảnh"), nhưng
// mỗi tập lại tự dựng sơ đồ RIÊNG và so số cảnh của CHÍNH NÓ với targetSceneCount
// (xem getBlueprintScaleStatus ở blueprintAI.js). Nếu gán y nguyên targetSceneCount
// toàn game cho từng tập, game 5 tập sẽ bị hiểu thành 5×30 = 150 cảnh — AI cứ dựng
// mãi không đủ, sinh tràn lan cảnh đệm/hội tụ trùng lặp để cố đạt số. Chia đều
// target (và dung sai) cho số tập trước khi gắn vào từng episode.
export function derivePerEpisodeConstraints(globalConstraints, episodeCount) {
  if (!globalConstraints || !Number.isFinite(episodeCount) || episodeCount <= 1) return globalConstraints;
  const target = clampScenes(globalConstraints.targetSceneCount / episodeCount);
  const tolerance = globalConstraints.precision === "exact" ? Math.max(1, Math.round(target * 0.05)) : Math.max(2, Math.round(target * 0.1));
  return {
    ...globalConstraints,
    targetSceneCount: target,
    minimumSceneCount: Math.max(1, target - tolerance),
    maximumSceneCount: Math.min(MAX_SCENES_PER_EPISODE, target + tolerance),
  };
}

export function resolveEpisodeConstraints(episode = {}, fallbackIdea = "") {
  const saved = episode.planningConstraints;
  if (saved?.targetSceneCount) return { ...derivePlanningConstraints("", episode.stages), ...saved };
  return derivePlanningConstraints(fallbackIdea, episode.stages);
}

export function countMeaningfulScenes(blueprint) {
  const helpers = new Set([SCENE_ROLES.CONSEQUENCE, SCENE_ROLES.CONDITION, SCENE_ROLES.CONVERGENCE]);
  return (blueprint?.scenes || []).filter((scene) => !helpers.has(scene.role) && scene.role !== SCENE_ROLES.ENDING).length;
}

// A requested "N scenes, M choices each" is a request for N interactive
// moments. Linear narration remains useful, but is additional structure.
export function countPlayableScenes(blueprint) {
  return (blueprint?.scenes || []).filter((scene) =>
    scene.role === SCENE_ROLES.DECISION && (scene.choices || []).length >= 2
  ).length;
}

export function assessBlueprintScale(blueprint, constraints) {
  const meaningfulSceneCount = constraints?.desiredChoicesPerDecision
    ? countPlayableScenes(blueprint)
    : countMeaningfulScenes(blueprint);
  // "30 cảnh" là một con số chính xác, không phải lời mời giao 27/30. Dung
  // sai chỉ áp dụng khi chính người dùng nói "khoảng/tầm" hoặc đưa một dải.
  const minimum = constraints?.precision === "exact"
    ? constraints.targetSceneCount
    : constraints?.minimumSceneCount ?? 1;
  const maximum = constraints?.maximumSceneCount ?? MAX_SCENES_PER_EPISODE;
  return { meaningfulSceneCount, underGenerated: meaningfulSceneCount < minimum, withinTolerance: meaningfulSceneCount >= minimum && meaningfulSceneCount <= maximum };
}
