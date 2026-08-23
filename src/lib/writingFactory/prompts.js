// =============================================================================
// Xưởng Viết Truyện — Prompt builders
// Mô hình "xưởng" kiểu tác giả web-novel Trung Quốc: một đội ngũ AI đóng vai
// chuyên môn cùng quản lý một bộ tài liệu sống (bible) cho mỗi bộ truyện.
//   - Tổng biên tập  : giữ tông/định hướng tổng thể
//   - Thiết lập sư   : thế giới quan
//   - Quản lý nhân vật: hồ sơ + trạng thái
//   - Quan hệ quản lý : ma trận quan hệ & xưng hô
//   - Đại cương sư   : cấu trúc arc/chương
//   - Phục bút quản lý: sổ phục bút (伏笔)
//   - Thời tuyến     : timeline
//   - Biên tập nhất quán: soát mâu thuẫn với bible
// Các doc chính được lưu ở bảng writer_docs (doc_key) và luôn được nạp làm
// "trí nhớ dài hạn" khi viết chương / rollup.
// =============================================================================

import { genreStyleLine } from "@/lib/genreStyle";

// doc_key → tên file + tiêu đề hiển thị (khớp cây thư mục tác giả mô tả)
export const DOC_DEFS = [
  { key: "quy_tac_viet", file: "00_QUY_TAC_VIET.md", title: "Quy Tắc Viết", role: "Tổng biên tập", icon: "rule" },
  { key: "the_gioi", file: "01_THE_GIOI.md", title: "Thế Giới Quan", role: "Thiết lập sư", icon: "world" },
  { key: "nhan_vat", file: "02_NHAN_VAT.md", title: "Nhân Vật", role: "Quản lý nhân vật", icon: "user" },
  { key: "quan_he", file: "03_QUAN_HE.md", title: "Quan Hệ & Xưng Hô", role: "Quan hệ quản lý", icon: "network" },
  { key: "dai_cuong", file: "04_DAI_CUONG.md", title: "Đại Cương", role: "Đại cương sư", icon: "outline" },
  { key: "fuc_but", file: "05_FUC_BUT.md", title: "Phục Bút", role: "Phục bút quản lý", icon: "flag" },
  { key: "timeline", file: "06_TIMELINE.md", title: "Timeline", role: "Thời tuyến", icon: "clock" },
  { key: "trang_thai_nhan_vat", file: "07_TRANG_THAI_NHAN_VAT.md", title: "Trạng Thái Nhân Vật", role: "Quản lý nhân vật", icon: "user" },
  { key: "tom_tat_hien_tai", file: "summaries/tom_tat_hien_tai.md", title: "Tóm Tắt Hiện Tại", role: "Biên tập nhất quán", icon: "summary" },
];

export const DOC_DEFS_BY_KEY = Object.fromEntries(DOC_DEFS.map((d) => [d.key, d]));

// ---------- Team AI: các vai trò trong xưởng ----------
export const TEAM_ROLES = [
  {
    key: "tong_bien_tap",
    name: "Architect",
    emoji: "🎬",
    desc: "Dựng Master Plan, lời hứa truyện, theme và đích kết thúc.",
    system: `Bạn là TỔNG BIÊN TẬP của một xưởng viết tiểu thuyết mạng. Bạn chịu trách nhiệm giữ đúng tông truyện, nhịp độ kể chuyện và định hướng tác giả. Bạn đánh giá thẳng thắn chất lượng bản thảo, đề xuất cải thiện về kịch tính, cảm xúc, nhịp, và kiểm tra cấu trúc tổng thể. Luôn trả lời bằng tiếng Việt, cụ thể, không lặp lại ngữ cảnh.`,
  },
  {
    key: "thiet_lap_su",
    name: "Planner",
    emoji: "🌍",
    desc: "Lập Volume/Arc, rolling Chapter Map, Contract và Scene Plan.",
    system: `Bạn là THIẾT LẬP SƯ chuyên xây dựng và bảo toàn THẾ GIỚI QUAN của tiểu thuyết: bối cảnh địa lý, xã hội, văn hoá, chính trị, lực lượng, luật lệ, phép thuật/năng lực, thuật ngữ riêng. Bạn giữ cho thế giới luôn nhất quán với bộ tài liệu bible, phát hiện chỗ viết chệch và đề xuất bổ sung hợp lý. Luôn trả lời bằng tiếng Việt, cụ thể, bám tài liệu.`,
  },
  {
    key: "nhan_vat_quan_ly",
    name: "Writer",
    emoji: "👤",
    desc: "Viết prose theo contract, scene plan và content budget.",
    system: `Bạn là QUẢN LÝ NHÂN VẬT của một xưởng viết tiểu thuyết. Bạn nắm rõ hồ sơ, tính cách, mục tiêu, bí mật, mâu thuẫn nội tâm, giọng văn/xưng hô của từng nhân vật. Bạn đảm bảo nhân vật hành động và nói năng ĐÚNG tính cách mọi lúc, phát hiện chỗ "nhân vật lạc tính cách" và gợi ý cách sửa. Luôn trả lời bằng tiếng Việt, cụ thể.`,
  },
  {
    key: "phuc_but_quan_ly",
    name: "Continuity Editor",
    emoji: "🚩",
    desc: "Hard gate timeline, knowledge, state, open plots và foreshadow.",
    system: `Bạn là PHỤC BÚT QUẢN LÝ — chuyên gia quản lý 伏笔 (cài đặt phục bút và hồi đáp) trong tiểu thuyết dài kỳ. Bạn duy trì sổ phục bút: mỗi phục bút có trạng thái (chưa cài / đã cài / đang treo / đã hồi đáp), thời điểm cài, dự kiến hồi đáp. Bạn gợi ý cài phục bút mới ở vị trí tự nhiên, nhắc khi nào cần hồi đáp để không quên, và đánh giá mức độ hợp lý. Luôn trả lời bằng tiếng Việt, cụ thể.`,
  },
  {
    key: "bien_tap_nhat_quan",
    name: "Quality",
    emoji: "🔍",
    desc: "Chấm logic, pacing, repetition, description bloat và hook.",
    system: `Bạn là BIÊN TẬP NHẤT QUÁN của một xưởng viết tiểu thuyết. Nhiệm vụ của bạn là soát MÂU THUẪN giữa bản thảo chương và bộ tài liệu bible (quy tắc, thế giới, nhân vật, quan hệ, timeline, phục bút). Chỉ báo lỗi THẬT SỰ (đổi ngoại hình cố định, sai xưng hô, nhắc sự kiện chưa xảy ra, hành động trái tính cách, bỏ sót phục bút cần hồi đáp...). Mỗi lỗi nêu rõ mức độ nghiêm trọng, vị trí, và cách sửa đề xuất. Luôn trả lời bằng tiếng Việt, không báo lỗi mơ hồ.`,
  },
  {
    key: "tro_ly_tac_gia",
    name: "Canon Keeper",
    emoji: "✍️",
    desc: "Chỉ cập nhật canon/current state sau khi chương quality-pass.",
    system: `Bạn là TRỢ LÝ TÁC GIẢ toàn diện của một xưởng viết tiểu thuyết. Tác giả có thể yêu cầu TỰ DO bất cứ điều gì: brainstorm ý tưởng, viết thử đoạn văn, gợi ý tình tiết, kiểm tra logic, mở rộng hoặc rút gọn bản thảo, chuyển thể văn phong... Bạn luôn dựa vào bộ tài liệu bible để trả lời chính xác, cụ thể và hữu ích. Luôn trả lời bằng tiếng Việt.`,
  },
];

export const TEAM_ROLE_BY_KEY = Object.fromEntries(TEAM_ROLES.map((r) => [r.key, r]));

// ---------- Bộ khung chung: dựng block "toàn bộ bible" để nhồi vào prompt ----------
export function buildBibleBlock(docsByKey) {
  const order = ["quy_tac_viet", "the_gioi", "nhan_vat", "quan_he", "dai_cuong", "fuc_but", "timeline", "trang_thai_nhan_vat", "tom_tat_hien_tai"];
  const parts = [];
  for (const key of order) {
    const def = DOC_DEFS_BY_KEY[key];
    const doc = docsByKey?.[key];
    const content = doc?.content?.trim();
    if (!content) continue;
    parts.push(`## ${def.title} (${def.file})\n${content}`);
  }
  if (!parts.length) return "(Bộ tài liệu bible đang trống — hãy bấm nút 'Khởi tạo Xưởng' hoặc soạn nội dung từng tài liệu.)";
  return parts.join("\n\n");
}

