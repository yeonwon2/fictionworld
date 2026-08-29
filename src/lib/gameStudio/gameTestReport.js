// "Kiểm Tra Toàn Diện" — bộ tổng hợp 3 tầng test cho 1 game đã sản xuất
// (gameData.nodes/meta), dùng chung cho cả 5 xưởng (Thiết Kế/Hệ Thống/NPC/
// Cung Đấu/Trọng Sinh) vì tất cả đều ghi ra cùng 1 Canonical Script Model.
//
// CHỈ ĐỌC các module đã có sẵn (postprocess.js, routeExplorer.js) — không sửa
// hành vi hay export của chúng. Tầng 2 (persona) và Tầng 3 (AI) là 2 module
// hoàn toàn mới (personaSimulator.js, narrativeAiTester.js). File này chỉ
// ghép kết quả của 3 tầng thành 1 báo cáo có dạng
// { summary: {critical,high,medium,low}, coverage, endings, findings, persona }.

import { normalizeAndRepair, extractOrphanName } from "./postprocess.js";
import { graphReachable, buildRoutes, extractWarningNodeIds } from "./routeExplorer.js";
import { runPersonaSimulation, deriveBalanceFindings } from "./personaSimulator.js";
import { sampleRoutesForAiCheck } from "./narrativeAiTester.js";

function classifyStaticWarning(w) {
  if (typeof w !== "string") return "low";
  if (w.startsWith("[GỢI Ý]")) return "low";
  if (/KẸT CỨNG|KẸT VÒNG LẶP|không bao giờ vào được|nhưng không tồn tại trong kịch bản|KHÔNG thể đến được|đã ≤ ngưỡng chết/.test(w)) return "critical";
  return "high"; // các lỗi logic chặn đường chơi khác: thiếu vật phẩm/cờ nguồn, ngưỡng bất khả thi, hiệu ứng cú pháp sai bị bỏ qua...
}

function choiceAvailable(c, st) {
  for (const k in (c.statRequirements || {})) if ((st.stats[k] || 0) < c.statRequirements[k]) return false;
  for (const k in (c.statRequirementsMax || {})) if ((st.stats[k] || 0) > c.statRequirementsMax[k]) return false;
  if (c.requiresItem && !st.items.has(c.requiresItem)) return false;
  if (c.requiresFlag && !st.flags.has(c.requiresFlag)) return false;
  if (c.requiresFlagAbsent && st.flags.has(c.requiresFlagAbsent)) return false;
  if (c.requiresNpcAffinity) for (const n in c.requiresNpcAffinity) if ((st.npcAffinity[n] || 0) < c.requiresNpcAffinity[n]) return false;
  if (c.requiresNpcAffinityMax) for (const n in c.requiresNpcAffinityMax) if ((st.npcAffinity[n] || 0) > c.requiresNpcAffinityMax[n]) return false;
  return true;
}

function choiceTargets(c) {
  const out = [];
  if (c.targetNodeId) out.push(c.targetNodeId);
  if (c.diceRoll) { if (c.diceRoll.successTarget) out.push(c.diceRoll.successTarget); if (c.diceRoll.failTarget) out.push(c.diceRoll.failTarget); }
  if (c.combat) for (const t of [c.combat.winTarget, c.combat.loseTarget, c.combat.fleeTarget]) if (t) out.push(t);
  return out;
}

