import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBlueprintGraph } from "../src/lib/gameStudioPro/qaGraphAnalyzer.js";
import { runProQa } from "../src/lib/gameStudioPro/proQa.js";
import { compileProGame } from "../src/lib/gameStudioPro/proCompiler.js";
import { newEmptyProGame } from "../src/lib/gameStudioPro/proModel.js";
import { normalizeAndRepair } from "../src/lib/gameStudio/postprocess.js";
import { brokenProQaFixture, cleanProQaFixture } from "./fixtures/proQaFixtures.js";

const codes = (result) => new Set(result.issues.map((i) => i.code));

function statFeasibilityDoc({ repeatable }) {
  const stat = { id: "rep", kind: "stat", displayName: "Uy tín", default: 0, isVital: false };
  const registry = { stats: [stat], relationships: [], flags: [], items: [] };
  const rules = (conditions = [], effects = []) => ({ conditions, effects });
  const gain = { id: "gain", text: "+10", targetType: "scene", targetId: "b", rules: rules([], [{ type: "stat_change", entityId: stat.id, amount: repeatable ? 10 : 20 }]), conditionalOutcomes: [] };
  const backOrForward = { id: "back", text: repeatable ? "Lặp lại" : "Đi tiếp", targetType: "scene", targetId: repeatable ? "a" : "gate", rules: rules(), conditionalOutcomes: [] };
  const toGate = { id: "to_gate", text: "Tới cổng", targetType: "scene", targetId: "gate", rules: rules(), conditionalOutcomes: [] };
  const gated = { id: "gated", text: "Kết thúc", targetType: "ending", targetId: "end", rules: rules([{ type: "stat_compare", entityId: stat.id, operator: ">=", value: 100 }]), conditionalOutcomes: [] };
  const scenes = [
    { id: "a", title: "A", role: "story", choices: [gain] },
    { id: "b", title: "B", role: "decision", choices: repeatable ? [backOrForward, toGate] : [backOrForward] },
    { id: "gate", title: "Cổng", role: "condition", choices: [gated] },
  ];
  return { title: "Stat bounds", storyBlueprint: { episodes: [{ id: "ep", order: 1, title: "Tập", stages: [], planningIntents: [], sceneBlueprint: { startSceneId: "a", scenes, endings: [{ id: "end", title: "Hết", tone: "good" }], registry } }] }, globalState: { startEpisodeId: "ep", registry, milestones: [] } };
}

test("repeatable reachable stat gain must not false-block a high gate", () => {
  const result = runProQa(statFeasibilityDoc({ repeatable: true }));
  assert.equal(codes(result).has("STAT_REQUIREMENT_IMPOSSIBLE"), false);
});

test("non-repeatable stat gain keeps a finite conservative upper bound", () => {
  const result = runProQa(statFeasibilityDoc({ repeatable: false }));
  assert.equal(codes(result).has("STAT_REQUIREMENT_IMPOSSIBLE"), true);
});

test("repeatable gain through an episode transition cycle fails open", () => {
  const doc = statFeasibilityDoc({ repeatable: false });
  const ep1 = doc.storyBlueprint.episodes[0];
  ep1.sceneBlueprint.scenes[2].choices[0].targetType = "episode";
  ep1.sceneBlueprint.scenes[2].choices[0].targetId = "ep2";
  ep1.sceneBlueprint.endings = [];
  const ep2 = { id: "ep2", order: 2, title: "Tập lặp", stages: [], planningIntents: [], sceneBlueprint: { startSceneId: "ep2_start", registry: doc.globalState.registry, endings: [{ id: "end", title: "Hết", tone: "good" }], scenes: [{ id: "ep2_start", title: "Quay lại", role: "decision", choices: [
    { id: "again", text: "Lặp campaign", targetType: "episode", targetId: "ep", rules: { conditions: [], effects: [] }, conditionalOutcomes: [] },
    { id: "finish", text: "Đòi 100", targetType: "ending", targetId: "end", rules: { conditions: [{ type: "stat_compare", entityId: "rep", operator: ">=", value: 100 }], effects: [] }, conditionalOutcomes: [] },
  ] }] } };
  doc.storyBlueprint.episodes.push(ep2);
  assert.equal(codes(runProQa(doc)).has("STAT_REQUIREMENT_IMPOSSIBLE"), false);
});

