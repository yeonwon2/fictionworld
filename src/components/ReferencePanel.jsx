import React, { useEffect, useMemo, useState } from "react";
import { listCharacters, listLocations } from "@/lib/worldcrud";
import { Input } from "@/components/ui/input";
import { Image } from "@/components/ui/image";
import { Search, Users, MapPin } from "lucide-react";
import { useStory } from "@/lib/StoryContext";

// Bảng tra cứu thông tin — hiển thị bên cạnh trình soạn thảo.
export default function ReferencePanel() {
  const { currentStoryId, ready } = useStory();
  const [characters, setCharacters] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("characters");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!ready) return;
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
  }, [ready, currentStoryId]);

  const q = query.trim().toLowerCase();
  const filteredChars = useMemo(
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
  const filteredLocs = useMemo(
    () =>
      locations.filter((l) =>
        !q
          ? true
          : [l.name, l.type, l.description].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
      ),
    [locations, q]
  );

  const list = tab === "characters" ? filteredChars : filteredLocs;

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-3 py-3 border-b border-border">
        <div className="flex items-center gap-1.5 mb-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="font-display text-sm font-semibold">Tra cứu thông tin</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm nhân vật, địa danh..."
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex gap-1 mt-2">
          <TabBtn
            active={tab === "characters"}
            onClick={() => { setTab("characters"); setSelected(null); }}
            icon={Users}
            label={`Nhân vật (${filteredChars.length})`}
          />
          <TabBtn
            active={tab === "locations"}
            onClick={() => { setTab("locations"); setSelected(null); }}
            icon={MapPin}
            label={`Địa danh (${filteredLocs.length})`}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="text-center text-xs text-muted-foreground py-6">Đang tải...</div>
        ) : selected ? (
          <div className="p-2 space-y-3">
            <button onClick={() => setSelected(null)} className="text-xs text-primary hover:underline">
              ← Quay lại danh sách
            </button>
            {tab === "characters" ? (
              <CharacterQuick character={selected} />
            ) : (
              <LocationQuick location={selected} />
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {list.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-6">Không có kết quả.</div>
            ) : (
              list.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className="w-full text-left p-2 rounded-lg hover:bg-muted transition flex items-center gap-2.5"
                >
                  {tab === "characters" ? (
                    <>
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-muted shrink-0">
                        {item.avatar_url && (
                          <Image src={item.avatar_url} alt={item.name} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{item.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {[item.role, item.aliases].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{item.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{item.type || "—"}</div>
                      </div>
                    </>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
      }`}
    >
      <Icon className="w-3 h-3" /> {label}
    </button>
  );
}

function CharacterQuick({ character: c }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-14 h-14 rounded-full overflow-hidden bg-muted shrink-0 border-2 border-primary/30">
          {c.avatar_url && <Image src={c.avatar_url} alt={c.name} className="w-full h-full object-cover" />}
        </div>
        <div className="min-w-0">
          <div className="font-display font-semibold truncate">{c.name}</div>
          {c.aliases && <div className="text-xs text-muted-foreground truncate">{c.aliases}</div>}
          {c.role && (
            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {c.role}
            </span>
          )}
        </div>
      </div>
      {c.description && (
        <div className="text-xs leading-relaxed text-muted-foreground line-clamp-6">{c.description}</div>
      )}
      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        {c.power_level && <Field label="Năng lực" value={c.power_level} />}
        {c.skills && <Field label="Kỹ năng" value={c.skills} />}
        {c.personality && <Field label="Tính cách" value={c.personality} />}
        {c.items && <Field label="Vật phẩm" value={c.items} />}
      </div>
    </div>
  );
}

function LocationQuick({ location: l }) {
  return (
    <div>
      <div className="font-display font-semibold mb-1">{l.name}</div>
      {l.type && (
        <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary mb-2">
          {l.type}
        </span>
      )}
      {l.map_url && (
        <div className="w-full h-32 rounded-xl overflow-hidden bg-muted mb-2">
          <Image src={l.map_url} alt={l.name} className="w-full h-full object-cover" />
        </div>
      )}
      {l.description && (
        <div className="text-xs leading-relaxed text-muted-foreground">{l.description}</div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="rounded-lg bg-muted/60 p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-[11px] font-medium line-clamp-2">{value}</div>
    </div>
  );
}