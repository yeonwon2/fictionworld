// Hỗ trợ viết kịch bản SIÊU DÀI (XL) bằng cách CHIA THÀNH NHIỀU ĐỢT gọi AI rồi
// ghép lại. Một lần gọi AI chỉ sinh được ~14 cảnh (giới hạn token), nên muốn
// 40-60-100 cảnh phải viết thành từng "hồi" (chunk) liên tiếp rồi đánh số lại
// toàn cục cho đúng CẢNH 1..N.

import { aiCall } from "@/lib/aiCall";

// Tách khối meta (đầu kịch bản: tiêu đề/thể loại/chỉ số...) khỏi phần cảnh.
// Mỗi chunk chỉ giữ meta ở chunk ĐẦU TIÊN; các chunk sau bắt đầu bằng CẢNH luôn.
export function splitHeader(sceneText, first) {
  const idx = sceneText.indexOf("CẢNH ");
  if (idx < 0) return { header: sceneText, body: "" };
  const header = sceneText.slice(0, idx).trim();
  const body = sceneText.slice(idx).trim();
  return { header: first ? header : "", body };
}

// Đánh số lại 1 chunk: mọi "CẢNH <n>" và "→ Đến cảnh <n>" tăng lên `offset`.
export function renumberScenes(body, offset) {
  if (offset === 0) return body;
  const shift = (n) => parseInt(n, 10) + offset;
  return body
    .replace(/^CẢNH\s+(\d+)/gm, (m, n) => "CẢNH " + shift(n))
    .replace(/→\s*Đến\s+cảnh\s+(\d+)/gi, (m, n) => "→ Đến cảnh " + shift(n));
}

/**
 * Sinh kịch bản siêu dài theo đợt.
 * @param {Object} p
 * @param {(prompt:string)=>Promise<string>} p.buildTask - nhận prompt đã có SYNTAX_GUIDE,
 *   trả về văn bản kịch bản (chunk) — là hàm riêng của từng xưởng.
 * @param {string} p.baseTask - mô tả nhiệm vụ chung (đã chèn ý tưởng/nội dung chương).
 * @param {string} p.syntaxGuide - CÚ PHÁP BẮT BUỘC của xưởng.
 * @param {number} p.totalScenes - tổng số cảnh muốn đạt (vd 60).
 * @param {number} [p.chunkScenes=14] - số cảnh mỗi đợt (AI viết được trong 1 lần gọi).
 * @returns {Promise<string>} toàn bộ kịch bản đã ghép + đánh số lại (CẢNH 1..N).
 */
export async function generateLongByChunks({ buildTask, baseTask, syntaxGuide, totalScenes, chunkScenes = 14 }) {
  const chunkCount = Math.max(2, Math.ceil(totalScenes / chunkScenes));
  const chunks = [];
  for (let i = 0; i < chunkCount; i++) {
    const isFirst = i === 0;
    const isLast = i === chunkCount - 1;
    const prompt = `Bạn là biên kịch game nhập vai. ${baseTask}\n\n` +
      `Đang viết HỒI ${i + 1}/${chunkCount} của một kịch bản tổng cộng ${totalScenes} cảnh.\n` +
      (isFirst ? "Viết kèm phần đầu kịch bản (tiêu đề, chỉ số, GIỚI THIỆU) như cú pháp mẫu.\n" : "KHÔNG viết lại tiêu đề/chỉ số/GIỚI THIỆU — bắt đầu thẳng bằng CẢNH.\n") +
      (isLast
        ? `Đây là HỒI CUỐI: kết thúc tất cả mạch truyện bằng ít nhất 1 khối "KẾT THÚC <nhãn>" và dùng "→ Kết thúc <nhãn>" từ các cảnh cuối.\n`
        : `Đây CHƯA phải hồi cuối: cảnh cuối hồi (và mọi cảnh muốn nối tiếp) dùng "→ Đến cảnh ${chunkScenes + 1}" để nối hồi sau. KHÔNG viết khối "KẾT THÚC" nào ở hồi này.\n`) +
      `Trong hồi này, đánh số cảnh BẮT ĐẦU TỪ 1 (CẢNH 1, CẢNH 2, ...) và mọi dòng "→ Đến cảnh N" cũng dùng SỐ NỘI BỘ của hồi (cảnh đích trong cùng hồi). Riêng dòng nối sang hồi sau luôn là "→ Đến cảnh ${chunkScenes + 1}" (số nội bộ = hết hồi cộng 1). Hệ thống sẽ tự đánh số lại toàn cục sau khi ghép.\n\n${syntaxGuide}\n\n` +
      `Chỉ trả về đúng nội dung kịch bản của HỒI ${i + 1} theo cú pháp trên, không thêm lời dẫn.`;
    chunks.push(await buildTask(prompt));
  }
  // Ghép + đánh số lại (an toàn kể cả khi AI đánh số lệch)
  const bodies = chunks.map((chunk, i) => splitHeader(chunk, i === 0));
  const offsets = [];
  let cumulative = 0;
  for (let i = 0; i < bodies.length; i++) {
    offsets.push(cumulative);
    cumulative += countScenes(bodies[i].body);
  }
  let out = "";
  for (let i = 0; i < bodies.length; i++) {
    let part = renumberScenes(bodies[i].body, offsets[i]);
    // Sửa dòng "nối hồi sau" (→ Đến cảnh X vượt ngoài phạm vi hồi này) trỏ đúng
    // sang cảnh đầu tiên của hồi kế tiếp.
    if (i < bodies.length - 1) {
      const nextFirst = offsets[i + 1] + 1;
      const localMax = offsets[i] + countScenes(bodies[i].body);
      part = part.replace(/→\s*Đến\s+cảnh\s+(\d+)/gi, (m, n) => {
        const v = parseInt(n, 10);
        return v > localMax ? "→ Đến cảnh " + nextFirst : m;
      });
    }
    if (i === 0) out = bodies[i].header ? bodies[i].header + "\n\n" + part + "\n\n" : part + "\n\n";
    else out += part + "\n\n";
  }
  return out.trim();
}

function countScenes(body) {
  const m = body.match(/^CẢNH\s+(\d+)/gm) || [];
  let max = 0;
  for (const line of m) {
    const n = parseInt(line.replace(/^CẢNH\s+/, ""), 10);
    if (n > max) max = n;
  }
  return max;
}
