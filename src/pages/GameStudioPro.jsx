// Xưởng Game Pro — PRO 0 (nền tảng) + PRO 1 (Game/Episode Planner).
//
// Đây là một lớp AUTHORING mới, độc lập với "Xưởng Game" cũ (src/pages/
// GameStudio.jsx) — không thay thế, không đổi hành vi, không đổi parser cũ.
// Người dùng soạn một "tài liệu Pro" tối giản (proModel.js), tài liệu này
// được biên dịch (proCompiler.js) thành đúng dữ liệu `{meta, nodes}` mà
// GamePlayer / ExportCenter hiện tại đã hiểu — nên "Chơi thử" và "Xuất bản"
// bên dưới dùng lại y nguyên hai component đó, không có runtime/engine thứ 2.
//
// Tab "Soạn" (PRO 0) vẫn chỉ hỗ trợ 1 cảnh mở đầu → 2 lựa chọn → 2 kết thúc —
// đủ để xác minh toàn bộ pipeline tạo/lưu/tải lại/sửa/biên dịch/chơi/xuất
// bản, KHÔNG đổi ở bước PRO 1 này.
//
// Tab "Kế hoạch" (PRO 1) thêm một lớp PLANNING phía trên: Ý tưởng tự nhiên →
// AI lập Game Plan + Episode Plan (proDoc.storyBlueprint, xem plannerModel.js
// /plannerAI.js/plannerValidator.js) — CHỈ là dữ liệu mô tả, chưa sinh
// scene/node graph thật, nên compileProGame() ở tab "Soạn"/"Chơi
// thử"/"Xuất bản" hoàn toàn không đọc tới nó. Mind map Pro, Scene Intent,
// Natural-Language-to-Rule, import kịch bản ngoài... vẫn CHƯA làm.
import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Rocket, Plus, ArrowLeft, Trash2, Loader2, Check, AlertTriangle, Circle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import GamePlayer from "@/components/game-studio/player/GamePlayer";
import ExportCenter from "@/components/game-studio/player/ExportCenter";
import { newEmptyProGame } from "@/lib/gameStudioPro/proModel";
import { compileProGame, compileProDocument } from "@/lib/gameStudioPro/proCompiler";
import { ensureGlobalState } from "@/lib/gameStudioPro/globalStateModel";
import { ensureMechanicsState } from "@/lib/gameStudioPro/mechanicsModel";
import { listProGames, getGame, createGame, updateGame, deleteGame } from "@/lib/worldcrud";
import PlannerIntro from "@/components/game-studio-pro/PlannerIntro";
import PlannerEditor from "@/components/game-studio-pro/PlannerEditor";
import SmartMindMap from "@/components/game-studio-pro/SmartMindMap";
import ProQaDashboard from "@/components/game-studio-pro/ProQaDashboard";
import { runProQa } from "@/lib/gameStudioPro/proQa";
import { deriveWorkflowState, INITIAL_SAVE_STATE, saveStateLabel, saveStateReducer, WORKFLOW_STEPS } from "@/lib/gameStudioPro/workflowState";
import { ensureProPresentation, updateProPresentation } from "@/lib/gameStudioPro/presentationModel";
import PresentationPicker from "@/components/game-studio-pro/PresentationPicker";

function WorkflowBar({ state, mode, onNavigate }) {
  return (
    <nav aria-label="Các bước làm game" className="overflow-x-auto [scrollbar-width:none]">
      <div className="flex min-w-max gap-1 py-2 px-4 md:justify-center">
        {WORKFLOW_STEPS.map((step) => {
          const active = mode === step.id || (mode === "plan" && step.id === state.currentStep && ["idea", "plan"].includes(step.id));
          const done = state.completed.has(step.id);
          const errors = state.errorSteps.get(step.id);
          return <button key={step.id} type="button" onClick={() => onNavigate(step.id)} aria-current={active ? "step" : undefined} className={`min-h-10 rounded-full border px-3 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/70 hover:bg-accent"}`}>
            {errors ? <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> : done ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Circle className="w-3 h-3" aria-hidden="true" />}
            {step.label}{errors ? ` ${errors}` : ""}
          </button>;
        })}
      </div>
    </nav>
  );
}

