// "Xưởng Cung Đấu" — xưởng sản xuất game RIÊNG BIỆT, độc lập hoàn toàn với
// "Xưởng Offline" (scriptParser.js), "Xưởng Hệ Thống" (systemScriptParser.js)
// và "Xưởng NPC" (npcScriptParser.js) — không import, không chia sẻ cú pháp hay
// state với các file đó, sửa xưởng này không ảnh hưởng gì tới các xưởng kia.
//
// Dành cho thể loại "Cung Đấu" (hậu cung / đấu tranh trong cung điện): nhân vật
// chính là một phi tần phải dùng mưu kế, xây dựng Sủng Ái của Hoàng thượng,
// tranh đấu với các phi tần khác và phe phái. Khác biệt so với các xưởng khác:
// - "Sủng Ái" (chỉ số sinh tử) quyết định CẤP BẬC TẦN PHI: càng được sủng ái
//   càng thăng chức (Thường Tại → Quý Nhân → Tần → ... → Hoàng Hậu), thất
//   sủng thì giáng chức dần. Cấp bậc được tính TỰ ĐỘNG từ Sủng Ái, không cần
//   khai thêm chỉ số nào.
// - "Hảo cảm" với từng nhân vật (Hoàng hậu, Quý Phi, Thái Hậu...) dùng làm
//   thang đo phe phái — tăng/giảm qua lựa chọn, có thể dùng làm điều kiện
//   khoá lựa chọn (→ Cần hảo cảm X >= N).
// - "→ Chỉ dụ: ..." là bảng thông báo hoàng cung (sắc chỉ, điều tra, sự kiện).
//
// Dùng chung node schema với GamePlayer.jsx/rpgExport.js (không sửa engine nào
// về mặt LOGIC — chỉ thêm archetype "palace" để engine vẽ HUD cung đấu riêng:
// cấp bậc tần phi + bảng hậu cung), nên game sản xuất ra chơi/xuất bản bình
// thường như mọi game khác.
//
// ============================= CÚ PHÁP KỊCH BẢN =============================
//
// # <Tên game>
// **Thể loại:** ...                          (tuỳ chọn)
// **Tác giả:** ...                            (tuỳ chọn)
// **Chỉ số sinh tử:** <Tên chỉ số> < <ngưỡng>  (NÊN khai "Sủng Ái < 10" — chỉ
//                                               số này tụt bằng/dưới ngưỡng là
//                                               bị phế truất/Game Over. Có thể
//                                               khai nhiều, cách nhau dấu phẩy.
//                                               Chỉ số ĐẦU TIÊN được khai làm
//                                               "Sủng Ái" để tính cấp bậc tần phi.)
// **Chỉ số khởi đầu:** <Tên chỉ số> = <giá trị> (QUAN TRỌNG nếu có "Chỉ số sinh
//                                               tử": nhớ đặt cao hơn ngưỡng chết,
//                                               nếu không sẽ "chết" ngay đầu game.
//                                               Khai nhiều cách nhau dấu phẩy,
//                                               vd: "Sủng Ái = 30, Thế Lực = 5")
// **Thông báo thua cuộc:** <tiêu đề> | <nội dung> (tuỳ chọn — chữ hiện khi bị
//                                               phế truất, thay cho "GAME OVER"
//                                               mặc định. Vd: "Bị Phế Truất |
//                                               Thất sủng quá mức, nàng bị đày
//                                               vào lãnh cung, mất tất cả...")
// **Cấp bậc hậu cung:** <tên> / <tên> / ...   (tuỳ chọn — danh sách cấp bậc tần
//                                               phi, cách nhau dấu "/". Bỏ qua
//                                               thì dùng mặc định. Mỗi 15 điểm
//                                               Sủng Ái trên ngưỡng sống thăng 1
//                                               cấp, tự động.)
//
// ## GIỚI THIỆU
// <văn bản mở đầu>
//
// ## CẢNH 1 — <Tên cảnh, chỉ để tham khảo khi viết>
// (Nhãn cảnh không bắt buộc là số thuần — có thể đặt "CẢNH 1A", "CẢNH 2b"...
//  miễn khớp đúng với "→ Đến cảnh <nhãn>" ở dưới.)
// → Chỉ dụ: <tiêu đề> | <nội dung>            (tuỳ chọn — bảng thông báo hoàng
//                                               cung bật khi VÀO cảnh này. Tối
//                                               đa 1 dòng này cho mỗi cảnh.
//                                               Viết "→ Hệ thống: ..." cũng được,
//                                               hiểu tương tự.)
// <văn bản diễn biến của cảnh, có thể nhiều đoạn>
//
// **A — <lời lựa chọn>**
// → Sủng Ái +5                                 (cộng/trừ chỉ số)
// → Sủng Ái -10                                (thất sủng — có thể bị giáng chức)
// → Thế Lực +5                                 (thế lực / uy tín / ngờ vực... tên
//                                                chỉ số tự do, hệ thống tự nhận)
// → Hảo cảm Quý Phi +10                        (tăng/giảm hảo cảm 1 nhân vật —
//                                                phe phái trong cung)
// → Hảo cảm Thái Hậu -5
// → Cần hảo cảm Quý Phi >= 30                  (khoá lựa chọn nếu hảo cảm chưa đủ)
// → Cần hảo cảm Hoàng hậu <= 10                (khoá lựa chọn nếu hảo cảm QUÁ
//                                                CAO — mưu kế chỉ dùng được khi
//                                                đối thủ ít cảnh giác với mình)
// → Cần Sủng Ái >= 40                          (khoá lựa chọn nếu chỉ số chưa đủ)
// → Cờ: đã cài người vào Dưỡng Tâm Điện         (bật "cờ truyện" — 1 mưu kế đã
//                                                đặt xong)
// → Cần cờ: đã cài người vào Dưỡng Tâm Điện     (khoá nếu cờ CHƯA bật)
// → Cần không có cờ: đã cài người vào Dưỡng Tâm Điện (khoá nếu cờ ĐÃ bật)
// → Vật phẩm: Bùa hộ mệnh                      (nhặt vật phẩm — chứng cứ, bùa,
//                                                đan dược...)
// → Cần vật phẩm: Bùa hộ mệnh                  (khoá nếu chưa có vật phẩm)
// → Chỉ dụ: <tiêu đề> | <nội dung>             (tuỳ chọn — bảng thông báo bật
//                                                NGAY SAU KHI chọn, dùng công bố
//                                                kết quả mưu kế)
// → Đến cảnh 3                                 (chỉ định thẳng cảnh tiếp theo —
//                                               "## CẢNH 3" PHẢI có thật)
// → Kết thúc phong_hau                          (dẫn tới khối KẾT THÚC cùng nhãn
//                                               — viết tắt "→ Đến phong_hau"
//                                               cũng được, miễn KHÔNG PHẢI
//                                               "Đến cảnh N")
//
// **B — <lời lựa chọn khác>**
// ...
//
// ## CẢNH 2 — ...
// ...
//
// ## KẾT THÚC phong_hau — <Tên kết thúc> [TRUE_END]
// <văn bản kết thúc>
//
// Loại kết thúc trong [ ] CHỈ ĐƯỢC là TRUE_END / GOOD_END / NORMAL_END /
// BAD_END (mặc định NORMAL_END nếu bỏ qua). Không hỗ trợ rẽ nhánh điều kiện
// kiểu "→ Nếu có cờ X: Đến cảnh Y" trong CÙNG 1 lựa chọn — muốn rẽ nhánh theo
// điều kiện, viết 2 lựa chọn riêng, mỗi cái khoá bằng "Cần cờ:"/"Cần không có
// cờ:"/"Cần hảo cảm X >= N" đối lập nhau, mỗi cái tự có "→ Đến cảnh"/"→ Kết
// thúc" riêng.
//
// Các ký hiệu markdown (#, ##, **) chỉ để DỄ ĐỌC, KHÔNG bắt buộc. Mũi tên "→"
// có thể gõ thành "->" hoặc "=>" nếu bàn phím không gõ được ký tự →.
// =============================================================================

