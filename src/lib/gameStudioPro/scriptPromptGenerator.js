// Xưởng Game Pro — PRO 4: PROMPT GENERATOR FOR EXTERNAL AI
//
// Tạo prompt trung lập cho AI bên ngoài (ChatGPT, Claude, Gemini, DeepSeek...)
// để AI viết kịch bản đúng chuẩn FICTIONWORLD PRO SCRIPT v1 mà không cần học runtime syntax.
import { SCRIPT_HEADER_V1, SCRIPT_FORMAT_DOCS } from "./scriptFormat.js";
import { compactGamePlanSummary } from "./plannerPrompts.js";
import { ensureRegistry, listEntities, ENTITY_KINDS } from "./entityRegistry.js";

export function generateExternalAiPrompt({
  mode = "full_episode", // "full_episode" | "continue_from_scene" | "rewrite_scene" | "repair_script"
  gamePlan = null,
  episode = null,
  blueprint = null,
  selectedSceneId = null,
  customInstructions = "",
  validationIssues = [],
  originalScript = "",
} = {}) {
  // Mode 4: Sửa lỗi kịch bản (Repair Mode - Requirement 23)
  if (mode === "repair_script") {
    return generateRepairPrompt({ validationIssues, originalScript, customInstructions });
  }

  const registry = ensureRegistry(blueprint);
  const statsList = listEntities(registry, ENTITY_KINDS.STAT).map((s) => s.displayName);
  const relsList = listEntities(registry, ENTITY_KINDS.RELATIONSHIP).map((r) => `${r.displayName} (NPC: ${r.npc})`);
  const flagsList = listEntities(registry, ENTITY_KINDS.FLAG).map((f) => f.displayName);
  const itemsList = listEntities(registry, ENTITY_KINDS.ITEM).map((i) => i.displayName);

  const contextBlocks = [];

  if (gamePlan) {
    contextBlocks.push(`=== 1. TỔNG QUAN GAME ===\n${compactGamePlanSummary(gamePlan)}`);
  }

  if (episode) {
    const epDetails = [
      `Tên tập: "${episode.title}"`,
      episode.summary ? `Tóm tắt: ${episode.summary}` : "",
      episode.goal ? `Mục tiêu: ${episode.goal}` : "",
      episode.majorConflict ? `Xung đột chính: ${episode.majorConflict}` : "",
      episode.climax ? `Cao trào: ${episode.climax}` : "",
      episode.possibleFailure ? `Nguy cơ thất bại: ${episode.possibleFailure}` : "",
      episode.keyCharacters?.length ? `Nhân vật: ${episode.keyCharacters.join(", ")}` : "",
    ].filter(Boolean).join("\n");
    contextBlocks.push(`=== 2. KẾ HOẠCH TẬP HIỆN TẠI ===\n${epDetails}`);
  }

  const existingEntities = [
    statsList.length ? `Chỉ số có sẵn: ${statsList.join(", ")}` : "",
    relsList.length ? `Quan hệ có sẵn: ${relsList.join(", ")}` : "",
    flagsList.length ? `Cờ có sẵn: ${flagsList.join(", ")}` : "",
    itemsList.length ? `Vật phẩm có sẵn: ${itemsList.join(", ")}` : "",
  ].filter(Boolean).join("\n");

  if (existingEntities) {
    contextBlocks.push(`=== 3. DANH MỤC THỰC THỂ CÓ SẴN ===\n${existingEntities}`);
  }

  // Mode 2: Viết tiếp từ cảnh
  if (mode === "continue_from_scene" && blueprint && selectedSceneId) {
    const scene = blueprint.scenes.find((s) => s.id === selectedSceneId);
    if (scene) {
      contextBlocks.push(`=== 4. CẢNH BẮT ĐẦU VIẾT TIẾP ===\nCẢNH: ${scene.title}\nLOẠI: ${scene.role}\nNỘI DUNG:\n${scene.intent || ""}`);
    }
  }

  // Mode 3: Viết lại cảnh
  if (mode === "rewrite_scene" && blueprint && selectedSceneId) {
    const scene = blueprint.scenes.find((s) => s.id === selectedSceneId);
    if (scene) {
      contextBlocks.push(`=== 4. CẢNH CẦN VIẾT LẠI ===\nCẢNH: ${scene.title}\nLOẠI: ${scene.role}\nNỘI DUNG HIỆN TẠI:\n${scene.intent || ""}`);
    }
  }

  let taskDescription = "";
  if (mode === "full_episode") {
    taskDescription = `Hãy VIẾT TOÀN BỘ KỊCH BẢN CHO TẬP TRÊN theo đúng định dạng ${SCRIPT_HEADER_V1}.
Bao gồm cảnh mở đầu, các phân cảnh phân nhánh (decision 2-4 lựa chọn), các cảnh hệ quả, cảnh phụ (nếu có), điểm hội tụ và các kết thúc khả dĩ (thành công / thất bại).`;
  } else if (mode === "continue_from_scene") {
    taskDescription = `Hãy VIẾT TIẾP KỊCH BẢN từ cảnh được chỉ định ở trên cho đến khi hoàn tất tập này, theo đúng định dạng ${SCRIPT_HEADER_V1}.`;
  } else if (mode === "rewrite_scene") {
    taskDescription = `Hãy THIẾT KẾ LẠI CẢNH trên (và các nhánh con liên quan nếu cần), theo đúng định dạng ${SCRIPT_HEADER_V1}.`;
  }

  if (customInstructions?.trim()) {
    taskDescription += `\n\nYÊU CẦU ĐẶC BIỆT CỦA TÁC GIẢ:\n${customInstructions.trim()}`;
  }

  return `Bạn là biên kịch game tương tác chuyên nghiệp. Hãy soạn thảo kịch bản phân nhánh chất lượng cao cho FictionWorld.

${contextBlocks.join("\n\n")}

=== YÊU CẦU CÔNG VIỆC ===
${taskDescription}

=== QUY TẮC ĐỊNH DẠNG BẮT BUỘC (RẤT QUAN TRỌNG) ===
1. Dòng đầu tiên PHẢI LÀ:
${SCRIPT_HEADER_V1}

2. KHÔNG viết JSON. Viết theo cấu trúc từ khoá văn bản rõ ràng:
- TẬP: <Tên tập>
- CHỈ SỐ: (danh sách: - Tên = Số khởi đầu [sinh tồn nếu là chỉ số sinh tử])
- CỜ: (danh sách cờ sự kiện)
- VẬT PHẨM: (danh sách vật phẩm)
- QUAN HỆ: (danh sách thiện cảm NPC)
- CẢNH: <Tên cảnh>
- LOẠI: <Kể chuyện | Lựa chọn | Hệ quả | Điều kiện | Nguy hiểm | Cảnh phụ | Hội tụ | Kết thúc>
- NỘI DUNG: <Mô tả văn cảnh, diễn biến, tình huống>
- LỰA CHỌN A: <Lời lựa chọn>
  - NẾU: <Điều kiện, ví dụ: - Uy tín >= 20, - Có cờ: Đã cứu Tiểu Lan, - Có vật phẩm: Ngọc bội>
  - HỆ QUẢ: <Hệ quả, ví dụ: - Uy tín +5, - Đặt cờ: Đã cứu Tiểu Lan, - Nhận vật phẩm: Ngọc bội>
  - ĐẾN: <Tên cảnh đích - PHẢI khớp đúng tên cảnh sau CẢNH:>
  - KẾT THÚC: <Tên kết thúc - nếu lựa chọn dẫn tới kết thúc>
- Rẽ nhánh điều kiện cùng một lựa chọn (Conditional Outcomes):
  LỰA CHỌN D: Phản bác
  NẾU:
  - Uy tín < 20
  KẾT THÚC [Chết]: Bị xử tử
  NẾU:
  - Uy tín >= 20
  HỆ QUẢ:
  - Uy tín -10
  ĐẾN: Cảnh Sau Yến Tiệc

3. CÁC HẠN CHẾ CỦA ENGINE:
- Điều kiện và biến động chỉ số dùng số nguyên (>=, <=, >, <, ==, +N, -N).
- Mỗi lựa chọn chỉ yêu cầu tối đa 1 cờ và 1 vật phẩm.
- Không dùng điều kiện "HOẶC" phức tạp trong 1 lựa chọn đơn (hãy tách thành 2 lựa chọn hoặc 2 nhánh NẾU).
- Mọi đích trong "ĐẾN: <Tên>" PHẢI có một khối "CẢNH: <Tên>" tương ứng trong bài viết.
- Trả về TOÀN BỘ kịch bản bắt đầu bằng "${SCRIPT_HEADER_V1}". Không bọc giải thích dông dài bên ngoài.

---
VÍ DỤ MẪU CHUẨN:
${SCRIPT_FORMAT_DOCS}`;
}

