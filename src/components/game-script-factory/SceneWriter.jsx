import React, { useEffect, useState } from "react";
import {
  Clapperboard,
  Plus,
  Trash2,
  Loader2,
  Wand2,
  Save,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  ListChecks,
} from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import {
  buildGameScriptBlock,
  buildSceneOutlinePrompt,
  GAME_SCENE_OUTLINE_SCHEMA,
  buildSceneWritePrompt,
  buildSceneRevisionPrompt,
  buildGameConsistencyPrompt,
  GAME_CONSISTENCY_SCHEMA,
} from "@/lib/gameScriptFactory/prompts";
import {
  listGameRoutes,
  listGameScenes,
  getGameScene,
  createGameScene,
  updateGameScene,
  deleteGameScene,
} from "@/lib/worldcrud";

const SCENE_TYPE_COLORS = {
  "đối thoại": "#8b5cf6",
  "chọn lựa": "#06b6d4",
  "cutscene": "#3b82f6",
  "khám phá": "#10b981",
  "trận đấu": "#ef4444",
  "nhiệm vụ": "#f59e0b",
  "CG": "#ec4899",
  "thăm dò": "#14b8a6",
  "chạy trốn": "#f97316",
  "jump-scare": "#7f1d1d",
  "hội thoại": "#6366f1",
};

function typeColor(type) {
  const t = (type || "").toLowerCase();
  for (const [k, v] of Object.entries(SCENE_TYPE_COLORS)) {
    if (t.includes(k)) return v;
  }
  return "#94a3b8";
}

