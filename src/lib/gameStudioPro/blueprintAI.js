// Xưởng Game Pro — PRO 2: AI dựng/sửa Scene Blueprint.
//
// Cùng nguyên tắc plannerAI.js: hàm THUẦN (normalize*/apply*/merge*) tách khỏi
// hàm BẤT ĐỒNG BỘ (generate*/regenerate*) để test được không cần giả lập
// aiCall. aiCall() không ép schema thật nên mọi normalize* phải khoan dung.
//
// AN TOÀN AI (mục 23 yêu cầu PRO 2): AI không được trực tiếp mutate blueprint.
// Luồng luôn là: gọi AI -> normalize (đổi ref cục bộ thành ID hệ thống thật,
// LOẠI BỎ mọi cảnh AI cố định nghĩa lại ngoài phạm vi cho phép) -> áp dụng
// (apply*, hàm thuần) -> UI hiển thị/áp dụng. "Thiết kế lại 1 cảnh" CHỈ được
// phép thay cảnh đang chọn + cảnh mới nó cần — applyAIScenes() ở dưới LOẠI BỎ
// cứng mọi cảnh AI trả về trùng ref với 1 cảnh "được bảo vệ" (protected), kể
// cả khi prompt bị AI phớt lờ.
import { aiCall } from "../aiCall.js";
import {
  buildEpisodeBlueprintPrompt,
  EPISODE_BLUEPRINT_SCHEMA,
  buildSceneRedesignPrompt,
  buildBlueprintContinuationPrompt,
  SCENE_REDESIGN_SCHEMA,
} from "./blueprintPrompts.js";
import {
  SCENE_ROLES,
  MAX_DECISION_CHOICES,
  MAX_SCENES_PER_EPISODE,
  makeSceneId,
  makeEndingId,
  newSceneBlueprint,
} from "./blueprintModel.js";
import { resolveEpisodeConstraints, assessBlueprintScale } from "./planningConstraints.js";
import { parseEffectsDeterministic } from "./ruleParser.js";
import { ensureRegistry } from "./entityRegistry.js";

// Dùng đúng trần cấu trúc thật; prompt topology được giữ súc tích để không
// phải âm thầm thu nhỏ yêu cầu của người dùng theo một trần mềm khác.
export const AI_GENERATION_SCENE_CAP = MAX_SCENES_PER_EPISODE;
export const BLUEPRINT_AI_MAX_OUTPUT_TOKENS = 32768;

function safeString(v) {
  return typeof v === "string" ? v.trim() : "";
}
function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
const VALID_ROLES = new Set(Object.values(SCENE_ROLES));
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function sanitizeRawChoice(raw) {
  if (!raw || typeof raw !== "object") return null;
  const target = safeString(raw.target);
  if (!target || DANGEROUS_KEYS.has(target)) return null;
  const targetKind = raw.targetKind === "ending" ? "ending" : "scene";
  return { text: safeString(raw.text), target, targetKind, gateIntent: safeString(raw.gateIntent), effectIntent: safeString(raw.effectIntent) };
}

function sanitizeRawScene(raw) {
  if (!raw || typeof raw !== "object") return null;
  const ref = safeString(raw.ref);
  if (!ref || DANGEROUS_KEYS.has(ref)) return null;
  const role = VALID_ROLES.has(raw.role) ? raw.role : SCENE_ROLES.STORY;
  return {
    ref,
    title: safeString(raw.title),
    role,
    intent: safeString(raw.intent),
    isStart: raw.isStart === true,
    choices: safeArray(raw.choices).map(sanitizeRawChoice).filter(Boolean).slice(0, MAX_DECISION_CHOICES + 2),
  };
}

function sanitizeRawEnding(raw) {
  if (!raw || typeof raw !== "object") return null;
  const ref = safeString(raw.ref);
  if (!ref || DANGEROUS_KEYS.has(ref)) return null;
  const tone = ["death", "good", "bad", "neutral"].includes(raw.tone) ? raw.tone : "neutral";
  return { ref, title: safeString(raw.title) || "Kết thúc", text: safeString(raw.text), tone };
}

