// Sửa trực tiếp trên VĂN BẢN kịch bản (không phải node graph đã parse) — dùng
// cho các nút hành động nhanh trong QA (vd "Xoá cờ này") để người viết không
// phải tự tìm dòng "→ Cờ: X"/"→ Vật phẩm: X" nằm ở đâu trong kịch bản dài.
//
// Regex khớp Y HỆT cú pháp mà cả 5 xưởng cùng dùng để NHẬN diện dòng cấp
// (xem RE_EFFECT/RE_EFF_FLAG/RE_EFF_ITEM lặp lại giống hệt nhau ở
// scriptParser.js/npcScriptParser.js/systemScriptParser.js/
// palaceScriptParser.js/rebirthScriptParser.js) — đổi cú pháp ở 1 trong 5 file
// đó thì phải sửa cả đây.

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Xoá MỌI dòng "→ Vật phẩm: X" (hoặc "→ Cờ: X") khớp đúng tên, ở bất kỳ đâu
 * trong kịch bản — an toàn vì đây là gợi ý "mồ côi" (đã xác nhận KHÔNG lựa
 * chọn nào yêu cầu vật phẩm/cờ này), nên xoá dòng cấp không đổi hành vi chơi.
 * @param {string} scriptText
 * @param {"item"|"flag"} kind
 * @param {string} name
 * @returns {{script: string, removedCount: number}}
 */
export function removeGrantLines(scriptText, kind, name) {
  const esc = escapeRegExp(String(name || "").trim());
  if (!esc) return { script: scriptText, removedCount: 0 };
  const pattern = kind === "item"
    ? new RegExp(`^\\s*(?:→|->|=>)\\s*(?:Nhận\\s+)?Vật phẩm:\\s*${esc}\\s*$`, "i")
    : new RegExp(`^\\s*(?:→|->|=>)\\s*Cờ:\\s*${esc}\\s*$`, "i");
  const lines = String(scriptText || "").split("\n");
  const kept = lines.filter((l) => !pattern.test(l));
  return { script: kept.join("\n"), removedCount: lines.length - kept.length };
}
