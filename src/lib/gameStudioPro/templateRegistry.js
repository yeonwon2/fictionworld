// Xưởng Game Pro — PRO 6: TEMPLATE REGISTRY — bộ khởi tạo theo thể loại (mục
// 13/14). Template KHÔNG phải runtime riêng, KHÔNG phải "Xưởng Pro <thể
// loại>" riêng (mục 1) — nó chỉ là DỮ LIỆU đề xuất (entity + mechanics +
// hướng dẫn Planner) mà người dùng có thể áp (additive) vào registry/mechanics
// hiện có của game, qua applyTemplate() bên dưới. `suggestedEntities` dùng
// hình dạng THÔ `{kind, displayName, ...}` (không phải entity id thật) — id
// chỉ được cấp phát lúc apply, sau khi đã resolve chống trùng với registry
// hiện có (mục 17 — tái dùng ĐÚNG entityRegistry.js.resolveEntity()).
import {
  ENTITY_KINDS,
  ensureRegistry,
  resolveEntity,
  normalizeForMatch,
  newStatEntity,
  newRelationshipEntity,
  newFlagEntity,
  newItemEntity,
} from "./entityRegistry.js";
import { MECHANIC_IDS, enableMechanics, addRankConfig, findRankConfigByTemplateId } from "./mechanicsModel.js";

export const TEMPLATE_IDS = {
  BLANK: "blank",
  VISUAL_NOVEL: "visual_novel",
  PALACE: "palace",
  SYSTEM: "system",
  REBIRTH: "rebirth",
  SURVIVAL: "survival",
  ADVENTURE: "adventure",
};