// ---------- Khởi tạo xưởng: sinh toàn bộ tài liệu từ ý tưởng ----------
export function buildFactoryBootstrapPrompt({ idea, genre, directionBlock, existingBible }) {
  return `Bạn là TỔNG BIÊN TẬP điều hành một XƯỞNG VIẾT TRUYỆN chuyên nghiệp (mô hình web-novel Trung Quốc). Tác giả mới giao một ý tưởng và cần bạn khởi tạo TOÀN BỘ bộ tài liệu làm việc cho xưởng. ${genreStyleLine(genre)}

# Định hướng bộ truyện
${directionBlock || "(chưa có)"}

# Ý tưởng / bối cảnh của tác giả
"""${idea || "(trống)"}"""

${existingBible?.trim() ? `# Dữ liệu hiện có trong sổ tay thế giới (bổ sung, giữ nhất quán)\n${existingBible.trim()}` : ""}

Hãy trả về TOÀN BỘ 8 tài liệu, MỖI tài liệu là một chuỗi Markdown hoàn chỉnh (đầy đủ tiêu đề #, gạch đầu dòng, bảng khi cần). Yêu cầu:
- 00_QUY_TAC_VIET: quy tắc viết — tông giọng, POV, thì/cách kể, từ cấm/không dùng, mật độ miêu tả, cách xưng hô, nguyên tắc về nhịp chương, giới hạn (VD: không tiết lộ trước bí mật nhân vật).
- 01_THE_GIOI: thế giới quan — bối cảnh, địa lý, xã hội/chính trị/văn hoá, luật lệ, phép thuật/năng lệ/đẳng cấp, thuật ngữ riêng.
- 02_NHAN_VAT: hồ sơ nhân vật — mỗi nhân vật 1 mục đầy đủ (thân phận, tuổi, ngoại hình CỐ ĐỊNH, tính cách, mục tiêu, bí mật, mâu thuẫn nội tâm, giọng văn/xưng hô, quan hệ, sự kiện định hình).
- 03_QUAN_HE: ma trận quan hệ & xưng hô giữa các nhân vật (ai với ai, kiểu quan hệ, thái độ hiện tại, xưng hô đúng giọng).
- 04_DAI_CUONG: MASTER PLAN đa tầng — premise, thematic question, lời hứa với độc giả, ending đích, trục biến đổi nhân vật; Volume/Arc plan (mục tiêu, xung đột, midpoint, climax, hệ quả, phạm vi chương); và ROLLING CHAPTER MAP chi tiết cho 5–10 chương gần nhất. Mỗi chương có promise, tiến triển plot, state change, knowledge/reveal, phục bút và hook. Không khóa vào một thể loại.
- 05_FUC_BUT: sổ phục bút — danh sách phục bút nên cài (mô tả, thời điểm cài, dự kiến hồi đáp, trạng thái "đang treo").
- 06_TIMELINE: dòng thời gian các sự kiện đã xác lập (sự kiện, thời điểm, nơi, nhân vật liên quan).
- 07_TRANG_THAI_NHAN_VAT: trạng thái sống của từng nhân vật NGAY BÂY GIỜ — địa điểm hiện tại, hành động đang làm, tâm lý, vật phẩm, bí mật đã biết, thương tích/địa vị mới nhất (dùng Markdown, mỗi nhân vật 1 mục '### Tên').
- summaries/tom_tat_hien_tai.md: tóm tắt hiện tại — trạng thái câu chuyện NGAY BÂY GIỜ (nhân vật đang ở đâu, đang làm gì, xung đột đang leo thang thế nào) để viết chương tiếp theo không lệch.

Trả JSON đúng schema: { docs: { quy_tac_viet: string, the_gioi: string, nhan_vat: string, quan_he: string, dai_cuong: string, fuc_but: string, timeline: string, tom_tat_hien_tai: string } }.`;
}

export const FACTORY_BOOTSTRAP_SCHEMA = {
  type: "object",
  properties: {
    docs: {
      type: "object",
      properties: Object.fromEntries(
        DOC_DEFS.map((d) => [d.key, { type: "string" }])
      ),
      required: DOC_DEFS.map((d) => d.key),
    },
  },
  required: ["docs"],
};

// ---------- Sinh/tái sinh MỘT tài liệu ----------
export function buildDocGenPrompt({ key, genre, idea, existingBible, currentDoc, note }) {
  const def = DOC_DEFS_BY_KEY[key];
  const label = `${def.file} (${def.title})`;
  const specifics = {
    quy_tac_viet:
      "Soạn quy tắc viết: tông giọng, POV, cách kể, từ cấm, mật độ miêu tả, xưng hô, nhịp chương, giới hạn tiết lộ. Càng cụ thể càng tốt, dùng Markdown có tiêu đề + gạch đầu dòng.",
    the_gioi:
      "Soạn thế giới quan: bối cảnh, địa lý, xã hội/chính trị/văn hoá, luật lệ, phép thuật/năng lực/đẳng cấp, thuật ngữ riêng. Bám sát ý tưởng gốc, không tự ý thêm đặc trưng thể loại khác.",
    nhan_vat:
      "Soạn hồ sơ nhân vật: mỗi nhân vật một mục đầy đủ (thân phận, tuổi, ngoại hình CỐ ĐỊNH, tính cách, mục tiêu, bí mật, mâu thuẫn nội tâm, giọng văn/xưng hô, quan hệ, sự kiện định hình).",
    quan_he:
      "Soạn ma trận quan hệ & xưng hô: từng cặp nhân vật — kiểu quan hệ, thái độ hiện tại, xưng hô đúng giọng từng người.",
    dai_cuong:
      "Soạn MASTER PLAN: premise/theme/reader promise/ending/trục biến đổi; Volume → Arc plan với midpoint/climax/hệ quả; rolling Chapter Map chi tiết 5–10 chương kế tiếp (promise, plot, state, knowledge, relationship, foreshadow, hook). Dùng được cho mọi thể loại.",
    fuc_but:
      "Soạn sổ phục bút: mỗi phục bút có mô tả, thời điểm cài, dự kiến hồi đáp, trạng thái (chưa cài / đã cài / đang treo / đã hồi đáp).",
    timeline:
      "Soạn timeline: các sự kiện đã xác lập theo thứ tự thời gian — sự kiện, thời điểm, nơi, nhân vật liên quan.",
    trang_thai_nhan_vat:
      "Soạn trạng thái nhân vật sống: mỗi nhân vật một mục ### Tên — địa điểm hiện tại, hành động đang làm, tâm lý, vật phẩm, bí mật đã biết, thương tích/địa vị mới nhất. Không phải hồ sơ tĩnh — là trạng thái HIỆN TẠI thay đổi theo chương.",
    tom_tat_hien_tai:
      "Soạn tóm tắt hiện tại: trạng thái câu chuyện NGAY BÂY GIỜ — nhân vật đang ở đâu, đang làm gì, xung đột đang leo thang thế nào — để viết chương tiếp theo không lệch.",
  };
  return `Bạn là ${def.role} của một xưởng viết tiểu thuyết. Hãy ${currentDoc?.trim() ? "VIẾT LẠI CHO TỐT HƠN / BỔ SUNG" : "SOẠN MỚI"} tài liệu "${label}". ${genreStyleLine(genre)}

# Ý tưởng / bối cảnh gốc
"""${idea || "(trống — hãy xây dựng chung chung nhưng cụ thể, có thể chỉnh sau)"}"""

${existingBible?.trim() ? `# Dữ liệu hiện có trong sổ tay thế giới (bám sát, đừng làm mâu thuẫn)\n${existingBible.trim()}` : ""}

${currentDoc?.trim() ? `# Tài liệu hiện tại (giữ phần tốt, sửa/nâng cấp theo góp ý)\n${currentDoc.trim()}` : ""}

# Yêu cầu chuyên môn
${specifics[key]}

# Góp ý của tác giả
${note?.trim() || "(không có — tự làm cho hay và đầy đủ)"}

Chỉ trả nội dung Markdown của tài liệu này, không thêm lời dẫn ngoài.`;
}

// ---------- Scene Beat Planner (细纲): lên beats trước khi viết văn ----------
export function buildBeatPlannerPrompt({
  genre,
  chapterTitle,
  chapterNumber,
  chapterGoal,
  bibleText,
  prevTail,
  orientation,
}) {
  return `Bạn là biên kịch của xưởng viết tiểu thuyết. ${genreStyleLine(genre)} Trước khi viết văn, hãy lên DÀN BEATS (细纲) cho chương — 5–8 beats, mỗi beat 1 câu súc tích, rõ ràng hành động/cảm xúc/kết quả.

# BỘ TÀI LIỆU XƯỞNG (bible)
${bibleText}

# Chương cần lên beats
- Tiêu đề: ${chapterTitle || "(chưa có)"}
- Số chương: ${chapterNumber || "(chưa có)"}
- Mục tiêu: ${chapterGoal?.trim() || "(chưa có — dựa vào đại cương + tóm tắt hiện tại)"}

# Đoạn cuối chương trước (để nối mạch)
${prevTail?.trim() || "(chưa có — viết như mở đầu)"}

${orientation?.trim() ? `# Định hướng của tác giả\n${orientation.trim()}` : ""}

# Yêu cầu beats
- Bắt đầu beat đầu tiên phải NỐI TIẾP đoạn cuối chương trước (không đứt mạch).
- Mỗi beat phải có XUNG ĐỘT hoặc THÔNG TIN MỚI, không chỉ mô tả không khí.
- Beats cuối phải để lại MÓC TREO (hook) hoặc khoảnh khắc cảm xúc mạnh.
- Nhân vật hành động ĐÚNG tính cách trong 02_NHAN_VAT, xưng hô ĐÚNG 03_QUAN_HE.
- Nếu hợp lý, 1 beat nên cài phục bút mới hoặc hồi đáp phục bút đang treo.

Trả JSON đúng schema: { beats: [string] } — mảng 5–8 beats, mỗi beat 1 câu.`;
}

export const BEAT_PLANNER_SCHEMA = {
  type: "object",
  properties: {
    beats: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["beats"],
};

// ---------- Chapter Contract + Scene Plan: cam kết đầu ra trước khi viết ----------
export function buildChapterContractPrompt({ genre, chapterNumber, chapterTitle, chapterGoal, bibleText, prevTail, targetWords }) {
  return `Bạn là PLANNER của xưởng viết truyện dài đa thể loại. ${genreStyleLine(genre)} Hãy lập CHAPTER CONTRACT và SCENE PLAN có thể kiểm chứng trước khi Writer viết.

# CANON/CURRENT STATE
${bibleText}

# Chương ${chapterNumber || "?"}: ${chapterTitle || "(chưa đặt tên)"}
- Mục tiêu tác giả: ${chapterGoal?.trim() || "(suy ra từ đại cương và chapter map)"}
- Content budget: ${targetWords || 1200} từ, dung sai ±15%.
- Đoạn nối: ${prevTail?.trim() || "(mở đầu truyện)"}

Contract phải nêu: promise (thay đổi không thể bỏ), start_state, end_state, required_reveals, forbidden_reveals, open_plots_advanced, foreshadow_actions, timeline_window, knowledge_constraints, relationship_changes và content_budget phân bổ theo cảnh. Scene plan gồm 3–7 cảnh; mỗi cảnh có goal, conflict, turn, outcome, pov, location, characters, knowledge_used, state_changes, words. Tổng words gần target; không tạo cảnh chỉ để miêu tả hoặc kéo chữ.
Trả JSON đúng schema.`;
}

export const CHAPTER_CONTRACT_SCHEMA = {
  type: "object",
  properties: {
    contract: {
      type: "object",
      properties: {
        promise: { type: "string" }, start_state: { type: "string" }, end_state: { type: "string" },
        required_reveals: { type: "array", items: { type: "string" } }, forbidden_reveals: { type: "array", items: { type: "string" } },
        open_plots_advanced: { type: "array", items: { type: "string" } }, foreshadow_actions: { type: "array", items: { type: "string" } },
        timeline_window: { type: "string" }, knowledge_constraints: { type: "array", items: { type: "string" } },
        relationship_changes: { type: "array", items: { type: "string" } }, content_budget: { type: "string" },
      },
      required: ["promise", "start_state", "end_state", "required_reveals", "forbidden_reveals", "open_plots_advanced", "foreshadow_actions", "timeline_window", "knowledge_constraints", "relationship_changes", "content_budget"],
    },
    scenes: { type: "array", items: { type: "object", properties: {
      goal: { type: "string" }, conflict: { type: "string" }, turn: { type: "string" }, outcome: { type: "string" },
      pov: { type: "string" }, location: { type: "string" }, characters: { type: "array", items: { type: "string" } },
      knowledge_used: { type: "array", items: { type: "string" } }, state_changes: { type: "array", items: { type: "string" } }, words: { type: "number" },
    }, required: ["goal", "conflict", "turn", "outcome", "words"] } },
  }, required: ["contract", "scenes"],
};

export function buildLogicGatePrompt({ genre, phase, bibleText, contract, scenes, chapterContent = "" }) {
  return `Bạn là CONTINUITY EDITOR kiêm Logic/Canon/Current State engine. ${genreStyleLine(genre)} Đây là HARD GATE ${phase === "pre" ? "TRƯỚC KHI VIẾT" : "SAU KHI VIẾT"}.

# CANON/CURRENT STATE
${bibleText}
# CHAPTER CONTRACT
${JSON.stringify(contract || {}, null, 2)}
# SCENE PLAN
${JSON.stringify(scenes || [], null, 2)}
${phase === "post" ? `# BẢN THẢO\n"""${chapterContent || ""}"""` : ""}

Kiểm riêng từng miền: timeline, knowledge (nhân vật chỉ biết điều đã học), character_state, relationship_state, open_plots, foreshadow, và world_rules. Lỗi mâu thuẫn logic/canon là hard_fail=true; thiếu dữ liệu cần thiết để xác nhận cũng hard fail và ghi rõ cần bổ sung gì. passed chỉ true khi không có hard fail. Không chấm văn phong.
Trả JSON đúng schema.`;
}

export const LOGIC_GATE_SCHEMA = {
  type: "object", properties: {
    passed: { type: "boolean" }, summary: { type: "string" },
    issues: { type: "array", items: { type: "object", properties: {
      domain: { type: "string" }, severity: { type: "string" }, hard_fail: { type: "boolean" }, problem: { type: "string" }, suggestion: { type: "string" },
    }, required: ["domain", "severity", "hard_fail", "problem"] } },
  }, required: ["passed", "issues", "summary"],
};

export function buildQualityGatePrompt({ genre, bibleText, contract, scenes, chapterContent, targetWords }) {
  return `Bạn là QUALITY EDITOR. ${genreStyleLine(genre)} Chấm bản thảo sau khi Continuity Editor kiểm canon. Logic/canon là HARD FAIL; pacing, repetition và description_bloat là quality checks. Content budget ${targetWords || "mặc định"} từ ±15%.
# BIBLE\n${bibleText}\n# CONTRACT\n${JSON.stringify(contract || {}, null, 2)}\n# SCENES\n${JSON.stringify(scenes || [], null, 2)}\n# BẢN THẢO\n"""${chapterContent}"""
Kiểm: hoàn thành promise/start→end state; mọi scene có tiến triển; nhịp; lặp ý/câu/tình tiết; miêu tả không phục vụ mood, thông tin, nhân vật hoặc tension; padding; hook. Mọi lỗi logic đặt hard_fail=true. passed=false nếu có hard fail hoặc chất lượng tổng thể dưới 7/10. Trả JSON đúng schema.`;
}

export const QUALITY_GATE_SCHEMA = {
  type: "object", properties: {
    passed: { type: "boolean" }, score: { type: "number" }, summary: { type: "string" },
    checks: { type: "object", additionalProperties: { type: "number" } },
    issues: { type: "array", items: { type: "object", properties: {
      domain: { type: "string" }, severity: { type: "string" }, hard_fail: { type: "boolean" }, problem: { type: "string" }, suggestion: { type: "string" },
    }, required: ["domain", "severity", "hard_fail", "problem"] } },
  }, required: ["passed", "score", "summary", "issues"],
};

// ---------- P6–P10: kiểm sức khỏe toàn truyện + Story Promise/trackers ----------
export function buildNovelHealthPrompt({ genre, bibleText, chapters }) {
  const chapterEvidence = (chapters || []).map((c) => {
    const text = String(c.content || "");
    const excerpt = text.length > 2400 ? `${text.slice(0, 1200)}\n…\n${text.slice(-1200)}` : text;
    return `## Chương ${c.chapter_number ?? "?"}: ${c.title || ""}\n${excerpt}`;
  }).join("\n\n");
  return `Bạn là NOVEL TESTER kiểm định truyện dài đa thể loại. ${genreStyleLine(genre)} Đọc Master Plan/Bible và bằng chứng chương để tạo HEALTH REPORT dựa trên bằng chứng, không đoán.
# BIBLE / MASTER PLAN / CURRENT STATE\n${bibleText}
# CHƯƠNG (đầu+cuối mỗi chương nếu dài)\n${chapterEvidence || "(chưa có)"}

Kiểm các tracker: story_promise, main_plot, subplots/open_plots, character_arcs, relationship_progression, knowledge/mystery, foreshadow/payoff, timeline, pacing, repetition và description_bloat. Với mỗi tracker: score 0–100, status good/warning/critical, evidence có số chương, neglected_for_chapters và next_action. Chỉ critical khi có mâu thuẫn hoặc lời hứa trọng tâm bị bỏ quên rõ ràng. health_score là trung bình có trọng số, logic/canon/story promise nặng nhất. regressions là lỗi xuất hiện hoặc tệ hơn ở các chương gần đây. priorities tối đa 7 hành động cụ thể cho 3–10 chương tới.
Trả JSON đúng schema.`;
}

