// Xưởng Game Pro — PRO 2: Smart Mind Map — sơ đồ cảnh CỦA MỘT TẬP đã duyệt.
// Nguồn thật là episode.sceneBlueprint (blueprintModel.js), KHÔNG phải node
// graph runtime — xem compileEpisodeBlueprint (proCompiler.js) cho hướng
// biên dịch 1 chiều blueprint -> nodes. Cố tình KHÔNG tái dùng
// MindMapTab/useMapCanvas (bản pan/zoom SVG của Xưởng Game cũ, gắn chặt vào
// node graph runtime + trường kỹ thuật) — đây là 1 renderer MỚI, đơn giản
// hơn (cột theo độ sâu, không phải canvas tự do), đủ để người dùng "nhìn
// graph và hiểu được đường đi" mà không phải viết lại toàn bộ map engine.
import React, { useEffect, useMemo, useState } from "react";
import { Plus, Sparkles, Loader2, PlayCircle, AlertTriangle, XCircle, Lock, Flag, X, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import GamePlayer from "@/components/game-studio/player/GamePlayer";
import {
  SCENE_ROLES,
  SCENE_ROLE_LABELS,
  newSceneBlueprint,
  addScene,
  removeScene,
  countIncoming,
  addEnding,
  updateEnding,
  removeEnding,
} from "@/lib/gameStudioPro/blueprintModel";
import { validateSceneBlueprint } from "@/lib/gameStudioPro/blueprintValidator";
import { generateEpisodeBlueprint, regenerateScene, getBlueprintScaleStatus, continueEpisodeBlueprint, refreshBlueprintEffects } from "@/lib/gameStudioPro/blueprintAI";
import { compileEpisodeBlueprint } from "@/lib/gameStudioPro/proCompiler";
import { syncRegistryToAllEpisodes, applyEpisodeBlueprint } from "@/lib/gameStudioPro/globalStateModel";
import SceneIntentEditor from "./SceneIntentEditor";
import ExternalAiBridgeModal from "./ExternalAiBridgeModal";
import { derivePlanningConstraints } from "@/lib/gameStudioPro/planningConstraints";

const ROLE_STYLES = {
  [SCENE_ROLES.STORY]: "border-sky-400/50 bg-sky-500/10",
  [SCENE_ROLES.DECISION]: "border-violet-400/50 bg-violet-500/10",
  [SCENE_ROLES.CONSEQUENCE]: "border-amber-400/50 bg-amber-500/10",
  [SCENE_ROLES.CONDITION]: "border-teal-400/50 bg-teal-500/10",
  [SCENE_ROLES.DANGER]: "border-red-400/50 bg-red-500/10",
  [SCENE_ROLES.SIDE]: "border-fuchsia-400/50 bg-fuchsia-500/10",
  [SCENE_ROLES.CONVERGENCE]: "border-emerald-400/50 bg-emerald-500/10",
  [SCENE_ROLES.ENDING]: "border-zinc-400/50 bg-zinc-500/10",
};

// Cột theo độ sâu (BFS từ start scene) — chỉ để XẾP HÌNH cho dễ nhìn, không
// phải dữ liệu lưu trữ. Cảnh không tới được xếp riêng cột cuối "Mồ côi".
function groupScenesByDepth(blueprint) {
  const byId = new Map(blueprint.scenes.map((s) => [s.id, s]));
  const depth = new Map();
  if (blueprint.startSceneId && byId.has(blueprint.startSceneId)) {
    const queue = [blueprint.startSceneId];
    depth.set(blueprint.startSceneId, 0);
    while (queue.length) {
      const id = queue.shift();
      const scene = byId.get(id);
      for (const c of scene.choices) {
        if (c.targetType === "scene" && byId.has(c.targetId) && !depth.has(c.targetId)) {
          depth.set(c.targetId, depth.get(id) + 1);
          queue.push(c.targetId);
        }
      }
    }
  }
  const columns = [];
  const orphans = [];
  for (const scene of blueprint.scenes) {
    const d = depth.get(scene.id);
    if (d === undefined) { orphans.push(scene); continue; }
    columns[d] = columns[d] || [];
    columns[d].push(scene);
  }
  return { columns: columns.filter(Boolean), orphans };
}

function SceneCard({ blueprint, scene, isStart, onOpen, onDelete }) {
  const incoming = countIncoming(blueprint, scene.id);
  const conditions = scene.choices.reduce((count, choice) => count + (choice.rules?.conditions?.length || 0) + (choice.conditionalOutcomes || []).reduce((sum, branch) => sum + (branch.conditions?.length || 0), 0), 0);
  return (
    <div className={`rounded-xl border p-3 space-y-1.5 ${ROLE_STYLES[scene.role] || ROLE_STYLES[SCENE_ROLES.STORY]}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isStart && <Flag className="w-3.5 h-3.5 shrink-0 text-primary" title="Cảnh bắt đầu" />}
          {scene.locked && <Lock className="w-3 h-3 shrink-0 text-amber-500" />}
          <span className="font-semibold text-sm truncate">{scene.title || "(chưa đặt tên)"}</span>
        </div>
        <button type="button" onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive shrink-0" title="Xoá cảnh">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <Badge variant="secondary" className="text-[10px]">{SCENE_ROLE_LABELS[scene.role]}</Badge>
      <p className="text-xs text-muted-foreground line-clamp-3">{scene.intent || "(chưa có ý đồ cảnh)"}</p>
      <div className="text-[11px] space-y-0.5">
        {scene.role === SCENE_ROLES.ENDING ? (
          <p className="text-muted-foreground italic">Kết thúc — không có lựa chọn.</p>
        ) : scene.choices.length === 0 ? (
          <p className="text-amber-600">Chưa có lựa chọn/kết nối.</p>
        ) : (
          scene.choices.map((c, i) => {
            const targetScene = c.targetType === "scene" ? blueprint.scenes.find((s) => s.id === c.targetId) : null;
            const targetEnding = c.targetType === "ending" ? (blueprint.endings || []).find((e) => e.id === c.targetId) : null;
            const label = targetScene?.title || targetEnding?.title;
            return (
              <p key={c.id} className="truncate text-muted-foreground">
                {String.fromCharCode(65 + i)}. {c.text || "(đi tiếp)"} → {label ? (targetEnding?.tone === "death" ? `☠ ${label}` : label) : <span className="text-destructive">chưa nối</span>}
              </p>
            );
          })
        )}
      </div>
      <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground/80"><span>{scene.choices.length} lựa chọn</span><span aria-hidden="true">·</span><span>{conditions ? `${conditions} điều kiện` : "Không có điều kiện"}</span><span aria-hidden="true">·</span><span>{incoming} lối vào</span></div>
      <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={onOpen}>Thiết kế cảnh</Button>
    </div>
  );
}

function EndingsPanel({ blueprint, onBlueprintChange }) {
  const endings = blueprint.endings || [];
  return (
    <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Kết thúc ({endings.length})</span>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onBlueprintChange(addEnding(blueprint, { title: "Kết thúc mới" }))}>
          <Plus className="w-3 h-3 mr-1" /> Thêm kết thúc
        </Button>
      </div>
      {endings.map((e) => (
        <div key={e.id} className="rounded-lg border border-border p-2 space-y-1.5">
          <div className="flex gap-1.5">
            <Input className="h-8 text-xs flex-1" value={e.title} onChange={(ev) => onBlueprintChange(updateEnding(blueprint, e.id, { title: ev.target.value }))} />
            <Select value={e.tone} onValueChange={(v) => onBlueprintChange(updateEnding(blueprint, e.id, { tone: v }))}>
              <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="neutral">Bình thường</SelectItem>
                <SelectItem value="good">Tốt</SelectItem>
                <SelectItem value="bad">Xấu</SelectItem>
                <SelectItem value="death">☠ Chết</SelectItem>
              </SelectContent>
            </Select>
            <button type="button" onClick={() => onBlueprintChange(removeEnding(blueprint, e.id))} className="p-1.5 text-muted-foreground hover:text-destructive">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <Textarea rows={2} className="text-xs" placeholder="Mô tả ngắn" value={e.text} onChange={(ev) => onBlueprintChange(updateEnding(blueprint, e.id, { text: ev.target.value }))} />
        </div>
      ))}
    </div>
  );
}

export default function SmartMindMap({ storyBlueprint, onChange, initialEpisodeId, initialSceneId, globalState, onGlobalStateChange, mechanics, templateId, presentation }) {
  const episodes = storyBlueprint?.episodes || [];
  const [selectedId, setSelectedId] = useState(initialEpisodeId || episodes[0]?.id || null);
  const [editingSceneId, setEditingSceneId] = useState(initialSceneId || null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [pending, setPending] = useState(null); // { blueprint, isRegenerate }
  const [playtesting, setPlaytesting] = useState(false);
  const [aiBridgeOpen, setAiBridgeOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (initialEpisodeId && episodes.some((item) => item.id === initialEpisodeId)) setSelectedId(initialEpisodeId); }, [initialEpisodeId, episodes]);
  useEffect(() => { if (initialSceneId) setEditingSceneId(initialSceneId); }, [initialSceneId]);
  // Bản nháp AI (pending) trước đây chỉ sống trong state cục bộ — dựng xong
  // 30 cảnh (kể cả sau nhiều vòng "Tiếp tục phần còn thiếu", tốn quota AI
  // thật) mà CHƯA bấm "Áp dụng" thì thoát màn hình/đổi tập/tải lại trang là
  // mất sạch, quay về "chưa có sơ đồ" y như chưa dựng gì. Nạp lại đúng bản
  // nháp đã lưu của tập đang chọn (nếu có) mỗi khi đổi tập/mở lại màn hình.
  useEffect(() => {
    setPending(episodes.find((e) => e.id === selectedId)?.pendingBlueprint || null);
  }, [selectedId]);

  const episode = episodes.find((e) => e.id === selectedId) || null;
  const blueprint = episode?.sceneBlueprint || null;
  const gamePlan = storyBlueprint?.gamePlan || null;

  const knownEpisodeIds = useMemo(() => new Set(episodes.map((e) => e.id)), [episodes]);
  const episodesById = useMemo(() => Object.fromEntries(episodes.map((e) => [e.id, e])), [episodes]);
  const otherEpisodes = useMemo(() => episodes.filter((e) => e.id !== selectedId), [episodes, selectedId]);

  const validation = useMemo(
    () => (blueprint ? validateSceneBlueprint(blueprint, { knownEpisodeIds, planningConstraints: episode?.planningConstraints || storyBlueprint.planningConstraints }) : { errors: [], warnings: [] }),
    [blueprint, knownEpisodeIds, episode?.planningConstraints, storyBlueprint.planningConstraints]
  );
  const grouped = useMemo(() => (blueprint ? groupScenesByDepth(blueprint) : { columns: [], orphans: [] }), [blueprint]);

  // HOTFIX PRO 5: funnel DUY NHẤT ghi blueprint vào 1 episode — MỌI nơi gọi
  // (applyPending/handleRegenerateScene/handleAddScene/handleDeleteScene/"Tạo
  // sơ đồ trống"/EndingsPanel/SceneIntentEditor/ExternalAiBridgeModal đều gọi
  // qua đây) tự động được ép registry của blueprint về đúng canonical
  // globalState.registry — không caller nào tự nhớ sync (globalStateModel.js
  // #applyEpisodeBlueprint).
  function setEpisodeBlueprint(nextBlueprint) {
    const result = applyEpisodeBlueprint(storyBlueprint, globalState, episode.id, nextBlueprint);
    onGlobalStateChange(result.globalState);
    onChange(result.storyBlueprint);
  }

  // PRO 5: registry CANONICAL sống ở globalState (globalStateModel.js) —
  // mirror ngay vào MỌI episode.sceneBlueprint.registry để mọi nơi đọc
  // blueprint.registry cũ (compileEpisodeBlueprint, ExternalAiBridgeModal...)
  // tự động thấy đúng dữ liệu canonical, không cần sửa.
  function handleGlobalRegistryChange(nextRegistry) {
    onGlobalStateChange({ ...globalState, registry: nextRegistry });
    onChange(syncRegistryToAllEpisodes(storyBlueprint, nextRegistry));
  }

  function patchEpisode(patch) {
    if (!episode) return;
    onChange({ ...storyBlueprint, episodes: episodes.map((e) => (e.id === episode.id ? { ...e, ...patch } : e)) });
  }

  // Đổi `pending` VÀ lưu ngay vào tập đang chọn (đi qua autosave chung của
  // ProGameEditor) — dùng thay setPending() trực tiếp ở MỌI nơi để bản nháp
  // AI không còn chỉ sống trong bộ nhớ tạm (xem effect nạp lại pendingBlueprint
  // ở trên).
  function commitPending(updater) {
    const resolved = typeof updater === "function" ? updater(pending) : updater;
    setPending(resolved);
    patchEpisode({ pendingBlueprint: resolved });
  }

  // ~30 cảnh dài, đúng văn phong người dùng yêu cầu (tả tâm lý/đối thoại đủ
  // dài, không cụt) rất dễ vượt ngân sách token của 1 lượt gọi AI — model
  // thường tự dừng sớm (vd 21/30) dù JSON vẫn hợp lệ (không phải lỗi/crash).
  // Trước đây người dùng phải tự nhận ra cảnh báo "thiếu cảnh" rồi bấm "Tiếp
  // tục phần còn thiếu" — thường phải bấm lặp lại nhiều lần. Tự động lặp vài
  // vòng "tiếp tục" (rẻ hơn dựng lại từ đầu — mỗi vòng chỉ xin đúng phần
  // thiếu) ngay trong 1 lượt "Dựng sơ đồ tập"; nếu vẫn chưa đủ sau
  // MAX_AUTO_CONTINUE_ROUNDS, nút "Tiếp tục phần còn thiếu"/"Thử tạo lại" thủ
  // công vẫn còn đó để người dùng tự quyết tiếp.
  const MAX_AUTO_CONTINUE_ROUNDS = 3;
  async function fillUntilTarget(generationEpisode, startBlueprint) {
    let next = startBlueprint;
    let scale = getBlueprintScaleStatus(next, generationEpisode);
    let round = 0;
    while (scale.underGenerated && round < MAX_AUTO_CONTINUE_ROUNDS) {
      round += 1;
      setProgress(`Chưa đủ cảnh (${scale.meaningfulSceneCount}/${generationEpisode.planningConstraints.targetSceneCount}) — đang tự bổ sung (vòng ${round}/${MAX_AUTO_CONTINUE_ROUNDS})...`);
      try {
        next = await continueEpisodeBlueprint(generationEpisode, gamePlan, next);
        scale = getBlueprintScaleStatus(next, generationEpisode);
      } catch (e) {
        // Dừng vòng lặp tự động nhưng KHÔNG ném lỗi ra ngoài — giữ lại mọi
        // cảnh đã bổ sung thành công tới vòng trước, không mất công đã làm.
        toast({ variant: "destructive", title: "Tự động bổ sung bị dừng giữa chừng", description: e.message });
        break;
      }
    }
    return { blueprint: next, scale };
  }

  async function handleGenerate(forceRefresh = false) {
    if (!episode) return;
    const generationEpisode = { ...episode, planningConstraints: episode.planningConstraints || storyBlueprint.planningConstraints || derivePlanningConstraints(storyBlueprint.idea, episode.stages) };
    setGenerating(true);
    try {
      const first = await generateEpisodeBlueprint(generationEpisode, gamePlan, blueprint, { forceRefresh });
      const { blueprint: next, scale } = await fillUntilTarget(generationEpisode, first);
      commitPending({ blueprint: next, isRegenerate: !!blueprint, scale, targetSceneCount: generationEpisode.planningConstraints.targetSceneCount, allowUnderGenerated: false });
    } catch (e) {
      toast({ variant: "destructive", title: "Không dựng được sơ đồ", description: e.message });
    } finally {
      setGenerating(false);
      setProgress("");
    }
  }

  function applyPending() {
    if (pending.scale?.underGenerated && !pending.allowUnderGenerated) return;
    const constraints = episode.planningConstraints || storyBlueprint.planningConstraints || derivePlanningConstraints(storyBlueprint.idea, episode.stages);
    // Chấm lại hệ quả theo danh mục MỚI NHẤT trước khi kiểm tra — nếu người
    // dùng vừa thêm entity còn thiếu vào "Chỉ số & trạng thái" sau khi AI dựng
    // sơ đồ, bản nháp phải nhận ra ngay (không cần dựng lại, tốn thêm AI).
    const refreshedBlueprint = refreshBlueprintEffects(pending.blueprint, globalState?.registry);
    const previewValidation = validateSceneBlueprint(refreshedBlueprint, { knownEpisodeIds, planningConstraints: constraints });
    if (previewValidation.errors.length) {
      commitPending((value) => (value ? { ...value, blueprint: refreshedBlueprint } : value));
      toast({ variant: "destructive", title: "Bản xem trước chưa hợp lệ", description: previewValidation.errors[0] });
      return;
    }
    // Áp dụng sceneBlueprint THẬT và xoá pendingBlueprint trong CÙNG 1 lần ghi
    // storyBlueprint — gọi setEpisodeBlueprint() rồi commitPending(null) riêng
    // rẽ sẽ dùng 2 bản `storyBlueprint` cũ (đóng băng lúc hàm này bắt đầu
    // chạy) khác nhau, lần ghi sau đè mất chính sceneBlueprint vừa áp dụng.
    const result = applyEpisodeBlueprint(storyBlueprint, globalState, episode.id, refreshedBlueprint);
    onGlobalStateChange(result.globalState);
    onChange({
      ...result.storyBlueprint,
      episodes: result.storyBlueprint.episodes.map((e) => (e.id === episode.id ? { ...e, pendingBlueprint: null } : e)),
    });
    setPending(null);
    toast({ title: "Đã áp dụng sơ đồ" });
  }

  async function handleContinueMissing() {
    const generationEpisode = { ...episode, planningConstraints: episode.planningConstraints || storyBlueprint.planningConstraints || derivePlanningConstraints(storyBlueprint.idea, episode.stages) };
    setGenerating(true);
    try {
      const { blueprint: next, scale } = await fillUntilTarget(generationEpisode, pending.blueprint);
      commitPending((value) => ({ ...value, blueprint: next, scale, allowUnderGenerated: false }));
    } finally {
      setGenerating(false);
      setProgress("");
    }
  }

  async function handleRegenerateScene(sceneId, instructionText) {
    const next = await regenerateScene(blueprint, episode, gamePlan, sceneId, instructionText);
    setEpisodeBlueprint(next);
    toast({ title: "Đã thiết kế lại cảnh" });
  }

  function handleAddScene() {
    const next = addScene(blueprint, SCENE_ROLES.STORY, { title: "Cảnh mới" });
    setEpisodeBlueprint(next);
    setEditingSceneId(next.scenes[next.scenes.length - 1].id);
  }

  function handleDeleteScene(sceneId) {
    if (sceneId === blueprint.startSceneId) {
      toast({ variant: "destructive", title: "Không thể xoá", description: "Đây là cảnh bắt đầu của tập." });
      return;
    }
    const incoming = countIncoming(blueprint, sceneId);
    if (incoming > 0 && !window.confirm(`Cảnh này đang có ${incoming} lựa chọn khác trỏ tới. Xoá vẫn tiếp tục — các lựa chọn đó sẽ mất kết nối. Tiếp tục?`)) return;
    setEpisodeBlueprint(removeScene(blueprint, sceneId));
  }

  let compiledPreview = null;
  let compileError = "";
  if (playtesting && blueprint) {
    try {
      compiledPreview = compileEpisodeBlueprint(blueprint, { title: episode.title, episodesById, presentation });
    } catch (e) {
      compileError = e.message;
    }
  }

  if (episodes.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm"><p>Game chưa có tập nào.</p><p className="mt-1">Quay lại Kế hoạch để tạo tập đầu tiên.</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground shrink-0">Tập:</span>
            <Select value={selectedId || ""} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full sm:w-64 min-h-10"><SelectValue placeholder="Chọn tập..." /></SelectTrigger>
              <SelectContent>
                {episodes.map((e) => (
                  <SelectItem key={e.id} value={e.id}>Tập {e.order} — {e.title}{e.sceneBlueprint ? "" : " (chưa có sơ đồ)"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
            <Button size="sm" variant="outline" onClick={() => setAiBridgeOpen(true)} disabled={!episode}>
              <Bot className="w-3.5 h-3.5 mr-1.5" /> Viết bằng AI bên ngoài
            </Button>
            {blueprint && (
              <Button size="sm" variant="outline" onClick={handleAddScene}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Thêm cảnh
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => handleGenerate(false)} disabled={generating || !episode}>
              {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
              {blueprint ? "Dựng lại sơ đồ tập" : "Dựng sơ đồ tập"}
            </Button>
            {blueprint && (
              <Button size="sm" onClick={() => setPlaytesting(true)} disabled={validation.errors.length > 0}>
                <PlayCircle className="w-3.5 h-3.5 mr-1.5" /> Chơi thử tập này
              </Button>
            )}
          </div>
        </div>

        {generating && progress && <p className="text-xs text-muted-foreground">{progress}</p>}

        {(validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
            {validation.errors.map((e, i) => (
              <p key={`e${i}`} className="text-xs text-destructive flex items-start gap-1.5"><XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{e}</p>
            ))}
            {validation.warnings.map((w, i) => (
              <p key={`w${i}`} className="text-xs text-muted-foreground flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{w}</p>
            ))}
          </div>
        )}
      </div>

      {pending && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-2.5">
          <div className="flex min-w-0 flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <span className="min-w-0 break-words text-sm font-semibold">Xem trước sơ đồ AI vừa dựng ({pending.scale?.meaningfulSceneCount ?? pending.blueprint.scenes.length} cảnh có ý nghĩa, {pending.blueprint.endings.length} kết thúc) — chưa áp dụng</span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => commitPending(null)}>Huỷ</Button>
              {pending.scale?.underGenerated && <Button size="sm" variant="outline" onClick={handleContinueMissing} disabled={generating}>Tiếp tục phần còn thiếu</Button>}
              {pending.scale?.underGenerated && <Button size="sm" variant="outline" onClick={() => handleGenerate(true)} disabled={generating}>Thử tạo lại</Button>}
              <Button size="sm" onClick={applyPending} disabled={pending.scale?.underGenerated && !pending.allowUnderGenerated}>Áp dụng</Button>
            </div>
          </div>
          {pending.scale?.underGenerated && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p>Kế hoạch yêu cầu khoảng {pending.targetSceneCount} cảnh nhưng AI mới dựng {pending.scale.meaningfulSceneCount} cảnh.</p>
              <button type="button" className="mt-2 text-xs text-muted-foreground underline" onClick={() => commitPending((value) => ({ ...value, allowUnderGenerated: true }))}>Nâng cao: vẫn áp dụng bản thiếu</button>
            </div>
          )}
          <div className="max-h-56 overflow-y-auto space-y-1 text-xs">
            {pending.blueprint.scenes.map((s) => (
              <p key={s.id} className="text-muted-foreground">
                <Badge variant="secondary" className="text-[10px] mr-1.5">{SCENE_ROLE_LABELS[s.role]}</Badge>
                {s.title || "(chưa đặt tên)"}{s.id === pending.blueprint.startSceneId ? " · bắt đầu" : ""}
              </p>
            ))}
          </div>
        </div>
      )}

      {!blueprint && !pending && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm space-y-2">
          <p>Tập này chưa có sơ đồ cảnh.</p>
          <p>Dựng từ kế hoạch bằng AI, nhập kịch bản từ AI bên ngoài, hoặc bắt đầu thủ công.</p>
          <div className="flex flex-wrap justify-center gap-2"><Button size="sm" onClick={() => handleGenerate(false)}><Sparkles className="w-3.5 h-3.5 mr-1.5" />Dựng từ kế hoạch</Button><Button size="sm" variant="outline" onClick={() => setAiBridgeOpen(true)}><Bot className="w-3.5 h-3.5 mr-1.5" />Nhập từ AI bên ngoài</Button><Button size="sm" variant="ghost" onClick={() => setEpisodeBlueprint(newSceneBlueprint(episode))}><Plus className="w-3.5 h-3.5 mr-1.5" />Bắt đầu thủ công</Button></div>
        </div>
      )}

      {blueprint && (
        <div className="space-y-4">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {grouped.columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-3 w-64 shrink-0">
                {col.map((scene) => (
                  <SceneCard
                    key={scene.id}
                    blueprint={blueprint}
                    scene={scene}
                    isStart={scene.id === blueprint.startSceneId}
                    onOpen={() => setEditingSceneId(scene.id)}
                    onDelete={() => handleDeleteScene(scene.id)}
                  />
                ))}
              </div>
            ))}
            {grouped.orphans.length > 0 && (
              <div className="flex flex-col gap-3 w-64 shrink-0">
                <span className="text-xs font-semibold text-destructive">Mồ côi (không tới được)</span>
                {grouped.orphans.map((scene) => (
                  <SceneCard
                    key={scene.id}
                    blueprint={blueprint}
                    scene={scene}
                    isStart={false}
                    onOpen={() => setEditingSceneId(scene.id)}
                    onDelete={() => handleDeleteScene(scene.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <EndingsPanel blueprint={blueprint} onBlueprintChange={setEpisodeBlueprint} />
        </div>
      )}

      {editingSceneId && blueprint && (
        <SceneIntentEditor
          blueprint={blueprint}
          sceneId={editingSceneId}
          onBlueprintChange={setEpisodeBlueprint}
          onClose={() => setEditingSceneId(null)}
          onRegenerate={(instruction) => handleRegenerateScene(editingSceneId, instruction)}
          registry={globalState?.registry}
          onRegistryChange={handleGlobalRegistryChange}
          episodes={otherEpisodes}
        />
      )}

      {playtesting && (
        <div className="fixed inset-0 z-50 bg-background/95 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <span className="text-sm font-semibold">Chơi thử · {episode.title}</span>
            <Button size="sm" variant="outline" onClick={() => setPlaytesting(false)}>Đóng</Button>
          </div>
          <div className="flex-1 overflow-hidden">
            {compileError ? (
              <p className="p-6 text-sm text-destructive">{compileError}</p>
            ) : (
              <GamePlayer gameData={{ meta: compiledPreview.meta, nodes: compiledPreview.nodes }} gameKey={`bp-preview-${episode.id}`} onExit={() => setPlaytesting(false)} />
            )}
          </div>
        </div>
      )}

      {aiBridgeOpen && episode && (
        <ExternalAiBridgeModal
          open={aiBridgeOpen}
          onClose={() => setAiBridgeOpen(false)}
          episode={episode}
          gamePlan={gamePlan}
          blueprint={blueprint}
          onApplyBlueprint={setEpisodeBlueprint}
          mechanics={mechanics}
          templateId={templateId}
        />
      )}
    </div>
  );
}
