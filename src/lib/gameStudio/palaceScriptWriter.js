// AI viết kịch bản "Cung Đấu" (văn bản thuần) theo đúng cú pháp mà
// palaceScriptParser.js đọc được — độc lập hoàn toàn với scriptWriter.js
// ("Xưởng Offline") và systemScriptWriter.js ("Xưởng Hệ Thống").

import { aiCall } from "@/lib/aiCall";
import { generateLongByChunks } from "./longScriptWriter";

const SYNTAX_GUIDE = `
CÚ PHÁP BẮT BUỘC (tuân thủ CHÍNH XÁC, không thêm ký hiệu markdown khác):

# <Tên game>
**Thể loại:** <thể loại>
**Chỉ số sinh tử:** <Tên chỉ số> < <ngưỡng>
(NÊN là "Sủng Ái < 10" — chỉ số này tụt bằng/dưới ngưỡng là bị phế truất/Game Over. Khai nhiều cách nhau dấu phẩy, nhưng "Sủng Ái" phải là chỉ số ĐẦU TIÊN vì cấp bậc tần phi được tính từ nó.)
**Chỉ số khởi đầu:** Sủng Ái = <giá trị CAO HƠN ngưỡng chết, vd 30> (khai nhiều cách nhau dấu phẩy, vd "Sủng Ái = 30, Thế Lực = 5". QUAN TRỌNG: chỉ số nào không khai "Chỉ số khởi đầu" sẽ bắt đầu ở 0 — nếu 0 đã thấp hơn/bằng ngưỡng chết thì nhân vật bị coi là chết NGAY KHI VỪA VÀO GAME.)
**Thông báo thua cuộc:** <tiêu đề> | <nội dung> (tuỳ chọn — chữ hiện khi bị phế truất, thay cho "GAME OVER" mặc định. Vd: "Bị Phế Truất | Thất sủng quá mức, nàng bị đày vào lãnh cung...")
**Cấp bậc hậu cung:** <tên> / <tên> / <tên> (tuỳ chọn — danh sách cấp bậc tần phi cách nhau dấu "/", từ thấp lên cao. Bỏ qua thì dùng mặc định. Mỗi 15 điểm Sủng Ái trên ngưỡng sống thăng 1 cấp, tự động.)

## GIỚI THIỆU
→ Chỉ dụ: <tiêu đề> | <lời chào nhập cung, mời người chơi bắt đầu>
<văn bản mở đầu, 1-2 đoạn>

## CẢNH 1 — <tên cảnh>
→ Chỉ dụ: <tiêu đề> | <thông báo hoàng cung — sự kiện/diễn biến chung của cung điện> (tuỳ chọn, CHỈ khi cần)
<văn bản diễn biến, 2-5 đoạn, có thể có lời thoại trong ngoặc kép>

**A — <lời lựa chọn ngắn>**
→ Sủng Ái +5
→ Hảo cảm Quý Phi +10
→ Cờ: đã hạ độc trong bát canh
→ Chỉ dụ: <tiêu đề> | <kết quả mưu kế — công bố ngay sau khi chọn>

**B — <lời lựa chọn khác>**
→ Sủng Ái -10
→ Hảo cảm Quý Phi -10
→ Cần hảo cảm Quý Phi >= 30
→ Cần cờ: đã hạ độc trong bát canh
→ Cần không có cờ: đã hạ độc trong bát canh
→ Cần vật phẩm: Bùa hộ mệnh
→ Vật phẩm: Bùa hộ mệnh
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
- Cấp bậc hậu cung TỰ ĐỘNG tăng/giảm theo Sủng Ái (mỗi 15 điểm trên ngưỡng sống thăng 1 cấp). Có sự kiện thăng chức/giáng chức thì nêu rõ trong văn bản hoặc "→ Chỉ dụ:".
- "→ Hảo cảm <tên nhân vật> +N/-N" là mối quan hệ phe phái (Hoàng hậu, Quý Phi, Thái Hậu...). "→ Cần hảo cảm <tên> >= N" khoá lựa chọn nếu hảo cảm chưa đủ.
- Dòng "→ Chỉ dụ: <tiêu đề> | <nội dung>" đặt NGAY DƯỚI "## CẢNH N" (trước lựa chọn A) thì bật bảng thông báo khi VÀO cảnh; đặt BÊN TRONG 1 lựa chọn thì bật NGAY SAU KHI chọn. Mỗi cảnh/lựa chọn tối đa 1 dòng này. Tiêu đề và nội dung cách nhau bằng dấu " | " (có khoảng trắng 2 bên). Muốn xuống dòng trong nội dung thì gõ "\n" (gạch chéo ngược + n), KHÔNG xuống dòng thật.
- Mỗi cảnh (trừ kết thúc) PHẢI có 2-4 lựa chọn.
- Nếu lựa chọn không ghi "→ Đến cảnh N" hay "→ Kết thúc nhãn", nó TỰ ĐỘNG dẫn tới cảnh kế tiếp theo thứ tự.
- PHẢI có ít nhất 1 khối "## KẾT THÚC" ở cuối, được một lựa chọn nào đó trỏ tới bằng "→ Kết thúc <nhãn>".
- "→ Đến cảnh N" CHỈ được dùng khi "## CẢNH N" THẬT SỰ tồn tại trong chính kịch bản đang viết. "→ Kết thúc <nhãn>" cũng phải khớp Y HỆT một khối "## KẾT THÚC <nhãn>" có thật.
- Loại kết thúc trong [ ] CHỈ được là TRUE_END, GOOD_END, NORMAL_END, hoặc BAD_END.
- MỖI lựa chọn CHỈ được có ĐÚNG MỘT "→ Đến cảnh"/"→ Kết thúc".
- Không dùng markdown khác ngoài **...** cho tiêu đề lựa chọn và # / ## cho tiêu đề.
- Thể hiện đúng tinh thần cung đấu: mưu kế, phe phái, sủng ái, ngoại giao giữa các phi tần, chữ nghĩa cổ phong nhưng dễ hiểu.
`.trim();

