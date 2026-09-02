// Xưởng Game Pro — PRO 2: prompt + schema cho AI dựng/sửa Scene Blueprint.
// Cùng khuôn mẫu plannerPrompts.js: mỗi prompt builder đi kèm 1 JSON schema
// dùng cho aiCall()'s `jsonSchema` (chỉ là chỉ dẫn nhúng vào prompt, KHÔNG ép
// schema thật ở model) — blueprintAI.js phải tự thẩm định/khoan dung kết quả.
//
// AI KHÔNG được trả prose tự do hay kỹ thuật (node ID/targetNodeId/requiresFlag
// thật) — mỗi cảnh có `ref` (nhãn cục bộ do AI đặt, ví dụ "s1", "sideA") để
// các lựa chọn trỏ tới nhau TRONG CÙNG 1 phản hồi; blueprintAI.js mới đổi các
// ref này thành ID hệ thống thật (xem normalizeAIScenes ở đó).
import { compactGamePlanSummary, compactEpisodeSummary } from "./plannerPrompts.js";
import { SCENE_ROLES, SCENE_ROLE_LABELS, MAX_DECISION_CHOICES, MAX_SCENES_PER_EPISODE } from "./blueprintModel.js";
import { resolveEpisodeConstraints } from "./planningConstraints.js";
import { registryBlock } from "./rulePrompts.js";

const ROLE_GUIDE = Object.entries(SCENE_ROLE_LABELS)
  .map(([key, label]) => `  - "${key}" (${label})`)
  .join("\n");

function episodeContextBlock(gamePlan, episode) {
  const stages = (episode.stages || [])
    .map((s, i) => `  ${i + 1}. ${s.title || "(chưa đặt tên)"} — ${s.purpose || ""} (khoảng ${s.approximateSceneCount ?? "?"} cảnh). Sự kiện: ${(s.importantEvents || []).join("; ") || "(không có)"}`)
    .join("\n");
  const intents = (episode.planningIntents || []).map((it) => `  - [${it.type}] ${it.description}`).join("\n");
  const relevant = [
    episode.keyCharacters?.length ? `Nhân vật liên quan: ${episode.keyCharacters.join(", ")}` : "",
    episode.relevantStats?.length ? `Chỉ số liên quan: ${episode.relevantStats.join(", ")}` : "",
    episode.relevantFlags?.length ? `Cờ truyện liên quan: ${episode.relevantFlags.join(", ")}` : "",
    episode.relevantItems?.length ? `Vật phẩm liên quan: ${episode.relevantItems.join(", ")}` : "",
  ].filter(Boolean).join("\n");

  return `# KẾ HOẠCH GAME (bối cảnh)
${compactGamePlanSummary(gamePlan)}

# TẬP ĐANG DỰNG SƠ ĐỒ
Tên: "${episode.title}"
Tóm tắt: ${episode.summary || "(không có)"}
Tình huống mở đầu: ${episode.startState || "(không có)"}
Mục tiêu: ${episode.goal || "(không có)"}
Xung đột chính: ${episode.majorConflict || "(không có)"}
Cao trào: ${episode.climax || "(không có)"}
Khả năng thất bại: ${episode.possibleFailure || "(không có)"}
Chuyển sang tập sau: ${episode.transitionToNextEpisode || "(không có)"}
${relevant ? `\n${relevant}` : ""}

# GIAI ĐOẠN TRONG TẬP (dùng để ước lượng số cảnh — KHÔNG cần đúng tuyệt đối)
${stages || "(chưa có giai đoạn nào — tự chia hợp lý theo tóm tắt/mục tiêu)"}

# GHI CHÚ ĐẶC BIỆT CỦA NGƯỜI DÙNG (planningIntents — RẤT QUAN TRỌNG, phải thể hiện đúng trong sơ đồ)
${intents || "(không có ghi chú đặc biệt nào)"}`;
}

