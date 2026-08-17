// "Xưởng NPC" — xưởng sản xuất game RIÊNG BIỆT, độc lập hoàn toàn với "Xưởng
// Offline" (scriptParser.js) và "Xưởng Hệ Thống" (systemScriptParser.js) —
// không import, không chia sẻ cú pháp hay state với 2 file đó, sửa xưởng này
// không ảnh hưởng gì tới 2 xưởng kia.
//
// Dành cho thể loại "Công Lược" (otome / dating sim): người chơi chọn 1 trong
// nhiều nhân vật để theo đuổi ngay ở màn hình đầu tiên — từ đó chỉ tuyến
// truyện của người đó tiếp diễn, không cần tính điểm những người còn lại.
// Giống 2 xưởng kia ở việc biến 1 kịch bản văn bản thành game chơi được
// (không gọi AI, hoàn toàn xác định), nhưng cú pháp có thêm khối "NHÂN VẬT"
// để khai nhiều tuyến song song trong CÙNG 1 kịch bản.
//
// Dùng chung node schema với GamePlayer.jsx/rpgExport.js — mỗi nhân vật ở màn
// hình chọn thực chất là 1 lựa chọn (choice) bình thường trỏ tới cảnh đầu tiên
// của tuyến người đó, chỉ gắn thêm field "npcCard" để engine vẽ thành thẻ bài
// đẹp thay vì nút bấm chữ suông — không cần sửa engine chơi/export nào cả về
// mặt LOGIC, chỉ thêm 1 kiểu hiển thị.
//
// ============================= CÚ PHÁP KỊCH BẢN =============================
//
// # Công lược — <Tên truyện>
// **Thể loại:** ...                          (tuỳ chọn)
// **Tác giả:** ...                            (tuỳ chọn)
// **Chỉ số sinh tử:** <Tên chỉ số> < <ngưỡng>  (tuỳ chọn — vd "Thiện cảm < 10"
//                                               nghĩa là ác cảm quá mức (dưới
//                                               10) thì thất bại/Game Over
//                                               ngay. Có thể khai nhiều, cách
//                                               nhau dấu phẩy.)
// **Chỉ số khởi đầu:** <Tên chỉ số> = <giá trị> (tuỳ chọn — vd "Thiện cảm = 20".
//                                               QUAN TRỌNG nếu có khai "Chỉ số
//                                               sinh tử" ở trên: nhớ đặt điểm
//                                               khởi đầu cao hơn ngưỡng chết,
//                                               nếu không sẽ "chết" ngay khi
//                                               vừa vào game.)
//
// ## GIỚI THIỆU
// <văn bản hiện trên màn hình chọn nhân vật, vd "Bạn muốn theo đuổi ai?">
// (tuỳ chọn — bỏ qua thì tự dùng câu mặc định "Bạn muốn theo đuổi ai?")
//
// ## NHÂN VẬT <Tên nhân vật> — <mô tả ngắn / tính cách>
// → Ảnh: <URL ảnh đại diện>                   (tuỳ chọn, đặt NGAY DƯỚI dòng
//                                               NHÂN VẬT, trước cảnh đầu tiên)
//
// ### CẢNH 1 — <Tên cảnh, chỉ để tham khảo khi viết>
// <văn bản diễn biến>
// (Nhãn cảnh không bắt buộc là số thuần — có thể đặt "CẢNH 1_A", "CẢNH 2b"...
//  để dễ phân biệt các nhánh rẽ, miễn khớp đúng với "→ Đến cảnh <nhãn>" ở dưới.)
//
// **A — <lời lựa chọn>**
// → Thiện cảm +5                              (cộng/trừ điểm — tên chỉ số tự
// → Thiện cảm -10                              do, hệ thống tự nhận diện)
// → Cờ: đã hứa ở lại
// → Cần cờ: đã hứa ở lại
// → Cần không có cờ: đã hứa ở lại
// → Vật phẩm: tên vật phẩm
// → Cần vật phẩm: tên vật phẩm
// → Cần Thiện cảm >= 20
// → Đến cảnh 2                                 ("### CẢNH 2" PHẢI có thật
//                                               TRONG CÙNG khối NHÂN VẬT này)
// → Kết thúc yeu                               (dẫn tới 1 khối "### KẾT THÚC"
//                                               cùng nhãn, TRONG CÙNG khối
//                                               NHÂN VẬT này)
//
// ### CẢNH 2 — ...
// ...
//
// ### KẾT THÚC yeu — Thành đôi [TRUE_END]
// <văn bản kết thúc>
//
// ### KẾT THÚC chia_xa — Chia xa [BAD_END]
// <văn bản kết thúc>
//
// ## NHÂN VẬT <Tên nhân vật khác> — <mô tả ngắn>
// ### CẢNH 1 — ...                             (số cảnh TỰ RESET về 1 cho mỗi
// ...                                           nhân vật — mỗi tuyến độc lập)
//
// Số cảnh/nhãn kết thúc chỉ có hiệu lực TRONG PHẠM VI khối NHÂN VẬT đang viết
// — "→ Đến cảnh 2" ở tuyến A không thể trỏ sang cảnh 2 của tuyến B. Loại kết
// thúc trong [ ] CHỈ ĐƯỢC là TRUE_END / GOOD_END / NORMAL_END / BAD_END (mặc
// định NORMAL_END nếu bỏ qua). Không hỗ trợ rẽ nhánh điều kiện kiểu "→ Nếu có
// cờ X: Đến cảnh Y" trong CÙNG 1 lựa chọn — muốn rẽ nhánh, viết 2 lựa chọn
// riêng, mỗi cái khoá bằng "Cần cờ:"/"Cần không có cờ:" đối lập nhau.
//
// Các ký hiệu markdown (#, ##, ###, **) chỉ để DỄ ĐỌC, KHÔNG bắt buộc — hệ
// thống nhận diện qua từ khoá (NHÂN VẬT, CẢNH, KẾT THÚC, GIỚI THIỆU...). Mũi
// tên "→" có thể gõ thành "->" hoặc "=>" nếu bàn phím không gõ được ký tự →.
// =============================================================================

