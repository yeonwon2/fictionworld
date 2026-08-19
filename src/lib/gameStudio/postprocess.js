// Hậu xử lý node graph của game nhập vai — ported gần như nguyên vẹn từ
// gamenhapvai's base44/functions/generateGameScenario/entry.ts (phần sau khi
// nhận JSON từ AI). Logic này KHÔNG phụ thuộc vào việc nodesMap được sinh
// bằng 1 lệnh gọi AI hay nhiều lệnh gộp lại — nó vẫn là lưới an toàn bắt buộc
// để dọn dẹp targetNodeId lơ lửng, node không tới được, kết thúc quá nông...
// Đặc biệt quan trọng khi sinh nhiều batch song song: một batch có thể tạo ra
// targetNodeId trỏ sang node do batch khác phụ trách — pass này bắt lỗi đó.

const cleanStr = (v) => (v == null || v === "null" || v === "" || v === "none" || v === "None") ? null : String(v);
const cleanNum = (v) => (typeof v === "number" && !isNaN(v)) ? v : null;
const cleanStrArr = (v) => Array.isArray(v) ? v.map(String).filter((x) => x && x !== "null") : [];

// Cảnh báo dạng gợi ý chất lượng (vật phẩm/cờ mồ côi, điều kiện thừa) — không
// chặn đường chơi được, khác với lỗi thật. Dùng chung ở UI (tách danh sách
// hiển thị) và ở fixScriptWithAI.js (không đưa gợi ý vào vòng AI tự sửa).
export const isSuggestionWarning = (w) => typeof w === "string" && w.startsWith("[GỢI Ý]");

// Phân loại 1 dòng gợi ý để UI gộp nhóm thay vì liệt kê phẳng — kịch bản dài
// (60+ cảnh) dễ ra hàng chục cờ/vật phẩm mồ côi cùng lúc, đọc từng dòng không
// thực tế. Ba nhóm khớp đúng 3 dạng câu do analyzeLogic()/simulatePlaytest()
// sinh ra (xem 2 hàm đó) — đổi câu chữ ở đó thì phải sửa cả đây.
export const SUGGESTION_CATEGORIES = {
  orphanItem: {
    label: "vật phẩm mồ côi",
    hint: 'Những vật phẩm này không mở khoá bất kỳ lựa chọn nào ("→ Cần vật phẩm"). Nếu bạn chỉ dùng để mô tả/thưởng cho vui thì bỏ qua — chỉ đáng sửa nếu bạn ĐỊNH dùng nó để mở khoá 1 lựa chọn/kết thúc mà quên nối.',
  },
  orphanFlag: {
    label: "cờ mồ côi",
    hint: 'Những cờ này không khoá bất kỳ lựa chọn nào ("→ Cần cờ"/"→ Cần không có cờ"). Lưu ý: cờ CHỈ hiện cho người chơi thấy khi thể loại game là "Dị Giới" (Isekai) — ngoài ra cờ hoàn toàn vô hình, chỉ dùng để khoá/mở lựa chọn. Nếu bạn chỉ dùng cờ để đánh dấu diễn biến thì bỏ qua toàn bộ — chỉ đáng sửa nếu định dùng nó mở 1 kết thúc/cảnh riêng mà quên nối.',
  },
  redundantReq: {
    label: "điều kiện thừa",
    hint: "Những yêu cầu này qua mô phỏng chạy thử chưa từng thực sự chặn ai (luôn đúng sẵn trước khi tới) — có thể bỏ yêu cầu đi cho gọn, hoặc giữ nguyên nếu định mở rộng thêm nhánh khác sau này.",
  },
};

export function categorizeSuggestion(w) {
  const text = String(w || "").replace(/^\[GỢI Ý\]\s*/, "");
  if (text.startsWith('Vật phẩm "')) return "orphanItem";
  if (text.startsWith('Cờ "')) return "orphanFlag";
  return "redundantReq";
}

function cleanPopup(p) {
  if (!p || typeof p !== "object") return null;
  const t = cleanStr(p.title);
  const x = cleanStr(p.text);
  return (t || x) ? { title: t || "", text: x || "" } : null;
}

function cleanQuest(q) {
  if (!q || typeof q !== "object") return null;
  const title = cleanStr(q.title);
  if (!title) return null;
  return { id: cleanStr(q.id) || ("quest_" + Math.random().toString(36).slice(2, 8)), title, desc: cleanStr(q.desc) || "", reward: cleanStr(q.reward) || "" };
}

function cleanAffinity(a) {
  if (!a || typeof a !== "object") return null;
  const out = {};
  for (const k of Object.keys(a)) {
    if (typeof a[k] === "number" && !isNaN(a[k]) && k !== "null" && k) out[k] = a[k];
  }
  return Object.keys(out).length ? out : null;
}

function cleanModsObject(m) {
  if (!m || typeof m !== "object") return {};
  const out = {};
  for (const k of Object.keys(m)) if (typeof m[k] === "number" && !isNaN(m[k]) && k !== "null" && k) out[k] = m[k];
  return out;
}

function cleanDiceRoll(dr) {
  if (!dr || typeof dr !== "object") return null;
  const stat = cleanStr(dr.stat);
  const difficulty = typeof dr.difficulty === "number" && !isNaN(dr.difficulty) ? dr.difficulty : 10;
  if (!stat) return null;
  return {
    stat, difficulty,
    successTarget: cleanStr(dr.successTarget) || "start_node",
    failTarget: cleanStr(dr.failTarget) || "start_node",
    successMods: cleanModsObject(dr.successMods),
    failMods: cleanModsObject(dr.failMods),
    critThreshold: typeof dr.critThreshold === "number" ? dr.critThreshold : 5,
    critFailThreshold: typeof dr.critFailThreshold === "number" ? dr.critFailThreshold : 1,
  };
}