function configurationDoc() {
  const doc = cleanProQaFixture();
  // Relationships share registry.stats storage but retain kind=relationship.
  doc.globalState.registry.stats.push({ id: "rel", kind: "relationship", displayName: "Thiện cảm", npc: "NPC", default: 0 });
  for (const ep of doc.storyBlueprint.episodes) ep.sceneBlueprint.registry = doc.globalState.registry;
  return doc;
}

test("rank pointing to a non-stat has structured wrong-kind ERROR", () => {
  const doc = configurationDoc();
  doc.mechanics.configs.rank = [
    { id: "r1", label: "Quan hệ", entityId: "rel", levels: [{ threshold: 0 }] },
    { id: "r2", label: "Cờ", entityId: "flag_saved", levels: [{ threshold: 0 }] },
    { id: "r3", label: "Vật phẩm", entityId: "item_scarf", levels: [{ threshold: 0 }] },
  ];
  const issues = runProQa(doc).issues.filter((item) => item.code === "RANK_ENTITY_WRONG_KIND");
  assert.equal(issues.length, 3);
  assert.ok(issues.every((issue) => issue.severity === "error"));
});

test("currency pointing to a non-stat has structured wrong-kind ERROR", () => {
  const doc = configurationDoc();
  doc.mechanics.configs.currency = [{ id: "c", entityId: "rel", allowNegative: true }];
  const issue = runProQa(doc).issues.find((item) => item.code === "CURRENCY_ENTITY_WRONG_KIND");
  assert.equal(issue?.severity, "error");
});

test("duplicate rank thresholds have a structured ERROR", () => {
  const doc = configurationDoc();
  doc.mechanics.configs.rank = [{ id: "r", label: "Trùng", entityId: "stat_rep", levels: [{ threshold: 10 }, { threshold: 10 }] }];
  assert.equal(runProQa(doc).issues.find((item) => item.code === "RANK_DUPLICATE_THRESHOLD")?.severity, "error");
});

test("out-of-order rank thresholds have a structured WARNING", () => {
  const doc = configurationDoc();
  doc.mechanics.configs.rank = [{ id: "r", label: "Lệch", entityId: "stat_rep", levels: [{ threshold: 20 }, { threshold: 10 }] }];
  assert.equal(runProQa(doc).issues.find((item) => item.code === "RANK_THRESHOLD_ORDER_WARNING")?.severity, "warning");
});

test("vital mechanic and broken milestones expose stable structured codes", () => {
  const doc = configurationDoc();
  doc.mechanics.enabled = ["vitalStat"];
  doc.globalState.milestones = [
    { id: "missing", statEntityId: "deleted", thresholds: [{ at: 1, bonus: 1 }] },
    { id: "wrong", statEntityId: "rel", thresholds: [{ at: 5, bonus: 1 }, { at: 5, bonus: Number.NaN }] },
  ];
  const result = runProQa(doc); const found = codes(result);
  for (const code of ["VITAL_MECHANIC_WITHOUT_VITAL_STAT", "MILESTONE_ENTITY_MISSING", "MILESTONE_ENTITY_WRONG_KIND", "MILESTONE_DUPLICATE_THRESHOLD", "MILESTONE_VALUE_INVALID"]) assert.ok(found.has(code), `missing ${code}`);
});

test("direct start choice to a reachable death ending satisfies instant_failure", () => {
  assert.equal(codes(runProQa(cleanProQaFixture())).has("PLANNER_INSTANT_FAILURE_MISSING"), false);
});