/**
 * Chuẩn hoá phản hồi AI thô thành 1 danh sách cảnh/kết thúc SẴN SÀNG áp dụng
 * (ID hệ thống thật, target đã resolve) — hàm THUẦN, không đọc/ghi gì ngoài
 * tham số. `rejectSceneRefs`/`rejectEndingRefs` là tập ref (ID thật đã tồn
 * tại) mà AI KHÔNG được phép định nghĩa lại — nếu response chứa 1 scene/
 * ending trùng ref đó, entry đó bị loại bỏ hoàn toàn (an toàn kể cả khi AI
 * phớt lờ prompt) nhưng ref đó vẫn resolve được làm ĐÍCH cho lựa chọn (AI
 * được phép TRỎ TỚI, chỉ không được ĐỊNH NGHĨA LẠI). `keepIdSceneRefs` là tập
 * ref mà nếu AI trả về ĐÚNG ref đó, giữ nguyên ID thật (cập nhật tại chỗ) thay
 * vì cấp ID mới — dùng cho đúng 1 cảnh đang "thiết kế lại" (ref = ID thật của
 * chính nó, xem buildSceneRedesignPrompt).
 */
export function normalizeAIBlueprintResponse(
  raw,
  episodeId,
  { rejectSceneRefs = new Set(), keepIdSceneRefs = new Set(), rejectEndingRefs = new Set() } = {}
) {
  const rawScenes = safeArray(raw?.scenes).map(sanitizeRawScene).filter(Boolean).slice(0, AI_GENERATION_SCENE_CAP);
  const rawEndings = safeArray(raw?.endings).map(sanitizeRawEnding).filter(Boolean).slice(0, AI_GENERATION_SCENE_CAP);

  if (rawScenes.length === 0) {
    throw new Error("AI không trả về cảnh nào — hãy thử lại hoặc mô tả ý đồ chi tiết hơn.");
  }

  const sceneRefMap = new Map(); // ref (AI) -> real scene id
  const acceptedScenes = [];
  for (const s of rawScenes) {
    if (sceneRefMap.has(s.ref)) continue; // trùng ref trong cùng phản hồi — giữ cái đầu
    if (rejectSceneRefs.has(s.ref)) continue; // AI cố định nghĩa lại cảnh được bảo vệ — bỏ qua
    const realId = keepIdSceneRefs.has(s.ref) ? s.ref : makeSceneId(episodeId);
    sceneRefMap.set(s.ref, realId);
    acceptedScenes.push({ ...s, id: realId });
  }
  // Các ref bị từ chối định nghĩa lại (cảnh đã có từ trước) vẫn phải resolve
  // được làm ĐÍCH cho lựa chọn — tự map ref->chính nó nếu AI chưa "chạm" tới.
  for (const ref of rejectSceneRefs) if (!sceneRefMap.has(ref)) sceneRefMap.set(ref, ref);
  for (const ref of keepIdSceneRefs) if (!sceneRefMap.has(ref)) sceneRefMap.set(ref, ref);

  const endingRefMap = new Map();
  const acceptedEndings = [];
  for (const e of rawEndings) {
    if (endingRefMap.has(e.ref)) continue;
    if (rejectEndingRefs.has(e.ref)) continue;
    const realId = makeEndingId(episodeId);
    endingRefMap.set(e.ref, realId);
    acceptedEndings.push({ ...e, id: realId });
  }
  for (const ref of rejectEndingRefs) if (!endingRefMap.has(ref)) endingRefMap.set(ref, ref);

  function resolveTarget(choice) {
    if (choice.targetKind === "ending" && endingRefMap.has(choice.target)) {
      return { targetType: "ending", targetId: endingRefMap.get(choice.target) };
    }
    if (sceneRefMap.has(choice.target)) {
      return { targetType: "scene", targetId: sceneRefMap.get(choice.target) };
    }
    // AI có thể lẫn targetKind — thử tra ngược nếu không khớp khai báo.
    if (endingRefMap.has(choice.target)) return { targetType: "ending", targetId: endingRefMap.get(choice.target) };
    return { targetType: null, targetId: null };
  }

  const scenes = acceptedScenes.map((s) => ({
    id: s.id,
    title: s.title,
    role: s.role,
    intent: s.intent,
    isStart: s.isStart,
    choices: s.choices.map((c) => {
      const { targetType, targetId } = resolveTarget(c);
      return { text: c.text, gateIntent: c.gateIntent, effectIntent: c.effectIntent, targetType, targetId };
    }),
  }));

  const endings = acceptedEndings.map((e) => ({ id: e.id, title: e.title, text: e.text, tone: e.tone }));

  const startScene = scenes.find((s) => s.isStart) || scenes[0];

  return { scenes, endings, startSceneId: startScene?.id || null };
}

