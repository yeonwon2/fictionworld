import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from '@/components/ui/select';
import { Plus, Trash2, Image as ImageIcon, Palette } from 'lucide-react';
import { GENRES, ARCHETYPES, GAME_PRESENTATIONS, PRESENTATION_ART, PRESET_AVATARS, THEMES, statsArrayToObject, applyArchetypeStats } from '@/lib/gameStudio/rpgThemes';
import FileUrlInput from '@/components/FileUrlInput';
import { listThemes } from '@/lib/worldcrud';

const BUILTIN_PREFIX = '__builtin__:';

export default function GameMetaConfig({ gameData, setGameData }) {
  const { meta } = gameData;
  const [customThemes, setCustomThemes] = useState([]);
  useEffect(() => { listThemes().then(setCustomThemes).catch(() => {}); }, []);

  const updateMeta = (patch) => {
    setGameData({ ...gameData, meta: { ...meta, ...patch } });
  };

  // Bảng màu có 3 nhóm: (1) mặc định theo Phong cách đang chọn, (2) mọi Theme
  // màu có sẵn (trước đây chỉ gán cứng 1-1 theo Phong cách, không chọn tay
  // được), (3) Theme tự dựng đã lưu ở Xưởng Theme.
  const onCustomThemeChange = (id) => {
    if (id === '__none__') {
      const preset = GAME_PRESENTATIONS[meta.presentation || 'dialogue'];
      updateMeta({ theme: preset?.theme || 'lily-noir', customTheme: undefined });
      return;
    }
    if (id.startsWith(BUILTIN_PREFIX)) {
      const themeId = id.slice(BUILTIN_PREFIX.length);
      if (THEMES[themeId]) updateMeta({ theme: themeId, customTheme: undefined });
      return;
    }
    const picked = customThemes.find((t) => t.id === id);
    if (picked) updateMeta({ theme: 'custom', customTheme: picked.vars });
  };
  const paletteValue = meta.theme === 'custom'
    ? (customThemes.find((t) => JSON.stringify(t.vars) === JSON.stringify(meta.customTheme))?.id || '__custom_unlisted__')
    : (THEMES[meta.theme] && meta.theme !== (GAME_PRESENTATIONS[meta.presentation || 'dialogue']?.theme) ? BUILTIN_PREFIX + meta.theme : '__none__');

  const onArchetypeChange = (archetype) => {
    const statsConfig = applyArchetypeStats(meta.statsConfig, archetype);
    updateMeta({ archetype, statsConfig, initialStats: statsArrayToObject(statsConfig) });
  };

  const onPresentationChange = (presentation) => {
    const preset = GAME_PRESENTATIONS[presentation];
    if (!preset) return;
    const statsConfig = applyArchetypeStats(meta.statsConfig, preset.archetype);
    // Không ghi đè theme nếu người dùng đã tự chọn riêng (theme tự tạo, hoặc 1
    // Theme màu có sẵn khác với mặc định của Phong cách cũ) — và không ghi đè
    // avatar nếu người dùng đã tự đặt — đổi "Phong cách" không nên âm thầm xoá
    // màu/ảnh họ đã tự chọn.
    const oldPreset = GAME_PRESENTATIONS[meta.presentation || 'dialogue'];
    const themeWasCustomized = meta.theme === 'custom' || meta.theme !== (oldPreset?.theme || 'lily-noir');
    const themePatch = themeWasCustomized ? {} : { theme: preset.theme };
    const avatarPatch = meta.playerAvatar ? {} : { playerAvatar: PRESENTATION_ART[presentation] };
    updateMeta({ presentation, ...themePatch, ...avatarPatch, archetype: preset.archetype, statsConfig, initialStats: statsArrayToObject(statsConfig) });
  };

  const updateStat = (idx, patch) => {
    const statsConfig = meta.statsConfig.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    updateMeta({ statsConfig, initialStats: statsArrayToObject(statsConfig) });
  };

  const addStat = () => {
    const key = 'stat_' + Math.random().toString(36).slice(2, 6);
    const statsConfig = [...meta.statsConfig, { key, label: 'Chỉ số mới', default: 0, isVital: false }];
    updateMeta({ statsConfig, initialStats: statsArrayToObject(statsConfig) });
  };

  const removeStat = (idx) => {
    const statsConfig = meta.statsConfig.filter((_, i) => i !== idx);
    updateMeta({ statsConfig, initialStats: statsArrayToObject(statsConfig) });
  };

  const litrpg = meta.litrpg || { ranks: ['Luyện Khí', 'Trúc Cơ', 'Kim Đan', 'Nguyên Anh'], expPerRank: 100 };
  const updateLitrpg = (patch) => updateMeta({ litrpg: { ...litrpg, ...patch } });
  const updateRank = (idx, val) => {
    const ranks = [...litrpg.ranks];
    ranks[idx] = val;
    updateLitrpg({ ranks });
  };
  const addRank = () => updateLitrpg({ ranks: [...litrpg.ranks, 'Cảnh giới mới'] });
  const removeRank = (idx) => updateLitrpg({ ranks: litrpg.ranks.filter((_, i) => i !== idx) });

  const mystery = meta.mystery || { inventorySlots: 4 };

  return (
    <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-4">
      <h3 className="font-semibold text-sm flex items-center gap-2">⚙️ Cấu hình chung (Game Meta)</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Tên tựa game</Label>
          <Input value={meta.title} onChange={(e) => updateMeta({ title: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tác giả</Label>
          <Input value={meta.author || ''} onChange={(e) => updateMeta({ author: e.target.value })} placeholder="Tên tác giả" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Thể loại</Label>
          <Select value={meta.genre} onValueChange={(v) => updateMeta({ genre: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {GENRES.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Theme (giao diện & cách chơi)</Label>
          <Select value={meta.presentation || 'dialogue'} onValueChange={onPresentationChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.values(GAME_PRESENTATIONS).map((p) => <SelectItem key={p.id} value={p.id}>{p.icon} {p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="theme-preview-strip" style={{ backgroundImage: `url(${PRESENTATION_ART[meta.presentation || 'dialogue']})` }}>
        <div><b>{GAME_PRESENTATIONS[meta.presentation || 'dialogue']?.name}</b><span>{GAME_PRESENTATIONS[meta.presentation || 'dialogue']?.description}</span></div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1"><Palette size={12} /> Bảng màu</Label>
        <Select value={paletteValue} onValueChange={onCustomThemeChange}>
          <SelectTrigger><SelectValue placeholder="Dùng bảng màu mặc định của Theme trên" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Dùng bảng màu mặc định của Theme trên</SelectItem>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Theme màu có sẵn</SelectLabel>
              {Object.values(THEMES).map((t) => <SelectItem key={t.id} value={BUILTIN_PREFIX + t.id}>{t.name}</SelectItem>)}
            </SelectGroup>
            {(customThemes.length > 0 || meta.theme === 'custom') && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Theme tự tạo (Xưởng Theme)</SelectLabel>
                  {meta.theme === 'custom' && !customThemes.some((t) => JSON.stringify(t.vars) === JSON.stringify(meta.customTheme)) && (
                    <SelectItem value="__custom_unlisted__">Theme tự tạo (chưa lưu vào Xưởng Theme)</SelectItem>
                  )}
                  {customThemes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectGroup>
              </>
            )}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">Chọn 1 theme màu có sẵn, hoặc 1 theme tự dựng ở "Xưởng Theme" (font/màu/hình dạng riêng), để dùng thay cho bảng màu mặc định của Phong cách ở trên.</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">🎮 Archetype / Cơ chế gameplay</Label>
        <Select value={meta.archetype || 'none'} onValueChange={onArchetypeChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.values(ARCHETYPES).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">{ARCHETYPES[meta.archetype || 'none']?.description}</p>
      </div>

      {meta.archetype === 'litrpg' && (
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 space-y-2">
          <Label className="text-xs font-semibold text-violet-600">⚙️ Cấu hình Hệ Thống (LitRPG)</Label>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Danh sách Cảnh giới (Rank)</Label>
            <div className="space-y-1.5">
              {litrpg.ranks.map((r, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-5">{idx + 1}.</span>
                  <Input value={r} onChange={(e) => updateRank(idx, e.target.value)} className="text-xs h-8" />
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeRank(idx)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={addRank} className="h-7 text-xs"><Plus size={13} className="mr-1" /> Thêm cảnh giới</Button>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">EXP cần để đột phá mỗi cảnh giới</Label>
            <Input type="number" value={litrpg.expPerRank} onChange={(e) => updateLitrpg({ expPerRank: Number(e.target.value) })} className="text-xs h-8 w-32" />
          </div>
        </div>
      )}

      {meta.archetype === 'mystery' && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 space-y-2">
          <Label className="text-xs font-semibold text-rose-600">⚙️ Cấu hình Trinh thám / Kinh dị</Label>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Số slot Túi đồ (Inventory)</Label>
            <Input type="number" min={1} max={12} value={mystery.inventorySlots} onChange={(e) => updateMeta({ mystery: { inventorySlots: Number(e.target.value) } })} className="text-xs h-8 w-32" />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Tên nhân vật chính</Label>
        <Input value={meta.player_name || ''} onChange={(e) => updateMeta({ player_name: e.target.value })} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Tiểu sử nhân vật (hiện trong khung thông tin khi chơi)</Label>
        <Textarea value={meta.player_bio || ''} onChange={(e) => updateMeta({ player_bio: e.target.value })} rows={3} placeholder="Xuất thân, bối cảnh xuyên không, tính cách…" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1"><ImageIcon size={12} /> Avatar nhân vật (tải lên, dán URL, hoặc chọn preset)</Label>
        <FileUrlInput value={meta.playerAvatar || ''} onChange={(url) => updateMeta({ playerAvatar: url })} preview />
        <p className="text-[10px] text-muted-foreground">Avatar tròn nhỏ hiện ở góc trên khi chơi — khác với "Ảnh nhân vật mặc định" (ảnh lớn ở giữa màn hình) bên dưới.</p>
        <div className="flex gap-2 flex-wrap mt-1">
          {PRESET_AVATARS.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => updateMeta({ playerAvatar: url })}
              className={`w-10 h-10 rounded-full overflow-hidden border-2 ${meta.playerAvatar === url ? 'border-primary' : 'border-border'}`}
            >
              <img src={url} alt="avatar" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1"><ImageIcon size={12} /> Ảnh nhân vật mặc định (khung lớn khi chơi)</Label>
        <FileUrlInput value={meta.defaultNpcAvatar || ''} onChange={(url) => updateMeta({ defaultNpcAvatar: url })} preview />
        <p className="text-[10px] text-muted-foreground">
          Dùng chung cho MỌI cảnh trong game — chỉ cần tải 1 lần ở đây. Nếu 1 cảnh cần ảnh riêng (khác cảm xúc, khác nhân vật...),
          vào sửa cảnh đó trong Xưởng Thiết Kế và đặt ảnh riêng — ảnh riêng sẽ được ưu tiên hơn ảnh mặc định này.
          Để trống thì màn hình chơi hiện gradient theo màu theme thay vì ảnh.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Bộ chỉ số nhân vật (Stats Config)</Label>
          <Button size="sm" variant="outline" onClick={addStat} className="h-7 text-xs">
            <Plus size={14} className="mr-1" /> Thêm chỉ số
          </Button>
        </div>
        <div className="space-y-2">
          {meta.statsConfig.map((s, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-lg border border-border p-2">
              <Input value={s.key} onChange={(e) => updateStat(idx, { key: e.target.value.replace(/\s+/g, '_') })} className="w-24 text-xs" placeholder="key" />
              <Input value={s.label} onChange={(e) => updateStat(idx, { label: e.target.value })} className="flex-1 text-xs" placeholder="Tên hiển thị" />
              <Input type="number" value={s.default} onChange={(e) => updateStat(idx, { default: Number(e.target.value) })} className="w-20 text-xs" />
              <label className="flex items-center gap-1 text-xs whitespace-nowrap cursor-pointer">
                <input type="checkbox" checked={!!s.isVital} onChange={(e) => updateStat(idx, { isVital: e.target.checked })} />
                Sinh tử
              </label>
              <Button size="icon" variant="ghost" onClick={() => removeStat(idx)} className="h-7 w-7 text-destructive">
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Đánh dấu "Sinh tử" cho chỉ số nào khi ≤ 0 sẽ kích hoạt Game Over. Các archetype tự thêm chỉ số đặc trưng (SAN, Tri thức kiếp trước...).
        </p>
      </div>
    </section>
  );
}