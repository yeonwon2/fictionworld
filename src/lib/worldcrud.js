import { supabase } from "@/lib/supabase";

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

// ---------- Xưởng Game (Game) ----------
// listGames() chỉ trả cột nhẹ (KHÔNG có nodes/meta) — dùng cho thư viện/danh
// sách game. Gọi getGame(id) riêng khi mở một game cụ thể để chơi/sửa/xuất —
// tránh tải toàn bộ node graph (có thể vài chục KB) chỉ để hiển thị tiêu đề.
const GAME_LITE_COLUMNS = "id, story_id, title, node_count, updated_at, created_at";

export async function listGames() {
  const { data, error } = await supabase
    .from("games")
    .select(GAME_LITE_COLUMNS)
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
