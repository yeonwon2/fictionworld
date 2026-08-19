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
import { isSuggestionWarning } from "./postprocess";

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

const SCRIPT_MARKER = "===KỊCH BẢN===";
const EXPLAIN_MARKER = "===GIẢI THÍCH===";

// Định dạng phân tách bằng dấu mốc văn bản thường (không phải JSON) — cùng lý
// do với scriptWriter.js: đơn giản, không bị lỗi cắt cụt/escape như JSON khi
// kịch bản dài. Nếu AI lỡ không theo đúng định dạng (thiếu 1 trong 2 mốc),
// coi toàn bộ phản hồi là kịch bản và bỏ qua phần giải thích — không để 1 câu
// trả lời sai định dạng làm mất luôn kết quả sửa.
function parseFixResponse(raw) {
  const text = String(raw || "").trim();
  const si = text.indexOf(SCRIPT_MARKER);
  const ei = text.indexOf(EXPLAIN_MARKER);
  if (si === -1 || ei === -1 || ei < si) {
    return { script: text.replace(SCRIPT_MARKER, "").trim(), explanations: [] };
  }
  const script = text.slice(si + SCRIPT_MARKER.length, ei).trim();
  const explainRaw = text.slice(ei + EXPLAIN_MARKER.length).trim();
  const explanations = explainRaw
    .split("\n")
    .map((l) => l.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
  return { script, explanations };
}

/**
 * Nhờ AI sửa kịch bản theo danh sách lỗi đã phát hiện (1 lượt gọi).
 * @param {string} cheatSheet - kịch bản mẫu cú pháp của xưởng.
 * @param {string} script - kịch bản đang cần sửa.
 * @param {string[]} warnings - danh sách lỗi/cảnh báo cần xử lý.
 * @returns {Promise<{script:string, explanations:string[]}>} kịch bản đã sửa
 *   + giải thích ngắn (1 dòng/lỗi) AI đã sửa thế nào, để người viết học được
 *   thay vì chỉ nhận bản đã sửa mà không hiểu vì sao.
 */
export async function fixScriptWithAI(cheatSheet, script, warnings) {
  const prompt = `Bạn là biên kịch game nhập vai. Sửa kịch bản dưới đây để HẾT các lỗi logic.\n\n` +
    `KỊCH BẢN MẪU ĐÚNG CÚ PHÁP:"""${cheatSheet}"""\n\n` +
    `KỊCH BẢN CẦN SỬA:"""${script}"""\n\n` +
    `DANH SÁCH LỖI:\n` + warnings.map((w) => " - " + w).join("\n") + "\n\n" + CHECKLIST +
    `\nTrả về ĐÚNG định dạng sau, không thêm gì khác ngoài 2 mục này:\n\n` +
    `${SCRIPT_MARKER}\n(toàn bộ kịch bản đã sửa theo đúng cú pháp mẫu)\n\n` +
    `${EXPLAIN_MARKER}\n(mỗi lỗi trong DANH SÁCH LỖI 1 dòng, dạng "- <tóm tắt lỗi>: <đã sửa thế nào>", theo đúng thứ tự đã liệt kê)`;

  const text = await aiCall(prompt);
  return parseFixResponse(text);
}

// Gợi ý chất lượng (isSuggestionWarning, vd vật phẩm/cờ mồ côi, điều kiện
// thừa) KHÔNG phải lỗi chặn đường chơi được. Không đưa vào danh sách gửi AI
// sửa (AI có thể "sửa" bằng cách xoá mất một thiết kế cố ý), và không tính
// vào "còn lỗi hay không" — nếu không thì một kịch bản chỉ còn gợi ý sẽ không
// bao giờ đạt trạng thái "sạch".
function safeWarnings(parseFn, script) {
  try {
    const parsed = parseFn(script);
    const list = parsed.warnings || [];
    const blocking = list.filter((w) => !isSuggestionWarning(w));
    return { list, blocking, count: blocking.length };
  } catch {
    return { list: [], blocking: [], count: Infinity }; // lỗi cú pháp nghiêm trọng → coi như "rất tệ"
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
 * @param {string[]} [p.focusWarnings] - nếu có, CHỈ nhờ AI sửa đúng các lỗi
 *   này (người viết tự chọn từng lỗi muốn AI đụng vào) — các lỗi khác không
 *   được gửi cho AI và tiến độ được đo trên đúng tập con này, dù `clean` cuối
 *   cùng vẫn phản ánh TOÀN BỘ kịch bản (còn lỗi khác chưa chọn thì vẫn chưa
 *   "sạch"). Không truyền = sửa hết mọi lỗi (hành vi cũ).
 * @returns {Promise<{script:string, warnings:string[], clean:boolean, rounds:number, improved:boolean, explanations:string[], originalScript:string}>}
 *   `originalScript` là bản TRƯỚC khi sửa — dùng để hiển thị diff trước/sau ở UI.
 */
export async function verifyAndFixScript({ cheatSheet, parseFn, script, maxRounds = 3, focusWarnings }) {
  let best = script;
  let bestInfo = safeWarnings(parseFn, script);
  const focusSet = focusWarnings && focusWarnings.length ? new Set(focusWarnings) : null;
  const targetList = (info) => (focusSet ? info.blocking.filter((w) => focusSet.has(w)) : info.blocking);

  const explanations = [];
  const report = {
    script: best, warnings: bestInfo.list, clean: bestInfo.count === 0,
    rounds: 0, improved: false, explanations, originalScript: script,
  };
  if (targetList(bestInfo).length === 0) return report;

  for (let i = 0; i < maxRounds; i++) {
    const toSend = targetList(bestInfo);
    if (toSend.length === 0) break;
    let fixed;
    try {
      fixed = await fixScriptWithAI(cheatSheet, best, toSend);
    } catch {
      break; // gọi AI lỗi (thiếu key...) → dừng, giữ bản tốt nhất
    }
    const info = safeWarnings(parseFn, fixed.script);
    if (targetList(info).length < toSend.length) {
      best = fixed.script;
      bestInfo = info;
      report.improved = true;
      report.rounds = i + 1;
      if (fixed.explanations.length) explanations.push(...fixed.explanations);
      if (targetList(info).length === 0) break;
    }
    // nếu lần này không tốt hơn (trên tập lỗi đang nhắm tới): bỏ kết quả, thử lại từ bản tốt nhất ở vòng sau
  }
  report.script = best;
  report.warnings = bestInfo.list;
  report.clean = bestInfo.count === 0;
  return report;
}