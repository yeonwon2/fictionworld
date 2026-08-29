import { buildGameBible, buildSceneContracts } from "./narrativeCompiler.js";

const norm = (value) => String(value || "").trim();
const key = (value) => norm(value).toLocaleLowerCase("vi");
const list = (value) => Array.isArray(value) ? value.map(norm).filter(Boolean) : [];
const issue = (severity, code, message, route = []) => ({ severity, code, message, route });

function initialState() {
  return { items: new Set(), flags: new Set(), knowledge: new Set(), stats: new Map() };
}

function openingState(contract = {}) {
  const state = initialState();
  // The opening scene establishes the campaign baseline before its first
  // choice. Treat its declared handoff as initialized context; later scenes
  // must still earn every handoff through their reveals/choice effects.
  const handoff = contract.handoff || {};
  for (const item of list(handoff.items)) state.items.add(key(item));
  for (const flag of list(handoff.flags)) state.flags.add(key(flag));
  for (const fact of list(handoff.knowledge)) state.knowledge.add(key(fact));
  for (const [name, value] of Object.entries(handoff.stats || {})) state.stats.set(key(name), Number(value) || 0);
  return state;
}

function cloneState(state) {
  return { items: new Set(state.items), flags: new Set(state.flags), knowledge: new Set(state.knowledge), stats: new Map(state.stats) };
}

function missingRequirements(contract = {}, state) {
  const req = contract.requires || {};
  const missing = [];
  for (const item of list(req.items)) if (!state.items.has(key(item))) missing.push(`vật phẩm “${item}”`);
  for (const flag of list(req.flags)) if (!state.flags.has(key(flag))) missing.push(`cờ “${flag}”`);
  for (const fact of list(req.knowledge)) if (!state.knowledge.has(key(fact))) missing.push(`kiến thức “${fact}”`);
  for (const [name, minimum] of Object.entries(req.stats || {})) if ((state.stats.get(key(name)) || 0) < Number(minimum)) missing.push(`${name} >= ${minimum}`);
  return missing;
}

function applyScene(contract = {}, state) {
  for (const fact of list(contract.reveals)) state.knowledge.add(key(fact));
  // `handoff` is the scene's guaranteed postcondition. It may come from the
  // narrated scene itself (not only from a choice effect), so materialize it
  // before exploring exits. Choice-specific grants are still applied below.
  const handoff = contract.handoff || {};
  for (const item of list(handoff.items)) state.items.add(key(item));
  for (const flag of list(handoff.flags)) state.flags.add(key(flag));
  for (const fact of list(handoff.knowledge)) state.knowledge.add(key(fact));
  for (const [name, value] of Object.entries(handoff.stats || {})) if (!state.stats.has(key(name))) state.stats.set(key(name), Number(value) || 0);
}

function choiceAllowed(effects, state) {
  if (effects.requireItems.some((x) => !state.items.has(key(x)))) return false;
  if (effects.requireFlags.some((x) => !state.flags.has(key(x)))) return false;
  if (effects.requireFlagsAbsent.some((x) => state.flags.has(key(x)))) return false;
  return effects.stats.filter((x) => !["+", "-"].includes(x.op)).every((x) => {
    const current = state.stats.get(key(x.name)) || 0;
    if (x.op === ">=" || x.op === ">") return current >= x.value;
    if (x.op === "<=" || x.op === "<") return current <= x.value;
    return true;
  });
}

function choiceMissing(effects, state) {
  const missing = [];
  for (const item of effects.requireItems) if (!state.items.has(key(item))) missing.push(`vật phẩm “${item}”`);
  for (const flag of effects.requireFlags) if (!state.flags.has(key(flag))) missing.push(`cờ “${flag}”`);
  for (const flag of effects.requireFlagsAbsent) if (state.flags.has(key(flag))) missing.push(`phải chưa có cờ “${flag}”`);
  for (const stat of effects.stats.filter((x) => !["+", "-"].includes(x.op))) {
    const current = state.stats.get(key(stat.name)) || 0;
    const ok = stat.op === ">=" ? current >= stat.value : stat.op === ">" ? current > stat.value : stat.op === "<=" ? current <= stat.value : stat.op === "<" ? current < stat.value : true;
    if (!ok) missing.push(`${stat.name} ${stat.op} ${stat.value} (tuyến này: ${current})`);
  }
  return missing;
}

