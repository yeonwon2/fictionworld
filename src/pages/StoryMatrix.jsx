import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, MapPin, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Image } from "@/components/ui/image";
import { listEvents, listCharacters, listLocations } from "@/lib/worldcrud";
import { useStory } from "@/lib/StoryContext";
import CustomFieldsList from "@/components/CustomFieldsList";

// Chọn màu chấm theo từ khóa trạng thái.
function statusColor(status) {
  if (!status) return "bg-primary";
  const t = String(status).toLowerCase();
  if (/thương|loa|tổn|bị/.test(t)) return "bg-amber-500";
  if (/mất|khuất|chết|tử|kẻ địch|địch/.test(t)) return "bg-destructive";
  if (/thăng|đột phá|lên|vượt|tăng|đề破/.test(t)) return "bg-emerald-500";
  return "bg-primary";
}

// Trang Ma trận Cốt truyện — bảng chéo: sự kiện (hàng) × nhân vật / địa danh (cột).
export default function StoryMatrix() {
  const { currentStoryId, ready, currentStory } = useStory();
  const [events, setEvents] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hideUnused, setHideUnused] = useState(true);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    Promise.all([
      listEvents(currentStoryId),
      listCharacters(currentStoryId),
      listLocations(currentStoryId),
    ])
      .then(([e, c, l]) => {
        setEvents((e || []).sort((a, b) => (a.timeline_order || 0) - (b.timeline_order || 0)));
        setCharacters(c || []);
        setLocations(l || []);
      })
      .finally(() => setLoading(false));
  }, [ready, currentStoryId]);

  const usedCharIds = useMemo(
    () => new Set(events.flatMap((ev) => ev.related_character_ids || [])),
    [events]
  );
  const usedLocIds = useMemo(
    () => new Set(events.flatMap((ev) => ev.related_location_ids || [])),
    [events]
  );
  const colsChars = useMemo(
    () => characters.filter((c) => (hideUnused ? usedCharIds.has(c.id) : true)),
    [characters, hideUnused, usedCharIds]
  );
  const colsLocs = useMemo(
    () => locations.filter((l) => (hideUnused ? usedLocIds.has(l.id) : true)),
    [locations, hideUnused, usedLocIds]
  );

  const charById = useMemo(() => Object.fromEntries(characters.map((c) => [c.id, c])), [characters]);
  const locById = useMemo(() => Object.fromEntries(locations.map((l) => [l.id, l])), [locations]);

  if (loading) {
    return (
      <div className="p-10 max-w-7xl mx-auto">
        <div className="h-40 rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <header className="mb-4">
        <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <LayoutGrid className="w-6 h-6 text-primary" /> Ma trận cốt truyện
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {currentStory ? `${currentStory.name} — ` : ""}Toàn cảnh diễn biến: mốc sự kiện × nhân vật / địa danh.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-muted-foreground">
        <label className="inline-flex items-center gap-1.5 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={hideUnused}
            onChange={(e) => setHideUnused(e.target.checked)}
            className="accent-primary"
          />
          Chỉ hiển thị nhân vật/địa danh có xuất hiện
        </label>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Tham gia</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Thăng cấp</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Bị thương</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> Mất tích/chết</span>
      </div>

      {!events.length ? (
        <div className="text-center py-20 text-muted-foreground">
          <LayoutGrid className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Chưa có sự kiện nào để dựng ma trận. Hãy thêm sự kiện ở mục Niên biểu.</p>
        </div>
      ) : (
        <div className="overflow-auto rounded-2xl border border-border bg-card max-h-[calc(100vh-230px)]">
          <table className="border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-40 bg-card border-b border-r border-border px-3 py-2 text-left font-display font-semibold whitespace-nowrap min-w-[170px]">
                  Mốc sự kiện
                </th>
                {colsChars.map((c) => (
                  <th key={c.id} className="sticky top-0 z-30 bg-card border-b border-r border-border px-2 py-2 min-w-[110px] align-bottom">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-muted">
                        {c.avatar_url && <Image src={c.avatar_url} alt={c.name} className="w-full h-full object-cover" />}
                      </div>
                      <span className="truncate max-w-[100px] font-medium" title={c.name}>{c.name}</span>
                    </div>
                  </th>
                ))}
                {colsLocs.length > 0 && (
                  <th className="sticky top-0 z-30 bg-primary/5 border-b border-r border-border px-1 py-2 w-1" />
                )}
                {colsLocs.map((l) => (
                  <th key={l.id} className="sticky top-0 z-30 bg-primary/5 border-b border-r border-border px-2 py-2 min-w-[90px] align-bottom">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="truncate max-w-[80px] font-medium" title={l.name}>{l.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((ev, i) => (
                <tr key={ev.id}>
                  <th
                    className="sticky left-0 z-20 bg-card border-b border-r border-border px-3 py-2 text-left font-medium whitespace-nowrap cursor-pointer hover:bg-muted"
                    onClick={() => setDetail({ type: "event", event: ev })}
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground font-mono">#{ev.timeline_order ?? i + 1}</span>
                      <span>{ev.title}</span>
                    </div>
                  </th>
                  {colsChars.map((c) => {
                    const inEv = (ev.related_character_ids || []).includes(c.id);
                    const status = ev.participant_states?.[c.id];
                    return (
                      <td
                        key={c.id}
                        onClick={() => setDetail({ type: "character", entity: c, event: ev })}
                        className="border-b border-r border-border px-1.5 py-2 text-center cursor-pointer hover:bg-muted/60 align-middle"
                      >
                        {inEv ? (
                          <div className="inline-flex flex-col items-center gap-0.5 justify-center w-full h-full">
                            <span className={`w-2.5 h-2.5 rounded-full ${statusColor(status)}`} />
                            {status && (
                              <span className="text-[9px] leading-tight text-muted-foreground line-clamp-2 max-w-[100px]">{status}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/20">·</span>
                        )}
                      </td>
                    );
                  })}
                  {colsLocs.length > 0 && <td className="bg-primary/5 border-b border-r border-border" />}
                  {colsLocs.map((l) => {
                    const present = (ev.related_location_ids || []).includes(l.id);
                    return (
                      <td
                        key={l.id}
                        onClick={() => setDetail({ type: "location", entity: l, event: ev })}
                        className="bg-primary/5 border-b border-r border-border px-1.5 py-2 text-center cursor-pointer hover:bg-primary/10 align-middle"
                      >
                        {present ? (
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary" title="Xuất hiện" />
                        ) : (
                          <span className="text-muted-foreground/20">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {detail && <MatrixDetail detail={detail} charById={charById} locById={locById} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MatrixDetail({ detail, charById, locById }) {
  const { type, entity, event } = detail;
  return (
    <div className="px-4 py-4 space-y-4">
      <SheetHeader className="p-0 space-y-1">
        <SheetDescription className="uppercase tracking-wide text-[11px]">
          {type === "event" ? "Sự kiện" : type === "character" ? "Nhân vật" : "Địa danh"} — xem nhanh
        </SheetDescription>
        <SheetTitle className="font-display text-lg leading-tight">
          {type === "event" ? event.title : entity.name}
        </SheetTitle>
      </SheetHeader>

      {type === "character" && (
        <CharacterBlock c={entity} event={event} estate={(event.participant_states || {})[entity.id]} locById={locById} />
      )}
      {type === "location" && <LocationBlock l={entity} event={event} charById={charById} />}
      {type === "event" && <EventBlock event={event} charById={charById} locById={locById} />}
    </div>
  );
}

function EventBlock({ event, charById, locById }) {
  return (
    <>
      {event.timeline_order != null && <Chip label="Thứ tự" value={`#${event.timeline_order}`} />}
      {event.description && (
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{event.description}</p>
      )}
      {event.related_character_ids?.length > 0 && (
        <div>
          <h4 className="text-xs font-medium mb-1.5 text-muted-foreground">Nhân vật xuất hiện</h4>
          <div className="space-y-1.5">
            {event.related_character_ids.map((cid) => {
              const c = charById[cid];
              const st = (event.participant_states || {})[cid];
              return (
                <div key={cid} className="flex items-center gap-2 flex-wrap">
                  {c ? (
                    <Link to={`/nhan-vat/${cid}`} className="text-sm font-medium hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> {c.name}
                    </Link>
                  ) : (
                    <span>?</span>
                  )}
                  {st && <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted">{st}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {event.related_location_ids?.length > 0 && (
        <div>
          <h4 className="text-xs font-medium mb-1.5 text-muted-foreground">Địa danh xuất hiện</h4>
          <div className="flex flex-wrap gap-1.5">
            {event.related_location_ids.map((lid) => {
              const l = locById[lid];
              return l ? (
                <span key={lid} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{l.name}</span>
              ) : null;
            })}
          </div>
        </div>
      )}
      <CustomFieldsList formType="event" data={event} className="text-sm" />
    </>
  );
}

function CharacterBlock({ c, event, estate, locById }) {
  const locs = (event.related_location_ids || []).map((lid) => locById[lid]).filter(Boolean);
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full overflow-hidden bg-muted shrink-0 border border-border">
          {c.avatar_url && <Image src={c.avatar_url} alt={c.name} className="w-full h-full object-cover" />}
        </div>
        <div className="min-w-0">
          {c.aliases && <div className="text-xs text-muted-foreground truncate">{c.aliases}</div>}
          {c.role && <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{c.role}</span>}
        </div>
      </div>
      {c.description && <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6">{c.description}</p>}

      <div className="rounded-xl border border-border p-3 bg-muted/40 space-y-2">
        <div className="text-xs font-medium">Tại sự kiện «{event.title}»</div>
        {estate ? <Chip label="Trạng thái" value={estate} /> : <p className="text-xs text-muted-foreground">Tham gia (không có trạng thái đặc biệt).</p>}
        {locs.length > 0 && (
          <div className="text-xs">
            <span className="text-muted-foreground">Địa danh: </span>
            {locs.map((l, i) => (
              <span key={l.id} className="font-medium">{l.name}{i < locs.length - 1 ? ", " : ""}</span>
            ))}
          </div>
        )}
      </div>

      <CustomFieldsList formType="character" data={c} />
      <Link to={`/nhan-vat/${c.id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ExternalLink className="w-3 h-3" /> Xem trang nhân vật
      </Link>
    </>
  );
}

function LocationBlock({ l, event, charById }) {
  const chars = (event.related_character_ids || []).map((cid) => charById[cid]).filter(Boolean);
  return (
    <>
      {l.type && <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{l.type}</span>}
      {l.description && <p className="text-sm text-muted-foreground leading-relaxed">{l.description}</p>}
      <div className="rounded-xl border border-border p-3 bg-muted/40 space-y-1">
        <div className="text-xs font-medium">Tại sự kiện «{event.title}»</div>
        {chars.length ? (
          <div className="text-xs">
            <span className="text-muted-foreground">Nhân vật có mặt: </span>
            {chars.map((cn, i) => (
              <span key={cn.id} className="font-medium">{cn.name}{i < chars.length - 1 ? ", " : ""}</span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Chưa có nhân vật gắn vào sự kiện này.</p>
        )}
      </div>
      <CustomFieldsList formType="location" data={l} />
    </>
  );
}

function Chip({ label, value }) {
  return (
    <div className="text-xs">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}