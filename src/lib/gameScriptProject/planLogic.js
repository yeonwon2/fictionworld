// Rà lỗi logic NGAY TRONG LÚC dựng bộ khung/dàn cảnh — trước khi có kịch bản
// văn bản thật (nên không thể chạy parser thật/postprocess.js ở bước này).
// Đây là kiểm tra NHẸ trên chính dữ liệu JSON (characters/settings/endings/
// branches/scenes) để báo "thiếu logic" NGAY KHI XUẤT HIỆN, thay vì phải đợi
// tới lúc ghép xong kịch bản văn bản ở FinalStep mới biết.
// Không thay thế realParseCheck() (chỉ nó mới bắt được lỗi cú pháp/mồ côi thật
// trên văn bản) — đây chỉ là lớp cảnh báo SỚM ở cấp độ ý tưởng/bộ khung.

/**
 * @param {Object} p
 * @param {Array} p.scenes - toàn bộ game_plan_scenes đã có (kể cả đang dở).
 * @param {Object} p.meta - game_plan_meta { characters, settings, endings, branches }.
 * @param {number} p.branchCount - số nhánh mục tiêu của dự án.
 * @param {number} p.sceneCountTarget - tổng số cảnh mục tiêu của dự án.
 * @param {boolean} [p.complete] - true nếu ĐÃ dựng xong toàn bộ dàn cảnh (bật
 *   thêm vài kiểm tra chỉ có ý nghĩa khi dữ liệu đã đầy đủ, tránh báo nhầm lúc
 *   đang dựng dở).
 * @returns {string[]} danh sách cảnh báo — không phân loại chặn/gợi ý, vì đây
 *   là bước ý tưởng, hoàn toàn có thể còn đang dở khi người viết đọc thấy.
 */
export function analyzePlanLogic({ scenes = [], meta = null, branchCount = 0, sceneCountTarget = 0, complete = false }) {
  const warnings = [];
  const endings = meta?.endings || [];
  const branches = meta?.branches || [];

  if (branches.length && endings.length && endings.length < branches.length) {
    warnings.push(`Chỉ có ${endings.length} kết thúc nhưng có ${branches.length} nhánh — mỗi nhánh nên có ít nhất 1 kết thúc riêng, nếu không các nhánh sẽ bị dồn chung vào cùng 1 kết cục.`);
  }

  const orderCount = new Map();
  for (const s of scenes) orderCount.set(s.scene_order, (orderCount.get(s.scene_order) || 0) + 1);
  const dup = [...orderCount.entries()].filter(([, n]) => n > 1).map(([o]) => o);
  if (dup.length) warnings.push(`Trùng số cảnh: ${dup.join(", ")} — mỗi số cảnh chỉ được xuất hiện 1 lần.`);

  const branchPointScenes = scenes.filter((s) => s.is_branch_point);
  for (const s of branchPointScenes) {
    const idx = Number(s.branch_index);
    if (Number.isNaN(idx) || idx < 0 || idx >= (branchCount || Infinity)) {
      warnings.push(`Cảnh ${s.scene_order} ("${s.title}") đánh dấu điểm rẽ vào nhánh số ${s.branch_index} nhưng dự án chỉ có ${branchCount} nhánh (0–${branchCount - 1}).`);
    }
  }
  if (complete && branchCount) {
    for (let i = 0; i < branchCount; i++) {
      const has = branchPointScenes.some((s) => Number(s.branch_index) === i);
      if (!has) warnings.push(`Nhánh ${i + 1}${branches[i]?.name ? ` ("${branches[i].name}")` : ""} chưa có cảnh nào đánh dấu là điểm rẽ của nó — nhánh này sẽ không thực sự xuất hiện trong kịch bản.`);
    }
  }

  for (const s of scenes) {
    if (!s.choices || !s.choices.length) {
      if (complete || s.scene_order < scenes.length) {
        warnings.push(`Cảnh ${s.scene_order} ("${s.title}") chưa có lựa chọn nào.`);
      }
      continue;
    }
    for (const c of s.choices) {
      if (!c.text?.trim()) warnings.push(`Cảnh ${s.scene_order}: có lựa chọn chưa có lời thoại.`);
      const m = String(c.target || "").match(/cảnh\s+(\d+)/i);
      if (m) {
        const target = Number(m[1]);
        if (complete && target > sceneCountTarget) {
          warnings.push(`Cảnh ${s.scene_order} — lựa chọn "${c.text}": trỏ tới cảnh ${target} nhưng kịch bản chỉ định ${sceneCountTarget} cảnh.`);
        }
      }
    }
  }

  if (complete && sceneCountTarget && scenes.length !== sceneCountTarget) {
    warnings.push(`Đang có ${scenes.length}/${sceneCountTarget} cảnh theo thiết lập — bấm "Thêm cảnh" nếu muốn bổ sung cho đủ, hoặc chỉnh lại Số cảnh ở bước Ý Tưởng.`);
  }

  return warnings;
}
