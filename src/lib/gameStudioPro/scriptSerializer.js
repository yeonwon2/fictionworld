// Xưởng Game Pro — PRO 4: SCRIPT SERIALIZER
//
// Xuất Pro Scene Blueprint hiện tại (blueprintModel.js) thành văn bản chuẩn
// FICTIONWORLD PRO SCRIPT v1 — hỗ trợ quy trình 2 chiều (Round Trip) trọn vẹn.
import { SCRIPT_HEADER_V1, normalizeTone } from "./scriptFormat.js";
import { SCENE_ROLES, sceneRoleLabel } from "./blueprintModel.js";
import { ensureRegistry, findEntityByIdAnyKind, ENTITY_KINDS, listEntities } from "./entityRegistry.js";
import { CONDITION_TYPES, EFFECT_TYPES } from "./ruleModel.js";

function formatConditionLine(cond, registry) {
  if (!cond) return "";
  const entity = findEntityByIdAnyKind(registry, cond.entityId);
  const name = entity ? entity.displayName : cond.entityId || "(?)";
  if (cond.type === CONDITION_TYPES.STAT_COMPARE) {
    return `${name} ${cond.operator} ${cond.value}`;
  }
  if (cond.type === CONDITION_TYPES.FLAG_PRESENT) {
    return `Có cờ: ${name}`;
  }
  if (cond.type === CONDITION_TYPES.FLAG_ABSENT) {
    return `Chưa có cờ: ${name}`;
  }
  if (cond.type === CONDITION_TYPES.ITEM_PRESENT) {
    return `Có vật phẩm: ${name}`;
  }
  return cond.raw || `Điều kiện: ${name}`;
}

function formatEffectLine(eff, registry) {
  if (!eff) return "";
  const entity = findEntityByIdAnyKind(registry, eff.entityId);
  const name = entity ? entity.displayName : eff.entityId || "(?)";
  if (eff.type === EFFECT_TYPES.STAT_CHANGE) {
    return `${name} ${eff.amount >= 0 ? "+" : ""}${eff.amount}`;
  }
  if (eff.type === EFFECT_TYPES.GRANT_FLAG) {
    return `Đặt cờ: ${name}`;
  }
  if (eff.type === EFFECT_TYPES.GRANT_ITEM) {
    return `Nhận vật phẩm: ${name}`;
  }
  if (eff.type === EFFECT_TYPES.REMOVE_ITEM) {
    return `Mất vật phẩm: ${name}`;
  }
  return eff.raw || `Hệ quả: ${name}`;
}

function toneLabel(tone) {
  const norm = normalizeTone(tone);
  if (norm === "death") return "Chết";
  if (norm === "good") return "Tốt";
  if (norm === "bad") return "Xấu";
  return "Bình thường";
}

