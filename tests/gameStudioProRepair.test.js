import test from "node:test";
import assert from "node:assert/strict";
import { findChoiceEffectGaps, applyEffectFixes } from "../src/lib/gameStudioPro/blueprintRepair.js";
import { repairBlueprintEffects, refreshBlueprintEffects } from "../src/lib/gameStudioPro/blueprintAI.js";
import { saveAIProfile, activateAIProfile } from "../src/lib/aiCall.js";

const memory = new Map();
globalThis.localStorage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) };

const registry = { stats: [{ id: "aff", kind: "relationship", displayName: "Thiện cảm nữ chính", npc: "Nữ chính", default: -100 }], flags: [], items: [] };

function decisionScene(id, title, choiceEffects) {
  return {
    id,
    title,
    role: "decision",
    intent: "Cảnh quyết định",
    choices: choiceEffects.map((amount, i) => ({
      id: `${id}_c${i}`,
      text: `Lựa chọn ${i + 1}`,
      effectIntent: amount === null ? "" : `Thiện cảm nữ chính ${amount >= 0 ? "+" : ""}${amount}`,
      rules: { conditions: [], effects: amount === null ? [] : [{ type: "stat_change", entityId: "aff", amount }] },
      unresolvedEffects: [],
    })),
  };
}

test("findChoiceEffectGaps bỏ qua cảnh có đủ hệ quả khác nhau", () => {
  const blueprint = { scenes: [decisionScene("s1", "Ổn", [15, 5, -5, -20])] };
  assert.deepEqual(findChoiceEffectGaps(blueprint), []);
});

test("findChoiceEffectGaps phát hiện lựa chọn thiếu hệ quả", () => {
  const blueprint = { scenes: [decisionScene("s1", "Thiếu", [15, 5, null, -20])] };
  const gaps = findChoiceEffectGaps(blueprint);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].sceneId, "s1");
  assert.ok(gaps[0].problemChoiceIds.has("s1_c2"));
  assert.equal(gaps[0].problemChoiceIds.has("s1_c0"), false);
});

test("findChoiceEffectGaps phát hiện 2 lựa chọn trùng hệ quả (đúng ca lỗi thật của người dùng)", () => {
  const blueprint = { scenes: [decisionScene("s1", "Thức tỉnh và tiếng gọi hệ thống", [15, 15, -5, -20])] };
  const gaps = findChoiceEffectGaps(blueprint);
  assert.equal(gaps.length, 1);
  assert.ok(gaps[0].problemChoiceIds.has("s1_c0"));
  assert.ok(gaps[0].problemChoiceIds.has("s1_c1"));
  assert.equal(gaps[0].problemChoiceIds.has("s1_c2"), false);
});

test("findChoiceEffectGaps bỏ qua cảnh không phải decision hoặc dưới 2 lựa chọn", () => {
  const story = { ...decisionScene("s1", "Kể chuyện", [null]), role: "story" };
  assert.deepEqual(findChoiceEffectGaps({ scenes: [story] }), []);
});

test("applyEffectFixes chỉ vá đúng choiceId được liệt kê, giữ nguyên phần còn lại", () => {
  const blueprint = { scenes: [decisionScene("s1", "Thức tỉnh", [15, 15, -5, -20])] };
  const fixed = applyEffectFixes(blueprint, [{ choiceId: "s1_c1", effectIntent: "Thiện cảm nữ chính +5" }], registry);
  assert.deepEqual(fixed.scenes[0].choices[1].rules.effects, [{ type: "stat_change", entityId: "aff", amount: 5 }]);
  // Các lựa chọn khác giữ nguyên tham chiếu/giá trị — không bị viết lại ngoài phạm vi vá.
  assert.equal(fixed.scenes[0].choices[0], blueprint.scenes[0].choices[0]);
  assert.equal(fixed.scenes[0].choices[2], blueprint.scenes[0].choices[2]);
  assert.equal(findChoiceEffectGaps(fixed).length, 0);
});