// entity trong suggestedEntities: { kind, displayName, isVital?, deathThreshold?, default?, npc? }
export const TEMPLATES = [
  {
    id: TEMPLATE_IDS.BLANK,
    label: "Tự thiết kế",
    description: "Bắt đầu từ trống — tự chọn chỉ số/cơ chế theo ý riêng.",
    suggestedEntities: [],
    suggestedMechanics: [],
    suggestedRank: null,
    plannerGuidance: "",
  },
  {
    id: TEMPLATE_IDS.VISUAL_NOVEL,
    label: "Tình cảm",
    description: "Visual novel tập trung vào lựa chọn & mối quan hệ.",
    suggestedEntities: [
      { kind: ENTITY_KINDS.STAT, displayName: "Thiện cảm chung", default: 0 },
    ],
    suggestedMechanics: [MECHANIC_IDS.RELATIONSHIP],
    suggestedRank: null,
    plannerGuidance: "Game tập trung vào lựa chọn tình cảm/hội thoại và mối quan hệ với các nhân vật quan trọng — ưu tiên nhánh rẽ theo thiện cảm hơn là chiến đấu/sinh tồn.",
  },
  {
    id: TEMPLATE_IDS.PALACE,
    label: "Cung Đấu",
    description: "Hậu cung/triều đình — sinh tồn, uy tín, quyền lực, thăng tiến.",
    suggestedEntities: [
      { kind: ENTITY_KINDS.STAT, displayName: "Sinh tồn", default: 100, isVital: true, deathThreshold: 0 },
      { kind: ENTITY_KINDS.STAT, displayName: "Uy tín", default: 0 },
      { kind: ENTITY_KINDS.STAT, displayName: "Quyền lực", default: 0 },
    ],
    suggestedMechanics: [MECHANIC_IDS.VITAL_STAT, MECHANIC_IDS.RELATIONSHIP, MECHANIC_IDS.RANK, MECHANIC_IDS.INVENTORY],
    suggestedRank: {
      label: "Cấp bậc hậu cung",
      statDisplayName: "Uy tín",
      levels: [
        { label: "Cung nữ", threshold: 0 },
        { label: "Nữ quan", threshold: 10 },
        { label: "Quý nhân", threshold: 30 },
        { label: "Tần", threshold: 60 },
        { label: "Phi", threshold: 100 },
        { label: "Quý phi", threshold: 150 },
        { label: "Hoàng hậu", threshold: 220 },
      ],
    },
    plannerGuidance: "Game tập trung vào tranh quyền, quan hệ NPC, địa vị hậu cung và sinh tồn — thăng tiến theo Uy tín, nguy cơ mất mạng nếu Sinh tồn chạm 0.",
  },
  {
    id: TEMPLATE_IDS.SYSTEM,
    label: "Hệ Thống",
    description: "Nhân vật mang theo \"hệ thống\" — nhiệm vụ, điểm, thông báo.",
    suggestedEntities: [
      { kind: ENTITY_KINDS.STAT, displayName: "Sinh tồn", default: 100, isVital: true, deathThreshold: 0 },
      { kind: ENTITY_KINDS.STAT, displayName: "Điểm hệ thống", default: 0 },
    ],
    suggestedMechanics: [MECHANIC_IDS.VITAL_STAT, MECHANIC_IDS.CURRENCY, MECHANIC_IDS.SYSTEM, MECHANIC_IDS.QUEST, MECHANIC_IDS.INVENTORY],
    suggestedRank: null,
    plannerGuidance: "Nhân vật chính mang theo một \"hệ thống\" thông báo nhiệm vụ/thưởng phạt bằng Điểm hệ thống — có nguy cơ tử vong nếu Sinh tồn chạm 0.",
  },
  {
    id: TEMPLATE_IDS.REBIRTH,
    label: "Trọng Sinh Làm Giàu",
    description: "Trọng sinh, khởi nghiệp/làm giàu — tiền, danh tiếng, thăng tiến.",
    suggestedEntities: [
      { kind: ENTITY_KINDS.STAT, displayName: "Tiền", default: 100 },
      { kind: ENTITY_KINDS.STAT, displayName: "Danh tiếng", default: 0 },
    ],
    suggestedMechanics: [MECHANIC_IDS.CURRENCY, MECHANIC_IDS.RANK, MECHANIC_IDS.INVENTORY],
    suggestedRank: {
      label: "Cấp bậc tài sản",
      statDisplayName: "Tiền",
      levels: [
        { label: "Tay trắng", threshold: 0 },
        { label: "Đủ ăn", threshold: 200 },
        { label: "Khá giả", threshold: 600 },
        { label: "Giàu có", threshold: 1500 },
        { label: "Đại gia", threshold: 5000 },
      ],
    },
    plannerGuidance: "Nhân vật chính trọng sinh với ký ức đời trước, tập trung tích luỹ Tiền và Danh tiếng qua các quyết định đầu tư/kinh doanh — không cần mô phỏng tài chính chi tiết.",
  },
  {
    id: TEMPLATE_IDS.SURVIVAL,
    label: "Sinh Tồn",
    description: "Sinh tồn trong môi trường khắc nghiệt.",
    suggestedEntities: [
      { kind: ENTITY_KINDS.STAT, displayName: "Sinh tồn", default: 100, isVital: true, deathThreshold: 0 },
      { kind: ENTITY_KINDS.STAT, displayName: "Thể lực", default: 100 },
    ],
    suggestedMechanics: [MECHANIC_IDS.VITAL_STAT, MECHANIC_IDS.INVENTORY],
    suggestedRank: null,
    plannerGuidance: "Trọng tâm là sinh tồn trước môi trường/nguy hiểm — quản lý Sinh tồn và Thể lực, vật phẩm hỗ trợ sống sót.",
  },
  {
    id: TEMPLATE_IDS.ADVENTURE,
    label: "Phiêu Lưu",
    description: "Phiêu lưu khám phá — sinh tồn, vật phẩm, quan hệ đồng hành.",
    suggestedEntities: [
      { kind: ENTITY_KINDS.STAT, displayName: "Sinh tồn", default: 100, isVital: true, deathThreshold: 0 },
    ],
    suggestedMechanics: [MECHANIC_IDS.VITAL_STAT, MECHANIC_IDS.INVENTORY, MECHANIC_IDS.RELATIONSHIP],
    suggestedRank: null,
    plannerGuidance: "Hành trình phiêu lưu/khám phá nhiều địa điểm, thu thập vật phẩm, xây dựng quan hệ với bạn đồng hành.",
  },
];

