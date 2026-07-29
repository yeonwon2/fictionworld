import React, { useEffect, useState } from "react";
import { useStory } from "@/lib/StoryContext";
import { listCharacters } from "@/lib/worldcrud";
import { Link } from "react-router-dom";
import { Lock, Target, HeartCrack, MessageSquareQuote, Loader2, Pencil } from "lucide-react";

// Hồ sơ nhân vật (Story Bible) — bản xem nhanh các trường mở rộng. Sửa chi tiết ở mục Sổ Tay → Nhân vật.
export default function CharacterBiblePanel() {
  const { currentStoryId, ready } = useStory();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!ready) return;
    setLoading(true);
    listCharacters(currentStoryId)
      .then((c) => setItems(c || []))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [ready, currentStoryId]);

  if (loading)
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
      </div>
    );

  if (!items.length)
    return (
      <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
        Chưa có nhân vật.{" "}
        <Link to="/so-tay-the-gioi?tab=characters" className="text-primary underline">
          Thêm nhân vật
        </Link>{" "}
        rồi điền mục tiêu / bí mật / giọng văn để AI giữ nhất quán.
      </div>
    );

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((c) => (
        <div key={c.id} className="rounded-xl border border-border bg-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-display font-semibold text-sm">{c.name}</span>
            <Link
              to="/so-tay-the-gioi?tab=characters"
              className="p-1 rounded text-muted-foreground hover:bg-muted"
              title="Sửa ở mục Nhân vật"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {c.role && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{c.role}</span>}
            {c.age != null && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{c.age} tuổi</span>}
          </div>
          {c.appearance && <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{c.appearance}</p>}
          <div className="space-y-1.5 mt-2.5 text-xs">
            {c.personality && <p><span className="text-muted-foreground">Tính cách:</span> {c.personality}</p>}
            {c.speech_style && (
              <p className="flex items-start gap-1.5">
                <MessageSquareQuote className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <span>{c.speech_style}</span>
              </p>
            )}
            {c.goals && (
              <p className="flex items-start gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span>{c.goals}</span>
              </p>
            )}
            {c.secret && (
              <p className="flex items-start gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                <span>{c.secret}</span>
              </p>
            )}
            {c.inner_conflict && (
              <p className="flex items-start gap-1.5">
                <HeartCrack className="w-3.5 h-3.5 text-rose-600 mt-0.5 shrink-0" />
                <span>{c.inner_conflict}</span>
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}