// Cầu nối Xưởng Kịch Bản Game → parser THẬT của Xưởng Game (scriptParser,
// systemScriptParser, npcScriptParser, palaceScriptParser, rebirthScriptParser).
//
// Trước đây FinalStep tự kiểm tra bằng validateScript.js (regex bề mặt: chỉ
// bắt "Đến cảnh N" trỏ vào số không tồn tại...) — KHÔNG chạy qua
// normalizeAndRepair() nên bỏ lọt đúng những lỗi người viết gặp phải khi
// "Sản Xuất" thật ở Xưởng Game: cảnh mồ côi (không tới được), vật phẩm/cờ mồ
// côi, kẹt cứng, vòng lặp không lối ra, chỉ số sinh tử chết ngay từ đầu...
// Bằng cách gọi ĐÚNG parser thật ở đây, "Kiểm Tra" tại Xưởng Kịch Bản và "Sản
// Xuất" tại Xưởng Game giờ chạy CÙNG MỘT hàm — không còn lệch kết quả.
import { parseScript } from "@/lib/gameStudio/scriptParser";
import { parseSystemScript } from "@/lib/gameStudio/systemScriptParser";
import { parseNpcScript } from "@/lib/gameStudio/npcScriptParser";
import { parsePalaceScript } from "@/lib/gameStudio/palaceScriptParser";
import { parseRebirthScript } from "@/lib/gameStudio/rebirthScriptParser";
import { isSuggestionWarning } from "@/lib/gameStudio/postprocess";

const PARSERS = {
  studio: parseScript,
  system: parseSystemScript,
  npc: parseNpcScript,
  palace: parsePalaceScript,
  rebirth: parseRebirthScript,
};

export function parserForWorkshop(workshopId) {
  return PARSERS[workshopId] || parseScript;
}

/**
 * Chạy parser THẬT của Xưởng Game trên kịch bản đã ghép — kết quả này là
 * CHÍNH XÁC những gì sẽ xảy ra khi dán kịch bản này sang Xưởng Game rồi bấm
 * "Sản Xuất". Tách warnings "chặn đường chơi" (blocking) khỏi các gợi ý chất
 * lượng "[GỢI Ý]" (vật phẩm/cờ mồ côi, điều kiện thừa — không chặn ai, chỉ là
 * dấu hiệu quên nối) để UI hiển thị đúng mức độ nghiêm trọng.
 * @returns {{ok:boolean, blocking:string[], suggestions:string[], warnings:string[], meta:object|null, sceneCount:number, endingCount:number}}
 */
export function realParseCheck(workshopId, script, baseMeta = {}) {
  const parseFn = parserForWorkshop(workshopId);
  try {
    const result = parseFn(script, baseMeta);
    const warnings = result?.warnings || [];
    const blocking = warnings.filter((w) => !isSuggestionWarning(w));
    const suggestions = warnings.filter(isSuggestionWarning);
    const nodes = Object.values(result?.nodes || {});
    return {
      ok: true,
      blocking,
      suggestions,
      warnings,
      meta: result?.meta || null,
      sceneCount: nodes.filter((n) => !n.isEnding).length,
      endingCount: nodes.filter((n) => n.isEnding).length,
    };
  } catch (e) {
    const msg = String(e?.message || e);
    return { ok: false, blocking: [msg], suggestions: [], warnings: [msg], meta: null, sceneCount: 0, endingCount: 0 };
  }
}
