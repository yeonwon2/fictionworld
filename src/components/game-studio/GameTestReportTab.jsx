import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, AlertOctagon, AlertTriangle, AlertCircle, Info, Loader2, PlayCircle, Sparkles, Copy, Pencil, CheckCircle2, Wrench, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { buildGameTestReport, getNarrativeCheckCandidates, endingTextFor, formatReproPath } from "@/lib/gameStudio/gameTestReport";
import { runNarrativeAiChecks } from "@/lib/gameStudio/narrativeAiTester";
import { computeBalanceFixOptions } from "@/lib/gameStudio/balanceFixer";
import { removeOrphanGrant } from "@/lib/gameStudio/orphanFixer";
import { findingLocations } from "@/lib/gameStudio/qaLocations";
import { choiceLabel, sceneLabel } from "@/lib/gameStudio/mindMap";
import NodeEditorDrawer from "@/components/game-studio/NodeEditorDrawer";

// Kiểm tra trạng thái và logic chơi, bổ sung cho Sơ Đồ Tư Duy —
// không import/sửa gì từ file đó để không ảnh hưởng tính năng đang chạy tốt.
// Chỉ đọc gameData.nodes/meta (Canonical Script Model) qua gameTestReport.js.

const SEVERITY_META = {
  critical: { icon: AlertOctagon, color: "text-red-500", bg: "bg-red-500/10", label: "Critical" },
  high: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10", label: "High" },
  medium: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-500/10", label: "Medium" },
  low: { icon: Info, color: "text-slate-400", bg: "bg-slate-500/10", label: "Low" },
};
const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

function ReproPath({ path }) {
  const { toast } = useToast();
  if (!path) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(path); toast({ title: "Đã sao chép đường tái hiện" }); } catch { /* ignore */ }
      }}
      title="Sao chép đường tái hiện"
      className="mt-1 flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground bg-muted/50 rounded px-1.5 py-0.5 max-w-full overflow-x-auto"
    >
      <Copy size={10} className="shrink-0" /> <span className="truncate">{path}</span>
    </button>
  );
}

// Diff 1 dòng: giá trị cũ (gạch ngang, đỏ) → giá trị mới (xanh) — cùng quy ước
// màu với AiFixReview.jsx (không import file đó, chỉ dùng chung màu sắc).
function EditPreviewRow({ edit }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] py-0.5">
      {edit.sceneId && <span className="text-muted-foreground shrink-0">[{edit.sceneId}]</span>}
      <span className="truncate flex-1 text-muted-foreground">{edit.choiceText}</span>
      <span className="line-through text-red-600/80 dark:text-red-400/80 shrink-0">{edit.current}</span>
      <span className="shrink-0">→</span>
      <span className="text-emerald-600 dark:text-emerald-400 font-medium shrink-0">{edit.next}</span>
    </div>
  );
}

