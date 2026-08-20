// =============================================================================
// Xuất / tải về dữ liệu Xưởng Viết Truyện dưới nhiều định dạng.
//   - .md  : Markdown — AI dễ đọc, dễ chỉnh sửa.
//   - .txt : văn bản thuần — hầu hết các trang đăng truyện đều nhận.
//   - .html: 1 file tự mở bằng trình duyệt, đẹp để up web / đọc offline.
//   - .epub: sách điện tử chuẩn EPUB3 — up Kindle/Apple Books/Cửa hàng ebook.
//   - .json: cấu trúc đầy đủ (bible + chương + beats) cho AI/tool phân tích.
// =============================================================================

import JSZip from "jszip";
import { DOC_DEFS } from "./prompts";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(s) {
  return escapeHtml(s).replace(/'/g, "&apos;");
}

function markdownToParagraphs(md) {
  // Chia đoạn theo dòng trống; nhận dạng tiêu đề markdown -> <h*>; còn lại <p>.
  const blocks = String(md ?? "")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const out = [];
  for (const block of blocks) {
    if (/^#{1,3}\s/.test(block)) {
      const level = block.match(/^(#{1,3})/)[1].length;
      const text = escapeHtml(block.replace(/^#{1,3}\s*/, ""));
      out.push(`<h${level + 1}>${text}</h${level + 1}>`);
    } else if (/^[-*]\s/.test(block)) {
      const items = block
        .split(/\n(?=[-*]\s)/)
        .map((i) => `<li>${escapeHtml(i.replace(/^[-*]\s*/, ""))}</li>`)
        .join("");
      out.push(`<ul>${items}</ul>`);
    } else {
      const lines = block.split("\n").map((l) => escapeHtml(l)).join("<br/>");
      out.push(`<p>${lines}</p>`);
    }
  }
  return out.join("\n");
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

// ---------- Markdown ----------
export function buildBibleMarkdown(docsByKey) {
  const blocks = DOC_DEFS.map((d) => {
    const doc = docsByKey?.[d.key];
    if (!doc?.content?.trim()) return null;
    return `# ${d.title} (${d.file})\n\n${doc.content.trim()}`;
  }).filter(Boolean);
  if (!blocks.length) return "";
  return "# BỘ TÀI LIỆU XƯỞNG (bible)\n\n" + blocks.join("\n\n---\n\n");
}

export function buildStoryMarkdown(chapters) {
  return chapters
    .map(
      (c) => `# ${c.chapter_number != null ? `Chương ${c.chapter_number}: ` : ""}${c.title}\n\n${(c.content || "").trim()}`
    )
    .join("\n\n---\n\n");
}

export function downloadMarkdown(filename, text) {
  downloadBlob(filename, new Blob([text], { type: "text/markdown;charset=utf-8" }));
}

// ---------- TXT thuần (đăng truyện) ----------
export function buildStoryTxt(chapters, storyName) {
  const parts = [];
  if (storyName) parts.push(storyName.toUpperCase());
  for (const c of chapters) {
    parts.push(
      `\n${"─".repeat(40)}\n${c.chapter_number != null ? `CHƯƠNG ${c.chapter_number}: ` : ""}${c.title.toUpperCase()}\n${"─".repeat(40)}\n\n${(c.content || "").trim()}`
    );
  }
  return parts.join("\n\n");
}

export function downloadTxt(filename, text) {
  downloadBlob(filename, new Blob([text], { type: "text/plain;charset=utf-8" }));
}

// ---------- HTML (mở bằng trình duyệt / up web) ----------
export function buildStoryHtml({ storyName, author, chapters }) {
  const title = escapeHtml(storyName || "Truyện");
  const toc = chapters
    .map(
      (c) =>
        `<li><a href="#ch-${c.chapter_number != null ? c.chapter_number : "x"}">${
          c.chapter_number != null ? `Chương ${c.chapter_number}: ` : ""
        }${escapeHtml(c.title)}</a></li>`
    )
    .join("\n");
  const body = chapters
    .map((c) => {
      const id = c.chapter_number != null ? c.chapter_number : "x";
      return `<section class="chapter" id="ch-${id}">
<h2>${c.chapter_number != null ? `Chương ${c.chapter_number}: ` : ""}${escapeHtml(c.title)}</h2>
${markdownToParagraphs(c.content)}
</section>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${title}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; line-height: 1.8; color: #222; background: #fafaf8; margin: 0; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
  header { text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 1.5rem; margin-bottom: 2rem; }
  h1 { font-size: 2rem; margin: 0; }
  .author { color: #888; font-size: 0.9rem; margin-top: 0.5rem; }
  .toc { background: #fff; border: 1px solid #e3e3e0; border-radius: 8px; padding: 1rem 1.5rem; margin-bottom: 2.5rem; }
  .toc h2 { font-size: 1.1rem; margin: 0 0 0.5rem; }
  .toc ul { list-style: none; padding: 0; margin: 0; columns: 2; }
  .toc a { color: #333; text-decoration: none; }
  .toc a:hover { color: #9a3b3b; }
  .chapter { margin-bottom: 3rem; }
  .chapter h2 { font-size: 1.25rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
  .chapter p { margin: 0 0 1.1rem; text-align: justify; }
  .chapter h3 { font-size: 1.05rem; margin: 1.4rem 0 0.6rem; }
  .chapter ul { padding-left: 1.5rem; }
</style>
</head>
<body>
<div class="wrap">
<header>
<h1>${title}</h1>
${author ? `<div class="author">${escapeHtml(author)}</div>` : ""}
</header>
<nav class="toc">
<h2>Mục lục</h2>
<ul>
${toc}
</ul>
</nav>
${body}
</div>
</body>
</html>`;
}

export function downloadHtml(filename, html) {
  downloadBlob(filename, new Blob([html], { type: "text/html;charset=utf-8" }));
}

// ---------- EPUB3 ----------
function uid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function buildEpubBlob({ storyName, author, chapters }) {
  const zip = new JSZip();
  const id = uid();
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const title = storyName || "Truyện";

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  const chapterFiles = chapters.map((c, i) => ({
    id: `ch${i + 1}`,
    href: `chapter-${i + 1}.xhtml`,
    num: c.chapter_number,
    title: c.title,
  }));

  const manifest = chapterFiles
    .map((f) => `<item id="${f.id}" href="${f.href}" media-type="application/xhtml+xml"/>`)
    .join("\n    ");
  const spine = chapterFiles.map((f) => `<itemref idref="${f.id}"/>`).join("\n    ");

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="vi">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${id}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    ${author ? `<dc:creator>${escapeXml(author)}</dc:creator>` : ""}
    <dc:language>vi</dc:language>
    <meta property="dcterms:modified">${now}</meta>
  </metadata>
  <manifest>
    <item id="css" href="styles.css" media-type="text/css"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${manifest}
  </manifest>
  <spine>
    ${spine}
  </spine>
</package>`
  );

  const tocItems = chapterFiles
    .map(
      (f) =>
        `<li><a href="${f.href}">${f.num != null ? `Chương ${f.num}: ` : ""}${escapeXml(f.title)}</a></li>`
    )
    .join("\n      ");
  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="vi" xml:lang="vi">
<head><title>${escapeXml(title)}</title></head>
<body>
<nav epub:type="toc" id="toc">
  <h1>Mục lục</h1>
  <ol>
    ${tocItems}
  </ol>
</nav>
</body>
</html>`
  );

  zip.file(
    "OEBPS/styles.css",
    `body { font-family: Georgia, serif; line-height: 1.8; margin: 1em; }
p { margin: 0 0 1.1em; text-align: justify; text-indent: 1.5em; }
h1 { font-size: 1.6em; }
h2 { font-size: 1.25em; margin: 1.2em 0 0.6em; }
h3 { font-size: 1.05em; }
ul { padding-left: 1.5em; }`
  );

  chapters.forEach((c, i) => {
    const f = chapterFiles[i];
    zip.file(
      `OEBPS/${f.href}`,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="vi" xml:lang="vi">
<head><title>${f.num != null ? `Chương ${f.num}: ` : ""}${escapeXml(f.title)}</title>
<link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
<h2>${f.num != null ? `Chương ${f.num}: ` : ""}${escapeXml(f.title)}</h2>
${markdownToParagraphs(c.content)}
</body>
</html>`
    );
  });

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
  });
}

export function downloadEpub(filename, blob) {
  downloadBlob(filename, blob);
}

// ---------- JSON (AI / công cụ phân tích) ----------
export function buildFullJson({ storyName, author, docsByKey, chapters }) {
  const bible = {};
  for (const d of DOC_DEFS) {
    const doc = docsByKey?.[d.key];
    bible[d.key] = { title: d.title, file: d.file, content: doc?.content || "" };
  }
  return JSON.stringify(
    {
      type: "fictionworld_xuong_viet_truyen",
      version: 2,
      story: { name: storyName, author: author || "" },
      bible,
      chapters: chapters.map((c) => ({
        chapter_number: c.chapter_number ?? null,
        title: c.title,
        content: c.content || "",
        outline_beats: (() => {
          try {
            return c.outline_beats ? JSON.parse(c.outline_beats) : null;
          } catch {
            return null;
          }
        })(),
      })),
      meta: {
        exported_at: new Date().toISOString(),
        chapter_count: chapters.length,
      },
    },
    null,
    2
  );
}

export function downloadJson(filename, obj) {
  downloadBlob(
    filename,
    new Blob([typeof obj === "string" ? obj : JSON.stringify(obj, null, 2)], { type: "application/json;charset=utf-8" })
  );
}

// ---------- Bundle download (zip) — backup toàn diện 1 lần ----------
export async function buildBundleZip({ storyName, docsByKey, chapters, relationships, characters, locations, events, glossary }) {
  const zip = new JSZip();
  const safe = (storyName || "truyen").replace(/[\\/:*?"<>|]/g, "_");
  const root = zip.folder(safe);

  // Bible
  const bibleFolder = root.folder("bible");
  for (const d of DOC_DEFS) {
    const doc = docsByKey?.[d.key];
    if (doc?.content?.trim()) {
      bibleFolder.file(`${d.file}`, doc.content);
    }
  }
  bibleFolder.file("_all.json", JSON.stringify(
    Object.fromEntries(DOC_DEFS.map((d) => [d.key, docsByKey?.[d.key]?.content || ""])),
    null, 2
  ));

  // Chapters
  const chaptersFolder = root.folder("chapters");
  for (const c of chapters) {
    const num = c.chapter_number != null ? String(c.chapter_number).padStart(3, "0") : "xxx";
    const fname = `ch${num}_${(c.title || "untitled").replace(/[\\/:*?"<>|]/g, "_")}.md`;
    const header = `# Chương ${c.chapter_number != null ? c.chapter_number : "?"}: ${c.title}\n\n`;
    chaptersFolder.file(fname, header + (c.content || ""));
  }
  // beats JSON
  chaptersFolder.file("_beats.json", JSON.stringify(
    chapters.map((c) => ({ chapter_number: c.chapter_number, title: c.title, beats: (() => { try { return c.outline_beats ? JSON.parse(c.outline_beats) : null; } catch { return null; } })() })),
    null, 2
  ));

  // World data
  const worldFolder = root.folder("world");
  if (characters?.length) worldFolder.file("characters.json", JSON.stringify(characters, null, 2));
  if (relationships?.length) worldFolder.file("relationships.json", JSON.stringify(relationships, null, 2));
  if (locations?.length) worldFolder.file("locations.json", JSON.stringify(locations, null, 2));
  if (events?.length) worldFolder.file("events.json", JSON.stringify(events, null, 2));
  if (glossary?.length) worldFolder.file("glossary.json", JSON.stringify(glossary, null, 2));

  // Metadata
  root.file("manifest.json", JSON.stringify({
    type: "fictionworld_bundle",
    version: 1,
    story_name: storyName,
    exported_at: new Date().toISOString(),
    chapter_count: chapters.length,
    bible_doc_count: DOC_DEFS.filter((d) => docsByKey?.[d.key]?.content?.trim()).length,
    world_data: {
      characters: characters?.length || 0,
      relationships: relationships?.length || 0,
      locations: locations?.length || 0,
      events: events?.length || 0,
      glossary: glossary?.length || 0,
    },
  }, null, 2));

  return zip.generateAsync({ type: "blob", mimeType: "application/zip" });
}