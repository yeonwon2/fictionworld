import { PLANNER_STATUS } from "./plannerModel.js";

export const WORKFLOW_STEPS = [
  { id: "idea", label: "Ý tưởng" },
  { id: "plan", label: "Kế hoạch" },
  { id: "mindmap", label: "Sơ đồ" },
  { id: "mechanics", label: "Cơ chế" },
  { id: "qa", label: "Kiểm tra" },
  { id: "play", label: "Chơi thử" },
  { id: "export", label: "Xuất game" },
];

function episodesOf(doc) { return Array.isArray(doc?.storyBlueprint?.episodes) ? doc.storyBlueprint.episodes : []; }

export function deriveWorkflowState(doc, qaResult = { blocking: false, summary: {} }, campaignError = null) {
  const story = doc?.storyBlueprint;
  const episodes = episodesOf(doc);
  const hasIdea = Boolean(story?.idea?.trim());
  const approved = story?.status === PLANNER_STATUS.APPROVED;
  const graphed = episodes.filter((episode) => episode?.sceneBlueprint?.scenes?.length);
  const allGraphed = episodes.length > 0 && graphed.length === episodes.length;
  const blockingCount = Number(qaResult?.summary?.error || 0);
  let currentStep = "idea";
  let nextAction = { label: "Bắt đầu từ ý tưởng", mode: "plan" };

  if (hasIdea && !approved) {
    currentStep = "plan";
    nextAction = { label: story?.gamePlan ? "Duyệt kế hoạch" : "Tạo kế hoạch game", mode: "plan" };
  } else if (approved && !allGraphed) {
    currentStep = "mindmap";
    const missing = episodes.find((episode) => !episode?.sceneBlueprint?.scenes?.length);
    nextAction = { label: "Dựng sơ đồ tập tiếp theo", mode: "mindmap", episodeId: missing?.id || null };
  } else if (allGraphed && (campaignError || qaResult?.blocking)) {
    currentStep = "qa";
    nextAction = { label: `Sửa ${blockingCount || 1} lỗi`, mode: "qa" };
  } else if (allGraphed) {
    currentStep = "play";
    nextAction = { label: "Chơi thử", mode: "play" };
  }

  const completed = new Set();
  if (hasIdea) completed.add("idea");
  if (approved) completed.add("plan");
  if (allGraphed) { completed.add("mindmap"); completed.add("mechanics"); completed.add("qa"); }
  return {
    currentStep, nextAction, completed,
    errorSteps: new Map((allGraphed && blockingCount) || campaignError ? [["qa", blockingCount || 1]] : []),
    canPlay: allGraphed && !campaignError,
    canExport: allGraphed && !campaignError && !qaResult?.blocking,
  };
}

export const INITIAL_SAVE_STATE = { status: "saved", error: "", savedAt: null };
export function saveStateReducer(state, action) {
  if (action.type === "dirty") return { ...state, status: "dirty", error: "" };
  if (action.type === "saving") return { ...state, status: "saving", error: "" };
  if (action.type === "saved") return { status: "saved", error: "", savedAt: action.at || new Date() };
  if (action.type === "error") return { ...state, status: "error", error: action.error || "Không thể lưu thay đổi." };
  return state;
}

export function saveStateLabel(state) {
  if (state.status === "saving") return "Đang lưu…";
  if (state.status === "dirty") return "Có thay đổi chưa lưu";
  if (state.status === "error") return "Lưu thất bại";
  return state.savedAt ? `Đã lưu lúc ${state.savedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Đã lưu";
}

export function switchEpisodeWithoutMutation(doc, episodeId) {
  return { doc, episodeId: episodesOf(doc).some((episode) => episode.id === episodeId) ? episodeId : episodesOf(doc)[0]?.id || null };
}

export function findEntityReferences(doc, entityId) {
  const references = [];
  for (const episode of episodesOf(doc)) for (const scene of episode?.sceneBlueprint?.scenes || []) for (const choice of scene?.choices || []) {
    const rules = [choice?.rules, ...(choice?.conditionalOutcomes || [])];
    if (rules.some((rule) => [...(rule?.conditions || []), ...(rule?.effects || [])].some((item) => item?.entityId === entityId))) {
      references.push({ episodeId: episode.id, sceneId: scene.id, choiceId: choice.id });
    }
  }
  return references;
}
