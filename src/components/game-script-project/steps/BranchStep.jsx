import React, { useEffect, useState } from "react";
import { Loader2, Wand2, ArrowLeft, CheckCircle2, Pencil } from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import { buildBranchDraftPrompt, BRANCH_DRAFT_SCHEMA } from "@/lib/gameScriptProject/prompts";
import {
  listGamePlanScenes, getGamePlanMeta,
  listGamePlanBranches, createGamePlanBranch, updateGamePlanBranch,
  listGamePlanSceneContent, upsertGamePlanSceneContent,
} from "@/lib/worldcrud";

// Bước 3 — viết BẢN THẢO VĂN XUÔI cho từng nhánh truyện (theo số nhánh đã chọn),
// dựa trên bộ khung đã duyệt. Tác giả đọc bản thảo, chỉnh sửa rồi chốt.
export default function BranchStep({ project, patchProject, directionBlock, onBack, onNext }) {
  const [meta, setMeta] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [branches, setBranches] = useState([]);
  const [contents, setContents] = useState({}); // branchId -> [ {scene_order, title, draft, script, id} ]
  const [loading, setLoading] = useState(true);
  const [writingBranch, setWritingBranch] = useState(null);
  const [writingAll, setWritingAll] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [editScene, setEditScene] = useState(null); // { branchId, sceneId, draft }

  const load = async () => {
    setLoading(true);
    try {
      const m = await getGamePlanMeta(project.id);
      setMeta(m);
      const s = (await listGamePlanScenes(project.id)) || [];
      setScenes(s);
      let b = (await listGamePlanBranches(project.id)) || [];

      // Nếu chưa có nhánh nào, tạo từ meta.branches hoặc mặc định
      if (!b.length) {
        const metaBranches = m?.branches?.length ? m.branches : Array.from({ length: project.branch_count || 4 }, (_, i) => ({ name: `Nhánh ${i + 1}`, description: "" }));
        const created = [];
        for (let i = 0; i < (project.branch_count || 4); i++) {
          const mb = metaBranches[i] || { name: `Nhánh ${i + 1}`, description: "" };
          const row = await createGamePlanBranch({ project_id: project.id, branch_index: i, name: mb.name || `Nhánh ${i + 1}`, description: mb.description || "", scene_order_ids: [], status: "nháp" });
          created.push(row);
        }
        b = created;
      }
      setBranches(b);

      // Nạp nội dung từng nhánh
      const cc = {};
      for (const br of b) {
        const list = (await listGamePlanSceneContent(project.id, br.id)) || [];
        cc[br.id] = list;
      }
      setContents(cc);
    } catch (e) {
      setError("Không tải được nhánh: " + (e?.message || "lỗi"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
     
  }, [project.id]);

  // Xác định các cảnh thuộc 1 nhánh: từ điểm rẽ của nhánh đó trở đi.
  // Điểm rẽ của nhánh i là cảnh có is_branch_point && branch_index === i.
  function scenesForBranch(branchIndex) {
    const branchPoint = scenes.find((s) => s.is_branch_point && s.branch_index === branchIndex);
    if (!branchPoint) return scenes;
    const startOrder = branchPoint.scene_order;
    return scenes.filter((s) => s.scene_order >= startOrder);
  }

  // Gộp bộ khung thành block văn bản đưa vào prompt
  function buildPlanBlockText() {
    const lines = [];
    if (meta?.characters?.length) lines.push("## Nhân vật\n" + meta.characters.map((c) => `- ${c.name}${c.role ? ` (${c.role})` : ""}: ${c.personality || ""} ${c.motive ? `· ${c.motive}` : ""}`).join("\n"));
    if (meta?.settings?.length) lines.push("## Bối cảnh\n" + meta.settings.map((s) => `- ${s.name}: ${s.description || ""}`).join("\n"));
    if (meta?.endings?.length) lines.push("## Kết thúc\n" + meta.endings.map((e) => `- ${e.name} [${e.type || "NORMAL_END"}]: ${e.description || ""}`).join("\n"));
    return lines.join("\n\n");
  }

  const handleWriteBranch = async (branch) => {
    const branchScenes = scenesForBranch(branch.branch_index);
    if (!branchScenes.length) return;
    setError("");
    setWritingBranch(branch.id);
    try {
      const planBlock = buildPlanBlockText();
      const prompt = buildBranchDraftPrompt({
        workshop: project.workshop,
        title: project.title,
        idea: project.idea,
        genre: project.genre,
        planBlock,
        branch,
        scenes: branchScenes,
        playerName: project.player_name,
        playerDesc: project.player_desc,
        mainQuest: project.main_quest,
      });
      const res = await aiCall(prompt, { jsonSchema: BRANCH_DRAFT_SCHEMA });
      const drafts = res?.scenes || [];
      for (const d of drafts) {
        const sc = branchScenes.find((s) => s.scene_order === d.scene_order);
        if (!sc) continue;
        await upsertGamePlanSceneContent(project.id, branch.id, sc.id, {
          scene_order: sc.scene_order,
          title: d.title || sc.title,
          draft: d.draft || "",
          status: "đã viết",
        });
      }
      await updateGamePlanBranch(branch.id, { status: "đã viết" });
      await load();
      setStatus(`Đã viết bản thảo nhánh "${branch.name}".`);
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      setError("Viết bản thảo nhánh lỗi: " + (e?.message || "lỗi"));
    } finally {
      setWritingBranch(null);
    }
  };

  const handleWriteAll = async () => {
    setError("");
    setWritingAll(true);
    for (const br of branches) {
      if (writingBranch) continue;
      await handleWriteBranch(br);
    }
    setWritingAll(false);
    setStatus("Đã viết bản thảo tất cả các nhánh.");
    setTimeout(() => setStatus(""), 3000);
  };

  const handleSaveDraft = async () => {
    if (!editScene) return;
    const { branchId, sceneId, draft } = editScene;
    try {
      await upsertGamePlanSceneContent(project.id, branchId, sceneId, { draft, status: "đã sửa" });
      setEditScene(null);
      await load();
      setStatus("Đã lưu bản thảo.");
      setTimeout(() => setStatus(""), 2000);
    } catch (e) {
      setError("Lưu bản thảo lỗi: " + e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-16 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Đang tải các nhánh...
      </div>
    );
  }

  const allWritten = branches.every((b) => (contents[b.id] || []).length > 0);

  return (
    <div className="space-y-5">
      {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>}
      {status && <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">{status}</div>}

      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <h3 className="font-display font-semibold text-base flex items-center gap-2"><GitBranchIcon /> Viết bản thảo {branches.length} nhánh truyện</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Mỗi nhánh = 1 đáp án/lựa chọn chính ở các điểm rẽ. AI viết <b>bản thảo văn xuôi</b> cho các cảnh của từng nhánh để bạn đọc thử và chỉnh sửa trước khi chốt.
          </p>
        </div>
        <button
          onClick={handleWriteAll}
          disabled={writingAll || writingBranch}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          {writingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          {writingAll ? "Đang viết tất cả..." : "Viết bản thảo tất cả nhánh"}
        </button>
      </div>

      <div className="space-y-4">
        {branches.map((br, bi) => {
          const list = contents[br.id] || [];
          const written = list.length > 0;
          const branchScenes = scenesForBranch(br.branch_index);
          return (
            <div key={br.id} className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <h4 className="font-display font-semibold text-sm">Nhánh {bi + 1} — {br.name}</h4>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{branchScenes.length} cảnh</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${written ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                  {written ? "đã viết" : "chưa viết"}
                </span>
                <button
                  onClick={() => handleWriteBranch(br)}
                  disabled={writingBranch !== null || writingAll}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/40 text-primary text-[11px] hover:bg-primary/10 disabled:opacity-50"
                >
                  {writingBranch === br.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {written ? "Viết lại" : "Viết bản thảo"}
                </button>
              </div>
              <div className="p-3 space-y-2">
                {!written ? (
                  <p className="text-xs text-muted-foreground italic">Chưa có bản thảo. Bấm "Viết bản thảo" để AI viết {branchScenes.length} cảnh của nhánh này.</p>
                ) : (
                  list.map((c) => (
                    <div key={c.id} className="rounded-lg border border-border bg-muted/10 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-muted-foreground">#{c.scene_order}</span>
                        <span className="text-xs font-medium">{c.title}</span>
                        <button onClick={() => setEditScene({ branchId: br.id, sceneId: c.scene_id, draft: c.draft })} className="ml-auto inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                          <Pencil className="w-3 h-3" /> Sửa
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed line-clamp-4">{c.draft}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal chỉnh sửa bản thảo */}
      {editScene && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditScene(null)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl p-5">
            <h3 className="font-display font-semibold text-base mb-3">Chỉnh sửa bản thảo cảnh</h3>
            <textarea
              value={editScene.draft}
              onChange={(e) => setEditScene({ ...editScene, draft: e.target.value })}
              rows={16}
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm leading-6 resize-y"
            />
            <div className="flex items-center justify-end gap-2 mt-3">
              <button onClick={() => setEditScene(null)} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted">Huỷ</button>
              <button onClick={handleSaveDraft} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Lưu</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">
          <ArrowLeft className="w-4 h-4" /> Quay lại Bộ khung
        </button>
        <button
          onClick={() => patchProject({ status: "final" }).then(onNext)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          <CheckCircle2 className="w-4 h-4" /> Đã chốt — Xuất kịch bản chuẩn form
        </button>
      </div>
    </div>
  );
}

function GitBranchIcon() {
  return (
    <svg className="w-4 h-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" />
      <path d="M6 9v6M18 9a9 9 0 0 1-9 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
