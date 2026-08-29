// Đề xuất SỬA CỤ THỂ cho finding cân bằng số liệu (BALANCE_EARLY_TERMINATION,
// xem personaSimulator.js#deriveBalanceFindings) — không đoán số chung chung,
// mà tính đúng số liệu THẬT trên chính kịch bản đang mở, cho xem trước rồi
// mới áp dụng (không tự ý sửa). Đây là phần "sửa" bổ sung cho "check" đã có,
// theo đúng yêu cầu: KHÔNG để AI tự bịa số — chỉ 2 phép biến đổi xác định
// (giảm mức trừ / tăng vốn khởi đầu), người viết chọn 1 trong 2 (hoặc giữ
// nguyên) theo đúng ý đồ sáng tác của họ.
//
// Áp dụng trực tiếp vào gameData.nodes/meta.statsConfig (giống cách
// RouteExplorerTab.jsx#updateNode đã làm cho NodeEditorDrawer) — CHƯA đụng gì
// tới meta.sourceScript, vì mỗi xưởng có cú pháp text khác nhau và người viết
// vẫn có thể dán lại kịch bản text mới bất cứ lúc nào (khi đó bản vá số này sẽ
// bị ghi đè, đúng như cảnh báo đã có sẵn ở RouteExplorerTab).

/** Mô phỏng LẠI đúng 1 tuyến (route đã biết từ finding) để tính giá trị chỉ số THẬT lúc chết. */
export function replayStatAlongRoute(nodes, startValue, route, statKey) {
  let value = startValue;
  for (const step of route || []) {
    const node = nodes[step.sceneId];
    const choice = node?.choices?.[step.choiceIndex];
    const delta = choice?.statModifiers?.[statKey];
    if (typeof delta === "number") value += delta;
  }
  return value;
}

function scaleDown(current) {
  const magnitude = Math.max(1, Math.round(Math.abs(current) / 2));
  return current < 0 ? -magnitude : magnitude;
}

function applyModifierEdits(gameData, edits, statKey) {
  const nodes = { ...(gameData.nodes || {}) };
  for (const e of edits) {
    const node = nodes[e.sceneId];
    if (!node) continue;
    nodes[e.sceneId] = {
      ...node,
      choices: (node.choices || []).map((c, ci) => (ci === e.choiceIndex ? { ...c, statModifiers: { ...(c.statModifiers || {}), [statKey]: e.next } } : c)),
    };
  }
  return { ...gameData, nodes };
}

function applyInitialBump(gameData, statKey, newStart) {
  const statsConfig = (gameData.meta?.statsConfig || []).map((s) => (s.key === statKey ? { ...s, default: newStart } : s));
  return { ...gameData, meta: { ...gameData.meta, statsConfig } };
}

/**
 * Tính 2-3 phương án sửa cụ thể cho 1 finding cân bằng ("category: balance",
 * có `deadStat`/`route`) — dùng số liệu THẬT của kịch bản đang mở, không đoán.
 * @param {Object} gameData - { nodes, meta } đang mở (bản GỐC, không phải bản đã normalizeAndRepair).
 * @param {{ category:string, deadStat:string, route: Array<{sceneId,choiceIndex}> }} finding
 * @returns {null|{ statKey:string, statLabel:string, affectedCount:number, options:Array<{id,label,preview,apply:(gameData)=>gameData|null}> }}
 */
export function computeBalanceFixOptions(gameData, finding) {
  if (!finding || finding.category !== "balance" || !finding.deadStat) return null;
  const nodes = gameData?.nodes || {};
  const statKey = finding.deadStat;
  const statsConfig = gameData?.meta?.statsConfig || [];
  const statMeta = statsConfig.find((s) => s.key === statKey);
  if (!statMeta) return null;

  const negativeEdits = [];
  for (const node of Object.values(nodes)) {
    (node.choices || []).forEach((c, ci) => {
      const v = c.statModifiers?.[statKey];
      if (typeof v === "number" && v < 0) negativeEdits.push({ sceneId: node.id, choiceIndex: ci, choiceText: c.text || "", current: v });
    });
  }
  if (!negativeEdits.length) return null;

  const startValue = typeof statMeta.default === "number" ? statMeta.default : 0;
  const threshold = statMeta.deathThreshold || 0;
  const deathValue = finding.route?.length ? replayStatAlongRoute(nodes, startValue, finding.route, statKey) : null;
  // Số điểm còn thiếu để chính đường mẫu đã chết KHÔNG chết nữa (đủ để vượt
  // ngưỡng đúng 1 điểm) — buộc phải tính trên tuyến mẫu thật, không đoán %.
  const deficit = deathValue != null ? Math.max(0, threshold - deathValue + 1) : null;
  const suggestedStart = deficit != null && deficit > 0 ? startValue + deficit : null;

  const halveEdits = negativeEdits.map((e) => ({ ...e, next: scaleDown(e.current) }));

  const options = [
    {
      id: "halve",
      label: `Nới nhẹ: giảm ${negativeEdits.length} mức trừ "${statMeta.label}" xuống còn ~một nửa`,
      preview: halveEdits.map((e) => ({ sceneId: e.sceneId, choiceText: e.choiceText, current: e.current, next: e.next })),
      apply: (gd) => applyModifierEdits(gd, halveEdits, statKey),
    },
  ];
  if (suggestedStart != null) {
    options.push({
      id: "buffer",
      label: `Tăng "Chỉ số khởi đầu" của ${statMeta.label} từ ${startValue} lên ${suggestedStart}`,
      preview: [{ sceneId: null, choiceText: "(Chỉ số khởi đầu, không phải 1 dòng lựa chọn)", current: startValue, next: suggestedStart }],
      apply: (gd) => applyInitialBump(gd, statKey, suggestedStart),
    });
  }
  options.push({
    id: "keep",
    label: "Giữ nguyên — đây là độ khó cố ý",
    preview: [],
    apply: null,
  });

  return { statKey, statLabel: statMeta.label, affectedCount: negativeEdits.length, options };
}
