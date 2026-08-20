// =============================================================================
// Xưởng Kịch Bản Game — Prompt builders
// Cùng nguyên tắc mô hình "xưởng" của WritingFactory: một đội AI đóng vai chuyên
// môn cùng quản lý một bộ tài liệu sống (bible) cho mỗi bộ truyện — nhưng chuyên
// viết KỊCH BẢN GAME. Danh sách LOẠI GAME được lấy ĐÚNG từ Xưởng Game
// (GAME_PRESENTATIONS trong src/lib/gameStudio/rpgThemes.js) — cùng một nguồn,
// không tự sinh danh sách riêng. Mỗi loại có bộ NGUYÊN TẮC KỊCH BẢN RIÊNG
// (GAME_SCRIPT_PRINCIPLES) mà AI bắt buộc tuân thủ; khi thêm xưởng/layout mới vào
// Xưởng Game thì loại mới tự xuất hiện và dùng nguyên tắc chung
// (GENERIC_SCRIPT_PRINCIPLES) cho tới khi được bổ sung nguyên tắc riêng.
// Các tài liệu được lưu ở bảng game_script_docs (doc_key) và luôn được nạp làm
// "trí nhớ dài hạn" khi lên tuyến / viết phân cảnh / kiểm tra nhất quán.
// =============================================================================
import { GAME_PRESENTATIONS } from "../gameStudio/rpgThemes";