export const NOVEL_HEALTH_SCHEMA = {
  type: "object", properties: {
    health_score: { type: "number" }, summary: { type: "string" },
    trackers: { type: "array", items: { type: "object", properties: {
      key: { type: "string" }, label: { type: "string" }, score: { type: "number" }, status: { type: "string" }, evidence: { type: "array", items: { type: "string" } }, neglected_for_chapters: { type: "number" }, next_action: { type: "string" },
    }, required: ["key", "label", "score", "status", "evidence", "next_action"] } },
    regressions: { type: "array", items: { type: "string" } }, priorities: { type: "array", items: { type: "string" } },
  }, required: ["health_score", "summary", "trackers", "regressions", "priorities"],
};

export function buildGateRepairPrompt({ genre, bibleText, contract, scenes, chapterContent, gateReport, targetWords }) {
  return `Bạn là WRITER nhận phiếu sửa từ Continuity Editor/Quality. ${genreStyleLine(genre)} Viết lại TOÀN BỘ chương, giữ phần đạt, sửa hết hard fail và lỗi chất lượng. Không được sửa canon để hợp thức hóa bản thảo.
# BIBLE\n${bibleText}\n# CONTRACT\n${JSON.stringify(contract || {}, null, 2)}\n# SCENE PLAN\n${JSON.stringify(scenes || [], null, 2)}\n# GATE REPORT\n${JSON.stringify(gateReport || {}, null, 2)}\n# BẢN THẢO\n"""${chapterContent}"""
# CONTENT BUDGET\n${targetWords || 1200} từ ±15%. Không padding; mỗi đoạn phải phục vụ plot, character, relationship, knowledge, mood có chủ đích hoặc tension.
Chỉ trả chương Markdown hoàn chỉnh, không giải thích meta.`;
}

