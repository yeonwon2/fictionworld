// Xưởng Game Pro — PRO 2: "THIẾT KẾ CẢNH" — panel sửa 1 cảnh trong Smart Mind
// Map. Chỉ dùng ngôn ngữ thường (Tên cảnh/Loại cảnh/Ý đồ cảnh/Lựa chọn/Kết
// nối) — KHÔNG hiện node ID/targetNodeId/requiresFlag kỹ thuật nào (khác hẳn
// MindMapEditor.jsx cũ của Xưởng Game, vốn lộ toàn bộ trường kỹ thuật — đây
// là lớp Pro editor MỚI cố tình tách riêng, không fork MindMapEditor).
import React, { useState } from "react";
import { Lock, Unlock, Plus, X, Sparkles, Loader2, GitBranch, Library } from "lucide-react";
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
  newOutcomeBranch,
} from "@/lib/gameStudioPro/blueprintModel";
import { ensureRegistry } from "@/lib/gameStudioPro/entityRegistry";
import RuleEditor from "./RuleEditor";
import EntityRegistryPanel from "./EntityRegistryPanel";

const NONE_VALUE = "__none__";
const NEW_DEATH_VALUE = "__new_death_ending__";

function targetLabelFor(blueprint, targetType, targetId, episodes = []) {
  if (!targetType || !targetId) return "(chưa nối)";
  if (targetType === "scene") {
    const s = findScene(blueprint, targetId);
    return s ? `→ Cảnh: ${s.title || "(chưa đặt tên)"}` : "→ Cảnh (đã bị xoá)";
  }
  if (targetType === "episode") {
    const ep = episodes.find((e) => e.id === targetId);
    return ep ? `→ Sang tập: ${ep.title || "(chưa đặt tên)"}` : "→ Sang tập (tập đã bị xoá)";
  }
  const e = (blueprint.endings || []).find((x) => x.id === targetId);
  return e ? `→ Kết thúc: ${e.title || "(chưa đặt tên)"}${e.tone === "death" ? " ☠" : ""}` : "→ Kết thúc (đã bị xoá)";
}
function targetLabel(blueprint, choice, episodes) {
  return targetLabelFor(blueprint, choice.targetType, choice.targetId, episodes);
}

