import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Gauge,
  Sparkles,
  DoorOpen,
  Flag,
  Copy,
  History,
  RotateCcw,
  Camera,
  X,
  Rocket,
  Target,
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
  createChapterSnapshot,
  listChapterSnapshots,
  getChapterSnapshot,
  deleteChapterSnapshot,
} from "@/lib/worldcrud";
import {
  buildWriteChapterPrompt,
  buildBeatPlannerPrompt,
  BEAT_PLANNER_SCHEMA,
  buildChapterRevisionPrompt,
  buildBibleConsistencyPrompt,
  BIBLE_CONSISTENCY_SCHEMA,
  buildXungHoConsistencyPrompt,
  XUNG_HO_CONSISTENCY_SCHEMA,
  buildChapterCritiquePrompt,
  CHAPTER_CRITIQUE_SCHEMA,
  buildRewriteFromCritiquePrompt,
  buildOpeningPrompt,
  buildHookPrompt,
  CHAPTER_OPTIONS_SCHEMA,
  buildRepetitionCheckPrompt,
  REPETITION_CHECK_SCHEMA,
  buildRollupPrompt,
  ROLLUP_SCHEMA,
  buildNextChapterGoalPrompt,
  NEXT_CHAPTER_GOAL_SCHEMA,
  buildChapterContractPrompt,
  CHAPTER_CONTRACT_SCHEMA,
  buildLogicGatePrompt,
  LOGIC_GATE_SCHEMA,
  buildQualityGatePrompt,
  QUALITY_GATE_SCHEMA,
  buildGateRepairPrompt,
  DOC_DEFS_BY_KEY,
} from "@/lib/writingFactory/prompts";
import { canPassQuality, canWriteChapter, compactBibleContext, decodeChapterPlan, encodeChapterPlan, findPreviousChapter, getWordBudgetStatus } from "@/lib/writingFactory/workflow";

function getLastWords(text, n) {
  if (!text) return "";
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= n) return text;
  return words.slice(words.length - n).join(" ");
}

