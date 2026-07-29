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
import EditableLabel from "@/components/EditableLabel";
import CustomFieldsEditor from "@/components/CustomFieldsEditor";
import { useFieldSchema } from "@/lib/useFieldSchema";
import { createCharacter, updateCharacter, deleteCharacter } from "@/lib/worldcrud";
import { useStory } from "@/lib/StoryContext";

const ROLE_OPTIONS = ["Nam chính", "Nữ chính", "Sư phụ", "Đồng minh", "Phản diện", "Phụ", "Qua đường", "Khác"];

// Form modal Thêm/Sửa nhân vật. Hỗ trợ đổi tên trường + trường tùy chỉnh theo bộ truyện.
export default function CharacterFormModal({ open, character, onClose, onSaved, onDeleted }) {
  const isEdit = !!character;
  const { currentStoryId } = useStory();
  const { label, renameField } = useFieldSchema("character");
  const [form, setForm] = useState({});
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (character) {
      setForm({
        name: character.name || "",
        aliases: character.aliases || "",
        avatar_url: character.avatar_url || "",
        role: character.role || "",
        age: character.age ?? "",
        power_level: character.power_level || "",
        description: character.description || "",
        appearance: character.appearance || "",
        personality: character.personality || "",
        speech_style: character.speech_style || "",
        goals: character.goals || "",
        secret: character.secret || "",
        inner_conflict: character.inner_conflict || "",
        skills: character.skills || "",
        items: character.items || "",
        first_appeared_chapter: character.first_appeared_chapter ?? "",
        custom_fields: character.custom_fields || {},
      });
      setTagsText((character.tags || []).join(", "));
    } else {
      setForm({
        name: "", aliases: "", avatar_url: "", role: "Phụ", age: "", power_level: "",
        description: "", appearance: "", personality: "", speech_style: "",
        goals: "", secret: "", inner_conflict: "", skills: "", items: "",
        first_appeared_chapter: "", custom_fields: {},
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
      custom_fields: form.custom_fields || {},
      story_id: isEdit ? (character.story_id || currentStoryId) : currentStoryId,
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
          <div className="space-y-1.5">
            <EditableLabel label={label("avatar_url", "Ảnh đại diện")} onRename={renameField("avatar_url")} />
            <FileUrlInput value={form.avatar_url} onChange={set("avatar_url")} preview />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <EditableLabel label={label("name", "Tên nhân vật *")} onRename={renameField("name")} />
              <Input value={form.name} onChange={set.fromEvent("name")} placeholder="VD: Lâm Tiêu" />
            </div>
            <div className="space-y-1.5">
              <EditableLabel label={label("aliases", "Biệt danh / Hán Việt")} onRename={renameField("aliases")} />
              <Input value={form.aliases} onChange={set.fromEvent("aliases")} placeholder="VD: Lâm thiếu hiệp" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <EditableLabel label={label("role", "Vai trò")} onRename={renameField("role")} />
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
              <EditableLabel label={label("power_level", "Cấp độ / Năng lực")} onRename={renameField("power_level")} />
              <Input value={form.power_level} onChange={set.fromEvent("power_level")} placeholder="VD: Luyện khí tầng 9" />
            </div>
          </div>

          <div className="space-y-1.5">
            <EditableLabel label={label("description", "Mô tả chi tiết / Tiểu sử")} onRename={renameField("description")} />
            <RichTextEditor value={form.description} onChange={set("description")} placeholder="Giới thiệu nhân vật..." />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <EditableLabel label={label("appearance", "Ngoại hình")} onRename={renameField("appearance")} />
              <Textarea value={form.appearance} onChange={set.fromEvent("appearance")} rows={3} placeholder="Miêu tả ngoại hình..." />
            </div>
            <div className="space-y-1.5">
              <EditableLabel label={label("personality", "Tính cách")} onRename={renameField("personality")} />
              <Textarea value={form.personality} onChange={set.fromEvent("personality")} rows={3} placeholder="Miêu tả tính cách..." />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <EditableLabel label={label("skills", "Kỹ năng")} onRename={renameField("skills")} />
              <Textarea value={form.skills} onChange={set.fromEvent("skills")} rows={2} placeholder="VD: Thanh Phong kiếm pháp..." />
            </div>
            <div className="space-y-1.5">
              <EditableLabel label={label("items", "Vật phẩm / Pháp bảo")} onRename={renameField("items")} />
              <Textarea value={form.items} onChange={set.fromEvent("items")} rows={2} placeholder="VD: Trảm Linh kiếm..." />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tuổi</Label>
              <Input type="number" value={form.age ?? ""} onChange={set.fromEvent("age")} placeholder="VD: 18" />
            </div>
            <div className="space-y-1.5">
              <Label>Giọng văn / Cách xưng hô đặc trưng</Label>
              <Input value={form.speech_style || ""} onChange={set.fromEvent("speech_style")} placeholder="VD: lạnh lùng, xưng 'ta', gọi 'ngươi'" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mục tiêu / Động cơ</Label>
            <Textarea value={form.goals || ""} onChange={set.fromEvent("goals")} rows={2} placeholder="Mục tiêu / động cơ của nhân vật..." />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Bí mật đang giữ</Label>
              <Textarea value={form.secret || ""} onChange={set.fromEvent("secret")} rows={2} placeholder="Bí mật nhân vật giữ..." />
            </div>
            <div className="space-y-1.5">
              <Label>Mâu thuẫn nội tâm</Label>
              <Textarea value={form.inner_conflict || ""} onChange={set.fromEvent("inner_conflict")} rows={2} placeholder="Mâu thuẫn nội tâm..." />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <EditableLabel label={label("first_appeared_chapter", "Xuất hiện từ chương")} onRename={renameField("first_appeared_chapter")} />
              <Input
                type="number"
                value={form.first_appeared_chapter}
                onChange={set.fromEvent("first_appeared_chapter")}
                placeholder="VD: 1"
              />
            </div>
            <div className="space-y-1.5">
              <EditableLabel label={label("tags", "Thẻ (cách nhau bởi dấu phẩy)")} onRename={renameField("tags")} />
              <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="nam chính, kiếm tu" />
            </div>
          </div>

          <CustomFieldsEditor
            formType="character"
            values={form.custom_fields}
            onChange={(v) => set("custom_fields")(v)}
          />

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