test("direct death choice on a later reachable scene satisfies instant_failure", () => {
  const doc = cleanProQaFixture(); const bp = doc.storyBlueprint.episodes[0].sceneBlueprint;
  const deathChoice = bp.scenes[0].choices.find((choice) => choice.targetId === "death");
  deathChoice.targetType = "scene"; deathChoice.targetId = "side";
  bp.scenes.find((scene) => scene.id === "side").choices.push({ id: "die_later", text: "Chết ngay", targetType: "ending", targetId: "death", rules: { conditions: [], effects: [] }, conditionalOutcomes: [] });
  assert.equal(codes(runProQa(doc)).has("PLANNER_INSTANT_FAILURE_MISSING"), false);
});

test("an unconnected death ending does not satisfy instant_failure", () => {
  const doc = cleanProQaFixture(); const bp = doc.storyBlueprint.episodes[0].sceneBlueprint;
  const deathChoice = bp.scenes[0].choices.find((choice) => choice.targetId === "death");
  deathChoice.targetType = "scene"; deathChoice.targetId = "join";
  assert.equal(codes(runProQa(doc)).has("PLANNER_INSTANT_FAILURE_MISSING"), true);
});

test("a direct death choice on an unreachable scene does not satisfy instant_failure", () => {
  const doc = cleanProQaFixture(); const bp = doc.storyBlueprint.episodes[0].sceneBlueprint;
  const deathChoice = bp.scenes[0].choices.find((choice) => choice.targetId === "death");
  deathChoice.targetType = "scene"; deathChoice.targetId = "join";
  bp.scenes.push({ id: "orphan_death", title: "Cảnh mồ côi", role: "story", choices: [{ id: "die_orphan", text: "Chết", targetType: "ending", targetId: "death", rules: { conditions: [], effects: [] }, conditionalOutcomes: [] }] });
  assert.equal(codes(runProQa(doc)).has("PLANNER_INSTANT_FAILURE_MISSING"), true);
});

test("a reachable conditional outcome directly targeting death satisfies instant_failure", () => {
  const doc = cleanProQaFixture(); const bp = doc.storyBlueprint.episodes[0].sceneBlueprint;
  const deathChoice = bp.scenes[0].choices.find((choice) => choice.targetId === "death");
  deathChoice.targetType = "scene"; deathChoice.targetId = "join";
  const reachableChoice = bp.scenes.find((scene) => scene.id === "side").choices[0];
  reachableChoice.conditionalOutcomes = [{ id: "death_branch", conditions: [], effects: [], targetType: "ending", targetId: "death" }];
  assert.equal(codes(runProQa(doc)).has("PLANNER_INSTANT_FAILURE_MISSING"), false);
});

test("PRO 7 graph engine reports reachability, incoming/outgoing and missing targets", () => {
  const bp = brokenProQaFixture().storyBlueprint.episodes[0].sceneBlueprint;
  const graph = analyzeBlueprintGraph(bp);
  assert.equal(graph.reachableSceneIds.has("start"), true);
  assert.equal(graph.unreachableSceneIds.has("unreachable"), true);
  assert.equal(graph.incoming.get("clean_join").length, 2);
  assert.equal(graph.outgoing.get("start").length, 2);
  assert.equal(graph.brokenEdges.some((e) => e.choiceId === "missing"), true);
});

test("PRO 7 detects required broken fixture without flagging its clean branch", () => {
  const result = runProQa(brokenProQaFixture()); const found = codes(result);
  for (const code of ["MISSING_TARGET", "UNREACHABLE_SCENE", "UNREACHABLE_ENDING", "ORPHAN_SIDE_SCENE", "ORPHAN_CONSEQUENCE", "CONVERGENCE_TOO_FEW_INCOMING", "ITEM_NEVER_GRANTED", "FLAG_NEVER_GRANTED", "STAT_REQUIREMENT_IMPOSSIBLE", "BROKEN_EPISODE_TRANSITION", "RANK_ENTITY_MISSING", "LAST_EPISODE_NO_ENDING"]) assert.ok(found.has(code), `missing ${code}`);
  assert.equal(result.issues.some((i) => i.sceneId === "clean_join" && ["UNREACHABLE_SCENE", "NO_INCOMING_EDGE", "CONVERGENCE_TOO_FEW_INCOMING"].includes(i.code)), false);
});

