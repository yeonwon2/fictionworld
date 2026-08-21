// =============================================================================
// Xưởng Kịch Bản Game (luồng mới) — CÚ PHÁP KỊCH BẢN của 5 xưởng sản xuất game
// Đây là "quy ước chung trình bày kịch bản bắt buộc" mà kịch bản cuối phải tuân
// theo để dán thẳng vào Xưởng Game là chạy được. Mỗi xưởng có parser riêng:
//   studio   → scriptParser.js      (Xưởng Thiết Kế — phiêu lưu/hành động)
//   system   → systemScriptParser.js (Xưởng Hệ Thống — LitRPG/trọng sinh)
//   npc      → npcScriptParser.js    (Xưởng NPC — visual novel/công lược)
//   palace   → palaceScriptParser.js (Xưởng Cung Đấu — hậu cung)
//   rebirth  → rebirthScriptParser.js(Xưởng Trọng Sinh Làm Giàu — doanh nhân)
// Các chuỗi dưới đây được nhồi vào prompt để AI xuất đúng cú pháp của xưởng.
// =============================================================================

// Phần cú pháp chung cho mọi xưởng (trừ NPC có thêm khối NHÂN VẬT).
const COMMON = `
QUY TẮC LOGIC (QUAN TRỌNG, bắt buộc tuân thủ CHÍNH XÁC):
- Mạch truyện PHẢI LIỀN MẠCH: mỗi "→ Đến cảnh N" phải hợp lý — cảnh đích PHẢI mở đầu bằng 1 câu nhắc lại tình huống vừa xảy ra ở cảnh trước, tuyệt đối không nhảy sang chuyện khác không liên quan.
- Mọi "→ Cần vật phẩm: X" PHẢI có "→ Vật phẩm: X" (hoặc "→ Nhận Vật phẩm: X") tạo ra vật phẩm đó ở MỘT CẢNH PHÍA TRƯỚC.
- Mọi "→ Cần cờ: X" PHẢI có "→ Cờ: X" tạo cờ đó ở phía trước; "→ Cần không có cờ: X" chỉ dùng khi cờ X chưa từng được tạo trên mọi nhánh dẫn tới lựa chọn đó.
- Mọi "→ Cần <chỉ số> >= N" phải ĐẠT ĐƯỢC dựa trên "Chỉ số khởi đầu" cộng các lần tăng chỉ số ở các cảnh phía trước — đừng đặt ngưỡng cao hơn mức tối đa có thể đạt.
- Mỗi cảnh (trừ kết thúc) PHẢI có 2-4 lựa chọn.
- Mỗi lựa chọn PHẢI có ít nhất 1 dòng "→ <Tên chỉ số> +N/-N" (trừ khi cố ý là lựa chọn thuần rẽ nhánh).
- Nếu lựa chọn không ghi "→ Đến cảnh N" hay "→ Kết thúc nhãn", nó TỰ ĐỘNG dẫn tới cảnh kế tiếp theo thứ tự — chỉ ghi rõ khi muốn rẽ nhánh khác thường hoặc dẫn tới kết thúc.
- PHẢI có ít nhất 1 khối "## KẾT THÚC" ở cuối, được một lựa chọn nào đó trỏ tới bằng "→ Kết thúc <nhãn>".
- "→ Đến cảnh N" CHỈ được dùng khi "## CẢNH N" THẬT SỰ tồn tại trong chính kịch bản đang viết — TUYỆT ĐỐI không bịa số cảnh chưa viết. "→ Kết thúc <nhãn>" cũng phải khớp Y HỆT một khối "## KẾT THÚC <nhãn>" có thật.
- Loại kết thúc trong [ ] CHỈ ĐƯỢC là TRUE_END / GOOD_END / NORMAL_END / BAD_END — không tự đặt loại khác.
- MỖI lựa chọn CHỈ được có ĐÚNG MỘT "→ Đến cảnh"/"→ Kết thúc" — KHÔNG viết điều kiện kiểu "→ Nếu có cờ X: Đến cảnh Y" trong 1 dòng. Muốn rẽ nhánh theo cờ/chỉ số, hãy tách thành 2 lựa chọn RIÊNG (vd cùng câu thoại nhưng 1 khoá bằng "Cần cờ: X", 1 khoá bằng "Cần không có cờ: X"), mỗi lựa chọn tự có đích riêng.
- Tên chỉ số đặt tự do (tiếng Việt), hệ thống tự nhận diện.
- Các ký hiệu # / ## / ** chỉ để DỄ ĐỌC, KHÔNG bắt buộc — hệ thống nhận diện qua từ khoá (CẢNH, KẾT THÚC, GIỚI THIỆU...). Mũi tên "→" có thể gõ thành "->" hoặc "=>".
- KHÔNG dùng markdown khác ngoài **...** cho tiêu đề lựa chọn và # / ## cho tiêu đề.
`;

