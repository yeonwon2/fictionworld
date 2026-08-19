// AI tự SỬA lỗi logic trong kịch bản — dùng chung cho mọi xưởng (Thiết Kế,
// Hệ Thống, NPC, Cung Đấu, Trọng Sinh). 
//
// Nguyên tắc quan trọng: AI viết lại cả kịch bản rất dễ "sửa chỗ này hỏng chỗ
// kia". Vì vậy: 
//   - Prompt yêu cầu sửa TỐI THIỂU (chỉ đụng đúng dòng lỗi, giữ nguyên phần khác).
//   - Mọi vòng sửa đều được KIỂM TRA LẠI bằng parser; chỉ chấp nhận kết quả
//     khi SỐ LỖI GIẢM. Hệ thống luôn giữ bản ít lỗi nhất → KHÔNG BAO GIỜ tệ
//     hơn bản gốc.

import { aiCall } from "@/lib/aiCall";

const CHECKLIST = `
QUY TẮC SỬA (bắt buộc, tuân thủ CHÍNH XÁC):
1. CHỈ sửa ĐÚNG các lỗi được liệt kê trong DANH SÁCH LỖI. KHÔNG viết lại cảnh,
   KHÔNG đổi tên nhân vật/cảnh/kết thúc, KHÔNG thêm nhân vật hoặc ý tưởng mới,
   KHÔNG đổi mạch truyện, KHÔNG thêm cảnh mới.
2. Sửa TỐI THIỂU: ưu tiên 1 trong các cách sau theo thứ tự:
   a) Thêm dòng cho đồ/cờ cần thiết ở một cảnh phía trước ("→ Vật phẩm: X" /
      "→ Cờ: X").
   b) Bỏ bớt dòng "→ Cần ..." đang gây lỗi (nếu không quan trọng).
   c) Giảm/tăng ngưỡng chỉ số cho KHẢ THI (dựa trên chỉ số khởi đầu + các lần
      tăng/giảm ở phía trước).
3. TUYỆT ĐỐI KHÔNG tạo ra lỗi mới: mọi "→ Cần vật phẩm: Y" bạn thêm vào đều
   PHẢI có "→ Vật phẩm: Y" ở phía trước; mọi "→ Cần cờ: Y" đều PHẢI có "→ Cờ: Y"
   ở phía trước; mọi ngưỡng chỉ số đều phải đạt được. Nếu không chắc chắn, đừng
   thêm yêu cầu mới.
4. Nếu bạn phải nối lại "→ Đến cảnh N" thì cảnh đích phải mở đầu bằng câu nhắc
   lại tình huống vừa xảy ra (mạch truyện liền mạch).
5. Giữ NGUYÊN phần không bị lỗi — chép lại y hệt, không cải biên, không thêm mô tả.
`;

/**
 * Nhờ AI sửa kịch bản theo danh sách lỗi đã phát hiện (1 lượt gọi).
 * @param {string} cheatSheet - kịch bản mẫu cú pháp của xưởng.
 * @param {string} script - kịch bản đang cần sửa.
 * @param {string[]} warnings - danh sách lỗi/cảnh báo cần xử lý.
 * @returns {Promise<string>} toàn bộ kịch bản sau khi sửa.
 */
export async function fixScriptWithAI(cheatSheet, script, warnings) {
  const prompt = `Bạn là biên kịch game nhập vai. Sửa kịch bản dưới đây để HẾT các lỗi logic.\n\n` +
    `KỊCH BẢN MẪU ĐÚNG CÚ PHÁP:"""${cheatSheet}"""\n\n` +
    `KỊCH BẢN CẦN SỬA:"""${script}"""\n\n` +
    `DANH SÁCH LỖI:\n` + warnings.map((w) => " - " + w).join("\n") + "\n\n" + CHECKLIST +
    `\nTrả về TOÀN BỘ kịch bản đã sửa theo đúng cú pháp mẫu. KHÔNG thêm lời dẫn/giải thích trước hoặc sau.`;

  const text = await aiCall(prompt);
  return String(text || "").trim();
}

function safeWarnings(parseFn, script) {
  try {
    const parsed = parseFn(script);
    return { list: parsed.warnings || [], count: (parsed.warnings || []).length };
  } catch {
    return { list: [], count: Infinity }; // lỗi cú pháp nghiêm trọng → coi như "rất tệ"
  }
}

/**
 * "XƯỞNG SẢN XUẤT KỊCH BẢN CHUẨN": viết kịch bản → tự kiểm tra → tự nhờ AI sửa
 * → kiểm tra lại, lặp tối đa `maxRounds` lần cho tới khi hết lỗi.
 * LUÔN GIỮ BẢN ÍT LỖI NHẤT — một lượt sửa nào làm tăng lỗi sẽ bị bỏ qua và quay
 * về bản tốt nhất, nên kết quả KHÔNG BAO GIỜ tệ hơn kịch bản ban đầu.
 * @param {Object} p
 * @param {string} p.cheatSheet - kịch bản mẫu cú pháp của xưởng.
 * @param {(script:string)=>object} p.parseFn - hàm parse kịch bản trả { warnings }.
 * @param {string} p.script - kịch bản cần được kiểm tra/sửa.
 * @param {number} [p.maxRounds=3] - số vòng sửa tối đa.
 * @returns {Promise<{script:string, warnings:string[], clean:boolean, rounds:number, improved:boolean}>}
 */
export async function verifyAndFixScript({ cheatSheet, parseFn, script, maxRounds = 3 }) {
  let best = script;
  let bestInfo = safeWarnings(parseFn, script);
  const report = { script: best, warnings: bestInfo.list, clean: bestInfo.count === 0, rounds: 0, improved: false };
  if (report.clean) return report;
  for (let i = 0; i < maxRounds; i++) {
    let fixed;
    try {
      fixed = await fixScriptWithAI(cheatSheet, best, bestInfo.list);
    } catch {
      break; // gọi AI lỗi (thiếu key...) → dừng, giữ bản tốt nhất
    }
    const info = safeWarnings(parseFn, fixed);
    if (info.count < bestInfo.count) {
      best = fixed;
      bestInfo = info;
      report.improved = true;
      report.rounds = i + 1;
      if (info.count === 0) break;
    }
    // nếu lần này không tốt hơn: bỏ kết quả, thử lại từ bản tốt nhất ở vòng sau
  }
  report.script = best;
  report.warnings = bestInfo.list;
  report.clean = bestInfo.count === 0;
  return report;
}