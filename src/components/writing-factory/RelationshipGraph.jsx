import React, { useEffect, useMemo, useState } from "react";
import { Network, Loader2, RefreshCw } from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import { buildRelationshipExtractPrompt, RELATIONSHIP_EXTRACT_SCHEMA } from "@/lib/writingFactory/prompts";

const EDGE_COLORS = {
  "lãng mạn": "#e74c3c",
  "thù địch": "#e67e22",
  "gia đình": "#9b59b6",
  "thầy trò": "#27ae60",
  "hữu": "#2980b9",
  "đồng nghiệp": "#3498db",
  "bạn": "#1abc9c",
};

function getColor(type) {
  const t = (type || "").toLowerCase();
  for (const [k, v] of Object.entries(EDGE_COLORS)) {
    if (t.includes(k)) return v;
  }
  return "#888";
}

// Sơ đồ quan hệ nhân vật trực quan — nodes phân bố vòng tròn, edges vẽ SVG lines.
export default function RelationshipGraph({ currentStoryId, genre, docsByKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const analyze = async () => {
    if (!currentStoryId) return;
    setLoading(true);
    setError("");
    try {
      const res = await aiCall(
        buildRelationshipExtractPrompt({ genre, relationText: docsByKey?.quan_he?.content || "" }),
        { jsonSchema: RELATIONSHIP_EXTRACT_SCHEMA }
      );
      setData(res);
    } catch (e) {
      setError("Trích xuất quan hệ lỗi: " + (e?.message || "lỗi"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (docsByKey?.quan_he?.content?.trim()) analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoryId]);

  const layout = useMemo(() => {
    if (!data?.nodes?.length) return null;
    const n = data.nodes.length;
    const cx = 200, cy = 180, r = 140;
    const positions = {};
    data.nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      positions[node.id] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
    return positions;
  }, [data]);

  const noDoc = !docsByKey?.quan_he?.content?.trim();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold">Mạng Lưới Quan Hệ</h2>
          <button
            onClick={analyze}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/40 text-primary text-xs hover:bg-primary/10 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {loading ? "Đang phân tích..." : "Phân tích lại"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Đọc tài liệu <b>03_QUAN_HE</b>, trích xuất nhân vật + quan hệ → vẽ sơ đồ trực quan. Click nhân vật để xem chi tiết.
        </p>
      </div>

      {noDoc && !loading && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Chưa có tài liệu <b>03_QUAN_HE</b>.
        </div>
      )}
      {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> AI đang đọc quan hệ và vẽ sơ đồ...
        </div>
      )}

      {layout && data && !loading && (
        <div className="rounded-2xl border border-border bg-card p-4 overflow-x-auto">
          <svg viewBox="0 0 400 360" className="w-full max-w-[500px] mx-auto" style={{ minHeight: 280 }}>
            {/* Edges */}
            {data.edges?.map((e, i) => {
              const from = layout[e.source];
              const to = layout[e.target];
              if (!from || !to) return null;
              const color = getColor(e.type);
              const sw = Math.max(1, Math.min(4, e.intensity || 1));
              const isHighlighted = selected === e.source || selected === e.target;
              return (
                <g key={i} opacity={isHighlighted || !selected ? 1 : 0.2}>
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={sw} strokeDasharray={e.type?.includes("thù") ? "4,3" : "none"} />
                  {e.label && (
                    <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 4} textAnchor="middle" fontSize={8} fill={color} fontWeight="500">
                      {e.label}
                    </text>
                  )}
                </g>
              );
            })}
            {/* Nodes */}
            {data.nodes.map((node) => {
              const pos = layout[node.id];
              if (!pos) return null;
              const isSelected = selected === node.id;
              const hasEdge = data.edges?.some((e) => e.source === node.id || e.target === node.id);
              return (
                <g key={node.id} onClick={() => setSelected(isSelected ? null : node.id)} style={{ cursor: "pointer" }}>
                  <circle cx={pos.x} cy={pos.y} r={isSelected ? 22 : 16} fill={isSelected ? "#3b82f6" : hasEdge ? "#dbeafe" : "#f3f4f6"} stroke="#3b82f6" strokeWidth={isSelected ? 2 : 1} />
                  <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={isSelected ? 9 : 8} fill={isSelected ? "#fff" : "#1e40af"} fontWeight="600">
                    {node.name.length > 5 ? node.name.slice(0, 4) + "…" : node.name}
                  </text>
                  <text x={pos.x} y={pos.y + 30} textAnchor="middle" fontSize={8} fill="#6b7280">
                    {node.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="flex items-center gap-3 flex-wrap mt-3 justify-center">
            {Object.entries(EDGE_COLORS).slice(0, 5).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1 text-[10px]">
                <div className="w-3 h-0.5 rounded" style={{ backgroundColor: v }} />
                <span className="capitalize">{k}</span>
              </div>
            ))}
          </div>

          {selected && (
            <div className="mt-3 p-2.5 rounded-lg border border-primary/30 bg-primary/5 text-xs">
              <span className="font-semibold">{data.nodes.find((n) => n.id === selected)?.name}</span> — quan hệ:
              {data.edges?.filter((e) => e.source === selected || e.target === selected).map((e, i) => {
                const other = e.source === selected ? e.target : e.source;
                const otherName = data.nodes.find((n) => n.id === other)?.name || other;
                return (
                  <span key={i} className="ml-2">
                    ↔ <b>{otherName}</b>
                    {e.type ? <span className="text-muted-foreground"> ({e.type})</span> : null}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}