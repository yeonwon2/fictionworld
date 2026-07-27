import { base44 } from "@/api/base44Client";

// =============================================================================
// CRUD — kết nối cơ sở dữ liệu qua Base44 SDK (PostgreSQL / Supabase).
// Mọi entity nội dung đều có story_id để phân theo bộ truyện đang chọn.
// =============================================================================

// ---------- Bộ truyện (Story) ----------
export async function listStories() {
  return (await base44.entities.Story.list("-updated_date", 100)) || [];
}
export async function createStory(data) {
  return await base44.entities.Story.create(cleanPayload(data));
}
export async function updateStory(id, data) {
  return await base44.entities.Story.update(id, cleanPayload(data));
}
export async function deleteStory(id) {
  return await base44.entities.Story.delete(id);
}

// Helper: lọc theo story nếu có, không thì lấy tất cả
function listByStory(entity, storyId, sort, limit) {
  if (storyId) return base44.entities[entity].filter({ story_id: storyId }, sort, limit);
  return base44.entities[entity].list(sort, limit);
}

// ---------- Nhân vật (Character) ----------
export async function listCharacters(storyId) {
  return (await listByStory("Character", storyId, "-updated_date", 200)) || [];
}
export async function createCharacter(data) {
  return await base44.entities.Character.create(cleanPayload(data));
}
export async function updateCharacter(id, data) {
  return await base44.entities.Character.update(id, cleanPayload(data));
}
export async function deleteCharacter(id) {
  return await base44.entities.Character.delete(id);
}

// ---------- Mối quan hệ (Relationship) ----------
export async function listRelationships(storyId) {
  return (await listByStory("Relationship", storyId, "-updated_date", 300)) || [];
}
export async function addRelationship(data) {
  return await base44.entities.Relationship.create(cleanPayload(data));
}
export async function updateRelationship(id, data) {
  return await base44.entities.Relationship.update(id, cleanPayload(data));
}
export async function deleteRelationship(id) {
  return await base44.entities.Relationship.delete(id);
}

// ---------- Địa danh (Location) ----------
export async function listLocations(storyId) {
  return (await listByStory("Location", storyId, "-updated_date", 200)) || [];
}
export async function createLocation(data) {
  return await base44.entities.Location.create(cleanPayload(data));
}
export async function updateLocation(id, data) {
  return await base44.entities.Location.update(id, cleanPayload(data));
}
export async function deleteLocation(id) {
  return await base44.entities.Location.delete(id);
}

// ---------- Sự kiện (Event) ----------
export async function listEvents(storyId) {
  return (await listByStory("Event", storyId, "-updated_date", 200)) || [];
}
export async function createEvent(data) {
  return await base44.entities.Event.create(cleanPayload(data));
}
export async function updateEvent(id, data) {
  return await base44.entities.Event.update(id, cleanPayload(data));
}
export async function deleteEvent(id) {
  return await base44.entities.Event.delete(id);
}

// ---------- Chương truyện (Chapter) ----------
export async function listChapters(storyId) {
  return (await listByStory("Chapter", storyId, "chapter_number", 200)) || [];
}
export async function createChapter(data) {
  return await base44.entities.Chapter.create(cleanPayload(data));
}
export async function updateChapter(id, data) {
  return await base44.entities.Chapter.update(id, cleanPayload(data));
}
export async function deleteChapter(id) {
  return await base44.entities.Chapter.delete(id);
}

// ---------- Tiện ích: tải tệp lên bộ nhớ ----------
export async function uploadFile(file) {
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return file_url;
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