// Xưởng Game Pro — PRO 4: SCRIPT NORMALIZER & ENTITY RESOLVER
//
// Chuyển đổi AST từ scriptParser.js thành Canonical Pro Blueprint (blueprintModel.js)
// cùng Canonical Rule IR (ruleModel.js) và Entity Registry (entityRegistry.js).
import {
  SCENE_ROLES,
  newSceneBlueprint,
  newScene,
  newChoice,
  newEnding,
  newOutcomeBranch,
} from "./blueprintModel.js";
import {
  newEmptyRegistry,
  ensureRegistry,
  addStatEntity,
  addRelationshipEntity,
  addFlagEntity,
  addItemEntity,
  resolveEntity,
  ENTITY_KINDS,
} from "./entityRegistry.js";
import {
  parseConditionsDeterministic,
  parseEffectsDeterministic,
} from "./ruleParser.js";

function normalizeForLookup(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeProScriptAst(ast, { episodeId = "ep_1", existingRegistry = null } = {}) {
  const issues = []; // { line, message, type: "error" | "warning" }
  const recordIssue = (line, message, type = "error") => {
    issues.push({ line: Number(line) || 1, message: String(message || ""), type });
  };

  if (!ast || !Array.isArray(ast.scenes)) {
    recordIssue(1, "AST kịch bản không hợp lệ.");
    return { blueprint: null, issues, newEntities: { stats: [], flags: [], items: [] } };
  }

  // 1. Khởi tạo / Cập nhật Registry
  let registry = existingRegistry ? ensureRegistry({ registry: existingRegistry }) : newEmptyRegistry();
  const newEntities = { stats: [], flags: [], items: [] };

  // Nạp stats từ khai báo
  for (const s of ast.stats || []) {
    const existing = resolveEntity(registry, "stat", s.name);
    if (existing.status !== "matched") {
      registry = addStatEntity(registry, {
        displayName: s.name,
        default: s.initial ?? 0,
        isVital: !!s.isVital,
        deathThreshold: s.deathThreshold,
      });
      const created = registry.stats[registry.stats.length - 1];
      newEntities.stats.push(created);
    } else if (existing.entity) {
      if (Number.isFinite(s.initial)) {
        existing.entity.default = s.initial;
      }
      if (s.isVital !== undefined) {
        existing.entity.isVital = !!s.isVital;
      }
      if (Number.isFinite(s.deathThreshold)) {
        existing.entity.deathThreshold = s.deathThreshold;
      }
    }
  }

  // Nạp relationships từ khai báo
  for (const r of ast.relationships || []) {
    const existing = resolveEntity(registry, "relationship", r.name);
    if (existing.status !== "matched") {
      registry = addRelationshipEntity(registry, {
        displayName: r.name,
        npc: r.npc || r.name,
        default: r.initial ?? 0,
      });
      const created = registry.stats[registry.stats.length - 1];
      newEntities.stats.push(created);
    }
  }

  // Nạp flags từ khai báo
  for (const f of ast.flags || []) {
    const existing = resolveEntity(registry, ENTITY_KINDS.FLAG, f.name);
    if (existing.status !== "matched") {
      registry = addFlagEntity(registry, f.name);
      const created = registry.flags[registry.flags.length - 1];
      newEntities.flags.push(created);
    }
  }

  // Nạp items từ khai báo
  for (const it of ast.items || []) {
    const existing = resolveEntity(registry, ENTITY_KINDS.ITEM, it.name);
    if (existing.status !== "matched") {
      registry = addItemEntity(registry, it.name);
      const created = registry.items[registry.items.length - 1];
      newEntities.items.push(created);
    }
  }

  // 2. Tạo bản đồ Cảnh (Scene Title -> Scene Object) và kiểm tra Ambiguity (Trùng tên)
  const sceneLookup = new Map(); // normalizedTitle -> { scene, line, originalTitle }
  const scenesList = [];
  let startSceneId = null;

  for (let i = 0; i < ast.scenes.length; i++) {
    const rawScene = ast.scenes[i];
    const norm = normalizeForLookup(rawScene.title);

    if (!norm) {
      recordIssue(rawScene.line, `Cảnh thứ ${i + 1} chưa có tên tiêu đề.`);
      continue;
    }

    if (sceneLookup.has(norm)) {
      const prev = sceneLookup.get(norm);
      recordIssue(
        rawScene.line,
        `Trùng tên cảnh "${rawScene.title}" với cảnh ở dòng ${prev.line}. Hãy đổi tên để tránh nhập nhằng kết nối.`
      );
    }

    const sceneObj = newScene(episodeId, rawScene.role || SCENE_ROLES.STORY, {
      title: rawScene.title,
      intent: rawScene.intent || "",
      notes: rawScene.notes || "",
      choices: [],
    });

    if (i === 0) {
      startSceneId = sceneObj.id;
    }

    sceneLookup.set(norm, { scene: sceneObj, line: rawScene.line, originalTitle: rawScene.title });
    scenesList.push({ raw: rawScene, model: sceneObj });
  }

  // 3. Tạo bản đồ Kết thúc (Ending Title -> Ending Object)
  const endingLookup = new Map(); // normalizedTitle -> { ending, line }
  const endingsList = [];

  for (const rawEnd of ast.endings || []) {
    const norm = normalizeForLookup(rawEnd.title);
    if (!norm) continue;
    if (endingLookup.has(norm)) {
      const prev = endingLookup.get(norm);
      recordIssue(rawEnd.line, `Trùng tiêu đề kết thúc "${rawEnd.title}" với dòng ${prev.line}.`, "warning");
    }
    const endObj = newEnding(episodeId, {
      title: rawEnd.title,
      text: rawEnd.text || "",
      tone: rawEnd.tone || "neutral",
    });
    endingLookup.set(norm, { ending: endObj, line: rawEnd.line });
    endingsList.push(endObj);
  }

  // Helper tìm hoặc tạo Ending theo tên
  function resolveOrCreateEnding(title, tone = "neutral", line = 1) {
    const norm = normalizeForLookup(title);
    if (!norm) return null;
    if (endingLookup.has(norm)) {
      return endingLookup.get(norm).ending;
    }
    const newEnd = newEnding(episodeId, {
      title: String(title).trim(),
      text: "",
      tone: tone || "neutral",
    });
    endingLookup.set(norm, { ending: newEnd, line });
    endingsList.push(newEnd);
    return newEnd;
  }

  // 4. Helper phân giải luật và tự động đăng ký entity nếu xuất hiện trong điều kiện/hệ quả
  function resolveRules(conditionItemsRaw, effectItemsRaw, line) {
    const conditions = [];
    const effects = [];

    // Parse conditions
    for (const c of conditionItemsRaw || []) {
      const parsed = parseConditionsDeterministic(c.raw, registry);
      if (parsed.orDetected) {
        recordIssue(c.line || line, `Dòng ${c.line || line}: ${parsed.items[0]?.reason || "Điều kiện HOẶC chưa được hỗ trợ."}`);
      }
      for (const item of parsed.items || []) {
        if (item.status === "ok") {
          conditions.push(item.condition);
        } else if (item.status === "unresolved") {
          if (item.entityKind === ENTITY_KINDS.FLAG || item.pending.type === "flag_present" || item.pending.type === "flag_absent") {
            registry = addFlagEntity(registry, item.text);
            const created = registry.flags[registry.flags.length - 1];
            newEntities.flags.push(created);
            conditions.push(item.pending.type === "flag_absent" ? { type: "flag_absent", entityId: created.id } : { type: "flag_present", entityId: created.id });
          } else if (item.entityKind === ENTITY_KINDS.ITEM || item.pending.type === "item_present") {
            registry = addItemEntity(registry, item.text);
            const created = registry.items[registry.items.length - 1];
            newEntities.items.push(created);
            conditions.push({ type: "item_present", entityId: created.id });
          } else {
            registry = addStatEntity(registry, { displayName: item.text, default: 0 });
            const created = registry.stats[registry.stats.length - 1];
            newEntities.stats.push(created);
            conditions.push({ type: "stat_compare", entityId: created.id, operator: item.pending.operator, value: item.pending.value });
          }
        } else if (item.status === "ambiguous") {
          recordIssue(c.line || line, `Dòng ${c.line || line}: Tên "${item.text}" không rõ ràng (khớp nhiều thực thể).`);
        } else if (item.status === "unsupported") {
          recordIssue(c.line || line, `Dòng ${c.line || line}: ${item.reason || "Điều kiện chưa được hỗ trợ."}`);
        }
      }
    }

    // Parse effects
    for (const e of effectItemsRaw || []) {
      const parsed = parseEffectsDeterministic(e.raw, registry);
      for (const item of parsed.items || []) {
        if (item.status === "ok") {
          effects.push(item.effect);
        } else if (item.status === "unresolved") {
          if (item.entityKind === ENTITY_KINDS.FLAG || item.pending.type === "grant_flag") {
            registry = addFlagEntity(registry, item.text);
            const created = registry.flags[registry.flags.length - 1];
            newEntities.flags.push(created);
            effects.push({ type: "grant_flag", entityId: created.id });
          } else if (item.entityKind === ENTITY_KINDS.ITEM || item.pending.type === "grant_item" || item.pending.type === "remove_item") {
            registry = addItemEntity(registry, item.text);
            const created = registry.items[registry.items.length - 1];
            newEntities.items.push(created);
            effects.push({ type: item.pending.type, entityId: created.id });
          } else {
            registry = addStatEntity(registry, { displayName: item.text, default: 0 });
            const created = registry.stats[registry.stats.length - 1];
            newEntities.stats.push(created);
            effects.push({ type: "stat_change", entityId: created.id, amount: item.pending.amount });
          }
        } else if (item.status === "unsupported") {
          recordIssue(e.line || line, `Dòng ${e.line || line}: ${item.reason || "Hệ quả chưa được hỗ trợ."}`);
        }
      }
    }

    return { conditions, effects };
  }

  // 5. Liên kết các lựa chọn và chuyển đổi sang Blueprint Models
  for (const { raw, model } of scenesList) {
    // Nếu cảnh không có choices nhưng có autoTarget (cảnh tự động đi tiếp)
    if ((!raw.choices || raw.choices.length === 0) && (raw.autoTarget || model.role === SCENE_ROLES.ENDING)) {
      if (model.role === SCENE_ROLES.ENDING) {
        model.choices = [];
      } else if (raw.autoTarget) {
        let targetType = null;
        let targetId = null;
        const targetLine = raw.autoTargetLine || raw.line;

        if (raw.autoTargetKind === "ending") {
          const ending = resolveOrCreateEnding(raw.autoTarget, raw.autoEndingTone, targetLine);
          if (ending) {
            targetType = "ending";
            targetId = ending.id;
          }
        } else {
          const targetNorm = normalizeForLookup(raw.autoTarget);
          if (sceneLookup.has(targetNorm)) {
            targetType = "scene";
            targetId = sceneLookup.get(targetNorm).scene.id;
          } else {
            recordIssue(
              targetLine,
              `Dòng ${targetLine}: ĐẾN "${raw.autoTarget}" — Không tìm thấy cảnh "${raw.autoTarget}".`
            );
          }
        }

        const autoChoice = newChoice({
          text: "Đi tiếp",
          targetType,
          targetId,
        });
        model.choices = [autoChoice];
      }
      continue;
    }

    // Xử lý các lựa chọn trong cảnh
    for (const rawChoice of raw.choices || []) {
      const choiceLine = rawChoice.line || raw.line;
      const blocks = rawChoice.outcomeBlocks || [];

      if (blocks.length === 0) {
        const choiceModel = newChoice({
          text: rawChoice.text || "Tiếp tục",
          targetType: null,
          targetId: null,
          rules: { conditions: [], effects: [] },
        });
        model.choices.push(choiceModel);
        continue;
      }

      function resolveBlockTarget(block) {
        let tType = null;
        let tId = null;
        const tLine = block.targetLine || choiceLine;

        if (block.targetKind === "ending") {
          const ending = resolveOrCreateEnding(block.target, block.endingTone, tLine);
          if (ending) {
            tType = "ending";
            tId = ending.id;
          }
        } else if (block.target) {
          const targetNorm = normalizeForLookup(block.target);
          if (sceneLookup.has(targetNorm)) {
            tType = "scene";
            tId = sceneLookup.get(targetNorm).scene.id;
          } else {
            recordIssue(
              tLine,
              `Dòng ${tLine}: ĐẾN "${block.target}" — Không tìm thấy cảnh "${block.target}".`
            );
          }
        }
        return { targetType: tType, targetId: tId };
      }

      if (blocks.length === 1) {
        const block = blocks[0];
        const { targetType, targetId } = resolveBlockTarget(block);
        const { conditions, effects } = resolveRules(block.conditions, block.effects, block.line || choiceLine);

        const choiceModel = newChoice({
          text: rawChoice.text || "Tiếp tục",
          targetType,
          targetId,
          rules: { conditions, effects },
          conditionalOutcomes: [],
        });
        model.choices.push(choiceModel);
      } else {
        // Nhiều blocks outcome (Conditional Outcomes)
        // Blocks từ 0 đến N-2 trở thành conditionalOutcomes branches
        // Block cuối cùng (N-1) trở thành base rules + base target
        const conditionalOutcomes = [];

        for (let bIdx = 0; bIdx < blocks.length - 1; bIdx++) {
          const block = blocks[bIdx];
          const { targetType, targetId } = resolveBlockTarget(block);
          const { conditions, effects } = resolveRules(block.conditions, block.effects, block.line || choiceLine);

          const branchObj = newOutcomeBranch({
            label: "",
            conditions,
            effects,
            targetType,
            targetId,
          });
          conditionalOutcomes.push(branchObj);
        }

        const lastBlock = blocks[blocks.length - 1];
        const { targetType: lastTargetType, targetId: lastTargetId } = resolveBlockTarget(lastBlock);
        const { conditions: lastConditions, effects: lastEffects } = resolveRules(
          lastBlock.conditions,
          lastBlock.effects,
          lastBlock.line || choiceLine
        );

        const choiceModel = newChoice({
          text: rawChoice.text || "Tiếp tục",
          targetType: lastTargetType,
          targetId: lastTargetId,
          rules: { conditions: lastConditions, effects: lastEffects },
          conditionalOutcomes,
        });
        model.choices.push(choiceModel);
      }
    }
  }

  const blueprint = {
    version: 1,
    episodeId,
    startSceneId: startSceneId || scenesList[0]?.model.id || null,
    scenes: scenesList.map((s) => s.model),
    endings: endingsList,
    registry,
    updatedAt: new Date().toISOString(),
  };

  return { blueprint, issues, newEntities, registry };
}
