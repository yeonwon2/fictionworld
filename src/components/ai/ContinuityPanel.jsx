import React from "react";
import { Link2, Loader2, Lightbulb, BookOpen, ClipboardPaste, Pin } from "lucide-react";

// Cấp độ 3 · Nối tiếp Mạch Truyện — hiển thị theo trạng thái chương (open / continue)
export default function ContinuityPanel({
  chapters,
  selectedChapterId,
  setSelectedChapterId,
  mode,
  setMode,
  pastedText,
  setPastedText,
  onBrainstorm,
  brainstorming,
  suggestions,
  onSelectSuggestion,
  phase,
  chapterOutline,
}) {
  const isOpen = phase === "open";

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="w-4 h-4 text-primary" />
        <h2 className="font-display font-semibold">Cấp độ 3 · Nối tiếp Mạch Truyện</h2>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            isOpen ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
          }`}
        >
          {isOpen ? "Mở đầu chương" : "Viết tiếp đoạn kết"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Chương đang chọn sẽ được tự động phân trạng thái để đề gợi ý cho đúng.
      </p>

      {/* Ô hiển thị nhanh dàn ý đã chốt */}
      <div className="rounded-lg border border-border bg-muted/30 p-2.5 mb-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary mb-1">
          <Pin className="w-3.5 h-3.5" /> Dàn ý đã chốt cho Chap này:
        </div>
        {chapterOutline?.trim() ? (
          <p className="text-[11px] text-muted-foreground whitespace-pre-line line-clamp-6 max-h-28 overflow-y-auto">
            {chapterOutline}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">
            Chưa có dàn ý chốt — hãy lập ở Cấp độ 2, hoặc nếu đang dán văn bản thì điền ô dàn ý phân cảnh.
          </p>
        )}
      </div>

      {/* Chế độ A / B */}
      <div className="inline-flex rounded-lg border border-border p-0.5 mb-3">
        <button
          onClick={() => setMode("pick")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
            mode === "pick" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 inline mr-1.5" />A · Chọn chương
        </button>
        <button
          onClick={() => setMode("paste")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
            mode === "paste" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          }`}
        >
          <ClipboardPaste className="w-3.5 h-3.5 inline mr-1.5" />B · Dán văn bản chap
        </button>
      </div>

      {mode === "pick" ? (
        <div>
          {(chapters || []).length === 0 ? (
            <p className="text-xs text-muted-foreground py-1.5">
              Chưa có chương nào — chuyển sang chế độ B để dán văn bản, hoặc dùng dàn ý ở Cấp độ 2.
            </p>
          ) : (
            <>
              <select
                value={selectedChapterId || ""}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                className="w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— Chọn chương đang viết —</option>
                {chapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.chapter_number != null ? `Ch. ${ch.chapter_number}: ` : ""}
                    {ch.title}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {isOpen
                  ? "Chương này chưa có bản thảo — AI sẽ đọc dàn ý để gợi ý 3 cách mở đầu."
                  : "Đã có bản thảo đoạn kết — AI đọc đoạn cuối để gợi ý hướng viết tiếp."}
              </p>
            </>
          )}
        </div>
      ) : (
        <div>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={5}
            placeholder="Dán trực tiếp văn bản Chương trước vào đây — AI sẽ đọc đoạn cuối để gợi ý viết tiếp..."
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Chế độ B luôn coi như viết tiếp — AI đọc 500–1000 từ đoạn cuối để gợi ý.
          </p>
        </div>
      )}

      {/* Nút gợi ý — đổi theo trạng thái */}
      <button
        onClick={onBrainstorm}
        disabled={brainstorming}
        className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-primary/40 text-primary text-sm font-medium hover:bg-primary/10 disabled:opacity-50 transition"
      >
        {brainstorming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
        {brainstorming
          ? "AI đang suy hướng kịch bản..."
          : isOpen
          ? "💡 AI Gợi Ý 3 Cách Mở Đầu Cho Chương Này"
          : "💡 AI Gợi Ý Tình Huống Nối Tiếp Đoạn Kết"}
      </button>

      {suggestions.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Chọn một hướng — dàn ý sẽ tự điền vào ô ở Cấp độ 4:
          </p>
          {suggestions.map((s, i) => (
            <div key={i} className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
              <div className="text-xs font-semibold text-primary">
                {s.key ? `Hướng ${s.key}: ` : ""}
                {s.title}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-3 whitespace-pre-line">
                {s.outline}
              </p>
              <button
                onClick={() => onSelectSuggestion(s.outline)}
                className="text-[11px] font-semibold text-primary hover:underline mt-1"
              >
                → Dùng hướng này
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}