// ---------- Nguyên tắc kịch bản riêng của từng loại game (khớp GAME_PRESENTATIONS) ----------
const GAME_SCRIPT_PRINCIPLES = {
  adventure: {
    principles: [
      "Kịch bản tính theo PHA ĐO (level/chương): mỗi pha đo = 1 mục tiêu gameplay + 1 bước tiến câu chuyện.",
      "Lựa chọn HÀNH ĐỘNG là trục chính: mỗi quyết định lớn phải đổi hướng diễn biến hoặc đổi tài nguyên/trạng thái nhân vật.",
      "Nhịp động-tĩnh xen kẽ: hành động (đấu/rượt đuổi/leo trèo) đan với tĩnh (khám phá, hội thoại, tiết lộ) — không quá 3 pha động liên tiếp.",
      "Set piece (cảnh bom tấn) đặt ở mở đầu, giữa và cuối; mỗi set piece phải đổi cách chơi hoặc leo thang nguy hiểm.",
      "Cutscene chỉ kể điều gameplay không kể được; mỗi cutscene ≤ 60 giây đọc và luôn chuyển sang gameplay.",
      "Nhân vật chính có động cơ rõ ràng; thế giới phải trả lời 'tại sao tôi phải qua pha đo này'.",
    ],
    docs: "Quy tắc: viết kịch bản theo pha đo — mỗi phân cảnh ghi rõ mục tiêu gameplay đi kèm, giữ nhịp động-tĩnh xen kẽ, set piece và cutscene ngắn.",
  },
  dialogue: {
    principles: [
      "Kịch bản là chuỗi CẢNH đọc/hiển thị: thoại (dialogue) + bối cảnh (narration) + chọn lựa (choices).",
      "Hội thoại là trục chính: mỗi lựa chọn thoại đổi thái độ NPC và có thể mở/khoá hội thoại hoặc cảnh sau.",
      "Chỉ số hảo cảm / cờ (flags) tích luỹ theo từng chương và quyết định tuyến mở khoá + kết thúc nhận được.",
      "Mỗi NPC có giọng thoại riêng, tuyệt đối nhất quán xưng hô (đối chiếu tài liệu nhân vật).",
      "Chọn lựa phải CÓ HỆ QUẢ thực tế (tăng/giảm hảo cảm, mở/khoá cờ), không phải chọn cho có.",
      "Cây kết thúc rõ ràng: mỗi tuyến ≥2 kết (tốt/xấu hoặc tốt/bình thường/xấu) do ngưỡng chỉ số quyết định.",
    ],
    docs: "Quy tắc: viết theo nhịp visual novel / trò chuyện NPC — thoại ngắn gọn, cảm xúc qua lời thoại + mô tả ngắn; mỗi màn nên có điểm rẽ hoặc thông tin mới.",
  },
  transmigration: {
    principles: [
      "Nhân vật chính BIẾT TRƯỚC kịch bản gốc (xuyên vào sách/phim/game) — kịch bản xoay quanh chênh lệch 'bản gốc vs hiện tại'.",
      "Phân loại rõ 'điểm bất biến' (không thể hoặc chống đổi) và 'điểm có thể sửa' — mỗi màn nêu rõ đang phá/thay đổi điều gì.",
      "Cờ cốt truyện: mỗi hành động chống lại bản gốc đặt cờ và làm cốt truyện lệch dần, tạo phản ứng dây chuyền.",
      "Quan hệ với nhân vật 'phản diện bản gốc' phải có tiến trình thuyết phục, không đổi thái độ tức thì.",
      "Hệ thống/cốt truyện phản ứng với sự thay đổi (cảnh báo, nhiệm vụ mới, ám chỉ nguy hiểm) — tạo áp lực sửa kịch bản.",
      "Kết thúc tuỳ mức 'lệch bản gốc': tránh kết cục gốc, tạo kết mới hoặc đổi kết gốc — không có kết 'miễn nhiễm' với hệ quả.",
    ],
    docs: "Quy tắc: viết theo xuyên sách/sửa kịch bản — ghi rõ điểm bất biến vs điểm sửa được, cờ thay đổi cốt truyện, hảo cảm nhân vật gốc.",
  },
  system: {
    principles: [
      "Cấu trúc theo NHIỆM VỤ (quest) + cấp bậc: mỗi pha đo có mục tiêu hệ thống giao, phần thưởng và hệ quả rõ ràng.",
      "Trọng sinh biết trước tương lai → kịch bản xoay quanh lợi thế 'biết trước' và hệ quả khi thay đổi tương lai.",
      "Thông báo hệ thống là công cụ kể chuyện: nhiệm vụ, cảnh báo, tiến độ — dùng có ý nghĩa, không lạm dụng.",
      "Phát triển cấp bậc/kỹ năng gắn với arc nhân vật, không tự dưng mạnh; mỗi bước mạnh lên phải có cái giá.",
      "Mỗi lựa chọn đầu tư (thời gian/tài nguyên) có lời-lỗ rõ ràng ở pha đo sau — người chơi cảm được quyết định của mình.",
      "Có đối thủ cũng biết trước hoặc học theo — tạo màn rượt đuổi tiến độ, không để người chơi thắng quá dễ.",
    ],
    docs: "Quy tắc: viết theo hệ thống/trọng sinh — mỗi pha đo ghi nhiệm vụ + phần thưởng, thông báo hệ thống có ý nghĩa, cạnh tranh tiến độ với đối thủ.",
  },
  detective: {
    principles: [
      "Kịch bản theo QUÁ TRÌNH ĐIỀU TRA: hiện trường → chứng cứ → phỏng vấn nghi phạm → suy luận → đối chất.",
      "Chứng cứ phải CÔNG BẰNG: người chơi có thể thu thập đủ trước khi kết luận; không giấu manh mối quyết định sau một nhánh ngẫu nhiên.",
      "Mỗi nghi phạm có động cơ + cơ hội + hành tung riêng; lời khai mâu thuẫn chính là manh mối.",
      "Kết luận sai phải có hậu quả (bắt nhầm, bỏ lọt thủ phạm) nhưng vẫn cho sửa sai bằng chứng mới.",
      "Hồi tưởng/flashback dùng để lấp lỗ hổng logic, không dùng để trình bày sẵn đáp án.",
      "Hồ sơ vụ án tích luỹ: bảng chứng cứ cập nhật theo tiến trình; kết luận và kết thúc phụ thuộc chứng cứ đã thu thập.",
    ],
    docs: "Quy tắc: viết theo hồ sơ/phá án — mỗi phân cảnh ghi chứng cứ + manh mối thu được, nghi phạm và lời khai mâu thuẫn, bước suy luận.",
  },
  palace: {
    principles: [
      "Kịch bản theo THỨ BẬC + PHE PHÁI: địa vị (sủng ái/cấp bậc) thay đổi theo quyết định và mưu kế.",
      "Mưu kế DÀI HƠI: mỗi âm mưu có chuẩn bị, nghi phạm và hậu quả ở các màn sau — không giải quyết tức thì.",
      "Quyết định phe phái: chọn phe / giữ trung lập đổi bộ mặt kịch bản và mở/khoá sự kiện.",
      "Lời ăn tiếng nói, cử chỉ, lễ nghi là vũ khí — thoại phải thể hiện địa vị và dụng ý, không lộng ngôn.",
      "Đối thủ thông minh: họ nhớ lỗi sai của người chơi và trả đũa, cạm bẫy đặt theo điểm yếu đã lộ.",
      "Kết thúc theo địa vị cuối: sống sót / được sủng / đăng cơ / bị diệt — do chuỗi quyết định và mưu kế quyết định.",
    ],
    docs: "Quy tắc: viết theo cung đấu/hậu cung — ghi địa vị sủng ái, phe phái, mưu kế dài hơi, lời thoại thể hiện địa vị, kết theo địa vị cuối.",
  },
  rebirth: {
    principles: [
      "Kịch bản theo NIÊN ĐẠI LÀM GIÀU: giai đoạn tích vốn → đầu tư → cạnh tranh → xây đế chế.",
      "Trọng sinh biết trước cơ hội giá rẻ / khủng hoảng → xoay quanh 'quyết định khi biết trước' và hệ quả thay đổi dòng thời gian.",
      "Vốn (tài chính) là chỉ số kể chuyện: mỗi quyết định đầu tư có lời-lỗ, có cú sốc thị trường bất ngờ làm đảo lộn kế hoạch.",
      "Cạnh tranh trên THƯƠNG TRƯỜNG: thâu tóm, chiêu nhân tài, phá giá, chính sách — không dùng bạo lực tầm thường.",
      "Quan hệ (đối tác, gia đình, nhân tài) đổi theo cách làm ăn: quá máu lạnh thì cô đơn, quá nương tay thì thua cuộc.",
      "Kết thúc theo quy mô đế chế + uy tín: bá chủ / truyền nhân / phá sản nhưng giữ được người thân — phụ thuộc chuỗi quyết định.",
    ],
    docs: "Quy tắc: viết theo trọng sinh/làm giàu — ghi niên đại tích vốn, cơ hội biết trước, thương chiến với đối thủ, lời-lỗ từng quyết định.",
  },
};

// Nguyên tắc chung cho loại game MỚI thêm vào Xưởng Game sau này (chưa có nguyên tắc riêng)
const GENERIC_SCRIPT_PRINCIPLES = {
  principles: [
    "Mỗi phân cảnh phải đẩy câu chuyện lên và có mục tiêu gameplay/cảm xúc rõ ràng.",
    "Rẽ nhánh phải có hệ quả thực tế (cờ/chỉ số/trạng thái), không có nhánh chết vô nghĩa.",
    "Nhịp pha đo xen kẽ động-tĩnh; cao trào đặt đúng chỗ, không dồn dập hay kéo dài vô lối.",
    "Nhân vật nhất quán với bộ tài liệu, xưng hô chuẩn, không lạc tính cách.",
    "Mỗi tuyến có ≥2 kết thúc phụ thuộc quyết định người chơi, không có kết 'mặc định'.",
    "Cập nhật bộ tài liệu (đặc biệt Tóm Tắt Hiện Tại) sau mỗi màn để mạch kịch bản không lệch.",
  ],
  docs: "Quy tắc: viết theo nguyên tắc chung của xưởng — đẩy câu chuyện, rẽ nhánh có hệ quả, nhịp xen kẽ, nhân vật nhất quán, đa kết thúc.",
};

