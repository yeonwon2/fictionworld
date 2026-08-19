import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, Loader2, CheckCircle2, FileText, Check } from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import { getChapter, listChapters, upsertWriterDoc } from "@/lib/worldcrud";
import { buildBibleBlock, buildRollupPrompt, ROLLUP_SCHEMA, DOC_DEFS_BY_KEY } from "@/lib/writingFactory/prompts";

// Rollup: sau khi viết xong chương, AI đọc nội dung chương + bible hiện tại,
// trả về các tài liệu CẦN cập nhật (timeline, tóm tắt hiện tại, phục bút,
// nhân vật, quan hệ, đại cương). Người dùng duyệt từng tài liệu rồi lưu.
export default function RollupPanel({ currentStoryId, genre, docsByKey, onDocsUpdated }) {
  const [chapters, setChapters] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [chapterContent, setChapterContent] = useState("");
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proposal, setProposal] = useState(null); // { key: { new, old, saved } }
  const [error, setError] = useState("");

  useEffect(() => {
    setActiveId(null);
    setProposal(null);
    listChapters(currentStoryId).then((list) => setChapters(list || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoryId]);

  useEffect(() => {
    let cancelled = false;
    if (activeId) {
      getChapter(activeId).then((full) => {
        if (cancelled) return;
        setChapterContent(full?.content || "");
      });
    } else {
      setChapterContent("");
    }
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const bibleText = useMemo(() => buildBibleBlock(docsByKey), [docsByKey]);

  const run = async () => {
    if (!activeId) {
      setError("Chọn một chương đã lưu để cập nhật bible.");
      return;
    }
    if (!chapterContent.trim()) {
      setError("Chương được chọn đang trống nội dung.");
      return;
    }
    setError("");
    setProposal(null);
    setRunning(true);
    try {
      const ch = chapters.find((c) => c.id === activeId);
      const prompt = buildRollupPrompt({
        genre,
        chapterTitle: ch?.title || "",
        chapterContent,
        bibleText,
        pastSummary: docsByKey?.tom_tat_hien_tai?.content || "",
      });
      const res = await aiCall(prompt, { jsonSchema: ROLLUP_SCHEMA });
      const updates = res?.updates || {};
      const keys = Object.keys(updates);
      if (!keys.length) {
        setProposal({});
        return;
      }
      const map = {};
      for (const k of keys) {
        map[k] = { old: docsByKey?.[k]?.content || "", new: updates[k], saved: false };
      }
      setProposal(map);
    } catch (e) {
      setError("Rollup lỗi: " + (e?.message || "lỗi"));
    } finally {
      setRunning(false);
    }
  };

  const acceptOne = async (key) => {
    const p = proposal[key];
    if (!p || p.saved) return;
    setSaving(true);
    try {
      await upsertWriterDoc(currentStoryId, key, { title: DOC_DEFS_BY_KEY[key]?.title || key, content: p.new });
      setProposal((prev) => ({ ...prev, [key]: { ...prev[key], saved: true } }));
      onDocsUpdated?.();
    } catch (e) {
      setError("Lưu tài liệu lỗi: " + (e?.message || "lỗi"));
    } finally {
      setSaving(false);
    }
  };

  const acceptAll = async () => {
    if (!proposal) return;
    setSaving(true);
    try {
      for (const key of Object.keys(proposal)) {
        if (proposal[key].saved) continue;
        await upsertWriterDoc(currentStoryId, key, { title: DOC_DEFS_BY_KEY[key]?.title || key, content: proposal[key].new });
      }
      setProposal((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, { ...prev[k], saved: true }])));
      onDocsUpdated?.();
    } catch (e) {
      setError("Lưu tài liệu lỗi: " + (e?.message || "lỗi"));
    } finally {
      setSaving(false);
    }
  };

  const proposalKeys = proposal ? Object.keys(proposal) : [];
  const allSaved = proposal && proposalKeys.length > 0 && proposalKeys.every((k) => proposal[k].saved);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold">Cập Nhật Bible Sau Chương</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Chọn chương vừa viết xong → AI đọc chương + bible hiện tại → đề xuất cập nhật timeline,
          tóm tắt hiện tại, phục bút, trạng thái nhân vật, quan hệ. Bạn duyệt từng tài liệu trước khi lưu.
        </p>

        <div className="flex items-center gap-2 mt-3">
          <select
            value={activeId || ""}
            onChange={(e) => setActiveId(e.target.value || null)}
            className="flex-1 rounded-md border border-input bg-transparent px-2.5 py-2 text-sm"
          >
            <option value="">— Chọn chương đã lưu —</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.chapter_number != null ? `Ch. ${c.chapter_number}: ` : ""}
                {c.title}
              </option>
            ))}
          </select>
          <button
            onClick={run}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {running ? "AI đang đọc & đề xuất..." : "Đề xuất cập nhật"}
          </button>
        </div>
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      </div>

      {proposal && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-display font-semibold text-sm">
                AI đề xuất cập nhật {proposalKeys.length} tài liệu
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={acceptAll}
                disabled={saving || allSaved}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Lưu tất cả
              </button>
            </div>
          </div>

          <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
            {proposalKeys.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                AI nhận định chương này không thay đổi gì đáng cập nhật so với bible.
              </p>
            )}
            {proposalKeys.map((key) => {
              const p = proposal[key];
              const def = DOC_DEFS_BY_KEY[key];
              return (
                <div key={key} className={`rounded-xl border p-3 ${p.saved ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-card"}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-medium text-sm">{def?.title || key}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{def?.file || ""}</span>
                    {p.saved && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-500/10 rounded-full px-2 py-0.5">
                        <Check className="w-3 h-3" /> Đã lưu
                      </span>
                    )}
                    <button
                      onClick={() => acceptOne(key)}
                      disabled={saving || p.saved}
                      className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-primary/40 text-primary text-[11px] hover:bg-primary/10 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Lưu tài liệu này
                    </button>
                  </div>
                  {p.old && (
                    <details className="mt-2">
                      <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                        Xem bản cũ (để so sánh)
                      </summary>
                      <pre className="mt-1.5 text-[10px] whitespace-pre-wrap max-h-40 overflow-y-auto bg-muted/40 rounded-md p-2 text-muted-foreground">
                        {p.old}
                      </pre>
                    </details>
                  )}
                  <div className="mt-2 rounded-md bg-muted/40 p-2.5">
                    <div className="text-[10px] font-semibold text-primary mb-1">Nội dung mới đề xuất</div>
                    <pre className="text-[11px] whitespace-pre-wrap max-h-56 overflow-y-auto text-foreground/90">{p.new}</pre>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}