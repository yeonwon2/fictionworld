import test from "node:test";
import assert from "node:assert/strict";
import { buildGameTestReport, formatReproPath, getNarrativeCheckCandidates } from "../src/lib/gameStudio/gameTestReport.js";

// Đồ thị nhỏ có 1 lựa chọn trỏ tới cảnh KHÔNG TỒN TẠI ("scene_99") — đúng loại
// lỗi "chuyển sai cảnh" cần bắt được ở mức Critical, giống lỗi thật đã tìm ra
// ở kịch bản "DƯỚI BÓNG PHÙ DUNG" (nhãn kết thúc gõ sai → auto-route "Thiếu cảnh").
function brokenLinkGraph() {
  return {
    start_node: { id: "start_node", text: "Giới thiệu", choices: [{ text: "Bắt đầu", targetNodeId: "scene_1" }] },
    scene_1: {
      id: "scene_1",
      text: "Cảnh 1",
      choices: [
        { text: "Đi đúng", targetNodeId: "scene_2" },
        { text: "Đi sai (lỗi cố ý)", targetNodeId: "scene_99" },
      ],
    },
    scene_2: { id: "scene_2", text: "Cảnh 2", isEnding: true, endingType: "NORMAL_END", choices: [] },
  };
}

test("buildGameTestReport bắt lỗi chuyển sai cảnh ở mức Critical và tính coverage", () => {
  const gameData = { nodes: brokenLinkGraph(), meta: { statsConfig: [] } };
  const report = buildGameTestReport(gameData, { runsPerPersona: 20 });

  assert.equal(report.error, undefined);
  assert.ok(report.summary.critical >= 1, "phải có ít nhất 1 finding Critical cho link vỡ");
  const brokenFinding = report.findings.find((f) => /nhưng không tồn tại trong kịch bản/.test(f.message));
  assert.ok(brokenFinding, "phải có finding mô tả đúng lựa chọn trỏ sai cảnh");
  assert.equal(brokenFinding.severity, "critical");

  assert.ok(report.coverage.scenesTotal >= 3);
  assert.ok(report.coverage.scenePercent >= 0 && report.coverage.scenePercent <= 100);
  assert.ok(report.endings.total >= 2, "scene_2 (NORMAL_END) + broken_link_end đều là kết thúc thật");
});

test("formatReproPath dựng đúng dạng START → scene[lựa chọn]", () => {
  const path = formatReproPath([
    { sceneId: "scene_1", choiceIndex: 1 },
    { sceneId: "scene_5", choiceIndex: 3 },
  ]);
  assert.equal(path, "START → scene_1[2] → scene_5[4]");
});

test("getNarrativeCheckCandidates trả về tuyến có sẵn text để đưa vào Tầng 3", () => {
  const gameData = { nodes: brokenLinkGraph(), meta: { statsConfig: [] } };
  const report = buildGameTestReport(gameData, { runsPerPersona: 20 });
  const candidates = getNarrativeCheckCandidates(report, { max: 3 });
  assert.ok(candidates.length >= 1);
  assert.ok(candidates[0].steps.length >= 1);
  assert.ok(candidates[0].steps[0].scene.text);
});
