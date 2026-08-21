// =============================================================================
// Xưởng Kịch Bản Game — Prompt builders
// Luồng: Ý tưởng (nguồn duy nhất) → AI phát triển bộ khung (theo lô) → duyệt
// → bản thảo 4 nhánh → kịch bản chuẩn form theo cú pháp xưởng game.
// =============================================================================
import { buildSyntaxBlock, WORKSHOPS, WORKSHOP_LIST } from "./syntaxGuide";

const WORKSHOP_DEFS_BLOCK = WORKSHOP_LIST
  .map((w) => `- ${w.label}: ${w.desc}`)
  .join("\n");

function stickToIdeaRules(idea) {
  return `# ⚠️ QUY TẮC BẮT BUỘC — BÁM SÁT Ý TƯỞNG (KHÔNG ĐƯỢC THAY THẾ)
- Ý tưởng dưới đây là NGUỒN DUY NHẤT. Bạn chỉ PHÁT TRIỂN THÊM chi tiết, KHÔNG được bịa thế giới / nhân vật / tên / cốt truyện khác.
- Mọi tên nhân vật, hệ thống, chỉ số, tuyến, twist, địa danh đã nêu trong ý tưởng PHẢI giữ nguyên chữ (VD: "Hệ Thống 404", "Lâm Tịch", "Tạ Vãn Ninh"...).
- CẤM viết sang thể loại/bối cảnh khác (cung đình, vương phi, v.v.) nếu ý tưởng không có.
- Nếu ý tưởng đã liệt kê nhân vật/tuyến/kết thúc/chỉ số/gameplay — dùng ĐÚNG chúng, chỉ bổ sung cho đủ số lượng yêu cầu.

# Ý TƯỞNG CỦA TÁC GIẢ (NGUỒN)
"""${idea?.trim() || "(TRỐNG — dừng lại, không được bịa)"}"""`;
}

// ---------- Pass 1: nhân vật + bối cảnh + nhánh + kết thúc (KHÔNG dàn cảnh) ----------
export function buildPlanCorePrompt({ workshop, title, idea, genre, branchCount, notes, directionBlock, playerName, playerDesc, mainQuest }) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  return `Bạn là BIÊN KỊCH CHÍNH xưởng kịch bản game (${w.label}). Tác giả đã giao Ý TƯỞNG đầy đủ. Nhiệm vụ: trích xuất và phát triển BỘ CỐT LÕI (nhân vật, bối cảnh, nhánh, kết thúc) — CHƯA viết dàn cảnh.

${stickToIdeaRules(idea)}

# XƯỞNG: ${w.label} — ${w.desc}
# Tên game: ${title || "(theo ý tưởng)"}
# Thể loại: ${genre || "(theo ý tưởng)"}
# Số nhánh truyện: ${branchCount}

${directionBlock ? `# Định hướng thêm\n${directionBlock}` : ""}
${notes?.trim() ? `# Ghi chú thêm\n${notes.trim()}` : ""}

# NHÂN VẬT NHẬP VAI (nếu ý tưởng đã có tên thì dùng đúng tên đó)
- Tên gợi ý từ form: ${playerName?.trim() || "(đọc trong ý tưởng — VD Lâm Tịch)"}
- Lai lịch form: ${playerDesc?.trim() || "(đọc trong ý tưởng)"}
- Nhiệm vụ chính form: ${mainQuest?.trim() || "(đọc trong ý tưởng — nhiệm vụ hệ thống / mục tiêu chính)"}

# YÊU CẦU JSON
- characters: danh sách đầy đủ. Phần tử ĐẦU TIÊN = nhân vật người chơi nhập vai (role: "Nhân vật nhập vai / Player"), dùng đúng tên trong ý tưởng. Tiếp theo: từng tuyến nữ chính/NPC/phản diện/hệ thống (nếu có) — đúng tên + tính cách + động cơ + mối quan hệ với player.
- settings: địa điểm / không gian quan trọng trong ý tưởng (có thể suy ra thêm nếu ý tưởng không liệt kê, nhưng phải khớp bối cảnh).
- branches: đúng ${branchCount} nhánh — nếu ý tưởng có 4 tuyến nhân vật thì mỗi nhánh = 1 tuyến đó; mô tả ngắn storyline của nhánh.
- endings: ≥${branchCount} kết thúc (TRUE_END/GOOD_END/NORMAL_END/BAD_END) khớp ý tưởng (VD ending từng tuyến + True Ending).
- player_name, player_desc, main_quest: trích từ ý tưởng (bắt buộc điền, không để trống).
- notes: tóm tắt cơ chế gameplay (chỉ số, nhiệm vụ hệ thống, twist...) đã có trong ý tưởng.