// ---------- Viết chương bám bible ----------
export function buildWriteChapterPrompt({
  genre,
  chapterTitle,
  chapterNumber,
  chapterGoal,
  bibleText,
  prevTail,
  orientation,
  beats,
  targetWords,
  overdueForeshadows,
  contract,
  scenes,
}) {
  const wordRule =
    targetWords && Number(targetWords) > 0
      ? `- Độ dài chương: viết KHOẢNG ${targetWords} từ (đủ dài theo yêu cầu — đừng cắt bớt, cũng đừng lặp ý để kéo dài).`
      : "- Đảm bảo nhịp chương ~800-1200 từ.";
  return `Bạn là tác giả chính của một xưởng viết tiểu thuyết. ${genreStyleLine(genre)} TUYỆT ĐỐI không giải thích meta — chỉ viết văn chương hoàn chỉnh.

# BỘ TÀI LIỆU XƯỞNG (bible) — phải bám sát 100%
${bibleText}

# Mục tiêu của chương này
${chapterGoal?.trim() || "(chưa có — hãy viết chương nối tiếp tự nhiên theo đại cương và tóm tắt hiện tại)"}

# Đoạn cuối chương trước (nối mạch, giữ tông)
${prevTail?.trim() ? prevTail.trim() : "(chưa có — viết như mở đầu)"}

${contract ? `# CHAPTER CONTRACT (cam kết bắt buộc)\n${JSON.stringify(contract, null, 2)}` : ""}
${scenes?.length ? `# SCENE PLAN (thực hiện đúng thứ tự và content budget)\n${JSON.stringify(scenes, null, 2)}` : ""}
${beats?.length ? `# DÀN BEATS ĐÃ DUYỆT (细纲 — bám sát 100% từng beat theo thứ tự)\n${beats.map((b, i) => `${i + 1}. ${b}`).join("\n")}` : ""}

${orientation?.trim() ? `# Định hướng thêm của tác giả\n${orientation.trim()}` : ""}

${overdueForeshadows?.length ? `# PHỤC BÚT CẦN HỒI ĐÁP TRONG CHƯƠNG NÀY (nếu hợp lý, hãy hồi đáp ít nhất 1 phục bút sau — nếu có thể nhồi tự nhiên vào tình tiết)\n${overdueForeshadows.map((f) => `- ${f.name}: ${f.description || ""}${f.resolve_by_chapter ? ` (dự kiến ch.${f.resolve_by_chapter})` : ""}`).join("\n")}` : ""}

# Yêu cầu bắt buộc
- Tuân thủ tuyệt đối 00_QUY_TAC_VIET (tông giọng, POV, từ cấm, xưng hô, giới hạn tiết lộ).
- Nhân vật hành động/đối thoại ĐÚNG hồ sơ trong 02_NHAN_VAT & 03_QUAN_HE (giọng văn, xưng hô đúng từng người).
- Địa danh, luật lệ, thuật ngữ ĐÚNG 01_THE_GIOI.
- Trạng thái nhân vật bắt đầu chương phải KHỚP với 07_TRANG_THAI_NHAN_VAT (vị trí, hành động, tâm lý, vật phẩm).
- ${wordRule}
- Chấp nhận dung sai độ dài ±15%. Nếu thiếu chữ, tăng xung đột/hành động/thông tin; KHÔNG padding bằng miêu tả, hồi tưởng hoặc lặp cảm xúc.
- Chia đoạn rõ ràng, kết chương có móc treo (hook) tự nhiên hoặc khoảnh khắc cảm xúc.
- Nếu hợp lý, cài 1 phục bút mới theo 05_FUC_BUT hoặc hồi đáp một phục bút đang treo.
- Không mâu thuẫn 06_TIMELINE và summaries/tom_tat_hien_tai.md.
Chỉ trả nội dung chương (Markdown), không tiêu đề meta, không lời dẫn.`;
}

// ---------- Sửa chương theo góp ý: AI đọc lại + viết lại chương theo feedback ----------
export function buildChapterRevisionPrompt({
  genre,
  chapterTitle,
  chapterNumber,
  chapterGoal,
  bibleText,
  currentContent,
  feedback,
  orientation,
  beats,
  targetWords,
}) {
  const wordRule =
    targetWords && Number(targetWords) > 0
      ? `- Độ dài chương: viết KHOẢNG ${targetWords} từ (đủ dài theo yêu cầu — đừng cắt bớt, cũng đừng lặp ý để kéo dài).`
      : "- Đảm bảo nhịp chương ~800-1200 từ.";
  return `Bạn là tác giả chính của một xưởng viết tiểu thuyết. ${genreStyleLine(genre)} Tác giả vừa xem chương và muốn SỬA CHỮA theo góp ý. Nhiệm vụ: viết lại TOÀN BỘ chương, GIỮ nguyên phần đã hay, sửa đúng các điểm được góp ý. TUYỆT ĐỐI không giải thích meta — chỉ trả nội dung chương hoàn chỉnh (viết lại toàn bộ, không phải chỉ phần thay đổi).

# BỘ TÀI LIỆU XƯỞNG (bible) — phải bám sát 100%
${bibleText}

# Mục tiêu của chương này
${chapterGoal?.trim() || "(không thay đổi so với lần viết trước)"}

${beats?.length ? `# DÀN BEATS ĐÃ DUYỆT (细纲 — bám sát 100% từng beat theo thứ tự)\n${beats.map((b, i) => `${i + 1}. ${b}`).join("\n")}` : ""}

${orientation?.trim() ? `# Định hướng thêm của tác giả\n${orientation.trim()}` : ""}

# BẢN THẢO CHƯƠNG HIỆN TẠI (cần sửa)
"""${currentContent}"""

# GÓP Ý CỦA TÁC GIẢ (phải bám sát từng ý)
${feedback}

# Yêu cầu bắt buộc
- Đọc kỹ GÓP Ý rồi sửa đúng từng điểm, phần khác giữ nguyên chất lượng (không làm hỏng đoạn đã hay).
- Tuân thủ tuyệt đối 00_QUY_TAC_VIET (tông giọng, POV, từ cấm, xưng hô, giới hạn tiết lộ).
- Nhân vật hành động/đối thoại ĐÚNG hồ sơ trong 02_NHAN_VAT & 03_QUAN_HE (giọng văn, xưng hô đúng từng người).
- Trạng thái nhân vật bắt đầu chương phải KHỚP với 07_TRANG_THAI_NHAN_VAT.
- ${wordRule}
- Chia đoạn rõ ràng, kết chương có móc treo (hook) tự nhiên hoặc khoảnh khắc cảm xúc.
- Không mâu thuẫn 06_TIMELINE và summaries/tom_tat_hien_tai.md.
Chỉ trả nội dung chương (Markdown), không tiêu đề meta, không lời dẫn.`;
}

// ---------- Rollup: cập nhật toàn bộ bible sau khi viết xong chương ----------
export function buildRollupPrompt({ genre, chapterTitle, chapterContent, bibleText, pastSummary }) {
  return `Bạn là ĐỘI NGŨ BIÊN TẬP của xưởng viết tiểu thuyết. Tác giả vừa viết xong chương "${chapterTitle || "(chưa có tiêu đề)"}". Nhiệm vụ của bạn: cập nhật BỘ TÀI LIỆU XƯỞNG để phản ánh đúng hiện trạng — đây chính là "trí nhớ dài hạn" giúp các chương sau viết không lệch. ${genreStyleLine(genre)}

# BỘ TÀI LIỆU HIỆN TẠI
${bibleText}

# NỘI DUNG CHƯƠNG VỪA VIẾT
"""${chapterContent}"""

# Yêu cầu cập nhật — LUÔN LUÔN trả về 2 tài liệu sau (bất kể chương như thế nào), các tài liệu khác CHỈ trả khi thực sự có thay đổi:
- 07_TRANG_THAI_NHAN_VAT (LUÔN): viết MỚI toàn bộ trạng thái sống của từng nhân vật ngay SAU chương này — địa điểm mới, hành động đang làm, tâm lý, vật phẩm mới, bí mật đã biết, thương tích/địa vị mới nhất (mỗi nhân vật 1 mục '### Tên').
- summaries/tom_tat_hien_tai.md (LUÔN): viết MỚI toàn bộ tóm tắt hiện tại (thay hoàn toàn bản cũ) — nhân vật đang ở đâu, đang làm gì, xung đột leo thang thế nào, móc treo đang treo là gì.
- 06_TIMELINE: thêm các sự kiện mới của chương vào cuối timeline (đúng thứ tự), cập nhật trạng thái nếu có thay đổi.
- 05_FUC_BUT: thêm phục bút MỚI được cài trong chương (đánh dấu "đang treo"), và đánh dấu "đã hồi đáp" cho phục bút nào được hồi đáp trong chương này.
- 02_NHAN_VAT: cập nhật nếu chương thay đổi đáng kể hồ sơ nhân vật (mục tiêu đổi, bí mật tiết lộ, mối quan hệ quan trọng thay đổi...). TRÊN 03_QUAN_HE nếu chỉ thay đổi thái độ thì không cần.
- 03_QUAN_HE: cập nhật thái độ/quan hệ nếu chương có thay đổi.
- 04_DAI_CUONG: đánh dấu tiến độ chương đã viết (ghi chú nhỏ) nếu cần.
- 00_QUY_TAC_VIET và 01_THE_GIOI: chỉ cập nhật khi chương tiết lộ luật mới/địa danh mới cần ghi nhận.

Trả JSON đúng schema: { updates: { [doc_key]: "nội dung Markdown mới của tài liệu đó" } } — chỉ chứa các key cần cập nhật.`;
}

export const ROLLUP_SCHEMA = {
  type: "object",
  properties: {
    updates: {
      type: "object",
      additionalProperties: { type: "string" },
    },
  },
  required: ["updates"],
};

// ---------- Kiểm tra nhất quán với bible ----------
export function buildBibleConsistencyPrompt({ genre, chapterContent, bibleText }) {
  return `Bạn là BIÊN TẬP NHẤT QUÁN của xưởng viết tiểu thuyết. So sánh chương vừa viết với BỘ TÀI LIỆU XƯỞNG, phát hiện MÂU THUẪN và vi phạm THẬT SỰ. ${genreStyleLine(genre)}

# BỘ TÀI LIỆU XƯỞNG
${bibleText}

# CHƯƠNG VỪA VIẾT
"""${chapterContent}"""

# Yêu cầu
Chỉ báo lỗi thật sự: đổi ngoại hình cố định, sai xưng hô/giọng văn, nhắc sự kiện chưa xảy ra, mâu thuẫn timeline, hành động trái tính cách/động cơ/bí mật, bỏ lỡ phục bút cần hồi đáp, vi phạm quy tắc viết. Mỗi lỗi: severity ("nghiêm trọng" / "cảnh báo"), where (trích ngắn/tên nhân vật), problem (mô tả cụ thể), suggestion (cách sửa). Nếu không có lỗi, trả issues rỗng. Trả JSON đúng schema.`;
}

export const BIBLE_CONSISTENCY_SCHEMA = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string" },
          where: { type: "string" },
          problem: { type: "string" },
          suggestion: { type: "string" },
        },
        required: ["severity", "problem"],
      },
    },
  },
  required: ["issues"],
};

// ---------- Kiểm tra xưng hô nhất quán GIỮA CÁC CHƯƠNG ----------
// Rà từng cặp nhân vật: nhân vật A xưng/gọi B bằng gì qua các chương, đối chiếu
// với 03_QUAN_HE. Phát hiện chỗ lúc "em" lúc "ngươi", lúc "ta" lúc "tôi"...
export function buildXungHoConsistencyPrompt({ genre, relationText, chapters }) {
  const chaptersBlock = chapters
    .map((c, i) => `### Chương ${i + 1} — ${c.title || "(chưa có tiêu đề)"}\n"""${(c.content || "").trim()}"""`)
    .join("\n\n");
  return `Bạn là BIÊN TẬP NHẤT QUÁN của xưởng viết tiểu thuyết, chuyên rà XƯNG HÔ. ${genreStyleLine(genre)}
Nhiệm vụ: đọc TOÀN BỘ các chương đã viết và kiểm tra xem cách các nhân vật XƯNG (gọi bản thân) và GỌI nhau (ngươi/em/anh/chị/chú/bác...) có nhất quán GIỮA CÁC CHƯƠNG không, và có khớp với tài liệu QUAN HỆ & XƯNG HÔ không.

# QUAN HỆ & XƯNG HÔ (03_QUAN_HE — chuẩn cần tuân thủ)
${relationText || "(chưa có tài liệu — chỉ so nhất quán giữa các chương)"}

# TOÀN BỘ CHƯƠNG ĐÃ VIẾT
${chaptersBlock || "(chưa có chương nào)"}

# Yêu cầu
- Với mỗi CẶP nhân vật có tương tác, xác định cách A xưng bản thân (tôi/ta/mình/em/thiếp...) và cách A gọi B (em/anh/ngươi/cô/tiểu thư...) qua từng chương.
- Báo lỗi khi:
  1. Cùng một cặp, xưng hô ĐỔI KHÁC NHAU giữa các chương mà không có lý do cốt truyện rõ ràng (VD: lúc gọi "em", lúc gọi "ngươi"; lúc xưng "tôi", lúc xưng "ta").
  2. Xưng hô lệch với 03_QUAN_HE (VD: tài liệu ghi "nam chính gọi nữ chính là 'em'" nhưng chương viết "ngươi").
  3. Hai nhân vật xưng hô không đối xứng (VD: A gọi B "em" nhưng B gọi A "em" khi quan hệ không phải vậy).
- KHÔNG báo lỗi nếu sự thay đổi có chủ đích rõ ràng (bí mật thân phận vỡ lở, quan hệ đổi chỗ, giai đoạn mới...) — nhưng phải ghi rõ lý do đó là gì.
- Mỗi lỗi: character_a, character_b (tên nhân vật), expected (xưng hô chuẩn theo tài liệu, hoặc rỗng nếu không có), found (các biến thể tìm thấy, VD "chương 1: em — chương 3: ngươi"), chapters (số chương liên quan), problem (mô tả cụ thể), suggestion (cách sửa). Nếu không có lỗi, trả issues rỗng.
Trả JSON đúng schema.`;
}

