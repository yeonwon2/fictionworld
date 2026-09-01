// Xưởng Game Pro — PRO 0 data model.
//
// Đây là "tài liệu Pro" (Pro Model): nguồn dữ liệu gốc mà Xưởng Game Pro
// đọc/ghi. Nó KHÔNG phải là dữ liệu game mà GamePlayer/Export hiểu — dữ liệu
// đó (`{meta, nodes}` kiểu Xưởng Game cũ) được sinh ra từ tài liệu này qua
// `compileProGame()` (proCompiler.js). Tài liệu Pro được lưu trong
// `games.meta.pro` của cùng bảng `games` mà Xưởng Game cũ dùng — không có
// bảng/migration riêng cho Pro.
import { newEmptyGlobalState } from "./globalStateModel.js";

export const PRO_SCHEMA_VERSION = 1;

// Khung PRO 0 chỉ hỗ trợ: 1 cảnh mở đầu → 2 lựa chọn → 2 kết thúc. Đây là ví
// dụ tối giản để xác minh toàn bộ pipeline (tạo/lưu/tải lại/sửa/biên
// dịch/chơi/xuất bản). Các trường mở rộng bên dưới (episodes, mechanics,
// storyBlueprint, sceneIntents, externalImport) CHƯA được dùng ở bước này —
// chỉ giữ chỗ cho các tính năng Pro sau này. `globalState` là ngoại lệ: PRO 5
// dùng ngay trường này làm registry/campaign state canonical (xem
// globalStateModel.js) — newEmptyGlobalState() ở đây tương thích ngược hoàn
// toàn với `{}` cũ (ensureGlobalState() vẫn tự chuẩn hoá mọi giá trị cũ).
export function newEmptyProGame() {
  return {
    schemaVersion: PRO_SCHEMA_VERSION,
    builder: "pro",
    title: "Game Pro Mới",
    startScene: {
      text: "Câu chuyện bắt đầu... Hãy chỉnh sửa cảnh này trong Xưởng Game Pro.",
    },
    choices: [
      { text: "Lựa chọn A", endingId: "ending_a" },
      { text: "Lựa chọn B", endingId: "ending_b" },
    ],
    endings: [
      { id: "ending_a", title: "Kết A", text: "Đây là kết thúc A." },
      { id: "ending_b", title: "Kết B", text: "Đây là kết thúc B." },
    ],
    episodes: [],
    mechanics: {},
    storyBlueprint: null,
    sceneIntents: {},
    externalImport: null,
    globalState: newEmptyGlobalState(),
  };
}
