import React, { useEffect, useState } from "react";
import { Loader2, Wand2, CheckCircle2, ArrowLeft, Pencil, Save } from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import { buildPlanPrompt, PLAN_SCHEMA } from "@/lib/gameScriptProject/prompts";
import { WORKSHOPS } from "@/lib/gameScriptProject/syntaxGuide";
import {
  getGamePlanMeta, upsertGamePlanMeta,
  listGamePlanScenes, createGamePlanScene, updateGamePlanScene, deleteGamePlanScene,
  listGamePlanBranches, createGamePlanBranch, deleteGamePlanBranch,
} from "@/lib/worldcrud";

// Bước 2 — AI gợi ý bộ khung (nhân vật/bối cảnh/dàn cảnh/lựa chọn/kết thúc),
// tác giả duyệt/chỉnh sửa từng phần rồi chuyển sang viết 4 nhánh.
export default function PlanStep({ project, patchProject, directionBlock, onBack, onNext }) {
  const [meta, setMeta] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [editMetaSection, setEditMetaSection] = useState(null); // 'characters'|'settings'|'endings'|'branches'|null

  const load = async () => {
    setLoading(true);
    try {
      const m = await getGamePlanMeta(project.id);
      setMeta(m || { project_id: project.id, characters: [], settings: [], endings: [], branches: [], notes: "" });
      const s = (await listGamePlanScenes(project.id)) || [];
      setScenes(s);
      const b = (await listGamePlanBranches(project.id)) || [];
      setBranches(b);
    } catch (e) {
      setError("Không tải được bộ khung: " + (e?.message || "lỗi"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
     
  }, [project.id]);

  const handleGenerate = async () => {
    setError("");
    setGenerating(true);
    try {
      const prompt = buildPlanPrompt({
        workshop: project.workshop,
        title: project.title,
        idea: project.idea,
        genre: project.genre,
        sceneCount: project.scene_count,
        choicesPerScene: project.choices_per_scene,
        branchCount: project.branch_count,
        notes: project.notes,
        directionBlock,
      });
      const res = await aiCall(prompt, { jsonSchema: PLAN_SCHEMA });

      // Lưu meta
      await upsertGamePlanMeta(project.id, {
        characters: res.characters || [],
        settings: res.settings || [],
        endings: res.endings || [],
        branches: res.branches || [],
        notes: res.notes || "",
      });

      // Xoá dàn cảnh cũ (nếu có) rồi tạo mới
      for (const s of scenes) await deleteGamePlanScene(s.id).catch(() => {});
      const newScenes = res.scenes || [];
      const savedScenes = [];
      for (let i = 0; i < newScenes.length; i++) {
        const sc = newScenes[i];
        const row = await createGamePlanScene({
          project_id: project.id,
          scene_order: i + 1,
          title: sc.title || `Cảnh ${i + 1}`,
          description: sc.description || "",
          location: sc.location || "",
          characters: sc.characters || "",
          foreshadow: sc.foreshadow || "",
          choices: sc.choices || [],
          is_branch_point: !!sc.is_branch_point,
          branch_index: sc.branch_index ?? null,
          status: "nháp",
        });
        savedScenes.push(row);
      }

      // Xoá nhánh cũ rồi tạo mới
      for (const b of branches) await deleteGamePlanBranch(b.id).catch(() => {});
      const newBranches = res.branches || [];
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

      await patchProject({ status: "plan" });
      await load();
    } catch (e) {
      setError("AI gợi ý bộ khung lỗi: " + (e?.message || "lỗi"));
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveMetaSection = async (section, value) => {
    const next = { ...meta, [section]: value };
    setMeta(next);
    await upsertGamePlanMeta(project.id, next).catch((e) => setError("Lưu bộ khung lỗi: " + e.message));
    setEditMetaSection(null);
  };

  const updateScene = async (id, patch) => {
    const next = scenes.map((s) => (s.id === id ? { ...s, ...patch } : s));
    setScenes(next);
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

  return (
    <div className="space-y-5">
      {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>}

      {!hasContent ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Wand2 className="w-8 h-8 text-primary mx-auto mb-3" />
          <h3 className="font-display font-semibold text-lg">Chưa có bộ khung</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl mx-auto">
            Bấm nút bên dưới để AI dựng <b>bộ khung</b> cho game <b>{project.title}</b> ({project.scene_count} cảnh, {project.branch_count} nhánh,
            {project.choices_per_scene} lựa chọn/cảnh) theo xưởng {WORKSHOPS[project.workshop]?.label}. Sau đó bạn duyệt, chỉnh sửa cho đúng ý.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {generating ? "AI đang dựng bộ khung..." : "AI gợi ý bộ khung"}
          </button>
        </div>
      ) : (
        <>
          {/* Thanh điều khiển */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-primary/40 text-primary text-xs hover:bg-primary/10 disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {generating ? "Đang dựng lại..." : "Dựng lại bộ khung"}
            </button>
            <span className="text-xs text-muted-foreground">
              {scenes.length} cảnh · {branchPoints.length} điểm rẽ nhánh · {branches.length} nhánh
            </span>
          </div>

          {/* Nhân vật / bối cảnh / kết thúc / nhánh */}
          <MetaCard
            title="Nhân vật"
            icon="👤"
            items={(meta?.characters || []).map((c) => `${c.name}${c.role ? ` (${c.role})` : ""} — ${c.personality || ""} ${c.motive ? `· ${c.motive}` : ""}`)}
            editing={editMetaSection === "characters"}
            onEdit={() => setEditMetaSection(editMetaSection === "characters" ? null : "characters")}
            onSave={(v) => handleSaveMetaSection("characters", v)}
            meta={meta}
            field="characters"
            setMeta={setMeta}
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
            setMeta={setMeta}
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
            setMeta={setMeta}
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
            setMeta={setMeta}
          />

          {/* Dàn cảnh */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <ListTreeIcon />
              <h3 className="font-display font-semibold text-sm">Dàn {scenes.length} cảnh</h3>
              <span className="text-[11px] text-muted-foreground">— chỉnh sửa tiêu đề/mô tả/lựa chọn, đánh dấu điểm rẽ nhánh</span>
            </div>
            <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {scenes.map((s, i) => (
                <SceneEditor key={s.id} scene={s} index={i} onChange={(patch) => updateScene(s.id, patch)} branchCount={project.branch_count} />
              ))}
            </div>
          </div>

          {/* Điều hướng */}
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">
              <ArrowLeft className="w-4 h-4" /> Quay lại Ý tưởng
            </button>
            <button
              onClick={() => patchProject({ status: "plan" }).then(onNext)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              <CheckCircle2 className="w-4 h-4" /> Đã duyệt — Viết 4 nhánh
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ListTreeIcon() {
  return (
    <svg className="w-4 h-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Thẻ hiển thị/chỉnh sửa một phần meta (nhân vật/bối cảnh/kết thúc/nhánh) dạng JSON.
function MetaCard({ title, icon, items, editing, onEdit, onSave, meta, field, setMeta }) {
  const [text, setText] = useState(JSON.stringify(meta?.[field] || [], null, 2));
  const [error, setError] = useState("");

  useEffect(() => {
    setText(JSON.stringify(meta?.[field] || [], null, 2));
  }, [meta, field]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(text);
      onSave(parsed);
    } catch (e) {
      setError("JSON không hợp lệ: " + e.message);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <h4 className="font-display font-semibold text-sm">{title}</h4>
        <button onClick={onEdit} className="ml-auto inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
          {editing ? "Đóng" : <><Pencil className="w-3 h-3" /> Chỉnh sửa</>}
        </button>
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea value={text} onChange={(e) => { setText(e.target.value); setError(""); }} rows={8} className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono" />
          {error && <p className="text-[11px] text-destructive">{error}</p>}
          <button onClick={handleSave} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] hover:opacity-90">
            <Save className="w-3 h-3" /> Lưu
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">(trống)</p>
          ) : (
            items.map((it, i) => <p key={i} className="text-xs text-muted-foreground">• {it}</p>)
          )}
        </div>
      )}
    </div>
  );
}

// Trình soạn một cảnh trong dàn tổng (kèm lựa chọn + đánh dấu điểm rẽ nhánh).
function SceneEditor({ scene, index, onChange, branchCount }) {
  const [choices, setChoices] = useState(scene.choices || []);
  const [showChoices, setShowChoices] = useState(false);

  const updateChoice = (i, key, value) => {
    const next = choices.map((c, ci) => (ci === i ? { ...c, [key]: value } : c));
    setChoices(next);
    onChange({ choices: next });
  };

  const addChoice = () => {
    const next = [...choices, { text: "", effect: "", target: "" }];
    setChoices(next);
    onChange({ choices: next });
  };

  const removeChoice = (i) => {
    const next = choices.filter((_, ci) => ci !== i);
    setChoices(next);
    onChange({ choices: next });
  };

  return (
    <div className={`rounded-xl border p-3 ${scene.is_branch_point ? "border-amber-400/50 bg-amber-500/5" : "border-border bg-muted/10"}`}>
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-mono text-muted-foreground mt-1 w-7 shrink-0">#{scene.scene_order}</span>
        <div className="flex-1 min-w-0 space-y-2">
          <input
            value={scene.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium focus:border-input focus:bg-background"
          />
          <textarea
            value={scene.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
            placeholder="Mô tả sự kiện diễn ra trong cảnh..."
            className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs resize-y"
          />
          <div className="grid sm:grid-cols-3 gap-2">
            <input value={scene.location || ""} onChange={(e) => onChange({ location: e.target.value })} placeholder="Địa điểm" className="rounded-md border border-input bg-transparent px-2 py-1 text-xs" />
            <input value={scene.characters || ""} onChange={(e) => onChange({ characters: e.target.value })} placeholder="Nhân vật" className="rounded-md border border-input bg-transparent px-2 py-1 text-xs" />
            <input value={scene.foreshadow || ""} onChange={(e) => onChange({ foreshadow: e.target.value })} placeholder="Phục bút" className="rounded-md border border-input bg-transparent px-2 py-1 text-xs" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input type="checkbox" checked={!!scene.is_branch_point} onChange={(e) => onChange({ is_branch_point: e.target.checked })} />
              Điểm rẽ nhánh
            </label>
            {scene.is_branch_point && (
              <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                Nhánh
                <select value={scene.branch_index ?? 0} onChange={(e) => onChange({ branch_index: Number(e.target.value) })} className="rounded-md border border-input bg-background px-1.5 py-0.5 text-[11px]">
                  {Array.from({ length: branchCount }, (_, i) => (
                    <option key={i} value={i}>Nhánh {i + 1}</option>
                  ))}
                </select>
              </label>
            )}
            <button onClick={() => setShowChoices((s) => !s)} className="text-[11px] text-primary hover:underline">
              {showChoices ? "Đóng lựa chọn" : `Lựa chọn (${choices.length})`}
            </button>
          </div>

          {showChoices && (
            <div className="space-y-1.5 pl-1">
              {choices.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground w-3">{i + 1}.</span>
                  <input value={c.text || ""} onChange={(e) => updateChoice(i, "text", e.target.value)} placeholder="Lựa chọn" className="flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs" />
                  <input value={c.effect || ""} onChange={(e) => updateChoice(i, "effect", e.target.value)} placeholder="Hiệu ứng" className="w-40 rounded-md border border-input bg-transparent px-2 py-1 text-xs" />
                  <input value={c.target || ""} onChange={(e) => updateChoice(i, "target", e.target.value)} placeholder="Đích (cảnh N / kết thúc)" className="w-44 rounded-md border border-input bg-transparent px-2 py-1 text-xs" />
                  <button onClick={() => removeChoice(i)} className="text-[11px] text-destructive hover:underline">x</button>
                </div>
              ))}
              <button onClick={addChoice} className="text-[11px] text-primary hover:underline">+ Thêm lựa chọn</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
