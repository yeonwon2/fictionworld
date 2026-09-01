// Xưởng Game Pro — PRO 6: MECHANICS — vốn từ chung cho các khả năng gameplay
// mà một game Pro có thể "bật". Đây KHÔNG phải runtime thứ hai: mọi mechanic
// dưới đây hoặc (a) đã có sẵn 100% trong entityRegistry.js/ruleModel.js/
// proCompiler.js (stat/relationship/flag/item/vital-stat — mechanic chỉ là
// lớp UI/vocabulary thân thiện hơn phủ lên trên), hoặc (b) là dữ liệu
// AUTHORING-ONLY/DEFERRED_RUNTIME được khai báo rõ ràng, KHÔNG giả vờ có hỗ
// trợ runtime khi chưa có (mục 29 yêu cầu PRO 6) — xem `supportLevel` ở
// MECHANIC_DEFS.
//
// `mechanics.enabled` là MẢNG id ổn định (KHÔNG bao giờ dùng displayName làm
// định danh — cùng quy ước với entityRegistry.js). "stats" và "flags" không
// nằm trong danh sách toggle được vì chúng là năng lực NỀN mọi mechanic khác
// đều dựa vào (STAT_COMPARE/STAT_CHANGE/FLAG_PRESENT/GRANT_FLAG luôn sẵn có
// bất kể mechanics nào được bật).
//
// `currency` và `rank` KHÔNG sở hữu bản sao riêng của entity — config của
// chúng chỉ giữ `entityId` trỏ vào MỘT stat đã có sẵn trong
// globalState.registry (bài học từ PRO 5 hotfix FIX1: không được có nguồn sự
// thật thứ hai cho cùng 1 entity).
export const MECHANICS_SCHEMA_VERSION = 1;

export const MECHANIC_IDS = {
  RELATIONSHIP: "relationship",
  INVENTORY: "inventory",
  VITAL_STAT: "vitalStat",
  CURRENCY: "currency",
  RANK: "rank",
  SYSTEM: "system",
  QUEST: "quest",
};

export const SUPPORT_LEVELS = {
  SUPPORTED: "SUPPORTED",
  AUTHORING_ONLY: "AUTHORING_ONLY",
  DEFERRED_RUNTIME: "DEFERRED_RUNTIME",
};

// icon: emoji hiển thị trong MechanicsPanel.jsx (mục 21) — thuần trang trí.
export const MECHANIC_DEFS = {
  [MECHANIC_IDS.RELATIONSHIP]: {
    id: MECHANIC_IDS.RELATIONSHIP,
    label: "Quan hệ",
    icon: "❤️",
    description: "Theo dõi thiện cảm/sủng ái với từng NPC.",
    supportLevel: SUPPORT_LEVELS.SUPPORTED,
  },
  [MECHANIC_IDS.VITAL_STAT]: {
    id: MECHANIC_IDS.VITAL_STAT,
    label: "Chỉ số sinh tử",
    icon: "❤️",
    description: "Chạm ngưỡng → Game Over.",
    supportLevel: SUPPORT_LEVELS.SUPPORTED,
  },
  [MECHANIC_IDS.CURRENCY]: {
    id: MECHANIC_IDS.CURRENCY,
    label: "Tiền tệ",
    icon: "💰",
    description: "Tiền / vàng / điểm hệ thống.",
    supportLevel: SUPPORT_LEVELS.SUPPORTED,
  },
  [MECHANIC_IDS.RANK]: {
    id: MECHANIC_IDS.RANK,
    label: "Cấp bậc",
    icon: "🎖",
    description: "Các mốc thăng tiến.",
    supportLevel: SUPPORT_LEVELS.AUTHORING_ONLY,
  },
  [MECHANIC_IDS.INVENTORY]: {
    id: MECHANIC_IDS.INVENTORY,
    label: "Vật phẩm",
    icon: "🎒",
    description: "Vật phẩm ảnh hưởng lựa chọn.",
    supportLevel: SUPPORT_LEVELS.SUPPORTED,
  },
  [MECHANIC_IDS.SYSTEM]: {
    id: MECHANIC_IDS.SYSTEM,
    label: "Hệ thống",
    icon: "🔔",
    description: "Thông báo hệ thống khi vào cảnh/sau lựa chọn.",
    supportLevel: SUPPORT_LEVELS.SUPPORTED,
  },
  [MECHANIC_IDS.QUEST]: {
    id: MECHANIC_IDS.QUEST,
    label: "Nhiệm vụ",
    icon: "📜",
    description: "Ghi chú nhiệm vụ/mục tiêu — CHƯA được game tự thực thi (chỉ là ghi chú tác giả).",
    supportLevel: SUPPORT_LEVELS.DEFERRED_RUNTIME,
  },
};