// Viết chương bám Bible — nạp toàn bộ bộ tài liệu xưởng làm ngữ cảnh.
// Flow: (1) Lên beats (细纲) → tác giả duyệt/sửa → (2) AI viết prose theo beats
// → (3) Lưu chương → (4) auto-rollup đề xuất cập nhật bible ngay bên dưới.
// (5) Nếu có phục bút sắp hết hạn → tự nhồi vào prompt để AI hồi đáp.
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
  const [autoPrevTail, setAutoPrevTail] = useState("");
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

  // Viết 2 pass (tự đánh giá & viết lại)
  const [qualityMode, setQualityMode] = useState(false);
  const [writeStep, setWriteStep] = useState("");
  const [critique, setCritique] = useState(null);

  // Mở màn / hook đa lựa chọn
  const [openingOptions, setOpeningOptions] = useState(null);
  const [hookOptions, setHookOptions] = useState(null);
  const [genOpen, setGenOpen] = useState(false);
  const [genHook, setGenHook] = useState(false);

  // Check đạo nhại
  const [checkingRep, setCheckingRep] = useState(false);
  const [repIssues, setRepIssues] = useState(null);

  // Beat planner
  const [beats, setBeats] = useState([]);
  const [planningBeats, setPlanningBeats] = useState(false);
  const [beatsApproved, setBeatsApproved] = useState(false);
  const [contract, setContract] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [planningContract, setPlanningContract] = useState(false);
  const [preflight, setPreflight] = useState(null);
  const [runningPreflight, setRunningPreflight] = useState(false);
  const [qualityGate, setQualityGate] = useState(null);
  const [runningQuality, setRunningQuality] = useState(false);
  const [repairingGate, setRepairingGate] = useState(false);

  // Auto-rollup
  const [rollingUp, setRollingUp] = useState(false);
  const [rollupProposal, setRollupProposal] = useState(null);
  const [rollupSaving, setRollupSaving] = useState(false);
  const [autoRollup, setAutoRollup] = useState(true);

  // Lịch sử phiên bản chương (snapshot trước mỗi lần lưu ghi đè nội dung khác)
  const originalContentRef = useRef(""); // nội dung ĐANG CÓ TRONG DB của chương đang mở — để biết có đổi thật không trước khi snapshot
  const [historyOpen, setHistoryOpen] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Gợi ý mục tiêu chương tiếp theo + Tự động viết chương tiếp theo (auto-pilot)
  const [suggestingGoal, setSuggestingGoal] = useState(false);
  const [autoPiloting, setAutoPiloting] = useState(false);
  const [autoPilotStep, setAutoPilotStep] = useState("");

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
        originalContentRef.current = full.content || "";
        const plan = decodeChapterPlan(full.outline_beats);
        setBeats(plan.beats);
        setContract(plan.contract);
        setScenes(plan.scenes);
        setBeatsApproved(Boolean(plan.beats.length));
        setPreflight(null);
        setQualityGate(plan.quality);
      });
    } else {
      setTitle("");
      setNumber(String((chapters?.[chapters.length - 1]?.chapter_number || 0) + 1));
      setContent("");
      originalContentRef.current = "";
      setBeats([]);
      setContract(null);
      setScenes([]);
      setPreflight(null);
      setQualityGate(null);
      setBeatsApproved(false);
    }
    setHistoryOpen(false);
    setSnapshots([]);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    let cancelled = false;
    const previous = findPreviousChapter(chapters, activeId, number);
    if (!previous) { setAutoPrevTail(""); return undefined; }
    getChapter(previous.id).then((row) => {
      if (!cancelled) setAutoPrevTail(getLastWords(row?.content || "", 800));
    }).catch(() => { if (!cancelled) setAutoPrevTail(""); });
    return () => { cancelled = true; };
  }, [chapters, activeId, number]);

  const bibleText = useMemo(() => compactBibleContext(docsByKey), [docsByKey]);

  // Parse 05_FUC_BUT, tìm phục bút "đang treo" / "đã cài" có resolve_by_chapter <= số chương hiện tại.
  const overdueForeshadows = useMemo(() => {
    const content = docsByKey?.fuc_but?.content || "";
    const curNum = Number(number) || 1;
    const items = [];
    const regex = /###?\s*(.+?)(?:\n|$)/g;
    let m;
    while ((m = regex.exec(content))) {
      const name = m[1].trim();
      const rest = content.slice(m.index, content.indexOf("\n###", m.index + 1) || content.length);
      const isPending = /treo|đã cài|chưa cài|pending/i.test(rest) && !/đã hồi đáp|resolved/i.test(rest);
      if (isPending) {
        const chapMatch = rest.match(/chương\s*(\d+)/i);
        const resolveBy = chapMatch ? Number(chapMatch[1]) : null;
        if (!resolveBy || resolveBy <= curNum) {
          items.push({ name, description: rest.replace(/^#+\s*.+\n/, "").trim().slice(0, 200) });
        }
      }
    }
    return items.slice(0, 3); // tối đa 3 phục bút
  }, [docsByKey, number]);

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
        prevTail: prevTail || autoPrevTail,
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

  const handlePlanContract = async () => {
    setError("");
    setPlanningContract(true);
    setPreflight(null);
    setQualityGate(null);
    try {
      const res = await aiCall(buildChapterContractPrompt({
        genre, chapterNumber: number, chapterTitle: title, chapterGoal: goal, bibleText,
        prevTail: prevTail || autoPrevTail, targetWords,
      }), { jsonSchema: CHAPTER_CONTRACT_SCHEMA });
      setContract(res?.contract || null);
      setScenes(res?.scenes || []);
      setStatusNote("Planner đã lập Chapter Contract + Scene Plan. Hãy chạy hard gate trước khi viết.");
    } catch (e) {
      setError("Không thể lập hợp đồng chương: " + (e?.message || "lỗi"));
    } finally { setPlanningContract(false); }
  };

  const handlePreflight = async () => {
    if (!contract || !scenes.length) { setError("Hãy lập Chapter Contract + Scene Plan trước."); return; }
    setError(""); setRunningPreflight(true); setPreflight(null);
    try {
      const res = await aiCall(buildLogicGatePrompt({ genre, phase: "pre", bibleText, contract, scenes }), { jsonSchema: LOGIC_GATE_SCHEMA });
      setPreflight(res);
    } catch (e) { setError("Hard gate trước viết lỗi: " + (e?.message || "lỗi")); }
    finally { setRunningPreflight(false); }
  };

  const handleQualityGate = async () => {
    if (!content.trim()) return;
    setError(""); setRunningQuality(true); setQualityGate(null);
    try {
      const logic = await aiCall(buildLogicGatePrompt({ genre, phase: "post", bibleText, contract, scenes, chapterContent: content }), { jsonSchema: LOGIC_GATE_SCHEMA });
      if (!logic?.passed) { setQualityGate({ ...logic, score: 0, stage: "logic" }); return; }
      const quality = await aiCall(buildQualityGatePrompt({ genre, bibleText, contract, scenes, chapterContent: content, targetWords }), { jsonSchema: QUALITY_GATE_SCHEMA });
      setQualityGate({ ...quality, stage: "quality" });
    } catch (e) { setError("Quality Gate lỗi: " + (e?.message || "lỗi")); }
    finally { setRunningQuality(false); }
  };

  const handleRepairGate = async () => {
    if (!qualityGate || !content.trim()) return;
    setRepairingGate(true); setError("");
    try {
      const revised = await aiCall(buildGateRepairPrompt({ genre, bibleText, contract, scenes, chapterContent: content, gateReport: qualityGate, targetWords }));
      setContent(String(revised || ""));
      setQualityGate(null);
      setStatusNote("Writer đã sửa theo phiếu gate. Hãy chạy lại Chapter Quality Gate để xác nhận.");
    } catch (e) { setError("Tự sửa theo gate lỗi: " + (e?.message || "lỗi")); }
    finally { setRepairingGate(false); }
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
    if (!canWriteChapter({ contract, scenes, preflight })) {
      setError("Hard gate chưa pass. Hãy lập Chapter Contract + Scene Plan và sửa mọi lỗi logic/canon trước khi viết.");
      return;
    }
    setError("");
    setIssues(null);
    setQualityGate(null);
    setCritique(null);
    setWriteStep("");
    setWriting(true);
    try {
      const prompt = buildWriteChapterPrompt({
        genre,
        chapterTitle: title,
        chapterNumber: number,
        chapterGoal: goal,
        bibleText,
        prevTail: prevTail || autoPrevTail,
        orientation,
        beats: beatsApproved ? beats : undefined,
        targetWords,
        overdueForeshadows,
        contract,
        scenes,
      });
      if (qualityMode) {
        // Pass 1 — viết nháp
        setWriteStep("Pass 1/2 — viết nháp...");
        const draft = await aiCall(prompt);
        // Pass 2 — tự đánh giá theo rubric
        setWriteStep("Pass 2/2 — tổng biên tập đang chấm điểm...");
        const crit = await aiCall(buildChapterCritiquePrompt({ genre, chapterTitle: title, bibleText, chapterContent: draft, targetWords }), {
          jsonSchema: CHAPTER_CRITIQUE_SCHEMA,
        });
        setCritique(crit);
        // Pass 3 — viết lại theo đánh giá
        setWriteStep("Pass 2/2 — viết lại theo đánh giá...");
        const critiqueText = [
          ...(crit?.scores || []).map((s) => `- ${s.criterion}: ${s.score}/10 — ${s.note || ""}`),
          "Điểm mạnh: " + (crit?.strengths || []).join("; "),
          "Điểm yếu: " + (crit?.weaknesses || []).join("; "),
          "Lệnh viết lại: " + (crit?.rewrite_instructions || []).map((r) => `[${r}]`).join(", "),
        ].join("\n");
        const final = await aiCall(
          buildRewriteFromCritiquePrompt({
            genre,
            chapterTitle: title,
            bibleText,
            chapterContent: draft,
            critiqueText,
            targetWords,
          })
        );
        setContent(String(final));
        setStatusNote("Đã viết 2 pass: nháp → chấm điểm → viết lại. Xem lại rồi Lưu chương.");
      } else {
        const res = await aiCall(prompt);
        setContent((prev) => (prev.trim() ? `${prev.trim()}\n\n---\n\n${String(res)}` : String(res)));
      }
    } catch (e) {
      setError("Không thể viết chương: " + (e?.message || "lỗi"));
    } finally {
      setWriteStep("");
      setWriting(false);
    }
  };

  const handleGenOpening = async () => {
    setError("");
    setOpeningOptions(null);
    setGenOpen(true);
    try {
      const p = buildOpeningPrompt({
        genre,
        chapterTitle: title,
        chapterNumber: number,
        chapterGoal: goal,
        bibleText,
        prevTail: prevTail || autoPrevTail,
        orientation,
      });
      const res = await aiCall(p, { jsonSchema: CHAPTER_OPTIONS_SCHEMA });
      setOpeningOptions(res?.options || []);
    } catch (e) {
      setError("Sinh mở màn lỗi: " + (e?.message || "lỗi"));
    } finally {
      setGenOpen(false);
    }
  };

  const applyOpening = (opt) => {
    setContent((prev) => (prev.trim() ? `${opt.trim()}\n\n${prev.trim()}` : opt.trim()));
    setQualityGate(null);
    setOpeningOptions(null);
    setStatusNote("Đã chèn mở màn vào đầu chương.");
  };

  const handleGenHook = async () => {
    if (!content.trim()) {
      setError("Hãy viết chương trước rồi mới sinh hook kết chương.");
      return;
    }
    setError("");
    setHookOptions(null);
    setGenHook(true);
    try {
      const p = buildHookPrompt({ genre, chapterTitle: title, chapterContent: content, bibleText, beats: beatsApproved ? beats : undefined });
      const res = await aiCall(p, { jsonSchema: CHAPTER_OPTIONS_SCHEMA });
      setHookOptions(res?.options || []);
    } catch (e) {
      setError("Sinh hook lỗi: " + (e?.message || "lỗi"));
    } finally {
      setGenHook(false);
    }
  };

  const applyHook = (opt) => {
    setContent((prev) => (prev.trim() ? `${prev.trim()}\n\n${opt.trim()}` : opt.trim()));
    setQualityGate(null);
    setHookOptions(null);
    setStatusNote("Đã chèn hook vào cuối chương.");
  };

  const handleCheckRep = async () => {
    if (!content.trim()) {
      setError("Chưa có nội dung để kiểm tra.");
      return;
    }
    // Lấy tối đa 5 chương gần nhất có nội dung làm đối chiếu.
    const past = [];
    for (const c of chapters) {
      if (c.id === activeId) continue;
      if (past.length >= 5) break;
      try {
        const row = await getChapter(c.id);
        if (row?.content?.trim()) past.push(row);
      } catch { /* skip */ }
    }
    if (!past.length) {
      setError("Chưa có chương nào khác để so sánh — viết thêm chương rồi kiểm tra lại.");
      return;
    }
    setError("");
    setRepIssues(null);
    setCheckingRep(true);
    try {
      const prompt = buildRepetitionCheckPrompt({ genre, chapterContent: content, pastChapters: past });
      const res = await aiCall(prompt, { jsonSchema: REPETITION_CHECK_SCHEMA });
      setRepIssues(res?.issues || []);
    } catch (e) {
      setError("Kiểm tra đạo nhại lỗi: " + (e?.message || "lỗi"));
    } finally {
      setCheckingRep(false);
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
      setQualityGate(null);
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
        chapterContent: chapterRow?.content || content,
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
    const budget = getWordBudgetStatus(content, targetWords);
    if (!canPassQuality({ report: qualityGate, budget })) {
      setError(`Chưa thể lưu/pass: cần Quality Gate đạt, logic không có hard fail và độ dài trong ${budget.min}–${budget.max} từ (hiện ${budget.words}).`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      // Chụp lại bản CŨ trước khi ghi đè — chỉ khi nội dung thực sự đổi (tránh
      // snapshot rác mỗi lần bấm Lưu mà không đổi gì). Đây là lưới an toàn cho
      // "Viết 2 pass"/"Sửa theo góp ý" — 2 tính năng ghi đè TOÀN BỘ chương.
      if (activeId && originalContentRef.current.trim() && originalContentRef.current !== content) {
        try {
          await createChapterSnapshot(currentStoryId, activeId, {
            title, content: originalContentRef.current, chapterNumber: number === "" ? null : Number(number), label: "trước khi lưu đè",
          });
        } catch { /* không chặn lưu nếu snapshot lỗi */ }
      }
      const num = number === "" ? undefined : Number(number);
      const payload = { title, chapter_number: num, content };
      payload.outline_beats = encodeChapterPlan({ contract, scenes, beats, quality: qualityGate });
      let saved;
      if (activeId) {
        saved = await updateChapter(activeId, payload);
        originalContentRef.current = content;
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
      if (autoRollup && content.trim() && canPassQuality({ report: qualityGate, budget })) {
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

  // ---------- Lịch sử phiên bản chương ----------
  const loadSnapshots = async () => {
    if (!activeId) return;
    setHistoryLoading(true);
    try {
      setSnapshots((await listChapterSnapshots(activeId)) || []);
    } catch {
      setSnapshots([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleToggleHistory = () => {
    setHistoryOpen((o) => {
      const next = !o;
      if (next) loadSnapshots();
      return next;
    });
  };

  const handleRestoreSnapshot = async (snapId) => {
    setRestoring(true);
    try {
      const snap = await getChapterSnapshot(snapId);
      if (snap?.content != null) {
        setContent(snap.content);
        setQualityGate(null);
        setHistoryOpen(false);
        setStatusNote("Đã khôi phục bản cũ vào ô soạn thảo — bấm Lưu chương để áp dụng thật.");
      }
    } catch (e) {
      setError("Khôi phục snapshot lỗi: " + (e?.message || "lỗi"));
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteSnapshot = async (snapId) => {
    try {
      await deleteChapterSnapshot(snapId);
      setSnapshots((s) => s.filter((x) => x.id !== snapId));
    } catch (e) {
      setError("Xoá snapshot lỗi: " + (e?.message || "lỗi"));
    }
  };

  // ---------- Gợi ý mục tiêu chương tiếp theo (đọc đại cương + tóm tắt hiện tại) ----------
  const suggestNextGoal = async () => {
    setError("");
    setSuggestingGoal(true);
    try {
      const nextNum = activeId ? number : String((chapters?.[chapters.length - 1]?.chapter_number || 0) + 1);
      const res = await aiCall(
        buildNextChapterGoalPrompt({ genre, bibleText, prevTail: prevTail || autoPrevTail, nextChapterNumber: nextNum }),
        { jsonSchema: NEXT_CHAPTER_GOAL_SCHEMA }
      );
      if (res?.goal) setGoal(res.goal);
      setStatusNote(res?.reasoning ? `AI gợi ý mục tiêu — lý do: ${res.reasoning}` : "AI đã điền mục tiêu chương.");
    } catch (e) {
      setError("Gợi ý mục tiêu lỗi: " + (e?.message || "lỗi"));
    } finally {
      setSuggestingGoal(false);
    }
  };

  // ---------- Tự động viết chương tiếp theo (auto-pilot): tạo chương mới, gợi ý
  // mục tiêu → lên beats → viết → lưu, gộp lại thành 1 click cho tác giả viết
  // nhiều chương liên tục. Rollup vẫn để tác giả tự bấm sau (không tự ý sửa bible).
  const handleAutoPilotNext = async () => {
    setError("");
    setAutoPiloting(true);
    setAutoPilotStep("Đang chuẩn bị chương mới...");
    try {
      const lastChapter = chapters[chapters.length - 1];
      let lastContent = "";
      if (lastChapter) {
        try {
          const full = await getChapter(lastChapter.id);
          lastContent = full?.content || "";
        } catch { /* bỏ qua */ }
      }
      const nextNum = String((lastChapter?.chapter_number || 0) + 1);
      const tail = getLastWords(lastContent, 800);

      setAutoPilotStep("Đang gợi ý mục tiêu chương...");
      const goalRes = await aiCall(
        buildNextChapterGoalPrompt({ genre, bibleText, prevTail: tail, nextChapterNumber: nextNum }),
        { jsonSchema: NEXT_CHAPTER_GOAL_SCHEMA }
      );
      const nextGoal = goalRes?.goal || "";

      setAutoPilotStep("Planner đang lập contract + scene plan...");
      const planRes = await aiCall(buildChapterContractPrompt({ genre, chapterNumber: nextNum, chapterTitle: `Chương ${nextNum}`, chapterGoal: nextGoal, bibleText, prevTail: tail, targetWords }), { jsonSchema: CHAPTER_CONTRACT_SCHEMA });
      const nextContract = planRes?.contract;
      const nextScenes = planRes?.scenes || [];

      setAutoPilotStep("Continuity Editor đang kiểm trước viết...");
      const pre = await aiCall(buildLogicGatePrompt({ genre, phase: "pre", bibleText, contract: nextContract, scenes: nextScenes }), { jsonSchema: LOGIC_GATE_SCHEMA });
      if (!canWriteChapter({ contract: nextContract, scenes: nextScenes, preflight: pre })) throw new Error("Chapter plan không vượt qua hard gate logic/canon.");

      setAutoPilotStep("Đang viết chương...");
      const written = String(
        await aiCall(
          buildWriteChapterPrompt({
            genre, chapterTitle: "", chapterNumber: nextNum, chapterGoal: nextGoal, bibleText, prevTail: tail,
            orientation: "", beats: [], targetWords, overdueForeshadows, contract: nextContract, scenes: nextScenes,
          })
        ) || ""
      ).trim();

      setAutoPilotStep("Đang chạy Chapter Quality Gate...");
      const post = await aiCall(buildLogicGatePrompt({ genre, phase: "post", bibleText, contract: nextContract, scenes: nextScenes, chapterContent: written }), { jsonSchema: LOGIC_GATE_SCHEMA });
      if (!post?.passed) throw new Error("Bản thảo bị hard fail logic/canon; chưa lưu.");
      const quality = await aiCall(buildQualityGatePrompt({ genre, bibleText, contract: nextContract, scenes: nextScenes, chapterContent: written, targetWords }), { jsonSchema: QUALITY_GATE_SCHEMA });
      const budget = getWordBudgetStatus(written, targetWords);
      if (!canPassQuality({ report: quality, budget })) throw new Error(`Bản thảo chưa đạt Quality Gate hoặc ngoài ${budget.min}–${budget.max} từ; chưa lưu.`);

      setAutoPilotStep("Đang lưu chương...");
      const saved = await createChapter({
        story_id: currentStoryId,
        chapter_number: Number(nextNum),
        title: `Chương ${nextNum}`,
        content: written,
        outline_beats: encodeChapterPlan({ contract: nextContract, scenes: nextScenes, beats: [], quality }),
      });
      setChapters((cs) => [...cs.filter((c) => c.id !== saved.id), saved].sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0)));
      setActiveId(saved.id);
      setGoal(nextGoal);
      setContract(nextContract); setScenes(nextScenes); setPreflight(pre); setQualityGate(quality);
      onChapterWritten?.(saved);
      if (autoRollup) await runRollup({ ...saved, title: `Chương ${nextNum}`, content: written });
      setStatusNote(`Chương ${nextNum} đã vượt contract → logic gate → quality gate, được lưu và chuyển Canon Keeper cập nhật state.`);
    } catch (e) {
      setError("Tự động viết chương tiếp theo lỗi: " + (e?.message || "lỗi"));
    } finally {
      setAutoPilotStep("");
      setAutoPiloting(false);
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
          <button
            onClick={handleAutoPilotNext}
            disabled={autoPiloting || writing}
            title="Tự động: gợi ý mục tiêu + lên beats + viết + lưu chương kế tiếp — chỉ 1 lần bấm"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
          >
            {autoPiloting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
            {autoPiloting ? autoPilotStep || "Đang tự động viết..." : "Tự động viết chương tiếp"}
          </button>
          {activeId && (
            <button
              onClick={handleToggleHistory}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border text-xs hover:bg-muted"
              title="Lịch sử phiên bản chương (snapshot tự động trước mỗi lần AI ghi đè)"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          )}
          {activeId && (
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-destructive/40 text-destructive text-xs hover:bg-destructive/10"
            >
              Xoá
            </button>
          )}
        </div>

        {/* Lịch sử phiên bản chương */}
        {historyOpen && (
          <div className="px-4 py-2.5 border-b border-border bg-muted/10 max-h-44 overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <History className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold">Lịch sử phiên bản chương</span>
              <button onClick={loadSnapshots} disabled={historyLoading} className="ml-auto text-[10px] text-primary hover:underline disabled:opacity-50">
                {historyLoading ? "Đang tải..." : "Làm mới"}
              </button>
              <button onClick={() => setHistoryOpen(false)} className="p-0.5 text-muted-foreground hover:bg-muted rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {snapshots.length === 0 && (
              <p className="text-[10px] text-muted-foreground italic">
                Chưa có snapshot nào. Mỗi lần Lưu ghi đè nội dung khác, bản cũ sẽ tự động được chụp lại ở đây.
              </p>
            )}
            <ul className="space-y-1.5">
              {snapshots.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
                  <Camera className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium truncate">{s.label || "Snapshot"}</div>
                    <div className="text-[9px] text-muted-foreground">{new Date(s.created_at).toLocaleString("vi-VN")}</div>
                  </div>
                  <button
                    onClick={() => handleRestoreSnapshot(s.id)}
                    disabled={restoring}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-primary/40 text-primary text-[10px] hover:bg-primary/10 disabled:opacity-50"
                  >
                    {restoring ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Khôi phục
                  </button>
                  <button onClick={() => handleDeleteSnapshot(s.id)} className="p-1 text-muted-foreground hover:text-destructive text-[10px]" title="Xoá snapshot">
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

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
                onChange={(e) => { setTargetWords(e.target.value); setPreflight(null); setQualityGate(null); }}
                className="w-20 rounded-md border border-input bg-transparent px-2 py-1 text-xs text-foreground"
              />
              từ
            </label>
          </div>
          <div className="mt-1 flex items-start gap-1.5">
            <textarea
              value={goal}
              onChange={(e) => { setGoal(e.target.value); setPreflight(null); setQualityGate(null); }}
              rows={2}
              placeholder="VD: Nữ chính phát hiện thân phận thật của nam chính, đối chất, xảy ra hiểu lầm..."
              className="flex-1 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs resize-y"
            />
            <button
              onClick={suggestNextGoal}
              disabled={suggestingGoal}
              title="Chưa nghĩ ra mục tiêu? Để AI đọc đại cương + tóm tắt hiện tại rồi gợi ý"
              className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-md border border-primary/40 text-primary text-[10px] hover:bg-primary/10 disabled:opacity-50"
            >
              {suggestingGoal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />} Gợi ý
            </button>
          </div>
        </div>

        {/* Chapter Contract → Scene Plan → pre-write hard gate */}
        <div className="px-4 pt-2.5">
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold">1. Chapter Contract + Scene Plan</span>
              <button onClick={handlePlanContract} disabled={planningContract} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/40 text-primary text-[11px] hover:bg-primary/10 disabled:opacity-50">
                {planningContract ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} {contract ? "Lập lại" : "Planner lập kế hoạch"}
              </button>
              <button onClick={handlePreflight} disabled={runningPreflight || !contract || !scenes.length} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] disabled:opacity-50">
                {runningPreflight ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} 2. Kiểm logic trước viết
              </button>
            </div>
            {contract && <div className="mt-2 text-[11px]"><b>Cam kết:</b> {contract.promise} <span className="text-muted-foreground">· {scenes.length} cảnh</span></div>}
            {preflight && <div className={`mt-2 rounded-md px-2.5 py-2 text-[11px] ${preflight.passed ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
              <b>{preflight.passed ? "PASS — được phép viết" : "HARD FAIL — chưa được viết"}</b> · {preflight.summary}
              {(preflight.issues || []).map((x, i) => <div key={i}>• [{x.domain}] {x.problem}</div>)}
            </div>}
          </div>
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

        {/* Mở màn & Hook đa lựa chọn */}
        <div className="px-4 pt-2.5">
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold">Mở màn & Hook kết chương</span>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={handleGenOpening}
                  disabled={genOpen}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/40 text-primary text-[11px] hover:bg-primary/10 disabled:opacity-50"
                >
                  {genOpen ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DoorOpen className="w-3.5 h-3.5" />}
                  {genOpen ? "Đang sinh..." : "3 cách mở màn"}
                </button>
                <button
                  onClick={handleGenHook}
                  disabled={genHook}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/40 text-primary text-[11px] hover:bg-primary/10 disabled:opacity-50"
                >
                  {genHook ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
                  {genHook ? "Đang sinh..." : "3 hook kết chương"}
                </button>
              </div>
            </div>

            {openingOptions?.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {openingOptions.map((o, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2">
                    <span className="text-[10px] text-muted-foreground mt-0.5 shrink-0">Mở {i + 1}</span>
                    <p className="flex-1 text-[11px] leading-5 line-clamp-4 whitespace-pre-wrap">{o}</p>
                    <button
                      onClick={() => applyOpening(o)}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-primary/40 text-primary text-[10px] hover:bg-primary/10"
                    >
                      <Check className="w-3 h-3" /> Dùng
                    </button>
                  </div>
                ))}
              </div>
            )}
            {hookOptions?.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {hookOptions.map((o, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2">
                    <span className="text-[10px] text-muted-foreground mt-0.5 shrink-0">Hook {i + 1}</span>
                    <p className="flex-1 text-[11px] leading-5 line-clamp-4 whitespace-pre-wrap">{o}</p>
                    <button
                      onClick={() => applyHook(o)}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-primary/40 text-primary text-[10px] hover:bg-primary/10"
                    >
                      <Check className="w-3 h-3" /> Dùng
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
          <button
            onClick={handleWrite}
            disabled={writing || !canWriteChapter({ contract, scenes, preflight })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {writing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {writing ? writeStep || "Xưởng đang viết..." : "Viết chương bằng AI"}
          </button>
          <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer" title="Viết nháp → tự chấm điểm rubric → viết lại cho tốt hơn">
            <input
              type="checkbox"
              checked={qualityMode}
              onChange={(e) => setQualityMode(e.target.checked)}
              className="accent-primary"
            />
            <Gauge className="w-3.5 h-3.5" /> Viết 2 pass (tự đánh giá & viết lại)
          </label>
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
          <button
            onClick={handleCheckRep}
            disabled={checkingRep || !content.trim()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-primary/40 text-primary text-sm hover:bg-primary/10 disabled:opacity-50"
            title="Phát hiện câu lặp, tình tiết trùng, cấu trúc mở đầu/kết thúc giống hệt"
          >
            {checkingRep ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            Kiểm tra đạo nhại
          </button>
          <button onClick={handleQualityGate} disabled={runningQuality || !content.trim() || !contract} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-primary/40 text-primary text-sm hover:bg-primary/10 disabled:opacity-50">
            {runningQuality ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gauge className="w-4 h-4" />} Chapter Quality Gate
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
        {critique && (
          <div className="mx-4 mb-2 rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
              <Gauge className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-semibold">Điểm tổng biên tập (trước khi viết lại)</span>
            </div>
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(critique.scores || []).map((s, i) => (
                <div key={i} className="rounded-md border border-border p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium">{s.criterion}</span>
                    <span className={`text-[11px] font-bold ${(s.score || 0) >= 7 ? "text-emerald-600" : (s.score || 0) >= 5 ? "text-amber-600" : "text-destructive"}`}>
                      {s.score}/10
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{s.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {qualityGate && (() => {
          const budget = getWordBudgetStatus(content, targetWords);
          const passed = canPassQuality({ report: qualityGate, budget });
          return <div className={`mx-4 mb-2 rounded-xl px-3 py-2 text-xs ${passed ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
            <b>{passed ? "QUALITY PASS — có thể lưu" : qualityGate.stage === "logic" ? "LOGIC HARD FAIL" : "QUALITY FAIL"}</b>
            {qualityGate.score != null && qualityGate.stage !== "logic" ? ` · ${qualityGate.score}/10` : ""} · {budget.words}/{budget.target} từ (cho phép {budget.min}–{budget.max})
            <div>{qualityGate.summary}</div>
            {(qualityGate.issues || []).map((x, i) => <div key={i}>• [{x.domain}] {x.problem}</div>)}
            {!passed && <button onClick={handleRepairGate} disabled={repairingGate} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] disabled:opacity-50">{repairingGate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Tự sửa theo phiếu gate</button>}
          </div>;
        })()}

        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); setQualityGate(null); }}
          placeholder="Bản thảo chương — bấm 'Viết chương bằng AI' để Xưởng viết dựa trên toàn bộ bible..."
          className="flex-1 min-h-[360px] resize-y px-4 py-3 text-[15px] leading-7 bg-card focus:outline-none font-body"
        />

        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-border bg-muted/20">
          <span className="mr-auto text-[11px] text-muted-foreground">
            {content.trim() ? (() => { const b = getWordBudgetStatus(content, targetWords); return `${b.words} từ · mục tiêu ${b.min}–${b.max}${b.within ? " ✓" : ""}`; })() : "Bản nháp trống"}
          </span>
          <button
            onClick={handleSave}
            disabled={saving || rollingUp || !title.trim() || !canPassQuality({ report: qualityGate, budget: getWordBudgetStatus(content, targetWords) })}
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

        {repIssues !== null && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Copy className="w-4 h-4 text-primary" />
              <h3 className="font-display font-semibold text-sm">Kiểm tra đạo nhại / trùng lặp</h3>
            </div>
            <div className="mt-2 space-y-2">
              {repIssues.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-500/10 rounded-md px-3 py-2.5">
                  <CheckCircle2 className="w-4 h-4" /> Không phát hiện đạo nhại / trùng lặp giữa các chương.
                </div>
              ) : (
                repIssues.map((iss, i) => (
                  <div key={i} className="rounded-md px-3 py-2 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold">{iss.type || "Trùng lặp"}</span>
                        {iss.chapters ? <span className="opacity-70"> · {iss.chapters}</span> : null}
                        <div className="opacity-80 mt-0.5">{iss.problem}</div>
                        {iss.excerpt ? (
                          <div className="opacity-70 mt-0.5 text-[10px] italic border-l-2 border-amber-400 pl-2">"{iss.excerpt}"</div>
                        ) : null}
                        {iss.suggestion ? <div className="opacity-80 mt-0.5">→ {iss.suggestion}</div> : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
