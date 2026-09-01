// Compiler/Adapter: Pro Model (proModel.js) -> dữ liệu game mà GamePlayer /
// ExportCenter / rpgExport hiện tại đã hiểu (`{meta, nodes}` giống hệt Xưởng
// Game cũ). Cố tình viết mỏng — không tự làm lại việc vá/chuẩn hoá node graph
// mà gọi thẳng `normalizeAndRepair` (đã dùng bởi mọi parser của Xưởng Game
// cũ), để Pro không có một bản sao logic runtime riêng.
import { normalizeAndRepair } from "../gameStudio/postprocess.js";
import { SCENE_ROLES } from "./blueprintModel.js";
import { ensureRegistry, findEntityByIdAnyKind, ENTITY_KINDS, listEntities } from "./entityRegistry.js";
import { CONDITION_TYPES, EFFECT_TYPES, negateOperator, statCompare, flagPresent, flagAbsent } from "./ruleModel.js";

// ---------- PRO 3: dịch Canonical Rule IR -> field runtime thật ----------
// KHÔNG có engine luật thứ hai — mọi condition/effect cuối cùng chỉ là đúng
// các field GamePlayer/postprocess.js đã đọc từ trước (statRequirements/
// requiresFlag/statModifiers/...). Xem entityRegistry.js "RUNTIME MAPPING".
function statOrRelKeyFields(entity) {
  if (entity.kind === ENTITY_KINDS.RELATIONSHIP) {
    return { minField: "requiresNpcAffinity", maxField: "requiresNpcAffinityMax", key: entity.npc, effectField: "npcAffinity" };
  }
  return { minField: "statRequirements", maxField: "statRequirementsMax", key: entity.id, effectField: "statModifiers" };
}

// `conditions` là 1 mảng (ngữ nghĩa AND). Nhiều điều kiện cùng chạm 1
// field/key (vd 2 mốc ">=" khác nhau trên cùng 1 chỉ số) được GỘP về đúng 1
// biên chặt nhất, KHÔNG ghi đè tuỳ ý theo thứ tự — để kết quả biên dịch không
// phụ thuộc thứ tự mảng (đúng yêu cầu "Compiler phải pure/deterministic").
function compileConditions(conditions, registry) {
  const fields = {};
  function bumpMin(field, key, value) {
    fields[field] = fields[field] || {};
    fields[field][key] = fields[field][key] === undefined ? value : Math.max(fields[field][key], value);
  }
  function bumpMax(field, key, value) {
    fields[field] = fields[field] || {};
    fields[field][key] = fields[field][key] === undefined ? value : Math.min(fields[field][key], value);
  }
  for (const cond of conditions || []) {
    if (!cond || cond.type === CONDITION_TYPES.UNSUPPORTED) continue; // luật chưa hỗ trợ — validator đã báo lỗi, compiler chỉ bỏ qua an toàn
    const entity = findEntityByIdAnyKind(registry, cond.entityId);
    if (!entity) continue; // entity đã bị xoá khỏi registry — validator báo lỗi, compiler bỏ qua an toàn
    if (cond.type === CONDITION_TYPES.STAT_COMPARE) {
      if (!Number.isFinite(cond.value)) continue;
      const { minField, maxField, key } = statOrRelKeyFields(entity);
      // Miền số nguyên (chỉ số/quan hệ trong toàn hệ thống đều là số nguyên) —
      // runtime chỉ có >= (statRequirements) / <= (statRequirementsMax) nên
      // ">"/"<" phải quy về biên inclusive gần nhất (mục 17).
      if (cond.operator === ">=") bumpMin(minField, key, cond.value);
      else if (cond.operator === ">") bumpMin(minField, key, cond.value + 1);
      else if (cond.operator === "<=") bumpMax(maxField, key, cond.value);
      else if (cond.operator === "<") bumpMax(maxField, key, cond.value - 1);
      else if (cond.operator === "==") { bumpMin(minField, key, cond.value); bumpMax(maxField, key, cond.value); }
      continue;
    }
    if (cond.type === CONDITION_TYPES.FLAG_PRESENT) fields.requiresFlag = entity.displayName;
    else if (cond.type === CONDITION_TYPES.FLAG_ABSENT) fields.requiresFlagAbsent = entity.displayName;
    else if (cond.type === CONDITION_TYPES.ITEM_PRESENT) fields.requiresItem = entity.displayName;
  }
  return fields;
}

function compileEffects(effects, registry) {
  const fields = {};
  for (const eff of effects || []) {
    if (!eff || eff.type === EFFECT_TYPES.UNSUPPORTED) continue;
    const entity = findEntityByIdAnyKind(registry, eff.entityId);
    if (!entity) continue;
    if (eff.type === EFFECT_TYPES.STAT_CHANGE) {
      if (!Number.isFinite(eff.amount)) continue;
      const { key, effectField } = statOrRelKeyFields(entity);
      fields[effectField] = fields[effectField] || {};
      fields[effectField][key] = (fields[effectField][key] || 0) + eff.amount;
      continue;
    }
    if (eff.type === EFFECT_TYPES.GRANT_FLAG) {
      fields.grantFlags = fields.grantFlags || [];
      if (!fields.grantFlags.includes(entity.displayName)) fields.grantFlags.push(entity.displayName);
    } else if (eff.type === EFFECT_TYPES.GRANT_ITEM) {
      fields.grantItem = entity.displayName; // engine chỉ có 1 ô — ruleValidator.js chặn 2 grant_item khác nhau từ trước
    } else if (eff.type === EFFECT_TYPES.REMOVE_ITEM) {
      fields.removeItem = entity.displayName;
    }
  }
  return fields;
}

