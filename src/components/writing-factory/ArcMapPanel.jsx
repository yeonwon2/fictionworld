import React, { useCallback, useEffect, useState } from "react";
import { Map, Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import { listChapters } from "@/lib/worldcrud";
import { buildArcMapPrompt, ARC_MAP_SCHEMA } from "@/lib/writingFactory/prompts";

// Bản đồ Arc & tiến độ — phân tích 04_DAI_CUONG thành các arc, đối chiếu với số
// chương đã viết để hiển thị tiến độ và cảnh báo lạc đề.
export default function ArcMapPanel({ currentStoryId, genre, docsByKey }) {
  const [arcs, setArcs] = useState(null);
  const [warnings, setWarnings] = useState([]);
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
        buildArcMapPrompt({ genre, daiCuong: docsByKey?.dai_cuong?.content || "", chapters: list }),
        { jsonSchema: ARC_MAP_SCHEMA }
      );
      setArcs(res?.arcs || []);
      setWarnings(res?.warnings || []);
    } catch (e) {
      setError("Vẽ bản đồ arc lỗi: " + (e?.message || "lỗi"));
    } finally {
      setLoading(false);
    }
  }, [currentStoryId, genre, docsByKey]);

  useEffect(() => {
    if (docsByKey?.dai_cuong?.content?.trim()) analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoryId]);

  const noDaiCuong = !docsByKey?.dai_cuong?.content?.trim();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold">Bản Đồ Arc & Tiến Độ</h2>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {maxChapter ? `Đã viết ${maxChapter} chương` : "Chưa có chương nào"}
          </span>
          <button
            onClick={analyze}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/40 text-primary text-xs hover:bg-primary/10 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {loading ? "Đang phân tích..." : "Phân tích lại"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Đọc tài liệu <b>04_DAI_CUONG</b>, vẽ từng arc với phạm vi chương + mục tiêu, đối chiếu với chương đã viết
          để biết truyện đang đi tới đâu và có lạc đề không.
        </p>
      </div>

      {noDaiCuong && !loading && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Chưa có tài liệu <b>04_DAI_CUONG</b>. Hãy khởi tạo Xưởng hoặc soạn đại cương trong tab Bộ Tài Liệu trước.
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> AI đang đọc đại cương và vẽ bản đồ arc...
        </div>
      )}

      {arcs && !loading && (
        <>
          {arcs.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Không tìm thấy arc nào trong đại cương.
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {arcs.map((a, i) => {
              const written = maxChapter;
              const inRange = (written >= a.start_chapter && written <= a.end_chapter) || (written >= a.start_chapter && !a.end_chapter);
              const done = a.end_chapter && written >= a.end_chapter;
              const notStarted = written < a.start_chapter;
              const total = a.end_chapter ? a.end_chapter - a.start_chapter + 1 : null;
              const progressed = total ? Math.max(0, Math.min(total, written - a.start_chapter + 1)) : null;
              const pct = total ? Math.round((progressed / total) * 100) : null;
              return (
                <div key={i} className="rounded-xl border border-border bg-card p-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Arc {i + 1}</span>
                    <h3 className="font-display font-semibold text-sm">{a.name}</h3>
                    <span
                      className={`ml-auto inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 ${
                        done ? "bg-emerald-500/10 text-emerald-600" : inRange ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {done ? "Hoàn tất" : inRange ? "Đang viết" : notStarted ? "Chưa bắt đầu" : "Sắp tới"}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Chương {a.start_chapter}{a.end_chapter ? ` → ${a.end_chapter}` : "+"}
                  </div>
                  <p className="text-xs mt-1.5 line-clamp-3">{a.goal}</p>
                  {total && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Tiến độ</span>
                        <span>{progressed}/{total} chương ({pct}%)</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                  {a.progress_note ? (
                    <p className="text-[10px] text-muted-foreground mt-1.5 italic">{a.progress_note}</p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {(warnings || []).length > 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="font-display font-semibold text-sm text-amber-700 dark:text-amber-400">Cảnh báo lạc đề</h3>
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {warnings.map((w, i) => (
                  <li key={i} className="text-amber-700 dark:text-amber-400">• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {arcs.length > 0 && warnings.length === 0 && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Không phát hiện chương lạc đề khỏi các arc.
            </div>
          )}
        </>
      )}
    </div>
  );
}