import { normalizeAndRepair } from "./postprocess.js";
import { PRESENTATION_ART } from "./rpgThemes.js";

export function slugifyPalace(label) {
  return String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "x";
}

const DEFAULT_PALACE_RANKS = ["Thường Tại", "Quý Nhân", "Tần", "Quý Tần", "Phi", "Quý Phi", "Hoàng Quý Phi", "Hoàng Hậu"];

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
const RE_META_GAMEOVER = /^Thông báo thua cuộc\s*:\s*(.+)$/i;
const RE_META_RANKS = /^Cấp bậc hậu cung\s*:\s*(.+)$/i;
const RE_INTRO = /^GIỚI THIỆU\s*$/i;
const RE_SCENE = /^CẢNH\s+(\S+?)(?:(?:\s*[—:.]|\s+-)\s*(.+))?$/i;
const RE_ENDING = /^KẾT THÚC\s+(\S+)\s*(?:[—\-:.]\s*(.+?))?\s*(?:\[(TRUE_END|GOOD_END|NORMAL_END|BAD_END)\])?\s*$/i;
const RE_CHOICE = /^([A-ZĐ])\s*[—\-:.)]\s*(.+?)\s*\**\s*$/;
const RE_EFFECT = /^(?:→|->|=>)\s*(.+)$/;

