// Xưởng Game Pro — PRO 6: CƠ CHẾ GAME (mục 21) — bật/tắt mechanic + cấu hình
// đơn giản bằng thẻ, KHÔNG bao giờ hiện entityId/stat_compare/statRequirements
// hay bất kỳ field kỹ thuật nào ra người dùng (mục 21 yêu cầu rõ). Mỗi
// mechanic hoặc dùng THẲNG entity/rule đã có (Quan hệ/Sinh tử/Vật phẩm/Cờ —
// không cấu hình gì thêm ở đây, chỉ là công tắc bật hiển thị) hoặc chỉ trỏ
// `entityId` vào 1 stat đã có trong registry (Tiền tệ/Cấp bậc) — không sở
// hữu bản sao riêng (bài học FIX1 PRO5).
import React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  MECHANIC_IDS,
  MECHANIC_DEFS,
  SUPPORT_LEVELS,
  isMechanicEnabled,
  toggleMechanic,
  addCurrencyConfig,
  removeCurrencyConfig,
  addRankConfig,
  removeRankConfig,
  addRankLevel,
  removeRankLevel,
  addQuestNote,
  removeQuestNote,
  setSystemConfig,
} from "@/lib/gameStudioPro/mechanicsModel.js";
import { ENTITY_KINDS, listEntities } from "@/lib/gameStudioPro/entityRegistry.js";

const SUPPORT_BADGE = {
  [SUPPORT_LEVELS.SUPPORTED]: null,
  [SUPPORT_LEVELS.AUTHORING_ONLY]: "Hiện dùng để hỗ trợ thiết kế; game chưa tự chạy cơ chế này.",
  [SUPPORT_LEVELS.DEFERRED_RUNTIME]: "Nhiệm vụ hiện dùng để lập kế hoạch. Game chưa tự theo dõi tiến độ nhiệm vụ.",
};

