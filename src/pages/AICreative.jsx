import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useStory } from "@/lib/StoryContext";
import { listCharacters, listRelationships } from "@/lib/worldcrud";
import { Sparkles, Loader2 } from "lucide-react";
import SceneSetupPanel from "@/components/ai/SceneSetupPanel";
import AIEditor from "@/components/ai/AIEditor";

// Trang Sáng Tác AI
export default function AICreative() {
  const { currentStoryId, ready } = useStory();
  const [characters, setCharacters] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [loadingChars, setLoadingChars] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [outline, setOutline] = useState("");
  const [content, setContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    setLoadingChars(true);
    Promise.all([listCharacters(currentStoryId), listRelationships(currentStoryId)])
      .then(([c, r]) => {
        setCharacters(c || []);
        setRelationships(r || []);
      })
      .finally(() => setLoadingChars(false));
  }, [ready, currentStoryId]);

  const charById = useMemo(
    () => Object.fromEntries(characters.map((c) => [c.id, c])),
    [characters]
  );

  // Trích xuất hồ sơ nhân vật được chọn
  const profilesBlock = useMemo(() => {
    const chosen = characters.filter((c) => selectedIds.includes(c.id));
    if (!chosen.length) return "(Chưa chọn nhân vật.)";
    return chosen.map(buildProfile).join("\n\n");
  }, [characters, selectedIds]);

  // Ma trận quan hệ & xưng hô giữa các nhân vật được chọn
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

  const callLLM = async (prompt) => {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: "gemini_3_flash",
    });
    return res;
  };

  const handleGenerate = async () => {
    setError("");
    if (selectedIds.length === 0) {
      setError("Hãy chọn ít nhất một nhân vật xuất hiện trong cảnh.");
      return;
    }
    setGenerating(true);
    try {
      const prompt = buildScenePrompt(profilesBlock, relationsBlock, outline);
      const res = await callLLM(prompt);
      setContent((prev) => (prev.trim() ? `${prev}\n\n---\n\n${res}` : String(res)));
    } catch (e) {
      setError("Không thể sinh phân cảnh: " + (e?.message || "lỗi không xác định"));
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
          <Sparkles className="w-6 h-6 text-primary" /> Sáng Tác AI
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Viết phân cảnh cổ phong tự động — trích xuất dữ liệu nhân vật & quan hệ từ Sổ Tay Thế Giới.
        </p>
      </header>

      {error && (
        <div className="mb-3 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          {error}
        </div>
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
            {selectedIds.length > 0
              ? `Sẽ trích xuất hồ sơ + quan hệ của ${selectedIds.length} nhân vật được chọn.`
              : "Chưa chọn nhân vật nào — AI sẽ không có bối cảnh."}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---- Xây prompt ----
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

function buildScenePrompt(profiles, relations, outline) {
  return `Bạn là trợ lý sáng tác văn học chuyên tiểu thuyết Bách Hợp Cổ Đại. Văn phong điền nhã, tao nhã, từ ngữ cổ kính. TUYỆT ĐỐI không dùng từ ngữ hiện đại (như "hệ thống", "data", "feedback", "bình luận", "internet"...) và không giải thích meta — chỉ viết văn.

Dưới đây là dữ liệu từ Sổ Tay Thế Giới. Hãy dùng làm bối cảnh để VIẾT MỘT PHÂN CẢNH hoàn chỉnh.

# Hồ sơ nhân vật xuất hiện trong cảnh
${profiles}

# Ma trận quan hệ & cách xưng hô
${relations}

# Dàn ý phân cảnh
${outline.trim() || "(Chưa cung cấp — hãy tự xây một phân cảnh hợp lý, đúng tính cách & quan hệ nhân vật trên.)"}

# Yêu cầu
- Phong cách: Bách Hợp Cổ Đại, điền nhã, tao nhã, cổ kính.
- Xưng hô phù hợp thân phận & quan hệ trên (ví dụ: sư huynh, sư đệ, công tử, nương tử, đại nhân, bần đạo...).
- Diễn tả tâm lý & ngoại hình tinh tế, gợi hình, không sáo rỗng.
- Độ dài khoảng 700–1100 từ, chia đoạn rõ ràng.
- Chỉ viết văn phân cảnh — không tiêu đề meta, không ghi chú "phần 1", không lời dẫn.

Hãy bắt đầu:`;
}

function buildToolPrompt(action, selectedText, ctxBlock) {
  switch (action) {
    case "continue":
      return `${ctxBlock}

Dựa văn phong đoạn dưới đây, hãy VIẾT TIẾP khoảng 300 từ nối tiếp mượt mà, giữ trào lưu Bách Hợp Cổ Đại, điền nhã, không từ hiện đại, không lặp lại đoạn gốc, không giải thích.

Đoạn gốc:
"""${selectedText}"""

Chỉ viết phần tiếp:`;
    case "expand":
      return `Hãy MỞ RỘNG phần miêu tả cổ phong sau đây — văn phong điền nhã, thêm chi tiết ngoại hình / quang cảnh / cảm xúc (khoảng 200 từ), giữ nguyên ý cốt lõi, không dùng từ hiện đại. Chỉ trả phần mở rộng đã viết lại, không giải thích.

"""${selectedText}"""`;
    case "dialogue":
      return `${ctxBlock}

Dựa quan hệ & xưng hô giữa các nhân vật trên, hãy SINH lời thoại chuẩn xưng hô nối tiếp đoạn sau (chỉ lời thoại kèm vài câu hành động ngắn, 4–8 câu), không dùng từ hiện đại. Chỉ trả lời thoại.

Đoạn hiện tại:
"""${selectedText}"""`;
    case "suggest":
      return `Dựa đoạn sau, hãy GỢI Ý 3 tình huống tiếp theo phù hợp trào lưu Bách Hợp Cổ Đại, mỗi tình huống 1–2 câu, cụ thể, không sáo. Chỉ liệt kê 3 gợi ý.

"""${selectedText}"""`;
    default:
      return selectedText;
  }
}