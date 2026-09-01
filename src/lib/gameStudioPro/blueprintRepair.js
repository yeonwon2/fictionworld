// Xưởng Game Pro — TỰ SỬA sơ đồ AI vừa dựng, KHÔNG bắt người dùng thường tự
// hiểu/sửa lỗi kỹ thuật (canonical rule/entity/graph). Chỉ chứa hàm THUẦN
// (không gọi AI) — tách khỏi phần điều phối gọi AI (blueprintAI.js) để test
// được trực tiếp và tránh vòng phụ thuộc (blueprintAI.js sẽ import module
// này, không phải ngược lại).
//
// Nguyên tắc (đúng yêu cầu "self-repair"): PHÂN LOẠI lỗi trước — cái gì suy
// luận cục bộ được (registry đã cập nhật, khớp gần đúng tên...) thì sửa
// ngay, không tốn AI (xem refreshBlueprintEffects() ở blueprintAI.js, đã làm
// đúng việc này). Cái gì THẬT SỰ thiếu NỘI DUNG (hệ quả các lựa chọn) thì
// không thể suy luận cục bộ — đây là phần duy nhất cần AI, và phải GỘP CHUNG
// 1 lượt gọi cho toàn bộ tập thay vì gọi riêng từng cảnh (mục "request-saver").
import { SCENE_ROLES } from "./blueprintModel.js";
import { parseEffectsDeterministic } from "./ruleParser.js";

// Tìm mọi cảnh QUYẾT ĐỊNH có lựa chọn THIẾU hệ quả luật thật, hoặc có 2+ lựa
// chọn cho CÙNG 1 hệ quả (vi phạm "mỗi lựa chọn phải có hệ quả riêng, không
// phải lựa chọn nào cũng cộng điểm") — đây là lỗi duy nhất trong nhóm
// "unresolved/duplicate effect" mà code KHÔNG thể tự bịa số liệu để sửa, bắt
// buộc phải xin AI đề xuất nội dung mới.
export function findChoiceEffectGaps(blueprint) {
  const gaps = [];
  for (const scene of blueprint?.scenes || []) {
    if (scene.role !== SCENE_ROLES.DECISION) continue;
    const choices = scene.choices || [];
    if (choices.length < 2) continue;
    const signatures = choices.map((c) => JSON.stringify(c.rules?.effects || []));
    const problemChoiceIds = new Set();
    choices.forEach((c, i) => {
      const hasEffect = (c.rules?.effects || []).length > 0;
      const isDuplicate = signatures.filter((sig) => sig === signatures[i]).length > 1;
      if (!hasEffect || isDuplicate) problemChoiceIds.add(c.id);
    });
    if (problemChoiceIds.size) {
      gaps.push({ sceneId: scene.id, sceneTitle: scene.title, sceneIntent: scene.intent, choices, problemChoiceIds });
    }
  }
  return gaps;
}

// Gộp các bản vá { choiceId, effectIntent } của AI vào blueprint — hàm
// THUẦN, cùng cách phân giải effectIntent -> rules.effects với
// applyNormalizedBlueprint()/refreshBlueprintEffects() ở blueprintAI.js (chỉ
// đổi CHOICE ĐƯỢC VÁ, giữ nguyên mọi cảnh/lựa chọn khác — không viết lại gì
// ngoài phạm vi bản vá).
export function applyEffectFixes(blueprint, fixes, registry) {
  const byChoiceId = new Map((fixes || []).filter((f) => f?.choiceId && f?.effectIntent).map((f) => [f.choiceId, f.effectIntent]));
  if (!byChoiceId.size) return blueprint;
  return {
    ...blueprint,
    scenes: (blueprint.scenes || []).map((s) => ({
      ...s,
      choices: (s.choices || []).map((c) => {
        if (!byChoiceId.has(c.id)) return c;
        const effectIntent = byChoiceId.get(c.id);
        const parsed = parseEffectsDeterministic(effectIntent, registry);
        const effects = parsed.items?.filter((item) => item.status === "ok").map((item) => item.effect) || [];
        const unresolvedEffects = parsed.items?.some((item) => item.status !== "ok") || parsed.unmatchedText || !parsed.items?.length
          ? [{ intent: effectIntent, items: parsed.items || [] }]
          : [];
        return { ...c, effectIntent, rules: { ...c.rules, effects }, unresolvedEffects };
      }),
    })),
  };
}
