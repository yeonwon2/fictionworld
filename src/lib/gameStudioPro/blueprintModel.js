// Xưởng Game Pro — PRO 2: model cho "Sơ đồ cảnh" (Scene Blueprint) của MỘT
// Tập (episode.sceneBlueprint, xem AGENTS.md/thiết kế PRO 2). Đây vẫn là một
// tài liệu AUTHORING (giống storyBlueprint ở plannerModel.js) — KHÔNG phải
// runtime node graph. Nó mô tả CẤU TRÚC (topology): cảnh nào, loại gì, nối
// đi đâu — và Ý ĐỒ (Scene Intent) bằng ngôn ngữ tự nhiên. Điều kiện luật thật
// (statRequirements/requiresFlag...) CHƯA được compile ở bước này — mỗi lựa
// chọn chỉ giữ `gateIntent` dạng văn bản, PRO 3 mới compile thành luật.
//
// episode.sceneBlueprint -> (blueprintCompiler.js) -> runtime nodes, đúng
// hướng 1 chiều PRO source -> compiler -> runtime đã dùng ở proCompiler.js.
//
// PRO 3: thêm `blueprint.registry` (entityRegistry.js — danh mục chỉ số/cờ/
// vật phẩm/quan hệ) và `choice.rules`/`choice.effectIntent`/
// `choice.conditionalOutcomes` (ruleModel.js — luật thật, dịch từ lời tự
// nhiên). `gateIntent` VẪN giữ nguyên làm mô tả người đọc được — luật thật
// sống ở `choice.rules`, không thay thế gateIntent (mục 6 yêu cầu PRO 3).
export const BLUEPRINT_SCHEMA_VERSION = 1;

// Loại cảnh (role) — tên kỹ thuật CHỈ dùng nội bộ, UI luôn hiển thị nhãn
// tiếng Việt ở SCENE_ROLE_LABELS bên dưới.
export const SCENE_ROLES = {
  STORY: "story",
  DECISION: "decision",
  CONSEQUENCE: "consequence",
  CONDITION: "condition",
  DANGER: "danger",
  SIDE: "side",
  CONVERGENCE: "convergence",
  ENDING: "ending",
};

export const SCENE_ROLE_LABELS = {
  [SCENE_ROLES.STORY]: "Kể chuyện",
  [SCENE_ROLES.DECISION]: "Lựa chọn",
  [SCENE_ROLES.CONSEQUENCE]: "Hệ quả",
  [SCENE_ROLES.CONDITION]: "Điều kiện",
  [SCENE_ROLES.DANGER]: "Nguy hiểm",
  [SCENE_ROLES.SIDE]: "Cảnh phụ",
  [SCENE_ROLES.CONVERGENCE]: "Hội tụ",
  [SCENE_ROLES.ENDING]: "Kết thúc",
};

export function sceneRoleLabel(role) {
  return SCENE_ROLE_LABELS[role] || SCENE_ROLE_LABELS[SCENE_ROLES.STORY];
}

// Vai không có lựa chọn thật (đi tiếp tự động, tối đa 1 cảnh kế) — người dùng
// không cần chọn số lựa chọn cho các vai này.
export const AUTO_CONTINUE_ROLES = new Set([
  SCENE_ROLES.STORY,
  SCENE_ROLES.CONSEQUENCE,
  SCENE_ROLES.CONDITION,
  SCENE_ROLES.CONVERGENCE,
]);

export const MIN_DECISION_CHOICES = 2;
export const MAX_DECISION_CHOICES = 6;

// Giới hạn an toàn tổng số cảnh/tập — Planner chỉ ước lượng approximateSceneCount,
// không tuyệt đối, nhưng KHÔNG được để AI vô tình sinh hàng trăm cảnh cho 1 tập.
export const MAX_SCENES_PER_EPISODE = 60;

let idCounter = 0;
function uniqueSuffix() {
  idCounter += 1;
  return `${Date.now().toString(36)}${idCounter.toString(36)}`;
}

// ID cảnh do HỆ THỐNG quản lý — namespaced theo episode để không đụng ID khi
// game nhiều tập compile chung (xem blueprintCompiler.js), ổn định sau khi
// sửa/đổi tên (không phụ thuộc order/title), và không va chạm khi AI thêm
// cảnh phụ (dùng bộ đếm riêng trên blueprint, không đoán từ số lượng hiện có).
export function makeSceneId(episodeId) {
  return `${episodeId}__s_${uniqueSuffix()}`;
}
export function makeChoiceId() {
  return `c_${uniqueSuffix()}`;
}
export function makeEndingId(episodeId) {
  return `${episodeId}__end_${uniqueSuffix()}`;
}

