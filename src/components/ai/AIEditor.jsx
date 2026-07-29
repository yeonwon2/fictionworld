import React, { useRef, useState } from "react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Trình soạn thảo + thanh công cụ AI nhanh khi bôi đen văn bản
const TOOLS = [
  { action: "continue", label: "Viết tiếp" },
  { action: "expand", label: "Mở rộng miêu tả cổ phong" },
  { action: "dialogue", label: "Sinh lời thoại chuẩn xưng hô" },
  { action: "suggest", label: "Gợi ý tình huống tiếp theo" },
];

export default function AIEditor({ value, onChange, onAITool, busy, busyAction }) {
  const taRef = useRef(null);
  const [sel, setSel] = useState({ start: 0, end: 0, text: "" });

  const updateSelection = () => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    setSel({ start: s, end: e, text: ta.value.slice(s, e) });
  };

  const runTool = async (action) => {
    const result = await onAITool(action, sel.text);
    if (!result) return;
    // Chèn kết quả vào textarea theo chế độ từng công cụ
    const ta = taRef.current;
    if (!ta) return;
    const { start, end } = sel;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const selected = value.slice(start, end);
    const next = action === "expand"
      ? before + result + after
      : before + selected + "\n\n" + result + after;
    onChange(next);
    setSel({ start: 0, end: 0, text: "" });
  };

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Thanh tiêu đề + công cụ AI (xuất hiện khi bôi đen) */}
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
                {busyAction === t.action ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {t.label}
              </button>
            ))}
          </div>
        )}
        {sel.text.trim().length === 0 && (
          <span className="ml-auto text-[11px] text-muted-foreground hidden sm:inline">
            Bôi đen đoạn văn để dùng công cụ AI
          </span>
        )}
      </div>

      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSelect={updateSelection}
        onMouseUp={updateSelection}
        onKeyUp={updateSelection}
        placeholder="Phân cảnh do AI tạo ra sẽ hiển thị tại đây. Bạn có thể bôi đen một đoạn và dùng các công cụ AI phía trên để viết tiếp / mở rộng / sinh lời thoại / gợi ý tình huống..."
        className="w-full min-h-[420px] resize-y px-4 py-3 text-[15px] leading-7 bg-card focus:outline-none font-body"
      />
    </section>
  );
}