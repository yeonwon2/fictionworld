import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Copy, FileText, ListTree, Loader2, Plus, Sparkles, Wand2 } from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import { buildSceneScriptPrompt, buildSceneScriptRevisionPrompt, buildPlanScenesChunkPrompt, PLAN_SCENES_CHUNK_SCHEMA, extractItemsAndFlags } from "@/lib/gameScriptProject/prompts";
import { WORKSHOPS, buildSyntaxBlock } from "@/lib/gameScriptProject/syntaxGuide";
import { realParseCheck, parserForWorkshop } from "@/lib/gameScriptProject/parserBridge";
import { verifyAndFixScript } from "@/lib/gameStudio/fixScriptWithAI";
import { analyzePhase3Narrative } from "@/lib/gameScriptProject/phase3Analyzer";
import { compileFinalScriptLocally } from "@/lib/gameScriptProject/quotaPlanner";
import AiReviseBox from "@/components/game-script-project/AiReviseBox";
import { getGamePlanMeta, listGamePlanBranches, listGamePlanSceneContent, listGamePlanScenes, createGamePlanScene, upsertGamePlanSceneContent } from "@/lib/worldcrud";

// Gemini đôi khi phớt lờ yêu cầu "chỉ viết một cảnh" và trả lại cả kịch bản.
// Chặn việc mỗi hàng scene_content giữ một bản đầy đủ rồi bị nối lặp N lần.
export function isolateGeneratedScene(raw, sceneOrder, { isFirst = false, isLast = false } = {}) {
  const text = String(raw || "").trim();
  if (!text) return "";
  const marker = new RegExp(`^##\\s*CẢNH\\s+${sceneOrder}(?:\\s|—|-)`, "imu");
  const match = marker.exec(text);
  if (!match) return text;

  const before = isFirst ? text.slice(0, match.index).trim() : "";
  const afterStart = text.slice(match.index);
  const nextScene = /\n##\s*CẢNH\s+\d+(?:\s|—|-)/imu.exec(afterStart.slice(match[0].length));
  let sceneAndEndings = afterStart;
  if (nextScene) sceneAndEndings = afterStart.slice(0, match[0].length + nextScene.index);
  if (!isLast) {
    const ending = /\n##\s*KẾT THÚC\b/imu.exec(sceneAndEndings);
    if (ending) sceneAndEndings = sceneAndEndings.slice(0, ending.index);
  }
  return [before, sceneAndEndings.trim()].filter(Boolean).join("\n\n").trim();
}

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
  const [addingScenes, setAddingScenes] = useState(false);
  const [addCount, setAddCount] = useState(6);
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

  useEffect(() => { load(); }, [project.id]);

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
  const phase3Report = useMemo(() => analyzePhase3Narrative({ project, meta, scenes }), [project, meta, scenes]);
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
      setProgress("Đang biên dịch cục bộ — không gọi Gemini...");
      const draftByScene = new Map();
      for (const row of contents) if (row.draft?.trim() && !draftByScene.has(row.scene_id)) draftByScene.set(row.scene_id, row);
      const compiled = compileFinalScriptLocally({ project, meta, scenes, draftByScene });
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const branch = branchForScene(scene);
        setProgress(`Đang lưu cảnh ${i + 1}/${scenes.length}: ${scene.title} · 0 lượt AI`);
        const old = contents.find((c) => c.scene_id === scene.id);
        const script = isolateGeneratedScene(compiled, scene.scene_order, {
          isFirst: i === 0,
          isLast: i === scenes.length - 1,
        });
        await upsertGamePlanSceneContent(project.id, branch.id, scene.id, {
          scene_order: scene.scene_order, title: scene.title, draft: old?.draft || "",
          script, status: "đã ghép kịch bản chung",
        });
      }
      await patchProject({ status: "final" });
      await load();
      setProgress("Đã ghép xong hoàn toàn trên máy (0 lượt Gemini). Hãy xem báo cáo trước khi copy.");
    } catch (e) { setError("Ghép kịch bản lỗi: " + (e?.message || "lỗi")); }
    finally { setWriting(false); }
  };

  // Sửa/góp ý sửa MỘT cảnh cụ thể trong bản kịch bản cuối — dùng lại
  // buildSceneScriptRevisionPrompt (đã có sẵn trong prompts.js từ trước,
  // trước đây chưa từng được gắn vào UI nào).
  const reviseScene = async (scene, feedback) => {
    const branch = branchForScene(scene);
    const currentContent = scriptByScene.get(scene.id) || "";
    const revised = String(await aiCall(buildSceneScriptRevisionPrompt({
      workshop: project.workshop, title: project.title, planBlock: planBlock(), branch, scene, currentContent, feedback, idea: project.idea,
    })) || "").trim();
    const old = contents.find((c) => c.scene_id === scene.id);
    await upsertGamePlanSceneContent(project.id, branch.id, scene.id, {
      scene_order: scene.scene_order, title: scene.title, draft: old?.draft || "", script: revised, status: "đã sửa",
    });
    await load();
  };

  // "Thêm cảnh vào cuối" — kịch bản đã ghép xong nhưng thấy ít cảnh quá thì
  // nối thêm NGAY LẬP TỨC (dựng bộ khung cho cảnh mới + viết luôn kịch bản
  // chuẩn form), không phải quay lại bước Bộ Khung làm lại từ đầu. Cảnh cuối
  // cùng ĐANG CÓ (vốn đã tự kết thúc câu chuyện) được nhờ AI nối lại sang
  // cảnh mới thay vì tiếp tục dẫn tới kết thúc — nếu không làm bước này, cảnh
  // mới sẽ không có lựa chọn nào trỏ tới (cảnh mồ côi).
  const addScenesToEnd = async () => {
    const extra = Math.max(1, Math.min(30, Number(addCount) || 0));
    if (!scenes.length) { setError("Hãy ghép kịch bản trước khi thêm cảnh."); return; }
    setAddingScenes(true); setError("");
    try {
      const oldLast = scenes[scenes.length - 1];
      const startOrder = oldLast.scene_order + 1;
      const target = startOrder - 1 + extra;
      const branchCount = Math.max(2, Number(project.branch_count) || 4);
      const choicesPer = Math.max(1, Math.min(6, Number(project.choices_per_scene) || 3));
      const coreBlock = planBlock();
      const prevSummary = scenes.slice(-6).map((s) => `${s.scene_order}. ${s.title}: ${(s.description || "").slice(0, 120)}`).join("\n");

      setProgress(`Đang dựng bộ khung cho ${extra} cảnh mới...`);
      const chunk = await aiCall(
        buildPlanScenesChunkPrompt({
          workshop: project.workshop, idea: project.idea, coreBlock, branchCount, choicesPerScene: choicesPer,
          startOrder, count: extra, totalScenes: target, prevScenesSummary: prevSummary,
        }),
        { jsonSchema: PLAN_SCENES_CHUNK_SCHEMA }
      );
      const list = chunk?.scenes || [];
      const newScenes = [];
      let order = startOrder;
      for (const sc of list) {
        if (order > target) break;
        const row = await createGamePlanScene({
          project_id: project.id, scene_order: order, title: sc.title || `Cảnh ${order}`, description: sc.description || "",
          location: sc.location || "", characters: sc.characters || "", foreshadow: sc.foreshadow || "",
          choices: sc.choices || [], is_branch_point: !!sc.is_branch_point, branch_index: sc.branch_index ?? null, status: "nháp",
        });
        newScenes.push(row);
        order++;
      }
      if (!newScenes.length) throw new Error("AI không trả về cảnh nào.");

      // Nối cảnh cuối CŨ sang cảnh mới thay vì kết thúc ở đó.
      setProgress("Đang nối cảnh cuối cũ sang cảnh mới...");
      await reviseScene(oldLast, `Câu chuyện KHÔNG kết thúc ở cảnh này nữa — sẽ có tiếp cảnh ${startOrder} ("${newScenes[0].title}") trở đi. Đổi lựa chọn đang dẫn tới "→ Kết thúc ..." thành "→ Đến cảnh ${startOrder}" (giữ nguyên các hiệu ứng khác của lựa chọn đó, chỉ đổi đích), phần còn lại giữ nguyên.`);

      const sceneMap = [...scenes, ...newScenes].map((s) => ({ scene_order: s.scene_order, title: s.title }));
      const endingLabels = (meta?.endings || []).map((e) => e.name).filter(Boolean);
      const known = extractItemsAndFlags(fullScript);
      const knownItems = new Set(known.items);
      const knownFlags = new Set(known.flags);
      let previous = fullScript.slice(-1200);
      for (let i = 0; i < newScenes.length; i++) {
        const scene = newScenes[i];
        const branch = branchForScene(scene);
        setProgress(`Đang viết cảnh mới ${i + 1}/${newScenes.length}: ${scene.title}`);
        const generated = String(await aiCall(buildSceneScriptPrompt({
          workshop: project.workshop, title: project.title, idea: project.idea, planBlock: planBlock(),
          branch, scene, prevScript: previous, nextScene: newScenes[i + 1] || null,
          isFirst: false, isLast: i === newScenes.length - 1, totalScenes: target,
          playerName: project.player_name, playerDesc: project.player_desc, mainQuest: project.main_quest,
          knownItems: [...knownItems], knownFlags: [...knownFlags], sceneMap, endingLabels,
          approvedDraft: "", gameBible: meta?.game_bible,
        })) || "").trim();
        const script = isolateGeneratedScene(generated, scene.scene_order, {
          isFirst: false,
          isLast: i === newScenes.length - 1,
        });
        await upsertGamePlanSceneContent(project.id, branch.id, scene.id, {
          scene_order: scene.scene_order, title: scene.title, draft: "", script, status: "đã ghép kịch bản chung",
        });
        const found = extractItemsAndFlags(script);
        for (const it of found.items) knownItems.add(it);
        for (const fl of found.flags) knownFlags.add(fl);
        previous = script;
      }
      await patchProject({ scene_count: target });
      setProgress(`Đã thêm ${newScenes.length} cảnh. Xem báo cáo kiểm tra bên dưới — nếu còn cảnh mồ côi, bấm "Tự động sửa bằng AI".`);
      await load();
    } catch (e) {
      setError("Thêm cảnh lỗi: " + (e?.message || "lỗi"));
      setProgress("");
    } finally {
      setAddingScenes(false);
    }
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
        <p className="text-xs text-muted-foreground mt-1">Toàn bộ {project.scene_count} cảnh và {project.branch_count} nhánh được biên dịch trên máy thành cú pháp {workshop.label}. Bước này không tốn lượt Gemini.</p>
      </div>
      <div className="flex items-center gap-2">
        {!!fullScript && (
          <>
            <input
              type="number" min={1} max={30} value={addCount}
              onChange={(e) => setAddCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
              className="w-14 rounded-md border border-input bg-background px-1.5 py-2 text-xs"
              title="Số cảnh muốn thêm"
            />
            <button onClick={addScenesToEnd} disabled={addingScenes || writing} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-primary/40 text-primary text-xs font-medium hover:bg-primary/10 disabled:opacity-50" title="Kịch bản ít cảnh quá? Thêm ngay, không cần dựng lại từ đầu">
              {addingScenes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Thêm cảnh
            </button>
          </>
        )}
        <button onClick={writeCompleteScript} disabled={writing || addingScenes} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
          {writing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} {writing ? "Đang ghép..." : fullScript ? "Ghép lại miễn phí" : "Ghép kịch bản · 0 lượt AI"}
        </button>
      </div>
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
    {!!displayScript && <div className={`rounded-xl border p-3 text-xs ${phase3Report.publishReady ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-400/40 bg-amber-500/5"}`}><div className="font-semibold">Cổng xuất bản Phase 3: {phase3Report.publishReady ? "ĐẠT" : "CHƯA ĐẠT"} · {phase3Report.score}/100</div><p className="mt-1 text-muted-foreground">Coverage {phase3Report.coverage.scenePercent}% cảnh, {phase3Report.coverage.choicePercent}% lựa chọn · {phase3Report.regressionCases.length} tuyến hồi quy.</p>{!phase3Report.publishReady && <ul className="mt-2 list-disc pl-5 space-y-1">{phase3Report.findings.slice(0, 8).map((x, i) => <li key={i}>{x.message}</li>)}</ul>}</div>}
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <span className="text-sm font-semibold">Bản để copy sang Xưởng Game</span>
        {fixedScript && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">đã tự sửa</span>}
        <button onClick={copyAll} disabled={!displayScript || !report.ok || report.blocking.length > 0 || !phase3Report.publishReady} title={report.blocking.length ? "Sửa hết lỗi chặn đường chơi trước khi copy" : !phase3Report.publishReady ? "Cổng xuất bản Phase 3 chưa đạt" : ""} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-40">{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Đã copy" : "Copy toàn bộ"}</button>
      </div>
      <pre className="p-4 text-xs leading-5 whitespace-pre-wrap overflow-auto max-h-[70vh] font-mono">{displayScript || "Chưa có kịch bản cuối. Bấm “Ghép kịch bản cuối”."}</pre>
    </div>
    {!!scenes.length && !!scriptByScene.size && (
      <details className="rounded-2xl border border-border bg-card overflow-hidden">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center gap-2"><ListTree className="w-4 h-4 text-primary" /> Sửa từng cảnh riêng ({scenes.length} cảnh)</summary>
        <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto border-t border-border">
          {scenes.map((s) => {
            const script = scriptByScene.get(s.id) || "";
            return (
              <div key={s.id} className="rounded-lg border border-border bg-muted/10 p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono text-muted-foreground">#{s.scene_order}</span>
                  <span className="text-xs font-medium">{s.title}</span>
                </div>
                {script ? (
                  <p className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed line-clamp-3 mb-1.5">{script}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic mb-1.5">Chưa ghép cảnh này.</p>
                )}
                {script && <AiReviseBox onRevise={(fb) => reviseScene(s, fb)} label="Sửa cảnh này" placeholder="VD: đổi kết thúc bi kịch hơn, thêm twist, viết lại lựa chọn C..." />}
              </div>
            );
          })}
        </div>
      </details>
    )}
    <div className="flex items-center justify-between"><button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"><ArrowLeft className="w-4 h-4" /> Quay lại duyệt nhánh</button><span className="text-xs text-muted-foreground">Copy → dán vào {workshop.label} → Sản xuất game</span></div>
  </div>;
}
