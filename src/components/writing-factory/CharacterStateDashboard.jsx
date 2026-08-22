import React, { useEffect, useMemo, useState } from "react";
import { Users, RefreshCw, Loader2, MessageSquareQuote, BookPlus } from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import { listChapters, upsertWriterDoc } from "@/lib/worldcrud";
import { buildVoiceExtractionPrompt, VOICE_EXTRACTION_SCHEMA, buildBackstoryPrompt, buildBibleBlock, DOC_DEFS_BY_KEY } from "@/lib/writingFactory/prompts";

// Parse trạng thái nhân vật từ doc `07_TRANG_THAI_NHAN_VAT.md`.
// Giả định mỗi nhân vật là một mục bắt đầu bằng `### Tên` hoặc `## Tên`.
function parseCharacterStates(content) {
  if (!content?.trim()) return [];
  const blocks = content.split(/\n(?=###?\s)/).filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split("\n");
      const first = lines[0].replace(/^#{1,3}\s*/, "").trim();
      if (!first) return null;
      const rest = lines.slice(1).join("\n").trim();
      const fields = {};
      const fieldLines = rest.split("\n").filter((l) => l.trim().startsWith("- ") || l.trim().startsWith("* "));
      fieldLines.forEach((l) => {
        const clean = l.trim().replace(/^[-*]\s*/, "");
        const [k, ...v] = clean.split(":");
        if (k && v.length) fields[k.trim()] = v.join(":").trim();
      });
      return { name: first, raw: rest, fields };
    })
    .filter(Boolean);
}

// Dashboard trạng thái sống của nhân vật — đọc từ tài liệu bible trang_thai_nhan_vat.
// Hỗ trợ trích giọng văn nhân vật từ chương đã viết và cập nhật vào 02_NHAN_VAT.
export default function CharacterStateDashboard({
  currentStoryId,
  stateDoc,
  characterDoc,
  docsByKey,
  genre,
  onDocsUpdated,
}) {
  const [chapters, setChapters] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [extractFor, setExtractFor] = useState(null);
  const [extractPreview, setExtractPreview] = useState(null);
  const [backstoryFor, setBackstoryFor] = useState(null);
  const [generatingBackstory, setGeneratingBackstory] = useState(false);
  const [backstoryPreview, setBackstoryPreview] = useState(null); // { name, markdown }

  useEffect(() => {
    listChapters(currentStoryId).then((list) => setChapters(list || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoryId]);

  const characters = useMemo(() => parseCharacterStates(stateDoc?.content), [stateDoc?.content]);
  const bibleText = useMemo(() => buildBibleBlock(docsByKey), [docsByKey]);

  // Nhân vật phụ dễ bị "phẳng" (thiếu chiều sâu) — AI viết backstory + gợi ý
  // cảnh xuất hiện, biến họ thành nhân vật được nhớ thay vì bù nhìn cho có.
  const handleGenerateBackstory = async (name) => {
    setBackstoryFor(name);
    setBackstoryPreview(null);
    setGeneratingBackstory(true);
    try {
      const md = await aiCall(buildBackstoryPrompt({ genre, bibleText, characterName: name, numScenes: 3 }));
      setBackstoryPreview({ name, markdown: String(md || "").trim() });
    } catch (e) {
      alert("Lỗi sinh backstory: " + (e?.message || "lỗi"));
    } finally {
      setGeneratingBackstory(false);
    }
  };

  const applyBackstoryToCharacterDoc = async () => {
    if (!backstoryPreview || !characterDoc) return;
    const newContent = (characterDoc.content || "").trim() + `\n\n## Backstory: ${backstoryPreview.name}\n${backstoryPreview.markdown}`;
    await upsertWriterDoc(currentStoryId, "nhan_vat", { title: DOC_DEFS_BY_KEY["nhan_vat"].title, content: newContent });
    setBackstoryPreview(null);
    onDocsUpdated?.();
  };

  const handleExtractVoice = async (name) => {
    setExtractFor(name);
    setExtractPreview(null);
    setExtracting(true);
    try {
      // Lấy tối đa 5 chương gần nhất có nội dung.
      const contents = (chapters || [])
        .filter((c) => c.content?.trim())
        .slice(-5)
        .map((c) => c.content);
      if (!contents.length) throw new Error("Chưa có chương nào để trích giọng văn.");
      const prompt = buildVoiceExtractionPrompt({ genre, characterName: name, chapterContents: contents });
      const res = await aiCall(prompt, { jsonSchema: VOICE_EXTRACTION_SCHEMA });
      setExtractPreview({
        name: res?.name || name,
        samples: res?.dialogue_samples || [],
        notes: res?.voice_notes || "",
      });
    } catch (e) {
      alert("Lỗi trích giọng văn: " + (e?.message || "lỗi"));
    } finally {
      setExtracting(false);
    }
  };

  const applyVoiceToCharacterDoc = async () => {
    if (!extractPreview || !characterDoc) return;
    const block = `

## Giọng văn / Thoại mẫu của ${extractPreview.name}
${extractPreview.notes ? `- Nhận xét giọng: ${extractPreview.notes}` : ""}
${extractPreview.samples.map((s) => `- "${s}"`).join("\n")}`;
    const newContent = (characterDoc.content || "").trim() + block;
    await upsertWriterDoc(currentStoryId, "nhan_vat", {
      title: DOC_DEFS_BY_KEY["nhan_vat"].title,
      content: newContent,
    });
    setExtractPreview(null);
    onDocsUpdated?.();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold">Trạng Thái Nhân Vật (sống)</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Cập nhật sau mỗi chương qua rollup. Giúp AI biết nhân vật đang ở đâu, làm gì, tâm lý, vật phẩm hiện tại — tránh viết lệch.
        </p>
      </div>

      {characters.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Chưa có dữ liệu trạng thái. Sau khi viết chương, bật rollup để AI tự cập nhật tài liệu{" "}
          <b>Trạng Thái Nhân Vật</b>.
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {characters.map((c) => (
          <div key={c.name} className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-display font-semibold text-sm">{c.name}</h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleGenerateBackstory(c.name)}
                  disabled={generatingBackstory}
                  title="Nhân vật phụ đang phẳng? AI viết backstory + gợi ý cảnh xuất hiện"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-primary/40 text-primary text-[10px] hover:bg-primary/10 disabled:opacity-50"
                >
                  {backstoryFor === c.name && generatingBackstory ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <BookPlus className="w-3 h-3" />
                  )}
                  Sinh backstory
                </button>
                <button
                  onClick={() => handleExtractVoice(c.name)}
                  disabled={extracting}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-primary/40 text-primary text-[10px] hover:bg-primary/10 disabled:opacity-50"
                >
                  {extractFor === c.name && extracting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <MessageSquareQuote className="w-3 h-3" />
                  )}
                  Trích giọng
                </button>
              </div>
            </div>
            <div className="mt-2 space-y-1 text-xs">
              {Object.entries(c.fields).length === 0 && (
                <p className="text-muted-foreground italic">Chưa có trường chi tiết.</p>
              )}
              {Object.entries(c.fields).map(([k, v]) => (
                <div key={k} className="flex gap-1.5">
                  <span className="font-medium text-muted-foreground shrink-0">{k}:</span>
                  <span className="text-foreground/80 line-clamp-3">{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {extractPreview && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-sm">Trích giọng: {extractPreview.name}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{extractPreview.notes}</p>
          <ul className="mt-2 space-y-1 text-xs">
            {extractPreview.samples.map((s, i) => (
              <li key={i} className="border-l-2 border-primary/30 pl-2 italic">
                “{s}”
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={applyVoiceToCharacterDoc}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:opacity-90"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Thêm vào 02_NHAN_VAT
            </button>
            <button
              onClick={() => setExtractPreview(null)}
              className="px-3 py-1.5 rounded-md border border-border text-xs hover:bg-muted"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {backstoryPreview && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <BookPlus className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-sm">Backstory: {backstoryPreview.name}</h3>
          </div>
          <div className="mt-2 text-xs whitespace-pre-wrap max-h-64 overflow-y-auto rounded-md bg-background/60 p-3 leading-relaxed">
            {backstoryPreview.markdown || "(trống)"}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={applyBackstoryToCharacterDoc}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:opacity-90"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Thêm vào 02_NHAN_VAT
            </button>
            <button
              onClick={() => setBackstoryPreview(null)}
              className="px-3 py-1.5 rounded-md border border-border text-xs hover:bg-muted"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}