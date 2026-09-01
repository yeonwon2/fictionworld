// Compiler/Adapter: Pro Model (proModel.js) -> dữ liệu game mà GamePlayer /
// ExportCenter / rpgExport hiện tại đã hiểu (`{meta, nodes}` giống hệt Xưởng
// Game cũ). Cố tình viết mỏng — không tự làm lại việc vá/chuẩn hoá node graph
// mà gọi thẳng `normalizeAndRepair` (đã dùng bởi mọi parser của Xưởng Game
// cũ), để Pro không có một bản sao logic runtime riêng.
import { normalizeAndRepair } from "../gameStudio/postprocess.js";
import { SCENE_ROLES } from "./blueprintModel.js";
import { ensureRegistry, findEntityByIdAnyKind, ENTITY_KINDS, listEntities } from "./entityRegistry.js";
import { CONDITION_TYPES, EFFECT_TYPES, negateOperator, statCompare, flagPresent, flagAbsent } from "./ruleModel.js";
import { ensureGlobalState } from "./globalStateModel.js";

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

// Đổi tên 1 node đã có trong rawNodes thành "start_node" — quy ước bắt buộc
// của normalizeAndRepair/GamePlayer (chỉ có ĐÚNG 1 node bắt đầu cho MỘT đồ
// thị runtime). Sửa mọi targetNodeId đang trỏ tới id gốc theo. Dùng chung bởi
// compileEpisodeBlueprint (đổi tên scene bắt đầu CỦA TẬP đó) và
// compileProCampaign (chỉ đổi tên scene bắt đầu CỦA TẬP BẮT ĐẦU CAMPAIGN —
// mọi tập khác giữ nguyên id thật của chúng vì đã namespaced theo episode).
function renameNodeToStartNode(rawNodes, originalId) {
  if (!originalId || !rawNodes[originalId] || originalId === "start_node") return;
  const start = { ...rawNodes[originalId], id: "start_node" };
  delete rawNodes[originalId];
  rawNodes["start_node"] = start;
  for (const n of Object.values(rawNodes)) {
    for (const c of n.choices || []) {
      if (c.targetNodeId === originalId) c.targetNodeId = "start_node";
    }
  }
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
export function compileEpisodeBlueprint(sceneBlueprint, { title, episodesById } = {}) {
  if (!sceneBlueprint || !sceneBlueprint.scenes?.length) {
    throw new Error("Sơ đồ cảnh trống — chưa có cảnh nào để chơi thử.");
  }

  const registry = ensureRegistry(sceneBlueprint);
  const rawNodes = {};
  // PRO 5: chơi thử MỘT tập riêng lẻ không thể thật sự nhảy sang tập khác —
  // nếu người gọi truyền episodesById (SmartMindMap có toàn bộ danh sách
  // tập), lựa chọn "Sang tập tiếp" được biên dịch thành 1 kết thúc TỔNG HỢP
  // giải thích rõ ràng thay vì rơi vào "broken_link_end" (nghe như lỗi kịch
  // bản trong khi đây là hành vi đúng khi test cô lập 1 tập) — xem
  // compileProCampaign() để biết cách nối THẬT sang tập khác trong campaign.
  const syntheticEpisodeEndings = new Map();

  function resolveTarget(choice) {
    if (choice.targetType === "scene" && choice.targetId) return choice.targetId;
    if (choice.targetType === "ending" && choice.targetId) return choice.targetId;
    if (choice.targetType === "episode" && choice.targetId) {
      const targetEpisode = episodesById?.[choice.targetId];
      if (!targetEpisode) return null;
      if (syntheticEpisodeEndings.has(choice.targetId)) return syntheticEpisodeEndings.get(choice.targetId);
      const nodeId = `__episode_transition_${choice.targetId}`;
      rawNodes[nodeId] = {
        id: nodeId,
        speaker: "",
        text: `→ Sang tập: ${targetEpisode.title || "?"} (chơi thật ở "Chơi thử toàn game").`,
        title: `Sang tập: ${targetEpisode.title || "?"}`,
        bgImage: "",
        isEnding: true,
        endingType: "NORMAL_END",
        choices: [],
      };
      syntheticEpisodeEndings.set(choice.targetId, nodeId);
      return nodeId;
    }
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
  renameNodeToStartNode(rawNodes, sceneBlueprint.startSceneId);

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

// PRO 5: biên dịch TOÀN BỘ campaign (mọi episode có sceneBlueprint) thành
// ĐÚNG MỘT đồ thị {meta, nodes} runtime hợp nhất — không phải N game riêng
// biệt, không phải runtime thứ hai. Đây là lý do carry-state (mục 11) và
// save/reload xuyên tập (mục 14/24) "tự động đúng" mà không cần cơ chế mới:
// GamePlayer/playerState.js chỉ biết MỘT `rt` runtime state di chuyển qua các
// node, và loadPlayerState() chỉ cần `nodes[savedNodeId]` tồn tại — không
// quan tâm node đó thuộc tập nào (xem src/lib/gameStudio/playerState.js).
// Chuyển tập = 1 lựa chọn có targetType "episode" trỏ THẲNG sang scene bắt
// đầu của tập kế — một CẠNH đồ thị bình thường, KHÔNG phải node/ending đặc
// biệt (mục 7: EPISODE_COMPLETE vs GAME_END chỉ là khái niệm AUTHORING-TIME,
// runtime hoàn toàn không biết khái niệm này). Tái dùng NGUYÊN
// compileChoice/compileConditions/compileEffects ở trên cho từng tập —
// KHÔNG có logic biên dịch song song nào khác.
export function compileProCampaign(proDocRaw) {
  const proDoc = ensureGlobalState(proDocRaw);
  const episodes = [...(proDoc.storyBlueprint?.episodes || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const episodesWithBlueprint = episodes.filter((e) => e.sceneBlueprint?.scenes?.length);
  if (episodesWithBlueprint.length === 0) {
    throw new Error("Chưa có tập nào có sơ đồ cảnh — chưa có gì để biên dịch campaign.");
  }

  const episodesById = Object.fromEntries(episodes.map((e) => [e.id, e]));
  const requestedStartId = proDoc.globalState.startEpisodeId;
  const startEpisodeId =
    requestedStartId && episodesById[requestedStartId]?.sceneBlueprint?.scenes?.length
      ? requestedStartId
      : episodesWithBlueprint[0].id;

  // Registry canonical toàn campaign (mục 3) — mọi tập đọc CÙNG 1 registry
  // này (không có bản sao lệch nhau) nên không cần hoà giải id giữa các tập.
  const registry = ensureRegistry({ registry: proDoc.globalState.registry });
  const startSceneIdByEpisode = new Map(episodesWithBlueprint.map((e) => [e.id, e.sceneBlueprint.startSceneId]));

  function resolveTarget(choice) {
    if (choice.targetType === "scene" && choice.targetId) return choice.targetId;
    if (choice.targetType === "ending" && choice.targetId) return choice.targetId;
    if (choice.targetType === "episode" && choice.targetId) {
      // Tập đích chưa có sơ đồ (đang soạn dở) -> null, rơi vào broken_link_end
      // sẵn có của normalizeAndRepair — an toàn, campaignValidator.js là nơi
      // CHẶN trước khi cho chơi/xuất bản, compiler ở đây không tự chặn.
      return startSceneIdByEpisode.get(choice.targetId) || null;
    }
    return null;
  }

  const rawNodes = {};
  for (const episode of episodesWithBlueprint) {
    const blueprint = episode.sceneBlueprint;
    for (const scene of blueprint.scenes) {
      const isEndingRole = scene.role === SCENE_ROLES.ENDING;
      const choices = isEndingRole ? [] : scene.choices.flatMap((c) => compileChoice(c, registry, resolveTarget));
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
    for (const ending of blueprint.endings || []) {
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
  }

  // CHỈ scene bắt đầu của TẬP BẮT ĐẦU CAMPAIGN được đổi thành "start_node" —
  // mọi tập khác giữ nguyên id thật (đã namespaced theo episode từ PRO 2) nên
  // không đụng ID khi gộp (đúng thiết kế ghi ở blueprintModel.js/makeSceneId).
  renameNodeToStartNode(rawNodes, startSceneIdByEpisode.get(startEpisodeId));

  // Chỉ entity kind "stat" mới thành meta.statsConfig — xem RUNTIME MAPPING ở
  // entityRegistry.js. default ở đây chính là GIÁ TRỊ KHỞI ĐẦU CỦA TOÀN
  // CAMPAIGN (mục 5.A) — chỉ áp dụng MỘT LẦN ở start_node thật (tập bắt đầu),
  // không reset lại khi sang tập tiếp vì carry-state là tự động (mục 5/11).
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
    title: proDoc.title || "Game Pro Mới",
    presentation: "dialogue",
    theme: "lily-noir",
    archetype: "none",
    player_name: "Nhân Vật Chính",
    playerAvatar: "",
    defaultNpcAvatar: "",
    statsConfig,
    initialStats,
    builder: "pro",
    proSchemaVersion: proDoc.schemaVersion || 1,
    // Toàn bộ tài liệu Pro (kể cả globalState đã migrate/chuẩn hoá) round-trip
    // qua đây — đúng quy ước compileProGame() đã dùng để proDoc sống lại khi
    // mở game (xem GameStudioPro.jsx: setProDoc(row.meta?.pro || ...)).
    pro: proDoc,
  };

  return { meta, nodes, warnings };
}