// BFS có state (chỉ số/vật phẩm/cờ) bị giới hạn số trạng thái — dùng riêng để
// tính % cảnh/lựa chọn THẬT SỰ khả dụng ít nhất 1 lần, khác graphReachable()
// (thuần cấu trúc, bỏ qua điều kiện khoá) và buildRoutes() (lấy mẫu để ĐỌC,
// không nhằm tính coverage chính xác).
function computeCoverage(nodesMap, statsConfig) {
  const totalScenes = Object.keys(nodesMap).length;
  const totalChoices = Object.values(nodesMap).reduce((sum, n) => sum + (n.choices || []).length, 0);
  const empty = { scenesTotal: totalScenes, scenesReached: 0, scenePercent: 0, choicesTotal: totalChoices, choicesReached: 0, choicePercent: 0, truncated: false };
  const startNode = nodesMap.start_node;
  if (!startNode) return empty;

  const startStats = {};
  for (const sc of (statsConfig || [])) startStats[sc.key] = typeof sc.default === "number" ? sc.default : 0;
  const vital = (statsConfig || []).filter((sc) => sc.isVital).map((sc) => ({ key: sc.key, threshold: sc.deathThreshold || 0 }));

  const sceneReached = new Set();
  const choiceReached = new Set();
  const visited = new Set();
  const MAX_STATES = 20000;
  let explored = 0;

  const stateSig = (id, st) => id + "|" + Object.keys(st.stats).sort().map((k) => k + "=" + st.stats[k]).join(",") + "|" + [...st.items].sort().join(",") + "|" + [...st.flags].sort().join(",");
  const queue = [];
  const push = (id, st) => {
    const sig = stateSig(id, st);
    if (visited.has(sig)) return;
    visited.add(sig);
    queue.push({ id, st });
  };
  push("start_node", { stats: { ...startStats }, items: new Set(), flags: new Set(), npcAffinity: {} });

  while (queue.length && explored < MAX_STATES) {
    const { id, st } = queue.shift();
    explored++;
    const node = nodesMap[id];
    if (!node) continue;
    sceneReached.add(id);
    const stHere = { stats: { ...st.stats }, items: new Set(st.items), flags: new Set(st.flags), npcAffinity: { ...st.npcAffinity } };
    if (node.grantItem) stHere.items.add(node.grantItem);
    if (node.setFlags) for (const f of node.setFlags) stHere.flags.add(f);
    if (node.isEnding) continue;

    (node.choices || []).forEach((c, ci) => {
      if (!choiceAvailable(c, stHere)) return;
      choiceReached.add(id + "::" + ci);
      const ns = { stats: { ...stHere.stats }, items: new Set(stHere.items), flags: new Set(stHere.flags), npcAffinity: { ...stHere.npcAffinity } };
      for (const [k, d] of Object.entries(c.statModifiers || {})) ns.stats[k] = (ns.stats[k] || 0) + d;
      if (c.grantItem) ns.items.add(c.grantItem);
      if (c.removeItem) ns.items.delete(c.removeItem);
      for (const gf of (c.grantFlags || [])) ns.flags.add(gf);
      if (c.npcAffinity) for (const n in c.npcAffinity) ns.npcAffinity[n] = (ns.npcAffinity[n] || 0) + c.npcAffinity[n];
      for (const v of vital) if ((ns.stats[v.key] || 0) <= v.threshold) return; // chết — không đi tiếp, nhưng lựa chọn vẫn tính là đã "test"
      for (const t of choiceTargets(c)) if (nodesMap[t]) push(t, ns);
    });
  }

  return {
    scenesTotal: totalScenes,
    scenesReached: sceneReached.size,
    scenePercent: totalScenes ? Math.round((sceneReached.size / totalScenes) * 1000) / 10 : 0,
    choicesTotal: totalChoices,
    choicesReached: choiceReached.size,
    choicePercent: totalChoices ? Math.round((choiceReached.size / totalChoices) * 1000) / 10 : 0,
    truncated: explored >= MAX_STATES,
  };
}

function computeEndingProbability(personaSim) {
  const totals = {};
  let totalRuns = 0;
  for (const p of Object.values(personaSim.personas)) {
    totalRuns += p.runs;
    for (const [endId, count] of Object.entries(p.endingCounts)) totals[endId] = (totals[endId] || 0) + count;
  }
  const probs = {};
  for (const [endId, count] of Object.entries(totals)) probs[endId] = totalRuns ? count / totalRuns : 0;
  return probs;
}

/**
 * Định dạng đường tái hiện lỗi kiểu "START → scene_1[2] → scene_5[4] → ...".
 * `steps` là mảng {sceneId, choiceIndex} (persona route hoặc route.steps).
 */
export function formatReproPath(steps, startLabel = "START") {
  if (!steps || !steps.length) return startLabel;
  return [startLabel, ...steps.map((s) => `${s.sceneId}[${(s.choiceIndex ?? 0) + 1}]`)].join(" → ");
}

function reconstructRouteFromPersonaPath(nodes, personaId, pathResult) {
  if (!pathResult || !pathResult.route?.length) return null;
  const steps = pathResult.route
    .map((s) => ({ sceneId: s.sceneId, scene: nodes[s.sceneId], choiceIndex: s.choiceIndex, choice: nodes[s.sceneId]?.choices?.[s.choiceIndex] }))
    .filter((s) => s.scene);
  if (!steps.length) return null;
  return { id: `persona_${personaId}_sample`, steps, status: "vital_death", endingId: null, endingLabel: `Chết vì chỉ số sinh tử (persona: ${personaId})`, endingType: null };
}