// Suy ra điều kiện ĐỐI LẬP chính xác (không đoán mò) cho đúng 1 điều kiện
// stat_compare/flag_present/flag_absent đơn — dùng để tự lấp nhánh "else" khi
// conditionalOutcomes chỉ có 1 nhánh và chính lựa chọn chưa tự khai điều kiện
// nào (mục 17/22). item_present không có đối lập (không có requiresItemAbsent
// ở runtime) nên trả null — bắt buộc người dùng khai rõ nhánh còn lại.
function tryAutoNegateCondition(cond) {
  if (!cond) return null;
  if (cond.type === CONDITION_TYPES.STAT_COMPARE) {
    const negOp = negateOperator(cond.operator);
    return negOp ? statCompare(cond.entityId, negOp, cond.value) : null;
  }
  if (cond.type === CONDITION_TYPES.FLAG_PRESENT) return flagAbsent(cond.entityId);
  if (cond.type === CONDITION_TYPES.FLAG_ABSENT) return flagPresent(cond.entityId);
  return null;
}

// Biên dịch 1 choice (Pro) -> MẢNG choice runtime (thường 1 phần tử; nhiều
// hơn nếu có conditionalOutcomes — mục 22). Mỗi nhánh + nhánh "else" trở
// thành các lựa chọn CẤU TRÚC anh em cùng cảnh, KHÔNG dùng cơ chế
// automaticEnding của Xưởng Game cũ — cơ chế đó buộc mọi đích phải là ending
// thật và cấm mọi hệ quả trên các lựa chọn của nó (xem
// automaticEnding.js/validateAutomaticEnding), quá hẹp cho rẽ nhánh có hệ quả
// + đi tiếp cảnh thường (đúng ca bắt buộc ở mục 30, cảnh E). GamePlayer luôn
// hiện MỌI lựa chọn của 1 cảnh (khoá/mờ nếu chưa đủ điều kiện, không ẩn hẳn
// — xem VNScenePanel), nên nếu conditionalOutcomes có nhiều nhánh trùng
// `text`/`label`, người chơi có thể thấy 2 nút giống chữ (1 khoá, 1 mở) —
// ĐÚNG về mặt luật (không ai bấm nhầm được nút khoá) nhưng nên đặt `label`
// riêng cho từng nhánh nếu muốn UX rõ ràng hơn (RuleEditor UI có gợi ý việc
// này, không bắt buộc).
function compileChoice(choice, registry, resolveTarget) {
  const baseText = choice.text?.trim() || "Tiếp tục";
  const baseChoice = {
    text: baseText,
    targetNodeId: resolveTarget(choice),
    ...compileConditions(choice.rules?.conditions, registry),
    ...compileEffects(choice.rules?.effects, registry),
  };

  const branches = choice.conditionalOutcomes || [];
  if (!branches.length) return [baseChoice];

  const compiledBranches = branches.map((b) => ({
    text: (b.label || baseText).trim() || "Tiếp tục",
    targetNodeId: resolveTarget(b),
    ...compileConditions(b.conditions, registry),
    ...compileEffects(b.effects, registry),
  }));

  let compiledElse = baseChoice;
  if (branches.length === 1 && (branches[0].conditions || []).length === 1 && !(choice.rules?.conditions || []).length) {
    const negated = tryAutoNegateCondition(branches[0].conditions[0]);
    if (negated) compiledElse = { ...baseChoice, ...compileConditions([negated], registry) };
  }

  return [...compiledBranches, compiledElse];
}

export function compileProGame(proDoc) {
  const rawNodes = {
    start_node: {
      id: "start_node",
      speaker: "",
      text: proDoc.startScene?.text || "",
      bgImage: "",
      isEnding: false,
      endingType: null,
      choices: (proDoc.choices || []).map((c) => ({
        text: c.text,
        targetNodeId: c.endingId,
      })),
    },
    ...Object.fromEntries(
      (proDoc.endings || []).map((e) => [
        e.id,
        {
          id: e.id,
          speaker: "",
          text: e.text,
          title: e.title,
          bgImage: "",
          isEnding: true,
          endingType: "neutral",
          choices: [],
        },
      ])
    ),
  };

  const { nodes, warnings } = normalizeAndRepair(rawNodes, [], 1, {
    forceNonEmptyModifiers: false,
  });

  const meta = {
    title: proDoc.title || "Game Pro Mới",
    presentation: "dialogue",
    theme: "lily-noir",
    archetype: "none",
    player_name: "Nhân Vật Chính",
    playerAvatar: "",
    defaultNpcAvatar: "",
    statsConfig: [],
    initialStats: {},
    builder: "pro",
    proSchemaVersion: proDoc.schemaVersion || 1,
    pro: proDoc,
  };

  return { meta, nodes, warnings };
}

