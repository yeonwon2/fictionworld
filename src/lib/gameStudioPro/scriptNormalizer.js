// Xưởng Game Pro — PRO 4: SCRIPT NORMALIZER & ENTITY RESOLVER
//
// Chuyển đổi AST từ scriptParser.js thành Canonical Pro Blueprint (blueprintModel.js)
// cùng Canonical Rule IR (ruleModel.js) và Entity Registry (entityRegistry.js).
//
// NGUYÊN TẮC:
// 1. PURE & NO SILENT CREATION: Không bao giờ tự động tạo entity mới vào existingRegistry.
// 2. Thu thập danh sách entityProposals để người dùng duyệt/khớp trước khi import.
// 3. Finalize step (finalizeProScriptBlueprint) là nơi DUY NHẤT tạo entity khi người dùng đã approve.
// 4. FAIL-CLOSED: Bất kỳ proposal nào thiếu approval, sai hành động, hoặc map sai kiểu -> Báo lỗi, không tạo ngầm.
import {
  SCENE_ROLES,
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
  findEntityByIdAnyKind,
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

function cleanEntityText(rawText) {
  let s = String(rawText || "").trim();
  s = s.replace(/^(?:vật phẩm|cờ|chỉ số|quan hệ|item|flag|stat)\s*[:=]?\s*/i, "").trim();
  s = s.replace(/^:\s*/, "").trim();
  return s;
}

export function normalizeProScriptAst(ast, { episodeId = "ep_1", existingRegistry = null } = {}) {
  const issues = []; // { line, message, type: "error" | "warning" }
  const recordIssue = (line, message, type = "error") => {
    issues.push({ line: Number(line) || 1, message: String(message || ""), type });
  };

  if (!ast || !Array.isArray(ast.scenes)) {
    recordIssue(1, "AST kịch bản không hợp lệ.");
    return { blueprint: null, entityProposals: [], issues, registry: existingRegistry ? ensureRegistry({ registry: existingRegistry }) : newEmptyRegistry() };
  }

  // Registry hiện có — PURE, KHÔNG mutate
  const currentRegistry = existingRegistry ? ensureRegistry({ registry: existingRegistry }) : newEmptyRegistry();
  const entityProposals = [];
  const tempKeyMap = new Map(); // kind:normalizedName -> tempKey | realEntityId

  function getOrCreateProposal(kind, rawName, meta = {}) {
    const cleanName = cleanEntityText(rawName);
    const norm = normalizeForLookup(cleanName);
    const key = `${kind}:${norm}`;
    const isQuantity = kind === ENTITY_KINDS.STAT || kind === ENTITY_KINDS.RELATIONSHIP;
    const quantityKey = isQuantity ? `quantity:${norm}` : null;

    if (tempKeyMap.has(key)) {
      return tempKeyMap.get(key);
    }
    if (quantityKey && tempKeyMap.has(quantityKey)) {
      return tempKeyMap.get(quantityKey);
    }

    const tempKey = `temp:${kind}:${cleanName}`;
    const resolution = resolveEntity(currentRegistry, isQuantity ? "quantity" : kind, cleanName);
    
    // Nếu khớp entity có sẵn thì dùng entityId thật, không cần proposal
    if (resolution.status === "matched" && resolution.entity) {
      tempKeyMap.set(key, resolution.entity.id);
      if (quantityKey) tempKeyMap.set(quantityKey, resolution.entity.id);
      return resolution.entity.id;
    }

    const proposal = {
      tempKey,
      kind,
      requestedName: cleanName,
      sourceLine: meta.line || 1,
      usage: meta.usage || `Khai báo hoặc sử dụng "${cleanName}"`,
      initial: meta.initial ?? 0,
      isVital: !!meta.isVital,
      deathThreshold: meta.deathThreshold,
      npc: meta.npc || cleanName,
      candidates: resolution.candidates || [],
      declaredInHeader: !!meta.declaredInHeader,
    };

    entityProposals.push(proposal);
    tempKeyMap.set(key, tempKey);
    if (quantityKey) tempKeyMap.set(quantityKey, tempKey);
    return tempKey;
  }

  // 1. Quét khai báo ở Header và tạo proposals cho các entity chưa có
  for (const s of ast.stats || []) {
    getOrCreateProposal(ENTITY_KINDS.STAT, s.name, {
      line: s.line,
      usage: "Khai báo ở phần CHỈ SỐ",
      initial: s.initial ?? 0,
      isVital: s.isVital,
      deathThreshold: s.deathThreshold,
      declaredInHeader: true,
    });
  }

  for (const r of ast.relationships || []) {
    getOrCreateProposal(ENTITY_KINDS.RELATIONSHIP, r.name, {
      line: r.line,
      usage: "Khai báo ở phần QUAN HỆ",
      npc: r.npc || r.name,
      initial: r.initial ?? 0,
      declaredInHeader: true,
    });
  }

  for (const f of ast.flags || []) {
    getOrCreateProposal(ENTITY_KINDS.FLAG, f.name, {
      line: f.line,
      usage: "Khai báo ở phần CỜ",
      declaredInHeader: true,
    });
  }

  for (const it of ast.items || []) {
    getOrCreateProposal(ENTITY_KINDS.ITEM, it.name, {
      line: it.line,
      usage: "Khai báo ở phần VẬT PHẨM",
      declaredInHeader: true,
    });
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

  // 4. Phân giải luật — nếu gặp entity chưa có, gán tempKey và tạo Proposal (KHÔNG silent-create)
  function resolveRules(conditionItemsRaw, effectItemsRaw, line, sceneTitle = "") {
    const conditions = [];
    const effects = [];

    // Parse conditions
    for (const c of conditionItemsRaw || []) {
      const parsed = parseConditionsDeterministic(c.raw, currentRegistry);
      if (parsed.orDetected) {
        recordIssue(c.line || line, `Dòng ${c.line || line}: ${parsed.items[0]?.reason || "Điều kiện HOẶC chưa được hỗ trợ."}`);
      }
      for (const item of parsed.items || []) {
        if (item.status === "ok") {
          conditions.push(item.condition);
        } else if (item.status === "unresolved") {
          const kind = item.pending.type === "flag_present" || item.pending.type === "flag_absent"
            ? ENTITY_KINDS.FLAG
            : item.pending.type === "item_present"
            ? ENTITY_KINDS.ITEM
            : ENTITY_KINDS.STAT;
          const cleanText = cleanEntityText(item.text);
          const tempId = getOrCreateProposal(kind, cleanText, {
            line: c.line || line,
            usage: `Điều kiện tại "${sceneTitle || "Cảnh"}"`,
          });
          if (item.pending.type === "flag_absent") {
            conditions.push({ type: "flag_absent", entityId: tempId });
          } else if (item.pending.type === "flag_present") {
            conditions.push({ type: "flag_present", entityId: tempId });
          } else if (item.pending.type === "item_present") {
            conditions.push({ type: "item_present", entityId: tempId });
          } else {
            conditions.push({ type: "stat_compare", entityId: tempId, operator: item.pending.operator, value: item.pending.value });
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
      const parsed = parseEffectsDeterministic(e.raw, currentRegistry);
      for (const item of parsed.items || []) {
        if (item.status === "ok") {
          effects.push(item.effect);
        } else if (item.status === "unresolved") {
          const kind = item.pending.type === "grant_flag"
            ? ENTITY_KINDS.FLAG
            : item.pending.type === "grant_item" || item.pending.type === "remove_item"
            ? ENTITY_KINDS.ITEM
            : ENTITY_KINDS.STAT;
          const cleanText = cleanEntityText(item.text);
          const tempId = getOrCreateProposal(kind, cleanText, {
            line: e.line || line,
            usage: `Hệ quả tại "${sceneTitle || "Cảnh"}"`,
          });
          if (item.pending.type === "grant_flag") {
            effects.push({ type: "grant_flag", entityId: tempId });
          } else if (item.pending.type === "grant_item") {
            effects.push({ type: "grant_item", entityId: tempId });
          } else if (item.pending.type === "remove_item") {
            effects.push({ type: "remove_item", entityId: tempId });
          } else {
            effects.push({ type: "stat_change", entityId: tempId, amount: item.pending.amount });
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
        const { conditions, effects } = resolveRules(block.conditions, block.effects, block.line || choiceLine, model.title);

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
          const { conditions, effects } = resolveRules(block.conditions, block.effects, block.line || choiceLine, model.title);

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
          lastBlock.line || choiceLine,
          model.title
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
    registry: currentRegistry, // PURE registry, chưa chứa entity mới
    updatedAt: new Date().toISOString(),
  };

  return { blueprint, entityProposals, issues, registry: currentRegistry };
}

// =========================================================================
// FINALIZE BLUEPRINT (FAIL-CLOSED: Bắt buộc đủ approval, không default create)
// =========================================================================
export function finalizeProScriptBlueprint(
  normalizedResult,
  approvals = {}, // { [tempKey]: { action: "create" | "map", targetEntityId, config } }
  { existingRegistry = null, episodeId = "ep_1" } = {}
) {
  const errors = [];

  if (!normalizedResult || !normalizedResult.blueprint) {
    return {
      ok: false,
      errors: ["Dữ liệu Blueprint kịch bản không hợp lệ."],
      blueprint: null,
      registry: null,
    };
  }

  const proposals = normalizedResult.entityProposals || [];
  const blueprintCopy = JSON.parse(JSON.stringify(normalizedResult.blueprint));
  let finalRegistry = existingRegistry ? ensureRegistry({ registry: existingRegistry }) : ensureRegistry(blueprintCopy);
  const idMap = new Map();

  // Kiểm tra tính đầy đủ và hợp lệ của approvals (FAIL-CLOSED)
  for (const proposal of proposals) {
    if (!approvals || !approvals[proposal.tempKey]) {
      errors.push(`Chưa có quyết định phê duyệt cho thực thể "${proposal.requestedName}" (${proposal.kind}).`);
      continue;
    }

    const approval = approvals[proposal.tempKey];
    if (approval.action !== "create" && approval.action !== "map") {
      errors.push(`Hành động không hợp lệ "${approval.action}" cho thực thể "${proposal.requestedName}".`);
      continue;
    }

    if (approval.action === "map") {
      if (!approval.targetEntityId) {
        errors.push(`Thiếu targetEntityId khi ánh xạ thực thể "${proposal.requestedName}".`);
        continue;
      }

      const target = findEntityByIdAnyKind(finalRegistry, approval.targetEntityId);
      if (!target) {
        errors.push(`Thực thể đích (ID: "${approval.targetEntityId}") không tồn tại trong danh mục.`);
        continue;
      }

      // Kiểm tra tính tương thích loại thực thể (Kind Compatibility)
      const isPropQuantity = proposal.kind === ENTITY_KINDS.STAT || proposal.kind === ENTITY_KINDS.RELATIONSHIP;
      const isTargetQuantity = target.kind === ENTITY_KINDS.STAT || target.kind === ENTITY_KINDS.RELATIONSHIP;

      if (isPropQuantity && !isTargetQuantity) {
        errors.push(`Không thể ánh xạ chỉ số/quan hệ "${proposal.requestedName}" sang "${target.displayName}" (loại: ${target.kind}).`);
        continue;
      }
      if (proposal.kind === ENTITY_KINDS.FLAG && target.kind !== ENTITY_KINDS.FLAG) {
        errors.push(`Không thể ánh xạ cờ "${proposal.requestedName}" sang "${target.displayName}" (loại: ${target.kind}).`);
        continue;
      }
      if (proposal.kind === ENTITY_KINDS.ITEM && target.kind !== ENTITY_KINDS.ITEM) {
        errors.push(`Không thể ánh xạ vật phẩm "${proposal.requestedName}" sang "${target.displayName}" (loại: ${target.kind}).`);
        continue;
      }

      idMap.set(proposal.tempKey, target.id);
    } else if (approval.action === "create") {
      const cfg = approval.config || {};
      const displayName = cfg.displayName || proposal.requestedName;

      if (proposal.kind === ENTITY_KINDS.STAT) {
        finalRegistry = addStatEntity(finalRegistry, {
          displayName,
          default: cfg.default ?? proposal.initial ?? 0,
          isVital: cfg.isVital ?? proposal.isVital,
          deathThreshold: cfg.deathThreshold ?? proposal.deathThreshold,
        });
        const created = finalRegistry.stats[finalRegistry.stats.length - 1];
        idMap.set(proposal.tempKey, created.id);
      } else if (proposal.kind === ENTITY_KINDS.RELATIONSHIP) {
        finalRegistry = addRelationshipEntity(finalRegistry, {
          displayName,
          npc: cfg.npc || proposal.npc || displayName,
          default: cfg.default ?? proposal.initial ?? 0,
        });
        const created = finalRegistry.stats[finalRegistry.stats.length - 1];
        idMap.set(proposal.tempKey, created.id);
      } else if (proposal.kind === ENTITY_KINDS.FLAG) {
        finalRegistry = addFlagEntity(finalRegistry, displayName);
        const created = finalRegistry.flags[finalRegistry.flags.length - 1];
        idMap.set(proposal.tempKey, created.id);
      } else if (proposal.kind === ENTITY_KINDS.ITEM) {
        finalRegistry = addItemEntity(finalRegistry, displayName);
        const created = finalRegistry.items[finalRegistry.items.length - 1];
        idMap.set(proposal.tempKey, created.id);
      }
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      blueprint: null,
      registry: null,
    };
  }

  // Thay thế toàn bộ tempKey trong điều kiện & hệ quả sang realEntityId
  for (const scene of blueprintCopy.scenes || []) {
    for (const choice of scene.choices || []) {
      for (const cond of choice.rules?.conditions || []) {
        if (idMap.has(cond.entityId)) {
          cond.entityId = idMap.get(cond.entityId);
        }
      }
      for (const eff of choice.rules?.effects || []) {
        if (idMap.has(eff.entityId)) {
          eff.entityId = idMap.get(eff.entityId);
        }
      }
      for (const branch of choice.conditionalOutcomes || []) {
        for (const cond of branch.conditions || []) {
          if (idMap.has(cond.entityId)) {
            cond.entityId = idMap.get(cond.entityId);
          }
        }
        for (const eff of branch.effects || []) {
          if (idMap.has(eff.entityId)) {
            eff.entityId = idMap.get(eff.entityId);
          }
        }
      }
    }
  }

  blueprintCopy.registry = finalRegistry;
  blueprintCopy.updatedAt = new Date().toISOString();

  return {
    ok: true,
    errors: [],
    blueprint: blueprintCopy,
    registry: finalRegistry,
  };
}
