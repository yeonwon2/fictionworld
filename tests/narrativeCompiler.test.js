import test from "node:test";
import assert from "node:assert/strict";
import { buildSceneContracts, compileNarrativePlan, repairNarrativePlan, simulateNarrativeRoutes } from "../src/lib/gameScriptProject/narrativeCompiler.js";
import { analyzeNarrativeContinuity } from "../src/lib/gameScriptProject/continuityChecker.js";
import { analyzeStatefulNarrative } from "../src/lib/gameScriptProject/statefulCompiler.js";
import { analyzePhase3Narrative, buildChapterMap } from "../src/lib/gameScriptProject/phase3Analyzer.js";
import { compileFinalScriptLocally, effectLines, estimateGeminiCalls } from "../src/lib/gameScriptProject/quotaPlanner.js";

const project = { title: "Test", player_name: "Linh", main_quest: "Tìm sự thật", scene_count: 2, branch_count: 1 };
const meta = { endings: [{ name: "Sự thật", type: "TRUE_END" }] };

test("compiles a valid legacy-compatible plan", () => {
  const scenes = [
    { scene_order: 1, title: "Mở", choices: [{ text: "Đi", effect: "→ Cờ: da_biet", target: "cảnh 2" }] },
    { scene_order: 2, title: "Cuối", choices: [{ text: "Nói", effect: "Cần cờ: da_biet", target: "kết thúc Sự thật" }] },
  ];
  const report = compileNarrativePlan({ project, meta, scenes });
  assert.equal(report.ok, true);
  assert.deepEqual(report.summary, { scenes: 2, reachableScenes: 2, endings: 1, reachableEndings: 1, errors: 0, warnings: 0 });
});

test("compiler and continuity checker tolerate metadata while it is loading", () => {
  assert.doesNotThrow(() => compileNarrativePlan({ project, meta: null, scenes: [] }));
  assert.doesNotThrow(() => analyzeNarrativeContinuity({ project, meta: null, scenes: [] }));
});

test("finds missing destinations, unreachable scenes and orphan endings", () => {
  const scenes = [
    { scene_order: 1, title: "Mở", choices: [{ text: "Sai", target: "cảnh 99" }] },
    { scene_order: 2, title: "Mồ côi", choices: [{ text: "Dừng", target: "kết thúc Không tồn tại" }] },
  ];
  const codes = compileNarrativePlan({ project, meta, scenes }).issues.map((x) => x.code);
  assert.ok(codes.includes("MISSING_DESTINATION"));
  assert.ok(codes.includes("UNREACHABLE_SCENE"));
  assert.ok(codes.includes("ORPHAN_ENDING"));
  assert.ok(codes.includes("TRAPPED_PATH"));
});

test("finds infeasible item, flag and stat requirements", () => {
  const scenes = [{ scene_order: 1, title: "Khóa", choices: [{ text: "Mở", effect: "Cần vật phẩm: chìa khóa; Cần cờ: tin_tuong; Cần Danh vọng >= 10", target: "kết thúc Sự thật" }] }];
  const codes = compileNarrativePlan({ project, meta, scenes }).issues.map((x) => x.code);
  assert.ok(codes.includes("ITEM_INFEASIBLE"));
  assert.ok(codes.includes("FLAG_INFEASIBLE"));
  assert.ok(codes.includes("STAT_INFEASIBLE"));
});

test("scene contracts do not change the legacy target text", () => {
  const [contract] = buildSceneContracts([{ scene_order: 7, choices: [{ text: "A", effect: "→ Vật phẩm: Ngọc", target: "→ Đến cảnh 8" }] }]);
  assert.equal(contract.choices[0].target.raw, "→ Đến cảnh 8");
  assert.equal(contract.choices[0].target.id, 8);
  assert.deepEqual(contract.choices[0].effects.grantItems, ["Ngọc"]);
});

test("repairs broken links, dead ends and orphan endings without touching effects", () => {
  const scenes = [
    { scene_order: 1, title: "Mở", choices: [{ text: "Đi", effect: "Danh vọng +2", target: "cảnh 99" }] },
    { scene_order: 2, title: "Cuối", choices: [] },
  ];
  const result = repairNarrativePlan({ scenes, meta });
  assert.equal(result.scenes[0].choices[0].target, "cảnh 2");
  assert.equal(result.scenes[0].choices[0].effect, "Danh vọng +2");
  assert.ok(result.scenes[1].choices.some((choice) => choice.target === "kết thúc Sự thật"));
  assert.ok(result.changes.length >= 2);
});

