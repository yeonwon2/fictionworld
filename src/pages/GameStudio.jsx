import React, { useEffect, useRef, useState } from "react";
import { Swords, Gamepad2, Wrench, Share2, Plus, ArrowLeft, Trash2, Loader2, Palette, Bot, Heart, Crown, ChevronDown, Coins, NotebookText, GitBranch, Smartphone, Tablet, Monitor, FlaskConical } from "lucide-react";
import GameMetaConfig from "@/components/game-studio/GameMetaConfig";
import ScenarioGenerator from "@/components/game-studio/ScenarioGenerator";
import ScriptImporter from "@/components/game-studio/ScriptImporter";
import SystemScriptImporter from "@/components/game-studio/SystemScriptImporter";
import NpcScriptImporter from "@/components/game-studio/NpcScriptImporter";
import PalaceScriptImporter from "@/components/game-studio/PalaceScriptImporter";
import RebirthScriptImporter from "@/components/game-studio/RebirthScriptImporter";
import NodeTreeEditor from "@/components/game-studio/NodeTreeEditor";
import MindMapTab from "@/components/game-studio/MindMapTab";
import GameTestReportTab from "@/components/game-studio/GameTestReportTab";
import GamePlayer from "@/components/game-studio/player/GamePlayer";
import ExportCenter from "@/components/game-studio/player/ExportCenter";
import ThemeWorkshop from "@/components/game-studio/ThemeWorkshop";
import PromptHandbook from "@/components/game-studio/PromptHandbook";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { newEmptyGame } from "@/lib/gameStudio/rpgThemes";
import { listGames, getGame, createGame, updateGame, deleteGame } from "@/lib/worldcrud";
import { useToast } from "@/components/ui/use-toast";

// "Xưởng Thiết Kế" / "Xưởng Hệ Thống" / "Xưởng NPC" / "Xưởng Cung Đấu" /
// "Xưởng Trọng Sinh Làm Giàu" là các xưởng RIÊNG BIỆT, độc lập hoàn toàn với
// nhau (khác component, khác parser, khác file) — chỉ dùng chung khung sườn
// game (lưu/chơi/xuất bản) vì đó là hạ tầng chung của mọi game, không phải
// "cách viết nội dung" mà các xưởng khác nhau ở đó. Vì có nhiều xưởng, chúng
// được GOM VÀO 1 NÚT THẢ (dropdown "Xưởng") trên thanh điều hướng — tránh bấm
// nhầm — thay vì xếp thẳng hàng từng xưởng.
const MAIN_TABS = [
  { id: "play", label: "Trải Nghiệm Game", short: "Chơi", icon: Gamepad2 },
  { id: "mindmap", label: "Sơ Đồ Tư Duy", short: "Sơ đồ", icon: GitBranch },
  { id: "gametest", label: "Kiểm Tra Toàn Diện", short: "Test", icon: FlaskConical },
  { id: "export", label: "Xuất Bản & Embed", short: "Xuất", icon: Share2 },
];
const WORKSHOP_TABS = [
  { id: "studio", label: "Xưởng Thiết Kế", short: "Xưởng", icon: Wrench },
  { id: "system", label: "Xưởng Hệ Thống", short: "Hệ Thống", icon: Bot },
  { id: "npc", label: "Xưởng NPC", short: "NPC", icon: Heart },
  { id: "palace", label: "Xưởng Cung Đấu", short: "Cung Đấu", icon: Crown },
  { id: "rebirth", label: "Xưởng Trọng Sinh Làm Giàu", short: "Trọng Sinh", icon: Coins },
];
const ALL_TABS = [...MAIN_TABS, ...WORKSHOP_TABS];

