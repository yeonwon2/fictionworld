// Xưởng Game Pro — PRO 3: RULE PARSER — dịch câu tiếng Việt tự nhiên thành
// Canonical Rule IR (ruleModel.js), tham chiếu entity qua entityRegistry.js.
//
// Hybrid theo đúng mục 13: bộ phân tích TẤT ĐỊNH (deterministic, regex, thuần
// JS, không cần AI) bắt các mẫu câu đơn giản đã liệt kê ở yêu cầu PRO 3; câu
// phức tạp hơn mới cần AI (parseRuleWithAI). CẢ HAI đường đều phải đi qua
// cùng 1 bước chuẩn hoá + resolve entity + validate — không có đường tắt nào
// (kể cả AI) được phép tạo canonical rule mà không qua bước này (mục 14).
//
// Không bao giờ tin thẳng 1 câu là đúng: mọi kết quả (tất định lẫn AI) đều
// trả về DANH SÁCH "parse item" cho UI xem trước (mục 6/7/14) — người dùng
// bấm "Áp dụng" mới thật sự ghi vào choice.rules.
import { aiCall } from "../aiCall.js";
import { buildConditionParsePrompt, buildEffectParsePrompt, RULE_CLAUSE_SCHEMA } from "./rulePrompts.js";
import { resolveEntity, ENTITY_KINDS } from "./entityRegistry.js";
import { statCompare, flagPresent, flagAbsent, itemPresent, statChange, grantFlag, grantItem, removeItem } from "./ruleModel.js";

// ---------- Item shape dùng chung cho preview UI ----------
// { status: "ok", condition|effect, entityLabel }
// { status: "unresolved", entityKind, text, pending }   -- cần hỏi "dùng X có sẵn / tạo mới"
// { status: "ambiguous", entityKind, text, candidates, pending }
// { status: "unsupported", raw, reason }
// (pending giữ đủ thông tin type/operator/value/amount để hoàn tất sau khi resolve xong)

function resolveForItem(registry, entityKind, text, pending) {
  const res = resolveEntity(registry, entityKind, text);
  if (res.status === "matched") return { status: "ok", entity: res.entity, pending };
  if (res.status === "ambiguous") return { status: "ambiguous", entityKind, text: res.text, candidates: res.candidates, pending };
  return { status: "unresolved", entityKind, text: res.text, pending };
}

function finalizeConditionItem(resolved) {
  if (resolved.status !== "ok") return resolved;
  const { entity, pending } = resolved;
  if (pending.type === "stat_compare") {
    if (entity.kind !== ENTITY_KINDS.STAT && entity.kind !== ENTITY_KINDS.RELATIONSHIP) {
      return { status: "unsupported", raw: pending.raw, reason: `"${entity.displayName}" không phải chỉ số/quan hệ dạng số.` };
    }
    return { status: "ok", condition: statCompare(entity.id, pending.operator, pending.value), entityLabel: entity.displayName };
  }
  if (pending.type === "flag_present") return { status: "ok", condition: flagPresent(entity.id), entityLabel: entity.displayName };
  if (pending.type === "flag_absent") return { status: "ok", condition: flagAbsent(entity.id), entityLabel: entity.displayName };
  if (pending.type === "item_present") return { status: "ok", condition: itemPresent(entity.id), entityLabel: entity.displayName };
  return { status: "unsupported", raw: pending.raw, reason: "Loại điều kiện không xác định." };
}

function finalizeEffectItem(resolved) {
  if (resolved.status !== "ok") return resolved;
  const { entity, pending } = resolved;
  if (pending.type === "stat_change") {
    if (entity.kind !== ENTITY_KINDS.STAT && entity.kind !== ENTITY_KINDS.RELATIONSHIP) {
      return { status: "unsupported", raw: pending.raw, reason: `"${entity.displayName}" không phải chỉ số/quan hệ dạng số.` };
    }
    return { status: "ok", effect: statChange(entity.id, pending.amount), entityLabel: entity.displayName };
  }
  if (pending.type === "grant_flag") return { status: "ok", effect: grantFlag(entity.id), entityLabel: entity.displayName };
  if (pending.type === "grant_item") return { status: "ok", effect: grantItem(entity.id), entityLabel: entity.displayName };
  if (pending.type === "remove_item") return { status: "ok", effect: removeItem(entity.id), entityLabel: entity.displayName };
  return { status: "unsupported", raw: pending.raw, reason: "Loại hệ quả không xác định." };
}

