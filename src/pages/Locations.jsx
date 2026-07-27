import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { MapPin, ChevronRight } from "lucide-react";

// Trang địa danh — hiển thị theo cấu trúc phân cấp
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

  useEffect(() => {
    base44.entities.Location
      .list("-updated_date", 200)
      .then((data) => setLocations(data || []))
      .finally(() => setLoading(false));
  }, []);

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
      <header className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <MapPin className="w-6 h-6 text-primary" /> Địa danh
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Quốc gia → Vùng đất → Môn phái / Thành trì.</p>
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
            <LocationNode key={root.id} location={root} depth={0} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <MapPin className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Chưa có địa danh nào.</p>
        </div>
      )}
    </div>
  );
}

function LocationNode({ location, depth }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = location.children?.length > 0;
  const typeClass = TYPE_STYLES[location.type] || TYPE_STYLES["Khác"];

  return (
    <div style={{ marginLeft: depth > 0 ? 20 : 0 }}>
      <div
        className={`rounded-2xl border border-border bg-card p-4 transition ${depth > 0 ? "border-l-2 border-l-primary/40" : ""}`}
      >
        <div className="flex items-start gap-3">
          {/* Nút mở rộng */}
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
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-semibold">{location.name}</h3>
              {location.type && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeClass}`}>{location.type}</span>
              )}
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
            <LocationNode key={child.id} location={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}