import React, { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import { getChapter, listChapters } from "@/lib/worldcrud";
import { buildNovelHealthPrompt, NOVEL_HEALTH_SCHEMA } from "@/lib/writingFactory/prompts";
import { compactBibleContext } from "@/lib/writingFactory/workflow";

export default function NovelHealthPanel({ currentStoryId, genre, docsByKey }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bibleText = useMemo(() => compactBibleContext(docsByKey, 100000), [docsByKey]);
  const storageKey = `fw_novel_health_${currentStoryId}`;

  useEffect(() => {
    try { setReport(JSON.parse(localStorage.getItem(storageKey) || "null")); } catch { setReport(null); }
  }, [storageKey]);

  const analyze = async () => {
    setLoading(true); setError("");
    try {
      const lite = await listChapters(currentStoryId);
      const full = (await Promise.all((lite || []).map(async (c) => {
        try { return await getChapter(c.id); } catch { return null; }
      }))).filter(Boolean);
      const res = await aiCall(buildNovelHealthPrompt({ genre, bibleText, chapters: full }), { jsonSchema: NOVEL_HEALTH_SCHEMA });
      setReport(res);
      try { localStorage.setItem(storageKey, JSON.stringify({ ...res, analyzed_at: new Date().toISOString(), chapter_count: full.length })); } catch { /* storage optional */ }
    } catch (e) { setError("Kiểm định toàn truyện lỗi: " + (e?.message || "lỗi")); }
    finally { setLoading(false); }
  };

  return <div className="space-y-4">
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /><h2 className="font-display font-semibold">Novel Health · Kiểm định toàn truyện</h2>
        <button onClick={analyze} disabled={loading} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-50">{loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Chạy kiểm định</button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">Rà Story Promise và các tuyến plot, nhân vật, quan hệ, knowledge/mystery, phục bút, timeline, pacing, lặp và bloat trên toàn bộ chương.</p>
      {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
    </div>
    {report && <>
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4">
        <div className={`text-3xl font-bold ${report.health_score >= 75 ? "text-emerald-600" : report.health_score >= 55 ? "text-amber-600" : "text-destructive"}`}>{Math.round(report.health_score || 0)}</div>
        <div><div className="text-sm font-semibold">Điểm sức khỏe / 100</div><div className="text-xs text-muted-foreground">{report.summary}</div></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">{(report.trackers || []).map((t) => <div key={t.key} className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">{t.status === "good" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className={`w-4 h-4 ${t.status === "critical" ? "text-destructive" : "text-amber-600"}`} />}<b className="text-xs">{t.label}</b><span className="ml-auto text-xs font-bold">{Math.round(t.score || 0)}</span></div>
        <div className="mt-2 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, t.score || 0))}%` }} /></div>
        {(t.evidence || []).slice(0, 2).map((e, i) => <div key={i} className="mt-1 text-[10px] text-muted-foreground">• {e}</div>)}
        <div className="mt-2 text-[11px]"><b>Tiếp theo:</b> {t.next_action}</div>
      </div>)}</div>
      {(report.priorities || []).length > 0 && <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4"><h3 className="text-sm font-semibold">Ưu tiên cho 3–10 chương tới</h3>{report.priorities.map((p, i) => <div key={i} className="text-xs mt-1">{i + 1}. {p}</div>)}</div>}
      {(report.regressions || []).length > 0 && <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4"><h3 className="text-sm font-semibold text-destructive">Regression gần đây</h3>{report.regressions.map((p, i) => <div key={i} className="text-xs mt-1">• {p}</div>)}</div>}
    </>}
  </div>;
}
