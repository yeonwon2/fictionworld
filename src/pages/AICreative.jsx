import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useStory } from "@/lib/StoryContext";
import {
  listCharacters,
  listRelationships,
  listChapters,
  listEvents,
  listLocations,
} from "@/lib/worldcrud";
import { Sparkles, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ConceptTab from "@/components/ai/ConceptTab";
import ArcArchitectTab from "@/components/ai/ArcArchitectTab";
import ContinuityPanel from "@/components/ai/ContinuityPanel";
import SceneSetupPanel from "@/components/ai/SceneSetupPanel";
import AIEditor from "@/components/ai/AIEditor";

// Hệ thống Hỗ trợ Sáng tác 4 cấp độ: Ý tưởng → Dàn Ý → Nối Mạch → Viết
export default function AICreative() {
  const { currentStoryId, ready } = useStory();
  const [activeTab, setActiveTab] = useState("idea");
  const [characters, setCharacters] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [events, setEvents] = useState([]);
  const [locations, setLocations] = useState([]);
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
  const [error, setError] = useState("");

  const loadData = () => {
    if (!ready) return;
    setLoadingChars(true);
    Promise.all([
      listCharacters(currentStoryId),
      listRelationships(currentStoryId),
      listChapters(currentStoryId),
      listEvents(currentStoryId),
      listLocations(currentStoryId),
    ])
      .then(([c, r, ch, ev, lo]) => {
        setCharacters(c || []);
        setRelationships(r || []);
        setChapters(ch || []);
        setEvents(ev || []);
        setLocations(lo || []);
        if ((ch || []).length > 0 && !selectedChapterId) setSelectedChapterId(ch[ch.length - 1].id);
      })
      .finally(() => setLoadingChars(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadData, [ready, currentStoryId]);

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

  // Văn bản chương trước (chế độ A hoặc B)
  const selectedChapter = useMemo(
    () => chapters.find((c) => c.id === selectedChapterId) || null,
    [chapters, selectedChapterId]
  );
  const chapterOutline = useMemo(
    () => (mode === "pick" ? selectedChapter?.content || "" : outline || ""),
    [mode, selectedChapter, outline]
  );
  // Phase: "open" khi chương đang chọn chưa có bản thảo (mở đầu chương mới), "continue" khi đã có bản thảo / dán văn bản.
  const phase = useMemo(() => (mode === "pick" && !content.trim() ? "open" : "continue"), [mode, content]);
  // Văn bản cấp bối cảnh cho AI: dàn ý chương (nếu mở đầu) hoặc đoạn kết (nếu viết tiếp)
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
    return `Sự kiện gần nhất: ${latest.title}\n${lines.join("\n") || "(các nhân vật được chọn chưa xuất hiện trong sự kiện gần nhất)"}`;
  }, [events, selectedIds, charById, locById]);

  const callLLM = (prompt, schema) =>
    base44.integrations.Core.InvokeLLM({
      prompt,
      model: "gemini_3_flash",
      ...(schema ? { response_json_schema: schema } : {}),
    });

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
      const prompt = buildBrainstormPrompt(ctxText, currentStateBlock, profilesBlock, relationsBlock, phase);
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
      const prompt = buildScenePrompt(profilesBlock, relationsBlock, outline, ctxText, currentStateBlock, phase);
      const res = await callLLM(prompt);
      setContent((prev) => (prev.trim() ? `${prev}\n\n---\n\n${res}` : String(res)));
    } catch (e) {
      setError("Không thể sinh phân cảnh: " + (e?.message || "lỗi"));
    } finally {
      setGenerating(false);
    }
  };

  const handleAITool = async (action, selectedText) => {
    if (!selectedText.trim()) return null;
    setBusyAction(action);
    setError("");
    try {
      const ctxBlock = `${profilesBlock}\n\n${relationsBlock}`;
      const prompt = buildToolPrompt(action, selectedText, ctxBlock);
      const res = await callLLM(prompt);
      return String(res);
    } catch (e) {
      setError("Công cụ AI lỗi: " + (e?.message || "lỗi"));
      return null;
    } finally {
      setBusyAction(null);
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
                  <Loader2 className="w-4 h-4 animate-spin" /> Gemini đang viết phân cảnh...
                </div>
              )}
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
                {selectedIds.length > 0 && `Trích hồ sơ + quan hệ của ${selectedIds.length} nhân vật.`}
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
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
  if (c.description) p.push(`- Giới thiệu: ${c.description}`);
  if (c.appearance) p.push(`- Ngoại hình: ${c.appearance}`);
  if (c.personality) p.push(`- Tính cách: ${c.personality}`);
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