function cleanCombat(cb) {
  if (!cb || typeof cb !== "object" || !cb.enemy || typeof cb.enemy !== "object") return null;
  const e = cb.enemy;
  return {
    enemy: { name: cleanStr(e.name) || "Kẻ thù", hp: typeof e.hp === "number" ? e.hp : 50, attack: typeof e.attack === "number" ? e.attack : 10, defense: typeof e.defense === "number" ? e.defense : 3, avatar: cleanStr(e.avatar), intro: cleanStr(e.intro) },
    winTarget: cleanStr(cb.winTarget) || "start_node",
    loseTarget: cleanStr(cb.loseTarget),
    fleeTarget: cleanStr(cb.fleeTarget),
    fleeChance: typeof cb.fleeChance === "number" ? cb.fleeChance : 0.4,
    loot: { statModifiers: cleanModsObject(cb.loot && cb.loot.statModifiers), grantItem: cleanStr(cb.loot && cb.loot.grantItem), exp: typeof (cb.loot && cb.loot.exp) === "number" ? cb.loot.exp : null },
  };
}

function cleanRandomEvents(evs) {
  if (!Array.isArray(evs)) return [];
  return evs.map((ev) => ({
    chance: typeof ev.chance === "number" ? Math.min(1, Math.max(0, ev.chance)) : 0.2,
    text: cleanStr(ev.text) || "Sự kiện bất ngờ!",
    statModifiers: cleanModsObject(ev.statModifiers),
    grantItem: cleanStr(ev.grantItem),
    icon: cleanStr(ev.icon) || "🎲",
  })).filter((ev) => ev.text);
}

/**
 * Dọn dẹp + sửa lỗi cấu trúc node graph.
 * @param {Object} rawNodesMap - { [id]: nodeObject } gộp từ các batch AI.
 * @param {string[]} statKeys - danh sách key chỉ số (vd hp, gold, reputation).
 * @param {number} minDepth - độ sâu tối thiểu bắt buộc trước khi tới ending (0 = tắt).
 * @param {Object} [options]
 * @param {boolean} [options.forceNonEmptyModifiers=true] - tự vá +3 điểm chỉ số
 *   mặc định vào lựa chọn không có statModifiers. Bật cho kịch bản AI sinh (AI
 *   dễ "lười" bỏ hệ quả); TẮT cho kịch bản viết tay (người viết có thể cố ý
 *   để lựa chọn thuần rẽ nhánh, không đổi điểm).
 * @returns {{ nodes: Object, warnings: string[] }} — `warnings` liệt kê MỌI
 *   targetNodeId trỏ tới cảnh không tồn tại (lỗi đánh số/nhãn kết thúc trong
 *   kịch bản gốc) — trước đây các lựa chọn này bị ÂM THẦM chuyển về
 *   "start_node" khiến người chơi tưởng game bị reset; giờ dẫn tới 1 ending
 *   dùng chung "Thiếu cảnh" (broken_link_end) và được liệt kê rõ trong warnings
 *   để người viết sửa lại kịch bản.
 */
