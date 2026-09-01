// Xưởng Game Pro — PRO 4: EXTERNAL AI SCRIPT BRIDGE COORDINATOR
//
// Đầu mối chính kết nối toàn bộ hệ thống kịch bản ngoài:
// - Phân tích cục bộ (Parser + Normalizer + Pre-Validator)
// - Duyệt và khớp thực thể (Fail-Closed Entity Approval & Finalization)
// - Tái kiểm định toàn diện sau khi duyệt (Finalize & Full Validation)
// - Xuất bản kịch bản (Serializer)
// - Tạo prompt cho AI bên ngoài (ChatGPT, Claude, Gemini, DeepSeek...)
import { parseProScript } from "./scriptParser.js";
import { normalizeProScriptAst, finalizeProScriptBlueprint } from "./scriptNormalizer.js";
import { validateParsedScript, validateFinalizedBlueprint } from "./scriptValidator.js";
import { serializeEpisodeBlueprint } from "./scriptSerializer.js";
import { generateExternalAiPrompt, generateRepairPrompt } from "./scriptPromptGenerator.js";
import { SCRIPT_HEADER_V1, SCRIPT_FORMAT_VERSION, SCRIPT_FORMAT_DOCS } from "./scriptFormat.js";

// Giai đoạn 1: Parse, Normalize & Pre-validate
export function parseAndValidateProScript(scriptText, { episodeId = "ep_1", existingRegistry = null } = {}) {
  const { ast, issues: parserIssues, lines } = parseProScript(scriptText);

  let blueprint = null;
  let normalizerIssues = [];
  let entityProposals = [];
  let registry = existingRegistry;

  if (ast) {
    const normResult = normalizeProScriptAst(ast, { episodeId, existingRegistry });
    blueprint = normResult.blueprint;
    normalizerIssues = normResult.issues;
    entityProposals = normResult.entityProposals;
    registry = normResult.registry;
  }

  const validation = validateParsedScript({
    ast,
    blueprint,
    entityProposals,
    parserIssues,
    normalizerIssues,
  });

  return {
    ast,
    blueprint,
    entityProposals,
    validation,
    registry,
    lines,
  };
}

// Giai đoạn 2: Finalize & Full Post-Validation (Kiểm tra lại sau khi người dùng duyệt proposals)
export function finalizeAndValidateProScript({
  normalizedResult,
  approvals = {},
  existingRegistry = null,
  episodeId = "ep_1",
}) {
  if (!normalizedResult) {
    return {
      ok: false,
      finalizedBlueprint: null,
      finalizedRegistry: null,
      validation: {
        parseValid: false,
        normalizerValid: false,
        entityResolutionComplete: false,
        finalBlueprintValid: false,
        readyToImport: false,
        errors: [{ line: 0, message: "Thiếu dữ liệu normalizedResult.", code: "PARAM_ERROR" }],
        warnings: [],
        stats: {},
      },
    };
  }

  // 1. Finalize (Fail-closed)
  const finalResult = finalizeProScriptBlueprint(normalizedResult, approvals, {
    existingRegistry,
    episodeId,
  });

  if (!finalResult.ok) {
    return {
      ok: false,
      finalizedBlueprint: null,
      finalizedRegistry: null,
      validation: {
        parseValid: normalizedResult.validation?.parseValid ?? true,
        normalizerValid: normalizedResult.validation?.normalizerValid ?? true,
        entityResolutionComplete: false,
        finalBlueprintValid: false,
        readyToImport: false,
        errors: finalResult.errors.map((msg) => ({ line: 0, message: msg, code: "FINALIZE_ERROR" })),
        warnings: normalizedResult.validation?.warnings || [],
        stats: normalizedResult.validation?.stats || {},
      },
    };
  }

  // 2. Full Validate trên Finalized Blueprint
  const postValidation = validateFinalizedBlueprint(finalResult.blueprint, normalizedResult.validation);

  return {
    ok: postValidation.readyToImport,
    finalizedBlueprint: finalResult.blueprint,
    finalizedRegistry: finalResult.registry,
    validation: postValidation,
  };
}

export {
  finalizeProScriptBlueprint,
  validateParsedScript,
  validateFinalizedBlueprint,
  serializeEpisodeBlueprint,
  generateExternalAiPrompt,
  generateRepairPrompt,
  SCRIPT_HEADER_V1,
  SCRIPT_FORMAT_VERSION,
  SCRIPT_FORMAT_DOCS,
};
