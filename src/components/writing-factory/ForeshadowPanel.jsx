import React, { useCallback, useEffect, useState } from "react";
import { Flag, Loader2, RefreshCw, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import { listChapters } from "@/lib/worldcrud";
import { buildForeshadowParsePrompt, FORESHADOW_PARSE_SCHEMA } from "@/lib/writingFactory/prompts";

const STATUS_LABEL = {
  "chưa cài": { text: "Chưa cài", cls: "bg-muted text-muted-foreground" },
  "đã cài": { text: "Đã cài", cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  "đang treo": { text: "Đang treo", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  "đã hồi đáp": { text: "Đã hồi đáp", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
};

// Sổ phục bút có cảnh báo — đọc 05_FUC_BUT, chuẩn hoá trạng thái, cảnh báo phục bút
// "đang treo" quá lâu so với số chương đã viết để nhắc hồi đáp đúng lúc.
export default function ForeshadowPanel({ currentStoryId, genre, docsByKey }) {
  const [items, setItems] = useState(null);
  const [maxChapter, setMaxChapter] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyze = useCallback(async () => {
    if (!currentStoryId) return;
    setLoading(true);
    setError("");
    try {
      const list = (await listChapters(currentStoryId)) || [];
      const max = list.reduce((m, c) => Math.max(m, Number(c.chapter_number) || 0), 0);
      setMaxChapter(max);
      const res = await aiCall(
        buildForeshadowParsePrompt({ genre, fucBut: docsByKey?.fuc_but?.content || "", chapters: list }),
        { jsonSchema: FORESHADOW_PARSE_SCHEMA }
      );
      setItems(res?.items || []);
    } catch (e) {
      setError("Đọc sổ phục bút lỗi: " + (e?.message || "lỗi"));
    } finally {
      setLoading(false);
    }
  }, [currentStoryId, genre, docsByKey]);

  useEffect(() => {
    if (docsByKey?.fuc_but?.content?.trim()) analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoryId]);

  const noDoc = !docsByKey?.fuc_but?.content?.trim();
  const hanging = (items || []).filter((i) => (i.status || "").toLowerCase().includes("treo"));
  const overdue = hanging.filter((i) => i.resolve_by_chapter && maxChapter >= i.resolve_by_chapter);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold">Sổ Phục Bút (伏笔) & Cảnh Báo</h2>
          <div className="ml-auto flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-500/10 rounded-full px-2 py-0.5">
              <Clock className="w-3 h-3" /> {hanging.length} đang treo
            </span>
            <span className="inline-flex items-center gap-1 text-destructive bg-destructive/10 rounded-full px-2 py-0.5">
              <AlertTriangle className="w-3 h-3" /> {overdue.length} đến lúc hồi đáp
            </span>
          </div>
          <button
            onClick={analyze}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/40 text-primary text-xs hover:bg-primary/10 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {loading ? "Đang đọc..." : "Phân tích lại"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Đọc tài liệu <b>05_FUC_BUT</b>, chuẩn hoá trạng thái từng phục bút. Phục bút <b>đang treo</b> vượt quá chương
          dự kiến hồi đáp sẽ được đánh dấu <span className="text-destructive">đến lúc hồi đáp</span> — độc giả web-novel
          rất ghét phục bút bỏ quên.
        </p>
      </div>

      {noDoc && !loading && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Chưa có tài liệu <b>05_FUC_BUT</b>. Hãy khởi tạo Xưởng hoặc soạn sổ phục bút trong tab Bộ Tài Liệu.
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> AI đang đọc sổ phục bút...
        </div>
      )}

      {overdue.length > 0 && !loading && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h3 className="font-display font-semibold text-sm text-destructive">
              {overdue.length} phục bút đang treo QUÁ LÂU — nên hồi đáp trong vài chương tới
            </h3>
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {overdue.map((o, i) => (
              <li key={i} className="text-destructive">
                • <b>{o.name}</b>
                {o.resolve_by_chapter ? ` — dự kiến hồi đáp ở chương ${o.resolve_by_chapter}, đã viết tới chương ${maxChapter}` : ""}
                {o.description ? `: ${o.description}` : ""}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground mt-2">
            Gợi ý: viết chương sau hãy hồi đáp phục bút này — hoặc chèn vào mục tiêu chương để AI xử lý. Sau khi hồi đáp,
            cập nhật trạng thái trong 05_FUC_BUT qua rollup.
          </p>
        </div>
      )}

      {items && !loading && (
        <>
          {items.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Sổ phục bút trống — chưa có phục bút nào được ghi nhận.
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {items.map((it, i) => {
              const st = STATUS_LABEL[String(it.status || "").toLowerCase().trim()] || STATUS_LABEL["đang treo"];
              const isOverdue = (it.status || "").toLowerCase().includes("treo") && it.resolve_by_chapter && maxChapter >= it.resolve_by_chapter;
              return (
                <div key={i} className={`rounded-xl border bg-card p-3.5 ${isOverdue ? "border-destructive/40" : "border-border"}`}>
                  <div className="flex items-center gap-2">
                    <Flag className="w-3.5 h-3.5 text-primary shrink-0" />
                    <h3 className="font-display font-semibold text-sm truncate">{it.name}</h3>
                    <span className={`ml-auto inline-flex items-center text-[10px] rounded-full px-2 py-0.5 ${st.cls}`}>
                      {st.text}
                    </span>
                  </div>
                  {it.description ? (
                    <p className="text-xs text-foreground/80 mt-1.5 line-clamp-3">{it.description}</p>
                  ) : null}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-2">
                    {it.planted_chapter ? <span>Cài: ch.{it.planted_chapter}</span> : null}
                    {it.resolve_by_chapter ? <span>Hồi đáp: ch.{it.resolve_by_chapter}</span> : null}
                    {isOverdue && (
                      <span className="text-destructive font-semibold">QUÁ HẠN</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {items.length > 0 && overdue.length === 0 && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Không có phục bút nào treo quá lâu.
            </div>
          )}
        </>
      )}
    </div>
  );
}