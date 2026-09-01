import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBlueprintGraph } from "../src/lib/gameStudioPro/qaGraphAnalyzer.js";
import { runProQa } from "../src/lib/gameStudioPro/proQa.js";
import { compileProGame } from "../src/lib/gameStudioPro/proCompiler.js";
import { newEmptyProGame } from "../src/lib/gameStudioPro/proModel.js";
import { normalizeAndRepair } from "../src/lib/gameStudio/postprocess.js";
import { brokenProQaFixture, cleanProQaFixture } from "./fixtures/proQaFixtures.js";

const codes = (result) => new Set(result.issues.map((i) => i.code));

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
