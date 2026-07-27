import React, { useEffect, useState, useMemo } from "react";
import { Image } from "@/components/ui/image";
import LocationFormModal from "@/components/LocationFormModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { MapPin, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import { listLocations, deleteLocation } from "@/lib/worldcrud";

// Trang địa danh — hiển thị theo cấu trúc phân cấp + CRUD
const TYPE_STYLES = {
  "Quốc gia": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "Vùng đất": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "Môn phái": "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  "Thành trì": "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  "Khác": "bg-muted text-muted-foreground",
};

export default function Locations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  function load() {
    listLocations().then(setLocations).finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingLoc(null);
    setModalOpen(true);
  }
  function openEdit(loc) {
    setEditingLoc(loc);
    setModalOpen(true);
  }
  async function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await deleteLocation(id);
      load();
    } catch (e) {
      // lỗi hiển thị qua toast không bắt buộc
      console.error(e);
    }
  }

  // Nhóm theo địa danh cấp trên (parent) — tạo cấu trúc cây 2 cấp
  const tree = useMemo(() => {
    const byId = Object.fromEntries(locations.map((l) => [l.id, { ...l, children: [] }]));
    const roots = [];
    Object.values(byId).forEach((loc) => {
      if (loc.parent_location_id && byId[loc.parent_location_id]) {
        byId[loc.parent_location_id].children.push(loc);
      } else {
        roots.push(loc);
      }
    });
    return roots;
  }, [locations]);

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" /> Địa danh
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Quốc gia → Vùng đất → Môn phái / Thành trì.</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition shrink-0"
        >
          <Plus className="w-4 h-4" /> Thêm địa danh
        </button>
      </header>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : tree.length ? (
        <div className="space-y-3">
          {tree.map((root) => (
            <LocationNode key={root.id} location={root} depth={0} onEdit={openEdit} onDelete={setDeleteTarget} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <MapPin className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Chưa có địa danh nào.</p>
          <button onClick={openCreate} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <Plus className="w-4 h-4" /> Thêm địa danh đầu tiên
          </button>
        </div>
      )}

      <LocationFormModal
        open={modalOpen}
        location={editingLoc}
        locations={locations}
        onClose={() => { setModalOpen(false); setEditingLoc(null); }}
        onSaved={() => { setModalOpen(false); setEditingLoc(null); load(); }}
        onDeleted={() => { setModalOpen(false); setEditingLoc(null); load(); }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Xóa địa danh này?"
        description={deleteTarget ? `“${deleteTarget.name}” sẽ bị xóa khỏi cây phân cấp.` : ""}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function LocationNode({ location, depth, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = location.children?.length > 0;
  const typeClass = TYPE_STYLES[location.type] || TYPE_STYLES["Khác"];

  return (
    <div style={{ marginLeft: depth > 0 ? 20 : 0 }}>
      <div className={`rounded-2xl border border-border bg-card p-4 transition ${depth > 0 ? "border-l-2 border-l-primary/40" : ""}`}>
        <div className="flex items-start gap-3">
          {hasChildren ? (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-0.5 p-1 rounded-md hover:bg-muted transition"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
            </button>
          ) : (
            <div className="w-6 flex justify-center mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display font-semibold">{location.name}</h3>
                {location.type && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeClass}`}>{location.type}</span>
                )}
              </div>
              {/* Nút thao tác */}
              <div className="flex items-center gap-1 opacity-70 hover:opacity-100 transition">
                <button
                  onClick={() => onEdit(location)}
                  className="p-1.5 rounded-lg hover:bg-muted transition"
                  title="Chỉnh sửa"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(location)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition"
                  title="Xóa"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {location.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{location.description}</p>
            )}
            {location.map_url && (
              <div className="mt-3 w-full h-32 rounded-xl overflow-hidden bg-muted">
                <Image src={location.map_url} alt={location.name} className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="mt-2 space-y-2 border-l border-border ml-4 pl-3">
          {location.children.map((child) => (
            <LocationNode key={child.id} location={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}