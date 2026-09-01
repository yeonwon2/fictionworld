// Xưởng Game Pro — PRO 2: Smart Mind Map — sơ đồ cảnh CỦA MỘT TẬP đã duyệt.
// Nguồn thật là episode.sceneBlueprint (blueprintModel.js), KHÔNG phải node
// graph runtime — xem compileEpisodeBlueprint (proCompiler.js) cho hướng
// biên dịch 1 chiều blueprint -> nodes. Cố tình KHÔNG tái dùng
// MindMapTab/useMapCanvas (bản pan/zoom SVG của Xưởng Game cũ, gắn chặt vào
// node graph runtime + trường kỹ thuật) — đây là 1 renderer MỚI, đơn giản
// hơn (cột theo độ sâu, không phải canvas tự do), đủ để người dùng "nhìn
// graph và hiểu được đường đi" mà không phải viết lại toàn bộ map engine.
import React, { useMemo, useState } from "react";
import { Plus, Sparkles, Loader2, PlayCircle, AlertTriangle, XCircle, Lock, Flag, X } from "lucide-react";
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
import { generateEpisodeBlueprint, regenerateScene } from "@/lib/gameStudioPro/blueprintAI";
import { compileEpisodeBlueprint } from "@/lib/gameStudioPro/proCompiler";
import SceneIntentEditor from "./SceneIntentEditor";

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
      <p className="text-[10px] text-muted-foreground/70">{incoming} lối vào</p>
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

export default function SmartMindMap({ storyBlueprint, onChange, initialEpisodeId }) {
  const episodes = storyBlueprint?.episodes || [];
  const [selectedId, setSelectedId] = useState(initialEpisodeId || episodes[0]?.id || null);
  const [editingSceneId, setEditingSceneId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [pending, setPending] = useState(null); // { blueprint, isRegenerate }
  const [playtesting, setPlaytesting] = useState(false);
  const { toast } = useToast();

  const episode = episodes.find((e) => e.id === selectedId) || null;
  const blueprint = episode?.sceneBlueprint || null;
  const gamePlan = storyBlueprint?.gamePlan || null;

  const validation = useMemo(() => (blueprint ? validateSceneBlueprint(blueprint) : { errors: [], warnings: [] }), [blueprint]);
  const grouped = useMemo(() => (blueprint ? groupScenesByDepth(blueprint) : { columns: [], orphans: [] }), [blueprint]);

  function setEpisodeBlueprint(nextBlueprint) {
    onChange({
      ...storyBlueprint,
      episodes: storyBlueprint.episodes.map((e) => (e.id === episode.id ? { ...e, sceneBlueprint: nextBlueprint } : e)),
    });
  }

  async function handleGenerate() {
    if (!episode) return;
    setGenerating(true);
    try {
      const next = await generateEpisodeBlueprint(episode, gamePlan, blueprint);
      setPending({ blueprint: next, isRegenerate: !!blueprint });
    } catch (e) {
      toast({ variant: "destructive", title: "Không dựng được sơ đồ", description: e.message });
    } finally {
      setGenerating(false);
    }
  }

  function applyPending() {
    setEpisodeBlueprint(pending.blueprint);
    setPending(null);
    toast({ title: "Đã áp dụng sơ đồ" });
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
      compiledPreview = compileEpisodeBlueprint(blueprint, { title: episode.title });
    } catch (e) {
      compileError = e.message;
    }
  }

  if (episodes.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">Chưa có Tập nào trong Bản thiết kế — hãy lập kế hoạch ở tab "Kế hoạch" trước.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground shrink-0">Tập:</span>
            <Select value={selectedId || ""} onValueChange={setSelectedId}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Chọn tập..." /></SelectTrigger>
              <SelectContent>
                {episodes.map((e) => (
                  <SelectItem key={e.id} value={e.id}>Tập {e.order} — {e.title}{e.sceneBlueprint ? "" : " (chưa có sơ đồ)"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {blueprint && (
              <Button size="sm" variant="outline" onClick={handleAddScene}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Thêm cảnh
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating || !episode}>
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
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Xem trước sơ đồ AI vừa dựng ({pending.blueprint.scenes.length} cảnh, {pending.blueprint.endings.length} kết thúc) — chưa áp dụng</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPending(null)}>Huỷ</Button>
              <Button size="sm" onClick={applyPending}>Áp dụng</Button>
            </div>
          </div>
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
          <p>Bấm "Dựng sơ đồ tập" để AI dựng sơ đồ từ Kế hoạch Tập, hoặc bắt đầu tay:</p>
          <Button size="sm" variant="outline" onClick={() => setEpisodeBlueprint(newSceneBlueprint(episode))}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Tạo sơ đồ trống
          </Button>
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
    </div>
  );
}
