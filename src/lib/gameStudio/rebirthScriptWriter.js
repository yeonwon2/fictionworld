// AI viết kịch bản "Trọng Sinh Làm Giàu" (văn bản thuần) theo đúng cú pháp mà
// rebirthScriptParser.js đọc được — độc lập hoàn toàn với palaceScriptWriter.js
// ("Xưởng Cung Đấu") và các xưởng khác.

import { aiCall } from "@/lib/aiCall";

const SYNTAX_GUIDE = `
CÚ PHÁP BẮT BUỘC (tuân thủ CHÍNH XÁC, không thêm ký hiệu markdown khác):

# <Tên game>
**Thể loại:** <thể loại>
**Chỉ số sinh tử:** <Tên chỉ số> < <ngưỡng>
(NÊN là "Vốn < 5" — chỉ số này tụt bằng/dưới ngưỡng là PHÁ SẢN/Game Over. Khai nhiều cách nhau dấu phẩy, nhưng "Vốn" phải là chỉ số ĐẦU TIÊN vì niên đại làm giàu được tính từ nó. "Vốn" = số tiền/khối tài sản hiện có.)
**Chỉ số khởi đầu:** Vốn = <giá trị CAO HƠN ngưỡng chết, vd 50> (khai nhiều cách nhau dấu phẩy, vd "Vốn = 50, Sức khỏe = 3, Danh vọng = 2". QUAN TRỌNG: chỉ số nào không khai "Chỉ số khởi đầu" sẽ bắt đầu ở 0 — nếu 0 đã thấp hơn/bằng ngưỡng chết thì nhân vật bị coi là chết NGAY KHI VỪA VÀO GAME.)
**Thông báo thua cuộc:** <tiêu đề> | <nội dung> (tuỳ chọn — chữ hiện khi phá sản, thay cho "GAME OVER" mặc định. Vd: "Phá Sản | Vốn cạn kiệt, nhà xưởng bị siết nợ...")
**Thang thời đại:** <nhãn> = <mốc vốn> (+thu nhập) | ... (tuỳ chọn — các mốc vốn đổi niên đại, cách nhau dấu "|", thu nhập là số tiền cộng MỘT LẦN khi đế chế thăng niên đại. Bỏ qua thì dùng mặc định 1995=0(+0)/1999=60(+5)/2003=200(+10)/2007=600(+20)/2011=1500(+35).)

## GIỚI THIỆU
→ Cơ hội: <tiêu đề> | <lời chào mở đầu, mời người chơi bắt đầu>
<văn bản mở đầu, 1-2 đoạn>

## CẢNH 1 — <tên cảnh>
→ Cơ hội: <tiêu đề> | <tin nội bộ/dự án/phi vụ — sự kiện chung của thương trường> (tuỳ chọn, CHỈ khi cần)
<văn bản diễn biến, 2-5 đoạn, có thể có lời thoại trong ngoặc kép>

**A — <lời lựa chọn ngắn>**
→ Vốn +10
→ Danh vọng +5
→ Cờ: ký được hợp đồng cà phê
→ Cơ hội: <tiêu đề> | <kết quả phi vụ — công bố ngay sau khi chọn>

**B — <lời lựa chọn khác>**
→ Vốn -20
→ Cần Vốn >= 40
→ Cần cờ: ký được hợp đồng cà phê
→ Cần không có cờ: ký được hợp đồng cà phê
→ Cần vật phẩm: Giấy tờ đất nền Quận 3
→ Vật phẩm: Giấy tờ đất nền Quận 3
→ Đến cảnh 3

## CẢNH 2 — <tên cảnh>
...
## KẾT THÚC <nhan> — <tên kết thúc> [TRUE_END|GOOD_END|NORMAL_END|BAD_END]
<văn bản kết thúc>

QUY TẮC:
- LOGIC (QUAN TRỌNG): mạch truyện phải LIỀN MẠCH — mỗi "→ Đến cảnh N" phải hợp lý: cảnh đích PHẢI mở đầu bằng 1 câu nhắc lại tình huống vừa xảy ra ở cảnh trước, tuyệt đối không nhảy sang chuyện khác không liên quan.
- LOGIC: mọi "→ Cần vật phẩm: X" PHẢI có "→ Vật phẩm: X" (hoặc "→ Nhận Vật phẩm: X") cho ra vật phẩm đó ở MỘT CẢNH PHÍA TRƯỚC — đừng yêu cầu vật phẩm chưa từng xuất hiện.
- LOGIC: mọi "→ Cần cờ: X" PHẢI có "→ Cờ: X" tạo cờ đó ở phía trước; "→ Cần không có cờ: X" chỉ dùng khi cờ X chưa từng được tạo trên mọi nhánh dẫn tới lựa chọn đó.
- LOGIC: mọi "→ Cần <chỉ số> >= N" phải ĐẠT ĐƯỢC dựa trên "Chỉ số khởi đầu" cộng các lần tăng chỉ số ở các cảnh phía trước — đừng đặt ngưỡng cao hơn mức tối đa có thể đạt.
- Niên đại làm giàu TỰ ĐỘNG theo Vốn: chạm mốc vốn thì đế chế bước sang niên đại mới (1995 mồ hôi vốn → 1999 cổ phiếu vàng → 2003 đất vàng → ...) và thu thêm khoản tiền MỘT LẦN — "tiền đẻ ra tiền". Có sự kiện thăng niên đại thì nêu rõ trong văn bản hoặc "→ Cơ hội:".
- "→ Vốn +N/-N" là lời/lỗ tiền — NHỚ trừ tiền khi làm ăn thất bại, để lỗ gần ngưỡng phá sản tạo kịch tính. "→ Danh vọng +N", "→ Sức khỏe +N"... là chỉ số phụ (tên tự do, hệ thống tự nhận).
- "→ Cơ hội: <tiêu đề> | <nội dung>" là tin nội bộ/dự án/phi vụ. Đặt NGAY DƯỚI "## CẢNH N" (trước lựa chọn A) thì bật bảng thông báo khi VÀO cảnh; đặt BÊN TRONG 1 lựa chọn thì bật NGAY SAU KHI chọn. Mỗi cảnh/lựa chọn tối đa 1 dòng này. Tiêu đề và nội dung cách nhau bằng dấu " | " (có khoảng trắng 2 bên). Muốn xuống dòng trong nội dung thì gõ "\\n" (gạch chéo ngược + n), KHÔNG xuống dòng thật.
- Mỗi cảnh (trừ kết thúc) PHẢI có 2-4 lựa chọn.
- Nếu lựa chọn không ghi "→ Đến cảnh N" hay "→ Kết thúc nhãn", nó TỰ ĐỘNG dẫn tới cảnh kế tiếp theo thứ tự.
- PHẢI có ít nhất 1 khối "## KẾT THÚC" ở cuối, được một lựa chọn nào đó trỏ tới bằng "→ Kết thúc <nhãn>".
- "→ Đến cảnh N" CHỈ được dùng khi "## CẢNH N" THẬT SỰ tồn tại trong chính kịch bản đang viết. "→ Kết thúc <nhãn>" cũng phải khớp Y HỆT một khối "## KẾT THÚC <nhãn>" có thật.
- Loại kết thúc trong [ ] CHỈ được là TRUE_END, GOOD_END, NORMAL_END, hoặc BAD_END.
- MỖI lựa chọn CHỈ được có ĐÚNG MỘT "→ Đến cảnh"/"→ Kết thúc".
- Không dùng markdown khác ngoài **...** cho tiêu đề lựa chọn và # / ## cho tiêu đề.
- Thể hiện đúng tinh thần trọng sinh làm giàu: dùng kiến thức tương lai (giá cổ phiếu, cơn sốt đất, xu hướng thị trường) để đi trước thời đại; khởi nghiệp tay trắng, mở công ty, mua đất, đầu tư chứng khoán; chi tiết kinh doanh thực tế dễ hiểu; nhịp độ tiền lời/lỗ hấp dẫn.
`.trim();

