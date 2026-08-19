import React, { useMemo, useState } from "react";
import { GitBranch, ChevronLeft, ChevronRight, AlertTriangle, AlertOctagon, Info, Pencil } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { normalizeAndRepair } from "@/lib/gameStudio/postprocess";
import { buildRoutes, graphReachable, extractWarningNodeIds, severityOf } from "@/lib/gameStudio/routeExplorer";
import { ENDING_TYPES } from "@/lib/gameStudio/rpgThemes";
import NodeEditorDrawer from "@/components/game-studio/NodeEditorDrawer";

// Phase 1+2: tách kịch bản thành từng tuyến chơi cụ thể, đọc như 1 truyện
// tuyến tính, liệt kê vấn đề toàn cục có đánh dấu tuyến bị ảnh hưởng, VÀ cho
// sửa trực tiếp ngay tại cảnh đang đọc (tái dùng NodeEditorDrawer — cùng 1
// editor Studio/Xưởng đã dùng, không viết editor thứ hai). CHƯA có: chèn cảnh
// mới giữa 2 cảnh, undo/redo riêng cho tuyến, ghép ngược ra lại thành text
// kịch bản gốc (đó vẫn là việc của nút "Sản Xuất Game" ở từng xưởng).
//
// Nguồn dữ liệu: LUÔN đọc thẳng `gameData.nodes` — đây chính là Canonical
// Script Model thật của app (GamePlayer.jsx và rpgExport.js cũng chạy trên
// đúng object này, không phải bản re-parse từ text). Từng nút "Sản Xuất Game"
// ở mỗi xưởng (Thiết Kế/Hệ Thống/NPC/Cung Đấu/Trọng Sinh) đã tự parse đúng cú
// pháp của xưởng đó rồi ghi thẳng vào gameData.nodes — nên KHÔNG cần đoán lại
// hay re-parse `meta.sourceScript` ở đây nữa (bản cũ từng làm vậy và đoán sai
// xưởng, đọc kịch bản Cung Đấu bằng cú pháp Xưởng Thiết Kế, ra 400 tuyến rác).
// Muốn cập nhật theo kịch bản text mới, bấm "Sản Xuất Game" ở tab Xưởng tương
// ứng như bình thường — Tuyến Chơi sẽ tự cập nhật theo vì cùng đọc gameData.
//
// Sửa tại đây ghi THẲNG vào gameData.nodes qua setGameData (giống hệt cách
// Visual Node Tree Editor đã làm) — vì mọi tuyến đều là VIEW tính lại từ cùng
// 1 nodesMap này, sửa 1 cảnh dùng chung sẽ tự phản ánh sang mọi tuyến khác
// ngay khi component re-render, không cần đồng bộ thủ công.

const FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "TRUE_END", label: "TRUE END" },
  { id: "GOOD_END", label: "GOOD END" },
  { id: "NORMAL_END", label: "NORMAL END" },
  { id: "BAD_END", label: "BAD END" },
  { id: "problem", label: "Tuyến lỗi" },
];

const SEVERITY_ICON = {
  critical: <AlertOctagon size={14} className="text-red-500 shrink-0 mt-0.5" />,
  logic: <AlertTriangle size={14} className="text-orange-500 shrink-0 mt-0.5" />,
  warn: <Info size={14} className="text-yellow-500 shrink-0 mt-0.5" />,
};

function effectLines(choice) {
  const lines = [];
  for (const [k, v] of Object.entries(choice.statModifiers || {})) lines.push(`${k} ${v > 0 ? "+" : ""}${v}`);
  for (const gf of (choice.grantFlags || [])) lines.push(`Cờ: ${gf}`);
  if (choice.grantItem) lines.push(`Vật phẩm: ${choice.grantItem}`);
  if (choice.requiresFlag) lines.push(`Cần cờ: ${choice.requiresFlag}`);
  if (choice.requiresFlagAbsent) lines.push(`Cần không có cờ: ${choice.requiresFlagAbsent}`);
  if (choice.requiresItem) lines.push(`Cần vật phẩm: ${choice.requiresItem}`);
  for (const [k, v] of Object.entries(choice.statRequirements || {})) lines.push(`Cần ${k} ≥ ${v}`);
  for (const [k, v] of Object.entries(choice.statRequirementsMax || {})) lines.push(`Cần ${k} ≤ ${v}`);
  return lines;
}

function routeEndingCategory(route) {
  if (route.status !== "ok") return "problem";
  return route.endingType || "NORMAL_END";
}