// ---------- Bộ phân tích TẤT ĐỊNH ----------

const NUM = "-?\\d+(?:[.,]\\d+)?";
function toNumber(s) {
  return Number(String(s).replace(",", "."));
}
const FILLER_PREFIX = /^(nếu|khi|chỉ khi|chỉ)\s+/i;

function splitClauses(text) {
  return String(text || "")
    .split(/\s*[,;]\s*| và | AND /i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasOrKeyword(text) {
  return /\bhoặc\b|\bOR\b/i.test(text);
}

const STAT_COMPARE_PATTERNS = [
  { re: new RegExp(`^(.+?)\\s*(?:từ)\\s*(${NUM})\\s*trở lên$`, "i"), op: ">=" },
  { re: new RegExp(`^(.+?)\\s*(?:không dưới|ít nhất)\\s*(${NUM})$`, "i"), op: ">=" },
  { re: new RegExp(`^(.+?)\\s*>=\\s*(${NUM})$`), op: ">=" },
  { re: new RegExp(`^(.+?)\\s*(?:tối đa|không quá|nhiều nhất|không vượt quá)\\s*(${NUM})$`, "i"), op: "<=" },
  { re: new RegExp(`^(.+?)\\s*<=\\s*(${NUM})$`), op: "<=" },
  { re: new RegExp(`^(.+?)\\s*(?:cao hơn|lớn hơn)\\s*(${NUM})$`, "i"), op: ">" },
  { re: new RegExp(`^(.+?)\\s*>\\s*(${NUM})$`), op: ">" },
  { re: new RegExp(`^(.+?)\\s*(?:dưới|nhỏ hơn|thấp hơn)\\s*(${NUM})$`, "i"), op: "<" },
  { re: new RegExp(`^(.+?)\\s*<\\s*(${NUM})$`), op: "<" },
  { re: new RegExp(`^(.+?)\\s*(?:bằng đúng|đúng bằng|bằng)\\s*(${NUM})$`, "i"), op: "==" },
  { re: new RegExp(`^(.+?)\\s*==\\s*(${NUM})$`), op: "==" },
];
// So sánh entity-với-entity (không có số ở vế phải) — chưa hỗ trợ (mục 17/17b).
const STAT_VS_STAT_RE = /^(.+?)\s*(?:cao hơn|lớn hơn|thấp hơn|nhỏ hơn|bằng)\s*(.+)$/i;

const FLAG_ABSENT_RE = /^(?:chưa có|không có)\s*cờ\s+(.+)$/i;
const FLAG_PRESENT_RE = /^(?:đã có|có)\s*cờ\s+(.+)$/i;
const ITEM_ABSENT_RE = /^(?:chưa có|không có)\s+(.+)$/i;
const ITEM_PRESENT_RE = /^(?:đã có|có|sở hữu)\s+(.+)$/i;

function parseConditionClause(clause, registry) {
  const raw = clause;
  const text = clause.replace(FILLER_PREFIX, "").trim();

  for (const { re, op } of STAT_COMPARE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const entityText = m[1].trim();
      const value = toNumber(m[2]);
      if (!Number.isFinite(value)) continue;
      return resolveForItem(registry, "quantity", entityText, { type: "stat_compare", operator: op, value, raw });
    }
  }
  const svs = text.match(STAT_VS_STAT_RE);
  if (svs && !/^-?\d/.test(svs[2].trim())) {
    return { status: "unsupported", raw, reason: "So sánh giữa hai chỉ số/quan hệ với nhau chưa được hỗ trợ." };
  }

  let m = text.match(FLAG_ABSENT_RE);
  if (m) return resolveForItem(registry, ENTITY_KINDS.FLAG, m[1].trim(), { type: "flag_absent", raw });
  m = text.match(FLAG_PRESENT_RE);
  if (m) return resolveForItem(registry, ENTITY_KINDS.FLAG, m[1].trim(), { type: "flag_present", raw });
  m = text.match(ITEM_ABSENT_RE);
  if (m) return { status: "unsupported", raw, reason: `Điều kiện "chưa có vật phẩm" chưa được hỗ trợ (engine chỉ hỗ trợ yêu cầu CÓ vật phẩm).` };
  m = text.match(ITEM_PRESENT_RE);
  if (m) {
    const entityText = m[1].trim();
    // Không biết chắc là cờ hay vật phẩm — thử registry cả hai, ưu tiên cờ
    // (thường là mô tả sự kiện quá khứ như "đã cứu Tiểu Lan").
    const flagGuess = resolveEntity(registry, ENTITY_KINDS.FLAG, entityText);
    if (flagGuess.status === "matched") return resolveForItem(registry, ENTITY_KINDS.FLAG, entityText, { type: "flag_present", raw });
    return resolveForItem(registry, ENTITY_KINDS.ITEM, entityText, { type: "item_present", raw });
  }

  // Không có động từ nào — thử khớp CẢ CÂU thẳng vào registry cờ (vd câu điều
  // kiện gõ trần "Đã cứu Tiểu Lan" không có "có"/"đã có" phía trước). Trả về
  // đúng shape "pending" (chưa finalize) như mọi nhánh khác ở trên — để
  // finalizeConditionItem() xử lý thống nhất 1 chỗ duy nhất.
  const flagWhole = resolveEntity(registry, ENTITY_KINDS.FLAG, text);
  if (flagWhole.status === "matched") return { status: "ok", entity: flagWhole.entity, pending: { type: "flag_present", raw } };
  const itemWhole = resolveEntity(registry, ENTITY_KINDS.ITEM, text);
  if (itemWhole.status === "matched") return { status: "ok", entity: itemWhole.entity, pending: { type: "item_present", raw } };

  return null; // không nhận diện được — caller quyết định fallback AI hay báo unresolved
}

const STAT_INC_RE = new RegExp(`^(?:tăng)\\s*(${NUM})\\s+(.+)$`, "i");
const STAT_DEC_RE = new RegExp(`^(?:giảm|trừ|mất)\\s*(${NUM})\\s+(.+)$`, "i");
const STAT_PLUS_SUFFIX_RE = new RegExp(`^(.+?)\\s*\\+\\s*(${NUM})$`);
const STAT_MINUS_SUFFIX_RE = new RegExp(`^(.+?)\\s*-\\s*(${NUM})$`);
const GRANT_FLAG_RE = /^(?:nhận|đặt|set|gắn)\s*cờ\s+(.+)$/i;
const GRANT_ITEM_RE = /^(?:nhận|nhận được)\s+(.+)$/i;
const REMOVE_ITEM_RE = /^mất\s+(.+)$/i;

function parseEffectClause(clause, registry) {
  const raw = clause;
  const text = clause.replace(FILLER_PREFIX, "").trim();

  let m = text.match(STAT_INC_RE);
  if (m) return resolveForItem(registry, "quantity", m[2].trim(), { type: "stat_change", amount: toNumber(m[1]), raw });
  m = text.match(STAT_DEC_RE);
  if (m) return resolveForItem(registry, "quantity", m[2].trim(), { type: "stat_change", amount: -Math.abs(toNumber(m[1])), raw });
  m = text.match(STAT_PLUS_SUFFIX_RE);
  if (m) return resolveForItem(registry, "quantity", m[1].trim(), { type: "stat_change", amount: toNumber(m[2]), raw });
  m = text.match(STAT_MINUS_SUFFIX_RE);
  if (m) return resolveForItem(registry, "quantity", m[1].trim(), { type: "stat_change", amount: -Math.abs(toNumber(m[2])), raw });

  m = text.match(GRANT_FLAG_RE);
  if (m) return resolveForItem(registry, ENTITY_KINDS.FLAG, m[1].trim(), { type: "grant_flag", raw });
  m = text.match(REMOVE_ITEM_RE);
  if (m) return resolveForItem(registry, ENTITY_KINDS.ITEM, m[1].trim(), { type: "remove_item", raw });
  m = text.match(GRANT_ITEM_RE);
  if (m) {
    const entityText = m[1].trim();
    const flagGuess = resolveEntity(registry, ENTITY_KINDS.FLAG, entityText);
    if (flagGuess.status === "matched") return resolveForItem(registry, ENTITY_KINDS.FLAG, entityText, { type: "grant_flag", raw });
    return resolveForItem(registry, ENTITY_KINDS.ITEM, entityText, { type: "grant_item", raw });
  }

  return null;
}

// Trả { items: ParseItem[], orDetected: boolean }. `items` rỗng + orDetected
// false + text không rỗng nghĩa là "không mệnh đề nào khớp tất định" — gọi
// parseConditionsWithAI để thử tiếp (hoặc để UI báo không hiểu).
export function parseConditionsDeterministic(text, registry) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { items: [], orDetected: false };
  if (hasOrKeyword(trimmed)) {
    return { items: [{ status: "unsupported", raw: trimmed, reason: 'Điều kiện "HOẶC" giữa nhiều vế chưa được hỗ trợ trên 1 lựa chọn — hãy tách thành 2 lựa chọn/nhánh riêng.' }], orDetected: true };
  }
  const clauses = splitClauses(trimmed);
  const items = [];
  for (const clause of clauses) {
    const parsed = parseConditionClause(clause, registry);
    if (!parsed) return { items: [], orDetected: false, unmatchedText: trimmed }; // để nguyên câu gốc cho AI, tránh phân tích nửa vời
    items.push(finalizeConditionItem(parsed));
  }
  return { items, orDetected: false };
}

