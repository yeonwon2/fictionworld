import React, { useState, useRef, useMemo } from "react";
import { Image } from "@/components/ui/image";
import { User } from "lucide-react";

/**
 * Sơ đồ mối quan hệ trực quan (custom, không cần thư viện ngoài).
 * - Mỗi nhân vật là một nút tròn chứa ảnh đại diện.
 * - Mối quan hệ là đường nối SVG có nhãn.
 * - Kéo thả nút để sắp xếp; nhấp nút để mở bảng thông tin bên.
 */
const NODE_RADIUS = 38;
const CANVAS_W = 900;
const CANVAS_H = 620;

export default function RelationshipGraph({ characters = [], relationships = [], onSelect, onEdgeSelect }) {
  const containerRef = useRef(null);

  // Vị trí ban đầu: xếp vòng tròn
  const [positions, setPositions] = useState(() => {
    const n = characters.length || 1;
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;
    const r = Math.min(CANVAS_W, CANVAS_H) / 2 - 80;
    const map = {};
    characters.forEach((c, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      map[c.id] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
    return map;
  });

  const [draggingId, setDraggingId] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const charById = useMemo(() => {
    const m = {};
    characters.forEach((c) => (m[c.id] = c));
    return m;
  }, [characters]);

  // Xử lý kéo thả nút
  const onPointerDown = (e, id) => {
    e.stopPropagation();
    setDraggingId(id);
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    dragOffset.current = {
      x: (e.clientX - rect.left) * scaleX - positions[id].x,
      y: (e.clientY - rect.top) * scaleY - positions[id].y,
    };
    e.target.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!draggingId) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX - dragOffset.current.x;
    const y = (e.clientY - rect.top) * scaleY - dragOffset.current.y;
    setPositions((prev) => ({
      ...prev,
      [draggingId]: { x: Math.max(NODE_RADIUS, Math.min(CANVAS_W - NODE_RADIUS, x)), y: Math.max(NODE_RADIUS, Math.min(CANVAS_H - NODE_RADIUS, y)) },
    }));
  };

  const onPointerUp = () => setDraggingId(null);

  // Tính điểm trên viền nút để đường nối không chèn vào nút
  const edgePoint = (from, to) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: from.x + (dx / dist) * NODE_RADIUS, y: from.y + (dy / dist) * NODE_RADIUS };
  };

  if (!characters.length) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground text-sm">
        Chưa có nhân vật nào để hiển thị sơ đồ.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-auto rounded-2xl border border-border bg-card/40"
      style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Vẽ các cạnh (mối quan hệ) */}
        {relationships.map((rel) => {
          const from = positions[rel.source_character_id];
          const to = positions[rel.target_character_id];
          if (!from || !to) return null;
          const p1 = edgePoint(from, to);
          const p2 = edgePoint(to, from);
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          return (
            <g key={rel.id}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="hsl(var(--primary) / 0.4)" strokeWidth={1.8} style={{ pointerEvents: "none" }} />
              {rel.relation_type && (
                <g transform={`translate(${mx}, ${my})`} style={{ pointerEvents: "none" }}>
                  <rect x={-36} y={-9} width={72} height={18} rx={9} fill="hsl(var(--card))" stroke="hsl(var(--border))" />
                  <text x={0} y={4} textAnchor="middle" className="fill-foreground" style={{ fontSize: 10, fontWeight: 500 }}>
                    {rel.relation_type}
                  </text>
                </g>
              )}
              {/* Vùng nhận click dọc đường nối để chỉnh sửa / xóa */}
              <line
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke="transparent" strokeWidth={14}
                style={{ cursor: "pointer", pointerEvents: "stroke" }}
                onClick={() => onEdgeSelect?.(rel)}
              />
            </g>
          );
        })}
      </svg>

      {/* Vẽ các nút nhân vật (HTML để dùng Image + pointer dễ dàng) */}
      {characters.map((c) => {
        const pos = positions[c.id];
        if (!pos) return null;
        const isDragging = draggingId === c.id;
        return (
          <button
            key={c.id}
            onPointerDown={(e) => onPointerDown(e, c.id)}
            onClick={() => !isDragging && onSelect?.(c)}
            className={`absolute flex flex-col items-center cursor-grab active:cursor-grabbing ${isDragging ? "z-20" : "z-10"}`}
            style={{
              left: `${(pos.x / CANVAS_W) * 100}%`,
              top: `${(pos.y / CANVAS_H) * 100}%`,
              transform: "translate(-50%, -50%)",
              touchAction: "none",
            }}
          >
            <div
              className={`rounded-full overflow-hidden border-2 bg-card shadow-md transition ${
                isDragging ? "border-primary scale-105" : "border-border hover:border-primary/60"
              }`}
              style={{ width: NODE_RADIUS * 2, height: NODE_RADIUS * 2 }}
            >
              {c.avatar_url ? (
                <Image src={c.avatar_url} alt={c.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <User className="w-6 h-6" />
                </div>
              )}
            </div>
            <span className="mt-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-card/90 border border-border shadow-sm whitespace-nowrap max-w-[90px] truncate">
              {c.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}