export function newEmptyMechanicsState() {
  return {
    version: MECHANICS_SCHEMA_VERSION,
    enabled: [],
    configs: {
      currency: [],
      rank: [],
      quest: [],
      system: { name: "", notificationStyle: "" },
    },
  };
}

// Blueprint tạo trước PRO 6 không có `mechanics` hợp lệ — luôn trả về bản hợp
// lệ, cùng quy ước phòng thủ đã dùng ở ensureRegistry()/ensureGlobalState().
export function ensureMechanicsState(mechanics) {
  const m = mechanics && typeof mechanics === "object" ? mechanics : {};
  return {
    version: MECHANICS_SCHEMA_VERSION,
    enabled: Array.isArray(m.enabled) ? [...new Set(m.enabled.filter((id) => MECHANIC_DEFS[id]))] : [],
    configs: {
      currency: Array.isArray(m.configs?.currency) ? m.configs.currency : [],
      rank: Array.isArray(m.configs?.rank) ? m.configs.rank : [],
      quest: Array.isArray(m.configs?.quest) ? m.configs.quest : [],
      system: m.configs?.system && typeof m.configs.system === "object"
        ? { name: m.configs.system.name || "", notificationStyle: m.configs.system.notificationStyle || "" }
        : { name: "", notificationStyle: "" },
    },
  };
}

export function isMechanicEnabled(mechanics, id) {
  return ensureMechanicsState(mechanics).enabled.includes(id);
}

export function toggleMechanic(mechanics, id, on) {
  const m = ensureMechanicsState(mechanics);
  if (!MECHANIC_DEFS[id]) return m;
  const has = m.enabled.includes(id);
  if (on === has) return m;
  return { ...m, enabled: on ? [...m.enabled, id] : m.enabled.filter((x) => x !== id) };
}

// Cộng dồn (union) nhiều mechanic cùng lúc — KHÔNG bao giờ tắt mechanic đang
// bật (dùng khi áp Template — mục 16 "Template apply ≠ reset", chỉ CỘNG).
export function enableMechanics(mechanics, ids) {
  const m = ensureMechanicsState(mechanics);
  const next = new Set(m.enabled);
  for (const id of ids || []) if (MECHANIC_DEFS[id]) next.add(id);
  return { ...m, enabled: [...next] };
}

let idCounter = 0;
function uniqueSuffix() {
  idCounter += 1;
  return `${Date.now().toString(36)}${idCounter.toString(36)}`;
}

// ---------- Currency config ----------
export function newCurrencyConfig({ entityId, unit = "", allowNegative = false } = {}) {
  return { id: `currency_${uniqueSuffix()}`, entityId, unit, allowNegative: !!allowNegative };
}
export function setCurrencyConfigs(mechanics, configs) {
  const m = ensureMechanicsState(mechanics);
  return { ...m, configs: { ...m.configs, currency: configs } };
}
export function addCurrencyConfig(mechanics, opts) {
  const m = ensureMechanicsState(mechanics);
  return { ...m, configs: { ...m.configs, currency: [...m.configs.currency, newCurrencyConfig(opts)] } };
}
export function removeCurrencyConfig(mechanics, id) {
  const m = ensureMechanicsState(mechanics);
  return { ...m, configs: { ...m.configs, currency: m.configs.currency.filter((c) => c.id !== id) } };
}

