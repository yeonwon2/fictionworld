// Xưởng Game Pro — PRO 6: CHỌN KIỂU GAME (mục 22) + áp dụng an toàn, additive
// (mục 15/16/17). Đây KHÔNG phải giao diện/theme game (mục 22 nhắc rõ — việc
// đó để PRO 8) — chỉ là chọn 1 bộ khởi tạo registry/mechanics đề xuất.
// Preview luôn hiện "Sẽ thêm / Đã tồn tại / Xung đột" trước khi cho áp dụng —
// không bao giờ silent-overwrite (mục 15).
import React, { useState } from "react";
import { Check, Plus, AlertTriangle, Equal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TEMPLATES, previewTemplate, applyTemplate } from "@/lib/gameStudioPro/templateRegistry.js";
import { newEmptyRegistry } from "@/lib/gameStudioPro/entityRegistry.js";

function TemplateCard({ template, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(template.id)}
      className={`text-left rounded-xl border p-3 space-y-1 transition ${selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{template.label}</span>
        {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
      </div>
      <p className="text-[11px] text-muted-foreground">{template.description}</p>
    </button>
  );
}

function PreviewPanel({ registry, templateId }) {
  const preview = previewTemplate(registry, templateId);
  if (!preview.template) return null;
  return (
    <div className="rounded-xl border border-dashed border-border p-3 space-y-2 text-xs">
      {preview.toAdd.length > 0 && (
        <div className="space-y-1">
          <p className="font-semibold flex items-center gap-1.5 text-emerald-600"><Plus className="w-3.5 h-3.5" /> Sẽ thêm</p>
          {preview.toAdd.map((s, i) => <p key={i} className="pl-5 text-muted-foreground">{s.displayName}</p>)}
        </div>
      )}
      {preview.existing.length > 0 && (
        <div className="space-y-1">
          <p className="font-semibold flex items-center gap-1.5 text-muted-foreground"><Equal className="w-3.5 h-3.5" /> Đã tồn tại (dùng lại, không tạo trùng)</p>
          {preview.existing.map((x, i) => <p key={i} className="pl-5 text-muted-foreground">{x.entity.displayName}</p>)}
        </div>
      )}
      {preview.conflicts.length > 0 && (
        <div className="space-y-1">
          <p className="font-semibold flex items-center gap-1.5 text-amber-600"><AlertTriangle className="w-3.5 h-3.5" /> Xung đột (bỏ qua, không tự thêm)</p>
          {preview.conflicts.map((c, i) => <p key={i} className="pl-5 text-amber-600">{c.reason}</p>)}
        </div>
      )}
      {preview.toAdd.length === 0 && preview.existing.length === 0 && preview.conflicts.length === 0 && (
        <p className="text-muted-foreground">Kiểu game này không đề xuất chỉ số/quan hệ/cờ/vật phẩm nào.</p>
      )}
    </div>
  );
}

// `proDoc`/`onApply(nextProDoc)`: dùng khi áp vào 1 proDoc đã có (PlannerEditor
// re-apply — Dialog). `onSelect(templateId)`: dùng ở màn tạo game mới
// (PlannerIntro — chưa có proDoc thật, chỉ cần biết đã chọn gì để truyền vào
// settings.templateId + áp registry/mechanics ngay khi tạo).
export default function TemplatePicker({ proDoc, selectedId: controlledSelectedId, onSelect, onApply, onClose, asDialog = false }) {
  const [internalSelectedId, setInternalSelectedId] = useState(controlledSelectedId || proDoc?.templateId || null);
  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;
  const registry = proDoc?.globalState?.registry || newEmptyRegistry();

  function handleSelect(id) {
    if (onSelect) onSelect(id);
    else setInternalSelectedId(id);
  }

  function confirm() {
    if (!selectedId || !proDoc || !onApply) return;
    onApply(applyTemplate(proDoc, selectedId));
    onClose?.();
  }

  const content = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {TEMPLATES.map((t) => (
          <TemplateCard key={t.id} template={t} selected={selectedId === t.id} onSelect={handleSelect} />
        ))}
      </div>
      {selectedId && selectedId !== "blank" && <PreviewPanel registry={registry} templateId={selectedId} />}
      {onApply && (
        <div className="flex justify-end gap-2">
          {onClose && <Button type="button" variant="ghost" onClick={onClose}>Huỷ</Button>}
          <Button type="button" onClick={confirm} disabled={!selectedId}>Áp dụng</Button>
        </div>
      )}
    </div>
  );

  if (!asDialog) return content;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chọn kiểu game</DialogTitle>
          <DialogDescription>Chỉ đề xuất chỉ số/cơ chế khởi đầu — không xoá/ghi đè gì đã có, không phải giao diện/theme.</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