/**
 * Áp dụng kết quả normalize vào 1 blueprint hiện có (hàm THUẦN). `replaceIds`
 * là tập ID cảnh sẽ bị THAY THẾ hoàn toàn bởi kết quả mới (ví dụ đúng 1 cảnh
 * đang "thiết kế lại", hoặc mọi cảnh chưa khoá khi tạo lại toàn bộ) — các
 * cảnh KHÔNG nằm trong tập này được giữ nguyên tham chiếu.
 */
// Phân giải effectIntent (lời tự nhiên) thành rules.effects thật + phần chưa
// ánh xạ được, dựa trên 1 bản registry cho trước — hàm THUẦN, dùng chung bởi
// applyNormalizedBlueprint (lúc AI vừa dựng xong) VÀ refreshBlueprintEffects
// (lúc người dùng vừa thêm entity còn thiếu vào danh mục, cần chấm lại NGAY
// mà không tốn thêm 1 lượt gọi AI — xem refreshBlueprintEffects()).
function resolveChoiceEffects(effectIntent, registry) {
  const parsed = parseEffectsDeterministic(effectIntent, registry);
  const effects = parsed.items?.filter((item) => item.status === "ok").map((item) => item.effect) || [];
  const unresolvedEffects = effectIntent && (parsed.items?.some((item) => item.status !== "ok") || parsed.unmatchedText || !parsed.items?.length)
    ? [{ intent: effectIntent, items: parsed.items || [] }]
    : [];
  return { effects, unresolvedEffects };
}

export function applyNormalizedBlueprint(blueprint, normalized, { replaceIds = null, replaceStartScene = false } = {}) {
  const registry = ensureRegistry(blueprint);
  const originalById = new Map((blueprint.scenes || []).map((s) => [s.id, s]));
  const keepScenes = replaceIds
    ? blueprint.scenes.filter((s) => !replaceIds.has(s.id))
    : [];
  const newScenes = normalized.scenes.map((s) => ({
    id: s.id,
    title: s.title,
    role: s.role,
    intent: s.intent,
    choices: s.choices.map((c) => {
      const { effects, unresolvedEffects } = resolveChoiceEffects(c.effectIntent, registry);
      return {
      id: `c_${Math.random().toString(36).slice(2, 9)}`,
      text: c.text,
      targetType: c.targetType,
      targetId: c.targetId,
      gateIntent: c.gateIntent,
      effectIntent: c.effectIntent,
      rules: { conditions: [], effects },
      conditionalOutcomes: [],
      unresolvedEffects,
    }; }),
    // Ghi chú (notes) do người dùng gõ tay ở Scene Intent Editor, AI không
    // biết tới trường này — giữ nguyên khi cập nhật tại chỗ 1 cảnh đã có.
    notes: originalById.get(s.id)?.notes || "",
    locked: false,
    userEdited: false,
  }));
  // Cập nhật tại chỗ (giữ vị trí) nếu ID đã tồn tại trong keepScenes trước khi
  // xoá — thật ra keepScenes đã loại các ID nằm trong replaceIds nên chỉ cần
  // nối thêm; thứ tự hiển thị KHÔNG quan trọng về mặt dữ liệu (đồ thị, không
  // phải danh sách tuyến tính).
  const scenes = [...keepScenes, ...newScenes];
  const endings = [...(blueprint.endings || []), ...normalized.endings.map((e) => ({ id: e.id, title: e.title, text: e.text, tone: e.tone }))];
  const startSceneId = replaceStartScene && normalized.startSceneId ? normalized.startSceneId : blueprint.startSceneId;
  return { ...blueprint, scenes, endings, startSceneId, updatedAt: new Date().toISOString() };
}

