import test from "node:test";
import assert from "node:assert/strict";
import { derivePlanningConstraints, assessBlueprintScale } from "../src/lib/gameStudioPro/planningConstraints.js";
import { buildEpisodeBlueprintPrompt } from "../src/lib/gameStudioPro/blueprintPrompts.js";
import { buildEpisodePlanPrompt } from "../src/lib/gameStudioPro/plannerPrompts.js";
import { normalizeAIBlueprintResponse, applyNormalizedBlueprint } from "../src/lib/gameStudioPro/blueprintAI.js";
import { MAX_SCENES_PER_EPISODE } from "../src/lib/gameStudioPro/blueprintModel.js";
import { validateSceneBlueprint } from "../src/lib/gameStudioPro/blueprintValidator.js";

const makeRaw = (count) => ({ scenes: Array.from({ length: count }, (_, i) => ({ ref: `s${i + 1}`, title: `Cảnh ${i + 1}`, role: i % 2 ? "decision" : "story", intent: "Ý đồ ngắn", isStart: i === 0, choices: [{ text: "Tiếp", target: i === count - 1 ? "good" : `s${i + 2}`, targetKind: i === count - 1 ? "ending" : "scene" }] })), endings: [{ ref: "good", title: "Kết tốt", tone: "good" }] });

test("quy mô và mật độ lựa chọn được suy ra từ ý định", () => {
  const value = derivePlanningConstraints("Tầm 30 cảnh, mỗi cảnh 4 lựa chọn, thời hạn 6 tháng");
  assert.equal(value.targetSceneCount, 30); assert.equal(value.minimumSceneCount, 27); assert.equal(value.desiredChoicesPerDecision, 4);
});
test("ràng buộc đi tới prompt và không còn ép gộp về 24", () => {
  const planningConstraints = derivePlanningConstraints("Khoảng 30 cảnh, mỗi cảnh 4 lựa chọn");
  const episode = { title: "Tập 1", stages: [], planningConstraints };
  assert.match(buildEpisodePlanPrompt({}, episode), /30 cảnh/);
  const prompt = buildEpisodeBlueprintPrompt({}, episode);
  assert.match(prompt, /Mục tiêu: khoảng 30 cảnh/); assert.match(prompt, /4 lựa chọn/); assert.doesNotMatch(prompt, /GỘP các sự kiện|Tối đa 24/);
});
test("8 trên mục tiêu 30 bị chặn, khoảng 30 hợp lệ", () => {
  const constraints = derivePlanningConstraints("khoảng 30 cảnh");
  assert.equal(assessBlueprintScale({ scenes: makeRaw(8).scenes }, constraints).underGenerated, true);
  assert.equal(assessBlueprintScale({ scenes: makeRaw(30).scenes }, constraints).withinTolerance, true);
});
test("normalization giữ 30 cảnh và áp trần cấu trúc thật", () => {
  assert.equal(normalizeAIBlueprintResponse(makeRaw(30), "ep").scenes.length, 30);
  assert.equal(normalizeAIBlueprintResponse(makeRaw(75), "ep").scenes.length, MAX_SCENES_PER_EPISODE);
});
test("áp dụng preview chỉ biến đổi dữ liệu cục bộ", () => {
  const normalized = normalizeAIBlueprintResponse(makeRaw(30), "ep");
  const result = applyNormalizedBlueprint({ episodeId: "ep", startSceneId: null, scenes: [], endings: [] }, normalized, { replaceIds: new Set(), replaceStartScene: true });
  assert.equal(result.scenes.length, 30);
});
test("phần tiếp tục chỉ thêm và giữ nguyên các cảnh đã có", () => {
  const initial = normalizeAIBlueprintResponse(makeRaw(8), "ep");
  const blueprint = applyNormalizedBlueprint({ episodeId: "ep", startSceneId: null, scenes: [], endings: [] }, initial, { replaceIds: new Set(), replaceStartScene: true });
  const ids = blueprint.scenes.map((scene) => scene.id);
  const addition = normalizeAIBlueprintResponse({ scenes: [{ ref: "new1", title: "Bổ sung", role: "side", intent: "Nhánh mới", choices: [{ target: ids[0], targetKind: "scene" }] }], endings: [] }, "ep", { rejectSceneRefs: new Set(ids), rejectEndingRefs: new Set(blueprint.endings.map((ending) => ending.id)) });
  const continued = applyNormalizedBlueprint(blueprint, addition, { replaceIds: new Set(), replaceStartScene: false });
  assert.deepEqual(continued.scenes.slice(0, ids.length).map((scene) => scene.id), ids);
  assert.equal(continued.scenes.length, 9);
});
test("smoke topology 30 cảnh, 4 lựa chọn, nhiều kết thúc không có đích hỏng hoặc cảnh mồ côi", () => {
  const raw = makeRaw(30);
  raw.endings = ["good", "bad", "death"].map((ref) => ({ ref, title: ref, tone: ref === "good" ? "good" : ref === "death" ? "death" : "bad" }));
  raw.scenes.forEach((scene, index) => {
    const next = index === 29 ? ["good", "bad", "death", "good"] : [`s${index + 2}`, `s${index + 2}`, `s${index + 2}`, `s${index + 2}`];
    scene.role = "decision";
    scene.choices = next.map((target, choice) => ({ text: `Lựa chọn ${choice + 1}`, target, targetKind: index === 29 ? "ending" : "scene", gateIntent: choice === 3 ? "Thiện cảm nữ chính phải đủ" : "" }));
  });
  const normalized = normalizeAIBlueprintResponse(raw, "smoke");
  const blueprint = applyNormalizedBlueprint({ episodeId: "smoke", startSceneId: null, scenes: [], endings: [] }, normalized, { replaceIds: new Set(), replaceStartScene: true });
  const validation = validateSceneBlueprint(blueprint);
  assert.equal(blueprint.scenes.length, 30);
  assert.equal(blueprint.scenes.every((scene) => scene.choices.length === 4), true);
  assert.deepEqual(validation.errors, []);
});