function buildBrainstormPrompt(source, currentState, profiles, relations, phase) {
  if (phase === "open") {
    return `Bạn là trợ lý kịch thuật Bách Hợp Cổ Đại. Dựa DÀN Ý / BIẾN CỐ CHÍNH của chương này dưới đây, hãy đề xuất 3 CÁCH MỞ ĐẦU cho chương, BÁM SÁT 100% nội dung dàn ý đó.

# Dàn ý / Biến cố chính của chương này
${source || "(Chưa có dàn ý — hãy đề xuất 3 cách mở đầu chung cho chương đầu.)"}

# Dữ kiện trạng thái nhân vật (bổ sung từ Sổ Tay)
${currentState}

# Hồ sơ nhân vật
${profiles}

# Ma trận quan hệ & xưng hô
${relations}

# Yêu cầu
- Đưa ra đúng 3 lựa chọn cách mở đầu:
  + key "A": Mở đầu bằng nội tâm — dòng tâm sự/độc thoại nội tâm dẫn vào.
  + key "B": Mở đầu bằng đối thoại — lời thoại trực tiếp tạo kịch tính.
  + key "C": Mở đầu bằng hành động — mở bằng một cảnh/chuyển động sinh động.
- Mỗi hướng: "title" ngắn (≤ 8 từ), "outline" là dàn ý chi tiết 4-6 gạch đầu dòng bằng tiếng Việt cổ kính, điền nhã, KHÔNG dùng từ hiện đại, BÁM SÁT 100% dàn ý chương này, đúng tính cách & quan hệ nhân vật.
Trả JSON đúng schema.`;
  }
  return `Bạn là trợ lý kịch thuật Bách Hợp Cổ Đại. Hãy đọc ĐOẠN KẾT dưới đây, trích trạng thái / vị trí / cảm xúc các nhân vật (dựa văn bản + dữ kiện bổ sung), rồi đề xuất 3 HƯỚNG KỊCH BẢN viết tiếp, bám sát logic vừa xảy ra.

# Đoạn kết chương trước
${source || "(Trống — hãy đề xuất 3 hướng mở chuyện cho chương đầu.)"}

# Dữ kiện trạng thái nhân vật (bổ sung từ Sổ Tay)
${currentState}

# Hồ sơ nhân vật
${profiles}

# Ma trận quan hệ & xưng hô
${relations}

# Yêu cầu
- Đưa ra đúng 3 lựa chọn:
  + key "A": Nối liền lập tức — tiếp ngay khoảnh khắc đoạn kết dừng lại.
  + key "B": Chuyển cảnh sang hôm sau — dịch chuyển thời gian, giữ tâm lý nhân vật.
  + key "C": Biến cố bất ngờ — một sự kiện đột phá thay đổi hướng truyện.
- Mỗi hướng: "title" ngắn (≤ 8 từ), "outline" là dàn ý chi tiết 4-6 gạch đầu dòng bằng tiếng Việt cổ kính, điền nhã, không dùng từ hiện đại, bám đúng tính cách & quan hệ nhân vật.
Trả JSON đúng schema.`;
}

