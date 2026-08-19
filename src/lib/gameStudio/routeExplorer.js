// Route Explorer — tách một nodesMap (Canonical Script Model, xem scriptParser.js/
// postprocess.js) thành từng "tuyến chơi" cụ thể mà một người chơi thật sẽ trải
// qua: từ start_node, mô phỏng ĐÚNG state thật (chỉ số/cờ/vật phẩm) như
// GamePlayer.jsx, đi theo từng lựa chọn khả dụng tới từng kết thúc.
//
// KHÔNG phải một parser/engine thứ hai — chỉ đi bộ (walk) trên nodesMap đã được
// scriptParser.js + postprocess.js#normalizeAndRepair() dựng và dọn sẵn. Thứ tự
// áp dụng hiệu ứng (node.grantItem/setFlags khi VÀO node, rồi choice.statModifiers/
// grantItem/grantFlags khi CHỌN) khớp đúng GamePlayer.jsx (xem hàm advance ở đó) và
// simulatePlaytest() trong postprocess.js — 3 nơi này phải luôn đồng bộ.
//
// HAI phần TÁCH RIÊNG, cố tình không gộp làm một:
//   1. graphReachable() — BFS THUẦN CẤU TRÚC (bỏ qua điều kiện khoá), rẻ, luôn
//      CHÍNH XÁC 100% — dùng để biết "kịch bản này thật sự có bao nhiêu loại
//      kết thúc, kết thúc nào tồn tại" mà KHÔNG phụ thuộc việc có lấy mẫu đủ
//      tuyến hay không. Đây là nguồn số liệu thật cho các badge tổng quan.
//   2. buildRoutes() — LẤY MẪU tuyến cụ thể (có mô phỏng state thật) để ĐỌC —
//      luôn bị giới hạn (không thể liệt kê hết 1 kịch bản rẽ nhánh lớn), nên
//      chia NGÂN SÁCH (budget) CÔNG BẰNG cho từng nhánh tại mỗi điểm rẽ thay vì
//      duyệt tham lam hết nhánh đầu tiên trước — nếu không, một nhánh rẽ sớm có
//      độ phân nhánh cao sẽ nuốt hết ngân sách trước khi bao giờ chạm tới các
//      nhánh khác, khiến TOÀN BỘ 1 loại kết thúc biến mất khỏi danh sách dù nó
//      có thật (đây chính là lỗi đã xảy ra: DFS tham lam cũ báo "0 TRUE_END"
//      trên 1 kịch bản có thật TRUE_END, chỉ vì nhánh GOOD_END khám phá trước
//      đã dùng hết 400 route).

const MAX_ROUTES = 400;
const MAX_DEPTH = 200;
const MAX_STEPS_EXPLORED = 200000; // tổng số bước duyệt qua (chống treo trên đồ thị dày đặc)

