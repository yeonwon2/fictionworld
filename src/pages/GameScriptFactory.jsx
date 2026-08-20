import React, { useEffect, useMemo, useState } from "react";
import {
  Clapperboard,
  Loader2,
  RefreshCw,
  Bot,
  GitBranch,
  Clock,
  PenLine,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import { useStory } from "@/lib/StoryContext";
import { buildDirectionBlock } from "@/lib/directionUtils";
import {
  getGameScriptConfig,
  upsertGameScriptConfig,
  listGameScriptDocs,
  upsertGameScriptDoc,
} from "@/lib/worldcrud";
import {
  GAME_TYPE_DEFS,
  GAME_TYPE_BY_KEY,
  GAME_SCRIPT_DOC_BY_KEY,
  buildGameBootstrapPrompt,
  GAME_BOOTSTRAP_SCHEMA,
  buildGameDocGenPrompt,
} from "@/lib/gameScriptFactory/prompts";
import GameDocTree from "@/components/game-script-factory/GameDocTree";
import GameDocEditor from "@/components/game-script-factory/GameDocEditor";
import RoutePlanner from "@/components/game-script-factory/RoutePlanner";
import SceneWriter from "@/components/game-script-factory/SceneWriter";
import RouteTimeline from "@/components/game-script-factory/RouteTimeline";
import GameScriptTeamChat from "@/components/game-script-factory/GameScriptTeamChat";

const TABS = [
  { key: "docs", label: "Bộ Tài Liệu", icon: BookOpen },
  { key: "tuyen", label: "Tuyến Kịch Bản", icon: GitBranch },
  { key: "scenes", label: "Viết Kịch Bản", icon: PenLine },
  { key: "timeline", label: "Timeline Tuyến", icon: Clock },
  { key: "team", label: "Team AI", icon: Bot },
];

// Xưởng Kịch Bản Game — mô hình "xưởng" như WritingFactory nhưng chuyên viết
// kịch bản game: 1 bộ tài liệu sống theo LOẠI GAME (nguyên tắc kịch bản riêng
// từng loại) + tuyến kịch bản (branch/route) + phân cảnh theo từng tuyến +
// timeline từng tuyến để tác giả theo dõi và sửa.
export default function GameScriptFactory() {
  const { currentStory, currentStoryId, ready } = useStory();
  const [activeTab, setActiveTab] = useState("docs");
  const [activeKey, setActiveKey] = useState("quy_tac");
  const [config, setConfig] = useState(null);
  const [docsByKey, setDocsByKey] = useState({});
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [bootstrapOpen, setBootstrapOpen] = useState(false);
  const [gameType, setGameType] = useState(GAME_TYPE_DEFS[0]?.key || "adventure");
  const [idea, setIdea] = useState("");
  const [notes, setNotes] = useState("");
  const [bootstrapping, setBootstrapping] = useState(false);
  const [docBusyKey, setDocBusyKey] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [focusSceneId, setFocusSceneId] = useState(null);

  const currentType = config?.game_type || GAME_TYPE_DEFS[0]?.key || "adventure";

  const loadDocs = async () => {
    if (!currentStoryId) return;
    setLoadingDocs(true);
    try {
      const cfg = await getGameScriptConfig(currentStoryId);
      setConfig(cfg);
      if (cfg?.game_type) setGameType(cfg.game_type);
      const list = (await listGameScriptDocs(currentStoryId)) || [];
      setDocsByKey(Object.fromEntries(list.map((d) => [d.doc_key, d])));
    } catch (e) {
      setError("Không tải được xưởng kịch bản: " + (e?.message || "lỗi"));
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (ready) loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, currentStoryId]);

  const currentDoc = useMemo(() => docsByKey[activeKey] || null, [docsByKey, activeKey]);
  const directionBlock = useMemo(() => buildDirectionBlock(currentStory?.direction), [currentStory]);

  const handleBootstrap = async () => {
    setError("");
    setBootstrapping(true);
    try {
      const prompt = buildGameBootstrapPrompt({
        gameType,
        idea,
        notes,
        directionBlock,
      });
      const res = await aiCall(prompt, { jsonSchema: GAME_BOOTSTRAP_SCHEMA });
      const docsPayload = res?.docs || {};
      const keys = Object.keys(docsPayload);
      for (const key of keys) {
        const content = String(docsPayload[key] || "").trim();
        if (content) {
          await upsertGameScriptDoc(currentStoryId, key, {
            title: GAME_SCRIPT_DOC_BY_KEY[key]?.title || key,
            content,
          });
        }
      }
      await upsertGameScriptConfig(currentStoryId, {
        game_type: gameType,
        game_name: currentStory?.name || "Game",
        setting: idea,
        notes,
      });
      await loadDocs();
      setBootstrapOpen(false);
      setStatus(`Xưởng đã dựng xong ${keys.length} tài liệu kịch bản cho loại game ${GAME_TYPE_BY_KEY[gameType]?.label}.`);
    } catch (e) {
      setError("Khởi tạo Xưởng lỗi: " + (e?.message || "lỗi"));
    } finally {
      setBootstrapping(false);
    }
  };

  const handleSaveDoc = async (content) => {
    if (!currentDoc) return;
    setSavingKey(activeKey);
    setError("");
    try {
      await upsertGameScriptDoc(currentStoryId, activeKey, { title: currentDoc.title, content });
      await loadDocs();
    } catch (e) {
      setError("Lưu tài liệu lỗi: " + (e?.message || "lỗi"));
    } finally {
      setSavingKey(null);
    }
  };

  const handleAIGenerateDoc = async (currentContent, note) => {
    if (!currentDoc) return;
    setDocBusyKey(activeKey);
    setError("");
    try {
      const prompt = buildGameDocGenPrompt({
        key: activeKey,
        gameType: currentType,
        idea,
        currentDoc: currentContent,
        note,
      });
      const res = await aiCall(prompt);
      await upsertGameScriptDoc(currentStoryId, activeKey, {
        title: currentDoc.title,
        content: String(res).trim(),
      });
      await loadDocs();
      setStatus(`Đã cập nhật tài liệu "${GAME_SCRIPT_DOC_BY_KEY[activeKey]?.title}" bằng AI.`);
    } catch (e) {
      setError("AI soạn tài liệu lỗi: " + (e?.message || "lỗi"));
    } finally {
      setDocBusyKey(null);
    }
  };

  const handleEditScene = (sceneId) => {
    setFocusSceneId(sceneId);
    setActiveTab("scenes");
  };

  if (!ready) {
    return (
      <div className="p-10 max-w-[1400px] mx-auto">
        <div className="text-center text-muted-foreground py-20 text-sm">Đang tải bộ truyện...</div>
      </div>
    );
  }

  const hasContent = Object.values(docsByKey).some((d) => d.content?.trim());
  const typeLabel = GAME_TYPE_BY_KEY[currentType]?.label || "Chưa chọn loại game";

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <header className="mb-5">
        <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <Clapperboard className="w-6 h-6 text-primary" /> Xưởng Kịch Bản Game
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Mô hình xưởng như Xưởng Viết Truyện: bộ tài liệu kịch bản sống là "trí nhớ dài hạn" của AI —
          nhưng sản phẩm ở đây là <b>KỊCH BẢN GAME</b> (slugline SCENE, thoại theo nhân vật, mô tả hành động,
          khối lựa chọn kèm cờ/chỉ số + đích nhánh, chỉ dẫn kỹ thuật SFX/MUSIC/TRANSITION) — không phải văn xuôi
          truyện. Các loại game lấy <b>đúng từ Xưởng Game</b> ({GAME_TYPE_DEFS.map((t) => t.label).join(", ")}),
          mỗi loại có nguyên tắc kịch bản riêng mà AI bắt buộc tuân thủ.
          Lên tuyến kịch bản → dàn beats → viết phân cảnh theo từng tuyến → theo dõi timeline từng tuyến và sửa trực tiếp.
        </p>
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
            {GAME_TYPE_BY_KEY[currentType]?.emoji} {typeLabel}
          </span>
          {config?.game_name && <span>· {config.game_name}</span>}
        </div>
      </header>

      {status && (
        <div className="mb-3 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">{status}</div>
      )}
      {error && (
        <div className="mb-3 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>
      )}

      {/* Điều hướng tab */}
      <div className="flex items-center gap-1 flex-wrap mb-4">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {loadingDocs && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Đang tải xưởng kịch bản...
        </div>
      )}

      {!loadingDocs && activeTab === "docs" && (
        <div className="grid lg:grid-cols-[260px_1fr] gap-4">
          <GameDocTree
            gameType={currentType}
            docsByKey={docsByKey}
            activeKey={activeKey}
            onSelect={setActiveKey}
            onBootstrap={() => setBootstrapOpen(true)}
            bootstrapping={bootstrapping}
            hasContent={hasContent}
          />
          <div className="min-h-[560px]">
            <GameDocEditor
              doc={currentDoc}
              onSave={handleSaveDoc}
              saving={savingKey === activeKey}
              onAIGenerate={handleAIGenerateDoc}
              busy={docBusyKey === activeKey}
              gameType={currentType}
            />
          </div>
        </div>
      )}

      {!loadingDocs && activeTab === "tuyen" && (
        <RoutePlanner currentStoryId={currentStoryId} gameType={currentType} docsByKey={docsByKey} idea={idea} />
      )}

      {!loadingDocs && activeTab === "scenes" && (
        <SceneWriter
          currentStoryId={currentStoryId}
          gameType={currentType}
          docsByKey={docsByKey}
          idea={idea}
          onDataChanged={loadDocs}
          focusSceneId={focusSceneId}
        />
      )}

      {!loadingDocs && activeTab === "timeline" && (
        <RouteTimeline currentStoryId={currentStoryId} onEditScene={handleEditScene} />
      )}

      {!loadingDocs && activeTab === "team" && (
        <GameScriptTeamChat currentStoryId={currentStoryId} gameType={currentType} docsByKey={docsByKey} />
      )}

      {/* Modal khởi tạo xưởng — chọn loại game + ý tưởng */}
      {bootstrapOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBootstrapOpen(false)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl p-5">
            <h3 className="font-display font-semibold text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Khởi tạo Xưởng Kịch Bản Game
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              AI sẽ dựng đủ {Object.keys(GAME_SCRIPT_DOC_BY_KEY).length} tài liệu kịch bản cho bộ truyện{" "}
              <b>{currentStory?.name}</b> theo <b>nguyên tắc kịch bản của loại game</b> bạn chọn. Có thể chỉnh sửa sau.
            </p>

            {/* Chọn loại game */}
            <div className="text-xs font-semibold text-muted-foreground mt-4 mb-2">Chọn loại game (nguyên tắc kịch bản sẽ khác nhau)</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {GAME_TYPE_DEFS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setGameType(t.key)}
                  className={`text-left rounded-xl border p-3 transition ${
                    gameType === t.key ? "border-primary/60 bg-primary/10" : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{t.emoji}</span>
                    <span className="text-sm font-semibold">{t.label}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{t.short}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{t.desc}</p>
                </button>
              ))}
            </div>

            {gameType && (
              <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
                <div className="text-[11px] font-semibold text-primary mb-1.5">
                  Nguyên tắc kịch bản {GAME_TYPE_BY_KEY[gameType].label} — AI sẽ bắt buộc tuân thủ:
                </div>
                <ul className="text-[11px] text-muted-foreground space-y-1">
                  {GAME_TYPE_BY_KEY[gameType].principles.slice(0, 4).map((p, i) => (
                    <li key={i} className="flex gap-1.5"><span className="text-primary shrink-0">•</span> {p}</li>
                  ))}
                  <li className="flex gap-1.5 text-primary/70 shrink-0"><span className="text-primary shrink-0">•</span> +{GAME_TYPE_BY_KEY[gameType].principles.length - 4} nguyên tắc nữa trong bộ tài liệu...</li>
                </ul>
              </div>
            )}

            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={4}
              placeholder="Ý tưởng / bối cảnh game (VD: 'RPG giả tưởng phương Tây, nữ chính mất ký ức, phải tìm lại danh tính qua các thành bang...'). Bỏ trống nếu muốn Xưởng dựng khung chuẩn cho loại game."
              className="w-full mt-4 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ghi chú thêm (tuỳ chọn): tông, mức độ trưởng thành, ràng buộc, điều muốn tránh..."
              className="w-full mt-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setBootstrapOpen(false)}
                className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted"
              >
                Huỷ
              </button>
              <button
                onClick={handleBootstrap}
                disabled={bootstrapping}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {bootstrapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {bootstrapping ? "Đang dựng bộ tài liệu kịch bản..." : "Khởi tạo Xưởng"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}