// "→ Chỉ dụ: ..." là bảng thông báo hoàng cung — lưu vào chính field systemPopup
// để engine chơi/xuất bản hiện modal mà KHÔNG cần sửa engine. "→ Hệ thống: ..."
// cũng được chấp nhận cho ai quen cú pháp Xưởng Hệ Thống.
const RE_EFF_EDICT = /^Chỉ dụ\s*:\s*(.+)$/i;
const RE_EFF_SYSPOPUP = /^Hệ thống\s*:\s*(.+)$/i;
// "→ Hảo cảm <tên> +N" — phải xét TRƯỚC "→ <chỉ số> +N" vì regex chỉ số cũng
// khớp "Hảo cảm X +N". "→ Cần hảo cảm X >= N" khoá khi hảo cảm CHƯA ĐỦ;
// "→ Cần hảo cảm X <= N" khoá khi hảo cảm QUÁ CAO (mưu kế cần đối thủ ít cảnh
// giác) — 2 loại lưu 2 field riêng (requiresNpcAffinity / requiresNpcAffinityMax)
// nên tương thích với mọi engine cũ.
const RE_EFF_AFFINITY = /^Hảo cảm\s+(.+?)\s*([+-]\d+)\s*$/i;
const RE_EFF_REQ_AFFINITY = /^Cần hảo cảm\s+(.+?)\s*(>=|≥|<=|≤)\s*(-?\d+)\s*$/i;
const RE_EFF_FLAG = /^Cờ:\s*(.+)$/i;
const RE_EFF_REQ_FLAG = /^Cần cờ:\s*(.+)$/i;
const RE_EFF_REQ_NOT_FLAG = /^Cần không có cờ:\s*(.+)$/i;
const RE_EFF_ITEM = /^(?:Nhận\s+)?Vật phẩm:\s*(.+)$/i;
const RE_EFF_REQ_ITEM = /^Cần vật phẩm:\s*(.+)$/i;
const RE_EFF_GOTO = /^Đến\s+cảnh\s+(\S+)$/i;
const RE_EFF_ENDING = /^(?:Đến\s+)?kết\s+thúc\s+(\S+)$/i;
const RE_EFF_GOTO_BARE = /^Đến\s+(?!cảnh\b)(\S+)$/i;
const RE_EFF_REQ_STAT = /^Cần\s+(.+?)\s*(>=|≥|<=|≤)\s*(-?\d+)$/i;
const RE_EFF_STAT = /^(.+?)\s*([+-]\d+)\s*$/;
const RE_VITAL_ITEM = /^(.+?)\s*(?:(<=|<)\s*(-?\d+))?$/;
const RE_INITIAL_ITEM = /^(.+?)\s*=\s*(-?\d+)$/;
const RE_EFFECT_DASH = /^-\s+(.+)$/;