function sceneShapeInstructions(maxScenes, constraints = null) {
  return `# CÁCH MÔ TẢ 1 CẢNH (Scene Blueprint — CHỈ CẤU TRÚC, KHÔNG viết lời thoại đầy đủ)
Mỗi cảnh gồm:
- ref: nhãn CỤC BỘ do bạn đặt (vd "s1", "s2", "side_a"), duy nhất trong phản hồi này. Đây KHÔNG phải ID thật — hệ thống sẽ tự đổi ID sau.
- title: tên ngắn gọn của cảnh.
- role: PHẢI là một trong các loại sau:
${ROLE_GUIDE}
- intent: Ý ĐỒ CẢNH súc tích (1-2 câu), đủ hiểu topology nhưng KHÔNG viết văn cảnh dài.
- choices: mảng lựa chọn. Cảnh loại "decision" cần 2-${MAX_DECISION_CHOICES} lựa chọn (nếu ghi chú đặc biệt yêu cầu đúng 1 số lượng thì PHẢI theo đúng số đó). Cảnh loại "story"/"consequence"/"condition"/"convergence" thường chỉ cần 1 lựa chọn "đi tiếp" (hoặc để trống nếu không có lối đi tiếp — hiếm khi xảy ra). Cảnh loại "ending" KHÔNG có choices (để mảng rỗng).
  Mỗi lựa chọn gồm: text (lời lựa chọn, có thể để trống nếu chỉ là "đi tiếp"), target (ref của cảnh/kết thúc mà lựa chọn này dẫn tới — PHẢI khớp đúng 1 ref đã khai báo), targetKind ("scene" hoặc "ending"), gateIntent (ghi chú ĐIỀU KIỆN bằng văn bản tự nhiên), effectIntent (HỆ QUẢ riêng bằng cú pháp tự nhiên tương thích luật hiện có, ví dụ "Thiện cảm nữ chính +15"; chỉ dùng đúng tên chỉ số/quan hệ/cờ/vật phẩm trong bối cảnh, không tự chế biến thể tên).
- Nếu 1 lựa chọn dẫn tới cái chết/thất bại ngay lập tức: cho targetKind="ending", trỏ tới 1 kết thúc phù hợp (tone="death").

# CÁCH MÔ TẢ 1 KẾT THÚC (endings)
Mỗi kết thúc gồm: ref (nhãn cục bộ), title, text (mô tả ngắn), tone ("death" nếu là kết thúc xấu/chết, "neutral" nếu bình thường, "good" nếu tốt).

# GIỚI HẠN
- Trần an toàn là ${maxScenes} cảnh. Không tự thu nhỏ hoặc gộp mất quy mô người dùng yêu cầu.
${constraints ? `- Mục tiêu: khoảng ${constraints.targetSceneCount} ${constraints.desiredChoicesPerDecision ? "cảnh CHƠI được (playable decision/story moments)" : "cảnh có ý nghĩa"}, phạm vi chấp nhận ${constraints.minimumSceneCount}-${constraints.maximumSceneCount}.${constraints.desiredChoicesPerDecision ? ` MỖI cảnh chơi phải là role="decision", có ĐÚNG ${constraints.desiredChoicesPerDecision} lựa chọn có ý nghĩa và mỗi lựa chọn có effectIntent riêng. Không biến cảnh chơi thành STORY với một nút “đi tiếp”. STORY-only phải hiếm, chỉ dùng cho nhịp kể thật sự cần thiết, và KHÔNG tính vào mục tiêu ${constraints.targetSceneCount} cảnh chơi.` : ""}${constraints.sourceIdea ? `\n- Ràng buộc gốc của người dùng (phải giữ cả mốc thời gian, ngưỡng điểm và yêu cầu kết thúc): ${constraints.sourceIdea}` : ""}` : ""}
- PHẢI có đúng 1 cảnh có isStart=true — đó là cảnh người chơi bắt đầu tập.
- Mọi target PHẢI khớp đúng 1 ref có thật trong phản hồi (của scenes hoặc endings) — không được để trống hoặc trỏ ra ngoài.
- Đây là LẬP SƠ ĐỒ (structure), CHƯA phải viết lời thoại/văn cảnh đầy đủ — intent súc tích, không cần văn hoa.`;
}