function applyChoice(effects, state) {
  for (const item of effects.grantItems) state.items.add(key(item));
  for (const item of effects.removeItems) state.items.delete(key(item));
  for (const flag of effects.setFlags) state.flags.add(key(flag));
  for (const stat of effects.stats) if (stat.op === "+" || stat.op === "-") {
    const statKey = key(stat.name);
    state.stats.set(statKey, (state.stats.get(statKey) || 0) + (stat.op === "+" ? stat.value : -stat.value));
  }
}

function invariantViolations(invariants, { sceneId, ending, state }) {
  const violations = [];
  for (const rule of invariants || []) {
    const type = norm(rule.type);
    const value = key(rule.value);
    const field = norm(rule.field || "knowledge");
    const has = field === "item" || field === "items" ? state.items.has(value) : field === "flag" || field === "flags" ? state.flags.has(value) : state.knowledge.has(value);
    if (type === "ending_requires" && key(rule.ending) === key(ending) && !has) violations.push(rule);
    if (type === "fact_before_scene" && Number(rule.scene) === Number(sceneId) && !has) violations.push(rule);
    if (type === "forbid_before_scene" && Number(sceneId) < Number(rule.scene) && has) violations.push(rule);
  }
  return violations;
}

function signature(sceneId, state, statThresholds = new Map()) {
  const statBuckets = [...statThresholds].sort(([a], [b]) => a.localeCompare(b)).map(([name, thresholds]) => {
    const value = state.stats.get(name) || 0;
    return `${name}:${thresholds.filter((threshold) => value >= threshold).length}`;
  });
  return `${sceneId}|${[...state.items].sort()}|${[...state.flags].sort()}|${[...state.knowledge].sort()}|${statBuckets}`;
}

function collectStatThresholds(contracts) {
  const result = new Map();
  const add = (name, value) => {
    const stat = key(name);
    if (!stat || !Number.isFinite(Number(value))) return;
    if (!result.has(stat)) result.set(stat, new Set());
    result.get(stat).add(Number(value));
  };
  for (const scene of contracts) {
    for (const [name, value] of Object.entries(scene.stateContract?.requires?.stats || {})) add(name, value);
    for (const choice of scene.choices) for (const stat of choice.effects.stats) if (!["+", "-"].includes(stat.op)) add(stat.name, stat.value);
  }
  return new Map([...result].map(([name, values]) => [name, [...values].sort((a, b) => a - b)]));
}