function useExplorerData(gameData) {
  return useMemo(() => {
    const meta = gameData?.meta || {};
    let nodes, warnings;
    try {
      const clone = JSON.parse(JSON.stringify(gameData?.nodes || {}));
      const statKeys = (meta.statsConfig || []).map((s) => s.key);
      const repaired = normalizeAndRepair(clone, statKeys, 0, { forceNonEmptyModifiers: false, statsConfig: meta.statsConfig });
      nodes = repaired.nodes;
      warnings = repaired.warnings;
    } catch (e) {
      return { error: e.message, nodes: null, warnings: [], routes: [], sceneUsage: new Map(), truncated: false, endings: [] };
    }
    const { routes, truncated, sceneUsage } = buildRoutes(nodes, meta.statsConfig || []);
    const { endings } = graphReachable(nodes);
    return { error: null, nodes, warnings, routes, sceneUsage, truncated, endings };
  }, [gameData?.nodes, gameData?.meta?.statsConfig]);
}

export default function RouteExplorerTab({ gameData, setGameData }) {
  const data = useExplorerData(gameData);
  const [filter, setFilter] = useState("all");
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [subTab, setSubTab] = useState("routes");
  const [editingId, setEditingId] = useState(null);

  const routes = data.routes || [];
  const filtered = useMemo(() => {
    if (filter === "all") return routes;
    if (filter === "problem") return routes.filter((r) => r.status !== "ok");
    return routes.filter((r) => routeEndingCategory(r) === filter);
  }, [routes, filter]);

  const selected = filtered.find((r) => r.id === selectedRouteId) || filtered[0] || null;
  const selectedIndex = selected ? filtered.indexOf(selected) : -1;

  const goTo = (routeId) => { setSelectedRouteId(routeId); setSubTab("routes"); };
  const step = (delta) => {
    if (selectedIndex < 0) return;
    const next = filtered[selectedIndex + delta];
    if (next) setSelectedRouteId(next.id);
  };

  // Ghi patch THẲNG vào gameData.nodes thật (không phải bản clone đã qua
  // normalizeAndRepair ở useExplorerData) — mọi tuyến đọc lại nodesMap này
  // trên lần render kế tiếp nên tự động phản ánh thay đổi ở mọi nơi cảnh này
  // xuất hiện, không cần đồng bộ thủ công.
  const updateNode = (id, patch) => {
    const nodes = gameData.nodes || {};
    setGameData({ ...gameData, nodes: { ...nodes, [id]: { ...nodes[id], ...patch } } });
  };

  const problemCount = routes.filter((r) => r.status !== "ok").length;
  // Số kết thúc THẬT theo cấu trúc kịch bản (graphReachable — luôn chính xác,
  // không phụ thuộc mẫu tuyến có bị cắt hay không). Đếm theo route trong danh
  // sách mẫu là SAI khi kịch bản lớn (đã xảy ra thật: báo "0 TRUE_END" dù kịch
  // bản có TRUE_END, chỉ vì mẫu 400 tuyến chưa kịp chạm tới).
  const endings = data.endings || [];
  const endingCounts = { TRUE_END: 0, GOOD_END: 0, NORMAL_END: 0, BAD_END: 0 };
  for (const e of endings) if (endingCounts[e.type] !== undefined) endingCounts[e.type]++;
  const reachedInSample = new Set(routes.filter((r) => r.status === "ok" && r.endingId).map((r) => r.endingId));
  const missingFromSample = endings.filter((e) => !reachedInSample.has(e.id));

  if (data.error) {
    return (
      <section className="glass-card rounded-2xl p-5 space-y-2">
        <h3 className="font-semibold text-sm flex items-center gap-2"><GitBranch size={15} /> Tuyến Chơi & Vấn Đề</h3>
        <p className="text-sm text-red-500">Không đọc được dữ liệu game: {data.error}</p>
      </section>
    );
  }

  const editingNode = editingId ? gameData.nodes?.[editingId] : null;

  return (
    <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <GitBranch size={15} /> Tuyến Chơi &amp; Vấn Đề
        </h3>
        <span className="text-[11px] text-muted-foreground">
          Sửa ở đây cập nhật thẳng vào dữ liệu game — nếu vừa sửa kịch bản text ở tab Xưởng, bấm "Sản Xuất Game" ở đó trước để đồng bộ.
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary">{endings.length} kết thúc trong kịch bản</Badge>
        <Badge variant="secondary">👑 {endingCounts.TRUE_END} TRUE END</Badge>
        <Badge variant="secondary">🌟 {endingCounts.GOOD_END} GOOD END</Badge>
        <Badge variant="secondary">⚖️ {endingCounts.NORMAL_END} NORMAL END</Badge>
        <Badge variant="secondary">💀 {endingCounts.BAD_END} BAD END</Badge>
        <Badge variant="outline">{routes.length} tuyến đọc mẫu</Badge>
        {problemCount > 0 && <Badge variant="destructive">{problemCount} tuyến mẫu có vấn đề</Badge>}
        {data.warnings.length > 0 && <Badge variant="outline">{data.warnings.length} cảnh báo toàn cục</Badge>}
      </div>
      {data.truncated && (
        <p className="text-[11px] text-yellow-600 flex items-center gap-1"><AlertTriangle size={12} /> Kịch bản rẽ nhánh quá lớn — danh sách tuyến bên dưới chỉ là MẪU đại diện công bằng cho mọi nhánh, không phải toàn bộ. Số kết thúc ở trên vẫn đúng 100% (đếm theo cấu trúc, không theo mẫu).</p>
      )}
      {missingFromSample.length > 0 && (
        <p className="text-[11px] text-orange-600 flex items-center gap-1">
          <AlertTriangle size={12} /> {missingFromSample.length} kết thúc có thật trong kịch bản nhưng KHÔNG tìm được tuyến nào chạm tới (kể cả sau khi dò riêng theo cấu trúc): {missingFromSample.map((e) => `"${e.label || e.id}"`).join(", ")}. Có thể bị điều kiện khoá chặn hoàn toàn — nên kiểm tra ở tab Vấn Đề.
        </p>
      )}

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="routes">Tuyến Chơi</TabsTrigger>
          <TabsTrigger value="problems">Vấn Đề {data.warnings.length > 0 && `(${data.warnings.length})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="routes" className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                  filter === f.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {!filtered.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Không có tuyến nào khớp bộ lọc.</p>
          ) : (
            <div className="grid md:grid-cols-[220px_1fr] gap-3">
              <div className="max-h-[520px] overflow-y-auto space-y-1 pr-1 border-r border-border/60 md:pr-3">
                {filtered.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRouteId(r.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs border transition ${
                      selected?.id === r.id ? "border-primary bg-accent/50" : "border-transparent hover:bg-accent/30"
                    }`}
                  >
                    <div className="font-medium flex items-center gap-1.5">
                      {r.status !== "ok" ? <AlertTriangle size={11} className="text-orange-500" /> : <span>{ENDING_TYPES[r.endingType]?.icon || "•"}</span>}
                      {r.id.replace("route_", "Tuyến ")}
                      {r.guided && <span title="Kết thúc hiếm — dò riêng theo cấu trúc, không nằm trong mẫu công bằng thường">🧭</span>}
                    </div>
                    <div className="text-muted-foreground truncate">
                      {r.status === "ok" ? (r.endingLabel || ENDING_TYPES[r.endingType]?.label || "Kết thúc") :
                        r.status === "dead_end" ? "Kẹt cứng" : r.status === "loop" ? "Vòng lặp" : "Quá dài (đã cắt)"}
                      {" · "}{r.sceneCount} cảnh
                    </div>
                  </button>
                ))}
              </div>

              <div>
                {selected ? (
                  <RouteReader
                    route={selected}
                    sceneUsage={data.sceneUsage}
                    warnings={data.warnings}
                    onPrev={() => step(-1)}
                    onNext={() => step(1)}
                    hasPrev={selectedIndex > 0}
                    hasNext={selectedIndex >= 0 && selectedIndex < filtered.length - 1}
                    position={`${selectedIndex + 1} / ${filtered.length}`}
                    onEditScene={setEditingId}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground py-6 text-center">Chọn 1 tuyến để đọc.</p>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="problems">
          <ProblemsPanel warnings={data.warnings} sceneUsage={data.sceneUsage} onJumpToRoute={goTo} />
        </TabsContent>
      </Tabs>

      <NodeEditorDrawer
        node={editingNode}
        allNodes={gameData.nodes || {}}
        statsConfig={gameData.meta?.statsConfig || []}
        archetype={gameData.meta?.archetype}
        defaultNpcAvatar={gameData.meta?.defaultNpcAvatar}
        open={!!editingNode}
        onClose={() => setEditingId(null)}
        onChange={(patch) => updateNode(editingId, patch)}
      />
    </section>
  );
}

