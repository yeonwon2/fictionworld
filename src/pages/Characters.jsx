import React, { useEffect, useState, useMemo } from "react";
import CharacterCard from "@/components/CharacterCard";
import CharacterFormModal from "@/components/CharacterFormModal";
import { Input } from "@/components/ui/input";
import { Search, Users, Plus } from "lucide-react";
import { listCharacters } from "@/lib/worldcrud";
import { useStory } from "@/lib/StoryContext";

// Trang danh sách nhân vật — lưới thẻ + lọc/tìm kiếm
export default function Characters() {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { currentStoryId, ready } = useStory();
  function load() {
    setLoading(true);
    listCharacters(currentStoryId).then(setCharacters).finally(() => setLoading(false));
  }
  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready, currentStoryId]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(c) {
    setEditing(c);
    setModalOpen(true);
  }
  function handleSaved() {
    setModalOpen(false);
    setEditing(null);
    load();
  }

  // Danh sách vai trò duy nhất để lọc
  const roles = useMemo(
    () => [...new Set(characters.map((c) => c.role).filter(Boolean))],
    [characters]
  );

  // Lọc theo từ khoá + vai trò
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return characters.filter((c) => {
      const matchQ =
        !q ||
        [c.name, c.aliases, c.role, ...(c.tags || [])]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      const matchRole = !roleFilter || c.role === roleFilter;
      return matchQ && matchRole;
    });
  }, [characters, query, roleFilter]);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Nhân vật
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Danh sách toàn bộ nhân vật trong thế giới của bạn.</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition shrink-0"
        >
          <Plus className="w-4 h-4" /> Thêm nhân vật
        </button>
      </header>

      {/* Thanh tìm kiếm & lọc */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, biệt danh, thẻ..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <FilterChip active={!roleFilter} onClick={() => setRoleFilter("")} label="Tất cả" />
          {roles.map((r) => (
            <FilterChip key={r} active={roleFilter === r} onClick={() => setRoleFilter(r)} label={r} />
          ))}
        </div>
      </div>

      {/* Lưới nhân vật */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
              <div className="aspect-[4/5] bg-muted" />
              <div className="p-3.5 space-y-2">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((c) => (
            <CharacterCard key={c.id} character={c} onEdit={() => openEdit(c)} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Không tìm thấy nhân vật phù hợp.</p>
        </div>
      )}

      <CharacterFormModal
        open={modalOpen}
        character={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSaved={handleSaved}
        onDeleted={handleSaved}
      />
    </div>
  );
}

function FilterChip({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition border ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}