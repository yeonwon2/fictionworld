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
import { Loader2, Save } from "lucide-react";
import FileUrlInput from "@/components/FileUrlInput";
import { createStory, updateStory } from "@/lib/worldcrud";

// Form modal Thêm/Sửa một bộ truyện.
export default function StoryFormModal({ open, story, onClose, onSaved }) {
  const isEdit = !!story;
  const [form, setForm] = useState({ name: "", genre: "", cover_url: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (story) {
      setForm({ name: story.name || "", genre: story.genre || "", cover_url: story.cover_url || "" });
    } else {
      setForm({ name: "", genre: "", cover_url: "" });
    }
  }, [open, story]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.name?.trim()) {
      setError("Vui lòng nhập tên bộ truyện.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = isEdit ? await updateStory(story.id, form) : await createStory(form);
      onSaved?.(result, isEdit ? "update" : "create");
      onClose?.();
    } catch (e) {
      setError(e?.message || "Lỗi khi lưu bộ truyện.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {isEdit ? "Chỉnh sửa bộ truyện" : "Tạo bộ truyện mới"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Tên bộ truyện *</Label>
            <Input value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="VD: Linh Vũ Thiên Hạ" />
          </div>
          <div className="space-y-1.5">
            <Label>Thể loại</Label>
            <Input value={form.genre} onChange={(e) => set("genre")(e.target.value)} placeholder="VD: Tiên hiệp, Huyền huyễn..." />
          </div>
          <div className="space-y-1.5">
            <Label>Ảnh bìa</Label>
            <FileUrlInput value={form.cover_url} onChange={set("cover_url")} preview />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onClose?.()} type="button" disabled={saving}>Hủy</Button>
          <Button onClick={handleSave} disabled={saving} type="button">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? "Lưu thay đổi" : "Tạo bộ truyện"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}