function RouteReader({ route, sceneUsage, warnings, onPrev, onNext, hasPrev, hasNext, position, onEditScene }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onPrev} disabled={!hasPrev}>
          <ChevronLeft size={14} /> Tuyến trước
        </Button>
        <span className="text-xs text-muted-foreground">{position}</span>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onNext} disabled={!hasNext}>
          Tuyến sau <ChevronRight size={14} />
        </Button>
      </div>

      <div className="max-h-[460px] overflow-y-auto space-y-3 pr-1">
        {route.steps.map((step, i) => {
          const usageCount = sceneUsage.get(step.sceneId)?.length || 0;
          const sceneWarnings = warnings.filter((w) => extractWarningNodeIds(w).includes(step.sceneId));
          return (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {step.scene.speaker || step.sceneId}
                </span>
                <div className="flex items-center gap-1.5">
                  {usageCount > 1 && <Badge variant="outline" className="text-[10px]">dùng chung {usageCount} tuyến</Badge>}
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5" onClick={() => onEditScene(step.sceneId)}>
                    <Pencil size={11} className="mr-1" /> Sửa
                  </Button>
                </div>
              </div>
              {sceneWarnings.length > 0 && (
                <div className="space-y-1">
                  {sceneWarnings.map((w, wi) => (
                    <div key={wi} className="flex items-start gap-1.5 text-[11px] text-orange-600 bg-orange-500/10 rounded px-2 py-1">
                      {SEVERITY_ICON[severityOf(w)]}
                      <span>{w.replace(/^\[GỢI Ý\]\s*/, "")}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-sm whitespace-pre-line leading-relaxed">{step.scene.text}</p>
              {step.choice && (
                <div className="mt-2 pt-2 border-t border-dashed border-border/70 text-xs">
                  <div className="font-medium text-primary">→ {step.choice.text}</div>
                  {effectLines(step.choice).map((l, li) => (
                    <div key={li} className="text-muted-foreground pl-3">↳ {l}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="rounded-lg border-2 border-dashed border-primary/40 p-3 text-center space-y-2">
          {route.status === "ok" ? (
            <>
              <div className="text-lg">{ENDING_TYPES[route.endingType]?.icon}</div>
              <div className="text-sm font-semibold">{route.endingLabel || ENDING_TYPES[route.endingType]?.label}</div>
              <div className="text-[11px] text-muted-foreground">{ENDING_TYPES[route.endingType]?.label}</div>
              {route.endingId && (
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5" onClick={() => onEditScene(route.endingId)}>
                  <Pencil size={11} className="mr-1" /> Sửa kết thúc
                </Button>
              )}
            </>
          ) : (
            <div className="text-sm font-semibold text-orange-500 flex items-center justify-center gap-1.5">
              <AlertTriangle size={14} />
              {route.status === "dead_end" ? "Kẹt cứng — không còn lựa chọn nào khả dụng" :
                route.status === "loop" ? "Quay lại đúng trạng thái đã đi qua — dừng ở đây (vòng lặp)" :
                "Tuyến quá dài — đã dừng đọc"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProblemsPanel({ warnings, sceneUsage, onJumpToRoute }) {
  const groups = { critical: [], logic: [], warn: [] };
  for (const w of warnings) groups[severityOf(w)].push(w);

  const jumpTarget = (w) => {
    const ids = extractWarningNodeIds(w);
    for (const id of ids) {
      const routeIds = sceneUsage.get(id);
      if (routeIds && routeIds.length) return routeIds[0];
    }
    return null;
  };

  if (!warnings.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Không có vấn đề nào được phát hiện. 🎉</p>;
  }

  const SECTION = [
    { key: "critical", title: "🔴 Lỗi nghiêm trọng" },
    { key: "logic", title: "🟠 Logic điều kiện" },
    { key: "warn", title: "🟡 Cảnh báo / gợi ý" },
  ];

  return (
    <div className="space-y-4">
      {SECTION.map((s) => groups[s.key].length > 0 && (
        <div key={s.key} className="space-y-1.5">
          <h4 className="text-xs font-semibold">{s.title} ({groups[s.key].length})</h4>
          {groups[s.key].map((w, i) => {
            const target = jumpTarget(w);
            return (
              <div key={i} className="flex items-start gap-2 text-xs rounded-lg border border-border p-2.5">
                {SEVERITY_ICON[s.key]}
                <span className="flex-1 leading-relaxed">{w.replace(/^\[GỢI Ý\]\s*/, "")}</span>
                {target && (
                  <Button size="sm" variant="outline" className="h-6 text-[10px] shrink-0" onClick={() => onJumpToRoute(target)}>
                    Xem tuyến
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
