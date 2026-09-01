// Xưởng Game Pro — PRO 5: GLOBAL STATE — nguồn sự thật DUY NHẤT cho các
// entity (chỉ số/cờ/vật phẩm/quan hệ) XUYÊN SUỐT một game nhiều tập.
//
// Trước PRO 5, mỗi episode.sceneBlueprint có `registry` RIÊNG (entityRegistry.js)
// — "Uy tín" ở Tập 1 và "Uy tín" ở Tập 2 là 2 entity id khác nhau một cách âm
// thầm. PRO 5 KHÔNG dựng một hệ registry thứ hai: `proDoc.globalState.registry`
// dùng NGUYÊN `newEmptyRegistry()`/`ENTITY_KINDS`/mọi hàm CRUD của
// entityRegistry.js — nó chỉ là MỘT registry được đặt ở cấp game thay vì cấp
// episode. Mỗi episode.sceneBlueprint.registry được giữ làm BẢN SAO ĐỒNG BỘ
// (mirror) của registry toàn cục (xem syncRegistryToAllEpisodes) — mọi nơi
// đọc registry hiện có (compileEpisodeBlueprint, ruleParser.js,
// ExternalAiBridgeModal existingRegistry, RuleEditor...) tiếp tục đọc
// `blueprint.registry` y nguyên, không cần sửa, mà vẫn thấy đúng dữ liệu
// canonical — xem proCompiler.js/SmartMindMap.jsx cho nơi mirror được ghi.
import {
  ENTITY_KINDS,
  ensureRegistry,
  newEmptyRegistry,
  normalizeForMatch,
} from "./entityRegistry.js";

export const GLOBAL_STATE_SCHEMA_VERSION = 1;

export function newEmptyGlobalState() {
  return {
    version: GLOBAL_STATE_SCHEMA_VERSION,
    registry: newEmptyRegistry(),
    // Tập bắt đầu campaign (mục 10) — id ổn định, KHÔNG phụ thuộc order/tên
    // (mục 6/29). null = chưa xác định, compileProCampaign() tự suy ra tập
    // có order nhỏ nhất mà đã có sceneBlueprint.
    startEpisodeId: null,
  };
}

function ensureGlobalRegistryShape(registry) {
  return ensureRegistry({ registry });
}

// Blueprint tạo trước PRO 5 không có `globalState` hợp lệ — luôn trả về bản
// hợp lệ, KHÔNG bắt nơi gọi tự phòng thủ.
export function ensureGlobalState(proDoc) {
  const raw = proDoc?.globalState;
  const rawRegistry = raw && typeof raw === "object" ? ensureGlobalRegistryShape(raw.registry) : newEmptyRegistry();
  const hasGlobalData = rawRegistry.stats.length > 0 || rawRegistry.flags.length > 0 || rawRegistry.items.length > 0;

  const episodes = proDoc?.storyBlueprint?.episodes || [];
  const anyEpisodeRegistry = episodes.some((e) => {
    const r = e?.sceneBlueprint?.registry;
    return r && ((r.stats || []).length > 0 || (r.flags || []).length > 0 || (r.items || []).length > 0);
  });

  const startEpisodeId = raw && typeof raw === "object" && raw.startEpisodeId ? raw.startEpisodeId : null;

  // Đã có global registry (dù trống thật hay đã được migrate/soạn trước đó)
  // hoặc chưa episode nào có registry để migrate — chỉ chuẩn hoá hình dạng,
  // KHÔNG migrate lại (tránh ghi đè chỉnh sửa thủ công đã có ở cấp global).
  if (hasGlobalData || !anyEpisodeRegistry) {
    return {
      ...proDoc,
      globalState: { version: GLOBAL_STATE_SCHEMA_VERSION, registry: rawRegistry, startEpisodeId },
    };
  }

  const migrated = migrateEpisodeRegistriesToGlobal(proDoc.storyBlueprint);
  const syncedBlueprint = syncRegistryToAllEpisodes(migrated.storyBlueprint, migrated.registry);
  return {
    ...proDoc,
    storyBlueprint: syncedBlueprint,
    globalState: { version: GLOBAL_STATE_SCHEMA_VERSION, registry: migrated.registry, startEpisodeId },
  };
}

