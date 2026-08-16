// "Xưởng Offline" — biến một kịch bản văn bản (viết tay HOẶC do AI viết theo
// đúng cú pháp bên dưới) thành game chơi được, KHÔNG gọi AI, hoàn toàn xác
// định (cùng một kịch bản luôn ra đúng một kết quả). Dùng chung node schema
// với generator.js/postprocess.js nên tương thích 100% với GamePlayer.jsx và
// bản HTML xuất ra (rpgExport.js) — không cần sửa engine nào cả.
//
// ============================= CÚ PHÁP KỊCH BẢN =============================
//
// # <Tên game>
// **Thể loại:** ...              (tuỳ chọn)
// **Tác giả:** ...                (tuỳ chọn)
//
// ## GIỚI THIỆU
// <văn bản mở đầu, có thể nhiều đoạn>
//
// ## CẢNH 1 — <Tên cảnh, chỉ để tham khảo khi viết>
// <văn bản diễn biến của cảnh, có thể nhiều đoạn>
//
// **A — <lời lựa chọn>**
// → <Tên chỉ số> +5            (cộng điểm — tự nhận diện & tạo chỉ số mới nếu chưa có)
// → <Tên chỉ số> -10           (trừ điểm)
// → Cần <Tên chỉ số> >= 20     (khoá lựa chọn nếu chỉ số chưa đủ)
// → Cờ: ten_co                 (bật một "cờ truyện" — dùng để nhớ lựa chọn trước đó)
// → Cần cờ: ten_co             (khoá lựa chọn nếu cờ chưa bật)
// → Vật phẩm: tên vật phẩm     (nhặt vật phẩm)
// → Cần vật phẩm: tên vật phẩm (khoá lựa chọn nếu chưa có vật phẩm)
// → Đến cảnh 3                 (chỉ định thẳng cảnh tiếp theo — nếu bỏ qua, mặc định là cảnh liền sau trong văn bản)
// → Kết thúc true_end          (dẫn thẳng tới một khối KẾT THÚC có cùng nhãn)
//
// **B — <lời lựa chọn khác>**
// ...
//
// ## CẢNH 2 — ...
// ...
//
// ## KẾT THÚC true_end — <Tên kết thúc> [TRUE_END]
// <văn bản kết thúc>
//
// Nhãn kết thúc (true_end ở trên) do người viết tự đặt, chỉ cần khớp với dòng
// "→ Kết thúc <nhãn>" ở lựa chọn dẫn tới nó. Loại kết thúc trong [ ] là một
// trong TRUE_END / GOOD_END / NORMAL_END / BAD_END (mặc định NORMAL_END nếu bỏ qua).
//
// Nếu một lựa chọn không có dòng "→ Đến cảnh"/"→ Kết thúc" nào, nó tự động
// dẫn tới CẢNH kế tiếp theo đúng thứ tự xuất hiện trong văn bản — nghĩa là một
// kịch bản hoàn toàn tuyến tính chỉ cần liệt kê cảnh theo thứ tự, không cần
// khai báo "Đến cảnh" ở mọi lựa chọn.
//
// Các ký hiệu markdown (#, ##, **) chỉ để DỄ ĐỌC, KHÔNG bắt buộc — hệ thống
// nhận diện "CẢNH", "KẾT THÚC", "GIỚI THIỆU", lựa chọn (A/B/C...) qua từ khoá,
// dù có hay thiếu #/##/** đều đọc được như nhau. Mũi tên hiệu ứng "→" có thể
// gõ thành "->" hoặc "=>" nếu bàn phím không gõ được ký tự →.
// =============================================================================

import { normalizeAndRepair } from "./postprocess";

export function slugify(label) {
  return String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "x";
}

// Các dòng "đề mục" (tiêu đề/cảnh/kết thúc/lựa chọn/meta) được nhận diện qua
// TỪ KHOÁ, không bắt buộc phải có "#"/"##"/"**" bao quanh — người viết tay
// rất hay quên các ký hiệu markdown này, nên hệ thống tự bỏ qua chúng khi
// nhận diện (stripMarkers), chỉ dùng để phân biệt tiêu đề game (không từ
// khoá, dựa vào việc là dòng nội dung đầu tiên của văn bản).
function stripMarkers(line) {
  return line.replace(/^#{1,6}\s*/, "").replace(/^\*{1,3}\s*/, "").replace(/\*{1,3}\s*$/, "").trim();
}

const RE_META_GENRE = /^Thể loại\s*:\s*(.+)$/i;
const RE_META_AUTHOR = /^Tác giả\s*:\s*(.+)$/i;
const RE_INTRO = /^GIỚI THIỆU\s*$/i;
const RE_SCENE = /^CẢNH\s+(\d+)\s*(?:[—\-:.]\s*(.+))?$/i;
const RE_ENDING = /^KẾT THÚC\s+(\S+)\s*(?:[—\-:.]\s*(.+?))?\s*(?:\[(TRUE_END|GOOD_END|NORMAL_END|BAD_END)\])?\s*$/i;
const RE_CHOICE = /^([A-ZĐ])\s*[—\-:.)]\s*(.+?)\s*\**\s*$/;
const RE_EFFECT = /^(?:→|->|=>)\s*(.+)$/;

