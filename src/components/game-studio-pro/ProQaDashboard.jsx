import React, { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Info, RefreshCw, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SEVERITY_UI = {
  error: { label: "Error", icon: AlertCircle, className: "text-destructive border-destructive/30 bg-destructive/5" },
  warning: { label: "Warning", icon: AlertTriangle, className: "text-amber-700 border-amber-500/30 bg-amber-500/5" },
  info: { label: "Info", icon: Info, className: "text-sky-700 border-sky-500/30 bg-sky-500/5" },
};

export default function ProQaDashboard({ result, episodes, onRerun, onLocate }) {
  const [severity, setSeverity] = useState("all");
  const [episodeId, setEpisodeId] = useState("all");
  const [blockingOnly, setBlockingOnly] = useState(false);
  const episodeById = useMemo(() => Object.fromEntries((episodes || []).map((e) => [e.id, e])), [episodes]);
  const visible = result.issues.filter((issue) => (!blockingOnly || issue.severity === "error") && (severity === "all" || issue.severity === severity) && (episodeId === "all" || issue.episodeId === episodeId));
  const grouped = new Map();
  for (const issue of visible) {
    const key = issue.code;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(issue);
  }
  return (
    <div className="space-y-4">
      <section className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-lg">Kiểm tra game</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Kiểm tra toàn campaign trên máy, không gọi AI và không tự sửa dữ liệu.</p>
          </div>
          <Button size="sm" onClick={onRerun}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Kiểm tra lại</Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(SEVERITY_UI).map(([key, ui]) => <button key={key} type="button" onClick={() => setSeverity(severity === key ? "all" : key)} className={`rounded-xl border p-3 text-left ${ui.className} ${severity === key ? "ring-2 ring-primary/30" : ""}`}><span className="text-2xl font-bold">{result.summary[key]}</span><span className="block text-xs font-semibold">{ui.label}</span></button>)}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={severity} onValueChange={setSeverity}><SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Mọi mức độ</SelectItem><SelectItem value="error">Error</SelectItem><SelectItem value="warning">Warning</SelectItem><SelectItem value="info">Info</SelectItem></SelectContent></Select>
          <Select value={episodeId} onValueChange={setEpisodeId}><SelectTrigger className="w-56 h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Mọi tập</SelectItem>{(episodes || []).map((e) => <SelectItem key={e.id} value={e.id}>Tập {e.order} — {e.title}</SelectItem>)}</SelectContent></Select>
          <Button size="sm" variant={blockingOnly ? "default" : "outline"} onClick={() => setBlockingOnly((v) => !v)}>Chỉ xem lỗi chặn xuất bản</Button>
        </div>
        {result.blocking ? <p className="text-xs text-destructive">Xuất bản đang bị chặn bởi {result.summary.error} lỗi. Bạn vẫn có thể lưu bản soạn và sửa từng cảnh.</p> : <p className="text-xs text-emerald-700">Không có lỗi chặn xuất bản.</p>}
      </section>

      {visible.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Không có kết quả phù hợp bộ lọc.</div> : [...grouped.entries()].map(([code, items]) => (
        <section key={code} className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between"><span className="font-mono text-xs font-semibold">{code}</span><Badge variant="secondary">{items.length}</Badge></div>
          <div className="divide-y divide-border">
            {items.map((issue, index) => {
              const ui = SEVERITY_UI[issue.severity]; const Icon = ui.icon; const ep = episodeById[issue.episodeId];
              return <article key={`${issue.code}-${issue.sceneId}-${issue.choiceId}-${index}`} className="p-4 space-y-2">
                <div className="flex items-start gap-2"><Icon className={`w-4 h-4 mt-0.5 shrink-0 ${ui.className.split(" ")[0]}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-1.5 items-center"><h3 className="font-semibold text-sm">{issue.title}</h3><Badge variant="outline" className="text-[10px]">{ui.label}</Badge>{ep && <Badge variant="secondary" className="text-[10px]">Tập {ep.order} · {ep.title}</Badge>}</div><p className="text-sm mt-1">{issue.message}</p></div></div>
                {issue.whyItMatters && <p className="text-xs text-muted-foreground"><span className="font-semibold">Vì sao nguy hiểm:</span> {issue.whyItMatters}</p>}
                {issue.suggestedFix && <p className="text-xs text-muted-foreground"><span className="font-semibold">Gợi ý sửa:</span> {issue.suggestedFix}</p>}
                {issue.episodeId && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onLocate(issue)}><MapPin className="w-3 h-3 mr-1" /> {issue.sceneId ? "Mở đúng cảnh" : "Mở tập"}</Button>}
              </article>;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