export function newChoice(overrides = {}) {
  return {
    id: makeChoiceId(),
    text: "",
    // targetType: "scene" | "ending" | null (chưa nối)
    targetType: null,
    targetId: null,
    // Ghi chú ĐIỀU KIỆN bằng văn bản (người đọc) — mô tả song song với
    // `rules.conditions` thật, KHÔNG phải nguồn compile (xem ruleParser.js).
    gateIntent: "",
    // Ghi chú HỆ QUẢ bằng văn bản (người đọc) — cùng vai trò với gateIntent
    // nhưng cho hệ quả (mục 7 yêu cầu PRO 3).
    effectIntent: "",
    // Luật THẬT (Canonical Rule IR — ruleModel.js) — nguồn compile duy nhất
    // proCompiler.js dùng để sinh statRequirements/requiresFlag/... (mục 3).
    rules: { conditions: [], effects: [] },
    // Rẽ nhánh có điều kiện (mục 22): mỗi nhánh có điều kiện/hệ quả/đích
    // RIÊNG; nếu không nhánh nào khớp, dùng chính rules/targetType/targetId
    // ở trên làm nhánh "còn lại". Rỗng ([]) = không rẽ nhánh, hành vi y hệt
    // trước PRO 3. Xem proCompiler.js để biết cách biên dịch (mở rộng thành
    // nhiều lựa chọn cấu trúc cùng cảnh — KHÔNG dùng cơ chế automaticEnding
    // vì cơ chế đó bắt buộc mọi đích phải là kết thúc và không cho phép hệ
    // quả, quá hẹp cho rẽ nhánh chung).
    conditionalOutcomes: [],
    ...overrides,
  };
}

export function newScene(episodeId, role = SCENE_ROLES.STORY, overrides = {}) {
  return {
    id: makeSceneId(episodeId),
    title: "",
    role,
    // Ý ĐỒ CẢNH — phần quan trọng nhất PRO 2: mô tả tự nhiên ý đồ tác giả.
    intent: "",
    choices: [],
    notes: "",
    locked: false,
    userEdited: false,
    ...overrides,
  };
}

export function newEnding(episodeId, overrides = {}) {
  return {
    id: makeEndingId(episodeId),
    title: "",
    text: "",
    // tone chỉ để UI tô màu (ví dụ ☠ khi tone === "death") — không ảnh hưởng compiler.
    tone: "neutral",
    ...overrides,
  };
}

export function newSceneBlueprint(episode) {
  const startId = makeSceneId(episode.id);
  return {
    version: BLUEPRINT_SCHEMA_VERSION,
    episodeId: episode.id,
    startSceneId: startId,
    scenes: [newScene(episode.id, SCENE_ROLES.STORY, { id: startId, title: episode.title || "Mở đầu" })],
    endings: [],
    // Danh mục chỉ số/cờ/vật phẩm/quan hệ (entityRegistry.js) — PRO 3.
    registry: { stats: [], flags: [], items: [] },
    updatedAt: new Date().toISOString(),
  };
}

export function findScene(blueprint, sceneId) {
  return (blueprint?.scenes || []).find((s) => s.id === sceneId) || null;
}
export function findEnding(blueprint, endingId) {
  return (blueprint?.endings || []).find((e) => e.id === endingId) || null;
}

function touch(blueprint) {
  return { ...blueprint, updatedAt: new Date().toISOString() };
}

// ---------- Graph operations (thuần — không gọi AI) ----------

export function addScene(blueprint, role = SCENE_ROLES.STORY, overrides = {}) {
  const scene = newScene(blueprint.episodeId, role, overrides);
  return touch({ ...blueprint, scenes: [...blueprint.scenes, scene] });
}

export function updateScene(blueprint, sceneId, patch) {
  return touch({
    ...blueprint,
    scenes: blueprint.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)),
  });
}

// Xoá 1 cảnh. Mọi lựa chọn (ở cảnh khác) đang trỏ tới cảnh này sẽ bị gỡ nối
// (targetType/targetId về null) thay vì để lơ lửng — người gọi (UI) nên cảnh
// báo trước nếu cảnh có incoming connection, nhưng hàm này luôn giữ đồ thị
// hợp lệ về mặt cấu trúc dù không cảnh báo.
export function removeScene(blueprint, sceneId) {
  const scenes = blueprint.scenes
    .filter((s) => s.id !== sceneId)
    .map((s) => ({
      ...s,
      choices: s.choices.map((c) =>
        c.targetType === "scene" && c.targetId === sceneId ? { ...c, targetType: null, targetId: null } : c
      ),
    }));
  const startSceneId = blueprint.startSceneId === sceneId ? scenes[0]?.id || null : blueprint.startSceneId;
  return touch({ ...blueprint, scenes, startSceneId });
}