export function generateRepairPrompt({ validationIssues = [], originalScript = "", customInstructions = "" } = {}) {
  const issueList = validationIssues
    .map((iss, idx) => `${idx + 1}. ${iss.line ? `Dòng ${iss.line}: ` : ""}${iss.message}`)
    .join("\n");

  return `Bạn là biên kịch game tương tác cho FictionWorld. Dưới đây là một kịch bản theo chuẩn ${SCRIPT_HEADER_V1} đang có ${validationIssues.length} lỗi/cảnh báo cần được sửa chữa.

=== DANH SÁCH LỖI CẦN SỬA ===
${issueList || "(Không có danh sách lỗi cụ thể)"}

${customInstructions?.trim() ? `=== GHI CHÚ BỔ SUNG ===\n${customInstructions.trim()}\n` : ""}
=== KỊCH BẢN GỐC HIỆN TẠI ===
${originalScript || "(Trống)"}

=== NHIỆM VỤ ===
Hãy SỬA CHÍNH XÁC tất cả các lỗi trên (khớp đúng tên cảnh đích, điều chỉnh điều kiện/hệ quả, loại bỏ tên trùng lặp...) và trả lại TOÀN BỘ KỊCH BẢN ĐÃ SỬA HOÀN CHỈNH, bắt đầu bằng dòng "${SCRIPT_HEADER_V1}". Không viết thêm lời dẫn bên ngoài kịch bản.`;
}