export function findTemplate(templateId) {
  return TEMPLATES.find((t) => t.id === templateId) || null;
}

// resolveEntity() (entityRegistry.js) chỉ tìm trong ĐÚNG 1 pool theo kind
// (stat/relationship dùng chung mảng `stats` nhưng lọc riêng theo
// entity.kind) — không tự phát hiện trùng tên giữa 2 LOẠI khác nhau (vd 1
// flag và 1 stat cùng tên "Uy tín"). Quét chéo toàn bộ registry để bắt đúng
// ca "xung đột khác loại" mà mục 17 yêu cầu.
function findEntityByNameAnyKind(registry, name) {
  const wanted = normalizeForMatch(name);
  if (!wanted) return null;
  const pools = [...registry.stats, ...registry.flags, ...registry.items];
  return pools.find((e) => normalizeForMatch(e.displayName) === wanted) || null;
}

// So khớp 1 suggestedEntity với registry hiện có — dùng ĐÚNG resolveEntity()
// (entityRegistry.js, cùng cơ chế "exact-safe" đã dùng ở External AI Bridge
// PRO 4 và migration PRO 5), KHÔNG tự viết lại thuật toán so khớp riêng.
function resolveSuggestedEntity(registry, suggested) {
  const kindForResolve = suggested.kind === ENTITY_KINDS.RELATIONSHIP ? "relationship" : suggested.kind;
  const result = resolveEntity(registry, kindForResolve, suggested.displayName);
  if (result.status === "matched") return { status: "existing", suggested, entity: result.entity };
  if (result.status === "ambiguous") {
    return { status: "conflict", suggested, reason: `"${suggested.displayName}" khớp gần đúng với nhiều entity đã có — cần người dùng tự chọn.` };
  }
  // not_found trong ĐÚNG loại — vẫn có thể trùng tên với 1 entity loại khác.
  const crossKind = findEntityByNameAnyKind(registry, suggested.displayName);
  if (crossKind) {
    return { status: "conflict", suggested, reason: `"${suggested.displayName}" đã tồn tại nhưng khác loại (${crossKind.kind} ≠ ${suggested.kind}).` };
  }
  return { status: "new", suggested };
}

// Preview THUẦN (không mutate gì) — spec mục 15: hiển thị "Sẽ thêm / Đã tồn
// tại / Xung đột" trước khi cho người dùng bấm Áp dụng. Tách khỏi
// previewTemplate() để dùng lại cho MỌI danh sách suggested {kind,
// displayName,...} thô, không chỉ danh sách cố định của 1 template (vd
// suggestedStats/suggestedRelationships/... của chính Game Plan — xem
// PlannerEditor.jsx handleApprove()).
export function previewSuggestedEntities(registry, suggestedList) {
  const r = ensureRegistry({ registry });
  const resolved = (suggestedList || []).map((s) => resolveSuggestedEntity(r, s));
  return {
    toAdd: resolved.filter((x) => x.status === "new").map((x) => x.suggested),
    existing: resolved.filter((x) => x.status === "existing"),
    conflicts: resolved.filter((x) => x.status === "conflict"),
  };
}

export function previewTemplate(registry, templateId) {
  const template = findTemplate(templateId);
  if (!template) return { template: null, toAdd: [], existing: [], conflicts: [] };
  const { toAdd, existing, conflicts } = previewSuggestedEntities(registry, template.suggestedEntities);
  return { template, toAdd, existing, conflicts };
}

