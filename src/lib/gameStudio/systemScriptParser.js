// "Xưởng Hệ Thống" — xưởng sản xuất game RIÊNG BIỆT, độc lập hoàn toàn với
// "Xưởng Offline" (scriptParser.js) — không import, không chia sẻ cú pháp hay
// state với file đó, sửa xưởng này không ảnh hưởng gì tới xưởng kia.
//
// Dành cho thể loại "Hệ Thống": trọng sinh/xuyên không có một hệ thống/AI dẫn
// dắt nhân vật chính — bật bảng thông báo khi vào game, nhắc nhở giữa chừng,
// và phạt/thưởng ngay sau khi người chơi chọn. Giống "Xưởng Offline" ở việc
// đều biến 1 kịch bản văn bản thành game chơi được (không gọi AI, hoàn toàn
// xác định), nhưng cú pháp dành riêng cho phong cách "Hệ Thống" này.
//
// Dùng chung node schema với GamePlayer.jsx/rpgExport.js (không sửa engine
// nào cả) nên game sản xuất ra chơi/xuất bản bình thường như mọi game khác.
//
// ============================= CÚ PHÁP KỊCH BẢN =============================
//
// # <Tên game>
// **Thể loại:** ...                          (tuỳ chọn)
// **Tác giả:** ...                            (tuỳ chọn)
// **Chỉ số sinh tử:** <Tên chỉ số> < <ngưỡng>  (tuỳ chọn, có thể khai nhiều,
//                                               cách nhau dấu phẩy — chỉ số này
//                                               tụt xuống bằng/dưới ngưỡng thì
//                                               Game Over ngay. Bỏ "< ngưỡng"
//                                               thì ngưỡng mặc định là 0.
//                                               Vd: "Thiện cảm < 10" nghĩa là
//                                               dưới 10 (tức còn 9 trở xuống)
//                                               là chết, KHÔNG PHẢI về đúng 0.)
// **Chỉ số khởi đầu:** <Tên chỉ số> = <giá trị> (tuỳ chọn, có thể khai nhiều,
//                                               cách nhau dấu phẩy — đặt điểm
//                                               XUẤT PHÁT cho 1 chỉ số. QUAN
//                                               TRỌNG: nếu có khai "Chỉ số
//                                               sinh tử", NHỚ khai luôn điểm
//                                               khởi đầu cao hơn ngưỡng chết,
//                                               nếu không nhân vật sẽ "chết"
//                                               ngay khi vừa vào game vì mọi
//                                               chỉ số mặc định bắt đầu ở 0.
//                                               Vd: "Thiện cảm = 20")
// **Thông báo thua cuộc:** <tiêu đề> | <nội dung> (tuỳ chọn — đổi chữ hiện khi
//                                               chết vì "Chỉ số sinh tử" ở
//                                               trên, thay cho "GAME OVER" mặc
//                                               định. Vd: "Ký Chủ Ngừng Hoạt
//                                               Động | Nhiệm vụ thất bại, hệ
//                                               thống đã ngắt kết nối.". Bỏ
//                                               qua dòng này thì vẫn hiện chữ
//                                               mặc định như cũ.)
//
// ## GIỚI THIỆU
// → Hệ thống: <tiêu đề> | <nội dung>          (tuỳ chọn — bảng thông báo hệ
//                                               thống bật NGAY KHI VÀO GAME,
//                                               vd lời chào "Hệ thống số 01
//                                               xin chào ký chủ..."; người
//                                               chơi bấm "Đã hiểu" để đóng rồi
//                                               mới thấy được nội dung mở đầu.
//                                               MUỐN XUỐNG DÒNG trong <nội
//                                               dung>: gõ "\n" (gạch chéo
//                                               ngược + chữ n liền nhau) ở chỗ
//                                               muốn ngắt dòng — KHÔNG được
//                                               nhấn Enter thật vì mỗi hiệu
//                                               ứng chỉ được nằm trên ĐÚNG 1
//                                               dòng văn bản.)
// <văn bản mở đầu, có thể nhiều đoạn>
//
// ## CẢNH 1 — <Tên cảnh, chỉ để tham khảo khi viết>
// (Nhãn cảnh không bắt buộc là số thuần — có thể đặt "CẢNH 1A", "CẢNH 2b"...
//  để dễ phân biệt các nhánh rẽ, miễn khớp đúng với "→ Đến cảnh <nhãn>" ở dưới.)
// → Hệ thống: <tiêu đề> | <nội dung>          (tuỳ chọn — bảng thông báo bật
//                                               khi VÀO cảnh này, dùng để nhắc
//                                               nhở giữa chừng. Tối đa 1 dòng
//                                               này cho mỗi cảnh.)
// <văn bản diễn biến của cảnh, có thể nhiều đoạn>
//
// **A — <lời lựa chọn>**
// → <Tên chỉ số> +5                            (cộng điểm)
// → <Tên chỉ số> -10                           (trừ điểm — dùng cho hình phạt)
// → Hệ thống: <tiêu đề> | <nội dung>            (tuỳ chọn — bảng thông báo bật
//                                               NGAY SAU KHI người chơi chọn
//                                               lựa chọn này, dùng để công bố
//                                               phạt/thưởng, vd "Hệ thống:
//                                               CẢNH BÁO | Ký chủ đã làm lệch
//                                               cốt truyện, bị phạt chích
//                                               điện, trừ 10 thiện cảm!")
// → Cần <Tên chỉ số> >= 20                     (khoá lựa chọn nếu chỉ số chưa đủ)
// → Cờ: đã hứa ở lại                           (bật một "cờ truyện")
// → Cần cờ: đã hứa ở lại                       (khoá nếu cờ CHƯA bật)
// → Cần không có cờ: đã hứa ở lại               (khoá nếu cờ ĐÃ bật — nhánh "else")
// → Vật phẩm: tên vật phẩm                     (nhặt vật phẩm)
// → Cần vật phẩm: tên vật phẩm                 (khoá nếu chưa có vật phẩm)
// → Đến cảnh 3                                 (chỉ định thẳng cảnh tiếp theo —
//                                               "## CẢNH 3" PHẢI có thật, nếu
//                                               không sẽ báo lỗi rõ ràng; bỏ
//                                               qua dòng này thì mặc định là
//                                               cảnh liền sau trong văn bản)
// → Kết thúc true_end                          (dẫn tới khối KẾT THÚC cùng nhãn
//                                               — viết tắt "→ Đến true_end"
//                                               cũng được, miễn KHÔNG PHẢI
//                                               "Đến cảnh N")
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
// Loại kết thúc trong [ ] CHỈ ĐƯỢC là TRUE_END / GOOD_END / NORMAL_END /
// BAD_END (mặc định NORMAL_END nếu bỏ qua). Không hỗ trợ rẽ nhánh điều kiện
// kiểu "→ Nếu có cờ X: Đến cảnh Y" trong CÙNG 1 lựa chọn — muốn rẽ nhánh theo
// điều kiện, viết 2 lựa chọn riêng, mỗi cái khoá bằng "Cần cờ:"/"Cần không có
// cờ:" đối lập nhau, mỗi cái tự có "→ Đến cảnh"/"→ Kết thúc" riêng.
//
// Các ký hiệu markdown (#, ##, **) chỉ để DỄ ĐỌC, KHÔNG bắt buộc. Mũi tên "→"
// có thể gõ thành "->" hoặc "=>" nếu bàn phím không gõ được ký tự →.
// =============================================================================

