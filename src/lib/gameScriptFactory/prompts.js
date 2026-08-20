// =============================================================================
// Xưởng Kịch Bản Game — Prompt builders
// Cùng nguyên tắc mô hình "xưởng" của WritingFactory: một đội AI đóng vai chuyên
// môn cùng quản lý một bộ tài liệu sống (bible) cho mỗi bộ truyện — nhưng chuyên
// viết KỊCH BẢN GAME. Mỗi LOẠI GAME có bộ NGUYÊN TẮC KỊCH BẢN RIÊNG (GAME_TYPE_DEFS)
// mà AI bắt buộc tuân thủ, khác hẳn nhau:
//   - Visual Novel  : tuyến theo chỉ số tình cảm + cờ (flag) + CG + đa kết thúc
//   - RPG / JRPG    : cấu trúc nhiệm vụ (main/side quest), party, trận đấu, khám phá
//   - Action-Adventure: pha đo gắn gameplay — set piece, nhịp đấu xen nghỉ
//   - Point & Click : câu đố, túi đồ (inventory), hotspot, hội thoại rẽ nhánh
//   - Horror        : nhịp căng thẳng, jump scare, tài nguyên khan hiếm, sinh tồn
//   - Text Adventure: parser, phòng (rooms), động từ (verbs), vật thể (objects)
//   - Romance/Otome : tuyến tình cảm, ngưỡng affection, cảnh thân mật, nhiều kết
//   - Interactive Film: rẽ nhánh điện ảnh, quyết định nhanh, cây kết thúc
// Các tài liệu được lưu ở bảng game_script_docs (doc_key) và luôn được nạp làm
// "trí nhớ dài hạn" khi lên tuyến / viết phân cảnh / kiểm tra nhất quán.
// =============================================================================

