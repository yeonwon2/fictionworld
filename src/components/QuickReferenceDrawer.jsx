import React, { useState, useEffect, useMemo } from "react";
import { listCharacters, listLocations } from "@/lib/worldcrud";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Image } from "@/components/ui/image";
import { Search, Users, MapPin, X } from "lucide-react";
import { useStory } from "@/lib/StoryContext";

// Bảng tra cứu nhanh dạng slide-over bên phải — bật/tắt từ mọi trang
export default function QuickReferenceDrawer({ open, onOpenChange }) {
  const [query, setQuery] = useState("");
  const [characters, setCharacters] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("characters");

  const { currentStoryId, ready } = useStory();
  // Tải dữ liệu theo bộ truyện hiện tại
  useEffect(() => {
    if (!open || !ready) return;
    setLoading(true);
    Promise.all([
      listCharacters(currentStoryId),
      listLocations(currentStoryId),
    ])
      .then(([c, l]) => {
        setCharacters(c || []);
        setLocations(l || []);
      })
      .finally(() => setLoading(false));
  }, [open, ready, currentStoryId]);

  const q = query.trim().toLowerCase();

  const filteredCharacters = useMemo(
    () =>
      characters.filter((c) =>
        !q
          ? true
          : [c.name, c.aliases, c.role, ...(c.tags || [])]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q))
      ),
    [characters, q]
  );

  const filteredLocations = useMemo(
    () =>
      locations.filter((l) =>
        !q ? true : [l.name, l.type, l.description].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
      ),
    [locations, q]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="font-display text-lg">Tra cứu nhanh</SheetTitle>
        </SheetHeader>

        <div className="px-5 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm nhân vật, địa danh, thẻ..."
              className="pl-9"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="flex gap-1 mt-3">
            <TabButton active={tab === "characters"} onClick={() => setTab("characters")} icon={Users} label="Nhân vật" count={filteredCharacters.length} />
            <TabButton active={tab === "locations"} onClick={() => setTab("locations")} icon={MapPin} label="Địa danh" count={filteredLocations.length} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-10">Đang tải...</div>
          ) : tab === "characters" ? (
            filteredCharacters.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0">
                  {c.avatar_url && <Image src={c.avatar_url} alt={c.name} className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{[c.aliases, c.role].filter(Boolean).join(" · ") || "—"}</div>
                </div>
              </div>
            ))
          ) : (
            filteredLocations.map((l) => (
              <div key={l.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{l.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{[l.type, l.hierarchy_path].filter(Boolean).join(" · ") || "—"}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      <span className={`text-[10px] ${active ? "opacity-80" : "opacity-60"}`}>({count})</span>
    </button>
  );
}