export function duplicateScene(blueprint, sceneId) {
  const source = findScene(blueprint, sceneId);
  if (!source) return blueprint;
  const copy = {
    ...source,
    id: makeSceneId(blueprint.episodeId),
    title: source.title ? `${source.title} (bản sao)` : "",
    locked: false,
    choices: source.choices.map((c) => ({ ...c, id: makeChoiceId() })),
  };
  return touch({ ...blueprint, scenes: [...blueprint.scenes, copy] });
}

export function countIncoming(blueprint, sceneId) {
  let n = 0;
  for (const s of blueprint.scenes) {
    for (const c of s.choices) {
      if (c.targetType === "scene" && c.targetId === sceneId) n++;
    }
  }
  return n;
}

export function addChoice(blueprint, sceneId, overrides = {}) {
  return touch({
    ...blueprint,
    scenes: blueprint.scenes.map((s) =>
      s.id === sceneId ? { ...s, choices: [...s.choices, newChoice(overrides)] } : s
    ),
  });
}

export function updateChoice(blueprint, sceneId, choiceId, patch) {
  return touch({
    ...blueprint,
    scenes: blueprint.scenes.map((s) =>
      s.id === sceneId
        ? { ...s, choices: s.choices.map((c) => (c.id === choiceId ? { ...c, ...patch } : c)) }
        : s
    ),
  });
}

export function removeChoice(blueprint, sceneId, choiceId) {
  return touch({
    ...blueprint,
    scenes: blueprint.scenes.map((s) =>
      s.id === sceneId ? { ...s, choices: s.choices.filter((c) => c.id !== choiceId) } : s
    ),
  });
}

export function connectChoice(blueprint, sceneId, choiceId, targetType, targetId) {
  return updateChoice(blueprint, sceneId, choiceId, { targetType, targetId });
}

export function disconnectChoice(blueprint, sceneId, choiceId) {
  return updateChoice(blueprint, sceneId, choiceId, { targetType: null, targetId: null });
}

// AI dựng sơ đồ CHỈ biết "scene"/"ending" làm đích lựa chọn (xem
// blueprintPrompts.js) — nối SANG TẬP KHÁC là 1 thao tác tác giả làm thủ công
// trong Scene Intent Editor (targetType "episode", xem SceneIntentEditor.jsx
// mục 20 PRO 5). Kết quả: cảnh "chốt tập" mà AI vừa dựng thường rơi vào 1
// trong 2 dạng — (a) cụt hẳn (0 lựa chọn, đúng lỗi QA "Cảnh cụt không phải
// kết thúc"), hoặc (b) có 1 lựa chọn "đi tiếp" trỏ tới 1 kết thúc CỤC BỘ
// (placeholder "hết tập", KHÔNG phải kết cục thật của campaign) — cả hai đều
// khiến tập sau "không thể đi tới" (proQa.js UNREACHABLE_EPISODE) ngay sau
// MỖI lần Xưởng tự sản xuất. Tự nối 1 trong các cảnh đó sang tập kế tiếp
// ngay khi Xưởng vừa dựng xong — tác giả vẫn có thể vào sửa lại nếu muốn.
export function autoLinkDanglingScenesToEpisode(blueprint, nextEpisodeId) {
  if (!nextEpisodeId) return blueprint;
  const hasEpisodeEdge = (blueprint.scenes || []).some((s) => (s.choices || []).some((c) => c.targetType === "episode"));
  if (hasEpisodeEdge) return blueprint;

  const danglingScenes = (blueprint.scenes || []).filter((s) => s.role !== SCENE_ROLES.ENDING && (s.choices || []).length === 0);
  if (danglingScenes.length) {
    let next = blueprint;
    for (const scene of danglingScenes) next = addChoice(next, scene.id, { targetType: "episode", targetId: nextEpisodeId });
    return next;
  }

  // Không cảnh nào cụt hẳn (0 lựa chọn) — tìm 1 cảnh "chốt tập" (mọi vai trò
  // NGOÀI "ending"/"decision" — decision là nhánh rẽ thật, không phải điểm
  // chốt tuyến) mà MỌI lựa chọn hiện tại đều KHÔNG mở rộng campaign: chưa nối
  // được đích nào (AI trả ref hỏng — vẫn "có lựa chọn" theo nghĩa mảng không
  // rỗng, nhưng vô dụng), tự trỏ lại CHÍNH cảnh này (bug thường gặp ở cảnh
  // "Kể chuyện" kết tập — AI định ý "đi tiếp" nhưng lại tự tham chiếu, tạo
  // đúng lỗi QA "Cảnh tự quay lại chính nó"/"Vòng lặp không có lối thoát"),
  // hoặc chỉ trỏ tới 1 kết thúc CỤC BỘ không-tử-vong (placeholder "hết tập").
  // Ưu tiên cảnh có nhiều lối vào nhất (đầu mối chốt tập tự nhiên nhất), rồi
  // CHUYỂN HƯỚNG lựa chọn đầu tiên của nó sang tập kế tiếp.
  const endingById = new Map((blueprint.endings || []).map((e) => [e.id, e]));
  const isEpisodeExtendable = (c, sceneId) =>
    !c.targetType ||
    (c.targetType === "scene" && c.targetId === sceneId) ||
    (c.targetType === "ending" && endingById.get(c.targetId)?.tone !== "death");
  const candidates = (blueprint.scenes || []).filter((s) => {
    if (s.role === SCENE_ROLES.ENDING || s.role === SCENE_ROLES.DECISION) return false;
    const choices = s.choices || [];
    return choices.length > 0 && choices.every((c) => isEpisodeExtendable(c, s.id));
  });
  if (!candidates.length) return blueprint;
  const target = candidates.reduce((best, s) => (countIncoming(blueprint, s.id) > countIncoming(blueprint, best.id) ? s : best), candidates[0]);
  return connectChoice(blueprint, target.id, target.choices[0].id, "episode", nextEpisodeId);
}

