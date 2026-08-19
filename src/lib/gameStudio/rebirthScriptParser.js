// "Xưởng Trọng Sinh Làm Giàu" — xưởng sản xuất game RIÊNG BIỆT, độc lập hoàn toàn
// với các xưởng khác (scriptParser/systemScriptParser/npcScriptParser/
// palaceScriptParser) — không import, không chia sẻ cú pháp hay state với
// chúng, sửa xưởng này không ảnh hưởng gì tới các xưởng kia.
//
// Dành cho thể loại "Trọng Sinh Làm Giàu" (nhân vật chính trọng sinh về quá
// khứ, dùng hiểu biết tương lai để làm ăn phát tài: cổ phiếu, đất đai, kinh
// doanh...). Khác biệt so với các xưởng khác:
// - "Vốn" (chỉ số sinh tử) quyết định NIÊN ĐẠI phát triển: cứ chạm mốc vốn,
//   đế chế bước sang một niên đại mới (1995 mồ hôi vốn → 1999 cổ phiếu vàng →
//   ... → 2011 huyền thoại) và thu nhập thêm 1 khoản tiền MỘT LẦN — "tiền đẻ
//   ra tiền". Niên đại được tính TỰ ĐỘNG từ Vốn, không cần khai thêm chỉ số.
// - "→ Cơ hội: ..." là bảng thông báo (tin nội bộ, dự án, phi vụ...) — hiểu
//   tương tự "→ Chỉ dụ:" của cung đấu, bật khi VÀO cảnh hoặc NGAY SAU KHI chọn.
// - Các hiệu ứng cờ/vật phẩm dùng cho: hợp đồng ký được, bí quyết kinh doanh,
//   giấy tờ chứng cứ, mối làm ăn bí mật...
//
// Dùng chung node schema với GamePlayer.jsx/rpgExport.js (không sửa engine nào
// về mặt LOGIC — chỉ thêm archetype "rebirth" để engine vẽ HUD "Bảng Gia Sản":
// Vốn + niên đại + thu nhập thời đại), nên game sản xuất ra chơi/xuất bản bình
// thường như mọi game khác.
//
// ============================= CÚ PHÁP KỊCH BẢN =============================
//
// # <Tên game>
// **Thể loại:** ...                          (tuỳ chọn)
// **Tác giả:** ...                            (tuỳ chọn)
// **Chỉ số sinh tử:** <Tên chỉ số> < <ngưỡng>  (NÊN khai "Vốn < 5" — chỉ số này
//                                               tụt bằng/dưới ngưỡng là PHÁ SẢN/
//                                               Game Over. Có thể khai nhiều,
//                                               cách nhau dấu phẩy. Chỉ số ĐẦU
//                                               TIÊN được khai làm "Vốn" để tính
//                                               niên đại làm giàu.)
// **Chỉ số khởi đầu:** <Tên chỉ số> = <giá trị> (QUAN TRỌNG nếu có "Chỉ số sinh
//                                               tử": nhớ đặt cao hơn ngưỡng chết,
//                                               vd "Vốn = 50". Khai nhiều cách
//                                               nhau dấu phẩy.)
// **Thông báo thua cuộc:** <tiêu đề> | <nội dung> (tuỳ chọn — chữ hiện khi phá
//                                               sản, thay cho "GAME OVER" mặc
//                                               định. Vd: "Phá Sản | Vốn cạn,
//                                               nhà xưởng bị siết nợ...")
// **Thang thời đại:** <nhãn> = <mốc vốn> (+thu) | ...  (tuỳ chọn — các mốc vốn
//                                               đổi niên đại, cách nhau "|".
//                                               Bỏ qua thì dùng mặc định. Vd:
//                                               "1999 · Cổ phiếu vàng = 60 (+5)")
//
// ## GIỚI THIỆU
// <văn bản mở đầu>
//
// ## CẢNH 1 — <Tên cảnh, chỉ để tham khảo khi viết>
// (Nhãn cảnh không bắt buộc là số thuần — có thể đặt "CẢNH 1A", "CẢNH 2b"...
//  miễn khớp đúng với "→ Đến cảnh <nhãn>" ở dưới.)
// → Cơ hội: <tiêu đề> | <nội dung>          (tuỳ chọn — bảng thông báo bật khi
//                                               VÀO cảnh này. Viết "→ Chỉ dụ:"
//                                               hoặc "→ Hệ thống:" cũng được,
//                                               hiểu tương tự.)
// <văn bản diễn biến của cảnh, có thể nhiều đoạn>
//
// **A — <lời lựa chọn>**
// → Vốn +10                                  (cộng/trừ chỉ số — tiền lời/lỗ)
// → Vốn -20                                  (lỗ vốn — có thể sát ngưỡng phá sản)
// → Danh vọng +5                             (tên chỉ số tự do, hệ thống tự nhận)
// → Cơ hội Quảng Châu +10                    (hảo cảm/lòng tin 1 nhân vật hoặc
//                                               đối tác — dùng như "mối làm ăn")
// → Cần cơ hội Quảng Châu >= 30              (khoá lựa chọn nếu lòng tin chưa đủ)
// → Cần Vốn >= 40                            (khoá lựa chọn nếu vốn chưa đủ)
// → Cờ: ký được hợp đồng đồng hồ               (bật "cờ truyện" — 1 mối làm ăn đã
//                                               chốt xong)
// → Cần cờ: ký được hợp đồng đồng hồ           (khoá nếu cờ CHƯA bật)
// → Cần không có cờ: ký được hợp đồng đồng hồ   (khoá nếu cờ ĐÃ bật)
// → Vật phẩm: Giấy tờ đất nền Quận 3          (nhặt vật phẩm — hợp đồng, giấy tờ,
//                                               hàng hoá...)
// → Cần vật phẩm: Giấy tờ đất nền Quận 3      (khoá nếu chưa có vật phẩm)
// → Cơ hội: <tiêu đề> | <nội dung>           (tuỳ chọn — bảng thông báo bật NGAY
//                                               SAU KHI chọn, dùng công bố kết quả
//                                               phi vụ)
// → Đến cảnh 3                               (chỉ định thẳng cảnh tiếp theo)
// → Kết thúc de_che                     (dẫn tới khối KẾT THÚC cùng nhãn)
//
// **B — <lời lựa chọn khác>**
// ...
//
// ## CẢNH 2 — ...
// ...
//
// ## KẾT THÚC de_che — <Tên kết thúc> [TRUE_END]
// <văn bản kết thúc>
//
// Loại kết thúc trong [ ] CHỈ ĐƯỢC là TRUE_END / GOOD_END / NORMAL_END /
// BAD_END (mặc định NORMAL_END nếu bỏ qua). Không hỗ trợ rẽ nhánh điều kiện
// kiểu "→ Nếu có cờ X: Đến cảnh Y" trong CÙNG 1 lựa chọn — muốn rẽ nhánh theo
// điều kiện, viết 2 lựa chọn riêng, mỗi cái khoá bằng "Cần cờ:"/"Cần không có
// cờ:"/"Cần <chỉ số> >= N" đối lập nhau, mỗi cái tự có "→ Đến cảnh"/"→ Kết
// thúc" riêng.
//
// Các ký hiệu markdown (#, ##, **) chỉ để DỄ ĐỌC, KHÔNG bắt buộc. Mũi tên "→"
// có thể gõ thành "->" hoặc "=>" nếu bàn phím không gõ được ký tự →.
// =============================================================================