import { normalizeAndRepair } from "./postprocess";

export function slugifySystem(label) {
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
    // Nhãn kiểu "**Chỉ số sinh tử:** giá trị" — cặp ** đóng nằm giữa dòng (ngay
    // sau nhãn), không phải cuối dòng, nên phải gỡ theo CẶP.
    .replace(/^\*{1,3}([^*]*)\*{1,3}\s*/, "$1")
    .replace(/\*{1,3}\s*$/, "")
    .trim();
}

const RE_META_GENRE = /^Thể loại\s*:\s*(.+)$/i;
const RE_META_AUTHOR = /^Tác giả\s*:\s*(.+)$/i;
const RE_META_VITAL = /^Chỉ số sinh tử\s*:\s*(.+)$/i;
const RE_META_INITIAL = /^Chỉ số khởi đầu\s*:\s*(.+)$/i;
const RE_META_GAMEOVER = /^Thông báo thua cuộc\s*:\s*(.+)$/i;
const RE_INTRO = /^GIỚI THIỆU\s*$/i;
const RE_SCENE = /^CẢNH\s+(\S+?)(?:(?:\s*[—:.]|\s+-)\s*(.+))?$/i;
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
// Cho phép viết tắt "→ Đến <nhãn>" (không cần chữ "kết thúc") để trỏ tới 1
// kết thúc — miễn KHÔNG PHẢI dạng "Đến cảnh N" (đã xử lý riêng ở trên). Nhiều
// người quen tay gõ giống "Đến cảnh N" nên hay quên chữ "kết thúc".
const RE_EFF_GOTO_BARE = /^Đến\s+(?!cảnh\b)(\S+)$/i;
const RE_EFF_REQ_STAT = /^Cần\s+(.+?)\s*(>=|≥|<=|≤)\s*(-?\d+)$/i;
const RE_EFF_STAT = /^(.+?)\s*([+-]\d+)\s*$/;
const RE_EFF_SYSPOPUP = /^Hệ thống\s*:\s*(.+)$/i;
const RE_VITAL_ITEM = /^(.+?)\s*(?:(<=|<)\s*(-?\d+))?$/;
const RE_INITIAL_ITEM = /^(.+?)\s*=\s*(-?\d+)$/;
const RE_EFFECT_DASH = /^-\s+(.+)$/;

