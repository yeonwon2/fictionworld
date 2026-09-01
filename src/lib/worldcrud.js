import { supabase } from "@/lib/supabase";
import { LEGACY_GAME_FILTER } from "@/lib/gameListFilters";

// =============================================================================
// CRUD — kết nối trực tiếp Supabase (Postgres + Storage), thay cho backend Base44.
// Mọi entity nội dung đều có story_id để phân theo bộ truyện đang chọn.
// Đây là điểm hội tụ DUY NHẤT gọi Supabase — mọi rule tiết kiệm egress (chọn
// cột cần thiết, nén ảnh, dọn ảnh cũ) đều nằm ở đây, không rải rác ở UI.
// =============================================================================

const BUCKET = "fictionworld-media";
const MAX_IMAGE_DIM = 1000;

// ---------- Helper CRUD chung ----------
async function listTable(table, storyId, orderCol = "updated_at", ascending = false, limit) {
  let q = supabase.from(table).select("*").order(orderCol, { ascending });
  if (storyId) q = q.eq("story_id", storyId);
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function createRow(table, data) {
  const { data: row, error } = await supabase.from(table).insert(cleanPayload(data)).select().single();
  if (error) throw error;
  return row;
}

async function updateRow(table, id, data) {
  const { data: row, error } = await supabase.from(table).update(cleanPayload(data)).eq("id", id).select().single();
  if (error) throw error;
  return row;
}

async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

// Cập nhật record có trường ảnh (avatar_url/cover_url/map_url): sau khi lưu
// thành công, nếu ảnh đổi khác thì xoá object ảnh cũ khỏi Storage — tránh rác
// tích luỹ mỗi lần thay ảnh (đúng lỗi từng gặp và sửa ở dự án LilyHub).
async function updateRowReplacingImage(table, id, data, imageField) {
  let oldUrl = null;
  if (Object.prototype.hasOwnProperty.call(data, imageField)) {
    const { data: existing } = await supabase.from(table).select(imageField).eq("id", id).single();
    oldUrl = existing?.[imageField] || null;
  }
  const row = await updateRow(table, id, data);
  if (oldUrl && oldUrl !== row[imageField]) {
    await deleteFileByUrl(oldUrl);
  }
  return row;
}

// Bỏ các trường rỗng/null để không ghi đè dữ liệu cũ bằng chuỗi rỗng
function cleanPayload(data) {
  const out = {};
  Object.entries(data).forEach(([k, v]) => {
    if (v === "" || v === null || v === undefined) return;
    out[k] = v;
  });
  return out;
}

// ---------- Bộ truyện (Story) ----------
export async function listStories() {
  return listTable("stories", null, "updated_at", false, 100);
}
export async function createStory(data) {
  return createRow("stories", data);
}
export async function updateStory(id, data) {
  return updateRowReplacingImage("stories", id, data, "cover_url");
}
export async function deleteStory(id) {
  return deleteRow("stories", id);
}

// ---------- Nhân vật (Character) ----------
export async function listCharacters(storyId) {
  return listTable("characters", storyId, "updated_at", false, 200);
}
export async function getCharacter(id) {
  const { data, error } = await supabase.from("characters").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}
export async function createCharacter(data) {
  return createRow("characters", data);
}
export async function updateCharacter(id, data) {
  return updateRowReplacingImage("characters", id, data, "avatar_url");
}
export async function deleteCharacter(id) {
  return deleteRow("characters", id);
}

// ---------- Mối quan hệ (Relationship) ----------
export async function listRelationships(storyId) {
  return listTable("relationships", storyId, "updated_at", false, 300);
}
export async function addRelationship(data) {
  return createRow("relationships", data);
}
export async function updateRelationship(id, data) {
  return updateRow("relationships", id, data);
}
export async function deleteRelationship(id) {
  return deleteRow("relationships", id);
}

// ---------- Địa danh (Location) ----------
export async function listLocations(storyId) {
  return listTable("locations", storyId, "updated_at", false, 200);
}
export async function createLocation(data) {
  return createRow("locations", data);
}
export async function updateLocation(id, data) {
  return updateRowReplacingImage("locations", id, data, "map_url");
}
export async function deleteLocation(id) {
  return deleteRow("locations", id);
}

// ---------- Sự kiện (Event) ----------
export async function listEvents(storyId) {
  return listTable("events", storyId, "updated_at", false, 200);
}
export async function createEvent(data) {
  return createRow("events", data);
}
export async function updateEvent(id, data) {
  return updateRow("events", id, data);
}
export async function deleteEvent(id) {
  return deleteRow("events", id);
}

// ---------- Thuật ngữ riêng của truyện (Glossary) ----------
export async function listGlossary(storyId) {
  return listTable("glossary_terms", storyId, "category", true, 500);
}
export async function createGlossary(data) {
  return createRow("glossary_terms", data);
}
export async function updateGlossary(id, data) {
  return updateRow("glossary_terms", id, data);
}
export async function deleteGlossary(id) {
  return deleteRow("glossary_terms", id);
}

// ---------- Chương truyện (Chapter) ----------
// listChapters() chỉ trả cột nhẹ (KHÔNG có content) — dùng cho danh sách/sidebar.
// Gọi getChapter(id) riêng khi cần đọc/sửa nội dung một chương cụ thể — tránh
// tải full content của toàn bộ chương chỉ để hiển thị tiêu đề trong danh sách.
const CHAPTER_LITE_COLUMNS = "id, story_id, title, chapter_number, updated_at";

export async function listChapters(storyId) {
  let q = supabase.from("chapters").select(CHAPTER_LITE_COLUMNS).order("chapter_number", { ascending: true });
  if (storyId) q = q.eq("story_id", storyId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function getChapter(id) {
  const { data, error } = await supabase.from("chapters").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}
export async function createChapter(data) {
  return createRow("chapters", data);
}
export async function updateChapter(id, data) {
  return updateRow("chapters", id, data);
}
export async function deleteChapter(id) {
  return deleteRow("chapters", id);
}

// ---------- Snapshot chương (chapter_snapshots) ----------
// Cùng nguyên lý writer_doc_snapshots: chụp lại nội dung CŨ trước khi một lần
// lưu ghi đè nó (đặc biệt sau khi AI viết lại/sửa theo góp ý) — có đường quay
// lại nếu bản mới tệ hơn.
export async function createChapterSnapshot(storyId, chapterId, { title, content, chapterNumber, label }) {
  const { data: row, error } = await supabase
    .from("chapter_snapshots")
    .insert({ story_id: storyId, chapter_id: chapterId, title, content, chapter_number: chapterNumber, label })
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function listChapterSnapshots(chapterId, limit = 20) {
  const { data, error } = await supabase
    .from("chapter_snapshots")
    .select("id, chapter_id, title, label, chapter_number, created_at")
    .eq("chapter_id", chapterId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getChapterSnapshot(id) {
  const { data, error } = await supabase.from("chapter_snapshots").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function deleteChapterSnapshot(id) {
  const { error } = await supabase.from("chapter_snapshots").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Xưởng Viết Truyện (writer_docs) — bộ tài liệu sống theo bộ truyện ----------
// doc_key cố định: quy_tac_viet | the_gioi | nhan_vat | quan_he | dai_cuong | fuc_but | timeline | tom_tat_hien_tai
const WRITER_DOC_COLUMNS = "id, story_id, doc_key, title, content, updated_at, created_at";

export async function listWriterDocs(storyId) {
  let q = supabase.from("writer_docs").select(WRITER_DOC_COLUMNS).order("doc_key", { ascending: true });
  if (storyId) q = q.eq("story_id", storyId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getWriterDoc(storyId, docKey) {
  const { data, error } = await supabase
    .from("writer_docs")
    .select(WRITER_DOC_COLUMNS)
    .eq("story_id", storyId)
    .eq("doc_key", docKey)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function upsertWriterDoc(storyId, docKey, data) {
  const payload = { story_id: storyId, doc_key: docKey, ...data };
  const { data: row, error } = await supabase.from("writer_docs").upsert(payload, { onConflict: "story_id,doc_key" }).select().single();
  if (error) throw error;
  return row;
}

export async function deleteWriterDoc(storyId, docKey) {
  const { error } = await supabase.from("writer_docs").delete().eq("story_id", storyId).eq("doc_key", docKey);
  if (error) throw error;
}

// ---------- Snapshot bible (writer_doc_snapshots) ----------
export async function createWriterDocSnapshot(storyId, docKey, { title, content, label }) {
  const { data: row, error } = await supabase
    .from("writer_doc_snapshots")
    .insert({ story_id: storyId, doc_key: docKey, title, content, label })
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function listWriterDocSnapshots(storyId, docKey, limit = 20) {
  const { data, error } = await supabase
    .from("writer_doc_snapshots")
    .select("id, story_id, doc_key, title, label, created_at")
    .eq("story_id", storyId)
    .eq("doc_key", docKey)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getWriterDocSnapshot(id) {
  const { data, error } = await supabase.from("writer_doc_snapshots").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function deleteWriterDocSnapshot(id) {
  const { error } = await supabase.from("writer_doc_snapshots").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Xưởng Game (Game) ----------
// listGames() chỉ trả cột nhẹ (KHÔNG có nodes/meta) — dùng cho thư viện/danh
// sách game. Gọi getGame(id) riêng khi mở một game cụ thể để chơi/sửa/xuất —
// tránh tải toàn bộ node graph (có thể vài chục KB) chỉ để hiển thị tiêu đề.
const GAME_LITE_COLUMNS = "id, story_id, title, node_count, updated_at, created_at";

export async function listGames() {
  const { data, error } = await supabase
    .from("games")
    .select(GAME_LITE_COLUMNS)
    // Chỉ loại game Pro. Legacy có thể mang builder cũ/khác hoặc không có
    // builder, nên lọc `!= pro OR is null` thay vì giả định tất cả đều null.
    .or(LEGACY_GAME_FILTER)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}
// Thư viện riêng cho Xưởng Game Pro — cùng bảng `games`, chỉ lọc theo
// meta.builder = "pro" (xem proModel.js / proCompiler.js).
export async function listProGames() {
  const { data, error } = await supabase
    .from("games")
    .select(GAME_LITE_COLUMNS)
    .filter("meta->>builder", "eq", "pro")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}
export async function getGame(id) {
  const { data, error } = await supabase.from("games").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}
export async function createGame(data) {
  const payload = { ...data };
  if (payload.nodes) payload.node_count = Object.keys(payload.nodes).length;
  return createRow("games", payload);
}
export async function updateGame(id, data) {
  const payload = { ...data };
  if (payload.nodes) payload.node_count = Object.keys(payload.nodes).length;
  return updateRow("games", id, payload);
}
export async function deleteGame(id) {
  return deleteRow("games", id);
}

// ---------- Xưởng Theme (custom_themes) — mẫu theme tự tạo, dùng lại giữa nhiều game ----------
export async function listThemes() {
  const { data, error } = await supabase.from("custom_themes").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function createTheme(data) {
  return createRow("custom_themes", data);
}
export async function updateTheme(id, data) {
  return updateRow("custom_themes", id, data);
}
export async function deleteTheme(id) {
  return deleteRow("custom_themes", id);
}

// ---------- Xưởng Kịch Bản Game (game_script_*) ----------
// Mô hình xưởng viết kịch bản game: 1 config (loại game) + bộ tài liệu bible
// (game_script_docs) + tuyến kịch bản (game_routes) + phân cảnh theo tuyến
// (game_scenes). Cùng nguyên tắc "trí nhớ dài hạn" của WritingFactory.
const GAME_SCRIPT_DOC_COLUMNS = "id, story_id, doc_key, title, content, updated_at, created_at";
const GAME_ROUTE_COLUMNS = "id, story_id, route_key, name, color, description, sort_order, updated_at, created_at";
// listGameScenes() chỉ trả cột nhẹ (KHÔNG có content) — gọi getGameScene(id) khi cần đọc/sửa.
const GAME_SCENE_LITE_COLUMNS = "id, story_id, route_key, scene_order, title, scene_type, status, updated_at, created_at";

export async function getGameScriptConfig(storyId) {
  const { data, error } = await supabase
    .from("game_script_config")
    .select("*")
    .eq("story_id", storyId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function upsertGameScriptConfig(storyId, data) {
  const payload = { story_id: storyId, ...data };
  const { data: row, error } = await supabase
    .from("game_script_config")
    .upsert(payload, { onConflict: "story_id" })
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function listGameScriptDocs(storyId) {
  let q = supabase.from("game_script_docs").select(GAME_SCRIPT_DOC_COLUMNS).order("doc_key", { ascending: true });
  if (storyId) q = q.eq("story_id", storyId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getGameScriptDoc(storyId, docKey) {
  const { data, error } = await supabase
    .from("game_script_docs")
    .select(GAME_SCRIPT_DOC_COLUMNS)
    .eq("story_id", storyId)
    .eq("doc_key", docKey)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function upsertGameScriptDoc(storyId, docKey, data) {
  const payload = { story_id: storyId, doc_key: docKey, ...data };
  const { data: row, error } = await supabase
    .from("game_script_docs")
    .upsert(payload, { onConflict: "story_id,doc_key" })
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function deleteGameScriptDoc(storyId, docKey) {
  const { error } = await supabase
    .from("game_script_docs")
    .delete()
    .eq("story_id", storyId)
    .eq("doc_key", docKey);
  if (error) throw error;
}

export async function listGameRoutes(storyId) {
  let q = supabase.from("game_routes").select(GAME_ROUTE_COLUMNS).order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (storyId) q = q.eq("story_id", storyId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createGameRoute(data) {
  return createRow("game_routes", data);
}
export async function updateGameRoute(id, data) {
  return updateRow("game_routes", id, data);
}
export async function deleteGameRoute(id) {
  return deleteRow("game_routes", id);
}

export async function listGameScenes(storyId, routeKey) {
  let q = supabase.from("game_scenes").select(GAME_SCENE_LITE_COLUMNS).order("scene_order", { ascending: true });
  if (storyId) q = q.eq("story_id", storyId);
  if (routeKey) q = q.eq("route_key", routeKey);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getGameScene(id) {
  const { data, error } = await supabase.from("game_scenes").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}
export async function createGameScene(data) {
  return createRow("game_scenes", data);
}
export async function updateGameScene(id, data) {
  return updateRow("game_scenes", id, data);
}
export async function deleteGameScene(id) {
  return deleteRow("game_scenes", id);
}

// ---------- Xưởng Kịch Bản Game (luồng mới) — game_script_projects ----------
// Wizard: ý tưởng → AI gợi ý bộ khung → duyệt → 4 nhánh → chốt → xuất kịch bản.
const GSP_COLUMNS = "id, story_id, workshop, title, idea, genre, scene_count, choices_per_scene, branch_count, notes, player_name, player_desc, main_quest, status, updated_at, created_at";
const GPM_LEGACY_COLUMNS = "project_id, characters, settings, endings, branches, notes, updated_at, created_at";
const GPM_COLUMNS = "project_id, characters, settings, endings, branches, notes, game_bible, scene_contracts, compiler_report, invariants, updated_at, created_at";
const GPS_COLUMNS = "id, project_id, scene_order, title, description, location, characters, foreshadow, state_contract, chapter_index, is_checkpoint, choices, is_branch_point, branch_index, status, updated_at, created_at";
const GPB_COLUMNS = "id, project_id, branch_index, name, description, scene_order_ids, status, updated_at, created_at";
const GPC_COLUMNS = "id, project_id, branch_id, scene_id, scene_order, title, draft, script, status, updated_at, created_at";

export async function listGameScriptProjects(storyId) {
  let q = supabase.from("game_script_projects").select(GSP_COLUMNS).order("updated_at", { ascending: false });
  if (storyId) q = q.eq("story_id", storyId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function getGameScriptProject(id) {
  const { data, error } = await supabase.from("game_script_projects").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}
export async function createGameScriptProject(data) {
  return createRow("game_script_projects", data);
}
export async function updateGameScriptProject(id, data) {
  return updateRow("game_script_projects", id, data);
}
export async function deleteGameScriptProject(id) {
  return deleteRow("game_script_projects", id);
}

export async function getGamePlanMeta(projectId) {
  let { data, error } = await supabase
    .from("game_plan_meta")
    .select(GPM_COLUMNS)
    .eq("project_id", projectId)
    .maybeSingle();
  // Databases that have not run the Phase 1 migration can still open and edit
  // existing projects. Only persisting compiler snapshots requires migration.
  if (error && /game_bible|scene_contracts|compiler_report|invariants/i.test(error.message || "")) {
    const fallback = await supabase.from("game_plan_meta").select(GPM_LEGACY_COLUMNS).eq("project_id", projectId).maybeSingle();
    data = fallback.data ? { ...fallback.data, game_bible: {}, scene_contracts: [], compiler_report: {}, invariants: [] } : fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  return data || null;
}
export async function upsertGamePlanMeta(projectId, data) {
  const payload = { project_id: projectId, ...data };
  let { data: row, error } = await supabase.from("game_plan_meta").upsert(payload, { onConflict: "project_id" }).select().single();
  if (error && /invariants/i.test(error.message || "")) {
    const { invariants: _ignored, ...legacyPayload } = payload;
    const fallback = await supabase.from("game_plan_meta").upsert(legacyPayload, { onConflict: "project_id" }).select().single();
    row = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  return row;
}

export async function listGamePlanScenes(projectId) {
  let q = supabase.from("game_plan_scenes").select(GPS_COLUMNS).order("scene_order", { ascending: true });
  if (projectId) q = q.eq("project_id", projectId);
  let { data, error } = await q;
  if (error && /state_contract|chapter_index|is_checkpoint/i.test(error.message || "")) {
    let fallback = supabase.from("game_plan_scenes").select(GPS_COLUMNS.replace(", state_contract, chapter_index, is_checkpoint", "")).order("scene_order", { ascending: true });
    if (projectId) fallback = fallback.eq("project_id", projectId);
    const result = await fallback;
    data = (result.data || []).map((row) => ({ ...row, state_contract: {}, chapter_index: 1, is_checkpoint: false }));
    error = result.error;
  }
  if (error) throw error;
  return data || [];
}
export async function createGamePlanScene(data) {
  try { return await createRow("game_plan_scenes", data); }
  catch (error) {
    if (!/state_contract|chapter_index|is_checkpoint/i.test(error.message || "")) throw error;
    const legacy = { ...data }; delete legacy.state_contract; delete legacy.chapter_index; delete legacy.is_checkpoint;
    return createRow("game_plan_scenes", legacy);
  }
}
export async function updateGamePlanScene(id, data) {
  try { return await updateRow("game_plan_scenes", id, data); }
  catch (error) {
    if (!/state_contract|chapter_index|is_checkpoint/i.test(error.message || "")) throw error;
    const legacy = { ...data }; delete legacy.state_contract; delete legacy.chapter_index; delete legacy.is_checkpoint;
    return updateRow("game_plan_scenes", id, legacy);
  }
}
export async function deleteGamePlanScene(id) {
  return deleteRow("game_plan_scenes", id);
}

export async function listGamePlanBranches(projectId) {
  let q = supabase.from("game_plan_branches").select(GPB_COLUMNS).order("branch_index", { ascending: true });
  if (projectId) q = q.eq("project_id", projectId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function createGamePlanBranch(data) {
  return createRow("game_plan_branches", data);
}
export async function updateGamePlanBranch(id, data) {
  return updateRow("game_plan_branches", id, data);
}
export async function deleteGamePlanBranch(id) {
  return deleteRow("game_plan_branches", id);
}

export async function listGamePlanSceneContent(projectId, branchId) {
  let q = supabase.from("game_plan_scene_content").select(GPC_COLUMNS).order("scene_order", { ascending: true });
  if (projectId) q = q.eq("project_id", projectId);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function upsertGamePlanSceneContent(projectId, branchId, sceneId, data) {
  const payload = { project_id: projectId, branch_id: branchId, scene_id: sceneId, ...data };
  const { data: row, error } = await supabase
    .from("game_plan_scene_content")
    .upsert(payload, { onConflict: "branch_id,scene_id" })
    .select()
    .single();
  if (error) throw error;
  return row;
}

// ---------- Tiện ích: tải tệp lên Storage (tự nén ảnh trước khi lưu) ----------
export async function uploadFile(file) {
  const compressed = await compressImage(file);
  const ext = compressed.type === "image/webp" ? "webp" : (file.name.split(".").pop() || "bin");
  const path = `uploads/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
    contentType: compressed.type || file.type,
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Ảnh (trừ SVG) được resize (cạnh dài tối đa MAX_IMAGE_DIM) + chuyển WebP
// trước khi upload — tránh lưu ảnh gốc vài MB cho avatar/bìa/bản đồ, giảm cả
// dung lượng Storage lẫn egress mỗi lần ảnh được tải để hiển thị.
async function compressImage(file) {
  if (!file.type?.startsWith("image/") || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    return blob || file;
  } catch {
    return file;
  }
}

function extractStoragePath(url) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

async function deleteFileByUrl(url) {
  const path = extractStoragePath(url);
  if (!path) return;
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch (e) {
    console.warn("Không xoá được file ảnh cũ:", e);
  }
}
