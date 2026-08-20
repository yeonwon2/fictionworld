import React, { useEffect, useMemo, useState } from "react";
import {
  PenLine,
  Loader2,
  Save,
  ListChecks,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Wand2,
  ListOrdered,
  RefreshCw,
  Check,
  FileText,
  Edit3,
  MessagesSquare,
} from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import {
  listChapters,
  getChapter,
  createChapter,
  updateChapter,
  deleteChapter,
  upsertWriterDoc,
  createWriterDocSnapshot,
} from "@/lib/worldcrud";
import {
  buildBibleBlock,
  buildWriteChapterPrompt,
  buildBeatPlannerPrompt,
  BEAT_PLANNER_SCHEMA,
  buildChapterRevisionPrompt,
  buildBibleConsistencyPrompt,
  BIBLE_CONSISTENCY_SCHEMA,
  buildXungHoConsistencyPrompt,
  XUNG_HO_CONSISTENCY_SCHEMA,
  buildRollupPrompt,
  ROLLUP_SCHEMA,
  DOC_DEFS_BY_KEY,
} from "@/lib/writingFactory/prompts";

function getLastWords(text, n) {
  if (!text) return "";
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= n) return text;
  return words.slice(words.length - n).join(" ");
}

// Viết chương bám Bible — nạp toàn bộ bộ tài liệu xưởng làm ngữ cảnh.
// Flow: (1) Lên beats (细纲) → tác giả duyệt/sửa → (2) AI viết prose theo beats
// → (3) Lưu chương → (4) auto-rollup đề xuất cập nhật bible ngay bên dưới.
export default function ChapterWriter({ currentStoryId, genre, docsByKey, onChapterWritten, onDocsUpdated }) {
  const [chapters, setChapters] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [content, setContent] = useState("");
  const [goal, setGoal] = useState("");
  const [orientation, setOrientation] = useState("");
  const [targetWords, setTargetWords] = useState("2000");
  const [prevTail, setPrevTail] = useState("");
  const [writing, setWriting] = useState(false);
  const [revising, setRevising] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [issues, setIssues] = useState(null);
  const [checkingXungHo, setCheckingXungHo] = useState(false);
  const [xungHoIssues, setXungHoIssues] = useState(null);
  const [error, setError] = useState("");
  const [statusNote, setStatusNote] = useState("");

  // Beat planner
  const [beats, setBeats] = useState([]);
  const [planningBeats, setPlanningBeats] = useState(false);
  const [beatsApproved, setBeatsApproved] = useState(false);

  // Auto-rollup
  const [rollingUp, setRollingUp] = useState(false);
  const [rollupProposal, setRollupProposal] = useState(null);
  const [rollupSaving, setRollupSaving] = useState(false);
  const [autoRollup, setAutoRollup] = useState(true);

  const load = async () => {
    const list = (await listChapters(currentStoryId)) || [];
    list.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
    setChapters(list);
    setActiveId((prev) => (prev && list.find((c) => c.id === prev) ? prev : list[0]?.id || null));
  };

  useEffect(() => {
    setActiveId(null);
    setBeats([]);
    setBeatsApproved(false);
    setRollupProposal(null);
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
        try {
          setBeats(full.outline_beats ? JSON.parse(full.outline_beats) : []);
        } catch {
          setBeats([]);
        }
        setBeatsApproved(!!full.outline_beats);
      });
    } else {
      setTitle("");
      setNumber(String((chapters?.[chapters.length - 1]?.chapter_number || 0) + 1));
      setContent("");
      setBeats([]);
      setBeatsApproved(false);
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

  const handlePlanBeats = async () => {
    setError("");
    setPlanningBeats(true);
    try {
      const prompt = buildBeatPlannerPrompt({
        genre,
        chapterTitle: title,
        chapterNumber: number,
        chapterGoal: goal,
        bibleText,
        prevTail: prevTail || getLastWords(content, 800),
        orientation,
      });
      const res = await aiCall(prompt, { jsonSchema: BEAT_PLANNER_SCHEMA });
      setBeats(res?.beats || []);
      setBeatsApproved(false);
    } catch (e) {
      setError("Không thể lên beats: " + (e?.message || "lỗi"));
    } finally {
      setPlanningBeats(false);
    }
  };

  const updateBeat = (i, value) => {
    setBeats((bs) => bs.map((b, idx) => (idx === i ? value : b)));
    setBeatsApproved(false);
  };
  const addBeat = () => {
    setBeats((bs) => [...bs, ""]);
    setBeatsApproved(false);
  };
  const removeBeat = (i) => {
    setBeats((bs) => bs.filter((_, idx) => idx !== i));
    setBeatsApproved(false);
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
        beats: beatsApproved ? beats : undefined,
        targetWords,
      });
      const res = await aiCall(prompt);
      setContent((prev) => (prev.trim() ? `${prev.trim()}\n\n---\n\n${String(res)}` : String(res)));
    } catch (e) {
      setError("Không thể viết chương: " + (e?.message || "lỗi"));
    } finally {
      setWriting(false);
    }
  };

  const handleRevise = async () => {
    if (!content.trim()) {
      setError("Chưa có bản thảo để sửa — hãy viết chương trước.");
      return;
    }
    if (!revisionNote.trim()) {
      setError("Hãy ghi rõ góp ý (VD: 'kéo dài đoạn đối chất, thêm cảm xúc, bỏ đoạn miêu tả...').");
      return;
    }
    setError("");
    setRevising(true);
    try {
      const prompt = buildChapterRevisionPrompt({
        genre,
        chapterTitle: title,
        chapterNumber: number,
        chapterGoal: goal,
        bibleText,
        currentContent: content,
        feedback: revisionNote,
        orientation,
        beats: beatsApproved ? beats : undefined,
        targetWords,
      });
      const res = await aiCall(prompt);
      setContent(String(res));
      setRevisionNote("");
      setStatusNote("Đã sửa chương theo góp ý. Xem lại rồi Lưu chương để cập nhật.");
    } catch (e) {
      setError("Sửa chương lỗi: " + (e?.message || "lỗi"));
    } finally {
      setRevising(false);
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

  const handleCheckXungHo = async () => {
    if (!chapters.length) {
      setError("Chưa có chương nào để kiểm tra xưng hô.");
      return;
    }
    setError("");
    setXungHoIssues(null);
    setCheckingXungHo(true);
    try {
      // listChapters chỉ trả cột nhẹ — cần lấy content từng chương.
      const full = [];
      for (const c of chapters) {
        try {
          const row = await getChapter(c.id);
          if (row?.content?.trim()) full.push(row);
        } catch {
          // bỏ qua chương đọc lỗi
        }
      }
      if (!full.length) {
        setError("Không tìm thấy nội dung chương nào — hãy lưu chương trước.");
        return;
      }
      const relationText = docsByKey?.quan_he?.content || "";
      const prompt = buildXungHoConsistencyPrompt({ genre, relationText, chapters: full });
      const res = await aiCall(prompt, { jsonSchema: XUNG_HO_CONSISTENCY_SCHEMA });
      setXungHoIssues(res?.issues || []);
    } catch (e) {
      setError("Kiểm tra xưng hô lỗi: " + (e?.message || "lỗi"));
    } finally {
      setCheckingXungHo(false);
    }
  };

  const runRollup = async (chapterRow) => {
    setError("");
    setRollupProposal(null);
    setRollingUp(true);
    try {
      const prompt = buildRollupPrompt({
        genre,
        chapterTitle: chapterRow?.title || title,
        chapterContent: content,
        bibleText,
        pastSummary: docsByKey?.tom_tat_hien_tai?.content || "",
      });
      const res = await aiCall(prompt, { jsonSchema: ROLLUP_SCHEMA });
      const updates = res?.updates || {};
      const map = {};
      for (const k of Object.keys(updates)) {
        map[k] = { old: docsByKey?.[k]?.content || "", new: updates[k], saved: false };
      }
      setRollupProposal(map);
    } catch (e) {
      setError("Rollup lỗi: " + (e?.message || "lỗi"));
    } finally {
      setRollingUp(false);
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
      const payload = { title, chapter_number: num, content };
      if (beats.length) payload.outline_beats = JSON.stringify(beats);
      let saved;
      if (activeId) {
        saved = await updateChapter(activeId, payload);
      } else {
        saved = await createChapter({
          story_id: currentStoryId,
          chapter_number: num ?? chapters.length + 1,
          ...payload,
        });
      }
      setChapters((cs) =>
        [...cs.filter((c) => c.id !== saved.id), saved].sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0))
      );
      setActiveId(saved.id);
      onChapterWritten?.(saved);
      if (autoRollup && content.trim()) {
        await runRollup(saved);
      }
    } catch (e) {
      setError("Lưu chương lỗi: " + (e?.message || "lỗi"));
    } finally {
      setSaving(false);
    }
  };

  const acceptRollupOne = async (key) => {
    const p = rollupProposal[key];
    if (!p || p.saved) return;
    setRollupSaving(true);
    try {
      // Snapshot bản cũ trước khi ghi đè — để quay lại nếu AI update sai.
      if (p.old?.trim()) {
        await createWriterDocSnapshot(currentStoryId, key, {
          title: DOC_DEFS_BY_KEY[key]?.title || key,
          content: p.old,
          label: "trước rollup",
        });
      }
      await upsertWriterDoc(currentStoryId, key, { title: DOC_DEFS_BY_KEY[key]?.title || key, content: p.new });
      setRollupProposal((prev) => ({ ...prev, [key]: { ...prev[key], saved: true } }));
      onDocsUpdated?.();
    } catch (e) {
      setError("Lưu tài liệu lỗi: " + (e?.message || "lỗi"));
    } finally {
      setRollupSaving(false);
    }
  };

  const acceptRollupAll = async () => {
    if (!rollupProposal) return;
    setRollupSaving(true);
    try {
      for (const key of Object.keys(rollupProposal)) {
        if (rollupProposal[key].saved) continue;
        if (rollupProposal[key].old?.trim()) {
          await createWriterDocSnapshot(currentStoryId, key, {
            title: DOC_DEFS_BY_KEY[key]?.title || key,
            content: rollupProposal[key].old,
            label: "trước rollup",
          });
        }
        await upsertWriterDoc(currentStoryId, key, {
          title: DOC_DEFS_BY_KEY[key]?.title || key,
          content: rollupProposal[key].new,
        });
      }
      setRollupProposal((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, { ...prev[k], saved: true }])));
      onDocsUpdated?.();
    } catch (e) {
      setError("Lưu tài liệu lỗi: " + (e?.message || "lỗi"));
    } finally {
      setRollupSaving(false);
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

  const rollupKeys = rollupProposal ? Object.keys(rollupProposal) : [];
  const rollupAllSaved = rollupKeys.length > 0 && rollupKeys.every((k) => rollupProposal[k].saved);

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
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] font-medium text-muted-foreground">Mục tiêu chương (biến cố/xung đột cần xảy ra)</label>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
              Độ dài mục tiêu
              <input
                type="number"
                min={300}
                max={10000}
                step={100}
                value={targetWords}
                onChange={(e) => setTargetWords(e.target.value)}
                className="w-20 rounded-md border border-input bg-transparent px-2 py-1 text-xs text-foreground"
              />
              từ
            </label>
          </div>
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

        {/* Scene Beat Planner */}
        <div className="px-4 pt-2.5">
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <ListOrdered className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold">Dàn beats (细纲)</span>
              {beatsApproved && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-500/10 rounded-full px-2 py-0.5">
                  <Check className="w-3 h-3" /> Đã duyệt — sẽ bám sát khi viết
                </span>
              )}
              <button
                onClick={handlePlanBeats}
                disabled={planningBeats}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/40 text-primary text-[11px] hover:bg-primary/10 disabled:opacity-50"
              >
                {planningBeats ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                Lên beats bằng AI
              </button>
            </div>
            {beats.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {beats.map((b, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                    <input
                      value={b}
                      onChange={(e) => updateBeat(i, e.target.value)}
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                    />
                    <button onClick={() => removeBeat(i)} className="p-1 text-muted-foreground hover:text-destructive text-xs">✕</button>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={addBeat} className="text-[11px] text-primary hover:underline">+ Thêm beat</button>
                  <button
                    onClick={() => setBeatsApproved(true)}
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:underline"
                  >
                    <Check className="w-3 h-3" /> Duyệt beats này
                  </button>
                </div>
              </div>
            )}
            {beats.length === 0 && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Beats = khung xương chương (mở cảnh → xung đột → cao trào → móc treo). Duyệt beats rồi mới viết văn sẽ chặt chẽ hơn.
              </p>
            )}
          </div>
        </div>

        {/* Sửa chương theo góp ý */}
        <div className="px-4 pt-2.5">
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold">Sửa chương theo góp ý</span>
              <span className="text-[10px] text-muted-foreground">(viết xong chương rồi muốn AI chỉnh lại chỗ nào)</span>
            </div>
            <textarea
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              rows={2}
              placeholder="VD: 'Kéo dài đoạn đối chất giữa nữ chính và nam chính, thêm cảm xúc; bỏ đoạn miêu tả phố xá; nhân vật A phải nghi ngờ hơn'..."
              className="mt-2 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs resize-y"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleRevise}
                disabled={revising || !content.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/40 text-primary text-[11px] hover:bg-primary/10 disabled:opacity-50"
              >
                {revising ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {revising ? "Đang sửa..." : "Sửa theo góp ý này"}
              </button>
              <span className="text-[10px] text-muted-foreground">
                AI viết lại toàn bộ chương theo góp ý — giữ đoạn đã hay. Sau đó bấm Lưu chương.
              </span>
            </div>
          </div>
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
          <button
            onClick={handleCheckXungHo}
            disabled={checkingXungHo || !chapters.length}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-primary/40 text-primary text-sm hover:bg-primary/10 disabled:opacity-50"
            title="Đọc toàn bộ chương, rà xem lúc 'em' lúc 'ngươi', lúc 'tôi' lúc 'ta'..."
          >
            {checkingXungHo ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessagesSquare className="w-4 h-4" />}
            Kiểm tra xưng hô
          </button>
          <label className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoRollup}
              onChange={(e) => setAutoRollup(e.target.checked)}
              className="accent-primary"
            />
            Tự cập nhật bible sau khi lưu
          </label>
        </div>

        {error && (
          <div className="mx-4 mb-2 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
        )}
        {statusNote && (
          <div className="mx-4 mb-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-md px-3 py-2">{statusNote}</div>
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
            disabled={saving || rollingUp || !title.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {activeId ? "Lưu chương" : "Tạo chương"}
          </button>
        </div>

        {/* Auto-rollup đề xuất ngay dưới chương vừa lưu */}
        {rollingUp && (
          <div className="mx-4 mb-3 flex items-center gap-2 text-xs text-primary">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI đang đọc chương vừa lưu & đề xuất cập nhật bible...
          </div>
        )}
        {rollupProposal && (
          <div className="mx-4 mb-4 rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-primary" />
                <span className="font-display font-semibold text-sm">
                  {rollupKeys.length === 0 ? "Bible không cần cập nhật" : `AI đề xuất cập nhật ${rollupKeys.length} tài liệu`}
                </span>
              </div>
              {rollupKeys.length > 0 && (
                <button
                  onClick={acceptRollupAll}
                  disabled={rollupSaving || rollupAllSaved}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {rollupSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Lưu tất cả
                </button>
              )}
            </div>
            <div className="p-3 space-y-2.5 max-h-[50vh] overflow-y-auto">
              {rollupKeys.map((key) => {
                const p = rollupProposal[key];
                const def = DOC_DEFS_BY_KEY[key];
                return (
                  <div key={key} className={`rounded-lg border p-2.5 ${p.saved ? "border-emerald-500/40 bg-emerald-500/5" : "border-border"}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="font-medium text-xs">{def?.title || key}</span>
                      {p.saved && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                          <Check className="w-3 h-3" /> Đã lưu
                        </span>
                      )}
                      <button
                        onClick={() => acceptRollupOne(key)}
                        disabled={rollupSaving || p.saved}
                        className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md border border-primary/40 text-primary text-[10px] hover:bg-primary/10 disabled:opacity-50"
                      >
                        <Check className="w-3 h-3" /> Lưu
                      </button>
                    </div>
                    <pre className="mt-1.5 text-[10px] whitespace-pre-wrap max-h-32 overflow-y-auto text-foreground/80 bg-muted/30 rounded p-2">
                      {p.new}
                    </pre>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
            Lưu chương sẽ tự động đề xuất cập nhật bible (bật/tắt bằng checkbox). Mở tab <b>Cập Nhật Bible</b> nếu muốn rollup chương cũ.
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
        {xungHoIssues !== null && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <MessagesSquare className="w-4 h-4 text-primary" />
              <h3 className="font-display font-semibold text-sm">Kiểm tra xưng hô (mọi chương)</h3>
            </div>
            <div className="mt-2 space-y-2">
              {xungHoIssues.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-500/10 rounded-md px-3 py-2.5">
                  <CheckCircle2 className="w-4 h-4" /> Xưng hô nhất quán giữa các chương.
                </div>
              ) : (
                xungHoIssues.map((iss, i) => (
                  <div key={i} className="rounded-md px-3 py-2 text-xs bg-destructive/10 text-destructive">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-semibold">
                          {iss.character_a || "?"}
                          {iss.character_b ? ` ↔ ${iss.character_b}` : ""}
                        </span>
                        {iss.chapters ? <span className="opacity-70"> · Chương {iss.chapters}</span> : null}
                        <div className="opacity-80 mt-0.5">{iss.problem}</div>
                        {iss.found ? (
                          <div className="opacity-80 mt-0.5 text-[10px]">Thấy: {iss.found}</div>
                        ) : null}
                        {iss.expected ? (
                          <div className="opacity-80 mt-0.5 text-[10px]">Chuẩn: {iss.expected}</div>
                        ) : null}
                        {iss.suggestion ? <div className="opacity-80 mt-0.5">→ {iss.suggestion}</div> : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              So sánh xưng hô giữa các chương với nhau và với 03_QUAN_HE. Sửa chương theo góp ý nếu cần rồi lưu lại.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}