test("applyEffectFixes không đổi gì khi danh sách vá rỗng", () => {
  const blueprint = { scenes: [decisionScene("s1", "Ổn", [15, 5, -5, -20])] };
  assert.equal(applyEffectFixes(blueprint, [], registry), blueprint);
});

for (const provider of ["gemini", "custom"]) {
  test(`${provider}: repairBlueprintEffects KHÔNG gọi AI khi không còn cảnh thiếu/trùng hệ quả`, async (t) => {
    const original = globalThis.fetch;
    t.after(() => { globalThis.fetch = original; });
    const profile = saveAIProfile({ name: "Repair", provider, key: "test-only", model: "test-model", custom: { providerId: "other", key: "test-only", model: "test-model", baseUrl: "https://example.test/v1" } });
    activateAIProfile(profile.id);
    let fetched = 0;
    globalThis.fetch = async () => { fetched++; return { ok: true, json: async () => ({}) }; };
    const blueprint = { scenes: [decisionScene("s1", "Ổn", [15, 5, -5, -20])] };
    const result = await repairBlueprintEffects(blueprint, {}, { title: "Tập 1" }, registry);
    assert.equal(fetched, 0);
    assert.equal(result.repaired, false);
    assert.equal(result.stillHasGaps, false);
  });
}

test("repairBlueprintEffects gộp NHIỀU cảnh lỗi vào ĐÚNG 1 lượt gọi AI, không phải 1 lượt/cảnh", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  memory.clear();
  const profile = saveAIProfile({ name: "Batch", provider: "gemini", key: "test-only", model: "test-model" });
  activateAIProfile(profile.id);
  let fetched = 0;
  globalThis.fetch = async (_url, options) => {
    fetched++;
    const body = JSON.parse(options.body);
    const promptText = body.contents[0].parts[0].text;
    // Cả 3 cảnh lỗi phải có mặt trong CÙNG 1 prompt (bằng chứng đã gộp, không gọi rời).
    assert.match(promptText, /Cảnh 1/);
    assert.match(promptText, /Cảnh 2/);
    assert.match(promptText, /Cảnh 3/);
    const fixes = [
      { choiceId: "s1_c2", effectIntent: "Thiện cảm nữ chính -3" },
      { choiceId: "s2_c1", effectIntent: "Thiện cảm nữ chính +8" },
      { choiceId: "s3_c0", effectIntent: "Thiện cảm nữ chính +20" },
    ];
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ fixes }) }] } }] }) };
  };
  const blueprint = {
    scenes: [
      decisionScene("s1", "Cảnh 1", [15, 5, null, -20]),
      decisionScene("s2", "Cảnh 2", [15, 15, -5, -20]),
      decisionScene("s3", "Cảnh 3", [null, 5, -5, -20]),
    ],
  };
  const result = await repairBlueprintEffects(blueprint, {}, { title: "Tập 1" }, registry);
  assert.equal(fetched, 1);
  assert.equal(result.repaired, true);
  assert.equal(result.stillHasGaps, false);
  assert.deepEqual(result.blueprint.scenes[0].choices[2].rules.effects, [{ type: "stat_change", entityId: "aff", amount: -3 }]);
  assert.deepEqual(result.blueprint.scenes[1].choices[1].rules.effects, [{ type: "stat_change", entityId: "aff", amount: 8 }]);
  assert.deepEqual(result.blueprint.scenes[2].choices[0].rules.effects, [{ type: "stat_change", entityId: "aff", amount: 20 }]);
  // Lựa chọn vốn đã ổn không bị viết lại.
  assert.deepEqual(result.blueprint.scenes[0].choices[0].rules.effects, [{ type: "stat_change", entityId: "aff", amount: 15 }]);
  assert.equal(findChoiceEffectGaps(result.blueprint).length, 0);
});

