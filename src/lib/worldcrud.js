import { base44 } from "@/api/base44Client";

// =============================================================================
// Các hàm CRUD — kết nối tới cơ sở dữ liệu qua Base44 SDK (PostgreSQL / Supabase).
// Gom lại một chỗ để dễ tái sử dụng ở mọi component.
// =============================================================================

// ---------- Nhân vật (Character) ----------
export async function listCharacters() {
  return (await base44.entities.Character.list("-updated_date", 200)) || [];
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
export async function listRelationships() {
  return (await base44.entities.Relationship.list("-updated_date", 300)) || [];
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
export async function listLocations() {
  return (await base44.entities.Location.list("-updated_date", 200)) || [];
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
export async function listEvents() {
  return (await base44.entities.Event.list("-updated_date", 200)) || [];
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