// Bỏ chú thích "(...)" ở CUỐI dòng cấu hình — kịch bản mẫu hay viết chú thích
// hướng dẫn sau giá trị thật (vd "Chỉ số sinh tử: Sủng Ái < 10  (tuỳ chọn ...)").
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

function normalizeLoose(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/đ/g, "d").trim();
}

// Dò các lỗi "gõ gần đúng" phổ biến nhất cho 1 dòng "→ ..." không khớp cú pháp
// nào cả — trả về 1 câu gợi ý sửa cụ thể, hoặc "" nếu không đoán được.
function suggestEffectFix(raw) {
  const norm = normalizeLoose(raw);
  if (/^hao\s*cam\b/.test(norm) && !/[+-]\d+\s*$/.test(raw)) return ' Có phải bạn định viết "→ Hảo cảm <tên> +N" (hoặc "→ Hảo cảm <tên> -N")? Nhớ có dấu cộng/trừ trước số.';
  if (/^can\s+hao\s*cam\b/.test(norm) && !/>=|≥|<=|≤/.test(raw)) return ' Có phải bạn định viết "→ Cần hảo cảm <tên> >= <số>" (đủ hảo cảm) hoặc "→ Cần hảo cảm <tên> <= <số>" (hảo cảm thấp)? Thiếu dấu ">=" hoặc "<=".';
  if (/^chi\s*du\b/.test(norm)) {
    if (!raw.includes(":")) return ' Có phải bạn định viết "→ Chỉ dụ: <tiêu đề> | <nội dung>"? Thiếu dấu ":" sau "Chỉ dụ".';
    if (!raw.includes("|")) return ' Có phải bạn định viết "→ Chỉ dụ: <tiêu đề> | <nội dung>"? Thiếu dấu "|" ngăn cách tiêu đề và nội dung.';
    return '';
  }
  if (/^den\s+canh\b/.test(norm)) return ' Có phải bạn định viết "→ Đến cảnh <số/nhãn cảnh>"? Kiểm tra lại dấu tiếng Việt và khoảng trắng.';
  if (/^(den\s+)?ket\s*thuc\b/.test(norm)) return ' Có phải bạn định viết "→ Kết thúc <nhãn>"? Nhãn phải khớp Y HỆT với 1 khối "KẾT THÚC ..." có thật trong kịch bản.';
  if (/^can\s+co\b/.test(norm) && !raw.includes(":")) return ' Có phải bạn định viết "→ Cần cờ: <tên cờ>"? Thiếu dấu ":".';
  if (/^co\b/.test(norm) && !raw.includes(":")) return ' Có phải bạn định viết "→ Cờ: <tên cờ>"? Thiếu dấu ":".';
  if (/^vat\s*pham\b/.test(norm) && !raw.includes(":")) return ' Có phải bạn định viết "→ Vật phẩm: <tên vật phẩm>"? Thiếu dấu ":".';
  if (/^can\s+vat\s*pham\b/.test(norm) && !raw.includes(":")) return ' Có phải bạn định viết "→ Cần vật phẩm: <tên vật phẩm>"? Thiếu dấu ":".';
  if (/^can\b/.test(norm) && !/>=|≥/.test(raw)) return ' Có phải bạn định viết "→ Cần <tên chỉ số> >= <số>"? Thiếu dấu ">=".';
  if (/\d\s*$/.test(raw) && !/[+-]\d+\s*$/.test(raw)) return ' Có phải đây là hiệu ứng chỉ số? Nhớ thêm dấu "+" hoặc "-" trước số, vd "→ Sủng Ái +10".';
  return '';
}

