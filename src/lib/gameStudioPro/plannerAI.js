// Xưởng Game Pro — PRO 1: AI Game/Episode Planner.
//
// Chia rõ 2 nhóm hàm:
// - THUẦN (validate*/merge*/reorder*/toggle*/add*/remove*): không gọi AI,
//   test trực tiếp được mà không cần giả lập aiCall/localStorage/mạng.
// - BẤT ĐỒNG BỘ (generate*/regenerate*): gọi aiCall() rồi dùng lại đúng các
//   hàm thuần ở trên để thẩm định + hợp nhất kết quả.
//
// aiCall() (src/lib/aiCall.js) KHÔNG ép schema thật ở phía model — chỉ nhúng
// schema vào prompt dạng chỉ dẫn rồi parse JSON. Vì vậy mọi validate* ở đây
// PHẢI khoan dung: bù mặc định cho trường thiếu, giới hạn độ dài mảng, và
// chỉ throw khi phản hồi thực sự không dùng được — không được để 1 phản hồi
// AI lệch chuẩn làm crash Studio.
import { aiCall } from "../aiCall.js";
import {
  buildGamePlanPrompt,
  GAME_PLAN_SCHEMA,
  buildEpisodePlanPrompt,
  EPISODE_PLAN_SCHEMA,
} from "./plannerPrompts.js";
import { MAX_EPISODES, PLANNER_STATUS, makePlannerId, newStoryBlueprint, newBlankEpisode } from "./plannerModel.js";
import { derivePlanningConstraints, derivePerEpisodeConstraints } from "./planningConstraints.js";

// Kế hoạch là dữ liệu nền bắt buộc của cả xưởng. Một JSON bị cắt không nên
// làm người dùng mất toàn bộ lần bấm chỉ vì chính sách tiết kiệm request của
// các công cụ gợi ý không quan trọng. Cho phép đúng một lần trả lại súc tích;
// aiCall vẫn không retry lỗi quota/429.
const PLANNER_OPTIONS = { maxAttempts: 2 };

function safeString(v) {
  return typeof v === "string" ? v.trim() : "";
}
function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeNumber(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function sanitizeSuggestion(item) {
  if (!item || typeof item !== "object") return null;
  const name = safeString(item.name);
  if (!name || DANGEROUS_KEYS.has(name)) return null;
  return { name, description: safeString(item.description), origin: item.origin === "user" ? "user" : "ai" };
}
function sanitizeCharacter(item) {
  if (!item || typeof item !== "object") return null;
  const name = safeString(item.name);
  if (!name) return null;
  return { name, role: safeString(item.role), description: safeString(item.description) };
}
function sanitizeEpisodeSummary(item) {
  if (!item || typeof item !== "object") return null;
  const title = safeString(item.title);
  if (!title) return null;
  return { title, summary: safeString(item.summary) };
}
function sanitizeStage(item) {
  if (!item || typeof item !== "object") return null;
  return {
    title: safeString(item.title),
    purpose: safeString(item.purpose),
    approximateSceneCount: safeNumber(item.approximateSceneCount),
    importantEvents: safeArray(item.importantEvents).map(safeString).filter(Boolean).slice(0, 20),
  };
}
function sanitizeIntent(item) {
  if (!item || typeof item !== "object") return null;
  const description = safeString(item.description);
  if (!description) return null;
  return { type: safeString(item.type) || "other", description };
}

// ---------- Thẩm định phản hồi AI (thuần) ----------
export function validateAIGamePlanResponse(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("AI không trả về dữ liệu hợp lệ cho Kế hoạch Game. Hãy thử lại.");
  }
  const title = safeString(raw.title);
  const episodeSummaries = safeArray(raw.episodeSummaries)
    .map(sanitizeEpisodeSummary)
    .filter(Boolean)
    .slice(0, MAX_EPISODES);
  if (!title && episodeSummaries.length === 0) {
    throw new Error("AI không trả về tên game hay danh sách tập nào — hãy thử lại hoặc mô tả ý tưởng chi tiết hơn.");
  }
  return {
    title: title || "Game Pro Mới",
    premise: safeString(raw.premise),
    genre: safeString(raw.genre),
    tone: safeString(raw.tone),
    coreGameplayLoop: safeString(raw.coreGameplayLoop),
    protagonist: safeString(raw.protagonist),
    importantCharacters: safeArray(raw.importantCharacters).map(sanitizeCharacter).filter(Boolean).slice(0, 20),
    suggestedStats: safeArray(raw.suggestedStats).map(sanitizeSuggestion).filter(Boolean).slice(0, 20),
    suggestedRelationships: safeArray(raw.suggestedRelationships).map(sanitizeSuggestion).filter(Boolean).slice(0, 20),
    suggestedFlags: safeArray(raw.suggestedFlags).map(sanitizeSuggestion).filter(Boolean).slice(0, 20),
    suggestedItems: safeArray(raw.suggestedItems).map(sanitizeSuggestion).filter(Boolean).slice(0, 20),
    majorSystems: safeArray(raw.majorSystems).map(safeString).filter(Boolean).slice(0, 20),
    endingStrategy: safeString(raw.endingStrategy),
    episodeSummaries,
  };
}