export function serializeEpisodeBlueprint(blueprint, episode = null) {
  if (!blueprint) return `${SCRIPT_HEADER_V1}\n`;

  const registry = ensureRegistry(blueprint);
  const statsList = listEntities(registry, ENTITY_KINDS.STAT);
  const relsList = listEntities(registry, ENTITY_KINDS.RELATIONSHIP);
  const flagsList = listEntities(registry, ENTITY_KINDS.FLAG);
  const itemsList = listEntities(registry, ENTITY_KINDS.ITEM);

  const lines = [];

  // 1. Header
  lines.push(SCRIPT_HEADER_V1);
  lines.push("");

  // 2. Episode Title
  const title = episode?.title || "Tập 1";
  lines.push(`TẬP: ${title}`);
  lines.push("");

  // 3. Stats
  if (statsList.length > 0) {
    lines.push("CHỈ SỐ:");
    for (const s of statsList) {
      let tag = "";
      if (s.isVital) {
        tag = ` [sinh tồn, ngưỡng ${s.deathThreshold ?? 0}]`;
      }
      lines.push(`- ${s.displayName} = ${s.default ?? 0}${tag}`);
    }
    lines.push("");
  }

  // 4. Relationships
  if (relsList.length > 0) {
    lines.push("QUAN HỆ:");
    for (const r of relsList) {
      lines.push(`- ${r.displayName} = ${r.default ?? 0} (NPC: ${r.npc || r.displayName})`);
    }
    lines.push("");
  }

  // 5. Flags
  if (flagsList.length > 0) {
    lines.push("CỜ:");
    for (const f of flagsList) {
      lines.push(`- ${f.displayName}`);
    }
    lines.push("");
  }

  // 6. Items
  if (itemsList.length > 0) {
    lines.push("VẬT PHẨM:");
    for (const it of itemsList) {
      lines.push(`- ${it.displayName}`);
    }
    lines.push("");
  }

  const sceneMap = new Map((blueprint.scenes || []).map((s) => [s.id, s]));
  const endingMap = new Map((blueprint.endings || []).map((e) => [e.id, e]));

  // 7. Scenes
  for (const scene of blueprint.scenes || []) {
    lines.push(`CẢNH: ${scene.title || "(Chưa đặt tên)"}`);
    lines.push(`LOẠI: ${sceneRoleLabel(scene.role)}`);
    lines.push("");

    if (scene.intent) {
      lines.push("NỘI DUNG:");
      lines.push(scene.intent.trim());
      lines.push("");
    }

    if (scene.notes) {
      lines.push("GHI CHÚ:");
      lines.push(scene.notes.trim());
      lines.push("");
    }

    if (scene.role === SCENE_ROLES.ENDING) {
      continue;
    }

    // Choices
    const choices = scene.choices || [];
    for (let i = 0; i < choices.length; i++) {
      const c = choices[i];
      const letter = String.fromCharCode(65 + i);
      lines.push(`LỰA CHỌN ${letter}:`);
      lines.push(c.text || "Tiếp tục");
      lines.push("");

      const conds = c.rules?.conditions || [];
      const effs = c.rules?.effects || [];
      const branches = c.conditionalOutcomes || [];

      // 1. Serialize conditional outcome branches FIRST (deterministic ordering)
      for (const branch of branches) {
        if ((branch.conditions || []).length > 0) {
          lines.push("NẾU:");
          for (const bCond of branch.conditions) {
            lines.push(`- ${formatConditionLine(bCond, registry)}`);
          }
        }
        if ((branch.effects || []).length > 0) {
          lines.push("HỆ QUẢ:");
          for (const bEff of branch.effects) {
            lines.push(`- ${formatEffectLine(bEff, registry)}`);
          }
        }
        if (branch.targetType === "ending") {
          const endObj = endingMap.get(branch.targetId);
          const endTitle = endObj ? endObj.title : branch.targetId;
          const toneTag = endObj?.tone && endObj.tone !== "neutral" ? ` [${toneLabel(endObj.tone)}]` : "";
          lines.push(`KẾT THÚC${toneTag}:`);
          lines.push(endTitle);
          lines.push("");
        } else if (branch.targetType === "scene") {
          const scObj = sceneMap.get(branch.targetId);
          lines.push("ĐẾN:");
          lines.push(scObj ? scObj.title : branch.targetId || "");
          lines.push("");
        }
      }

      // 2. Serialize base / fallback choice SECOND
      if (conds.length > 0) {
        lines.push("NẾU:");
        for (const cond of conds) {
          lines.push(`- ${formatConditionLine(cond, registry)}`);
        }
      }

      if (effs.length > 0) {
        lines.push("HỆ QUẢ:");
        for (const eff of effs) {
          lines.push(`- ${formatEffectLine(eff, registry)}`);
        }
      }

      if (c.targetType === "ending") {
        const endObj = endingMap.get(c.targetId);
        const endTitle = endObj ? endObj.title : c.targetId;
        const toneTag = endObj?.tone && endObj.tone !== "neutral" ? ` [${toneLabel(endObj.tone)}]` : "";
        lines.push(`KẾT THÚC${toneTag}:`);
        lines.push(endTitle);
        lines.push("");
      } else if (c.targetType === "scene") {
        const scObj = sceneMap.get(c.targetId);
        lines.push("ĐẾN:");
        lines.push(scObj ? scObj.title : c.targetId || "");
        lines.push("");
      }
    }
  }

  // 8. Dedicated Endings
  if ((blueprint.endings || []).length > 0) {
    for (const e of blueprint.endings) {
      lines.push(`KẾT THÚC [${toneLabel(e.tone)}]: ${e.title}`);
      lines.push(`LOẠI: ${toneLabel(e.tone)}`);
      if (e.text) {
        lines.push("NỘI DUNG:");
        lines.push(e.text.trim());
      }
      lines.push("");
    }
  }

  return lines.join("\n").trim() + "\n";
}