function GameLibrary({ onOpen, onOpenThemeWorkshop, onOpenPromptHandbook }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  function load() {
    setLoading(true);
    listGames().then(setGames).catch((e) => {
      toast({ variant: "destructive", title: "Không tải được danh sách game", description: e.message });
    }).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const empty = newEmptyGame();
      const row = await createGame({ title: empty.meta.title, meta: empty.meta, nodes: empty.nodes });
      onOpen(row.id);
    } catch (e) {
      toast({ variant: "destructive", title: "Không tạo được game", description: e.message });
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!window.confirm("Xoá game này? Không thể hoàn tác.")) return;
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
            <Swords className="w-6 h-6 text-primary" /> Xưởng Game
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Xưởng sản xuất game nhập vai AI — cho LilyHub.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onOpenPromptHandbook}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-sm font-medium hover:bg-accent transition"
          >
            <NotebookText className="w-4 h-4" /> Sổ Tay AI
          </button>
          <button
            onClick={onOpenThemeWorkshop}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-sm font-medium hover:bg-accent transition"
          >
            <Palette className="w-4 h-4" /> Xưởng Theme
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Game mới
          </button>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      ) : games.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
          Chưa có game nào. Bấm "Game mới" để bắt đầu.
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
                title="Xoá game"
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

function GameEditor({ gameId, onBack }) {
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playKey, setPlayKey] = useState(0);
  const [tab, setTab] = useState("play");
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [previewDevice, setPreviewDevice] = useState("desktop");
  const saveTimer = useRef(null);
  const saveQueue = useRef(Promise.resolve());
  const pendingSave = useRef(null);
  const { toast } = useToast();
  const activeWorkshopTab = WORKSHOP_TABS.find((t) => t.id === tab);
  const isWorkshopActive = !!activeWorkshopTab;
  const activeWorkshopLabel = activeWorkshopTab ? activeWorkshopTab.short : "";

  useEffect(() => {
    setLoading(true);
    getGame(gameId).then((row) => {
      setGameData({ meta: row.meta, nodes: row.nodes });
    }).catch((e) => {
      toast({ variant: "destructive", title: "Không mở được game", description: e.message });
      onBack();
    }).finally(() => setLoading(false));
    return () => {
      clearTimeout(saveTimer.current);
      if (pendingSave.current) {
        const data = pendingSave.current;
        pendingSave.current = null;
        persist(data);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  async function persist(data, rethrow = false) {
    setSaving(true);
    try {
      // Serialize writes so an older autosave cannot overwrite a rebuilt game.
      const pending = saveQueue.current.catch(() => {}).then(() => updateGame(gameId, { title: data.meta?.title || "Tựa Game Mới", meta: data.meta, nodes: data.nodes }));
      saveQueue.current = pending;
      await pending;
      setLastSavedAt(new Date());
    } catch (e) {
      toast({ variant: "destructive", title: "Không lưu được game", description: e.message });
      if (rethrow) throw e;
    } finally {
      setSaving(false);
    }
  }

  // Tự lưu sau khi ngừng chỉnh sửa 1.2s — tránh ghi Supabase liên tục theo từng phím gõ.
  function handleChange(data) {
    setGameData(data);
    clearTimeout(saveTimer.current);
    pendingSave.current = data;
    saveTimer.current = setTimeout(() => { pendingSave.current = null; persist(data); }, 1200);
  }

  function handleGenerated(data) {
    pendingSave.current = null;
    setGameData(data);
    clearTimeout(saveTimer.current);
    persist(data);
    setPlayKey((k) => k + 1);
    setTab("mindmap");
  }

  async function handleMindMapGenerated(data) {
    pendingSave.current = null;
    clearTimeout(saveTimer.current);
    await persist(data, true);
    setGameData(data);
    setPlayKey((k) => k + 1);
    setTab("play");
    toast({ title: "Đã tạo lại game từ sơ đồ", description: "Đã lưu các cảnh và lựa chọn. Bắt đầu lượt chơi mới." });
  }

  if (loading || !gameData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <header className="sticky top-0 z-40 glass-panel border-b">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground shrink-0" title="Quay lại thư viện">
            <ArrowLeft size={18} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
            <Swords size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base leading-tight text-glow-cyan truncate">{gameData.meta.title || "Tựa Game Mới"}</h1>
            <p className="text-[11px] text-muted-foreground leading-tight truncate flex items-center gap-1">
              {saving ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Đang lưu game...</>
              ) : lastSavedAt ? (
                <>✓ Đã lưu game lúc {lastSavedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</>
              ) : (
                "Xưởng sản xuất Game Nhập vai No-code"
              )}
            </p>
          </div>
          <nav className="hidden lg:flex items-center gap-1.5 ml-auto glass-panel rounded-xl p-1">
            {MAIN_TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "bg-gradient-to-r from-cyan-500/90 to-violet-600/90 text-white shadow-md shadow-cyan-500/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  <Icon size={15} /> {t.label}
                </button>
              );
            })}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isWorkshopActive
                      ? "bg-gradient-to-r from-cyan-500/90 to-violet-600/90 text-white shadow-md shadow-cyan-500/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  <Wrench size={15} /> {activeWorkshopLabel || "Xưởng"} <ChevronDown size={13} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {WORKSHOP_TABS.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.id;
                  return (
                    <DropdownMenuItem key={t.id} onClick={() => setTab(t.id)} className={active ? "text-cyan-500 font-semibold" : ""}>
                      <Icon size={15} /> {t.label}
                      {active && <span className="ml-auto text-[10px]">●</span>}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-3 sm:px-4 py-4">
        {isWorkshopActive && gameData.meta.sourceScriptOutdated && <p className="max-w-2xl mx-auto mb-4 rounded-xl border border-amber-400 bg-amber-500/10 p-3 text-sm">Sơ đồ đã có chỉnh sửa mới hơn kịch bản gốc. Sản xuất lại từ văn bản sẽ thay thế các sửa đổi đó. Để giữ bản đã sửa, dùng “Tạo lại game từ sơ đồ” trong tab Sơ Đồ Tư Duy.</p>}
        {tab === "play" && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-1.5">
              {[
                { id: "phone", label: "Điện thoại", icon: Smartphone },
                { id: "tablet", label: "Tablet", icon: Tablet },
                { id: "desktop", label: "Desktop", icon: Monitor },
              ].map((device) => {
                const Icon = device.icon;
                return <button key={device.id} onClick={() => setPreviewDevice(device.id)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition ${previewDevice === device.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}><Icon size={13} /> {device.label}</button>;
              })}
            </div>
            <div className="mx-auto transition-[max-width] duration-300" style={{ maxWidth: previewDevice === "phone" ? 430 : previewDevice === "tablet" ? 760 : 900, containerType: "inline-size", containerName: "game-preview" }}>
              <div className={previewDevice !== "desktop" ? "rounded-[28px] border-[6px] border-slate-900 bg-slate-900 overflow-hidden shadow-2xl" : ""}>
                <GamePlayer key={playKey} gameData={gameData} gameKey={gameData.meta.mindMapRevision ? `${gameId}:map:${gameData.meta.mindMapRevision}` : gameId} onExit={onBack} />
              </div>
            </div>
          </div>
        )}
        {tab === "mindmap" && (
          <div className="space-y-4">
            <MindMapTab gameData={gameData} setGameData={handleChange} onGenerated={handleMindMapGenerated} />
          </div>
        )}
        {tab === "gametest" && (
          <div className="max-w-4xl mx-auto space-y-4">
            <GameTestReportTab gameData={gameData} setGameData={handleChange} />
          </div>
        )}
        {tab === "studio" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <GameMetaConfig gameData={gameData} setGameData={handleChange} />
            <ScenarioGenerator gameData={gameData} setGameData={handleChange} onGenerated={handleGenerated} />
            <ScriptImporter gameData={gameData} setGameData={handleChange} onGenerated={handleGenerated} />
            <NodeTreeEditor gameData={gameData} setGameData={handleChange} />
          </div>
        )}
        {tab === "system" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <GameMetaConfig gameData={gameData} setGameData={handleChange} />
            <SystemScriptImporter gameData={gameData} setGameData={handleChange} onGenerated={handleGenerated} />
            <NodeTreeEditor gameData={gameData} setGameData={handleChange} />
          </div>
        )}
        {tab === "npc" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <GameMetaConfig gameData={gameData} setGameData={handleChange} />
            <NpcScriptImporter gameData={gameData} setGameData={handleChange} onGenerated={handleGenerated} />
            <NodeTreeEditor gameData={gameData} setGameData={handleChange} />
          </div>
        )}
        {tab === "palace" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <GameMetaConfig gameData={gameData} setGameData={handleChange} />
            <PalaceScriptImporter gameData={gameData} setGameData={handleChange} onGenerated={handleGenerated} />
            <NodeTreeEditor gameData={gameData} setGameData={handleChange} />
          </div>
        )}
        {tab === "rebirth" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <GameMetaConfig gameData={gameData} setGameData={handleChange} />
            <RebirthScriptImporter gameData={gameData} setGameData={handleChange} onGenerated={handleGenerated} />
            <NodeTreeEditor gameData={gameData} setGameData={handleChange} />
          </div>
        )}
        {tab === "export" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <ExportCenter gameData={gameData} setGameData={handleChange} />
            <section className="glass-card rounded-2xl p-5 space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-glow-purple">
                <Share2 size={15} /> Nhúng vào LilyHub
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tải file HTML độc lập rồi upload lên host (vd: <code className="px-1 py-0.5 rounded bg-muted text-cyan-300">lilyhub.top</code>), hoặc sao chép mã Iframe dán trực tiếp vào bất kỳ trang web / blog nào. File chạy 100% offline, không cần server.
              </p>
            </section>
          </div>
        )}
      </main>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur-xl" style={{ background: "hsl(var(--background) / 0.72)", borderColor: "hsl(var(--border) / 0.6)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex">
          {MAIN_TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex-1 flex flex-col items-center gap-0.5 py-1.5 transition-colors ${
                  active ? "" : "text-muted-foreground"
                }`}
                style={active ? { color: "hsl(var(--primary))" } : undefined}
              >
                <Icon size={17} />
                <span className="text-[9.5px] font-medium">{t.short}</span>
                {active && <span className="absolute bottom-0 h-0.5 w-6 rounded-full" style={{ background: "hsl(var(--primary))" }} />}
              </button>
            );
          })}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`relative flex-1 flex flex-col items-center gap-0.5 py-1.5 transition-colors ${
                  isWorkshopActive ? "" : "text-muted-foreground"
                }`}
                style={isWorkshopActive ? { color: "hsl(var(--primary))" } : undefined}
              >
                <Wrench size={17} />
                <span className="text-[9.5px] font-medium">{activeWorkshopLabel || "Xưởng"}</span>
                {isWorkshopActive && <span className="absolute bottom-0 h-0.5 w-6 rounded-full" style={{ background: "hsl(var(--primary))" }} />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-52">
              {WORKSHOP_TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <DropdownMenuItem key={t.id} onClick={() => setTab(t.id)} className={active ? "text-cyan-500 font-semibold" : ""}>
                    <Icon size={15} /> {t.label}
                    {active && <span className="ml-auto text-[10px]">●</span>}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </div>
  );
}

export default function GameStudio() {
  const [activeGameId, setActiveGameId] = useState(null);
  const [view, setView] = useState("library"); // "library" | "theme-workshop" | "prompt-handbook"

  if (activeGameId) {
    return <GameEditor gameId={activeGameId} onBack={() => setActiveGameId(null)} />;
  }
  if (view === "theme-workshop") {
    return <ThemeWorkshop onBack={() => setView("library")} />;
  }
  if (view === "prompt-handbook") {
    return <PromptHandbook onBack={() => setView("library")} />;
  }
  return <GameLibrary onOpen={setActiveGameId} onOpenThemeWorkshop={() => setView("theme-workshop")} onOpenPromptHandbook={() => setView("prompt-handbook")} />;
}
