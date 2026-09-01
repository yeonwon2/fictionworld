// Xưởng Game Pro — PRO 2: "THIẾT KẾ CẢNH" — panel sửa 1 cảnh trong Smart Mind
// Map. Chỉ dùng ngôn ngữ thường (Tên cảnh/Loại cảnh/Ý đồ cảnh/Lựa chọn/Kết
// nối) — KHÔNG hiện node ID/targetNodeId/requiresFlag kỹ thuật nào (khác hẳn
// MindMapEditor.jsx cũ của Xưởng Game, vốn lộ toàn bộ trường kỹ thuật — đây
// là lớp Pro editor MỚI cố tình tách riêng, không fork MindMapEditor).
import React, { useState } from "react";
import { Lock, Unlock, Plus, X, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import {
  SCENE_ROLES,
  SCENE_ROLE_LABELS,
  MIN_DECISION_CHOICES,
  MAX_DECISION_CHOICES,
  findScene,
  updateScene,
  addChoice,
  updateChoice,
  removeChoice,
  connectChoice,
  disconnectChoice,
  connectInstantEnding,
  toggleSceneLock,
} from "@/lib/gameStudioPro/blueprintModel";

const NONE_VALUE = "__none__";
const NEW_DEATH_VALUE = "__new_death_ending__";

function targetLabel(blueprint, choice) {
  if (!choice.targetType || !choice.targetId) return "(chưa nối)";
  if (choice.targetType === "scene") {
    const s = findScene(blueprint, choice.targetId);
    return s ? `→ Cảnh: ${s.title || "(chưa đặt tên)"}` : "→ Cảnh (đã bị xoá)";
  }
  const e = (blueprint.endings || []).find((x) => x.id === choice.targetId);
  return e ? `→ Kết thúc: ${e.title || "(chưa đặt tên)"}${e.tone === "death" ? " ☠" : ""}` : "→ Kết thúc (đã bị xoá)";
}

function ChoiceRow({ blueprint, sceneId, choice, index, onBlueprintChange, disabled }) {
  const value = choice.targetType && choice.targetId ? `${choice.targetType}:${choice.targetId}` : NONE_VALUE;
  const otherScenes = blueprint.scenes.filter((s) => s.id !== sceneId);

  function handleTargetChange(v) {
    if (v === NONE_VALUE) {
      onBlueprintChange(disconnectChoice(blueprint, sceneId, choice.id));
      return;
    }
    if (v === NEW_DEATH_VALUE) {
      onBlueprintChange(connectInstantEnding(blueprint, sceneId, choice.id, { title: "Kết thúc", tone: "death" }));
      return;
    }
    const [targetType, ...rest] = v.split(":");
    const targetId = rest.join(":");
    onBlueprintChange(connectChoice(blueprint, sceneId, choice.id, targetType, targetId));
  }

  return (
    <div className="rounded-lg border border-border p-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-xs font-semibold text-muted-foreground shrink-0 mt-2 w-5">{String.fromCharCode(65 + index)}.</span>
        <Input
          className="flex-1"
          placeholder="Lời lựa chọn (để trống nếu chỉ là 'đi tiếp')"
          value={choice.text}
          disabled={disabled}
          onChange={(e) => onBlueprintChange(updateChoice(blueprint, sceneId, choice.id, { text: e.target.value }))}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onBlueprintChange(removeChoice(blueprint, sceneId, choice.id))}
          className="p-2 text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-30"
          title="Xoá lựa chọn"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="pl-7 flex flex-wrap items-center gap-2">
        <Select value={value} onValueChange={handleTargetChange} disabled={disabled}>
          <SelectTrigger className="h-8 text-xs w-auto min-w-[220px]"><SelectValue placeholder="Chọn đích..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>(chưa nối)</SelectItem>
            <SelectItem value={NEW_DEATH_VALUE}>☠ Kết thúc ngay (tạo kết thúc mới)</SelectItem>
            {otherScenes.length > 0 && (
              <SelectGroup>
                <SelectLabel>Cảnh</SelectLabel>
                {otherScenes.map((s) => (
                  <SelectItem key={s.id} value={`scene:${s.id}`}>{s.title || "(chưa đặt tên)"} · {SCENE_ROLE_LABELS[s.role]}</SelectItem>
                ))}
              </SelectGroup>
            )}
            {(blueprint.endings || []).length > 0 && (
              <SelectGroup>
                <SelectLabel>Kết thúc có sẵn</SelectLabel>
                {blueprint.endings.map((e) => (
                  <SelectItem key={e.id} value={`ending:${e.id}`}>{e.tone === "death" ? "☠ " : ""}{e.title || "(chưa đặt tên)"}</SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground">{targetLabel(blueprint, choice)}</span>
      </div>
      <div className="pl-7">
        <Input
          className="text-xs h-8"
          placeholder="Điều kiện (tuỳ chọn, ghi bằng lời — vd: chỉ mở nếu trước đó đã cứu Tiểu Lan)"
          value={choice.gateIntent}
          disabled={disabled}
          onChange={(e) => onBlueprintChange(updateChoice(blueprint, sceneId, choice.id, { gateIntent: e.target.value }))}
        />
      </div>
    </div>
  );
}

export default function SceneIntentEditor({ blueprint, sceneId, onBlueprintChange, onClose, onRegenerate }) {
  const scene = findScene(blueprint, sceneId);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");

  if (!scene) return null;
  const isDecision = scene.role === SCENE_ROLES.DECISION;
  const isEnding = scene.role === SCENE_ROLES.ENDING;
  const disabled = scene.locked;

  function patch(fields) {
    onBlueprintChange(updateScene(blueprint, sceneId, fields));
  }

  function handleChoiceCountChange(v) {
    const target = Number(v);
    if (!Number.isFinite(target)) return; // "auto" — không ép số lượng
    const current = scene.choices.length;
    if (target > current) {
      let next = blueprint;
      for (let i = current; i < target; i++) next = addChoice(next, sceneId);
      onBlueprintChange(next);
    } else if (target < current) {
      const removed = scene.choices.slice(target);
      const losesConnections = removed.some((c) => c.targetType);
      if (losesConnections && !window.confirm(`Giảm xuống ${target} lựa chọn sẽ xoá ${removed.length} lựa chọn đã nối. Tiếp tục?`)) return;
      let next = blueprint;
      for (const c of removed) next = removeChoice(next, sceneId, c.id);
      onBlueprintChange(next);
    }
  }

  async function handleRegenerate() {
    setError("");
    setRegenerating(true);
    try {
      await onRegenerate(scene.intent);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thiết kế cảnh</DialogTitle>
          <DialogDescription>Chỉ mô tả bằng lời — hệ thống tự lo phần kỹ thuật (ID, kết nối) phía sau.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tên cảnh</Label>
            <Input value={scene.title} disabled={disabled} onChange={(e) => patch({ title: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>Loại cảnh</Label>
            <Select value={scene.role} onValueChange={(v) => patch({ role: v })} disabled={disabled}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SCENE_ROLE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Ý đồ cảnh</Label>
            <Textarea
              rows={5}
              placeholder='Mô tả bằng lời chuyện gì xảy ra ở cảnh này — vd: "Lệ Phi hỏi tội nhân vật chính trước yến tiệc, 4 lựa chọn: một đứng về Hoàng hậu, một đứng về Lệ Phi, một im lặng, một phản bác (phản bác sai có thể chết)."'
              value={scene.intent}
              disabled={disabled}
              onChange={(e) => patch({ intent: e.target.value })}
            />
          </div>

          {!isEnding && (
            <>
              <div className="space-y-1.5">
                <Label>Số lựa chọn</Label>
                <Select value="auto" onValueChange={handleChoiceCountChange} disabled={disabled}>
                  <SelectTrigger className="w-40"><SelectValue placeholder={`Hiện tại: ${scene.choices.length}`} /></SelectTrigger>
                  <SelectContent>
                    {isDecision
                      ? Array.from({ length: MAX_DECISION_CHOICES - MIN_DECISION_CHOICES + 1 }, (_, i) => i + MIN_DECISION_CHOICES).map((n) => (
                          <SelectItem key={n} value={String(n)}>{n} lựa chọn</SelectItem>
                        ))
                      : [0, 1].map((n) => <SelectItem key={n} value={String(n)}>{n === 0 ? "Không có (kết thúc/hội tụ)" : "1 (đi tiếp)"}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Hiện có {scene.choices.length} lựa chọn. Chọn số khác để tự thêm/bớt.</p>
              </div>

              <div className="space-y-2">
                <Label>Các lựa chọn hiện tại</Label>
                {scene.choices.length === 0 && <p className="text-xs text-muted-foreground">Chưa có lựa chọn nào.</p>}
                {scene.choices.map((c, i) => (
                  <ChoiceRow key={c.id} blueprint={blueprint} sceneId={sceneId} choice={c} index={i} onBlueprintChange={onBlueprintChange} disabled={disabled} />
                ))}
                <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onBlueprintChange(addChoice(blueprint, sceneId))}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Thêm lựa chọn
                </Button>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Ghi chú riêng (không gửi cho AI)</Label>
            <Textarea rows={2} value={scene.notes} disabled={disabled} onChange={(e) => patch({ notes: e.target.value })} />
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <button
              type="button"
              onClick={() => onBlueprintChange(toggleSceneLock(blueprint, sceneId))}
              className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg transition ${scene.locked ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground hover:text-foreground"}`}
            >
              {scene.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              {scene.locked ? "Đang khoá — Giữ nguyên cảnh này" : "Khoá cảnh này"}
            </button>
            <Button type="button" size="sm" onClick={handleRegenerate} disabled={disabled || regenerating}>
              {regenerating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
              AI thiết kế lại cảnh này
            </Button>
          </div>
          {disabled && <p className="text-[11px] text-amber-600">Cảnh đang khoá — mở khoá để sửa hoặc để AI thiết kế lại.</p>}
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
