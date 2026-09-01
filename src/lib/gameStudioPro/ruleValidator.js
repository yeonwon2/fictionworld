// Xưởng Game Pro — PRO 3: RULE VALIDATOR (mục 25) — kiểm tra Canonical Rule
// IR (choice.rules/conditionalOutcomes) TRƯỚC khi compile. Thuần JS, không
// gọi AI, cùng phong cách blueprintValidator.js (trả {errors, warnings} —
// chuỗi tiếng Việt, không mã lỗi).
//
// KHÔNG lặp lại việc kiểm tra topology (đích tồn tại/mồ côi/...) — việc đó đã
// do blueprintValidator.js/validateSceneBlueprint lo. File này CHỈ lo phần
// luật: entity có tồn tại không, operator hợp lệ không, giá trị có phải số
// không, có đụng GIỚI HẠN THẬT của runtime không (mục 15/16/25).
import { CONDITION_TYPES, EFFECT_TYPES, OPERATORS, SINGLE_SLOT_CONDITION_TYPES, SINGLE_SLOT_EFFECT_TYPES } from "./ruleModel.js";
import { findEntityByIdAnyKind, ENTITY_KINDS } from "./entityRegistry.js";

function entityLabel(registry, entityId) {
  const e = findEntityByIdAnyKind(registry, entityId);
  return e ? e.displayName : `(entity không tồn tại: ${entityId})`;
}

// Kiểm tra 1 mảng conditions (ngữ nghĩa AND) — trả list message lỗi/cảnh báo,
// KHÔNG kèm tiền tố ngữ cảnh (caller tự thêm "Cảnh X — Lựa chọn Y: ").
function checkConditions(conditions, registry) {
  const errors = [];
  const warnings = [];
  const seenByTypeEntity = new Map(); // `${type}:${entityId}` -> count, để bắt trùng slot

  const statBoundsByEntity = new Map(); // entityId -> { min, max }

  for (const cond of conditions || []) {
    if (!cond || typeof cond !== "object") { errors.push("Có điều kiện rỗng/không hợp lệ."); continue; }
    if (cond.type === CONDITION_TYPES.UNSUPPORTED) {
      errors.push(`Điều kiện chưa được hỗ trợ: "${cond.raw}"${cond.reason ? ` — ${cond.reason}` : ""}.`);
      continue;
    }
    if (!Object.values(CONDITION_TYPES).includes(cond.type)) { errors.push(`Loại điều kiện không xác định: "${cond.type}".`); continue; }

    const entity = findEntityByIdAnyKind(registry, cond.entityId);
    if (!entity) { errors.push(`Điều kiện tham chiếu tới chỉ số/cờ/vật phẩm không tồn tại trong danh mục (id: ${cond.entityId}).`); continue; }

    if (cond.type === CONDITION_TYPES.STAT_COMPARE) {
      if (entity.kind !== ENTITY_KINDS.STAT && entity.kind !== ENTITY_KINDS.RELATIONSHIP) {
        errors.push(`"${entity.displayName}" không phải chỉ số/quan hệ dạng số, không thể so sánh.`);
        continue;
      }
      if (!OPERATORS.includes(cond.operator)) { errors.push(`Toán tử không hợp lệ: "${cond.operator}".`); continue; }
      if (!Number.isFinite(cond.value)) { errors.push(`Giá trị điều kiện cho "${entity.displayName}" không phải số hợp lệ.`); continue; }
      const bounds = statBoundsByEntity.get(cond.entityId) || { min: -Infinity, max: Infinity };
      if (cond.operator === ">=") bounds.min = Math.max(bounds.min, cond.value);
      else if (cond.operator === ">") bounds.min = Math.max(bounds.min, cond.value + 1);
      else if (cond.operator === "<=") bounds.max = Math.min(bounds.max, cond.value);
      else if (cond.operator === "<") bounds.max = Math.min(bounds.max, cond.value - 1);
      else if (cond.operator === "==") { bounds.min = Math.max(bounds.min, cond.value); bounds.max = Math.min(bounds.max, cond.value); }
      statBoundsByEntity.set(cond.entityId, bounds);
      continue;
    }

    // flag_present / flag_absent / item_present — kiểm tra giới hạn "1 khoá/lựa chọn".
    const kindOk = {
      [CONDITION_TYPES.FLAG_PRESENT]: ENTITY_KINDS.FLAG,
      [CONDITION_TYPES.FLAG_ABSENT]: ENTITY_KINDS.FLAG,
      [CONDITION_TYPES.ITEM_PRESENT]: ENTITY_KINDS.ITEM,
    }[cond.type];
    if (entity.kind !== kindOk) { errors.push(`"${entity.displayName}" không phải đúng loại (${kindOk === ENTITY_KINDS.FLAG ? "cờ" : "vật phẩm"}) cho điều kiện này.`); continue; }

    if (SINGLE_SLOT_CONDITION_TYPES.has(cond.type)) {
      const key = cond.type;
      if (!seenByTypeEntity.has(key)) seenByTypeEntity.set(key, new Set());
      seenByTypeEntity.get(key).add(cond.entityId);
    }
  }

  // Engine chỉ có 1 ô requiresFlag / 1 ô requiresFlagAbsent / 1 ô requiresItem
  // trên mỗi lựa chọn — nhiều cờ/vật phẩm KHÁC NHAU cùng bắt buộc là chưa hỗ trợ.
  for (const [type, ids] of seenByTypeEntity) {
    if (ids.size > 1) {
      const label = type === CONDITION_TYPES.ITEM_PRESENT ? "vật phẩm" : "cờ";
      errors.push(`Engine chỉ hỗ trợ yêu cầu 1 ${label} trên mỗi lựa chọn — điều kiện đang yêu cầu ${ids.size} ${label} khác nhau cùng lúc. Hãy tách thành nhiều lựa chọn/nhánh.`);
    }
  }
  // Cùng 1 cờ vừa bắt buộc CÓ vừa bắt buộc CHƯA CÓ — không ai vào được nhánh này.
  const presentFlags = seenByTypeEntity.get(CONDITION_TYPES.FLAG_PRESENT) || new Set();
  const absentFlags = seenByTypeEntity.get(CONDITION_TYPES.FLAG_ABSENT) || new Set();
  for (const id of presentFlags) if (absentFlags.has(id)) errors.push(`"${entityLabel(registry, id)}": vừa bắt buộc đã có vừa bắt buộc chưa có — không ai thoả được điều kiện này.`);

  for (const [entityId, bounds] of statBoundsByEntity) {
    if (bounds.min > bounds.max) errors.push(`"${entityLabel(registry, entityId)}": điều kiện tối thiểu (${bounds.min}) lớn hơn tối đa (${bounds.max}) — không ai thoả được điều kiện này.`);
  }

  return { errors, warnings };
}

