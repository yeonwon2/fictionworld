import React, { useEffect, useState } from "react";
import { GitBranch, Plus, Trash2, Loader2, Wand2, Check, Pencil, X, Save } from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import {
  buildRoutePlannerPrompt,
  GAME_ROUTE_PLAN_SCHEMA,
  buildGameScriptBlock,
} from "@/lib/gameScriptFactory/prompts";
import { listGameRoutes, createGameRoute, updateGameRoute, deleteGameRoute, listGameScenes } from "@/lib/worldcrud";

const DEFAULT_COLORS = ["#8b5cf6", "#06b6d4", "#ef4444", "#f59e0b", "#10b981", "#ec4899", "#3b82f6", "#f97316"];

// Quản lý TUYẾN KỊCH BẢN (branch/route): danh sách tuyến, AI đề xuất tuyến mới
// theo nguyên tắc loại game, thêm/sửa/xoá thủ công, màu để vẽ timeline.
export default function RoutePlanner({ currentStoryId, gameType, docsByKey, idea }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [targetCount, setTargetCount] = useState(3);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [sceneCounts, setSceneCounts] = useState({});

  const loadRoutes = async () => {
    if (!currentStoryId) return;
    setLoading(true);
    try {
      const list = (await listGameRoutes(currentStoryId)) || [];
      setRoutes(list);
      const counts = {};
      await Promise.all(
        list.map(async (r) => {
          try {
            counts[r.route_key] = ((await listGameScenes(currentStoryId, r.route_key)) || []).length;
          } catch {
            counts[r.route_key] = 0;
          }
        })
      );
      setSceneCounts(counts);
    } catch (e) {
      setError("Không tải được tuyến: " + (e?.message || "lỗi"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoryId]);

  const handlePlan = async () => {
    setError("");
    setProposals([]);
    setPlanning(true);
    try {
      const docsText = buildGameScriptBlock(docsByKey);
      const prompt = buildRoutePlannerPrompt({ gameType, docsText, targetRoutes: targetCount });
      const res = await aiCall(prompt, { jsonSchema: GAME_ROUTE_PLAN_SCHEMA });
      setProposals(res?.routes || []);
    } catch (e) {
      setError("AI lên tuyến lỗi: " + (e?.message || "lỗi"));
    } finally {
      setPlanning(false);
    }
  };

  const acceptProposal = async (p) => {
    const existing = routes.map((r) => r.route_key);
    let key = p.key || slugify(p.name);
    let n = 2;
    while (existing.includes(key)) {
      key = `${p.key || slugify(p.name)}_${n}`;
      n++;
    }
    try {
      const row = await createGameRoute({
        story_id: currentStoryId,
        route_key: key,
        name: p.name,
        color: p.color || DEFAULT_COLORS[routes.length % DEFAULT_COLORS.length],
        description: p.description || "",
        sort_order: routes.length + 1,
      });
      setRoutes((rs) => [...rs, row]);
      setProposals((ps) => ps.filter((x) => x !== p));
    } catch (e) {
      setError("Không thêm được tuyến: " + (e?.message || "lỗi"));
    }
  };

  const acceptAll = async () => {
    for (const p of proposals) {
      await acceptProposal(p);
    }
  };

  const handleCreate = async (name) => {
    if (!name.trim()) return;
    const key = slugify(name);
    const dup = routes.some((r) => r.route_key === key);
    if (dup) {
      setError("Đã có tuyến trùng mã. Hãy đổi tên.");
      return;
    }
    try {
      const row = await createGameRoute({
        story_id: currentStoryId,
        route_key: key,
        name: name.trim(),
        color: DEFAULT_COLORS[routes.length % DEFAULT_COLORS.length],
        description: "",
        sort_order: routes.length + 1,
      });
      setRoutes((rs) => [...rs, row]);
      setAdding(false);
    } catch (e) {
      setError("Không thêm được tuyến: " + (e?.message || "lỗi"));
    }
  };

  const handleSaveEdit = async (route) => {
    if (!route.name.trim()) return;
    try {
      const row = await updateGameRoute(route.id, { name: route.name, description: route.description, color: route.color });
      setRoutes((rs) => rs.map((r) => (r.id === row.id ? row : r)));
      setEditing(null);
    } catch (e) {
      setError("Không lưu được tuyến: " + (e?.message || "lỗi"));
    }
  };

  const handleDelete = async (route) => {
    if (!window.confirm(`Xoá tuyến "${route.name}" và toàn bộ phân cảnh của tuyến? Không thể hoàn tác.`)) return;
    try {
      await deleteGameRoute(route.id);
      setRoutes((rs) => rs.filter((r) => r.id !== route.id));
    } catch (e) {
      setError("Không xoá được tuyến: " + (e?.message || "lỗi"));
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <GitBranch className="w-4 h-4 text-primary" />
        <h3 className="font-display font-semibold text-sm">Tuyến Kịch Bản (Branch / Route)</h3>
        <span className="text-xs text-muted-foreground">— các storyline của game; mỗi tuyến có timeline riêng theo dõi ở tab Timeline Tuyến</span>
      </div>

      {error && <p className="text-xs text-destructive mt-2">{error}</p>}

      {/* Hành động AI + thêm thủ công */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <input
          type="number"
          min={1}
          max={8}
          value={targetCount}
          onChange={(e) => setTargetCount(Math.max(1, Math.min(8, Number(e.target.value) || 3)))}
          className="w-16 rounded-md border border-input bg-transparent px-2 py-1.5 text-xs"
          title="Số tuyến AI đề xuất"
        />
        <button
          onClick={handlePlan}
          disabled={planning}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          {planning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          {planning ? "Đang lên tuyến..." : "Lên tuyến bằng AI"}
        </button>
        <button
          onClick={() => setAdding((a) => !a)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-primary/40 text-primary text-xs hover:bg-primary/10"
        >
          <Plus className="w-3.5 h-3.5" /> Thêm tuyến
        </button>
      </div>

      {/* Thêm thủ công */}
      {adding && (
        <AddRouteForm
          onCancel={() => setAdding(false)}
          onCreate={handleCreate}
        />
      )}

      {/* Đề xuất AI */}
      {proposals.length > 0 && (
        <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-primary">AI đề xuất {proposals.length} tuyến</span>
            <button onClick={acceptAll} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] hover:opacity-90">
              <Check className="w-3 h-3" /> Thêm tất cả
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-2 mt-2">
            {proposals.map((p, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color || "#8b5cf6" }} />
                  <span className="text-xs font-semibold">{p.name}</span>
                  {p.ending_type && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{p.ending_type}</span>
                  )}
                  <button onClick={() => acceptProposal(p)} className="ml-auto inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                    <Plus className="w-3 h-3" /> Thêm
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{p.description}</p>
                {p.unlock_condition && (
                  <p className="text-[10px] text-muted-foreground mt-1">🔓 Mở khoá: {p.unlock_condition}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danh sách tuyến */}
      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="text-xs text-muted-foreground">Đang tải tuyến...</p>
        ) : routes.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Chưa có tuyến nào. Bấm "Lên tuyến bằng AI" hoặc "Thêm tuyến" để bắt đầu.
          </p>
        ) : (
          routes.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-muted/20 p-3">
              {editing === r.id ? (
                <div className="space-y-2">
                  <input
                    value={r.name}
                    onChange={(e) => setRoutes((rs) => rs.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))}
                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                    placeholder="Tên tuyến"
                  />
                  <input
                    type="color"
                    value={r.color || "#8b5cf6"}
                    onChange={(e) => setRoutes((rs) => rs.map((x) => (x.id === r.id ? { ...x, color: e.target.value } : x)))}
                    className="h-8 w-14 rounded-md border border-input bg-transparent cursor-pointer"
                  />
                  <textarea
                    value={r.description || ""}
                    onChange={(e) => setRoutes((rs) => rs.map((x) => (x.id === r.id ? { ...x, description: e.target.value } : x)))}
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
                    placeholder="Mô tả tuyến kịch bản..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(r)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] hover:opacity-90"
                    >
                      <Save className="w-3 h-3" /> Lưu
                    </button>
                    <button onClick={() => setEditing(null)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-[11px] hover:bg-muted">
                      <X className="w-3 h-3" /> Huỷ
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full mt-1 shrink-0" style={{ background: r.color || "#8b5cf6" }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{r.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {sceneCounts[r.route_key] || 0} phân cảnh
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground opacity-70">{r.route_key}</span>
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditing(r.id)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted" title="Sửa tuyến">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(r)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Xoá tuyến">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AddRouteForm({ onCreate, onCancel }) {
  const [name, setName] = useState("");
  return (
    <div className="mt-3 flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCreate(name);
        }}
        placeholder="Tên tuyến (VD: Tuyến Lâm Mục, Tuyến Hội Thảo)..."
        className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
        autoFocus
      />
      <button onClick={() => onCreate(name)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] hover:opacity-90">
        <Plus className="w-3 h-3" /> Tạo
      </button>
      <button onClick={onCancel} className="px-3 py-1.5 rounded-md border border-border text-[11px] hover:bg-muted">
        Huỷ
      </button>
    </div>
  );
}

function slugify(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}