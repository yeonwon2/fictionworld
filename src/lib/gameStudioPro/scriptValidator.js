// Xưởng Game Pro — PRO 4: SCRIPT VALIDATOR
//
// Kiểm tra tính hợp lệ đa giai đoạn (Multi-stage Validation):
// 1. Pre-validation: Kiểm tra Lexer, Parser, Normalizer & theo dõi Entity Proposals.
// 2. Post-validation: Chạy validateSceneBlueprint toàn diện trên Finalized Blueprint.
//
// TRẠNG THÁI RÕ RÀNG (Explicit Validation States):
// - parseValid: Parser không có lỗi
// - normalizerValid: Normalizer không có lỗi
// - entityResolutionComplete: Không còn proposal nào chưa duyệt
// - finalBlueprintValid: Sơ đồ Scene Blueprint sau finalize đạt 100% kiểm định cấu trúc
// - readyToImport: parseValid && normalizerValid && entityResolutionComplete && finalBlueprintValid
import { validateSceneBlueprint } from "./blueprintValidator.js";
import { ensureRegistry } from "./entityRegistry.js";

function computeStats(blueprint, ast = null, entityProposals = []) {
  const registry = ensureRegistry(blueprint);
  let choiceCount = 0;
  for (const s of blueprint?.scenes || []) {
    choiceCount += s.choices?.length || 0;
  }

  return {
    sceneCount: blueprint?.scenes?.length || ast?.scenes?.length || 0,
    choiceCount,
    statCount: registry.stats?.length || ast?.stats?.length || 0,
    flagCount: registry.flags?.length || ast?.flags?.length || 0,
    itemCount: registry.items?.length || ast?.items?.length || 0,
    endingCount: blueprint?.endings?.length || ast?.endings?.length || 0,
    pendingProposalsCount: entityProposals.length,
  };
}

// 1. Kiểm định trước khi duyệt thực thể (Pre-validation)
export function validateParsedScript({
  ast,
  blueprint,
  entityProposals = [],
  parserIssues = [],
  normalizerIssues = [],
}) {
  const errors = [];
  const warnings = [];

  const parseErrors = parserIssues.filter((i) => i.type !== "warning");
  const normalizerErrors = normalizerIssues.filter((i) => i.type !== "warning");

  // Thu thập lỗi từ Parser và Normalizer (kèm số dòng)
  for (const issue of [...parserIssues, ...normalizerIssues]) {
    if (issue.type === "warning") {
      warnings.push({ line: issue.line || 1, message: issue.message, code: "PARSE_WARNING" });
    } else {
      errors.push({ line: issue.line || 1, message: issue.message, code: "PARSE_ERROR" });
    }
  }

  // Cảnh báo các thực thể mới đang chờ duyệt
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

  const parseValid = parseErrors.length === 0 && ast !== null;
  const normalizerValid = normalizerErrors.length === 0;
  const entityResolutionComplete = entityProposals.length === 0;

  // Nếu không có entity proposals, kiểm tra luôn blueprint
  let finalBlueprintValid = false;
  if (blueprint && entityResolutionComplete && parseValid && normalizerValid) {
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
    finalBlueprintValid = (bpValidation.errors || []).length === 0 && errors.length === 0;
  }

  const stats = computeStats(blueprint, ast, entityProposals);
  const readyToImport = Boolean(parseValid && normalizerValid && entityResolutionComplete && finalBlueprintValid && errors.length === 0);

  return {
    valid: readyToImport,
    parseValid,
    normalizerValid,
    entityResolutionComplete,
    finalBlueprintValid,
    readyToImport,
    hasPendingProposals: entityProposals.length > 0,
    errors,
    warnings,
    entityProposals,
    stats,
  };
}

// 2. Kiểm định toàn diện trên Finalized Blueprint (Post-validation)
export function validateFinalizedBlueprint(finalizedBlueprint, preValidation = null) {
  const errors = preValidation ? [...(preValidation.errors.filter((e) => e.code !== "UNAPPROVED_ENTITY_PROPOSAL"))] : [];
  const warnings = preValidation ? [...(preValidation.warnings.filter((w) => w.code !== "UNAPPROVED_ENTITY_PROPOSAL"))] : [];

  if (!finalizedBlueprint) {
    errors.push({ line: 0, message: "Blueprint sau khi duyệt thực thể không tồn tại.", code: "FINAL_BLUEPRINT_ERROR" });
    return {
      valid: false,
      parseValid: preValidation?.parseValid ?? true,
      normalizerValid: preValidation?.normalizerValid ?? true,
      entityResolutionComplete: true,
      finalBlueprintValid: false,
      readyToImport: false,
      errors,
      warnings,
      stats: computeStats(null),
    };
  }

  const bpValidation = validateSceneBlueprint(finalizedBlueprint);
  for (const err of bpValidation.errors || []) {
    if (!errors.some((e) => e.message.includes(err) || err.includes(e.message))) {
      errors.push({ line: 0, message: err, code: "FINAL_BLUEPRINT_ERROR" });
    }
  }
  for (const warn of bpValidation.warnings || []) {
    if (!warnings.some((w) => w.message.includes(warn) || warn.includes(w.message))) {
      warnings.push({ line: 0, message: warn, code: "FINAL_BLUEPRINT_WARNING" });
    }
  }

  const parseValid = preValidation?.parseValid ?? true;
  const normalizerValid = preValidation?.normalizerValid ?? true;
  const finalBlueprintValid = (bpValidation.errors || []).length === 0 && errors.length === 0;
  const readyToImport = Boolean(parseValid && normalizerValid && finalBlueprintValid && errors.length === 0);

  return {
    valid: readyToImport,
    parseValid,
    normalizerValid,
    entityResolutionComplete: true,
    finalBlueprintValid,
    readyToImport,
    errors,
    warnings,
    stats: computeStats(finalizedBlueprint),
  };
}