// Viết kịch bản theo TUYẾN: chọn tuyến → danh sách phân cảnh → viết/sửa từng
// cảnh theo nguyên tắc loại game. Hỗ trợ lên dàn bằng AI, viết bằng AI, sửa
// theo góp ý, và kiểm tra nhất quán với bộ tài liệu.
export default function SceneWriter({ currentStoryId, gameType, docsByKey, idea, onDataChanged, focusSceneId }) {
  const [routes, setRoutes] = useState([]);
  const [routeKey, setRouteKey] = useState("");
  const [scenes, setScenes] = useState([]);
  const [loadingScenes, setLoadingScenes] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [scene, setScene] = useState(null);
  const [loadingScene, setLoadingScene] = useState(false);
  const [saving, setSaving] = useState(false);
  const [goal, setGoal] = useState("");
  const [outlining, setOutlining] = useState(false);
  const [outline, setOutline] = useState([]);
  const [writing, setWriting] = useState(false);
  const [revising, setRevising] = useState(false);
  const [reviseNote, setReviseNote] = useState("");
  const [reviseOpen, setReviseOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [issues, setIssues] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!currentStoryId) return;
    listGameRoutes(currentStoryId)
      .then((rs) => {
        setRoutes(rs || []);
        if (rs?.length) setRouteKey((cur) => (rs.some((r) => r.route_key === cur) ? cur : rs[0].route_key));
      })
      .catch((e) => setError("Không tải được tuyến: " + (e?.message || "lỗi")));
  }, [currentStoryId]);

  useEffect(() => {
    if (!currentStoryId || !routeKey) return;
    setActiveId(null);
    setScene(null);
    setOutline([]);
    setIssues(null);
    setLoadingScenes(true);
    listGameScenes(currentStoryId, routeKey)
      .then((rows) => {
        const list = rows || [];
        setScenes(list);
        if (list.length) {
          if (focusSceneId && list.some((s) => s.id === focusSceneId)) setActiveId(focusSceneId);
          else setActiveId(list[0].id);
        }
      })
      .catch((e) => setError("Không tải được phân cảnh: " + (e?.message || "lỗi")))
      .finally(() => setLoadingScenes(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoryId, routeKey]);

  useEffect(() => {
    if (!activeId) {
      setScene(null);
      return;
    }
    setLoadingScene(true);
    getGameScene(activeId)
      .then(setScene)
      .catch((e) => setError("Không mở được phân cảnh: " + (e?.message || "lỗi")))
      .finally(() => setLoadingScene(false));
  }, [activeId]);

  const reloadScenes = async () => {
    if (!currentStoryId || !routeKey) return;
    const rows = (await listGameScenes(currentStoryId, routeKey)) || [];
    setScenes(rows);
    return rows;
  };

  const handleOutline = async () => {
    setError("");
    setOutline([]);
    setOutlining(true);
    try {
      const docsText = buildGameScriptBlock(docsByKey);
      const route = routes.find((r) => r.route_key === routeKey);
      const prev = scenes.length ? await getGameScene(scenes[scenes.length - 1].id) : null;
      const prompt = buildSceneOutlinePrompt({ gameType, docsText, route, sceneGoal: goal, prevScene: prev, count: 5 });
      const res = await aiCall(prompt, { jsonSchema: GAME_SCENE_OUTLINE_SCHEMA });
      setOutline(res?.scenes || []);
    } catch (e) {
      setError("Lên dàn phân cảnh lỗi: " + (e?.message || "lỗi"));
    } finally {
      setOutlining(false);
    }
  };

  const acceptOutlineAll = async () => {
    let order = scenes.length + 1;
    for (const o of outline) {
      try {
        const row = await createGameScene({
          story_id: currentStoryId,
          route_key: routeKey,
          scene_order: order,
          title: o.title || "Phân cảnh",
          scene_type: o.scene_type || "đối thoại",
          location: o.location || "",
          characters: o.characters || "",
          foreshadow: o.foreshadow || "",
          choices: o.choice_hint || "",
          content: "",
          status: "dàn",
        });
        order++;
        setScenes((s) => [...s, row]);
      } catch (e) {
        setError("Không tạo được phân cảnh: " + (e?.message || "lỗi"));
        return;
      }
    }
    setOutline([]);
    setGoal("");
    setStatus(`Đã tạo ${outline.length} phân cảnh dàn — chọn từng cảnh rồi bấm "Viết kịch bản bằng AI".`);
    setTimeout(() => setStatus(""), 4000);
  };

  const handleCreate = async () => {
    const order = scenes.length + 1;
    try {
      const row = await createGameScene({
        story_id: currentStoryId,
        route_key: routeKey,
        scene_order: order,
        title: `Phân cảnh ${order}`,
        scene_type: "đối thoại",
        content: "",
        status: "nháp",
      });
      setScenes((s) => [...s, row]);
      setActiveId(row.id);
      setAdding(false);
    } catch (e) {
      setError("Không tạo được phân cảnh: " + (e?.message || "lỗi"));
    }
  };

  const handleSave = async () => {
    if (!scene) return;
    setSaving(true);
    setError("");
    try {
      const row = await updateGameScene(scene.id, scene);
      setScene(row);
      setScenes((s) => s.map((x) => (x.id === row.id ? { ...x, title: row.title, scene_type: row.scene_type, status: row.status } : x)));
      onDataChanged?.();
      setStatus("Đã lưu phân cảnh.");
      setTimeout(() => setStatus(""), 2000);
    } catch (e) {
      setError("Lưu phân cảnh lỗi: " + (e?.message || "lỗi"));
    } finally {
      setSaving(false);
    }
  };

  const handleWrite = async () => {
    if (!scene) return;
    setError("");
    setReviseOpen(false);
    setWriting(true);
    try {
      const docsText = buildGameScriptBlock(docsByKey);
      const route = routes.find((r) => r.route_key === routeKey);
      const idx = scenes.findIndex((s) => s.id === scene.id);
      const prev = idx > 0 ? await getGameScene(scenes[idx - 1].id) : null;
      const prompt = buildSceneWritePrompt({
        gameType,
        docsText,
        route,
        outline: {
          title: scene.title,
          scene_type: scene.scene_type,
          goal: "",
          location: scene.location,
          characters: scene.characters,
          foreshadow: scene.foreshadow,
          choice_hint: scene.choices,
        },
        prevScene: prev,
      });
      const res = await aiCall(prompt);
      const updated = { ...scene, content: String(res || "").trim(), status: "đã viết" };
      const row = await updateGameScene(scene.id, { content: updated.content, status: updated.status });
      setScene(row);
      setScenes((s) => s.map((x) => (x.id === row.id ? { ...x, status: row.status } : x)));
      onDataChanged?.();
      setStatus("Đã viết kịch bản phân cảnh.");
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      setError("Viết kịch bản lỗi: " + (e?.message || "lỗi"));
    } finally {
      setWriting(false);
    }
  };

  const handleRevise = async () => {
    if (!scene || !reviseNote.trim()) return;
    setError("");
    setRevising(true);
    try {
      const docsText = buildGameScriptBlock(docsByKey);
      const route = routes.find((r) => r.route_key === routeKey);
      const prompt = buildSceneRevisionPrompt({
        gameType,
        docsText,
        route,
        outline: { title: scene.title, scene_type: scene.scene_type },
        currentContent: scene.content,
        feedback: reviseNote,
      });
      const res = await aiCall(prompt);
      const updated = { ...scene, content: String(res || "").trim(), status: "đã sửa" };
      const row = await updateGameScene(scene.id, { content: updated.content, status: updated.status });
      setScene(row);
      setScenes((s) => s.map((x) => (x.id === row.id ? { ...x, status: row.status } : x)));
      setReviseNote("");
      setReviseOpen(false);
      onDataChanged?.();
      setStatus("Đã sửa phân cảnh theo góp ý.");
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      setError("Sửa phân cảnh lỗi: " + (e?.message || "lỗi"));
    } finally {
      setRevising(false);
    }
  };

  const handleCheck = async () => {
    if (!scene || !scene.content?.trim()) return;
    setError("");
    setIssues(null);
    setChecking(true);
    try {
      const docsText = buildGameScriptBlock(docsByKey);
      const prompt = buildGameConsistencyPrompt({ gameType, docsText, sceneContent: scene.content });
      const res = await aiCall(prompt, { jsonSchema: GAME_CONSISTENCY_SCHEMA });
      setIssues(res?.issues || []);
    } catch (e) {
      setError("Kiểm tra nhất quán lỗi: " + (e?.message || "lỗi"));
    } finally {
      setChecking(false);
    }
  };

  const moveScene = async (dir) => {
    const idx = scenes.findIndex((s) => s.id === activeId);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= scenes.length) return;
    const a = scenes[idx];
    const b = scenes[j];
    try {
      await updateGameScene(a.id, { scene_order: b.scene_order });
      await updateGameScene(b.id, { scene_order: a.scene_order });
      await reloadScenes();
    } catch (e) {
      setError("Đổi thứ tự lỗi: " + (e?.message || "lỗi"));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Xoá phân cảnh này? Không thể hoàn tác.")) return;
    try {
      await deleteGameScene(id);
      setScenes((s) => s.filter((x) => x.id !== id));
      setActiveId(null);
      onDataChanged?.();
    } catch (e) {
      setError("Không xoá được phân cảnh: " + (e?.message || "lỗi"));
    }
  };

  const route = routes.find((r) => r.route_key === routeKey);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
        <Clapperboard className="w-4 h-4 text-primary shrink-0" />
        <h3 className="font-display font-semibold text-sm">Viết Kịch Bản</h3>
        <div className="ml-auto flex items-center gap-1.5">
          <select
            value={routeKey}
            onChange={(e) => setRouteKey(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          >
            {routes.length === 0 && <option value="">(chưa có tuyến — tạo ở tab Tuyến)</option>}
            {routes.map((r) => (
              <option key={r.route_key} value={r.route_key}>{r.name}</option>
            ))}
          </select>
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-primary/40 text-primary text-xs hover:bg-primary/10">
            <Plus className="w-3.5 h-3.5" /> Cảnh mới
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-destructive px-4 py-2">{error}</p>}
      {status && <p className="text-xs text-emerald-600 dark:text-emerald-400 px-4 py-2 bg-emerald-500/10">{status}</p>}

      <div className="grid lg:grid-cols-[300px_1fr] gap-0">
        {/* Danh sách phân cảnh */}
        <div className="border-r border-border p-3 space-y-1.5 max-h-[720px] overflow-y-auto">
          <div className="flex items-center gap-2">
            <ListChecks className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Phân cảnh ({scenes.length})</span>
            <button onClick={() => setAdding(true)} className="ml-auto p-1 rounded-md text-muted-foreground hover:bg-muted" title="Thêm cảnh trống">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {loadingScenes ? (
            <p className="text-xs text-muted-foreground">Đang tải...</p>
          ) : scenes.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-4">
              Chưa có phân cảnh. Nhập mục tiêu đoạn kịch bản rồi bấm "Lên dàn bằng AI", hoặc "Cảnh mới".
            </div>
          ) : (
            scenes.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`w-full flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                  activeId === s.id ? "border-primary/50 bg-primary/10" : "border-border hover:bg-muted"
                }`}
              >
                <span className="text-[10px] font-mono text-muted-foreground mt-0.5 w-5 shrink-0">{s.scene_order}</span>
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: typeColor(s.scene_type) }} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{s.title}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground truncate">{s.scene_type || "?"}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                      s.status === "đã viết" || s.status === "đã sửa"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : s.status === "dàn"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                    }`}>{s.status}</span>
                  </div>
                </div>
              </button>
            ))
          )}

          {/* Lên dàn bằng AI */}
          <div className="pt-2 border-t border-border mt-2">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              placeholder="Mục tiêu đoạn kịch bản tiếp theo (VD: hé lộ thân phận phản diện + trận đấu đầu tiên)..."
              className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs resize-none"
            />
            <button
              onClick={handleOutline}
              disabled={outlining}
              className="w-full mt-1.5 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              {outlining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {outlining ? "Đang lên dàn..." : "Lên dàn phân cảnh bằng AI"}
            </button>
          </div>

          {/* Đề xuất dàn */}
          {outline.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-primary">Dàn {outline.length} phân cảnh</span>
                <button onClick={acceptOutlineAll} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[10px] hover:opacity-90">
                  <CheckCircle2 className="w-3 h-3" /> Tạo hết
                </button>
              </div>
              {outline.map((o, i) => (
                <div key={i} className="text-[11px] rounded-md bg-card border border-border p-2">
                  <div className="font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: typeColor(o.scene_type) }} />
                    {o.title}
                  </div>
                  <div className="text-muted-foreground mt-0.5">{o.goal}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trình soạn phân cảnh */}
        <div className="p-4">
          {!scene ? (
            <div className="text-sm text-muted-foreground py-10 text-center">
              {adding ? "Đang tạo..." : "Chọn một phân cảnh bên trái để soạn kịch bản."}
            </div>
          ) : loadingScene ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang mở phân cảnh...
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  value={scene.title}
                  onChange={(e) => setScene({ ...scene, title: e.target.value })}
                  className="flex-1 min-w-[160px] rounded-md border border-input bg-transparent px-3 py-2 text-sm font-medium"
                  placeholder="Tiêu đề phân cảnh"
                />
                <input
                  type="color"
                  value={typeColor(scene.scene_type)}
                  onChange={() => {}}
                  className="h-9 w-10 rounded-md border border-input bg-transparent cursor-default"
                  title={scene.scene_type || "loại"}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-2">
                <label className="text-[11px] text-muted-foreground">
                  Loại phân cảnh
                  <input
                    value={scene.scene_type || ""}
                    onChange={(e) => setScene({ ...scene, scene_type: e.target.value })}
                    placeholder="đối thoại / chọn lựa / trận đấu / cutscene..."
                    className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs mt-1"
                  />
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Địa điểm
                  <input
                    value={scene.location || ""}
                    onChange={(e) => setScene({ ...scene, location: e.target.value })}
                    placeholder="VD: Cổng thành phương Bắc"
                    className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs mt-1"
                  />
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Nhân vật
                  <input
                    value={scene.characters || ""}
                    onChange={(e) => setScene({ ...scene, characters: e.target.value })}
                    placeholder="VD: Linh, Tố, Trưởng lão"
                    className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs mt-1"
                  />
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Phục bút
                  <input
                    value={scene.foreshadow || ""}
                    onChange={(e) => setScene({ ...scene, foreshadow: e.target.value })}
                    placeholder="VD: cài — nhẫn của mẹ Linh"
                    className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs mt-1"
                  />
                </label>
              </div>

              <label className="text-[11px] text-muted-foreground block">
                Điểm rẽ lựa chọn (nếu có — AI sẽ viết các chọn lựa + hệ quả)
                <textarea
                  value={scene.choices || ""}
                  onChange={(e) => setScene({ ...scene, choices: e.target.value })}
                  rows={2}
                  placeholder="VD: A) Tin lời phản diện (+cờ 'nghi ngờ') B) Chống lại (−affection Trưởng lão)..."
                  className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs mt-1 resize-none"
                />
              </label>

              <textarea
                value={scene.content}
                onChange={(e) => setScene({ ...scene, content: e.target.value })}
                rows={16}
                placeholder={`Kịch bản phân cảnh (đúng định dạng kịch bản game):\n\n[SCENE: Cổng thành - đêm]\nLinh: (nhìn lên tường thành) Trời sắp đổ mưa...\nTố: (lo lắng) Nghe nói quân địch đã cắt đường tiếp tế.\n\nChỉ dẫn audio/transition khi cần.`}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2.5 text-sm leading-6 resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
              />

              {/* Thanh hành động */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Lưu
                </button>
                <button
                  onClick={handleWrite}
                  disabled={writing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-primary/40 text-primary text-xs hover:bg-primary/10 disabled:opacity-50"
                  title="AI viết kịch bản cho phân cảnh này theo dàn + bộ tài liệu"
                >
                  {writing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  {writing ? "Đang viết..." : "Viết kịch bản bằng AI"}
                </button>
                <button
                  onClick={() => setReviseOpen((o) => !o)}
                  disabled={!scene.content?.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-primary/40 text-primary text-xs hover:bg-primary/10 disabled:opacity-50"
                >
                  <ChevronRight className="w-3.5 h-3.5" /> Sửa theo góp ý
                </button>
                <button
                  onClick={handleCheck}
                  disabled={checking || !scene.content?.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-primary/40 text-primary text-xs hover:bg-primary/10 disabled:opacity-50"
                  title="Rà mâu thuẫn với bộ tài liệu kịch bản"
                >
                  {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  Kiểm tra nhất quán
                </button>
                <div className="ml-auto flex items-center gap-1">
                  <button onClick={() => moveScene(-1)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted" title="Lên trước">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => moveScene(1)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted" title="Xuống sau">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(scene.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Xoá phân cảnh">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Sửa theo góp ý */}
              {reviseOpen && (
                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                  <div className="text-[11px] font-semibold text-muted-foreground">Góp ý sửa phân cảnh</div>
                  <textarea
                    value={reviseNote}
                    onChange={(e) => setReviseNote(e.target.value)}
                    rows={2}
                    placeholder="VD: đoạn thoại Trưởng lão quá lạnh, nhấn cảm xúc của Linh khi biết sự thật, giảm 30% dài dòng..."
                    className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs resize-none"
                  />
                  <button
                    onClick={handleRevise}
                    disabled={revising || !reviseNote.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {revising ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    {revising ? "Đang sửa..." : "Gửi sửa"}
                  </button>
                </div>
              )}

              {/* Kết quả kiểm tra nhất quán */}
              {issues !== null && (
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold">Kiểm tra nhất quán</span>
                  </div>
                  {issues.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                      <CheckCircle2 className="w-4 h-4" /> Không phát hiện mâu thuẫn với bộ tài liệu.
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {issues.map((iss, i) => (
                        <div key={i} className="rounded-md px-3 py-2 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-semibold">{iss.severity === "nghiêm trọng" ? "Nghiêm trọng" : "Cảnh báo"}</span>
                              {iss.where ? <span className="opacity-70"> · {iss.where}</span> : null}
                              <div className="opacity-80 mt-0.5">{iss.problem}</div>
                              {iss.suggestion ? <div className="opacity-80 mt-0.5">→ {iss.suggestion}</div> : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}