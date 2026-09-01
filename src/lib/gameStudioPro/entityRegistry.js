// Xưởng Game Pro — PRO 3: ENTITY REGISTRY — danh tính chuẩn (canonical) cho
// CHỈ SỐ / CỜ / VẬT PHẨM / QUAN HỆ của một Sơ đồ cảnh (blueprint.registry).
//
// Vì sao cần: nếu để AI/người dùng gõ tự do mỗi lần ("Uy tín" / "uy tin" /
// "Điểm uy tín" / "UY_TIN"), luật sẽ tham chiếu 4 biến khác nhau một cách âm
// thầm (mục 10 yêu cầu PRO 3). Registry là nguồn sự thật DUY NHẤT: mỗi entity
// có 1 `id` ổn định (không đổi khi đổi tên hiển thị) + 1 `displayName` mà
// người dùng luôn thấy. `ruleParser.js` PHẢI resolve qua registry này trước
// khi tạo luật — không được tự âm thầm tạo entity mới (mục 11-12).
//
// Đây vẫn là dữ liệu AUTHORING (giống blueprintModel.js) — runtime thật
// (GamePlayer) không biết registry tồn tại. proCompiler.js là nơi DUY NHẤT
// dịch entity id -> field/key runtime thật (statsConfig.key, requiresFlag
// string, v.v.) — xem mục "RUNTIME MAPPING" ở cuối file.

export const ENTITY_KINDS = { STAT: "stat", RELATIONSHIP: "relationship", FLAG: "flag", ITEM: "item" };

let idCounter = 0;
function uniqueSuffix() {
  idCounter += 1;
  return `${Date.now().toString(36)}${idCounter.toString(36)}`;
}
export function makeEntityId(prefix) {
  return `${prefix}_${uniqueSuffix()}`;
}

export function newEmptyRegistry() {
  return { stats: [], flags: [], items: [] };
}

// Blueprint tạo trước PRO 3 không có `registry` — luôn trả về bản hợp lệ thay
// vì để mọi nơi gọi phải tự phòng thủ `blueprint.registry || {...}`.
export function ensureRegistry(blueprint) {
  const r = blueprint?.registry;
  if (!r || typeof r !== "object") return newEmptyRegistry();
  return {
    stats: Array.isArray(r.stats) ? r.stats : [],
    flags: Array.isArray(r.flags) ? r.flags : [],
    items: Array.isArray(r.items) ? r.items : [],
  };
}

