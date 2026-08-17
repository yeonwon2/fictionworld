// AI viết kịch bản "Hệ Thống" (văn bản thuần) theo đúng cú pháp mà
// systemScriptParser.js đọc được — độc lập hoàn toàn với scriptWriter.js của
// "Xưởng Offline" (không import, không chia sẻ gì cả).

import { aiCall } from "@/lib/aiCall";

const SYNTAX_GUIDE = `
CÚ PHÁP BẮT BUỘC (tuân thủ CHÍNH XÁC, không thêm ký hiệu markdown khác):

# <Tên game>
**Thể loại:** <thể loại>
**Chỉ số sinh tử:** <Tên chỉ số> < <ngưỡng>
**Chỉ số khởi đầu:** <Tên chỉ số (CÙNG TÊN với "Chỉ số sinh tử" ở trên)> = <giá trị cao hơn ngưỡng chết>

## GIỚI THIỆU
→ Hệ thống: <tiêu đề> | <lời chào của hệ thống, mời người chơi xác nhận để bắt đầu>
<văn bản mở đầu, 1-2 đoạn>

## CẢNH 1 — <tên cảnh>
→ Hệ thống: <tiêu đề> | <nội dung nhắc nhở, CHỈ dùng khi cảnh này thật sự cần hệ thống nhắc>
<văn bản diễn biến, 2-5 đoạn, có thể có lời thoại trong ngoặc kép>

**A — <lời lựa chọn ngắn>**
→ <Tên chỉ số> +<số>
→ Hệ thống: <tiêu đề> | <thông báo phần thưởng nếu lựa chọn này ĐÚNG cốt truyện hệ thống giao>

**B — <lời lựa chọn khác, phạm luật hệ thống>**
→ <Tên chỉ số> -<số>
→ Hệ thống: <tiêu đề> | <thông báo hình phạt cụ thể, nêu rõ lý do và mức phạt>

## CẢNH 2 — <tên cảnh>
...

## KẾT THÚC <nhan> — <tên kết thúc> [TRUE_END|GOOD_END|NORMAL_END|BAD_END]
<văn bản kết thúc>

QUY TẮC:
- Chỉ số khai ở "Chỉ số sinh tử" PHẢI xuất hiện ở ít nhất 1 dòng "→ <chỉ số> +N/-N" nào đó trong kịch bản.
- BẮT BUỘC: nếu có khai "Chỉ số sinh tử", PHẢI khai kèm "Chỉ số khởi đầu" cho đúng chỉ số đó với giá trị RÕ RÀNG CAO HƠN ngưỡng chết — mọi chỉ số không được khai "Chỉ số khởi đầu" sẽ tự động bắt đầu ở 0, nếu 0 đã thấp hơn/bằng ngưỡng chết thì nhân vật sẽ bị coi là chết NGAY KHI VỪA VÀO GAME.
- Dòng "→ Hệ thống: ..." đặt NGAY DƯỚI "## CẢNH N" (trước lựa chọn A) thì bật khi VÀO cảnh; đặt BÊN TRONG 1 lựa chọn thì bật NGAY SAU KHI chọn. Mỗi cảnh/lựa chọn tối đa 1 dòng này — CHỈ dùng khi thật sự cần thông báo, không phải cảnh/lựa chọn nào cũng cần.
- Tiêu đề và nội dung của "→ Hệ thống: ..." cách nhau bằng dấu " | " (có khoảng trắng 2 bên).
- Mỗi cảnh (trừ kết thúc) PHẢI có 2-4 lựa chọn.
- Nếu lựa chọn không ghi "→ Đến cảnh N" hay "→ Kết thúc nhãn", nó TỰ ĐỘNG dẫn tới cảnh kế tiếp theo thứ tự.
- PHẢI có ít nhất 1 khối "## KẾT THÚC" ở cuối, được một lựa chọn nào đó trỏ tới bằng "→ Kết thúc <nhãn>".
- "→ Đến cảnh N" CHỈ được dùng khi "## CẢNH N" THẬT SỰ tồn tại trong chính kịch bản đang viết. "→ Kết thúc <nhãn>" cũng phải khớp Y HỆT một khối "## KẾT THÚC <nhãn>" có thật.
- Loại kết thúc trong [ ] CHỈ được là TRUE_END, GOOD_END, NORMAL_END, hoặc BAD_END.
- MỖI lựa chọn CHỈ được có ĐÚNG MỘT "→ Đến cảnh"/"→ Kết thúc".
- Không dùng markdown khác ngoài **...** cho tiêu đề lựa chọn và # / ## cho tiêu đề.
`.trim();

function lengthToSceneCount(length) {
  if (length === "short") return 6;
  if (length === "long") return 14;
  return 10;
}

/**
 * Sinh kịch bản "Hệ Thống" dạng text theo đúng cú pháp systemScriptParser.js đọc được.
 * @param {Object} p
 * @param {'idea'|'chapter'} p.mode
 * @param {string} p.input
 * @param {'short'|'medium'|'long'} [p.length]
 * @returns {Promise<string>}
 */
export async function generateSystemScriptFromPrompt({ mode, input, length }) {
  if (!input || !String(input).trim()) throw new Error("Thiếu nội dung đầu vào.");
  const sceneCount = lengthToSceneCount(length);

  const task =
    mode === "chapter"
      ? `Dưới đây là nội dung một chương truyện thể loại "Hệ Thống" (trọng sinh/xuyên không có một hệ thống dẫn dắt nhân vật chính). Hãy CHUYỂN THỂ nó thành kịch bản game nhập vai phân nhánh khoảng ${sceneCount} cảnh — giữ đúng tinh thần/nhân vật/bối cảnh, thêm các điểm rẽ nhánh hợp lý, và lồng ghép hệ thống nhắc nhở/phạt/thưởng đúng như phong cách "Hệ Thống".\n\nNỘI DUNG CHƯƠNG TRUYỆN:\n"""${input}"""`
      : `Từ ý tưởng/cảnh mở đầu sau, hãy sáng tác một kịch bản game nhập vai phân nhánh thể loại "Hệ Thống" (có một hệ thống/AI dẫn dắt, nhắc nhở, phạt/thưởng nhân vật chính) HOÀN CHỈNH khoảng ${sceneCount} cảnh, nhiều kết thúc khác nhau.\n\nÝ TƯỞNG:\n"""${input}"""`;

  const prompt = `Bạn là một biên kịch game nhập vai chuyên nghiệp, chuyên viết thể loại "Hệ Thống". ${task}\n\n${SYNTAX_GUIDE}\n\nChỉ trả về đúng nội dung kịch bản theo cú pháp trên, không thêm lời dẫn/giải thích nào khác trước hoặc sau.`;

  const text = await aiCall(prompt);
  return String(text || "").trim();
}