test("cycles distinguish an escapable loop from an infinite SCC", () => {
  const noExit = { startSceneId: "a", endings: [], scenes: [{ id: "a", choices: [{ id: "1", targetType: "scene", targetId: "b" }] }, { id: "b", choices: [{ id: "2", targetType: "scene", targetId: "a" }] }] };
  assert.equal(analyzeBlueprintGraph(noExit).cycles[0].hasExit, false);
  noExit.endings.push({ id: "end" }); noExit.scenes[1].choices.push({ id: "3", targetType: "ending", targetId: "end" });
  assert.equal(analyzeBlueprintGraph(noExit).cycles[0].hasExit, true);
});

test("planner intent mismatches have stable codes", () => {
  const doc = cleanProQaFixture(); doc.storyBlueprint.episodes[0].sceneBlueprint.scenes = doc.storyBlueprint.episodes[0].sceneBlueprint.scenes.filter((s) => !["side", "consequence"].includes(s.id));
  const found = codes(runProQa(doc));
  assert.ok(found.has("PLANNER_SIDE_BRANCH_MISSING")); assert.ok(found.has("PLANNER_NON_LETHAL_FAILURE_MISSING"));
});

test("clean multi-episode fixture has zero blocking errors", () => {
  const result = runProQa(cleanProQaFixture());
  assert.equal(result.summary.error, 0, result.issues.map((i) => `${i.code}: ${i.message}`).join("\n"));
  assert.equal(result.blocking, false);
});

test("all canonical QA results expose stable structured fields", () => {
  for (const issue of runProQa(brokenProQaFixture()).issues) {
    assert.match(issue.code, /^[A-Z0-9_]+$/); assert.ok(["error", "warning", "info"].includes(issue.severity)); assert.ok(issue.scope); assert.ok(issue.title); assert.equal(typeof issue.message, "string"); assert.equal(typeof issue.whyItMatters, "string"); assert.equal(typeof issue.suggestedFix, "string");
  }
});

test("malformed source does not crash QA", () => {
  assert.doesNotThrow(() => runProQa(null));
  assert.doesNotThrow(() => runProQa({ storyBlueprint: { episodes: [{ id: "bad", sceneBlueprint: { scenes: [{ id: "x", choices: null }] } }] } }));
});

test("500-scene graph performance sanity remains linear enough for browser QA", () => {
  const scenes = Array.from({ length: 500 }, (_, i) => ({ id: `s${i}`, title: `Cảnh ${i}`, role: "story", choices: i === 499 ? [{ id: "end", text: "Hết", targetType: "ending", targetId: "done", rules: { conditions: [], effects: [] }, conditionalOutcomes: [] }] : [{ id: `c${i}`, text: "Tiếp", targetType: "scene", targetId: `s${i + 1}`, rules: { conditions: [], effects: [] }, conditionalOutcomes: [] }] }));
  const registry = { stats: [], relationships: [], flags: [], items: [] };
  const doc = { storyBlueprint: { episodes: [{ id: "ep", order: 1, title: "Lớn", stages: [], planningIntents: [], sceneBlueprint: { startSceneId: "s0", scenes, endings: [{ id: "done", title: "Hết", tone: "good" }], registry } }] }, globalState: { startEpisodeId: "ep", registry, milestones: [] } };
  const started = performance.now(); const result = runProQa(doc); const elapsed = performance.now() - started;
  assert.equal(result.summary.error, 0); assert.ok(elapsed < 1000, `QA took ${elapsed.toFixed(1)}ms`);
});

test("PRO 0–6 and Legacy compiler paths remain unchanged", () => {
  const pro = compileProGame(newEmptyProGame()); assert.ok(pro.nodes.start_node); assert.equal(pro.nodes.start_node.choices.length, 2);
  const legacy = normalizeAndRepair({ start_node: { id: "start_node", text: "Legacy", choices: [{ text: "Hết", targetNodeId: "end" }] }, end: { id: "end", text: "Hết", isEnding: true, choices: [] } }, [], 0);
  assert.equal(legacy.nodes.start_node.choices[0].targetNodeId, "end");
});
