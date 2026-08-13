import React, { useRef, useState } from "react";
import { Sparkles, Loader2, Wand2, Bot, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Trình soạn thảo + thanh công cụ AI nhanh khi bôi đen văn bản
// mode "replace": ghi đè đoạn chọn bằng kết quả; "append": chèn sau đoạn chọn.
const TOOLS = [
  { action: "continue", label: "Viết tiếp", mode: "append" },
  { action: "expand", label: "Mở rộng miêu tả", mode: "replace" },
  { action: "shorten", label: "Rút gọn", mode: "replace" },
  { action: "polish", label: "Polish văn phong", mode: "replace" },
  { action: "tone_formal", label: "Trang trọng hơn", mode: "replace" },
  { action: "tone_intimate", label: "Gần gũi hơn", mode: "replace" },
  { action: "tone_poetic", label: "Thơ mộng hơn", mode: "replace" },
  { action: "dialogue_next", label: "Sinh thoại tiếp", mode: "append" },
  { action: "action_next", label: "Gợi ý hành động", mode: "append" },
  { action: "suggest", label: "Gợi ý tình huống", mode: "append" },
];

export default function AIEditor({ value, onChange, onAITool, busy, busyAction }) {
  const taRef = useRef(null);
  const [sel, setSel] = useState({ start: 0, end: 0, text: "" });
  const [rewriting, setRewriting] = useState(false);
  const [rewriteNote, setRewriteNote] = useState("");

  const updateSelection = () => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    setSel({ start: s, end: e, text: ta.value.slice(s, e) });
  };

  const baseInsert = (result, action) => {
    const ta = taRef.current;
    if (!ta) return;
    const { start, end } = sel;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const selected = value.slice(start, end);
    const mode = TOOLS.find((t) => t.action === action)?.mode || "append";
    const next = mode === "replace" ? before + result + after : before + selected + "\n\n" + result + after;
    onChange(next);
    setSel({ start: 0, end: 0, text: "" });
  };

  const runTool = async (action) => {
    const result = await onAITool(action, sel.text);
    if (result == null) return;
    baseInsert(result, action);
  };

  const runRewrite = async () => {
    const result = await onAITool("rewrite_by_feedback", sel.text, rewriteNote.trim());
    setRewriting(false);
    setRewriteNote("");
    if (result == null) return;
    // ghi đè đoạn vừa chèn (replace)
    baseInsert(result, "polish");
  };

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <Wand2 className="w-4 h-4 text-primary" />
        <span className="font-display font-semibold text-sm">Trình soạn thảo</span>

        {sel.text.trim().length > 0 && (
          <div className="ml-auto flex items-center gap-1 flex-wrap">
            <span className="hidden sm:inline text-[11px] text-muted-foreground mr-1">AI trên đoạn chọn:</span>
            {TOOLS.map((t) => (
              <button
                key={t.action}
                onClick={() => runTool(t.action)}
                disabled={busy || busyAction !== null}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition",
                  busyAction === t.action
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-primary/40 text-primary hover:bg-primary/10"
                )}
              >
                {busyAction === t.action ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {t.label}
              </button>
            ))}
            <button
              onClick={() => setRewriting((r) => !r)}
              disabled={busy || busyAction !== null}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition",
                "border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
              )}
            >
              <Bot className="w-3 h-3" /> Viết lại theo góp ý
            </button>
          </div>
        )}
        {sel.text.trim().length === 0 && (
          <span className="ml-auto text-[11px] text-muted-foreground hidden sm:inline">
            Bôi đen đoạn văn để dùng công cụ AI
          </span>
        )}
      </div>

      {rewriting && sel.text.trim().length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-500/30 bg-amber-500/5">
          <Bot className="w-4 h-4 text-amber-600 shrink-0" />
          <input
            value={rewriteNote}
            onChange={(e) => setRewriteNote(e.target.value)}
            placeholder="Góp ý để AI viết lại đoạn này (VD: để nhân vật nghi ngờ, đừng vội vàng)..."
            className="flex-1 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs"
          />
          <button
            onClick={runRewrite}
            disabled={busy || busyAction !== null}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs hover:opacity-90 disabled:opacity-50"
          >
            {busyAction === "rewrite_by_feedback" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Gửi
          </button>
          <button onClick={() => { setRewriting(false); setRewriteNote(""); }} className="p-1.5 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSelect={updateSelection}
        onMouseUp={updateSelection}
        onKeyUp={updateSelection}
        placeholder="Phân cảnh do AI tạo ra hiển thị tại đây. Bôi đen đoạn và dùng toolbar phía trên: viết tiếp / mở rộng / rút gọn / polish văn phong / đổi văn phong / sinh thoại / gợi ý hành động / viết lại theo góp ý..."
        className="w-full min-h-[420px] resize-y px-4 py-3 text-[15px] leading-7 bg-card focus:outline-none font-body"
      />
    </section>
  );
}