Trả JSON đúng schema.`;
}

export const PLAN_CORE_SCHEMA = {
  type: "object",
  properties: {
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          personality: { type: "string" },
          motive: { type: "string" },
        },
        required: ["name", "role"],
      },
    },
    settings: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, description: { type: "string" } },
        required: ["name"],
      },
    },
    endings: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, type: { type: "string" }, description: { type: "string" } },
        required: ["name"],
      },
    },
    branches: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, description: { type: "string" } },
        required: ["name"],
      },
    },
    player_name: { type: "string" },
    player_desc: { type: "string" },
    main_quest: { type: "string" },
    notes: { type: "string" },
  },
  required: ["characters", "settings", "endings", "branches", "player_name", "main_quest"],
};

// ---------- Pass 2+: dàn cảnh theo lô (mỗi lô ~8–10 cảnh) ----------
export function buildPlanScenesChunkPrompt({
  workshop,
  idea,
  coreBlock,
  branchCount,
  choicesPerScene,
  startOrder,
  count,
  totalScenes,
  prevScenesSummary,
}) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  const endOrder = Math.min(startOrder + count - 1, totalScenes);
  return `Bạn là BIÊN KỊCH CHÍNH xưởng kịch bản game (${w.label}). Đang dựng DÀN CẢNH theo lô — chỉ viết các cảnh từ số ${startOrder} đến ${endOrder} (tổng game ${totalScenes} cảnh).

${stickToIdeaRules(idea)}

# BỘ CỐT LÕI ĐÃ CHỐT (bám sát 100%)
${coreBlock}

# TIẾN ĐỘ DÀN CẢNH
- Viết đúng các cảnh số: ${startOrder} … ${endOrder} (đủ ${endOrder - startOrder + 1} cảnh, không thiếu không thừa).
- Mỗi cảnh ${choicesPerScene} lựa chọn (text + effect + target).
- ${branchCount} nhánh truyện: đánh dấu is_branch_point=true + branch_index (0..${branchCount - 1}) tại các điểm rẽ quan trọng (ưu tiên rải đều theo tiến độ game, khớp từng tuyến nhân vật trong bộ cốt lõi).

${prevScenesSummary?.trim() ? `# CÁC CẢNH TRƯỚC ĐÃ CÓ (nối mạch, không lặp)\n${prevScenesSummary.trim()}` : "(đây là lô cảnh đầu)"}

# YÊU CẦU MỖI CẢNH
- title, description (nêu rõ player làm gì + đẩy mạch nhiệm vụ chính / hệ thống nếu có), location, characters (tên đúng), foreshadow, choices[].
- description 1–3 câu súc tích, bám ý tưởng (nhiệm vụ hệ thống, chỉ số Tình cảm/Tin tưởng/Nghi ngờ, twist vòng lặp... nếu ý tưởng có).
- choices.target: "cảnh N" hoặc "kết thúc <tên>" hợp lý.

Trả JSON: { scenes: [ ... ] } đúng số lượng.`;
}

export const PLAN_SCENES_CHUNK_SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          location: { type: "string" },
          characters: { type: "string" },
          foreshadow: { type: "string" },
          choices: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                effect: { type: "string" },
                target: { type: "string" },
              },
              required: ["text"],
            },
          },
          is_branch_point: { type: "boolean" },
          branch_index: { type: "number" },
        },
        required: ["title", "description"],
      },
    },
  },
  required: ["scenes"],
};

/** @deprecated dùng buildPlanCorePrompt + buildPlanScenesChunkPrompt */
export function buildPlanPrompt(args) {
  return buildPlanCorePrompt(args);
}

export const PLAN_SCHEMA = PLAN_CORE_SCHEMA;

export function formatCoreBlock(core) {
  if (!core) return "(trống)";
  const lines = [];
  lines.push(`Player: ${core.player_name || "?"} — ${core.player_desc || ""}`);
  lines.push(`Main quest: ${core.main_quest || "?"}`);
  if (core.characters?.length) {
    lines.push("## Nhân vật");
    for (const c of core.characters) {
      lines.push(`- ${c.name} (${c.role || "?"}): ${c.personality || ""} · ${c.motive || ""}`);
    }
  }
  if (core.settings?.length) {
    lines.push("## Bối cảnh");
    for (const s of core.settings) lines.push(`- ${s.name}: ${s.description || ""}`);
  }
  if (core.branches?.length) {
    lines.push("## Nhánh");
    core.branches.forEach((b, i) => lines.push(`- [${i}] ${b.name}: ${b.description || ""}`));
  }
  if (core.endings?.length) {
    lines.push("## Kết thúc");
    for (const e of core.endings) lines.push(`- ${e.name} [${e.type || "NORMAL_END"}]: ${e.description || ""}`);
  }
  if (core.notes) lines.push(`## Ghi chú gameplay\n${core.notes}`);
  return lines.join("\n");
}