test("repairBlueprintEffects: vá 1 choiceId trùng đã đủ giải phóng cả cặp trùng, hết lỗi", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  memory.clear();
  const profile = saveAIProfile({ name: "Partial", provider: "gemini", key: "test-only", model: "test-model" });
  activateAIProfile(profile.id);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ fixes: [{ choiceId: "s1_c1", effectIntent: "Thiện cảm nữ chính +5" }] }) }] } }] }) });
  const blueprint = { scenes: [decisionScene("s1", "Thức tỉnh", [15, 15, -5, -20])] };
  const result = await repairBlueprintEffects(blueprint, {}, { title: "Tập 1" }, registry);
  assert.equal(result.repaired, true);
  assert.equal(result.stillHasGaps, false); // choice 1 was the only duplicate of choice 0; fixing it clears the gap.
});

test("repairBlueprintEffects: AI không vá đủ mọi cảnh lỗi vẫn giữ phần đã vá được, báo đúng stillHasGaps=true", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  memory.clear();
  const profile = saveAIProfile({ name: "PartialMulti", provider: "gemini", key: "test-only", model: "test-model" });
  activateAIProfile(profile.id);
  let fetched = 0;
  globalThis.fetch = async () => {
    fetched++;
    // Chỉ vá cảnh s1, "quên" cảnh s2 — mô phỏng AI trả về không đầy đủ.
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ fixes: [{ choiceId: "s1_c1", effectIntent: "Thiện cảm nữ chính +5" }] }) }] } }] }) };
  };
  const blueprint = {
    scenes: [
      decisionScene("s1", "Cảnh 1", [15, 15, -5, -20]),
      decisionScene("s2", "Cảnh 2", [15, 15, -5, -20]),
    ],
  };
  const result = await repairBlueprintEffects(blueprint, {}, { title: "Tập 1" }, registry);
  assert.equal(fetched, 1); // vẫn chỉ 1 lượt gọi, kể cả khi kết quả chưa đủ.
  assert.equal(result.repaired, true);
  assert.equal(result.stillHasGaps, true);
  assert.equal(findChoiceEffectGaps(result.blueprint).length, 1);
  assert.equal(findChoiceEffectGaps(result.blueprint)[0].sceneId, "s2");
  // Cảnh s1 vẫn giữ phần đã vá được — không bị mất vì s2 chưa xong.
  assert.deepEqual(result.blueprint.scenes[0].choices[1].rules.effects, [{ type: "stat_change", entityId: "aff", amount: 5 }]);
});

test("repairBlueprintEffects: lỗi mạng/hết quota không làm mất bản nháp — hàm ném lỗi để caller tự giữ blueprint trước khi vá", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  memory.clear();
  const profile = saveAIProfile({ name: "Quota", provider: "gemini", key: "test-only", model: "test-model" });
  activateAIProfile(profile.id);
  globalThis.fetch = async () => ({ ok: false, status: 429, text: async () => "quota" });
  const blueprint = { scenes: [decisionScene("s1", "Cảnh", [15, 15, -5, -20])] };
  await assert.rejects(repairBlueprintEffects(blueprint, {}, { title: "Tập 1" }, registry), /429/);
});

test("refreshBlueprintEffects (chấm cục bộ) tự khớp entity gần đúng, không cần AI", () => {
  const blueprint = { scenes: [{ id: "s1", title: "Cảnh", role: "decision", choices: [{ id: "c0", text: "A", effectIntent: "Thiện cảm +10", rules: { conditions: [], effects: [] }, unresolvedEffects: [{ intent: "Thiện cảm +10" }] }] }] };
  const refreshed = refreshBlueprintEffects(blueprint, registry);
  assert.deepEqual(refreshed.scenes[0].choices[0].rules.effects, [{ type: "stat_change", entityId: "aff", amount: 10 }]);
  assert.deepEqual(refreshed.scenes[0].choices[0].unresolvedEffects, []);
});
