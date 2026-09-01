// Xưởng Game Pro — PRO 1: model cho "Bản thiết kế" (storyBlueprint).
//
// Đây là lớp PLANNING — Ý tưởng → Kế hoạch game → Kế hoạch từng Tập. Nó
// KHÔNG sinh ra scene/node thật; storyBlueprint chỉ là dữ liệu mô tả, được
// lưu nguyên vẹn bên trong tài liệu Pro (`proDoc.storyBlueprint`, xem
// proModel.js) và đi qua compileProGame() mà không bị đọc/dùng — runtime
// (GamePlayer/Export) hoàn toàn không biết tới nó ở bước này.
//
// Số tập tối đa 1 lần lập/tạo lại kế hoạch — giới hạn mềm để tránh vượt trần
// token của aiCall (8192 khi có jsonSchema) mà không cần dựng cơ chế chia lô
// + tiếp tục dở dang (như Xưởng Kịch Bản Game làm cho hàng trăm cảnh) — ở
// mức tóm tắt kế hoạch (không phải văn cảnh đầy đủ), 12 tập vẫn gọn trong 1
// lượt gọi.
export const MAX_EPISODES = 12;

export const PLANNER_STATUS = {
  DRAFT: "draft",
  PLANNED: "planned",
  APPROVED: "approved",
};

// Từ vựng GỢI Ý cho loại "ghi chú đặc biệt" (planning intent) — KHÔNG bắt
// buộc/enum-hoá: AI hoặc người dùng có thể dùng type khác, UI chỉ hiển thị
// nhãn chung "Ghi chú khác" cho type lạ thay vì từ chối dữ liệu.
export const INTENT_TYPE_LABELS = {
  multi_choice: "Nhiều lựa chọn",
  instant_failure: "Chết ngay / thất bại tức thì",
  side_branch: "Nhánh phụ",
  convergence: "Hội tụ nhánh",
  item_gate: "Cần vật phẩm",
  relationship_or_flag_gate: "Cần điều kiện quan hệ/cờ truyện",
  non_lethal_failure: "Thất bại không chết",
  other: "Ghi chú khác",
};

export function intentTypeLabel(type) {
  return INTENT_TYPE_LABELS[type] || INTENT_TYPE_LABELS.other;
}

let idCounter = 0;
export function makePlannerId(prefix) {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export function newStoryBlueprint(idea, settings = {}) {
  return {
    status: PLANNER_STATUS.DRAFT,
    idea: idea || "",
    settings: {
      genre: settings.genre || "",
      gameLength: settings.gameLength === "long" ? "long" : "short",
      estimatedEpisodes: settings.estimatedEpisodes || null,
      episodeLength: settings.episodeLength || "",
      style: settings.style || "",
      branchiness: settings.branchiness || "",
      // PRO 6: template đã chọn ở màn "CHỌN KIỂU GAME" (mục 22) — CHỈ để nhúng
      // thêm ngữ cảnh vào prompt (plannerPrompts.js#settingsBlock), KHÔNG thay
      // thế `genre` tự do đã có — người dùng vẫn có thể để trống (template
      // "blank") hoặc override genre tự nhập.
      templateId: settings.templateId || null,
    },
    gamePlan: null,
    episodes: [],
  };
}

export function newBlankEpisode(order) {
  return {
    id: makePlannerId("ep"),
    order,
    title: `Tập ${order}`,
    summary: "",
    startState: "",
    goal: "",
    stages: [],
    keyCharacters: [],
    relevantStats: [],
    relevantFlags: [],
    relevantItems: [],
    majorConflict: "",
    climax: "",
    possibleFailure: "",
    transitionToNextEpisode: "",
    planningIntents: [],
    locked: false,
  };
}

export function newBlankStage() {
  return { title: "", purpose: "", approximateSceneCount: null, importantEvents: [] };
}

export function newBlankIntent() {
  return { type: "other", description: "" };
}

// "Đã duyệt" nghĩa là ĐÚNG nội dung này đã được xem/duyệt — bất kỳ chỉnh sửa
// nào sau đó (tay hoặc AI tạo lại) đều phải hạ về "planned" cho tới khi
// người dùng duyệt lại, để trạng thái approved luôn đáng tin cho PRO 2 sau
// này.
export function downgradeIfApproved(storyBlueprint) {
  if (storyBlueprint?.status === PLANNER_STATUS.APPROVED) {
    return { ...storyBlueprint, status: PLANNER_STATUS.PLANNED };
  }
  return storyBlueprint;
}
