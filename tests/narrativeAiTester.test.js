import test from "node:test";
import assert from "node:assert/strict";
import { sampleRoutesForAiCheck, buildNarrativeCheckPrompt, runNarrativeAiChecks } from "../src/lib/gameStudio/narrativeAiTester.js";

function fakeRoute(id, endingType, sceneText = "Diễn biến cảnh.") {
  return {
    id,
    status: "ok",
    endingId: `ending_${id}`,
    endingLabel: `Kết thúc ${id}`,
    endingType,
    steps: [
      { sceneId: "scene_1", scene: { text: sceneText, speaker: "" }, choice: { text: "Lựa chọn A" } },
      { sceneId: "scene_2", scene: { text: "Diễn biến tiếp theo.", speaker: "NPC" }, choice: { text: "Lựa chọn B" } },
    ],
  };
}

test("buildNarrativeCheckPrompt đưa nguyên văn text từng cảnh + lựa chọn + kết thúc vào prompt", () => {
  const route = fakeRoute("route_1", "TRUE_END", "Nàng gọi bạn là ân nhân.");
  const prompt = buildNarrativeCheckPrompt(route, "Họ sống hạnh phúc mãi mãi.");
  assert.match(prompt, /Nàng gọi bạn là ân nhân\./);
  assert.match(prompt, /Lựa chọn A/);
  assert.match(prompt, /Lựa chọn B/);
  assert.match(prompt, /Họ sống hạnh phúc mãi mãi\./);
  assert.match(prompt, /Cảnh "ending_route_1" — Kết thúc route_1/);
});

test("sampleRoutesForAiCheck ưu tiên đa dạng loại kết thúc rồi mới bù thêm, không vượt max", () => {
  const routes = [fakeRoute("r1", "TRUE_END"), fakeRoute("r2", "TRUE_END"), fakeRoute("r3", "BAD_END"), fakeRoute("r4", "GOOD_END")];
  const picked = sampleRoutesForAiCheck(routes, [], { max: 2 });
  assert.equal(picked.length, 2);
  const types = new Set(picked.map((r) => r.endingType));
  assert.equal(types.size, 2, "2 tuyến đầu phải khác loại kết thúc nhau");
});

test("sampleRoutesForAiCheck không lấy trùng route đã có trong suspiciousRoutes", () => {
  const routes = [fakeRoute("r1", "TRUE_END")];
  const suspicious = [fakeRoute("r1", "TRUE_END")]; // cùng id, không được nhân đôi
  const picked = sampleRoutesForAiCheck(routes, suspicious, { max: 5 });
  const ids = picked.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("runNarrativeAiChecks không throw khi thiếu cấu hình AI — trả về finding low giải thích lý do", async () => {
  const routes = [fakeRoute("r1", "TRUE_END")];
  const seenProgress = [];
  const findings = await runNarrativeAiChecks(routes, { onProgress: (done, total) => seenProgress.push([done, total]) });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "low");
  assert.equal(findings[0].routeId, "r1");
  assert.match(findings[0].message, /Không kiểm tra được tuyến này bằng AI/);
  assert.deepEqual(seenProgress[0], [0, 1]);
});
