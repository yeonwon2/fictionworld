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
// **Thông báo thua cuộc:** <tiêu đề> | <nội dung> (tuỳ chọn — chữ hiện khi
//                                thua cuộc, thay cho "GAME OVER" mặc định.
//                                Chỉ có tác dụng nếu bạn tự đặt 1 chỉ số là
//                                "sinh tử" trong Cấu hình chung. Bỏ qua dòng
//                                này thì vẫn hiện chữ mặc định như cũ.)
//
// ## GIỚI THIỆU
// <văn bản mở đầu, có thể nhiều đoạn>
//
// ## CẢNH 1 — <Tên cảnh, chỉ để tham khảo khi viết>
// <văn bản diễn biến của cảnh, có thể nhiều đoạn>
// (Nhãn cảnh không bắt buộc là số thuần — có thể đặt "CẢNH 1A", "CẢNH 2b"...
//  để dễ phân biệt các nhánh rẽ, miễn khớp đúng với "→ Đến cảnh <nhãn>" ở dưới.)
//
// **A — <lời lựa chọn>**
// → <Tên chỉ số> +5            (cộng điểm — tự nhận diện & tạo chỉ số mới nếu chưa có)
// → <Tên chỉ số> -10           (trừ điểm)
// → Cần <Tên chỉ số> >= 20     (khoá lựa chọn nếu chỉ số chưa đủ)
// → Cờ: đã hứa ở lại           (bật một "cờ truyện" — dùng để nhớ lựa chọn trước đó; đây
//                                cũng là câu chữ sẽ hiện thẳng cho người chơi xem trong
//                                thông báo, nên hãy viết bằng tiếng Việt tự nhiên)
// → Cần cờ: đã hứa ở lại       (khoá lựa chọn nếu cờ CHƯA bật — gõ đúng y hệt câu ở trên)
// → Cần không có cờ: đã hứa ở lại (khoá lựa chọn nếu cờ ĐÃ bật — dùng để làm nhánh "else"
//                                đối lập với "Cần cờ" ở một lựa chọn khác)
// → Vật phẩm: tên vật phẩm     (nhặt vật phẩm)
// → Cần vật phẩm: tên vật phẩm (khoá lựa chọn nếu chưa có vật phẩm)
// → Đến cảnh 3                 (chỉ định thẳng cảnh tiếp theo — SỐ 3 PHẢI có một khối
//                                "## CẢNH 3" thật trong kịch bản, nếu không lựa chọn này sẽ
//                                báo lỗi rõ ràng và tạm dẫn tới ending "Thiếu cảnh" — nếu bỏ
//                                qua dòng này hoàn toàn, mặc định là cảnh liền sau trong văn bản)
// → Kết thúc true_end          (dẫn thẳng tới một khối KẾT THÚC có cùng nhãn — "Đến Kết thúc
//                                true_end" cũng được, có/không chữ "Đến" đều đọc như nhau)
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
// "→ Kết thúc <nhãn>" ở lựa chọn dẫn tới nó — nhãn phải khớp Y HỆT (không phân
// biệt hoa/thường), nếu không sẽ bị báo lỗi thay vì âm thầm hỏng. Loại kết thúc
// trong [ ] CHỈ ĐƯỢC là một trong 4 giá trị: TRUE_END / GOOD_END / NORMAL_END /
// BAD_END (mặc định NORMAL_END nếu bỏ qua) — các nhãn tự đặt khác (vd [SAD_END],
// [SECRET_END]) không được hỗ trợ, sẽ bị báo lỗi và tự chuyển thành NORMAL_END.
//
// Nếu một lựa chọn không có dòng "→ Đến cảnh"/"→ Kết thúc" nào, nó tự động
// dẫn tới CẢNH kế tiếp theo đúng thứ tự xuất hiện trong văn bản — nghĩa là một
// kịch bản hoàn toàn tuyến tính chỉ cần liệt kê cảnh theo thứ tự, không cần
// khai báo "Đến cảnh" ở mọi lựa chọn.
//
// KHÔNG HỖ TRỢ rẽ nhánh có điều kiện kiểu "→ Nếu có cờ X: Đến cảnh Y" trên CÙNG
// một lựa chọn — mỗi lựa chọn chỉ có ĐÚNG MỘT đích đến. Để rẽ nhánh theo điều
// kiện, hãy viết thành 2 lựa chọn riêng cùng hiện một nội dung, một cái khoá
// bằng "Cần cờ: X" (nhánh khi có cờ), cái kia khoá bằng "Cần không có cờ: X"
// (nhánh khi chưa có cờ) — mỗi cái tự "→ Đến cảnh"/"→ Kết thúc" riêng.
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

