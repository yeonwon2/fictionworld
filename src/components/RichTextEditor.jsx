import React, { useRef } from "react";
import { Bold, Italic, Heading, List, ListOrdered, Link as LinkIcon } from "lucide-react";

/**
 * Trình soạn thảo Markdown nhẹ (không cần thư viện ngoài).
 * Hỗ trợ thanh công cụ: in đậm, in nghiêng, tiêu đề, danh sách, liên kết.
 * Props giống input điều khiển: { value, onChange, placeholder }.
 */
export default function RichTextEditor({ value, onChange, placeholder }) {
  const ref = useRef(null);

  // Chèn văn bản quanh vùng chọn hiện tại
  function insert(before, after = "") {
    const ta = ref.current;
    if (!ta) {
      onChange((value || "") + before + after);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = value.slice(start, end);
    const next = value.slice(0, start) + before + sel + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + sel.length;
    });
  }

  // Thêm tiền tố đầu dòng đang chọn (dùng cho heading / list)
  function linePrefix(prefix) {
    const ta = ref.current;
    const start = ta?.selectionStart ?? value.length;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => ta?.focus());
  }

  const btnClass = "p-1.5 rounded-md hover:bg-muted text-muted-foreground transition";

  return (
    <div className="rounded-lg border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring">
      {/* Thanh công cụ */}
      <div className="flex items-center gap-0.5 border-b border-border px-2 py-1.5 bg-muted/40">
        <button type="button" className={btnClass} title="In đậm" onClick={() => insert("**", "**")}>
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" className={btnClass} title="In nghiêng" onClick={() => insert("*", "*")}>
          <Italic className="w-4 h-4" />
        </button>
        <button type="button" className={btnClass} title="Tiêu đề" onClick={() => linePrefix("## ")}>
          <Heading className="w-4 h-4" />
        </button>
        <button type="button" className={btnClass} title="Danh sách" onClick={() => linePrefix("- ")}>
          <List className="w-4 h-4" />
        </button>
        <button type="button" className={btnClass} title="Danh sách số" onClick={() => linePrefix("1. ")}>
          <ListOrdered className="w-4 h-4" />
        </button>
        <button type="button" className={btnClass} title="Liên kết" onClick={() => insert("[", "](url)")}>
          <LinkIcon className="w-4 h-4" />
        </button>
        <span className="ml-auto text-[10px] text-muted-foreground pr-1">Hỗ trợ Markdown</span>
      </div>

      {/* Vùng nhập */}
      <textarea
        ref={ref}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={6}
        className="w-full bg-background px-3 py-2 text-sm outline-none resize-y min-h-[120px]"
      />
    </div>
  );
}