function instantiateEntity(suggested) {
  if (suggested.kind === ENTITY_KINDS.STAT) {
    return newStatEntity({ displayName: suggested.displayName, isVital: suggested.isVital, deathThreshold: suggested.deathThreshold, default: suggested.default });
  }
  if (suggested.kind === ENTITY_KINDS.RELATIONSHIP) {
    return newRelationshipEntity({ displayName: suggested.displayName, npc: suggested.npc, default: suggested.default });
  }
  if (suggested.kind === ENTITY_KINDS.FLAG) return newFlagEntity(suggested.displayName);
  if (suggested.kind === ENTITY_KINDS.ITEM) return newItemEntity(suggested.displayName);
  return null;
}

function collectionKeyFor(kind) {
  if (kind === ENTITY_KINDS.STAT || kind === ENTITY_KINDS.RELATIONSHIP) return "stats";
  if (kind === ENTITY_KINDS.FLAG) return "flags";
  if (kind === ENTITY_KINDS.ITEM) return "items";
  return null;
}

// Merge theo TÊN+LOẠI (khác với globalStateModel.mergeNewEntitiesIntoRegistry
// vốn merge theo ID) — cần thiết vì entity đề xuất bởi template là dữ liệu
// THÔ chưa có id thật, phải resolve theo tên trước khi biết có phải "mới"
// không (mục 17). Chỉ cộng dồn (không xoá/không sửa entity có sẵn).
export function mergeNamedEntitiesIntoRegistry(registry, toAddSuggested) {
  const r = ensureRegistry({ registry });
  const next = { stats: [...r.stats], flags: [...r.flags], items: [...r.items] };
  const created = [];
  for (const suggested of toAddSuggested) {
    const entity = instantiateEntity(suggested);
    if (!entity) continue;
    const key = collectionKeyFor(suggested.kind);
    next[key].push(entity);
    created.push(entity);
  }
  return { registry: next, created };
}

// Áp dụng 1 template vào proDoc — THUẦN (trả proDoc mới, không mutate) — chỉ
// cộng entity mới + bật mechanics đề xuất (union) + gắn rank config nếu
// template có đề xuất (trỏ vào entity Uy tín/Tiền vừa resolve, không sở hữu
// bản sao riêng — mục "currency/rank không sở hữu entity" ở mechanicsModel.js).
// KHÔNG bao giờ đụng episodes/scenes/rules/startEpisodeId (mục 16).
export function applyTemplate(proDoc, templateId) {
  const template = findTemplate(templateId);
  if (!template) return proDoc;
  const preview = previewTemplate(proDoc.globalState?.registry, templateId);
  const { registry: mergedRegistry, created } = mergeNamedEntitiesIntoRegistry(proDoc.globalState?.registry, preview.toAdd);

  let mechanics = enableMechanics(proDoc.mechanics, template.suggestedMechanics);

  // HOTFIX PRO 6: idempotent với rank do CHÍNH template này đã tạo trước đó
  // (đánh dấu bằng templateId, KHÔNG dùng label — 2 template khác nhau có
  // thể trùng label, và người dùng có thể tự đổi label sau khi tạo). Nếu đã
  // có, TÁI SỬ DỤNG (giữ nguyên, không tạo thêm bản sao) — áp lại cùng
  // template nhiều lần, hoặc đổi qua template khác rồi quay lại, không tích
  // tụ rank config trùng. Rank do người dùng tự tạo tay luôn có
  // templateId=null nên không bao giờ bị coi là "đã có" ở đây — không bị
  // applyTemplate() đụng tới.
  if (template.suggestedRank && !findRankConfigByTemplateId(mechanics, template.id)) {
    const byName = (name) =>
      [...mergedRegistry.stats].find((e) => e.displayName === name) ||
      preview.existing.find((x) => x.suggested.displayName === name)?.entity ||
      created.find((e) => e.displayName === name);
    const statEntity = byName(template.suggestedRank.statDisplayName);
    if (statEntity) {
      mechanics = addRankConfig(mechanics, {
        label: template.suggestedRank.label,
        entityId: statEntity.id,
        levels: template.suggestedRank.levels,
        templateId: template.id,
      });
    }
  }

  return {
    ...proDoc,
    templateId: template.id,
    globalState: { ...proDoc.globalState, registry: mergedRegistry },
    mechanics,
  };
}