export function validateAIEpisodePlanResponse(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("AI không trả về dữ liệu hợp lệ cho Kế hoạch Tập. Hãy thử lại.");
  }
  const title = safeString(raw.title);
  const summary = safeString(raw.summary);
  if (!title && !summary) {
    throw new Error("AI không trả về tên hay tóm tắt cho tập này — hãy thử tạo lại.");
  }
  return {
    title: title || "Tập mới",
    summary,
    startState: safeString(raw.startState),
    goal: safeString(raw.goal),
    stages: safeArray(raw.stages).map(sanitizeStage).filter(Boolean).slice(0, 15),
    keyCharacters: safeArray(raw.keyCharacters).map(safeString).filter(Boolean).slice(0, 20),
    relevantStats: safeArray(raw.relevantStats).map(safeString).filter(Boolean).slice(0, 20),
    relevantFlags: safeArray(raw.relevantFlags).map(safeString).filter(Boolean).slice(0, 20),
    relevantItems: safeArray(raw.relevantItems).map(safeString).filter(Boolean).slice(0, 20),
    majorConflict: safeString(raw.majorConflict),
    climax: safeString(raw.climax),
    possibleFailure: safeString(raw.possibleFailure),
    transitionToNextEpisode: safeString(raw.transitionToNextEpisode),
    planningIntents: safeArray(raw.planningIntents).map(sanitizeIntent).filter(Boolean).slice(0, 30),
  };
}

// ---------- Hợp nhất kết quả vào storyBlueprint (thuần) ----------
// Tập đã khoá giữ nguyên `order` và không bao giờ nằm trong newEpisodesInOrder
// (AI được yêu cầu KHÔNG lập lại chúng — xem buildGamePlanPrompt) nên không
// cần nhánh "khớp số lượng" — về mặt cấu trúc, tập khoá không thể bị đụng.
export function mergeGamePlanRegeneration(storyBlueprint, idea, settings, gamePlanFields, newEpisodesInOrder) {
  const lockedEpisodes = (storyBlueprint.episodes || []).filter((e) => e.locked);
  const usedOrders = new Set(lockedEpisodes.map((e) => e.order));
  let nextOrder = 1;
  const allocateOrder = () => {
    while (usedOrders.has(nextOrder)) nextOrder += 1;
    usedOrders.add(nextOrder);
    return nextOrder++;
  };
  const orderedNew = newEpisodesInOrder.map((ep) => ({ ...ep, order: allocateOrder() }));
  const episodes = [...lockedEpisodes, ...orderedNew].sort((a, b) => a.order - b.order);
  return {
    ...storyBlueprint,
    idea: idea != null ? idea : storyBlueprint.idea,
    settings: settings || storyBlueprint.settings,
    gamePlan: gamePlanFields,
    episodes,
    status: PLANNER_STATUS.PLANNED,
  };
}

// Thay đúng 1 tập, các tập khác giữ nguyên tham chiếu — không có cách nào để
// hàm này vô tình xoá/đụng tập khác.
export function mergeEpisodeRegeneration(storyBlueprint, episodeId, newEpisode) {
  return {
    ...storyBlueprint,
    episodes: (storyBlueprint.episodes || []).map((e) => (e.id === episodeId ? newEpisode : e)),
    status: storyBlueprint.status === PLANNER_STATUS.APPROVED ? PLANNER_STATUS.PLANNED : storyBlueprint.status,
  };
}

// ---------- Danh sách tập: sắp xếp / khoá / thêm / xoá (thuần) ----------
export function reorderEpisode(episodes, id, direction) {
  const idx = episodes.findIndex((e) => e.id === id);
  if (idx === -1) return episodes;
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= episodes.length) return episodes;
  const next = episodes.slice();
  const a = next[idx];
  const b = next[swapWith];
  next[idx] = { ...b, order: a.order };
  next[swapWith] = { ...a, order: b.order };
  return next.sort((x, y) => x.order - y.order);
}