const RE_EFF_FLAG = /^Cờ:\s*(.+)$/i;
const RE_EFF_REQ_FLAG = /^Cần cờ:\s*(.+)$/i;
const RE_EFF_ITEM = /^Vật phẩm:\s*(.+)$/i;
const RE_EFF_REQ_ITEM = /^Cần vật phẩm:\s*(.+)$/i;
const RE_EFF_GOTO = /^Đến cảnh\s+(\d+)$/i;
const RE_EFF_ENDING = /^Kết thúc\s+(\S+)$/i;
const RE_EFF_REQ_STAT = /^Cần\s+(.+?)\s*(>=|≥)\s*(-?\d+)$/i;
const RE_EFF_STAT = /^(.+?)\s*([+-]\d+)\s*$/;

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
 * Phân tích kịch bản văn bản thành { meta, nodes, warnings }.
 * Không gọi AI, hoàn toàn xác định. Ném lỗi (có số dòng) nếu kịch bản
 * không có nổi 1 cảnh nào để sản xuất.
 */
export function parseScript(scriptText, baseMeta = {}) {
  const lines = String(scriptText || "").replace(/\r\n/g, "\n").split("\n");
  const warnings = [];
  const statKeysSeen = new Map(); // key -> label gốc

  let title = "";
  let genre = "";
  let author = "";

  const sceneOrder = []; // ["scene_1", "scene_2", ...] theo đúng thứ tự xuất hiện
  const nodesMap = {};
  let currentNode = null; // node đang được điền text/choices
  let currentChoice = null; // choice đang được điền hiệu ứng
  let introNode = null;

  function registerStat(label) {
    const key = slugify(label);
    if (!statKeysSeen.has(key)) statKeysSeen.set(key, label.trim());
    return key;
  }

  function applyEffectLine(raw, lineNo) {
    const target = currentChoice; // hiệu ứng luôn gắn vào lựa chọn hiện tại
    if (!target) {
      warnings.push(`Dòng ${lineNo}: có "→ ${raw}" nhưng chưa ở trong lựa chọn nào (bỏ qua).`);
      return;
    }
    let m;
    if ((m = raw.match(RE_EFF_FLAG))) { target.grantFlag = slugify(m[1]); return; }
    if ((m = raw.match(RE_EFF_REQ_FLAG))) { target.requiresFlag = slugify(m[1]); return; }
    if ((m = raw.match(RE_EFF_ITEM))) { target.grantItem = m[1].trim(); return; }
    if ((m = raw.match(RE_EFF_REQ_ITEM))) { target.requiresItem = m[1].trim(); return; }
    if ((m = raw.match(RE_EFF_GOTO))) { target.__explicitTarget = "scene_" + m[1]; return; }
    if ((m = raw.match(RE_EFF_ENDING))) { target.__explicitTarget = "ending_" + slugify(m[1]); return; }
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

    if (RE_INTRO.test(norm)) {
      introNode = { id: "start_node", speaker: "", text: "", bgImage: "", isEnding: false, endingType: null, choices: [] };
      currentNode = introNode;
      currentChoice = null;
      continue;
    }

    if ((m = norm.match(RE_SCENE))) {
      const n = m[1];
      const id = "scene_" + n;
      const node = { id, speaker: (m[2] || "").trim(), text: "", bgImage: "", isEnding: false, endingType: null, choices: [] };
      nodesMap[id] = node;
      sceneOrder.push(id);
      currentNode = node;
      currentChoice = null;
      continue;
    }

    if ((m = norm.match(RE_ENDING))) {
      const id = "ending_" + slugify(m[1]);
      const node = { id, speaker: (m[2] || "").trim(), text: "", bgImage: "", isEnding: true, endingType: m[3] || "NORMAL_END", choices: [] };
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

    // Dòng đầu tiên của cả văn bản, chưa thuộc GIỚI THIỆU/CẢNH/KẾT THÚC nào
    // → coi là tên game (kể cả khi người viết quên "#" đầu dòng).
    if (!title && !currentNode) {
      title = norm;
      continue;
    }

    // Văn bản thường — thuộc về choice hiện tại (kết quả lựa chọn) nếu đang
    // trong 1 lựa chọn, ngược lại thuộc về phần mở đầu của node.
    if (currentChoice) {
      // Gộp thêm mô tả kết quả vào cuối text của node (không tách riêng để
      // giữ engine hiện có đơn giản — mọi diễn biến nằm trong 1 khối text).
      pushParagraph(currentNode, line);
    } else if (currentNode) {
      pushParagraph(currentNode, line);
    }
  }

  if (!sceneOrder.length) {
    throw new Error("Không tìm thấy cảnh nào (cần ít nhất 1 dòng \"## CẢNH 1 — ...\"). Kiểm tra lại cú pháp kịch bản.");
  }

  // start_node: dùng GIỚI THIỆU nếu có (nối vào cảnh 1 bằng 1 lựa chọn "Tiếp tục"),
  // nếu không thì chính CẢNH 1 trở thành start_node.
  if (introNode) {
    introNode.choices = [{ text: "Bắt đầu", targetNodeId: sceneOrder[0], statRequirements: {}, statModifiers: {} }];
    nodesMap["start_node"] = introNode;
  } else {
    const first = nodesMap[sceneOrder[0]];
    delete nodesMap[sceneOrder[0]];
    first.id = "start_node";
    nodesMap["start_node"] = first;
    sceneOrder[0] = "start_node";
  }

  // Giải quyết targetNodeId: ưu tiên "__explicitTarget", nếu không thì mặc
  // định là cảnh kế tiếp theo thứ tự văn bản; cảnh cuối cùng không có target
  // rõ ràng sẽ tự trở thành node kết thúc (không có lựa chọn tiếp theo hợp lệ
  // → normalizeAndRepair() sẽ tự sinh ending fallback).
  for (let idx = 0; idx < sceneOrder.length; idx++) {
    const node = nodesMap[sceneOrder[idx]];
    if (!node) continue;
    const nextId = sceneOrder[idx + 1];
    for (const c of node.choices) {
      if (c.__explicitTarget) {
        c.targetNodeId = c.__explicitTarget;
        delete c.__explicitTarget;
      } else if (nextId) {
        c.targetNodeId = nextId;
      } else {
        warnings.push(
          `Lựa chọn "${c.text}" ở cảnh cuối cùng (${node.id}) không có đích rõ ràng — ` +
          `hãy thêm "→ Đến cảnh N" hoặc "→ Kết thúc <nhãn>" cho nó. Lựa chọn này đã bị bỏ qua.`
        );
      }
    }
  }

  const statKeys = Array.from(statKeysSeen.keys());
  const statsConfig = statKeys.map((key) => ({ key, label: statKeysSeen.get(key), default: 0, isVital: false }));
  const initialStats = {};
  for (const key of statKeys) initialStats[key] = 0;

  const nodes = normalizeAndRepair(nodesMap, statKeys, 0, { forceNonEmptyModifiers: false });

  // Tiêu đề/thể loại ưu tiên do kịch bản tự khai báo; các lựa chọn trình bày
  // (theme/tên nhân vật/avatar) giữ nguyên từ cấu hình "Thiết Lập Game" đã đặt
  // sẵn trước đó, không bị kịch bản ghi đè. statsConfig luôn lấy từ kịch bản
  // vì mỗi kịch bản có hệ chỉ số tường thuật riêng.
  const meta = {
    title: title || baseMeta.title || "Tựa Game Từ Kịch Bản",
    author: author || baseMeta.author || "",
    genre: genre || baseMeta.genre || "fantasy",
    theme: baseMeta.theme || "fantasy-parchment",
    archetype: "none",
    player_name: baseMeta.player_name || "Nhân Vật Chính",
    playerAvatar: baseMeta.playerAvatar || "",
    statsConfig,
    initialStats,
    litrpg: baseMeta.litrpg || { ranks: ["Luyện Khí", "Trúc Cơ", "Kim Đan", "Nguyên Anh"], expPerRank: 100 },
    mystery: baseMeta.mystery || { inventorySlots: 4 },
  };

  return { meta, nodes, warnings };
}
