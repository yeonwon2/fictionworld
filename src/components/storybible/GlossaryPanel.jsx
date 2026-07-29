import React, { useEffect, useState } from "react";
import { useStory } from "@/lib/StoryContext";
import {
  listGlossary,
  createGlossary,
  updateGlossary,
  deleteGlossary,
} from "@/lib/worldcrud";
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
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

const CATEGORIES = [
  "Xưng hô",
  "Địa danh",
  "Chức quan",
  "Môn phái / Tổ chức",
  "Thuật ngữ",
  "Khác",
];

const CAT_TONE = {
  "Xưng hô": "text-violet-600 bg-violet-500/10",
  "Địa danh": "text-emerald-600 bg-emerald-500/10",
  "Chức quan": "text-amber-600 bg-amber-500/10",
  "Môn phái / Tổ chức": "text-sky-600 bg-sky-500/10",
  "Thuật ngữ": "text-rose-600 bg-rose-500/10",
  "Khác": "text-muted-foreground bg-muted",
};

export default function GlossaryPanel() {
  const { currentStoryId, ready } = useStory();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ term: "", category: "Khác", definition: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const load = () => {
    if (!ready) return;
    setLoading(true);
    listGlossary(currentStoryId)
      .then((g) => setItems(g || []))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [ready, currentStoryId]);

  const openAdd = () => {
    setEditing(null);
    setForm({ term: "", category: "Khác", definition: "" });
    setError("");
    setOpen(true);
  };
  const openEdit = (it) => {
    setEditing(it);
    setForm({ term: it.term || "", category: it.category || "Khác", definition: it.definition || "" });
    setError("");
    setOpen(true);
  };

  const save = async () => {
    if (!form.term.trim()) {
      setError("Nhập thuật ngữ.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, story_id: editing?.story_id || currentStoryId };
      if (editing) await updateGlossary(editing.id, payload);
      else await createGlossary(payload);
      setOpen(false);
      load();
    } catch (e) {
      setError(e?.message || "Lỗi khi lưu.");
    } finally {
      setSaving(false);
    }
  };

  const del = async (it) => {
    if (!window.confirm(`Xóa "${it.term}"?`)) return;
    try {
      await deleteGlossary(it.id);
      load();
    } catch (e) {
      alert(e?.message || "Lỗi khi xóa.");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Bảng thuật ngữ cổ phong — xưng hô, địa danh, chức quan, môn phái, thuật ngữ thế giới. AI
          sẽ tự nạp để giữ nhất quán khi sáng tác.
        </p>
        <Button onClick={openAdd} size="sm">
          <Plus className="w-4 h-4" /> Thêm thuật ngữ
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
          Chưa có thuật ngữ. Bấm "Thêm thuật ngữ" để bắt đầu xây Story Bible.
        </div>
      ) : (
        <div className="space-y-5">
          {CATEGORIES.map((cat) => {
            const rows = items.filter((i) => (i.category || "Khác") === cat);
            if (!rows.length) return null;
            return (
              <div key={cat}>
                <h3 className="font-display text-sm font-semibold mb-2">{cat}</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {rows.map((it) => (
                    <div key={it.id} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-sm">{it.term}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${CAT_TONE[cat]}`}>
                          {cat}
                        </span>
                      </div>
                      {it.definition && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-4">
                          {it.definition}
                        </p>
                      )}
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={() => openEdit(it)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                          title="Sửa"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => del(it)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Sửa thuật ngữ" : "Thêm thuật ngữ cổ phong"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Thuật ngữ / Từ *</Label>
              <Input value={form.term} onChange={(e) => set("term")(e.target.value)} placeholder="VD: sư huynh / Vân Sơn phái" />
            </div>
            <div className="space-y-1.5">
              <Label>Phân loại</Label>
              <Select value={form.category} onValueChange={set("category")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Định nghĩa / Cách dùng</Label>
              <Textarea value={form.definition} onChange={(e) => set("definition")(e.target.value)} rows={3} placeholder="Giải thích nghĩa, hoàn cảnh sử dụng..." />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} type="button" disabled={saving}>Hủy</Button>
            <Button onClick={save} disabled={saving} type="button">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}