import test from "node:test";
import assert from "node:assert/strict";
import { deriveWorkflowState, findEntityReferences, INITIAL_SAVE_STATE, saveStateReducer, switchEpisodeWithoutMutation } from "../src/lib/gameStudioPro/workflowState.js";
import { generateExternalAiPrompt } from "../src/lib/gameStudioPro/scriptPromptGenerator.js";
import { cleanProQaFixture } from "./fixtures/proQaFixtures.js";

const qa = (errors = 0) => ({ blocking: errors > 0, summary: { error: errors } });
const doc = (patch = {}) => ({ storyBlueprint: { idea: "Một game", status: "approved", episodes: [], ...patch } });

test("workflow: empty game starts at Idea", () => assert.equal(deriveWorkflowState({}, qa()).currentStep, "idea"));
test("workflow: idea without approved plan points to Planner", () => assert.equal(deriveWorkflowState(doc({ status: "planned" }), qa()).nextAction.mode, "plan"));
test("workflow: approved episode without graph points to Build Graph", () => assert.equal(deriveWorkflowState(doc({ episodes: [{ id: "ep1" }] }), qa()).nextAction.mode, "mindmap"));
test("workflow: graph with QA errors points to fixing QA", () => assert.equal(deriveWorkflowState(doc({ episodes: [{ id: "ep1", sceneBlueprint: { scenes: [{}] } }] }), qa(3)).currentStep, "qa"));
test("workflow: clean graph points to Play", () => assert.equal(deriveWorkflowState(doc({ episodes: [{ id: "ep1", sceneBlueprint: { scenes: [{}] } }] }), qa()).nextAction.mode, "play"));
test("workflow: blocking QA disables export", () => assert.equal(deriveWorkflowState(doc({ episodes: [{ id: "ep1", sceneBlueprint: { scenes: [{}] } }] }), qa(1)).canExport, false));
test("workflow: clean QA enables export", () => assert.equal(deriveWorkflowState(doc({ episodes: [{ id: "ep1", sceneBlueprint: { scenes: [{}] } }] }), qa()).canExport, true));
test("episode switching preserves authored source by identity", () => { const source = doc({ episodes: [{ id: "a", note: "kept" }, { id: "b" }] }); assert.equal(switchEpisodeWithoutMutation(source, "b").doc, source); });
test("save state covers saving, saved and persistent error", () => { let state = saveStateReducer(INITIAL_SAVE_STATE, { type: "saving" }); assert.equal(state.status, "saving"); state = saveStateReducer(state, { type: "saved", at: new Date(0) }); assert.equal(state.status, "saved"); state = saveStateReducer(state, { type: "error", error: "offline" }); assert.deepEqual([state.status, state.error], ["error", "offline"]); });
test("destructive helper identifies referenced entity", () => { const source = doc({ episodes: [{ id: "ep1", sceneBlueprint: { scenes: [{ id: "s1", choices: [{ id: "c1", rules: { conditions: [{ entityId: "item_1" }], effects: [] } }] }] } }] }); assert.deepEqual(findEntityReferences(source, "item_1"), [{ episodeId: "ep1", sceneId: "s1", choiceId: "c1" }]); });
test("PHƯỢNG ĐỒ smoke: external prompt carries episode, state, mechanics and existing scenes", () => {
  const source = cleanProQaFixture();
  source.title = "PHƯỢNG ĐỒ";
  source.storyBlueprint.gamePlan = { title: source.title, premise: "Cung đấu bách hợp", importantCharacters: ["Lệ Phi", "Hoàng hậu"] };
  source.mechanics.enabled = ["inventory", "relationships"];
  const episode = source.storyBlueprint.episodes[0];
  episode.goal = "Cứu Tiểu Lan và sống sót qua buổi thẩm vấn";
  const prompt = generateExternalAiPrompt({ gamePlan: source.storyBlueprint.gamePlan, episode, blueprint: episode.sceneBlueprint, mechanics: source.mechanics });
  for (const expected of ["PHƯỢNG ĐỒ", episode.title, episode.goal, "Uy tín", "Đã cứu Tiểu Lan", "Khăn thêu", "Cơ chế đang bật", "Mở đầu", "FICTIONWORLD PRO SCRIPT v1"]) assert.match(prompt, new RegExp(expected));
});
