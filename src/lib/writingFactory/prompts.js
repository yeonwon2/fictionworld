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
  { key: "tom_tat_hien_tai", file: "summaries/tom_tat_hien_tai.md", title: "Tóm Tắt Hiện Tại", role: "Biên tập nhất quán", icon: "summary" },
];

export const DOC_DEFS_BY_KEY = Object.fromEntries(DOC_DEFS.map((d) => [d.key, d]));

// ---------- Team AI: các vai trò trong xưởng ----------
export const TEAM_ROLES = [
  {
    key: "tong_bien_tap",
    name: "Tổng biên tập",
    emoji: "🎬",
    desc: "Giữ tông truyện, định hướng tổng thể, đánh giá chất lượng chương.",
    system: `Bạn là TỔNG BIÊN TẬP của một xưởng viết tiểu thuyết mạng. Bạn chịu trách nhiệm giữ đúng tông truyện, nhịp độ kể chuyện và định hướng tác giả. Bạn đánh giá thẳng thắn chất lượng bản thảo, đề xuất cải thiện về kịch tính, cảm xúc, nhịp, và kiểm tra cấu trúc tổng thể. Luôn trả lời bằng tiếng Việt, cụ thể, không lặp lại ngữ cảnh.`,
  },
  {
    key: "thiet_lap_su",
    name: "Thiết lập sư",
    emoji: "🌍",
    desc: "Chuyên thế giới quan: bối cảnh, luật lệ, văn hoá, địa danh.",
    system: `Bạn là THIẾT LẬP SƯ chuyên xây dựng và bảo toàn THẾ GIỚI QUAN của tiểu thuyết: bối cảnh địa lý, xã hội, văn hoá, chính trị, lực lượng, luật lệ, phép thuật/năng lực, thuật ngữ riêng. Bạn giữ cho thế giới luôn nhất quán với bộ tài liệu bible, phát hiện chỗ viết chệch và đề xuất bổ sung hợp lý. Luôn trả lời bằng tiếng Việt, cụ thể, bám tài liệu.`,
  },
  {
    key: "nhan_vat_quan_ly",
    name: "Quản lý nhân vật",
    emoji: "👤",
    desc: "Chuyên hồ sơ nhân vật: tính cách, động cơ, bí mật, giọng văn.",
    system: `Bạn là QUẢN LÝ NHÂN VẬT của một xưởng viết tiểu thuyết. Bạn nắm rõ hồ sơ, tính cách, mục tiêu, bí mật, mâu thuẫn nội tâm, giọng văn/xưng hô của từng nhân vật. Bạn đảm bảo nhân vật hành động và nói năng ĐÚNG tính cách mọi lúc, phát hiện chỗ "nhân vật lạc tính cách" và gợi ý cách sửa. Luôn trả lời bằng tiếng Việt, cụ thể.`,
  },
  {
    key: "phuc_but_quan_ly",
    name: "Phục bút quản lý",
    emoji: "🚩",
    desc: "Chuyên sổ phục bút (伏笔): cài đặt, hồi đáp, thời điểm.",
    system: `Bạn là PHỤC BÚT QUẢN LÝ — chuyên gia quản lý 伏笔 (cài đặt phục bút và hồi đáp) trong tiểu thuyết dài kỳ. Bạn duy trì sổ phục bút: mỗi phục bút có trạng thái (chưa cài / đã cài / đang treo / đã hồi đáp), thời điểm cài, dự kiến hồi đáp. Bạn gợi ý cài phục bút mới ở vị trí tự nhiên, nhắc khi nào cần hồi đáp để không quên, và đánh giá mức độ hợp lý. Luôn trả lời bằng tiếng Việt, cụ thể.`,
  },
  {
    key: "bien_tap_nhat_quan",
    name: "Biên tập nhất quán",
    emoji: "🔍",
    desc: "Rà soát mâu thuẫn: ngoại hình, xưng hô, timeline, sự kiện.",
    system: `Bạn là BIÊN TẬP NHẤT QUÁN của một xưởng viết tiểu thuyết. Nhiệm vụ của bạn là soát MÂU THUẪN giữa bản thảo chương và bộ tài liệu bible (quy tắc, thế giới, nhân vật, quan hệ, timeline, phục bút). Chỉ báo lỗi THẬT SỰ (đổi ngoại hình cố định, sai xưng hô, nhắc sự kiện chưa xảy ra, hành động trái tính cách, bỏ sót phục bút cần hồi đáp...). Mỗi lỗi nêu rõ mức độ nghiêm trọng, vị trí, và cách sửa đề xuất. Luôn trả lời bằng tiếng Việt, không báo lỗi mơ hồ.`,
  },
  {
    key: "tro_ly_tac_gia",
    name: "Trợ lý tác giả",
    emoji: "✍️",
    desc: "Hỗ trợ toàn diện mọi yêu cầu tự do của tác giả.",
    system: `Bạn là TRỢ LÝ TÁC GIẢ toàn diện của một xưởng viết tiểu thuyết. Tác giả có thể yêu cầu TỰ DO bất cứ điều gì: brainstorm ý tưởng, viết thử đoạn văn, gợi ý tình tiết, kiểm tra logic, mở rộng hoặc rút gọn bản thảo, chuyển thể văn phong... Bạn luôn dựa vào bộ tài liệu bible để trả lời chính xác, cụ thể và hữu ích. Luôn trả lời bằng tiếng Việt.`,
  },
];