// ---------- Định nghĩa loại game — tự đồng bộ với Xưởng Game (GAME_PRESENTATIONS) ----------
export const GAME_TYPE_DEFS = Object.entries(GAME_PRESENTATIONS).map(([key, p]) => {
  const spec = GAME_SCRIPT_PRINCIPLES[key] || GENERIC_SCRIPT_PRINCIPLES;
  return {
    key,
    label: p.name,
    short: p.name.split(" · ")[0],
    emoji: p.icon,
    desc: p.description,
    principles: spec.principles,
    docs: spec.docs,
  };
});

export const GAME_TYPE_BY_KEY = Object.fromEntries(GAME_TYPE_DEFS.map((t) => [t.key, t]));

// doc_key → tên file + tiêu đề hiển thị (bộ tài liệu sống của xưởng kịch bản game)
export const GAME_SCRIPT_DOC_DEFS = [
  { key: "quy_tac", file: "00_QUY_TAC_KICH_BAN.md", title: "Quy Tắc Kịch Bản", role: "Biên kịch chính" },
  { key: "the_gioi", file: "01_THE_GIOI_GAME.md", title: "Thế Giới & Địa Điểm", role: "Thiết lập sư game" },
  { key: "nhan_vat", file: "02_NHAN_VAT_NPC.md", title: "Nhân Vật & NPC", role: "Quản lý nhân vật game" },
  { key: "tuyen", file: "03_TUYEN_KICH_BAN.md", title: "Tuyến & Điều Kiện Mở Khoá", role: "Nhà thiết kế tuyến" },
  { key: "pha_do", file: "04_PHA_DO_BEATS.md", title: "Pha Đo & Beats", role: "Đạo diễn kịch bản" },
  { key: "flags", file: "05_FLAGS_CHI_SO.md", title: "Cờ, Chỉ Số & Trạng Thái", role: "Kỹ sư hệ thống kịch bản" },
  { key: "tom_tat", file: "summaries/tom_tat_tuyen.md", title: "Tóm Tắt Hiện Tại", role: "Biên tập nhất quán" },
];

/** @type {Record<string, { key: string; file: string; title: string; role: string }>} */
export const GAME_SCRIPT_DOC_BY_KEY = Object.fromEntries(GAME_SCRIPT_DOC_DEFS.map((d) => [d.key, d]));

// ---------- Team AI: vai trò trong xưởng kịch bản game ----------
export const GAME_TEAM_ROLES = [
  {
    key: "bien_kich",
    name: "Biên kịch chính",
    emoji: "✒️",
    desc: "Giữ tông kịch bản, nhịp pha đo, đảm bảo AI bám nguyên tắc loại game đang chọn.",
    system: `Bạn là BIÊN KỊCH CHÍNH của một xưởng viết kịch bản game. Bạn nắm chắc nguyên tắc kịch bản của LOẠI GAME đang chọn (theo bộ NGUYÊN TẮC KỊCH BẢN RIÊNG của từng loại trong xưởng — cùng danh sách loại game của Xưởng Game) và đảm bảo mọi phân cảnh tuân thủ đúng. Bạn đánh giá thẳng thắn chất lượng kịch bản, đề xuất cải thiện nhịp, thoại, rẽ nhánh và hệ quả lựa chọn. Luôn trả lời bằng tiếng Việt, cụ thể, bám tài liệu.`,
  },
  {
    key: "thiet_ke_tuyen",
    name: "Nhà thiết kế tuyến",
    emoji: "🛤️",
    desc: "Chuyên cây tuyến kịch bản: branch, điều kiện mở khoá, cờ, kết thúc.",
    system: `Bạn là NHÀ THIẾT KẾ TUYẾN (narrative designer) của xưởng kịch bản game. Bạn thiết kế cây tuyến kịch bản: mỗi tuyến (route/branch) có điều kiện mở khoá, cờ và chỉ số tích luỹ, điểm rẽ, và cây kết thúc. Bạn đảm bảo mọi rẽ nhánh có hệ quả thực tế, không có nhánh 'chết' (dead-end vô nghĩa). Luôn trả lời bằng tiếng Việt, cụ thể.`,
  },
  {
    key: "dao_dien",
    name: "Đạo diễn kịch bản",
    emoji: "🎬",
    desc: "Chuyên nhịp pha đo: set piece, cutscene, căng-xả, đặt đúng chỗ cao trào.",
    system: `Bạn là ĐẠO DIỄN KỊCH BẢN của một xưởng kịch bản game. Bạn chịu trách nhiệm NHỊP PHA ĐO: xen kẽ động-tĩnh, đặt set piece và cao trào đúng chỗ, cutscene ngắn gọn, nhịp căng thẳng hình sin. Bạn chỉ ra chỗ kịch bản dài dòng / đứt nhịp / cao trào đặt sai và đề xuất cách sửa. Luôn trả lời bằng tiếng Việt, cụ thể.`,
  },
  {
    key: "ky_su_he_thong",
    name: "Kỹ sư hệ thống kịch bản",
    emoji: "🔧",
    desc: "Chuyên cờ (flags), chỉ số (affection/stamina/sanity), vật phẩm và điều kiện logic.",
    system: `Bạn là KỸ SƯ HỆ THỐNG KỊCH BẢN của một xưởng kịch bản game. Bạn quản lý mọi BIẾN SỐ KỊCH BẢN: cờ (flags), chỉ số (affection, sanity, tài nguyên), vật phẩm, và điều kiện mở khoá. Bạn kiểm tra logic: lựa chọn có làm thay đổi đúng cờ không, điều kiện mở khoá có khả thi không, có nhánh không bao giờ đạt tới không. Luôn trả lời bằng tiếng Việt, cụ thể.`,
  },
  {
    key: "bien_tap_nhat_quan",
    name: "Biên tập nhất quán",
    emoji: "🔍",
    desc: "Rà mâu thuẫn: tính cách NPC, xưng hô, timeline tuyến, cờ bị bỏ quên.",
    system: `Bạn là BIÊN TẬP NHẤT QUÁN của một xưởng kịch bản game. Bạn soát MÂU THUẪN giữa phân cảnh và bộ tài liệu: nhân vật lạc tính cách, xưng hô sai, timeline tuyến lệch, cờ đã cài nhưng không bao giờ được dùng, vật phẩm bịa không có trong túi đồ, kết thúc không đạt được do thiếu điều kiện. Chỉ báo lỗi THẬT SỰ, nêu rõ mức độ, vị trí và cách sửa. Luôn trả lời bằng tiếng Việt, không báo lỗi mơ hồ.`,
  },
];

