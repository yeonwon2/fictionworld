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
  const { forceNonEmptyModifiers = true } = options;
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
      }
    }
  }
  for (const id of Object.keys(nodesMap)) {
    if (!reachable.has(id)) delete nodesMap[id];
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

  return { nodes: nodesMap, warnings };
}