// Bỏ chú thích "(...)" ở CUỐI dòng cấu hình — kịch bản mẫu hay viết chú thích
// hướng dẫn sau giá trị thật (vd "Chỉ số sinh tử: Thiện cảm < 10  (tuỳ chọn ...)").
// Không chạm nhóm "(+N)"/"(<số>)" toàn số — đó là dữ liệu thật.
function stripMetaNote(s) {
  let t = String(s || "").trim();
  for (;;) {
    const numericTail = t.match(/\(\s*[+-]?\d+\s*\)\s*$/);
    if (numericTail) break;
    const next = t.replace(/\s*\([^)]*\)?\s*$/, "").trim();
    if (next === t) break;
    t = next;
  }
  return t;
}

// Nhiều người quen gõ "-" thay cho "→" (nhất là gõ trên điện thoại, bàn phím
// không gõ được dấu mũi tên) — chỉ chấp nhận nếu phần sau dấu "-" khớp Y HỆT
// 1 hiệu ứng THẬT SỰ, để không hiểu nhầm 1 câu văn xuôi tình cờ có gạch đầu dòng.
function looksLikeEffect(text) {
  return RE_EFF_SYSPOPUP.test(text) || RE_EFF_FLAG.test(text) || RE_EFF_REQ_FLAG.test(text) || RE_EFF_REQ_NOT_FLAG.test(text)
    || RE_EFF_ITEM.test(text) || RE_EFF_REQ_ITEM.test(text) || RE_EFF_GOTO.test(text)
    || RE_EFF_ENDING.test(text) || RE_EFF_GOTO_BARE.test(text) || RE_EFF_REQ_STAT.test(text) || RE_EFF_STAT.test(text);
}

function parseSystemPopup(raw) {
  // Kịch bản là văn bản 1 dòng/hiệu ứng nên không gõ Enter thật được — gõ
  // "\n" (gạch chéo ngược + chữ n) ngay trong nội dung để xuống dòng, hệ
  // thống tự đổi thành dòng mới thật khi hiển thị bảng thông báo.
  const idx = raw.indexOf("|");
  if (idx < 0) return { title: "Hệ Thống", text: raw.trim().replace(/\\n/g, "\n") };
  return { title: raw.slice(0, idx).trim() || "Hệ Thống", text: raw.slice(idx + 1).trim().replace(/\\n/g, "\n") };
}

function normalizeLoose(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/đ/g, "d").trim();
}