export const XUNG_HO_CONSISTENCY_SCHEMA = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          character_a: { type: "string" },
          character_b: { type: "string" },
          expected: { type: "string" },
          found: { type: "string" },
          chapters: { type: "string" },
          problem: { type: "string" },
          suggestion: { type: "string" },
        },
        required: ["problem"],
      },
    },
  },
  required: ["issues"],
};

// ---------- Tự đánh giá chương theo rubric (bước 2 của "viết 2 pass") ----------
export function buildChapterCritiquePrompt({ genre, chapterTitle, bibleText, chapterContent, targetWords }) {
  return `Bạn là TỔNG BIÊN TẬP khắt khe của một xưởng viết tiểu thuyết mạng. ${genreStyleLine(genre)} Tác giả vừa viết xong bản nháp chương và muốn bạn CHẤM ĐIỂM trung thực để tự nâng chất lượng trước khi xuất bản. Hãy đọc chương và cho điểm theo rubric.

# BỘ TÀI LIỆU XƯỞNG (bible — chuẩn để so sánh)
${bibleText}

# BẢN NHÁP CHƯƠNG "${chapterTitle || "(chưa có tiêu đề)"}"
"""${chapterContent}"""

${targetWords && Number(targetWords) > 0 ? `# Yêu cầu độ dài: ~${targetWords} từ.\n` : ""}

# Rubric chấm điểm (mỗi tiêu chí score 1–10, note 1–2 câu cụ thể)
1. độ_căng_kịch_tính — mức độ xung đột, áp lực, thông tin mới được kéo căng.
2. cảm_xúc — tác động vào cảm xúc người đọc (đồng cảm, hồi hộp, tức giận...).
3. hook_kết_chương — móc treo/giây phút cảm xúc ở cuối có khiến muốn đọc chương sau không.
4. nhịp_độ — phân bổ đoạn, không dài dòng/loãng, cao trào đặt đúng chỗ.
5. đối_thoại_xưng_hô — lời thoại tự nhiên, đúng giọng từng nhân vật, xưng hô nhất quán (đối chiếu 02_NHAN_VAT, 03_QUAN_HE).
6. bám_bible — địa danh/luật lệ/trạng thái nhân vật khớp 01_THE_GIOI, 07_TRANG_THAI_NHAN_VAT, 06_TIMELINE.

# Yêu cầu
- Không nương tay: nếu chương chỉ đạt 6/10 thì cứ nói thẳng — điều này giúp truyện hay hơn.
- strengths: 2–3 điểm mạnh cụ thể.
- weaknesses: 2–4 điểm yếu cụ thể (trích đoạn ngắn nếu cần).
- rewrite_instructions: 3–6 LỆNH viết lại cụ thể, ưu tiên tăng độ căng, hook, cảm xúc.
Trả JSON đúng schema: { scores: [{criterion, score, note}], strengths: [string], weaknesses: [string], rewrite_instructions: [string] }.`;
}

export const CHAPTER_CRITIQUE_SCHEMA = {
  type: "object",
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterion: { type: "string" },
          score: { type: "number" },
          note: { type: "string" },
        },
        required: ["criterion", "score"],
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    rewrite_instructions: { type: "array", items: { type: "string" } },
  },
  required: ["scores", "strengths", "weaknesses", "rewrite_instructions"],
};

// ---------- Viết lại theo đánh giá (bước 3 của "viết 2 pass") ----------
export function buildRewriteFromCritiquePrompt({ genre, chapterTitle, bibleText, chapterContent, critiqueText, targetWords }) {
  const wordRule =
    targetWords && Number(targetWords) > 0
      ? `- Độ dài chương: viết KHOẢNG ${targetWords} từ (đủ dài, không cắt bớt).`
      : "- Đảm bảo nhịp chương ~800-1200 từ.";
  return `Bạn là TÁC GIẢ CHÍNH của một xưởng viết tiểu thuyết. ${genreStyleLine(genre)} Tổng biên tập vừa chấm điểm bản nháp chương "${chapterTitle || "(chưa có tiêu đề)"}". Hãy viết lại TOÀN BỘ chương theo đánh giá — GIỮ phần đã hay, khắc phục đúng các điểm yếu, tuân thủ từng lệnh viết lại. TUYỆT ĐỐI không giải thích meta, chỉ trả văn chương hoàn chỉnh.

# BỘ TÀI LIỆU XƯỞNG (bible — bám sát 100%)
${bibleText}

# BẢN NHÁP HIỆN TẠI
"""${chapterContent}"""

# ĐÁNH GIÁ CỦA TỔNG BIÊN TẬP (phải khắc phục từng mục)
${critiqueText}

# Yêu cầu bắt buộc
- Khắc phục mọi điểm yếu trong weaknesses và làm theo TẤT CẢ rewrite_instructions.
- Giữ nguyên mạch truyện, beats và các chi tiết tốt đã có — chỉ nâng cấp, không phá cấu trúc.
- ${wordRule}
- Kết chương phải có hook mạnh hoặc khoảnh khắc cảm xúc rõ ràng.
- Không mâu thuẫn 06_TIMELINE, 07_TRANG_THAI_NHAN_VAT, summaries/tom_tat_hien_tai.md.
Chỉ trả nội dung chương (Markdown), không tiêu đề meta, không lời dẫn.`;
}

// ---------- Mở màn đa lựa chọn ----------
export function buildOpeningPrompt({ genre, chapterTitle, chapterNumber, chapterGoal, bibleText, prevTail, orientation }) {
  return `Bạn là biên kịch của xưởng viết tiểu thuyết. ${genreStyleLine(genre)} Hãy sinh 3 PHƯƠNG ÁN MỞ ĐẦU khác nhau cho chương "${chapterTitle || "(chưa có tiêu đề)"}" (chương ${chapterNumber || "?"}).

# BỘ TÀI LIỆU XƯỞNG (bible)
${bibleText}

# Mục tiêu chương
${chapterGoal?.trim() || "(chưa có — dựa vào đại cương và tóm tắt hiện tại)"}

# Đoạn cuối chương trước (phải nối mạch)
${prevTail?.trim() || "(chưa có — viết như mở đầu)"}

${orientation?.trim() ? `# Định hướng tác giả\n${orientation.trim()}` : ""}

# Yêu cầu
- 3 phương án KHÁC NHAU rõ rệt về cách vào cảnh (in medias res, từ chi tiết gợi mở, từ tâm trạng nhân vật, từ hội thoại...).
- Mỗi phương án 150–250 từ, đủ sức hút, tự nhiên, đúng tông truyện.
- Bám sát bible: nhân vật, địa danh, trạng thái nhân vật bắt đầu chương phải khớp 07_TRANG_THAI_NHAN_VAT.
Trả JSON đúng schema: { options: [string] } — 3 chuỗi văn xuôi hoàn chỉnh.`;
}

// ---------- Hook / móc treo kết chương đa lựa chọn ----------
export function buildHookPrompt({ genre, chapterTitle, chapterContent, bibleText, beats }) {
  return `Bạn là biên kịch của xưởng viết tiểu thuyết. ${genreStyleLine(genre)} Hãy đọc chương "${chapterTitle || "(chưa có tiêu đề)"}" và sinh 3 PHƯƠNG ÁN KẾT CHƯƠNG (hook) khác nhau để móc người đọc vào chương sau.

# BỘ TÀI LIỆU XƯỞNG (bible)
${bibleText}

# NỘI DUNG CHƯƠNG ĐÃ VIẾT
"""${chapterContent}"""

${beats?.length ? `# DÀN BEATS đã duyệt\n${beats.map((b, i) => `${i + 1}. ${b}`).join("\n")}` : ""}

# Yêu cầu
- 3 phương án KHÁC NHAU về loại hook: (a) tiết lộ chấn động, (b) nguy hiểm đang tới, (c) tình cảm/nút thắt mới, (d) hồi đáp phục bút treo, (e) quyết định liều lĩnh...
- Mỗi phương án 2–5 câu, là PHẦN NỐI TIẾP ngay sau nội dung chương (không lặp lại đoạn cuối chương).
- Phải nhất quán với bible và hướng câu chuyện; không bịa sự kiện mâu thuẫn.
Trả JSON đúng schema: { options: [string] } — 3 chuỗi hook hoàn chỉnh.`;
}

export const CHAPTER_OPTIONS_SCHEMA = {
  type: "object",
  properties: {
    options: { type: "array", items: { type: "string" } },
  },
  required: ["options"],
};

// ---------- Bản đồ Arc: phân tích đại cương thành các arc ----------
export function buildArcMapPrompt({ genre, daiCuong, chapters }) {
  const chaptersBlock = chapters
    .map((c) => `- Chương ${c.chapter_number != null ? c.chapter_number : "?"}: ${c.title}`)
    .join("\n");
  return `Bạn là ĐẠI CƯƠNG SƯ của xưởng viết tiểu thuyết. ${genreStyleLine(genre)} Hãy phân tích tài liệu ĐẠI CƯƠNG (04_DAI_CUONG) và danh sách chương đã viết để VẼ BẢN ĐỒ ARC của bộ truyện.

# 04_DAI_CUONG (đại cương — nguồn duy nhất để phân tích arc)
${daiCuong?.trim() || "(trống)"}

# CÁC CHƯƠNG ĐÃ VIẾT
${chaptersBlock || "(chưa có)"}

# Yêu cầu
- Xác định TẤT CẢ volume và arc có trong đại cương: volume, tên arc, số chương bắt đầu/kết thúc, mục tiêu/bước ngoặt chính.
- Nếu đại cương không nêu rõ số chương từng arc, hãy ước lượng hợp lý từ mô tả và thứ tự.
- Ghi chú tiến độ: arc nào đã bắt đầu/đang viết/hoàn tất dựa trên số chương đã viết.
- Tạo rolling chapter_map cho 5–10 chương kể từ chương kế tiếp; mỗi mục có chapter, promise, plot_advance, state_change, reveal, foreshadow, hook. Chỉ dùng thông tin đại cương, không tự đổi canon.
- Cảnh báo những chương đã viết NẰM NGOÀI mọi arc (lạc đề).
Trả JSON đúng schema.`;
}

export const ARC_MAP_SCHEMA = {
  type: "object",
  properties: {
    arcs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          volume: { type: "string" },
          start_chapter: { type: "number" },
          end_chapter: { type: "number" },
          goal: { type: "string" },
          progress_note: { type: "string" },
        },
        required: ["name", "start_chapter", "end_chapter", "goal"],
      },
    },
    warnings: { type: "array", items: { type: "string" } },
    chapter_map: { type: "array", items: { type: "object", properties: {
      chapter: { type: "number" }, promise: { type: "string" }, plot_advance: { type: "string" }, state_change: { type: "string" }, reveal: { type: "string" }, foreshadow: { type: "string" }, hook: { type: "string" },
    }, required: ["chapter", "promise", "plot_advance", "state_change", "hook"] } },
  },
  required: ["arcs"],
};

// ---------- Sổ phục bút: phân tích + cảnh báo treo lâu ----------
export function buildForeshadowParsePrompt({ genre, fucBut, chapters }) {
  const maxChapter = chapters.reduce((m, c) => Math.max(m, Number(c.chapter_number) || 0), 0);
  return `Bạn là PHỤC BÚT QUẢN LÝ của xưởng viết tiểu thuyết. ${genreStyleLine(genre)} Hãy đọc SỔ PHỤC BÚT (05_FUC_BUT) và danh sách chương đã viết, rồi lập danh sách phục bút có trạng thái hiện tại.

# 05_FUC_BUT (sổ phục bút)
${fucBut?.trim() || "(trống — chưa có phục bút nào)"}

# SỐ CHƯƠNG ĐÃ VIẾT: ${maxChapter || 0}

# Yêu cầu
- Liệt kê TẤT CẢ phục bút có trong sổ: tên, chương được cài (nếu ghi rõ), chương dự kiến hồi đáp (nếu ghi rõ), trạng thái (chưa cài / đã cài / đang treo / đã hồi đáp), mô tả ngắn.
- Nếu tài liệu không ghi số chương, để trống hoặc suy luận từ mô tả (planted_chapter / resolve_by_chapter có thể null).
- status chuẩn hoá về 1 trong: "chưa cài" | "đã cài" | "đang treo" | "đã hồi đáp".
Trả JSON đúng schema: { items: [{ name, planted_chapter, resolve_by_chapter, status, description }] }.`;
}

export const FORESHADOW_PARSE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          planted_chapter: { type: ["number", "null"] },
          resolve_by_chapter: { type: ["number", "null"] },
          status: { type: "string" },
          description: { type: "string" },
        },
        required: ["name", "status"],
      },
    },
  },
  required: ["items"],
};

// ---------- Voice Consistency: trích giọng văn nhân vật từ chương đã viết ----------
export function buildVoiceExtractionPrompt({ genre, characterName, chapterContents }) {
  const excerpts = chapterContents
    .map((c, i) => `### Chương ${i + 1}\n"""${c}"""`)
    .join("\n\n");
  return `Bạn là biên tập giọng văn nhân vật trong xưởng viết tiểu thuyết. ${genreStyleLine(genre)} Hãy đọc các đoạn văn chương dưới đây và TRÍCH ra giọng văn/thoại đặc trưng của nhân vật "${characterName}".

# Các chương đã viết
${excerpts}

# Yêu cầu trích xuất
- 5–10 câu THOẠI thực tế nhân vật này từng nói (trích nguyên văn, giữ dấu “ ” nếu có).
- Ghi chú 1–2 dòng về phong cách nói (VD: lạnh lùng, ngắn gọn, dùng từ cổ trang, hay dùng "ta/ngươi", hay nói mỉa...).
- Nếu nhân vật không xuất hiện thoại trong các đoạn này, trả về mảng rỗng.
Trả JSON đúng schema: { name: string, dialogue_samples: [string], voice_notes: string }.`;
}

