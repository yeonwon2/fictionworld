// =============================================================================
// Xưởng Viết Truyện — Bible Builder
// Dựng khối văn bản "sổ tay thế giới hiện có" từ dữ liệu có cấu trúc trong
// Supabase (nhân vật, quan hệ, địa danh, sự kiện, thuật ngữ, chương) để đưa
// vào prompt khi khởi tạo xưởng — giúp AI không tạo bible xung đột với dữ liệu
// tác giả đã nhập ở các trang khác.
// =============================================================================

function line(label, value) {
  if (value == null || value === "") return "";
  return `- ${label}: ${value}`;
}

function buildCharacterBlock(chars) {
  if (!chars?.length) return "(Chưa có nhân vật nào được nhập.)";
  return chars
    .map((c) => {
      const parts = [`### ${c.name}${c.role ? ` — ${c.role}` : ""}`];
      const extra = [
        line("Biệt danh/Hán Việt", c.aliases),
        line("Tuổi", c.age),
        line("Giới thiệu", c.description),
        line("Ngoại hình cố định", c.appearance),
        line("Tính cách", c.personality),
        line("Giọng văn/Xưng hô", c.speech_style),
        line("Mục tiêu/Động cơ", c.goals),
        line("Bí mật", c.secret),
        line("Mâu thuẫn nội tâm", c.inner_conflict),
        line("Tu vi/Năng lực", c.power_level),
        line("Kỹ năng/Pháp thuật", c.skills),
        line("Vật phẩm", c.items),
      ].filter(Boolean);
      if (extra.length) parts.push(...extra);
      return parts.join("\n");
    })
    .join("\n\n");
}

function buildRelationshipBlock(rels, charById) {
  if (!rels?.length) return "(Chưa có quan hệ nào được nhập.)";
  return rels
    .map((r) => {
      const a = charById[r.source_character_id]?.name || "?";
      const b = charById[r.target_character_id]?.name || "?";
      return `- ${a} ↔ ${b}: ${r.relation_type || ""}${r.description ? ` — ${r.description}` : ""}`;
    })
    .join("\n");
}

function buildLocationBlock(locs) {
  if (!locs?.length) return "(Chưa có địa danh nào được nhập.)";
  return locs
    .map((l) => {
      const parts = [`### ${l.name}${l.type && l.type !== "Khác" ? ` (${l.type})` : ""}`];
      if (l.description) parts.push(l.description);
      return parts.join("\n");
    })
    .join("\n\n");
}

function buildEventBlock(events, charById, locById) {
  if (!events?.length) return "(Chưa có sự kiện nào được nhập.)";
  return events
    .map((e) => {
      const chars = (e.related_character_ids || [])
        .map((id) => charById[id]?.name)
        .filter(Boolean)
        .join(", ");
      const locs = (e.related_location_ids || [])
        .map((id) => locById[id]?.name)
        .filter(Boolean)
        .join(", ");
      const parts = [`### [mốc ${e.timeline_order ?? "?"}] ${e.title}`];
      if (e.description) parts.push(e.description);
      if (chars) parts.push(`- Nhân vật: ${chars}`);
      if (locs) parts.push(`- Nơi: ${locs}`);
      if (e.foreshadow_note) parts.push(`- Phục bút: ${e.foreshadow_note} (${e.foreshadow_resolved ? "đã giải quyết" : "đang treo"})`);
      return parts.join("\n");
    })
    .sort((a, b) => a.localeCompare(b))
    .join("\n\n");
}

function buildGlossaryBlock(glossary) {
  if (!glossary?.length) return "(Chưa có thuật ngữ nào được nhập.)";
  return glossary
    .map((g) => `- [${g.category || "Khác"}] ${g.term}: ${g.definition || ""}`)
    .join("\n");
}

function buildChaptersBlock(chapters) {
  if (!chapters?.length) return "(Chưa có chương nào được lưu.)";
  return chapters
    .map((c) => `- ${c.chapter_number != null ? `Ch.${c.chapter_number}` : "Ch."}: ${c.title}`)
    .join("\n");
}

// Trả về chuỗi "sổ tay thế giới hiện có" để nhồi vào prompt khởi tạo xưởng.
export function buildExistingStoryData({ characters, relationships, locations, events, glossary, chapters }) {
  const parts = [];
  parts.push("## Nhân vật\n" + buildCharacterBlock(characters));
  parts.push("## Quan hệ\n" + buildRelationshipBlock(relationships, Object.fromEntries((characters || []).map((c) => [c.id, c]))));
  parts.push("## Địa danh\n" + buildLocationBlock(locations));
  parts.push(
    "## Sự kiện / Timeline\n" +
      buildEventBlock(
        events,
        Object.fromEntries((characters || []).map((c) => [c.id, c])),
        Object.fromEntries((locations || []).map((l) => [l.id, l]))
      )
  );
  parts.push("## Thuật ngữ (Glossary)\n" + buildGlossaryBlock(glossary));
  parts.push("## Chương đã lưu\n" + buildChaptersBlock(chapters));
  return parts.join("\n\n");
}