// Dò các lỗi "gõ gần đúng" phổ biến nhất cho 1 dòng "→ ..." không khớp cú
// pháp nào cả — trả về 1 câu gợi ý sửa cụ thể, hoặc "" nếu không đoán được.
// Chỉ dùng để LÀM RÕ cảnh báo có sẵn, không thay đổi kết quả sản xuất.
function suggestEffectFix(raw) {
  const norm = normalizeLoose(raw);
  if (/^he\s*thong\b/.test(norm)) {
    if (!raw.includes(":")) return ' Có phải bạn định viết "→ Hệ thống: <tiêu đề> | <nội dung>"? Thiếu dấu ":" sau "Hệ thống".';
    if (!raw.includes("|")) return ' Có phải bạn định viết "→ Hệ thống: <tiêu đề> | <nội dung>"? Thiếu dấu "|" ngăn cách tiêu đề và nội dung.';
    return '';
  }
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
 * Phân tích kịch bản "Hệ Thống" thành { meta, nodes, warnings }.
 * Không gọi AI, hoàn toàn xác định. Ném lỗi (có số dòng) nếu kịch bản
 * không có nổi 1 cảnh nào để sản xuất.
 */
export function parseSystemScript(scriptText, baseMeta = {}) {
  const lines = String(scriptText || "").replace(/\r\n/g, "\n").split("\n");
  const warnings = [];
  const statKeysSeen = new Map(); // key -> label gốc

  let title = "";
  let genre = "";
  let author = "";
  let gameOverTitle = "";
  let gameOverText = "";
  const vitalDeclarations = []; // [{ key, deathThreshold }] — từ "**Chỉ số sinh tử:**"
  const initialDeclarations = []; // [{ key, value }] — từ "**Chỉ số khởi đầu:**"

  const sceneOrder = []; // ["scene_1", "scene_2", ...] theo đúng thứ tự xuất hiện
  const nodesMap = {};
  let currentNode = null; // node đang được điền text/choices
  let currentChoice = null; // choice đang được điền hiệu ứng
  let introNode = null;

  function registerStat(label) {
    const key = slugifySystem(label);
    if (!statKeysSeen.has(key)) statKeysSeen.set(key, label.trim());
    return key;
  }

  function applyEffectLine(raw, lineNo) {
    let m;
    // "→ Hệ thống: ..." không cần đang ở trong lựa chọn — gắn vào cảnh hiện
    // tại (bật khi VÀO cảnh) nếu đứng ngoài lựa chọn, hoặc vào lựa chọn hiện
    // tại (bật NGAY SAU KHI chọn — dùng cho phạt/thưởng) nếu đứng trong lựa chọn.
    if ((m = raw.match(RE_EFF_SYSPOPUP))) {
      const popup = parseSystemPopup(m[1]);
      if (currentChoice) currentChoice.systemPopup = popup;
      else if (currentNode) currentNode.systemPopup = popup;
      else warnings.push(`Dòng ${lineNo}: có "→ Hệ thống: ..." nhưng chưa thuộc cảnh nào (bỏ qua).`);
      return;
    }
    const target = currentChoice; // các hiệu ứng còn lại luôn gắn vào lựa chọn hiện tại
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
          currentNode.choices.push({ text: "Tiếp tục", statRequirements: {}, statModifiers: {}, __explicitTarget: "ending_" + slugifySystem(mm[1]) });
          return;
        }
        if ((mm = raw.match(RE_EFF_GOTO_BARE))) {
          currentNode.choices.push({ text: "Tiếp tục", statRequirements: {}, statModifiers: {}, __explicitTarget: "ending_" + slugifySystem(mm[1]) });
          return;
        }
      }
      warnings.push(`Dòng ${lineNo}: có "→ ${raw}" nhưng chưa ở trong lựa chọn nào (bỏ qua).${suggestEffectFix(raw)}`);
      return;
    }
    if ((m = raw.match(RE_EFF_FLAG))) { {
      const f = m[1].trim();
      if (!target.grantFlags) target.grantFlags = [];
      if (!target.grantFlags.includes(f)) target.grantFlags.push(f);
      if (!target.grantFlag) target.grantFlag = f;
      return;
    } }
    if ((m = raw.match(RE_EFF_REQ_NOT_FLAG))) { target.requiresFlagAbsent = m[1].trim(); return; }
    if ((m = raw.match(RE_EFF_REQ_FLAG))) { target.requiresFlag = m[1].trim(); return; }
    if ((m = raw.match(RE_EFF_ITEM))) { target.grantItem = m[1].trim(); return; }
    if ((m = raw.match(RE_EFF_REQ_ITEM))) { target.requiresItem = m[1].trim(); return; }
    if ((m = raw.match(RE_EFF_GOTO))) { target.__explicitTarget = "scene_" + m[1]; return; }
    if ((m = raw.match(RE_EFF_ENDING))) { target.__explicitTarget = "ending_" + slugifySystem(m[1]); return; }
    if ((m = raw.match(RE_EFF_GOTO_BARE))) { target.__explicitTarget = "ending_" + slugifySystem(m[1]); return; }
    if ((m = raw.match(RE_EFF_REQ_STAT))) {
      const key = registerStat(m[1]);
      if (m[2] === "<=" || m[2] === "≤") {
        if (!target.statRequirementsMax) target.statRequirementsMax = {};
        target.statRequirementsMax[key] = Number(m[3]);
      } else {
        target.statRequirements[key] = Number(m[3]);
      }
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
      const parts = stripMetaNote(m[1]).split("|");
      gameOverTitle = (parts[0] || "").trim();
      gameOverText = (parts[1] || "").trim();
      continue;
    }
    if ((m = norm.match(RE_META_VITAL))) {
      for (const part of stripMetaNote(m[1]).split(",")) {
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
      for (const part of stripMetaNote(m[1]).split(",")) {
        const im = part.trim().match(RE_INITIAL_ITEM);
        if (!im || !im[1].trim()) { warnings.push(`Dòng ${lineNo}: "Chỉ số khởi đầu" cần đúng dạng "<Tên chỉ số> = <số>" (bỏ qua "${part.trim()}").`); continue; }
        const key = registerStat(im[1]);
        initialDeclarations.push({ key, value: Number(im[2]) });
      }
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
      const id = "ending_" + slugifySystem(m[1]);
      let endTitle = (m[2] || "").trim();
      const strayType = endTitle.match(/\s*\[([A-Z_]+)\]\s*$/);
      if (strayType) {
        endTitle = endTitle.slice(0, strayType.index).trim();
        warnings.push(`Dòng ${lineNo}: loại kết thúc "[${strayType[1]}]" không hợp lệ — chỉ nhận TRUE_END/GOOD_END/NORMAL_END/BAD_END, đã tự chuyển thành NORMAL_END.`);
      }
      const node = { id, speaker: endTitle, text: "", bgImage: "", isEnding: true, endingType: (m[3] || "NORMAL_END").toUpperCase(), choices: [] };
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

    if (!title && !currentNode) {
      title = norm;
      continue;
    }

    if (currentChoice) {
      pushParagraph(currentNode, line);
    } else if (currentNode) {
      pushParagraph(currentNode, line);
    }
  }

  if (!sceneOrder.length) {
    throw new Error("Không tìm thấy cảnh nào (cần ít nhất 1 dòng \"## CẢNH 1 — ...\"). Kiểm tra lại cú pháp kịch bản.");
  }

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
  const statsConfig = statKeys.map((key) => {
    const vital = vitalDeclarations.find((v) => v.key === key);
    const initial = initialDeclarations.find((v) => v.key === key);
    const base = { key, label: statKeysSeen.get(key), default: initial ? initial.value : 0, isVital: false };
    return vital ? { ...base, isVital: true, deathThreshold: vital.deathThreshold } : base;
  });
  // initialStats lấy từ statsConfig[].default (nguồn xác thực duy nhất — nếu
  // sau này người dùng sửa lại chỉ số trong "Cấu hình chung" bằng tay, giá
  // trị khởi đầu vẫn nhất quán với những gì hiện trên form).
  const initialStats = {};
  for (const sc of statsConfig) initialStats[sc.key] = sc.default;

  const repaired = normalizeAndRepair(nodesMap, statKeys, 0, { forceNonEmptyModifiers: false, statsConfig });
  const nodes = repaired.nodes;
  warnings.push(...repaired.warnings);

  const meta = {
    title: title || baseMeta.title || "Tựa Game Hệ Thống",
    author: author || baseMeta.author || "",
    genre: genre || baseMeta.genre || "fantasy",
    theme: baseMeta.theme || "aaa-dark",
    archetype: "none",
    player_name: baseMeta.player_name || "Ký Chủ",
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