function collectionKeyFor(kind) {
  if (kind === ENTITY_KINDS.STAT || kind === ENTITY_KINDS.RELATIONSHIP) return "stats";
  if (kind === ENTITY_KINDS.FLAG) return "flags";
  if (kind === ENTITY_KINDS.ITEM) return "items";
  return null;
}

// Mọi entity của MỌI episode (registry PRO 3/4 cũ, chưa có global state) —
// gắn kèm episode nguồn chỉ để log cảnh báo dễ hiểu.
function allLegacyEntities(storyBlueprint) {
  const out = [];
  for (const ep of storyBlueprint?.episodes || []) {
    const r = ensureRegistry(ep.sceneBlueprint || {});
    for (const e of r.stats) out.push({ entity: e, episode: ep });
    for (const e of r.flags) out.push({ entity: e, episode: ep });
    for (const e of r.items) out.push({ entity: e, episode: ep });
  }
  return out;
}

// Merge "exact-safe" (mục 3/4/18): cùng kind + cùng displayName chuẩn hoá
// (+ cùng NPC chuẩn hoá nếu là relationship) mới được gộp về 1 entity —
// KHÔNG tự gộp nếu chỉ gần giống hoặc khác kind (đó là "ambiguous"/"hard
// conflict", chỉ cảnh báo, giữ nguyên riêng biệt). Trả về registry hợp nhất +
// idRemap (oldEntityId -> canonicalEntityId, bao gồm cả ánh xạ identity cho
// entity đầu tiên trở thành canonical) + storyBlueprint đã viết lại mọi
// `choice.rules`/`conditionalOutcomes` theo id canonical + warnings.
export function migrateEpisodeRegistriesToGlobal(storyBlueprint) {
  const registry = newEmptyRegistry();
  const idRemap = new Map();
  const warnings = [];
  // key -> canonical entity, dùng để phát hiện trùng/xung đột khi duyệt tuần tự.
  const byMatchKey = new Map(); // `${kind}|${normalizedName}` -> entity (stat/flag/item)
  const byNameOnly = new Map(); // normalizedName (bỏ kind) -> [{kind, entity}] để phát hiện kind conflict
  const byRelKey = new Map(); // `${normalizedName}|${normalizedNpc}` -> entity (relationship)
  const byRelNameOnly = new Map(); // normalizedName -> [{npc, entity}] để phát hiện NPC khác nhau

  const ordered = [...(storyBlueprint?.episodes || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const ep of ordered) {
    const localRegistry = ensureRegistry(ep.sceneBlueprint || {});
    for (const kind of [ENTITY_KINDS.STAT, ENTITY_KINDS.RELATIONSHIP, ENTITY_KINDS.FLAG, ENTITY_KINDS.ITEM]) {
      const pool = kind === ENTITY_KINDS.STAT
        ? localRegistry.stats.filter((e) => e.kind === ENTITY_KINDS.STAT)
        : kind === ENTITY_KINDS.RELATIONSHIP
        ? localRegistry.stats.filter((e) => e.kind === ENTITY_KINDS.RELATIONSHIP)
        : kind === ENTITY_KINDS.FLAG
        ? localRegistry.flags
        : localRegistry.items;

      for (const entity of pool) {
        const name = normalizeForMatch(entity.displayName);

        if (kind === ENTITY_KINDS.RELATIONSHIP) {
          const npc = normalizeForMatch(entity.npc);
          const relKey = `${name}|${npc}`;
          const existing = byRelKey.get(relKey);
          if (existing) {
            idRemap.set(entity.id, existing.id);
            continue;
          }
          const sameName = byRelNameOnly.get(name) || [];
          if (sameName.length > 0 && !sameName.some((s) => s.npc === npc)) {
            warnings.push(
              `Quan hệ "${entity.displayName}" ở tập "${ep.title}" có NPC khác với quan hệ cùng tên đã có trước đó — không tự gộp, giữ riêng biệt.`
            );
          }
          registry.stats.push(entity);
          idRemap.set(entity.id, entity.id);
          byRelKey.set(relKey, entity);
          byRelNameOnly.set(name, [...sameName, { npc, entity }]);
          continue;
        }

        const matchKey = `${kind}|${name}`;
        const existing = byMatchKey.get(matchKey);
        if (existing) {
          idRemap.set(entity.id, existing.id);
          continue;
        }
        const sameNameOtherKind = byNameOnly.get(name) || [];
        if (sameNameOtherKind.length > 0 && !sameNameOtherKind.some((s) => s.kind === kind)) {
          warnings.push(
            `"${entity.displayName}" ở tập "${ep.title}" trùng tên với entity loại khác đã có trước đó (${sameNameOtherKind.map((s) => s.kind).join(", ")} ↔ ${kind}) — không tự gộp, giữ riêng biệt.`
          );
        }
        const key = collectionKeyFor(kind);
        registry[key].push(entity);
        idRemap.set(entity.id, entity.id);
        byMatchKey.set(matchKey, entity);
        byNameOnly.set(name, [...sameNameOtherKind, { kind, entity }]);
      }
    }
  }

  const migratedEpisodes = (storyBlueprint?.episodes || []).map((ep) => ({
    ...ep,
    sceneBlueprint: ep.sceneBlueprint ? remapBlueprintEntityIds(ep.sceneBlueprint, idRemap) : ep.sceneBlueprint,
  }));

  return {
    registry,
    idRemap,
    warnings,
    storyBlueprint: { ...storyBlueprint, episodes: migratedEpisodes },
  };
}

function remapCondition(cond, idRemap) {
  if (!cond || !cond.entityId || !idRemap.has(cond.entityId)) return cond;
  return { ...cond, entityId: idRemap.get(cond.entityId) };
}

function remapRules(rules, idRemap) {
  if (!rules) return rules;
  return {
    conditions: (rules.conditions || []).map((c) => remapCondition(c, idRemap)),
    effects: (rules.effects || []).map((e) => remapCondition(e, idRemap)),
  };
}

function remapBlueprintEntityIds(blueprint, idRemap) {
  return {
    ...blueprint,
    scenes: (blueprint.scenes || []).map((s) => ({
      ...s,
      choices: (s.choices || []).map((c) => ({
        ...c,
        rules: remapRules(c.rules, idRemap),
        conditionalOutcomes: (c.conditionalOutcomes || []).map((b) => ({
          ...b,
          conditions: (b.conditions || []).map((cond) => remapCondition(cond, idRemap)),
          effects: (b.effects || []).map((eff) => remapCondition(eff, idRemap)),
        })),
      })),
    })),
  };
}

// Ghi registry toàn cục thành bản mirror của MỌI episode.sceneBlueprint —
// đây là bước duy nhất khiến mọi consumer cũ (compileEpisodeBlueprint,
// ExternalAiBridgeModal, RuleEditor...) tự động thấy đúng dữ liệu canonical
// mà không cần sửa bất kỳ file nào trong số đó.
export function syncRegistryToAllEpisodes(storyBlueprint, registry) {
  return {
    ...storyBlueprint,
    episodes: (storyBlueprint?.episodes || []).map((ep) =>
      ep.sceneBlueprint ? { ...ep, sceneBlueprint: { ...ep.sceneBlueprint, registry } } : ep
    ),
  };
}

// ---------- HOTFIX PRO 5: funnel DUY NHẤT để ghi 1 blueprint vào 1 episode ----------
//
// Trước hotfix này, mỗi nơi gọi setEpisodeBlueprint-kiểu-thủ-công (AI dựng sơ
// đồ lần đầu, tạo sơ đồ trống, nhập kịch bản từ External AI Bridge...) có thể
// âm thầm ghi đè episode.sceneBlueprint.registry bằng 1 registry KHÔNG phải
// globalState.registry (vd rỗng — newSceneBlueprint()/emptyBlueprintBase()
// luôn khởi tạo registry rỗng; hoặc registry đã "chốt" của riêng External AI
// Bridge kèm entity vừa duyệt tạo mới, chưa từng được cộng vào global). Global
// registry khi đó không còn là SOURCE OF TRUTH thật — đúng lỗi kiến trúc bị
// chỉ ra.
//
// applyEpisodeBlueprint() là funnel DUY NHẤT: mọi UI ghi blueprint vào 1
// episode (SmartMindMap.setEpisodeBlueprint — chính là nơi applyPending/
// handleRegenerateScene/handleAddScene/handleDeleteScene/"Tạo sơ đồ
// trống"/EndingsPanel/SceneIntentEditor/ExternalAiBridgeModal.onApplyBlueprint
// đều đi qua) PHẢI gọi hàm này thay vì tự ghép { ...episode, sceneBlueprint }.
// Hàm CỘNG DỒN (không đoán/không merge-theo-tên) mọi entity MỚI có trong
// nextBlueprint.registry nhưng CHƯA có id trong globalState.registry vào
// canonical registry, rồi mirror kết quả ra MỌI episode (kể cả episode vừa
// ghi) — không có nơi nào khác được phép là "source of truth thứ hai".
function unionEntitiesById(existing, incoming) {
  const ids = new Set(existing.map((e) => e.id));
  return [...existing, ...incoming.filter((e) => !ids.has(e.id))];
}

// Entity nào trong `incomingRegistry` chưa có id trong `globalRegistry` được
// coi là THẬT SỰ MỚI (vd External AI Bridge vừa duyệt "Tạo mới") và được cộng
// vào — entity trùng id giữ NGUYÊN bản global (global luôn là bản canonical,
// không bị nội dung cũ hơn từ 1 blueprint local ghi đè ngược).
export function mergeNewEntitiesIntoRegistry(globalRegistry, incomingRegistry) {
  const g = ensureGlobalRegistryShape(globalRegistry);
  const inc = ensureGlobalRegistryShape(incomingRegistry);
  return {
    stats: unionEntitiesById(g.stats, inc.stats),
    flags: unionEntitiesById(g.flags, inc.flags),
    items: unionEntitiesById(g.items, inc.items),
  };
}

// Ghi `nextBlueprint` làm sceneBlueprint của `episodeId` — TRẢ VỀ cả
// storyBlueprint lẫn globalState đã cập nhật, caller chỉ cần set 2 state đó,
// không tự làm gì thêm (không cần tự nhớ sync).
export function applyEpisodeBlueprint(storyBlueprint, globalState, episodeId, nextBlueprint) {
  const mergedRegistry = mergeNewEntitiesIntoRegistry(globalState?.registry, nextBlueprint?.registry);
  const swapped = {
    ...storyBlueprint,
    episodes: (storyBlueprint?.episodes || []).map((ep) =>
      ep.id === episodeId ? { ...ep, sceneBlueprint: nextBlueprint } : ep
    ),
  };
  return {
    storyBlueprint: syncRegistryToAllEpisodes(swapped, mergedRegistry),
    globalState: { ...globalState, registry: mergedRegistry },
  };
}

function collectEpisodeTargets(blueprint) {
  const out = new Set();
  for (const s of blueprint?.scenes || []) {
    for (const c of s.choices || []) {
      if (c.targetType === "episode" && c.targetId) out.add(c.targetId);
      for (const b of c.conditionalOutcomes || []) {
        if (b.targetType === "episode" && b.targetId) out.add(b.targetId);
      }
    }
  }
  return out;
}

// Tập nào tập này dẫn tới (outgoing) + tập nào dẫn vào tập này (incoming) —
// THUẦN suy ra từ choice.targetType==="episode", không lưu trạng thái riêng
// (mục 29: không có nguồn sự thật thứ hai để lệch dữ liệu).
export function episodeTransitionSummary(storyBlueprint, episodeId) {
  const episodes = storyBlueprint?.episodes || [];
  const self = episodes.find((e) => e.id === episodeId);
  const outgoing = self?.sceneBlueprint ? [...collectEpisodeTargets(self.sceneBlueprint)] : [];
  const incoming = episodes
    .filter((e) => e.id !== episodeId && e.sceneBlueprint && collectEpisodeTargets(e.sceneBlueprint).has(episodeId))
    .map((e) => e.id);
  return { outgoing, incoming };
}
