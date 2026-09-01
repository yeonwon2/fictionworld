// Xưởng Game Pro — PRO 1: prompt + schema cho AI Game/Episode Planner.
//
// Theo đúng khuôn mẫu đã có ở Xưởng Kịch Bản Game (src/lib/gameScriptProject/
// prompts.js): mỗi prompt builder đi kèm 1 schema JSON dùng cho aiCall()'s
// `jsonSchema` — aiCall KHÔNG ép schema thật (chỉ nhúng vào prompt dạng chỉ
// dẫn + yêu cầu output JSON hợp lệ cú pháp), nên plannerAI.js phải tự thẩm
// định/khoan dung kết quả trả về (xem plannerAI.js).
import { MAX_EPISODES } from "./plannerModel.js";

function stickToIdeaRules(idea) {
  return `# QUY TẮC BẮT BUỘC — BÁM SÁT Ý TƯỞNG
- Ý tưởng dưới đây là NGUỒN DUY NHẤT. Chỉ PHÁT TRIỂN THÊM chi tiết còn thiếu, KHÔNG bịa thế giới/nhân vật/thể loại khác với ý tưởng.
- Nếu ý tưởng đã nêu tên nhân vật, chỉ số, phe phái, hệ thống... PHẢI dùng đúng tên đó.
- Nếu ý tưởng chưa đặt tên, hãy tạo tên mới phù hợp bối cảnh.
- Đây là LẬP KẾ HOẠCH (planning), KHÔNG phải viết văn/lời thoại đầy đủ — mọi mô tả nên ngắn gọn, súc tích (1–3 câu mỗi trường).

# Ý TƯỞNG CỦA NGƯỜI DÙNG
"""${idea?.trim() || "(trống)"}"""`;
}

function settingsBlock(settings) {
  const lines = [];
  if (settings?.genre) lines.push(`- Thể loại: ${settings.genre}`);
  lines.push(`- Độ dài: ${settings?.gameLength === "long" ? "game dài nhiều tập" : "game ngắn (1 tập)"}`);
  if (settings?.estimatedEpisodes) lines.push(`- Số tập mong muốn: khoảng ${settings.estimatedEpisodes}`);
  if (settings?.episodeLength) lines.push(`- Độ dài mỗi tập mong muốn: ${settings.episodeLength}`);
  if (settings?.style) lines.push(`- Phong cách: ${settings.style}`);
  if (settings?.branchiness) lines.push(`- Mức độ phân nhánh mong muốn: ${settings.branchiness}`);
  return lines.length ? lines.join("\n") : "(không có tuỳ chọn thêm — tự quyết định hợp lý theo ý tưởng)";
}

// ---------- Game Plan (+ tóm tắt các tập cần lập kế hoạch chi tiết tiếp) ----------
export function buildGamePlanPrompt(idea, settings, lockedEpisodes = [], episodeCountToGenerate) {
  const lockedBlock = lockedEpisodes.length
    ? `\n# CÁC TẬP ĐÃ KHOÁ (giữ nguyên, KHÔNG lập lại — chỉ dùng làm bối cảnh để các tập mới khớp mạch truyện)\n${lockedEpisodes
        .map((e, i) => `${i + 1}. "${e.title}" — ${e.summary || "(không có tóm tắt)"} | Mục tiêu: ${e.goal || "(chưa có)"}`)
        .join("\n")}\n\nChỉ trả về episodeSummaries cho các tập MỚI (không lặp lại các tập đã khoá ở trên).`
    : "";

  return `Bạn là NHÀ THIẾT KẾ GAME cho một game nhập vai dạng lựa chọn (visual novel / interactive fiction). Nhiệm vụ: từ ý tưởng của người dùng, lập một BẢN KẾ HOẠCH GAME tổng thể (Game Plan) — CHƯA viết lời thoại, CHƯA dựng cảnh thật.

${stickToIdeaRules(idea)}

# TUỲ CHỌN NGƯỜI DÙNG
${settingsBlock(settings)}
${lockedBlock}

# YÊU CẦU
- title, premise (bối cảnh/tiền đề ngắn gọn), genre, tone (giọng điệu), coreGameplayLoop (vòng lặp lối chơi chính, 1-2 câu), protagonist (nhân vật chính).
- importantCharacters: các nhân vật quan trọng khác (name, role, description ngắn).
- suggestedStats / suggestedRelationships / suggestedFlags / suggestedItems: mỗi phần tử có name, description, và origin = "user" nếu người dùng ĐÃ nêu rõ trong ý tưởng, hoặc "ai" nếu đây là đề xuất thêm của bạn. Đừng bịa quá nhiều — ưu tiên bám sát ý tưởng, chỉ đề xuất thêm khi thực sự hợp lý.
- majorSystems: các hệ thống/cơ chế lớn của game (mảng chuỗi ngắn).
- endingStrategy: định hướng chung về (các) kết thúc của game.
- episodeSummaries: ${episodeCountToGenerate ? `ĐÚNG ${episodeCountToGenerate} tập mới (không tính các tập đã khoá)` : "số tập hợp lý theo ý tưởng và tuỳ chọn"}, tối đa ${MAX_EPISODES} tập, mỗi phần tử chỉ gồm {title, summary} ngắn gọn — CHƯA cần chi tiết giai đoạn/nhân vật/rủi ro, việc đó sẽ lập kế hoạch riêng cho từng tập sau.

Trả JSON đúng schema.`;
}

