// Xưởng Game Pro — PRO 2: Smart Mind Map — sơ đồ cảnh CỦA MỘT TẬP đã duyệt.
// Nguồn thật là episode.sceneBlueprint (blueprintModel.js), KHÔNG phải node
// graph runtime — xem compileEpisodeBlueprint (proCompiler.js) cho hướng
// biên dịch 1 chiều blueprint -> nodes. Renderer bên dưới giữ blueprint làm
// nguồn thật nhưng trình bày giống Xưởng Game thường: Cảnh → Lựa chọn → Cảnh
// đích, với đường nối SVG thật thay vì danh sách chữ theo cột.
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  autoLinkDanglingScenesToEpisode,
  autoLinkDanglingChoices,
  autoStitchUnreachableComponents,
} from "@/lib/gameStudioPro/blueprintModel";
import { validateSceneBlueprint } from "@/lib/gameStudioPro/blueprintValidator";
import { generateEpisodeBlueprint, regenerateScene, getBlueprintScaleStatus, continueEpisodeBlueprint, refreshBlueprintEffects, repairBlueprintEffects } from "@/lib/gameStudioPro/blueprintAI";
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

const GRAPH_SCENE_WIDTH = 264;
const GRAPH_SCENE_HEIGHT = 190;
const GRAPH_CHOICE_WIDTH = 224;
const GRAPH_CHOICE_HEIGHT = 82;
const GRAPH_COLUMN_GAP = 96;
const GRAPH_ROW_GAP = 28;

function buildConnectedGraphLayout(blueprint) {
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
          depth.set(c.targetId, depth.get(id) + 2);
          queue.push(c.targetId);
        }
      }
    }
  }
  const layers = [];
  for (const scene of blueprint.scenes) {
    const d = depth.get(scene.id) ?? Math.max(2, ...depth.values()) + 2;
    layers[d] = layers[d] || [];
    layers[d].push({ id: scene.id, kind: "scene", scene });
    scene.choices.forEach((choice, index) => {
      layers[d + 1] = layers[d + 1] || [];
      layers[d + 1].push({ id: choice.id, kind: "choice", choice, scene, index });
    });
  }

  const endingDepth = Math.max(2, ...layers.map((items, index) => items?.length ? index : 0)) + 1;
  for (const ending of blueprint.endings || []) {
    layers[endingDepth] = layers[endingDepth] || [];
    layers[endingDepth].push({ id: ending.id, kind: "ending", ending });
  }

  const nodes = [];
  const positions = new Map();
  let width = 0;
  let height = 0;
  layers.forEach((items, layer) => {
    if (!items?.length) return;
    const isChoiceLayer = items[0].kind === "choice";
    const cardWidth = isChoiceLayer ? GRAPH_CHOICE_WIDTH : GRAPH_SCENE_WIDTH;
    const x = 24 + layer * (GRAPH_SCENE_WIDTH + GRAPH_COLUMN_GAP);
    items.forEach((item, row) => {
      const cardHeight = item.kind === "choice" ? GRAPH_CHOICE_HEIGHT : GRAPH_SCENE_HEIGHT;
      const y = 24 + row * (GRAPH_SCENE_HEIGHT + GRAPH_ROW_GAP);
      const positioned = { ...item, x, y, width: cardWidth, height: cardHeight };
      nodes.push(positioned);
      positions.set(item.id, positioned);
      width = Math.max(width, x + cardWidth + 24);
      height = Math.max(height, y + cardHeight + 24);
    });
  });

  const edges = [];
  for (const scene of blueprint.scenes) {
    const source = positions.get(scene.id);
    for (const choice of scene.choices) {
      const middle = positions.get(choice.id);
      const target = positions.get(choice.targetId);
      if (source && middle) edges.push({ id: `${scene.id}-${choice.id}`, from: source, to: middle, tone: "choice" });
      if (middle && target) edges.push({ id: `${choice.id}-${choice.targetId}`, from: middle, to: target, tone: choice.targetType === "ending" ? "ending" : "path" });
    }
  }
  return { nodes, edges, width: Math.max(width, 720), height: Math.max(height, 360) };
}