// Khối meta (đầu kịch bản) — dùng chung cho system/palace/rebirth (có chỉ số sinh tử).
function metaBlock({ vital = [], initial = [], gameOver = "" } = {}) {
  const lines = [];
  if (vital.length) lines.push(`**Chỉ số sinh tử:** ${vital.join(", ")}`);
  if (initial.length) lines.push(`**Chỉ số khởi đầu:** ${initial.join(", ")}`);
  if (gameOver) lines.push(`**Thông báo thua cuộc:** ${gameOver}`);
  return lines.length ? lines.join("\n") + "\n" : "";
}

// ---------- Xưởng Thiết Kế (studio) — scriptParser ----------
const STUDIO = `
## GIỚI THIỆU
<văn bản mở đầu, 1-2 đoạn>

## CẢNH 1 — <Tên cảnh>
<văn bản diễn biến, 2-5 đoạn, có thể có lời thoại trong ngoặc kép>

**A — <lời lựa chọn ngắn>**
→ <Tên chỉ số> +5
→ <Tên chỉ số> -10
→ Cờ: <ten_co_khong_dau_khong_cach>
→ Cần cờ: <ten_co>
→ Cần không có cờ: <ten_co>
→ Vật phẩm: <tên vật phẩm>
→ Cần vật phẩm: <tên vật phẩm>
→ Cần <Tên chỉ số> >= <số>
→ Đến cảnh <số>
→ Kết thúc <nhan_ket_thuc>

**B — <lời lựa chọn khác>**
...(tương tự)

## CẢNH 2 — <Tên cảnh>
...

## KẾT THÚC <nhan> — <Tên kết thúc> [TRUE_END|GOOD_END|NORMAL_END|BAD_END]
<văn bản kết thúc>
`;

// ---------- Xưởng Hệ Thống (system) — systemScriptParser ----------
const SYSTEM = `
## GIỚI THIỆU
→ Hệ thống: <tiêu đề> | <nội dung>   (bảng thông báo bật NGAY KHI VÀO GAME, tuỳ chọn. Muốn xuống dòng gõ \\n)
<văn bản mở đầu, có thể nhiều đoạn>

## CẢNH 1 — <Tên cảnh>
→ Hệ thống: <tiêu đề> | <nội dung>   (bảng nhắc nhở khi VÀO cảnh, tuỳ chọn, tối đa 1 dòng/cảnh)
<văn bản diễn biến>

**A — <lời lựa chọn>**
→ <Tên chỉ số> +5
→ Hệ thống: <tiêu đề> | <nội dung>   (bảng công bố phạt/thưởng NGAY SAU KHI chọn, tuỳ chọn)
→ Cần <Tên chỉ số> >= 20
→ Cờ: <tên cờ>
→ Cần cờ: <tên cờ>
→ Cần không có cờ: <tên cờ>
→ Vật phẩm: <tên>
→ Cần vật phẩm: <tên>
→ Đến cảnh <số>
→ Kết thúc <nhãn>

## KẾT THÚC <nhãn> — <Tên kết thúc> [TRUE_END|GOOD_END|NORMAL_END|BAD_END]
`;