function checkEffects(effects, registry) {
  const errors = [];
  const warnings = [];
  const seenByTypeEntity = new Map();

  for (const eff of effects || []) {
    if (!eff || typeof eff !== "object") { errors.push("Có hệ quả rỗng/không hợp lệ."); continue; }
    if (eff.type === EFFECT_TYPES.UNSUPPORTED) {
      errors.push(`Hệ quả chưa được hỗ trợ: "${eff.raw}"${eff.reason ? ` — ${eff.reason}` : ""}.`);
      continue;
    }
    if (!Object.values(EFFECT_TYPES).includes(eff.type)) { errors.push(`Loại hệ quả không xác định: "${eff.type}".`); continue; }

    const entity = findEntityByIdAnyKind(registry, eff.entityId);
    if (!entity) { errors.push(`Hệ quả tham chiếu tới chỉ số/cờ/vật phẩm không tồn tại trong danh mục (id: ${eff.entityId}).`); continue; }

    if (eff.type === EFFECT_TYPES.STAT_CHANGE) {
      if (entity.kind !== ENTITY_KINDS.STAT && entity.kind !== ENTITY_KINDS.RELATIONSHIP) { errors.push(`"${entity.displayName}" không phải chỉ số/quan hệ dạng số.`); continue; }
      if (!Number.isFinite(eff.amount)) errors.push(`Giá trị hệ quả cho "${entity.displayName}" không phải số hợp lệ.`);
      if (eff.amount === 0) warnings.push(`"${entity.displayName}": hệ quả +0 không có tác dụng gì — có thể bỏ.`);
      continue;
    }

    const kindOk = {
      [EFFECT_TYPES.GRANT_FLAG]: ENTITY_KINDS.FLAG,
      [EFFECT_TYPES.GRANT_ITEM]: ENTITY_KINDS.ITEM,
      [EFFECT_TYPES.REMOVE_ITEM]: ENTITY_KINDS.ITEM,
    }[eff.type];
    if (entity.kind !== kindOk) { errors.push(`"${entity.displayName}" không phải đúng loại cho hệ quả này.`); continue; }

    if (SINGLE_SLOT_EFFECT_TYPES.has(eff.type)) {
      if (!seenByTypeEntity.has(eff.type)) seenByTypeEntity.set(eff.type, new Set());
      seenByTypeEntity.get(eff.type).add(eff.entityId);
    }
  }

  for (const [type, ids] of seenByTypeEntity) {
    if (ids.size > 1) {
      const label = type === EFFECT_TYPES.GRANT_ITEM ? "nhận vật phẩm" : "mất vật phẩm";
      errors.push(`Engine chỉ hỗ trợ ${label} 1 vật phẩm trên mỗi lựa chọn — hệ quả đang yêu cầu ${ids.size} vật phẩm khác nhau cùng lúc. Hãy tách thành nhiều lựa chọn.`);
    }
  }

  return { errors, warnings };
}