function buildScenePrompt(profiles, relations, outline, ctxText, currentState, phase) {
  if (phase === "open") {
    return `Bạn là trợ lý sáng tác văn học chuyên tiểu thuyết Bách Hợp Cổ Đại. Văn phong điền nhã, tao nhã, từ ngữ cổ kính. TUYỆT ĐỐI không dùng từ ngữ hiện đại và không giải thích meta — chỉ viết văn.

Dữ liệu dưới đây lấy từ Sổ Tay Thế Giới. Hãy MỞ ĐẦU một phân cảnh của chương mới, BÁM SÁT 100% dàn ý / biến cố chính của chương này.

# Dàn ý / Biến cố chính của chương này
${ctxText || "(Chưa có dàn ý — hãy mở đầu một chương mới hợp lý theo dàn ý phân cảnh.)"}

# Trạng thái & vị trí hiện tại của nhân vật
${currentState}

# Hồ sơ nhân vật xuất hiện trong cảnh
${profiles}

# Ma trận quan hệ & cách xưng hô
${relations}

# Dàn ý phân cảnh (chi tiết cận cảnh)
${outline.trim() || "(Chưa cung cấp — hãy tự xây phân cảnh mở đầu hợp lý, đúng tính cách & quan hệ nhân vật.)"}

# Yêu cầu bắt buộc
- MỞ ĐẦU chương mới BÁM SÁT 100% dàn ý / biến cố chính của chương này.
- Giữ tông giọng, vị trí nhân vật, diễn biến tâm lý nhất quán với Sổ Tay.
- Xưng hô phù hợp thân phận & quan hệ (sư huynh, sư đệ, công tử, nương tử, đại nhân...).
- Văn phong cổ kính, điền nhã, gợi hình; khoảng 700–1100 từ, chia đoạn rõ ràng.
- Chỉ viết văn phân cảnh — không tiêu đề meta, không lời dẫn.

Hãy bắt đầu:`;
  }
  return `Bạn là trợ lý sáng tác văn học chuyên tiểu thuyết Bách Hợp Cổ Đại. Văn phong điền nhã, tao nhã, từ ngữ cổ kính. TUYỆT ĐỐI không dùng từ ngữ hiện đại và không giải thích meta — chỉ viết văn.

Dữ liệu dưới đây lấy từ Sổ Tay Thế Giới & chương trước. Hãy VIẾT TIẾP MỘT PHÂN CẢNH mới một cách tự nhiên, nối mạch từ đoạn kết.

# Đoạn kết của chương trước
${ctxText || "(Không có đoạn kết — viết phân cảnh tiếp theo theo dàn ý.)"}

# Trạng thái & vị trí hiện tại của nhân vật
${currentState}

# Hồ sơ nhân vật xuất hiện trong cảnh
${profiles}

# Ma trận quan hệ & cách xưng hô
${relations}

# Dàn ý phân cảnh mới
${outline.trim() || "(Chưa cung cấp — hãy tự xây một phân cảnh hợp lý, đúng tính cách & quan hệ nhân vật, nối tiếp tự nhiên với đoạn kết trên.)"}

# Yêu cầu bắt buộc
- VIẾT TIẾP mạch văn từ đoạn kết một cách tự nhiên, GIỮ NGUYÊN tông giọng, vị trí nhân vật và diễn biến tâm lý.
- Tuyệt đối không bị đứt gãy hay mâu thuẫn tình tiết với đoạn kết chương trước.
- Xưng hô phù hợp thân phận & quan hệ (sư huynh, sư đệ, công tử, nương tử, đại nhân...).
- Văn phong cổ kính, điền nhã, gợi hình; khoảng 700–1100 từ, chia đoạn rõ ràng.
- Chỉ viết văn phân cảnh — không tiêu đề meta, không lời dẫn.

Hãy bắt đầu:`;
}

function buildToolPrompt(action, selectedText, ctxBlock) {
  switch (action) {
    case "continue":
      return `${ctxBlock}

Dựa văn phong đoạn dưới đây, hãy VIẾT TIẾP khoảng 300 từ nối tiếp mượt mà, giữ trào lưu Bách Hợp Cổ Đại, điền nhã, không từ hiện đại, không lặp lại đoạn gốc.

Đoạn gốc:
"""${selectedText}"""

Chỉ viết phần tiếp:`;
    case "expand":
      return `Hãy MỞ RỘNG phần miêu tả cổ phong sau đây — văn phong điền nhã, thêm chi tiết ngoại hình / quang cảnh / cảm xúc (khoảng 200 từ), giữ nguyên ý cốt lõi, không dùng từ hiện đại. Chỉ trả phần mở rộng.

"""${selectedText}"""`;
    case "dialogue":
      return `${ctxBlock}

Dựa quan hệ & xưng hô giữa các nhân vật trên, hãy SINH lời thoại chuẩn xưng hô nối tiếp đoạn sau (chỉ lời thoại kèm vài câu hành động ngắn, 4–8 câu), không dùng từ hiện đại.

Đoạn hiện tại:
"""${selectedText}"""`;
    case "suggest":
      return `Dựa đoạn sau, hãy GỢI Ý 3 tình huống tiếp theo phù hợp trào lưu Bách Hợp Cổ Đại, mỗi tình huống 1–2 câu, cụ thể. Chỉ liệt kê 3 gợi ý.

"""${selectedText}"""`;
    default:
      return selectedText;
  }
}