// =============================================================================
// Xưởng Kịch Bản Game (luồng mới) — Prompt builders
// Wizard: Ý tưởng → AI gợi ý bộ khung (nhân vật/bối cảnh/dàn cảnh/lựa chọn/
// kết thúc) → tác giả duyệt/chỉnh → AI viết 4 nhánh truyện (bản thảo văn xuôi)
// → chốt → AI viết kịch bản chuẩn form theo đúng cú pháp xưởng game → xuất.
// =============================================================================
import { buildSyntaxBlock, WORKSHOPS, WORKSHOP_LIST } from "./syntaxGuide";

const WORKSHOP_DEFS_BLOCK = WORKSHOP_LIST
  .map((w) => `- ${w.label}: ${w.desc}`)
  .join("\n");

// ---------- Bước 1: Gợi ý bộ khung (dàn tổng) từ ý tưởng ----------
export function buildPlanPrompt({ workshop, title, idea, genre, sceneCount, choicesPerScene, branchCount, notes, directionBlock }) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  return `Bạn là BIÊN KỊCH CHÍNH của một xưởng viết kịch bản game. Game master giao một ý tưởng và cần bạn dựng TOÀN BỘ BỘ KHUNG (dàn tổng) cho game ${w.label} — trước khi viết kịch bản thật.

# XƯỞNG GAME ĐANG CHỌN
${WORKSHOP_DEFS_BLOCK}

# XƯỞNG ĐANG DÙNG CHO DỰ ÁN NÀY: ${w.label}
${w.desc}

# THÔNG SỐ
- Số cảnh (dàn tổng): ${sceneCount}
- Số lựa chọn mỗi cảnh: ${choicesPerScene}
- Số nhánh truyện (đáp án chính): ${branchCount}

${directionBlock ? `# ĐỊNH HƯỚNG CỦA TÁC GIẢ\n${directionBlock}` : ""}

# Ý TƯỞNG CỦA TÁC GIẢ
"""${idea || "(trống — hãy dựng khung chuẩn cho xưởng này, có thể chỉnh sau)"}"""

${notes?.trim() ? `# GHI CHÚ THÊM\n${notes.trim()}` : ""}

# YÊU CẦU — trả về bộ khung đầy đủ để tác giả duyệt, gồm:
- characters: danh sách nhân vật (tên, vai trò, tính cách, động cơ) — gồm nhân vật chính, party/đồng hành, NPC quan trọng, phản diện.
- settings: bối cảnh / địa điểm quan trọng (tên, mô tả, công dụng kể chuyện).
- scenes: DÀN ${sceneCount} CẢNH theo đúng thứ tự — mỗi cảnh gồm title, description (sự kiện diễn ra), location, characters (nhân vật tham gia), foreshadow (phục bút cài/hồi đáp nếu có), choices (mảng ${choicesPerScene} lựa chọn — mỗi lựa chọn: text, effect (mô tả hiệu ứng cờ/chỉ số/vật phẩm), target (đến cảnh số mấy, hoặc kết thúc)). Đánh dấu is_branch_point=true và branch_index (0..${branchCount - 1}) cho ${branchCount} cảnh quan trọng nhất — mỗi cảnh là điểm rẽ tương ứng 1 nhánh truyện, tại đó lựa chọn dẫn vào nhánh đó.
- endings: danh sách kết thúc dự kiến (tên, loại TRUE_END/GOOD_END/NORMAL_END/BAD_END, mô tả) — ít nhất ${branchCount} kết thúc.
- branches: danh sách ${branchCount} nhánh truyện (tên, mô tả ngắn) — mỗi nhánh tương ứng 1 đáp án/lựa chọn chính.
- notes: ghi chú tổng thể cho biên kịch (nếu cần).

