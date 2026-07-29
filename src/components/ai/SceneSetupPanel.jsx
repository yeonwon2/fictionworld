import React from "react";
import { Users, Rocket, Loader2, Info, Lightbulb, BookOpen } from "lucide-react";

// Bảng thiết lập phân cảnh + Mạch truyện (nối chương trước) + gợi ý nối tiếp
export default function SceneSetupPanel({
  characters,
  loadingChars,
  selectedIds,
  setSelectedIds,
  outline,
  setOutline,
  onGenerate,
  generating,
  chapters,
  selectedChapterId,
  setSelectedChapterId,
  onBrainstorm,
  brainstorming,
  suggestions,
  onSelectSuggestion,
}) {
  const toggle = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <aside className="lg:sticky lg:top-16 lg:self-start space-y-4">
      {/* Nối tiếp chương trước */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold">Mạch truyện</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-2">Nối tiếp Chương/Phân cảnh — mặc định chọn chương liền trước.</p>
        <div className="text-xs font-medium mb-1 text-muted-foreground">Nối tiếp từ Chương/Phân cảnh:</div>
        {(chapters || []).length === 0 ? (
          <p className="text-xs text-muted-foreground py-1.5">Chưa có chương nào — đây sẽ là chương mở đầu.</p>
        ) : (
          <select
            value={selectedChapterId || ""}
            onChange={(e) => setSelectedChapterId(e.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">— Không nối tiếp (mở mới) —</option>
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.chapter_number != null ? `Ch. ${ch.chapter_number}: ` : ""}
                {ch.title}
              </option>
            ))}
          </select>
        )}
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Tự động trích 500–1000 từ cuối + trạng thái/vị trí nhân vật để gửi cho AI.
        </p>
      </div>

      {/* Chọn nhân vật */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold">Nhân vật trong cảnh</h2>
        </div>
        <div className="text-xs font-medium mb-1.5 text-muted-foreground">Nhân vật xuất hiện trong cảnh</div>
        {loadingChars ? (
          <div className="h-20 rounded-lg bg-muted animate-pulse" />
        ) : characters.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3">Chưa có nhân vật trong bộ truyện.</p>
        ) : (
          <div className="max-h-52 overflow-y-auto -mx-1 px-1 space-y-1 pr-1">
            {characters.map((c) => {
              const checked = selectedIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer border transition ${
                    checked ? "border-primary/50 bg-primary/5" : "border-transparent hover:bg-muted/60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(c.id)}
                    className="accent-primary w-4 h-4 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    {c.role && <div className="text-[11px] text-muted-foreground truncate">{c.role}</div>}
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Dàn ý + Gợi ý + Viết */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-xs font-medium mb-1.5 text-muted-foreground">Dàn ý phân cảnh</div>
        <textarea
          value={outline}
          onChange={(e) => setOutline(e.target.value)}
          placeholder="VD: Mở đầu — hai sư huynh đệ trước cửa Linh Tiên Các. Khắc Doanh dò hỏi..."
          rows={6}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
        />
        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground bg-muted/40 rounded-md p-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Yêu cầu văn phong: <b>Bách Hợp Cổ Đại</b>, điền nhã, không dùng từ ngữ hiện đại.</span>
        </div>

        {/* Gợi ý nối tiếp */}
        <button
          onClick={onBrainstorm}
          disabled={brainstorming}
          className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-primary/40 text-primary text-sm font-medium hover:bg-primary/10 disabled:opacity-50 transition"
        >
          {brainstorming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
          {brainstorming ? "AI đang suy hướng kịch bản..." : "💡 AI Gợi Ý Tình Huống Nối Tiếp"}
        </button>

        {suggestions.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] text-muted-foreground">Chọn một hướng — dàn ý sẽ tự điền vào ô trên:</p>
            {suggestions.map((s, i) => (
              <div key={i} className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                <div className="text-xs font-semibold text-primary">
                  {s.key ? `Hướng ${s.key}: ` : ""}
                  {s.title}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-3 whitespace-pre-line">{s.outline}</p>
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

        <button
          onClick={onGenerate}
          disabled={generating || selectedIds.length === 0}
          className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
          {generating ? "Đang viết phân cảnh..." : "🚀 AI Viết Phân Cảnh"}
        </button>
        {selectedIds.length === 0 && (
          <p className="text-[11px] text-muted-foreground mt-1.5">Hãy chọn ít nhất một nhân vật.</p>
        )}
      </div>
    </aside>
  );
}