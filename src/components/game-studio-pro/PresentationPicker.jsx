import React from "react";
import { Check, Image, ImageOff, Sparkles } from "lucide-react";
import { listProEffects, listProThemes, ensureProPresentation } from "@/lib/gameStudioPro/presentationModel";

export default function PresentationPicker({ value, onChange }) {
  const selected = ensureProPresentation(value);
  return <section className="glass-card min-w-0 space-y-4 rounded-2xl p-4 sm:p-5" data-testid="pro-presentation-picker">
    <div><h2 className="font-semibold">Giao diện game</h2><p className="mt-1 text-xs text-muted-foreground">Chỉ đổi cách game hiển thị khi chơi thử và xuất bản. Nội dung, luật và chỉ số không thay đổi.</p></div>
    <div className="space-y-2"><h3 className="text-sm font-medium">Chọn giao diện</h3><div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {listProThemes().map((theme) => { const active = selected.themeId === theme.id; return <button key={theme.id} type="button" aria-pressed={active} onClick={() => onChange({ ...selected, themeId: theme.id })} className={`min-w-0 overflow-hidden rounded-xl border p-3 text-left transition ${active ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"}`}>
        <div className="mb-2 h-16 rounded-lg border border-white/10 bg-cover bg-center" style={{ backgroundColor: theme.vars["--rpg-bg"], backgroundImage: theme.art ? `url(${theme.art})` : theme.pattern }} aria-hidden="true" />
        <div className="flex min-w-0 items-start gap-2">{theme.art ? <Image className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <ImageOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}<span className="min-w-0 flex-1 break-words text-sm font-medium">{theme.art ? "Có ảnh" : "Không ảnh"} · {theme.name}</span>{active && <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Đang chọn" />}</div>
      </button>; })}
    </div></div>
    <div className="space-y-2"><h3 className="flex items-center gap-1.5 text-sm font-medium"><Sparkles className="h-4 w-4" aria-hidden="true" />Hiệu ứng nền</h3><div className="flex min-w-0 flex-wrap gap-2">
      {listProEffects().map((effect) => <button key={effect.id} type="button" aria-pressed={selected.backgroundEffectId === effect.id} onClick={() => onChange({ ...selected, backgroundEffectId: effect.id })} className={`min-h-10 rounded-full border px-3 text-xs ${selected.backgroundEffectId === effect.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent"}`}>{effect.label}</button>)}
    </div><p className="text-xs text-muted-foreground">Hiệu ứng nhẹ, không âm thanh và tự tắt khi thiết bị bật giảm chuyển động.</p></div>
  </section>;
}
