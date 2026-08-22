import React, { useEffect, useState } from "react";
import { Loader2, Wand2, CheckCircle2, ArrowLeft, Pencil, Save, AlertTriangle, Plus, ListChecks } from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import {
  buildPlanCorePrompt,
  PLAN_CORE_SCHEMA,
  buildPlanScenesChunkPrompt,
  PLAN_SCENES_CHUNK_SCHEMA,
  formatCoreBlock,
  buildCoreSectionRevisionPrompt,
  coreSectionRevisionSchema,
  buildPlanSceneRevisionPrompt,
  PLAN_SCENE_REVISION_SCHEMA,
} from "@/lib/gameScriptProject/prompts";
import { analyzePlanLogic } from "@/lib/gameScriptProject/planLogic";
import { WORKSHOPS } from "@/lib/gameScriptProject/syntaxGuide";
import AiReviseBox from "@/components/game-script-project/AiReviseBox";
import {
  getGamePlanMeta,
  upsertGamePlanMeta,
  listGamePlanScenes,
  createGamePlanScene,
  updateGamePlanScene,
  deleteGamePlanScene,
  listGamePlanBranches,
  createGamePlanBranch,
  deleteGamePlanBranch,
} from "@/lib/worldcrud";

const CHUNK = 8;

// Bước 2 — AI phát triển bộ khung TỪ Ý TƯỞNG (pass cốt lõi + dàn cảnh theo lô).
export default function PlanStep({ project, patchProject, directionBlock, onBack, onNext }) {
  const [meta, setMeta] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [editMetaSection, setEditMetaSection] = useState(null);
  const [planWarnings, setPlanWarnings] = useState([]);
  const [addingScenes, setAddingScenes] = useState(false);
  const [addCount, setAddCount] = useState(8);

  const ideaOk = !!String(project.idea || "").trim();

  // Rà lỗi logic NGAY khi dữ liệu thay đổi — trong lúc AI đang dựng dàn cảnh
  // (scenes/meta được cập nhật DẦN trong handleGenerate, không đợi xong hết)
  // lẫn khi tác giả tự tay sửa sau đó. "complete" chỉ bật khi không còn đang
  // sinh dở, tránh báo nhầm lúc dữ liệu chưa đầy đủ.
  useEffect(() => {
    if (!scenes.length && !meta?.characters?.length) { setPlanWarnings([]); return; }
    setPlanWarnings(
      analyzePlanLogic({
        scenes, meta,
        branchCount: Number(project.branch_count) || 4,
        sceneCountTarget: Number(project.scene_count) || 0,
        complete: !generating && !addingScenes,
      })
    );

  }, [scenes, meta, project.branch_count, project.scene_count, generating, addingScenes]);

  const load = async () => {
    setLoading(true);
    try {
      const m = await getGamePlanMeta(project.id);
      setMeta(m || { project_id: project.id, characters: [], settings: [], endings: [], branches: [], notes: "" });
      setScenes((await listGamePlanScenes(project.id)) || []);
      setBranches((await listGamePlanBranches(project.id)) || []);
    } catch (e) {
      setError("Không tải được bộ khung: " + (e?.message || "lỗi"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const handleGenerate = async () => {
    setError("");
    if (!ideaOk) {
      setError("Ý tưởng đang trống. Quay lại bước Ý Tưởng, dán nội dung rồi bấm Lưu.");
      return;
    }
    setGenerating(true);
    setProgress("Đang trích cốt lõi từ ý tưởng (nhân vật, tuyến, kết thúc)...");
    try {
      const core = await aiCall(
        buildPlanCorePrompt({
          workshop: project.workshop,
          title: project.title,
          idea: project.idea,
          genre: project.genre,
          branchCount: project.branch_count || 4,
          notes: project.notes,
          directionBlock,
          playerName: project.player_name,
          playerDesc: project.player_desc,
          mainQuest: project.main_quest,
        }),
        { jsonSchema: PLAN_CORE_SCHEMA }
      );

      // Đồng bộ player / main quest trích từ ý tưởng về project
      await patchProject({
        player_name: core.player_name || project.player_name,
        player_desc: core.player_desc || project.player_desc,
        main_quest: core.main_quest || project.main_quest,
        status: "plan",
      });

      const coreMeta = {
        characters: core.characters || [],
        settings: core.settings || [],
        endings: core.endings || [],
        branches: core.branches || [],
        notes: core.notes || "",
      };
      await upsertGamePlanMeta(project.id, coreMeta);
      // Cập nhật state NGAY (không đợi load() ở cuối) — để bảng cảnh báo logic
      // và preview bộ cốt lõi có dữ liệu để rà ngay khi vừa trích xong, trước
      // khi dàn cảnh bắt đầu được viết.
      setMeta((m) => ({ ...m, ...coreMeta }));

      for (const b of branches) await deleteGamePlanBranch(b.id).catch(() => {});
      const newBranches = core.branches || [];
      for (let i = 0; i < newBranches.length; i++) {
        const br = newBranches[i];
        await createGamePlanBranch({
          project_id: project.id,
          branch_index: i,
          name: br.name || `Nhánh ${i + 1}`,
          description: br.description || "",
          scene_order_ids: [],
          status: "nháp",
        });
      }

      for (const s of scenes) await deleteGamePlanScene(s.id).catch(() => {});

      const total = Math.max(5, Math.min(120, Number(project.scene_count) || 50));
      const choicesPer = Math.max(1, Math.min(6, Number(project.choices_per_scene) || 3));
      const branchCount = Math.max(2, Number(project.branch_count) || 4);
      const coreBlock = formatCoreBlock(core);
      const allScenes = [];
      let order = 1;

      while (order <= total) {
        const count = Math.min(CHUNK, total - order + 1);
        setProgress(`Đang dựng dàn cảnh ${order}–${order + count - 1}/${total}...`);
        const prevSummary = allScenes
          .slice(-6)
          .map((s) => `${s.scene_order}. ${s.title}: ${(s.description || "").slice(0, 120)}`)
          .join("\n");
        const chunk = await aiCall(
          buildPlanScenesChunkPrompt({
            workshop: project.workshop,
            idea: project.idea,
            coreBlock,
            branchCount,
            choicesPerScene: choicesPer,
            startOrder: order,
            count,
            totalScenes: total,
            prevScenesSummary: prevSummary,
          }),
          { jsonSchema: PLAN_SCENES_CHUNK_SCHEMA }
        );
        const list = chunk?.scenes || [];
        for (let i = 0; i < list.length && order <= total; i++) {
          const sc = list[i];
          await createGamePlanScene({
            project_id: project.id,
            scene_order: order,
            title: sc.title || `Cảnh ${order}`,
            description: sc.description || "",
            location: sc.location || "",
            characters: sc.characters || "",
            foreshadow: sc.foreshadow || "",
            choices: sc.choices || [],
            is_branch_point: !!sc.is_branch_point,
            branch_index: sc.branch_index ?? null,
            status: "nháp",
          });
          allScenes.push({
            scene_order: order, title: sc.title, description: sc.description,
            location: sc.location, characters: sc.characters, foreshadow: sc.foreshadow,
            choices: sc.choices || [], is_branch_point: !!sc.is_branch_point, branch_index: sc.branch_index ?? null,
          });
          order++;
        }
        // Cập nhật danh sách cảnh NGAY sau mỗi lô — người viết thấy cảnh xuất
        // hiện dần và cảnh báo logic (nhánh thiếu điểm rẽ, trùng số cảnh...)
        // được rà lại ngay, không phải đợi dựng xong hết mới biết.
        setScenes([...allScenes]);
        if (!list.length) break;
      }

      setProgress("");
      await load();
    } catch (e) {
      setError("AI phát triển bộ khung lỗi: " + (e?.message || "lỗi"));
      setProgress("");
    } finally {
      setGenerating(false);
    }
  };

  // "Thêm cảnh" — kịch bản đã dựng xong nhưng thấy ít cảnh quá thì nối thêm
  // NGAY, không phải xoá đi dựng lại từ đầu (mất hết chỉnh sửa đã có).
  const handleAddScenes = async () => {
    const extra = Math.max(1, Math.min(60, Number(addCount) || 0));
    if (!scenes.length) return;
    setError("");
    setAddingScenes(true);
    try {
      const startOrder = Math.max(...scenes.map((s) => s.scene_order)) + 1;
      const newTotal = startOrder - 1 + extra;
      const choicesPer = Math.max(1, Math.min(6, Number(project.choices_per_scene) || 3));
      const branchCount = Math.max(2, Number(project.branch_count) || 4);
      const coreBlock = formatCoreBlock(meta);
      const base = scenes;
      const added = [];
      let order = startOrder;
      const target = startOrder - 1 + extra;
      while (order <= target) {
        const count = Math.min(CHUNK, target - order + 1);
        setProgress(`Đang thêm cảnh ${order}–${order + count - 1}/${target}...`);
        const prevSummary = scenes
          .slice(-6)
          .map((s) => `${s.scene_order}. ${s.title}: ${(s.description || "").slice(0, 120)}`)
          .join("\n");
        const chunk = await aiCall(
          buildPlanScenesChunkPrompt({
            workshop: project.workshop, idea: project.idea, coreBlock, branchCount,
            choicesPerScene: choicesPer, startOrder: order, count, totalScenes: target, prevScenesSummary: prevSummary,
          }),
          { jsonSchema: PLAN_SCENES_CHUNK_SCHEMA }
        );
        const list = chunk?.scenes || [];
        for (let i = 0; i < list.length && order <= target; i++) {
          const sc = list[i];
          const row = await createGamePlanScene({
            project_id: project.id, scene_order: order, title: sc.title || `Cảnh ${order}`,
            description: sc.description || "", location: sc.location || "", characters: sc.characters || "",
            foreshadow: sc.foreshadow || "", choices: sc.choices || [], is_branch_point: !!sc.is_branch_point,
            branch_index: sc.branch_index ?? null, status: "nháp",
          });
          added.push(row);
          order++;
        }
        setScenes([...base, ...added]);
        if (!list.length) break;
      }
      await patchProject({ scene_count: newTotal });
      setProgress("");
      await load();
    } catch (e) {
      setError("Thêm cảnh lỗi: " + (e?.message || "lỗi"));
      setProgress("");
    } finally {
      setAddingScenes(false);
    }
  };

  const handleSaveMetaSection = async (section, value) => {
    const next = { ...meta, [section]: value };
    setMeta(next);
    await upsertGamePlanMeta(project.id, next).catch((e) => setError("Lưu bộ khung lỗi: " + e.message));
    setEditMetaSection(null);
  };

  const updateScene = async (id, patch) => {
    setScenes((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    try {
      await updateGamePlanScene(id, patch);
    } catch (e) {
      setError("Lưu cảnh lỗi: " + e.message);
    }
  };

  const hasContent = !!meta && (meta.characters?.length || scenes.length);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-16 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Đang tải bộ khung...
      </div>
    );
  }

  const branchPoints = scenes.filter((s) => s.is_branch_point);
  const ideaPreview = (project.idea || "").trim();

  return (
    <div className="space-y-5">
      {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>}
      {progress && (
        <div className="text-sm text-primary bg-primary/10 rounded-lg px-3 py-2 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" /> {progress}
        </div>
      )}

      {/* Rà lỗi logic SỐNG — cập nhật ngay khi AI đang dựng dàn cảnh hoặc khi
          tự tay sửa, không phải đợi ghép xong kịch bản mới biết thiếu logic. */}
      {!!planWarnings.length && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/5 p-3 text-xs">
          <div className="font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <ListChecks className="w-4 h-4" /> {planWarnings.length} điểm thiếu logic cần xem lại{generating ? " (đang rà theo thời gian thực)" : ""}
          </div>
          <ul className="mt-1.5 list-disc pl-5 space-y-1 text-amber-700 dark:text-amber-400">
            {planWarnings.slice(0, 15).map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Luôn hiện ý tưởng đang dùng — để biết AI bám gì */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">📌</span>
          <h4 className="font-display font-semibold text-sm">Ý tưởng nguồn (AI bắt buộc bám sát)</h4>
          {!ideaOk && (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" /> Trống — quay lại bước Ý Tưởng
            </span>
          )}
        </div>
        {ideaOk ? (
          <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed font-sans">
            {ideaPreview.slice(0, 4000)}
            {ideaPreview.length > 4000 ? "\n…(còn nữa)" : ""}
          </pre>
        ) : (
          <p className="text-xs text-destructive">Chưa có ý tưởng. Không thể dựng bộ khung đúng.</p>
        )}
      </div>

      {!hasContent ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Wand2 className="w-8 h-8 text-primary mx-auto mb-3" />
          <h3 className="font-display font-semibold text-lg">Phát triển bộ khung từ ý tưởng</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl mx-auto">
            AI sẽ: (1) trích nhân vật/tuyến/kết thúc đúng tên trong ý tưởng, (2) dựng dàn {project.scene_count} cảnh theo lô — không bịa thế giới khác.
            Xưởng: <b>{WORKSHOPS[project.workshop]?.label}</b>.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !ideaOk}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {generating ? "Đang phát triển..." : "AI phát triển bộ khung từ ý tưởng"}
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-2">
            <h4 className="font-display font-semibold text-sm">🎮 Player & nhiệm vụ (trích từ ý tưởng)</h4>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[11px] text-muted-foreground">Nhân vật nhập vai</div>
                <p className="font-medium">{project.player_name || "—"}</p>
                {project.player_desc && <p className="text-xs text-muted-foreground mt-0.5">{project.player_desc}</p>}
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Nhiệm vụ chính</div>
                <p>{project.main_quest || "—"}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !ideaOk}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-primary/40 text-primary text-xs hover:bg-primary/10 disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {generating ? "Đang dựng lại..." : "Dựng lại từ ý tưởng"}
            </button>
            <span className="text-xs text-muted-foreground">
              {scenes.length} cảnh · {branchPoints.length} điểm rẽ · {branches.length} nhánh
            </span>
          </div>

          <MetaCard
            title="Nhân vật"
            icon="👤"
            items={(meta?.characters || []).map(
              (c) => `${c.name}${c.role ? ` (${c.role})` : ""} — ${c.personality || ""} ${c.motive ? `· ${c.motive}` : ""}`
            )}
            editing={editMetaSection === "characters"}
            onEdit={() => setEditMetaSection(editMetaSection === "characters" ? null : "characters")}
            onSave={(v) => handleSaveMetaSection("characters", v)}
            meta={meta}
            field="characters"
            workshop={project.workshop}
            idea={project.idea}
            title2={project.title}
          />
          <MetaCard
            title="Bối cảnh / Địa điểm"
            icon="🗺️"
            items={(meta?.settings || []).map((s) => `${s.name} — ${s.description || ""}`)}
            editing={editMetaSection === "settings"}
            onEdit={() => setEditMetaSection(editMetaSection === "settings" ? null : "settings")}
            onSave={(v) => handleSaveMetaSection("settings", v)}
            meta={meta}
            field="settings"
            workshop={project.workshop}
            idea={project.idea}
            title2={project.title}
          />
          <MetaCard
            title="Kết thúc dự kiến"
            icon="🏁"
            items={(meta?.endings || []).map((e) => `${e.name} [${e.type || "NORMAL_END"}] — ${e.description || ""}`)}
            editing={editMetaSection === "endings"}
            onEdit={() => setEditMetaSection(editMetaSection === "endings" ? null : "endings")}
            onSave={(v) => handleSaveMetaSection("endings", v)}
            meta={meta}
            field="endings"
            workshop={project.workshop}
            idea={project.idea}
            title2={project.title}
          />
          <MetaCard
            title="Nhánh truyện"
            icon="🛤️"
            items={(meta?.branches || []).map((b) => `${b.name} — ${b.description || ""}`)}
            editing={editMetaSection === "branches"}
            onEdit={() => setEditMetaSection(editMetaSection === "branches" ? null : "branches")}
            onSave={(v) => handleSaveMetaSection("branches", v)}
            meta={meta}
            field="branches"
            workshop={project.workshop}
            idea={project.idea}
            title2={project.title}
          />

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
              <div>
                <h3 className="font-display font-semibold text-sm">Dàn {scenes.length} cảnh</h3>
                <p className="text-[11px] text-muted-foreground">Chỉnh sửa tiêu đề/mô tả/lựa chọn trước khi viết nhánh</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <input
                  type="number" min={1} max={60} value={addCount}
                  onChange={(e) => setAddCount(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                  className="w-14 rounded-md border border-input bg-background px-1.5 py-1 text-xs"
                />
                <button
                  type="button" onClick={handleAddScenes} disabled={addingScenes || generating || !scenes.length}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-primary/40 text-primary text-[11px] hover:bg-primary/10 disabled:opacity-50"
                  title="Thấy ít cảnh quá thì nối thêm ngay, không cần dựng lại từ đầu"
                >
                  {addingScenes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Thêm cảnh
                </button>
              </div>
            </div>
            <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {scenes.map((s) => (
                <SceneEditor
                  key={s.id || s.scene_order}
                  scene={s}
                  onChange={(patch) => updateScene(s.id, patch)}
                  branchCount={project.branch_count}
                  readOnly={generating || !s.id}
                  workshop={project.workshop}
                  idea={project.idea}
                  coreBlock={formatCoreBlock(meta)}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button type="button" onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">
              <ArrowLeft className="w-4 h-4" /> Quay lại Ý tưởng
            </button>
            <button
              type="button"
              onClick={() => patchProject({ status: "plan" }).then(onNext)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              <CheckCircle2 className="w-4 h-4" /> Đã duyệt — Viết nhánh
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MetaCard({ title, icon, items, editing, onEdit, onSave, meta, field, workshop, idea, title2 }) {
  const [text, setText] = useState(JSON.stringify(meta?.[field] || [], null, 2));
  const [error, setError] = useState("");

  useEffect(() => {
    setText(JSON.stringify(meta?.[field] || [], null, 2));
  }, [meta, field]);

  const handleSave = () => {
    try {
      onSave(JSON.parse(text));
    } catch (e) {
      setError("JSON không hợp lệ: " + e.message);
    }
  };

  const handleAiRevise = async (feedback) => {
    const res = await aiCall(
      buildCoreSectionRevisionPrompt({ workshop, idea, title: title2, section: field, currentValue: meta?.[field] || [], feedback }),
      { jsonSchema: coreSectionRevisionSchema(field) }
    );
    onSave(res?.items || []);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <h4 className="font-display font-semibold text-sm">{title}</h4>
        <button type="button" onClick={onEdit} className="ml-auto text-[11px] text-primary hover:underline">
          {editing ? "Đóng" : (
            <>
              <Pencil className="w-3 h-3 inline" /> Chỉnh sửa
            </>
          )}
        </button>
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea value={text} onChange={(e) => { setText(e.target.value); setError(""); }} rows={8} className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono" />
          {error && <p className="text-[11px] text-destructive">{error}</p>}
          <button type="button" onClick={handleSave} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px]">
            <Save className="w-3 h-3" /> Lưu
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">(trống)</p>
          ) : (
            items.map((it, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                • {it}
              </p>
            ))
          )}
        </div>
      )}
      {!editing && <div className="mt-2"><AiReviseBox onRevise={handleAiRevise} label={`Nhờ AI sửa ${title.toLowerCase()}`} placeholder={field === "endings" ? "VD: đổi kết thúc nhánh 2 thành bi kịch, thêm 1 kết thúc ẩn..." : "Góp ý sửa..."} /></div>}
    </div>
  );
}

function SceneEditor({ scene, onChange, branchCount, readOnly, workshop, idea, coreBlock }) {
  const [choices, setChoices] = useState(scene.choices || []);
  const [showChoices, setShowChoices] = useState(false);

  useEffect(() => {
    setChoices(scene.choices || []);
  }, [scene.id, scene.choices]);

  const updateChoice = (i, key, value) => {
    const next = choices.map((c, ci) => (ci === i ? { ...c, [key]: value } : c));
    setChoices(next);
    onChange({ choices: next });
  };

  const handleAiRevise = async (feedback) => {
    const res = await aiCall(
      buildPlanSceneRevisionPrompt({ workshop, idea, coreBlock, scene, feedback }),
      { jsonSchema: PLAN_SCENE_REVISION_SCHEMA }
    );
    onChange({
      title: res.title || scene.title, description: res.description || scene.description,
      location: res.location ?? scene.location, characters: res.characters ?? scene.characters,
      foreshadow: res.foreshadow ?? scene.foreshadow, choices: res.choices || scene.choices,
    });
    setChoices(res.choices || scene.choices || []);
  };

  return (
    <div className={`rounded-xl border p-3 ${scene.is_branch_point ? "border-amber-400/50 bg-amber-500/5" : "border-border bg-muted/10"}`}>
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-mono text-muted-foreground mt-1 w-7 shrink-0">#{scene.scene_order}</span>
        <div className="flex-1 min-w-0 space-y-2">
          <input
            value={scene.title}
            disabled={readOnly}
            onChange={(e) => onChange({ title: e.target.value })}
            className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium focus:border-input focus:bg-background disabled:opacity-60"
          />
          <textarea
            value={scene.description}
            disabled={readOnly}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs resize-y disabled:opacity-60"
          />
          <div className="grid sm:grid-cols-3 gap-2">
            <input disabled={readOnly} value={scene.location || ""} onChange={(e) => onChange({ location: e.target.value })} placeholder="Địa điểm" className="rounded-md border border-input bg-transparent px-2 py-1 text-xs disabled:opacity-60" />
            <input disabled={readOnly} value={scene.characters || ""} onChange={(e) => onChange({ characters: e.target.value })} placeholder="Nhân vật" className="rounded-md border border-input bg-transparent px-2 py-1 text-xs disabled:opacity-60" />
            <input disabled={readOnly} value={scene.foreshadow || ""} onChange={(e) => onChange({ foreshadow: e.target.value })} placeholder="Phục bút" className="rounded-md border border-input bg-transparent px-2 py-1 text-xs disabled:opacity-60" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input type="checkbox" disabled={readOnly} checked={!!scene.is_branch_point} onChange={(e) => onChange({ is_branch_point: e.target.checked })} />
              Điểm rẽ nhánh
            </label>
            {scene.is_branch_point && (
              <select disabled={readOnly} value={scene.branch_index ?? 0} onChange={(e) => onChange({ branch_index: Number(e.target.value) })} className="rounded-md border border-input bg-background px-1.5 py-0.5 text-[11px]">
                {Array.from({ length: branchCount || 4 }, (_, i) => (
                  <option key={i} value={i}>
                    Nhánh {i + 1}
                  </option>
                ))}
              </select>
            )}
            <button type="button" onClick={() => setShowChoices((s) => !s)} className="text-[11px] text-primary hover:underline">
              {showChoices ? "Đóng lựa chọn" : `Lựa chọn (${choices.length})`}
            </button>
          </div>
          {showChoices && (
            <div className="space-y-1.5">
              {choices.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input disabled={readOnly} value={c.text || ""} onChange={(e) => updateChoice(i, "text", e.target.value)} placeholder="Lựa chọn" className="flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs disabled:opacity-60" />
                  <input disabled={readOnly} value={c.effect || ""} onChange={(e) => updateChoice(i, "effect", e.target.value)} placeholder="Hiệu ứng" className="w-36 rounded-md border border-input bg-transparent px-2 py-1 text-xs disabled:opacity-60" />
                  <input disabled={readOnly} value={c.target || ""} onChange={(e) => updateChoice(i, "target", e.target.value)} placeholder="Đích" className="w-32 rounded-md border border-input bg-transparent px-2 py-1 text-xs disabled:opacity-60" />
                </div>
              ))}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    const next = [...choices, { text: "", effect: "", target: "" }];
                    setChoices(next);
                    onChange({ choices: next });
                  }}
                  className="text-[11px] text-primary hover:underline"
                >
                  + Thêm lựa chọn
                </button>
              )}
            </div>
          )}
          {!readOnly && <AiReviseBox onRevise={handleAiRevise} label="Nhờ AI sửa cảnh này" placeholder="VD: cảnh này rời rạc quá, thêm kịch tính / đổi lựa chọn B thành..." />}
        </div>
      </div>
    </div>
  );
}
