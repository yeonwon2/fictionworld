import test from "node:test";
import assert from "node:assert/strict";
import { canPassQuality, canUpdateCanon, canWriteChapter, compactBibleContext, decodeChapterPlan, encodeChapterPlan, findPreviousChapter, getWordBudgetStatus } from "../src/lib/writingFactory/workflow.js";

test("keeps legacy outline beat arrays readable", () => {
  assert.deepEqual(decodeChapterPlan('["Mở cảnh","Đối đầu"]').beats, ["Mở cảnh", "Đối đầu"]);
});

test("round-trips chapter contract and scene plan", () => {
  const value = { contract: { promise: "A" }, scenes: [{ goal: "B" }], beats: ["C"] };
  assert.deepEqual(decodeChapterPlan(encodeChapterPlan(value)), { version: 2, ...value, quality: null });
});

test("word tolerance is a quality gate", () => {
  assert.equal(getWordBudgetStatus("a ".repeat(850), 1000).within, true);
  assert.equal(getWordBudgetStatus("a ".repeat(849), 1000).within, false);
  assert.equal(canPassQuality({ report: { passed: true, issues: [] }, budget: { within: false } }), false);
});

test("preflight and logic issues are hard gates", () => {
  assert.equal(canWriteChapter({ contract: {}, scenes: [{}], preflight: { passed: true, issues: [] } }), true);
  assert.equal(canWriteChapter({ contract: {}, scenes: [{}], preflight: { passed: false, issues: [] } }), false);
  assert.equal(canPassQuality({ report: { passed: true, issues: [{ severity: "nghiêm trọng" }] }, budget: { within: true } }), false);
});

test("compact context prioritizes current state and stays bounded", () => {
  const docs = { tom_tat_hien_tai: { content: "NOW" }, the_gioi: { content: "W".repeat(20000) }, nhan_vat: { content: "C".repeat(20000) } };
  const result = compactBibleContext(docs, 5000);
  assert.match(result, /NOW/);
  assert.ok(result.length < 7000);
});

test("Canon Keeper only accepts persisted quality pass without hard failures", () => {
  assert.equal(canUpdateCanon(encodeChapterPlan({ quality: { passed: true, issues: [] } })), true);
  assert.equal(canUpdateCanon(encodeChapterPlan({ quality: { passed: true, issues: [{ hard_fail: true }] } })), false);
  assert.equal(canUpdateCanon('["legacy beat"]'), false);
});

test("finds the real previous chapter for new and existing drafts", () => {
  const chapters = [{ id: "b", chapter_number: 2 }, { id: "a", chapter_number: 1 }, { id: "c", chapter_number: 3 }];
  assert.equal(findPreviousChapter(chapters, null, 4).id, "c");
  assert.equal(findPreviousChapter(chapters, "c", 3).id, "b");
  assert.equal(findPreviousChapter(chapters, "a", 1), null);
});