export const VOICE_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    dialogue_samples: { type: "array", items: { type: "string" } },
    voice_notes: { type: "string" },
  },
  required: ["name", "dialogue_samples", "voice_notes"],
};

// ---------- Kiểm tra đạo nhại / trùng lặp giữa chương mới vs chương cũ ----------
export function buildRepetitionCheckPrompt({ genre, chapterContent, pastChapters }) {
  const past = pastChapters
    .map((c, i) => `### Chương ${i + 1} — ${c.title || "?"}\n"""${(c.content || "").slice(0, 2000)}"""`)
    .join("\n\n");
  return `Bạn là BIÊN TẬP CHẤT LƯỢNG của xưởng viết tiểu thuyết. ${genreStyleLine(genre)} Hãy đọc chương vừa viết và TOÀN BỘ các chương trước đó, phát hiện các dấu hiệu TRÙNG LẶP / ĐẠO NHẠI NGNÀI, cụ thể:

# CHƯƠNG VỪA VIẾT
"""${chapterContent}"""

# CÁC CHƯƠNG TRƯỚC ĐÓ
${past || "(chưa có chương trước)"}

# Yêu cầu kiểm tra
1. CÂU/CỤM TỪ TRÙNG: tìm câu hoặc cụm từ dài >= 10 từ xuất hiện >= 2 lần trong TOÀN BỘ các chương (gồm cả chương mới). Trích nguyên văn.
2. TÌNH TIẾT TRÙNG: mô tả cùng 1 sự kiện/hành động/cảm xúc lặp lại y hệt (VD: nữ chính "lòng đau như cắt" 3 lần, hoặc 2 chương mở đầu đều "nắng nhẹ nhàng chiếu qua cửa sổ").
3. CẤU TRÚC TRÙNG: cách mở đầu/kết thúc chương lặp lại mô-tip giống hệt nhau (VD: mỗi chương đều mở bằng "một buổi sáng đẹp trời").
4. CẢM XÚC TRÙNG: nhân vật phản ứng cảm xúc giống hệt nhau ở cùng tình huống (VD: lần nào cũng "mắt đỏ hoe" khi buồn).

Trả JSON đúng schema: { issues: [{ type, excerpt, chapters, problem, suggestion }] } — type = "câu_trùng" | "tình_tiết_trùng" | "cấu_trúc_trùng" | "cảm_xúc_trùng". Nếu không có vấn đề, issues rỗng.`;
}