// ---------- Bản thảo 1 nhánh (chia lô nếu nhiều cảnh) ----------
export function buildBranchDraftPrompt({ workshop, title, idea, planBlock, branch, scenes, playerName, playerDesc, mainQuest }) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  const sceneBlock = scenes
    .map(
      (s) =>
        `- [cảnh ${s.scene_order}] ${s.title}\n  Mô tả: ${s.description}\n  Địa điểm: ${s.location || "-"}\n  NV: ${s.characters || "-"}\n  Lựa chọn: ${(s.choices || []).map((c) => `"${c.text}"`).join(" | ") || "-"}`
    )
    .join("\n");
  return `Bạn là BIÊN KỊCH xưởng (${w.label}). Viết BẢN THẢO VĂN XUÔI cho NHÁNH "${branch.name}" của "${title}" — để tác giả đọc thử, KHÔNG phải cú pháp kịch bản game.

${stickToIdeaRules(idea)}

# Player: ${playerName || "?"} — ${playerDesc || ""}
# Main quest: ${mainQuest || "?"}

# BỘ KHUNG
${planBlock}

# NHÁNH: ${branch.name} — ${branch.description || ""}

# CÁC CẢNH CỦA NHÁNH
${sceneBlock}

# YÊU CẦU
- Đủ từng cảnh theo scene_order; mỗi draft 150–280 từ; player là trung tâm; bám tên/tuyến/hệ thống trong ý tưởng.
- Mạch liền mạch giữa các cảnh.

Trả JSON: { scenes: [{ scene_order, title, draft }] }.`;
}

export const BRANCH_DRAFT_SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          scene_order: { type: "number" },
          title: { type: "string" },
          draft: { type: "string" },
        },
        required: ["scene_order", "draft"],
      },
    },
  },
  required: ["scenes"],
};

// ---------- Kịch bản chuẩn form 1 cảnh ----------
export function buildSceneScriptPrompt({
  workshop,
  title,
  idea,
  planBlock,
  branch,
  scene,
  prevScript,
  nextScene,
  isFirst,
  isLast,
  totalScenes,
  playerName,
  playerDesc,
  mainQuest,
}) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  const sceneNumber = scene.scene_order;
  const choicesBlock = (scene.choices || [])
    .map((c) => `- "${c.text}"${c.effect ? ` → ${c.effect}` : ""}${c.target ? ` → ${c.target}` : ""}`)
    .join("\n");
  return `Bạn là BIÊN KỊCH CHÍNH (${w.label}). Viết PHÂN CẢNH KỊCH BẢN GAME hoàn chỉnh — đúng cú pháp xưởng. Không meta.

${buildSyntaxBlock(workshop)}

${stickToIdeaRules(idea)}

# GAME: ${title}
# Player: ${playerName || "?"} — ${playerDesc || ""}
# Main quest: ${mainQuest || "?"}
# NHÁNH: ${branch.name}

# BỘ KHUNG
${planBlock}

# CẢNH ${sceneNumber}/${totalScenes}: ${scene.title}
- Sự kiện: ${scene.description}
- Địa điểm: ${scene.location || "?"}
- NV: ${scene.characters || "?"}
- Phục bút: ${scene.foreshadow || "-"}
- Lựa chọn:
${choicesBlock || "- (tiếp tục)"}

${isFirst ? `BẮT BUỘC mở bằng ## GIỚI THIỆU (player ${playerName || ""} + nhiệm vụ ${mainQuest || ""}) rồi ## CẢNH ${sceneNumber} — ${scene.title}.` : ""}
${!isFirst && prevScript ? `# Cảnh trước (nối mạch)\n"""${prevScript.slice(-1200)}"""` : ""}
${isLast ? "CẢNH CUỐI: lựa chọn dẫn ## KẾT THÚC <nhãn> — <Tên> [LOẠI] viết kèm trong bài trả lời." : `Cảnh kế: ## CẢNH ${nextScene?.scene_order} — ${nextScene?.title || ""}. Dùng → Đến cảnh ${nextScene?.scene_order} khi cần.`}

Chỉ trả nội dung kịch bản phân cảnh.`;
}

export function buildSceneScriptRevisionPrompt({ workshop, title, planBlock, branch, scene, currentContent, feedback, idea }) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  return `Bạn là BIÊN KỊCH CHÍNH (${w.label}). Sửa TOÀN BỘ phân cảnh theo góp ý. Không meta.

${buildSyntaxBlock(workshop)}
${idea?.trim() ? stickToIdeaRules(idea) : ""}

# GAME: ${title} — NHÁNH ${branch?.name || "?"}
# CẢNH: ${scene?.title || "?"} — ${scene?.description || ""}

# KỊCH BẢN HIỆN TẠI
"""${currentContent}"""

# GÓP Ý
${feedback}

Giữ cú pháp xưởng ${w.label}. Chỉ trả kịch bản.`;
}
