// Xưởng Game Pro — PRO 4: SCRIPT VALIDATOR
//
// Kiểm tra tính hợp lệ toàn diện của kịch bản đã phân tích:
// - Tổng hợp lỗi theo từng dòng từ Lexer, Parser, Normalizer.
// - Chạy validateSceneBlueprint (kiểm tra đồ thị, kết nối, mồ côi, reachability, rule constraints).
// - Thống kê chi tiết (số cảnh, lựa chọn, cờ, vật phẩm, kết thúc, chỉ số).
import { validateSceneBlueprint } from "./blueprintValidator.js";
import { ensureRegistry } from "./entityRegistry.js";

export function validateParsedScript({ ast, blueprint, parserIssues = [], normalizerIssues = [] }) {
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

  // 2. Nếu có Blueprint, chạy thêm validateSceneBlueprint
  if (blueprint) {
    const bpValidation = validateSceneBlueprint(blueprint);
    for (const err of bpValidation.errors || []) {
      // Tránh lặp lại lỗi đã được normalizer gắn dòng
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

  // 3. Thống kê kịch bản
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
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}
