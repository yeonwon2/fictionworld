import React, { useMemo, useState } from "react";
import { aiCall } from "@/lib/aiCall";
import { genreStyleLine } from "@/lib/genreStyle";
import {
  GitBranch,
  Drama,
  Zap,
  Moon,
  MessageSquareQuote,
  Dices,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";

const THEMES = [
  "Trăng",
  "Biệt ly",
  "Rượu",
  "Chiến trận",
  "Tình ý",
  "Thời gian / Năm tháng",
  "Mùa xuân",
  "Lá thu",
  "Cô đơn",
];

const THEME_DESC = {
  "Trăng": "tả trăng (trăng thanh, trăng khuyết, bóng trăng...)",
  "Biệt ly": "tả biệt ly / chia ly",
  "Rượu": "tả rượu / ấm rượu / say",
  "Chiến trận": "tả chiến trận / sát khí",
  "Tình ý": "tả tình ý / ái mộ",
  "Thời gian / Năm tháng": "tả thời gian / năm tháng trôi",
  "Mùa xuân": "tả mùa xuân",
  "Lá thu": "tả lá thu / tàn dạ",
  "Cô đơn": "tả cô đơn / tịch mịch",
};

const TOOLS = [
  { key: "branch", label: "Rẽ Nhánh Tình Huống", icon: GitBranch, desc: "3-4 hướng phát triển kèm ưu/nhược" },
  { key: "intensify", label: "Tăng Kịch Tính", icon: Drama, desc: "căng thẳng hơn" },
  { key: "conflict", label: "Sinh Xung Đột Nhỏ", icon: Zap, desc: "trở ngại nhỏ chèn vào cảnh" },
  { key: "imagery", label: "Ngân Hàng Ý Tượng", icon: Moon, desc: "cụm từ Hán Việt theo chủ đề" },
  { key: "voice", label: "Sinh Thoại Theo Giọng NV", icon: MessageSquareQuote, desc: "đúng tính cách + xưng hô" },
  { key: "challenge", label: "Thử Thách Ngẫu Nhiên", icon: Dices, desc: "tình huống bất ngờ phá bế tắc" },
];

function tailWords(text, n = 500) {
  if (!text) return "";
  const w = text.split(/\s+/).filter(Boolean);
  return w.slice(-n).join(" ");
}

function buildProfileLite(c) {
  const p = [`【${c.name}】`];
  if (c.role) p.push(`- Thân phận: ${c.role}`);
  if (c.personality) p.push(`- Tính cách: ${c.personality}`);
  if (c.speech_style) p.push(`- Giọng văn / Xưng hô: ${c.speech_style}`);
  if (c.goals) p.push(`- Động cơ: ${c.goals}`);
  if (c.inner_conflict) p.push(`- Mâu thuẫn nội tâm: ${c.inner_conflict}`);
  return p.join("\n");
}

function buildIdeaPrompt(tool, { context, profile, glossary, theme, genre }) {
  const gi = glossary ? `\n# Bảng thuật ngữ (tham khảo xưng hô/địa danh)\n${glossary}\n` : "";
  const style = genreStyleLine(genre);
  switch (tool) {
    case "branch":
      return `Bạn là cố vấn kịch thuật tiểu thuyết. ${style} Dựa đoạn đang viết dưới đây, đề xuất 3-4 HƯỚNG PHÁT TRIỂN khác nhau, mỗi hướng kèm 1 câu ưu + 1 câu nhược (ghi nhãn: "kịch tính hơn" / "hợp lý hơn" / "bất ngờ hơn"...).${gi}\n# Đoạn đang viết\n${context || "(chưa có nội dung)"}\n\nLiệt kê gọn.`;
    case "intensify":
      return `${style} Hãy gợi ý 2-3 cách làm đoạn sau CĂNG THẲNG / gay cấn hơn (thêm kịch tính, đẩy cao trào), cụ thể.${gi}\n\n# Đoạn\n${context || "(chưa có nội dung)"}`;
    case "conflict":
      return `${style} Gợi ý 1 chi tiết trở ngại / mâu thuẫn nhỏ để chèn vào cảnh đang quá êm đềm — cụ thể, hợp bối cảnh (1-2 câu mô tả).${gi}\n\n# Bối cảnh\n${context || ""}`;
    case "imagery":
      return `${style} Ngân hàng ý tượng cho chủ đề "${theme}". Đưa 8-12 cụm từ / ẩn dụ / thành ngữ phù hợp thể loại truyện để ${THEME_DESC[theme] || theme}. Mỗi cụm kèm 1 câu giải thích ngắn.`;
    case "voice":
      return `Bạn hoá thân thành nhân vật dưới đây. ${style} Hãy viết 1 đoạn lời thoại/độc thoại ĐÚNG tính cách + cách xưng hô đặc trưng, bối cảnh: ${context || "(tự chọn bối cảnh phù hợp)"}.${gi}\n\n# Hồ sơ nhân vật\n${profile || "(chưa chọn nhân vật)"}\n\nChỉ viết lời thoại + vài câu hành động ngắn.`;
    case "challenge":
      return `${style} Hãy sinh 1 tình huống BẤT NGỜ liên quan bối cảnh dưới đây để phá bế tắc — cụ thể, bất ngờ.${gi}\n\n# Bối cảnh\n${context || "(chưa có nội dung)"}`;
    default:
      return "";
  }
}

export default function IdeaTools({
  content,
  characters,
  selectedIds,
  glossaryBlock,
  genre,
  onAppend,
}) {
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState("");
  const [charId, setCharId] = useState("");
  const [theme, setTheme] = useState("Trăng");
  const [error, setError] = useState("");

  const defaultCharId = useMemo(() => {
    if (charId) return charId;
    if (selectedIds?.length) return selectedIds[0];
    return characters?.[0]?.id || "";
  }, [charId, selectedIds, characters]);

  const run = async (tool) => {
    setBusy(tool);
    setError("");
    setResult("");
    try {
      const profile =
        tool === "voice"
          ? buildProfileLite(characters.find((c) => c.id === defaultCharId) || {})
          : "";
      const prompt = buildIdeaPrompt(tool, {
        context: tailWords(content, 500),
        profile,
        glossary: glossaryBlock,
        theme,
        genre,
      });
      const res = await aiCall(prompt);
      setResult(String(res));
    } catch (e) {
      setError("Lỗi: " + (e?.message || "không xác định"));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4">
      <h3 className="font-display font-semibold text-sm mb-1 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" /> Công cụ xử lý bí ý tưởng
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Bôi đen văn bản trong trình soạn thảo để mấy công cụ dưới lấy bối cảnh đó.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => run(t.key)}
              disabled={!!busy}
              className="flex flex-col items-start gap-1 p-2.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 disabled:opacity-50 transition text-left"
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                {busy === t.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
                {t.label}
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight">{t.desc}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <div className="flex items-center gap-1.5 text-xs">
          <MessageSquareQuote className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">NV thoại:</span>
          <select
            value={defaultCharId}
            onChange={(e) => setCharId(e.target.value)}
            className="rounded-md border border-input bg-transparent px-2 py-1 text-xs"
          >
            <option value="">— chọn nhân vật —</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Moon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Chủ đề ý tượng:</span>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="rounded-md border border-input bg-transparent px-2 py-1 text-xs"
          >
            {THEMES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="mt-3 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>}

      {result && (
        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-primary">Kết quả</span>
            <button
              onClick={() => onAppend?.(result)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Chèn vào văn bản
            </button>
          </div>
          <pre className="text-xs whitespace-pre-wrap font-body leading-relaxed text-foreground/90 max-h-64 overflow-y-auto">
{result}
          </pre>
        </div>
      )}
    </div>
  );
}