test("simulates endings and reports cycles", () => {
  const endingRoutes = simulateNarrativeRoutes({ scenes: [{ scene_order: 1, title: "Mở", choices: [{ text: "Xong", target: "kết thúc HE" }] }] });
  assert.equal(endingRoutes[0].status, "ending");
  assert.equal(endingRoutes[0].ending, "HE");
  const cycleRoutes = simulateNarrativeRoutes({ scenes: [{ scene_order: 1, title: "Lặp", choices: [{ text: "Lại", target: "cảnh 1" }] }] });
  assert.equal(cycleRoutes[0].status, "cycle");
});

test("continuity checker finds unknown cast, unpaid foreshadow and unused branches", () => {
  const report = analyzeNarrativeContinuity({
    project: { ...project, branch_count: 2 },
    meta: { ...meta, characters: [{ name: "Linh" }] },
    scenes: [
      { scene_order: 1, title: "Chiếc nhẫn", description: "Linh tìm thấy một chiếc nhẫn có dấu máu trong căn phòng khóa.", location: "Phòng", characters: "Linh, Người lạ", foreshadow: "chiếc nhẫn có dấu máu", choices: [{ text: "Đi", target: "cảnh 2" }], is_branch_point: true, branch_index: 0 },
      { scene_order: 2, title: "Rời đi", description: "Linh quyết định rời khỏi nơi này và bắt đầu một hành trình hoàn toàn khác.", location: "Cổng", characters: "Linh", choices: [{ text: "Xong", target: "kết thúc Sự thật" }] },
    ],
  });
  const codes = report.findings.map((item) => item.code);
  assert.ok(codes.includes("UNKNOWN_CHARACTER"));
  assert.ok(codes.includes("FORESHADOW_UNPAID"));
  assert.ok(codes.includes("BRANCH_UNUSED"));
  assert.ok(report.score < 100);
});

test("stateful compiler follows item, flag, stat and knowledge across a route", () => {
  const scenes = [
    { scene_order: 1, title: "Manh mối", state_contract: { reveals: ["An lấy hạt giống"] }, choices: [{ text: "Nhặt", effect: "→ Vật phẩm: chìa khóa; → Cờ: đã điều tra; Suy luận +10", target: "cảnh 2" }] },
    { scene_order: 2, title: "Đối chất", state_contract: { requires: { items: ["chìa khóa"], flags: ["đã điều tra"], knowledge: ["An lấy hạt giống"], stats: { "Suy luận": 10 } } }, choices: [{ text: "Kết luận", effect: "Cần vật phẩm: chìa khóa; Cần cờ: đã điều tra; Cần Suy luận >= 10", target: "kết thúc TRUE_END" }] },
  ];
  const report = analyzeStatefulNarrative({ meta: { endings: [{ name: "TRUE_END" }], invariants: [{ type: "ending_requires", ending: "TRUE_END", field: "knowledge", value: "An lấy hạt giống", description: "Phải biết thủ phạm" }] }, scenes });
  assert.equal(report.ok, true);
  assert.equal(report.summary.validEndings, 1);
});

test("stateful compiler blocks impossible knowledge and ending invariants", () => {
  const scenes = [{ scene_order: 1, title: "Vội kết luận", state_contract: { requires: { knowledge: ["hung thủ là An"] } }, choices: [{ text: "Xong", target: "kết thúc TRUE_END" }] }];
  const report = analyzeStatefulNarrative({ meta: { invariants: [{ type: "ending_requires", ending: "TRUE_END", field: "flag", value: "đủ chứng cứ", description: "TRUE_END cần đủ chứng cứ" }] }, scenes });
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((x) => x.code === "SCENE_REQUIREMENT_UNMET"));
});

test("stateful compiler treats opening-scene handoff as campaign baseline", () => {
  const scenes = [{
    scene_order: 1,
    state_contract: { handoff: { flags: ["đã nhập cảnh"], knowledge: ["vị trí hiện trường"] } },
    choices: [{ text: "Bắt đầu điều tra", target: "kết thúc MỞ ÁN" }],
  }];
  const report = analyzeStatefulNarrative({ scenes });
  assert.equal(report.ok, true);
  assert.equal(report.summary.validEndings, 1);
});

test("stateful compiler materializes a scene handoff before its exits", () => {
  const scenes = [
    { scene_order: 1, choices: [{ text: "Gặp nhân chứng", target: "cảnh 2" }] },
    { scene_order: 2, state_contract: { handoff: { flags: ["đã gặp nhân chứng"], knowledge: ["lời khai"] } }, choices: [{ text: "Đi tiếp", target: "cảnh 3" }] },
    { scene_order: 3, state_contract: { requires: { flags: ["đã gặp nhân chứng"], knowledge: ["lời khai"] } }, choices: [{ text: "Kết luận", target: "kết thúc HE" }] },
  ];
  const report = analyzeStatefulNarrative({ scenes });
  assert.equal(report.ok, true);
  assert.equal(report.summary.validEndings, 1);
});