function normalizeLoose(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .trim();
}

// Dò các lỗi "gõ gần đúng" phổ biến nhất cho 1 dòng "→ ..." không khớp cú
// pháp nào cả — trả về 1 câu gợi ý sửa cụ thể, hoặc "" nếu không đoán được.
// Chỉ dùng để LÀM RÕ cảnh báo có sẵn, không thay đổi kết quả sản xuất.
function suggestEffectFix(raw) {
  const norm = normalizeLoose(raw);
  if (/^he\s*thong\b/.test(norm)) return ' Xưởng Offline không hỗ trợ "→ Hệ thống: ..." — bảng thông báo hệ thống chỉ có ở Xưởng Hệ Thống.';
  if (/^den\s+canh\b/.test(norm)) return ' Có phải bạn định viết "→ Đến cảnh <số/nhãn cảnh>"? Kiểm tra lại dấu tiếng Việt và khoảng trắng.';
  if (/^(den\s+)?ket\s*thuc\b/.test(norm)) return ' Có phải bạn định viết "→ Kết thúc <nhãn>"? Nhãn phải khớp Y HỆT với 1 khối "KẾT THÚC ..." có thật trong kịch bản.';
  if (/^can\s+co\b/.test(norm) && !raw.includes(":")) return ' Có phải bạn định viết "→ Cần cờ: <tên cờ>"? Thiếu dấu ":".';
  if (/^co\b/.test(norm) && !raw.includes(":")) return ' Có phải bạn định viết "→ Cờ: <tên cờ>"? Thiếu dấu ":".';
  if (/^vat\s*pham\b/.test(norm) && !raw.includes(":")) return ' Có phải bạn định viết "→ Vật phẩm: <tên vật phẩm>"? Thiếu dấu ":".';
  if (/^can\s+vat\s*pham\b/.test(norm) && !raw.includes(":")) return ' Có phải bạn định viết "→ Cần vật phẩm: <tên vật phẩm>"? Thiếu dấu ":".';
  if (/^can\b/.test(norm) && !/>=|≥/.test(raw)) return ' Có phải bạn định viết "→ Cần <tên chỉ số> >= <số>"? Thiếu dấu ">=".';
  if (/\d\s*$/.test(raw) && !/[+-]\d+\s*$/.test(raw)) return ' Có phải đây là hiệu ứng chỉ số? Nhớ thêm dấu "+" hoặc "-" trước số, vd "→ Thiện cảm +10".';
  return '';
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
const RE_META_GAMEOVER = /^Thông báo thua cuộc\s*:\s*(.+)$/i;
const RE_INTRO = /^GIỚI THIỆU\s*$/i;
const RE_SCENE = /^CẢNH\s+(\S+?)\s*(?:[—\-:.]\s*(.+))?$/i;
const RE_ENDING = /^KẾT THÚC\s+(\S+)\s*(?:[—\-:.]\s*(.+?))?\s*(?:\[(TRUE_END|GOOD_END|NORMAL_END|BAD_END)\])?\s*$/i;
const RE_CHOICE = /^([A-ZĐ])\s*[—\-:.)]\s*(.+?)\s*\**\s*$/;
const RE_EFFECT = /^(?:→|->|=>)\s*(.+)$/;

const RE_EFF_FLAG = /^Cờ:\s*(.+)$/i;
const RE_EFF_REQ_FLAG = /^Cần cờ:\s*(.+)$/i;
const RE_EFF_REQ_NOT_FLAG = /^Cần không có cờ:\s*(.+)$/i;
const RE_EFF_ITEM = /^(?:Nhận\s+)?Vật phẩm:\s*(.+)$/i;
const RE_EFF_REQ_ITEM = /^Cần vật phẩm:\s*(.+)$/i;
const RE_EFF_GOTO = /^Đến\s+cảnh\s+(\S+)$/i;
const RE_EFF_ENDING = /^(?:Đến\s+)?kết\s+thúc\s+(\S+)$/i;
const RE_EFF_REQ_STAT = /^Cần\s+(.+?)\s*(>=|≥)\s*(-?\d+)$/i;
const RE_EFF_STAT = /^(.+?)\s*([+-]\d+)\s*$/;
const RE_EFFECT_DASH = /^-\s+(.+)$/;

