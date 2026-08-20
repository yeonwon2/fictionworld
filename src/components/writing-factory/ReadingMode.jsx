import React, { useMemo, useState } from "react";
import { X, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";

// Chế độ đọc full-screen — hiển thị chương liên tục, không editor, để review trước khi đăng.
export default function ReadingMode({ chapters, storyName, onClose }) {
  const sorted = useMemo(
    () => [...(chapters || [])].sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0)),
    [chapters]
  );
  const [idx, setIdx] = useState(0);
  const [fontSize, setFontSize] = useState(18);

  if (!sorted.length) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Chưa có chương nào để đọc.</p>
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-md hover:bg-muted"><X className="w-5 h-5" /></button>
      </div>
    );
  }

  const ch = sorted[idx];
  const content = (ch.content || "").trim();

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border shrink-0">
        <BookOpen className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium truncate">{storyName || "Đọc truyện"}</span>
        <span className="text-xs text-muted-foreground">
          {ch.chapter_number != null ? `Ch.${ch.chapter_number}` : ""} · {ch.title}
        </span>
        <span className="text-[10px] text-muted-foreground ml-1">
          {idx + 1}/{sorted.length}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-[10px] text-muted-foreground">Cỡ chữ</label>
          <input
            type="range"
            min={14}
            max={24}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-20 accent-primary"
          />
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted"
          title="Đóng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-6 py-10" style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}>
          <h2 className="text-center text-xl font-semibold mb-8">
            {ch.chapter_number != null ? `Chương ${ch.chapter_number}: ` : ""}{ch.title}
          </h2>
          {content.split(/\n\s*\n/).filter(Boolean).map((para, i) => (
            <p key={i} className="mb-4 text-justify">{para}</p>
          ))}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border shrink-0">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" /> Chương trước
        </button>

        <div className="flex items-center gap-1.5">
          {sorted.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-2 h-2 rounded-full ${i === idx ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <button
          onClick={() => setIdx((i) => Math.min(sorted.length - 1, i + 1))}
          disabled={idx >= sorted.length - 1}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-30"
        >
          Chương sau <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}