// `targetOverride` (tuỳ chọn): dựng ĐỢT ĐẦU nhỏ hơn mục tiêu thật — ~30 cảnh
// dài (đúng văn phong người dùng yêu cầu) xin trong 1 lượt rất dễ vượt ngân
// sách token (MAX_TOKENS, JSON hỏng hoàn toàn, mất trắng cả lượt gọi). Xin
// một đợt nhỏ hơn, an toàn hơn, rồi để continueEpisodeBlueprint() bồi thêm
// nhiều lượt nhỏ (đã có sẵn — xem blueprintAI.js) thay vì 1 lượt lớn rủi ro.
export function buildEpisodeBlueprintPrompt(gamePlan, episode, { targetOverride = null } = {}) {
  const constraints = resolveEpisodeConstraints(episode);
  const capped = targetOverride && targetOverride < constraints.targetSceneCount;
  const promptConstraints = capped
    ? { ...constraints, targetSceneCount: targetOverride, maximumSceneCount: Math.min(constraints.maximumSceneCount, targetOverride) }
    : constraints;
  const batchNote = capped
    ? `\n# ĐỢT ĐẦU TRONG NHIỀU LƯỢT\nMục tiêu CUỐI CÙNG của tập là khoảng ${constraints.targetSceneCount} cảnh, nhưng phản hồi NÀY chỉ cần khoảng ${targetOverride} cảnh mở đầu (từ cảnh isStart), mạch lạc và tự hợp lệ (mọi target vẫn phải khớp đúng 1 ref có thật TRONG phản hồi này). KHÔNG cần chạm hết mọi kết thúc — các lượt sau sẽ được yêu cầu dựng tiếp và nối vào đúng các ref của lượt này. Việc chia nhỏ này CHỈ để an toàn ngân sách phản hồi, không phải giảm quy mô câu chuyện.\n`
    : "";
  return `Bạn là NHÀ THIẾT KẾ GAME. Từ Kế hoạch Tập bên dưới, hãy DỰNG SƠ ĐỒ CẢNH (Scene Blueprint) cho MỘT TẬP — xác định các cảnh sẽ đi qua và cách chúng nối với nhau (topology), CHƯA viết lời thoại đầy đủ.

${episodeContextBlock(gamePlan, episode)}
${batchNote}
${sceneShapeInstructions(MAX_SCENES_PER_EPISODE, promptConstraints)}

Trả JSON đúng schema: { scenes: [...], endings: [...] }.`;
}

export function buildBlueprintContinuationPrompt(gamePlan, episode, blueprint, missingCount) {
  const constraints = resolveEpisodeConstraints(episode);
  // Kèm `intent` (không chỉ title) — CHỈ có title rất dễ khiến model (nhất
  // là model rẻ/nhanh) không nhận ra 1 tình huống đã kể rồi và viết lại
  // GẦN NHƯ NGUYÊN VẸN dưới cái tên khác (vd "Khoảnh khắc đối đầu" rồi lại
  // "Đối diện với sự căm hận" cùng 1 xung đột, cùng 4 lựa chọn tương tự) —
  // vừa lãng phí lượt gọi vừa tạo cảnh mồ côi vì không cảnh nào trỏ tới.
  const dangling = (blueprint.scenes || []).filter((scene) => scene.role !== "ending" && (scene.choices || []).length === 0);
  const existing = (blueprint.scenes || [])
    .map((scene) => `- ${scene.id} [${scene.role}] "${scene.title}" — ${scene.intent || "(không có ý đồ)"}`)
    .join("\n");
  const endings = (blueprint.endings || []).map((ending) => `- ${ending.id}: ${ending.title}`).join("\n");
  const danglingBlock = dangling.length
    ? `\n# CẢNH CHƯA CÓ LỐI ĐI TIẾP (ưu tiên nối tiếp mạch truyện từ ĐÂY trước khi mở tình huống mới)\n${dangling.map((s) => `- ${s.id} "${s.title}"`).join("\n")}\n`
    : "";
  return `Bạn là NHÀ THIẾT KẾ GAME. Hãy TIẾP TỤC phần sơ đồ còn thiếu, chỉ THÊM nội dung mới và không viết lại cảnh đã có.

${episodeContextBlock(gamePlan, episode)}

# ĐÃ CÓ (có thể dùng đúng ref làm target, tuyệt đối không khai báo lại)
${existing}
# KẾT THÚC ĐÃ CÓ
${endings || "(chưa có)"}
${danglingBlock}
# PHẦN CÒN THIẾU
Thêm khoảng ${missingCount} cảnh có ý nghĩa, cùng số nút nối thật sự cần thiết. Nối phần mới vào các ref đã có; giữ các nhánh/kết thúc hiện tại. KHÔNG được tạo một cảnh mới kể lại/diễn giải lại cùng 1 tình huống xung đột đã có ở mục "ĐÃ CÓ" bằng tên khác — mỗi cảnh mới phải đưa câu chuyện tiến lên (thời điểm/tình huống thật sự mới), không lặp lại ý đồ cảnh đã tồn tại. Trả scenes/endings CHỈ gồm phần mới. Không đặt isStart=true.
${sceneShapeInstructions(MAX_SCENES_PER_EPISODE, constraints)}
Trả JSON đúng schema: { scenes: [...], endings: [...] }.`;
}

export const SCENE_CHOICE_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string" },
    target: { type: "string" },
    targetKind: { type: "string" },
    gateIntent: { type: "string" },
    effectIntent: { type: "string" },
  },
  required: ["target", "targetKind"],
};

