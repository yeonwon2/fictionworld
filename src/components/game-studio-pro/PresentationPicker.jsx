import React from "react";
import { Image, ImageOff, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listProEffects, listProThemes, ensureProPresentation } from "@/lib/gameStudioPro/presentationModel";

export default function PresentationPicker({ value, onChange }) {
  const selected = ensureProPresentation(value);
  const themes = listProThemes();
  const effects = listProEffects();
  const activeTheme = themes.find((theme) => theme.id === selected.themeId) || themes[0];
  return <section className="glass-card min-w-0 space-y-4 rounded-2xl p-4 sm:p-5" data-testid="pro-presentation-picker">
    <div><h2 className="font-semibold">Giao diện game</h2><p className="mt-1 text-xs text-muted-foreground">Chỉ đổi cách game hiển thị khi chơi thử và xuất bản. Nội dung, luật và chỉ số không thay đổi.</p></div>
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="min-w-0 space-y-1.5">
        <label className="text-sm font-medium" htmlFor="pro-theme-select">Theme</label>
        <Select value={selected.themeId} onValueChange={(themeId) => onChange({ ...selected, themeId })}>
          <SelectTrigger id="pro-theme-select" className="w-full min-w-0"><SelectValue placeholder="Chọn theme" /></SelectTrigger>
          <SelectContent>{themes.map((theme) => <SelectItem key={theme.id} value={theme.id}>{theme.art ? "Có ảnh" : "Không ảnh"} · {theme.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="min-w-0 space-y-1.5">
        <label className="flex items-center gap-1.5 text-sm font-medium" htmlFor="pro-effect-select"><Sparkles className="h-4 w-4" aria-hidden="true" />Hiệu ứng nền</label>
        <Select value={selected.backgroundEffectId} onValueChange={(backgroundEffectId) => onChange({ ...selected, backgroundEffectId })}>
          <SelectTrigger id="pro-effect-select" className="w-full min-w-0"><SelectValue placeholder="Chọn hiệu ứng" /></SelectTrigger>
          <SelectContent>{effects.map((effect) => <SelectItem key={effect.id} value={effect.id}>{effect.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
    {activeTheme && <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-background/60 p-2.5">
      <div className="h-12 w-20 shrink-0 rounded-lg border border-white/10 bg-cover bg-center" style={{ backgroundColor: activeTheme.vars["--rpg-bg"], backgroundImage: activeTheme.art ? `url(${activeTheme.art})` : activeTheme.pattern }} aria-hidden="true" />
      {activeTheme.art ? <Image className="h-4 w-4 shrink-0" aria-hidden="true" /> : <ImageOff className="h-4 w-4 shrink-0" aria-hidden="true" />}
      <div className="min-w-0"><p className="truncate text-sm font-medium">{activeTheme.name}</p><p className="text-xs text-muted-foreground">{effects.find((effect) => effect.id === selected.backgroundEffectId)?.label}</p></div>
    </div>}
    <p className="text-xs text-muted-foreground">Hiệu ứng nhẹ, không âm thanh và tự tắt khi thiết bị bật giảm chuyển động.</p>
  </section>;
}
