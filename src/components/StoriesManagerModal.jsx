import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useStory } from "@/lib/StoryContext";
import { deleteStory } from "@/lib/worldcrud";
import ConfirmDialog from "@/components/ConfirmDialog";

// Modal quản lý bộ truyện: đổi story, sửa, xóa, tạo mới.
// onEditStory(null|story) → mở form tạo/sửa bên ngoài.
export default function StoriesManagerModal({ open, onOpenChange, onEditStory, onChanged }) {
  const { stories, currentStoryId, setCurrentStoryId, refresh } = useStory();
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await deleteStory(id);
    } catch (e) {
      console.error(e);
    }
    await refresh();
    onChanged?.();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onOpenChange?.(o)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Quản lý bộ truyện</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {stories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Chưa có bộ truyện nào.</p>
            )}
            {stories.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                  s.id === currentStoryId ? "border-primary/50 bg-primary/5" : "border-border bg-card"
                }`}
              >
                <div className="w-12 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                  {s.cover_url ? (
                    <Image src={s.cover_url} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <span className="text-[10px]">N/A</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.name}</div>
                  {s.genre && <div className="text-xs text-muted-foreground truncate">{s.genre}</div>}
                </div>
                <button
                  onClick={() => setCurrentStoryId(s.id)}
                  className={`text-xs px-2.5 py-1 rounded-full transition whitespace-nowrap ${
                    s.id === currentStoryId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {s.id === currentStoryId ? "Đang chọn" : "Chọn"}
                </button>
                <button onClick={() => onEditStory?.(s)} className="p-1.5 rounded-lg hover:bg-muted transition" title="Sửa">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeleteTarget(s)} className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition" title="Xóa">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <Button onClick={() => onEditStory?.(null)} variant="outline" className="w-full" type="button">
            <Plus className="w-4 h-4" /> Tạo bộ truyện mới
          </Button>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Xóa bộ truyện này?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” sẽ bị xóa. Dữ liệu thuộc bộ truyện này (nhân vật, địa danh, quan hệ, sự kiện) KHÔNG tự xóa — chỉ bị bỏ ngỏ (chưa thuộc bộ truyện nào).`
            : ""
        }
        onConfirm={confirmDelete}
      />
    </>
  );
}