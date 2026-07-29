import React from "react";
import { History, RotateCcw, Trash2 } from "lucide-react";

// Lịch sử phiên bản dàn ý — xem lại / khôi phục / xoá.
export default function OutlineVersionHistory({ history, onRestore, onClear, open, onOpenChange }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <button
        onClick={() => onOpenChange?.(!open)}
        className="flex items-center gap-2 w-full text-left"
      >
        <History className="w-4 h-4 text-primary" />
        <span className="font-display font-semibold text-sm flex-1">
          Lịch sử phiên bản dàn ý ({history.length})
        </span>
        <span className="text-[11px] text-muted-foreground">{open ? "Ẩn" : "Xem"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Chưa có bản cũ. Mỗi lần "Sinh lại toàn bộ" sẽ tự lưu bản trước vào đây.
            </p>
          ) : (
            history.map((h, i) => (
              <div key={i} className="rounded-lg border border-border p-2.5 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium">{h.label}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(h.ts).toLocaleString("vi-VN")} · {h.arc?.chapters?.length || 0} chương
                  </div>
                </div>
                <button
                  onClick={() => onRestore?.(i)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-primary/50 text-primary text-[11px] hover:bg-primary/10"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Khôi phục
                </button>
              </div>
            ))
          )}
          {history.length > 0 && (
            <button
              onClick={onClear}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" /> Xoá toàn bộ lịch sử
            </button>
          )}
        </div>
      )}
    </div>
  );
}