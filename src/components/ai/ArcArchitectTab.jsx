import React, { useState } from "react";
import { aiCall } from "@/lib/aiCall";
import { createChapter, createEvent, createCharacter } from "@/lib/worldcrud";
import { Wand2, Loader2, Save, CheckCircle2, Layers, Clock } from "lucide-react";

const ARC_SCHEMA = {
  type: "object",
  properties: {
    total_chapters: { type: "number" },
    arcs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          from_chapter: { type: "number" },
          to_chapter: { type: "number" },
          summary: { type: "string" },
        },
        required: ["name", "from_chapter", "to_chapter", "summary"],
      },
    },
    chapters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          chapter_number: { type: "number" },
          arc_name: { type: "string" },
          title: { type: "string" },
          summary: { type: "string" },
          key_events: { type: "array", items: { type: "string" } },
        },
        required: ["chapter_number", "title", "summary", "key_events"],
      },
    },
  },
};

// Cấp độ 2 — Lập Dàn Ý Cốt Truyện (Arc Architect)
export default function ArcArchitectTab({ idea, setIdea, sampleChars, currentStoryId, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [arc, setArc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const run = async () => {
    if (!idea.trim()) {
      setError("Hãy nhập bối cảnh / ý tưởng có sẵn.");
      return;
    }
    setError("");
    setLoading(true);
    setArc(null);
    try {
      const prompt = `Bạn là biên kịch chuyên nghiệp tiểu thuyết mạng Bách Hợp Cổ Đại. Phân tích ý tưởng dưới đây và đề xuất cấu trúc cốt truyện: Tổng số chương nên viết, chia thành các Arc (Màn) rõ ràng, kèm danh sách các sự kiện biến cố chính cho từng chương. Văn phong cổ kính, điền nhã, KHÔNG dùng từ hiện đại. Trả JSON đúng schema.

Ý tưởng / Bối cảnh:
"""${idea}"""`;
      const res = await aiCall(prompt, { jsonSchema: ARC_SCHEMA });
      setArc(res);
      if (!res?.chapters?.length) setError("AI không trả về dàn ý chương.");
    } catch (e) {
      setError("Lỗi: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!arc?.chapters?.length) return;
    setSaving(true);
    setStatus("");
    try {
      let n = 0;
      for (const ch of arc.chapters) {
        const content = `${ch.summary || ""}\n\nSự kiện chính:\n${(ch.key_events || [])
          .map((e) => "+ " + e)
          .join("\n")}`;
        await createChapter({
          story_id: currentStoryId,
          chapter_number: ch.chapter_number,
          title: ch.title,
          content,
        });
        n++;
        for (const ev of ch.key_events || []) {
          await createEvent({
            story_id: currentStoryId,
            title: ev,
            timeline_order: ch.chapter_number,
            description: `(${ch.title}) ${ch.summary || ""}`,
          });
          n++;
        }
      }
      for (const c of sampleChars || []) {
        await createCharacter({
          story_id: currentStoryId,
          name: c.name,
          role: c.role,
          description: c.description,
        });
        n++;
      }
      setStatus(`Đã lưu ${n} mục (chương / sự kiện / nhân vật) vào Sổ Tay Thế Giới.`);
      onSaved?.();
    } catch (e) {
      setStatus("Lỗi khi lưu: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-primary" /> Cấp độ 2 · Lập Dàn Ý Cốt Truyện
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Nhập bối cảnh / ý tưởng — AI chia Arc, đề số chương & sự kiện biến cố.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs font-medium text-muted-foreground">Bối cảnh / Ý tưởng có sẵn</label>
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={5}
          placeholder="Dán bối cảnh / ý tưởng ở đây (sẽ tự điền nếu bạn chốt concept ở Cấp độ 1)..."
          className="w-full mt-1.5 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
        />
        {sampleChars?.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Kèm {sampleChars.length} nhân vật mẫu từ concept sẽ được lưu cùng dàn ý.
          </p>
        )}
        <button
          onClick={run}
          disabled={loading}
          className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          AI Lập Dàn Ý Cốt Truyện
        </button>
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      </div>

      {arc && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-sm font-medium">
              Tổng số chương đề xuất: <b>{arc.total_chapters || arc.chapters?.length || "?"}</b>
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary/10 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Đưa Dàn ý & Nhân vật vào Sổ Tay Thế Giới
            </button>
          </div>
          {status && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> {status}
            </div>
          )}

          {arc.arcs?.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="font-display font-semibold flex items-center gap-2 mb-2">
                <Layers className="w-4 h-4 text-primary" /> Các Arc (Màn)
              </h3>
              <div className="flex flex-wrap gap-2">
                {arc.arcs.map((a, i) => (
                  <div key={i} className="rounded-lg border border-border px-3 py-1.5 text-xs">
                    <b className="text-primary">{a.name}</b> · Ch.{a.from_chapter}–{a.to_chapter}
                    {a.summary && <div className="text-muted-foreground mt-0.5">{a.summary}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="font-display font-semibold flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-primary" /> Danh sách chương & sự kiện biến cố
            </h3>
            <div className="space-y-2">
              {arc.chapters.map((ch, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      Ch.{ch.chapter_number}
                    </span>
                    <b className="text-sm">{ch.title}</b>
                    {ch.arc_name && (
                      <span className="text-[11px] text-muted-foreground">· {ch.arc_name}</span>
                    )}
                  </div>
                  {ch.summary && <p className="text-xs text-muted-foreground mt-1">{ch.summary}</p>}
                  {ch.key_events?.length > 0 && (
                    <ul className="mt-1.5 list-disc list-inside text-xs space-y-0.5">
                      {ch.key_events.map((e, j) => (
                        <li key={j}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}