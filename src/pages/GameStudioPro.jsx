// Xưởng Game Pro — PRO 0 (nền tảng) + PRO 1 (Game/Episode Planner).
//
// Đây là một lớp AUTHORING mới, độc lập với "Xưởng Game" cũ (src/pages/
// GameStudio.jsx) — không thay thế, không đổi hành vi, không đổi parser cũ.
// Người dùng soạn một "tài liệu Pro" tối giản (proModel.js), tài liệu này
// được biên dịch (proCompiler.js) thành đúng dữ liệu `{meta, nodes}` mà
// GamePlayer / ExportCenter hiện tại đã hiểu — nên "Chơi thử" và "Xuất bản"
// bên dưới dùng lại y nguyên hai component đó, không có runtime/engine thứ 2.
//
// Tab "Soạn" (PRO 0) vẫn chỉ hỗ trợ 1 cảnh mở đầu → 2 lựa chọn → 2 kết thúc —
// đủ để xác minh toàn bộ pipeline tạo/lưu/tải lại/sửa/biên dịch/chơi/xuất
// bản, KHÔNG đổi ở bước PRO 1 này.
//
// Tab "Kế hoạch" (PRO 1) thêm một lớp PLANNING phía trên: Ý tưởng tự nhiên →
// AI lập Game Plan + Episode Plan (proDoc.storyBlueprint, xem plannerModel.js
// /plannerAI.js/plannerValidator.js) — CHỈ là dữ liệu mô tả, chưa sinh
// scene/node graph thật, nên compileProGame() ở tab "Soạn"/"Chơi
// thử"/"Xuất bản" hoàn toàn không đọc tới nó. Mind map Pro, Scene Intent,
// Natural-Language-to-Rule, import kịch bản ngoài... vẫn CHƯA làm.
import React, { useEffect, useState } from "react";
import { Rocket, Plus, ArrowLeft, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import GamePlayer from "@/components/game-studio/player/GamePlayer";
import ExportCenter from "@/components/game-studio/player/ExportCenter";
import { newEmptyProGame } from "@/lib/gameStudioPro/proModel";
import { compileProGame } from "@/lib/gameStudioPro/proCompiler";
import { listProGames, getGame, createGame, updateGame, deleteGame } from "@/lib/worldcrud";
import PlannerIntro from "@/components/game-studio-pro/PlannerIntro";
import PlannerEditor from "@/components/game-studio-pro/PlannerEditor";
import SmartMindMap from "@/components/game-studio-pro/SmartMindMap";

function ProGameLibrary({ onOpen }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  function load() {
    setLoading(true);
    listProGames()
      .then(setGames)
      .catch((e) => {
        toast({ variant: "destructive", title: "Không tải được danh sách Game Pro", description: e.message });
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const proDoc = newEmptyProGame();
      const { meta, nodes } = compileProGame(proDoc);
      const row = await createGame({ title: proDoc.title, meta, nodes });
      onOpen(row.id);
    } catch (e) {
      toast({ variant: "destructive", title: "Không tạo được Game Pro", description: e.message });
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!window.confirm("Xoá Game Pro này? Không thể hoàn tác.")) return;
    try {
      await deleteGame(id);
      setGames((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      toast({ variant: "destructive", title: "Không xoá được", description: err.message });
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
            <Rocket className="w-6 h-6 text-primary" /> Xưởng Game Pro
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Lập kế hoạch game bằng ý tưởng tự nhiên với AI — thư viện Game Pro riêng, tách biệt với Xưởng Game cũ.
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating}>
          {creating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
          Tạo Game Pro Mới
        </Button>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      ) : games.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
          Chưa có Game Pro nào. Bấm "Tạo Game Pro Mới" để bắt đầu.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((g) => (
            <button
              key={g.id}
              onClick={() => onOpen(g.id)}
              className="text-left rounded-2xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/40 transition group relative"
            >
              <h3 className="font-display font-semibold text-base pr-6 truncate">{g.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{g.node_count || 0} phân cảnh</p>
              <p className="text-[11px] text-muted-foreground mt-2">
                Cập nhật {g.updated_at ? new Date(g.updated_at).toLocaleString("vi-VN") : ""}
              </p>
              <span
                onClick={(e) => handleDelete(e, g.id)}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition"
                title="Xoá Game Pro"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProGameEditor({ gameId, onBack }) {
  const [proDoc, setProDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [mode, setMode] = useState("plan");
  const [playKey, setPlayKey] = useState(0);
  const [focusEpisodeId, setFocusEpisodeId] = useState(null);
  // Bản xem trước riêng cho tab Xuất bản — ExportCenter cho phép "Import JSON"
  // để nạp lại 1 file đã xuất; nếu trỏ thẳng vào proDoc thì việc import đó sẽ
  // âm thầm ghi đè tài liệu Pro (nguồn thật) bằng dữ liệu đã biên dịch, làm 2
  // bên lệch nhau. Nên tách state xem trước này, KHÔNG lưu vào proDoc/DB.
  const [exportPreview, setExportPreview] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    getGame(gameId)
      .then((row) => {
        setProDoc(row.meta?.pro || newEmptyProGame());
      })
      .catch((e) => {
        toast({ variant: "destructive", title: "Không mở được Game Pro", description: e.message });
        onBack();
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  async function handleSave() {
    setSaving(true);
    try {
      const { meta, nodes } = compileProGame(proDoc);
      await updateGame(gameId, { title: proDoc.title || "Game Pro Mới", meta, nodes });
      setLastSavedAt(new Date());
      setPlayKey((k) => k + 1);
      toast({ title: "Đã lưu Game Pro" });
    } catch (e) {
      toast({ variant: "destructive", title: "Không lưu được", description: e.message });
    } finally {
      setSaving(false);
    }
  }

  function updateField(patch) {
    setProDoc((prev) => ({ ...prev, ...patch }));
  }
  function updateChoice(index, patch) {
    setProDoc((prev) => ({
      ...prev,
      choices: prev.choices.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }
  function updateEnding(index, patch) {
    setProDoc((prev) => ({
      ...prev,
      endings: prev.endings.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    }));
  }

  if (loading || !proDoc) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const compiled = compileProGame(proDoc);
  const compiledGameData = { meta: compiled.meta, nodes: compiled.nodes };

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 glass-panel border-b">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground shrink-0" title="Quay lại thư viện">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-base leading-tight truncate">{proDoc.title || "Game Pro Mới"}</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {saving
                ? "Đang lưu..."
                : lastSavedAt
                ? `Đã lưu lúc ${lastSavedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`
                : "Chưa lưu thay đổi"}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant={mode === "plan" ? "default" : "outline"} onClick={() => setMode("plan")}>Kế hoạch</Button>
            <Button size="sm" variant={mode === "mindmap" ? "default" : "outline"} onClick={() => setMode("mindmap")}>Sơ đồ</Button>
            <Button size="sm" variant={mode === "edit" ? "default" : "outline"} onClick={() => setMode("edit")}>Soạn</Button>
            <Button size="sm" variant={mode === "play" ? "default" : "outline"} onClick={() => setMode("play")}>Chơi thử</Button>
            <Button size="sm" variant={mode === "export" ? "default" : "outline"} onClick={() => setMode("export")}>Xuất bản</Button>
            {(mode === "plan" || mode === "mindmap" || mode === "edit") && (
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null} Lưu
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {mode === "plan" && (
          proDoc.storyBlueprint?.gamePlan ? (
            <PlannerEditor
              storyBlueprint={proDoc.storyBlueprint}
              onChange={(storyBlueprint) => updateField({ storyBlueprint })}
              onOpenBlueprint={(episodeId) => { setFocusEpisodeId(episodeId); setMode("mindmap"); }}
            />
          ) : (
            <PlannerIntro
              storyBlueprint={proDoc.storyBlueprint}
              onGenerated={(storyBlueprint) => updateField({ storyBlueprint })}
              onSkip={() => setMode("edit")}
            />
          )
        )}

        {mode === "mindmap" && (
          <SmartMindMap
            storyBlueprint={proDoc.storyBlueprint}
            onChange={(storyBlueprint) => updateField({ storyBlueprint })}
            initialEpisodeId={focusEpisodeId}
          />
        )}

        {mode === "edit" && (
          <div className="space-y-4">
            <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-2">
              <Label>Tên game</Label>
              <Input value={proDoc.title} onChange={(e) => updateField({ title: e.target.value })} />
            </section>

            <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-2">
              <Label>Cảnh mở đầu</Label>
              <Textarea
                rows={4}
                value={proDoc.startScene.text}
                onChange={(e) => updateField({ startScene: { text: e.target.value } })}
              />
            </section>

            {proDoc.choices.map((c, i) => (
              <section key={i} className="glass-card rounded-2xl p-4 sm:p-5 space-y-2">
                <Label>Lựa chọn {i === 0 ? "A" : "B"} (dẫn tới Kết {i === 0 ? "A" : "B"})</Label>
                <Input value={c.text} onChange={(e) => updateChoice(i, { text: e.target.value })} />
              </section>
            ))}

            {proDoc.endings.map((e, i) => (
              <section key={e.id} className="glass-card rounded-2xl p-4 sm:p-5 space-y-2">
                <Label>Kết thúc {i === 0 ? "A" : "B"} — tiêu đề</Label>
                <Input value={e.title} onChange={(ev) => updateEnding(i, { title: ev.target.value })} />
                <Label>Nội dung</Label>
                <Textarea rows={3} value={e.text} onChange={(ev) => updateEnding(i, { text: ev.target.value })} />
              </section>
            ))}
          </div>
        )}

        {mode === "play" && (
          <div className="rounded-2xl overflow-hidden border border-border" style={{ minHeight: "70vh" }}>
            <GamePlayer key={playKey} gameData={compiledGameData} gameKey={gameId} onExit={() => setMode("edit")} />
          </div>
        )}

        {mode === "export" && (
          <ExportCenter gameData={exportPreview || compiledGameData} setGameData={setExportPreview} />
        )}
      </div>
    </div>
  );
}

export default function GameStudioPro() {
  const [activeGameId, setActiveGameId] = useState(null);

  if (activeGameId) {
    return <ProGameEditor gameId={activeGameId} onBack={() => setActiveGameId(null)} />;
  }
  return <ProGameLibrary onOpen={setActiveGameId} />;
}
