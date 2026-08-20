import React, { useEffect, useMemo, useState } from "react";
import { Factory, Loader2, PenLine, RefreshCw, Bot, Users, Download, BookMarked, Archive, FileCode2, FileText, FileType2, Map, Flag } from "lucide-react";
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
  getChapter,
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
import {
  buildBibleMarkdown,
  buildStoryMarkdown,
  buildStoryTxt,
  buildStoryHtml,
  buildEpubBlob,
  buildFullJson,
  downloadMarkdown,
  downloadTxt,
  downloadHtml,
  downloadEpub,
  downloadJson,
} from "@/lib/writingFactory/exporters";
import DocTree from "@/components/writing-factory/DocTree";
import DocEditor from "@/components/writing-factory/DocEditor";
import ChapterWriter from "@/components/writing-factory/ChapterWriter";
import RollupPanel from "@/components/writing-factory/RollupPanel";
import TeamChat from "@/components/writing-factory/TeamChat";
import CharacterStateDashboard from "@/components/writing-factory/CharacterStateDashboard";
import ArcMapPanel from "@/components/writing-factory/ArcMapPanel";
import ForeshadowPanel from "@/components/writing-factory/ForeshadowPanel";

const TABS = [
  { key: "docs", label: "Bộ Tài Liệu", icon: Factory },
  { key: "state", label: "Trạng Thái NV", icon: Users },
  { key: "arc", label: "Bản Đồ Arc", icon: Map },
  { key: "fucbut", label: "Phục Bút", icon: Flag },
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
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  const handleExport = async (mode) => {
    if (!currentStoryId) return;
    setExporting(true);
    setError("");
    try {
      const base = (currentStory?.name || "truyen").replace(/[\\/:*?"<>|]/g, "_");
      const author = "";
      // listChapters chỉ trả cột nhẹ — cần lấy content từng chương.
      const lite = (await listChapters(currentStoryId)) || [];
      lite.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
      const chapters = [];
      for (const c of lite) {
        try {
          const row = await getChapter(c.id);
          chapters.push(row);
        } catch {
          chapters.push(c);
        }
      }

      if (mode === "bible") {
        const md = buildBibleMarkdown(docsByKey);
        if (!md.trim()) throw new Error("Bộ tài liệu trống.");
        downloadMarkdown(`${base}_BO_TAI_LIEU.md`, md);
      } else if (mode === "bible-json") {
        downloadJson(`${base}_BO_TAI_LIEU.json`, {
          type: "fictionworld_bible",
          story: { name: currentStory?.name },
          bible: Object.fromEntries(
            DOC_DEFS.map((d) => [d.key, { title: d.title, file: d.file, content: docsByKey?.[d.key]?.content || "" }])
          ),
          exported_at: new Date().toISOString(),
        });
      } else if (mode === "chapters-txt") {
        const txt = buildStoryTxt(chapters, currentStory?.name);
        if (!txt.trim()) throw new Error("Chưa có chương nào.");
        downloadTxt(`${base}_TRUYEN.txt`, txt);
      } else if (mode === "chapters-html") {
        const html = buildStoryHtml({ storyName: currentStory?.name, author, chapters });
        downloadHtml(`${base}_TRUYEN.html`, html);
      } else if (mode === "chapters-epub") {
        if (!chapters.length) throw new Error("Chưa có chương nào.");
        const blob = await buildEpubBlob({ storyName: currentStory?.name, author, chapters });
        downloadEpub(`${base}.epub`, blob);
      } else if (mode === "chapters-md") {
        const md = buildStoryMarkdown(chapters);
        if (!md.trim()) throw new Error("Chưa có chương nào.");
        downloadMarkdown(`${base}_TRUYEN.md`, md);
      } else if (mode === "all") {
        const md = [buildBibleMarkdown(docsByKey), buildStoryMarkdown(chapters)].filter(Boolean).join("\n\n# TRUYỆN\n\n");
        if (!md.trim()) throw new Error("Không có nội dung để tải.");
        downloadMarkdown(`${base}_TOAN_BO.md`, md);
      } else if (mode === "all-json") {
        const json = buildFullJson({
          storyName: currentStory?.name,
          author,
          docsByKey,
          chapters,
        });
        downloadJson(`${base}_TOAN_BO.json`, json);
      }
      setExportOpen(false);
      setStatus("Đã tải file về máy.");
    } catch (e) {
      setError("Xuất file lỗi: " + (e?.message || "lỗi"));
    } finally {
      setExporting(false);
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
        <div className="relative mt-3 inline-block">
          <button
            onClick={() => setExportOpen((o) => !o)}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Xuất file
          </button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setExportOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-40 w-[380px] rounded-xl border border-border bg-card shadow-xl p-2">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Bộ tài liệu (bible) — cho AI / soạn thảo</div>
                <div className="flex gap-1.5 px-2 pb-1">
                  <button
                    onClick={() => handleExport("bible")}
                    disabled={exporting}
                    className="flex-1 inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs border border-border hover:bg-muted disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5 text-primary" /> .md
                  </button>
                  <button
                    onClick={() => handleExport("bible-json")}
                    disabled={exporting}
                    className="flex-1 inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs border border-border hover:bg-muted disabled:opacity-50"
                  >
                    <FileCode2 className="w-3.5 h-3.5 text-primary" /> .json
                  </button>
                </div>

                <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Truyện — để đăng / đọc</div>
                <div className="flex gap-1.5 px-2 pb-1 flex-wrap">
                  <button
                    onClick={() => handleExport("chapters-txt")}
                    disabled={exporting}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-border hover:bg-muted disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5 text-primary" /> .txt
                  </button>
                  <button
                    onClick={() => handleExport("chapters-html")}
                    disabled={exporting}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-border hover:bg-muted disabled:opacity-50"
                  >
                    <FileType2 className="w-3.5 h-3.5 text-primary" /> .html
                  </button>
                  <button
                    onClick={() => handleExport("chapters-epub")}
                    disabled={exporting}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-border hover:bg-muted disabled:opacity-50"
                  >
                    <BookMarked className="w-3.5 h-3.5 text-primary" /> .epub
                  </button>
                  <button
                    onClick={() => handleExport("chapters-md")}
                    disabled={exporting}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-border hover:bg-muted disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5 text-primary" /> .md
                  </button>
                </div>

                <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Toàn bộ (bible + truyện)</div>
                <div className="flex gap-1.5 px-2 pb-1">
                  <button
                    onClick={() => handleExport("all")}
                    disabled={exporting}
                    className="flex-1 inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs border border-border hover:bg-muted disabled:opacity-50"
                  >
                    <Archive className="w-3.5 h-3.5 text-primary" /> .md
                  </button>
                  <button
                    onClick={() => handleExport("all-json")}
                    disabled={exporting}
                    className="flex-1 inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs border border-border hover:bg-muted disabled:opacity-50"
                  >
                    <FileCode2 className="w-3.5 h-3.5 text-primary" /> .json
                  </button>
                </div>
              </div>
            </>
          )}
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

      {!loadingDocs && activeTab === "arc" && (
        <ArcMapPanel currentStoryId={currentStoryId} genre={currentStory?.genre || ""} docsByKey={docsByKey} />
      )}

      {!loadingDocs && activeTab === "fucbut" && (
        <ForeshadowPanel currentStoryId={currentStoryId} genre={currentStory?.genre || ""} docsByKey={docsByKey} />
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
              AI sẽ dựng đủ 9 tài liệu (quy tắc viết, thế giới, nhân vật, quan hệ, đại cương, phục bút,
              timeline, trạng thái nhân vật, tóm tắt hiện tại) từ ý tưởng + dữ liệu sổ tay thế giới hiện có
              của bộ truyện <b>{currentStory?.name}</b>. Nếu bỏ trống ý tưởng, Xưởng vẫn khởi tạo từ dữ liệu hiện có.
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