export const REPETITION_CHECK_SCHEMA = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          excerpt: { type: "string" },
          chapters: { type: "string" },
          problem: { type: "string" },
          suggestion: { type: "string" },
        },
        required: ["type", "problem"],
      },
    },
  },
  required: ["issues"],
};

// ---------- Gợi ý mục tiêu chương tiếp theo (tự động, từ đại cương + tóm tắt hiện tại) ----------
export function buildNextChapterGoalPrompt({ genre, bibleText, prevTail, nextChapterNumber }) {
  return `Bạn là ĐẠI CƯƠNG SƯ của xưởng viết tiểu thuyết. ${genreStyleLine(genre)} Tác giả sắp viết CHƯƠNG ${nextChapterNumber || "tiếp theo"} nhưng chưa nghĩ ra mục tiêu chương (biến cố/xung đột cần xảy ra). Hãy đọc BỘ TÀI LIỆU XƯỞNG (đặc biệt 04_DAI_CUONG và tóm tắt hiện tại) rồi đề xuất.

# BỘ TÀI LIỆU XƯỞNG (bible)
${bibleText}

# Đoạn cuối chương gần nhất (để nối mạch)
${prevTail?.trim() || "(chưa có — đây là chương đầu)"}

# Yêu cầu
- Dựa vào 04_DAI_CUONG (arc hiện đang viết tới đâu) và tóm tắt hiện tại (xung đột đang leo thang) để suy ra chương tiếp theo LOGIC PHẢI xảy ra chuyện gì.
- goal: 1-2 câu súc tích, đủ cụ thể để biên kịch lên beats được ngay (nêu rõ biến cố/xung đột/nhân vật liên quan).
- reasoning: 1 câu giải thích ngắn vì sao đây là bước tiếp theo hợp lý (dựa vào đại cương/arc nào).
Trả JSON đúng schema: { goal: string, reasoning: string }.`;
}