export const GAME_PLAN_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    premise: { type: "string" },
    genre: { type: "string" },
    tone: { type: "string" },
    coreGameplayLoop: { type: "string" },
    protagonist: { type: "string" },
    importantCharacters: {
      type: "array",
      items: { type: "object", properties: { name: { type: "string" }, role: { type: "string" }, description: { type: "string" } } },
    },
    suggestedStats: {
      type: "array",
      items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, origin: { type: "string" } } },
    },
    suggestedRelationships: {
      type: "array",
      items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, origin: { type: "string" } } },
    },
    suggestedFlags: {
      type: "array",
      items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, origin: { type: "string" } } },
    },
    suggestedItems: {
      type: "array",
      items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, origin: { type: "string" } } },
    },
    majorSystems: { type: "array", items: { type: "string" } },
    endingStrategy: { type: "string" },
    episodeSummaries: {
      type: "array",
      items: { type: "object", properties: { title: { type: "string" }, summary: { type: "string" } }, required: ["title", "summary"] },
    },
  },
  required: ["title", "premise", "episodeSummaries"],
};

// ---------- Episode Plan (1 tập, có bối cảnh tập trước/sau ở dạng tóm tắt) ----------
export function compactGamePlanSummary(gamePlan) {
  if (!gamePlan) return "(chưa có kế hoạch game)";
  const stats = (gamePlan.suggestedStats || []).map((s) => s.name).filter(Boolean).join(", ");
  const systems = (gamePlan.majorSystems || []).join(", ");
  return [
    `Tên game: ${gamePlan.title || "(chưa đặt)"}`,
    `Tiền đề: ${gamePlan.premise || "(chưa có)"}`,
    `Nhân vật chính: ${gamePlan.protagonist || "(chưa có)"}`,
    stats ? `Chỉ số: ${stats}` : "",
    systems ? `Hệ thống lớn: ${systems}` : "",
    `Định hướng kết thúc: ${gamePlan.endingStrategy || "(chưa có)"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function compactEpisodeSummary(episode) {
  if (!episode) return null;
  return `"${episode.title}" — ${episode.summary || "(không có tóm tắt)"} | Mục tiêu: ${episode.goal || "(chưa có)"}`;
}

export function buildEpisodePlanPrompt(gamePlan, targetSeed, neighbors = {}) {
  const neighborLines = [];
  if (neighbors.prev) neighborLines.push(`- Tập trước: ${compactEpisodeSummary(neighbors.prev)}`);
  if (neighbors.next) neighborLines.push(`- Tập sau: ${compactEpisodeSummary(neighbors.next)}`);

  return `Bạn là NHÀ THIẾT KẾ GAME. Dựa trên bản Kế Hoạch Game bên dưới, hãy lập KẾ HOẠCH CHI TIẾT cho MỘT TẬP — vẫn là lập kế hoạch (giai đoạn/sự kiện/nguy hiểm ở mức tóm tắt), CHƯA viết lời thoại hay cảnh thật.

# KẾ HOẠCH GAME (bối cảnh)
${compactGamePlanSummary(gamePlan)}

# TẬP CẦN LẬP KẾ HOẠCH
Tên/tóm tắt gợi ý: "${targetSeed?.title || ""}" — ${targetSeed?.summary || "(chưa có, tự đặt phù hợp mạch truyện)"}
${neighborLines.length ? `\n# TẬP LÂN CẬN (chỉ để giữ mạch truyện liền mạch, KHÔNG lập kế hoạch cho các tập này)\n${neighborLines.join("\n")}` : ""}

# YÊU CẦU
- title, summary, startState (tình huống mở đầu tập), goal (mục tiêu chính của tập).
- stages: các giai đoạn trong tập, mỗi giai đoạn có title, purpose (mục đích), approximateSceneCount (số cảnh ước lượng), importantEvents (mảng chuỗi các sự kiện quan trọng).
- keyCharacters, relevantStats, relevantFlags, relevantItems: mảng chuỗi tên liên quan tới tập này.
- majorConflict (xung đột chính), climax (cao trào), possibleFailure (khả năng thất bại/hệ quả xấu), transitionToNextEpisode (cách dẫn sang tập sau).
- planningIntents: các LƯU Ý ĐẶC BIỆT cần nhớ khi dựng cảnh thật sau này (CHƯA cần biến thành luật/graph) — mỗi phần tử {type, description}, type nên là một trong: multi_choice, instant_failure, side_branch, convergence, item_gate, relationship_or_flag_gate, non_lethal_failure, other. Ví dụ: "có đoạn 4 lựa chọn", "một lựa chọn sai có thể chết ngay", "có nhánh phụ nếu giúp NPC X", "một số nhánh hội tụ lại sau vài cảnh", "cần vật phẩm Y mới mở lựa chọn này", "không đủ điểm vẫn sống nhưng kết quả khác". Chỉ ghi những gì thực sự gợi ý được từ ý tưởng/bối cảnh, không bắt buộc phải có đủ mọi loại.

Trả JSON đúng schema.`;
}

export const EPISODE_PLAN_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    startState: { type: "string" },
    goal: { type: "string" },
    stages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          purpose: { type: "string" },
          approximateSceneCount: { type: "number" },
          importantEvents: { type: "array", items: { type: "string" } },
        },
      },
    },
    keyCharacters: { type: "array", items: { type: "string" } },
    relevantStats: { type: "array", items: { type: "string" } },
    relevantFlags: { type: "array", items: { type: "string" } },
    relevantItems: { type: "array", items: { type: "string" } },
    majorConflict: { type: "string" },
    climax: { type: "string" },
    possibleFailure: { type: "string" },
    transitionToNextEpisode: { type: "string" },
    planningIntents: {
      type: "array",
      items: { type: "object", properties: { type: { type: "string" }, description: { type: "string" } }, required: ["description"] },
    },
  },
  required: ["title", "summary", "goal", "stages"],
};