// ---------- Định nghĩa loại game + nguyên tắc kịch bản riêng từng loại ----------
export const GAME_TYPE_DEFS = [
  {
    key: "visual-novel",
    label: "Visual Novel",
    short: "VN",
    emoji: "🎭",
    desc: "Tiểu thuyết hình ảnh: đọc thoại, chọn lựa, theo đuổi tuyến tình cảm / tuyến nhân vật, đa kết thúc.",
    principles: [
      "Kịch bản là chuỗi CẢNH đọc/hiển thị: thoại (dialogue) + bối cảnh (narration) + chọn lựa (choices).",
      "Mỗi nhân vật có giọng thoại riêng, tuyệt đối nhất quán xưng hô (đối chiếu tài liệu quan hệ).",
      "Chọn lựa tại các node rẽ nhánh phải CÓ HỆ QUẢ thực tế (tăng/giảm affection, mở/khoá cờ), không phải chọn cho có.",
      "Chỉ số tình cảm / cờ (flags) tích luỹ theo từng chương và quyết định tuyến mở khoá + kết thúc nhận được.",
      "Cảnh CG / cảnh đặc biệt chỉ diễn ra ở các nhịp cao trào, mỗi tuyến 2–4 điểm CG.",
      "Cây kết thúc rõ ràng: mỗi tuyến ≥2 kết (tốt/xấu hoặc tốt/bình thường/xấu) do ngưỡng chỉ số quyết định.",
    ],
    docs: "Quy tắc: viết theo nhịp Visual Novel — thoại ngắn gọn, cảm xúc qua lời thoại + mô tả ngắn; mỗi màn nên có điểm rẽ hoặc thông tin mới.",
  },
  {
    key: "rpg",
    label: "RPG / JRPG",
    short: "RPG",
    emoji: "⚔️",
    desc: "Nhập vai: party, nhiệm vụ chính/phụ, trận đấu, khám phá bản đồ, phát triển nhân vật.",
    principles: [
      "Cấu trúc 3 hồi rõ ràng: giới thiệu thế giới → xây dựng party → đại chiến/kết cục.",
      "Nhiệm vụ chia main quest (bắt buộc) và side quest (tuỳ chọn); mỗi nhiệm vụ có mục tiêu rõ ràng + phần thưởng + hệ quả lên thế giới.",
      "Phân cảnh phải đan xen gameplay: khám phá → trận đấu → cutscene → nghỉ ngơi → nhiệm vụ mới (nhịp 'leo thang – xả hơi').",
      "Mỗi thành viên party có động cơ riêng + khoảnh khắc 'phát triển nhân vật' (character arc) ở ít nhất 1 mốc lớn.",
      "Boss/trùm là đỉnh nhịp của mỗi hồi — kịch bản phải xây dựng mâu thuẫn dồn về đó trước trận.",
      "Thế giới sống: NPC có lời thoại thay đổi theo tiến trình nhiệm vụ, không đứng im bất biến.",
    ],
    docs: "Quy tắc: viết theo cấu trúc RPG — mô tả bối cảnh + thoại NPC gọn, nhấn vào hành động nhiệm vụ; ghi rõ mục tiêu từng quest.",
  },
  {
    key: "action-adventure",
    label: "Action-Adventure",
    short: "Action",
    emoji: "🗡️",
    desc: "Hành động - phiêu lưu: pha đo gắn chặt gameplay, set piece, cắt cảnh (cutscene).",
    principles: [
      "Kịch bản tính theo PHA ĐO (level/chương): mỗi pha đo = 1 mục tiêu gameplay + 1 bước tiến câu chuyện.",
      "Cân bằng nghịch pha: hành động (đấu/rượt đuổi/giải đố) xen kẽ tĩnh lặng (khám phá, hội thoại, tiết lộ) — không quá 3 pha động liên tiếp.",
      "Set piece (cảnh bom tấn) đặt ở mở đầu, giữa và cuối — mỗi set piece phải đổi cách chơi hoặc leo thang nguy hiểm.",
      "Cutscene chỉ kể điều gameplay không kể được; mỗi cutscene ≤ 60 giây đọc và luôn chuyển sang gameplay.",
      "Nhân vật chính có động cơ rõ ràng đẩy suốt câu chuyện; thế giới trả lời 'tại sao tôi phải qua pha đo này'.",
    ],
    docs: "Quy tắc: viết kịch bản theo pha đo — mỗi phân cảnh ghi rõ mục tiêu gameplay đi kèm, giữ nhịp động-tĩnh xen kẽ.",
  },
  {
    key: "point-click",
    label: "Point & Click Adventure",
    short: "P&C",
    emoji: "🖱️",
    desc: "Phiêu lưu trỏ-chạm: câu đố, túi đồ (inventory), hotspot, hội thoại cây rẽ nhánh.",
    principles: [
      "Câu chuyện tiến triển qua VIỆC GIẢI CÂU ĐỐ: mỗi câu đố phải có logic nội tại + nhiều cách gợi ý, không mò mẫm vô nghĩa.",
      "Hotspot (vật thể tương tác) phải có ý nghĩa kể chuyện — mỗi vật khám phá bổ sung 1 mảnh thông tin hoặc mở 1 con đường.",
      "Túi đồ (inventory) là công cụ kể chuyện: vật phẩm kết hợp được với nhau theo logic, không bịa ghép vô lý.",
      "Hội thoại là cây nhiều lựa chọn: lựa chọn thay đổi thái độ NPC và có thể mở/khoá hội thoại sau.",
      "Mỗi màn (chapter) có một 'câu đố trung tâm' buộc mọi tuyến nhỏ hội tụ về để giải.",
      "Hài hước / kỳ quái là phong cách đặc trưng — giữ tông nhất quán theo tài liệu quy tắc.",
    ],
    docs: "Quy tắc: viết kịch bản theo màn-câu-đố — mô tả hotspot, vật phẩm, câu đố trung tâm mỗi màn, hội thoại rẽ nhánh.",
  },
  {
    key: "horror",
    label: "Horror / Survival",
    short: "Horror",
    emoji: "🕯️",
    desc: "Kinh dị - sinh tồn: nhịp căng thẳng, jump scare, tài nguyên khan hiếm, giữ 'khoảng an toàn' cho người chơi.",
    principles: [
      "Nhịp căng thẳng hình SIN (leo thang – xả): căng → đỉnh → xả nhẹ; không giữ căng liên tục (mất tác dụng).",
      "Jump scare phải là PHẦN THƯỞNG của sự hồi hộp đã xây, không phải công cụ rẻ tiền — tối đa 1-2 lần/pha đo.",
      "Thông tin rò rỉ dần dần (breadcrumb): người chơi hiểu thấu đáo mối nguy CHẬM hơn nhân vật, tạo lo sợ.",
      "Tài nguyên khan hiếm gắn với kể chuyện: đạn/đèn pin/máu ít → lựa chọn sinh tồn đau đớn được kịch bản hoá.",
      "Kết thúc tuỳ trạng thái sinh tồn: ít nhất 2 hướng (sống sót / hy sinh / trốn thoát) dựa trên quyết định người chơi.",
      "Bối cảnh 'an toàn' ban đầu phải thật sự an toàn để cú lật sau đáng sợ.",
    ],
    docs: "Quy tắc: viết theo nhịp kinh dị — xây căng rồi xả, ghi rõ mỗi jump scare ở đâu, khan hiếm tài nguyên ra sao.",
  },
  {
    key: "text-adventure",
    label: "Interactive Fiction",
    short: "IF",
    emoji: "⌨️",
    desc: "Tiểu thuyết tương tác / trò chơi văn bản: phòng (rooms), động từ (verbs), vật thể (objects), câu lệnh.",
    principles: [
      "Kịch bản là chuỗi MÔ TẢ PHÒNG + VẬT THỂ + CÂU LỆNH: mỗi phòng mô tả ngắn gọn, gợi mở hành động khả dĩ.",
      "Động từ chuẩn hoá: đi/nhìn/lấy/dùng/nói/cho — mỗi vật thể có phản hồi với các động từ hợp lý.",
      "Mô tả phòng cần 'gợi ý mềm' (đồ vật nổi bật, hướng đi) — người chơi không được phép bế tắc vô lý.",
      "Câu đố dựa trên logic ngôn ngữ: kết hợp động từ + vật thể theo lẽ thường, có phản hồi hài hước/hợp lý khi sai.",
      "Có nhiều con đường đến cùng đích (nhiều cách giải 1 câu đố) — tôn trọng tự do người chơi.",
      "Giọng văn kể chuyện thứ hai ('Bạn đang ở...') nhất quán toàn game.",
    ],
    docs: "Quy tắc: viết interactive fiction — mô tả phòng + vật thể + động từ khả dĩ; mỗi phân cảnh ghi rõ các hành động người chơi được làm.",
  },
  {
    key: "romance",
    label: "Romance / Otome",
    short: "Romance",
    emoji: "💞",
    desc: "Tình cảm / Otome: tuyến theo nhân vật, ngưỡng affection, cảnh thân mật, nhiều kết thúc theo chỉ số.",
    principles: [
      "Mỗi tuyến là 1 nhân vật tình cảm riêng với arc: gặp gỡ → thân thiết → thử thách → bộc lộ → cam kết.",
      "Cảm xúc tiến triển THEO NGƯỠNG: mỗi cột mốc affection mở 1 cảnh (event) + 1 lựa chọn quan trọng.",
      "Xung đột trong tuyến phải từ TÍNH CÁCH hai người, không từ hiểu lầm nông cạn — người chơi muốn họ xứng đáng với nhau.",
      "Lựa chọn lãng mạn không phải lúc nào cũng 'đúng nhất' — đôi khi lựa chọn khó khăn mới tạo chiều sâu.",
      "Mỗi tuyến có kết thúc tốt/xấu/trung lập; kết thúc tốt phải CÓ ĐƯỢC nhờ tích luỹ chỉ số + quyết định đúng chỗ.",
      "Nhân vật chính có tính cách riêng (không phải 'máy để yêu'), có mục tiêu ngoài tình cảm.",
    ],
    docs: "Quy tắc: viết theo tuyến tình cảm — đánh dấu cột mốc affection mở cảnh nào, xung đột từ tính cách, nhiều kết.",
  },
  {
    key: "interactive-film",
    label: "Interactive Film",
    short: "Film",
    emoji: "🎬",
    desc: "Phim tương tác / lựa chọn phân nhánh: quyết định nhanh theo dòng chảy điện ảnh, cây kết thúc phức tạp.",
    principles: [
      "Kịch bản viết theo CẢNH ĐIỆN ẢNH: mô tả hình ảnh + âm thanh + thoại + chỉ dẫn quay (camera/diễn xuất).",
      "Quyết định người chơi thường có GIỚI HẠN THỜI GIAN ngắn — tạo cảm giác căng như phim, kịch bản phải ghi rõ.",
      "Rẽ nhánh phải 'hội tụ thông minh': sau một đoạn phân kỳ, các nhánh gặp lại ở trục chính mà vẫn nhớ hệ quả (biến cờ).",
      "Mỗi quyết định lớn có hậu quả DÀI HẠN rõ ràng ở ít nhất 1 cảnh sau — không bỏ quên.",
      "Cây kết thúc có phân cấp: kết thúc chính + kết phụ (thất bại giữa chừng) — mỗi kết phụ phải có ý nghĩa kể chuyện.",
      "Toàn bộ mạch phim hướng về 'khoảnh khắc quyết định' cuối cùng — các lựa chọn trước tạo dựng cho nó.",
    ],
    docs: "Quy tắc: viết kịch bản phim tương tác — ghi chỉ dẫn quay/âm thanh, thời gian giới hạn quyết định, hệ quả dài hạn của mỗi rẽ.",
  },
];

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
    system: `Bạn là BIÊN KỊCH CHÍNH của một xưởng viết kịch bản game. Bạn nắm chắc nguyên tắc kịch bản của LOẠI GAME đang chọn (visual novel / RPG / action-adventure / point & click / horror / interactive fiction / romance / interactive film) và đảm bảo mọi phân cảnh tuân thủ đúng. Bạn đánh giá thẳng thắn chất lượng kịch bản, đề xuất cải thiện nhịp, thoại, rẽ nhánh và hệ quả lựa chọn. Luôn trả lời bằng tiếng Việt, cụ thể, bám tài liệu.`,
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
- 00_QUY_TAC_KICH_BAN: quy tắc viết kịch bản — TÓM TẮT các nguyên tắc kịch bản của loại game ${t.label} nêu trên (viết thành quy tắc hành văn: tông giọng, POV, độ dài phân cảnh, cách viết thoại, chỉ dẫn kỹ thuật cần có như scene/transition/audio), cộng thêm quy tắc riêng của game này.
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
    quy_tac: "Soạn quy tắc kịch bản: tóm tắt nguyên tắc loại game + tông giọng, POV, độ dài phân cảnh, cách viết thoại, chỉ dẫn kỹ thuật (scene/transition/audio), quy tắc riêng của game này.",
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

