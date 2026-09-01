// Xưởng Game Pro — PRO 3: CANONICAL RULE IR (Intermediate Representation).
//
// Đây là "nguồn sự thật" cho luật do người dùng viết bằng lời — KHÔNG phải
// một engine luật thứ hai. Field runtime thật (statRequirements/requiresFlag/
// statModifiers/...) do proCompiler.js dịch RA từ IR này mỗi lần biên dịch —
// IR mới là dữ liệu được LƯU (choice.rules), câu AI dịch chỉ là input.
//
// Mỗi Condition/Effect tham chiếu entity bằng `entityId` (xem
// entityRegistry.js) — KHÔNG bao giờ lưu tên hiển thị trực tiếp trong IR, để
// đổi tên entity không làm hỏng luật đã lưu.
//
// `choice.rules.conditions` là một MẢNG — ngữ nghĩa mặc định là AND (đúng
// hành vi runtime hiện tại: mỗi field điều kiện là một AND riêng — mục 16).
// OR KHÔNG được hỗ trợ trực tiếp trên 1 lựa chọn — xem ruleValidator.js.

export const CONDITION_TYPES = {
  STAT_COMPARE: "stat_compare", // { entityId, operator, value } — entity.kind stat|relationship
  FLAG_PRESENT: "flag_present", // { entityId }
  FLAG_ABSENT: "flag_absent", // { entityId }
  ITEM_PRESENT: "item_present", // { entityId }
  UNSUPPORTED: "unsupported", // { raw, reason } — luật không dịch được, KHÔNG được đoán
};

export const EFFECT_TYPES = {
  STAT_CHANGE: "stat_change", // { entityId, amount } — entity.kind stat|relationship
  GRANT_FLAG: "grant_flag", // { entityId }
  GRANT_ITEM: "grant_item", // { entityId }
  REMOVE_ITEM: "remove_item", // { entityId }
  // PRO 6: KHÔNG tham chiếu entity — { title, text }. Dịch thẳng thành
  // choice.systemPopup (field runtime CÓ SẴN, GamePlayer.jsx đã đọc/hiện từ
  // trước cho mọi archetype — xem postprocess.js#cleanPopup) — không phải
  // field mới do PRO 6 phát minh, chỉ là promote nó thành hệ quả tác giả có
  // thể chọn trong Rule Editor thay vì việc riêng của 4 Xưởng Legacy cũ.
  SHOW_POPUP: "show_popup", // { title, text }
  UNSUPPORTED: "unsupported", // { raw, reason }
};

export const OPERATORS = [">=", "<=", ">", "<", "=="];

// Giới hạn THẬT của runtime (xem audit proCompiler.js/GamePlayer.jsx): các
// field điều kiện/hệ quả dưới đây chỉ chứa được ĐÚNG 1 giá trị trên 1 lựa
// chọn (requiresFlag/requiresFlagAbsent/requiresItem/grantItem/removeItem là
// string đơn, KHÔNG phải mảng) — khác với statRequirements/statModifiers/
// requiresNpcAffinity/npcAffinity vốn là OBJECT nên chứa được nhiều khoá cùng
// lúc. ruleValidator.js dùng để phát hiện luật "2 cờ cùng bắt buộc" / "2 vật
// phẩm cùng yêu cầu" — thứ mà UI không được để lọt qua như thể được hỗ trợ.
export const SINGLE_SLOT_CONDITION_TYPES = new Set([CONDITION_TYPES.FLAG_PRESENT, CONDITION_TYPES.FLAG_ABSENT, CONDITION_TYPES.ITEM_PRESENT]);
export const SINGLE_SLOT_EFFECT_TYPES = new Set([EFFECT_TYPES.GRANT_ITEM, EFFECT_TYPES.REMOVE_ITEM]);

export function newRuleSet() {
  return { conditions: [], effects: [] };
}

