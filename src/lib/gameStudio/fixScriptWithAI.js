// AI tự SỬA lỗi logic trong kịch bản — dùng chung cho mọi xưởng (Thiết Kế,
// Hệ Thống, NPC, Cung Đấu, Trọng Sinh). Nhận danh sách lỗi/cảnh báo do bộ
// kiểm tra logic (postprocess.normalizeAndRepair) phát hiện rồi nhờ AI sửa,
// trả về TOÀN BỘ kịch bản đã sửa. Chạy 1 lượt AI thứ hai, nên chỉ dùng khi
// người dùng chủ động bấm nút (tốn thêm token của người dùng).

import { aiCall } from "@/lib/aiCall";

const CHECKLIST = `
KIỂM TRA & SỬA CÁC LỖI SAU, giữ nguyên mọi nội dung/ý tưởng khác:
1. VẬT PHẨM MỒ CÔI: mọi dòng "→ Cần vật phẩm: X" PHẢI có ít nhất 1 dòng
   "→ Vật phẩm: X" (hoặc "→ Nhận Vật phẩm: X") ở MỘT CẢNH PHÍA TRƯỚC có thể
   tới được. Nếu không: bỏ bớt yêu cầu đó, hoặc thêm lựa chọn cho vật phẩm.
2. CỜ MỒ CÔI: mọi dòng "→ Cần cờ: X" / "→ Cần không có cờ: X" PHẢI có dòng
   "→ Cờ: X" tạo ra cờ đó ở phía trước (hoặc cờ đó phải không bao giờ được tạo
   với "Cần không có cờ"). Nếu không: sửa tương tự như vật phẩm.
3. NGƯỠNG CHỈ SỐ BẤT KHẢ THI: mọi dòng "→ Cần <chỉ số> >= N" / "<= N" phải đạt
   được dựa trên "Chỉ số khởi đầu" cộng các lần tăng/giảm ở phía trước. Nếu
   không thể đạt: giảm/tăng ngưỡng cho hợp lý hoặc thêm lựa chọn điều chỉnh.
4. MẠCH TRUYỆN: "→ Đến cảnh N" phải MẠCH LẠC — cảnh đích phải mở đầu bằng câu
   nối liền với tình huống vừa xảy ra (nhắc lại ngữ cảnh người chơi vừa trải
   qua), KHÔNG được nhảy sang chuyện khác không liên quan.
5. CẢNH MỒ CÔI: cảnh nào không có lựa chọn nào trỏ tới từ start_node thì XOÁ
   bỏ hoặc thêm "→ Đến cảnh N" trỏ vào từ một cảnh đang chạy được.
6. NHÃN KẾT THÚC: mọi "→ Kết thúc <nhãn>" phải khớp Y HỆT 1 khối
   "KẾT THÚC <nhãn>" có thật ở cuối kịch bản.
`;

/**
 * Nhờ AI sửa toàn bộ kịch bản theo danh sách lỗi đã phát hiện.
 * @param {string} cheatSheet - kịch bản mẫu cú pháp của xưởng (để AI bám cú pháp).
 * @param {string} script - kịch bản đang cần sửa.
 * @param {string[]} warnings - danh sách lỗi/cảnh báo cần xử lý.
 * @returns {Promise<string>} toàn bộ kịch bản đã sửa.
 */
export async function fixScriptWithAI(cheatSheet, script, warnings) {
  const prompt = `Bạn là biên kịch game nhập vai. Dưới đây là KỊCH BẢN MẪU đúng cú pháp:"""${cheatSheet}"""\n\n` +
    `Dưới đây là KỊCH BẢN HIỆN TẠI cần sửa:"""${script}"""\n\n` +
    `Hệ thống đã rà soát và phát hiện các lỗi logic sau (danh sách lỗi chỉ là GỢI Ý — hãy tự rà soát lại toàn bộ kịch bản theo checklist bên dưới):\n` +
    warnings.map((w) => " - " + w).join("\n") + "\n\n" + CHECKLIST +
    `\nTrả về TOÀN BỘ kịch bản ĐÃ SỬA theo đúng cú pháp mẫu (giữ nguyên tiêu đề, chỉ số, toàn bộ cảnh hợp lệ). KHÔNG thêm lời dẫn/giải thích trước hoặc sau.`;

  const text = await aiCall(prompt);
  return String(text || "").trim();
}

/**
 * "XƯỞNG SẢN XUẤT KỊCH BẢN CHUẨN": viết kịch bản → tự kiểm tra → tự nhờ AI
 * sửa lỗi → kiểm tra lại, lặp tối đa `maxRounds` lần cho tới khi hết lỗi.
 * Trả về kịch bản cuối + kết quả kiểm tra (0 lỗi = chuẩn).
 * @param {Object} p
 * @param {string} p.cheatSheet - kịch bản mẫu cú pháp của xưởng.
 * @param {(script:string)=>object} p.parseFn - hàm parse kịch bản trả { warnings }.
 * @param {string} p.script - kịch bản AI vừa sinh ra (cần được kiểm tra/sửa).
 * @param {number} [p.maxRounds=3] - số vòng sửa tối đa.
 */
export async function verifyAndFixScript({ cheatSheet, parseFn, script, maxRounds = 3 }) {
  let current = script;
  const report = { script: current, warnings: [], rounds: 0, clean: false };
  for (let i = 0; i < maxRounds; i++) {
    const parsed = parseFn(current);
    const ws = parsed.warnings || [];
    if (ws.length === 0) {
      report.script = current;
      report.warnings = [];
      report.clean = true;
      report.rounds = i;
      return report;
    }
    report.rounds = i + 1;
    current = await fixScriptWithAI(cheatSheet, current, ws);
  }
  const final = parseFn(current);
  report.script = current;
  report.warnings = final.warnings || [];
  report.clean = report.warnings.length === 0;
  return report;
}