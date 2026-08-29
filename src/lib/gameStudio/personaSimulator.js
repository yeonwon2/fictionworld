// Tầng 2 — "Bot Playtester": mô phỏng NHIỀU LƯỢT chơi độc lập trên đúng
// Canonical Script Model (nodesMap đã qua postprocess.js#normalizeAndRepair),
// mỗi lượt do 1 "persona" (tính cách bot) tự chọn lựa chọn theo một thiên
// hướng cố định, KHÔNG đọc trước cấu trúc đồ thị. Đây là lớp hoàn toàn MỚI,
// KHÔNG sửa/đụng gì tới postprocess.js hay routeExplorer.js — chỉ đọc cùng
// nodesMap mà 2 file đó cũng đọc.
//
// Khác với buildRoutes() trong routeExplorer.js (lấy MẪU công bằng theo nhánh
// để liệt kê "tuyến nào tồn tại"), persona simulator trả lời câu hỏi khác:
// "người chơi THẬT SỰ sẽ đi tới đâu, xác suất bao nhiêu, thường chết/kẹt ở
// đâu" — thứ mà kiểm tra cấu trúc thuần tuý không thấy được (vd một chỉ số
// sinh tử bị trừ quá nặng khiến gần như mọi lượt chơi tự nhiên chết trước khi
// đi được 1/4 kịch bản, dù bản thân đồ thị không hề có lỗi kết nối nào).
//
// Vì tên chỉ số trong mỗi kịch bản là tiếng Việt tự do (không có quy ước cố
// định như "hp"/"gold"), các persona (trừ "cố đạt HE" và "phá game" — 2 cái
// này được phép nhìn vào statsConfig[].isVital) chấm điểm lựa chọn dựa trên
// hình dạng hiệu ứng (dấu/độ lớn statModifiers, có/không cấp đồ, có rủi ro
// xúc xắc/chiến đấu hay không) — không đoán ý nghĩa ngữ nghĩa của tên chỉ số.