export const GAME_TEAM_ROLE_BY_KEY = Object.fromEntries(GAME_TEAM_ROLES.map((r) => [r.key, r]));

// ---------- Bộ khung chung: dựng block "toàn bộ tài liệu kịch bản" ----------
export function buildGameScriptBlock(docsByKey) {
  const parts = [];
  for (const def of GAME_SCRIPT_DOC_DEFS) {
    const doc = docsByKey?.[def.key];
    const content = doc?.content?.trim();
    if (!content) continue;
    parts.push(`## ${def.title} (${def.file})\n${content}`);
  }
  if (!parts.length) return "(Bộ tài liệu kịch bản game đang trống — hãy bấm 'Khởi tạo Xưởng' trước.)";
  return parts.join("\n\n");
}

// Dựng block "nguyên tắc kịch bản loại game" để nhồi vào mọi prompt.
function gameTypePrinciplesBlock(gameType) {
  const t = GAME_TYPE_BY_KEY[gameType] || GAME_TYPE_DEFS[0];
  return `# LOẠI GAME: ${t.label} (${t.emoji})\n${t.desc}\n\n## NGUYÊN TẮC KỊCH BẢN BẮT BUỘC TUÂN THỦ\n${t.principles.map((p) => `- ${p}`).join("\n")}`;
}

// Bộ quy chuẩn ĐỊNH DẠNG KỊCH BẢN GAME — kịch bản game KHÔNG phải văn xuôi truyện.
// Nhồi vào mọi prompt lên dàn / viết / sửa / kiểm tra để AI luôn xuất đúng định dạng.
export const GAME_SCRIPT_FORMAT_GUIDE = `# ĐỊNH DẠNG KỊCH BẢN GAME (bắt buộc)
Kịch bản game KHÔNG phải văn xuôi tiểu thuyết. Mỗi phân cảnh phải viết theo cấu trúc chuẩn dưới đây:

1) TIÊU ĐỀ CẢNH (slugline) — dòng đầu tiên, đúng mẫu:
   SCENE <số> — <NỘI/NGOẠI> | <ĐỊA ĐIỂM> — <THỜI GIAN>
   (VD: SCENE 3 — NGOẠI | Cổng thành phương Bắc — ĐÊM)

2) MÔ TẢ HÀNH ĐỘNG (stage direction) — câu ngắn, hiện thực, thì hiện tại, mô tả điều NHÌN THẤY:
   (VD: Linh kéo Tố vào bóng tối. Mưa bắt đầu rơi lộp độp trên nóc nhà.)

3) CHỈ DẪN KỸ THUẬT — đặt trong ngoặc vuông, viết hoa:
   [SFX: sấm] [MUSIC: trống căng] [CAMERA: cận cảnh tay Linh] [TRANSITION: fade to black]

4) THOẠI — tên nhân vật VIẾT HOA trên dòng riêng; hành động/cảm xúc trong ngoặc đơn:
   LINH: (siết tay thành nắm) Trời sắp đổ mưa.
   TỐ: (lo lắng nhìn ra cổng) Nghe nói quân địch đã cắt đường tiếp tế.

5) THẺ CỜ / CHỈ SỐ / VẬT PHẨM — gắn ngay chỗ xảy ra để hệ thống áp dụng:
   Cờ:      {#nghi_ngo=true}   /  {#nghi_ngo=false}
   Chỉ số:  [+hảo cảm Tố +5]   /  [-san 10]  /  [+vàng 200]
   Vật phẩm: [+nhẫn_mẹ_linh]

6) LỰA CHỌN (choice block) — cuối cảnh nếu có rẽ nhánh; mỗi lựa chọn ghi rõ HIỆU ỨNG + ĐÍCH:
   ► CHOICE:
     1) Tin lời phản diện.  {#nghi_ngo=true}  → SCENE 5 (tuyến: tuyen_phan_dien)
     2) Chống lại.          [-hảo cảm Trưởng lão -5]  → SCENE 6 (tuyến hiện tại)

7) KẾT CẢNH — luôn kết bằng: LỰA CHỌN (nếu rẽ nhánh) HOẶC chỉ dẫn chuyển cảnh:
   [CUT TO: SCENE ...] / [TRANSITION: cut]

CẤM: kể chuyện kiểu văn xuôi/truyện (tâm trạng mô tả dài dòng, hồi tưởng đứng im, độc thoại nội tâm dài);
mọi cảm xúc/ý nghĩ nhân vật phải lộ ra qua HÀNH ĐỘNG + THOẠI, không qua người kể chuyện.`;

