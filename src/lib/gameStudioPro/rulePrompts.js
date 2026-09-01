// Xưởng Game Pro — PRO 3: prompt + schema cho AI phân tích 1 câu luật (điều
// kiện HOẶC hệ quả) tự nhiên thành các "clause" thô. Cùng khuôn mẫu
// blueprintPrompts.js: schema chỉ là chỉ dẫn nhúng prompt (KHÔNG ép được ở
// model) — ruleParser.js phải tự thẩm định/khoan dung kết quả, KHÔNG bao giờ
// tin thẳng field AI trả về.
//
// AI KHÔNG được tự bịa entity mới cho những gì đã có trong registry — prompt
// LUÔN liệt kê registry hiện có để AI ưu tiên khớp tên đã tồn tại (mục 10-11
// "entity resolution"), nhưng việc RESOLVE thật sự vẫn do ruleParser.js làm
// bằng entityRegistry.resolveEntity() — AI chỉ được tin một phần.
import { ENTITY_KINDS, listEntities } from "./entityRegistry.js";

function registryBlock(registry) {
  const stats = listEntities(registry, ENTITY_KINDS.STAT).map((e) => `  - "${e.displayName}" (chỉ số)`);
  const rels = listEntities(registry, ENTITY_KINDS.RELATIONSHIP).map((e) => `  - "${e.displayName}" (quan hệ/thiện cảm với ${e.npc})`);
  const flags = listEntities(registry, ENTITY_KINDS.FLAG).map((e) => `  - "${e.displayName}" (cờ)`);
  const items = listEntities(registry, ENTITY_KINDS.ITEM).map((e) => `  - "${e.displayName}" (vật phẩm)`);
  const all = [...stats, ...rels, ...flags, ...items];
  return all.length ? all.join("\n") : "  (chưa có chỉ số/cờ/vật phẩm/quan hệ nào được khai báo)";
}

export const RULE_CLAUSE_SCHEMA = {
  clauses: [
    {
      kind: "stat_compare|flag_present|flag_absent|item_present|stat_change|grant_flag|grant_item|remove_item|unsupported",
      entity: "string — tên chỉ số/cờ/vật phẩm/quan hệ, ưu tiên khớp đúng tên đã có trong danh sách nếu có",
      operator: ">=|<=|>|<|== (CHỈ dùng khi kind=stat_compare)",
      value: "number (CHỈ dùng khi kind=stat_compare)",
      amount: "number, có thể âm (CHỈ dùng khi kind=stat_change)",
      reason: "string — lý do CHỈ khi kind=unsupported (vd: so sánh 2 chỉ số với nhau, có bộ đếm thời gian, công thức phức tạp...)",
    },
  ],
};

function sharedHeader(registry) {
  return `Bạn là bộ phân tích LUẬT cho một game visual-novel tiếng Việt. Nhiệm vụ: tách 1 câu người dùng viết bằng lời thành các "clause" (mệnh đề) máy đọc được — KHÔNG được tự suy diễn gì thêm ngoài đúng nghĩa câu gốc.

# DANH SÁCH CHỈ SỐ/CỜ/VẬT PHẨM/QUAN HỆ ĐÃ CÓ TRONG GAME (ưu tiên dùng đúng tên này nếu câu nói tới)
${registryBlock(registry)}

# QUY TẮC BẮT BUỘC
- Mỗi mệnh đề nối bằng "và"/"," là 1 clause riêng.
- KHÔNG được tự đổi "hoặc" thành "và" — nếu câu có ý "HOẶC" giữa 2 điều kiện, trả về 1 clause DUY NHẤT kind="unsupported" với reason mô tả đúng ý OR đó (không tách nhỏ ra).
- Nếu câu so sánh 2 chỉ số với nhau (vd "Uy tín cao hơn Sủng ái"), trả kind="unsupported", reason="so sánh giữa hai chỉ số chưa được hỗ trợ".
- Nếu câu có bộ đếm thời gian thực (timer), công thức số học phức tạp, hoặc yếu tố ngẫu nhiên (random), trả kind="unsupported" với reason mô tả đúng lý do.
- entity PHẢI là tên chỉ số/cờ/vật phẩm/quan hệ thuần tuý (không kèm số, không kèm từ khoá toán tử).
- KHÔNG thêm clause nào không có trong câu gốc. KHÔNG bịa số liệu.`;
}

export function buildConditionParsePrompt(registry, text) {
  return `${sharedHeader(registry)}

# NHIỆM VỤ: phân tích ĐIỀU KIỆN sau thành các clause dạng "stat_compare" / "flag_present" / "flag_absent" / "item_present" / "unsupported":

"${text}"`;
}

export function buildEffectParsePrompt(registry, text) {
  return `${sharedHeader(registry)}

# NHIỆM VỤ: phân tích HỆ QUẢ sau thành các clause dạng "stat_change" / "grant_flag" / "grant_item" / "remove_item" / "unsupported":

"${text}"`;
}
