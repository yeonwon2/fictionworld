import React, { useEffect, useState } from "react";
import { Loader2, Wand2, Copy, Check, ArrowLeft, FileText } from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import { buildSceneScriptPrompt, buildSceneScriptRevisionPrompt } from "@/lib/gameScriptProject/prompts";
import { WORKSHOPS } from "@/lib/gameScriptProject/syntaxGuide";
import {
  listGamePlanScenes, getGamePlanMeta,
  listGamePlanBranches,
  listGamePlanSceneContent, upsertGamePlanSceneContent,
} from "@/lib/worldcrud";

// Bước 4 — AI viết KỊCH BẢN CHUẨN FORM (đúng cú pháp xưởng game) cho từng nhánh,
// ghép thành văn bản hoàn chỉnh → tác giả copy dán vào Xưởng Game để sản xuất.
export default function FinalStep({ project, patchProject, onBack }) {
  const [meta, setMeta] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [branches, setBranches] = useState([]);
  const [contents, setContents] = useState({});
  const [loading, setLoading] = useState(true);
  const [writingBranch, setWritingBranch] = useState(null);
  const [writingAll, setWritingAll] = useState(false);
  const [activeBranch, setActiveBranch] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [reviseScene, setReviseScene] = useState(null); // { branchId, sceneId, script, feedback }

  const workshop = WORKSHOPS[project.workshop] || WORKSHOPS.studio;

  const load = async () => {
    setLoading(true);
    try {
      const m = await getGamePlanMeta(project.id);
      setMeta(m);
      const s = (await listGamePlanScenes(project.id)) || [];
      setScenes(s);
      const b = (await listGamePlanBranches(project.id)) || [];
      setBranches(b);
      const cc = {};
      for (const br of b) cc[br.id] = (await listGamePlanSceneContent(project.id, br.id)) || [];
      setContents(cc);
      if (!activeBranch && b.length) setActiveBranch(b[0].id);
    } catch (e) {
      setError("Không tải được dữ liệu: " + (e?.message || "lỗi"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
     
  }, [project.id]);

  function scenesForBranch(branchIndex) {
    const bp = scenes.find((s) => s.is_branch_point && s.branch_index === branchIndex);
    if (!bp) return scenes;
    return scenes.filter((s) => s.scene_order >= bp.scene_order);
  }

  function buildPlanBlockText() {
    const lines = [];
    if (meta?.characters?.length) lines.push("## Nhân vật\n" + meta.characters.map((c) => `- ${c.name}${c.role ? ` (${c.role})` : ""}: ${c.personality || ""} ${c.motive ? `· ${c.motive}` : ""}`).join("\n"));
    if (meta?.settings?.length) lines.push("## Bối cảnh\n" + meta.settings.map((s) => `- ${s.name}: ${s.description || ""}`).join("\n"));
    if (meta?.endings?.length) lines.push("## Kết thúc\n" + meta.endings.map((e) => `- ${e.name} [${e.type || "NORMAL_END"}]: ${e.description || ""}`).join("\n"));
    return lines.join("\n\n");
  }

  // Viết kịch bản chuẩn form cho toàn bộ các cảnh của 1 nhánh, tuần tự từng cảnh.
  const handleWriteBranchScript = async (branch) => {
    const branchScenes = scenesForBranch(branch.branch_index);
    if (!branchScenes.length) return;
    setError("");
    setWritingBranch(branch.id);
    try {
      const planBlock = buildPlanBlockText();
      const existing = contents[branch.id] || [];
      // Gộp bản thảo draft vào cảnh nếu có (dùng làm chất liệu)
      const draftById = Object.fromEntries(existing.map((c) => [c.scene_id, c.draft]));
      let prevScript = "";
      for (let i = 0; i < branchScenes.length; i++) {
        const sc = branchScenes[i];
        const isLast = i === branchScenes.length - 1;
        const prompt = buildSceneScriptPrompt({
          workshop: project.workshop,
          title: project.title,
          idea: project.idea,
          planBlock,
          branch,
          scene: { ...sc, description: `${sc.description}${draftById[sc.id] ? "\n[Bản thảo tham khảo] " + draftById[sc.id].slice(0, 800) : ""}` },
          prevScript,
          nextScene: isLast ? null : branchScenes[i + 1],
          isFirst: i === 0,
          isLast,
          totalScenes: branchScenes.length,
          playerName: project.player_name,
          playerDesc: project.player_desc,
          mainQuest: project.main_quest,
        });
        const res = await aiCall(prompt);
        const script = String(res || "").trim();
        await upsertGamePlanSceneContent(project.id, branch.id, sc.id, {
          scene_order: sc.scene_order,
          title: sc.title,
          script,
          status: "đã viết kịch bản",
        });
        prevScript = script;
      }
      await load();
      setStatus(`Đã viết kịch bản chuẩn form nhánh "${branch.name}".`);
      setTimeout(() => setStatus(""), 4000);
    } catch (e) {
      setError("Viết kịch bản nhánh lỗi: " + (e?.message || "lỗi"));
    } finally {
      setWritingBranch(null);
    }
  };

  const handleWriteAll = async () => {
    setError("");
    setWritingAll(true);
    for (const br of branches) await handleWriteBranchScript(br);
    setWritingAll(false);
    setStatus("Đã viết kịch bản chuẩn form cho tất cả các nhánh.");
    setTimeout(() => setStatus(""), 4000);
    await patchProject({ status: "final" });
  };

  // Ghép toàn bộ kịch bản của 1 nhánh thành 1 văn bản hoàn chỉnh.
  function buildFullScript(branch) {
    const list = (contents[branch.id] || []).slice().sort((a, b) => a.scene_order - b.scene_order);
    const blocks = list.filter((c) => c.script?.trim()).map((c) => c.script.trim());
    const playerLine = project.player_name ? `**Nhân vật nhập vai:** ${project.player_name}${project.player_desc ? ` — ${project.player_desc}` : ""}` : "";
    const questLine = project.main_quest ? `**Nhiệm vụ chính:** ${project.main_quest}` : "";
    const metaExtra = [playerLine, questLine].filter(Boolean).join("\n");
    const header = `# ${project.title} — ${branch.name}\n**Thể loại:** ${project.genre || ""}\n**Tác giả:** FictionWorld${metaExtra ? `\n${metaExtra}` : ""}`.trim();
    const body = blocks.join("\n\n");
    const ending = `\n\n## KẾT THÚC ${slugify(branch.name)} — ${branch.name} [NORMAL_END]\n(Đây là phần kết thúc tổng của nhánh. Bạn có thể chỉnh tên/loại kết thúc cho phù hợp trước khi sản xuất.)`;
    return `${header}\n\n${body}${body && !/KẾT THÚC/i.test(body) ? ending : ""}`;
  }

  const handleCopy = async (branch) => {
    const text = buildFullScript(branch);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(branch.id);
      setTimeout(() => setCopied(null), 2000);
    } catch (e) {
      setError("Không copy được: " + e.message);
    }
  };

  const handleRevise = async () => {
    if (!reviseScene || !reviseScene.feedback.trim()) return;
    const { branchId, sceneId, feedback } = reviseScene;
    const branch = branches.find((b) => b.id === branchId);
    const sc = scenes.find((s) => s.id === sceneId);
    const list = contents[branchId] || [];
    const cur = list.find((c) => c.scene_id === sceneId);
    setError("");
    try {
      const prompt = buildSceneScriptRevisionPrompt({
        workshop: project.workshop,
        title: project.title,
        planBlock: buildPlanBlockText(),
        branch,
        scene: sc,
        currentContent: cur?.script || "",
        feedback,
      });
      const res = await aiCall(prompt);
      await upsertGamePlanSceneContent(project.id, branchId, sceneId, { script: String(res || "").trim(), status: "đã sửa" });
      setReviseScene(null);
      await load();
      setStatus("Đã sửa kịch bản theo góp ý.");
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      setError("Sửa kịch bản lỗi: " + e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-16 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
      </div>
    );
  }

  const active = branches.find((b) => b.id === activeBranch) || branches[0];

  return (
    <div className="space-y-5">
      {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>}
      {status && <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">{status}</div>}

      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <h3 className="font-display font-semibold text-base flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Kịch bản chuẩn form</h3>
          <p className="text-xs text-muted-foreground mt-1">
            AI viết từng phân cảnh theo <b>đúng cú pháp {workshop.label}</b> (parser: {workshop.parser}) — dán thẳng vào Xưởng Game là chạy được. Mỗi nhánh là 1 kịch bản hoàn chỉnh.
          </p>
        </div>
        <button
          onClick={handleWriteAll}
          disabled={writingAll || writingBranch}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          {writingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          {writingAll ? "Đang viết tất cả..." : "Viết kịch bản chuẩn form tất cả nhánh"}
        </button>
      </div>

      {/* Chọn nhánh */}
      <div className="flex items-center gap-2 flex-wrap">
        {branches.map((br) => (
          <button
            key={br.id}
            onClick={() => setActiveBranch(br.id)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
              activeBranch === br.id ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current opacity-60" />
            {br.name}
            {(contents[br.id] || []).some((c) => c.script?.trim()) && <Check className="w-3 h-3 text-emerald-500" />}
          </button>
        ))}
      </div>

      {active && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
            <h4 className="font-display font-semibold text-sm">Kịch bản nhánh: {active.name}</h4>
            <button
              onClick={() => handleWriteBranchScript(active)}
              disabled={writingBranch !== null || writingAll}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/40 text-primary text-[11px] hover:bg-primary/10 disabled:opacity-50"
            >
              {writingBranch === active.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              {(contents[active.id] || []).some((c) => c.script?.trim()) ? "Viết lại nhánh" : "Viết kịch bản nhánh này"}
            </button>
            <button
              onClick={() => handleCopy(active)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] hover:opacity-90"
            >
              {copied === active.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied === active.id ? "Đã copy" : "Copy kịch bản"}
            </button>
          </div>
          <div className="p-4">
            <pre className="rounded-lg border border-border bg-muted/20 p-4 text-xs leading-5 whitespace-pre-wrap overflow-x-auto max-h-[70vh] overflow-y-auto font-mono">
              {buildFullScript(active)}
            </pre>
          </div>
        </div>
      )}

      {/* Sửa kịch bản theo góp ý */}
      {active && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h4 className="font-display font-semibold text-sm mb-2">Sửa kịch bản theo góp ý</h4>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <select
              value={reviseScene?.sceneId || ""}
              onChange={(e) => setReviseScene({ branchId: active.id, sceneId: e.target.value, script: "", feedback: "" })}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            >
              <option value="">(chọn phân cảnh để sửa)</option>
              {(contents[active.id] || []).map((c) => (
                <option key={c.id} value={c.scene_id}>#{c.scene_order} {c.title}</option>
              ))}
            </select>
          </div>
          {reviseScene?.sceneId && (
            <div className="space-y-2">
              <textarea
                value={reviseScene.feedback}
                onChange={(e) => setReviseScene({ ...reviseScene, feedback: e.target.value })}
                rows={2}
                placeholder="Góp ý sửa (VD: đoạn thoại phản diện quá lạnh, nhấn cảm xúc nhân vật chính, giảm dài dòng...)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-none"
              />
              <button
                onClick={handleRevise}
                disabled={!reviseScene.feedback.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
              >
                <Wand2 className="w-3 h-3" /> Sửa theo góp ý
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">
          <ArrowLeft className="w-4 h-4" /> Quay lại 4 nhánh
        </button>
        <p className="text-xs text-muted-foreground">
          Sau khi copy, dán vào Xưởng Game ({workshop.label}) → Sản Xuất Game.
        </p>
      </div>
    </div>
  );
}

function slugify(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "end";
}