function BalanceFixPanel({ finding, gameData, setGameData }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const result = useMemo(() => computeBalanceFixOptions(gameData, finding), [gameData, finding]);
  if (!result) return null;

  const apply = (option) => {
    if (!option.apply) { toast({ title: "Đã ghi nhận", description: "Không thay đổi gì — coi đây là độ khó cố ý." }); setOpen(false); return; }
    setGameData(option.apply(gameData));
    toast({ title: "Đã áp dụng phương án sửa", description: "Bấm lại \"Chạy Mô Phỏng\" ở trên để xác nhận đã hết vấn đề." });
    setOpen(false);
  };

  return (
    <div className="mt-1.5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
        <Wrench size={11} /> {result.options.length} phương án sửa cụ thể cho "{result.statLabel}" {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <div className="mt-1.5 space-y-2 rounded-lg border border-border/70 bg-background/60 p-2">
          {result.options.map((option) => (
            <div key={option.id} className="rounded-md border border-border/60 p-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium flex-1">{option.label}</span>
                <Button size="sm" variant={option.id === "keep" ? "ghost" : "default"} className="h-6 text-[10px] px-2 shrink-0" onClick={() => apply(option)}>
                  {option.id === "keep" ? "Ghi nhận" : "Áp dụng"}
                </Button>
              </div>
              {option.preview.length > 0 && (
                <div className="pl-1 border-l-2 border-border/60">
                  {option.preview.slice(0, 6).map((edit, i) => <EditPreviewRow key={i} edit={edit} />)}
                  {option.preview.length > 6 && <div className="text-[10px] text-muted-foreground pl-1">… và {option.preview.length - 6} dòng khác</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrphanDeleteButton({ orphan, gameData, setGameData }) {
  const { toast } = useToast();
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-6 text-[10px] px-1.5 shrink-0 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10"
      title={`Xoá mọi nơi đang cấp "${orphan.name}" — an toàn vì không lựa chọn nào đang cần tới nó`}
      onClick={() => {
        setGameData(removeOrphanGrant(gameData, orphan));
        toast({ title: `Đã xoá "${orphan.name}"`, description: "Đã bỏ khỏi mọi cảnh đang cấp — bấm lại \"Chạy Mô Phỏng\" để xác nhận." });
      }}
    >
      <Trash2 size={10} className="mr-1" /> Xoá
    </Button>
  );
}

function FindingRow({ finding, onEditScene, gameData, setGameData, onLocateFinding = null, stale = false }) {
  const meta = SEVERITY_META[finding.severity] || SEVERITY_META.low;
  const Icon = meta.icon;
  const sceneId = finding.sceneIds?.[0];
  const locations = onLocateFinding ? findingLocations(finding, gameData.nodes || {}) : [];
  return (
    <div className={`flex items-start gap-2 text-xs rounded-lg border border-border p-2.5 ${meta.bg}`}>
      <Icon size={14} className={`${meta.color} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-background/60 border border-border/60">{finding.category}</span>
          {onLocateFinding && locations.length ? <button type="button" disabled={stale} className="text-left leading-relaxed underline decoration-dotted underline-offset-4 hover:text-primary disabled:opacity-50" onClick={() => onLocateFinding(finding, locations[0])}>{finding.message}</button> : <span className="leading-relaxed">{finding.message}</span>}
        </div>
        {onLocateFinding && <div className="flex flex-wrap gap-1">{locations.length ? locations.map((location) => <button key={location.key} type="button" disabled={stale} className="rounded border px-2 py-1 text-primary hover:bg-accent disabled:opacity-50" onClick={() => onLocateFinding(finding, location)}>Xem {sceneLabel(location.sceneId, gameData.nodes[location.sceneId])}{location.choiceIndex != null ? ` · ${choiceLabel(location.choiceIndex)}` : ''}</button>) : <span className="text-muted-foreground">Vấn đề tổng thể — chưa xác định được ô cụ thể.</span>}</div>}
        {finding.reproPath && <ReproPath path={finding.reproPath} />}
        {!stale && finding.category === "balance" && <BalanceFixPanel finding={finding} gameData={gameData} setGameData={setGameData} />}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {!onLocateFinding && sceneId && (
          <Button size="sm" variant="outline" className="h-6 text-[10px] px-1.5" onClick={() => onEditScene(sceneId)}>
            <Pencil size={10} className="mr-1" /> Sửa cảnh
          </Button>
        )}
        {!stale && finding.orphan && <OrphanDeleteButton orphan={finding.orphan} gameData={gameData} setGameData={setGameData} />}
      </div>
    </div>
  );
}

export default function GameTestReportTab({ gameData, setGameData, onLocateFinding = null }) {
  const { toast } = useToast();
  const [report, setReport] = useState(null);
  const [reportSource, setReportSource] = useState(null);
  const simulationTimer = useRef(null);
  useEffect(() => () => clearTimeout(simulationTimer.current), []);
  const stale = !!report && (reportSource?.nodes !== gameData.nodes || reportSource?.meta !== gameData.meta);
  const [running, setRunning] = useState(false);
  const [runsPerPersona, setRunsPerPersona] = useState(1000);
  const [aiCandidates, setAiCandidates] = useState([]);
  const [aiFindings, setAiFindings] = useState([]);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiProgress, setAiProgress] = useState(null);
  const [aiSampleSize, setAiSampleSize] = useState(6);
  const [editingId, setEditingId] = useState(null);

  const runSimulation = () => {
    setRunning(true);
    setReport(null);
    setAiFindings([]);
    setAiCandidates([]);
    // setTimeout 0 để UI kịp vẽ spinner trước khi mô phỏng (đồng bộ, có thể mất
    // 1-2s với kịch bản lớn + số lượt cao) chiếm luồng chính.
    simulationTimer.current = setTimeout(() => {
      try {
        const r = buildGameTestReport(gameData, { runsPerPersona });
        if (r.error) {
          toast({ variant: "destructive", title: "Không đọc được dữ liệu game", description: r.error });
          setReport(null);
        } else {
          setReportSource(gameData);
          setReport(r);
        }
      } catch (e) {
        toast({ variant: "destructive", title: "Lỗi khi chạy kiểm tra", description: e?.message || "Thử lại." });
      } finally {
        setRunning(false);
      }
    }, 30);
  };

  const runAiCheck = async () => {
    if (!report || stale) return;
    const candidates = getNarrativeCheckCandidates(report, { max: aiSampleSize });
    if (!candidates.length) { toast({ title: "Không có tuyến nào để kiểm tra" }); return; }
    setAiCandidates(candidates);
    setAiRunning(true);
    setAiProgress({ done: 0, total: candidates.length });
    try {
      const findings = await runNarrativeAiChecks(candidates, {
        endingTextOf: (route) => endingTextFor(report, route),
        onProgress: (done, total) => setAiProgress({ done, total }),
      });
      setAiFindings(findings);
      toast({ title: `AI đã kiểm tra ${candidates.length} tuyến`, description: findings.length ? `Tìm thấy ${findings.length} vấn đề tường thuật.` : "Không thấy mâu thuẫn tường thuật nào." });
    } catch (e) {
      toast({ variant: "destructive", title: "Lỗi kiểm tra AI", description: e?.message || "Thử lại." });
    } finally {
      setAiRunning(false);
    }
  };

  const editingNode = editingId ? gameData?.nodes?.[editingId] : null;
  const updateNode = (id, patch) => {
    const nodes = gameData.nodes || {};
    setGameData({ ...gameData, nodes: { ...nodes, [id]: { ...nodes[id], ...patch } } });
  };

  const aiFindingRows = aiFindings.map((f) => {
    const candidate = aiCandidates.find((c) => c.id === f.routeId);
    return {
      severity: f.severity,
      category: "narrative_ai",
      message: f.message,
      reproPath: candidate ? formatReproPath(candidate.steps) : null,
      sceneIds: f.sceneId ? [f.sceneId] : [],
    };
  });

  const allFindings = report ? [...report.findings, ...aiFindingRows] : [];
  const groupedFindings = SEVERITY_ORDER.map((sev) => ({ sev, items: allFindings.filter((f) => f.severity === sev) })).filter((g) => g.items.length);

  return (
    <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-sm flex items-center gap-2"><FlaskConical size={15} /> {onLocateFinding ? "QA Kịch Bản Trên Sơ Đồ" : "Kiểm Tra Toàn Diện"}</h3>
        <span className="text-[11px] text-muted-foreground">3 tầng: quét cấu trúc, mô phỏng nhiều tính cách bot, AI đọc tuyến — không đụng tới dữ liệu game, chỉ đọc.</span>
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        <div className="space-y-1">
          <Label className="text-[11px]">Số lượt mô phỏng / persona</Label>
          <Input type="number" min={100} max={10000} step={100} value={runsPerPersona} onChange={(e) => setRunsPerPersona(Math.max(100, Math.min(10000, Number(e.target.value) || 1000)))} className="h-8 w-28 text-xs" />
        </div>
        <Button onClick={runSimulation} disabled={running || aiRunning} className="h-8">
          {running ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <PlayCircle size={14} className="mr-1.5" />}
          {running ? "Đang chạy..." : "Chạy Mô Phỏng (Tầng 1+2, miễn phí)"}
        </Button>
      </div>

      {stale && <p role="status" className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">Sơ đồ đã thay đổi. Kết quả bên dưới là của bản cũ; chạy lại QA để cập nhật lỗi và vị trí.</p>}
      {report && (
        <>
          <div className="space-y-3">
            {groupedFindings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Không có vấn đề nào được phát hiện. 🎉</p>
            ) : groupedFindings.map(({ sev, items }) => (
              <div key={sev} className="space-y-1.5">
                <h4 className="text-xs font-semibold">{SEVERITY_META[sev].label} ({items.length})</h4>
                {items.map((f, i) => <FindingRow key={i} finding={f} onEditScene={setEditingId} gameData={gameData} setGameData={setGameData} onLocateFinding={onLocateFinding} stale={stale} />)}
              </div>
            ))}
          </div>
          {onLocateFinding && <p className="text-xs text-muted-foreground">QA chỉ mô phỏng trên bản sao, không tự sửa sơ đồ. Các “cảnh tạm” và số liệu mô phỏng có thể khác sơ đồ gốc; nút xem lỗi luôn dẫn về ô gốc để bạn kiểm tra.</p>}
          <div className="flex flex-wrap gap-2 text-xs">
            {SEVERITY_ORDER.map((sev) => (
              <Badge key={sev} variant={sev === "critical" ? "destructive" : "secondary"}>{SEVERITY_META[sev].label}: {report.summary[sev]}</Badge>
            ))}
            <Badge variant="outline">Coverage cảnh: {report.coverage.scenePercent}% ({report.coverage.scenesReached}/{report.coverage.scenesTotal})</Badge>
            <Badge variant="outline">Coverage lựa chọn: {report.coverage.choicePercent}% ({report.coverage.choicesReached}/{report.coverage.choicesTotal})</Badge>
            <Badge variant="outline">Kết thúc: {report.endings.reachedInSample}/{report.endings.total} đạt được trong mẫu</Badge>
          </div>

          {!stale && report.summary.critical === 0 && report.summary.high === 0 && (
            <div className="text-[11px] rounded-lg p-2.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-semibold">
              <CheckCircle2 size={12} /> Không có lỗi Critical/High nào từ quét cấu trúc + mô phỏng.
            </div>
          )}

          <div className="rounded-xl border border-border p-3 space-y-1.5">
            <div className="text-xs font-semibold">Xác suất theo persona đạt từng kết thúc</div>
            <div className="overflow-x-auto">
              <table className="text-[11px] w-full min-w-[420px]">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="pr-2 py-1">Persona</th>
                    <th className="pr-2">Chết (chỉ số sinh tử)</th>
                    <th className="pr-2">Kẹt cứng</th>
                    <th className="pr-2">Độ sâu TB</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.persona.personas).map(([id, p]) => (
                    <tr key={id} className="border-t border-border/60">
                      <td className="pr-2 py-1 font-medium">{p.label}</td>
                      <td className="pr-2">{Math.round(p.deathRate * 100)}%</td>
                      <td className="pr-2">{Math.round(p.deadlockRate * 100)}%</td>
                      <td className="pr-2">{p.avgDepth.toFixed(1)} / {report.persona.totalScenes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-primary/40 p-3 space-y-2">
            <div className="text-xs font-semibold flex items-center gap-1.5"><Sparkles size={13} /> Tầng 3 — AI Kiểm Tra Tường Thuật</div>
            <p className="text-[11px] text-muted-foreground">Đọc riêng từng tuyến như người chơi thật, bắt lỗi kiểu "nhân vật nhắc quan hệ/sự kiện chưa từng xảy ra ở tuyến này". <strong>Tốn lượt gọi AI của bạn</strong> — chọn số tuyến trước khi chạy.</p>
            <div className="flex items-end gap-2 flex-wrap">
              <div className="space-y-1">
                <Label className="text-[11px]">Số tuyến kiểm tra (tốn {aiSampleSize} lượt gọi AI)</Label>
                <Input type="number" min={1} max={15} value={aiSampleSize} onChange={(e) => setAiSampleSize(Math.max(1, Math.min(15, Number(e.target.value) || 6)))} className="h-8 w-24 text-xs" />
              </div>
              <Button onClick={runAiCheck} disabled={aiRunning || running || stale} variant="outline" className="h-8">
                {aiRunning ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Sparkles size={14} className="mr-1.5" />}
                {aiRunning ? `Đang kiểm tra ${aiProgress ? `${aiProgress.done}/${aiProgress.total}` : "..."}` : "Chạy AI Kiểm Tra"}
              </Button>
            </div>
          </div>


        </>
      )}

      <NodeEditorDrawer
        node={editingNode}
        allNodes={gameData?.nodes || {}}
        statsConfig={gameData?.meta?.statsConfig || []}
        archetype={gameData?.meta?.archetype}
        defaultNpcAvatar={gameData?.meta?.defaultNpcAvatar}
        open={!!editingNode}
        onClose={() => setEditingId(null)}
        onChange={(patch) => updateNode(editingId, patch)}
      />
    </section>
  );
}