export function normalizeForMatch(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ dấu để so khớp gần đúng
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function newStatEntity({ displayName, isVital = false, deathThreshold, default: def = 0 } = {}) {
  return {
    id: makeEntityId("stat"),
    kind: ENTITY_KINDS.STAT,
    displayName: String(displayName || "").trim(),
    default: Number.isFinite(def) ? def : 0,
    isVital: !!isVital,
    // Chỉ ghi field này khi thật sự có giá trị — tránh key `undefined` lơ
    // lửng (vừa khó đọc vừa làm JSON.parse(JSON.stringify(x)) không còn
    // deep-equal x, gây dương tính giả ở test kiểm tra "compiler không mutate").
    ...(Number.isFinite(deathThreshold) ? { deathThreshold } : {}),
  };
}

// Runtime (GamePlayer rt.npcAffinity) chỉ có 1 trục thiện cảm cho mỗi tên NPC
// — KHÔNG thể có "Sủng ái Lệ Phi" và "Ghen ghét Lệ Phi" độc lập nhau nếu cả
// hai cùng trỏ NPC "Lệ Phi" (xem proCompiler.js). `npc` là key thật sẽ dùng ở
// runtime; `displayName` là nhãn đầy đủ người dùng gõ (vd "Sủng ái Lệ Phi").
export function newRelationshipEntity({ displayName, npc, default: def = 0 } = {}) {
  return {
    id: makeEntityId("rel"),
    kind: ENTITY_KINDS.RELATIONSHIP,
    displayName: String(displayName || "").trim(),
    npc: String(npc || displayName || "").trim(),
    default: Number.isFinite(def) ? def : 0,
  };
}

export function newFlagEntity(displayName) {
  return { id: makeEntityId("flag"), kind: ENTITY_KINDS.FLAG, displayName: String(displayName || "").trim() };
}
export function newItemEntity(displayName) {
  return { id: makeEntityId("item"), kind: ENTITY_KINDS.ITEM, displayName: String(displayName || "").trim() };
}

export function addStatEntity(registry, opts) {
  return { ...registry, stats: [...registry.stats, newStatEntity(opts)] };
}
export function addRelationshipEntity(registry, opts) {
  return { ...registry, stats: [...registry.stats, newRelationshipEntity(opts)] };
}
export function addFlagEntity(registry, displayName) {
  return { ...registry, flags: [...registry.flags, newFlagEntity(displayName)] };
}
export function addItemEntity(registry, displayName) {
  return { ...registry, items: [...registry.items, newItemEntity(displayName)] };
}

function collectionKeyFor(kind) {
  if (kind === ENTITY_KINDS.STAT || kind === ENTITY_KINDS.RELATIONSHIP) return "stats";
  if (kind === ENTITY_KINDS.FLAG) return "flags";
  if (kind === ENTITY_KINDS.ITEM) return "items";
  return null;
}

export function updateEntity(registry, kind, id, patch) {
  const key = collectionKeyFor(kind);
  if (!key) return registry;
  return { ...registry, [key]: registry[key].map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}
export function removeEntity(registry, kind, id) {
  const key = collectionKeyFor(kind);
  if (!key) return registry;
  return { ...registry, [key]: registry[key].filter((e) => e.id !== id) };
}

export function listEntities(registry, kind) {
  if (kind === ENTITY_KINDS.STAT) return registry.stats.filter((e) => e.kind === ENTITY_KINDS.STAT);
  if (kind === ENTITY_KINDS.RELATIONSHIP) return registry.stats.filter((e) => e.kind === ENTITY_KINDS.RELATIONSHIP);
  if (kind === ENTITY_KINDS.FLAG) return registry.flags;
  if (kind === ENTITY_KINDS.ITEM) return registry.items;
  if (kind === "quantity") return registry.stats; // stat HOẶC relationship — cả hai đều là "đại lượng số"
  return [];
}

export function findEntityById(registry, kind, id) {
  return listEntities(registry, kind).find((e) => e.id === id) || null;
}
// Tìm theo id mà không cần biết trước kind — dùng khi compile luật (chỉ có entityId).
export function findEntityByIdAnyKind(registry, id) {
  return registry.stats.find((e) => e.id === id) || registry.flags.find((e) => e.id === id) || registry.items.find((e) => e.id === id) || null;
}

// ---------- Entity resolution (mục 11) ----------
// Cố map 1 cụm từ về ĐÚNG 1 entity đã có trong registry — KHÔNG tự tạo âm
// thầm entity mới. `kind`: "quantity" (stat hoặc relationship), "stat",
// "relationship", "flag", "item".
//
// Trả về:
//   { status: "matched", entity }              — khớp chính xác (sau khi chuẩn hoá) hoặc chỉ 1 khớp gần đúng
//   { status: "ambiguous", candidates, text }   — khớp gần đúng NHIỀU entity — người dùng phải chọn
//   { status: "not_found", text }               — không khớp gì — người dùng phải chọn "dùng X có sẵn" hoặc "tạo mới"
export function resolveEntity(registry, kind, text) {
  const wanted = normalizeForMatch(text);
  if (!wanted) return { status: "not_found", text: String(text || "") };
  const pool = listEntities(registry, kind);
  const exact = pool.find((e) => normalizeForMatch(e.displayName) === wanted);
  if (exact) return { status: "matched", entity: exact };
  const near = pool.filter((e) => {
    const have = normalizeForMatch(e.displayName);
    return have && (have.includes(wanted) || wanted.includes(have));
  });
  if (near.length === 1) return { status: "matched", entity: near[0] };
  if (near.length > 1) return { status: "ambiguous", candidates: near, text: String(text || "") };
  return { status: "not_found", text: String(text || "") };
}

// Cảnh báo mềm: 2 entity quan hệ khác nhau cùng trỏ 1 NPC sẽ đụng key runtime
// (mục 19 — không cần dựng engine quan hệ đa trục riêng, nhưng phải cảnh báo
// rõ nếu người dùng vô tình tạo 2 trục cho cùng 1 NPC).
export function findRelationshipNpcCollisions(registry) {
  const byNpc = new Map();
  for (const e of listEntities(registry, ENTITY_KINDS.RELATIONSHIP)) {
    const key = normalizeForMatch(e.npc);
    if (!key) continue;
    if (!byNpc.has(key)) byNpc.set(key, []);
    byNpc.get(key).push(e);
  }
  return [...byNpc.values()].filter((group) => group.length > 1);
}

// ---------- RUNTIME MAPPING (tham khảo — xem proCompiler.js) ----------
// STAT          -> meta.statsConfig entry { key: entity.id, label: displayName, default, isVital, deathThreshold }
//                  + choice.statRequirements/statRequirementsMax/statModifiers keyed by entity.id
// RELATIONSHIP  -> choice.requiresNpcAffinity/requiresNpcAffinityMax/npcAffinity keyed by entity.npc (string thô)
// FLAG          -> choice.requiresFlag/requiresFlagAbsent/grantFlags keyed bằng entity.displayName (string thô,
//                  runtime không có khái niệm ID cho cờ)
// ITEM          -> choice.requiresItem/grantItem/removeItem keyed bằng entity.displayName (string thô)
