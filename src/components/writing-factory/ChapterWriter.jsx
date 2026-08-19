import React, { useEffect, useMemo, useState } from "react";
import { PenLine, Loader2, Save, ListChecks, ShieldCheck, CheckCircle2, AlertTriangle, Wand2 } from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import {
  listChapters,
  getChapter,
  createChapter,
  updateChapter,
  deleteChapter,
} from "@/lib/worldcrud";
import {
  buildBibleBlock,
  buildWriteChapterPrompt,
  buildBibleConsistencyPrompt,
  BIBLE_CONSISTENCY_SCHEMA,
} from "@/lib/writingFactory/prompts";

function getLastWords(text, n) {
  if (!text) return "";
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= n) return text;
  return words.slice(words.length - n).join(" ");
}

// Viết chương bám Bible — nạp toàn bộ bộ tài liệu xưởng làm ngữ cảnh.
export default function ChapterWriter({ currentStoryId, genre, docsByKey, onChapterWritten }) {
  const [chapters, setChapters] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [content, setContent] = useState("");
  const [goal, setGoal] = useState("");
  const [orientation, setOrientation] = useState("");
  const [prevTail, setPrevTail] = useState("");
  const [writing, setWriting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [issues, setIssues] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    const list = (await listChapters(currentStoryId)) || [];
    list.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
    setChapters(list);
    setActiveId((prev) => (prev && list.find((c) => c.id === prev) ? prev : list[0]?.id || null));
  };

  useEffect(() => {
    setActiveId(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoryId]);

  useEffect(() => {
    let cancelled = false;
    if (activeId) {
      getChapter(activeId).then((full) => {
        if (cancelled) return;
        setTitle(full.title || "");
        setNumber(full.chapter_number ?? "");
        setContent(full.content || "");
      });
    } else {
      setTitle("");
      setNumber(String((chapters?.[chapters.length - 1]?.chapter_number || 0) + 1));
      setContent("");
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const bibleText = useMemo(() => buildBibleBlock(docsByKey), [docsByKey]);

  const handleNew = () => {
    setActiveId(null);
  };

  const handleSelect = (id) => {
    setActiveId(id || null);
  };

  const handleWrite = async () => {
    setError("");
    setIssues(null);
    setWriting(true);
    try {
      const prompt = buildWriteChapterPrompt({
        genre,
        chapterTitle: title,
        chapterNumber: number,
        chapterGoal: goal,
        bibleText,
        prevTail: prevTail || getLastWords(content, 800),
        orientation,
      });
      const res = await aiCall(prompt);
      setContent((prev) => (prev.trim() ? `${prev.trim()}\n\n---\n\n${String(res)}` : String(res)));
    } catch (e) {
      setError("Không thể viết chương: " + (e?.message || "lỗi"));
    } finally {
      setWriting(false);
    }
  };

  const handleCheck = async () => {
    if (!content.trim()) return;
    setError("");
    setIssues(null);
    setChecking(true);
    try {
      const prompt = buildBibleConsistencyPrompt({ genre, chapterContent: content, bibleText });
      const res = await aiCall(prompt, { jsonSchema: BIBLE_CONSISTENCY_SCHEMA });
      setIssues(res?.issues || []);
    } catch (e) {
      setError("Kiểm tra nhất quán lỗi: " + (e?.message || "lỗi"));
    } finally {
      setChecking(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Chưa có tên chương.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const num = number === "" ? undefined : Number(number);
      let saved;
      if (activeId) {
        saved = await updateChapter(activeId, { title, chapter_number: num, content });
      } else {
        saved = await createChapter({
          story_id: currentStoryId,
          title,
          chapter_number: num ?? chapters.length + 1,
          content,
        });
      }
      setChapters((cs) =>
        [...cs.filter((c) => c.id !== saved.id), saved].sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0))
      );
      setActiveId(saved.id);
      onChapterWritten?.(saved);
    } catch (e) {
      setError("Lưu chương lỗi: " + (e?.message || "lỗi"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeId) return;
    setError("");
    try {
      await deleteChapter(activeId);
      setChapters((cs) => cs.filter((c) => c.id !== activeId));
      setActiveId(null);
    } catch (e) {
      setError("Xoá chương lỗi: " + (e?.message || "lỗi"));
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      {/* Cột trái — soạn chương */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
          <PenLine className="w-4 h-4 text-primary shrink-0" />
          <select
            value={activeId || ""}
            onChange={(e) => handleSelect(e.target.value || "")}
            className="h-8 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">+ Chương mới (chưa lưu)</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.chapter_number != null ? `Ch. ${c.chapter_number}` : "Ch."} · {c.title}
              </option>
            ))}
          </select>
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border text-xs hover:bg-muted"
          >
            Mới
          </button>
          {activeId && (
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-destructive/40 text-destructive text-xs hover:bg-destructive/10"
            >
              Xoá
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-[1fr_100px] gap-2.5 px-4 pt-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Tên chương</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Khởi đầu"
              className="mt-1 w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Số chương</label>
            <input
              type="number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="1"
              className="mt-1 w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="px-4 pt-2.5">
          <label className="text-[11px] font-medium text-muted-foreground">Mục tiêu chương (biến cố/xung đột cần xảy ra)</label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            placeholder="VD: Nữ chính phát hiện thân phận thật của nam chính, đối chất, xảy ra hiểu lầm..."
            className="mt-1 w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs resize-y"
          />
        </div>

        <div className="px-4 pt-2.5">
          <label className="text-[11px] font-medium text-muted-foreground">
            Đoạn cuối chương trước để AI nối mạch (trống = tự lấy từ chương đã lưu)
          </label>
          <textarea
            value={prevTail}
            onChange={(e) => setPrevTail(e.target.value)}
            rows={2}
            placeholder="Dán đoạn kết chương trước nếu muốn AI nối đúng mạch..."
            className="mt-1 w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs resize-y"
          />
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
          <button
            onClick={handleWrite}
            disabled={writing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {writing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {writing ? "Xưởng đang viết..." : "Viết chương bằng AI"}
          </button>
          <button
            onClick={handleCheck}
            disabled={checking || !content.trim()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-primary/40 text-primary text-sm hover:bg-primary/10 disabled:opacity-50"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Kiểm tra nhất quán
          </button>
        </div>

        {error && (
          <div className="mx-4 mb-2 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
        )}

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Bản thảo chương — bấm 'Viết chương bằng AI' để Xưởng viết dựa trên toàn bộ bible..."
          className="flex-1 min-h-[360px] resize-y px-4 py-3 text-[15px] leading-7 bg-card focus:outline-none font-body"
        />

        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-border bg-muted/20">
          <span className="mr-auto text-[11px] text-muted-foreground">
            {content.trim() ? `${content.split(/\s+/).filter(Boolean).length} từ` : "Bản nháp trống"}
          </span>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {activeId ? "Lưu chương" : "Tạo chương"}
          </button>
        </div>
      </div>

      {/* Cột phải — theo dõi + kết quả nhất quán */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-sm">Chương đã lưu</h3>
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {chapters.length === 0 && <li className="text-muted-foreground">Chưa có chương nào.</li>}
            {chapters.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => handleSelect(c.id)}
                  className={`w-full text-left px-2 py-1.5 rounded-md hover:bg-muted ${c.id === activeId ? "bg-primary/10 font-medium" : ""}`}
                >
                  {c.chapter_number != null ? `Ch. ${c.chapter_number}: ` : ""}
                  {c.title}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground mt-2">
            Sau khi lưu, mở tab <b>Cập Nhật Bible</b> để AI ghi nhận tiến độ & phục bút.
          </p>
        </div>

        {issues !== null && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <h3 className="font-display font-semibold text-sm">Kết quả kiểm tra</h3>
            </div>
            <div className="mt-2 space-y-2">
              {issues.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-500/10 rounded-md px-3 py-2.5">
                  <CheckCircle2 className="w-4 h-4" /> Không phát hiện mâu thuẫn với bible.
                </div>
              ) : (
                issues.map((iss, i) => {
                  const severe = (iss.severity || "").toLowerCase().includes("nghiêm") || (iss.severity || "").toLowerCase().includes("high");
                  return (
                    <div
                      key={i}
                      className={`rounded-md px-3 py-2 text-xs ${
                        severe ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold">{iss.severity || "Cảnh báo"}</span>
                          {iss.where ? <span className="opacity-70"> · {iss.where}</span> : null}: {iss.problem}
                          {iss.suggestion ? <div className="opacity-80 mt-0.5">→ {iss.suggestion}</div> : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}