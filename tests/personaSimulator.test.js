import test from "node:test";
import assert from "node:assert/strict";
import { PERSONAS, runPersonaSimulation, deriveBalanceFindings } from "../src/lib/gameStudio/personaSimulator.js";

// Đồ thị nhỏ, cố tình "trừng phạt" lựa chọn liều lĩnh để hành vi từng persona
// là XÁC ĐỊNH (không cần random) — đúng dạng lỗi cân bằng đã gặp thật ở kịch
// bản "DƯỚI BÓNG PHÙ DUNG" (chỉ số sinh tử trừ quá nặng ở lựa chọn kịch tính).
function punishingGraph() {
  return {
    start_node: { id: "start_node", choices: [{ text: "Bắt đầu", targetNodeId: "scene_1" }] },
    scene_1: {
      id: "scene_1",
      text: "Cảnh 1",
      choices: [
        { text: "An toàn", targetNodeId: "scene_2", statModifiers: { hp: -2 } },
        { text: "Liều lĩnh", targetNodeId: "scene_2", statModifiers: { hp: -45 } },
      ],
    },
    scene_2: { id: "scene_2", text: "Cảnh 2", isEnding: true, endingType: "TRUE_END", choices: [] },
  };
}
const statsConfig = [{ key: "hp", label: "HP", default: 50, isVital: true, deathThreshold: 9 }];

test("reckless persona luôn chọn biến động chỉ số mạnh nhất và chết, cautious luôn an toàn", () => {
  const nodes = punishingGraph();
  const reckless = PERSONAS.find((p) => p.id === "reckless");
  const cautious = PERSONAS.find((p) => p.id === "cautious");
  const { personas } = runPersonaSimulation(nodes, statsConfig, { runsPerPersona: 20, personas: [reckless, cautious] });

  assert.equal(personas.reckless.deathRate, 1);
  assert.ok(personas.reckless.sampleDeathRoute);
  assert.equal(personas.reckless.sampleDeathRoute.route[0].sceneId, "start_node");
  assert.equal(personas.cautious.deathRate, 0);
  assert.equal(personas.cautious.endingCounts.scene_2, 20);
});

test("cùng seed cho kết quả giống hệt nhau (tái lập được cho test/regression)", () => {
  const nodes = punishingGraph();
  const random = PERSONAS.find((p) => p.id === "random");
  const a = runPersonaSimulation(nodes, statsConfig, { runsPerPersona: 30, personas: [random], seed: 12345 });
  const b = runPersonaSimulation(nodes, statsConfig, { runsPerPersona: 30, personas: [random], seed: 12345 });
  assert.deepEqual(a.personas.random.endingCounts, b.personas.random.endingCounts);
  assert.equal(a.personas.random.deathRate, b.personas.random.deathRate);
});

test("deriveBalanceFindings báo BALANCE_EARLY_TERMINATION khi persona tự nhiên chết sớm đa số", () => {
  const bad = {
    totalScenes: 100,
    personas: {
      reckless: { label: "Liều lĩnh", deathRate: 0.9, avgDepth: 5, sampleDeathRoute: { route: [{ sceneId: "scene_1", choiceIndex: 1 }], deadStat: "hp" } },
      greedy: { label: "Tham lam", deathRate: 0.8, avgDepth: 4, sampleDeathRoute: { route: [{ sceneId: "scene_1", choiceIndex: 1 }], deadStat: "hp" } },
      cautious: { label: "Cẩn thận", deathRate: 0.7, avgDepth: 6, sampleDeathRoute: { route: [{ sceneId: "scene_1", choiceIndex: 1 }], deadStat: "hp" } },
      random: { label: "Ngẫu nhiên", deathRate: 0.85, avgDepth: 5, sampleDeathRoute: { route: [{ sceneId: "scene_1", choiceIndex: 1 }], deadStat: "hp" } },
      he_seeking: { label: "Cố đạt HE", deathRate: 0, avgDepth: 90, sampleDeathRoute: null },
      griefer: { label: "Phá game", deathRate: 1, avgDepth: 2, sampleDeathRoute: { route: [], deadStat: "hp" } },
    },
  };
  const findings = deriveBalanceFindings(bad);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, "BALANCE_EARLY_TERMINATION");
  assert.equal(findings[0].severity, "medium");
  assert.equal(findings[0].personaId, "reckless");
});

test("deriveBalanceFindings bắt được cả khi chỉ 1 persona tự nhiên chết sớm hàng loạt (không bị pha loãng bởi trung bình)", () => {
  const oneBadPersona = {
    totalScenes: 114,
    personas: {
      reckless: { label: "Liều lĩnh", deathRate: 0, avgDepth: 100, sampleDeathRoute: null },
      greedy: { label: "Tham lam", deathRate: 0, avgDepth: 95, sampleDeathRoute: null },
      cautious: { label: "Cẩn thận", deathRate: 0.51, avgDepth: 8.8, sampleDeathRoute: { route: [{ sceneId: "scene_1", choiceIndex: 0 }], deadStat: "diem_tac_hop" } },
      random: { label: "Ngẫu nhiên", deathRate: 0.14, avgDepth: 90, sampleDeathRoute: null },
      he_seeking: { label: "Cố đạt HE", deathRate: 0, avgDepth: 100, sampleDeathRoute: null },
      griefer: { label: "Phá game", deathRate: 0.93, avgDepth: 6.3, sampleDeathRoute: { route: [], deadStat: "diem_tac_hop" } },
    },
  };
  const findings = deriveBalanceFindings(oneBadPersona);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].personaId, "cautious");
});

test("deriveBalanceFindings im lặng khi kịch bản cân bằng tốt", () => {
  const good = {
    totalScenes: 100,
    personas: {
      reckless: { deathRate: 0.1, avgDepth: 90, sampleDeathRoute: null },
      greedy: { deathRate: 0.05, avgDepth: 92, sampleDeathRoute: null },
      cautious: { deathRate: 0, avgDepth: 95, sampleDeathRoute: null },
      random: { deathRate: 0.1, avgDepth: 88, sampleDeathRoute: null },
      he_seeking: { deathRate: 0, avgDepth: 96, sampleDeathRoute: null },
      griefer: { deathRate: 0.9, avgDepth: 10, sampleDeathRoute: { route: [], deadStat: "hp" } },
    },
  };
  assert.deepEqual(deriveBalanceFindings(good), []);
});