// ---------- Xưởng NPC (npc) — npcScriptParser (công lược, nhiều tuyến NV) ----------
const NPC = `
## GIỚI THIỆU
<văn bản hiện trên màn hình chọn nhân vật, vd "Bạn muốn theo đuổi ai?">

## NHÂN VẬT <Tên nhân vật> — <mô tả ngắn / tính cách>
→ Ảnh: <URL ảnh đại diện>   (tuỳ chọn, đặt NGAY DƯỚI dòng NHÂN VẬT, trước cảnh đầu tiên)

### CẢNH 1 — <Tên cảnh>
<văn bản diễn biến>

**A — <lời lựa chọn>**
→ Thiện cảm +5
→ Cờ: đã hứa ở lại
→ Cần cờ: đã hứa ở lại
→ Cần không có cờ: đã hứa ở lại
→ Vật phẩm: tên vật phẩm
→ Cần vật phẩm: tên vật phẩm
→ Cần Thiện cảm >= 20
→ Đến cảnh 2   ("### CẢNH 2" PHẢI có thật TRONG CÙNG khối NHÂN VẬT này)
→ Kết thúc yeu ("### KẾT THÚC" cùng nhãn, TRONG CÙNG khối NHÂN VẬT này)

### CẢNH 2 — ...
### KẾT THÚC yeu — Thành đôi [TRUE_END]
### KẾT THÚC chia_xa — Chia xa [BAD_END]

## NHÂN VẬT <Tên nhân vật khác> — <mô tả>
### CẢNH 1 — ...   (số cảnh TỰ RESET về 1 cho mỗi nhân vật)
...

LƯU Ý: Số cảnh/nhãn kết thúc chỉ có hiệu lực TRONG PHẠM VI khối NHÂN VẬT đang viết. Mỗi nhân vật là 1 TUYẾN RIÊNG độc lập.
`;

// ---------- Xưởng Cung Đấu (palace) — palaceScriptParser ----------
const PALACE = `
## GIỚI THIỆU
<văn bản mở đầu>

## CẢNH 1 — <Tên cảnh>
→ Chỉ dụ: <tiêu đề> | <nội dung>   (bảng thông báo hoàng cung khi VÀO cảnh, tuỳ chọn)
<văn bản diễn biến>

**A — <lời lựa chọn>**
→ Sủng Ái +5
→ Sủng Ái -10
→ Hảo cảm Quý Phi +10
→ Hảo cảm Thái Hậu -5
→ Cần hảo cảm Quý Phi >= 30
→ Cần hảo cảm Hoàng hậu <= 10
→ Cần Sủng Ái >= 40
→ Cờ: <tên mưu kế>
→ Cần cờ: <tên mưu kế>
→ Cần không có cờ: <tên mưu kế>
→ Vật phẩm: <tên vật phẩm>
→ Cần vật phẩm: <tên vật phẩm>
→ Chỉ dụ: <tiêu đề> | <nội dung>   (công bố kết quả mưu kế, tuỳ chọn)
→ Đến cảnh <số>
→ Kết thúc <nhãn>

## KẾT THÚC <nhãn> — <Tên kết thúc> [TRUE_END|GOOD_END|NORMAL_END|BAD_END]

LƯU Ý: "Sủng Ái" là chỉ số sinh tử (khai trong "Chỉ số sinh tử"), cấp bậc tần phi tính TỰ ĐỘNG từ Sủng Ái.
`;

// ---------- Xưởng Trọng Sinh Làm Giàu (rebirth) — rebirthScriptParser ----------
const REBIRTH = `
## GIỚI THIỆU
<văn bản mở đầu>

## CẢNH 1 — <Tên cảnh>
→ Cơ hội: <tiêu đề> | <nội dung>   (tin nội bộ/dự án/phi vụ khi VÀO cảnh, tuỳ chọn)
<văn bản diễn biến>

**A — <lời lựa chọn>**
→ Vốn +10
→ Vốn -20
→ Danh vọng +5
→ Cơ hội Quảng Châu +10   (hảo cảm/lòng tin 1 đối tác)
→ Cần cơ hội Quảng Châu >= 30
→ Cần Vốn >= 40
→ Cờ: <tên mối làm ăn>
→ Cần cờ: <tên mối làm ăn>
→ Cần không có cờ: <tên mối làm ăn>
→ Vật phẩm: <tên giấy tờ>
→ Cần vật phẩm: <tên giấy tờ>
→ Cơ hội: <tiêu đề> | <nội dung>   (công bố kết quả phi vụ, tuỳ chọn)
→ Đến cảnh <số>
→ Kết thúc <nhãn>

## KẾT THÚC <nhãn> — <Tên kết thúc> [TRUE_END|GOOD_END|NORMAL_END|BAD_END]

LƯU Ý: "Vốn" là chỉ số sinh tử (khai trong "Chỉ số sinh tử"), niên đại làm giàu tính TỰ ĐỘNG từ Vốn.
`;