export const SCENE_SCHEMA = {
  type: "object",
  properties: {
    ref: { type: "string" },
    title: { type: "string" },
    role: { type: "string" },
    intent: { type: "string" },
    isStart: { type: "boolean" },
    choices: { type: "array", items: SCENE_CHOICE_SCHEMA },
  },
  required: ["ref", "title", "role", "intent"],
};

export const ENDING_SCHEMA = {
  type: "object",
  properties: {
    ref: { type: "string" },
    title: { type: "string" },
    text: { type: "string" },
    tone: { type: "string" },
  },
  required: ["ref", "title"],
};

export const EPISODE_BLUEPRINT_SCHEMA = {
  type: "object",
  properties: {
    scenes: { type: "array", items: SCENE_SCHEMA },
    endings: { type: "array", items: ENDING_SCHEMA },
  },
  required: ["scenes"],
};

// ---------- Thiết kế lại MỘT cảnh ("AI thiết kế lại cảnh") ----------
// Chỉ được sửa cảnh đang chọn + cảnh mới trực tiếp cần thiết cho nó — KHÔNG
// viết lại cả Episode. Các cảnh khác được liệt kê CHỈ để AI biết đích có thể
// trỏ tới (bằng ID THẬT của chúng, dùng luôn làm ref) — AI không được đổi nội
// dung các cảnh đó.
export function buildSceneRedesignPrompt(gamePlan, episode, blueprint, targetSceneId, instructionText) {
  const target = blueprint.scenes.find((s) => s.id === targetSceneId);
  const others = blueprint.scenes.filter((s) => s.id !== targetSceneId);
  const othersBlock = others
    .map((s) => `  - ref="${s.id}" · [${s.role}] "${s.title || "(chưa đặt tên)"}" — ${s.intent?.slice(0, 140) || "(chưa có ý đồ)"}`)
    .join("\n");
  const endingsBlock = (blueprint.endings || [])
    .map((e) => `  - ref="${e.id}" · "${e.title || "(chưa đặt tên)"}" (tone=${e.tone})`)
    .join("\n");
  const currentChoices = (target?.choices || [])
    .map((c, i) => `  ${i + 1}. "${c.text || "(đi tiếp)"}" → ${c.targetId || "(chưa nối)"}${c.gateIntent ? ` [điều kiện: ${c.gateIntent}]` : ""}`)
    .join("\n");

  return `Bạn là NHÀ THIẾT KẾ GAME. Người dùng muốn THIẾT KẾ LẠI MỘT CẢNH trong sơ đồ tập đã có. CHỈ được sửa cảnh này và tạo thêm cảnh MỚI thực sự cần thiết cho ý đồ mới — TUYỆT ĐỐI KHÔNG viết lại/đổi các cảnh khác đã liệt kê bên dưới (chúng chỉ để bạn biết có thể trỏ lựa chọn tới đâu).

${episodeContextBlock(gamePlan, episode)}

# CẢNH ĐANG SỬA (ref="${targetSceneId}")
Tên hiện tại: "${target?.title || ""}"
Loại hiện tại: ${target?.role || "story"}
Ý đồ hiện tại: ${target?.intent || "(chưa có)"}
Lựa chọn hiện tại:
${currentChoices || "  (chưa có lựa chọn nào)"}

# YÊU CẦU MỚI CỦA NGƯỜI DÙNG (ý đồ cảnh — bám sát đúng yêu cầu này)
"""${instructionText || "(không có yêu cầu thêm — cải thiện hợp lý theo bối cảnh)"}"""

# CÁC CẢNH KHÁC ĐÃ CÓ (chỉ để trỏ target tới, KHÔNG được sửa/định nghĩa lại — nếu trỏ tới 1 cảnh dưới đây, dùng ĐÚNG ref của nó, KHÔNG khai báo lại nó trong "scenes")
${othersBlock || "  (không có cảnh nào khác)"}

# CÁC KẾT THÚC ĐÃ CÓ (dùng đúng ref nếu muốn trỏ tới, KHÔNG khai báo lại)
${endingsBlock || "  (chưa có kết thúc nào)"}

${sceneShapeInstructions(6)}

# QUAN TRỌNG
- Trong "scenes" trả về, PHẦN TỬ ĐẦU TIÊN PHẢI là cảnh đang sửa — dùng chính ref="${targetSceneId}" (giữ nguyên ref này, KHÔNG đổi).
- Chỉ thêm "scenes" MỚI nếu ý đồ mới thực sự cần một cảnh phụ/hệ quả mới (ví dụ mở 1 cảnh phụ). Nếu không cần, chỉ trả về đúng 1 phần tử (cảnh đang sửa).
- KHÔNG lặp lại/khai báo lại bất kỳ cảnh nào trong "CÁC CẢNH KHÁC ĐÃ CÓ" ở trên trong mảng "scenes" trả về.
- Không cần "endings" mới trừ khi ý đồ mới thực sự cần 1 kết thúc mới (ví dụ 1 lựa chọn chết ngay mà chưa có kết thúc phù hợp).

Trả JSON đúng schema: { scenes: [...], endings: [...] }.`;
}