test("stateful compiler lets checkpoints reconcile divergent branch state", () => {
  const scenes = [
    { scene_order: 1, choices: [{ text: "Nhánh thiếu manh mối", target: "cảnh 2" }] },
    { scene_order: 2, is_checkpoint: true, state_contract: { requires: { items: ["hồ sơ 17"] } }, choices: [{ text: "Bù manh mối", target: "kết thúc HE" }] },
  ];
  const report = analyzeStatefulNarrative({ scenes });
  assert.equal(report.ok, true);
  assert.ok(report.issues.some((x) => x.code === "CHECKPOINT_STATE_VARIANCE" && x.severity === "warning"));
});

test("stateful compiler labels legacy scenes without contracts", () => {
  const report = analyzeStatefulNarrative({ scenes: [{ scene_order: 1, choices: [{ text: "Xong", target: "kết thúc HE" }] }] });
  assert.equal(report.summary.contractsDeclared, 0);
  assert.ok(report.issues.some((x) => x.code === "STATE_CONTRACT_COVERAGE"));
});

test("phase 3 detects fake choices and builds regression coverage", () => {
  const scenes = [
    { scene_order: 1, chapter_index: 1, is_checkpoint: true, choices: [{ text: "Đi trái", target: "cảnh 2" }, { text: "Đi phải", target: "cảnh 2" }] },
    { scene_order: 2, chapter_index: 1, choices: [{ text: "Kết", target: "kết thúc HE" }] },
  ];
  const report = analyzePhase3Narrative({ meta: { endings: [{ name: "HE" }] }, scenes });
  assert.ok(report.findings.some((x) => x.code === "FAKE_CHOICE"));
  assert.equal(report.coverage.scenePercent, 100);
  assert.equal(report.coverage.choicePercent, 100);
  assert.equal(report.regressionCases.length, 1);
});

test("chapter map adds safe inferred checkpoints for legacy scenes", () => {
  const scenes = Array.from({ length: 13 }, (_, index) => ({ scene_order: index + 1 }));
  const map = buildChapterMap(scenes, 12);
  assert.deepEqual(map.filter((x) => x.checkpoint).map((x) => x.sceneId), [1, 13]);
});

test("quota planner makes final compilation free and resumable", () => {
  assert.deepEqual(estimateGeminiCalls({ sceneCount: 50, existingScenes: 24, missingDraftScenes: 18 }), { core: 0, plan: 4, drafts: 3, final: 0, total: 7, branches: 0 });
});

test("local final compiler preserves the legacy parser format", () => {
  const script = compileFinalScriptLocally({ project: { title: "Nhà kính", player_name: "Linh", main_quest: "tìm hạt giống" }, meta: { endings: [{ name: "TRUE_END", type: "Viên mãn", description: "Đã cứu hoa." }] }, scenes: [{ id: "s1", scene_order: 1, title: "Mở đầu", description: "Mất hạt giống.", choices: [{ text: "Điều tra", effect: "Suy luận +5", target: "kết thúc TRUE_END" }] }], draftByScene: new Map() });
  assert.match(script, /## GIỚI THIỆU/);
  assert.match(script, /## CẢNH 1 — Mở đầu/);
  assert.match(script, /\*\*A — Điều tra\*\*/);
  assert.match(script, /→ Kết thúc TRUE_END/);
  assert.match(script, /## KẾT THÚC TRUE_END/);
});

test("local compiler normalizes prose effects without leaking parser errors", () => {
  assert.deepEqual(effectLines("Tăng Suy luận.; Sử dụng cờ da_biet; Hướng tới TRUE_END."), ["→ Suy luận +5", "→ Cờ: da_biet"]);
  assert.deepEqual(effectLines("→ Vật phẩm: Chìa khóa; Danh vọng -10"), ["→ Vật phẩm: Chìa khóa", "→ Danh vọng -10"]);
});

test("local compiler uses the ending code while preserving its display title", () => {
  const script = compileFinalScriptLocally({
    project: { title: "Án hoa trắng", player_name: "An", main_quest: "phá án" },
    meta: { endings: [{ name: "TRUE_END — HOA TRẮNG NỞ LẠI", type: "TRUE_END", description: "Sự thật sáng tỏ." }] },
    scenes: [{ scene_order: 1, title: "Đối chất", description: "An kết luận.", choices: [{ text: "Công bố", target: "kết thúc TRUE_END — HOA TRẮNG NỞ LẠI" }] }],
  });
  assert.match(script, /→ Kết thúc TRUE_END/);
  assert.doesNotMatch(script, /→ Kết thúc TRUE_END —/);
  assert.match(script, /## KẾT THÚC TRUE_END — HOA TRẮNG NỞ LẠI/);
});
