// Xưởng Game Pro — PRO 3: DANH MỤC (Entity Registry) — nơi khai báo chỉ số/
// quan hệ/cờ/vật phẩm CÓ TÊN CHUẨN cho cả tập, để luật không tự tạo "Uy tín"/
// "uy tin"/"Điểm uy tín" thành nhiều biến khác nhau (mục 10 yêu cầu PRO 3).
import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ENTITY_KINDS,
  listEntities,
  addStatEntity,
  addRelationshipEntity,
  addFlagEntity,
  addItemEntity,
  updateEntity,
  removeEntity,
  findRelationshipNpcCollisions,
} from "@/lib/gameStudioPro/entityRegistry.js";

function StatRow({ registry, entity, onChange }) {
  return (
    <div className="rounded-lg border border-border p-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Input className="h-7 text-xs flex-1" value={entity.displayName} onChange={(e) => onChange(updateEntity(registry, ENTITY_KINDS.STAT, entity.id, { displayName: e.target.value }))} />
        <Input className="h-7 text-xs w-20" type="number" title="Giá trị khởi đầu" value={entity.default} onChange={(e) => onChange(updateEntity(registry, ENTITY_KINDS.STAT, entity.id, { default: Number(e.target.value) || 0 }))} />
        <button type="button" onClick={() => onChange(removeEntity(registry, ENTITY_KINDS.STAT, entity.id))} className="p-1 text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
      </div>
      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground pl-1">
        <Checkbox checked={entity.isVital} onCheckedChange={(v) => onChange(updateEntity(registry, ENTITY_KINDS.STAT, entity.id, { isVital: !!v, deathThreshold: v ? (entity.deathThreshold ?? 0) : undefined }))} />
        Chỉ số sinh tử (Game Over khi chạm ngưỡng)
      </label>
      {entity.isVital && (
        <div className="flex items-center gap-1.5 pl-6">
          <Label className="text-[11px]">Ngưỡng thua (≤)</Label>
          <Input className="h-7 text-xs w-20" type="number" value={entity.deathThreshold ?? 0} onChange={(e) => onChange(updateEntity(registry, ENTITY_KINDS.STAT, entity.id, { deathThreshold: Number(e.target.value) || 0 }))} />
        </div>
      )}
    </div>
  );
}

function RelationshipRow({ registry, entity, onChange, collision }) {
  return (
    <div className={`rounded-lg border p-2 space-y-1 ${collision ? "border-amber-500/50 bg-amber-500/5" : "border-border"}`}>
      <div className="flex items-center gap-1.5">
        <Input className="h-7 text-xs flex-1" placeholder="Nhãn hiển thị — vd: Sủng ái Lệ Phi" value={entity.displayName} onChange={(e) => onChange(updateEntity(registry, ENTITY_KINDS.RELATIONSHIP, entity.id, { displayName: e.target.value }))} />
        <Input className="h-7 text-xs w-32" placeholder="Tên NPC" value={entity.npc} onChange={(e) => onChange(updateEntity(registry, ENTITY_KINDS.RELATIONSHIP, entity.id, { npc: e.target.value }))} />
        <button type="button" onClick={() => onChange(removeEntity(registry, ENTITY_KINDS.RELATIONSHIP, entity.id))} className="p-1 text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
      </div>
      {collision && <p className="text-[11px] text-amber-600 pl-1">⚠ Có mục quan hệ khác cũng dùng NPC "{entity.npc}" — engine chỉ có 1 trục thiện cảm/NPC, hai mục này sẽ cộng dồn vào cùng 1 số.</p>}
    </div>
  );
}

function SimpleRow({ registry, kind, entity, onChange }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border p-2">
      <Input className="h-7 text-xs flex-1" value={entity.displayName} onChange={(e) => onChange(updateEntity(registry, kind, entity.id, { displayName: e.target.value }))} />
      <button type="button" onClick={() => onChange(removeEntity(registry, kind, entity.id))} className="p-1 text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function AddRow({ placeholder, onAdd }) {
  const [value, setValue] = useState("");
  function submit() {
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue("");
  }
  return (
    <div className="flex items-center gap-1.5">
      <Input className="h-7 text-xs flex-1" placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())} />
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={submit}><Plus className="w-3 h-3 mr-1" />Thêm</Button>
    </div>
  );
}

export default function EntityRegistryPanel({ registry, onRegistryChange, onClose }) {
  const stats = listEntities(registry, ENTITY_KINDS.STAT);
  const relationships = listEntities(registry, ENTITY_KINDS.RELATIONSHIP);
  const flags = listEntities(registry, ENTITY_KINDS.FLAG);
  const items = listEntities(registry, ENTITY_KINDS.ITEM);
  const collisions = new Set(findRelationshipNpcCollisions(registry).flat().map((e) => e.id));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chỉ số & trạng thái</DialogTitle>
          <DialogDescription>Những dữ liệu người chơi có thể tích luỹ, nhận được hoặc dùng làm điều kiện trong toàn game.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">Chỉ số ({stats.length})</h4>
            {stats.map((e) => <StatRow key={e.id} registry={registry} entity={e} onChange={onRegistryChange} />)}
            <AddRow placeholder='Chỉ số mới — vd: "Uy tín"' onAdd={(name) => onRegistryChange(addStatEntity(registry, { displayName: name }))} />
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">Quan hệ / thiện cảm ({relationships.length})</h4>
            {relationships.map((e) => <RelationshipRow key={e.id} registry={registry} entity={e} onChange={onRegistryChange} collision={collisions.has(e.id)} />)}
            <AddRow placeholder='Quan hệ mới — vd: "Sủng ái Lệ Phi"' onAdd={(name) => onRegistryChange(addRelationshipEntity(registry, { displayName: name, npc: name }))} />
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">Cờ truyện ({flags.length})</h4>
            {flags.map((e) => <SimpleRow key={e.id} registry={registry} kind={ENTITY_KINDS.FLAG} entity={e} onChange={onRegistryChange} />)}
            <AddRow placeholder='Cờ mới — vd: "Đã cứu Tiểu Lan"' onAdd={(name) => onRegistryChange(addFlagEntity(registry, name))} />
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">Vật phẩm ({items.length})</h4>
            {items.map((e) => <SimpleRow key={e.id} registry={registry} kind={ENTITY_KINDS.ITEM} entity={e} onChange={onRegistryChange} />)}
            <AddRow placeholder='Vật phẩm mới — vd: "Ngọc bội"' onAdd={(name) => onRegistryChange(addItemEntity(registry, name))} />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