// Chấm lại rules.effects/unresolvedEffects của TOÀN BỘ blueprint theo 1 bản
// registry MỚI — hàm THUẦN, KHÔNG gọi AI. Dùng khi người dùng vừa thêm/sửa
// entity còn thiếu vào danh mục (vd qua "Chỉ số & trạng thái") trong lúc đang
// xem bản nháp (pending) AI vừa dựng: applyNormalizedBlueprint() chỉ chấm
// effectIntent MỘT LẦN lúc AI vừa trả lời, dùng đúng bản registry tại thời
// điểm đó — nếu registry đổi sau đó, bản nháp vẫn giữ unresolvedEffects CŨ và
// tiếp tục bị chặn "Áp dụng" dù entity đã có, buộc người dùng bấm dựng lại
// (tốn thêm 1 lượt gọi AI) chỉ để chấm lại đúng phần tra cứu cục bộ này. Gọi
// hàm này ngay trước khi validate/áp dụng để tránh lãng phí đó.
export function refreshBlueprintEffects(blueprint, registry) {
  return {
    ...blueprint,
    scenes: (blueprint.scenes || []).map((s) => ({
      ...s,
      choices: (s.choices || []).map((c) => {
        const { effects, unresolvedEffects } = resolveChoiceEffects(c.effectIntent, registry);
        return { ...c, rules: { ...c.rules, effects }, unresolvedEffects };
      }),
    })),
  };
}

// ---------- Điều phối gọi AI (bất đồng bộ) ----------

// Khung blueprint RỖNG (không cảnh nào) để nhận trọn bộ cảnh AI vừa dựng —
// LUÔN xoá sạch `scenes`/`endings`, kể cả khi chưa có existingBlueprint (vì
// newSceneBlueprint(episode) tự tạo sẵn 1 cảnh khung xương "Mở đầu"; giữ
// nguyên khung xương đó sẽ lẫn với các cảnh AI vừa dựng — đây là hàm THUẦN,
// test trực tiếp được để khoá đúng bất biến này).
export function emptyBlueprintBase(episode, existingBlueprint = null) {
  return { ...(existingBlueprint || newSceneBlueprint(episode)), scenes: [], endings: [] };
}

// Dựng sơ đồ tập LẦN ĐẦU (hoặc tạo lại toàn bộ, giữ nguyên các cảnh đã khoá).
export async function generateEpisodeBlueprint(episode, gamePlan, existingBlueprint = null, { forceRefresh = false } = {}) {
  const raw = await aiCall(buildEpisodeBlueprintPrompt(gamePlan, episode), { jsonSchema: EPISODE_BLUEPRINT_SCHEMA, maxAttempts: 1, maxOutputTokens: BLUEPRINT_AI_MAX_OUTPUT_TOKENS, forceRefresh });
  const lockedScenes = (existingBlueprint?.scenes || []).filter((s) => s.locked);
  const rejectSceneRefs = new Set(lockedScenes.map((s) => s.id));
  const normalized = normalizeAIBlueprintResponse(raw, episode.id, { rejectSceneRefs });

  if (lockedScenes.length === 0) {
    const base = emptyBlueprintBase(episode, existingBlueprint);
    return applyNormalizedBlueprint(base, normalized, { replaceIds: new Set(), replaceStartScene: true });
  }
  const replaceIds = new Set((existingBlueprint.scenes || []).filter((s) => !s.locked).map((s) => s.id));
  const startWasLocked = lockedScenes.some((s) => s.id === existingBlueprint.startSceneId);
  return applyNormalizedBlueprint(existingBlueprint, normalized, { replaceIds, replaceStartScene: !startWasLocked });
}