// ---------- Lên dàn phân cảnh (scene beats) cho một tuyến ----------
export function buildSceneOutlinePrompt({ gameType, docsText, route, sceneGoal, prevScene, count }) {
  const prevBlock = prevScene
    ? `# Phân cảnh trước đó (nối mạch)\n- Tiêu đề: ${prevScene.title}\n- Loại: ${prevScene.scene_type || "?"}\n- Tóm tắt: ${(prevScene.content || "").slice(0, 600)}`
    : "(đây là phân cảnh ĐẦU TIÊN của tuyến)";
  return `Bạn là ĐẠO DIỄN KỊCH BẢN của một xưởng viết kịch bản game.

${gameTypePrinciplesBlock(gameType)}

# BỘ TÀI LIỆU KỊCH BẢN HIỆN TẠI
${docsText}

# TUYẾN KỊCH BẢN: ${route?.name || route?.route_key || "?"}
${route?.description ? `- Mô tả: ${route.description}` : ""}

${prevBlock}

# Mục tiêu của đoạn phân cảnh tiếp theo
${sceneGoal?.trim() || "(chưa có — tiếp tục tự nhiên theo tuyến + tóm tắt hiện tại)"}

# Yêu cầu
Lên dàn ${count || 5} PHÂN CẢNH (scene outline) cho đoạn này, mỗi phân cảnh:
- title: tiêu đề ngắn
- scene_type: loại phân cảnh phù hợp với loại game (visual-novel: "đối thoại" / "chọn lựa" / "CG"; rpg: "khám phá" / "trận đấu" / "cutscene" / "nhiệm vụ"; horror: "thăm dò" / "chạy trốn" / "hội thoại" / "jump-scare"; ...)
- goal: mục tiêu kể chuyện của phân cảnh (1 câu)
- location: địa điểm (nếu có)
- characters: nhân vật tham gia
- foreshadow: phục bút / chi tiết cần cài hoặc hồi đáp (nếu có)
- choice_hint: nếu phân cảnh có điểm rẽ lựa chọn, mô tả các lựa chọn + hệ quả
Phân cảnh đầu phải nối mạch với phân cảnh trước; phân cảnh cuối để lại móc câu (hook). Bám sát 00_QUY_TAC_KICH_BAN và nguyên tắc loại game.
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

// ---------- Viết phân cảnh kịch bản hoàn chỉnh ----------
export function buildSceneWritePrompt({ gameType, docsText, route, outline, prevScene, targetWords = 0 }) {
  const lengthRule =
    targetWords && Number(targetWords) > 0
      ? `- Độ dài: khoảng ${targetWords} từ kịch bản hoàn chỉnh.`
      : "- Độ dài: phù hợp loại phân cảnh (thoại vừa đủ, không dài dòng).";
  return `Bạn là BIÊN KỊCH CHÍNH của một xưởng viết kịch bản game. Hãy viết PHÂN CẢNH kịch bản hoàn chỉnh, TUYỆT ĐỐI không giải thích meta — chỉ trả nội dung kịch bản.

${gameTypePrinciplesBlock(gameType)}

# BỘ TÀI LIỆU KỊCH BẢN HIỆN TẠI
${docsText}

# TUYẾN KỊCH BẢN: ${route?.name || route?.route_key || "?"}

# DÀN PHÂN CẢNH (outline — bám sát 100%)
- Tiêu đề: ${outline?.title || "(chưa có)"}
- Loại: ${outline?.scene_type || "đối thoại"}
- Mục tiêu: ${outline?.goal || "(chưa có)"}
- Địa điểm: ${outline?.location || "(chưa có)"}
- Nhân vật: ${outline?.characters || "(chưa có)"}
${outline?.foreshadow ? `- Phục bút: ${outline.foreshadow}` : ""}
${outline?.choice_hint ? `- Điểm rẽ lựa chọn: ${outline.choice_hint}` : ""}

${prevScene ? `# Phân cảnh trước đó (nối mạch)\n- Tiêu đề: ${prevScene.title}\n- Tóm tắt: ${(prevScene.content || "").slice(0, 800)}` : "(đây là phân cảnh đầu tiên của tuyến)"}

# Yêu cầu kịch bản
- Đúng định dạng kịch bản game: ghi rõ bối cảnh (SCENE/location), nhân vật hiện diện, thoại theo mẫu "Tên: lời thoại", mô tả hành động/cảm xúc trong ngoặc, chỉ dẫn âm thanh/transition khi cần.
- Tuân thủ 00_QUY_TAC_KICH_BAN + NGUYÊN TẮC LOẠI GAME (nhịp pha đo, hệ quả lựa chọn, căng-xả...).
- Nhân vật hành động/đối thoại ĐÚNG hồ sơ trong 02_NHAN_VAT_NPC; địa danh/luật lệ ĐÚNG 01_THE_GIOI_GAME.
- ${lengthRule}
- Nếu outline có điểm rẽ lựa chọn, ghi rõ các lựa chọn và hệ quả (cờ/chỉ số thay đổi).
- Cài phục bút / hồi đáp theo outline; không mâu thuẫn 04_PHA_DO_BEATS và summaries/tom_tat_tuyen.md.
Chỉ trả nội dung kịch bản phân cảnh, không lời dẫn ngoài.`;
}

// ---------- Sửa phân cảnh theo góp ý ----------
export function buildSceneRevisionPrompt({ gameType, docsText, route, outline, currentContent, feedback }) {
  return `Bạn là BIÊN KỊCH CHÍNH của một xưởng viết kịch bản game. Game master vừa xem phân cảnh và muốn SỬA theo góp ý. Nhiệm vụ: viết lại TOÀN BỘ phân cảnh, GIỮ phần hay, sửa đúng các điểm được góp ý. TUYỆT ĐỐI không giải thích meta — chỉ trả kịch bản hoàn chỉnh.

${gameTypePrinciplesBlock(gameType)}

# BỘ TÀI LIỆU KỊCH BẢN HIỆN TẠI
${docsText}

# TUYẾN: ${route?.name || route?.route_key || "?"} — Phân cảnh "${outline?.title || "(chưa có tiêu đề)"}"

# KỊCH BẢN HIỆN TẠI (cần sửa)
"""${currentContent}"""

# GÓP Ý CỦA TÁC GIẢ (bám sát từng ý)
${feedback}

# Yêu cầu
- Sửa đúng từng điểm góp ý, phần khác giữ nguyên chất lượng.
- Giữ định dạng kịch bản game (SCENE/thoại/mô tả hành động/audio), tuân thủ nguyên tắc loại game.
- Không làm mâu thuẫn với bộ tài liệu (nhân vật, thế giới, cờ/chỉ số, pha đo).
Chỉ trả nội dung kịch bản phân cảnh, không lời dẫn ngoài.`;
}

// ---------- Kiểm tra nhất quán phân cảnh với bộ tài liệu ----------
export function buildGameConsistencyPrompt({ gameType, docsText, sceneContent }) {
  return `Bạn là BIÊN TẬP NHẤT QUÁN của xưởng viết kịch bản game. So sánh phân cảnh vừa viết với BỘ TÀI LIỆU KỊCH BẢN, phát hiện mâu thuẫn và vi phạm THẬT SỰ.

${gameTypePrinciplesBlock(gameType)}

# BỘ TÀI LIỆU KỊCH BẢN
${docsText}

# PHÂN CẢNH VỪA VIẾT
"""${sceneContent}"""

# Yêu cầu
Chỉ báo lỗi thật sự: nhân vật lạc tính cách/giọng thoại, xưng hô sai, địa danh/luật lệ sai, timeline tuyến lệch, cờ/chỉ số cài mà không dùng, vật phẩm bịa không có, kết thúc không đạt được do thiếu điều kiện, vi phạm nguyên tắc loại game. Mỗi lỗi: severity ("nghiêm trọng"/"cảnh báo"), where, problem, suggestion. Nếu không có lỗi, trả issues rỗng. Trả JSON đúng schema.`;
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