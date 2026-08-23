export const DEFAULT_WORD_TOLERANCE = 0.15;

export function countWords(text = "") {
  return String(text).trim() ? String(text).trim().split(/\s+/).filter(Boolean).length : 0;
}

export function getWordBudgetStatus(text, target, tolerance = DEFAULT_WORD_TOLERANCE) {
  const words = countWords(text);
  const goal = Math.max(0, Number(target) || 0);
  if (!goal) return { words, target: 0, min: 0, max: Infinity, within: true, delta: 0 };
  const min = Math.floor(goal * (1 - tolerance));
  const max = Math.ceil(goal * (1 + tolerance));
  return { words, target: goal, min, max, within: words >= min && words <= max, delta: words - goal };
}

export function decodeChapterPlan(raw) {
  if (!raw) return { version: 2, contract: null, scenes: [], beats: [], quality: null };
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return { version: 1, contract: null, scenes: [], beats: parsed, quality: null };
    return {
      version: 2,
      contract: parsed?.contract || null,
      scenes: Array.isArray(parsed?.scenes) ? parsed.scenes : [],
      beats: Array.isArray(parsed?.beats) ? parsed.beats : [],
      quality: parsed?.quality || null,
    };
  } catch {
    return { version: 2, contract: null, scenes: [], beats: [], quality: null };
  }
}

export function encodeChapterPlan({ contract, scenes, beats, quality }) {
  return JSON.stringify({ version: 2, contract: contract || null, scenes: scenes || [], beats: beats || [], quality: quality || null });
}

export function hasHardFailures(report) {
  return (report?.issues || []).some((issue) => {
    const severity = String(issue?.severity || "").toLowerCase();
    return issue?.hard_fail === true || severity.includes("nghiêm") || severity.includes("critical") || severity.includes("hard");
  });
}

export function canWriteChapter({ contract, scenes, preflight }) {
  return Boolean(contract && Array.isArray(scenes) && scenes.length && preflight?.passed === true && !hasHardFailures(preflight));
}

export function canPassQuality({ report, budget }) {
  return Boolean(report?.passed === true && !hasHardFailures(report) && budget?.within);
}

export function canUpdateCanon(rawPlan) {
  const quality = decodeChapterPlan(rawPlan).quality;
  return Boolean(quality?.passed === true && !hasHardFailures(quality));
}

export function findPreviousChapter(chapters, activeId, chapterNumber) {
  const sorted = [...(chapters || [])].sort((a, b) => (Number(a.chapter_number) || 0) - (Number(b.chapter_number) || 0));
  if (activeId) {
    const index = sorted.findIndex((chapter) => chapter.id === activeId);
    return index > 0 ? sorted[index - 1] : null;
  }
  const target = Number(chapterNumber);
  const candidates = target ? sorted.filter((chapter) => (Number(chapter.chapter_number) || 0) < target) : sorted;
  return candidates[candidates.length - 1] || null;
}

export function compactBibleContext(docsByKey, maxChars = 60000) {
  const priority = ["tom_tat_hien_tai", "trang_thai_nhan_vat", "timeline", "quan_he", "fuc_but", "dai_cuong", "quy_tac_viet", "nhan_vat", "the_gioi"];
  const labels = { tom_tat_hien_tai: "Tóm Tắt Hiện Tại", trang_thai_nhan_vat: "Trạng Thái Nhân Vật", timeline: "Timeline", quan_he: "Quan Hệ", fuc_but: "Phục Bút", dai_cuong: "Đại Cương", quy_tac_viet: "Quy Tắc Viết", nhan_vat: "Nhân Vật", the_gioi: "Thế Giới" };
  let remaining = Math.max(4000, Number(maxChars) || 60000);
  const parts = [];
  for (const key of priority) {
    const raw = String(docsByKey?.[key]?.content || "").trim();
    if (!raw || remaining <= 0) continue;
    const allowance = ["tom_tat_hien_tai", "trang_thai_nhan_vat", "timeline", "quan_he", "fuc_but"].includes(key) ? Math.min(raw.length, remaining) : Math.min(raw.length, remaining, 12000);
    const content = raw.slice(0, allowance);
    parts.push(`## ${labels[key] || key}\n${content}${content.length < raw.length ? "\n[…đã rút gọn; dùng Bible đầy đủ khi kiểm định toàn truyện…]" : ""}`);
    remaining -= content.length;
  }
  return parts.join("\n\n") || "(Bible đang trống)";
}
