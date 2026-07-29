import React, { useEffect, useState } from "react";
import { useStory } from "@/lib/StoryContext";
import { listEvents, updateEvent } from "@/lib/worldcrud";
import { Flag, CheckCircle2, Loader2 } from "lucide-react";

// Bảng Phục bút — các mốc foreshadowing chưa giải quyết
export default function ForeshadowPanel() {
  const { currentStoryId, ready } = useStory();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = () => {
    if (!ready) return;
    setLoading(true);
    listEvents(currentStoryId)
      .then((ev) =>
        setItems(
          (ev || [])
            .filter((e) => e.foreshadow_note && !e.foreshadow_resolved)
            .sort((a, b) => (a.timeline_order || 0) - (b.timeline_order || 0))
        )
      )
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [ready, currentStoryId]);

  const resolve = async (ev) => {
    setBusy(ev.id);
    try {
      await updateEvent(ev.id, { foreshadow_resolved: true });
      load();
    } catch (e) {
      alert(e?.message || "Lỗi");
    } finally {
      setBusy("");
    }
  };

  if (loading)
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
      </div>
    );

  if (!items.length)
    return (
      <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
        Không có phục bút nào đang treo. Hãy mở một sự kiện ở mục Niên biểu và điền "Ghi chú phục bút".
      </div>
    );

  return (
    <div className="space-y-2.5">
      <p className="text-sm text-muted-foreground mb-2">
        Các phục bút <b>chưa hồi đáp</b>. Khi gần hết arc, AI sẽ được cảnh báo để gợi ý hồi đáp.
      </p>
      {items.map((ev) => (
        <div
          key={ev.id}
          className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-3"
        >
          <Flag className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{ev.title}</span>
              {ev.timeline_order != null && (
                <span className="text-[10px] text-muted-foreground">#{ev.timeline_order}</span>
              )}
            </div>
            <p className="text-xs text-foreground/80 mt-1">{ev.foreshadow_note}</p>
            {ev.description && (
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{ev.description}</p>
            )}
          </div>
          <button
            onClick={() => resolve(ev)}
            disabled={busy === ev.id}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-emerald-500/50 text-emerald-600 text-xs hover:bg-emerald-500/10 disabled:opacity-50"
          >
            {busy === ev.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Đã hồi đáp
          </button>
        </div>
      ))}
    </div>
  );
}