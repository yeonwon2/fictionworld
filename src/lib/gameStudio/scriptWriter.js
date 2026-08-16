// AI viết kịch bản (văn bản thuần, KHÔNG dùng JSON schema) theo đúng cú pháp
// mà scriptParser.js đọc được — cầu nối giữa "AI sáng tạo" và "Xưởng Offline".
// Vì đầu ra là text tự nhiên (không phải JSON lồng nhau nhiều trường), 1 lệnh
// gọi aiCall duy nhất là đủ, không cần chia batch như đường AI-JSON.

import { aiCall } from "@/lib/aiCall";

const SYNTAX_GUIDE = `
CÚ PHÁP BẮT BUỘC (tuân thủ CHÍNH XÁC, không thêm ký hiệu markdown khác):

# <Tên game>
**Thể loại:** <thể loại>

## GIỚI THIỆU
<văn bản mở đầu, 1-2 đoạn>

## CẢNH 1 — <tên cảnh>
<văn bản diễn biến, 2-5 đoạn, có thể có lời thoại trong ngoặc kép>

**A — <lời lựa chọn ngắn>**
→ <Tên chỉ số> +<số>
→ <Tên chỉ số> -<số>
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

## CẢNH 2 — <tên cảnh>
...

## KẾT THÚC <nhan> — <tên kết thúc> [TRUE_END|GOOD_END|NORMAL_END|BAD_END]
<văn bản kết thúc>

QUY TẮC:
- Mỗi cảnh (trừ nếu là kết thúc) PHẢI có 2-4 lựa chọn.
- Mỗi lựa chọn PHẢI có ít nhất 1 dòng "→ <Tên chỉ số> +N/-N" (trừ khi cố ý là lựa chọn thuần rẽ nhánh không đổi điểm).
- Nếu lựa chọn không ghi "→ Đến cảnh N" hay "→ Kết thúc nhãn", nó TỰ ĐỘNG dẫn tới cảnh kế tiếp theo thứ tự — chỉ cần ghi rõ khi muốn rẽ nhánh khác thường hoặc dẫn tới kết thúc.
- PHẢI có ít nhất 1 khối "## KẾT THÚC" ở cuối, được một lựa chọn nào đó trỏ tới bằng "→ Kết thúc <nhãn>".
- "→ Đến cảnh N" CHỈ được dùng khi "## CẢNH N" THẬT SỰ tồn tại trong chính kịch bản đang viết — TUYỆT ĐỐI không bịa số cảnh chưa viết tới, kể cả khi đó là số cảnh "hợp lý theo mạch truyện". "→ Kết thúc <nhãn>" cũng phải khớp Y HỆT một khối "## KẾT THÚC <nhãn>" có thật.
- Loại kết thúc trong [ ] CHỈ được là TRUE_END, GOOD_END, NORMAL_END, hoặc BAD_END — không tự đặt loại khác (vd không dùng [SAD_END], [SECRET_END]...).
- MỖI lựa chọn CHỈ được có ĐÚNG MỘT "→ Đến cảnh"/"→ Kết thúc" — TUYỆT ĐỐI không viết cú pháp điều kiện kiểu "→ Nếu có cờ X: Đến cảnh Y" trong 1 dòng. Muốn rẽ nhánh theo cờ/chỉ số, hãy tách thành 2 lựa chọn RIÊNG (vd cùng câu thoại nhưng 1 khoá bằng "Cần cờ: X", 1 khoá bằng "Cần không có cờ: X"), mỗi lựa chọn tự có "→ Đến cảnh"/"→ Kết thúc" của riêng nó.
- Tên chỉ số đặt tự do (tiếng Việt hoặc tiếng Anh đều được), hệ thống tự nhận diện.
- Không dùng markdown khác ngoài **...** cho tiêu đề lựa chọn và # / ## cho tiêu đề.
`.trim();

function lengthToSceneCount(length) {
  if (length === "short") return 6;
  if (length === "long") return 14;
  return 10;
}

/**
 * Sinh kịch bản dạng text theo đúng cú pháp scriptParser.js đọc được.
 * @param {Object} p
 * @param {'idea'|'chapter'} p.mode - 'idea': input là 1 ý tưởng/cảnh ngắn; 'chapter': input là nội dung chương truyện để chuyển thể.
 * @param {string} p.input
 * @param {'short'|'medium'|'long'} [p.length]
 * @returns {Promise<string>} kịch bản dạng text, sẵn sàng dán vào Xưởng Offline (nên cho người dùng xem/sửa trước khi sản xuất).
 */
export async function generateScriptFromPrompt({ mode, input, length }) {
  if (!input || !String(input).trim()) throw new Error("Thiếu nội dung đầu vào.");
  const sceneCount = lengthToSceneCount(length);

  const task =
    mode === "chapter"
      ? `Dưới đây là nội dung một chương truyện. Hãy CHUYỂN THỂ nó thành kịch bản game nhập vai phân nhánh khoảng ${sceneCount} cảnh — giữ đúng tinh thần/nhân vật/bối cảnh của chương truyện, nhưng thêm các điểm rẽ nhánh (lựa chọn) hợp lý mà chương gốc không có, để người chơi thực sự quyết định được diễn biến.\n\nNỘI DUNG CHƯƠNG TRUYỆN:\n"""${input}"""`
      : `Từ ý tưởng/cảnh mở đầu sau, hãy sáng tác một kịch bản game nhập vai phân nhánh HOÀN CHỈNH khoảng ${sceneCount} cảnh, nhiều kết thúc khác nhau.\n\nÝ TƯỞNG:\n"""${input}"""`;

  const prompt = `Bạn là một biên kịch game nhập vai chuyên nghiệp. ${task}\n\n${SYNTAX_GUIDE}\n\nChỉ trả về đúng nội dung kịch bản theo cú pháp trên, không thêm lời dẫn/giải thích nào khác trước hoặc sau.`;

  const text = await aiCall(prompt);
  return String(text || "").trim();
}