function cloneState(st) {
  return {
    stats: { ...st.stats },
    items: new Set(st.items),
    flags: new Set(st.flags),
    npcAffinity: { ...st.npcAffinity },
  };
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

function lockedReasons(c, st) {
  const bits = [];
  for (const k in (c.statRequirements || {})) if ((st.stats[k] || 0) < c.statRequirements[k]) bits.push(`cần ${k} ≥ ${c.statRequirements[k]} (đang ${st.stats[k] || 0})`);
  for (const k in (c.statRequirementsMax || {})) if ((st.stats[k] || 0) > c.statRequirementsMax[k]) bits.push(`cần ${k} ≤ ${c.statRequirementsMax[k]} (đang ${st.stats[k] || 0})`);
  if (c.requiresItem && !st.items.has(c.requiresItem)) bits.push(`cần vật phẩm "${c.requiresItem}"`);
  if (c.requiresFlag && !st.flags.has(c.requiresFlag)) bits.push(`cần cờ "${c.requiresFlag}"`);
  if (c.requiresFlagAbsent && st.flags.has(c.requiresFlagAbsent)) bits.push(`chỉ khi CHƯA có cờ "${c.requiresFlagAbsent}"`);
  return bits;
}

function stateSig(nodeId, st) {
  return nodeId + "|" +
    Object.keys(st.stats).sort().map((k) => k + "=" + st.stats[k]).join(",") + "|" +
    [...st.items].sort().join(",") + "|" +
    [...st.flags].sort().join(",");
}

function applyChoice(st, c) {
  const ns = cloneState(st);
  for (const [k, d] of Object.entries(c.statModifiers || {})) ns.stats[k] = (ns.stats[k] || 0) + d;
  if (c.grantItem) ns.items.add(c.grantItem);
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
  for (const v of vital) if ((st.stats[v.key] || 0) <= v.threshold) return true;
  return false;
}

function choiceTargets(c) {
  const out = [];
  if (c.targetNodeId) out.push(c.targetNodeId);
  if (c.diceRoll) { if (c.diceRoll.successTarget) out.push(c.diceRoll.successTarget); if (c.diceRoll.failTarget) out.push(c.diceRoll.failTarget); }
  if (c.combat) { for (const t of [c.combat.winTarget, c.combat.loseTarget, c.combat.fleeTarget]) if (t) out.push(t); }
  return out;
}

/**
 * BFS THUẦN CẤU TRÚC (bỏ qua statRequirements/requiresFlag/requiresItem) từ
 * start_node — cho biết CHÍNH XÁC kịch bản có bao nhiêu kết thúc/cảnh tồn tại
 * về mặt sơ đồ, không phụ thuộc việc buildRoutes() có lấy mẫu đủ hay không.
 * Đây là nguồn số liệu ĐÁNG TIN CẬY cho các badge tổng quan (số kết thúc theo
 * từng loại) — khác với danh sách tuyến cụ thể ở buildRoutes(), vốn luôn có
 * thể bị cắt bớt trên kịch bản rẽ nhánh lớn.
 */
export function graphReachable(nodesMap) {
  const reachable = new Set();
  const endings = [];
  if (!nodesMap["start_node"]) return { reachable, endings };
  const queue = ["start_node"];
  reachable.add("start_node");
  while (queue.length) {
    const id = queue.shift();
    const node = nodesMap[id];
    if (!node) continue;
    if (node.isEnding) endings.push({ id: node.id, label: node.speaker || "", type: node.endingType || "NORMAL_END" });
    for (const c of (node.choices || [])) {
      for (const t of choiceTargets(c)) {
        if (t && nodesMap[t] && !reachable.has(t)) { reachable.add(t); queue.push(t); }
      }
    }
  }
  return { reachable, endings };
}

function buildReverseAdjacency(nodesMap) {
  const rev = {};
  for (const n of Object.values(nodesMap)) {
    for (const c of (n.choices || [])) {
      for (const t of choiceTargets(c)) {
        if (!t || !nodesMap[t]) continue;
        (rev[t] = rev[t] || []).push(n.id);
      }
    }
  }
  return rev;
}

// BFS NGƯỢC (thuần cấu trúc, bỏ qua điều kiện khoá) từ 1 kết thúc — trả về
// tập nodeId mà TỪ ĐÓ có đường (không tính state) dẫn tới kết thúc này. Dùng
// làm "la bàn" cho guidedWalkToEnding(): ở mỗi điểm rẽ, ưu tiên lựa chọn có
// đích nằm trong tập này thay vì chọn bừa/chọn đầu tiên.
function canReachSetFor(targetId, reverseAdj) {
  const can = new Set([targetId]);
  const queue = [targetId];
  while (queue.length) {
    const id = queue.shift();
    for (const p of (reverseAdj[id] || [])) {
      if (!can.has(p)) { can.add(p); queue.push(p); }
    }
  }
  return can;
}

/**
 * Dò 1 tuyến CỤ THỂ (có mô phỏng state thật) tới đúng 1 kết thúc chỉ định —
 * dùng khi buildRoutes() lấy mẫu công bằng vẫn chưa may mắn chạm tới kết thúc
 * đó (kịch bản quá lớn, kết thúc đó ở quá sâu/hiếm). Ở mỗi điểm rẽ, trong số
 * các lựa chọn ĐANG KHẢ DỤNG theo state hiện tại, ưu tiên đi theo lựa chọn mà
 * đích của nó còn đường cấu trúc tới kết thúc mục tiêu (canReachSet); nếu
 * không lựa chọn khả dụng nào còn đường (bị khoá chặn mất lối đúng), đành đi
 * lựa chọn khả dụng đầu tiên và chấp nhận có thể trật hướng. Trả về route nếu
 * thực sự chạm đúng kết thúc mục tiêu, ngược lại trả về null (không giả vờ).
 */
function guidedWalkToEnding(nodesMap, statsConfig, targetEndingId, canReachSet) {
  const startStats = {};
  for (const sc of (statsConfig || [])) startStats[sc.key] = typeof sc.default === "number" ? sc.default : 0;
  const vital = (statsConfig || []).filter((sc) => sc.isVital).map((sc) => ({ key: sc.key, threshold: sc.deathThreshold || 0 }));
  const startNode = nodesMap["start_node"];
  if (!startNode) return null;

  const baseState = { stats: { ...startStats }, items: new Set(), flags: new Set(), npcAffinity: {} };
  let state = enterNode(baseState, startNode);
  let currentId = "start_node";
  let steps = [];
  const visited = new Set([stateSig("start_node", state)]);

  for (let hop = 0; hop < MAX_DEPTH; hop++) {
    const node = nodesMap[currentId];
    if (!node) return null;
    const stateHere = hop === 0 ? state : enterNode(state, node);
    if (node.isEnding) return node.id === targetEndingId ? { steps, status: "ok", endingNode: node } : null;

    const avail = (node.choices || []).filter((c) => choiceAvailable(c, stateHere));
    if (!avail.length) return null;
    const preferred = avail.find((c) => canReachSet.has(c.targetNodeId)) || avail[0];
    if (!preferred.targetNodeId || !nodesMap[preferred.targetNodeId]) return null;

    const afterChoice = applyChoice(stateHere, preferred);
    if (isDeadState(afterChoice, vital)) return null; // chết dọc đường — không phải kết thúc mục tiêu
    const step = { sceneId: currentId, scene: node, choiceIndex: node.choices.indexOf(preferred), choice: preferred, stateAfter: afterChoice };
    steps = [...steps, step];
    const sig = stateSig(preferred.targetNodeId, afterChoice);
    if (visited.has(sig)) return null; // vòng lặp — bỏ cuộc, không giả vờ tới nơi
    visited.add(sig);
    currentId = preferred.targetNodeId;
    state = afterChoice;
  }
  return null;
}

/**
 * Tách toàn bộ nodesMap thành danh sách route cụ thể (LẤY MẪU, không phải liệt
 * kê đầy đủ trên kịch bản lớn). Chia ngân sách CÔNG BẰNG cho từng lựa chọn khả
 * dụng tại MỖI điểm rẽ (budget còn lại / số nhánh còn lại, tối thiểu 1 mỗi
 * nhánh) thay vì duyệt tham lam hết nhánh đầu tiên rồi mới quay lại nhánh sau —
 * đảm bảo mọi nhánh rẽ ở gần đầu truyện đều có ít nhất 1 tuyến đại diện trong
 * kết quả, không bị 1 nhánh phân nhánh dày nuốt hết ngân sách của các nhánh
 * khác.
 *
 * Ngay cả với chia công bằng, kịch bản đủ lớn (budget cạn dần theo cấp số
 * nhân qua nhiều tầng rẽ nhánh) vẫn có thể khiến 1 vài kết thúc HIẾM không lọt
 * vào mẫu — nên sau khi lấy mẫu công bằng, chạy thêm 1 lượt "dò có mục tiêu"
 * (guidedWalkToEnding) cho từng kết thúc còn thiếu, đảm bảo CHỈ CẦN kết thúc
 * đó thật sự chơi-tới-được thì luôn có ít nhất 1 tuyến minh hoạ trong danh
 * sách, không bao giờ hiện "0" một cách oan uổng chỉ vì mẫu chưa đủ lớn.
 * @returns {{routes: Object[], truncated: boolean, sceneUsage: Map<string, string[]>}}
 */
export function buildRoutes(nodesMap, statsConfig) {
  const startStats = {};
  for (const sc of (statsConfig || [])) startStats[sc.key] = typeof sc.default === "number" ? sc.default : 0;
  const vital = (statsConfig || []).filter((sc) => sc.isVital).map((sc) => ({ key: sc.key, threshold: sc.deathThreshold || 0 }));

  const routes = [];
  const sceneUsage = new Map(); // nodeId -> [routeId, ...]
  let truncated = false;
  let stepsExplored = 0;
  let routeCounter = 0;

  const recordUsage = (nodeId, routeId) => {
    if (!sceneUsage.has(nodeId)) sceneUsage.set(nodeId, []);
    sceneUsage.get(nodeId).push(routeId);
  };

  function finishRoute(steps, status, endingNode) {
    routeCounter += 1;
    const id = "route_" + routeCounter;
    for (const s of steps) recordUsage(s.sceneId, id);
    if (endingNode) recordUsage(endingNode.id, id);
    routes.push({
      id,
      steps,
      status, // "ok" | "dead_end" | "loop" | "truncated"
      endingId: endingNode ? endingNode.id : null,
      endingLabel: endingNode ? endingNode.speaker || "" : "",
      endingType: endingNode ? (endingNode.endingType || "NORMAL_END") : null,
      sceneCount: steps.length,
    });
    return 1;
  }

  const startNode = nodesMap["start_node"];
  if (!startNode) return { routes: [], truncated: false, sceneUsage };

  const baseState = { stats: { ...startStats }, items: new Set(), flags: new Set(), npcAffinity: {} };
  const startEntered = enterNode(baseState, startNode);

  // walk() trả về SỐ tuyến thực sự đã tạo ra (để trừ vào ngân sách của node cha).
  function walk(nodeId, incomingState, stepsSoFar, visitedInPath, budget) {
    if (budget <= 0) { truncated = true; return 0; }
    stepsExplored += 1;
    if (stepsExplored >= MAX_STEPS_EXPLORED || routeCounter >= MAX_ROUTES) { truncated = true; return 0; }

    const node = nodesMap[nodeId];
    if (!node) return 0; // không nên xảy ra (đã normalizeAndRepair), phòng thủ

    const sig = stateSig(nodeId, incomingState);
    if (visitedInPath.has(sig)) return finishRoute(stepsSoFar, "loop", null);
    if (stepsSoFar.length >= MAX_DEPTH) { truncated = true; return finishRoute(stepsSoFar, "truncated", null); }

    const stateHere = enterNode(incomingState, node);

    if (node.isEnding) return finishRoute(stepsSoFar, "ok", node);

    const nextVisited = new Set(visitedInPath);
    nextVisited.add(sig);

    const avail = (node.choices || []).filter((c) => choiceAvailable(c, stateHere));
    if (!avail.length) return finishRoute(stepsSoFar, "dead_end", null);

    // Chia budget còn lại cho các nhánh CÒN CHƯA duyệt tại mỗi bước — nhánh
    // trước dùng ít hơn phần chia thì nhánh sau được hưởng phần dư, nhưng
    // không nhánh nào bị bỏ đói hoàn toàn khi budget vẫn còn ≥ 1.
    let used = 0;
    for (let i = 0; i < avail.length; i++) {
      if (routeCounter >= MAX_ROUTES || stepsExplored >= MAX_STEPS_EXPLORED) { truncated = true; break; }
      const remaining = budget - used;
      if (remaining <= 0) { truncated = true; break; }
      const childrenLeft = avail.length - i;
      const share = Math.max(1, Math.floor(remaining / childrenLeft));
      const c = avail[i];
      if (!c.targetNodeId || !nodesMap[c.targetNodeId]) continue; // đã được normalizeAndRepair dẫn về broken_link_end, nên hiếm khi xảy ra
      const afterChoice = applyChoice(stateHere, c);
      const step = {
        sceneId: nodeId,
        scene: node,
        choiceIndex: node.choices.indexOf(c),
        choice: c,
        stateAfter: afterChoice,
      };
      if (isDeadState(afterChoice, vital)) {
        used += finishRoute([...stepsSoFar, step], "ok", null); // chết vì chỉ số sinh tử = 1 dạng kết thúc hợp lệ, không phải lỗi
        continue;
      }
      used += walk(c.targetNodeId, afterChoice, [...stepsSoFar, step], nextVisited, share);
    }
    return used;
  }

  const startBranches = (startNode.choices || []).length
    ? startNode.choices.map((c) => ({ choice: c, node: startNode }))
    : [{ choice: null, node: startNode }];

  // Mỗi lựa chọn ở start_node là 1 luồng chơi riêng (khớp quy ước simulatePlaytest
  // trong postprocess.js — chọn nhân vật/mở đầu khác nhau thì KHÔNG hoà state) —
  // cũng chia budget công bằng giữa các luồng này như mọi điểm rẽ khác.
  let usedTop = 0;
  for (let i = 0; i < startBranches.length; i++) {
    if (routeCounter >= MAX_ROUTES || stepsExplored >= MAX_STEPS_EXPLORED) { truncated = true; break; }
    const remaining = MAX_ROUTES - usedTop;
    if (remaining <= 0) { truncated = true; break; }
    const childrenLeft = startBranches.length - i;
    const share = Math.max(1, Math.floor(remaining / childrenLeft));
    const branch = startBranches[i];

    let stateAtEntry = startEntered;
    let currentId = "start_node";
    let initialSteps = [];
    if (branch.choice) {
      if (!branch.choice.targetNodeId || !nodesMap[branch.choice.targetNodeId]) continue;
      const afterChoice = applyChoice(startEntered, branch.choice);
      initialSteps = [{
        sceneId: "start_node",
        scene: startNode,
        choiceIndex: startNode.choices.indexOf(branch.choice),
        choice: branch.choice,
        stateAfter: afterChoice,
      }];
      currentId = branch.choice.targetNodeId;
      stateAtEntry = afterChoice;
    }

    const visitedInPath = new Set([stateSig("start_node", startEntered)]);
    usedTop += walk(currentId, stateAtEntry, initialSteps, visitedInPath, share);
  }

  // Lượt 2: dò có mục tiêu cho từng kết thúc CÓ THẬT trong kịch bản (theo cấu
  // trúc — graphReachable) nhưng mẫu công bằng ở trên chưa may mắn chạm tới.
  // Không tính vào MAX_ROUTES/MAX_STEPS_EXPLORED phía trên (đã dùng hết ngân
  // sách đó) — chỉ thêm tối đa 1 tuyến/kết thúc còn thiếu, rẻ vì số kết thúc
  // luôn nhỏ (vài chục là nhiều).
  const { endings: allEndings } = graphReachable(nodesMap);
  const reachedIds = new Set(routes.filter((r) => r.endingId).map((r) => r.endingId));
  const missing = allEndings.filter((e) => !reachedIds.has(e.id));
  if (missing.length) {
    const reverseAdj = buildReverseAdjacency(nodesMap);
    for (const ending of missing) {
      const canReachSet = canReachSetFor(ending.id, reverseAdj);
      const guided = guidedWalkToEnding(nodesMap, statsConfig, ending.id, canReachSet);
      if (guided) {
        routeCounter += 1;
        const id = "route_" + routeCounter;
        for (const s of guided.steps) recordUsage(s.sceneId, id);
        recordUsage(guided.endingNode.id, id);
        routes.push({
          id,
          steps: guided.steps,
          status: "ok",
          endingId: guided.endingNode.id,
          endingLabel: guided.endingNode.speaker || "",
          endingType: guided.endingNode.endingType || "NORMAL_END",
          sceneCount: guided.steps.length,
          guided: true,
        });
      }
    }
  }

  return { routes, truncated, sceneUsage };
}

/**
 * Trích nodeId từ 1 dòng cảnh báo dạng `Cảnh "xxx"` / `cảnh "xxx"` do
 * postprocess.js sinh ra — dùng để nối cảnh báo toàn cục vào đúng (các) route
 * có đi qua cảnh đó, phân biệt lỗi toàn cục vs lỗi theo tuyến (route nào đi
 * qua cảnh này với state khiến cảnh báo đó đúng thì mới thực sự "dính" route
 * đó — ở mức v1 này ta liên kết theo cảnh, chưa phân biệt sâu hơn theo state
 * trong từng route, vì bản thân cảnh báo gốc cũng đã ở mức phân tích toàn cục).
 */
export function extractWarningNodeIds(warning) {
  const ids = [];
  const re = /[Cc]ảnh\s+"([^"]+)"/g;
  let m;
  while ((m = re.exec(warning))) ids.push(m[1]);
  return ids;
}

export function severityOf(warning) {
  if (warning.startsWith("[GỢI Ý]")) return "warn"; // 🟡
  if (/KẸT CỨNG|KẸT VÒNG LẶP|trỏ tới .* nhưng không tồn tại|không bao giờ vào được/.test(warning)) return "critical"; // 🔴
  return "logic"; // 🟠 (thiếu cờ/vật phẩm, ngưỡng không đạt...)
}

export { choiceAvailable, lockedReasons, stateSig };
