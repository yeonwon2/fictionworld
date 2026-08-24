// Narrative design compiler for the planning layer. It deliberately works on
// game_plan_* JSON, before prose/script generation, so structural mistakes are
// caught while they are still cheap to fix. The exported script remains the
// legacy Markdown format and is not affected by this internal representation.

import { effectLines } from "./quotaPlanner.js";

const norm = (value) => String(value || "").trim();
const key = (value) => norm(value).toLocaleLowerCase("vi");

function parseTarget(raw) {
  const value = norm(raw);
  const scene = value.match(/(?:cảnh|scene)\s*#?\s*(\d+)/i);
  if (scene) return { kind: "scene", id: Number(scene[1]), raw: value };
  const ending = value.match(/(?:kết\s*thúc|ending)\s*[:\-]?\s*(.+)$/i);
  if (ending) return { kind: "ending", id: norm(ending[1]), raw: value };
  return { kind: "unknown", id: value, raw: value };
}

function parseEffect(raw) {
  const normalized = effectLines(raw).join("; ");
  const text = norm(raw);
  const effects = { grantItems: [], removeItems: [], setFlags: [], requireItems: [], requireFlags: [], requireFlagsAbsent: [], stats: [], raw: text };
  const patterns = [
    ["grantItems", /(?:^|[;\n])\s*(?:→\s*)?(?:vật phẩm|nhận vật phẩm|item)\s*:\s*([^;\n,]+)/gi],
    ["removeItems", /(?:^|[;\n])\s*(?:→\s*)?(?:mất|xóa|xoá)\s+(?:vật phẩm|item)\s*:\s*([^;\n,]+)/gi],
    ["setFlags", /(?:^|[;\n])\s*(?:→\s*)?(?:cờ|đặt cờ|flag)\s*:\s*([^;\n,]+)/gi],
    ["requireItems", /(?:^|[;\n])\s*(?:→\s*)?(?:cần|yêu cầu)\s+(?:vật phẩm|item)\s*:\s*([^;\n,]+)/gi],
    ["requireFlags", /(?:^|[;\n])\s*(?:→\s*)?(?:cần|yêu cầu)\s+(?:cờ|flag)\s*:\s*([^;\n,]+)/gi],
    ["requireFlagsAbsent", /(?:^|[;\n])\s*(?:→\s*)?(?:cần|yêu cầu)\s+(?:không có|chưa có)\s+(?:cờ|flag)\s*:\s*([^;\n,]+)/gi],
  ];
  for (const [field, regex] of patterns) {
    let match;
    while ((match = regex.exec(text))) effects[field].push(norm(match[1]));
  }
  const statRe = /(?:chỉ số\s*)?([^:;+\-\n]+?)\s*([+\-]\s*\d+|>=?\s*-?\d+|<=?\s*-?\d+)/gi;
  let match;
  while ((match = statRe.exec(text))) {
    const opValue = match[2].replace(/\s/g, "");
    const op = opValue.match(/^[+\-]|^>=|^<=|^>|^</)?.[0] || "+";
    effects.stats.push({ name: norm(match[1]).replace(/^→\s*/, "").replace(/^(?:cần|yêu cầu)\s+/i, ""), op, value: Number(opValue.slice(op.length)) });
  }
  const parsedCount = effects.grantItems.length + effects.removeItems.length + effects.setFlags.length + effects.requireItems.length + effects.requireFlags.length + effects.requireFlagsAbsent.length + effects.stats.length;
  if (!parsedCount && normalized && normalized !== text) return parseEffect(normalized);
  return effects;
}

export function buildGameBible(project = {}, meta = {}) {
  project = project || {};
  meta = meta || {};
  return {
    version: 1,
    identity: { title: norm(project.title), workshop: project.workshop || "studio", genre: norm(project.genre) },
    player: { name: norm(project.player_name || meta.player_name), background: norm(project.player_desc || meta.player_desc), mainQuest: norm(project.main_quest || meta.main_quest) },
    rules: { targetScenes: Number(project.scene_count) || 0, choicesPerScene: Number(project.choices_per_scene) || 0, targetBranches: Number(project.branch_count) || 0 },
    characters: meta.characters || [], settings: meta.settings || [], branches: meta.branches || [], endings: meta.endings || [], invariants: meta.invariants || meta.game_bible?.invariants || [], notes: norm(meta.notes || project.notes),
  };
}

export function buildSceneContracts(scenes = []) {
  return scenes.slice().sort((a, b) => Number(a.scene_order) - Number(b.scene_order)).map((scene) => ({
    id: Number(scene.scene_order), title: norm(scene.title), purpose: norm(scene.description),
    location: norm(scene.location), characters: norm(scene.characters), foreshadow: norm(scene.foreshadow),
    stateContract: scene.state_contract || scene.stateContract || {},
    branchIndex: scene.branch_index == null ? null : Number(scene.branch_index), isBranchPoint: !!scene.is_branch_point,
    isCheckpoint: !!(scene.is_checkpoint ?? scene.isCheckpoint),
    choices: (scene.choices || []).map((choice, index) => ({
      id: `${Number(scene.scene_order)}:${index + 1}`, text: norm(choice.text), target: parseTarget(choice.target), effects: parseEffect(choice.effect),
    })),
  }));
}

const issue = (severity, code, message, sceneId = null, choiceId = null) => ({ severity, code, message, sceneId, choiceId });

export function compileNarrativePlan({ project = {}, meta = {}, scenes = [], complete = true } = {}) {
  project = project || {};
  meta = meta || {};
  const bible = buildGameBible(project, meta);
  const contracts = buildSceneContracts(scenes);
  const issues = [];
  const sceneIds = new Set(contracts.map((s) => s.id));
  const endings = new Map((bible.endings || []).map((e) => [key(e.name), e]));
  const adjacency = new Map(contracts.map((s) => [s.id, []]));
  const endingRefs = new Set();
  const grantedItems = new Set(), grantedFlags = new Set();
  const requiredItems = [], requiredFlags = [];
  const statDelta = new Map(), statRequirements = [];
  const directEndingScenes = new Set();

  if (!bible.player.name) issues.push(issue("error", "BIBLE_PLAYER_MISSING", "Game Bible chưa xác định nhân vật người chơi."));
  if (!bible.player.mainQuest) issues.push(issue("error", "BIBLE_QUEST_MISSING", "Game Bible chưa xác định nhiệm vụ chính."));

  for (const scene of contracts) {
    if (!scene.choices.length) issues.push(issue("error", "DEAD_END", `Cảnh ${scene.id} không có lựa chọn hoặc kết thúc.`, scene.id));
    for (const choice of scene.choices) {
      const target = choice.target;
      if (target.kind === "scene") {
        if (!sceneIds.has(target.id)) {
          if (complete) issues.push(issue("error", "MISSING_DESTINATION", `Cảnh ${scene.id}, lựa chọn “${choice.text || choice.id}” trỏ tới cảnh ${target.id} không tồn tại.`, scene.id, choice.id));
        } else adjacency.get(scene.id).push(target.id);
      } else if (target.kind === "ending") {
        endingRefs.add(key(target.id));
        directEndingScenes.add(scene.id);
        if (endings.size && !endings.has(key(target.id))) issues.push(issue("error", "MISSING_ENDING", `Cảnh ${scene.id} trỏ tới kết thúc “${target.id}” chưa có trong Game Bible.`, scene.id, choice.id));
      } else if (complete) issues.push(issue("error", "UNKNOWN_DESTINATION", `Cảnh ${scene.id}, lựa chọn “${choice.text || choice.id}” chưa có đích hợp lệ (cảnh N hoặc kết thúc Tên).`, scene.id, choice.id));
      choice.effects.grantItems.forEach((x) => grantedItems.add(key(x)));
      choice.effects.setFlags.forEach((x) => grantedFlags.add(key(x)));
      choice.effects.requireItems.forEach((x) => requiredItems.push([key(x), scene, choice, x]));
      choice.effects.requireFlags.forEach((x) => requiredFlags.push([key(x), scene, choice, x]));
      for (const stat of choice.effects.stats) {
        const statKey = key(stat.name);
        if (stat.op === "+" || stat.op === "-") statDelta.set(statKey, (statDelta.get(statKey) || 0) + (stat.op === "+" ? stat.value : -stat.value));
        else statRequirements.push([statKey, stat, scene, choice]);
      }
    }
  }

  const start = contracts[0]?.id;
  const reachable = new Set(start == null ? [] : [start]);
  const queue = start == null ? [] : [start];
  while (queue.length) for (const next of adjacency.get(queue.shift()) || []) if (!reachable.has(next)) { reachable.add(next); queue.push(next); }
  const reverse = new Map(contracts.map((s) => [s.id, []]));
  for (const [from, targets] of adjacency) for (const to of targets) reverse.get(to)?.push(from);
  const canReachEnding = new Set(directEndingScenes), endingQueue = [...directEndingScenes];
  while (endingQueue.length) for (const previous of reverse.get(endingQueue.shift()) || []) if (!canReachEnding.has(previous)) { canReachEnding.add(previous); endingQueue.push(previous); }
  if (complete) for (const scene of contracts) if (!reachable.has(scene.id)) issues.push(issue("error", "UNREACHABLE_SCENE", `Cảnh ${scene.id} không thể đến được từ cảnh mở đầu.`, scene.id));
  if (complete) for (const scene of contracts) if (reachable.has(scene.id) && !canReachEnding.has(scene.id)) issues.push(issue("error", "TRAPPED_PATH", `Cảnh ${scene.id} nằm trên tuyến không thể đi tới bất kỳ kết thúc nào (có thể là vòng lặp kín).`, scene.id));
  if (complete) for (const [endingName, ending] of endings) if (!endingRefs.has(endingName)) issues.push(issue("error", "ORPHAN_ENDING", `Kết thúc “${ending.name}” không có lựa chọn nào dẫn tới.`));
  for (const [, scene, choice, label] of requiredItems) if (!grantedItems.has(key(label))) issues.push(issue("error", "ITEM_INFEASIBLE", `Cảnh ${scene.id} yêu cầu vật phẩm “${label}” nhưng không cảnh nào cấp vật phẩm này.`, scene.id, choice.id));
  for (const [, scene, choice, label] of requiredFlags) if (!grantedFlags.has(key(label))) issues.push(issue("error", "FLAG_INFEASIBLE", `Cảnh ${scene.id} yêu cầu cờ “${label}” nhưng không cảnh nào tạo cờ này.`, scene.id, choice.id));
  for (const [statKey, requirement, scene, choice] of statRequirements) {
    const possible = statDelta.get(statKey) || 0;
    if ((requirement.op.startsWith(">") && possible < requirement.value) || (requirement.op.startsWith("<") && Math.min(0, possible) > requirement.value)) {
      issues.push(issue("error", "STAT_INFEASIBLE", `Cảnh ${scene.id} yêu cầu chỉ số “${requirement.name} ${requirement.op} ${requirement.value}” nhưng tổng biến thiên khả dụng chỉ là ${possible} từ mức mặc định 0.`, scene.id, choice.id));
    }
  }
  for (const item of grantedItems) if (!requiredItems.some(([x]) => x === item)) issues.push(issue("warning", "ORPHAN_ITEM", `Vật phẩm “${item}” được cấp nhưng chưa được dùng làm điều kiện.`));
  for (const flag of grantedFlags) if (!requiredFlags.some(([x]) => x === flag)) issues.push(issue("warning", "ORPHAN_FLAG", `Cờ “${flag}” được tạo nhưng chưa được dùng làm điều kiện.`));

  const errors = issues.filter((x) => x.severity === "error");
  return { version: 1, ok: errors.length === 0, bible, contracts, issues, summary: { scenes: contracts.length, reachableScenes: reachable.size, endings: endings.size, reachableEndings: endingRefs.size, errors: errors.length, warnings: issues.length - errors.length } };
}

// Enumerates representative playable paths without mutating the plan. The
// route cap and per-scene visit cap keep large/cyclic graphs responsive in UI.
export function simulateNarrativeRoutes({ scenes = [], maxRoutes = 24, maxSteps = 160 } = {}) {
  const contracts = buildSceneContracts(scenes);
  if (!contracts.length) return [];
  const byId = new Map(contracts.map((scene) => [scene.id, scene]));
  const routes = [];
  const stack = [{ sceneId: contracts[0].id, steps: [], visits: new Map() }];
  while (stack.length && routes.length < maxRoutes) {
    const state = stack.pop();
    const scene = byId.get(state.sceneId);
    if (!scene) continue;
    const visits = new Map(state.visits);
    visits.set(scene.id, (visits.get(scene.id) || 0) + 1);
    if (visits.get(scene.id) > 2 || state.steps.length >= maxSteps) {
      routes.push({ status: "cycle", ending: "Vòng lặp/chạm giới hạn", steps: state.steps.concat({ sceneId: scene.id, title: scene.title }) });
      continue;
    }
    if (!scene.choices.length) {
      routes.push({ status: "dead-end", ending: "Ngõ cụt", steps: state.steps.concat({ sceneId: scene.id, title: scene.title }) });
      continue;
    }
    for (let index = scene.choices.length - 1; index >= 0; index--) {
      const choice = scene.choices[index];
      const steps = state.steps.concat({ sceneId: scene.id, title: scene.title, choice: choice.text, choiceId: choice.id });
      if (choice.target.kind === "ending") routes.push({ status: "ending", ending: choice.target.id, steps });
      else if (choice.target.kind === "scene" && byId.has(choice.target.id)) stack.push({ sceneId: choice.target.id, steps, visits });
      else routes.push({ status: "broken", ending: choice.target.raw || "Thiếu đích", steps });
      if (routes.length >= maxRoutes) break;
    }
  }
  return routes.slice(0, maxRoutes);
}

// Repairs only graph wiring that has an unambiguous safe fallback. Narrative
// prose/effects are preserved; item/flag/stat feasibility remains author/AI
// work because inventing those facts automatically can change story meaning.
export function repairNarrativePlan({ scenes = [], meta = {} } = {}) {
  const sorted = scenes.slice().sort((a, b) => Number(a.scene_order) - Number(b.scene_order));
  const ids = new Set(sorted.map((scene) => Number(scene.scene_order)));
  const endingNames = (meta.endings || []).map((ending) => norm(ending.name)).filter(Boolean);
  const fallbackEnding = endingNames[0] || "Kết thúc";
  const changes = [];
  const nextTarget = (index) => index < sorted.length - 1 ? `cảnh ${sorted[index + 1].scene_order}` : `kết thúc ${fallbackEnding}`;
  const repaired = sorted.map((scene, index) => {
    let choices = (scene.choices || []).map((choice, choiceIndex) => {
      const target = parseTarget(choice.target);
      const invalid = target.kind === "unknown" || (target.kind === "scene" && !ids.has(target.id));
      if (!invalid) return choice;
      const replacement = nextTarget(index);
      changes.push({ sceneId: Number(scene.scene_order), choiceIndex, from: norm(choice.target), to: replacement, reason: "Đích thiếu hoặc không hợp lệ" });
      return { ...choice, target: replacement };
    });
    if (!choices.length) {
      const target = nextTarget(index);
      choices = [{ text: index < sorted.length - 1 ? "Tiếp tục" : "Khép lại câu chuyện", effect: "", target }];
      changes.push({ sceneId: Number(scene.scene_order), choiceIndex: 0, from: "", to: target, reason: "Cảnh không có lựa chọn" });
    }
    return { ...scene, choices };
  });

  // A sequential bridge is the least surprising way to reconnect an orphan:
  // add it from the closest earlier scene while preserving existing choices.
  let report = compileNarrativePlan({ project: { player_name: "_", main_quest: "_" }, meta, scenes: repaired });
  for (const orphan of report.issues.filter((entry) => entry.code === "UNREACHABLE_SCENE").sort((a, b) => a.sceneId - b.sceneId)) {
    const index = repaired.findIndex((scene) => Number(scene.scene_order) === orphan.sceneId);
    if (index <= 0) continue;
    const previous = repaired[index - 1];
    const target = `cảnh ${orphan.sceneId}`;
    if (!(previous.choices || []).some((choice) => parseTarget(choice.target).kind === "scene" && parseTarget(choice.target).id === orphan.sceneId)) {
      previous.choices = [...(previous.choices || []), { text: `Đi tiếp tới ${repaired[index].title || `cảnh ${orphan.sceneId}`}`, effect: "", target }];
      changes.push({ sceneId: Number(previous.scene_order), choiceIndex: previous.choices.length - 1, from: "", to: target, reason: "Nối lại cảnh mồ côi" });
    }
  }

  // Make every declared ending reachable, without rewriting an existing path.
  report = compileNarrativePlan({ project: { player_name: "_", main_quest: "_" }, meta, scenes: repaired });
  const last = repaired[repaired.length - 1];
  for (const orphan of report.issues.filter((entry) => entry.code === "ORPHAN_ENDING")) {
    const name = orphan.message.match(/“(.+?)”/)?.[1];
    if (!name || !last) continue;
    last.choices = [...(last.choices || []), { text: `Đi tới kết thúc: ${name}`, effect: "", target: `kết thúc ${name}` }];
    changes.push({ sceneId: Number(last.scene_order), choiceIndex: last.choices.length - 1, from: "", to: `kết thúc ${name}`, reason: "Nối ending mồ côi" });
  }
  return { scenes: repaired, changes };
}