/**
 * Chạy Tầng 1 (đọc lại warnings từ normalizeAndRepair) + Tầng 2 (persona
 * simulation) và ghép thành 1 báo cáo. KHÔNG gọi AI (Tầng 3 tốn lượt gọi, chỉ
 * chạy riêng khi người dùng bấm nút — xem runNarrativeAiChecks trong
 * narrativeAiTester.js + getNarrativeCheckCandidates/endingTextFor dưới đây).
 * @param {Object} gameData - { nodes, meta } của game đang mở trong Xưởng Game.
 * @param {{ runsPerPersona?: number }} [options]
 */
export function buildGameTestReport(gameData, options = {}) {
  const meta = gameData?.meta || {};
  const statsConfig = meta.statsConfig || [];
  const rawNodes = gameData?.nodes || {};
  const statKeys = statsConfig.map((s) => s.key);

  let nodes, staticWarnings;
  try {
    const clone = JSON.parse(JSON.stringify(rawNodes));
    const repaired = normalizeAndRepair(clone, statKeys, 0, { forceNonEmptyModifiers: false, statsConfig });
    nodes = repaired.nodes;
    staticWarnings = repaired.warnings || [];
  } catch (e) {
    return { error: e?.message || "Không đọc được dữ liệu game." };
  }

  const { endings: structuralEndings } = graphReachable(nodes);
  const { routes, truncated: routesTruncated } = buildRoutes(nodes, statsConfig);
  const coverage = computeCoverage(nodes, statsConfig);
  const personaSim = runPersonaSimulation(nodes, statsConfig, { runsPerPersona: options.runsPerPersona ?? 1000 });
  const endingProbability = computeEndingProbability(personaSim);

  const staticFindings = staticWarnings.map((w) => ({
    severity: classifyStaticWarning(w),
    category: "static",
    message: w.replace(/^\[GỢI Ý\]\s*/, ""),
    reproPath: null,
    sceneIds: extractWarningNodeIds(w),
    orphan: extractOrphanName(w), // {kind:"item"|"flag", name} nếu là gợi ý mồ côi — dùng cho nút "Xoá" ở orphanFixer.js
  }));

  const balanceFindings = deriveBalanceFindings(personaSim).map((f) => ({
    severity: f.severity,
    category: "balance",
    message: f.message,
    reproPath: f.route?.length ? formatReproPath(f.route) : null,
    sceneIds: [...new Set((f.route || []).map((s) => s.sceneId))],
    deadStat: f.deadStat, // dùng cho computeBalanceFixOptions() ở balanceFixer.js (tính phương án sửa dựa trên đúng tuyến này)
    route: f.route,
  }));

  const findings = [...staticFindings, ...balanceFindings];
  const summary = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) if (summary[f.severity] !== undefined) summary[f.severity]++;

  const endingsList = structuralEndings.map((e) => ({
    id: e.id,
    label: e.label,
    type: e.type,
    reachedInSample: routes.some((r) => r.status === "ok" && r.endingId === e.id),
    probability: endingProbability[e.id] || 0,
  }));

  return {
    generatedAt: Date.now(),
    summary,
    coverage,
    endings: { total: structuralEndings.length, reachedInSample: endingsList.filter((e) => e.reachedInSample).length, list: endingsList },
    findings,
    persona: personaSim,
    routes,
    nodes, // bản đã qua normalizeAndRepair — chỉ dùng để ĐỌC (tra text kết thúc, tái dựng route persona), KHÔNG dùng để ghi (Sửa cảnh phải ghi vào gameData.nodes gốc, xem GameTestReportTab.jsx).
    truncated: routesTruncated || coverage.truncated,
  };
}

/** Văn bản thật của 1 kết thúc — route.steps không mang theo text kết thúc. */
export function endingTextFor(report, route) {
  return report.nodes?.[route.endingId]?.text || "";
}

/**
 * Chọn tập tuyến để đưa vào Tầng 3 (AI) — ưu tiên đa dạng loại kết thúc, bù
 * thêm các tuyến "chết sớm" điển hình theo persona (đáng ngờ nhất) nếu còn chỗ.
 */
export function getNarrativeCheckCandidates(report, opts = {}) {
  const suspicious = Object.entries(report.persona?.personas || {})
    .map(([id, p]) => reconstructRouteFromPersonaPath(report.nodes, id, p.sampleDeathRoute))
    .filter(Boolean);
  return sampleRoutesForAiCheck(report.routes, suspicious, opts);
}
