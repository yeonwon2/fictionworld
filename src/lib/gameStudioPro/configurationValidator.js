// Shared PRO 6/7 configuration checks. Findings are structured so the Pro QA
// dashboard can expose stable codes; campaignValidator maps the same findings
// back to its legacy {errors,warnings} string contract.
import { ensureMechanicsState, MECHANIC_IDS } from "./mechanicsModel.js";
import { findEntityByIdAnyKind, ENTITY_KINDS } from "./entityRegistry.js";

export function validateProConfiguration(proDoc) {
  const findings = [];
  const registry = proDoc?.globalState?.registry || { stats: [] };
  const mechanics = ensureMechanicsState(proDoc?.mechanics);
  const push = (severity, code, message, entityId = null, label = "") => findings.push({ severity, code, message, entityId, label });

  for (const currency of mechanics.configs.currency) {
    const entity = findEntityByIdAnyKind(registry, currency?.entityId);
    if (!entity) push("error", "CURRENCY_ENTITY_MISSING", `Cơ chế Tiền tệ trỏ tới chỉ số không tồn tại/đã bị xoá (id: ${currency?.entityId}).`, currency?.entityId);
    else if (entity.kind !== ENTITY_KINDS.STAT) push("error", "CURRENCY_ENTITY_WRONG_KIND", `Cơ chế Tiền tệ trỏ tới “${entity.displayName}” nhưng đây không phải một chỉ số.`, entity.id, entity.displayName);
    else if (!currency.allowNegative) push("warning", "CURRENCY_NEGATIVE_NOT_ENFORCED", `“${entity.displayName}” được đánh dấu không cho âm, nhưng runtime chưa tự động chặn âm.`, entity.id, entity.displayName);
  }

  for (const rank of mechanics.configs.rank) {
    const entity = findEntityByIdAnyKind(registry, rank?.entityId);
    const levels = Array.isArray(rank?.levels) ? rank.levels : [];
    if (!entity) push("error", "RANK_ENTITY_MISSING", `Cơ chế Cấp bậc “${rank?.label || "chưa đặt tên"}” trỏ tới chỉ số không tồn tại/đã bị xoá (id: ${rank?.entityId}).`, rank?.entityId, rank?.label);
    else if (entity.kind !== ENTITY_KINDS.STAT) push("error", "RANK_ENTITY_WRONG_KIND", `Cơ chế Cấp bậc “${rank?.label || "chưa đặt tên"}” trỏ tới “${entity.displayName}” nhưng đây không phải một chỉ số.`, entity.id, rank?.label);
    if (!levels.length) push("warning", "RANK_NO_LEVELS", `Cơ chế Cấp bậc “${rank?.label || "chưa đặt tên"}” chưa có mốc cấp bậc nào.`, rank?.entityId, rank?.label);
    const thresholds = levels.map((level) => level?.threshold);
    if (new Set(thresholds).size !== thresholds.length) push("error", "RANK_DUPLICATE_THRESHOLD", `Cơ chế Cấp bậc “${rank?.label || "chưa đặt tên"}” có mốc trùng ngưỡng.`, rank?.entityId, rank?.label);
    const sorted = [...thresholds].sort((a, b) => a - b);
    if (thresholds.some((threshold, index) => threshold !== sorted[index])) push("warning", "RANK_THRESHOLD_ORDER_WARNING", `Các mốc của Cấp bậc “${rank?.label || "chưa đặt tên"}” chưa được sắp xếp tăng dần.`, rank?.entityId, rank?.label);
  }

  if (mechanics.enabled.includes(MECHANIC_IDS.VITAL_STAT) && !(registry.stats || []).some((entity) => entity.kind === ENTITY_KINDS.STAT && entity.isVital)) {
    push("warning", "VITAL_MECHANIC_WITHOUT_VITAL_STAT", "Cơ chế Chỉ số sinh tử đã bật nhưng chưa có chỉ số nào được đánh dấu sinh tử.");
  }
  if (mechanics.enabled.includes(MECHANIC_IDS.QUEST) && mechanics.configs.quest.length) {
    push("warning", "QUEST_RUNTIME_DEFERRED", "Cơ chế Nhiệm vụ hiện chỉ là ghi chú tác giả; runtime chưa tự theo dõi nhiệm vụ.");
  }

  for (const milestone of proDoc?.globalState?.milestones || []) {
    const entity = findEntityByIdAnyKind(registry, milestone?.statEntityId);
    const thresholds = Array.isArray(milestone?.thresholds) ? milestone.thresholds : [];
    if (!entity) {
      push("error", "MILESTONE_ENTITY_MISSING", `Milestone trỏ tới chỉ số không tồn tại/đã bị xoá (id: ${milestone?.statEntityId}).`, milestone?.statEntityId);
      continue;
    }
    if (entity.kind !== ENTITY_KINDS.STAT) push("error", "MILESTONE_ENTITY_WRONG_KIND", `Milestone trỏ tới “${entity.displayName}” nhưng đây không phải một chỉ số.`, entity.id, entity.displayName);
    if (!thresholds.length) push("warning", "MILESTONE_NO_THRESHOLDS", `Milestone theo “${entity.displayName}” chưa có mốc nào.`, entity.id, entity.displayName);
    const values = thresholds.map((threshold) => threshold?.at);
    if (new Set(values).size !== values.length) push("error", "MILESTONE_DUPLICATE_THRESHOLD", `Milestone theo “${entity.displayName}” có mốc trùng ngưỡng.`, entity.id, entity.displayName);
    if (thresholds.some((threshold) => !Number.isFinite(threshold?.at) || !Number.isFinite(threshold?.bonus))) push("error", "MILESTONE_VALUE_INVALID", `Milestone theo “${entity.displayName}” có ngưỡng hoặc thưởng không phải số hợp lệ.`, entity.id, entity.displayName);
  }
  return findings;
}
