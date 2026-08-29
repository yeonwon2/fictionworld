import { buildSceneContracts } from "./narrativeCompiler.js";
import { analyzeStatefulNarrative } from "./statefulCompiler.js";

const norm = (value) => String(value || "").trim().toLocaleLowerCase("vi").replace(/\s+/g, " ");
const finding = (severity, code, message, sceneId = null) => ({ severity, code, message, sceneId });

function effectSignature(effects = {}) {
  return JSON.stringify({
    items: [...(effects.grantItems || [])].map(norm).sort(),
    removed: [...(effects.removeItems || [])].map(norm).sort(),
    flags: [...(effects.setFlags || [])].map(norm).sort(),
    stats: [...(effects.stats || [])].map((x) => `${norm(x.name)}${x.op}${x.value}`).sort(),
  });
}

export function buildChapterMap(scenes = [], defaultChapterSize = 12) {
  const sorted = scenes.slice().sort((a, b) => Number(a.scene_order) - Number(b.scene_order));
  return sorted.map((scene, index) => ({
    sceneId: Number(scene.scene_order),
    chapter: Number(scene.chapter_index) || Math.floor(index / defaultChapterSize) + 1,
    checkpoint: !!scene.is_checkpoint || index === 0 || (index > 0 && (Number(scene.chapter_index) || Math.floor(index / defaultChapterSize) + 1) !== (Number(sorted[index - 1].chapter_index) || Math.floor((index - 1) / defaultChapterSize) + 1)),
  }));
}

export function analyzePhase3Narrative({ project = {}, meta = {}, scenes = [], maxStates = 5000 } = {}) {
  const contracts = buildSceneContracts(scenes);
  const stateful = analyzeStatefulNarrative({ project, meta, scenes, maxStates });
  const findings = [];
  const chapterMap = buildChapterMap(scenes);
  const reachedScenes = new Set(stateful.coverage?.sceneIds || []);
  const reachedChoiceIds = new Set(stateful.coverage?.choiceIds || []);
  const endingRoutes = stateful.endings.filter((x) => x.valid);
  for (const route of endingRoutes) for (const step of route.route || []) {
    const scene = String(step).match(/^C(\d+)$/)?.[1];
    if (scene) reachedScenes.add(Number(scene));
  }

  for (const scene of contracts) {
    const groups = new Map();
    for (const choice of scene.choices) {
      const signature = `${choice.target.kind}:${norm(choice.target.id)}|${effectSignature(choice.effects)}`;
      if (!groups.has(signature)) groups.set(signature, []);
      groups.get(signature).push(choice.text);
    }
    for (const choices of groups.values()) if (choices.length > 1) findings.push(finding("warning", "FAKE_CHOICE", `Cảnh ${scene.id} có ${choices.length} lựa chọn khác lời nhưng cùng đích và cùng hậu quả: “${choices.join("” / “")}”.`, scene.id));
  }

  const chapterIds = [...new Set(chapterMap.map((x) => x.chapter))];
  for (const chapter of chapterIds) {
    const rows = chapterMap.filter((x) => x.chapter === chapter);
    if (!rows.some((x) => x.checkpoint)) findings.push(finding("error", "CHAPTER_NO_CHECKPOINT", `Chương ${chapter} chưa có checkpoint trạng thái.`));
    if (rows.length > 20) findings.push(finding("warning", "CHAPTER_TOO_LARGE", `Chương ${chapter} có ${rows.length} cảnh; nên tách để AI và regression test giữ ngữ cảnh ổn định.`));
  }

  const endingNames = new Set(endingRoutes.map((x) => norm(x.ending)));
  for (const ending of meta?.endings || []) if (!endingNames.has(norm(ending.name))) {
    const nearMiss = stateful.blockedEndings?.find((entry) => norm(entry.ending) === norm(ending.name));
    const detail = nearMiss?.missing?.length ? ` Tuyến gần nhất còn thiếu: ${nearMiss.missing.join(", ")}.` : "";
    findings.push(finding("error", "ENDING_NO_VALID_ROUTE", `Kết thúc “${ending.name}” chưa có tuyến trạng thái hợp lệ trong regression suite.${detail}`));
  }
  for (const route of endingRoutes) if ((route.route || []).filter((x) => !/^C\d+$/.test(x)).length < 2) findings.push(finding("warning", "ENDING_TOO_EASY", `Kết thúc “${route.ending}” đạt được sau quá ít quyết định có ý nghĩa.`));

  const sceneCoverage = contracts.length ? reachedScenes.size / contracts.length : 0;
  const totalChoices = contracts.reduce((sum, scene) => sum + scene.choices.length, 0);
  const choiceCoverage = totalChoices ? reachedChoiceIds.size / totalChoices : 0;
  if (contracts.length && sceneCoverage < 0.8) findings.push(finding("warning", "LOW_SCENE_COVERAGE", `Regression suite mới phủ ${Math.round(sceneCoverage * 100)}% cảnh.`));
  if (totalChoices && choiceCoverage < 0.6) findings.push(finding("warning", "LOW_CHOICE_COVERAGE", `Regression suite mới phủ ${Math.round(choiceCoverage * 100)}% lựa chọn.`));

  const regressionCases = endingRoutes.slice(0, 100).map((route, index) => ({ id: `route-${index + 1}`, ending: route.ending, steps: route.route, expected: { ending: route.ending } }));
  const errors = findings.filter((x) => x.severity === "error");
  const warnings = findings.filter((x) => x.severity === "warning");
  const score = Math.max(0, Math.round(100 - errors.length * 15 - warnings.length * 4 - (1 - sceneCoverage) * 15 - (1 - choiceCoverage) * 10));
  return {
    version: 3,
    ok: stateful.ok && errors.length === 0,
    publishReady: stateful.ok && errors.length === 0 && sceneCoverage >= 0.8 && endingRoutes.length > 0,
    score, findings, chapterMap, regressionCases,
    coverage: { scenes: contracts.length, reachedScenes: reachedScenes.size, scenePercent: Math.round(sceneCoverage * 100), choices: totalChoices, reachedChoices: Math.round(choiceCoverage * totalChoices), choicePercent: Math.round(choiceCoverage * 100), validEndings: endingRoutes.length },
    summary: { chapters: chapterIds.length, checkpoints: chapterMap.filter((x) => x.checkpoint).length, errors: errors.length, warnings: warnings.length },
  };
}
