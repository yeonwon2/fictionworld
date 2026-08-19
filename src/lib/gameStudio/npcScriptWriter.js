// AI viết kịch bản "Công Lược" (văn bản thuần, KHÔNG dùng JSON schema) theo
// đúng cú pháp mà npcScriptParser.js đọc được — cầu nối giữa "AI sáng tạo" và
// "Xưởng NPC". Vì đầu ra là text tự nhiên, 1 lệnh gọi aiCall duy nhất là đủ.

import { aiCall } from "@/lib/aiCall";
import { generateLongByChunks } from "./longScriptWriter";

const SYNTAX_GUIDE = `
CÚ PHÁP BẮT BUỘC (tuân thủ CHÍNH XÁC, không thêm ký hiệu markdown khác):

# Công lược — <Tên truyện>
**Thể loại:** <thể loại>
**Chỉ số sinh tử:** Thiện cảm < 10
**Chỉ số khởi đầu:** Thiện cảm = 20
**Thông báo thua cuộc:** <tiêu đề> | <nội dung> (tuỳ chọn — chữ hiện khi chết, thay cho "GAME OVER" mặc định, viết đúng văn phong truyện)

## GIỚI THIỆU
Bạn muốn theo đuổi ai?

## NHÂN VẬT <Tên nhân vật 1> — <2-4 từ mô tả tính cách>
### CẢNH 1 — <tên cảnh>
<văn bản diễn biến, 2-4 đoạn>

**A — <lời lựa chọn ngắn>**
→ Thiện cảm +5
→ Đến cảnh 2

**B — <lời lựa chọn khác>**
→ Thiện cảm -5
→ Đến cảnh 2

### CẢNH 2 — <tên cảnh>
...(tương tự, tiếp diễn theo mạch: gặp gỡ → để ý → chủ động tìm đến → sự kiện
riêng → ghen tuông/thiện cảm → nhận ra tình cảm → biến cố lớn → tỏ tình)

### KẾT THÚC yeu — <tên kết thúc thành đôi> [TRUE_END]
<văn bản kết thúc — chỉ tới được nếu Thiện cảm đủ cao ở cảnh tỏ tình>

### KẾT THÚC chia_xa — <tên kết thúc chia xa> [BAD_END]
<văn bản kết thúc — nhánh khi Thiện cảm không đủ ở cảnh tỏ tình>

## NHÂN VẬT <Tên nhân vật 2> — <mô tả>
### CẢNH 1 — ...
...(một tuyến truyện ĐỘC LẬP hoàn toàn, số cảnh lại bắt đầu từ 1)

QUY TẮC:
- LOGIC (QUAN TRỌNG): mạch truyện phải LIỀN MẠCH — mỗi "→ Đến cảnh N" phải hợp lý: cảnh đích PHẢI mở đầu bằng 1 câu nhắc lại tình huống vừa xảy ra ở cảnh trước, tuyệt đối không nhảy sang chuyện khác không liên quan.
- LOGIC: mọi "→ Cần vật phẩm: X" PHẢI có "→ Vật phẩm: X" (hoặc "→ Nhận Vật phẩm: X") cho ra vật phẩm đó ở MỘT CẢNH PHÍA TRƯỚC — đừng yêu cầu vật phẩm chưa từng xuất hiện.
- LOGIC: mọi "→ Cần cờ: X" PHẢI có "→ Cờ: X" tạo cờ đó ở phía trước; "→ Cần không có cờ: X" chỉ dùng khi cờ X chưa từng được tạo trên mọi nhánh dẫn tới lựa chọn đó.
- LOGIC: mọi "→ Cần <chỉ số> >= N" phải ĐẠT ĐƯỢC dựa trên "Chỉ số khởi đầu" cộng các lần tăng chỉ số ở các cảnh phía trước — đừng đặt ngưỡng cao hơn mức tối đa có thể đạt.
- PHẢI có ít nhất 2 khối "## NHÂN VẬT" (nhiều "công lược đối tượng" để người chơi chọn).
- Mỗi nhân vật PHẢI có tối thiểu 5-8 cảnh đi theo mạch: gặp gỡ lần đầu → nhân vật bắt đầu chú ý → nhân vật chủ động tìm đến → 1 sự kiện đặc trưng → các lựa chọn tăng/giảm Thiện cảm rõ rệt → nhận ra tình cảm → 1 biến cố lớn thử thách mối quan hệ → cảnh tỏ tình.
- CẢNH TỎ TÌNH (cảnh cuối) PHẢI có ít nhất 2 lựa chọn: 1 lựa chọn khoá bằng "→ Cần Thiện cảm >= <ngưỡng cao>" dẫn tới kết thúc TRUE_END/GOOD_END (thành đôi), 1 lựa chọn KHÔNG khoá (hoặc khoá "Cần không có cờ") dẫn tới kết thúc BAD_END (thất bại) — để người chơi Thiện cảm chưa đủ vẫn có kết thúc riêng thay vì bị chặn hoàn toàn.
- Mỗi lựa chọn PHẢI có ít nhất 1 dòng "→ Thiện cảm +N/-N" (trừ lựa chọn thuần rẽ nhánh không đổi điểm).
- Nếu lựa chọn không ghi "→ Đến cảnh N" hay "→ Kết thúc nhãn", nó TỰ ĐỘNG dẫn tới cảnh kế tiếp CỦA CÙNG NHÂN VẬT theo thứ tự — chỉ cần ghi rõ khi muốn rẽ nhánh khác thường hoặc dẫn tới kết thúc.
- "→ Đến cảnh N" và "→ Kết thúc <nhãn>" CHỈ có hiệu lực TRONG PHẠM VI khối "## NHÂN VẬT" đang viết — không trỏ sang cảnh/kết thúc của nhân vật khác. TUYỆT ĐỐI không bịa số cảnh/nhãn kết thúc chưa viết tới.
- Loại kết thúc trong [ ] CHỈ được là TRUE_END, GOOD_END, NORMAL_END, hoặc BAD_END.
- MỖI lựa chọn CHỈ được có ĐÚNG MỘT "→ Đến cảnh"/"→ Kết thúc" — không viết cú pháp điều kiện kiểu "→ Nếu có cờ X: Đến cảnh Y" trong 1 dòng. Muốn rẽ nhánh theo cờ/chỉ số, tách thành 2 lựa chọn RIÊNG, mỗi cái tự có "→ Đến cảnh"/"→ Kết thúc" riêng.
- Tên chỉ số nên thống nhất dùng "Thiện cảm" cho MỌI nhân vật (chung 1 thang điểm vì chỉ 1 tuyến chạy tại 1 thời điểm).
- Không dùng markdown khác ngoài **...** cho tiêu đề lựa chọn và #/##/### cho tiêu đề.
`.trim();

