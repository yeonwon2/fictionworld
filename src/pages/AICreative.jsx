import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useStory } from "@/lib/StoryContext";
import { listCharacters, listRelationships, listChapters, listEvents, listLocations } from "@/lib/worldcrud";
import { Sparkles, Loader2 } from "lucide-react";
import SceneSetupPanel from "@/components/ai/SceneSetupPanel";
import AIEditor from "@/components/ai/AIEditor";

// Trang Sáng Tác AI — có tính năng Mạch truyện (Story Continuity)
export default function AICreative() {
  const { currentStoryId, ready } = useStory();
  const [characters, setCharacters] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [events, setEvents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loadingChars, setLoadingChars] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [outline, setOutline] = useState("");
  const [content, setContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [brainstorming, setBrainstorming] = useState(false);

  useEffect(() => {
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
        // Mặc định chọn chương liền trước (chương cuối cùng có sẵn)
        if ((ch || []).length > 0) setSelectedChapterId(ch[ch.length - 1].id);
      })
      .finally(() => setLoadingChars(false));
  }, [ready, currentStoryId]);

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

  // Chương trước được chọn + đoạn kết (500–1000 từ cuối)
  const selectedChapter = useMemo(
    () => chapters.find((c) => c.id === selectedChapterId) || null,
    [chapters, selectedChapterId]
  );
  const chapterEnding = useMemo(
    () => (selectedChapter?.content ? getLastWords(selectedChapter.content, 600) : ""),
    [selectedChapter]
  );

  // Trạng thái / vị trí / cảm xúc hiện tại (rút từ sự kiện gần nhất)
  const currentStateBlock = useMemo(() => {
    if (!events.length) return "(Chưa có sự kiện nào để suy trạng thái hiện tại.)";
    const latest = [...events].sort((a, b) => (b.timeline_order || 0) - (a.timeline_order || 0))[0];
    const locNames = (latest.related_location_ids || [])
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
    base44.integrations.Core.InvokeLLM({ prompt, model: "gemini_3_flash", ...(schema ? { response_json_schema: schema } : {}) });

  const handleGenerate = async () => {
    setError("");
    if (selectedIds.length === 0) {
      setError("Hãy chọn ít nhất một nhân vật xuất hiện trong cảnh.");
      return;
    }
    setGenerating(true);
    try {
      const prompt = buildScenePrompt(profilesBlock, relationsBlock, outline, chapterEnding, currentStateBlock);
      const res = await callLLM(prompt);
      setContent((prev) => (prev.trim() ? `${prev}\n\n---\n\n${res}` : String(res)));
    } catch (e) {
      setError("Không thể sinh phân cảnh: " + (e?.message || "lỗi không xác định"));
    } finally {
      setGenerating(false);
    }
  };

  const handleBrainstorm = async () => {
    setError("");
    setBrainstorming(true);
    setSuggestions([]);
    try {
      const prompt = buildBrainstormPrompt(chapterEnding, currentStateBlock, profilesBlock, relationsBlock);
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
          <Sparkles className="w-6 h-6 text-primary" /> Sáng Tác AI
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Viết phân cảnh cổ phong — tự nối tiếp chương trước & giữ mạch truyện liên tục.
        </p>
      </header>

      {error && (
        <div className="mb-3 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="grid lg:grid-cols-[340px_1fr] gap-4">
        <SceneSetupPanel
          characters={characters}
          loadingChars={loadingChars}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          outline={outline}
          setOutline={setOutline}
          onGenerate={handleGenerate}
          generating={generating}
          chapters={chapters}
          selectedChapterId={selectedChapterId}
          setSelectedChapterId={setSelectedChapterId}
          onBrainstorm={handleBrainstorm}
          brainstorming={brainstorming}
          suggestions={suggestions}
          onSelectSuggestion={handleSelectSuggestion}
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
            {selectedChapter
              ? `Nối tiếp «${selectedChapter.title}» — đã trích ${chapterEnding.split(/\s+/).filter(Boolean).length} từ đoạn kết.`
              : "Không nối tiếp chương nào."}{" "}
            {selectedIds.length > 0 && `Trích hồ sơ + quan hệ của ${selectedIds.length} nhân vật.`}
          </p>
        </div>
      </div>
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

function buildBrainstormPrompt(chapterEnding, currentState, profiles, relations) {
  return `Bạn là trợ lý kịch thuật Bách Hợp Cổ Đại. Hãy phân tích dữ liệu dưới đây và đề xuất 3 HƯỚNG KỊCH BẢN viết tiếp chương mới, bám sát logic vừa xảy ra ở chương trước.

# Đoạn kết chương trước
${chapterEnding || "(Chưa có chương trước — hãy đề xuất 3 hướng mở chuyện cho chương đầu.)"}

# Trạng thái / vị trí / cảm xúc hiện tại nhân vật
${currentState}

# Hồ sơ nhân vật
${profiles}

# Ma trận quan hệ & xưng hô
${relations}

# Yêu cầu
- Đưa ra đúng 3 lựa chọn:
  + key "A": Nối liền lập tức — tiếp ngay khoảnh khắc chương trước kết thúc.
  + key "B": Chuyển cảnh sang hôm sau —推移 thời gian, giữ tâm lý nhân vật.
  + key "C": Biến cố bất ngờ — một sự kiện đột phá thay đổi hướng truyện.
- Mỗi hướng: "title" ngắn gọn (≤ 8 từ), "outline" là dàn ý chi tiết 4-6 gạch đầu dòng bằng tiếng Việt, văn phong cổ kính, điền nhã, không từ hiện đại, bám đúng tính cách & quan hệ nhân vật.
Trả JSON theo schema.`;
}

function buildScenePrompt(profiles, relations, outline, chapterEnding, currentState) {
  return `Bạn là trợ lý sáng tác văn học chuyên tiểu thuyết Bách Hợp Cổ Đại. Văn phong điền nhã, tao nhã, từ ngữ cổ kính. TUYỆT ĐỐI không dùng từ ngữ hiện đại và không giải thích meta — chỉ viết văn.

Dữ liệu dưới đây lấy từ Sổ Tay Thế Giới & chương trước. Hãy VIẾT TIẾP MỘT PHÂN CẢNH mới một cách tự nhiên, nối mạch từ chương trước.

# Đoạn kết của chương trước
${chapterEnding || "(Không nối tiếp chương nào — viết phân cảnh mở đầu.)"}

# Trạng thái & vị trí hiện tại của nhân vật
${currentState}

# Hồ sơ nhân vật xuất hiện trong cảnh
${profiles}

# Ma trận quan hệ & cách xưng hô
${relations}

# Dàn ý phân cảnh mới
${outline.trim() || "(Chưa cung cấp — hãy tự xây một phân cảnh hợp lý, đúng tính cách & quan hệ nhân vật, nối tiếp tự nhiên với đoạn kết trên.)"}

# Yêu cầu bắt buộc
- VIẾT TIẾP mạch văn từ chương trước một cách tự nhiên, GIỮ NGUYÊN tông giọng, vị trí nhân vật và diễn biến tâm lý.
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