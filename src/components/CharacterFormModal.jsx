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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Loader2, Save, Trash2 } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import FileUrlInput from "@/components/FileUrlInput";
import ConfirmDialog from "@/components/ConfirmDialog";
import { createCharacter, updateCharacter, deleteCharacter } from "@/lib/worldcrud";

// Lựa chọn vai trò nhân vật
const ROLE_OPTIONS = ["Nam chính", "Nữ chính", "Sư phụ", "Đồng minh", "Phản diện", "Phụ", "Qua đường", "Khác"];

// Form modal Thêm/Sửa nhân vật. `character` = null → tạo mới; có đối tượng → chỉnh sửa.
export default function CharacterFormModal({ open, character, onClose, onSaved, onDeleted }) {
  const isEdit = !!character;
  const [form, setForm] = useState({});
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Khởi tạo form khi mở
  useEffect(() => {
    if (!open) return;
    setError("");
    if (character) {
      setForm({
        name: character.name || "",
        aliases: character.aliases || "",
        avatar_url: character.avatar_url || "",
        role: character.role || "",
        power_level: character.power_level || "",
        description: character.description || "",
        appearance: character.appearance || "",
        personality: character.personality || "",
        skills: character.skills || "",
        items: character.items || "",
        first_appeared_chapter: character.first_appeared_chapter ?? "",
      });
      setTagsText((character.tags || []).join(", "));
    } else {
      setForm({
        name: "", aliases: "", avatar_url: "", role: "Phụ", power_level: "",
        description: "", appearance: "", personality: "", skills: "", items: "", first_appeared_chapter: "",
      });
      setTagsText("");
    }
  }, [open, character]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  set.fromEvent = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSave() {
    if (!form.name?.trim()) {
      setError("Vui lòng nhập tên nhân vật.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      first_appeared_chapter: form.first_appeared_chapter === "" ? undefined : Number(form.first_appeared_chapter),
      tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
    };
    try {
      let result;
      if (isEdit) result = await updateCharacter(character.id, payload);
      else result = await createCharacter(payload);
      onSaved?.(result, isEdit ? "update" : "create");
      onClose?.();
    } catch (e) {
      setError(e?.message || "Lỗi khi lưu nhân vật.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setConfirmOpen(false);
    try {
      await deleteCharacter(character.id);
      onDeleted?.(character.id);
      onClose?.();
    } catch (e) {
      setError(e?.message || "Lỗi khi xóa nhân vật.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {isEdit ? "Chỉnh sửa nhân vật" : "Thêm nhân vật mới"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Ảnh đại diện */}
          <div className="space-y-1.5">
            <Label>Ảnh đại diện</Label>
            <FileUrlInput value={form.avatar_url} onChange={set("avatar_url")} preview />
          </div>

          {/* Tên + Biệt danh */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tên nhân vật *</Label>
              <Input value={form.name} onChange={set.fromEvent("name")} placeholder="VD: Lâm Tiêu" />
            </div>
            <div className="space-y-1.5">
              <Label>Biệt danh / Hán Việt</Label>
              <Input value={form.aliases} onChange={set.fromEvent("aliases")} placeholder="VD: Lâm thiếu hiệp" />
            </div>
          </div>

          {/* Vai trò + Cấp độ */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Vai trò</Label>
              <Select value={form.role} onValueChange={set("role")}>
                <SelectTrigger><SelectValue placeholder="Chọn vai trò" /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cấp độ / Năng lực</Label>
              <Input value={form.power_level} onChange={set.fromEvent("power_level")} placeholder="VD: Luyện khí tầng 9" />
            </div>
          </div>

          {/* Mô tả (Rich Text) */}
          <div className="space-y-1.5">
            <Label>Mô tả chi tiết / Tiểu sử</Label>
            <RichTextEditor value={form.description} onChange={set("description")} placeholder="Giới thiệu nhân vật..." />
          </div>

          {/* Ngoại hình + Tính cách */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Ngoại hình</Label>
              <Textarea value={form.appearance} onChange={set.fromEvent("appearance")} rows={3} placeholder="Miêu tả ngoại hình..." />
            </div>
            <div className="space-y-1.5">
              <Label>Tính cách</Label>
              <Textarea value={form.personality} onChange={set.fromEvent("personality")} rows={3} placeholder="Miêu tả tính cách..." />
            </div>
          </div>

          {/* Kỹ năng + Vật phẩm */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Kỹ năng</Label>
              <Textarea value={form.skills} onChange={set.fromEvent("skills")} rows={2} placeholder="VD: Thanh Phong kiếm pháp..." />
            </div>
            <div className="space-y-1.5">
              <Label>Vật phẩm / Pháp bảo</Label>
              <Textarea value={form.items} onChange={set.fromEvent("items")} rows={2} placeholder="VD: Trảm Linh kiếm..." />
            </div>
          </div>

          {/* Chương xuất hiện + Thẻ */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Xuất hiện từ chương</Label>
              <Input
                type="number"
                value={form.first_appeared_chapter}
                onChange={set.fromEvent("first_appeared_chapter")}
                placeholder="VD: 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Thẻ (cách nhau bởi dấu phẩy)</Label>
              <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="nam chính, kiếm tu" />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          {isEdit && (
            <Button variant="destructive" onClick={() => setConfirmOpen(true)} type="button" className="mr-auto">
              <Trash2 className="w-4 h-4" /> Xóa
            </Button>
          )}
          <Button variant="outline" onClick={() => onClose?.()} type="button" disabled={saving}>
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={saving} type="button">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? "Lưu thay đổi" : "Thêm nhân vật"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Xóa nhân vật này?"
        description="Nhân vật và các mối quan hệ liên quan sẽ bị gỡ khỏi sơ đồ. Hành động không thể hoàn tác."
        onConfirm={handleDelete}
      />
    </Dialog>
  );
}