export function normalizeAndRepair(rawNodesMap, statKeys, minDepth, options = {}) {
  const { forceNonEmptyModifiers = true, statsConfig } = options;
  const nodesMap = {};
  const ids = new Set();
  const warnings = [];
  for (const n of Object.values(rawNodesMap || {})) {
    if (n && n.id) {
      if (!n.choices) n.choices = [];
      if (!n.statRequirements) n.statRequirements = {};
      nodesMap[n.id] = n;
      ids.add(n.id);
    }
  }
  if (!nodesMap["start_node"]) {
    const first = Object.values(nodesMap)[0];
    if (first) {
      delete nodesMap[first.id];
      first.id = "start_node";
      nodesMap["start_node"] = first;
      ids.add("start_node");
    } else {
      nodesMap["start_node"] = { id: "start_node", speaker: "Dẫn Truyện", text: "Câu chuyện bắt đầu...", bgImage: "", isEnding: false, endingType: null, choices: [] };
      ids.add("start_node");
    }
  }

  const defaultStatKey = statKeys[0] || "reputation";
  const hpKey = statKeys.find((k) => k.toLowerCase() === "hp") || statKeys.find((k) => k.toLowerCase().includes("hp")) || null;
  const repKey = statKeys.find((k) => k.toLowerCase().includes("rep")) || statKeys.find((k) => k.toLowerCase().includes("danh")) || null;

  for (const n of Object.values(nodesMap)) {
    n.grantItem = cleanStr(n.grantItem);
    n.setFlags = cleanStrArr(n.setFlags);
    n.systemPopup = cleanPopup(n.systemPopup);
    n.quest = cleanQuest(n.quest);
    n.combat = cleanCombat(n.combat);
    n.randomEvents = cleanRandomEvents(n.randomEvents);
    if (n.endingType === "null" || n.endingType === "") n.endingType = null;
    for (const c of (n.choices || [])) {
      if (c.targetNodeId && !ids.has(c.targetNodeId)) {
        // Tìm điểm mốc "scene_"/"ending_" CUỐI CÙNG trong id (không phải đầu
        // tiên) — id ở Xưởng NPC có dạng "npc_<slug>_scene_1", nếu bắt từ đầu
        // sẽ cắt nhầm ngay giữa slug nhân vật (vd slug chứa chữ "end").
        const sceneMarker = c.targetNodeId.lastIndexOf("scene_");
        const endingMarker = c.targetNodeId.lastIndexOf("ending_");
        let refLabel, suggestion = "";
        if (sceneMarker !== -1 && sceneMarker >= endingMarker) {
          const prefix = c.targetNodeId.slice(0, sceneMarker + 6);
          const missing = c.targetNodeId.slice(prefix.length);
          refLabel = "cảnh " + missing;
          const valid = Array.from(ids).filter((id) => id.startsWith(prefix) && id !== c.targetNodeId).map((id) => id.slice(prefix.length));
          if (valid.length) suggestion = " Các cảnh có thật (cùng phạm vi): " + valid.join(", ") + ".";
        } else if (endingMarker !== -1) {
          const prefix = c.targetNodeId.slice(0, endingMarker + 7);
          const missing = c.targetNodeId.slice(prefix.length);
          refLabel = 'kết thúc "' + missing + '"';
          const valid = Array.from(ids).filter((id) => id.startsWith(prefix) && id !== c.targetNodeId).map((id) => id.slice(prefix.length));
          if (valid.length) suggestion = ' Các kết thúc có thật (cùng phạm vi): "' + valid.join('", "') + '".';
        } else {
          refLabel = '"' + c.targetNodeId + '"';
        }
        warnings.push('Cảnh "' + n.id + '" — lựa chọn "' + (c.text || "(không có chữ)") + '": trỏ tới ' + refLabel + ' nhưng không tồn tại trong kịch bản.' + suggestion + ' Đã tạm dẫn tới ending "Thiếu cảnh" — sửa lại đúng số/nhãn rồi sản xuất lại.');
        if (!ids.has("broken_link_end")) {
          nodesMap["broken_link_end"] = { id: "broken_link_end", speaker: "", text: "(Đường dẫn bị thiếu trong kịch bản gốc — cảnh hoặc kết thúc được trỏ tới chưa được viết. Hãy kiểm tra lại số cảnh/nhãn kết thúc rồi sản xuất lại.)", bgImage: "", isEnding: true, endingType: "NORMAL_END", choices: [] };
          ids.add("broken_link_end");
        }
        c.targetNodeId = "broken_link_end";
      }
      if (!c.statRequirements) c.statRequirements = {};
      if (!c.statRequirementsMax) c.statRequirementsMax = {};
      if (!c.statModifiers) c.statModifiers = {};
      if (forceNonEmptyModifiers && Object.keys(c.statModifiers).length === 0) {
        const lbl = (c.label || "").toLowerCase();
        const txt = (c.text || "").toLowerCase();
        if (lbl.includes("nguy") || lbl.includes("hiểm") || txt.includes("chiến") || txt.includes("xông") || txt.includes("đánh")) {
          c.statModifiers = hpKey ? { [hpKey]: -8 } : { [defaultStatKey]: -8 };
        } else if (lbl.includes("gian") || lbl.includes("xảo") || lbl.includes("lợi kỷ")) {
          c.statModifiers = repKey ? { [repKey]: -10, [defaultStatKey]: 10 } : { [defaultStatKey]: -10 };
        } else {
          c.statModifiers = repKey ? { [repKey]: 3 } : { [defaultStatKey]: 3 };
        }
      }
      c.requiresItem = cleanStr(c.requiresItem);
      c.requiresFlag = cleanStr(c.requiresFlag);
      c.requiresFlagAbsent = cleanStr(c.requiresFlagAbsent);
      c.grantFlag = cleanStr(c.grantFlag);
      if (c.grantFlags) c.grantFlags = cleanStrArr(c.grantFlags);
      else if (c.grantFlag) c.grantFlags = [c.grantFlag];
      c.grantItem = cleanStr(c.grantItem);
      c.removeItem = cleanStr(c.removeItem);
      c.completeQuestId = cleanStr(c.completeQuestId);
      c.unlockSkill = cleanStr(c.unlockSkill);
      c.label = cleanStr(c.label);
      c.exp = cleanNum(c.exp);
      c.systemPoints = cleanNum(c.systemPoints);
      c.npcAffinity = cleanAffinity(c.npcAffinity);
      c.systemPopup = cleanPopup(c.systemPopup);
      c.diceRoll = cleanDiceRoll(c.diceRoll);
    }
  }

  // BFS từ start_node → tập reachable + depth mỗi node.
  const reachable = new Set();
  const depthMap = {};
  {
    const queue = [["start_node", 0]];
    reachable.add("start_node");
    depthMap["start_node"] = 0;
    while (queue.length) {
      const [nid, d] = queue.shift();
      const nd = nodesMap[nid];
      if (!nd) continue;
      for (const c of (nd.choices || [])) {
        const t = c.targetNodeId;
        if (t && nodesMap[t] && !reachable.has(t)) {
          reachable.add(t);
          depthMap[t] = d + 1;
          queue.push([t, d + 1]);
        }
        // Lựa chọn xúc xắc/chiến đấu đi theo đích riêng — không có targetNodeId.
        const extra = [];
        if (c.diceRoll) { extra.push(c.diceRoll.successTarget, c.diceRoll.failTarget); }
        else if (c.combat) { extra.push(c.combat.winTarget, c.combat.loseTarget, c.combat.fleeTarget); }
        for (const t2 of extra) {
          if (t2 && nodesMap[t2] && !reachable.has(t2)) {
            reachable.add(t2);
            depthMap[t2] = d + 1;
            queue.push([t2, d + 1]);
          }
        }
      }
    }
  }
  const dropped = [];
  for (const id of Object.keys(nodesMap)) {
    if (!reachable.has(id)) { dropped.push(id); delete nodesMap[id]; }
  }
  if (dropped.length) {
    warnings.push('Có ' + dropped.length + ' cảnh/kết thúc KHÔNG thể đến được từ mạch truyện chính nên đã bị bỏ đi: ' + dropped.slice(0, 12).join(', ') + (dropped.length > 12 ? ' …' : '') + '. Muốn giữ chúng, hãy thêm lựa chọn "→ Đến cảnh …" dẫn vào từ một cảnh đang chạy được.');
  }

  // Ending đạt độ sâu < minDepth → chèn ĐỦ SỐ NODE ĐỆM còn thiếu để buộc đạt
  // đúng minDepth (không phải chỉ +1 — nếu ending gốc ở depth 1 và minDepth=4,
  // một node đệm duy nhất vẫn dừng ở depth 2, người chơi vẫn hết game quá sớm).
  let endCounter = 0;
  for (const id of Object.keys(nodesMap)) {
    const nd = nodesMap[id];
    const curDepth = depthMap[id] || 0;
    if (nd && nd.isEnding && curDepth < minDepth) {
      const missingSteps = minDepth - curDepth;
      nd.isEnding = false;
      nd.endingType = null;
      nd.text = (nd.text || "") + "\n\n…Số phận chưa khép lại ở đây. Con đường phía trước vẫn còn dài.";
      let prevNode = nd;
      let prevDepth = curDepth;
      for (let step = 1; step <= missingSteps; step++) {
        const isLast = step === missingSteps;
        const newId = "auto_end_" + (endCounter++);
        prevNode.choices = [{
          text: isLast ? "Đối mặt với số phận" : "Tiếp tục bước đi",
          targetNodeId: newId,
          statRequirements: {},
          statModifiers: hpKey ? { [hpKey]: -5 } : { [defaultStatKey]: -5 },
        }];
        const newNode = {
          id: newId,
          speaker: "Số Phận",
          text: isLast
            ? "Mọi quyết định đã dẫn bạn đến khoảnh khắc này. Câu chuyện khép lại — nhưng hành trình vẫn in dấu trong bạn."
            : "Con đường phía trước vẫn còn dài. Bạn tiếp tục bước đi, chưa biết điều gì đang chờ đợi phía trước.",
          bgImage: "",
          isEnding: isLast,
          endingType: isLast ? "NORMAL_END" : null,
          choices: [],
        };
        nodesMap[newId] = newNode;
        depthMap[newId] = prevDepth + step;
        prevNode = newNode;
      }
    }
  }

  // Node không phải ending nhưng không còn lựa chọn hợp lệ nào → tự tạo ending fallback (tránh dead-end).
  for (const id of Object.keys(nodesMap)) {
    const nd = nodesMap[id];
    if (nd && !nd.isEnding) {
      const valid = (nd.choices || []).filter((c) => c.targetNodeId && nodesMap[c.targetNodeId]);
      if (valid.length === 0) {
        const newEndId = "auto_end_" + (endCounter++);
        nd.choices = [{ text: "Kết thúc hành trình", targetNodeId: newEndId, statRequirements: {}, statModifiers: { [defaultStatKey]: 3 } }];
        nodesMap[newEndId] = { id: newEndId, speaker: "Số Phận", text: "Hành trình khép lại.", bgImage: "", isEnding: true, endingType: "NORMAL_END", choices: [] };
      } else {
        nd.choices = valid;
      }
    }
  }

  return { nodes: nodesMap, warnings: warnings.concat(analyzeLogic(nodesMap, statsConfig)).concat(simulatePlaytest(nodesMap, statsConfig)).concat(detectTrappedCycles(nodesMap)).concat(checkDeadOnArrival(statsConfig)) };
}

