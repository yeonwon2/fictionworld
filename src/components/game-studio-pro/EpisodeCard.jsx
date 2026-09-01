// Xưởng Game Pro — PRO 1: 1 thẻ Tập trong Bản thiết kế — sửa tay hoặc tạo
// lại bằng AI (nếu chưa khoá). Chỉ hiển thị từ ngữ thường (Tập/Giai
// đoạn/Sự kiện/Nguy hiểm/Kết thúc...), không có trường kỹ thuật nào.
import React, { useState } from "react";
import { Lock, Unlock, ChevronUp, ChevronDown, Trash2, RotateCcw, Plus, X, Loader2, Waypoints, Star, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { newBlankStage, newBlankIntent, intentTypeLabel, INTENT_TYPE_LABELS } from "@/lib/gameStudioPro/plannerModel";

function CommaListInput({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={(value || []).join(", ")}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
      />
    </div>
  );
}

function StageEditor({ stages, onChange }) {
  function updateStage(i, patch) {
    onChange(stages.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function removeStage(i) {
    onChange(stages.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-2">
      <Label>Giai đoạn</Label>
      {stages.length === 0 && <p className="text-xs text-muted-foreground">Chưa có giai đoạn nào.</p>}
      {stages.map((stage, i) => (
        <div key={i} className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex gap-2 items-start">
            <Input
              className="flex-1"
              placeholder="Tên giai đoạn"
              value={stage.title}
              onChange={(e) => updateStage(i, { title: e.target.value })}
            />
            <Input
              type="number"
              className="w-24"
              placeholder="Số cảnh"
              value={stage.approximateSceneCount ?? ""}
              onChange={(e) => updateStage(i, { approximateSceneCount: e.target.value ? Number(e.target.value) : null })}
            />
            <button type="button" onClick={() => removeStage(i)} className="p-2 text-muted-foreground hover:text-destructive shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <Input
            placeholder="Mục đích giai đoạn"
            value={stage.purpose}
            onChange={(e) => updateStage(i, { purpose: e.target.value })}
          />
          <Textarea
            rows={2}
            placeholder={"Sự kiện quan trọng (mỗi dòng 1 sự kiện)"}
            value={(stage.importantEvents || []).join("\n")}
            onChange={(e) => updateStage(i, { importantEvents: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
          />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...stages, newBlankStage()])}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Thêm giai đoạn
      </Button>
    </div>
  );
}

function IntentEditor({ intents, onChange }) {
  function updateIntent(i, patch) {
    onChange(intents.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function removeIntent(i) {
    onChange(intents.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-2">
      <Label>Ghi chú đặc biệt (điều kiện quan trọng, nguy hiểm...)</Label>
      {intents.length === 0 && <p className="text-xs text-muted-foreground">Chưa có ghi chú nào.</p>}
      {intents.map((intent, i) => (
        <div key={i} className="flex items-start gap-2">
          <select
            className="h-9 rounded-md border border-input bg-transparent px-2 text-xs shrink-0"
            value={intent.type}
            onChange={(e) => updateIntent(i, { type: e.target.value })}
          >
            {Object.keys(INTENT_TYPE_LABELS).map((key) => (
              <option key={key} value={key}>{intentTypeLabel(key)}</option>
            ))}
          </select>
          <Input
            className="flex-1"
            placeholder="Mô tả ghi chú"
            value={intent.description}
            onChange={(e) => updateIntent(i, { description: e.target.value })}
          />
          <button type="button" onClick={() => removeIntent(i)} className="p-2 text-muted-foreground hover:text-destructive shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...intents, newBlankIntent()])}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Thêm ghi chú
      </Button>
    </div>
  );
}

export default function EpisodeCard({
  episode,
  canMoveUp,
  canMoveDown,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onToggleLock,
  onRegenerate,
  planApproved,
  onOpenBlueprint,
  // PRO 5 — mục 16 (Episode Manager) — tất cả optional, không truyền vẫn ra
  // đúng hành vi PRO 1 cũ.
  isStartEpisode,
  onSetStartEpisode,
  nextEpisodeTitles = [],
}) {
  const [expanded, setExpanded] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  function patch(fields) {
    onChange({ ...episode, ...fields });
  }

  const sceneCount = episode.sceneBlueprint?.scenes?.length || 0;
  const hasBlueprint = !!episode.sceneBlueprint;

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground shrink-0">Tập {episode.order}</span>
        <Input className="min-w-0 max-w-full flex-1" value={episode.title} onChange={(e) => patch({ title: e.target.value })} />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
        {onSetStartEpisode && (
          <button
            type="button"
            onClick={onSetStartEpisode}
            disabled={isStartEpisode}
            className={`p-1.5 rounded transition disabled:opacity-100 ${isStartEpisode ? "text-amber-500" : "text-muted-foreground hover:text-foreground"}`}
            title={isStartEpisode ? "Tập bắt đầu campaign" : "Đặt làm tập bắt đầu campaign"}
          >
            <Star className="w-4 h-4" fill={isStartEpisode ? "currentColor" : "none"} />
          </button>
        )}
        <button type="button" onClick={onMoveUp} disabled={!canMoveUp} className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition" title="Lên">
          <ChevronUp className="w-4 h-4" />
        </button>
        <button type="button" onClick={onMoveDown} disabled={!canMoveDown} className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition" title="Xuống">
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onToggleLock}
          className={`p-1.5 rounded transition ${episode.locked ? "text-amber-500" : "text-muted-foreground hover:text-foreground"}`}
          title={episode.locked ? "Đang khoá — bấm để mở khoá" : "Khoá tập này (giữ nguyên khi tạo lại toàn bộ)"}
        >
          {episode.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>
        <button type="button" onClick={onRemove} className="p-1.5 rounded text-muted-foreground hover:text-destructive transition" title="Xoá tập">
          <Trash2 className="w-4 h-4" />
        </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {isStartEpisode && <Badge variant="secondary">★ Tập bắt đầu</Badge>}
        <span className={hasBlueprint ? "text-emerald-500" : "text-muted-foreground"}>
          {hasBlueprint ? `✓ Có sơ đồ · ${sceneCount} cảnh` : "Chưa dựng"}
        </span>
        {nextEpisodeTitles.length > 0 && (
          <span className="text-muted-foreground flex items-center gap-1">
            <ArrowRight className="w-3 h-3" /> {nextEpisodeTitles.join(", ")}
          </span>
        )}
      </div>

      <Textarea rows={2} placeholder="Tóm tắt tập" value={episode.summary} onChange={(e) => patch({ summary: e.target.value })} />

      <button type="button" className="text-xs text-primary hover:underline" onClick={() => setExpanded((v) => !v)}>
        {expanded ? "Thu gọn chi tiết" : "Xem chi tiết đầy đủ"}
      </button>

      {expanded && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tình huống mở đầu</Label>
              <Textarea rows={2} value={episode.startState} onChange={(e) => patch({ startState: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mục tiêu</Label>
              <Textarea rows={2} value={episode.goal} onChange={(e) => patch({ goal: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Xung đột chính</Label>
              <Textarea rows={2} value={episode.majorConflict} onChange={(e) => patch({ majorConflict: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cao trào</Label>
              <Textarea rows={2} value={episode.climax} onChange={(e) => patch({ climax: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Khả năng thất bại</Label>
              <Textarea rows={2} value={episode.possibleFailure} onChange={(e) => patch({ possibleFailure: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Chuyển sang tập sau</Label>
              <Textarea rows={2} value={episode.transitionToNextEpisode} onChange={(e) => patch({ transitionToNextEpisode: e.target.value })} />
            </div>
          </div>

          <StageEditor stages={episode.stages || []} onChange={(stages) => patch({ stages })} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CommaListInput label="Nhân vật liên quan" value={episode.keyCharacters} onChange={(v) => patch({ keyCharacters: v })} placeholder="Tên, cách nhau bằng dấu phẩy" />
            <CommaListInput label="Chỉ số liên quan" value={episode.relevantStats} onChange={(v) => patch({ relevantStats: v })} />
            <CommaListInput label="Cờ truyện liên quan" value={episode.relevantFlags} onChange={(v) => patch({ relevantFlags: v })} />
            <CommaListInput label="Vật phẩm liên quan" value={episode.relevantItems} onChange={(v) => patch({ relevantItems: v })} />
          </div>

          <IntentEditor intents={episode.planningIntents || []} onChange={(planningIntents) => patch({ planningIntents })} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={handleRegenerate} disabled={episode.locked || regenerating}>
          {regenerating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
          Tạo lại tập này
        </Button>
        {onOpenBlueprint && (
          <Button type="button" size="sm" variant="outline" onClick={onOpenBlueprint} disabled={!planApproved} title={planApproved ? undefined : "Duyệt bản thiết kế trước khi dựng sơ đồ cảnh"}>
            <Waypoints className="w-3.5 h-3.5 mr-1.5" /> Dựng sơ đồ tập
          </Button>
        )}
      </div>
    </section>
  );
}
