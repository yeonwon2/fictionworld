import React, { useState, useRef, useEffect } from "react";
import { X, Search, ChevronDown } from "lucide-react";

// Multi-select dạng chip: chọn nhiều id từ danh sách options.
// options: [{ id, label, sublabel? }]
export default function MultiSelectChips({
  options = [],
  selected = [],
  onChange,
  placeholder = "Tìm & thêm...",
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const q = query.trim().toLowerCase();
  const available = options.filter(
    (o) =>
      !selected.includes(o.id) &&
      (!q ||
        String(o.label).toLowerCase().includes(q) ||
        String(o.sublabel || "").toLowerCase().includes(q))
  );

  function add(id) {
    setQuery("");
    onChange([...selected, id]);
  }
  function remove(id) {
    onChange(selected.filter((x) => x !== id));
  }

  const selectedObjs = selected
    .map((id) => options.find((o) => o.id === id))
    .filter(Boolean);

  return (
    <div className="rounded-lg border border-input bg-background">
      {selectedObjs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 border-b border-border">
          {selectedObjs.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary"
            >
              {o.label}
              <button
                type="button"
                onClick={() => remove(o.id)}
                className="hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative" ref={ref}>
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full h-9 pl-8 pr-8 bg-transparent text-sm outline-none"
        />
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        {open && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
            {available.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Không còn lựa chọn.
              </div>
            ) : (
              available.map((o) => (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => add(o.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition flex flex-col"
                >
                  <span className="truncate">{o.label}</span>
                  {o.sublabel && (
                    <span className="text-[11px] text-muted-foreground truncate">
                      {o.sublabel}
                    </span>
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