Trả JSON đúng schema.`;
}

export const PLAN_SCHEMA = {
  type: "object",
  properties: {
    characters: {
      type: "array",
      items: { type: "object", properties: { name: { type: "string" }, role: { type: "string" }, personality: { type: "string" }, motive: { type: "string" } }, required: ["name"] },
    },
    settings: {
      type: "array",
      items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" } }, required: ["name"] },
    },
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
            items: { type: "object", properties: { text: { type: "string" }, effect: { type: "string" }, target: { type: "string" } }, required: ["text"] },
          },
          is_branch_point: { type: "boolean" },
          branch_index: { type: "number" },
        },
        required: ["title", "description"],
      },
    },
    endings: {
      type: "array",
      items: { type: "object", properties: { name: { type: "string" }, type: { type: "string" }, description: { type: "string" } }, required: ["name"] },
    },
    branches: {
      type: "array",
      items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" } }, required: ["name"] },
    },
    notes: { type: "string" },
  },
  required: ["characters", "settings", "scenes", "endings", "branches"],
};

// ---------- Bước 2: Viết BẢN THẢO VĂN XUÔI cho toàn bộ cảnh của 1 nhánh ----------
// Dùng JSON schema để lấy nhiều cảnh cùng lúc. Trả mảng theo thứ tự scene_order.
export function buildBranchDraftPrompt({ workshop, title, idea, genre, planBlock, branch, scenes }) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  const sceneBlock = scenes
    .map((s) => `- [cảnh ${s.scene_order}] ${s.title}\n  Mô tả: ${s.description}\n  Địa điểm: ${s.location || "-"}\n  NV: ${s.characters || "-"}\n  Phục bút: ${s.foreshadow || "-"}\n  Lựa chọn: ${(s.choices || []).map((c) => `"${c.text}"${c.effect ? ` (${c.effect})` : ""}`).join(" | ") || "-"}`)
    .join("\n");
  return `Bạn là BIÊN KỊCH của xưởng kịch bản game (${w.label}). Nhiệm vụ: viết BẢN THẢO VĂN XUÔI (bản thảo truyện để tác giả đọc thử) cho NHÁNH "${branch.name}" của game "${title}". Đây là bản thảo kể chuyện mạch lạc, KHÔNG phải kịch bản game có cú pháp — chỉ để tác giả duyệt nội dung.

# XƯỞNG: ${w.label} — ${w.desc}

# Ý TƯỞNG GỐC
"""${idea || "(trống)"}"""

# BỘ KHUNG ĐÃ DUYỆT
${planBlock}

# NHÁNH: ${branch.name} — ${branch.description || ""}

# CÁC CẢNH CỦA NHÁNH NÀY (theo thứ tự)
${sceneBlock}

# YÊU CẦU
- Viết bản thảo văn xuôi cho ĐÚNG từng cảnh theo đúng thứ tự đã cho, bám sát mô tả, nhân vật, phục bút và các lựa chọn.
- Mạch chuyện LIỀN MẠCH: mỗi cảnh nối tiếp cảnh trước một cách tự nhiên.
- Nhân vật hành động/đối thoại ĐÚNG tính cách và động cơ; thể hiện phục bút khi cần.
- Mỗi cảnh trả về 1 object: scene_order (số nguyên đúng thứ tự), title, draft (văn xuôi hoàn chỉnh của cảnh — khoảng 200-350 từ, kể rõ diễn biến, lời thoại trong ngoặc kép).
- Trả về ĐỦ TẤT CẢ các cảnh của nhánh, không thiếu, theo đúng thứ tự.

Trả JSON đúng schema.`;
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

// ---------- Bước 3: Viết KỊCH BẢN CHUẨN FORM cho 1 cảnh (theo cú pháp xưởng) ----------
// Mỗi cảnh viết riêng để kiểm soát chất lượng; trả văn bản thuần đúng cú pháp.
export function buildSceneScriptPrompt({ workshop, title, idea, planBlock, branch, scene, prevScript, nextScene, isFirst, isLast, totalScenes }) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  const sceneNumber = scene.scene_order;
  const choicesBlock = (scene.choices || [])
    .map((c) => `- "${c.text}"${c.effect ? ` → ${c.effect}` : ""}${c.target ? ` → ${c.target}` : ""}`)
    .join("\n");
  return `Bạn là BIÊN KỊCH CHÍNH của xưởng kịch bản game (${w.label}). Hãy viết PHÂN CẢNH KỊCH BẢN GAME HOÀN CHỈNH cho cảnh số ${sceneNumber} "${scene.title}" — đúng cú pháp kịch bản của XƯỞNG ${w.label}. TUYỆT ĐỐI không giải thích meta, không viết văn xuôi truyện dài dòng.

${buildSyntaxBlock(workshop)}

# GAME: ${title} — ${w.label}
# Ý TƯỞNG GỐC
"""${idea || "(trống)"}"""

# BỘ KHUNG ĐÃ DUYỆT
${planBlock}

# NHÁNH: ${branch.name} — ${branch.description || ""}

