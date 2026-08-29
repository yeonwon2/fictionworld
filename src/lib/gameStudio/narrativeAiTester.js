// Tầng 3 — "AI Narrative Tester": đọc lại ĐÚNG văn bản của MỘT tuyến chơi cụ
// thể (đã được mô phỏng state thật, xem routeExplorer.js#buildRoutes /
// personaSimulator.js) như một người đọc bình thường, rồi hỏi AI xem có chỗ
// nào nhân vật nhắc tới quan hệ/sự kiện/thông tin mà chính TUYẾN NÀY chưa hề
// xảy ra. Đây là loại lỗi Tầng 1 (dựng graph) và Tầng 2 (mô phỏng số liệu)
// KHÔNG bắt được, vì về mặt cấu trúc/trạng thái tuyến vẫn hợp lệ — chỉ có văn
// bản mới "biết" nhân vật đang nói gì.
//
// Module này KHÔNG đọc thẳng nodesMap — chỉ nhận vào "route" đã được chuẩn
// hoá bởi lớp gọi (gameTestReport.js), để không phụ thuộc chéo vào cấu trúc
// nội bộ của routeExplorer.js/personaSimulator.js.
//
// Tốn lượt gọi AI THẬT (bằng key riêng của người dùng, xem aiCall.js) — vì
// vậy CHỈ chạy khi người dùng bấm nút riêng, luôn cho chọn số tuyến kiểm tra,
// và không tự động chạy kèm Tầng 1/2.

import { aiCall } from "../aiCall.js";

const FINDING_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
          sceneId: { type: "string" },
          message: { type: "string" },
        },
        required: ["severity", "sceneId", "message"],
      },
    },
  },
  required: ["findings"],
};

/**
 * Chọn 1 tập tuyến nhỏ, đa dạng để gửi AI kiểm tra — tránh gọi AI tràn lan.
 * Ưu tiên: mỗi loại kết thúc khác nhau 1 tuyến trước, rồi mới bù thêm các
 * tuyến "đáng ngờ" (vd chết sớm do persona) cho tới khi đủ `max`.
 * @param {Array} routes - tuyến "bình thường" (từ buildRoutes(), có endingType).
 * @param {Array} [suspiciousRoutes] - tuyến ưu tiên khác (vd persona chết sớm).
 * @param {{max?: number}} [opts]
 */
export function sampleRoutesForAiCheck(routes, suspiciousRoutes = [], opts = {}) {
  const { max = 8 } = opts;
  const picked = [];
  const seenEndingType = new Set();
  const okRoutes = (routes || []).filter((r) => r.status === "ok");

  for (const r of okRoutes) {
    if (picked.length >= max) break;
    const type = r.endingType || "NORMAL_END";
    if (seenEndingType.has(type)) continue;
    seenEndingType.add(type);
    picked.push(r);
  }
  for (const r of suspiciousRoutes) {
    if (picked.length >= max) break;
    if (picked.some((p) => p.id === r.id)) continue;
    picked.push(r);
  }
  for (const r of okRoutes) {
    if (picked.length >= max) break;
    if (picked.some((p) => p.id === r.id)) continue;
    picked.push(r);
  }
  return picked.slice(0, max);
}

/**
 * Dựng transcript của 1 tuyến (chỉ văn bản THẬT trong kịch bản, không thêm
 * suy diễn) + đề bài cho AI. `endingText` là văn bản kết thúc thật (route ở
 * routeExplorer.js không lưu field này, lớp gọi cần tự tra `nodesMap[route.endingId].text`).
 */
export function buildNarrativeCheckPrompt(route, endingText = "") {
  const lines = (route.steps || []).map((step, i) => {
    const speaker = step.scene?.speaker ? `(${step.scene.speaker}) ` : "";
    const text = String(step.scene?.text || "").trim();
    const choiceText = step.choice?.text ? `\n→ Người chơi chọn: "${step.choice.text}"` : "";
    return `[${i + 1}] Cảnh "${step.sceneId}" ${speaker}\n${text}${choiceText}`;
  });
  if (endingText || route.endingId) {
    lines.push(`[Kết thúc] Cảnh "${route.endingId || "?"}" — ${route.endingLabel || ""}\n${String(endingText || "").trim()}`);
  }
  const transcript = lines.join("\n\n");

  return `Bạn là biên tập viên khó tính, đọc MỘT TUYẾN CHƠI CỤ THỂ của 1 game visual novel/nhập vai phân nhánh (không phải toàn bộ kịch bản — chỉ đúng những cảnh người chơi thực sự đi qua theo thứ tự dưới đây).

Nhiệm vụ: chỉ ra chỗ nào lời thoại/diễn biến MÂU THUẪN với chính những gì ĐÃ XẢY RA (hoặc CHƯA XẢY RA) trong ĐÚNG tuyến này. Ví dụ lỗi cần bắt: một nhân vật gọi người chơi là "ân nhân"/nhắc một kỷ niệm/thể hiện quan hệ thân thiết mà sự kiện tạo ra quan hệ đó KHÔNG nằm trong các cảnh đã liệt kê bên dưới (có thể sự kiện đó chỉ xảy ra ở một cảnh KHÁC mà tuyến này đã bỏ qua). Cũng báo nếu tuyến nhắc tới vật phẩm/thông tin người chơi chưa từng nhận được trong đúng các cảnh dưới đây.

KHÔNG báo lỗi chính tả/văn phong, KHÔNG suy đoán ngoài văn bản, KHÔNG bịa lỗi nếu không chắc chắn. Nếu tuyến này logic nhất quán, trả về mảng findings rỗng.

TUYẾN (theo đúng thứ tự chơi):
"""${transcript}"""`;
}

/**
 * Gọi AI tuần tự cho từng tuyến đã chọn — lỗi 1 tuyến không làm hỏng cả mẻ.
 * @param {Array} routes - danh sách route đã sampleRoutesForAiCheck().
 * @param {{ endingTextOf?: (route) => string, onProgress?: (done:number, total:number, route) => void }} [opts]
 * @returns {Promise<Array<{routeId:string, endingType:string, severity:string, sceneId:string, message:string}>>}
 */
export async function runNarrativeAiChecks(routes, opts = {}) {
  const { endingTextOf = () => "", onProgress } = opts;
  const findings = [];
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    onProgress?.(i, routes.length, route);
    try {
      const prompt = buildNarrativeCheckPrompt(route, endingTextOf(route));
      const result = await aiCall(prompt, { jsonSchema: FINDING_SCHEMA });
      const list = Array.isArray(result?.findings) ? result.findings : [];
      for (const f of list) {
        if (!f || !f.message) continue;
        findings.push({
          routeId: route.id,
          endingType: route.endingType || null,
          severity: ["critical", "high", "medium", "low"].includes(f.severity) ? f.severity : "medium",
          sceneId: String(f.sceneId || ""),
          message: String(f.message),
        });
      }
    } catch (e) {
      findings.push({ routeId: route.id, endingType: route.endingType || null, severity: "low", sceneId: "", message: `Không kiểm tra được tuyến này bằng AI: ${e?.message || "lỗi không rõ"}.` });
    }
  }
  onProgress?.(routes.length, routes.length, null);
  return findings;
}