/**
 * Chỉ số sinh tử đã ≤ ngưỡng chết NGAY TỪ GIÁ TRỊ KHỞI ĐẦU (thường do quên khai
 * "Chỉ số khởi đầu" nên mặc định = 0, hoặc khai ngưỡng chết cao hơn giá trị
 * khởi đầu) → người chơi Game Over ngay khi vừa mở game, chưa kịp làm gì.
 * simulatePlaytest() không bắt được lỗi này vì nó coi start_node luôn "sống".
 */
function checkDeadOnArrival(statsConfig) {
  const warnings = [];
  for (const sc of (statsConfig || [])) {
    if (!sc.isVital) continue;
    const start = typeof sc.default === "number" ? sc.default : 0;
    const threshold = sc.deathThreshold || 0;
    if (start <= threshold) {
      warnings.push(`Chỉ số sinh tử "${sc.label || sc.key}" có giá trị khởi đầu là ${start}, đã ≤ ngưỡng chết (${threshold}) — game sẽ Game Over NGAY khi vừa mở, người chơi chưa kịp làm gì. Kiểm tra lại "Chỉ số khởi đầu" của "${sc.label || sc.key}" trong kịch bản (hoặc mục Cấu hình chung), phải để cao hơn ${threshold}.`);
    }
  }
  return warnings;
}

/**
 * Phát hiện VÒNG LẶP KẸT: một nhóm cảnh quay vòng với nhau nhưng KHÔNG có lối
 * ra nào dẫn tới một kết thúc (và bên trong cũng không có kết thúc) → người
 * chơi bị kẹt quay vòng vô hạn, không bao giờ hết game. Dùng Tarjan SCC để tìm
 * các thành phần liên thông mạnh (chu trình) rồi kiểm tra lối ra.
 * Vòng lặp CÓ lối ra (như mạch "trọng sinh làm lại từ cảnh 21") là hợp lệ và
 * không bị báo — chỉ báo vòng lặp không thoát được.
 */
function detectTrappedCycles(nodesMap) {
  const adj = {};
  for (const n of Object.values(nodesMap)) {
    adj[n.id] = [];
    for (const c of (n.choices || [])) {
      if (c.targetNodeId && nodesMap[c.targetNodeId]) adj[n.id].push(c.targetNodeId);
      if (c.diceRoll) {
        if (c.diceRoll.successTarget && nodesMap[c.diceRoll.successTarget]) adj[n.id].push(c.diceRoll.successTarget);
        if (c.diceRoll.failTarget && nodesMap[c.diceRoll.failTarget]) adj[n.id].push(c.diceRoll.failTarget);
      } else if (c.combat) {
        for (const t of [c.combat.winTarget, c.combat.loseTarget, c.combat.fleeTarget]) {
          if (t && nodesMap[t]) adj[n.id].push(t);
        }
      }
    }
  }

  let idx = 0;
  const stack = [];
  const onStack = new Set();
  const disc = {};
  const low = {};
  const sccs = [];
  const strongconnect = (v) => {
    disc[v] = idx; low[v] = idx; idx++;
    stack.push(v); onStack.add(v);
    for (const w of (adj[v] || [])) {
      if (disc[w] === undefined) { strongconnect(w); low[v] = Math.min(low[v], low[w]); }
      else if (onStack.has(w)) low[v] = Math.min(low[v], disc[w]);
    }
    if (low[v] === disc[v]) {
      const comp = [];
      let w;
      do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== v);
      sccs.push(comp);
    }
  };
  for (const id of Object.keys(adj)) if (disc[id] === undefined) strongconnect(id);

  const warnings = [];
  for (const comp of sccs) {
    const isCycle = comp.length > 1 || (adj[comp[0]] || []).includes(comp[0]);
    if (!isCycle) continue;
    const hasEndingInside = comp.some((id) => nodesMap[id] && nodesMap[id].isEnding);
    const exits = comp.flatMap((id) => adj[id] || []).filter((t) => !comp.includes(t));
    if (!hasEndingInside && exits.length === 0) {
      warnings.push(
        `KẸT VÒNG LẶP: các cảnh ${comp.map((id) => `"${id}"`).join(", ")} quay vòng với nhau và KHÔNG có lối ra nào dẫn tới kết thúc — người chơi sẽ bị kẹt quay vòng vô hạn, không bao giờ hết game. Thêm 1 lựa chọn thoát ("→ Đến cảnh …" hoặc "→ Kết thúc …") từ ít nhất một cảnh trong vòng này.`
      );
    }
  }
  return warnings;
}

