// Xưởng Game Pro — PRO 4: SCRIPT VALIDATOR
//
// Kiểm tra tính hợp lệ toàn diện của kịch bản đã phân tích:
// - Tổng hợp lỗi theo từng dòng từ Lexer, Parser, Normalizer.
// - Kiểm tra entityProposals (chặn import nếu còn entity chưa được user duyệt).
// - Chạy validateSceneBlueprint khi không còn tempKey chưa giải quyết.
// - Thống kê chi tiết (số cảnh, lựa chọn, cờ, vật phẩm, kết thúc, chỉ số).
import { validateSceneBlueprint } from "./blueprintValidator.js";
import { ensureRegistry } from "./entityRegistry.js";

export function validateParsedScript({
  ast,
  blueprint,
  entityProposals = [],
  parserIssues = [],
  normalizerIssues = [],
}) {
  const errors = [];
  const warnings = [];

  // 1. Thu thập lỗi/cảnh báo từ Parser và Normalizer (đã có số dòng)
  for (const issue of [...parserIssues, ...normalizerIssues]) {
    if (issue.type === "warning") {
      warnings.push({ line: issue.line || 1, message: issue.message, code: "PARSE_WARNING" });
    } else {
      errors.push({ line: issue.line || 1, message: issue.message, code: "PARSE_ERROR" });
    }
  }

  // 2. Cảnh báo các thực thể mới đang chờ duyệt (Pending Entity Proposals)
  if (entityProposals.length > 0) {
    for (const prop of entityProposals) {
      warnings.push({
        line: prop.sourceLine || 1,
        message: `Thực thể "${prop.requestedName}" (${prop.kind}) chưa có trong danh mục — cần duyệt tạo mới hoặc khớp với thực thể có sẵn.`,
        code: "UNAPPROVED_ENTITY_PROPOSAL",
        proposal: prop,
      });
    }
  }

  // 3. Nếu có Blueprint và không còn entity proposal nào chưa resolve, chạy validateSceneBlueprint
  if (blueprint && entityProposals.length === 0) {
    const bpValidation = validateSceneBlueprint(blueprint);
    for (const err of bpValidation.errors || []) {
      if (!errors.some((e) => e.message.includes(err) || err.includes(e.message))) {
        errors.push({ line: 0, message: err, code: "BLUEPRINT_ERROR" });
      }
    }
    for (const warn of bpValidation.warnings || []) {
      if (!warnings.some((w) => w.message.includes(warn) || warn.includes(w.message))) {
        warnings.push({ line: 0, message: warn, code: "BLUEPRINT_WARNING" });
      }
    }
  }

  // 4. Thống kê kịch bản
  const registry = ensureRegistry(blueprint);
  let choiceCount = 0;
  for (const s of blueprint?.scenes || []) {
    choiceCount += s.choices?.length || 0;
  }

  const stats = {
    sceneCount: blueprint?.scenes?.length || ast?.scenes?.length || 0,
    choiceCount,
    statCount: registry.stats?.length || ast?.stats?.length || 0,
    flagCount: registry.flags?.length || ast?.flags?.length || 0,
    itemCount: registry.items?.length || ast?.items?.length || 0,
    endingCount: blueprint?.endings?.length || ast?.endings?.length || 0,
    pendingProposalsCount: entityProposals.length,
  };

  const valid = errors.length === 0 && entityProposals.length === 0;

  return {
    valid,
    readyToImport: valid,
    hasPendingProposals: entityProposals.length > 0,
    errors,
    warnings,
    entityProposals,
    stats,
  };
}
