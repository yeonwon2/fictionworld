import { newEmptyGlobalState } from "../../src/lib/gameStudioPro/globalStateModel.js";

const choice = (id, text, targetType, targetId, conditions = [], effects = []) => ({ id, text, targetType, targetId, gateIntent: "", rules: { conditions, effects }, conditionalOutcomes: [] });
const scene = (id, title, role, choices = []) => ({ id, title, role, intent: title, choices, locked: false });
const ending = (id, title, tone = "neutral") => ({ id, title, text: title, tone });

export function cleanProQaFixture() {
  const stats = [{ id: "stat_rep", kind: "stat", displayName: "Uy tín", default: 0, isVital: false }];
  const flags = [{ id: "flag_saved", kind: "flag", displayName: "Đã cứu Tiểu Lan" }];
  const items = [{ id: "item_scarf", kind: "item", displayName: "Khăn thêu" }];
  const registry = { stats, relationships: [], flags, items };
  const ep1 = {
    id: "ep1", order: 1, title: "Gặp gỡ", stages: [{ approximateSceneCount: 5 }],
    planningIntents: [{ type: "side_branch" }, { type: "convergence" }, { type: "item_gate" }, { type: "relationship_or_flag_gate" }, { type: "non_lethal_failure" }, { type: "instant_failure" }],
  };
  ep1.sceneBlueprint = { episodeId: ep1.id, startSceneId: "e1_start", registry, endings: [ending("death", "Chết", "death")], scenes: [
    scene("e1_start", "Mở đầu", "decision", [
      choice("a", "Giúp Tiểu Lan", "scene", "side", [], [{ type: "grant_flag", entityId: "flag_saved" }, { type: "grant_item", entityId: "item_scarf" }]),
      choice("b", "Đi đường chính", "scene", "consequence", [], [{ type: "stat_change", entityId: "stat_rep", amount: 5 }]),
      choice("c", "Lao vào nguy hiểm", "ending", "death"),
    ]),
    scene("side", "Nhánh Tiểu Lan", "side", [choice("s", "Trở lại", "scene", "join")]),
    scene("consequence", "Bị khiển trách nhưng sống", "consequence", [choice("f", "Đứng dậy", "scene", "join")]),
    scene("join", "Hội tụ", "convergence", [choice("j", "Qua cổng", "scene", "gate", [{ type: "flag_present", entityId: "flag_saved" }])]),
    scene("gate", "Cổng khăn thêu", "condition", [choice("g", "Đưa khăn", "episode", "ep2", [{ type: "item_present", entityId: "item_scarf" }, { type: "stat_compare", entityId: "stat_rep", operator: ">=", value: 0 }])]),
  ] };
  const ep2 = { id: "ep2", order: 2, title: "Hồi kết", stages: [{ approximateSceneCount: 1 }], planningIntents: [] };
  ep2.sceneBlueprint = { episodeId: ep2.id, startSceneId: "e2_start", registry, endings: [ending("good", "Đoàn viên", "good")], scenes: [scene("e2_start", "Kết cuộc", "story", [choice("end", "Khép lại", "ending", "good")])] };
  return { title: "Clean QA", storyBlueprint: { episodes: [ep1, ep2] }, globalState: { ...newEmptyGlobalState(), startEpisodeId: "ep1", registry }, mechanics: { enabled: [], configs: { currency: [], rank: [], quest: [], system: {} } } };
}

export function brokenProQaFixture() {
  const stats = [{ id: "stat_rep", kind: "stat", displayName: "Uy tín", default: 0, isVital: false }];
  const flags = [{ id: "flag_saved", kind: "flag", displayName: "Đã cứu Tiểu Lan" }];
  const items = [{ id: "item_scarf", kind: "item", displayName: "Khăn thêu" }];
  const registry = { stats, relationships: [], flags, items };
  const ep1 = { id: "ep1", order: 1, title: "Tập lỗi", stages: [{ approximateSceneCount: 8 }], planningIntents: [{ type: "side_branch" }, { type: "convergence" }, { type: "item_gate" }] };
  ep1.sceneBlueprint = { episodeId: ep1.id, startSceneId: "start", registry, endings: [ending("reachable_end", "Kết thật"), ending("orphan_end", "Kết mồ côi")], scenes: [
    scene("start", "Yến Trung Thu", "decision", [
      choice("clean_a", "Nhánh sạch A", "scene", "clean_join"),
      choice("clean_b", "Nhánh sạch B", "scene", "clean_join"),
      choice("missing", "Lựa chọn B", null, null),
      choice("gated", "Dùng khăn và cờ", "ending", "reachable_end", [{ type: "item_present", entityId: "item_scarf" }, { type: "flag_present", entityId: "flag_saved" }, { type: "stat_compare", entityId: "stat_rep", operator: ">=", value: 200 }, { type: "stat_compare", entityId: "stat_rep", operator: "<=", value: 20 }]),
    ]),
    scene("clean_join", "Nhánh sạch hội tụ", "convergence", [choice("next", "Sang tập hỏng", "episode", "missing_ep")]),
    scene("unreachable", "Cảnh không tới được", "story", [choice("u", "Kết", "ending", "orphan_end")]),
    scene("side_orphan", "Nhánh phụ bỏ quên", "side", [choice("so", "Kết", "ending", "orphan_end")]),
    scene("weak_join", "Hội tụ một lối", "convergence", [choice("wj", "Kết", "ending", "orphan_end")]),
    scene("orphan_consequence", "Hệ quả mồ côi", "consequence", [choice("oc", "Kết", "ending", "orphan_end")]),
  ] };
  const ep2 = { id: "ep2", order: 2, title: "Tập cuối cụt", stages: [], planningIntents: [] };
  ep2.sceneBlueprint = { episodeId: ep2.id, startSceneId: "e2", registry, endings: [ending("never", "Kết không tới")], scenes: [scene("e2", "Cảnh cuối cụt", "story", [])] };
  return { title: "Broken QA", storyBlueprint: { episodes: [ep1, ep2] }, globalState: { ...newEmptyGlobalState(), startEpisodeId: "ep1", registry }, mechanics: { enabled: ["rank"], configs: { currency: [], rank: [{ id: "rank1", label: "Phẩm cấp", entityId: "deleted_stat", levels: [] }], quest: [], system: {} } } };
}
