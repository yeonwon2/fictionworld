import React, { useEffect, useState } from "react";
import { Clock, Loader2, RefreshCw } from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import { buildTimelineParsePrompt, TIMELINE_PARSE_SCHEMA } from "@/lib/writingFactory/prompts";

// Timeline trực quan — đọc 06_TIMELINE, vẽ dòng thời gian vertical với các mốc.
export default function TimelinePanel({ currentStoryId, genre, docsByKey }) {
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyze = async () => {
    if (!currentStoryId) return;
    setLoading(true);
    setError("");
    try {
      const res = await aiCall(
        buildTimelineParsePrompt({ genre, timeline: docsByKey?.timeline?.content || "" }),
        { jsonSchema: TIMELINE_PARSE_SCHEMA }
      );
      setEvents(res?.events || []);
    } catch (e) {
      setError("Đọc timeline lỗi: " + (e?.message || "lỗi"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (docsByKey?.timeline?.content?.trim()) analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoryId]);

  const noDoc = !docsByKey?.timeline?.content?.trim();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold">Timeline Trực Quan</h2>
          <button
            onClick={analyze}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/40 text-primary text-xs hover:bg-primary/10 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {loading ? "Đang phân tích..." : "Phân tích lại"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Đọc tài liệu <b>06_TIMELINE</b>, trích xuất các mốc thời gian theo thứ tự.
        </p>
      </div>

      {noDoc && !loading && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Chưa có tài liệu <b>06_TIMELINE</b>.
        </div>
      )}
      {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> AI đang đọc timeline...
        </div>
      )}

      {events && !loading && (
        <div className="rounded-2xl border border-border bg-card p-6">
          {events.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Timeline trống.</p>
          )}
          <div className="relative pl-8">
            {/* Vertical line */}
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

            {events.map((e, i) => (
              <div key={i} className="relative mb-6 last:mb-0">
                {/* Dot */}
                <div className="absolute -left-5 top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />

                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-primary">{e.event}</span>
                    {e.time && <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">{e.time}</span>}
                  </div>
                  {e.location && <p className="text-[11px] text-muted-foreground mt-1">📍 {e.location}</p>}
                  {e.characters && <p className="text-[11px] text-foreground/80 mt-0.5">👤 {e.characters}</p>}
                  {e.foreshadow && <p className="text-[11px] text-amber-600 mt-0.5">🚩 {e.foreshadow}</p>}
                  {e.note && <p className="text-[11px] text-muted-foreground italic mt-0.5">📝 {e.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}