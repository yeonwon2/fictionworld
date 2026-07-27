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
import { Loader2, Save, Trash2 } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import ConfirmDialog from "@/components/ConfirmDialog";
import MultiSelectChips from "@/components/MultiSelectChips";
import EditableLabel from "@/components/EditableLabel";
import CustomFieldsEditor from "@/components/CustomFieldsEditor";
import { useFieldSchema } from "@/lib/useFieldSchema";
import { createEvent, updateEvent, deleteEvent } from "@/lib/worldcrud";
import { useStory } from "@/lib/StoryContext";

// Form modal Thêm/Sửa sự kiện — đổi tên trường + trường tùy chỉnh theo bộ truyện.
export default function EventFormModal({
  open,
  event,
  characters = [],
  locations = [],
  onClose,
  onSaved,
  onDeleted,
}) {
  const isEdit = !!event;
  const { currentStoryId } = useStory();
  const { label, renameField } = useFieldSchema("event");
  const [form, setForm] = useState({
    title: "",
    timeline_order: 0,
    description: "",
    related_character_ids: [],
    related_location_ids: [],
    custom_fields: {},
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (event) {
      setForm({
        title: event.title || "",
        timeline_order: event.timeline_order ?? 0,
        description: event.description || "",
        related_character_ids: event.related_character_ids || [],
        related_location_ids: event.related_location_ids || [],
        custom_fields: event.custom_fields || {},
      });
    } else {
      setForm({
        title: "",
        timeline_order: 0,
        description: "",
        related_character_ids: [],
        related_location_ids: [],
        custom_fields: {},
      });
    }
  }, [open, event]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.title?.trim()) {
      setError("Vui lòng nhập tên sự kiện.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      timeline_order: form.timeline_order === "" ? 0 : Number(form.timeline_order),
      custom_fields: form.custom_fields || {},
      story_id: isEdit ? event.story_id || currentStoryId : currentStoryId,
    };
    try {
      const result = isEdit
        ? await updateEvent(event.id, payload)
        : await createEvent(payload);
      onSaved?.(result, isEdit ? "update" : "create");
      onClose?.();
    } catch (e) {
      setError(e?.message || "Lỗi khi lưu sự kiện.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setConfirmOpen(false);
    try {
      await deleteEvent(event.id);
      onDeleted?.(event.id);
      onClose?.();
    } catch (e) {
      setError(e?.message || "Lỗi khi xóa sự kiện.");
    }
  }

  const charOpts = characters.map((c) => ({ id: c.id, label: c.name, sublabel: c.role }));
  const locOpts = locations.map((l) => ({ id: l.id, label: l.name, sublabel: l.type }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {isEdit ? "Chỉnh sửa sự kiện" : "Thêm sự kiện"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid sm:grid-cols-[1fr_120px] gap-4">
            <div className="space-y-1.5">
              <EditableLabel label={label("title", "Tên sự kiện *")} onRename={renameField("title")} />
              <Input
                value={form.title}
                onChange={(e) => set("title")(e.target.value)}
                placeholder="VD: Võ đạo thi đấu"
              />
            </div>
            <div className="space-y-1.5">
              <EditableLabel label={label("timeline_order", "Thứ tự")} onRename={renameField("timeline_order")} />
              <Input
                type="number"
                value={form.timeline_order}
                onChange={(e) => set("timeline_order")(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <EditableLabel label={label("description", "Mô tả")} onRename={renameField("description")} />
            <RichTextEditor
              value={form.description}
              onChange={set("description")}
              placeholder="Mô tả sự kiện..."
            />
          </div>

          <div className="space-y-1.5">
            <EditableLabel label={label("related_character_ids", "Nhân vật liên quan")} onRename={renameField("related_character_ids")} />
            <MultiSelectChips
              options={charOpts}
              selected={form.related_character_ids || []}
              onChange={set("related_character_ids")}
              placeholder="Tìm nhân vật..."
            />
          </div>

          <div className="space-y-1.5">
            <EditableLabel label={label("related_location_ids", "Địa danh liên quan")} onRename={renameField("related_location_ids")} />
            <MultiSelectChips
              options={locOpts}
              selected={form.related_location_ids || []}
              onChange={set("related_location_ids")}
              placeholder="Tìm địa danh..."
            />
          </div>

          <CustomFieldsEditor
            formType="event"
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
            {isEdit ? "Lưu thay đổi" : "Tạo sự kiện"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Xóa sự kiện này?"
        description="Sự kiện sẽ bị gỡ khỏi dòng thời gian."
        onConfirm={handleDelete}
      />
    </Dialog>
  );
}