/**
 * MÔ PHỎNG CHẠY THỬ toàn bộ cây lựa chọn — "chơi thử" tất cả các trạng thái có
 * thể tới được từ đầu game để bắt các lỗi mà kiểm tra tĩnh ở trên không thấy:
 *   - KẸT CỨNG (soft-lock): một cảnh có thể tới được, nhưng với trạng thái đó
 *     KHÔNG có lựa chọn nào khả dụng (mọi lựa chọn đều bị khoá bởi yêu cầu) →
 *     người chơi đứng im giữa chừng không làm gì được. Đây chính là lỗi người
 *     dùng hay gặp nhất với kịch bản AI.
 *   - CẢNH KHÔNG BAO GIỜ VÀO ĐƯỢC: tồn tại trong đồ thị (BFS thấy cạnh nối) nhưng
 *     mọi đường dẫn thực tế đều bị khoá yêu cầu → người chơi không bao giờ tới.
 * Mô phỏng này xác định, chạy nhanh (giới hạn số trạng thái), không tốn AI.
 */
function simulatePlaytest(nodesMap, statsConfig) {
  const warnings = [];
  const startStats = {};
  for (const sc of (statsConfig || [])) startStats[sc.key] = typeof sc.default === "number" ? sc.default : 0;
  const vital = (statsConfig || []).filter((sc) => sc.isVital).map((sc) => ({ key: sc.key, threshold: sc.deathThreshold || 0 }));
  const clamp = (v) => Math.max(-1000000, Math.min(1000000, v));

  const stateSig = (st) =>
    st.nodeId + "|" +
    Object.keys(st.stats).sort().map((k) => k + "=" + st.stats[k]).join(",") + "|" +
    [...st.items].sort().join(",") + "|" +
    [...st.flags].sort().join(",") + "|" +
    Object.keys(st.npcAffinity).sort().map((k) => k + "=" + st.npcAffinity[k]).join(",");

  const choiceAvailable = (c, st) => {
    for (const k in (c.statRequirements || {})) if ((st.stats[k] || 0) < c.statRequirements[k]) return false;
    for (const k in (c.statRequirementsMax || {})) if ((st.stats[k] || 0) > c.statRequirementsMax[k]) return false;
    if (c.requiresItem && !st.items.has(c.requiresItem)) return false;
    if (c.requiresFlag && !st.flags.has(c.requiresFlag)) return false;
    if (c.requiresFlagAbsent && st.flags.has(c.requiresFlagAbsent)) return false;
    if (c.requiresNpcAffinity) for (const n in c.requiresNpcAffinity) if ((st.npcAffinity[n] || 0) < c.requiresNpcAffinity[n]) return false;
    if (c.requiresNpcAffinityMax) for (const n in c.requiresNpcAffinityMax) if ((st.npcAffinity[n] || 0) > c.requiresNpcAffinityMax[n]) return false;
    return true;
  };

  const makeState = (nodeId, stats, items, flags, npcAffinity) => ({ nodeId, stats, items, flags, npcAffinity });

  const visited = new Set();
  const queue = [];
  const nodeSeen = new Set();        // nodeId có ít nhất 1 trạng thái tới
  const nodeHasMove = new Set();     // nodeId có ít nhất 1 trạng thái có lựa chọn khả dụng
  const blockedNodes = new Map();    // nodeId -> ví dụ lý do khoá (cho thông báo)

  // Theo dõi từng yêu cầu (vật phẩm/cờ) trên từng lựa chọn qua MỌI trạng thái
  // từng chạm tới nó — nếu yêu cầu không BAO GIỜ fail trong suốt mô phỏng, nó
  // là điều kiện thừa (luôn đúng sẵn trước khi cần, không cản được ai thật sự).
  const reqTrack = new Map(); // "nodeId::ci::type" -> {pass, fail, nodeId, choiceText, type, reqKey}
  const trackReq = (nodeId, ci, choiceText, type, reqKey, ok) => {
    const k = nodeId + "::" + ci + "::" + type;
    let r = reqTrack.get(k);
    if (!r) { r = { pass: 0, fail: 0, nodeId, choiceText, type, reqKey }; reqTrack.set(k, r); }
    if (ok) r.pass++; else r.fail++;
  };

  // Các cạnh vào mỗi node (kèm tóm tắt yêu cầu của lựa chọn đó) — dùng để chỉ
  // cho người viết biết CHÍNH XÁC lựa chọn nào chặn đường vào một cảnh.
  const inEdges = {};
  const summarizeReqs = (c) => {
    const bits = [];
    for (const k in (c.statRequirements || {})) bits.push(`cần chỉ số ${k} ≥ ${c.statRequirements[k]}`);
    for (const k in (c.statRequirementsMax || {})) bits.push(`cần chỉ số ${k} ≤ ${c.statRequirementsMax[k]}`);
    if (c.requiresItem) bits.push(`cần vật phẩm "${c.requiresItem}"`);
    if (c.requiresFlag) bits.push(`cần cờ "${c.requiresFlag}"`);
    if (c.requiresFlagAbsent) bits.push(`chỉ khi CHƯA có cờ "${c.requiresFlagAbsent}"`);
    return bits.join(", ") || "không có yêu cầu";
  };
  for (const n of Object.values(nodesMap)) {
    for (const c of (n.choices || [])) {
      const targets = [];
      if (c.targetNodeId && nodesMap[c.targetNodeId]) targets.push(c.targetNodeId);
      if (c.diceRoll) {
        if (c.diceRoll.successTarget && nodesMap[c.diceRoll.successTarget]) targets.push(c.diceRoll.successTarget);
        if (c.diceRoll.failTarget && nodesMap[c.diceRoll.failTarget]) targets.push(c.diceRoll.failTarget);
      } else if (c.combat) {
        for (const t of [c.combat.winTarget, c.combat.loseTarget, c.combat.fleeTarget]) if (t && nodesMap[t]) targets.push(t);
      }
      for (const t of targets) {
        (inEdges[t] = inEdges[t] || []).push({ from: n.id, choiceText: c.text || "(không có chữ)", req: summarizeReqs(c) });
      }
    }
  }

  const MAX_STATES = 200000;
  const NODE_STATE_CAP = 500; // tối đa trạng thái giữ lại cho MỖI cảnh (chống bùng nổ do chỉ số tích luỹ qua chuỗi cảnh dài)
  let explored = 0;
  const nodeStateCount = {}; // nodeId -> số trạng thái đã xếp hàng (đã khử trùng)

  // start_node luôn là điểm vào và luôn có lựa chọn (Bắt đầu / chọn nhân vật).
  if (nodesMap["start_node"]) { nodeSeen.add("start_node"); nodeHasMove.add("start_node"); }

  const pushState = (st) => {
    const sig = stateSig(st);
    if (visited.has(sig)) return;
    if ((nodeStateCount[st.nodeId] || 0) >= NODE_STATE_CAP) return;
    visited.add(sig);
    nodeStateCount[st.nodeId] = (nodeStateCount[st.nodeId] || 0) + 1;
    queue.push(st);
  };

  // Mỗi lựa chọn của start_node là 1 "luồng chơi" RIÊNG (đúng model Xưởng NPC:
  // chọn ai thì CHỈ tuyến đó chạy, không hoà trộn đồ đạc/cờ giữa các tuyến).
  const startNode = nodesMap["start_node"];
  if (startNode) {
    const sg = { items: new Set(), flags: new Set() };
    if (startNode.grantItem) sg.items.add(startNode.grantItem);
    if (startNode.setFlags) for (const f of startNode.setFlags) sg.flags.add(f);
    for (const c of (startNode.choices || [])) {
      if (c.targetNodeId && nodesMap[c.targetNodeId]) {
        const st = makeState(c.targetNodeId, { ...startStats }, new Set(sg.items), new Set(sg.flags), {});
        // phần thưởng từ chọn nhân vật ở start_node (grantItem/grantFlag trên lựa chọn)
        if (c.grantItem) st.items.add(c.grantItem);
        for (const gf of (c.grantFlags || [])) st.flags.add(gf);
        pushState(st);
      }
    }
  }

  while (queue.length && explored < MAX_STATES) {
    const st = queue.shift();
    explored++;
    const node = nodesMap[st.nodeId];
    if (!node) continue;
    nodeSeen.add(st.nodeId);
    // áp dụng phần thưởng của NODE khi bước vào (giống GamePlayer)
    if (node.grantItem) st.items.add(node.grantItem);
    if (node.setFlags) for (const f of node.setFlags) st.flags.add(f);

    if (node.isEnding) continue; // kết thúc hợp lệ

    (node.choices || []).forEach((c, ci) => {
      if (c.requiresItem) trackReq(st.nodeId, ci, c.text, "item", c.requiresItem, st.items.has(c.requiresItem));
      if (c.requiresFlag) trackReq(st.nodeId, ci, c.text, "flag", c.requiresFlag, st.flags.has(c.requiresFlag));
      if (c.requiresFlagAbsent) trackReq(st.nodeId, ci, c.text, "flagAbsent", c.requiresFlagAbsent, !st.flags.has(c.requiresFlagAbsent));
    });

    const avail = (node.choices || []).filter((c) => choiceAvailable(c, st));
    if (avail.length) {
      nodeHasMove.add(st.nodeId);
      for (const c of avail) {
        const ns = { ...st.stats };
        let dead = false;
        for (const [k, d] of Object.entries(c.statModifiers || {})) ns[k] = clamp((ns[k] || 0) + d);
        for (const v of vital) if ((ns[v.key] || 0) <= v.threshold) { dead = true; break; }
        if (dead) continue; // chọn xong chết → Game Over (kết cục hợp lệ, không phải kẹt cứng)
        const items = new Set(st.items);
        if (c.grantItem) items.add(c.grantItem);
        if (c.removeItem) items.delete(c.removeItem);
        const flags = new Set(st.flags);
        for (const gf of (c.grantFlags || [])) flags.add(gf);
        const affinity = { ...st.npcAffinity };
        if (c.npcAffinity) for (const n in c.npcAffinity) affinity[n] = (affinity[n] || 0) + c.npcAffinity[n];
        // Lựa chọn xúc xắc/chiến đấu: người chơi luôn bấm được (dù kết quả thắng/thua) —
        // đi theo mọi đích có thể xảy ra để không báo nhầm kẹt cứng.
        let targets = [];
        if (c.diceRoll) {
          if (c.diceRoll.successTarget && nodesMap[c.diceRoll.successTarget]) targets.push(c.diceRoll.successTarget);
          if (c.diceRoll.failTarget && nodesMap[c.diceRoll.failTarget]) targets.push(c.diceRoll.failTarget);
          if (c.diceRoll.successMods) for (const [k, v] of Object.entries(c.diceRoll.successMods)) ns[k] = clamp((ns[k] || 0) + v);
        } else if (c.combat) {
          if (c.combat.winTarget && nodesMap[c.combat.winTarget]) targets.push(c.combat.winTarget);
          if (c.combat.loseTarget && nodesMap[c.combat.loseTarget]) targets.push(c.combat.loseTarget);
          if (c.combat.fleeTarget && nodesMap[c.combat.fleeTarget]) targets.push(c.combat.fleeTarget);
          if (c.combat.loot) {
            if (c.combat.loot.grantItem) items.add(c.combat.loot.grantItem);
            for (const [k, v] of Object.entries(c.combat.loot.statModifiers || {})) ns[k] = clamp((ns[k] || 0) + v);
          }
        }
        if (!targets.length && c.targetNodeId && nodesMap[c.targetNodeId]) targets.push(c.targetNodeId);
        for (const t of targets) pushState(makeState(t, ns, items, flags, affinity));
      }
    } else {
      // không có lựa chọn nào khả dụng — ghi lại lý do khoá đầu tiên
      if (!blockedNodes.has(st.nodeId)) {
        const reasons = (node.choices || []).map((c) => {
          const bits = [];
          for (const k in (c.statRequirements || {})) if ((st.stats[k] || 0) < c.statRequirements[k]) bits.push(`cần ${k} ≥ ${c.statRequirements[k]} (đang ${st.stats[k] || 0})`);
          for (const k in (c.statRequirementsMax || {})) if ((st.stats[k] || 0) > c.statRequirementsMax[k]) bits.push(`cần ${k} ≤ ${c.statRequirementsMax[k]} (đang ${st.stats[k] || 0})`);
          if (c.requiresItem && !st.items.has(c.requiresItem)) bits.push(`cần vật phẩm "${c.requiresItem}"`);
          if (c.requiresFlag && !st.flags.has(c.requiresFlag)) bits.push(`cần cờ "${c.requiresFlag}"`);
          if (c.requiresFlagAbsent && st.flags.has(c.requiresFlagAbsent)) bits.push(`chỉ khi CHƯA có cờ "${c.requiresFlagAbsent}"`);
          return `lựa chọn "${c.text || "?"}": ${bits.join(", ") || "lựa chọn rỗng"}`;
        });
        blockedNodes.set(st.nodeId, reasons.join(" | "));
      }
    }
  }

  if (explored >= MAX_STATES) {
    warnings.push(`Đã dừng mô phỏng chạy thử ở ${MAX_STATES} trạng thái (kịch bản phân nhánh quá lớn) — bỏ qua kiểm tra kẹt cứng chi tiết. Hãy đơn giản hoá bớt nhánh rẽ nếu gặp vấn đề.`);
    return warnings;
  }

  for (const n of Object.values(nodesMap)) {
    if (!n || n.isEnding || !n.id) continue;
    const id = n.id;
    if (!nodeSeen.has(id)) {
      const edges = (inEdges[id] || []).slice(0, 3);
      const edgeDesc = edges.length
        ? edges.map((e) => `từ cảnh "${e.from}" — lựa chọn "${e.choiceText}" (${e.req})`).join("; ") + (edges.length < (inEdges[id] || []).length ? "; …" : "")
        : "(không có lựa chọn nào trỏ tới)";
      warnings.push(`Cảnh "${id}" không bao giờ vào được: mọi đường dẫn tới đều bị khoá — ${edgeDesc}. Sửa: cho vật phẩm/cờ/chỉ số cần thiết ở phía trước, hoặc bỏ yêu cầu trên chính lựa chọn dẫn vào. Nếu cảnh nguồn cũng không vào được, xem cảnh báo của cảnh nguồn.`);
    } else if (!nodeHasMove.has(id)) {
      warnings.push(`KẸT CỨNG: cảnh "${id}" có thể tới được nhưng mọi lựa chọn đều bị khoá: ${blockedNodes.get(id) || "(không rõ lý do)"}. Sửa: đảm bảo luôn có ≥ 1 lựa chọn mở, hoặc cho vật phẩm/cờ/chỉ số cần thiết ở phía trước.`);
    }
  }

  // Điều kiện THỪA: yêu cầu vật phẩm/cờ trên 1 lựa chọn nhưng qua toàn bộ mô
  // phỏng, mọi trạng thái từng chạm tới lựa chọn này đều ĐÃ có sẵn thứ đó rồi
  // — tức yêu cầu không bao giờ thực sự chặn ai (đã "xuất hiện trước khi cần"
  // trên mọi đường đi thật). Không phải lỗi chặn đường chơi nên chỉ là gợi ý.
  // Lưu ý: `pass` đếm số TRẠNG THÁI ĐÃ KHỬ TRÙNG (`visited`) từng chạm lựa
  // chọn này, không phải số đường đi — 2 nhánh khác nhau hội tụ về cùng 1
  // trạng thái (cùng đồ/cờ/chỉ số) chỉ tính 1 lần. Vì vậy KHÔNG đặt ngưỡng
  // pass≥2: fail=0 (chưa từng thấy trạng thái nào thiếu) đã là bằng chứng đủ
  // — kể cả với kịch bản 1 đường thẳng, đây vẫn là sự thật (yêu cầu không đổi
  // được kết quả gì), chỉ là mức độ đáng chú ý thấp hơn nên vẫn để dạng gợi ý.
  for (const r of reqTrack.values()) {
    if (r.fail === 0 && r.pass >= 1) {
      const label = r.type === "item" ? `vật phẩm "${r.reqKey}"` : r.type === "flag" ? `cờ "${r.reqKey}"` : `KHÔNG có cờ "${r.reqKey}"`;
      warnings.push(`[GỢI Ý] Cảnh "${r.nodeId}" — lựa chọn "${r.choiceText || "(không có chữ)"}": yêu cầu ${label}, nhưng qua mô phỏng chạy thử, MỌI cách tới được lựa chọn này đều đã thoả điều kiện từ trước — yêu cầu này chưa từng thực sự chặn ai, có thể là điều kiện thừa. Nếu cố ý giữ lại (phòng khi kịch bản mở rộng sau này thêm đường khác) thì bỏ qua cảnh báo này.`);
    }
  }

  return warnings;
}

