// Xưởng Game Pro — PRO 1: màn hình chỉnh Bản thiết kế (Game Plan + các Tập).
// 1 trang duy nhất, có phần cuộn — không phải wizard nhiều bước. Toàn bộ
// thay đổi (kể cả do AI tạo lại) chỉ cập nhật state cục bộ qua onChange();
// việc lưu vào Supabase vẫn do nút "Lưu" chung của ProGameEditor đảm nhiệm,
// giống mọi chỉnh sửa khác trong Xưởng Game Pro (không tách 2 kiểu lưu).
import React, { useMemo, useState } from "react";
import { RotateCcw, CheckCircle2, AlertTriangle, Plus, Loader2, ChevronDown, Library, XCircle, Sparkles, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/use-toast";
import { PLANNER_STATUS, downgradeIfApproved } from "@/lib/gameStudioPro/plannerModel";
import {
  regenerateFullPlan,
  regenerateOneEpisode,
  reorderEpisode,
  toggleEpisodeLock,
  removeEpisode,
  addBlankEpisode,
} from "@/lib/gameStudioPro/plannerAI";
import { validateGamePlan } from "@/lib/gameStudioPro/plannerValidator";
import { syncRegistryToAllEpisodes, episodeTransitionSummary } from "@/lib/gameStudioPro/globalStateModel";
import { validateCampaign } from "@/lib/gameStudioPro/campaignValidator";
import { previewSuggestedEntities, mergeNamedEntitiesIntoRegistry } from "@/lib/gameStudioPro/templateRegistry";
import { ENTITY_KINDS } from "@/lib/gameStudioPro/entityRegistry";
import SuggestionList from "./SuggestionList";
import EpisodeCard from "./EpisodeCard";
import EntityRegistryPanel from "./EntityRegistryPanel";
import MechanicsPanel from "./MechanicsPanel";
import TemplatePicker from "./TemplatePicker";

// Game Plan đề xuất Chỉ số/Quan hệ/Cờ/Vật phẩm (vd "Thiện cảm") chỉ để HIỂN
// THỊ + đưa vào prompt lập kế hoạch tập — KHÔNG tự động có mặt trong
// globalState.registry (danh mục thật mà rule/hiệu ứng cảnh phải tham
// chiếu). Nếu bỏ qua bước này, AI dựng cảnh sẽ không tìm thấy "Thiện cảm"
// trong registry và đành gán hệ quả vào chỉ số khác (vd của template) hoặc
// để hệ quả treo "chưa giải quyết" — đúng lỗi người dùng gặp phải. Duyệt kế
// hoạch là mốc tự nhiên để đồng bộ 1 lần trước khi Xưởng bắt đầu sản xuất.
function suggestedEntitiesFromGamePlan(gamePlan) {
  const named = (list, kind, extra = (_displayName) => ({})) =>
    (list || [])
      .map((item) => (item?.name || "").trim())
      .filter(Boolean)
      .map((displayName) => ({ kind, displayName, ...extra(displayName) }));
  return [
    ...named(gamePlan?.suggestedStats, ENTITY_KINDS.STAT),
    ...named(gamePlan?.suggestedRelationships, ENTITY_KINDS.RELATIONSHIP, (displayName) => ({ npc: displayName })),
    ...named(gamePlan?.suggestedFlags, ENTITY_KINDS.FLAG),
    ...named(gamePlan?.suggestedItems, ENTITY_KINDS.ITEM),
  ];
}

const STATUS_LABEL = {
  [PLANNER_STATUS.DRAFT]: "Bản nháp",
  [PLANNER_STATUS.PLANNED]: "Đã có bản thiết kế",
  [PLANNER_STATUS.APPROVED]: "Đã duyệt",
};

export default function PlannerEditor({
  storyBlueprint,
  onChange,
  onOpenBlueprint,
  globalState,
  onGlobalStateChange,
  mechanics,
  onMechanicsChange,
  proDoc,
  onProDocChange,
}) {
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const [progress, setProgress] = useState("");
  const [showIdea, setShowIdea] = useState(false);
  const [registryOpen, setRegistryOpen] = useState(false);
  const [mechanicsOpen, setMechanicsOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const { toast } = useToast();

  const gamePlan = storyBlueprint.gamePlan || {};
  const episodes = storyBlueprint.episodes || [];
  const { warnings, blockers } = useMemo(() => validateGamePlan(storyBlueprint), [storyBlueprint]);
  const campaignValidation = useMemo(
    () => validateCampaign({ storyBlueprint, globalState, mechanics }),
    [storyBlueprint, globalState, mechanics]
  );
  const episodeTitleById = useMemo(() => new Map(episodes.map((e) => [e.id, e.title])), [episodes]);

  function patchBlueprint(fields) {
    onChange(downgradeIfApproved({ ...storyBlueprint, ...fields }));
  }
  function patchGamePlan(fields) {
    patchBlueprint({ gamePlan: { ...gamePlan, ...fields } });
  }
  function patchEpisodes(nextEpisodes) {
    patchBlueprint({ episodes: nextEpisodes });
  }
  function updateEpisode(id, nextEpisode) {
    patchEpisodes(episodes.map((e) => (e.id === id ? nextEpisode : e)));
  }
  function handleRemoveEpisode(ep) {
    const { incoming } = episodeTransitionSummary(storyBlueprint, ep.id);
    if (incoming.length > 0) {
      const titles = incoming.map((id) => episodeTitleById.get(id) || id).join(", ");
      if (!window.confirm(`Tập "${ep.title}" đang được ${incoming.length} tập khác trỏ tới (${titles}). Xoá vẫn tiếp tục — các kết nối đó sẽ bị đứt (chưa nối). Tiếp tục?`)) return;
    }
    patchEpisodes(removeEpisode(episodes, ep.id));
  }
  function handleGlobalRegistryChange(nextRegistry) {
    onGlobalStateChange({ ...globalState, registry: nextRegistry });
    onChange(syncRegistryToAllEpisodes(storyBlueprint, nextRegistry));
  }

  async function handleRegenerateAll() {
    if (!window.confirm("Tạo lại toàn bộ kế hoạch? Các tập đã khoá sẽ được giữ nguyên, các tập còn lại sẽ được AI lập lại.")) return;
    setRegeneratingAll(true);
    setProgress("Đang lập lại Kế hoạch Game...");
    try {
      const next = await regenerateFullPlan(storyBlueprint, storyBlueprint.idea, storyBlueprint.settings, {
        onProgress: (p) => {
          if (p.stage === "gameplan") setProgress("Đang lập lại Kế hoạch Game...");
          else setProgress(`Đang lập lại Tập ${p.index + 1}/${p.total}: ${p.title || ""}`);
        },
      });
      onChange(next);
      toast({ title: "Đã tạo lại kế hoạch" });
    } catch (e) {
      toast({ variant: "destructive", title: "Không tạo lại được kế hoạch", description: e.message });
    } finally {
      setRegeneratingAll(false);
      setProgress("");
    }
  }

  async function handleRegenerateEpisode(episodeId) {
    try {
      const next = await regenerateOneEpisode(storyBlueprint, episodeId);
      onChange(next);
    } catch (e) {
      toast({ variant: "destructive", title: "Không tạo lại được tập này", description: e.message });
    }
  }

  function handleApprove() {
    if (blockers.length > 0) return;
    // Đưa các Chỉ số/Quan hệ/Cờ/Vật phẩm Game Plan đã đề xuất (vd "Thiện cảm")
    // vào registry thật trước khi sản xuất — nếu không, chỉ số cốt lõi người
    // dùng yêu cầu sẽ "không tồn tại" với AI dựng cảnh (xem
    // suggestedEntitiesFromGamePlan ở trên).
    const { toAdd } = previewSuggestedEntities(globalState?.registry, suggestedEntitiesFromGamePlan(gamePlan));
    const { registry: mergedRegistry } = mergeNamedEntitiesIntoRegistry(globalState?.registry, toAdd);
    onGlobalStateChange({ ...globalState, registry: mergedRegistry });
    // Bypass patchBlueprint() on purpose — it auto-downgrades APPROVED back to
    // PLANNED on every change (so a real edit un-approves the plan), which
    // would immediately undo the very status this action sets.
    onChange(syncRegistryToAllEpisodes({ ...storyBlueprint, status: PLANNER_STATUS.APPROVED }, mergedRegistry));
    toast({
      title: "Đã duyệt — Xưởng bắt đầu sản xuất",
      description: "Hệ thống sẽ tự dựng, kiểm tra, hoàn thiện và lưu sơ đồ; bạn không cần xử lý lỗi kỹ thuật.",
    });
    onOpenBlueprint?.(episodes[0]?.id);
  }

  return (
    <div className="space-y-4">
      <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={storyBlueprint.status === PLANNER_STATUS.APPROVED ? "default" : "secondary"}>
              {STATUS_LABEL[storyBlueprint.status] || STATUS_LABEL[PLANNER_STATUS.DRAFT]}
            </Badge>
            {episodes.length > 0 && <span className="text-xs text-muted-foreground">{episodes.length} tập</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {globalState && (
              <Button type="button" size="sm" variant="outline" onClick={() => setRegistryOpen(true)}>
                <Library className="w-3.5 h-3.5 mr-1.5" /> Chỉ số & trạng thái
              </Button>
            )}
            {mechanics && (
              <Button type="button" size="sm" variant="outline" onClick={() => setMechanicsOpen(true)}>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Cơ chế game
              </Button>
            )}
            {proDoc && onProDocChange && (
              <Button type="button" size="sm" variant="outline" onClick={() => setTemplatePickerOpen(true)}>
                <Layers className="w-3.5 h-3.5 mr-1.5" /> Chọn mẫu
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={handleRegenerateAll} disabled={regeneratingAll}>
              {regeneratingAll ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
              Lập lại kế hoạch
            </Button>
            <Button type="button" size="sm" onClick={handleApprove} disabled={blockers.length > 0}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Duyệt kế hoạch
            </Button>
          </div>
        </div>
        {regeneratingAll && progress && <p className="text-xs text-muted-foreground">{progress}</p>}

        <Collapsible open={showIdea} onOpenChange={setShowIdea}>
          <CollapsibleTrigger asChild>
            <button type="button" className="flex min-h-10 items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showIdea ? "rotate-180" : ""}`} />
              Xem/sửa ý tưởng gốc
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <Textarea rows={4} value={storyBlueprint.idea} onChange={(e) => patchBlueprint({ idea: e.target.value })} />
          </CollapsibleContent>
        </Collapsible>
      </section>

      {(warnings.length > 0 || blockers.length > 0) && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-1.5">
          <p className="text-xs font-semibold flex items-center gap-1.5 text-amber-600">
            <AlertTriangle className="w-3.5 h-3.5" /> Cần chú ý
          </p>
          {blockers.map((b, i) => (
            <p key={`b${i}`} className="text-xs text-destructive">{b}</p>
          ))}
          {warnings.map((w, i) => (
            <p key={`w${i}`} className="text-xs text-muted-foreground">{w}</p>
          ))}
        </section>
      )}

      {globalState && (campaignValidation.errors.length > 0 || campaignValidation.warnings.length > 0) && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-1.5">
          <p className="text-xs font-semibold flex items-center gap-1.5 text-amber-600">
            <AlertTriangle className="w-3.5 h-3.5" /> Liên kết giữa các tập
          </p>
          {campaignValidation.errors.map((e, i) => (
            <p key={`ce${i}`} className="text-xs text-destructive flex items-start gap-1.5"><XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{e}</p>
          ))}
          {campaignValidation.warnings.map((w, i) => (
            <p key={`cw${i}`} className="text-xs text-muted-foreground flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{w}</p>
          ))}
        </section>
      )}

      <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-3">
        <Label>Tên game</Label>
        <Input value={gamePlan.title || ""} onChange={(e) => patchGamePlan({ title: e.target.value })} />

        <Label>Tiền đề / bối cảnh</Label>
        <Textarea rows={3} value={gamePlan.premise || ""} onChange={(e) => patchGamePlan({ premise: e.target.value })} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Thể loại</Label>
            <Input value={gamePlan.genre || ""} onChange={(e) => patchGamePlan({ genre: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Giọng điệu</Label>
            <Input value={gamePlan.tone || ""} onChange={(e) => patchGamePlan({ tone: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nhân vật chính</Label>
            <Input value={gamePlan.protagonist || ""} onChange={(e) => patchGamePlan({ protagonist: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vòng lặp lối chơi chính</Label>
            <Input value={gamePlan.coreGameplayLoop || ""} onChange={(e) => patchGamePlan({ coreGameplayLoop: e.target.value })} />
          </div>
        </div>

        <Label>Định hướng kết thúc</Label>
        <Textarea rows={2} value={gamePlan.endingStrategy || ""} onChange={(e) => patchGamePlan({ endingStrategy: e.target.value })} />

        <SuggestionList label="Nhân vật quan trọng" items={gamePlan.importantCharacters || []} onChange={(v) => patchGamePlan({ importantCharacters: v })} />
        <SuggestionList label="Chỉ số đề xuất" items={gamePlan.suggestedStats || []} onChange={(v) => patchGamePlan({ suggestedStats: v })} />
        <SuggestionList label="Quan hệ đề xuất" items={gamePlan.suggestedRelationships || []} onChange={(v) => patchGamePlan({ suggestedRelationships: v })} />
        <SuggestionList label="Cờ truyện đề xuất" items={gamePlan.suggestedFlags || []} onChange={(v) => patchGamePlan({ suggestedFlags: v })} />
        <SuggestionList label="Vật phẩm đề xuất" items={gamePlan.suggestedItems || []} onChange={(v) => patchGamePlan({ suggestedItems: v })} />
      </section>

      <div className="space-y-4">
        {episodes.map((ep, i) => (
          <EpisodeCard
            key={ep.id}
            episode={ep}
            canMoveUp={i > 0}
            canMoveDown={i < episodes.length - 1}
            onChange={(next) => updateEpisode(ep.id, next)}
            onRemove={() => handleRemoveEpisode(ep)}
            onMoveUp={() => patchEpisodes(reorderEpisode(episodes, ep.id, "up"))}
            onMoveDown={() => patchEpisodes(reorderEpisode(episodes, ep.id, "down"))}
            onToggleLock={() => patchEpisodes(toggleEpisodeLock(episodes, ep.id))}
            onRegenerate={() => handleRegenerateEpisode(ep.id)}
            planApproved={storyBlueprint.status === PLANNER_STATUS.APPROVED}
            onOpenBlueprint={onOpenBlueprint ? () => onOpenBlueprint(ep.id) : undefined}
            isStartEpisode={globalState ? ep.id === globalState.startEpisodeId : undefined}
            onSetStartEpisode={globalState ? () => onGlobalStateChange({ ...globalState, startEpisodeId: ep.id }) : undefined}
            nextEpisodeTitles={
              globalState
                ? episodeTransitionSummary(storyBlueprint, ep.id).outgoing.map((id) => episodeTitleById.get(id) || id)
                : []
            }
          />
        ))}
        <Button type="button" variant="outline" onClick={() => patchEpisodes(addBlankEpisode(episodes))}>
          <Plus className="w-4 h-4 mr-1.5" /> Thêm tập
        </Button>
      </div>

      {registryOpen && globalState && (
        <EntityRegistryPanel registry={globalState.registry} onRegistryChange={handleGlobalRegistryChange} onClose={() => setRegistryOpen(false)} />
      )}
      {mechanicsOpen && mechanics && (
        <MechanicsPanel registry={globalState?.registry} mechanics={mechanics} onMechanicsChange={onMechanicsChange} onClose={() => setMechanicsOpen(false)} />
      )}
      {templatePickerOpen && proDoc && onProDocChange && (
        <TemplatePicker asDialog proDoc={proDoc} onApply={onProDocChange} onClose={() => setTemplatePickerOpen(false)} />
      )}
    </div>
  );
}