// Nhiều người quen gõ "-" thay cho "→" (nhất là gõ trên điện thoại, bàn phím
// không gõ được dấu mũi tên) — chỉ chấp nhận nếu phần sau dấu "-" khớp Y HỆT
// 1 hiệu ứng THẬT SỰ, để không hiểu nhầm 1 câu văn xuôi tình cờ có gạch đầu dòng.
function looksLikeEffect(text) {
  return RE_EFF_FLAG.test(text) || RE_EFF_REQ_FLAG.test(text) || RE_EFF_REQ_NOT_FLAG.test(text)
    || RE_EFF_ITEM.test(text) || RE_EFF_REQ_ITEM.test(text) || RE_EFF_GOTO.test(text)
    || RE_EFF_ENDING.test(text) || RE_EFF_REQ_STAT.test(text) || RE_EFF_STAT.test(text);
}

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
  let gameOverTitle = "";
  let gameOverText = "";

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
      // Cảnh không có lựa chọn A/B nào, chỉ có 1 dòng "→ Đến cảnh N"/"→ Kết
      // thúc X" ngay dưới lời dẫn — coi đây là cảnh chuyển tiếp thẳng, tự tạo
      // 1 lựa chọn "Tiếp tục" ẩn danh thay vì bỏ qua (rất nhiều kịch bản thật
      // viết theo kiểu này khi 1 cảnh không cần rẽ nhánh).
      if (currentNode && !currentNode.isEnding) {
        let mm;
        if ((mm = raw.match(RE_EFF_GOTO))) {
          currentNode.choices.push({ text: "Tiếp tục", statRequirements: {}, statModifiers: {}, __explicitTarget: "scene_" + mm[1] });
          return;
        }
        if ((mm = raw.match(RE_EFF_ENDING))) {
          currentNode.choices.push({ text: "Tiếp tục", statRequirements: {}, statModifiers: {}, __explicitTarget: "ending_" + slugify(mm[1]) });
          return;
        }
      }
      warnings.push(`Dòng ${lineNo}: có "→ ${raw}" nhưng chưa ở trong lựa chọn nào (bỏ qua).${suggestEffectFix(raw)}`);
      return;
    }
    let m;
    if ((m = raw.match(RE_EFF_FLAG))) { target.grantFlag = m[1].trim(); return; }
    if ((m = raw.match(RE_EFF_REQ_NOT_FLAG))) { target.requiresFlagAbsent = m[1].trim(); return; }
    if ((m = raw.match(RE_EFF_REQ_FLAG))) { target.requiresFlag = m[1].trim(); return; }
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
    warnings.push(`Dòng ${lineNo}: không hiểu hiệu ứng "→ ${raw}" (bỏ qua).${suggestEffectFix(raw)}`);
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
    if ((m = norm.match(RE_META_GAMEOVER))) {
      const parts = m[1].split("|");
      gameOverTitle = (parts[0] || "").trim();
      gameOverText = (parts[1] || "").trim();
      continue;
    }

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
      let title = (m[2] || "").trim();
      // Nhãn loại kết thúc ngoài 4 loại hợp lệ (vd [SAD_END], [SECRET_END]) không
      // khớp regex nên bị nuốt vào tên kết thúc thay vì nhận làm loại — tách ra
      // và báo rõ thay vì để lộ "[...]" ra màn hình người chơi.
      const strayType = title.match(/\s*\[([A-Z_]+)\]\s*$/);
      if (strayType) {
        title = title.slice(0, strayType.index).trim();
        warnings.push(`Dòng ${lineNo}: loại kết thúc "[${strayType[1]}]" không hợp lệ — chỉ nhận TRUE_END/GOOD_END/NORMAL_END/BAD_END, đã tự chuyển thành NORMAL_END.`);
      }
      const node = { id, speaker: title, text: "", bgImage: "", isEnding: true, endingType: m[3] || "NORMAL_END", choices: [] };
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

    if (currentNode && (m = norm.match(RE_EFFECT_DASH)) && looksLikeEffect(m[1].trim())) {
      warnings.push(`Dòng ${lineNo}: dòng "${line}" dùng "-" thay vì "→" — đã tạm hiểu như hiệu ứng, nhưng hãy đổi lại đúng dấu mũi tên "→" (hoặc "->"/"=>") để chắc chắn không bị lỗi về sau.`);
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

  const repaired = normalizeAndRepair(nodesMap, statKeys, 0, { forceNonEmptyModifiers: false });
  const nodes = repaired.nodes;
  warnings.push(...repaired.warnings);

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
    gameOverTitle: gameOverTitle || baseMeta.gameOverTitle || "",
    gameOverText: gameOverText || baseMeta.gameOverText || "",
    litrpg: baseMeta.litrpg || { ranks: ["Luyện Khí", "Trúc Cơ", "Kim Đan", "Nguyên Anh"], expPerRank: 100 },
    mystery: baseMeta.mystery || { inventorySlots: 4 },
  };

  return { meta, nodes, warnings };
}