function lengthToSceneCount(length) {
  if (length === "short") return 5;
  if (length === "long") return 9;
  if (length === "xl") return 40;
  return 7;
}

/**
 * Sinh kịch bản "Công Lược" dạng text theo đúng cú pháp npcScriptParser.js đọc được.
 * @param {Object} p
 * @param {'idea'|'chapter'} p.mode - 'idea': input là ý tưởng/bối cảnh + danh sách nhân vật muốn theo đuổi; 'chapter': input là nội dung chương truyện để chuyển thể thành 1 tuyến công lược.
 * @param {string} p.input
 * @param {'short'|'medium'|'long'|'xl'} [p.length]
 * @returns {Promise<string>} kịch bản dạng text, sẵn sàng dán vào Xưởng NPC (nên cho người dùng xem/sửa trước khi sản xuất).
 */
export async function generateNpcScriptFromPrompt({ mode, input, length }) {
  if (!input || !String(input).trim()) throw new Error("Thiếu nội dung đầu vào.");
  const sceneCount = lengthToSceneCount(length);

  const task =
    mode === "chapter"
      ? `Dưới đây là nội dung một chương truyện có nhiều nhân vật tiềm năng làm đối tượng theo đuổi. Hãy CHUYỂN THỂ nó thành kịch bản game "Công Lược" (otome/dating sim) — mỗi nhân vật nam/nữ chính đáng chú ý trong chương trở thành 1 tuyến "NHÂN VẬT" độc lập, khoảng ${sceneCount} cảnh mỗi tuyến, giữ đúng tinh thần/tính cách của họ nhưng thêm các điểm rẽ nhánh (lựa chọn tăng/giảm Thiện cảm) mà chương gốc không có.\n\nNỘI DUNG CHƯƠNG TRUYỆN:\n"""${input}"""`
      : `Từ ý tưởng/bối cảnh sau (kèm danh sách nhân vật muốn đưa vào làm đối tượng theo đuổi, nếu có), hãy sáng tác một kịch bản game "Công Lược" (otome/dating sim) HOÀN CHỈNH — mỗi nhân vật là 1 tuyến "NHÂN VẬT" độc lập khoảng ${sceneCount} cảnh, đều có kết thúc thành đôi và kết thúc thất bại riêng.\n\nÝ TƯỞNG:\n"""${input}"""`;

  if (length === "xl") {
    return generateLongByChunks({
      buildTask: (prompt) => aiCall(`Bạn là một biên kịch game otome/dating sim chuyên nghiệp, giỏi xây dựng nhiều tuyến tình cảm song song với tính cách nhân vật rõ nét. ` + prompt).then((t) => String(t || "").trim()),
      baseTask: task,
      syntaxGuide: SYNTAX_GUIDE,
      totalScenes: sceneCount,
    });
  }

  const prompt = `Bạn là một biên kịch game otome/dating sim chuyên nghiệp, giỏi xây dựng nhiều tuyến tình cảm song song với tính cách nhân vật rõ nét. ${task}\n\n${SYNTAX_GUIDE}\n\nChỉ trả về đúng nội dung kịch bản theo cú pháp trên, không thêm lời dẫn/giải thích nào khác trước hoặc sau.`;

  const text = await aiCall(prompt);
  return String(text || "").trim();
}