import { normalizeAndRepair } from "./postprocess";
import { PRESENTATION_ART } from "./rpgThemes";

export function slugifyRebirth(label) {
  return String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "x";
}

const DEFAULT_ERAS = [{ at: 0, label: "1995 · Vốn mồ hôi", bonus: 0 }, { at: 60, label: "1999 · Cổ phiếu vàng", bonus: 5 }, { at: 200, label: "2003 · Đất vàng", bonus: 10 }, { at: 600, label: "2007 · Đế chế", bonus: 20 }, { at: 1500, label: "2011 · Huyền thoại", bonus: 35 }];

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
const RE_META_ERAS = /^Thang thời đại\s*:\s*(.+)$/i;
const RE_ERA_ITEM = /^(.+?)\s*=\s*(-?\d+)\s*(?:\(?\+?(\d+)\)?)?\s*$/;
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
// "→ Cơ hội: <tiêu đề> | <nội dung>" — tin nội bộ/dự án/phi vụ trong game trọng
// sinh làm giàu, xử lý Y HỆT "Chỉ dụ"/"Hệ thống": hiện modal mà không cần sửa engine.
const RE_EFF_OPPORTUNITY = /^Cơ hội\s*:\s*(.+)$/i;
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
// hướng dẫn sau giá trị thật (vd "Chỉ số sinh tử: Vốn < 5  (tuỳ chọn — ...)").
// Không chạm nhóm "(+N)"/"(<số>)" toàn số — đó là dữ liệu thật (mốc thang thời đại).
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
  if (/\d\s*$/.test(raw) && !/[+-]\d+\s*$/.test(raw)) return ' Có phải đây là hiệu ứng chỉ số? Nhớ thêm dấu "+" hoặc "-" trước số, vd "→ Vốn +10".';
  return '';
}