// ---------- Rank config ----------
export function newRankLevel({ label = "", threshold = 0 } = {}) {
  return { id: `ranklv_${uniqueSuffix()}`, label, threshold };
}
// `templateId` (mặc định null): metadata ỔN ĐỊNH đánh dấu rank config này do
// chính Template nào sinh ra — KHÔNG dùng displayName/label để phân biệt
// (nhiều template có thể trùng label, và người dùng có thể tự đổi label sau
// khi tạo). null = rank do người dùng tự tạo tay (qua MechanicsPanel), không
// bao giờ bị applyTemplate() coi là "đã có rank của template này" — xem
// templateRegistry.js#applyTemplate (HOTFIX PRO 6: idempotent rank apply).
export function newRankConfig({ label = "Cấp bậc", entityId, levels = [], templateId = null } = {}) {
  // Chuẩn hoá levels: mỗi level luôn có id ổn định — chấp nhận input thô
  // {label, threshold} (vd từ templateRegistry.js's suggestedRank, chưa từng
  // đi qua addRankLevel()) lẫn level đã có id sẵn (giữ nguyên, không cấp lại).
  const normalizedLevels = levels.map((lv) => (lv?.id ? lv : newRankLevel(lv)));
  return { id: `rank_${uniqueSuffix()}`, label, entityId, levels: normalizedLevels, templateId };
}
export function setRankConfigs(mechanics, configs) {
  const m = ensureMechanicsState(mechanics);
  return { ...m, configs: { ...m.configs, rank: configs } };
}
export function addRankConfig(mechanics, opts) {
  const m = ensureMechanicsState(mechanics);
  return { ...m, configs: { ...m.configs, rank: [...m.configs.rank, newRankConfig(opts)] } };
}
// Tìm rank config do ĐÚNG template này sinh ra trước đó (nếu có) — dùng bởi
// applyTemplate() để không tạo bản sao khi áp lại cùng 1 template (HOTFIX PRO
// 6). Rank do người dùng tự tạo luôn có templateId=null nên không bao giờ khớp.
export function findRankConfigByTemplateId(mechanics, templateId) {
  const m = ensureMechanicsState(mechanics);
  return m.configs.rank.find((r) => r.templateId === templateId) || null;
}
export function removeRankConfig(mechanics, id) {
  const m = ensureMechanicsState(mechanics);
  return { ...m, configs: { ...m.configs, rank: m.configs.rank.filter((r) => r.id !== id) } };
}
export function addRankLevel(mechanics, rankId, opts) {
  const m = ensureMechanicsState(mechanics);
  return {
    ...m,
    configs: {
      ...m.configs,
      rank: m.configs.rank.map((r) => (r.id === rankId ? { ...r, levels: [...r.levels, newRankLevel(opts)] } : r)),
    },
  };
}
export function removeRankLevel(mechanics, rankId, levelId) {
  const m = ensureMechanicsState(mechanics);
  return {
    ...m,
    configs: {
      ...m.configs,
      rank: m.configs.rank.map((r) => (r.id === rankId ? { ...r, levels: r.levels.filter((lv) => lv.id !== levelId) } : r)),
    },
  };
}

// ---------- Quest config (DEFERRED_RUNTIME — chỉ là ghi chú tác giả) ----------
export function newQuestNote({ title = "", description = "", completionIntent = "", rewardIntent = "" } = {}) {
  return { id: `quest_${uniqueSuffix()}`, title, description, completionIntent, rewardIntent };
}
export function setQuestConfigs(mechanics, configs) {
  const m = ensureMechanicsState(mechanics);
  return { ...m, configs: { ...m.configs, quest: configs } };
}
export function addQuestNote(mechanics, opts) {
  const m = ensureMechanicsState(mechanics);
  return { ...m, configs: { ...m.configs, quest: [...m.configs.quest, newQuestNote(opts)] } };
}
export function removeQuestNote(mechanics, id) {
  const m = ensureMechanicsState(mechanics);
  return { ...m, configs: { ...m.configs, quest: m.configs.quest.filter((q) => q.id !== id) } };
}

// ---------- System config ----------
export function setSystemConfig(mechanics, patch) {
  const m = ensureMechanicsState(mechanics);
  return { ...m, configs: { ...m.configs, system: { ...m.configs.system, ...patch } } };
}

// ---------- Context cho Planner AI / External AI (mục 18/19) ----------
// Tóm tắt ngắn gọn, bằng lời — không lộ cấu trúc IR nội bộ — để nhúng vào
// prompt (plannerPrompts.js/scriptPromptGenerator.js).
export function describeMechanicsForPrompt(mechanics, registry) {
  const m = ensureMechanicsState(mechanics);
  const lines = [];
  for (const id of m.enabled) {
    const def = MECHANIC_DEFS[id];
    if (!def) continue;
    if (id === MECHANIC_IDS.CURRENCY && m.configs.currency.length) {
      for (const c of m.configs.currency) {
        const entity = registry ? findRegistryEntity(registry, c.entityId) : null;
        lines.push(`💰 Tiền tệ: ${entity?.displayName || "(chưa gắn chỉ số)"}${c.allowNegative ? "" : " (không nên âm)"}`);
      }
      continue;
    }
    if (id === MECHANIC_IDS.RANK && m.configs.rank.length) {
      for (const r of m.configs.rank) {
        const entity = registry ? findRegistryEntity(registry, r.entityId) : null;
        const ladder = r.levels.map((lv) => lv.label).filter(Boolean).join(" → ");
        lines.push(`🎖 ${r.label}${entity ? ` (theo ${entity.displayName})` : ""}${ladder ? `: ${ladder}` : ""}`);
      }
      continue;
    }
    lines.push(`${def.icon} ${def.label}`);
  }
  return lines;
}

function findRegistryEntity(registry, entityId) {
  if (!entityId) return null;
  return (
    (registry.stats || []).find((e) => e.id === entityId) ||
    (registry.flags || []).find((e) => e.id === entityId) ||
    (registry.items || []).find((e) => e.id === entityId) ||
    null
  );
}
