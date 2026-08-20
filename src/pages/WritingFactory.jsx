import React, { useEffect, useMemo, useState } from "react";
import { Factory, Loader2, PenLine, RefreshCw, Bot, Users } from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import { useStory } from "@/lib/StoryContext";
import {
  listWriterDocs,
  upsertWriterDoc,
  listCharacters,
  listRelationships,
  listLocations,
  listEvents,
  listGlossary,
  listChapters,
} from "@/lib/worldcrud";
import { buildDirectionBlock } from "@/lib/directionUtils";
import { buildExistingStoryData } from "@/lib/writingFactory/bibleBuilder";
import {
  buildFactoryBootstrapPrompt,
  buildDocGenPrompt,
  FACTORY_BOOTSTRAP_SCHEMA,
  DOC_DEFS,
  DOC_DEFS_BY_KEY,
} from "@/lib/writingFactory/prompts";
import DocTree from "@/components/writing-factory/DocTree";
import DocEditor from "@/components/writing-factory/DocEditor";
import ChapterWriter from "@/components/writing-factory/ChapterWriter";
import RollupPanel from "@/components/writing-factory/RollupPanel";
import TeamChat from "@/components/writing-factory/TeamChat";
import CharacterStateDashboard from "@/components/writing-factory/CharacterStateDashboard";

const TABS = [
  { key: "docs", label: "Bộ Tài Liệu", icon: Factory },
  { key: "state", label: "Trạng Thái NV", icon: Users },
  { key: "write", label: "Viết Chương", icon: PenLine },
  { key: "rollup", label: "Cập Nhật Bible", icon: RefreshCw },
  { key: "team", label: "Team AI", icon: Bot },
];

