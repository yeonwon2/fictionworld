// Xưởng Game Pro — PRO 4: EXTERNAL AI SCRIPT BRIDGE COORDINATOR
//
// Đầu mối chính kết nối toàn bộ hệ thống kịch bản ngoài:
// - Phân tích cục bộ (Parser + Normalizer + Validator)
// - Duyệt và khớp thực thể (Entity Approval & Finalization)
// - Xuất bản kịch bản (Serializer)
// - Tạo prompt cho AI bên ngoài (ChatGPT, Claude, Gemini, DeepSeek...)
import { parseProScript } from "./scriptParser.js";
import { normalizeProScriptAst, finalizeProScriptBlueprint } from "./scriptNormalizer.js";
import { validateParsedScript } from "./scriptValidator.js";
import { serializeEpisodeBlueprint } from "./scriptSerializer.js";
import { generateExternalAiPrompt, generateRepairPrompt } from "./scriptPromptGenerator.js";
import { SCRIPT_HEADER_V1, SCRIPT_FORMAT_VERSION, SCRIPT_FORMAT_DOCS } from "./scriptFormat.js";

export function parseAndValidateProScript(scriptText, { episodeId = "ep_1", existingRegistry = null } = {}) {
  // 1. Lexer & Parser
  const { ast, issues: parserIssues, lines } = parseProScript(scriptText);

  // 2. Normalizer & Entity Resolver (PURE - Không silent create)
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

  // 3. Validator (Line-Level Errors, Proposal Tracking & Stats)
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

export {
  finalizeProScriptBlueprint,
  serializeEpisodeBlueprint,
  generateExternalAiPrompt,
  generateRepairPrompt,
  SCRIPT_HEADER_V1,
  SCRIPT_FORMAT_VERSION,
  SCRIPT_FORMAT_DOCS,
};
