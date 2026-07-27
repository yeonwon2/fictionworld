import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Trash2, ArrowRight } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { addRelationship, updateRelationship, deleteRelationship } from "@/lib/worldcrud";

// Gợi ý loại quan hệ
const RELATION_TYPES = ["Sư đồ", "Đồng minh", "Kẻ thù", "Huynh đệ", "Huynh muội", "Tình nhân", "Chủ tớ", "Cha con", "Sư đồ nghịch"];

// Form modal Thêm/Sửa mối quan hệ. `relationship` = null → tạo mới.
export default function RelationshipFormModal({
  open,
  relationship,
  characters = [],
  onClose,
  onSaved,
  onDeleted,
}) {
  const isEdit = !!relationship;
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (relationship) {
      setForm({
        source_character_id: relationship.source_character_id || "",
        target_character_id: relationship.target_character_id || "",
        relation_type: relationship.relation_type || "",
        description: relationship.description || "",
      });
    } else {
      setForm({ source_character_id: "", target_character_id: "", relation_type: "", description: "" });
    }
  }, [open, relationship]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.source_character_id || !form.target_character_id) {
      setError("Vui lòng chọn cả hai nhân vật.");
      return;
    }
    if (form.source_character_id === form.target_character_id) {
      setError("Hai nhân vật phải khác nhau.");
      return;
    }
    if (!form.relation_type?.trim()) {
      setError("Vui lòng nhập loại quan hệ.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = isEdit
        ? await updateRelationship(relationship.id, form)
        : await addRelationship(form);
      onSaved?.(result, isEdit ? "update" : "create");
      onClose?.();
    } catch (e) {
      setError(e?.message || "Lỗi khi lưu mối quan hệ.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setConfirmOpen(false);
    try {
      await deleteRelationship(relationship.id);
      onDeleted?.(relationship.id);
      onClose?.();
    } catch (e) {
      setError(e?.message || "Lỗi khi xóa mối quan hệ.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {isEdit ? "Chỉnh sửa mối quan hệ" : "Thêm mối quan hệ"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Chọn hai nhân vật — hiển thị dạng danh sách chọn */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div className="space-y-1.5">
              <Label>Nhân vật A</Label>
              <CharSelect value={form.source_character_id} onChange={set("source_character_id")} characters={characters} placeholder="Chọn A" />
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground mb-2.5" />
            <div className="space-y-1.5">
              <Label>Nhân vật B</Label>
              <CharSelect value={form.target_character_id} onChange={set("target_character_id")} characters={characters} placeholder="Chọn B" />
            </div>
          </div>

          {/* Loại quan hệ (gợi ý bằng datalist) */}
          <div className="space-y-1.5">
            <Label>Loại quan hệ</Label>
            <Input
              list="relation-types"
              value={form.relation_type}
              onChange={(e) => set("relation_type")(e.target.value)}
              placeholder="VD: Sư đồ, Kẻ thù..."
            />
            <datalist id="relation-types">
              {RELATION_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          {/* Mô tả */}
          <div className="space-y-1.5">
            <Label>Mô tả</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              rows={3}
              placeholder="Mô tả ngắn về mối quan hệ..."
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          {isEdit && (
            <Button variant="destructive" onClick={() => setConfirmOpen(true)} type="button" className="mr-auto">
              <Trash2 className="w-4 h-4" /> Xóa
            </Button>
          )}
          <Button variant="outline" onClick={() => onClose?.()} type="button" disabled={saving}>Hủy</Button>
          <Button onClick={handleSave} disabled={saving} type="button">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? "Lưu thay đổi" : "Tạo quan hệ"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Xóa mối quan hệ này?"
        description="Đường nối giữa hai nhân vật sẽ bị gỡ khỏi sơ đồ."
        onConfirm={handleDelete}
      />
    </Dialog>
  );
}

// Ô chọn nhân vật hiển thị tên + ảnh nhỏ
function CharSelect({ value, onChange, characters, placeholder }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="">{placeholder}</option>
      {characters.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}