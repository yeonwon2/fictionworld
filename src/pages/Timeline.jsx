import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { listEvents, listCharacters } from "@/lib/worldcrud";
import { useStory } from "@/lib/StoryContext";
import { Clock, Users } from "lucide-react";

// Trang dòng thời gian — niên biểu sự kiện theo thứ tự
export default function Timeline() {
  const { currentStoryId, ready } = useStory();
  const [events, setEvents] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    Promise.all([
      listEvents(currentStoryId),
      listCharacters(currentStoryId),
    ])
      .then(([e, c]) => {
        setEvents(e || []);
        setCharacters(c || []);
      })
      .finally(() => setLoading(false));
  }, [ready, currentStoryId]);

  // Sắp xếp theo timeline_order tăng dần
  const sorted = useMemo(
    () => [...events].sort((a, b) => (a.timeline_order || 0) - (b.timeline_order || 0)),
    [events]
  );

  const charById = useMemo(() => Object.fromEntries(characters.map((c) => [c.id, c])), [characters]);

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <Clock className="w-6 h-6 text-primary" /> Niên biểu
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Dòng thời gian các sự kiện trong thế giới của bạn.</p>
      </header>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : sorted.length ? (
        <div className="relative">
          {/* Đường dọc của timeline */}
          <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

          <div className="space-y-5">
            {sorted.map((ev, idx) => (
              <div key={ev.id} className="relative pl-12">
                {/* Chấm mốc */}
                <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-background shadow-sm" />
                {/* Số thứ tự */}
                <div className="absolute -left-1 top-0 text-[10px] font-mono text-muted-foreground/60">
                  {String(idx + 1).padStart(2, "0")}
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 hover:shadow-sm transition">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-display font-semibold">{ev.title}</h3>
                    {ev.timeline_order != null && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                        #{ev.timeline_order}
                      </span>
                    )}
                  </div>
                  {ev.description && <p className="text-sm text-muted-foreground leading-relaxed">{ev.description}</p>}

                  {/* Nhân vật liên quan */}
                  {ev.related_character_ids?.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-3">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      {ev.related_character_ids.map((cid) => {
                        const ch = charById[cid];
                        if (!ch) return null;
                        return (
                          <Link
                            key={cid}
                            to={`/nhan-vat/${cid}`}
                            className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition"
                          >
                            {ch.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Chưa có sự kiện nào.</p>
        </div>
      )}
    </div>
  );
}