export const NEXT_CHAPTER_GOAL_SCHEMA = {
  type: "object",
  properties: {
    goal: { type: "string" },
    reasoning: { type: "string" },
  },
  required: ["goal"],
};

// ---------- Sinh backstory / sách bách khoa nhân vật phụ ----------
export function buildBackstoryPrompt({ genre, bibleText, characterName, numScenes, focus }) {
  return `Bạn là THIẾT LẬP SƯ + QUẢN LÝ NHÂN VẬT của xưởng viết tiểu thuyết. ${genreStyleLine(genre)} Hãy viết backstory chi tiết cho nhân vật phụ "${characterName}" — biến nhân vật phụ thành nhân vật ĐƯỢC NHỚ, có chiều sâu, có mục tiêu riêng, có bí mật.

# BỘ TÀI LIỆU XƯỞNG (bible)
${bibleText}

# Yêu cầu
- Viết backstory đầy đủ: quá khứ, biến cố định hình, mục tiêu, bí mật, mâu thuẫn nội tâm, quan hệ với nhân vật chính.
- Gợi ý ${numScenes || 3} CẢNH/HỌA ĐỘNG cụ thể mà nhân vật này có thể xuất hiện trong truyện (mỗi cảnh 1-2 câu mô tả, rõ ràng thời điểm/nguyên nhân).
- Gợi ý ${numScenes || 3} CÂU HỎI / ĐỘNG THÁY MỚI mà nhân vật này có thể tạo ra cho nhân vật chính.
- Giữ nhất quán với bible: không bịa sự kiện mâu thuẫn.
Chỉ trả nội dung Markdown về nhân vật "${characterName}", không lời dẫn ngoài.`;
}

// ---------- Timeline: phân tích 06_TIMELINE thành mốc trực quan ----------
export function buildTimelineParsePrompt({ genre, timeline }) {
  return `Bạn là THỜI TUYẾN QUẢN LÝ của xưởng viết tiểu thuyết. ${genreStyleLine(genre)} Hãy đọc tài liệu 06_TIMELINE và trích xuất các mốc thời gian theo định dạng có cấu trúc.

# 06_TIMELINE
${timeline?.trim() || "(trống)"}

# Yêu cầu
Liệt kê TẤT CẢ các mốc thời gian đã xác lập. Với mỗi mốc:
- event: tên sự kiện
- time: thời điểm (nếu ghi rõ) hoặc thứ tự timeline_order
- location: nơi xảy ra (nếu có)
- characters: nhân vật liên quan
- foreshadow: phục bút liên quan (nếu có)
- note: ghi chú thêm (nếu có)
Sắp xếp theo thứ tự thời gian tăng dần. Nếu timeline trống, trả items rỗng.
Trả JSON đúng schema: { events: [{event, time, location, characters, foreshadow, note}] }.`;
}

export const TIMELINE_PARSE_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          event: { type: "string" },
          time: { type: "string" },
          location: { type: "string" },
          characters: { type: "string" },
          foreshadow: { type: "string" },
          note: { type: "string" },
        },
        required: ["event"],
      },
    },
  },
  required: ["events"],
};

// ---------- Quan hệ nhân vật: trích xuất thành JSON cho graph ----------
export function buildRelationshipExtractPrompt({ genre, relationText }) {
  return `Bạn là QUAN HỆ QUẢN LÝ của xưởng viết tiểu thuyết. ${genreStyleLine(genre)} Hãy đọc tài liệu 03_QUAN_HE và trích xuất thành mạng lưới quan hệ nhân vật.

# 03_QUAN_HE
${relationText?.trim() || "(trống)"}

# Yêu cầu
- Liệt kê TẤT CẢ nhân vật có tên trong tài liệu.
- Liệt kê TẤT CẢ quan hệ giữa các cặp nhân vật.
- Mỗi quan hệ: source (nhân vật A), target (nhân vật B), type (quỹ vị/hữu/địch/lãng mạn/gia đình/thầy trò...), label (mô tả ngắn), intensity (mức độ quan trọng 1-5).
- Nếu quan hệ đa chiều (VD: vừa thù vừa yêu), tạo nhiều bản ghi.
Trả JSON đúng schema.`;
}

export const RELATIONSHIP_EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    nodes: {
      type: "array",
      items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "string" },
          target: { type: "string" },
          type: { type: "string" },
          label: { type: "string" },
          intensity: { type: "number" },
        },
        required: ["source", "target"],
      },
    },
  },
  required: ["nodes", "edges"],
};

// ---------- Team chat: prompt hệ thống theo vai + context bible ----------
export function buildTeamChatPrompt({ role, genre, bibleText, history, question }) {
  const historyBlock = history
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Tác giả" : role.name}: ${m.text}`)
    .join("\n\n");
  return `${role.system} ${genreStyleLine(genre)}

# BỘ TÀI LIỆU XƯỞNG (bible hiện tại)
${bibleText}

# Lịch sử hội thoại gần đây
${historyBlock || "(chưa có)"}

# Yêu cầu / câu hỏi của tác giả
${question}

Hãy trả lời trực tiếp, cụ thể, hữu ích — không lặp lại toàn bộ ngữ cảnh.`;
}
