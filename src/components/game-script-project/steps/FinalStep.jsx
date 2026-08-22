import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Copy, FileText, Loader2, Sparkles, Wand2 } from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import { buildSceneScriptPrompt, extractItemsAndFlags } from "@/lib/gameScriptProject/prompts";
import { WORKSHOPS, buildSyntaxBlock } from "@/lib/gameScriptProject/syntaxGuide";
import { realParseCheck, parserForWorkshop } from "@/lib/gameScriptProject/parserBridge";
import { verifyAndFixScript } from "@/lib/gameStudio/fixScriptWithAI";
import { getGamePlanMeta, listGamePlanBranches, listGamePlanSceneContent, listGamePlanScenes, upsertGamePlanSceneContent } from "@/lib/worldcrud";

// Ghép MỘT kịch bản duy nhất chứa toàn bộ cảnh và nhánh để copy sang Xưởng Game.
export default function FinalStep({ project, patchProject, onBack }) {
  const [meta, setMeta] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [branches, setBranches] = useState([]);
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [fixedScript, setFixedScript] = useState(""); // bản đã qua "Tự động sửa bằng AI" (chỉ giữ ở state, không lưu DB)
  const [fixing, setFixing] = useState(false);
  const [fixExplanations, setFixExplanations] = useState([]);
  const workshop = WORKSHOPS[project.workshop] || WORKSHOPS.studio;

  const load = async () => {
    setLoading(true);
    try {
      const [m, s, b] = await Promise.all([getGamePlanMeta(project.id), listGamePlanScenes(project.id), listGamePlanBranches(project.id)]);
      const all = [];
      for (const branch of b || []) {
        const rows = (await listGamePlanSceneContent(project.id, branch.id)) || [];
        all.push(...rows.map((row) => ({ ...row, branchId: branch.id })));
      }
      setMeta(m);
      setScenes((s || []).slice().sort((a, b2) => a.scene_order - b2.scene_order));
      setBranches(b || []);
      setContents(all);
    } catch (e) { setError("Không tải được dữ liệu: " + (e?.message || "lỗi")); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [project.id]);

  const branchForScene = (scene) => branches.find((b) => Number(b.branch_index) === Number(scene.branch_index)) || branches[0];
  const scriptByScene = useMemo(() => {
    const map = new Map();
    for (const row of contents) if (row.script?.trim() && !map.has(row.scene_id)) map.set(row.scene_id, row.script.trim());
    return map;
  }, [contents]);

  const planBlock = () => [
    project.idea?.trim() ? `## Ý tưởng nguồn\n${project.idea.trim().slice(0, 6000)}` : "",
    meta?.characters?.length ? `## Nhân vật\n${meta.characters.map((c) => `- ${c.name}: ${c.personality || ""}`).join("\n")}` : "",
    meta?.endings?.length ? `## Kết thúc\n${meta.endings.map((e) => `- ${e.name} [${e.type || "NORMAL_END"}]: ${e.description || ""}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");

  const fullScript = useMemo(() => {
    const blocks = scenes.map((s) => scriptByScene.get(s.id)).filter(Boolean);
    const hasTitle = blocks[0]?.trimStart().startsWith("# ");
    const header = `# ${project.title || "Kịch bản game"}\n**Thể loại:** ${project.genre || "Tương tác nhiều nhánh"}`;
    return `${hasTitle ? "" : header + "\n\n"}${blocks.join("\n\n")}`.trim();
  }, [project.genre, project.title, scenes, scriptByScene]);

  // Sau khi "Ghép lại" lần mới, bản đã tự sửa cũ không còn khớp nữa — bỏ đi để
  // không hiển thị/copy nhầm bản cũ chồng lên kịch bản vừa ghép lại.
  useEffect(() => { setFixedScript(""); setFixExplanations([]); }, [fullScript]);

  const displayScript = fixedScript || fullScript;
  // Kiểm tra bằng ĐÚNG parser thật của Xưởng Game (không phải regex bề mặt
  // riêng của Xưởng Kịch Bản) — kết quả này chính là những gì sẽ xảy ra khi
  // dán sang Xưởng Game rồi bấm "Sản Xuất": cảnh mồ côi, vật phẩm/cờ mồ côi,
  // kẹt cứng, vòng lặp không lối ra... đều được bắt giống hệt.
  const EMPTY_REPORT = { ok: true, blocking: [], suggestions: [], warnings: [], sceneCount: 0, endingCount: 0 };
  const report = useMemo(
    () => (displayScript ? realParseCheck(project.workshop, displayScript) : EMPTY_REPORT),
    [project.workshop, displayScript]
  );

  const writeCompleteScript = async () => {
    if (!scenes.length || !branches.length) { setError("Hãy tạo và duyệt bộ khung trước."); return; }
    setWriting(true); setError(""); setFixedScript(""); setFixExplanations([]);
    try {
      const sceneMap = scenes.map((s) => ({ scene_order: s.scene_order, title: s.title }));
      const endingLabels = (meta?.endings || []).map((e) => e.name).filter(Boolean);
      const knownItems = new Set();
      const knownFlags = new Set();
      let previous = "";
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const branch = branchForScene(scene);
        setProgress(`Đang viết cảnh ${i + 1}/${scenes.length}: ${scene.title}`);
        const old = contents.find((c) => c.scene_id === scene.id);
        const script = String(await aiCall(buildSceneScriptPrompt({
          workshop: project.workshop, title: project.title, idea: project.idea, planBlock: planBlock(),
          branch, scene, prevScript: previous, nextScene: scenes[i + 1] || null,
          isFirst: i === 0, isLast: i === scenes.length - 1, totalScenes: scenes.length,
          playerName: project.player_name, playerDesc: project.player_desc, mainQuest: project.main_quest,
          knownItems: [...knownItems], knownFlags: [...knownFlags], sceneMap, endingLabels,
        })) || "").trim();
        await upsertGamePlanSceneContent(project.id, branch.id, scene.id, {
          scene_order: scene.scene_order, title: scene.title, draft: old?.draft || "",
          script, status: "đã ghép kịch bản chung",
        });
        const found = extractItemsAndFlags(script);
        for (const it of found.items) knownItems.add(it);
        for (const fl of found.flags) knownFlags.add(fl);
        previous = script;
      }
      await patchProject({ status: "final" });
      await load();
      setProgress("Đã ghép xong. Hãy xem báo cáo tự kiểm tra trước khi copy.");
    } catch (e) { setError("Ghép kịch bản lỗi: " + (e?.message || "lỗi")); }
    finally { setWriting(false); }
  };

  // Nhờ AI tự sửa CHÍNH các lỗi mà báo cáo (report) vừa bắt được — dùng lại
  // NGUYÊN VẸN cơ chế "verifyAndFixScript" mà Xưởng Game dùng cho nút "Kiểm
  // Tra Kịch Bản": mỗi vòng chỉ chấp nhận bản mới nếu SỐ LỖI GIẢM, nên kết quả
  // không bao giờ tệ hơn bản đang có.
  const autoFix = async () => {
    if (!report.blocking.length) return;
    setFixing(true); setError("");
    try {
      const parseFn = (txt) => parserForWorkshop(project.workshop)(txt, {});
      const res = await verifyAndFixScript({
        cheatSheet: buildSyntaxBlock(project.workshop),
        parseFn,
        script: displayScript,
        maxRounds: 3,
      });
      setFixedScript(res.script);
      setFixExplanations(res.explanations || []);
      setProgress(res.clean ? "AI đã sửa hết lỗi chặn đường chơi." : res.improved ? "AI đã giảm bớt lỗi — vẫn còn vài lỗi cần bạn xem lại." : "AI chưa sửa được thêm — hãy xem lại chi tiết lỗi bên dưới.");
    } catch (e) { setError("Tự động sửa lỗi: " + (e?.message || "lỗi")); }
    finally { setFixing(false); }
  };

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(displayScript); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch (e) { setError("Không copy được: " + e.message); }
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground py-16 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Đang tải...</div>;

  return <div className="space-y-5">
    {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>}
    <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-[240px]">
        <h3 className="font-display font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Một kịch bản hoàn chỉnh</h3>
        <p className="text-xs text-muted-foreground mt-1">Toàn bộ {project.scene_count} cảnh và {project.branch_count} nhánh được nối trong một file đúng cú pháp {workshop.label}. Bạn chỉ cần copy một lần.</p>
      </div>
      <button onClick={writeCompleteScript} disabled={writing} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
        {writing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} {writing ? "Đang ghép..." : fullScript ? "Ghép lại kịch bản cuối" : "Ghép kịch bản cuối"}
      </button>
    </div>
    {progress && <div className="text-xs rounded-lg bg-primary/10 text-primary px-3 py-2">{progress}</div>}
    {!!displayScript && <div className={`rounded-xl border p-3 text-xs ${!report.ok || report.blocking.length ? "border-destructive/40 bg-destructive/5" : "border-emerald-500/40 bg-emerald-500/5"}`}>
      <div className="font-semibold flex items-center gap-2">
        {!report.ok || report.blocking.length ? <AlertTriangle className="w-4 h-4 text-destructive" /> : <Check className="w-4 h-4 text-emerald-600" />}
        {!report.ok ? "Kịch bản lỗi cú pháp nghiêm trọng" : report.blocking.length ? `${report.blocking.length} lỗi chặn đường chơi (giống hệt Xưởng Game sẽ báo)` : `Đạt kiểm tra như Xưởng Game: ${report.sceneCount} cảnh, ${report.endingCount} kết thúc`}
        {report.ok && !!report.blocking.length && (
          <button onClick={autoFix} disabled={fixing} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] font-medium disabled:opacity-50">
            {fixing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} {fixing ? "Đang tự sửa..." : "Tự động sửa bằng AI"}
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Kiểm tra này chạy ĐÚNG parser thật của {workshop.label} — kết quả khớp 100% với lúc bạn dán sang Xưởng Game rồi bấm "Sản Xuất".</p>
      {!!report.blocking.length && <ul className="mt-2 list-disc pl-5 space-y-1">{report.blocking.slice(0, 12).map((x, i) => <li key={i}>{x}</li>)}</ul>}
      {!!report.suggestions.length && (
        <details className="mt-2">
          <summary className="cursor-pointer text-amber-700 dark:text-amber-400">{report.suggestions.length} gợi ý chất lượng (vật phẩm/cờ mồ côi, điều kiện thừa — không chặn đường chơi)</summary>
          <ul className="mt-1 list-disc pl-5 space-y-1 text-amber-700 dark:text-amber-400">{report.suggestions.slice(0, 20).map((x, i) => <li key={i}>{x}</li>)}</ul>
        </details>
      )}
      {!!fixExplanations.length && (
        <div className="mt-2 rounded-lg bg-primary/5 p-2">
          <div className="font-semibold text-primary mb-1">AI đã sửa:</div>
          <ul className="list-disc pl-5 space-y-0.5">{fixExplanations.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      )}
    </div>}
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <span className="text-sm font-semibold">Bản để copy sang Xưởng Game</span>
        {fixedScript && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">đã tự sửa</span>}
        <button onClick={copyAll} disabled={!displayScript || !report.ok || report.blocking.length > 0} title={report.blocking.length ? "Sửa hết lỗi chặn đường chơi trước khi copy" : ""} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-40">{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Đã copy" : "Copy toàn bộ"}</button>
      </div>
      <pre className="p-4 text-xs leading-5 whitespace-pre-wrap overflow-auto max-h-[70vh] font-mono">{displayScript || "Chưa có kịch bản cuối. Bấm “Ghép kịch bản cuối”."}</pre>
    </div>
    <div className="flex items-center justify-between"><button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"><ArrowLeft className="w-4 h-4" /> Quay lại duyệt nhánh</button><span className="text-xs text-muted-foreground">Copy → dán vào {workshop.label} → Sản xuất game</span></div>
  </div>;
}