function cloneState(st) {
  return { stats: { ...st.stats }, items: new Set(st.items), flags: new Set(st.flags), npcAffinity: { ...st.npcAffinity } };
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

function applyChoiceEffects(st, c, extraMods, grantItemExtra) {
  const ns = cloneState(st);
  for (const [k, d] of Object.entries(c.statModifiers || {})) ns.stats[k] = (ns.stats[k] || 0) + d;
  for (const [k, d] of Object.entries(extraMods || {})) ns.stats[k] = (ns.stats[k] || 0) + d;
  if (c.grantItem) ns.items.add(c.grantItem);
  if (grantItemExtra) ns.items.add(grantItemExtra);
  if (c.removeItem) ns.items.delete(c.removeItem);
  for (const gf of (c.grantFlags || [])) ns.flags.add(gf);
  if (c.npcAffinity) for (const n in c.npcAffinity) ns.npcAffinity[n] = (ns.npcAffinity[n] || 0) + c.npcAffinity[n];
  return ns;
}

function enterNode(st, node) {
  const ns = cloneState(st);
  if (node.grantItem) ns.items.add(node.grantItem);
  if (node.setFlags) for (const f of node.setFlags) ns.flags.add(f);
  return ns;
}

function isDeadState(st, vital) {
  for (const v of vital) if ((st.stats[v.key] || 0) <= v.threshold) return v.key;
  return null;
}

// Xúc xắc/chiến đấu không được mô phỏng đúng cơ chế thật (khó/độ khó vs chỉ
// số) — chỉ xấp xỉ bằng xác suất cố định, đủ để ước lượng PHÂN BỐ kết thúc,
// không nhằm tái hiện chính xác luật chơi (đó là việc của GamePlayer.jsx).
function resolveNextTarget(choice, rng) {
  if (choice.diceRoll) {
    const succeed = rng() < 0.5;
    const dr = choice.diceRoll;
    return succeed
      ? { targetId: dr.successTarget, extraMods: dr.successMods || {} }
      : { targetId: dr.failTarget, extraMods: dr.failMods || {} };
  }
  if (choice.combat) {
    const cb = choice.combat;
    const win = rng() < 0.6;
    if (win) return { targetId: cb.winTarget, extraMods: (cb.loot && cb.loot.statModifiers) || {}, grantItemExtra: cb.loot && cb.loot.grantItem };
    return { targetId: cb.loseTarget || cb.fleeTarget || cb.winTarget, extraMods: {} };
  }
  return { targetId: choice.targetNodeId, extraMods: {} };
}

function netStatDelta(choice) {
  return Object.values(choice.statModifiers || {}).reduce((sum, v) => sum + v, 0);
}

function hasRisk(choice) {
  return !!(choice.diceRoll || choice.combat);
}

function vitalDelta(choice, vitalKeys) {
  let sum = 0;
  for (const [k, v] of Object.entries(choice.statModifiers || {})) if (vitalKeys.has(k)) sum += v;
  return sum;
}

function pickBest(avail, scoreFn, rng) {
  let best = [];
  let bestScore = -Infinity;
  for (const c of avail) {
    const s = scoreFn(c);
    if (s > bestScore) { bestScore = s; best = [c]; }
    else if (s === bestScore) best.push(c);
  }
  return best[Math.floor(rng() * best.length) % best.length];
}

// Mỗi persona chỉ cần định nghĩa `pick(avail, ctx, rng)` → trả về 1 phần tử
// của `avail`. `ctx = { vitalKeys, nodesMap }`.
export const PERSONAS = [
  {
    id: "reckless",
    label: "Liều lĩnh",
    description: "Ưu tiên lựa chọn xúc xắc/chiến đấu hoặc biến động chỉ số mạnh nhất, bất kể tốt xấu.",
    pick: (avail, ctx, rng) => pickBest(avail, (c) => (hasRisk(c) ? 1000 : 0) + Math.abs(netStatDelta(c)), rng),
  },
  {
    id: "greedy",
    label: "Tham lam",
    description: "Ưu tiên lựa chọn cho vật phẩm/cờ/exp, nếu không thì chọn cộng điểm nhiều nhất.",
    pick: (avail, ctx, rng) => pickBest(avail, (c) => (c.grantItem ? 500 : 0) + ((c.grantFlags || []).length ? 200 : 0) + (c.exp || 0) + (c.systemPoints || 0) + Math.max(0, netStatDelta(c)), rng),
  },
  {
    id: "cautious",
    label: "Cẩn thận",
    description: "Né xúc xắc/chiến đấu, chọn lựa chọn có biến động chỉ số nhỏ nhất (an toàn, ít cam kết).",
    pick: (avail, ctx, rng) => pickBest(avail, (c) => (hasRisk(c) ? -1000 : 0) - Math.abs(netStatDelta(c)), rng),
  },
  {
    id: "random",
    label: "Ngẫu nhiên",
    description: "Chọn hoàn toàn ngẫu nhiên trong các lựa chọn khả dụng — mô phỏng người chơi phổ thông không có chiến lược.",
    pick: (avail, _ctx, rng) => avail[Math.floor(rng() * avail.length) % avail.length],
  },
  {
    id: "he_seeking",
    label: "Cố đạt HE",
    description: "Luôn ưu tiên giữ chỉ số sinh tử cao nhất có thể — mô phỏng người chơi tối ưu để sống sót/đạt Happy Ending.",
    pick: (avail, ctx, rng) => pickBest(avail, (c) => (ctx.vitalKeys.size ? vitalDelta(c, ctx.vitalKeys) * 10 : netStatDelta(c)), rng),
  },
  {
    id: "griefer",
    label: "Phá game",
    description: "Cố tình chọn tệ nhất: dồn chỉ số sinh tử xuống thấp, né nhặt vật phẩm/cờ khi có lựa khác — dò lỗ hổng biên kịch không lường trước.",
    pick: (avail, ctx, rng) => pickBest(avail, (c) => {
      const vitalPenalty = ctx.vitalKeys.size ? -vitalDelta(c, ctx.vitalKeys) * 10 : -netStatDelta(c);
      const avoidLoot = (c.grantItem || (c.grantFlags || []).length) ? -50 : 0;
      return vitalPenalty + avoidLoot;
    }, rng),
  },
];

function simulateOne(nodesMap, statsConfig, persona, rng, maxSteps) {
  const vital = (statsConfig || []).filter((s) => s.isVital).map((s) => ({ key: s.key, threshold: s.deathThreshold || 0 }));
  const vitalKeys = new Set(vital.map((v) => v.key));
  const ctx = { vitalKeys, nodesMap };

  const startStats = {};
  for (const sc of (statsConfig || [])) startStats[sc.key] = typeof sc.default === "number" ? sc.default : 0;

  const startNode = nodesMap.start_node;
  if (!startNode) return { status: "broken", route: [], steps: 0 };

  let state = enterNode({ stats: startStats, items: new Set(), flags: new Set(), npcAffinity: {} }, startNode);
  let nodeId = "start_node";
  const route = [];

  for (let step = 0; step < maxSteps; step++) {
    const node = nodesMap[nodeId];
    if (!node) return { status: "broken", route, steps: step };
    const stateHere = step === 0 ? state : enterNode(state, node);
    if (node.isEnding) return { status: "ending", endingId: node.id, endingType: node.endingType || "NORMAL_END", route, steps: step };

    const avail = (node.choices || []).filter((c) => choiceAvailable(c, stateHere));
    if (!avail.length) return { status: "deadlock", route, steps: step };

    const choice = persona.pick(avail, ctx, rng);
    const choiceIndex = node.choices.indexOf(choice);
    const { targetId, extraMods, grantItemExtra } = resolveNextTarget(choice, rng);
    const afterChoice = applyChoiceEffects(stateHere, choice, extraMods, grantItemExtra);
    route.push({ sceneId: nodeId, choiceIndex, choiceText: choice.text || "" });

    const deadKey = isDeadState(afterChoice, vital);
    if (deadKey) return { status: "vital_death", deadStat: deadKey, route, steps: step + 1 };

    if (!targetId || !nodesMap[targetId]) return { status: "broken", route, steps: step + 1 };
    nodeId = targetId;
    state = afterChoice;
  }
  return { status: "maxsteps", route, steps: maxSteps };
}

// Xoay seed nhẹ theo index lượt + persona để nhiều lượt của cùng 1 persona
// không trùng hệt nhau khi dùng RNG có seed (test cần tái lập được).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * Chạy mô phỏng N lượt/persona trên nodesMap đã qua normalizeAndRepair.
 * @param {Object} nodesMap - Canonical Script Model (như GamePlayer.jsx dùng).
 * @param {Object[]} statsConfig - meta.statsConfig của game (key/default/isVital/deathThreshold).
 * @param {Object} [options]
 * @param {number} [options.runsPerPersona=1000]
 * @param {number} [options.maxSteps=250]
 * @param {Object[]} [options.personas=PERSONAS]
 * @param {number} [options.seed] - nếu truyền, RNG tái lập được (dùng cho test).
 * @returns {{ totalScenes:number, personas: Object<string, {label, runs, endingCounts, deathRate, deadlockRate, maxstepsRate, avgDepth, sampleDeathRoute, sampleDeadlockRoute}> }}
 */
export function runPersonaSimulation(nodesMap, statsConfig, options = {}) {
  const { runsPerPersona = 1000, maxSteps = 250, personas = PERSONAS, seed } = options;
  const totalScenes = Object.keys(nodesMap || {}).length;
  const personaResults = {};

  for (const persona of personas) {
    const endingCounts = {};
    let deathCount = 0, deadlockCount = 0, maxstepsCount = 0, brokenCount = 0, totalDepth = 0;
    let sampleDeathRoute = null;
    let sampleDeadlockRoute = null;
    const personaSeedBase = seed != null ? seed ^ hashStr(persona.id) : null;

    for (let i = 0; i < runsPerPersona; i++) {
      const rng = personaSeedBase != null ? mulberry32(personaSeedBase + i * 2654435761) : Math.random;
      const result = simulateOne(nodesMap, statsConfig, persona, rng, maxSteps);
      totalDepth += result.route.length;
      if (result.status === "ending") {
        endingCounts[result.endingId] = (endingCounts[result.endingId] || 0) + 1;
      } else if (result.status === "vital_death") {
        deathCount++;
        if (!sampleDeathRoute || result.route.length > sampleDeathRoute.route.length) sampleDeathRoute = result;
      } else if (result.status === "deadlock") {
        deadlockCount++;
        if (!sampleDeadlockRoute) sampleDeadlockRoute = result;
      } else if (result.status === "maxsteps") {
        maxstepsCount++;
      } else {
        brokenCount++;
      }
    }

    personaResults[persona.id] = {
      label: persona.label,
      description: persona.description,
      runs: runsPerPersona,
      endingCounts,
      deathRate: deathCount / runsPerPersona,
      deadlockRate: deadlockCount / runsPerPersona,
      maxstepsRate: maxstepsCount / runsPerPersona,
      brokenRate: brokenCount / runsPerPersona,
      avgDepth: totalDepth / runsPerPersona,
      sampleDeathRoute,
      sampleDeadlockRoute,
    };
  }

  return { totalScenes, personas: personaResults };
}

// Personas "chơi tự nhiên" — không cố tình tối ưu (he_seeking) hay cố tình phá
// (griefer) — dùng để đánh giá cân bằng số liệu cho người chơi phổ thông.
const NATURAL_PERSONA_IDS = new Set(["reckless", "greedy", "cautious", "random"]);

/**
 * Suy ra finding cân bằng số liệu từ kết quả mô phỏng — ví dụ điển hình: một
 * chỉ số sinh tử bị trừ quá nặng khiến người chơi TỰ NHIÊN (không cố ý tối ưu)
 * hay chết sớm, dù bản thân đồ thị không có lỗi cấu trúc nào cả (chính loại
 * lỗi đã gặp ở kịch bản "DƯỚI BÓNG PHÙ DUNG": Điểm Tác Hợp trừ quá nặng ở lựa
 * chọn lãng mạn khiến nhiều lượt chơi chết trước cảnh 8/114).
 *
 * Dùng persona TỰ NHIÊN TỆ NHẤT (không phải trung bình cả 4) làm điều kiện —
 * vì các persona tự nhiên có thiên hướng khác hẳn nhau (liều lĩnh/tham lam có
 * thể vô tình né được đòn chí mạng, cẩn thận/ngẫu nhiên thì không), lấy trung
 * bình sẽ pha loãng tín hiệu và bỏ sót đúng trường hợp "1 trong nhiều lối chơi
 * phổ biến chết sớm hàng loạt" mà biên kịch cần biết.
 * @param {ReturnType<typeof runPersonaSimulation>} simResult
 * @param {{ deathRateThreshold?: number, depthFractionThreshold?: number }} [opts]
 */
export function deriveBalanceFindings(simResult, opts = {}) {
  const { deathRateThreshold = 0.4, depthFractionThreshold = 0.3 } = opts;
  const findings = [];
  const naturalEntries = Object.entries(simResult.personas).filter(([id]) => NATURAL_PERSONA_IDS.has(id));
  if (!naturalEntries.length) return findings;

  const depthFractionOf = (p) => (simResult.totalScenes ? p.avgDepth / simResult.totalScenes : 1);
  const flagged = naturalEntries.filter(([, p]) => p.deathRate >= deathRateThreshold && depthFractionOf(p) <= depthFractionThreshold);
  if (!flagged.length) return findings;

  const [worstId, worstPersona] = flagged.reduce((a, b) => (b[1].deathRate > a[1].deathRate ? b : a));
  const depthFraction = depthFractionOf(worstPersona);
  findings.push({
    code: "BALANCE_EARLY_TERMINATION",
    message: `Persona "${worstPersona.label || worstId}" chết vì chỉ số sinh tử ở ${Math.round(worstPersona.deathRate * 100)}% số lượt, trước khi đi được ${Math.round(depthFraction * 100)}% kịch bản (trung bình ${worstPersona.avgDepth.toFixed(1)}/${simResult.totalScenes} cảnh). Đồ thị không có lỗi kết nối, nhưng biên độ trừ chỉ số sinh tử có thể đang quá nặng so với lối chơi này — kiểm tra lại các lựa chọn trừ điểm mạnh nhất trên đường tái hiện bên dưới.`,
    severity: "medium",
    route: worstPersona.sampleDeathRoute ? worstPersona.sampleDeathRoute.route : [],
    deadStat: worstPersona.sampleDeathRoute ? worstPersona.sampleDeathRoute.deadStat : null,
    personaId: worstId,
  });
  return findings;
}