export function toggleEpisodeLock(episodes, id) {
  return episodes.map((e) => (e.id === id ? { ...e, locked: !e.locked } : e));
}

export function removeEpisode(episodes, id) {
  return episodes.filter((e) => e.id !== id);
}

export function addBlankEpisode(episodes) {
  const order = episodes.length ? Math.max(...episodes.map((e) => e.order)) + 1 : 1;
  return [...episodes, newBlankEpisode(order)];
}

// ---------- Ước lượng số tập cần lập kế hoạch (thuần) ----------
export function desiredEpisodeCount(settings, existingNonLockedCount = 0) {
  if (!settings || settings.gameLength !== "long") return 1;
  const n = Number(settings.estimatedEpisodes);
  if (Number.isFinite(n) && n > 0) return Math.min(Math.round(n), MAX_EPISODES);
  if (existingNonLockedCount > 0) return Math.min(existingNonLockedCount, MAX_EPISODES);
  return 5;
}

// Schema của aiCall chỉ là chỉ dẫn nên model đôi lúc vẫn trả sai số tập.
// Chuẩn hoá ở biên dữ liệu để lựa chọn của người dùng luôn thắng. Với game
// ngắn, gộp toàn bộ ý chính model đã nghĩ ra thay vì cắt mất hồi giữa/cuối.
export function normalizeEpisodeSummaries(episodeSummaries, desiredCount, gameTitle = "") {
  const items = safeArray(episodeSummaries).filter(Boolean);
  const count = Math.max(1, Math.min(Number(desiredCount) || 1, MAX_EPISODES));
  if (count === 1 && items.length > 1) {
    return [{
      title: gameTitle || items[0].title || "Tập duy nhất",
      summary: items.map((item) => `${item.title}: ${item.summary}`).join(" "),
    }];
  }
  return items.slice(0, count);
}

export function collapseShortGameEpisodes(storyBlueprint) {
  const episodes = storyBlueprint?.episodes || [];
  if (storyBlueprint?.settings?.gameLength === "long" || episodes.length === 0) return storyBlueprint;
  const shortConstraints = derivePlanningConstraints(storyBlueprint.idea, episodes.flatMap((episode) => safeArray(episode.stages)));
  if (episodes.length === 1) {
    return {
      ...storyBlueprint,
      planningConstraints: shortConstraints,
      episodes: [{
        ...episodes[0],
        planningConstraints: shortConstraints,
      }],
    };
  }
  const first = episodes[0];
  const unique = (key) => [...new Set(episodes.flatMap((episode) => safeArray(episode[key])).filter(Boolean))];
  const joined = (key) => episodes.map((episode) => safeString(episode[key])).filter(Boolean).join(" ");
  const episode = {
    ...first,
    order: 1,
    title: storyBlueprint.gamePlan?.title || first.title,
    summary: episodes.map((item) => `${item.title}: ${item.summary}`).join(" "),
    startState: first.startState,
    goal: joined("goal"),
    stages: episodes.flatMap((item) => safeArray(item.stages)),
    keyCharacters: unique("keyCharacters"),
    relevantStats: unique("relevantStats"),
    relevantFlags: unique("relevantFlags"),
    relevantItems: unique("relevantItems"),
    majorConflict: joined("majorConflict"),
    climax: episodes.map((item) => safeString(item.climax)).filter(Boolean).at(-1) || "",
    possibleFailure: joined("possibleFailure"),
    transitionToNextEpisode: "",
    planningIntents: episodes.flatMap((item) => safeArray(item.planningIntents)),
    planningConstraints: shortConstraints,
  };
  return { ...storyBlueprint, planningConstraints: shortConstraints, episodes: [episode] };
}

function compactNeighbor(episode) {
  if (!episode) return null;
  return { title: episode.title, summary: episode.summary, goal: episode.goal };
}

