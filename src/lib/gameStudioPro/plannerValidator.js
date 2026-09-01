// Xưởng Game Pro — PRO 1: kiểm tra nhẹ cho Bản thiết kế (không dùng AI).
//
// Đây CHỈ là "planner validation" (kiểm tra dữ liệu kế hoạch có dùng được
// không) — KHÔNG phải graph checker (không kiểm tra scene/node vì PRO 1
// chưa sinh graph thật). Theo yêu cầu: cảnh báo (warnings) không chặn duyệt
// bản thiết kế; chỉ dữ liệu thực sự không dùng được mới là blocker.
export function validateGamePlan(storyBlueprint) {
  const warnings = [];
  const blockers = [];
  const gamePlan = storyBlueprint?.gamePlan;
  const episodes = storyBlueprint?.episodes || [];

  if (!gamePlan || !gamePlan.title?.trim()) {
    blockers.push("Chưa có tên game.");
  }

  if (storyBlueprint?.settings?.gameLength === "long" && episodes.length === 0) {
    warnings.push("Đây là game nhiều tập nhưng chưa có tập nào — hãy lập kế hoạch hoặc thêm tập.");
  }

  episodes.forEach((ep, i) => {
    const label = ep.title?.trim() || `Tập ${i + 1}`;
    if (!ep.goal?.trim()) warnings.push(`${label}: chưa có mục tiêu.`);
    if (!ep.stages || ep.stages.length === 0) warnings.push(`${label}: chưa có giai đoạn nào.`);
  });

  if (episodes.length > 0 && !gamePlan?.endingStrategy?.trim()) {
    warnings.push("Chưa có định hướng kết thúc chung cho game (endingStrategy).");
  }

  const knownStatNames = new Set((gamePlan?.suggestedStats || []).map((s) => s.name?.trim().toLowerCase()).filter(Boolean));
  episodes.forEach((ep, i) => {
    const label = ep.title?.trim() || `Tập ${i + 1}`;
    for (const statName of ep.relevantStats || []) {
      const key = statName?.trim().toLowerCase();
      if (key && !knownStatNames.has(key)) {
        warnings.push(`${label}: nhắc tới chỉ số "${statName}" nhưng chỉ số này chưa có trong danh sách Chỉ số đề xuất.`);
      }
    }
  });

  return { warnings, blockers };
}