function scriptFormatBlock() {
  return GAME_SCRIPT_FORMAT_GUIDE;
}

// ---------- Khởi tạo xưởng: sinh toàn bộ tài liệu từ loại game + ý tưởng ----------
export function buildGameBootstrapPrompt({ gameType, idea, notes, directionBlock }) {
  const t = GAME_TYPE_BY_KEY[gameType] || GAME_TYPE_DEFS[0];
  return `Bạn là BIÊN KỊCH CHÍNH điều hành một XƯỞNG VIẾT KỊCH BẢN GAME chuyên nghiệp. Game master vừa giao ý tưởng và cần bạn khởi tạo TOÀN BỘ bộ tài liệu kịch bản cho xưởng.

${gameTypePrinciplesBlock(gameType)}

# Định hướng của tác giả
${directionBlock || "(chưa có)"}

# Ý tưởng / bối cảnh của tác giả
"""${idea || "(trống — hãy dựng khung chuẩn cho loại game này, có thể chỉnh sau)"}"""

${notes?.trim() ? `# Ghi chú thêm\n${notes.trim()}` : ""}

Hãy trả về TOÀN BỘ ${GAME_SCRIPT_DOC_DEFS.length} tài liệu, MỖI tài liệu là một chuỗi Markdown hoàn chỉnh (đầy đủ tiêu đề #, gạch đầu dòng, bảng khi cần). Yêu cầu:
- 00_QUY_TAC_KICH_BAN: quy tắc viết kịch bản game — TÓM TẮT các nguyên tắc kịch bản của loại game ${t.label} nêu trên, cộng với QUY CHUẨN ĐỊNH DẠNG KỊCH BẢN GAME: tông giọng, cách viết thoại (tên nhân vật hoa + ngoặc đơn chỉ dẫn), slugline SCENE, mô tả hành động, chỉ dẫn kỹ thuật (SFX/MUSIC/CAMERA/TRANSITION), quy tắc gắn cờ/chỉ số ({#flag=...}, [+stat ±n]) và viết khối LỰA CHỌN kèm hiệu ứng + đích nhánh; cộng quy tắc riêng của game này.
- 01_THE_GIOI_GAME: thế giới game — bối cảnh, địa lý, bản đồ vùng, phe phái/lực lượng, luật lệ, công nghệ/phép thuật, kinh tế, thuật ngữ riêng, địa điểm quan trọng (mỗi địa điểm 1 mục với công dụng kể chuyện).
- 02_NHAN_VAT_NPC: nhân vật — nhân vật chính (điều khiển được), party/đồng hành, NPC quan trọng, phản diện (mỗi người: thân phận, tính cách, động cơ, bí mật, giọng thoại, vai trò kể chuyện).
- 03_TUYEN_KICH_BAN: các tuyến kịch bản (route/branch) đề xuất — mỗi tuyến: tên, mô tả ngắn, điều kiện mở khoá, nhân vật trọng tâm, loại kết thúc dự kiến.
- 04_PHA_DO_BEATS: cấu trúc pha đo / beats — số pha đo dự kiến, các hồi (act) lớn, mỗi pha đo: mục tiêu gameplay + bước tiến câu chuyện, cao trào và set piece nằm ở đâu.
- 05_FLAGS_CHI_SO: các biến số kịch bản — cờ (flags), chỉ số (affection/sanity/tài nguyên...), vật phẩm quan trọng, điều kiện mở khoá cụ thể, ảnh hưởng của từng chỉ số lên tuyến/kết thúc.
- summaries/tom_tat_tuyen.md: tóm tắt hiện tại — trạng thái câu chuyện NGAY BÂY GIỜ trên từng tuyến (đang ở pha đo nào, nhân vật đang ở đâu, xung đột leo thang thế nào, cờ nào đã bật) để viết phân cảnh tiếp theo không lệch.

Trả JSON đúng schema: { docs: { quy_tac: string, the_gioi: string, nhan_vat: string, tuyen: string, pha_do: string, flags: string, tom_tat: string } }.`;
}

export const GAME_BOOTSTRAP_SCHEMA = {
  type: "object",
  properties: {
    docs: {
      type: "object",
      properties: Object.fromEntries(GAME_SCRIPT_DOC_DEFS.map((d) => [d.key, { type: "string" }])),
      required: GAME_SCRIPT_DOC_DEFS.map((d) => d.key),
    },
  },
  required: ["docs"],
};

// ---------- Sinh / tái sinh MỘT tài liệu ----------
export function buildGameDocGenPrompt({ key, gameType, idea, currentDoc, note }) {
  const def = GAME_SCRIPT_DOC_BY_KEY[key];
  const specifics = {
    quy_tac: "Soạn quy tắc kịch bản: tóm tắt nguyên tắc loại game + QUY CHUẨN ĐỊNH DẠNG KỊCH BẢN GAME (slugline SCENE, thoại tên hoa + ngoặc đơn, mô tả hành động, chỉ dẫn SFX/MUSIC/CAMERA/TRANSITION, thẻ cờ {#flag}, [+stat ±n], khối LỰA CHỌN kèm hiệu ứng + đích nhánh), độ dài phân cảnh hợp loại, cách dùng cờ/chỉ số trong kịch bản, quy tắc riêng của game này.",
    the_gioi: "Soạn thế giới game: bối cảnh, địa lý, bản đồ vùng, phe phái, luật lệ, công nghệ/phép thuật, kinh tế, thuật ngữ, địa điểm quan trọng kèm công dụng kể chuyện.",
    nhan_vat: "Soạn nhân vật: chính/party/NPC/phản diện — thân phận, tính cách, động cơ, bí mật, giọng thoại, vai trò kể chuyện.",
    tuyen: "Soạn tuyến kịch bản: mỗi tuyến tên + mô tả + điều kiện mở khoá + nhân vật trọng tâm + loại kết thúc.",
    pha_do: "Soạn cấu trúc pha đo/beats: hồi lớn, mỗi pha đo ghi mục tiêu gameplay + bước tiến câu chuyện, vị trí cao trào/set piece.",
    flags: "Soạn biến số kịch bản: cờ, chỉ số, vật phẩm, điều kiện mở khoá cụ thể, ảnh hưởng lên tuyến/kết thúc.",
    tom_tat: "Soạn tóm tắt hiện tại: trạng thái câu chuyện trên từng tuyến NGAY BÂY GIỜ để viết tiếp không lệch.",
  };
  return `Bạn là ${def.role} của một xưởng viết kịch bản game.

${gameTypePrinciplesBlock(gameType)}

# Ý tưởng / bối cảnh gốc
"""${idea || "(trống — dựng khung chuẩn cho loại game này, có thể chỉnh sau)"}"""

${currentDoc?.trim() ? `# Tài liệu hiện tại (giữ phần tốt, sửa/nâng cấp theo góp ý)\n${currentDoc.trim()}` : ""}

# Yêu cầu chuyên môn
${specifics[key]}

# Góp ý của tác giả
${note?.trim() || "(không có — tự làm cho hay và đầy đủ)"}

Chỉ trả nội dung Markdown của tài liệu này, không thêm lời dẫn ngoài.`;
}

// ---------- Lên tuyến kịch bản (route plan) ----------
export function buildRoutePlannerPrompt({ gameType, docsText, targetRoutes }) {
  return `Bạn là NHÀ THIẾT KẾ TUYẾN của một xưởng viết kịch bản game.

${gameTypePrinciplesBlock(gameType)}

# BỘ TÀI LIỆU KỊCH BẢN HIỆN TẠI
${docsText}

# Yêu cầu
Lập kế hoạch ${targetRoutes || 3} TUYẾN KỊCH BẢN cho game này. Mỗi tuyến:
- key: mã tuyến (chữ thường không dấu, VD: "tuyen_linh_muc", "tuyen_hoi_thao")
- name: tên tuyến (tiếng Việt)
- color: mã màu hex dùng để vẽ timeline tuyến
- description: mô tả storyline của tuyến (2–3 câu)
- unlock_condition: điều kiện mở khoá tuyến (cờ / chỉ số / quyết định nào cần đạt)
- ending_type: loại kết thúc dự kiến (tốt / bình thường / xấu / kết mở)
- focus_characters: nhân vật trọng tâm của tuyến
Các tuyến phải nhất quán với 03_TUYEN_KICH_BAN và 05_FLAGS_CHI_SO trong bộ tài liệu. Nếu chưa có tài liệu, hãy dựa vào loại game để đề xuất tuyến hợp lý.
Trả JSON đúng schema.`;
}

export const GAME_ROUTE_PLAN_SCHEMA = {
  type: "object",
  properties: {
    routes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          name: { type: "string" },
          color: { type: "string" },
          description: { type: "string" },
          unlock_condition: { type: "string" },
          ending_type: { type: "string" },
          focus_characters: { type: "string" },
        },
        required: ["key", "name", "description"],
      },
    },
  },
  required: ["routes"],
};

// ---------- Lên dàn phân cảnh (screenplay beats) cho một tuyến ----------
export function buildSceneOutlinePrompt({ gameType, docsText, route, sceneGoal, prevScene, count }) {
  const prevBlock = prevScene
    ? `# Phân cảnh trước đó (nối mạch)\n- Tiêu đề: ${prevScene.title}\n- Loại: ${prevScene.scene_type || "?"}\n- Tóm tắt: ${(prevScene.content || "").slice(0, 600)}`
    : "(đây là phân cảnh ĐẦU TIÊN của tuyến)";
  return `Bạn là ĐẠO DIỄN KỊCH BẢN của một xưởng viết kịch bản game. Bạn lên DÀN THEO BEAT (screenplay beats) — KHÔNG viết văn xuôi, chỉ phác khung từng phân cảnh để biên kịch viết sau.

${gameTypePrinciplesBlock(gameType)}

${scriptFormatBlock()}

# BỘ TÀI LIỆU KỊCH BẢN HIỆN TẠI
${docsText}

# TUYẾN KỊCH BẢN: ${route?.name || route?.route_key || "?"}
${route?.description ? `- Mô tả: ${route.description}` : ""}

${prevBlock}

# Mục tiêu của đoạn kịch bản tiếp theo
${sceneGoal?.trim() || "(chưa có — tiếp tục tự nhiên theo tuyến + tóm tắt hiện tại)"}

# Yêu cầu
Lên dàn ${count || 5} PHÂN CẢNH (scene outline / beat) cho đoạn này, mỗi phân cảnh:
- title: tiêu đề ngắn
- scene_type: loại phân cảnh theo loại game (adventure: "hành động" / "khám phá" / "đối thoại" / "set piece"; dialogue: "đối thoại" / "chọn lựa" / "CG"; transmigration: "chệch bản gốc" / "mưu kế" / "cảnh báo"; system: "nhiệm vụ" / "thăng cấp" / "cạnh tranh"; detective: "hiện trường" / "phỏng vấn" / "suy luận" / "đối chất"; palace: "hậu cung" / "mưu kế" / "đấu khẩu" / "sự kiện"; rebirth: "đầu tư" / "thương chiến" / "khủng hoảng" / "đối tác"; ...)
- goal: MỤC ĐÍCH KỊCH BẢN của cảnh — beat đẩy chuyện gì (thông tin mới / đe dọa / quyết định / tiết lộ / thay đổi mối quan hệ / chốt hạ đau) — 1 câu
- location: địa điểm (nếu có)
- characters: nhân vật tham gia
- foreshadow: phục bút / chi tiết cần cài hoặc hồi đáp (nếu có)
- choice_hint: nếu cảnh có LỰA CHỌN rẽ nhánh — liệt kê từng lựa chọn kèm HIỆU ỨNG cờ/chỉ số ({#flag}, [+stat ±n]) và ĐÍCH (SCENE/tuyến tiếp theo)
Phân cảnh đầu phải nối mạch với phân cảnh trước; phân cảnh cuối để lại móc câu (hook). Bám sát 00_QUY_TAC_KICH_BAN, 05_FLAGS_CHI_SO và nguyên tắc loại game — mọi cờ/chỉ số trong choice_hint phải nằm trong tài liệu 05_FLAGS_CHI_SO.
Trả JSON đúng schema.`;
}

export const GAME_SCENE_OUTLINE_SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          scene_type: { type: "string" },
          goal: { type: "string" },
          location: { type: "string" },
          characters: { type: "string" },
          foreshadow: { type: "string" },
          choice_hint: { type: "string" },
        },
        required: ["title", "scene_type", "goal"],
      },
    },
  },
  required: ["scenes"],
};

