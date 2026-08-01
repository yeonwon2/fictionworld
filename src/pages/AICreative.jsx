import React, { useEffect, useMemo, useState } from "react";
import { aiCall } from "@/lib/aiCall";
import { buildDirectionBlock } from "@/lib/directionUtils";
import { useStory } from "@/lib/StoryContext";
import {
  listCharacters,
  listRelationships,
  listChapters,
  getChapter,
  listEvents,
  listLocations,
  listGlossary,
} from "@/lib/worldcrud";
import { Sparkles, Loader2, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ConceptTab from "@/components/ai/ConceptTab";
import ArcArchitectTab from "@/components/ai/ArcArchitectTab";
import ContinuityPanel from "@/components/ai/ContinuityPanel";
import SceneSetupPanel from "@/components/ai/SceneSetupPanel";
import AIEditor from "@/components/ai/AIEditor";
import IdeaTools from "@/components/ai/IdeaTools";
import AssistantChat from "@/components/ai/AssistantChat";

// Hệ thống Hỗ trợ Sáng tác 4 cấp độ: Ý tưởng → Dàn Ý → Nối Mạch → Viết
export default function AICreative() {
  const { currentStoryId, currentStory, ready } = useStory();
  const [activeTab, setActiveTab] = useState("idea");
  const [characters, setCharacters] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [events, setEvents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [glossary, setGlossary] = useState([]);
  const [loadingChars, setLoadingChars] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);

  // Cấp độ 2 state
  const [idea, setIdea] = useState("");
  const [sampleChars, setSampleChars] = useState([]);

  // Cấp độ 3 state (continuity)
  const [mode, setMode] = useState("pick");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [brainstorming, setBrainstorming] = useState(false);

  // Cấp độ 4 state
  const [outline, setOutline] = useState("");
  const [content, setContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [orientationNote, setOrientationNote] = useState("");
  const [error, setError] = useState("");

  // Consistency check
  const [consistency, setConsistency] = useState(null);
  const [checking, setChecking] = useState(false);

  const loadData = () => {
    if (!ready) return;
    setLoadingChars(true);
    Promise.all([
      listCharacters(currentStoryId),
      listRelationships(currentStoryId),
      listChapters(currentStoryId),
      listEvents(currentStoryId),
      listLocations(currentStoryId),
      listGlossary(currentStoryId),
    ])
      .then(([c, r, ch, ev, lo, gl]) => {
        setCharacters(c || []);
        setRelationships(r || []);
        setChapters(ch || []);
        setEvents(ev || []);
        setLocations(lo || []);
        setGlossary(gl || []);
        if ((ch || []).length > 0 && !selectedChapterId) setSelectedChapterId(ch[ch.length - 1].id);
      })
      .finally(() => setLoadingChars(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadData, [ready, currentStoryId]);

  // listChapters() chỉ trả cột nhẹ (không có content) — tải nội dung đầy đủ
  // riêng cho đúng 1 chương đang chọn làm ngữ cảnh, tránh kéo content mọi chương.
  const [selectedChapterContent, setSelectedChapterContent] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (selectedChapterId) {
      getChapter(selectedChapterId).then((full) => {
        if (!cancelled) setSelectedChapterContent(full?.content || "");
      });
    } else {
      setSelectedChapterContent("");
    }
    return () => {
      cancelled = true;
    };
  }, [selectedChapterId]);

  const charById = useMemo(() => Object.fromEntries(characters.map((c) => [c.id, c])), [characters]);
  const locById = useMemo(() => Object.fromEntries(locations.map((l) => [l.id, l])), [locations]);

  const profilesBlock = useMemo(() => {
    const chosen = characters.filter((c) => selectedIds.includes(c.id));
    if (!chosen.length) return "(Chưa chọn nhân vật.)";
    return chosen.map(buildProfile).join("\n\n");
  }, [characters, selectedIds]);

  const relationsBlock = useMemo(() => {
    const rels = relationships.filter(
      (r) => selectedIds.includes(r.source_character_id) && selectedIds.includes(r.target_character_id)
    );
    if (!rels.length) return "(Chưa ghi nhận quan hệ giữa các nhân vật được chọn.)";
    return rels
      .map((r) => {
        const a = charById[r.source_character_id]?.name || "?";
        const b = charById[r.target_character_id]?.name || "?";
        return `- ${a} ↔ ${b}: ${r.relation_type || ""}${r.description ? ` — ${r.description}` : ""}`;
      })
      .join("\n");
  }, [relationships, selectedIds, charById]);

  const glossaryBlock = useMemo(() => {
    if (!glossary.length) return "(Chưa có thuật ngữ cổ phong.)";
    return glossary.map((g) => `- [${g.category || "Khác"}] ${g.term}: ${g.definition || ""}`).join("\n");
  }, [glossary]);

  const foreshadowBlock = useMemo(() => {
    const open = events.filter((e) => e.foreshadow_note && !e.foreshadow_resolved);
    if (!open.length) return "(Không có phục bút chưa giải quyết.)";
    return open
      .map((e) => `- [mốc #${e.timeline_order ?? "?"} — ${e.title}]: ${e.foreshadow_note}`)
      .join("\n");
  }, [events]);

  const directionBlock = useMemo(() => buildDirectionBlock(currentStory?.direction), [currentStory]);

  // Văn bản chương trước (chế độ A hoặc B)
  const chapterOutline = useMemo(
    () => (mode === "pick" ? selectedChapterContent || "" : outline || ""),
    [mode, selectedChapterContent, outline]
  );
  const phase = useMemo(() => (mode === "pick" && !content.trim() ? "open" : "continue"), [mode, content]);
  const ctxText = useMemo(() => {
    if (phase === "open") return chapterOutline || "";
    return mode === "paste" ? getLastWords(pastedText, 700) : getLastWords(content, 800);
  }, [phase, chapterOutline, mode, pastedText, content]);

  const currentStateBlock = useMemo(() => {
    if (!events.length) return "(Chưa có sự kiện để suy trạng thái hiện tại.)";
    const latest = [...events].sort((a, b) => (b.timeline_order || 0) - (a.timeline_order || 0))[0];
    const locNames =
      (latest.related_location_ids || [])
        .map((id) => locById[id]?.name)
        .filter(Boolean)
        .join(", ") || "(không rõ)";
    const lines = selectedIds
      .map((cid) => {
        const c = charById[cid];
        if (!c) return null;
        const st = (latest.participant_states || {})[cid];
        return `- ${c.name}: ${st || "bình thường"} (đang ở: ${locNames})`;
      })
      .filter(Boolean);
    const base = `Sự kiện gần nhất: ${latest.title}\n${lines.join("\n") || "(các nhân vật được chọn chưa xuất hiện trong sự kiện gần nhất)"}`;
    return `${directionBlock}\n\n${base}`;
  }, [events, selectedIds, charById, locById, directionBlock]);

  const callLLM = (prompt, schema) => aiCall(prompt, { jsonSchema: schema || undefined });

  // ---------- Trợ lý chat tự do: chèn kết quả vào ô tương ứng theo tab ----------
  const handleInsertToIdea = (text) => setIdea((prev) => (prev.trim() ? `${prev}\n\n${text}` : text));
  const handleInsertToOutline = (text) => setOutline((prev) => (prev.trim() ? `${prev}\n\n${text}` : text));
  const handleInsertToContent = (text) =>
    setContent((prev) => (prev.trim() ? `${prev}\n\n---\n\n${text}` : String(text)));

  // ---------- Cấp độ 1 → 2 ----------
  const handleUseConcept = (ideaText, chars) => {
    setIdea(ideaText);
    setSampleChars(chars);
    setActiveTab("plot");
  };

  const handleArcSaved = () => {
    loadData();
    setActiveTab("write");
  };

  // ---------- Cấp độ 3: brainstorm nối tiếp ----------
  const handleBrainstorm = async () => {
    setError("");
    setBrainstorming(true);
    setSuggestions([]);
    try {
      const prompt = buildBrainstormPrompt(
        ctxText,
        currentStateBlock,
        profilesBlock,
        relationsBlock,
        phase,
        glossaryBlock,
        foreshadowBlock
      );
      const res = await callLLM(prompt, BRAINSTORM_SCHEMA);
      setSuggestions(res?.options || []);
      if (!res?.options?.length) setError("AI không trả về gợi ý nào.");
    } catch (e) {
      setError("Gợi ý lỗi: " + (e?.message || "lỗi"));
    } finally {
      setBrainstorming(false);
    }
  };

  const handleSelectSuggestion = (text) => setOutline(text);

  // ---------- Cấp độ 4: sinh phân cảnh ----------
  const handleGenerate = async () => {
    setError("");
    if (selectedIds.length === 0) {
      setError("Hãy chọn ít nhất một nhân vật xuất hiện trong cảnh.");
      return;
    }
    setGenerating(true);
    try {
      const orientedOutline = orientationNote.trim()
        ? `[Ghi chú định hướng của tác giả]: ${orientationNote.trim()}\n\n${outline}`
        : outline;
      const prompt = buildScenePrompt(
        profilesBlock,
        relationsBlock,
        orientedOutline,
        ctxText,
        currentStateBlock,
        phase,
        glossaryBlock,
        foreshadowBlock
      );
      const res = await callLLM(prompt);
      setContent((prev) => (prev.trim() ? `${prev}\n\n---\n\n${res}` : String(res)));
    } catch (e) {
      setError("Không thể sinh phân cảnh: " + (e?.message || "lỗi"));
    } finally {
      setGenerating(false);
    }
  };

  const handleAITool = async (action, selectedText, note) => {
    if (!selectedText.trim()) return null;
    setBusyAction(action);
    setError("");
    try {
      const ctxBlock = `${directionBlock}\n\n${profilesBlock}\n\n${relationsBlock}\n\n# Thuật ngữ cổ phong\n${glossaryBlock}`;
      const prompt = buildToolPrompt(action, selectedText, ctxBlock, note);
      const res = await callLLM(prompt);
      return String(res);
    } catch (e) {
      setError("Công cụ AI lỗi: " + (e?.message || "lỗi"));
      return null;
    } finally {
      setBusyAction(null);
    }
  };

  // ---------- Kiểm tra nhất quán ----------
  const handleConsistency = async () => {
    if (!content.trim()) {
      setError("Chưa có nội dung chương để kiểm tra.");
      return;
    }
    setChecking(true);
    setConsistency(null);
    setError("");
    try {
      const prompt = buildConsistencyPrompt(content, profilesBlock, relationsBlock, glossaryBlock, currentStateBlock, foreshadowBlock);
      const res = await callLLM(prompt, CONSISTENCY_SCHEMA);
      setConsistency(res?.issues || []);
    } catch (e) {
      setError("Kiểm tra lỗi: " + (e?.message || "lỗi"));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <header className="mb-5">
        <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" /> Hỗ trợ Sáng Tác AI
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          4 cấp độ: Ý tưởng → Dàn Ý → Nối Mạch → Viết phân cảnh cổ phong.
        </p>
      </header>

      {error && (
        <div className="mb-3 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-2xl mb-4">
          <TabsTrigger value="idea">1 · Ý tưởng</TabsTrigger>
          <TabsTrigger value="plot">2 · Dàn Ý</TabsTrigger>
          <TabsTrigger value="write">3 · Nối Mạch & Viết</TabsTrigger>
        </TabsList>

        <TabsContent value="idea">
          <ConceptTab onUseConcept={handleUseConcept} />
        </TabsContent>

        <TabsContent value="plot">
          <ArcArchitectTab
            idea={idea}
            setIdea={setIdea}
            sampleChars={sampleChars}
            currentStoryId={currentStoryId}
            onSaved={handleArcSaved}
            directionBlock={directionBlock}
          />
        </TabsContent>

        <TabsContent value="write">
          <ContinuityPanel
            chapters={chapters}
            selectedChapterId={selectedChapterId}
            setSelectedChapterId={setSelectedChapterId}
            mode={mode}
            setMode={setMode}
            pastedText={pastedText}
            setPastedText={setPastedText}
            onBrainstorm={handleBrainstorm}
            brainstorming={brainstorming}
            suggestions={suggestions}
            onSelectSuggestion={handleSelectSuggestion}
            phase={phase}
            chapterOutline={chapterOutline}
          />

          <div className="grid lg:grid-cols-[340px_1fr] gap-4 mt-4">
            <SceneSetupPanel
              characters={characters}
              loadingChars={loadingChars}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              outline={outline}
              setOutline={setOutline}
              onGenerate={handleGenerate}
              generating={generating}
            />
            <div>
              {generating && (
                <div className="mb-2 flex items-center gap-2 text-sm text-primary">
                  <Loader2 className="w-4 h-4 animate-spin" /> AI đang viết phân cảnh...
                </div>
              )}
              <textarea
                value={orientationNote}
                onChange={(e) => setOrientationNote(e.target.value)}
                rows={2}
                placeholder="Ghi chú định hướng trước khi viết tiếp (VD: để nhân vật nghi ngờ trước khi hành động, đừng vội vàng) — sẽ chèn vào prompt khi AI sinh/write tiếp..."
                className="w-full mb-2 rounded-md border border-input bg-transparent px-3 py-2 text-xs resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <AIEditor
                value={content}
                onChange={setContent}
                onAITool={handleAITool}
                busy={busyAction !== null}
                busyAction={busyAction}
              />
              <p className="text-[11px] text-muted-foreground mt-2">
                {phase === "open"
                  ? `Đang mở đầu chương mới theo dàn ý (${ctxText.split(/\s+/).filter(Boolean).length} từ).`
                  : `Đã nạp ${ctxText.split(/\s+/).filter(Boolean).length} từ đoạn kết để viết tiếp (chế độ ${
                      mode === "pick" ? "A" : "B"
                    }).`}{" "}
                {selectedIds.length > 0 && `Trích hồ sơ + quan hệ của ${selectedIds.length} nhân vật.`}{" "}
                {glossary.length > 0 && `· Nạp ${glossary.length} thuật ngữ cổ phong.`}
              </p>
            </div>
          </div>

          <IdeaTools
            content={content}
            characters={characters}
            selectedIds={selectedIds}
            glossaryBlock={glossaryBlock}
            onAppend={(text) => setContent((prev) => `${prev}\n\n${text}`.trim())}
          />

          {/* Kiểm tra nhất quán */}
          <div className="mt-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-display font-semibold text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" /> Kiểm Tra Nhất Quán với Story Bible
              </h3>
              <button
                onClick={handleConsistency}
                disabled={checking || !content.trim()}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Kiểm tra chương
              </button>
            </div>

            {consistency && (
              <div className="mt-3 space-y-2">
                {consistency.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-500/10 rounded-md px-3 py-2.5">
                    <CheckCircle2 className="w-4 h-4" /> Không phát hiện mâu thuẫn với Story Bible.
                  </div>
                ) : (
                  consistency.map((iss, i) => {
                    const severe = (iss.severity || "").toLowerCase().includes("nghiêm") || (iss.severity || "").toLowerCase().includes("high");
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs ${
                          severe ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold">{iss.severity || "Cảnh báo"}</span>
                          {iss.where ? <span className="opacity-70"> · {iss.where}</span> : null}:{" "}
                          {iss.problem}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AssistantChat
        currentStoryId={currentStoryId}
        activeTab={activeTab}
        directionBlock={directionBlock}
        profilesBlock={profilesBlock}
        relationsBlock={relationsBlock}
        glossaryBlock={glossaryBlock}
        foreshadowBlock={foreshadowBlock}
        idea={idea}
        outline={outline}
        content={content}
        onInsertToIdea={handleInsertToIdea}
        onInsertToOutline={handleInsertToOutline}
        onInsertToContent={handleInsertToContent}
      />
    </div>
  );
}

// ---------- helpers ----------
function getLastWords(text, n) {
  if (!text) return "";
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= n) return text;
  return words.slice(words.length - n).join(" ");
}

function buildProfile(c) {
  const p = [`【Nhân vật】${c.name}`];
  if (c.aliases) p.push(`- Biệt danh / Hán Việt: ${c.aliases}`);
  if (c.role) p.push(`- Thân phận: ${c.role}`);
  if (c.age != null && c.age !== "") p.push(`- Tuổi: ${c.age}`);
  if (c.description) p.push(`- Giới thiệu: ${c.description}`);
  if (c.appearance) p.push(`- Ngoại hình cố định: ${c.appearance}`);
  if (c.personality) p.push(`- Tính cách: ${c.personality}`);
  if (c.speech_style) p.push(`- Giọng văn / Cách xưng hô đặc trưng: ${c.speech_style}`);
  if (c.goals) p.push(`- Mục tiêu / Động cơ: ${c.goals}`);
  if (c.secret) p.push(`- Bí mật: ${c.secret}`);
  if (c.inner_conflict) p.push(`- Mâu thuẫn nội tâm: ${c.inner_conflict}`);
  if (c.power_level) p.push(`- Tu vi / Năng lực: ${c.power_level}`);
  if (c.skills) p.push(`- Kỹ năng / Pháp thuật: ${c.skills}`);
  if (c.items) p.push(`- Pháp bảo / Vật phẩm: ${c.items}`);
  return p.join("\n");
}

const BRAINSTORM_SCHEMA = {
  type: "object",
  properties: {
    options: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          title: { type: "string" },
          outline: { type: "string" },
        },
        required: ["key", "title", "outline"],
      },
    },
  },
};

const CONSISTENCY_SCHEMA = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string" },
          where: { type: "string" },
          problem: { type: "string" },
        },
        required: ["severity", "problem"],
      },
    },
  },
};

function bibleExtra(glossary, foreshadow) {
  return `\n# Bảng thuật ngữ cổ phong (Glossary — xưng hô/địa danh/chức quan)\n${glossary}\n\n# Phục bút chưa giải quyết (cân nhắc hồi đáp khi gần hết arc)\n${foreshadow}`;
}

function buildBrainstormPrompt(source, currentState, profiles, relations, phase, glossary, foreshadow) {
  const bible = `${relations}${bibleExtra(glossary, foreshadow)}`;
  if (phase === "open") {
    return `Bạn là trợ lý kịch thuật Bách Hợp Cổ Đại. Dựa DÀN Ý / BIẾN CỐ CHÍNH của chương này, hãy đề xuất 3 CÁCH MỞ ĐẦU, BÁM SÁT 100% nội dung dàn ý.

# Dàn ý / Biến cố chính của chương này
${source || "(Chưa có dàn ý — hãy đề xuất 3 cách mở đầu chung cho chương đầu.)"}

# Dữ kiện trạng thái nhân vật (bổ sung từ Story Bible)
${currentState}

# Hồ sơ nhân vật
${profiles}

# Ma trận quan hệ & xưng hô + Glossary cổ phong & Phục bút
${bible}

# Yêu cầu
- Đưa ra đúng 3 lựa chọn cách mở đầu:
  + key "A": Mở đầu bằng nội tâm — dòng tâm sự/độc thoại nội tâm dẫn vào.
  + key "B": Mở đầu bằng đối thoại — lời thoại trực tiếp tạo kịch tính.
  + key "C": Mở đầu bằng hành động — mở bằng một cảnh/chuyển động sinh động.
- Mỗi hướng BẮT BUỘC chứa ít nhất 1 BIẾN CỐ/XUNG ĐỘT cụ thể lấy từ dàn ý (không chỉ mô tả không khí/khung cảnh phiếm như "trời đẹp, ngồi uống trà"). "title" ngắn (≤ 8 từ), "outline" là dàn ý chi tiết 4-6 gạch đầu dòng bằng tiếng Việt cổ kính, điền nhã, KHÔNG dùng từ hiện đại, BÁM SÁT 100% dàn ý, đúng tính cách & quan hệ, DÙNG ĐÚNG xưng hô theo Glossary giọng nhân vật.
Trả JSON đúng schema.`;
  }
  return `Bạn là trợ lý kịch thuật Bách Hợp Cổ Đại. Hãy đọc ĐOẠN KẾT dưới đây, trích trạng thái/vị trí/cảm xúc nhân vật (dựa văn bản + Story Bible), rồi đề xuất 3 HƯỚNG KỊCH BẢN viết tiếp.

# Đoạn kết chương trước
${source || "(Trống — hãy đề xuất 3 hướng mở chuyện cho chương đầu.)"}

# Dữ kiện trạng thái nhân vật (bổ sung từ Story Bible)
${currentState}

# Hồ sơ nhân vật
${profiles}

# Ma trận quan hệ & xưng hô + Glossary cổ phong & Phục bút
${bible}

# Yêu cầu
- Đưa ra đúng 3 lựa chọn:
  + key "A": Nối liền lập tức — tiếp ngay khoảnh khắc đoạn kết dừng lại.
  + key "B": Chuyển cảnh sang hôm sau — dịch chuyển thời gian, giữ tâm lý nhân vật.
  + key "C": Biến cố bất ngờ — một sự kiện đột phá thay đổi hướng truyện.
- Mỗi hướng BẮT BUỘC chứa ít nhất 1 BIẾN CỐ/XUNG ĐỘT cụ thể (không chỉ mô tả không khí/hành động phiếm). "title" ngắn (≤ 8 từ), "outline" là dàn ý chi tiết 4-6 gạch đầu dòng, cổ kính, điền nhã, không từ hiện đại, bám tính cách & quan hệ, dùng đúng Glossary xưng hô. Nếu sắp hết arc, ưu tiên hướng hồi đáp phục bút.
Trả JSON đúng schema.`;
}

function buildScenePrompt(profiles, relations, outline, ctxText, currentState, phase, glossary, foreshadow) {
  const bible = `${relations}${bibleExtra(glossary, foreshadow)}`;
  if (phase === "open") {
    return `Bạn là trợ lý sáng tác văn học chuyên tiểu thuyết Bách Hợp Cổ Đại. Văn phong điền nhã, tao nhã, từ ngữ cổ kính. TUYỆT ĐỐI không dùng từ hiện đại và không giải thích meta — chỉ viết văn.

Dữ liệu dưới đây lấy từ Story Bible (Hồ Sơ Truyện). Hãy MỞ ĐẦU một phân cảnh của chương mới, BÁM SÁT 100% dàn ý / biến cố chính.

# Dàn ý / Biến cố chính của chương này
${ctxText || "(Chưa có dàn ý — hãy mở đầu một chương mới hợp lý theo dàn ý phân cảnh.)"}

# Trạng thái & vị trí hiện tại của nhân vật
${currentState}

# Hồ sơ nhân vật xuất hiện trong cảnh (kể cả giọng văn/xưng hô/mục tiêu/bí mật)
${profiles}

# Quan hệ & xưng hô + Glossary cổ phong & Phục bút
${bible}

# Dàn ý phân cảnh (chi tiết cận cảnh)
${outline.trim() || "(Chưa cung cấp — hãy tự xây phân cảnh mở đầu hợp lý, đúng tính cách & quan hệ nhân vật.)"}

# Yêu cầu bắt buộc
- MỞ ĐẦU chương mới BÁM SÁT 100% dàn ý.
- Giữ tông giọng, Ngoại hình cố định, vị trí & tâm lý nhất quán với Story Bible.
- Xưng hô ĐÚNG theo giọng văn nhân vật + Glossary (sư huynh, sư đệ, công tử, nương tử, đại nhân...).
- Văn phong cổ kính, điền nhã, gợi hình; khoảng 700–1100 từ, chia đoạn rõ ràng.
- Không mâu thuẫn tính cách/bí mật/động cơ nhân vật; nếu hợp lý có thể gợi hồi đáp phục bút.
- Chỉ viết văn phân cảnh — không tiêu đề meta, không lời dẫn.

Hãy bắt đầu:`;
  }
  return `Bạn là trợ lý sáng tác văn học chuyên tiểu thuyết Bách Hợp Cổ Đại. Văn phong điền nhã, tao nhã, cổ kính. TUYỆT ĐỐI không dùng từ hiện đại, không giải thích meta — chỉ viết văn.

Dữ liệu dưới đây lấy từ Story Bible & chương trước. Hãy VIẾT TIẾP MỘT PHÂN CẢNH mới tự nhiên, nối mạch từ đoạn kết.

# Đoạn kết của chương trước
${ctxText || "(Không có đoạn kết — viết phân cảnh tiếp theo theo dàn ý.)"}

# Trạng thái & vị trí hiện tại của nhân vật
${currentState}

# Hồ sơ nhân vật xuất hiện trong cảnh (kể cả giọng văn/xưng hô/mục tiêu/bí mật)
${profiles}

# Quan hệ & xưng hô + Glossary cổ phong & Phục bút
${bible}

# Dàn ý phân cảnh mới
${outline.trim() || "(Chưa cung cấp — hãy tự xây một phân cảnh hợp lý, nối tiếp tự nhiên với đoạn kết.)"}

# Yêu cầu bắt buộc
- VIẾT TIẾP mạch văn tự nhiên, GIỮ NGUYÊN tông giọng, vị trí, tâm lý, Ngoại hình cố định.
- Tuyệt đối không đứt gãy / mâu thuẫn tình tiết với đoạn kết.
- Xưng hô ĐÚNG giọng nhân vật + Glossary.
- Văn phong cổ kính, điền nhã, gợi hình; khoảng 700–1100 từ, chia đoạn rõ.
- Chỉ viết văn phân cảnh — không tiêu đề meta, không lời dẫn.

Hãy bắt đầu:`;
}

function buildConsistencyPrompt(content, profiles, relations, glossary, currentState, foreshadow) {
  return `Bạn là biên tập viên kiểm tra nhất quán cho tiểu thuyết Bách Hợp Cổ Đại. Hãy so sánh nội dung chương vừa viết với Story Bible (Hồ Sơ Truyện) dưới đây, phát hiện các MÂU THUẪN và vi phạm.

# Nội dung chương vừa viết
"""${content}"""

# Story Bible — Hồ sơ nhân vật
${profiles}

# Story Bible — Quan hệ & xưng hô
${relations}

# Story Bible — Glossary cổ phong
${glossary}

# Trạng thái nhân vật hiện tại (timeline)
${currentState}

# Phục bút chưa giải quyết
${foreshadow}

# Yêu cầu
Chỉ báo LỖI / mâu thuẫn thật sự, ví dụ:
- Đổi ngoại hình cố định của nhân vật (mắt, tóc...).
- Sai xưng hô so với giọng/ thân phận trong Story Bible / Glossary.
- Nhắc sự kiện chưa xảy ra hoặc mâu thuẫn timeline.
- Nhân vật hành động trái tính cách / động cơ / bí mật đã ghi.
Mỗi lỗi: severity ("nghiêm trọng" / "cảnh báo"), where (trích đoạn ngắn / tên nhân vật), problem (mô tả cụ thể).
Nếu không có lỗi, trả issues là mảng rỗng []. Trả JSON đúng schema.`;
}

function buildToolPrompt(action, selectedText, ctxBlock, note) {
  switch (action) {
    case "continue":
      return `${ctxBlock}

Dựa văn phong đoạn dưới đây, hãy VIẾT TIẾP khoảng 300 từ nối tiếp mượt mà, Bách Hợp Cổ Đại, điền nhã, không từ hiện đại, không lặp đoạn gốc, GIỮ ĐÚNG xưng hô Story Bible.

Đoạn gốc:
"""${selectedText}"""

Chỉ viết phần tiếp:`;
    case "expand":
      return `Hãy MỞ RỘNG phần miêu tả cổ phong sau đây — điền nhã, thêm chi tiết ngoại hình / quang cảnh / cảm xúc (~200 từ), giữ ý cốt lõi, không từ hiện đại. Chỉ trả phần mở rộng.

"""${selectedText}"""`;
    case "shorten":
      return `RÚT GỌN đoạn sau giữ ý cốt lõi, văn phong cổ phong, khoảng 55-65% độ dài gốc. Chỉ trả kết quả.

"""${selectedText}"""`;
    case "polish":
      return `POLISH đoạn sau sang văn phong cổ phong Hán Việt CHUẨN — thay từ hiện đại bằng điển cố/thành ngữ Hán Việt, điền nhã, mượt mà, giữ nguyên ý. Bám xưng hô Story Bible. Chỉ trả kết quả đã polish.

"""${selectedText}"""`;
    case "tone_formal":
      return `Viết lại đoạn sau TRANG TRỌNG / lễ nghiêm hơn (giữ cổ phong, bám xưng hô). Chỉ trả kết quả.

"""${selectedText}"""`;
    case "tone_intimate":
      return `Viết lại đoạn sau GẦN GŨI / ấm áp hơn (giữ cổ phong, bám xưng hô). Chỉ trả kết quả.

"""${selectedText}"""`;
    case "tone_poetic":
      return `Viết lại đoạn sau THƠ MỘNG / gợi hình hơn (thêm ẩn dụ, điển cố cổ phong, bám xưng hô). Chỉ trả kết quả.

"""${selectedText}"""`;
    case "dialogue":
      return `${ctxBlock}

Dựa quan hệ & xưng hô giữa các nhân vật (Story Bible), hãy SINH lời thoại chuẩn xưng hô nối tiếp đoạn sau (chỉ lời thoại + vài câu hành động ngắn, 4–8 câu), cổ phong.

Đoạn hiện tại:
"""${selectedText}"""`;
    case "dialogue_next":
      return `${ctxBlock}

SINH lời thoại TIẾP THEO nối sau đoạn dưới (4–8 câu), ĐÚNG tính cách + xưng hô Story Bible. Chỉ trả lời thoại + hành động ngắn.

"""${selectedText}"""`;
    case "action_next":
      return `${ctxBlock}

GỢI Ý 3 hành động/khắc tiếp theo của nhân vật trong cảnh (mỗi cái 1 câu cụ thể, cổ phong). Chỉ liệt kê.

"""${selectedText}"""`;
    case "suggest":
      return `Dựa đoạn sau, GỢI Ý 3 tình huống tiếp theo phù hợp Bách Hợp Cổ Đại, mỗi tình huống 1–2 câu cụ thể. Chỉ liệt kê.

"""${selectedText}"""`;
    case "rewrite_by_feedback":
      return `${ctxBlock}

Hãy VIẾT LẠI đoạn sau theo góp ý của tác giả (giữ cổ phong, bám xưng hô Story Bible, không từ hiện đại, giữ ý cốt lõi). Chỉ trả kết quả viết lại.

Góp ý: ${note || "(làm cho hay hơn, giữ ý chính)"}

Đoạn gốc:
"""${selectedText}"""`;
    default:
      return selectedText;
  }
}