function ProGameLibrary({ onOpen }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  function load() {
    setLoading(true);
    listProGames()
      .then(setGames)
      .catch((e) => {
        toast({ variant: "destructive", title: "Không tải được danh sách Game Pro", description: e.message });
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const proDoc = newEmptyProGame();
      const { meta, nodes } = compileProGame(proDoc);
      const row = await createGame({ title: proDoc.title, meta, nodes });
      onOpen(row.id);
    } catch (e) {
      toast({ variant: "destructive", title: "Không tạo được Game Pro", description: e.message });
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!window.confirm("Xoá Game Pro này? Không thể hoàn tác.")) return;
    try {
      await deleteGame(id);
      setGames((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      toast({ variant: "destructive", title: "Không xoá được", description: err.message });
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
            <Rocket className="w-6 h-6 text-primary" /> Xưởng Game Pro
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Lập kế hoạch game bằng ý tưởng tự nhiên với AI — thư viện Game Pro riêng, tách biệt với Xưởng Game cũ.
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating}>
          {creating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
          Tạo Game Pro Mới
        </Button>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      ) : games.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
          Chưa có Game Pro nào. Bấm "Tạo Game Pro Mới" để bắt đầu.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((g) => (
            <button
              key={g.id}
              onClick={() => onOpen(g.id)}
              className="text-left rounded-2xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/40 transition group relative"
            >
              <h3 className="font-display font-semibold text-base pr-6 truncate">{g.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{g.node_count || 0} phân cảnh</p>
              <p className="text-[11px] text-muted-foreground mt-2">
                Cập nhật {g.updated_at ? new Date(g.updated_at).toLocaleString("vi-VN") : ""}
              </p>
              <span
                onClick={(e) => handleDelete(e, g.id)}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition"
                title="Xoá Game Pro"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProGameEditor({ gameId, onBack }) {
  const [proDoc, setProDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveState, dispatchSave] = useReducer(saveStateReducer, INITIAL_SAVE_STATE);
  const [mode, setMode] = useState("plan");
  const [playKey, setPlayKey] = useState(0);
  const [focusEpisodeId, setFocusEpisodeId] = useState(null);
  const [focusSceneId, setFocusSceneId] = useState(null);
  const [qaRevision, setQaRevision] = useState(0);
  // Bản xem trước riêng cho tab Xuất bản — ExportCenter cho phép "Import JSON"
  // để nạp lại 1 file đã xuất; nếu trỏ thẳng vào proDoc thì việc import đó sẽ
  // âm thầm ghi đè tài liệu Pro (nguồn thật) bằng dữ liệu đã biên dịch, làm 2
  // bên lệch nhau. Nên tách state xem trước này, KHÔNG lưu vào proDoc/DB.
  const [exportPreview, setExportPreview] = useState(null);
  const { toast } = useToast();
  // HOTFIX PRO 5 (FIX 2): bản {meta,nodes} biên dịch THÀNH CÔNG gần nhất —
  // "runtime snapshot" thật của game này. Khởi tạo từ chính hàng DB đã lưu
  // (đúng nghĩa "lần lưu thành công gần nhất"), rồi cập nhật mỗi khi
  // compileProDocument() thành công trong lúc soạn. handleSave() dùng bản này
  // để KHÔNG BAO GIỜ ghi đè runtime đã lưu bằng 1 bản PRO 0 giả khi campaign
  // đang lỗi (xem "Không được overwrite runtime snapshot bằng fake PRO0
  // output" trong yêu cầu hotfix).
  const lastGoodCompiledRef = useRef(null);
  // Tự lưu sau khi ngừng chỉnh sửa 1.2s, và lưu ngay khi thoát/đổi game nếu
  // còn thay đổi chưa lưu — cùng cơ chế với Xưởng Game thường (GameStudio.jsx),
  // để thoát trang giữa chừng không làm mất bản soạn.
  const saveTimerRef = useRef(null);
  const dirtyRef = useRef(false);
  const handleSaveRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    getGame(gameId)
      .then((row) => {
        // PRO 5: chuẩn hoá + (nếu cần) migrate registry PRO 3/4 cũ của từng
        // tập thành 1 registry canonical toàn game ngay khi mở — thuần, trong
        // bộ nhớ, không đổi gì trên server cho tới lần "Lưu" tiếp theo (giống
        // mọi chỉnh sửa khác trong Xưởng Game Pro).
        // PRO 6: game Pro cũ (trước PRO6) không có `mechanics`/`templateId` —
        // ensureMechanicsState() chuẩn hoá an toàn, cùng quy ước ensureGlobalState().
        const loaded = ensureGlobalState(row.meta?.pro || newEmptyProGame());
        setProDoc({ ...loaded, mechanics: ensureMechanicsState(loaded.mechanics), templateId: loaded.templateId || null, presentation: ensureProPresentation(loaded.presentation) });
        setFocusEpisodeId(loaded.storyBlueprint?.episodes?.[0]?.id || null);
        dispatchSave({ type: "saved", at: row.updated_at ? new Date(row.updated_at) : null });
        // "Lần lưu thành công gần nhất" trước khi ta chỉnh sửa gì — sàn an
        // toàn ban đầu cho lastGoodCompiledRef (xem handleSave()).
        lastGoodCompiledRef.current = { meta: row.meta || {}, nodes: row.nodes || {} };
      })
      .catch((e) => {
        toast({ variant: "destructive", title: "Không mở được Game Pro", description: e.message });
        onBack();
      })
      .finally(() => setLoading(false));
    return () => {
      clearTimeout(saveTimerRef.current);
      if (dirtyRef.current) {
        dirtyRef.current = false;
        handleSaveRef.current?.();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  async function handleSave() {
    dispatchSave({ type: "saving" });
    try {
      const { compiled, campaignError } = compileProDocument(proDoc);
      if (campaignError) {
        // FIX 2 — FAIL-CLOSED: campaign đang lỗi biên dịch. KHÔNG được lưu 1
        // bản PRO 0 giả làm như campaign đang hoạt động. Vẫn phải cho lưu tài
        // liệu authoring (proDoc mới nhất, kể cả bản lỗi — đúng yêu cầu
        // "không được mất khả năng lưu tài liệu authoring") nhưng runtime
        // snapshot (nodes + phần meta không phải `pro`) giữ nguyên bản biên
        // dịch tốt gần nhất, không bị ghi đè.
        const fallback = lastGoodCompiledRef.current;
        if (!fallback) {
          toast({
            variant: "destructive",
            title: "Không thể lưu — campaign chưa từng biên dịch thành công",
            description: `Sửa lỗi campaign (xem "Trạng thái campaign" ở tab Kế hoạch) rồi lưu lại. Lỗi: ${campaignError}`,
          });
          dispatchSave({ type: "error", error: campaignError });
          return;
        }
        await updateGame(gameId, {
          title: proDoc.title || "Game Pro Mới",
          meta: { ...fallback.meta, pro: proDoc },
          nodes: fallback.nodes,
        });
        dispatchSave({ type: "saved" });
        toast({
          variant: "destructive",
          title: "Đã lưu bản soạn — CHƯA cập nhật game chơi được",
          description: `Campaign đang lỗi biên dịch nên "Chơi thử"/"Xuất bản" vẫn dùng bản biên dịch tốt gần nhất cho tới khi bạn sửa lỗi và lưu lại. Lỗi: ${campaignError}`,
        });
        return;
      }
      const { meta, nodes } = compiled;
      await updateGame(gameId, { title: proDoc.title || "Game Pro Mới", meta, nodes });
      lastGoodCompiledRef.current = { meta, nodes };
      dispatchSave({ type: "saved" });
      setPlayKey((k) => k + 1);
    } catch (e) {
      dispatchSave({ type: "error", error: e.message });
      toast({ variant: "destructive", title: "Không lưu được", description: e.message });
    }
  }
  handleSaveRef.current = handleSave;

  function markDirty() {
    dispatchSave({ type: "dirty" });
    dirtyRef.current = true;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      dirtyRef.current = false;
      handleSaveRef.current?.();
    }, 1200);
  }

  function updateField(patch) {
    markDirty();
    setProDoc((prev) => ({ ...prev, ...patch }));
  }
  function updateChoice(index, patch) {
    markDirty();
    setProDoc((prev) => ({
      ...prev,
      choices: prev.choices.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }
  function updateEnding(index, patch) {
    markDirty();
    setProDoc((prev) => ({
      ...prev,
      endings: prev.endings.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    }));
  }

  // Must stay above the loading early-return to preserve React hook order.
  const qaResult = useMemo(() => runProQa(proDoc), [proDoc, qaRevision]);

  if (loading || !proDoc) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { compiled, campaignError } = compileProDocument(proDoc);
  // QA runs against the authoring source, before compiler normalization. It
  // is deterministic/local, so imported External-AI blueprints are included
  // automatically as soon as they are applied to proDoc.
  // Bất cứ lúc nào biên dịch THÀNH CÔNG trong phiên soạn này (kể cả chưa
  // lưu) đều nâng cấp "bản tốt gần nhất" — không chỉ sau khi bấm Lưu — để
  // handleSave() luôn có sàn an toàn mới nhất có thể khi campaign sau đó bị
  // làm hỏng (mục "Save Safety").
  if (compiled) lastGoodCompiledRef.current = { meta: compiled.meta, nodes: compiled.nodes };
  const compiledGameData = compiled ? { meta: compiled.meta, nodes: compiled.nodes } : null;
  const workflow = deriveWorkflowState(proDoc, qaResult, campaignError);
  const episodes = proDoc.storyBlueprint?.episodes || [];
  const currentEpisode = episodes.find((episode) => episode.id === focusEpisodeId) || episodes[0] || null;
  function navigate(nextMode) {
    if (nextMode === "idea") setMode("plan");
    else if (nextMode === "mechanics") setMode("plan");
    else setMode(nextMode);
  }
  function runNextAction() {
    if (workflow.nextAction.episodeId) setFocusEpisodeId(workflow.nextAction.episodeId);
    navigate(workflow.nextAction.mode);
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 glass-panel border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground shrink-0 min-h-10 min-w-10" aria-label="Quay lại thư viện" title="Quay lại thư viện">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-base leading-tight truncate">{proDoc.title || "Game Pro Mới"}</h1>
            <p role={saveState.status === "error" ? "alert" : "status"} className={`text-[11px] leading-tight ${saveState.status === "error" ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              {saveStateLabel(saveState)}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" className="hidden sm:inline-flex min-h-10" onClick={runNextAction}>{workflow.nextAction.label}</Button>
            <Button size="sm" className="min-h-10 min-w-10" aria-label="Lưu thay đổi" onClick={handleSave} disabled={saveState.status === "saving" || saveState.status === "saved"}>
              {saveState.status === "saving" ? <Loader2 className="w-4 h-4 sm:mr-1.5 animate-spin" /> : null}<span className="hidden sm:inline">Lưu</span>
            </Button>
          </div>
        </div>
        <WorkflowBar state={workflow} mode={mode} onNavigate={navigate} />
      </header>

      {saveState.status === "error" && <div role="alert" className="sticky top-[104px] z-30 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-center text-xs text-destructive">Không thể lưu thay đổi. Dữ liệu vẫn còn trên màn hình — hãy kiểm tra mạng và bấm Lưu lại. {saveState.error}</div>}

      {campaignError && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            Liên kết nhiều tập chưa hợp lệ — Chơi thử và Xuất game bị chặn cho tới khi sửa xong. Bản soạn vẫn được lưu an toàn nhưng bản chơi gần nhất không bị ghi đè. Chi tiết: {campaignError}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {episodes.length > 0 && !["play", "export"].includes(mode) && <section className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2">
          <div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tập đang chỉnh</p><p className="font-semibold text-sm truncate">Tập {currentEpisode?.order} — {currentEpisode?.title}</p></div>
          <label className="relative sm:max-w-xs"><span className="sr-only">Chuyển tập</span><select value={currentEpisode?.id || ""} onChange={(event) => { setFocusEpisodeId(event.target.value); setFocusSceneId(null); }} className="min-h-10 w-full appearance-none rounded-lg border bg-background pl-3 pr-9 text-sm"><option value="" disabled>Chọn tập</option>{episodes.map((episode) => <option key={episode.id} value={episode.id}>Tập {episode.order} — {episode.title}{episode.sceneBlueprint?.scenes?.length ? " · Đã có sơ đồ" : " · Chưa có sơ đồ"}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 w-4 h-4 text-muted-foreground" /></label>
        </section>}
        {mode === "plan" && (
          proDoc.storyBlueprint?.gamePlan ? (
            <PlannerEditor
              storyBlueprint={proDoc.storyBlueprint}
              onChange={(storyBlueprint) => updateField({ storyBlueprint })}
              onOpenBlueprint={(episodeId) => { setFocusEpisodeId(episodeId); setMode("mindmap"); }}
              globalState={proDoc.globalState}
              onGlobalStateChange={(globalState) => updateField({ globalState })}
              mechanics={proDoc.mechanics}
              onMechanicsChange={(mechanics) => updateField({ mechanics })}
              proDoc={proDoc}
              onProDocChange={(next) => { markDirty(); setProDoc(next); }}
            />
          ) : (
            <PlannerIntro
              storyBlueprint={proDoc.storyBlueprint}
              onGenerated={(storyBlueprint) => updateField({ storyBlueprint })}
              onSkip={() => setMode("edit")}
              proDoc={proDoc}
              onProDocChange={(next) => { markDirty(); setProDoc(next); }}
            />
          )
        )}

        {mode === "mindmap" && (
          <SmartMindMap
            storyBlueprint={proDoc.storyBlueprint}
            onChange={(storyBlueprint) => updateField({ storyBlueprint })}
            initialEpisodeId={focusEpisodeId}
            initialSceneId={focusSceneId}
            globalState={proDoc.globalState}
            onGlobalStateChange={(globalState) => updateField({ globalState })}
            mechanics={proDoc.mechanics}
            templateId={proDoc.templateId}
            presentation={proDoc.presentation}
          />
        )}

        {mode === "qa" && <ProQaDashboard result={qaResult} episodes={proDoc.storyBlueprint?.episodes || []} onRerun={() => setQaRevision((v) => v + 1)} onLocate={(issue) => { setFocusEpisodeId(issue.episodeId); setFocusSceneId(issue.sceneId); setMode("mindmap"); }} onPlay={() => setMode("play")} />}

        {mode === "edit" && (
          <div className="space-y-4">
            <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-2">
              <Label>Tên game</Label>
              <Input value={proDoc.title} onChange={(e) => updateField({ title: e.target.value })} />
            </section>

            <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-2">
              <Label>Cảnh mở đầu</Label>
              <Textarea
                rows={4}
                value={proDoc.startScene.text}
                onChange={(e) => updateField({ startScene: { text: e.target.value } })}
              />
            </section>

            {proDoc.choices.map((c, i) => (
              <section key={i} className="glass-card rounded-2xl p-4 sm:p-5 space-y-2">
                <Label>Lựa chọn {i === 0 ? "A" : "B"} (dẫn tới Kết {i === 0 ? "A" : "B"})</Label>
                <Input value={c.text} onChange={(e) => updateChoice(i, { text: e.target.value })} />
              </section>
            ))}

            {proDoc.endings.map((e, i) => (
              <section key={e.id} className="glass-card rounded-2xl p-4 sm:p-5 space-y-2">
                <Label>Kết thúc {i === 0 ? "A" : "B"} — tiêu đề</Label>
                <Input value={e.title} onChange={(ev) => updateEnding(i, { title: ev.target.value })} />
                <Label>Nội dung</Label>
                <Textarea rows={3} value={e.text} onChange={(ev) => updateEnding(i, { text: ev.target.value })} />
              </section>
            ))}
          </div>
        )}

        {mode === "play" && (
          <div className="space-y-4">
            <PresentationPicker value={proDoc.presentation} onChange={(presentation) => { markDirty(); setProDoc((previous) => updateProPresentation(previous, presentation)); }} />
            {campaignError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
                Chưa thể chơi thử — liên kết giữa các tập còn lỗi. Sửa ở Kế hoạch hoặc Sơ đồ rồi quay lại đây.
                <p className="mt-2 text-xs opacity-80">Lỗi: {campaignError}</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden border border-border" style={{ minHeight: "70vh" }}>
                <GamePlayer key={playKey} gameData={compiledGameData} gameKey={gameId} onExit={() => setMode("edit")} />
              </div>
            )}
          </div>
        )}

        {mode === "export" && (
          campaignError || qaResult.blocking ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
              Chưa thể xuất game — {campaignError ? "liên kết giữa các tập còn lỗi" : `còn ${qaResult.summary.error} lỗi phải sửa`}. Mở Kiểm tra để xem vị trí và gợi ý sửa.
              {campaignError && <p className="mt-2 text-xs opacity-80">Lỗi: {campaignError}</p>}
            </div>
          ) : (
            <ExportCenter gameData={exportPreview || compiledGameData} setGameData={setExportPreview} />
          )
        )}
      </div>
    </div>
  );
}

export default function GameStudioPro() {
  const [activeGameId, setActiveGameId] = useState(null);

  if (activeGameId) {
    return <ProGameEditor gameId={activeGameId} onBack={() => setActiveGameId(null)} />;
  }
  return <ProGameLibrary onOpen={setActiveGameId} />;
}
