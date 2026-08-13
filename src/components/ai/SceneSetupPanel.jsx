import React from "react";
import { Users, Rocket, Loader2, Info, PenLine } from "lucide-react";

// Cấp độ 4 — Sáng Tác Phân Cảnh: chọn nhân vật + dàn ý + sinh phân cảnh
export default function SceneSetupPanel({
  characters,
  loadingChars,
  selectedIds,
  setSelectedIds,
  outline,
  setOutline,
  onGenerate,
  generating,
  genre,
}) {
  const toggle = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <aside className="lg:sticky lg:top-16 lg:self-start space-y-4">
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

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <PenLine className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold">Dàn ý phân cảnh</h2>
        </div>
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
          <span>
            Yêu cầu văn phong: <b>{genre || "chưa chọn thể loại"}</b> — đặt/đổi thể loại ở đầu trang Hỗ trợ Sáng Tác AI.
          </span>
        </div>

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