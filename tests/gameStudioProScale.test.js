import test from "node:test";
import assert from "node:assert/strict";
import { derivePlanningConstraints, assessBlueprintScale } from "../src/lib/gameStudioPro/planningConstraints.js";
import { buildEpisodeBlueprintPrompt, buildBlueprintContinuationPrompt } from "../src/lib/gameStudioPro/blueprintPrompts.js";
import { buildEpisodePlanPrompt } from "../src/lib/gameStudioPro/plannerPrompts.js";
import { normalizeAIBlueprintResponse, applyNormalizedBlueprint, BLUEPRINT_AI_MAX_OUTPUT_TOKENS } from "../src/lib/gameStudioPro/blueprintAI.js";
import { MAX_SCENES_PER_EPISODE } from "../src/lib/gameStudioPro/blueprintModel.js";
import { validateSceneBlueprint } from "../src/lib/gameStudioPro/blueprintValidator.js";
import { compileEpisodeBlueprint } from "../src/lib/gameStudioPro/proCompiler.js";

const makeRaw = (count) => ({ scenes: Array.from({ length: count }, (_, i) => ({ ref: `s${i + 1}`, title: `Cảnh ${i + 1}`, role: i % 2 ? "decision" : "story", intent: "Ý đồ ngắn", isStart: i === 0, choices: [{ text: "Tiếp", target: i === count - 1 ? "good" : `s${i + 2}`, targetKind: i === count - 1 ? "ending" : "scene" }] })), endings: [{ ref: "good", title: "Kết tốt", tone: "good" }] });

test("quy mô và mật độ lựa chọn được suy ra từ ý định", () => {
  const value = derivePlanningConstraints("Tầm 30 cảnh, mỗi cảnh 4 lựa chọn, thời hạn 6 tháng");
  assert.equal(value.targetSceneCount, 30); assert.equal(value.minimumSceneCount, 27); assert.equal(value.desiredChoicesPerDecision, 4);
});
test("blueprint lớn có ngân sách JSON đủ cho 30 cảnh x 4 lựa chọn", () => {
  assert.equal(BLUEPRINT_AI_MAX_OUTPUT_TOKENS, 32768);
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
test("yêu cầu chính xác 30 cảnh không chấp nhận bản 27 cảnh", () => {
  const constraints = derivePlanningConstraints("30 cảnh");
  assert.equal(constraints.precision, "exact");
  assert.equal(assessBlueprintScale({ scenes: makeRaw(27).scenes }, constraints).underGenerated, true);
  assert.equal(assessBlueprintScale({ scenes: makeRaw(30).scenes }, constraints).underGenerated, false);
});
test("30 STORY tuyến tính không thỏa mục tiêu 30 cảnh chơi", () => {
  const constraints = derivePlanningConstraints("khoảng 30 cảnh, mỗi cảnh 4 lựa chọn");
  const linear = makeRaw(30); linear.scenes.forEach((scene) => { scene.role = "story"; });
  const status = assessBlueprintScale(linear, constraints);
  assert.equal(status.meaningfulSceneCount, 0); assert.equal(status.underGenerated, true);
});
test("continuation giữ nguyên ràng buộc bốn lựa chọn", () => {
  const episode = { title: "Tập", planningConstraints: derivePlanningConstraints("30 cảnh, mỗi cảnh 4 lựa chọn"), stages: [] };
  assert.match(buildBlueprintContinuationPrompt({}, episode, { scenes: [], endings: [] }, 10), /ĐÚNG 4 lựa chọn/);
});
test("validator chặn 1/3 và nhận đúng 4 lựa chọn có hệ quả riêng", () => {
  const constraints = derivePlanningConstraints("30 cảnh, mỗi cảnh 4 lựa chọn");
  const registry = { stats: [{ id: "aff", kind: "relationship", displayName: "Thiện cảm nữ chính", npc: "Nữ chính", default: -100 }], flags: [], items: [] };
  const make = (n) => ({ startSceneId: "s", registry, endings: [{ id: "e", title: "Hết" }], scenes: [{ id: "s", title: "Chọn", role: "decision", choices: Array.from({ length: n }, (_, i) => ({ id: `c${i}`, text: `C${i}`, targetType: "ending", targetId: "e", rules: { conditions: [], effects: [{ type: "stat_change", entityId: "aff", amount: [15, 5, -5, -20][i] }] }, conditionalOutcomes: [] })) }] });
  assert.ok(validateSceneBlueprint(make(1), { planningConstraints: constraints }).errors.length);
  assert.ok(validateSceneBlueprint(make(3), { planningConstraints: constraints }).errors.length);
  assert.deepEqual(validateSceneBlueprint(make(4), { planningConstraints: constraints }).errors, []);
});
test("AI consequence intents resolve to four canonical existing-rule effects", () => {
  const raw = { scenes: [{ ref: "s", title: "Đối thoại", role: "decision", isStart: true, choices: [15, 5, -5, -20].map((amount, i) => ({ text: `C${i}`, target: "e", targetKind: "ending", effectIntent: `Thiện cảm nữ chính ${amount >= 0 ? "+" : ""}${amount}` })) }], endings: [{ ref: "e", title: "Hết" }] };
  const registry = { stats: [{ id: "aff", kind: "relationship", displayName: "Thiện cảm nữ chính", npc: "Nữ chính", default: -100 }], flags: [], items: [] };
  const normalized = normalizeAIBlueprintResponse(raw, "ep");
  const bp = applyNormalizedBlueprint({ episodeId: "ep", startSceneId: null, scenes: [], endings: [], registry }, normalized, { replaceIds: new Set(), replaceStartScene: true });
  assert.deepEqual(bp.scenes[0].choices.map((c) => c.rules.effects[0].amount), [15, 5, -5, -20]);
  assert.equal(new Set(bp.scenes[0].choices.map((c) => JSON.stringify(c.rules.effects))).size, 4);
  const runtime = compileEpisodeBlueprint(bp, { title: "Test" });
  assert.deepEqual(runtime.nodes.start_node.choices.map((c) => c.npcAffinity?.["Nữ chính"]), [15, 5, -5, -20]);
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
