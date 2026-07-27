import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RelationshipGraph from "@/components/RelationshipGraph";
import RelationshipFormModal from "@/components/RelationshipFormModal";
import { Image } from "@/components/ui/image";
import { Network, X, ArrowRight, Plus } from "lucide-react";
import { listCharacters, listRelationships } from "@/lib/worldcrud";

// Trang sơ đồ mối quan hệ + quản lý CRUD mối quan hệ ngay trên sơ đồ
export default function Relationships() {
  const [characters, setCharacters] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [relModalOpen, setRelModalOpen] = useState(false);
  const [editingRel, setEditingRel] = useState(null);

  function load() {
    Promise.all([listCharacters(), listRelationships()])
      .then(([c, r]) => {
        setCharacters(c);
        setRelationships(r);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openCreateRel() {
    setEditingRel(null);
    setRelModalOpen(true);
  }
  function openEditRel(rel) {
    setEditingRel(rel);
    setRelModalOpen(true);
  }
  function handleRelChange() {
    setRelModalOpen(false);
    setEditingRel(null);
    load();
  }

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
            <Network className="w-6 h-6 text-primary" /> Sơ đồ mối quan hệ
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Kéo thả các nút để sắp xếp. Nhấp vào nhân vật để xem thông tin nhanh — nhấp vào đường nối để chỉnh sửa / xóa.
          </p>
        </div>
        <button
          onClick={openCreateRel}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition shrink-0"
        >
          <Plus className="w-4 h-4" /> Thêm quan hệ
        </button>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 animate-pulse" style={{ aspectRatio: "900/620" }} />
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="min-w-0">
            <RelationshipGraph
              characters={characters}
              relationships={relationships}
              onSelect={setSelected}
              onEdgeSelect={openEditRel}
            />
          </div>

          {/* Bảng thông tin nhanh bên phải */}
          <aside className="lg:sticky lg:top-6 h-fit">
            {selected ? (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-display font-semibold">Thông tin nhanh</h3>
                  <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-muted shrink-0 border-2 border-primary/30">
                    {selected.avatar_url && <Image src={selected.avatar_url} alt={selected.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-semibold text-lg truncate">{selected.name}</div>
                    {selected.aliases && <div className="text-xs text-muted-foreground truncate">{selected.aliases}</div>}
                    {selected.role && (
                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{selected.role}</span>
                    )}
                  </div>
                </div>
                {selected.description && (
                  <div
                    className="text-xs leading-relaxed text-muted-foreground line-clamp-4"
                    dangerouslySetInnerHTML={{ __html: selected.description }}
                  />
                )}
                {selected.power_level && (
                  <div className="mt-3 text-xs">
                    <span className="text-muted-foreground">Năng lực: </span>
                    <span className="font-medium">{selected.power_level}</span>
                  </div>
                )}
                <Link
                  to={`/nhan-vat/${selected.id}`}
                  className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
                >
                  Xem chi tiết <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
                <Network className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Chọn một nhân vật hoặc đường nối trên sơ đồ để xem / chỉnh sửa.</p>
                <button onClick={openCreateRel} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                  <Plus className="w-4 h-4" /> Thêm mối quan hệ mới
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      <RelationshipFormModal
        open={relModalOpen}
        relationship={editingRel}
        characters={characters}
        onClose={() => { setRelModalOpen(false); setEditingRel(null); }}
        onSaved={handleRelChange}
        onDeleted={handleRelChange}
      />
    </div>
  );
}