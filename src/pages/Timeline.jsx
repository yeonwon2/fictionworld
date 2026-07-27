import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Clock, Users, Plus, Pencil, Trash2, MapPin } from "lucide-react";
import EventFormModal from "@/components/EventFormModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { listEvents, listCharacters, listLocations, deleteEvent } from "@/lib/worldcrud";
import { useStory } from "@/lib/StoryContext";

// Trang dòng thời gian — niên biểu sự kiện theo thứ tự + CRUD
export default function Timeline() {
  const { currentStoryId, ready } = useStory();
  const [events, setEvents] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([
      listEvents(currentStoryId),
      listCharacters(currentStoryId),
      listLocations(currentStoryId),
    ])
      .then(([e, c, l]) => {
        setEvents(e || []);
        setCharacters(c || []);
        setLocations(l || []);
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready, currentStoryId]);

  function openCreate() {
    setEditingEvent(null);
    setModalOpen(true);
  }
  function openEdit(ev) {
    setEditingEvent(ev);
    setModalOpen(true);
  }
  function handleSaved() {
    setModalOpen(false);
    setEditingEvent(null);
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await deleteEvent(id);
      load();
    } catch (e) {
      console.error(e);
    }
  }

  const sorted = useMemo(
    () => [...events].sort((a, b) => (a.timeline_order || 0) - (b.timeline_order || 0)),
    [events]
  );
  const charById = useMemo(() => Object.fromEntries(characters.map((c) => [c.id, c])), [characters]);
  const locById = useMemo(() => Object.fromEntries(locations.map((l) => [l.id, l])), [locations]);

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <header className="mb-8 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" /> Dòng thời gian
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Niên biểu các sự kiện theo thứ tự thời gian — gán nhân vật & địa danh liên quan.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition shrink-0"
        >
          <Plus className="w-4 h-4" /> Thêm sự kiện
        </button>
      </header>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : sorted.length ? (
        <div className="relative">
          <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
          <div className="space-y-5">
            {sorted.map((ev, idx) => (
              <div key={ev.id} className="relative pl-12">
                <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-background shadow-sm" />
                <div className="absolute -left-1 top-0 text-[10px] font-mono text-muted-foreground/60">
                  {String(idx + 1).padStart(2, "0")}
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 hover:shadow-sm transition">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-display font-semibold">{ev.title}</h3>
                    <div className="flex items-center gap-1">
                      {ev.timeline_order != null && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                          #{ev.timeline_order}
                        </span>
                      )}
                      <button onClick={() => openEdit(ev)} className="p-1.5 rounded-lg hover:bg-muted transition" title="Sửa">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(ev)} className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition" title="Xóa">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {ev.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{ev.description}</p>
                  )}

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

                  {ev.related_location_ids?.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      {ev.related_location_ids.map((lid) => {
                        const lc = locById[lid];
                        if (!lc) return null;
                        return (
                          <span
                            key={lid}
                            className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          >
                            {lc.name}
                          </span>
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
          <button
            onClick={openCreate}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Plus className="w-4 h-4" /> Thêm sự kiện đầu tiên
          </button>
        </div>
      )}

      <EventFormModal
        open={modalOpen}
        event={editingEvent}
        characters={characters}
        locations={locations}
        onClose={() => { setModalOpen(false); setEditingEvent(null); }}
        onSaved={handleSaved}
        onDeleted={handleSaved}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Xóa sự kiện này?"
        description={deleteTarget ? `“${deleteTarget.title}” sẽ bị gỡ khỏi dòng thời gian.` : ""}
        onConfirm={confirmDelete}
      />
    </div>
  );
}