import { normalizeAndRepair } from "./postprocess";

export function slugifyNpc(label) {
  return String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "x";
}

function stripMarkers(line) {
  return line
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\*{1,3}([^*]*)\*{1,3}\s*/, "$1")
    .replace(/\*{1,3}\s*$/, "")
    .trim();
}

const RE_META_GENRE = /^Thể loại\s*:\s*(.+)$/i;
const RE_META_AUTHOR = /^Tác giả\s*:\s*(.+)$/i;
const RE_META_VITAL = /^Chỉ số sinh tử\s*:\s*(.+)$/i;
const RE_META_INITIAL = /^Chỉ số khởi đầu\s*:\s*(.+)$/i;
const RE_INTRO = /^GIỚI THIỆU\s*$/i;
const RE_NPC = /^NHÂN\s+VẬT\s+(.+?)\s*(?:[—\-:]\s*(.+))?$/i;
const RE_SCENE = /^CẢNH\s+(\S+?)\s*(?:[—\-:.]\s*(.+))?$/i;
const RE_ENDING = /^KẾT THÚC\s+(\S+)\s*(?:[—\-:.]\s*(.+?))?\s*(?:\[(TRUE_END|GOOD_END|NORMAL_END|BAD_END)\])?\s*$/i;
const RE_CHOICE = /^([A-ZĐ])\s*[—\-:.)]\s*(.+?)\s*\**\s*$/;
const RE_EFFECT = /^(?:→|->|=>)\s*(.+)$/;

const RE_EFF_IMAGE = /^Ảnh\s*:\s*(.+)$/i;
const RE_EFF_FLAG = /^Cờ:\s*(.+)$/i;
const RE_EFF_REQ_FLAG = /^Cần cờ:\s*(.+)$/i;
const RE_EFF_REQ_NOT_FLAG = /^Cần không có cờ:\s*(.+)$/i;
const RE_EFF_ITEM = /^Vật phẩm:\s*(.+)$/i;
const RE_EFF_REQ_ITEM = /^Cần vật phẩm:\s*(.+)$/i;
const RE_EFF_GOTO = /^Đến\s+cảnh\s+(\S+)$/i;
const RE_EFF_ENDING = /^(?:Đến\s+)?kết\s+thúc\s+(\S+)$/i;
const RE_EFF_GOTO_BARE = /^Đến\s+(?!cảnh\b)(\S+)$/i;
const RE_EFF_REQ_STAT = /^Cần\s+(.+?)\s*(>=|≥)\s*(-?\d+)$/i;
const RE_EFF_STAT = /^(.+?)\s*([+-]\d+)\s*$/;
const RE_VITAL_ITEM = /^(.+?)\s*(?:(<=|<)\s*(-?\d+))?$/;
const RE_INITIAL_ITEM = /^(.+?)\s*=\s*(-?\d+)$/;