// ---------- Điều phối gọi AI (bất đồng bộ) ----------
export async function generateGamePlanWithEpisodes(idea, settings, { onProgress } = {}) {
  const planningConstraints = derivePlanningConstraints(idea);
  const desiredCount = desiredEpisodeCount(settings, 0);
  onProgress?.({ stage: "gameplan" });
  const raw = await aiCall(buildGamePlanPrompt(idea, settings, [], desiredCount), { jsonSchema: GAME_PLAN_SCHEMA, ...PLANNER_OPTIONS });
  const validated = validateAIGamePlanResponse(raw);
  const episodeSummaries = normalizeEpisodeSummaries(validated.episodeSummaries, desiredCount, validated.title);
  const gamePlan = { ...validated };
  delete gamePlan.episodeSummaries;
  const perEpisodeConstraints = derivePerEpisodeConstraints(planningConstraints, episodeSummaries.length);

  const episodes = [];
  for (let i = 0; i < episodeSummaries.length; i++) {
    onProgress?.({ stage: "episode", index: i, total: episodeSummaries.length, title: episodeSummaries[i].title });
    const neighbors = { prev: compactNeighbor(episodes[i - 1]), next: episodeSummaries[i + 1] || null };
    const episodeSeed = { ...episodeSummaries[i], planningConstraints: perEpisodeConstraints };
    const epRaw = await aiCall(buildEpisodePlanPrompt(gamePlan, episodeSeed, neighbors), {
      jsonSchema: EPISODE_PLAN_SCHEMA,
      ...PLANNER_OPTIONS,
    });
    const epValidated = validateAIEpisodePlanResponse(epRaw);
    episodes.push({ id: makePlannerId("ep"), order: i + 1, locked: false, ...epValidated, planningConstraints: perEpisodeConstraints });
  }

  return {
    ...newStoryBlueprint(idea, settings), planningConstraints,
    gamePlan,
    episodes,
    status: PLANNER_STATUS.PLANNED,
  };
}

export async function regenerateFullPlan(storyBlueprint, idea, settings, { onProgress } = {}) {
  const planningConstraints = derivePlanningConstraints(idea);
  const lockedEpisodes = (storyBlueprint.episodes || []).filter((e) => e.locked);
  const nonLockedCount = (storyBlueprint.episodes || []).filter((e) => !e.locked).length;
  const desiredCount = desiredEpisodeCount(settings, nonLockedCount);

  onProgress?.({ stage: "gameplan" });
  const raw = await aiCall(buildGamePlanPrompt(idea, settings, lockedEpisodes, desiredCount), {
    jsonSchema: GAME_PLAN_SCHEMA,
    ...PLANNER_OPTIONS,
  });
  const validated = validateAIGamePlanResponse(raw);
  const episodeSummaries = normalizeEpisodeSummaries(validated.episodeSummaries, desiredCount, validated.title);
  const gamePlan = { ...validated };
  delete gamePlan.episodeSummaries;
  const perEpisodeConstraints = derivePerEpisodeConstraints(planningConstraints, lockedEpisodes.length + episodeSummaries.length);

  const newEpisodes = [];
  for (let i = 0; i < episodeSummaries.length; i++) {
    onProgress?.({ stage: "episode", index: i, total: episodeSummaries.length, title: episodeSummaries[i].title });
    const prev = newEpisodes[i - 1] ? compactNeighbor(newEpisodes[i - 1]) : compactNeighbor(lockedEpisodes[lockedEpisodes.length - 1]);
    const next = episodeSummaries[i + 1] || null;
    const epRaw = await aiCall(buildEpisodePlanPrompt(gamePlan, { ...episodeSummaries[i], planningConstraints: perEpisodeConstraints }, { prev, next }), {
      jsonSchema: EPISODE_PLAN_SCHEMA,
      ...PLANNER_OPTIONS,
    });
    const epValidated = validateAIEpisodePlanResponse(epRaw);
    newEpisodes.push({ id: makePlannerId("ep"), locked: false, ...epValidated, planningConstraints: perEpisodeConstraints });
  }

  return { ...mergeGamePlanRegeneration(storyBlueprint, idea, settings, gamePlan, newEpisodes), planningConstraints };
}

export async function regenerateOneEpisode(storyBlueprint, episodeId, { onProgress } = {}) {
  const episodes = storyBlueprint.episodes || [];
  const idx = episodes.findIndex((e) => e.id === episodeId);
  if (idx === -1) throw new Error("Không tìm thấy tập này.");
  const target = episodes[idx];
  if (target.locked) throw new Error("Tập này đang khoá — mở khoá trước khi tạo lại.");

  onProgress?.({ stage: "episode", index: 0, total: 1, title: target.title });
  const neighbors = { prev: compactNeighbor(episodes[idx - 1]), next: compactNeighbor(episodes[idx + 1]) };
  const raw = await aiCall(buildEpisodePlanPrompt(storyBlueprint.gamePlan, target, neighbors), {
    jsonSchema: EPISODE_PLAN_SCHEMA,
    ...PLANNER_OPTIONS,
  });
  const validated = validateAIEpisodePlanResponse(raw);
  const newEpisode = { ...target, ...validated };
  return mergeEpisodeRegeneration(storyBlueprint, episodeId, newEpisode);
}
