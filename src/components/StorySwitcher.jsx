import React, { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { BookMarked, ChevronDown, Check, Plus, Settings2 } from "lucide-react";
import { useStory } from "@/lib/StoryContext";
import StoryFormModal from "@/components/StoryFormModal";
import StoriesManagerModal from "@/components/StoriesManagerModal";

// Dropdown chuyển đổi bộ truyện trên thanh tiêu đề + lối vào quản lý.
export default function StorySwitcher() {
  const { stories, currentStory, currentStoryId, setCurrentStoryId, refresh, ready } = useStory();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [managerOpen, setManagerOpen] = useState(false);

  function switchTo(id) {
    if (id !== currentStoryId) setCurrentStoryId(id);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="inline-flex items-center gap-2 px-3 h-9 rounded-lg border border-border bg-card hover:bg-muted transition text-sm font-medium max-w-[200px] sm:max-w-[280px]"
            disabled={!ready}
          >
            <BookMarked className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">{ready ? (currentStory?.name || "Chưa chọn") : "Đang tải..."}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Chuyển bộ truyện</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {stories.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Chưa có bộ truyện nào.</div>
          )}
          {stories.map((s) => (
            <DropdownMenuItem key={s.id} onClick={() => switchTo(s.id)} className="flex items-center justify-between gap-2">
              <span className="truncate">{s.name}</span>
              {s.id === currentStoryId && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Tạo bộ truyện mới
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setManagerOpen(true)}>
            <Settings2 className="w-4 h-4 mr-2" /> Quản lý bộ truyện
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <StoryFormModal
        open={formOpen}
        story={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={(result, mode) => {
          setFormOpen(false);
          refresh();
          if (mode === "create" && result?.id) setCurrentStoryId(result.id);
          setEditing(null);
        }}
      />
      <StoriesManagerModal
        open={managerOpen}
        onOpenChange={setManagerOpen}
        onEditStory={(s) => { setManagerOpen(false); setEditing(s); setFormOpen(true); }}
        onChanged={refresh}
      />
    </>
  );
}