// Xưởng Viết Truyện — workspace mô hình "xưởng" kiểu tác giả web-novel Trung Quốc:
// 1 bộ tài liệu bible sống + viết chương bám bible + rollup tự cập nhật + team AI theo vai.
export default function WritingFactory() {
  const { currentStory, currentStoryId, ready } = useStory();
  const [activeTab, setActiveTab] = useState("docs");
  const [activeKey, setActiveKey] = useState(DOC_DEFS[0].key);
  const [docs, setDocs] = useState([]);
  const [docsByKey, setDocsByKey] = useState({});
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [bootstrapOpen, setBootstrapOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [bootstrapping, setBootstrapping] = useState(false);
  const [docBusyKey, setDocBusyKey] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const loadDocs = async () => {
    if (!currentStoryId) return;
    setLoadingDocs(true);
    try {
      const list = (await listWriterDocs(currentStoryId)) || [];
      setDocs(list);
      setDocsByKey(Object.fromEntries(list.map((d) => [d.doc_key, d])));
    } catch (e) {
      setError("Không tải được bộ tài liệu: " + (e?.message || "lỗi"));
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

  // Nạp dữ liệu hiện có trong sổ tay thế giới để AI khởi tạo bible không mâu thuẫn.
  const loadExistingData = async () => {
    const [characters, relationships, locations, events, glossary, chapters] = await Promise.all([
      listCharacters(currentStoryId),
      listRelationships(currentStoryId),
      listLocations(currentStoryId),
      listEvents(currentStoryId),
      listGlossary(currentStoryId),
      listChapters(currentStoryId),
    ]);
    return buildExistingStoryData({ characters, relationships, locations, events, glossary, chapters });
  };

  const handleBootstrap = async () => {
    setError("");
    if (!idea.trim()) {
      // Nếu không có ý tưởng, vẫn cho phép dựa trên dữ liệu Sổ Tay Thế Giới hiện có.
      setStatus("Không có ý tưởng — Xưởng sẽ khởi tạo từ dữ liệu sổ tay thế giới hiện có.");
      setTimeout(() => setStatus(""), 3000);
    }
    setBootstrapping(true);
    try {
      const existingBible = await loadExistingData();
      const prompt = buildFactoryBootstrapPrompt({
        idea,
        genre: currentStory?.genre || "",
        directionBlock,
        existingBible,
      });
      const res = await aiCall(prompt, { jsonSchema: FACTORY_BOOTSTRAP_SCHEMA });
      const docsPayload = res?.docs || {};
      const keys = Object.keys(docsPayload);
      for (const key of keys) {
        const content = String(docsPayload[key] || "").trim();
        if (content) {
          await upsertWriterDoc(currentStoryId, key, {
            title: DOC_DEFS_BY_KEY[key]?.title || key,
            content,
          });
        }
      }
      await loadDocs();
      setBootstrapOpen(false);
      setStatus(`Xưởng đã khởi tạo xong ${keys.length} tài liệu.`);
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
      await upsertWriterDoc(currentStoryId, activeKey, { title: currentDoc.title, content });
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
      const existingBible = await loadExistingData();
      const prompt = buildDocGenPrompt({
        key: activeKey,
        genre: currentStory?.genre || "",
        idea,
        existingBible,
        currentDoc: currentContent,
        note,
      });
      const res = await aiCall(prompt);
      await upsertWriterDoc(currentStoryId, activeKey, {
        title: currentDoc.title,
        content: String(res).trim(),
      });
      await loadDocs();
      setStatus(`Đã cập nhật tài liệu "${DOC_DEFS_BY_KEY[activeKey]?.title}" bằng AI.`);
    } catch (e) {
      setError("AI soạn tài liệu lỗi: " + (e?.message || "lỗi"));
    } finally {
      setDocBusyKey(null);
    }
  };

  if (!ready) {
    return (
      <div className="p-10 max-w-[1400px] mx-auto">
        <div className="text-center text-muted-foreground py-20 text-sm">Đang tải bộ truyện...</div>
      </div>
    );
  }

  const hasContent = docs.some((d) => d.content?.trim());

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <header className="mb-5">
        <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <Factory className="w-6 h-6 text-primary" /> Xưởng Viết Truyện
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Mô hình xưởng kiểu tác giả web-novel: bộ tài liệu bible sống là "trí nhớ dài hạn" của AI —
          viết chương bám bible, rồi tự cập nhật bible sau mỗi chương để không bao giờ lệch.
        </p>
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
          <Loader2 className="w-4 h-4 animate-spin" /> Đang tải bộ tài liệu...
        </div>
      )}

      {!loadingDocs && activeTab === "docs" && (
        <div className="grid lg:grid-cols-[260px_1fr] gap-4">
          <DocTree
            docsByKey={docsByKey}
            activeKey={activeKey}
            onSelect={setActiveKey}
            onBootstrap={() => setBootstrapOpen(true)}
            bootstrapping={bootstrapping}
            hasContent={hasContent}
          />
          <div className="min-h-[560px]">
            <DocEditor
              doc={currentDoc}
              currentStoryId={currentStoryId}
              onSave={handleSaveDoc}
              saving={savingKey === activeKey}
              onAIGenerate={handleAIGenerateDoc}
              busy={docBusyKey === activeKey}
            />
          </div>
        </div>
      )}

      {!loadingDocs && activeTab === "state" && (
        <CharacterStateDashboard
          currentStoryId={currentStoryId}
          stateDoc={docsByKey?.trang_thai_nhan_vat}
          characterDoc={docsByKey?.nhan_vat}
          genre={currentStory?.genre || ""}
          onDocsUpdated={loadDocs}
        />
      )}

      {!loadingDocs && activeTab === "write" && (
        <ChapterWriter
          currentStoryId={currentStoryId}
          genre={currentStory?.genre || ""}
          docsByKey={docsByKey}
          onChapterWritten={() => setStatus("Đã lưu chương — đang tự động rollup nếu bật.")}
          onDocsUpdated={loadDocs}
        />
      )}

      {!loadingDocs && activeTab === "rollup" && (
        <RollupPanel
          currentStoryId={currentStoryId}
          genre={currentStory?.genre || ""}
          docsByKey={docsByKey}
          onDocsUpdated={loadDocs}
        />
      )}

      {!loadingDocs && activeTab === "team" && (
        <TeamChat currentStoryId={currentStoryId} genre={currentStory?.genre || ""} docsByKey={docsByKey} />
      )}

      {/* Modal khởi tạo xưởng */}
      {bootstrapOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBootstrapOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl p-5">
            <h3 className="font-display font-semibold text-lg">Khởi tạo Xưởng Viết Truyện</h3>
            <p className="text-xs text-muted-foreground mt-1">
              AI sẽ dựng đủ 8 tài liệu (quy tắc viết, thế giới, nhân vật, quan hệ, đại cương, phục bút,
              timeline, tóm tắt hiện tại) từ ý tưởng + dữ liệu sổ tay thế giới hiện có của bộ truyện{" "}
              <b>{currentStory?.name}</b>. Nếu bỏ trống ý tưởng, Xưởng vẫn khởi tạo từ dữ liệu hiện có.
            </p>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={6}
              placeholder="Dán ý tưởng / bối cảnh (tuỳ chọn, VD: 'Tra nữ bị nam chính xuyên không trả thù...'). Bỏ trống nếu muốn Xưởng dựa vào dữ liệu Sổ Tay Thế Giới hiện có..."
              className="w-full mt-3 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="flex items-center justify-end gap-2 mt-3">
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
                {bootstrapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Factory className="w-4 h-4" />}
                {bootstrapping ? "Đang dựng bộ tài liệu..." : "Khởi tạo Xưởng"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}