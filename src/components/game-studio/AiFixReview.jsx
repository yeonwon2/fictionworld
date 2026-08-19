import React from "react";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles } from "lucide-react";
import { diffLines } from "@/lib/gameStudio/lineDiff";
import { cn } from "@/lib/utils";

/**
 * Xem trước kết quả AI sửa kịch bản TRƯỚC khi ghi đè ô kịch bản của người
 * dùng — hiện diff dòng-theo-dòng (đỏ = bỏ, xanh = thêm) + giải thích ngắn AI
 * đã sửa gì, để người viết chủ động Áp dụng hoặc Huỷ thay vì bị thay nguyên
 * văn bản một cách âm thầm.
 *
 * @param {Object} p
 * @param {string} p.before - kịch bản trước khi sửa.
 * @param {string} p.after - kịch bản sau khi AI sửa.
 * @param {string[]} p.explanations - giải thích ngắn từng lỗi đã sửa.
 * @param {boolean} p.stillHasErrors - còn lỗi khác (ngoài phạm vi đã chọn) chưa sạch.
 * @param {() => void} p.onApply
 * @param {() => void} p.onDiscard
 */
export default function AiFixReview({ before, after, explanations, stillHasErrors, onApply, onDiscard }) {
  const unchanged = before === after;
  const diff = React.useMemo(() => diffLines(before, after), [before, after]);
  const changedCount = diff.filter((d) => d.type !== "same").length;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Sparkles size={14} />
          {unchanged ? "AI không đổi gì (không tìm được cách sửa an toàn)" : `Xem trước thay đổi (${changedCount} dòng khác biệt) — chưa áp dụng vào kịch bản`}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={onDiscard} className="h-7 px-2 text-[11px]">
            <X size={12} className="mr-1" /> Huỷ
          </Button>
          <Button size="sm" onClick={onApply} disabled={unchanged} className="h-7 px-2 text-[11px]">
            <Check size={12} className="mr-1" /> Áp dụng vào kịch bản
          </Button>
        </div>
      </div>

      {!unchanged && (
        <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-background/60 font-mono text-[11px] leading-relaxed">
          {diff.map((d, i) => (
            <div
              key={i}
              className={cn(
                "px-2 whitespace-pre-wrap break-words",
                d.type === "add" && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
                d.type === "remove" && "bg-red-500/15 text-red-800 dark:text-red-300 line-through decoration-1",
                d.type === "same" && "text-muted-foreground/70"
              )}
            >
              {d.type === "add" ? "+ " : d.type === "remove" ? "- " : "  "}{d.line || " "}
            </div>
          ))}
        </div>
      )}

      {explanations?.length > 0 && (
        <div className="text-[11px] space-y-1">
          <div className="font-semibold text-muted-foreground">AI đã sửa:</div>
          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
            {explanations.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {stillHasErrors && (
        <div className="text-[11px] text-amber-700 dark:text-amber-400">
          Vẫn còn lỗi khác chưa nằm trong lần sửa này — sau khi Áp dụng, bấm Kiểm Tra hoặc Sửa lỗi bằng AI lại để xử lý tiếp.
        </div>
      )}
    </div>
  );
}