// Explores distinct state-bearing routes. Equivalent states are merged, so a
// 100-scene graph stays bounded while item/flag/stat/knowledge differences are
// preserved instead of being flattened into a simple reachability graph.
export function analyzeStatefulNarrative({ project = {}, meta = {}, scenes = [], maxStates = 3000, maxSteps = 240 } = {}) {
  const bible = buildGameBible(project, meta);
  const contracts = buildSceneContracts(scenes);
  const byId = new Map(contracts.map((scene) => [scene.id, scene]));
  const invariants = meta?.invariants || bible?.invariants || meta?.game_bible?.invariants || [];
  const issues = [];
  const contractsDeclared = contracts.filter((scene) => scene.stateContract && Object.keys(scene.stateContract).length > 0).length;
  if (contracts.length && contractsDeclared < contracts.length) issues.push(issue("warning", "STATE_CONTRACT_COVERAGE", `Mới có ${contractsDeclared}/${contracts.length} cảnh khai báo state contract; các cảnh cũ vẫn chạy được nhưng tầng kiến thức/handoff chưa được kiểm tra đầy đủ.`));
  const endingStates = [];
  const blockedEndingStates = new Map();
  const reachedScenes = new Set();
  const reachedChoices = new Set();
  const seen = new Set();
  const statThresholds = collectStatThresholds(contracts);
  const queue = contracts.length ? [{ sceneId: contracts[0].id, state: openingState(contracts[0].stateContract), route: [], steps: 0 }] : [];

  while (queue.length && seen.size < maxStates) {
    // Đi sâu một tuyến tới ending trước rồi mới quay lại phủ biến thể. Với game
    // tuyến tính có 4 lựa chọn/cảnh, BFS tạo 4^N trạng thái và hết quota ở đầu
    // truyện dù một đường tới ending hoàn toàn rõ ràng.
    const current = queue.pop();
    const scene = byId.get(current.sceneId);
    if (!scene) continue;
    const sig = signature(scene.id, current.state, statThresholds);
    if (seen.has(sig)) continue;
    seen.add(sig);
    reachedScenes.add(scene.id);
    const route = [...current.route, `C${scene.id}`];
    if (current.steps >= maxSteps) { issues.push(issue("error", "STATE_ROUTE_LIMIT", `Tuyến qua cảnh ${scene.id} vượt ${maxSteps} bước, có thể đang lặp.`, route)); continue; }
    const missing = missingRequirements(scene.stateContract, current.state);
    if (missing.length) {
      if (scene.isCheckpoint) {
        issues.push(issue("warning", "CHECKPOINT_STATE_VARIANCE", `Checkpoint cảnh ${scene.id} nhận một tuyến chưa có ${missing.join(", ")}; cảnh hội tụ phải xử lý khác biệt này trong nội dung.`, route));
      } else {
        issues.push(issue("error", "SCENE_REQUIREMENT_UNMET", `Cảnh ${scene.id} được đi tới khi chưa đủ ${missing.join(", ")}.`, route));
        continue;
      }
    }
    const state = cloneState(current.state);
    applyScene(scene.stateContract, state);
    for (const forbidden of list(scene.stateContract?.forbids)) if (state.knowledge.has(key(forbidden))) issues.push(issue("error", "FORBIDDEN_KNOWLEDGE", `Cảnh ${scene.id} cấm tiết lộ “${forbidden}” nhưng tuyến này đã biết sự thật đó.`, route));
    for (const rule of invariantViolations(invariants, { sceneId: scene.id, state })) issues.push(issue("error", "INVARIANT_VIOLATION", `Vi phạm luật “${rule.description || rule.id || rule.type}” tại cảnh ${scene.id}.`, route));

    let playable = 0;
    for (const choice of scene.choices) {
      if (!choiceAllowed(choice.effects, state)) {
        if (choice.target.kind === "ending") {
          const missingChoice = choiceMissing(choice.effects, state);
          const previous = blockedEndingStates.get(choice.target.id);
          if (!previous || missingChoice.length < previous.missing.length) blockedEndingStates.set(choice.target.id, { ending: choice.target.id, sceneId: scene.id, choice: choice.text, missing: missingChoice, route });
        }
        continue;
      }
      playable++;
      reachedChoices.add(choice.id);
      const next = cloneState(state);
      applyChoice(choice.effects, next);
      if (choice.target.kind === "ending") {
        const broken = invariantViolations(invariants, { sceneId: scene.id, ending: choice.target.id, state: next });
        for (const rule of broken) issues.push(issue("error", "ENDING_INVARIANT_VIOLATION", `Kết thúc “${choice.target.id}” xảy ra khi chưa thỏa luật “${rule.description || rule.id || rule.type}”.`, [...route, choice.text]));
        endingStates.push({ ending: choice.target.id, valid: !broken.length, route: [...route, choice.text], state: next });
      } else if (choice.target.kind === "scene" && byId.has(choice.target.id)) queue.push({ sceneId: choice.target.id, state: next, route: [...route, choice.text], steps: current.steps + 1 });
    }
    if (!playable && scene.choices.length) issues.push(issue("error", "STATE_DEAD_END", `Cảnh ${scene.id} có lựa chọn nhưng không lựa chọn nào khả thi với trạng thái hiện tại.`, route));
  }
  if (queue.length) issues.push(issue("warning", "STATE_CAP_REACHED", `Đã chạm giới hạn ${maxStates} trạng thái; nên chia kịch bản thành chương/checkpoint để kiểm tra đầy đủ.`));
  const unique = new Map();
  for (const entry of issues) unique.set(`${entry.code}|${entry.message}|${entry.route.join(">")}`, entry);
  const finalIssues = [...unique.values()];
  const errors = finalIssues.filter((x) => x.severity === "error");
  return { version: 2, ok: errors.length === 0, issues: finalIssues, endings: endingStates, blockedEndings: [...blockedEndingStates.values()], coverage: { sceneIds: [...reachedScenes], choiceIds: [...reachedChoices] }, summary: { statesExplored: seen.size, contractsDeclared, totalContracts: contracts.length, endingsReached: endingStates.length, validEndings: endingStates.filter((x) => x.valid).length, errors: errors.length, warnings: finalIssues.length - errors.length } };
}
