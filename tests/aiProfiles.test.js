import test from "node:test";
import assert from "node:assert/strict";

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};

const ai = await import("../src/lib/aiCall.js");

test("AI profiles are manually saved, activated and deleted", () => {
  const first = ai.saveAIProfile({ name: "Gemini chính", provider: "gemini", key: "key-one", model: "gemini-test" });
  const second = ai.saveAIProfile({ name: "Dự phòng trả phí", provider: "custom", custom: { providerId: "other", baseUrl: "https://example.test/v1", key: "key-two", model: "model-two" } });
  assert.equal(ai.getAIProfiles().length, 2);
  ai.activateAIProfile(first.id);
  assert.equal(ai.getActiveAIProfileId(), first.id);
  assert.equal(ai.getCustomKey(), "key-one");
  ai.activateAIProfile(second.id);
  assert.equal(ai.getAIProvider(), "custom");
  assert.equal(ai.getCustomProviderConfig().model, "model-two");
  ai.deleteAIProfile(first.id);
  assert.equal(ai.getAIProfiles().length, 1);
});