// Dùng chung cho đích của lựa chọn CHÍNH lẫn đích của mỗi NHÁNH rẽ điều kiện
// (conditionalOutcomes) — 3 loại đích: Cảnh / Kết thúc game / Sang tập tiếp
// (mục 20 PRO 5 — "episode" chỉ xuất hiện khi có `episodes` khác tập hiện tại,
// tức đang chỉnh trong ngữ cảnh campaign chứ không phải blueprint đơn lẻ).
function TargetSelect({ blueprint, sceneId, targetType, targetId, onChange, onCreateDeathEnding, disabled, episodes = [] }) {
  const value = targetType && targetId ? `${targetType}:${targetId}` : NONE_VALUE;
  const otherScenes = blueprint.scenes.filter((s) => s.id !== sceneId);
  function handleChange(v) {
    if (v === NONE_VALUE) return onChange(null, null);
    if (v === NEW_DEATH_VALUE) return onCreateDeathEnding();
    const [tt, ...rest] = v.split(":");
    onChange(tt, rest.join(":"));
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={value} onValueChange={handleChange} disabled={disabled}>
        <SelectTrigger className="h-8 text-xs w-auto min-w-[220px]"><SelectValue placeholder="Chọn đích..." /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>(chưa nối)</SelectItem>
          {onCreateDeathEnding && <SelectItem value={NEW_DEATH_VALUE}>☠ Kết thúc ngay (tạo kết thúc mới)</SelectItem>}
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
              <SelectLabel>Kết thúc game có sẵn</SelectLabel>
              {blueprint.endings.map((e) => (
                <SelectItem key={e.id} value={`ending:${e.id}`}>{e.tone === "death" ? "☠ " : ""}{e.title || "(chưa đặt tên)"}</SelectItem>
              ))}
            </SelectGroup>
          )}
          {episodes.length > 0 && (
            <SelectGroup>
              <SelectLabel>Sang tập tiếp</SelectLabel>
              {episodes.map((ep) => (
                <SelectItem key={ep.id} value={`episode:${ep.id}`}>Tập {ep.order} — {ep.title || "(chưa đặt tên)"}</SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
      <span className="text-[11px] text-muted-foreground">{targetLabelFor(blueprint, targetType, targetId, episodes)}</span>
    </div>
  );
}

// 1 nhánh rẽ có điều kiện (mục 22) — điều kiện + hệ quả RIÊNG + đích RIÊNG.
// Nếu KHÔNG nhánh nào khớp, hành vi rơi về đúng rules/target của choice cha
// (xem proCompiler.js#compileChoice — nhánh "còn lại").
function OutcomeBranchEditor({ blueprint, sceneId, registry, onRegistryChange, branch, onChange, onRemove, disabled, episodes }) {
  return (
    <div className="rounded-lg border border-violet-400/30 bg-violet-500/5 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <GitBranch className="w-3.5 h-3.5 text-violet-500 shrink-0" />
        <Input
          className="h-7 text-xs flex-1"
          placeholder="Nhãn nhánh (tuỳ chọn, để trống dùng đúng lời lựa chọn)"
          value={branch.label}
          disabled={disabled}
          onChange={(e) => onChange({ ...branch, label: e.target.value })}
        />
        <button type="button" onClick={onRemove} disabled={disabled} className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"><X className="w-3.5 h-3.5" /></button>
      </div>
      <TargetSelect
        blueprint={blueprint}
        sceneId={sceneId}
        targetType={branch.targetType}
        targetId={branch.targetId}
        disabled={disabled}
        episodes={episodes}
        onChange={(tt, tid) => onChange({ ...branch, targetType: tt, targetId: tid })}
      />
      <div>
        <Label className="text-[11px]">Chỉ đi nhánh này nếu</Label>
        <RuleEditor registry={registry} onRegistryChange={onRegistryChange} kind="condition" items={branch.conditions || []} onItemsChange={(next) => onChange({ ...branch, conditions: next })} />
      </div>
      <div>
        <Label className="text-[11px]">Hệ quả riêng của nhánh này</Label>
        <RuleEditor registry={registry} onRegistryChange={onRegistryChange} kind="effect" items={branch.effects || []} onItemsChange={(next) => onChange({ ...branch, effects: next })} />
      </div>
    </div>
  );
}

function ChoiceRow({ blueprint, sceneId, choice, index, onBlueprintChange, registry, onRegistryChange, disabled, episodes }) {
  const [rulesOpen, setRulesOpen] = useState(false);

  function patchChoice(fields) {
    onBlueprintChange(updateChoice(blueprint, sceneId, choice.id, fields));
  }

  function handleTargetChange(targetType, targetId) {
    if (!targetType || !targetId) return onBlueprintChange(disconnectChoice(blueprint, sceneId, choice.id));
    onBlueprintChange(connectChoice(blueprint, sceneId, choice.id, targetType, targetId));
  }
  function handleCreateDeathEnding() {
    onBlueprintChange(connectInstantEnding(blueprint, sceneId, choice.id, { title: "Kết thúc", tone: "death" }));
  }

  const rules = choice.rules || { conditions: [], effects: [] };
  const branches = choice.conditionalOutcomes || [];
  const ruleCount = (rules.conditions?.length || 0) + (rules.effects?.length || 0) + branches.length;

  function updateBranch(i, nextBranch) {
    const next = branches.map((b, bi) => (bi === i ? nextBranch : b));
    patchChoice({ conditionalOutcomes: next });
  }
  function removeBranch(i) {
    patchChoice({ conditionalOutcomes: branches.filter((_, bi) => bi !== i) });
  }
  function addBranch() {
    patchChoice({ conditionalOutcomes: [...branches, newOutcomeBranch()] });
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
          onChange={(e) => patchChoice({ text: e.target.value })}
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
      <div className="pl-7">
        <TargetSelect
          blueprint={blueprint}
          sceneId={sceneId}
          targetType={choice.targetType}
          targetId={choice.targetId}
          disabled={disabled}
          episodes={episodes}
          onChange={handleTargetChange}
          onCreateDeathEnding={handleCreateDeathEnding}
        />
        {branches.length > 0 && <p className="text-[11px] text-violet-500 mt-1">↑ đích này chỉ dùng khi KHÔNG nhánh rẽ nào bên dưới khớp</p>}
      </div>
      <div className="pl-7 space-y-1.5">
        <Input
          className="text-xs h-8"
          placeholder="Ghi chú điều kiện bằng lời, chỉ để đọc (vd: chỉ mở nếu trước đó đã cứu Tiểu Lan)"
          value={choice.gateIntent}
          disabled={disabled}
          onChange={(e) => patchChoice({ gateIntent: e.target.value })}
        />
        <Input
          className="text-xs h-8"
          placeholder="Ghi chú hệ quả bằng lời, chỉ để đọc (vd: mất 5 Uy tín, nhận Ngọc bội)"
          value={choice.effectIntent || ""}
          disabled={disabled}
          onChange={(e) => patchChoice({ effectIntent: e.target.value })}
        />
      </div>

      <div className="pl-7">
        <button type="button" onClick={() => setRulesOpen((v) => !v)} className="text-xs text-primary hover:underline">
          {rulesOpen ? "▾" : "▸"} Luật thật (điều kiện & hệ quả){ruleCount > 0 ? ` · ${ruleCount}` : ""}
        </button>
      </div>

      {rulesOpen && (
        <div className="pl-7 space-y-3 border-l-2 border-primary/20 ml-2">
          <div>
            <Label className="text-[11px]">Điều kiện — chỉ hiện/mở lựa chọn này khi</Label>
            <RuleEditor registry={registry} onRegistryChange={onRegistryChange} kind="condition" items={rules.conditions || []} onItemsChange={(next) => patchChoice({ rules: { ...rules, conditions: next } })} />
          </div>
          <div>
            <Label className="text-[11px]">Hệ quả — khi người chơi chọn đáp án này</Label>
            <RuleEditor registry={registry} onRegistryChange={onRegistryChange} kind="effect" items={rules.effects || []} onItemsChange={(next) => patchChoice({ rules: { ...rules, effects: next } })} />
          </div>
          <div className="space-y-2">
            <Label className="text-[11px]">Rẽ nhánh có điều kiện (mục 22) — cùng 1 hành động, kết quả khác nhau tuỳ điều kiện</Label>
            {branches.map((b, i) => (
              <OutcomeBranchEditor
                key={b.id}
                blueprint={blueprint}
                sceneId={sceneId}
                registry={registry}
                onRegistryChange={onRegistryChange}
                branch={b}
                disabled={disabled}
                episodes={episodes}
                onChange={(next) => updateBranch(i, next)}
                onRemove={() => removeBranch(i)}
              />
            ))}
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={disabled} onClick={addBranch}>
              <Plus className="w-3 h-3 mr-1" /> Thêm rẽ nhánh có điều kiện
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SceneIntentEditor({
  blueprint,
  sceneId,
  onBlueprintChange,
  onClose,
  onRegenerate,
  // PRO 5: registry/onRegistryChange TOÀN CỤC (globalStateModel.js), truyền
  // xuống từ SmartMindMap khi đang chỉnh trong ngữ cảnh campaign. Không
  // truyền (vd nơi gọi cũ/test cũ) -> rơi về hành vi trước PRO 5 y nguyên
  // (đọc/ghi thẳng blueprint.registry).
  registry: registryProp,
  onRegistryChange: onRegistryChangeProp,
  // Các tập KHÁC trong campaign, để chọn đích "Sang tập tiếp" (mục 20) — rỗng
  // nếu đang chỉnh 1 blueprint ngoài ngữ cảnh campaign.
  episodes = [],
}) {
  const scene = findScene(blueprint, sceneId);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const [registryOpen, setRegistryOpen] = useState(false);
  const registry = registryProp || ensureRegistry(blueprint);

  if (!scene) return null;
  const isDecision = scene.role === SCENE_ROLES.DECISION;
  const isEnding = scene.role === SCENE_ROLES.ENDING;
  const disabled = scene.locked;

  function patch(fields) {
    onBlueprintChange(updateScene(blueprint, sceneId, fields));
  }
  function handleRegistryChange(nextRegistry) {
    if (onRegistryChangeProp) return onRegistryChangeProp(nextRegistry);
    onBlueprintChange({ ...blueprint, registry: nextRegistry });
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
                <div className="flex items-center justify-between">
                  <Label>Các lựa chọn hiện tại</Label>
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setRegistryOpen(true)}>
                    <Library className="w-3.5 h-3.5 mr-1" /> Danh mục chỉ số/cờ/vật phẩm
                  </Button>
                </div>
                {scene.choices.length === 0 && <p className="text-xs text-muted-foreground">Chưa có lựa chọn nào.</p>}
                {scene.choices.map((c, i) => (
                  <ChoiceRow
                    key={c.id}
                    blueprint={blueprint}
                    sceneId={sceneId}
                    choice={c}
                    index={i}
                    onBlueprintChange={onBlueprintChange}
                    registry={registry}
                    onRegistryChange={handleRegistryChange}
                    disabled={disabled}
                    episodes={episodes}
                  />
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
      {registryOpen && <EntityRegistryPanel registry={registry} onRegistryChange={handleRegistryChange} onClose={() => setRegistryOpen(false)} />}
    </Dialog>
  );
}