function edgePath(from, to) {
  const x1 = from.x + from.width;
  const y1 = from.y + from.height / 2;
  const x2 = to.x;
  const y2 = to.y + to.height / 2;
  const bend = Math.max(42, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

function ConnectedBlueprintGraph({ blueprint, onOpenScene, onDeleteScene }) {
  const layout = useMemo(() => buildConnectedGraphLayout(blueprint), [blueprint]);
  return (
    <div className="rounded-2xl border border-border bg-muted/10 overflow-auto max-h-[72vh]">
      <div className="relative" style={{ width: layout.width, height: layout.height }}>
        <svg className="absolute inset-0 pointer-events-none" width={layout.width} height={layout.height} aria-hidden="true">
          <defs><marker id="pro-graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" className="fill-muted-foreground/60" /></marker></defs>
          {layout.edges.map((edge) => <path key={edge.id} d={edgePath(edge.from, edge.to)} fill="none" className={edge.tone === "ending" ? "stroke-red-500/60" : "stroke-muted-foreground/45"} strokeWidth="2" markerEnd="url(#pro-graph-arrow)" />)}
        </svg>
        {layout.nodes.map((node) => (
          <div key={node.id} className="absolute" style={{ left: node.x, top: node.y, width: node.width }}>
            {node.kind === "scene" && <SceneCard blueprint={blueprint} scene={node.scene} isStart={node.scene.id === blueprint.startSceneId} onOpen={() => onOpenScene(node.scene.id)} onDelete={() => onDeleteScene(node.scene.id)} />}
            {node.kind === "choice" && (
              <button type="button" onClick={() => onOpenScene(node.scene.id)} className="w-full min-h-[82px] rounded-xl border border-primary/35 bg-background p-2.5 text-left shadow-sm hover:border-primary">
                <span className="text-[10px] font-bold text-primary">LỰA CHỌN {String.fromCharCode(65 + node.index)}</span>
                <p className="mt-1 text-xs line-clamp-2">{node.choice.text || "(chưa viết lựa chọn)"}</p>
                <p className="mt-1 truncate text-[10px] text-muted-foreground">Từ: {node.scene.title}</p>
              </button>
            )}
            {node.kind === "ending" && (
              <div className={`min-h-[110px] rounded-xl border p-3 shadow-sm ${node.ending.tone === "death" ? "border-red-500/60 bg-red-500/10" : "border-emerald-500/50 bg-emerald-500/10"}`}>
                <span className="text-[10px] font-bold">{node.ending.tone === "death" ? "☠ DEATH END" : "KẾT THÚC"}</span>
                <p className="mt-1 text-sm font-semibold">{node.ending.title}</p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{node.ending.text}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
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
  const [pending, setPending] = useState(null); // { blueprint, isRegenerate, needsRepair }
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [playtesting, setPlaytesting] = useState(false);
  const [aiBridgeOpen, setAiBridgeOpen] = useState(false);
  const autoStartedEpisodeIds = useRef(new Set());
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
  // Chấm trước lỗi của BẢN NHÁP (chưa áp dụng) ngay khi hiện danh sách cảnh —
  // trước đây người dùng chỉ thấy lỗi ĐẦU TIÊN qua toast lúc bấm "Áp dụng",
  // không biết CẢNH NÀO sai hay còn lỗi nào khác, và không có cách sửa ngoài
  // huỷ/dựng lại toàn bộ. Hiện đủ danh sách + cho sửa TỪNG cảnh bằng AI ngay
  // tại đây (xem handleRegeneratePendingScene ở dưới).
  const pendingValidation = useMemo(
    () => (pending ? validateSceneBlueprint(refreshBlueprintEffects(pending.blueprint, globalState?.registry), { knownEpisodeIds, planningConstraints: episode?.planningConstraints || storyBlueprint.planningConstraints }) : { errors: [], warnings: [] }),
    [pending, knownEpisodeIds, episode?.planningConstraints, storyBlueprint.planningConstraints, globalState?.registry]
  );
  const blueprintScale = useMemo(
    () => (blueprint && episode ? getBlueprintScaleStatus(blueprint, resolveGenerationEpisode()) : null),
    // resolveGenerationEpisode only derives from these authored values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blueprint, episode, storyBlueprint.planningConstraints, storyBlueprint.idea, storyBlueprint.settings?.gameLength, gamePlan?.coreGameplayLoop]
  );
  const topologyRepairPreview = useMemo(
    () => blueprint ? autoStitchUnreachableComponents(autoLinkDanglingChoices(blueprint)) : null,
    [blueprint]
  );
  const canRepairTopology = !!blueprint && topologyRepairPreview !== blueprint;

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
  const MAX_AUTO_CONTINUE_ROUNDS = 10;
  async function fillUntilTarget(generationEpisode, startBlueprint, isRegenerate = false) {
    let next = startBlueprint;
    let scale = getBlueprintScaleStatus(next, generationEpisode);
    let round = 0;
    while (scale.underGenerated && round < MAX_AUTO_CONTINUE_ROUNDS) {
      round += 1;
      setProgress(`Chưa đủ cảnh (${scale.meaningfulSceneCount}/${generationEpisode.planningConstraints.targetSceneCount}) — đang tự bổ sung (vòng ${round}/${MAX_AUTO_CONTINUE_ROUNDS})...`);
      try {
        const beforeCount = scale.meaningfulSceneCount;
        next = await continueEpisodeBlueprint(generationEpisode, gamePlan, next);
        scale = getBlueprintScaleStatus(next, generationEpisode);
        // Lưu checkpoint sau TỪNG lô thành công. Nếu quota/mạng hỏng ở lô sau,
        // tải lại trang vẫn trở về đúng tiến độ mới nhất thay vì bản 21 cảnh.
        commitPending({
          blueprint: next,
          isRegenerate,
          scale,
          targetSceneCount: generationEpisode.planningConstraints.targetSceneCount,
          allowUnderGenerated: false,
          needsRepair: false,
        });
        if (scale.meaningfulSceneCount <= beforeCount) {
          toast({ variant: "destructive", title: "AI chưa thêm được cảnh mới", description: "Hệ thống đã giữ nguyên toàn bộ cảnh hiện có và dừng để tránh gọi lặp vô ích." });
          break;
        }
      } catch (e) {
        // Dừng vòng lặp tự động nhưng KHÔNG ném lỗi ra ngoài — giữ lại mọi
        // cảnh đã bổ sung thành công tới vòng trước, không mất công đã làm.
        toast({ variant: "destructive", title: "Tự động bổ sung bị dừng giữa chừng", description: e.message });
        break;
      }
    }
    return { blueprint: next, scale };
  }

  function resolveGenerationEpisode() {
    // Game ngắn luôn lấy lại quy mô từ ý tưởng gốc. Dữ liệu cũ có thể từng
    // bị chia 3 tập và lưu target 8 vào episode; ưu tiên giá trị stale đó sẽ
    // khiến bản đã gộp vẫn dừng ở 8 thay vì 25.
    const planningConstraints = episodes.length === 1 || storyBlueprint.settings?.gameLength !== "long"
      ? derivePlanningConstraints(`${storyBlueprint.idea || ""}\n${gamePlan?.coreGameplayLoop || ""}\n${episode.summary || ""}`, episode.stages)
      : episode.planningConstraints || storyBlueprint.planningConstraints || derivePlanningConstraints(storyBlueprint.idea, episode.stages);
    return { ...episode, planningConstraints };
  }

  // Tập kế tiếp theo THỨ TỰ (order) của TẬP ĐANG DỰNG — dùng để tự nối cảnh
  // cụt cuối tập sang tập sau (xem autoLinkDanglingScenesToEpisode). null nếu
  // đây đã là tập cuối cùng của campaign.
  function resolveNextEpisodeId() {
    const ordered = [...episodes].sort((a, b) => a.order - b.order);
    const idx = ordered.findIndex((e) => e.id === episode.id);
    return idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1].id : null;
  }

  // Người dùng THƯỜNG (không rành kỹ thuật) không được để tự đọc/hiểu lỗi
  // validate kỹ thuật (vd "phải có hệ quả luật thật khác nhau") — bước này
  // chạy NGAY sau khi sơ đồ đủ cảnh, tự sửa những gì suy luận được cục bộ rồi
  // xin AI vá NỘI DUNG còn thiếu (GỘP CHUNG 1 lượt, xem repairBlueprintEffects
  // ở blueprintAI.js) trước khi cho xem bản nháp — để trường hợp thường gặp
  // (như ảnh lỗi "hệ quả luật thật khác nhau" của người dùng) tự hết mà không
  // ai phải bấm gì. Nếu lượt sửa gộp bị lỗi/hết quota, GIỮ NGUYÊN bản nháp
  // trước khi sửa (không mất công đã dựng) — người dùng có thể "Thử hoàn
  // thiện lại" sau, hoặc mở "Chi tiết kỹ thuật" để tự sửa từng cảnh.
  async function finalizeGeneration(generationEpisode, startBlueprint, scale, isRegenerate) {
    let finalBlueprint = startBlueprint;
    let stillHasGaps = false;
    if (!scale.underGenerated) {
      setProgress("Đang hoàn thiện...");
      try {
        const repairResult = await repairBlueprintEffects(startBlueprint, gamePlan, generationEpisode, globalState?.registry);
        finalBlueprint = repairResult.blueprint;
        stillHasGaps = repairResult.stillHasGaps;
      } catch (e) {
        toast({ variant: "destructive", title: "Sơ đồ đã được giữ lại nhưng chưa hoàn thiện", description: `${e.message} — bạn có thể bấm "Thử hoàn thiện lại" khi sẵn sàng.` });
      }
      finalBlueprint = autoLinkDanglingScenesToEpisode(finalBlueprint, resolveNextEpisodeId());
    }
    finalBlueprint = autoStitchUnreachableComponents(autoLinkDanglingChoices(finalBlueprint));
    const finalValidation = validateSceneBlueprint(finalBlueprint, { knownEpisodeIds, planningConstraints: generationEpisode.planningConstraints });
    if (!scale.underGenerated && finalValidation.errors.length === 0) {
      // Happy path của Xưởng: kỹ thuật đã đạt thì tự áp dụng, không bắt tác
      // giả duyệt thêm một lần cho dữ liệu graph nội bộ vừa do hệ thống tạo.
      const result = applyEpisodeBlueprint(storyBlueprint, globalState, episode.id, finalBlueprint);
      onGlobalStateChange(result.globalState);
      const completedStory = {
        ...result.storyBlueprint,
        episodes: result.storyBlueprint.episodes.map((item) => (item.id === episode.id ? { ...item, pendingBlueprint: null } : item)),
      };
      onChange(completedStory);
      setPending(null);
      const nextMissing = completedStory.episodes.find((item) => !item.sceneBlueprint?.scenes?.length);
      if (nextMissing) setSelectedId(nextMissing.id);
      else toast({ title: "Xưởng đã dựng xong toàn bộ sơ đồ", description: "Đang tự lưu thành phẩm; bạn có thể chơi thử hoặc xem QA." });
      return;
    }
    commitPending({
      blueprint: finalBlueprint,
      isRegenerate,
      scale: getBlueprintScaleStatus(finalBlueprint, generationEpisode),
      targetSceneCount: generationEpisode.planningConstraints.targetSceneCount,
      allowUnderGenerated: false,
      needsRepair: finalValidation.errors.length > 0 || stillHasGaps,
    });
  }

  async function handleGenerate(forceRefresh = false) {
    if (!episode) return;
    const generationEpisode = resolveGenerationEpisode();
    setGenerating(true);
    try {
      const first = await generateEpisodeBlueprint(generationEpisode, gamePlan, blueprint, { forceRefresh });
      // Giữ ngay lô đầu tiên trước khi gọi tiếp các lô còn thiếu.
      const firstScale = getBlueprintScaleStatus(first, generationEpisode);
      commitPending({ blueprint: first, isRegenerate: !!blueprint, scale: firstScale, targetSceneCount: generationEpisode.planningConstraints.targetSceneCount, allowUnderGenerated: false, needsRepair: false });
      const { blueprint: filled, scale } = await fillUntilTarget(generationEpisode, first, !!blueprint);
      await finalizeGeneration(generationEpisode, filled, scale, !!blueprint);
    } catch (e) {
      toast({ variant: "destructive", title: "Không dựng được sơ đồ", description: e.message });
    } finally {
      setGenerating(false);
      setProgress("");
    }
  }

  // Sau khi tác giả duyệt kế hoạch, Xưởng tự sản xuất lần lượt từng tập.
  // Đây chỉ chạy một lần/tập trong mỗi lần mở màn hình; checkpoint đã lưu sẽ
  // được tiếp tục thay vì gọi lại từ đầu khi tải lại trang.
  useEffect(() => {
    if (storyBlueprint?.status !== "approved" || !episode || blueprint || pending || generating) return;
    if (autoStartedEpisodeIds.current.has(episode.id)) return;
    autoStartedEpisodeIds.current.add(episode.id);
    handleGenerate(false);
    // handleGenerate intentionally uses the latest render snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyBlueprint?.status, episode?.id, blueprint, pending, generating]);

  // Xin AI hoàn thiện lại (gộp 1 lượt) mà KHÔNG dựng lại từ đầu — dùng khi
  // finalizeGeneration() đã thử 1 lần mà vẫn còn cảnh chưa xong (hết quota
  // giữa chừng, hoặc AI vẫn chưa vá đủ ở lượt đầu).
  async function handleRetryRepair() {
    if (!pending) return;
    const generationEpisode = resolveGenerationEpisode();
    setGenerating(true);
    setProgress("Đang hoàn thiện...");
    try {
      const { blueprint: repaired, stillHasGaps } = await repairBlueprintEffects(pending.blueprint, gamePlan, generationEpisode, globalState?.registry);
      const topologyRepaired = autoStitchUnreachableComponents(autoLinkDanglingChoices(repaired));
      const finalValidation = validateSceneBlueprint(topologyRepaired, { knownEpisodeIds, planningConstraints: generationEpisode.planningConstraints });
      // Đồng nhất với finalizeGeneration: thiếu effect máy đọc được là cảnh
      // báo QA/có thể sửa sau, không được khóa vĩnh viễn một graph đã đủ và
      // không còn lỗi cấu trúc. Hệ quả văn bản của lựa chọn vẫn được giữ.
      commitPending((value) => (value ? { ...value, blueprint: topologyRepaired, scale: getBlueprintScaleStatus(topologyRepaired, generationEpisode), needsRepair: finalValidation.errors.length > 0, hasEffectGaps: stillHasGaps } : value));
    } catch (e) {
      toast({ variant: "destructive", title: "Chưa hoàn thiện được", description: e.message });
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
    const refreshedBlueprint = autoStitchUnreachableComponents(autoLinkDanglingChoices(refreshBlueprintEffects(pending.blueprint, globalState?.registry)));
    const previewValidation = validateSceneBlueprint(refreshedBlueprint, { knownEpisodeIds, planningConstraints: constraints });
    if (previewValidation.errors.length) {
      // KHÔNG dump lỗi kỹ thuật lên toast — bản nháp vẫn còn nguyên, panel
      // "chưa hoàn thiện" (needsRepair) đã đủ hướng dẫn "Thử hoàn thiện
      // lại"/"Chi tiết kỹ thuật".
      commitPending((value) => (value ? { ...value, blueprint: refreshedBlueprint, needsRepair: true } : value));
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
    const generationEpisode = resolveGenerationEpisode();
    setGenerating(true);
    try {
      const { blueprint: filled, scale } = await fillUntilTarget(generationEpisode, pending.blueprint, pending.isRegenerate);
      await finalizeGeneration(generationEpisode, filled, scale, pending.isRegenerate);
    } finally {
      setGenerating(false);
      setProgress("");
    }
  }

  // Cứu cả sơ đồ thiếu đã được áp dụng/lưu từ phiên bản cũ: chuyển nó thành
  // checkpoint pending rồi chỉ xin phần còn thiếu, tuyệt đối không dựng lại
  // hay xoá các cảnh hiện có.
  async function handleCompleteAppliedBlueprint() {
    if (!blueprint || !blueprintScale?.underGenerated) return;
    const generationEpisode = resolveGenerationEpisode();
    const checkpoint = { blueprint, isRegenerate: true, scale: blueprintScale, targetSceneCount: generationEpisode.planningConstraints.targetSceneCount, allowUnderGenerated: false, needsRepair: false };
    commitPending(checkpoint);
    setGenerating(true);
    try {
      const { blueprint: filled, scale } = await fillUntilTarget(generationEpisode, blueprint, true);
      await finalizeGeneration(generationEpisode, filled, scale, true);
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

  // Sửa MỘT cảnh ngay trong bản nháp AI (pending, chưa áp dụng) — trước đây
  // gặp lỗi (vd 2 lựa chọn cùng hệ quả) thì chỉ có thể "Huỷ"/"Thử tạo lại"
  // toàn bộ, không có cách sửa riêng 1 cảnh mà không mất các cảnh khác đã ổn.
  // Không cần người dùng tự viết yêu cầu kỹ thuật — tự mô tả đúng lỗi đang có
  // (nếu có) cho AI sửa; nếu cảnh không có lỗi thì để trống, AI tự cải thiện.
  async function handleRegeneratePendingScene(sceneId) {
    if (!pending) return;
    const generationEpisode = resolveGenerationEpisode();
    const sceneErrors = pendingValidation.errors.filter((e) => e.includes(`"${pending.blueprint.scenes.find((s) => s.id === sceneId)?.title}"`));
    const instructionText = sceneErrors.length
      ? `Cảnh này đang bị lỗi, hãy sửa cho đúng: ${sceneErrors.join(" ")}`
      : "Giữ đúng vai trò/kết nối hiện tại, chỉ cải thiện nội dung và đảm bảo mỗi lựa chọn có hệ quả luật thật khác nhau, không trùng nhau.";
    setGenerating(true);
    try {
      const next = await regenerateScene(pending.blueprint, generationEpisode, gamePlan, sceneId, instructionText);
      const finalValidation = validateSceneBlueprint(next, { knownEpisodeIds, planningConstraints: generationEpisode.planningConstraints });
      commitPending((value) => (value ? { ...value, blueprint: next, scale: getBlueprintScaleStatus(next, generationEpisode), needsRepair: finalValidation.errors.length > 0 } : value));
      toast({ title: "Đã sửa lại cảnh trong bản nháp" });
    } catch (e) {
      toast({ variant: "destructive", title: "Chưa sửa được cảnh này", description: e.message });
    } finally {
      setGenerating(false);
    }
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
            {canRepairTopology && (
              <Button size="sm" variant="outline" onClick={() => setEpisodeBlueprint(topologyRepairPreview)}>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Tự nối các cụm rời
              </Button>
            )}
            {blueprint && blueprintScale?.underGenerated && (
              <Button size="sm" onClick={handleCompleteAppliedBlueprint} disabled={generating}>
                {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                Bổ sung cho đủ {resolveGenerationEpisode().planningConstraints.targetSceneCount} cảnh
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
              <Button size="sm" onClick={applyPending} disabled={(pending.scale?.underGenerated && !pending.allowUnderGenerated) || pending.needsRepair}>Áp dụng</Button>
            </div>
          </div>

          {generating && progress && <p className="text-xs text-muted-foreground">{progress}</p>}

          {pending.scale?.underGenerated && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p>Kế hoạch yêu cầu khoảng {pending.targetSceneCount} cảnh nhưng AI mới dựng {pending.scale.meaningfulSceneCount} cảnh.</p>
              <button type="button" className="mt-2 text-xs text-muted-foreground underline" onClick={() => commitPending((value) => ({ ...value, allowUnderGenerated: true }))}>Nâng cao: vẫn áp dụng bản thiếu</button>
            </div>
          )}

          {/* Người dùng thường KHÔNG thấy lỗi kỹ thuật thô — chỉ 1 câu đơn
              giản + cách xử lý. "Chi tiết kỹ thuật" là tuỳ chọn, dành cho ai
              muốn tự sửa tay từng cảnh (nút "Sửa bằng AI" dưới mỗi cảnh). */}
          {!pending.scale?.underGenerated && pending.needsRepair && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm space-y-2">
              <p>AI chưa hoàn thiện xong một vài phần của sơ đồ. Bản nháp vẫn được giữ nguyên — không mất công đã dựng.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleRetryRepair} disabled={generating}>Thử hoàn thiện lại</Button>
                <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setShowTechnicalDetails((v) => !v)}>
                  {showTechnicalDetails ? "Ẩn chi tiết kỹ thuật" : "Chi tiết kỹ thuật"}
                </button>
              </div>
              {showTechnicalDetails && (
                <div className="space-y-1 pt-2 border-t border-amber-500/30">
                  {pendingValidation.errors.map((e, i) => (
                    <p key={`pe${i}`} className="text-xs text-destructive flex items-start gap-1.5"><XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {!pending.scale?.underGenerated && !pending.needsRepair && (
            <p className="text-xs text-emerald-600 flex items-center gap-1.5">Đã sẵn sàng — có thể "Áp dụng".</p>
          )}

          <div className="max-h-56 overflow-y-auto space-y-1 text-xs">
            {pending.blueprint.scenes.map((s) => {
              const sceneHasError = pendingValidation.errors.some((e) => e.includes(`"${s.title}"`));
              return (
                <div key={s.id} className={`flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 ${sceneHasError && showTechnicalDetails ? "bg-destructive/5" : ""}`}>
                  <p className="text-muted-foreground min-w-0 truncate">
                    <Badge variant="secondary" className="text-[10px] mr-1.5">{SCENE_ROLE_LABELS[s.role]}</Badge>
                    {s.title || "(chưa đặt tên)"}{s.id === pending.blueprint.startSceneId ? " · bắt đầu" : ""}
                  </p>
                  {showTechnicalDetails && (
                    <button type="button" className={`shrink-0 text-[11px] underline ${sceneHasError ? "text-destructive" : "text-muted-foreground"}`} disabled={generating} onClick={() => handleRegeneratePendingScene(s.id)}>
                      Sửa bằng AI
                    </button>
                  )}
                </div>
              );
            })}
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
          <ConnectedBlueprintGraph blueprint={blueprint} onOpenScene={setEditingSceneId} onDeleteScene={handleDeleteScene} />

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