# PHÂN CẢNH NÀY (cảnh ${sceneNumber}/${totalScenes})
- Tiêu đề: ${scene.title}
- Mô tả sự kiện: ${scene.description}
- Địa điểm: ${scene.location || "(tự chọn hợp lý)"}
- Nhân vật: ${scene.characters || "(tự chọn hợp lý)"}
- Phục bút: ${scene.foreshadow || "(không có)"}
- Lựa chọn cần đưa vào cuối cảnh:
${choicesBlock || "- (cảnh này không bắt buộc rẽ nhánh, có thể kết bằng chỉ dẫn chuyển cảnh)"}

${isFirst ? "(ĐÂY LÀ CẢNH ĐẦU TIÊN của kịch bản nhánh — có thể thêm khối '## GIỚI THIỆU' mở đầu, rồi viết '## CẢNH ${sceneNumber} — ${scene.title}'.)" : ""}
${!isFirst && prevScript ? `# CẢNH TRƯỚC (phải NỐI MẠCH — cảnh này mở đầu phải nhắc lại tình huống vừa xảy ra ở cuối cảnh trước)\n"""${prevScript.slice(-1500)}"""` : ""}

${isLast ? "(ĐÂY LÀ CẢNH CUỐI của nhánh: các lựa chọn PHẢI dẫn tới khối '## KẾT THÚC <nhãn> — <Tên> [LOẠI]' mà bạn tạo ngay trong bài trả lời này, viết kèm văn bản kết thúc.)" : `(Cảnh kế tiếp trong nhánh này là '## CẢNH ${nextScene?.scene_order} — ${nextScene?.title || ""}'. Nếu cảnh có lựa chọn rẽ tiếp theo, dùng '→ Đến cảnh ${nextScene?.scene_order}' trỏ tới cảnh đó.)`}

# YÊU CẦU
- Viết ĐÚNG định dạng: "## CẢNH ${sceneNumber} — <Tên cảnh>" (hoặc nhãn khác phù hợp), văn bản diễn biến, rồi khối lựa chọn "**A —**", "**B —"..., mỗi lựa chọn kèm hiệu ứng "→ ..." và "→ Đến cảnh ..." / "→ Kết thúc ...".
- TUYỆT ĐỐI chỉ trỏ "→ Đến cảnh N" tới các cảnh THẬT SỰ tồn tại trong kịch bản nhánh này. Cảnh kế hợp lệ là ${nextScene ? `"## CẢNH ${nextScene.scene_order}"` : "(không có — đây là cảnh cuối)"}.
- Chỉ dùng cờ/chỉ số/vật phẩm hợp lý, đảm bảo logic (vật phẩm/cờ dùng phải được tạo ở phía trước trong nhánh).
- Nhân vật, địa điểm, phục bút bám sát bộ khung đã duyệt.
Chỉ trả nội dung kịch bản phân cảnh (có thể kèm khối KẾT THÚC nếu là cảnh cuối), không lời dẫn ngoài.`;
}

// ---------- Bước 3b: Sửa kịch bản 1 cảnh theo góp ý ----------
export function buildSceneScriptRevisionPrompt({ workshop, title, planBlock, branch, scene, currentContent, feedback }) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  return `Bạn là BIÊN KỊCH CHÍNH của xưởng kịch bản game (${w.label}). Game master vừa xem kịch bản cảnh "${scene.title}" và muốn SỬA theo góp ý. Nhiệm vụ: viết lại TOÀN BỘ phân cảnh, GIỮ phần hay, sửa đúng các điểm được góp ý. TUYỆT ĐỐI không giải thích meta — chỉ trả kịch bản hoàn chỉnh.

${buildSyntaxBlock(workshop)}

# GAME: ${title} — ${w.label}
# NHÁNH: ${branch.name} — ${branch.description || ""}
# PHÂN CẢNH: ${scene.title} — ${scene.description}

# KỊCH BẢN HIỆN TẠI
"""${currentContent}"""

# GÓP Ý CỦA TÁC GIẢ (bám sát từng ý)
${feedback}

# YÊU CẦU
- Sửa đúng từng điểm góp ý, phần khác giữ nguyên chất lượng.
- Giữ TUYỆT ĐỐI cú pháp kịch bản của XƯỞNG ${w.label} (khối CẢNH, lựa chọn "**A —**", hiệu ứng "→ ...", "→ Đến cảnh"/"→ Kết thúc", khối "## KẾT THÚC").
- Không làm mâu thuẫn với bộ khung đã duyệt.
Chỉ trả nội dung kịch bản phân cảnh, không lời dẫn ngoài.`;
}