// Xoá cờ (unset) hoàn toàn không tồn tại ở runtime hiện tại (chỉ có SET, xem
// mục 23/CONDITION_TYPES) — nếu ruleParser từng tạo "unsupported" cho việc
// này thì đã được checkEffects() bắt ở nhánh UNSUPPORTED phía trên.

export function validateChoiceRules(choice, registry, context = "") {
  const errors = [];
  const warnings = [];
  const prefix = context ? `${context}: ` : "";

  const { errors: ce, warnings: cw } = checkConditions(choice.rules?.conditions, registry);
  const { errors: ee, warnings: ew } = checkEffects(choice.rules?.effects, registry);
  errors.push(...ce.map((m) => prefix + m), ...ee.map((m) => prefix + m));
  warnings.push(...cw.map((m) => prefix + m), ...ew.map((m) => prefix + m));

  for (const [i, branch] of (choice.conditionalOutcomes || []).entries()) {
    const branchCtx = `${prefix}nhánh ${i + 1}`;
    const { errors: be, warnings: bw } = checkConditions(branch.conditions, registry);
    const { errors: bee, warnings: bew } = checkEffects(branch.effects, registry);
    errors.push(...be.map((m) => `${branchCtx}: ${m}`), ...bee.map((m) => `${branchCtx}: ${m}`));
    warnings.push(...bw.map((m) => `${branchCtx}: ${m}`), ...bew.map((m) => `${branchCtx}: ${m}`));
    if (!branch.targetType || !branch.targetId) errors.push(`${branchCtx}: chưa nối tới cảnh/kết thúc nào.`);
  }

  // Nhiều nhánh có điều kiện rỗng (luôn đúng) cùng lúc — không rõ nhánh nào
  // sẽ thật sự hiện ra cho người chơi (mục 25 "conditional outcomes overlap").
  const alwaysTrueBranches = (choice.conditionalOutcomes || []).filter((b) => !(b.conditions || []).length).length;
  const baseAlwaysTrue = !(choice.rules?.conditions || []).length;
  if (choice.conditionalOutcomes?.length && alwaysTrueBranches + (baseAlwaysTrue ? 1 : 0) > 1) {
    warnings.push(`${prefix}có nhiều hơn 1 nhánh không điều kiện (luôn đúng) — chỉ nhánh đầu tiên khớp là có ý nghĩa, cân nhắc thêm điều kiện phân biệt.`);
  }

  return { errors, warnings };
}

// Duyệt TOÀN BỘ blueprint — dùng để gộp vào blueprintValidator.js.
export function validateBlueprintRules(blueprint, registry) {
  const errors = [];
  const warnings = [];
  for (const scene of blueprint?.scenes || []) {
    for (const [i, choice] of (scene.choices || []).entries()) {
      const label = choice.text?.trim() || `Lựa chọn ${i + 1}`;
      const context = `Cảnh "${scene.title || scene.id}" — ${label}`;
      const { errors: e, warnings: w } = validateChoiceRules(choice, registry, context);
      errors.push(...e);
      warnings.push(...w);
    }
  }
  return { errors, warnings };
}