export const TEAM_ROLE_BY_KEY = Object.fromEntries(TEAM_ROLES.map((r) => [r.key, r]));

// ---------- Bộ khung chung: dựng block "toàn bộ bible" để nhồi vào prompt ----------
export function buildBibleBlock(docsByKey) {
  const order = ["quy_tac_viet", "the_gioi", "nhan_vat", "quan_he", "dai_cuong", "fuc_but", "timeline", "tom_tat_hien_tai"];
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
- 04_DAI_CUONG: đại cương — tổng số chương dự kiến, các arc (tên, từ-chương-đến-chương, bước ngoặt chính), đại cương sự kiện cho vài chương đầu.
- 05_FUC_BUT: sổ phục bút — danh sách phục bút nên cài (mô tả, thời điểm cài, dự kiến hồi đáp, trạng thái "đang treo").
- 06_TIMELINE: dòng thời gian các sự kiện đã xác lập (sự kiện, thời điểm, nơi, nhân vật liên quan).
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
      "Soạn đại cương: tổng số chương dự kiến, các arc (tên, từ-chương-đến-chương, bước ngoặt chính), và đại cương sự kiện chi tiết cho các chương.",
    fuc_but:
      "Soạn sổ phục bút: mỗi phục bút có mô tả, thời điểm cài, dự kiến hồi đáp, trạng thái (chưa cài / đã cài / đang treo / đã hồi đáp).",
    timeline:
      "Soạn timeline: các sự kiện đã xác lập theo thứ tự thời gian — sự kiện, thời điểm, nơi, nhân vật liên quan.",
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

// ---------- Viết chương bám bible ----------
export function buildWriteChapterPrompt({
  genre,
  chapterTitle,
  chapterNumber,
  chapterGoal,
  bibleText,
  prevTail,
  orientation,
}) {
  return `Bạn là tác giả chính của một xưởng viết tiểu thuyết. ${genreStyleLine(genre)} TUYỆT ĐỐI không giải thích meta — chỉ viết văn chương hoàn chỉnh.

# BỘ TÀI LIỆU XƯỞNG (bible) — phải bám sát 100%
${bibleText}

# Mục tiêu của chương này
${chapterGoal?.trim() || "(chưa có — hãy viết chương nối tiếp tự nhiên theo đại cương và tóm tắt hiện tại)"}

# Đoạn cuối chương trước (nối mạch, giữ tông)
${prevTail?.trim() ? prevTail.trim() : "(chưa có — viết như mở đầu)"}

${orientation?.trim() ? `# Định hướng thêm của tác giả\n${orientation.trim()}` : ""}

# Yêu cầu bắt buộc
- Tuân thủ tuyệt đối 00_QUY_TAC_VIET (tông giọng, POV, từ cấm, xưng hô, giới hạn tiết lộ).
- Nhân vật hành động/đối thoại ĐÚNG hồ sơ trong 02_NHAN_VAT & 03_QUAN_HE (giọng văn, xưng hô đúng từng người).
- Địa danh, luật lệ, thuật ngữ ĐÚNG 01_THE_GIOI.
- Đảm bảo nhịp chương ~800-1200 từ, chia đoạn rõ ràng, kết chương có móc treo (hook) tự nhiên hoặc khoảnh khắc cảm xúc.
- Nếu hợp lý, cài 1 phục bút mới theo 05_FUC_BUT hoặc hồi đáp một phục bút đang treo.
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

# Yêu cầu cập nhật — chỉ trả những tài liệu CẦN THAY ĐỔI, tài liệu không đổi thì KHÔNG đưa vào kết quả:
- 06_TIMELINE: thêm các sự kiện mới của chương vào cuối timeline (đúng thứ tự), cập nhật trạng thái nếu có thay đổi.
- summaries/tom_tat_hien_tai.md: VIẾT MỚI tóm tắt hiện tại (thay hoàn toàn bản cũ) — nhân vật đang ở đâu, đang làm gì, xung đột leo thang thế nào, móc treo đang treo là gì.
- 05_FUC_BUT: thêm phục bút MỚI được cài trong chương (đánh dấu "đang treo"), và đánh dấu "đã hồi đáp" cho phục bút nào được hồi đáp trong chương này.
- 02_NHAN_VAT: cập nhật trạng thái thực tế của nhân vật nếu chương thay đổi đáng kể (thương, thức tỉnh, địa vị, lật mặt, quan hệ...).
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