// ---------- Viết phân cảnh kịch bản hoàn chỉnh (đúng định dạng kịch bản game) ----------
export function buildSceneWritePrompt({ gameType, docsText, route, outline, prevScene, targetWords = 0 }) {
  const lengthRule =
    targetWords && Number(targetWords) > 0
      ? `- Độ dài: khoảng ${targetWords} từ kịch bản hoàn chỉnh.`
      : "- Độ dài: phù hợp loại phân cảnh (thoại vừa đủ, mô tả hành động ngắn, không dài dòng).";
  return `Bạn là BIÊN KỊCH CHÍNH của một xưởng viết kịch bản game. Hãy viết PHÂN CẢNH kịch bản game hoàn chỉnh — đúng định dạng kịch bản, TUYỆT ĐỐI không giải thích meta, không kể văn xuôi truyện. Chỉ trả nội dung kịch bản.

${gameTypePrinciplesBlock(gameType)}

${scriptFormatBlock()}

# BỘ TÀI LIỆU KỊCH BẢN HIỆN TẠI
${docsText}

# TUYẾN KỊCH BẢN: ${route?.name || route?.route_key || "?"}

# DÀN PHÂN CẢNH (beat — bám sát 100%)
- Tiêu đề: ${outline?.title || "(chưa có)"}
- Loại: ${outline?.scene_type || "đối thoại"}
- Mục đích kịch bản: ${outline?.goal || "(chưa có)"}
- Địa điểm: ${outline?.location || "(chưa có)"}
- Nhân vật: ${outline?.characters || "(chưa có)"}
${outline?.foreshadow ? `- Phục bút: ${outline.foreshadow}` : ""}
${outline?.choice_hint ? `- Lựa chọn (choice block): ${outline.choice_hint}` : ""}

${prevScene ? `# Phân cảnh trước đó (nối mạch)\n- Tiêu đề: ${prevScene.title}\n- Tóm tắt: ${(prevScene.content || "").slice(0, 800)}` : "(đây là phân cảnh đầu tiên của tuyến)"}

# Yêu cầu kịch bản
- ĐÚNG ĐỊNH DẠNG KỊCH BẢN GAME theo quy chuẩn trên: slugline "SCENE n — NỘI/NGOẠI | Địa điểm — Thời gian", mô tả hành động ngắn thì hiện tại, thoại "TÊN: (chỉ dẫn) lời thoại", chỉ dẫn kỹ thuật [SFX]/[MUSIC]/[CAMERA]/[TRANSITION] khi cần.
- Nếu dàn có lựa chọn: kết cảnh bằng khối "► CHOICE:" — mỗi lựa chọn ghi HIỆU ỨNG cờ/chỉ số ({#flag=...}, [+stat ±n]) và ĐÍCH (SCENE/tuyến tiếp theo). Chỉ dùng cờ/chỉ số có trong 05_FLAGS_CHI_SO.
- Gắn thẻ cờ/chỉ số {#...}, [+...] NGAY tại dòng xảy ra tác động trong cảnh.
- Tuân thủ 00_QUY_TAC_KICH_BAN + NGUYÊN TẮC LOẠI GAME (nhịp pha đo, hệ quả lựa chọn, căng-xả...).
- Nhân vật hành động/đối thoại ĐÚNG hồ sơ trong 02_NHAN_VAT_NPC; địa danh/luật lệ ĐÚNG 01_THE_GIOI_GAME.
- ${lengthRule}
- Cài phục bút / hồi đáp theo dàn; không mâu thuẫn 04_PHA_DO_BEATS và summaries/tom_tat_tuyen.md.
Chỉ trả nội dung kịch bản phân cảnh, không lời dẫn ngoài.`;
}

// ---------- Sửa phân cảnh theo góp ý ----------
export function buildSceneRevisionPrompt({ gameType, docsText, route, outline, currentContent, feedback }) {
  return `Bạn là BIÊN KỊCH CHÍNH của một xưởng viết kịch bản game. Game master vừa xem phân cảnh và muốn SỬA theo góp ý. Nhiệm vụ: viết lại TOÀN BỘ phân cảnh, GIỮ phần hay, sửa đúng các điểm được góp ý. TUYỆT ĐỐI không giải thích meta — chỉ trả kịch bản hoàn chỉnh.

${gameTypePrinciplesBlock(gameType)}

${scriptFormatBlock()}

# BỘ TÀI LIỆU KỊCH BẢN HIỆN TẠI
${docsText}

# TUYẾN: ${route?.name || route?.route_key || "?"} — Phân cảnh "${outline?.title || "(chưa có tiêu đề)"}"

# KỊCH BẢN HIỆN TẠI (cần sửa)
"""${currentContent}"""

# GÓP Ý CỦA TÁC GIẢ (bám sát từng ý)
${feedback}

# Yêu cầu
- Sửa đúng từng điểm góp ý, phần khác giữ nguyên chất lượng.
- Giữ TUYỆT ĐỐI định dạng kịch bản game (slugline SCENE / thoại "TÊN: (chỉ dẫn)" / mô tả hành động / [SFX]/[MUSIC]/[TRANSITION] / thẻ {#flag}/[+stat] / khối ► CHOICE kèm hiệu ứng + đích), tuân thủ nguyên tắc loại game.
- Không làm mâu thuẫn với bộ tài liệu (nhân vật, thế giới, cờ/chỉ số, pha đo).
Chỉ trả nội dung kịch bản phân cảnh, không lời dẫn ngoài.`;
}

// ---------- Kiểm tra nhất quán phân cảnh với bộ tài liệu ----------
export function buildGameConsistencyPrompt({ gameType, docsText, sceneContent }) {
  return `Bạn là BIÊN TẬP NHẤT QUÁN của xưởng viết kịch bản game. So sánh phân cảnh vừa viết với BỘ TÀI LIỆU KỊCH BẢN + QUY CHUẨN ĐỊNH DẠNG KỊCH BẢN, phát hiện mâu thuẫn và vi phạm THẬT SỰ.

${gameTypePrinciplesBlock(gameType)}

${scriptFormatBlock()}

# BỘ TÀI LIỆU KỊCH BẢN
${docsText}

# PHÂN CẢNH VỪA VIẾT
"""${sceneContent}"""

# Yêu cầu
Chỉ báo lỗi thật sự:
- SAI ĐỊNH DẠNG: không có slugline SCENE, thoại thiếu tên nhân vật hoa, viết theo văn xuôi truyện (kể tâm trạng dài, người kể chuyện xen vào), không có chỉ dẫn kỹ thuật khi cần, lựa chọn thiếu hiệu ứng/đích.
- SAI LOGIC CỜ/CHỈ SỐ: thẻ {#flag}/[+stat] dùng tên KHÔNG CÓ trong 05_FLAGS_CHI_SO, hiệu ứng mâu thuẫn (vd cài flag rồi phủ nhận trong cùng cảnh), đích nhánh trỏ tới SCENE/tuyến không tồn tại.
- SAI NỘI DUNG: nhân vật lạc tính cách/giọng thoại, xưng hô sai, địa danh/luật lệ sai, timeline tuyến lệch, phục bút cài mà không hồi đáp, kết thúc không đạt được do thiếu điều kiện, vi phạm nguyên tắc loại game.
Mỗi lỗi: severity ("nghiêm trọng"/"cảnh báo"), where, problem, suggestion. Nếu không có lỗi, trả issues rỗng. Trả JSON đúng schema.`;
}

export const GAME_CONSISTENCY_SCHEMA = {
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

// ---------- Phân tích timeline tuyến: mỗi tuyến thành chuỗi mốc ----------
export function buildGameTimelineParsePrompt({ gameType, scenes }) {
  const block = scenes
    .map(
      (s) =>
        `- [${s.scene_order}] ${s.title} | loại: ${s.scene_type || "?"} | nơi: ${s.location || "?"} | NV: ${s.characters || "?"} | phục bút: ${s.foreshadow || "-"}\n  ${(s.content || "").slice(0, 400)}`
    )
    .join("\n");
  return `Bạn là BIÊN TẬP TIMELINE của xưởng viết kịch bản game.

${gameTypePrinciplesBlock(gameType)}

# CÁC PHÂN CẢNH CỦA TUYẾN (theo thứ tự)
${block || "(chưa có phân cảnh nào)"}

# Yêu cầu
Trích xuất từng phân cảnh thành mốc timeline: event (tiêu đề), order (thứ tự), time (mốc thời gian trong game nếu rõ, ngược lại để trống), location, characters, foreshadow, scene_type, summary (1 câu tóm tắt nội dung). Giữ đúng thứ tự. Trả JSON đúng schema.`;
}

export const GAME_TIMELINE_PARSE_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          event: { type: "string" },
          order: { type: "number" },
          time: { type: "string" },
          location: { type: "string" },
          characters: { type: "string" },
          foreshadow: { type: "string" },
          scene_type: { type: "string" },
          summary: { type: "string" },
        },
        required: ["event", "order", "summary"],
      },
    },
  },
  required: ["events"],
};

// ---------- Team chat: prompt hệ thống theo vai + context tài liệu ----------
export function buildGameTeamChatPrompt({ role, gameType, docsText, history, question }) {
  const historyBlock = history
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Tác giả" : role.name}: ${m.text}`)
    .join("\n\n");
  return `${role.system}

${gameTypePrinciplesBlock(gameType)}

# BỘ TÀI LIỆU KỊCH BẢN HIỆN TẠI
${docsText}

# Lịch sử hội thoại gần đây
${historyBlock || "(chưa có)"}

# Yêu cầu / câu hỏi của tác giả
${question}

Hãy trả lời trực tiếp, cụ thể, hữu ích — không lặp lại toàn bộ ngữ cảnh.`;
}