export function getBlueprintScaleStatus(blueprint, episode) {
  return assessBlueprintScale(blueprint, resolveEpisodeConstraints(episode));
}

export async function continueEpisodeBlueprint(episode, gamePlan, partialBlueprint) {
  const constraints = resolveEpisodeConstraints(episode);
  const status = assessBlueprintScale(partialBlueprint, constraints);
  const missingCount = Math.max(1, constraints.targetSceneCount - status.meaningfulSceneCount);
  const raw = await aiCall(buildBlueprintContinuationPrompt(gamePlan, episode, partialBlueprint, missingCount), {
    jsonSchema: EPISODE_BLUEPRINT_SCHEMA,
    maxAttempts: 1,
    maxOutputTokens: BLUEPRINT_AI_MAX_OUTPUT_TOKENS,
  });
  const rejectSceneRefs = new Set((partialBlueprint.scenes || []).map((scene) => scene.id));
  const rejectEndingRefs = new Set((partialBlueprint.endings || []).map((ending) => ending.id));
  const capacity = MAX_SCENES_PER_EPISODE - (partialBlueprint.scenes || []).length;
  if (capacity <= 0) throw new Error(`Tập đã đạt trần an toàn ${MAX_SCENES_PER_EPISODE} cảnh. Hãy chỉnh kế hoạch hoặc sơ đồ hiện tại trước khi tiếp tục.`);
  const limitedRaw = { ...raw, scenes: safeArray(raw?.scenes).slice(0, capacity) };
  const normalized = normalizeAIBlueprintResponse(limitedRaw, episode.id, { rejectSceneRefs, rejectEndingRefs });
  return applyNormalizedBlueprint(partialBlueprint, normalized, { replaceIds: new Set(), replaceStartScene: false });
}

// "AI thiết kế lại cảnh" — CHỈ sửa 1 cảnh (targetSceneId) + cảnh mới nó cần.
export async function regenerateScene(blueprint, episode, gamePlan, targetSceneId, instructionText) {
  const target = blueprint.scenes.find((s) => s.id === targetSceneId);
  if (!target) throw new Error("Không tìm thấy cảnh này trong sơ đồ.");
  if (target.locked) throw new Error("Cảnh này đang khoá — mở khoá trước khi để AI thiết kế lại.");

  const raw = await aiCall(buildSceneRedesignPrompt(gamePlan, episode, blueprint, targetSceneId, instructionText), {
    jsonSchema: SCENE_REDESIGN_SCHEMA,
  });
  // Mọi cảnh KHÁC cảnh đang sửa đều được bảo vệ (AI chỉ được TRỎ TỚI, không
  // được định nghĩa lại) — chỉ đúng targetSceneId được phép cập nhật tại chỗ.
  const rejectSceneRefs = new Set(blueprint.scenes.filter((s) => s.id !== targetSceneId).map((s) => s.id));
  const keepIdSceneRefs = new Set([targetSceneId]);
  const rejectEndingRefs = new Set((blueprint.endings || []).map((e) => e.id));

  const normalized = normalizeAIBlueprintResponse(raw, episode.id, { rejectSceneRefs, keepIdSceneRefs, rejectEndingRefs });
  if (!normalized.scenes.some((s) => s.id === targetSceneId)) {
    throw new Error("AI không trả lại đúng cảnh đang sửa — hãy thử lại.");
  }
  const replaceIds = new Set([targetSceneId]);
  return applyNormalizedBlueprint(blueprint, normalized, { replaceIds, replaceStartScene: false });
}

export { MAX_SCENES_PER_EPISODE };
