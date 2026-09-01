// Xưởng Game Pro — PRO 4: ĐỊNH DẠNG TRAO ĐỔI KỊCH BẢN CHÍNH THỨC
// "FICTIONWORLD PRO SCRIPT v1"
//
// Đây là format trao đổi chính thức giữa External AI (ChatGPT, Claude, Gemini,
// DeepSeek...) và FictionWorld. Format dạng văn bản tự nhiên, có từ khoá rõ ràng,
// không phụ thuộc Markdown, không dùng JSON, không lộ runtime internals,
// hỗ trợ parse offline 100% bằng JavaScript.
import { SCENE_ROLES } from "./blueprintModel.js";

export const SCRIPT_FORMAT_VERSION = "v1";
export const SCRIPT_HEADER_PREFIX = "FICTIONWORLD PRO SCRIPT";
export const SCRIPT_HEADER_V1 = "FICTIONWORLD PRO SCRIPT v1";

export const ROLE_KEYWORDS = {
  story: SCENE_ROLES.STORY,
  "kể chuyện": SCENE_ROLES.STORY,
  "ke chuyen": SCENE_ROLES.STORY,
  decision: SCENE_ROLES.DECISION,
  "lựa chọn": SCENE_ROLES.DECISION,
  "lua chon": SCENE_ROLES.DECISION,
  consequence: SCENE_ROLES.CONSEQUENCE,
  "hệ quả": SCENE_ROLES.CONSEQUENCE,
  "he qua": SCENE_ROLES.CONSEQUENCE,
  condition: SCENE_ROLES.CONDITION,
  "điều kiện": SCENE_ROLES.CONDITION,
  "dieu kien": SCENE_ROLES.CONDITION,
  danger: SCENE_ROLES.DANGER,
  "nguy hiểm": SCENE_ROLES.DANGER,
  "nguy hiem": SCENE_ROLES.DANGER,
  side: SCENE_ROLES.SIDE,
  "cảnh phụ": SCENE_ROLES.SIDE,
  "canh phu": SCENE_ROLES.SIDE,
  convergence: SCENE_ROLES.CONVERGENCE,
  "hội tụ": SCENE_ROLES.CONVERGENCE,
  "hoi tu": SCENE_ROLES.CONVERGENCE,
  ending: SCENE_ROLES.ENDING,
  "kết thúc": SCENE_ROLES.ENDING,
  "ket thuc": SCENE_ROLES.ENDING,
};

export const TONE_KEYWORDS = {
  neutral: "neutral",
  "bình thường": "neutral",
  "binh thuong": "neutral",
  normal: "neutral",
  normal_end: "neutral",
  good: "good",
  "tốt": "good",
  tot: "good",
  good_end: "good",
  true_end: "good",
  bad: "bad",
  "xấu": "bad",
  xau: "bad",
  bad_end: "bad",
  death: "death",
  "chết": "death",
  chet: "death",
  "tử vong": "death",
  "tu vong": "death",
};

export function normalizeRole(raw) {
  if (!raw) return SCENE_ROLES.STORY;
  const key = String(raw).trim().toLowerCase();
  return ROLE_KEYWORDS[key] || SCENE_ROLES.STORY;
}

export function normalizeTone(raw) {
  if (!raw) return "neutral";
  const key = String(raw).trim().toLowerCase();
  return TONE_KEYWORDS[key] || "neutral";
}

export const SCRIPT_FORMAT_DOCS = `==================================================
TÀI LIỆU ĐỊNH DẠNG: FICTIONWORLD PRO SCRIPT v1
==================================================

1. DÒNG ĐẦU TIÊN (Bắt buộc):
FICTIONWORLD PRO SCRIPT v1

2. KHAI BÁO TỔNG QUAN (Tuỳ chọn):
TẬP: Tên tập
CHỈ SỐ:
- Sinh tồn = 100 [sinh tồn, ngưỡng 0]
- Uy tín = 10
QUAN HỆ:
- Sủng ái Lệ Phi = 0 (NPC: Lệ Phi)
CỜ:
- Đã cứu Tiểu Lan
VẬT PHẨM:
- Ngọc bội

3. MÔ TẢ CẢNH (Scene):
CẢNH: Yến tiệc
LOẠI: Lựa chọn  (hoặc Kể chuyện / Hệ quả / Điều kiện / Nguy hiểm / Cảnh phụ / Hội tụ / Kết thúc)
NỘI DUNG:
Lệ Phi bất ngờ hỏi tội nhân vật chính trước quần thần.

LỰA CHỌN A:
Xin lỗi nhún nhường.
HỆ QUẢ:
- Uy tín +5
ĐẾN:
Cảnh Sau Yến Tiệc

LỰA CHỌN B:
Nói đỡ cho Tiểu Lan.
HỆ QUẢ:
- Đặt cờ: Đã cứu Tiểu Lan
ĐẾN:
Cảnh Tiểu Lan

LỰA CHỌN C:
Đưa tín vật làm chứng.
NẾU:
- Có vật phẩm: Ngọc bội
HỆ QUẢ:
- Mất vật phẩm: Ngọc bội
- Sủng ái Lệ Phi +8
ĐẾN:
Cảnh Sau Yến Tiệc

LỰA CHỌN D:
Phản bác Lệ Phi.
NẾU:
- Uy tín < 20
KẾT THÚC [Chết]:
Bị xử tử

NẾU:
- Uy tín >= 20
HỆ QUẢ:
- Uy tín -10
ĐẾN:
Cảnh Sau Yến Tiệc

4. MÔ TẢ KẾT THÚC (Endings - Tuỳ chọn nếu đã nêu ở ĐẾN/KẾT THÚC):
KẾT THÚC: Bị xử tử
LOẠI: Chết  (hoặc Bình thường / Tốt / Xấu)
NỘI DUNG:
Không đủ uy tín, bạn bị Lệ Phi khép tội khi quân và xử trảm ngay tại chỗ.

5. NGUYÊN TẮC:
- Tên cảnh trong "ĐẾN: <Tên cảnh>" phải khớp đúng tên sau "CẢNH: <Tên cảnh>".
- Mỗi lựa chọn có thể có nhiều nhánh NẾU: để rẽ nhánh điều kiện (Conditional Outcomes).
- Với cảnh chỉ kể chuyện (không có nhiều lựa chọn), chỉ cần ghi ĐẾN: <Tên cảnh kế tiếp>.
`;