export function parseEffectsDeterministic(text, registry) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { items: [] };
  if (hasOrKeyword(trimmed)) {
    return { items: [{ status: "unsupported", raw: trimmed, reason: 'Hệ quả có "HOẶC" chưa được hỗ trợ.' }] };
  }
  const clauses = splitClauses(trimmed);
  const items = [];
  for (const clause of clauses) {
    const parsed = parseEffectClause(clause, registry);
    if (!parsed) return { items: [], unmatchedText: trimmed };
    items.push(finalizeEffectItem(parsed));
  }
  return { items };
}

// ---------- AI (bất đồng bộ) ----------

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeString(v) {
  return typeof v === "string" ? v.trim() : "";
}
const CONDITION_KINDS = new Set(["stat_compare", "flag_present", "flag_absent", "item_present", "unsupported"]);
const EFFECT_KINDS = new Set(["stat_change", "grant_flag", "grant_item", "remove_item", "unsupported"]);
const VALID_OPERATORS = new Set([">=", "<=", ">", "<", "=="]);

// Chuẩn hoá phản hồi AI thô thành ParseItem[] — hàm THUẦN, test được không
// cần gọi AI thật (cùng nguyên tắc blueprintAI.js normalizeAIBlueprintResponse).
export function normalizeAIRuleClauses(raw, registry, ruleKind /* "condition" | "effect" */) {
  const validKinds = ruleKind === "condition" ? CONDITION_KINDS : EFFECT_KINDS;
  const clauses = safeArray(raw?.clauses);
  const items = [];
  for (const c of clauses) {
    if (!c || typeof c !== "object") continue;
    const kind = validKinds.has(c.kind) ? c.kind : null;
    if (!kind) continue; // AI trả loại lạ — bỏ qua thay vì đoán
    if (kind === "unsupported") {
      items.push({ status: "unsupported", raw: safeString(c.entity) || safeString(c.reason) || "(?)", reason: safeString(c.reason) || "AI xác định câu này chưa hỗ trợ được." });
      continue;
    }
    const entityText = safeString(c.entity);
    if (!entityText) continue;
    if (kind === "stat_compare") {
      const operator = VALID_OPERATORS.has(c.operator) ? c.operator : null;
      const value = Number(c.value);
      if (!operator || !Number.isFinite(value)) {
        items.push({ status: "unsupported", raw: entityText, reason: "AI trả về điều kiện số không hợp lệ." });
        continue;
      }
      items.push(finalizeConditionItem(resolveForItem(registry, "quantity", entityText, { type: "stat_compare", operator, value, raw: entityText })));
    } else if (kind === "flag_present") {
      items.push(finalizeConditionItem(resolveForItem(registry, ENTITY_KINDS.FLAG, entityText, { type: "flag_present", raw: entityText })));
    } else if (kind === "flag_absent") {
      items.push(finalizeConditionItem(resolveForItem(registry, ENTITY_KINDS.FLAG, entityText, { type: "flag_absent", raw: entityText })));
    } else if (kind === "item_present") {
      items.push(finalizeConditionItem(resolveForItem(registry, ENTITY_KINDS.ITEM, entityText, { type: "item_present", raw: entityText })));
    } else if (kind === "stat_change") {
      const amount = Number(c.amount);
      if (!Number.isFinite(amount)) {
        items.push({ status: "unsupported", raw: entityText, reason: "AI trả về hệ quả số không hợp lệ." });
        continue;
      }
      items.push(finalizeEffectItem(resolveForItem(registry, "quantity", entityText, { type: "stat_change", amount, raw: entityText })));
    } else if (kind === "grant_flag") {
      items.push(finalizeEffectItem(resolveForItem(registry, ENTITY_KINDS.FLAG, entityText, { type: "grant_flag", raw: entityText })));
    } else if (kind === "grant_item") {
      items.push(finalizeEffectItem(resolveForItem(registry, ENTITY_KINDS.ITEM, entityText, { type: "grant_item", raw: entityText })));
    } else if (kind === "remove_item") {
      items.push(finalizeEffectItem(resolveForItem(registry, ENTITY_KINDS.ITEM, entityText, { type: "remove_item", raw: entityText })));
    }
  }
  return items;
}

