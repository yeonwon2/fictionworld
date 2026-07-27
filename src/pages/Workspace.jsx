import React, { useEffect, useMemo, useState } from "react";
import { PenTool, Plus, Trash2, Loader2, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import RichTextEditor from "@/components/RichTextEditor";
import ReferencePanel from "@/components/ReferencePanel";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useStory } from "@/lib/StoryContext";
import { listChapters, createChapter, updateChapter, deleteChapter } from "@/lib/worldcrud";

// Không gian soạn thảo (split-screen): trái = trình soạn thảo chương, phải = tra cứu.
export default function Workspace() {
  const { currentStory, currentStoryId, ready } = useStory();
  const [chapters, setChapters] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [content, setContent] = useState("");
  const [loadingChapters, setLoadingChapters] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function load() {
    setLoadingChapters(true);
    const list = (await listChapters(currentStoryId)) || [];
    list.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
    setChapters(list);
    setActiveId((prev) => (prev && list.find((c) => c.id === prev) ? prev : list[0]?.id || null));
    setLoadingChapters(false);
  }
  useEffect(() => {
    if (!ready) return;
    setActiveId(null);
    load();
  }, [ready, currentStoryId]);

  const active = useMemo(() => chapters.find((c) => c.id === activeId) || null, [chapters, activeId]);

  useEffect(() => {
    if (active) {
      setTitle(active.title || "");
      setNumber(active.chapter_number ?? "");
      setContent(active.content || "");
      setDirty(false);
    } else {
      setTitle("");
      setNumber("");
      setContent("");
      setDirty(false);
    }
  }, [activeId]); // eslint-disable-line

  if (!ready) {
    return (
      <div className="p-10 max-w-[1400px] mx-auto">
        <div className="text-center text-muted-foreground py-20 text-sm">Đang tải bộ truyện...</div>
      </div>
    );
  }

  function newChapter() {
    setActiveId(null);
    setTitle("");
    setNumber(String(chapters.length + 1));
    setContent("");
    setDirty(true);
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const num = number === "" ? undefined : Number(number);
      if (active) {
        const updated = await updateChapter(active.id, {
          title,
          chapter_number: num,
          content,
        });
        setChapters((cs) =>
          cs
            .map((c) => (c.id === active.id ? updated : c))
            .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0))
        );
      } else {
        const created = await createChapter({
          title,
          chapter_number: num ?? chapters.length + 1,
          content,
          story_id: currentStoryId,
        });
        setChapters((cs) =>
          [...cs, created].sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0))
        );
        setActiveId(created.id);
      }
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDel() {
    if (!active) return;
    const id = active.id;
    setConfirmDelete(false);
    try {
      await deleteChapter(id);
      setChapters((cs) => cs.filter((c) => c.id !== id));
      setActiveId(null);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <header className="mb-4">
        <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <PenTool className="w-6 h-6 text-primary" /> Không gian soạn thảo
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {currentStory
            ? `Viết & chỉnh sửa chương — ${currentStory.name}`
            : "Viết & chỉnh sửa chương truyện. Bảng tra cứu bên cạnh không rời khỏi trang."}
        </p>
      </header>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 h-[calc(100vh-170px)] min-h-[520px]">
        {/* Cột trái — trình soạn thảo */}
        <div className="flex flex-col min-w-0 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40">
            <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
            <select
              value={activeId || ""}
              onChange={(e) => setActiveId(e.target.value || null)}
              className="h-8 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">+ Chương mới (chưa lưu)</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.chapter_number != null ? `Ch. ${c.chapter_number}` : "Ch."} · {c.title}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={newChapter} type="button">
              <Plus className="w-3.5 h-3.5" /> Chương mới
            </Button>
            {active && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                type="button"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="grid sm:grid-cols-[1fr_100px] gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tên chương</Label>
                <Input
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                  placeholder="VD: Khởi đầu"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Số chương</Label>
                <Input
                  type="number"
                  value={number}
                  onChange={(e) => { setNumber(e.target.value); setDirty(true); }}
                  placeholder="1"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nội dung</Label>
              <RichTextEditor
                value={content}
                onChange={(v) => { setContent(v); setDirty(true); }}
                placeholder="Bắt đầu viết chương truyện tại đây (hỗ trợ Markdown)..."
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-border bg-muted/30">
            <span className="text-[11px] text-muted-foreground mr-auto">
              {dirty ? "Chưa lưu" : active ? "Đã lưu" : "Bản nháp mới"}
            </span>
            <Button onClick={handleSave} disabled={saving || !title.trim()} type="button" size="sm">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {active ? "Lưu" : "Tạo chương"}
            </Button>
          </div>
        </div>

        {/* Cột phải — tra cứu */}
        <div className="hidden lg:block min-h-0">
          <ReferencePanel />
        </div>
      </div>

      {/* Mobile: tra cứu hiển thị bên dưới */}
      <div className="lg:hidden mt-4 h-[420px]">
        <ReferencePanel />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Xóa chương này?"
        description={active ? `“${active.title}” sẽ bị xóa vĩnh viễn.` : ""}
        onConfirm={confirmDel}
      />
    </div>
  );
}