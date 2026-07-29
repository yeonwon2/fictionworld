import React, { useEffect, useState } from "react";
import { aiCall } from "@/lib/aiCall";
import { createChapter, createEvent, createCharacter } from "@/lib/worldcrud";
import { Wand2, Loader2, Save, CheckCircle2 } from "lucide-react";
import OutlineEditor from "@/components/ai/OutlineEditor";
import OutlineVersionHistory from "@/components/ai/OutlineVersionHistory";

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

const CHAPTER_SCHEMA = {
  type: "object",
  properties: {
    chapter_number: { type: "number" },
    arc_name: { type: "string" },
    title: { type: "string" },
    summary: { type: "string" },
    key_events: { type: "array", items: { type: "string" } },
  },
  required: ["chapter_number", "title", "summary", "key_events"],
};

const ARC_SINGLE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    from_chapter: { type: "number" },
    to_chapter: { type: "number" },
    summary: { type: "string" },
  },
  required: ["name", "from_chapter", "to_chapter", "summary"],
};

// Cấp độ 2 — Lập & SỬA Dàn Ý. Sửa trực tiếp / AI viết lại từng phần / thêm-xoá-kéo-thả / lịch sử.
export default function ArcArchitectTab({ idea, setIdea, sampleChars, currentStoryId, onSaved, directionBlock }) {
  const [loading, setLoading] = useState(false);
  const [arc, setArc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [regenBusy, setRegenBusy] = useState(null);
  const [regenAllBusy, setRegenAllBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const HK = `fw_outline_history_${currentStoryId}`;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem(HK) || "[]"));
    } catch {
      setHistory([]);
    }
    // reset khi đổi story
    setArc(null);
    setStatus("");
  }, [HK]);

  const persistHistory = (h) => {
    const capped = h.slice(0, 20);
    setHistory(capped);
    localStorage.setItem(HK, JSON.stringify(capped));
  };

  const pushHistory = (label) => {
    if (!arc) return;
    persistHistory([{ label, ts: Date.now(), arc }, ...history]);
  };

  const run = async () => {
    if (!idea.trim()) {
      setError("Hãy nhập bối cảnh / ý tưởng có sẵn.");
      return;
    }
    setError("");
    setLoading(true);
    setArc(null);
    try {
      const prompt = `Bạn là biên kịch chuyên nghiệp tiểu thuyết mạng Bách Hợp Cổ Đại. Phân tích ý tưởng và đề xuất cấu trúc cột truyện: Tổng số chương, chia thành các Arc (Màn), kèm danh sách sự kiện biến cố chính cho từng chương. Văn phong cổ kính, điền nhã, KHÔNG dùng từ hiện đại. Trả JSON đúng schema.

${directionBlock || ""}

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

  const regenChapter = async (idx, note) => {
    if (!arc?.chapters?.[idx]) return;
    setRegenBusy({ type: "chapter", idx });
    try {
      const ch = arc.chapters[idx];
      const prompt = `Bạn là biên kịch Bách Hợp Cổ Đại. Chỉ SINH LẠI RIÊNG chương số ${ch.chapter_number} trong dàn ý — giữ nguyên số chương và các chương khác không thay đổi. Giữ nguyên tiêu đề và arc_name nếu không cần đổi; điều chỉnh summary & key_events theo góp ý. Văn phong cổ kính, điền nhã, không từ hiện đại. Trả JSON đúng schema của 1 chương (chapter_number, arc_name, title, summary, key_events[]).

${directionBlock || ""}

# Bối cảnh / ý tưởng
"""${idea}"""

# Cấu trúc dàn ý hiện tại (để bám)
${JSON.stringify(arc)}

# Góp ý cho chương này
${note || "(làm cho hay hơn, giữ ý chính)"}`;
      const res = await aiCall(prompt, { jsonSchema: CHAPTER_SCHEMA });
      setArc((a) => {
        const chapters = a.chapters.map((c, i) => (i === idx ? { ...res, chapter_number: ch.chapter_number } : c));
        return { ...a, chapters };
      });
    } catch (e) {
      setError("Không thể viết lại chương: " + (e?.message || ""));
    } finally {
      setRegenBusy(null);
    }
  };

  const regenArc = async (idx, note) => {
    if (!arc?.arcs?.[idx]) return;
    setRegenBusy({ type: "arc", idx });
    try {
      const a0 = arc.arcs[idx];
      const prompt = `Bạn là biên kịch Bách Hợp Cổ Đại. Chỉ SINH LẠI RIÊNG arc "${a0.name}" (từ chương ${a0.from_chapter} đến ${a0.to_chapter}) — giữ nguyên from_chapter/to_chapter, có thể đổi tên + tóm tắt theo góp ý. Văn phong cổ kính. Trả JSON đúng schema của 1 arc (name, from_chapter, to_chapter, summary).

${directionBlock || ""}

# Bối cảnh
"""${idea}"""

# Góp ý
${note || "(làm tóm tắt rõ ràng hơn)"}`;
      const res = await aiCall(prompt, { jsonSchema: ARC_SINGLE_SCHEMA });
      setArc((a) => ({ ...a, arcs: a.arcs.map((x, i) => (i === idx ? { ...res, from_chapter: a0.from_chapter, to_chapter: a0.to_chapter } : x)) }));
    } catch (e) {
      setError("Không thể viết lại arc: " + (e?.message || ""));
    } finally {
      setRegenBusy(null);
    }
  };

  const regenAll = async (note) => {
    if (!arc) return;
    setRegenAllBusy(true);
    pushHistory(`Trước khi sinh lại toàn bộ · ${new Date().toLocaleTimeString("vi-VN")}`);
    try {
      const prompt = `Bạn là biên kịch Bách Hợp Cổ Đại. Hãy SINH LẠI TOÀN BỘ dàn ý NHƯNG GIỮ NGUYÊN cấu trúc: đúng ${arc.arcs?.length || 0} arc và đúng ${arc.chapters?.length || 0} chương, giữ nguyên thứ tự & tiêu đề chương (chỉ đổi nội dung summary & key_events cho hay hơn theo góp ý). Văn phong cổ kính, điền nhã, không từ hiện đại. Trả JSON đúng schema (arcs + chapters, giữ nguyên chapter_number & title).

${directionBlock || ""}

# Cấu trúc hiện tại (giữ nguyên)
${JSON.stringify({ arcs: arc.arcs, chapters: arc.chapters.map((c) => ({ chapter_number: c.chapter_number, title: c.title, arc_name: c.arc_name })) })}

# Góp ý cho lần sinh lại
${note || "(làm toàn bộ hay hơn, giữ ý chính)"}`;
      const res = await aiCall(prompt, { jsonSchema: ARC_SCHEMA });
      // Ghép lại tiêu đề cũ (AI được yêu cầu giữ nhưng đảm bảo)
      const chapters = (res.chapters || []).map((c, i) => ({
        ...c,
        title: arc.chapters[i]?.title || c.title,
        chapter_number: arc.chapters[i]?.chapter_number || c.chapter_number,
      }));
      setArc({ ...res, chapters: chapters.length ? chapters : arc.chapters });
    } catch (e) {
      setError("Không thể sinh lại toàn bộ: " + (e?.message || ""));
    } finally {
      setRegenAllBusy(false);
    }
  };

  const restoreHistory = (i) => {
    const snap = history[i];
    if (!snap) return;
    setArc(snap.arc);
    setHistoryOpen(false);
  };
  const clearHistory = () => {
    persistHistory([]);
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
          <Wand2 className="w-5 h-5 text-primary" /> Cấp độ 2 · Lập & Sửa Dàn Ý Cốt Truyện
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Nhập bối cảnh → AI lập dàn ý. Bạn có thể sửa trực tiếp, yêu cầu AI viết lại từng phần, thêm/xoá/kéo-thả chương & xem lịch sử phiên bản.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs font-medium text-muted-foreground">Bối cảnh / Ý tưởng có sẵn</label>
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={5}
          placeholder="Dán bối cảnh / ý tưởng ở đây (tự điền nếu bạn chốt concept ở Cấp độ 1)..."
          className="w-full mt-1.5 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
        />
        {sampleChars?.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Kèm {sampleChars.length} nhân vật mẫu sẽ được lưu cùng dàn ý.
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

          <OutlineEditor
            arc={arc}
            onArcChange={setArc}
            onRegenChapter={regenChapter}
            onRegenArc={regenArc}
            onRegenAll={regenAll}
            regenBusy={regenBusy}
            regenAllBusy={regenAllBusy}
          />

          <OutlineVersionHistory
            history={history}
            onRestore={restoreHistory}
            onClear={clearHistory}
            open={historyOpen}
            onOpenChange={setHistoryOpen}
          />
        </div>
      )}
    </div>
  );
}