// Nhiều người quen gõ "-" thay cho "→" (nhất là gõ trên điện thoại) — chỉ chấp
// nhận nếu phần sau dấu "-" khớp Y HỆT 1 hiệu ứng THẬT SỰ, để không hiểu nhầm
// 1 câu văn xuôi tình cờ có gạch đầu dòng.
function looksLikeEffect(text) {
  return RE_EFF_EDICT.test(text) || RE_EFF_SYSPOPUP.test(text)
    || RE_EFF_REQ_AFFINITY.test(text) || RE_EFF_AFFINITY.test(text)
    || RE_EFF_FLAG.test(text) || RE_EFF_REQ_FLAG.test(text) || RE_EFF_REQ_NOT_FLAG.test(text)
    || RE_EFF_ITEM.test(text) || RE_EFF_REQ_ITEM.test(text) || RE_EFF_GOTO.test(text)
    || RE_EFF_ENDING.test(text) || RE_EFF_GOTO_BARE.test(text) || RE_EFF_REQ_STAT.test(text) || RE_EFF_STAT.test(text);
}

function parsePalacePopup(raw) {
  // Kịch bản là văn bản 1 dòng/hiệu ứng nên không gõ Enter thật được — gõ
  // "\n" (gạch chéo ngược + chữ n) ngay trong nội dung để xuống dòng, hệ
  // thống tự đổi thành dòng mới thật khi hiển thị bảng thông báo.
  const idx = raw.indexOf("|");
  if (idx < 0) return { title: "Chỉ Dụ", text: raw.trim().replace(/\\n/g, "\n") };
  return { title: raw.slice(0, idx).trim() || "Chỉ Dụ", text: raw.slice(idx + 1).trim().replace(/\\n/g, "\n") };
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
 * Cấp bậc tần phi được tính TỰ ĐỘNG từ Sủng Ái:
 * - Mốc gốc được HIỆU CHỈNH để tại Sủng Ái khởi đầu (startFavor) nhân vật
 *   đứng đúng cấp bậc khởi đầu (startRankIndex, mặc định 0 = cấp thấp nhất).
 *   Trước đây mốc gốc = deathThreshold + 1, nên kịch bản khai "Sủng Ái = 30,
 *   Sủng Ái < 10" (bước 15) khởi đầu đã là "Quý Nhân" thay vì "Thường Tại" —
 *   người chơi không thay đổi được cấp vì cấp là kết quả tính toán.
 * - Cứ mỗi stepFavor điểm (mặc định 15) trên mốc gốc, thăng thêm 1 cấp.
 *   Ngược lại, thất sủng xuống dưới mốc đó thì giáng chức — rất hợp "thất
 *   sủng thì tuột dốc" của cung đấu, và KHÔNG cần khai thêm chỉ số nào.
 */
export function palaceBase(palace) {
  const step = palace?.stepFavor || 15;
  const startRankIndex = palace?.startRankIndex ?? 0;
  const startFavor = (palace?.startFavor !== undefined && palace?.startFavor !== null)
    ? palace.startFavor
    : ((palace?.deathThreshold ?? 0) + 1);
  return startFavor - startRankIndex * step;
}

export function palaceRankIndex(favor, palace) {
  const base = palaceBase(palace);
  const step = palace?.stepFavor || 15;
  const len = (palace?.ranks || []).length || 1;
  return Math.max(0, Math.min(len - 1, Math.floor((favor - base) / step)));
}

export function palaceProgressToNext(favor, palace, rankIdx) {
  const base = palaceBase(palace);
  const step = palace?.stepFavor || 15;
  const into = favor - base - rankIdx * step;
  return Math.max(0, Math.min(100, (into / step) * 100));
}

/**
 * Phân tích kịch bản "Cung Đấu" thành { meta, nodes, warnings }.
 * Không gọi AI, hoàn toàn xác định. Ném lỗi (có số dòng) nếu kịch bản
 * không có nổi 1 cảnh nào để sản xuất.
 */
export function parsePalaceScript(scriptText, baseMeta = {}) {
  const lines = String(scriptText || "").replace(/\r\n/g, "\n").split("\n");
  const warnings = [];
  const statKeysSeen = new Map(); // key -> label gốc

  let title = "";
  let genre = "";
  let author = "";
  let gameOverTitle = "";
  let gameOverText = "";
  const vitalDeclarations = []; // [{ key, deathThreshold }] — "**Chỉ số sinh tử:**"
  const initialDeclarations = []; // [{ key, value }] — "**Chỉ số khởi đầu:**"
  let ranksDeclared = []; // "**Cấp bậc hậu cung:** ..."

  const sceneOrder = [];
  const nodesMap = {};
  let currentNode = null;
  let currentChoice = null;
  let introNode = null;

  function registerStat(label) {
    const key = slugifyPalace(label);
    if (!statKeysSeen.has(key)) statKeysSeen.set(key, label.trim());
    return key;
  }

  function applyEffectLine(raw, lineNo) {
    let m;
    // "→ Chỉ dụ: ..." / "→ Hệ thống: ..." — gắn vào cảnh hiện tại (bật khi VÀO
    // cảnh) nếu đứng ngoài lựa chọn, hoặc vào lựa chọn hiện tại (bật NGAY SAU
    // KHI chọn) nếu đứng trong lựa chọn.
    if ((m = raw.match(RE_EFF_EDICT)) || (m = raw.match(RE_EFF_SYSPOPUP))) {
      const popup = parsePalacePopup(m[1]);
      if (currentChoice) currentChoice.systemPopup = popup;
      else if (currentNode) currentNode.systemPopup = popup;
      else warnings.push(`Dòng ${lineNo}: có "→ Chỉ dụ: ..." nhưng chưa thuộc cảnh nào (bỏ qua).`);
      return;
    }
    const target = currentChoice;
    if (!target) {
      // Cảnh không có lựa chọn A/B nào, chỉ có 1 dòng "→ Đến cảnh N"/"→ Kết
      // thúc X" ngay dưới lời dẫn — coi đây là cảnh chuyển tiếp thẳng, tự tạo
      // 1 lựa chọn "Tiếp tục" ẩn danh.
      if (currentNode && !currentNode.isEnding) {
        let mm;
        if ((mm = raw.match(RE_EFF_GOTO))) {
          currentNode.choices.push({ text: "Tiếp tục", statRequirements: {}, statModifiers: {}, __explicitTarget: "scene_" + mm[1] });
          return;
        }
        if ((mm = raw.match(RE_EFF_ENDING))) {
          currentNode.choices.push({ text: "Tiếp tục", statRequirements: {}, statModifiers: {}, __explicitTarget: "ending_" + slugifyPalace(mm[1]) });
          return;
        }
        if ((mm = raw.match(RE_EFF_GOTO_BARE))) {
          currentNode.choices.push({ text: "Tiếp tục", statRequirements: {}, statModifiers: {}, __explicitTarget: "ending_" + slugifyPalace(mm[1]) });
          return;
        }
      }
      warnings.push(`Dòng ${lineNo}: có "→ ${raw}" nhưng chưa ở trong lựa chọn nào (bỏ qua).${suggestEffectFix(raw)}`);
      return;
    }
    if ((m = raw.match(RE_EFF_REQ_AFFINITY))) {
      const name = m[1].trim();
      const op = m[2];
      const num = Number(m[3]);
      if (op === "<=" || op === "≤") {
        if (!target.requiresNpcAffinityMax) target.requiresNpcAffinityMax = {};
        target.requiresNpcAffinityMax[name] = num;
      } else {
        if (!target.requiresNpcAffinity) target.requiresNpcAffinity = {};
        target.requiresNpcAffinity[name] = num;
      }
      return;
    }
    if ((m = raw.match(RE_EFF_AFFINITY))) {
      const name = m[1].trim();
      if (!target.npcAffinity) target.npcAffinity = {};
      target.npcAffinity[name] = (target.npcAffinity[name] || 0) + Number(m[2]);
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
    if ((m = raw.match(RE_EFF_ENDING))) { target.__explicitTarget = "ending_" + slugifyPalace(m[1]); return; }
    if ((m = raw.match(RE_EFF_GOTO_BARE))) { target.__explicitTarget = "ending_" + slugifyPalace(m[1]); return; }
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
    if ((m = norm.match(RE_META_RANKS))) {
      ranksDeclared = stripMetaNote(m[1]).split("/").map((r) => r.trim()).filter(Boolean);
      if (!ranksDeclared.length) warnings.push(`Dòng ${lineNo}: "Cấp bậc hậu cung" cần ít nhất 1 cấp (bỏ qua, dùng mặc định).`);
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
      const id = "ending_" + slugifyPalace(m[1]);
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

  const entrySceneId = sceneOrder[0];
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
        c.targetNodeId = !introNode && c.__explicitTarget === entrySceneId ? "start_node" : c.__explicitTarget;
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
  const initialStats = {};
  for (const sc of statsConfig) initialStats[sc.key] = sc.default;

  // Xác định "Sủng Ái" = chỉ số sinh tử ĐẦU TIÊN được khai — cấp bậc tần phi
  // được tính từ nó. Nếu kịch bản không khai chỉ số sinh tử nào, cảnh báo và
  // rơi về chỉ số đầu tiên (vẫn chơi được, chỉ là không có ngưỡng phế truất).
  let favorKey = vitalDeclarations.length ? vitalDeclarations[0].key : null;
  let favorLabel = favorKey ? (statKeysSeen.get(favorKey) || "Sủng Ái") : "Sủng Ái";
  let favorDeathThreshold = vitalDeclarations.length ? vitalDeclarations[0].deathThreshold : 0;
  if (!favorKey) {
    favorKey = statKeys[0] || "sung_ai";
    favorLabel = statKeysSeen.get(favorKey) || "Sủng Ái";
    warnings.push(
      `Chưa khai "Chỉ số sinh tử" — cấp bậc tần phi được tính từ "Sủng Ái", nên khai "**Chỉ số sinh tử:** Sủng Ái < 10" (kèm "**Chỉ số khởi đầu:** Sủng Ái = 30") để có ngưỡng phế truất và thang cấp bậc chuẩn. Đã tạm lấy "${favorLabel}" làm thang Sủng Ái.`
    );
  }

  const repaired = normalizeAndRepair(nodesMap, statKeys, 0, { forceNonEmptyModifiers: false, statsConfig });
  const nodes = repaired.nodes;
  warnings.push(...repaired.warnings);

  const meta = {
    title: title || baseMeta.title || "Cung Đấu Mới",
    author: author || baseMeta.author || "",
    genre: genre || baseMeta.genre || "ngon-tinh",
    theme: baseMeta.theme || "imperial-gold",
    presentation: "palace",
    archetype: "palace",
    player_name: baseMeta.player_name || "Tân Tú",
    playerAvatar: baseMeta.playerAvatar || PRESENTATION_ART.palace,
    statsConfig,
    initialStats,
    gameOverTitle: gameOverTitle || baseMeta.gameOverTitle || "",
    gameOverText: gameOverText || baseMeta.gameOverText || "",
    palace: {
      ranks: ranksDeclared.length ? ranksDeclared : (baseMeta.palace?.ranks?.length ? baseMeta.palace.ranks : DEFAULT_PALACE_RANKS),
      favorStat: favorKey,
      favorLabel,
      deathThreshold: favorDeathThreshold,
      stepFavor: baseMeta.palace?.stepFavor || 15,
      startRankIndex: baseMeta.palace?.startRankIndex ?? 0,
      startFavor: initialStats[favorKey] || 0,
    },
    litrpg: baseMeta.litrpg || { ranks: ["Luyện Khí", "Trúc Cơ", "Kim Đan", "Nguyên Anh"], expPerRank: 100 },
    mystery: baseMeta.mystery || { inventorySlots: 4 },
  };

  return { meta, nodes, warnings };
}