function stripMarkdown(line) {
  return line
    .replace(/^>\s?/, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();
}

function pushParagraph(node, line) {
  const text = stripMarkdown(line);
  if (!text) return;
  node.text = node.text ? node.text + "\n\n" + text : text;
}

/**
 * Phân tích kịch bản "Công Lược" (nhiều tuyến NPC song song) thành
 * { meta, nodes, warnings }. Không gọi AI, hoàn toàn xác định.
 */
export function parseNpcScript(scriptText, baseMeta = {}) {
  const lines = String(scriptText || "").replace(/\r\n/g, "\n").split("\n");
  const warnings = [];
  const statKeysSeen = new Map(); // key -> label gốc

  let title = "";
  let genre = "";
  let author = "";
  const vitalDeclarations = [];
  const initialDeclarations = [];

  const nodesMap = {};
  const npcList = []; // [{ name, tagline, image, slug, sceneOrder: [] }]
  let currentNpc = null;
  let currentNode = null;
  let currentChoice = null;
  let introNode = null;
  let inIntro = false;

  function registerStat(label) {
    const key = slugifyNpc(label);
    if (!statKeysSeen.has(key)) statKeysSeen.set(key, label.trim());
    return key;
  }

  function applyEffectLine(raw, lineNo) {
    let m;
    if ((m = raw.match(RE_EFF_IMAGE))) {
      if (currentNode) { warnings.push(`Dòng ${lineNo}: "→ Ảnh: ..." phải đặt ngay dưới dòng "NHÂN VẬT ...", trước cảnh đầu tiên (bỏ qua).`); return; }
      if (currentNpc) currentNpc.image = m[1].trim();
      else warnings.push(`Dòng ${lineNo}: có "→ Ảnh: ..." nhưng chưa thuộc nhân vật nào (bỏ qua).`);
      return;
    }
    const target = currentChoice;
    if (!target) {
      // Cảnh không có lựa chọn A/B nào, chỉ có 1 dòng "→ Đến cảnh N"/"→ Kết
      // thúc X" ngay dưới lời dẫn — coi đây là cảnh chuyển tiếp thẳng, tự tạo
      // 1 lựa chọn "Tiếp tục" ẩn danh thay vì bỏ qua (rất nhiều kịch bản thật
      // viết theo kiểu này khi 1 cảnh không cần rẽ nhánh).
      if (currentNode && currentNpc) {
        let mm;
        if ((mm = raw.match(RE_EFF_GOTO))) {
          currentNode.choices.push({ text: "Tiếp tục", statRequirements: {}, statModifiers: {}, __explicitTarget: "npc_" + currentNpc.slug + "_scene_" + mm[1] });
          return;
        }
        if ((mm = raw.match(RE_EFF_ENDING))) {
          currentNode.choices.push({ text: "Tiếp tục", statRequirements: {}, statModifiers: {}, __explicitTarget: "npc_" + currentNpc.slug + "_ending_" + slugifyNpc(mm[1]) });
          return;
        }
        if ((mm = raw.match(RE_EFF_GOTO_BARE))) {
          currentNode.choices.push({ text: "Tiếp tục", statRequirements: {}, statModifiers: {}, __explicitTarget: "npc_" + currentNpc.slug + "_ending_" + slugifyNpc(mm[1]) });
          return;
        }
      }
      warnings.push(`Dòng ${lineNo}: có "→ ${raw}" nhưng chưa ở trong lựa chọn nào (bỏ qua).`);
      return;
    }
    if (!currentNpc) { warnings.push(`Dòng ${lineNo}: lựa chọn chưa thuộc nhân vật nào (bỏ qua).`); return; }
    if ((m = raw.match(RE_EFF_FLAG))) { target.grantFlag = m[1].trim(); return; }
    if ((m = raw.match(RE_EFF_REQ_NOT_FLAG))) { target.requiresFlagAbsent = m[1].trim(); return; }
    if ((m = raw.match(RE_EFF_REQ_FLAG))) { target.requiresFlag = m[1].trim(); return; }
    if ((m = raw.match(RE_EFF_ITEM))) { target.grantItem = m[1].trim(); return; }
    if ((m = raw.match(RE_EFF_REQ_ITEM))) { target.requiresItem = m[1].trim(); return; }
    if ((m = raw.match(RE_EFF_GOTO))) { target.__explicitTarget = "npc_" + currentNpc.slug + "_scene_" + m[1]; return; }
    if ((m = raw.match(RE_EFF_ENDING))) { target.__explicitTarget = "npc_" + currentNpc.slug + "_ending_" + slugifyNpc(m[1]); return; }
    if ((m = raw.match(RE_EFF_GOTO_BARE))) { target.__explicitTarget = "npc_" + currentNpc.slug + "_ending_" + slugifyNpc(m[1]); return; }
    if ((m = raw.match(RE_EFF_REQ_STAT))) {
      const key = registerStat(m[1]);
      target.statRequirements[key] = Number(m[3]);
      return;
    }
    if ((m = raw.match(RE_EFF_STAT))) {
      const key = registerStat(m[1]);
      target.statModifiers[key] = Number(m[2]);
      return;
    }
    warnings.push(`Dòng ${lineNo}: không hiểu hiệu ứng "→ ${raw}" (bỏ qua).`);
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;
    const norm = stripMarkers(line);

    let m;
    if ((m = norm.match(RE_META_GENRE))) { genre = m[1].trim(); continue; }
    if ((m = norm.match(RE_META_AUTHOR))) { author = m[1].trim(); continue; }
    if ((m = norm.match(RE_META_VITAL))) {
      for (const part of m[1].split(",")) {
        const vm = part.trim().match(RE_VITAL_ITEM);
        if (!vm || !vm[1].trim()) continue;
        const key = registerStat(vm[1]);
        const op = vm[2];
        const num = vm[3] !== undefined ? Number(vm[3]) : null;
        const deathThreshold = num === null ? 0 : (op === "<" ? num - 1 : num);
        vitalDeclarations.push({ key, deathThreshold });
      }
      continue;
    }
    if ((m = norm.match(RE_META_INITIAL))) {
      for (const part of m[1].split(",")) {
        const im = part.trim().match(RE_INITIAL_ITEM);
        if (!im || !im[1].trim()) { warnings.push(`Dòng ${lineNo}: "Chỉ số khởi đầu" cần đúng dạng "<Tên chỉ số> = <số>" (bỏ qua "${part.trim()}").`); continue; }
        const key = registerStat(im[1]);
        initialDeclarations.push({ key, value: Number(im[2]) });
      }
      continue;
    }

    if (RE_INTRO.test(norm)) {
      introNode = { id: "start_node", speaker: "", text: "", bgImage: "", isEnding: false, endingType: null, choices: [] };
      currentNode = null; // GIỚI THIỆU chỉ góp text cho start_node, không phải 1 cảnh có lựa chọn riêng
      currentChoice = null;
      currentNpc = null;
      inIntro = true; // đánh dấu đang trong khối GIỚI THIỆU để pushParagraph gom vào introNode
      continue;
    }

    if ((m = norm.match(RE_NPC))) {
      const name = m[1].trim();
      const npc = { name, tagline: (m[2] || "").trim(), image: "", slug: slugifyNpc(name), sceneOrder: [] };
      // Tránh 2 nhân vật trùng slug (vd trùng tên) đè node lẫn nhau.
      if (npcList.some((n) => n.slug === npc.slug)) npc.slug = npc.slug + "_" + (npcList.length + 1);
      npcList.push(npc);
      currentNpc = npc;
      currentNode = null;
      currentChoice = null;
      inIntro = false;
      continue;
    }

    if ((m = norm.match(RE_SCENE))) {
      if (!currentNpc) { warnings.push(`Dòng ${lineNo}: có "CẢNH ${m[1]}" nhưng chưa thuộc khối "NHÂN VẬT" nào (bỏ qua).`); continue; }
      const n = m[1];
      const id = "npc_" + currentNpc.slug + "_scene_" + n;
      const node = { id, speaker: (m[2] || "").trim(), text: "", bgImage: "", isEnding: false, endingType: null, choices: [] };
      nodesMap[id] = node;
      currentNpc.sceneOrder.push(id);
      currentNode = node;
      currentChoice = null;
      continue;
    }

    if ((m = norm.match(RE_ENDING))) {
      if (!currentNpc) { warnings.push(`Dòng ${lineNo}: có "KẾT THÚC ${m[1]}" nhưng chưa thuộc khối "NHÂN VẬT" nào (bỏ qua).`); continue; }
      const id = "npc_" + currentNpc.slug + "_ending_" + slugifyNpc(m[1]);
      let endTitle = (m[2] || "").trim();
      const strayType = endTitle.match(/\s*\[([A-Z_]+)\]\s*$/);
      if (strayType) {
        endTitle = endTitle.slice(0, strayType.index).trim();
        warnings.push(`Dòng ${lineNo}: loại kết thúc "[${strayType[1]}]" không hợp lệ — chỉ nhận TRUE_END/GOOD_END/NORMAL_END/BAD_END, đã tự chuyển thành NORMAL_END.`);
      }
      const node = { id, speaker: endTitle, text: "", bgImage: "", isEnding: true, endingType: m[3] || "NORMAL_END", choices: [] };
      nodesMap[id] = node;
      currentNode = node;
      currentChoice = null;
      continue;
    }

    if ((m = norm.match(RE_CHOICE))) {
      if (!currentNode) { warnings.push(`Dòng ${lineNo}: có lựa chọn nhưng chưa thuộc cảnh nào (bỏ qua).`); continue; }
      const choice = {
        text: stripMarkdown(m[2]),
        statRequirements: {},
        statModifiers: {},
      };
      currentNode.choices.push(choice);
      currentChoice = choice;
      continue;
    }

    if ((m = norm.match(RE_EFFECT))) {
      applyEffectLine(m[1].trim(), lineNo);
      continue;
    }

    if (!title && !currentNpc && !inIntro) {
      title = norm;
      continue;
    }

    if (inIntro && !currentNode) {
      pushParagraph(introNode, line);
    } else if (currentNode) {
      pushParagraph(currentNode, line);
    }
  }

  const validNpcs = npcList.filter((n) => n.sceneOrder.length > 0);
  for (const n of npcList) {
    if (!n.sceneOrder.length) warnings.push(`Nhân vật "${n.name}" không có cảnh nào (thiếu "### CẢNH 1 — ...") — đã bỏ khỏi màn hình chọn nhân vật.`);
  }
  if (!validNpcs.length) {
    throw new Error('Không tìm thấy nhân vật nào có cảnh (cần ít nhất 1 khối "## NHÂN VẬT ..." kèm "### CẢNH 1 — ..."). Kiểm tra lại cú pháp kịch bản.');
  }

  // Giải quyết targetNodeId trong PHẠM VI TỪNG nhân vật — số cảnh reset về 1
  // cho mỗi tuyến nên không được lẫn thứ tự giữa các nhân vật.
  for (const npc of validNpcs) {
    for (let idx = 0; idx < npc.sceneOrder.length; idx++) {
      const node = nodesMap[npc.sceneOrder[idx]];
      if (!node) continue;
      const nextId = npc.sceneOrder[idx + 1];
      for (const c of node.choices) {
        if (c.__explicitTarget) {
          c.targetNodeId = c.__explicitTarget;
          delete c.__explicitTarget;
        } else if (nextId) {
          c.targetNodeId = nextId;
        } else {
          warnings.push(
            `Lựa chọn "${c.text}" ở cảnh cuối cùng của "${npc.name}" (${node.id}) không có đích rõ ràng — ` +
            `hãy thêm "→ Đến cảnh N" hoặc "→ Kết thúc <nhãn>" cho nó. Lựa chọn này đã bị bỏ qua.`
          );
        }
      }
    }
  }

  nodesMap["start_node"] = {
    id: "start_node",
    speaker: "",
    text: (introNode && introNode.text) || "Bạn muốn theo đuổi ai?",
    bgImage: "",
    isEnding: false,
    endingType: null,
    choices: validNpcs.map((n) => ({
      text: "Theo đuổi " + n.name,
      targetNodeId: n.sceneOrder[0],
      statRequirements: {},
      statModifiers: {},
      npcCard: { name: n.name, tagline: n.tagline || "", image: n.image || "" },
    })),
  };

  const statKeys = Array.from(statKeysSeen.keys());
  const statsConfig = statKeys.map((key) => {
    const vital = vitalDeclarations.find((v) => v.key === key);
    const initial = initialDeclarations.find((v) => v.key === key);
    const base = { key, label: statKeysSeen.get(key), default: initial ? initial.value : 0, isVital: false };
    return vital ? { ...base, isVital: true, deathThreshold: vital.deathThreshold } : base;
  });
  const initialStats = {};
  for (const sc of statsConfig) initialStats[sc.key] = sc.default;

  const repaired = normalizeAndRepair(nodesMap, statKeys, 0, { forceNonEmptyModifiers: false });
  const nodes = repaired.nodes;
  warnings.push(...repaired.warnings);

  const meta = {
    title: title || baseMeta.title || "Công Lược Mới",
    author: author || baseMeta.author || "",
    genre: genre || baseMeta.genre || "ngon-tinh",
    theme: baseMeta.theme || "sakura-dream",
    archetype: "romance",
    player_name: baseMeta.player_name || "Nhân Vật Chính",
    playerAvatar: baseMeta.playerAvatar || "",
    statsConfig,
    initialStats,
    litrpg: baseMeta.litrpg || { ranks: ["Luyện Khí", "Trúc Cơ", "Kim Đan", "Nguyên Anh"], expPerRank: 100 },
    mystery: baseMeta.mystery || { inventorySlots: 4 },
  };

  return { meta, nodes, warnings };
}