/**
 * Rà soát logic "mồ côi" của đồ thị đã dọn xong — chạy sau khi BFS cắt node
 * không tới được (nên mọi node còn lại đều chạm tới được từ start_node).
 * Bắt các lỗi AI hay gây ra nhất mà không làm vỡ cấu trúc:
 *   - vật phẩm bị "Cần vật phẩm: X" nhưng chẳng đâu cho X (→ Vật phẩm: X).
 *   - cờ truyện bị "Cần cờ: X" nhưng chẳng đâu tạo X (→ Cờ: X).
 *   - ngưỡng chỉ số "Cần <chỉ số> >= N" không bao giờ đạt tới dù gom HẾT mọi
 *     điểm cộng trong toàn kịch bản (tương tự cho "<= N" với mọi điểm trừ).
 * Các cảnh báo này có chèn thêm gợi ý sửa cụ thể để người viết (hoặc AI) tự vá.
 */
function analyzeLogic(nodesMap, statsConfig) {
  const warnings = [];
  const itemsGranted = new Set();
  const flagsGranted = new Set();
  const itemSources = {};
  const flagSources = {};
  const statGains = {}; // chỉ số -> tổng điểm CỘNG tối đa trong toàn đồ thị
  const statLoses = {}; // chỉ số -> tổng điểm TRỪ tối đa trong toàn đồ thị
  const startValues = {};
  for (const sc of (statsConfig || [])) startValues[sc.key] = typeof sc.default === "number" ? sc.default : 0;

  const note = (map, key, loc) => { if (!key) return; map[key] = (map[key] || []).concat(loc); };

  for (const n of Object.values(nodesMap)) {
    if (n.grantItem) { itemsGranted.add(n.grantItem); note(itemSources, n.grantItem, n.id); }
    for (const f of (n.setFlags || [])) { flagsGranted.add(f); note(flagSources, f, n.id); }
    for (const c of (n.choices || [])) {
      if (c.grantItem) { itemsGranted.add(c.grantItem); note(itemSources, c.grantItem, n.id); }
      if (c.grantFlag) { flagsGranted.add(c.grantFlag); note(flagSources, c.grantFlag, n.id); }
      for (const gf of (c.grantFlags || [])) { flagsGranted.add(gf); note(flagSources, gf, n.id); }
      for (const [k, v] of Object.entries(c.statModifiers || {})) {
        if (typeof v === "number" && v > 0) statGains[k] = (statGains[k] || 0) + v;
        else if (typeof v === "number" && v < 0) statLoses[k] = (statLoses[k] || 0) + v;
      }
    }
  }

  const itemsRequired = new Set();
  const flagsRequired = new Set();

  for (const n of Object.values(nodesMap)) {
    for (const c of (n.choices || [])) {
      const where = `Cảnh "${n.id}" — lựa chọn "${c.text || "(không có chữ)"}"`;
      if (c.requiresItem) {
        itemsRequired.add(c.requiresItem);
        if (!itemsGranted.has(c.requiresItem)) {
          warnings.push(`${where}: yêu cầu vật phẩm "${c.requiresItem}" nhưng KHÔNG có lựa chọn nào cho vật phẩm này (không thấy dòng "→ Vật phẩm: ${c.requiresItem}" ở phía trước). Thêm lựa chọn cho vật phẩm trước cảnh này, hoặc bỏ yêu cầu.`);
        }
      }
      if (c.requiresFlag) {
        flagsRequired.add(c.requiresFlag);
        if (!flagsGranted.has(c.requiresFlag)) {
          warnings.push(`${where}: yêu cầu cờ "${c.requiresFlag}" nhưng KHÔNG có lựa chọn nào tạo cờ này (không thấy dòng "→ Cờ: ${c.requiresFlag}" ở phía trước). Thêm lựa chọn tạo cờ trước cảnh này, hoặc bỏ yêu cầu.`);
        }
      }
      if (c.requiresFlagAbsent) flagsRequired.add(c.requiresFlagAbsent);
      for (const [k, need] of Object.entries(c.statRequirements || {})) {
        const start = startValues[k] ?? 0;
        const maxReach = start + (statGains[k] || 0);
        if (maxReach < need) {
          warnings.push(`${where}: cần chỉ số ≥ ${need} nhưng ngay cả khi nhận HẾT mọi điểm cộng trong kịch bản thì tối đa chỉ đạt ${maxReach} (bắt đầu ${start}). Giảm ngưỡng xuống ≤ ${maxReach}, hoặc thêm lựa chọn tăng chỉ số ở phía trước.`);
        }
      }
      for (const [k, need] of Object.entries(c.statRequirementsMax || {})) {
        const start = startValues[k] ?? 0;
        const minReach = start + (statLoses[k] || 0);
        if (minReach > need) {
          warnings.push(`${where}: cần chỉ số ≤ ${need} nhưng ngay cả khi chịu HẾT mọi điểm trừ trong kịch bản thì thấp nhất cũng là ${minReach} (bắt đầu ${start}). Tăng ngưỡng lên ≥ ${minReach}, hoặc thêm lựa chọn trừ chỉ số ở phía trước.`);
        }
      }
    }
  }

  // Vật phẩm/cờ MỒ CÔI: được cấp ở đâu đó nhưng chẳng lựa chọn nào từng dùng
  // tới (không "→ Cần vật phẩm"/"→ Cần cờ" nào tham chiếu) — không phải lỗi
  // chặn đường chơi, chỉ là dấu hiệu quên nối hoặc vật phẩm thừa. Gắn nhãn
  // [GỢI Ý] để phân biệt với lỗi thật, và để không bị đưa vào vòng AI tự sửa.
  for (const item of itemsGranted) {
    if (!itemsRequired.has(item)) {
      const locs = (itemSources[item] || []).map((id) => `"${id}"`).join(", ");
      warnings.push(`[GỢI Ý] Vật phẩm "${item}" (cấp ở cảnh ${locs}) không được bất kỳ lựa chọn nào yêu cầu ("→ Cần vật phẩm: ${item}") — có thể là vật phẩm mồ côi, thừa, không có tác dụng gì trong kịch bản. Nếu cố ý (vật phẩm sưu tầm/trang trí) thì bỏ qua cảnh báo này.`);
    }
  }
  for (const flag of flagsGranted) {
    if (!flagsRequired.has(flag)) {
      const locs = (flagSources[flag] || []).map((id) => `"${id}"`).join(", ");
      warnings.push(`[GỢI Ý] Cờ "${flag}" (tạo ở cảnh ${locs}) không được bất kỳ lựa chọn nào kiểm tra ("→ Cần cờ: ${flag}" hoặc "→ Cần không có cờ: ${flag}") — có thể là cờ mồ côi, thừa, không ảnh hưởng gì tới mạch truyện.`);
    }
  }

  return warnings;
}