export async function parseConditionsWithAI(text, registry) {
  const raw = await aiCall(buildConditionParsePrompt(registry, text), { jsonSchema: RULE_CLAUSE_SCHEMA });
  return normalizeAIRuleClauses(raw, registry, "condition");
}
export async function parseEffectsWithAI(text, registry) {
  const raw = await aiCall(buildEffectParsePrompt(registry, text), { jsonSchema: RULE_CLAUSE_SCHEMA });
  return normalizeAIRuleClauses(raw, registry, "effect");
}

// ---------- Điều phối (deterministic trước, AI khi cần) ----------

export async function parseConditionText(text, registry, { allowAI = true } = {}) {
  const det = parseConditionsDeterministic(text, registry);
  if (det.items.length || det.orDetected) return { items: det.items, source: "deterministic" };
  if (!String(text || "").trim()) return { items: [], source: "deterministic" };
  if (!allowAI) return { items: [{ status: "unsupported", raw: text, reason: "Không nhận diện được câu này — hãy thử viết theo mẫu (vd: 'Uy tín từ 20 trở lên', 'có Ngọc bội', 'đã có cờ ...') hoặc dùng ô tự thêm thủ công." }], source: "deterministic" };
  const items = await parseConditionsWithAI(text, registry);
  return { items, source: "ai" };
}

export async function parseEffectText(text, registry, { allowAI = true } = {}) {
  const det = parseEffectsDeterministic(text, registry);
  if (det.items.length) return { items: det.items, source: "deterministic" };
  if (!String(text || "").trim()) return { items: [], source: "deterministic" };
  if (!allowAI) return { items: [{ status: "unsupported", raw: text, reason: "Không nhận diện được câu này — hãy thử viết theo mẫu (vd: 'Uy tín -5', 'tăng 8 Sủng ái Lệ Phi', 'nhận Ngọc bội') hoặc dùng ô tự thêm thủ công." }], source: "deterministic" };
  const items = await parseEffectsWithAI(text, registry);
  return { items, source: "ai" };
}