export const SCENE_REDESIGN_SCHEMA = EPISODE_BLUEPRINT_SCHEMA;

// Sửa HỆ QUẢ LỰA CHỌN hàng loạt, GỘP CHUNG 1 lượt gọi cho TOÀN BỘ tập —
// dùng khi validate sau khi dựng/tiếp tục sơ đồ phát hiện lựa chọn thiếu hệ
// quả hoặc 2+ lựa chọn cùng cảnh cho cùng 1 hệ quả (xem
// blueprintRepair.js#findChoiceEffectGaps). KHÔNG gửi lại cả sơ đồ, KHÔNG
// gọi 1 lượt/cảnh — chỉ gửi đúng các cảnh/lựa chọn đang thiếu, để tiết kiệm
// request (mỗi lượt "hoàn thiện" tự động chỉ tốn TỐI ĐA 1 lượt gọi AI, bất
// kể có bao nhiêu cảnh cần vá — xem repairBlueprintEffects() ở blueprintAI.js).
export function buildBatchEffectRepairPrompt(gamePlan, episode, gaps, registry) {
  const scenesBlock = gaps
    .map((g) => {
      const choicesText = g.choices
        .map((c, i) => `    ${i + 1}. choiceId="${c.id}" text="${c.text || "(đi tiếp)"}"${g.problemChoiceIds.has(c.id) ? " ← ĐANG THIẾU/TRÙNG hệ quả, cần hệ quả MỚI" : " (đã có hệ quả riêng, GIỮ NGUYÊN, không cần trả lại)"}`)
        .join("\n");
      return `- Cảnh "${g.sceneTitle}" (id="${g.sceneId}")\n  Ý đồ: ${g.sceneIntent || "(không có)"}\n  Lựa chọn:\n${choicesText}`;
    })
    .join("\n");
  return `Bạn là NHÀ THIẾT KẾ GAME. Các cảnh QUYẾT ĐỊNH bên dưới đang VI PHẠM yêu cầu gốc của người chơi: "mỗi lựa chọn phải có hệ quả riêng, không được thiết kế theo kiểu lựa chọn nào cũng cộng điểm — có lựa chọn tốt, tương đối tốt, trung tính/nguy hiểm, và có thể gây hậu quả nghiêm trọng." Một số lựa chọn đang THIẾU hệ quả hoặc TRÙNG hệ quả với lựa chọn khác trong cùng cảnh.

# BỐI CẢNH
${compactGamePlanSummary(gamePlan)}
Tập: "${episode.title}" — ${episode.summary || ""}

# CHỈ SỐ/QUAN HỆ/CỜ/VẬT PHẨM ĐÃ CÓ (chỉ dùng đúng tên này, KHÔNG tự đặt tên mới)
${registryBlock(registry)}

# CÁC CẢNH CẦN VÁ HỆ QUẢ (chỉ trả lại đúng những choiceId được đánh dấu "ĐANG THIẾU/TRÙNG")
${scenesBlock}

Với MỖI choiceId được đánh dấu, đề xuất 1 hệ quả MỚI (cú pháp "Tên chỉ số/quan hệ +N" hoặc "-N", ví dụ "Thiện cảm nữ chính +15"), sao cho MỌI lựa chọn trong CÙNG 1 cảnh có hệ quả rõ ràng KHÁC NHAU — có mức tăng nhiều/ít, mức giảm ít/nhiều (nguy hiểm), phù hợp với văn bản lựa chọn ("text") và ý đồ cảnh. KHÔNG trả lại choiceId nào không được đánh dấu.

Trả JSON đúng schema: { fixes: [{ choiceId, effectIntent }] }.`;
}

export const BATCH_EFFECT_REPAIR_SCHEMA = {
  type: "object",
  properties: {
    fixes: {
      type: "array",
      items: {
        type: "object",
        properties: { choiceId: { type: "string" }, effectIntent: { type: "string" } },
        required: ["choiceId", "effectIntent"],
      },
    },
  },
  required: ["fixes"],
};