// PRO 2: compile MỘT Scene Blueprint (episode.sceneBlueprint, xem
// blueprintModel.js) thành `{meta, nodes}` — dùng cho "Chơi thử tập này" ở
// Smart Mind Map. Cố tình TÁCH khỏi compileProGame() ở trên (không đổi hành
// vi/chữ ký của nó — có test PRO0/PRO1 khẳng định compileProGame() luôn ra
// đúng game demo 2 lựa chọn/2 kết thúc bất kể storyBlueprint chứa gì) nhưng
// vẫn nằm trong cùng module "Pro compiler" và tái dùng đúng normalizeAndRepair
// như compileProGame(), không có logic runtime song song nào khác.
//
// Chỉ compile MỘT tập đã chọn (không gộp nhiều tập cùng lúc) — Global State
// giữa các tập chưa cần ở PRO 2 (xem mục 20/21 yêu cầu PRO 2). Vì scene ID đã
// namespaced theo episode.id (blueprintModel.makeSceneId/makeEndingId) ngay
// từ đầu, việc sau này gộp nhiều blueprint tập vào 1 đồ thị lớn (PRO 5+) sẽ
// không đụng ID — quyết định này KHÔNG cần thiết kế lại data model.
export function compileEpisodeBlueprint(sceneBlueprint, { title } = {}) {
  if (!sceneBlueprint || !sceneBlueprint.scenes?.length) {
    throw new Error("Sơ đồ cảnh trống — chưa có cảnh nào để chơi thử.");
  }

  const registry = ensureRegistry(sceneBlueprint);
  const rawNodes = {};

  function resolveTarget(choice) {
    if (choice.targetType === "scene" && choice.targetId) return choice.targetId;
    if (choice.targetType === "ending" && choice.targetId) return choice.targetId;
    return null;
  }

  for (const scene of sceneBlueprint.scenes) {
    const isEndingRole = scene.role === SCENE_ROLES.ENDING;
    const choices = isEndingRole
      ? []
      : scene.choices.flatMap((c) => compileChoice(c, registry, resolveTarget));
    rawNodes[scene.id] = {
      id: scene.id,
      speaker: "",
      text: scene.intent?.trim() || scene.title || "",
      title: scene.title || "",
      bgImage: "",
      isEnding: isEndingRole,
      endingType: isEndingRole ? "NORMAL_END" : null,
      choices,
    };
  }

  for (const ending of sceneBlueprint.endings || []) {
    rawNodes[ending.id] = {
      id: ending.id,
      speaker: "",
      text: ending.text?.trim() || ending.title || "",
      title: ending.title || "",
      bgImage: "",
      isEnding: true,
      endingType: ending.tone === "death" ? "BAD_END" : "NORMAL_END",
      choices: [],
    };
  }

  // start_node là quy ước bắt buộc của normalizeAndRepair/GamePlayer — đổi
  // tên cảnh bắt đầu của blueprint thành đúng id đó thay vì đoán lại từ đầu.
  if (sceneBlueprint.startSceneId && rawNodes[sceneBlueprint.startSceneId] && sceneBlueprint.startSceneId !== "start_node") {
    const start = { ...rawNodes[sceneBlueprint.startSceneId], id: "start_node" };
    delete rawNodes[sceneBlueprint.startSceneId];
    rawNodes["start_node"] = start;
    for (const n of Object.values(rawNodes)) {
      for (const c of n.choices || []) {
        if (c.targetNodeId === sceneBlueprint.startSceneId) c.targetNodeId = "start_node";
      }
    }
  }

  // Chỉ entity kind "stat" mới thành meta.statsConfig — "relationship" dùng
  // hẳn hệ rt.npcAffinity riêng của GamePlayer (không có statsConfig, không
  // cần default/isVital — xem entityRegistry.js "RUNTIME MAPPING").
  const statsConfig = listEntities(registry, ENTITY_KINDS.STAT).map((e) => ({
    key: e.id,
    label: e.displayName,
    default: e.default,
    isVital: !!e.isVital,
    ...(e.isVital ? { deathThreshold: Number.isFinite(e.deathThreshold) ? e.deathThreshold : 0 } : {}),
  }));
  const initialStats = Object.fromEntries(statsConfig.map((s) => [s.key, s.default]));

  const { nodes, warnings } = normalizeAndRepair(
    rawNodes,
    statsConfig.map((s) => s.key),
    0,
    { forceNonEmptyModifiers: false, statsConfig }
  );

  const meta = {
    title: title || "Chơi thử tập",
    presentation: "dialogue",
    theme: "lily-noir",
    archetype: "none",
    player_name: "Nhân Vật Chính",
    playerAvatar: "",
    defaultNpcAvatar: "",
    statsConfig,
    initialStats,
    builder: "pro",
  };

  return { meta, nodes, warnings };
}