export function toggleSceneLock(blueprint, sceneId) {
  return touch({
    ...blueprint,
    scenes: blueprint.scenes.map((s) => (s.id === sceneId ? { ...s, locked: !s.locked } : s)),
  });
}

export function addEnding(blueprint, overrides = {}) {
  const ending = newEnding(blueprint.episodeId, overrides);
  return touch({ ...blueprint, endings: [...(blueprint.endings || []), ending] });
}

export function updateEnding(blueprint, endingId, patch) {
  return touch({
    ...blueprint,
    endings: (blueprint.endings || []).map((e) => (e.id === endingId ? { ...e, ...patch } : e)),
  });
}

export function removeEnding(blueprint, endingId) {
  const scenes = blueprint.scenes.map((s) => ({
    ...s,
    choices: s.choices.map((c) =>
      c.targetType === "ending" && c.targetId === endingId ? { ...c, targetType: null, targetId: null } : c
    ),
  }));
  return touch({ ...blueprint, scenes, endings: (blueprint.endings || []).filter((e) => e.id !== endingId) });
}

// Tạo nhanh 1 kết thúc "chết ngay" và nối thẳng lựa chọn tới đó — đúng UX
// "☠ Kết thúc ngay" ở mục 16: người dùng không cần tự tạo cảnh Consequence.
export function connectInstantEnding(blueprint, sceneId, choiceId, { title = "Kết thúc", text = "", tone = "death" } = {}) {
  const ending = newEnding(blueprint.episodeId, { title, text, tone });
  const next = touch({ ...blueprint, endings: [...(blueprint.endings || []), ending] });
  return connectChoice(next, sceneId, choiceId, "ending", ending.id);
}

// ---------- PRO 3: Registry (blueprint.registry) ----------

export function setRegistry(blueprint, registry) {
  return touch({ ...blueprint, registry });
}

// ---------- PRO 3: Rule CRUD (choice.rules / effectIntent / conditionalOutcomes) ----------

export function setChoiceRules(blueprint, sceneId, choiceId, rules) {
  return updateChoice(blueprint, sceneId, choiceId, { rules });
}

export function setChoiceConditionalOutcomes(blueprint, sceneId, choiceId, conditionalOutcomes) {
  return updateChoice(blueprint, sceneId, choiceId, { conditionalOutcomes });
}

let branchIdCounter = 0;
export function makeOutcomeBranchId() {
  branchIdCounter += 1;
  return `branch_${Date.now().toString(36)}${branchIdCounter.toString(36)}`;
}

export function newOutcomeBranch(overrides = {}) {
  return {
    id: makeOutcomeBranchId(),
    label: "",
    conditions: [],
    effects: [],
    targetType: null,
    targetId: null,
    ...overrides,
  };
}