// Nhiều người quen gõ "-" thay cho "→" (nhất là gõ trên điện thoại) — chỉ chấp
// nhận nếu phần sau dấu "-" khớp Y HỆT 1 hiệu ứng THẬT SỰ, để không hiểu nhầm
// 1 câu văn xuôi tình cờ có gạch đầu dòng.
function looksLikeEffect(text) {
  return RE_EFF_EDICT.test(text) || RE_EFF_SYSPOPUP.test(text) || RE_EFF_OPPORTUNITY.test(text)
    || RE_EFF_REQ_AFFINITY.test(text) || RE_EFF_AFFINITY.test(text)
    || RE_EFF_FLAG.test(text) || RE_EFF_REQ_FLAG.test(text) || RE_EFF_REQ_NOT_FLAG.test(text)
    || RE_EFF_ITEM.test(text) || RE_EFF_REQ_ITEM.test(text) || RE_EFF_GOTO.test(text)
    || RE_EFF_ENDING.test(text) || RE_EFF_GOTO_BARE.test(text) || RE_EFF_REQ_STAT.test(text) || RE_EFF_STAT.test(text);
}

function parseRebirthPopup(raw) {
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
 * Niên đại làm giàu được tính TỰ ĐỘNG từ Vốn: niên đại hiện tại là mốc vốn cao
 * nhất mà Vốn đạt được (1995 mồ hôi vốn → 1999 cổ phiếu vàng → ...). Mỗi khi
 * chạm mốc mới, đế chế thu thêm 1 khoản tiền MỘT LẦN (bonus) — "tiền đẻ ra
 * tiền". Chỉ là hàm thuần, KHÔNG tự cộng tiền: việc cộng bonus do engine
 * (GamePlayer/rpgExport) làm đúng MỘT LẦN mỗi mốc, thông qua state eraReached.
 */
// Sắp xếp TĂNG DẦN theo "at" trước khi dùng — 3 hàm dưới đây cùng gọi qua đây
// nên luôn đồng nhất 1 cách đánh index, kể cả khi rebirth.eras lưu trong
// gameData bị lệch thứ tự (vd chỉnh tay qua UI mà chưa Sản Xuất Game lại).
function sortedEras(rebirth) {
  const eras = (rebirth?.eras?.length ? rebirth.eras : DEFAULT_ERAS);
  return [...eras].sort((a, b) => (a.at || 0) - (b.at || 0));
}

export function rebirthEraIndex(money, rebirth) {
  const eras = sortedEras(rebirth);
  let idx = 0;
  for (let i = 0; i < eras.length; i++) if (money >= (eras[i].at || 0)) idx = i;
  return idx;
}

export function rebirthEraProgress(money, rebirth, eraIdx) {
  const eras = sortedEras(rebirth);
  const cur = eras[eraIdx] || eras[0] || { at: 0 };
  const next = eras[eraIdx + 1];
  if (!next) return 100;
  const span = next.at - cur.at;
  if (span <= 0) return 100;
  return Math.max(0, Math.min(100, ((money - cur.at) / span) * 100));
}

// Tổng thu nhập của các mốc (reachedIdx, eraIdx] chưa được nhận — engine gọi
// để cộng MỘT LẦN khi niên đại thăng hạng rồi cập nhật reachedIdx.
export function rebirthUnclaimedBonus(eraIdx, reachedIdx, rebirth) {
  const eras = sortedEras(rebirth);
  let bonus = 0;
  const start = Math.min(eraIdx, Math.max(0, reachedIdx + 1));
  for (let i = start; i <= eraIdx && i < eras.length; i++) bonus += (eras[i].bonus || 0);
  return bonus;
}

/**
 * Phân tích kịch bản "Trọng Sinh Làm Giàu" thành { meta, nodes, warnings }.
 * Không gọi AI, hoàn toàn xác định. Ném lỗi (có số dòng) nếu kịch bản
 * không có nổi 1 cảnh nào để sản xuất.
 */
export function parseRebirthScript(scriptText, baseMeta = {}) {
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
  let erasDeclared = []; // "**Thang thời đại:** ..."

  const sceneOrder = [];
  const nodesMap = {};
  let currentNode = null;
  let currentChoice = null;
  let introNode = null;

  function registerStat(label) {
    const key = slugifyRebirth(label);
    if (!statKeysSeen.has(key)) statKeysSeen.set(key, label.trim());
    return key;
  }

  function applyEffectLine(raw, lineNo) {
    let m;
    // "→ Chỉ dụ: ..." / "→ Hệ thống: ..." — gắn vào cảnh hiện tại (bật khi VÀO
    // cảnh) nếu đứng ngoài lựa chọn, hoặc vào lựa chọn hiện tại (bật NGAY SAU
    // KHI chọn) nếu đứng trong lựa chọn.
    if ((m = raw.match(RE_EFF_EDICT)) || (m = raw.match(RE_EFF_SYSPOPUP)) || (m = raw.match(RE_EFF_OPPORTUNITY))) {
      const popup = parseRebirthPopup(m[1]);
      if (currentChoice) currentChoice.systemPopup = popup;
      else if (currentNode) currentNode.systemPopup = popup;
      else warnings.push(`Dòng ${lineNo}: có "→ Cơ hội: ..." nhưng chưa thuộc cảnh nào (bỏ qua).`);
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
          currentNode.choices.push({ text: "Tiếp tục", statRequirements: {}, statModifiers: {}, __explicitTarget: "ending_" + slugifyRebirth(mm[1]) });
          return;
        }
        if ((mm = raw.match(RE_EFF_GOTO_BARE))) {
          currentNode.choices.push({ text: "Tiếp tục", statRequirements: {}, statModifiers: {}, __explicitTarget: "ending_" + slugifyRebirth(mm[1]) });
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
    if ((m = raw.match(RE_EFF_ENDING))) { target.__explicitTarget = "ending_" + slugifyRebirth(m[1]); return; }
    if ((m = raw.match(RE_EFF_GOTO_BARE))) { target.__explicitTarget = "ending_" + slugifyRebirth(m[1]); return; }
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
    if ((m = norm.match(RE_META_ERAS))) {
      erasDeclared = [];
      for (const part of stripMetaNote(m[1]).split("|")) {
        const em = part.trim().match(RE_ERA_ITEM);
        if (!em || !em[1].trim()) {
          warnings.push(`Dòng ${lineNo}: "Thang thời đại" cần đúng dạng "<Nhãn> = <mốc vốn> (+thu nhập)" cách nhau "|" (bỏ qua "${part.trim()}").`);
          continue;
        }
        erasDeclared.push({ at: Number(em[2]), label: em[1].trim(), bonus: em[3] !== undefined ? Number(em[3]) : 0 });
      }
      if (!erasDeclared.length) warnings.push(`Dòng ${lineNo}: "Thang thời đại" cần ít nhất 1 mốc (bỏ qua, dùng mặc định).`);
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
      const id = "ending_" + slugifyRebirth(m[1]);
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
  const initialStats = {};
  for (const sc of statsConfig) initialStats[sc.key] = sc.default;

  // Xác định "Vốn" = chỉ số sinh tử ĐẦU TIÊN được khai — niên đại làm giàu được
  // tính từ nó. Nếu kịch bản không khai chỉ số sinh tử nào, cảnh báo và rơi về
  // chỉ số đầu tiên (vẫn chơi được, chỉ là không có ngưỡng phá sản).
  let moneyKey = vitalDeclarations.length ? vitalDeclarations[0].key : null;
  let moneyLabel = moneyKey ? (statKeysSeen.get(moneyKey) || "Vốn") : "Vốn";
  let moneyDeathThreshold = vitalDeclarations.length ? vitalDeclarations[0].deathThreshold : 0;
  if (!moneyKey) {
    moneyKey = statKeys[0] || "von";
    moneyLabel = statKeysSeen.get(moneyKey) || "Vốn";
    warnings.push(
      `Chưa khai "Chỉ số sinh tử" — niên đại làm giàu được tính từ "Vốn", nên khai "**Chỉ số sinh tử:** Vốn < 5" (kèm "**Chỉ số khởi đầu:** Vốn = 50") để có ngưỡng phá sản và thang niên đại chuẩn. Đã tạm lấy "${moneyLabel}" làm thang Vốn.`
    );
  }
  // rebirthEraIndex() giả định eras đã sắp xếp TĂNG DẦN theo "at" — sắp xếp
  // lại ở đây (nguồn duy nhất tạo ra mảng eras) để không lệ thuộc người viết
  // kịch bản/chỉnh sửa UI phải tự giữ đúng thứ tự.
  const eras = [...(erasDeclared.length ? erasDeclared : (baseMeta.rebirth?.eras?.length ? baseMeta.rebirth.eras : DEFAULT_ERAS))]
    .sort((a, b) => (a.at || 0) - (b.at || 0));
  const repaired = normalizeAndRepair(nodesMap, statKeys, 0, { forceNonEmptyModifiers: false, statsConfig });
  const nodes = repaired.nodes;
  warnings.push(...repaired.warnings);

  const meta = {
    title: title || baseMeta.title || "Trọng Sinh Làm Giàu Mới",
    author: author || baseMeta.author || "",
    genre: genre || baseMeta.genre || "doanh-nhan",
    theme: baseMeta.theme || "steam-brass",
    presentation: "rebirth",
    archetype: "rebirth",
    player_name: baseMeta.player_name || "Minh Triết",
    playerAvatar: baseMeta.playerAvatar || PRESENTATION_ART.rebirth,
    statsConfig,
    initialStats,
    gameOverTitle: gameOverTitle || baseMeta.gameOverTitle || "",
    gameOverText: gameOverText || baseMeta.gameOverText || "",
    rebirth: {
      moneyStat: moneyKey,
      moneyLabel,
      deathThreshold: moneyDeathThreshold,
      eras,
      bonusStat: moneyKey,
    },
    litrpg: baseMeta.litrpg || { ranks: ["Luyện Khí", "Trúc Cơ", "Kim Đan", "Nguyên Anh"], expPerRank: 100 },
    mystery: baseMeta.mystery || { inventorySlots: 4 },
  };

  return { meta, nodes, warnings };
}