export function statCompare(entityId, operator, value) {
  return { type: CONDITION_TYPES.STAT_COMPARE, entityId, operator, value };
}
export function flagPresent(entityId) {
  return { type: CONDITION_TYPES.FLAG_PRESENT, entityId };
}
export function flagAbsent(entityId) {
  return { type: CONDITION_TYPES.FLAG_ABSENT, entityId };
}
export function itemPresent(entityId) {
  return { type: CONDITION_TYPES.ITEM_PRESENT, entityId };
}
export function unsupportedCondition(raw, reason) {
  return { type: CONDITION_TYPES.UNSUPPORTED, raw: String(raw || ""), reason: String(reason || "") };
}

export function statChange(entityId, amount) {
  return { type: EFFECT_TYPES.STAT_CHANGE, entityId, amount };
}
export function grantFlag(entityId) {
  return { type: EFFECT_TYPES.GRANT_FLAG, entityId };
}
export function grantItem(entityId) {
  return { type: EFFECT_TYPES.GRANT_ITEM, entityId };
}
export function removeItem(entityId) {
  return { type: EFFECT_TYPES.REMOVE_ITEM, entityId };
}
export function showPopup(title, text) {
  return { type: EFFECT_TYPES.SHOW_POPUP, title: String(title || ""), text: String(text || "") };
}
export function unsupportedEffect(raw, reason) {
  return { type: EFFECT_TYPES.UNSUPPORTED, raw: String(raw || ""), reason: String(reason || "") };
}

// Toán tử đối lập chính xác trên miền SỐ NGUYÊN (mục 17) — dùng để tự suy ra
// nhánh "else" cho conditionalOutcomes 2 nhánh đơn giản (xem proCompiler.js).
// "==" không có đối lập an toàn (đối lập là "!=", chưa có field runtime) nên
// trả về null — bắt buộc người dùng khai báo tường minh nhánh còn lại.
export function negateOperator(operator) {
  return { ">=": "<", "<": ">=", ">": "<=", "<=": ">" }[operator] || null;
}

// ---------- Giải thích luật bằng lời (mục 26) ----------
const OPERATOR_WORDS = { ">=": "từ", "<=": "tối đa", ">": "trên", "<": "dưới", "==": "đúng" };

export function explainCondition(condition, entityLabel) {
  const label = entityLabel || "(?)";
  switch (condition.type) {
    case CONDITION_TYPES.STAT_COMPARE:
      return `${label} ${OPERATOR_WORDS[condition.operator] || condition.operator} ${condition.value}`;
    case CONDITION_TYPES.FLAG_PRESENT:
      return `Đã có: ${label}`;
    case CONDITION_TYPES.FLAG_ABSENT:
      return `Chưa có: ${label}`;
    case CONDITION_TYPES.ITEM_PRESENT:
      return `Có vật phẩm: ${label}`;
    case CONDITION_TYPES.UNSUPPORTED:
      return `⚠ Chưa hỗ trợ: "${condition.raw}"${condition.reason ? ` (${condition.reason})` : ""}`;
    default:
      return `⚠ Luật không xác định (${condition.type})`;
  }
}

export function explainEffect(effect, entityLabel) {
  const label = entityLabel || "(?)";
  switch (effect.type) {
    case EFFECT_TYPES.STAT_CHANGE:
      return `${label} ${effect.amount >= 0 ? "+" : ""}${effect.amount}`;
    case EFFECT_TYPES.GRANT_FLAG:
      return `Nhận cờ: ${label}`;
    case EFFECT_TYPES.GRANT_ITEM:
      return `Nhận vật phẩm: ${label}`;
    case EFFECT_TYPES.REMOVE_ITEM:
      return `Mất vật phẩm: ${label}`;
    case EFFECT_TYPES.SHOW_POPUP:
      return `Thông báo: "${effect.title}"`;
    case EFFECT_TYPES.UNSUPPORTED:
      return `⚠ Chưa hỗ trợ: "${effect.raw}"${effect.reason ? ` (${effect.reason})` : ""}`;
    default:
      return `⚠ Hệ quả không xác định (${effect.type})`;
  }
}