function lengthToSceneCount(length) {
  if (length === "short") return 6;
  if (length === "long") return 14;
  return 10;
}

/**
 * Sinh kịch bản "Trọng Sinh Làm Giàu" dạng text theo đúng cú pháp rebirthScriptParser.js đọc được.
 * @param {Object} p
 * @param {'idea'|'chapter'} p.mode
 * @param {string} p.input
 * @param {'short'|'medium'|'long'} [p.length]
 * @returns {Promise<string>}
 */
export async function generateRebirthScriptFromPrompt({ mode, input, length }) {
  if (!input || !String(input).trim()) throw new Error("Thiếu nội dung đầu vào.");
  const sceneCount = lengthToSceneCount(length);

  const task =
    mode === "chapter"
      ? `Dưới đây là nội dung một chương truyện thể loại "Trọng Sinh Làm Giàu" (nhân vật chính trọng sinh về quá khứ, dùng kiến thức tương lai để làm giàu). Hãy CHUYỂN THỂ nó thành kịch bản game nhập vai phân nhánh khoảng ${sceneCount} cảnh — giữ đúng tinh thần/nhân vật/bối cảnh, thêm các điểm rẽ nhánh hợp lý (phi vụ thắng hay thua, lời hay lỗ vốn), và lồng ghép các hiệu ứng cơ hội/cờ truyện/vật phẩm đúng như phong cách "Trọng Sinh Làm Giàu".\n\nNỘI DUNG CHƯƠNG TRUYỆN:\n"""${input}"""`
      : `Từ ý tưởng/cảnh mở đầu sau, hãy sáng tác một kịch bản game nhập vai phân nhánh thể loại "Trọng Sinh Làm Giàu" HOÀN CHỈNH khoảng ${sceneCount} cảnh, nhiều kết thúc khác nhau — nhân vật chính trọng sinh về quá khứ và dùng hiểu biết tương lai để khởi nghiệp, đầu tư, xây đế chế tài chính.\n\nÝ TƯỞNG:\n"""${input}"""`;

  const prompt = `Bạn là một biên kịch game nhập vai chuyên nghiệp, chuyên viết thể loại "Trọng Sinh Làm Giàu". ${task}\n\n${SYNTAX_GUIDE}\n\nChỉ trả về đúng nội dung kịch bản theo cú pháp trên, không thêm lời dẫn/giải thích nào khác trước hoặc sau.`;

  const text = await aiCall(prompt);
  return String(text || "").trim();
}