// ---------- Đăng ký xưởng: tên hiển thị + parser + cú pháp ----------
export const WORKSHOPS = {
  studio: {
    id: "studio",
    label: "Xưởng Thiết Kế",
    short: "Thiết Kế",
    desc: "Phiêu lưu / hành động — lựa chọn hành động, nhiều kết thúc.",
    parser: "scriptParser",
    introMeta: "",
    syntax: STUDIO,
  },
  system: {
    id: "system",
    label: "Xưởng Hệ Thống",
    short: "Hệ Thống",
    desc: "LitRPG / trọng sinh — hệ thống nhắc nhở, nhiệm vụ, thăng cấp.",
    parser: "systemScriptParser",
    introMeta: metaBlock({
      vital: ["<chỉ số sinh tử> < ngưỡng (vd: Sinh lực < 5)"],
      initial: ["<chỉ số> = <giá trị> (vd: Sinh lực = 30)"],
      gameOver: "<tiêu đề> | <nội dung>",
    }),
    syntax: SYSTEM,
  },
  npc: {
    id: "npc",
    label: "Xưởng NPC",
    short: "NPC",
    desc: "Visual novel / công lược — theo đuổi nhân vật, tuyến riêng.",
    parser: "npcScriptParser",
    introMeta: metaBlock({
      vital: ["<chỉ số> < ngưỡng (vd: Thiện cảm < 10)"],
      initial: ["<chỉ số> = <giá trị> (vd: Thiện cảm = 20)"],
      gameOver: "<tiêu đề> | <nội dung>",
    }),
    syntax: NPC,
  },
  palace: {
    id: "palace",
    label: "Xưởng Cung Đấu",
    short: "Cung Đấu",
    desc: "Hậu cung — Sủng Ái, phe phái, mưu kế, cấp bậc tần phi.",
    parser: "palaceScriptParser",
    introMeta: metaBlock({
      vital: ["Sủng Ái < 10"],
      initial: ["Sủng Ái = 30, Thế Lực = 5"],
      gameOver: "<tiêu đề> | <nội dung>",
    }) + `**Cấp bậc hậu cung:** <tên> / <tên> / ...   (tuỳ chọn, bỏ qua thì dùng mặc định)\n`,
    syntax: PALACE,
  },
  rebirth: {
    id: "rebirth",
    label: "Xưởng Trọng Sinh Làm Giàu",
    short: "Trọng Sinh",
    desc: "Doanh nhân — Vốn, niên đại, cơ hội, thương chiến.",
    parser: "rebirthScriptParser",
    introMeta: metaBlock({
      vital: ["Vốn < 5"],
      initial: ["Vốn = 50"],
      gameOver: "<tiêu đề> | <nội dung>",
    }) + `**Thang thời đại:** <nhãn> = <mốc vốn> (+thu) | ...   (tuỳ chọn, bỏ qua thì dùng mặc định)\n`,
    syntax: REBIRTH,
  },
};

export const WORKSHOP_LIST = Object.values(WORKSHOPS);

// Dựng toàn bộ block cú pháp cho 1 xưởng (kèm meta mẫu đầu kịch bản).
export function buildSyntaxBlock(workshopId) {
  const w = WORKSHOPS[workshopId] || WORKSHOPS.studio;
  return `Bạn PHẢI xuất kịch bản theo ĐÚNG cú pháp của XƯỞNG ${w.label} (parser: ${w.parser}) như sau — không được viết theo kiểu xưởng khác:

# <Tên game>
**Thể loại:** <thể loại>
${w.introMeta}${w.syntax}
${COMMON}`;
}

// Nhãn mục tiêu cho từng xưởng (để gọi đúng parser trong Xưởng Game).
export function workshopParserName(workshopId) {
  return (WORKSHOPS[workshopId] || WORKSHOPS.studio).parser;
}
