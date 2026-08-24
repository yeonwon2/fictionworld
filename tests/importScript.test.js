import test from "node:test";
import assert from "node:assert/strict";
import { importExistingScript } from "../src/lib/gameScriptProject/importScript.js";
import { compileNarrativePlan } from "../src/lib/gameScriptProject/narrativeCompiler.js";

const SOURCE = `Tàn Nguyệt Hồng Trần
Thể loại: Cung Đấu, Bách hợp
HỒI 1: TRĂNG NON

CẢNH 1 — Nhập cung
Ta — Tạ Uyển Dung — bước qua cửa cấm.

A — Giữ im lặng
→ Cờ: đã nhập cung
→ Đến cảnh 2

B — Quan sát
→ Thế Lực +5
→ Đến cảnh 2

CẢNH 2 — Phán quyết
Nàng đối diện lựa chọn cuối.

A — Công bố sự thật
→ Cần cờ: đã nhập cung
→ Kết thúc phuong_hoang

KẾT THÚC phuong_hoang — Phượng Hoàng Tái Sinh [TRUE_END]
Sự thật được sáng tỏ.`;

test("imports loose TXT into editable plan scenes without changing source prose", () => {
  const result = importExistingScript(SOURCE);
  assert.equal(result.title, "Tàn Nguyệt Hồng Trần");
  assert.equal(result.genre, "Cung Đấu, Bách hợp");
  assert.equal(result.player_name, "Tạ Uyển Dung");
  assert.equal(result.scenes.length, 2);
  assert.equal(result.endings.length, 1);
  assert.equal(result.endings[0].name, "phuong_hoang");
  assert.equal(result.endings[0].type, "TRUE_END");
  assert.deepEqual(result.scenes[0].choices[0], { text: "Giữ im lặng", effect: "→ Cờ: đã nhập cung", target: "cảnh 2" });
  assert.match(result.scenes[0].description, /Tạ Uyển Dung/);
  assert.match(result.scenes[0].rawScript, /^# Tàn Nguyệt Hồng Trần/m);
  assert.match(result.scenes[1].rawScript, /KẾT THÚC phuong_hoang/);

  const report = compileNarrativePlan({
    project: { title: result.title, player_name: result.player_name, main_quest: result.main_quest },
    meta: { endings: result.endings },
    scenes: result.scenes,
  });
  assert.equal(report.summary.errors, 0);
  assert.equal(report.issues.some((issue) => issue.code === "ORPHAN_FLAG"), false);
});

test("rejects pasted text that has no scene headings", () => {
  assert.throws(() => importExistingScript("Một truyện tuyến tính chưa có cảnh."), /Không tìm thấy cảnh nào/);
});
