import React, { useEffect, useState } from 'react';
import { ArrowLeft, Palette, Plus, Trash2, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { listThemes, createTheme, updateTheme, deleteTheme } from '@/lib/worldcrud';
import { VNScenePanel } from '@/components/game-studio/player/GamePlayer';
import { FONT_OPTIONS, BUTTON_SHAPES, PANEL_SHAPES, BG_PATTERNS, THEME_EFFECTS, defaultCustomTheme, customThemeStyle } from '@/lib/gameStudio/rpgThemes';

const COLOR_FIELDS = [
  { key: 'bg', label: 'Nền tổng' },
  { key: 'panel', label: 'Khung chính' },
  { key: 'panel2', label: 'Khung phụ' },
  { key: 'text', label: 'Chữ' },
  { key: 'muted', label: 'Chữ mờ' },
  { key: 'accent', label: 'Màu nhấn 1' },
  { key: 'accent2', label: 'Màu nhấn 2' },
  { key: 'border', label: 'Viền' },
];

const DEMO_NODE = {
  speaker: 'Trần Sương',
  text: '"Nếu hôm nay ta không cứu ngươi, ngươi sẽ chết sao?"',
  npcAvatar: '',
  choices: [
    { text: '"Ta không biết."' },
    { text: '"Ta sẽ tự cứu mình."' },
    { text: '"Im lặng."' },
  ],
};
const okStatus = () => ({ ok: true });
const noop = () => {};
// Demo cho khối "Lượt N" + thẻ "Bạn đã chọn" trong preview — không có ý nghĩa
// gameplay thật, chỉ để người dùng thấy rõ 2 khối UI này lên màu/font ra sao.
const DEMO_DELTAS = { 'Tâm cảnh': 5, 'Trí nhớ': -2 };
const DEMO_LAST_CHOICE = '"Ta sẽ tự cứu mình."';

// Input type=color không hiểu hex 8 ký tự (có kênh alpha) — cắt về 6 ký tự chỉ
// để hiển thị đúng màu trên nút chọn màu; ô nhập chữ bên cạnh vẫn giữ nguyên
// giá trị đầy đủ (kể cả alpha) để chỉnh tay.
function swatchHex(value) {
  if (!value) return '#000000';
  return /^#[0-9a-fA-F]{6}/.test(value) ? value.slice(0, 7) : '#000000';
}

function ColorField({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={swatchHex(value)} onChange={(e) => onChange(e.target.value)} className="w-9 h-9 rounded-lg border border-border cursor-pointer shrink-0 bg-transparent" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-muted-foreground truncate">{label}</div>
        <Input value={value || ''} onChange={(e) => onChange(e.target.value)} className="h-7 text-xs font-mono" />
      </div>
    </div>
  );
}

function ShapeSwatch({ active, onClick, children, label }) {
  return (
    <button type="button" onClick={onClick} className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
      {children}
      <span className="text-[10px] text-center leading-tight">{label}</span>
    </button>
  );
}

export default function ThemeWorkshop({ onBack }) {
  const { toast } = useToast();
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('Theme mới');
  const [vars, setVars] = useState(defaultCustomTheme());
  const [choicesOpen, setChoicesOpen] = useState(true);

  function load() {
    setLoading(true);
    listThemes().then(setThemes).catch((e) => toast({ variant: 'destructive', title: 'Không tải được danh sách theme', description: e.message })).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const patchColors = (key, val) => setVars((v) => ({ ...v, colors: { ...v.colors, [key]: val } }));

  function openNew() {
    setEditingId(null);
    setName('Theme mới');
    setVars(defaultCustomTheme());
  }
  function openExisting(t) {
    setEditingId(t.id);
    setName(t.name);
    setVars(t.vars || defaultCustomTheme());
  }
  async function save() {
    setSaving(true);
    try {
      if (editingId) {
        await updateTheme(editingId, { name, vars });
        toast({ title: 'Đã cập nhật theme' });
      } else {
        const row = await createTheme({ name, vars });
        setEditingId(row.id);
        toast({ title: 'Đã lưu thành theme mẫu' });
      }
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Không lưu được theme', description: e.message });
    } finally {
      setSaving(false);
    }
  }
  async function remove(id) {
    if (!window.confirm('Xoá theme này? Không thể hoàn tác.')) return;
    try {
      await deleteTheme(id);
      if (editingId === id) openNew();
      setThemes((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      toast({ variant: 'destructive', title: 'Không xoá được', description: e.message });
    }
  }

  const previewStyle = customThemeStyle(vars);

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 glass-panel border-b">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground shrink-0" title="Quay lại thư viện">
            <ArrowLeft size={18} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-orange-400 flex items-center justify-center shadow-lg shrink-0">
            <Palette size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base leading-tight truncate">Xưởng Theme</h1>
            <p className="text-[11px] text-muted-foreground leading-tight truncate">Tự dựng theme riêng — font, màu, hình dạng nút/khung, nền trang trí</p>
          </div>
          <Button size="sm" onClick={save} disabled={saving} className="ml-auto shrink-0">
            {saving ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Check size={14} className="mr-1.5" />}
            {editingId ? 'Lưu thay đổi' : 'Lưu thành theme mẫu'}
          </Button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-3 sm:px-4 py-4 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        {/* Live preview */}
        <div className="space-y-3">
          <div className="space-y-1.5 max-w-sm">
            <Label className="text-xs">Tên theme</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="vd: Ấm áp cổ điển" />
          </div>
          <div style={previewStyle} data-bg-pattern={vars.bgPattern} data-panel-shape={vars.panelShape} className="rpg-root rounded-2xl overflow-hidden p-4 relative" >
            <div className={`rpg-effect rpg-effect-${vars.effect || 'none'}`} aria-hidden="true" />
            <div className="rounded-xl p-2.5 mb-3 flex items-center gap-2.5" style={{ background: 'color-mix(in srgb, var(--rpg-panel) 65%, transparent)', border: '1px solid var(--rpg-accent)44' }}>
              <div className="w-11 h-11 rounded-full shrink-0" style={{ background: 'var(--rpg-accent2)', border: '2px solid var(--rpg-accent)' }} />
              <div>
                <div className="font-bold text-sm" style={{ color: 'var(--rpg-text)', fontFamily: 'var(--rpg-font)' }}>Trần Sương</div>
                <div className="flex gap-1.5 mt-1">
                  {['Tâm cảnh 80', 'Trí nhớ 100', 'Quan hệ 20'].map((s) => (
                    <span key={s} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--rpg-accent)1f', border: '1px solid var(--rpg-accent)66', color: 'var(--rpg-accent)' }}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
            <VNScenePanel
              node={DEMO_NODE} typed={DEMO_NODE.text} typingDone skipTyping={noop} choiceStatus={okStatus} choose={noop} statsConfig={[]}
              turn={2} lastChoiceText={DEMO_LAST_CHOICE} lastDeltas={DEMO_DELTAS}
              choicesOpen={choicesOpen} setChoicesOpen={setChoicesOpen}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <section className="glass-card rounded-2xl p-4 space-y-2.5">
            <Label className="text-xs font-semibold">🎨 Bảng màu</Label>
            <div className="grid grid-cols-1 gap-2">
              {COLOR_FIELDS.map((f) => (
                <ColorField key={f.key} label={f.label} value={vars.colors?.[f.key]} onChange={(val) => patchColors(f.key, val)} />
              ))}
            </div>
          </section>

          <section className="glass-card rounded-2xl p-4 space-y-2.5">
            <Label className="text-xs font-semibold">✍️ Font chữ</Label>
            <div className="space-y-1.5">
              {FONT_OPTIONS.map((f) => (
                <button key={f.id} type="button" onClick={() => setVars((v) => ({ ...v, font: f.id }))}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${vars.font === f.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                  style={{ fontFamily: f.family }}>
                  {f.label}
                </button>
              ))}
            </div>
          </section>

          <section className="glass-card rounded-2xl p-4 space-y-2.5">
            <Label className="text-xs font-semibold">🔘 Hình dạng nút bấm</Label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(BUTTON_SHAPES).map(([id, s]) => (
                <ShapeSwatch key={id} active={vars.buttonShape === id} label={s.label} onClick={() => setVars((v) => ({ ...v, buttonShape: id }))}>
                  <div className="w-full h-6" style={{ background: 'var(--foreground, #888)', opacity: .5, borderRadius: s.radius }} />
                </ShapeSwatch>
              ))}
            </div>
          </section>

          <section className="glass-card rounded-2xl p-4 space-y-2.5">
            <Label className="text-xs font-semibold">💬 Hình dạng khung thoại</Label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PANEL_SHAPES).map(([id, s]) => (
                <ShapeSwatch key={id} active={vars.panelShape === id} label={s.label} onClick={() => setVars((v) => ({ ...v, panelShape: id }))}>
                  <div className="w-full h-8" style={{ background: 'var(--foreground, #888)', opacity: .5, borderRadius: s.radius }} />
                </ShapeSwatch>
              ))}
            </div>
          </section>

          <section className="glass-card rounded-2xl p-4 space-y-2.5">
            <Label className="text-xs font-semibold">🌌 Nền trang trí</Label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(BG_PATTERNS).map(([id, s]) => (
                <ShapeSwatch key={id} active={vars.bgPattern === id} label={s.label} onClick={() => setVars((v) => ({ ...v, bgPattern: id }))}>
                  <div className="w-full h-6 rounded-md" style={{ background: 'var(--foreground, #888)', opacity: .15 }} />
                </ShapeSwatch>
              ))}
            </div>
          </section>

          <section className="glass-card rounded-2xl p-4 space-y-2.5">
            <Label className="text-xs font-semibold">✨ Hiệu ứng nền (động)</Label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(THEME_EFFECTS).map(([id, s]) => (
                <ShapeSwatch key={id} active={vars.effect === id} label={s.label} onClick={() => setVars((v) => ({ ...v, effect: id }))}>
                  <div className="relative w-full h-6 overflow-hidden rounded-md">
                    <div className={`rpg-effect rpg-effect-${id}`} />
                  </div>
                </ShapeSwatch>
              ))}
            </div>
          </section>
        </div>
      </main>

      <section className="max-w-[1400px] mx-auto px-3 sm:px-4 pb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm">Theme đã lưu</h2>
          <Button size="sm" variant="outline" onClick={openNew} className="h-7 text-xs"><Plus size={13} className="mr-1" /> Theme mới</Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        ) : themes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Chưa có theme nào được lưu.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {themes.map((t) => (
              <div key={t.id} className={`rounded-xl border p-3 cursor-pointer transition ${editingId === t.id ? 'border-primary' : 'border-border hover:border-primary/40'}`} onClick={() => openExisting(t)}>
                <div className="flex gap-1 mb-2">
                  {['bg', 'panel', 'accent', 'accent2'].map((k) => (
                    <div key={k} className="w-5 h-5 rounded-full border border-border/50" style={{ background: t.vars?.colors?.[k] || '#888' }} />
                  ))}
                </div>
                <div className="text-xs font-medium truncate">{t.name}</div>
                <button onClick={(e) => { e.stopPropagation(); remove(t.id); }} className="mt-1.5 text-[10px] text-destructive flex items-center gap-1"><Trash2 size={10} /> Xoá</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