function StatSelect({ registry, value, onChange, placeholder = "Chọn chỉ số..." }) {
  const stats = listEntities(registry, ENTITY_KINDS.STAT);
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{stats.map((s) => <SelectItem key={s.id} value={s.id}>{s.displayName}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function CurrencySection({ registry, mechanics, onChange }) {
  return (
    <div className="space-y-1.5 pl-6">
      {mechanics.configs.currency.map((c) => {
        const entity = listEntities(registry, ENTITY_KINDS.STAT).find((s) => s.id === c.entityId);
        return (
          <div key={c.id} className="flex items-center gap-1.5 text-xs">
            <StatSelect registry={registry} value={c.entityId} onChange={(entityId) => onChange({ ...mechanics, configs: { ...mechanics.configs, currency: mechanics.configs.currency.map((x) => (x.id === c.id ? { ...x, entityId } : x)) } })} />
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Checkbox checked={c.allowNegative} onCheckedChange={(v) => onChange({ ...mechanics, configs: { ...mechanics.configs, currency: mechanics.configs.currency.map((x) => (x.id === c.id ? { ...x, allowNegative: !!v } : x)) } })} />
              Cho phép âm
            </label>
            {!entity && <span className="text-[11px] text-destructive">(chưa chọn chỉ số)</span>}
            <button type="button" onClick={() => onChange(removeCurrencyConfig(mechanics, c.id))} className="p-1 text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
          </div>
        );
      })}
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => onChange(addCurrencyConfig(mechanics, {}))}>
        <Plus className="w-3 h-3 mr-1" /> Thêm loại tiền tệ
      </Button>
    </div>
  );
}

function RankLevelRow({ rank, level, mechanics, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <Input className="h-7 text-xs flex-1" placeholder="Tên mốc — vd: Nữ quan" value={level.label} onChange={(e) => onChange({ ...mechanics, configs: { ...mechanics.configs, rank: mechanics.configs.rank.map((r) => (r.id === rank.id ? { ...r, levels: r.levels.map((lv) => (lv.id === level.id ? { ...lv, label: e.target.value } : lv)) } : r)) } })} />
      <Input className="h-7 text-xs w-20" type="number" placeholder="Ngưỡng" value={level.threshold} onChange={(e) => onChange({ ...mechanics, configs: { ...mechanics.configs, rank: mechanics.configs.rank.map((r) => (r.id === rank.id ? { ...r, levels: r.levels.map((lv) => (lv.id === level.id ? { ...lv, threshold: Number(e.target.value) || 0 } : lv)) } : r)) } })} />
      <button type="button" onClick={() => onChange(removeRankLevel(mechanics, rank.id, level.id))} className="p-1 text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function RankSection({ registry, mechanics, onChange }) {
  return (
    <div className="space-y-3 pl-6">
      {mechanics.configs.rank.map((rank) => (
        <div key={rank.id} className="rounded-lg border border-border p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Input className="h-7 text-xs flex-1" value={rank.label} onChange={(e) => onChange({ ...mechanics, configs: { ...mechanics.configs, rank: mechanics.configs.rank.map((r) => (r.id === rank.id ? { ...r, label: e.target.value } : r)) } })} />
            <StatSelect registry={registry} value={rank.entityId} onChange={(entityId) => onChange({ ...mechanics, configs: { ...mechanics.configs, rank: mechanics.configs.rank.map((r) => (r.id === rank.id ? { ...r, entityId } : r)) } })} placeholder="Theo chỉ số..." />
            <button type="button" onClick={() => onChange(removeRankConfig(mechanics, rank.id))} className="p-1 text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="space-y-1 pl-2">
            {rank.levels.map((lv) => <RankLevelRow key={lv.id} rank={rank} level={lv} mechanics={mechanics} onChange={onChange} />)}
          </div>
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => onChange(addRankLevel(mechanics, rank.id, {}))}>
            <Plus className="w-3 h-3 mr-1" /> Thêm mốc
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => onChange(addRankConfig(mechanics, { label: "Cấp bậc mới" }))}>
        <Plus className="w-3 h-3 mr-1" /> Thêm thang cấp bậc
      </Button>
    </div>
  );
}

function QuestSection({ mechanics, onChange }) {
  return (
    <div className="space-y-1.5 pl-6">
      {mechanics.configs.quest.map((q) => (
        <div key={q.id} className="rounded-lg border border-border p-2 space-y-1">
          <div className="flex items-center gap-1.5">
            <Input className="h-7 text-xs flex-1" placeholder="Tên nhiệm vụ" value={q.title} onChange={(e) => onChange({ ...mechanics, configs: { ...mechanics.configs, quest: mechanics.configs.quest.map((x) => (x.id === q.id ? { ...x, title: e.target.value } : x)) } })} />
            <button type="button" onClick={() => onChange(removeQuestNote(mechanics, q.id))} className="p-1 text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
          </div>
          <Input className="h-7 text-xs" placeholder="Điều kiện hoàn thành (ghi chú)" value={q.completionIntent} onChange={(e) => onChange({ ...mechanics, configs: { ...mechanics.configs, quest: mechanics.configs.quest.map((x) => (x.id === q.id ? { ...x, completionIntent: e.target.value } : x)) } })} />
          <Input className="h-7 text-xs" placeholder="Phần thưởng (ghi chú)" value={q.rewardIntent} onChange={(e) => onChange({ ...mechanics, configs: { ...mechanics.configs, quest: mechanics.configs.quest.map((x) => (x.id === q.id ? { ...x, rewardIntent: e.target.value } : x)) } })} />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => onChange(addQuestNote(mechanics, {}))}>
        <Plus className="w-3 h-3 mr-1" /> Thêm ghi chú nhiệm vụ
      </Button>
    </div>
  );
}

function SystemSection({ mechanics, onChange }) {
  return (
    <div className="space-y-1.5 pl-6">
      <Input className="h-7 text-xs" placeholder="Tên hệ thống — vd: Hệ Thống Sinh Tồn" value={mechanics.configs.system.name} onChange={(e) => onChange(setSystemConfig(mechanics, { name: e.target.value }))} />
      <p className="text-[11px] text-muted-foreground">Dùng hệ quả "Hiện thông báo" trong ô soạn luật của mỗi lựa chọn để hiện thông báo hệ thống.</p>
    </div>
  );
}

function MechanicCard({ id, registry, mechanics, onChange }) {
  const def = MECHANIC_DEFS[id];
  const enabled = isMechanicEnabled(mechanics, id);
  const note = SUPPORT_BADGE[def.supportLevel];
  return (
    <div className="rounded-xl border border-border p-3 space-y-2">
      <label className="flex items-start gap-2 cursor-pointer">
        <Checkbox checked={enabled} onCheckedChange={(v) => onChange(toggleMechanic(mechanics, id, !!v))} className="mt-0.5" />
        <span>
          <span className="text-sm font-medium">{def.icon} {def.label}</span>
          <p className="text-[11px] text-muted-foreground">{def.description}</p>
          {note && <p className="text-[11px] text-amber-600">{note}</p>}
        </span>
      </label>
      {enabled && id === MECHANIC_IDS.CURRENCY && <CurrencySection registry={registry} mechanics={mechanics} onChange={onChange} />}
      {enabled && id === MECHANIC_IDS.RANK && <RankSection registry={registry} mechanics={mechanics} onChange={onChange} />}
      {enabled && id === MECHANIC_IDS.QUEST && <QuestSection mechanics={mechanics} onChange={onChange} />}
      {enabled && id === MECHANIC_IDS.SYSTEM && <SystemSection mechanics={mechanics} onChange={onChange} />}
    </div>
  );
}

export default function MechanicsPanel({ registry, mechanics, onMechanicsChange, onClose }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cơ chế game</DialogTitle>
          <DialogDescription>Bật cơ chế game muốn dùng — Chỉ số/Cờ/Vật phẩm/Quan hệ luôn sẵn có, không cần bật riêng.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {Object.values(MECHANIC_IDS).map((id) => (
            <MechanicCard key={id} id={id} registry={registry} mechanics={mechanics} onChange={onMechanicsChange} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