function lengthToSceneCount(length) {
  if (length === "short") return 6;
  if (length === "long") return 14;
  if (length === "xl") return 60;
  return 10;
}

/**
 * Sinh kịch bản "Cung Đấu" dạng text theo đúng cú pháp palaceScriptParser.js đọc được.
 * @param {Object} p
 * @param {'idea'|'chapter'} p.mode
 * @param {string} p.input
 * @param {'short'|'medium'|'long'|'xl'} [p.length]
 * @returns {Promise<string>}
 */
export async function generatePalaceScriptFromPrompt({ mode, input, length }) {
  if (!input || !String(input).trim()) throw new Error("Thiếu nội dung đầu vào.");
  const sceneCount = lengthToSceneCount(length);

  const task =
    mode === "chapter"
      ? `Dưới đây là nội dung một chương truyện thể loại "Cung Đấu" (nữ chính là phi tần trong hậu cung). Hãy CHUYỂN THỂ nó thành kịch bản game nhập vai phân nhánh khoảng ${sceneCount} cảnh — giữ đúng tinh thần/nhân vật/bối cảnh, thêm các điểm rẽ nhánh hợp lý (được sủng ái hay thất sủng, thắng hay thua mưu kế), và lồng ghép các hiệu ứng hảo cảm phe phái/cờ truyện/vật phẩm đúng như phong cách "Cung Đấu".\n\nNỘI DUNG CHƯƠNG TRUYỆN:\n"""${input}"""`
      : `Từ ý tưởng/cảnh mở đầu sau, hãy sáng tác một kịch bản game nhập vai phân nhánh thể loại "Cung Đấu" HOÀN CHỈNH khoảng ${sceneCount} cảnh, nhiều kết thúc khác nhau — nhân vật chính là phi tần, xoay quanh Sủng Ái của Hoàng thượng, mưu kế giữa các phi tần, phe phái trong cung.\n\nÝ TƯỞNG:\n"""${input}"""`;

  if (length === "xl") {
    return generateLongByChunks({
      buildTask: (prompt) => aiCall(`Bạn là một biên kịch game nhập vai chuyên nghiệp, chuyên viết thể loại "Cung Đấu". ` + prompt).then((t) => String(t || "").trim()),
      baseTask: task,
      syntaxGuide: SYNTAX_GUIDE,
      totalScenes: sceneCount,
    });
  }

  const prompt = `Bạn là một biên kịch game nhập vai chuyên nghiệp, chuyên viết thể loại "Cung Đấu". ${task}\n\n${SYNTAX_GUIDE}\n\nChỉ trả về đúng nội dung kịch bản theo cú pháp trên, không thêm lời dẫn/giải thích nào khác trước hoặc sau.`;

  const text = await aiCall(prompt);
  return String(text || "").trim();
}
