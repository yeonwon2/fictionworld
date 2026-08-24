import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Wand2, CheckCircle2, ArrowLeft, Pencil, Save, AlertTriangle, Plus, ListChecks, PlayCircle, Wrench } from "lucide-react";
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
  buildImportedCorePrompt,
  buildImportedContractsPrompt,
  IMPORTED_CONTRACTS_SCHEMA,
} from "@/lib/gameScriptProject/prompts";
import { compileNarrativePlan, repairNarrativePlan, simulateNarrativeRoutes } from "@/lib/gameScriptProject/narrativeCompiler";
import { analyzeNarrativeContinuity } from "@/lib/gameScriptProject/continuityChecker";
import { analyzeStatefulNarrative } from "@/lib/gameScriptProject/statefulCompiler";
import { analyzePhase3Narrative } from "@/lib/gameScriptProject/phase3Analyzer";
import { estimateGeminiCalls } from "@/lib/gameScriptProject/quotaPlanner";
import { getAIUsageToday } from "@/lib/aiCall";
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
  const [compilerReport, setCompilerReport] = useState(null);
  const [addingScenes, setAddingScenes] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [showRoutes, setShowRoutes] = useState(false);
  const [repairSummary, setRepairSummary] = useState("");
  const [addCount, setAddCount] = useState(8);
  const [analyzingImported, setAnalyzingImported] = useState(false);
  const [repairingFinding, setRepairingFinding] = useState("");

  const ideaOk = !!String(project.idea || "").trim();
  const isImported = String(project.notes || "").includes("[IMPORTED_SCRIPT]");
  const playRoutes = useMemo(() => simulateNarrativeRoutes({ scenes, maxRoutes: 24 }), [scenes]);
  const qualityReport = useMemo(() => analyzeNarrativeContinuity({ project, meta, scenes }), [project, meta, scenes]);
  const statefulReport = useMemo(() => analyzeStatefulNarrative({ project, meta, scenes }), [project, meta, scenes]);
  const phase3Report = useMemo(() => analyzePhase3Narrative({ project, meta, scenes }), [project, meta, scenes]);
  const quotaEstimate = estimateGeminiCalls({ sceneCount: project.scene_count, branchCount: project.branch_count, existingScenes: scenes.length });
  const usageToday = getAIUsageToday();
  const importedNeedsCore = isImported && (!meta?.characters?.length || !meta?.settings?.length);
  const importedMissingContracts = isImported ? scenes.filter((scene) => !scene.state_contract || !Object.keys(scene.state_contract).length) : [];
  const importedAnalysisCalls = (importedNeedsCore ? 1 : 0) + Math.ceil(importedMissingContracts.length / CHUNK);

  // Rà lỗi logic NGAY khi dữ liệu thay đổi — trong lúc AI đang dựng dàn cảnh
  // (scenes/meta được cập nhật DẦN trong handleGenerate, không đợi xong hết)
  // lẫn khi tác giả tự tay sửa sau đó. "complete" chỉ bật khi không còn đang
  // sinh dở, tránh báo nhầm lúc dữ liệu chưa đầy đủ.
  useEffect(() => {
    if (!scenes.length && !meta?.characters?.length) { setPlanWarnings([]); return; }
    const report = compileNarrativePlan({ project, meta, scenes, complete: !generating && !addingScenes });
    setCompilerReport(report);
    setPlanWarnings(report.issues.map((x) => x.message));

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
        invariants: core.invariants || [],
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
            state_contract: sc.state_contract || {},
            chapter_index: Number(sc.chapter_index) || Math.floor((order - 1) / 12) + 1,
            is_checkpoint: !!sc.is_checkpoint || (order - 1) % 12 === 0,
            choices: sc.choices || [],
            is_branch_point: !!sc.is_branch_point,
            branch_index: sc.branch_index ?? null,
            status: "nháp",
          });
          allScenes.push({
            scene_order: order, title: sc.title, description: sc.description,
            location: sc.location, characters: sc.characters, foreshadow: sc.foreshadow,
            state_contract: sc.state_contract || {},
            chapter_index: Number(sc.chapter_index) || Math.floor((order - 1) / 12) + 1,
            is_checkpoint: !!sc.is_checkpoint || (order - 1) % 12 === 0,
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
            state_contract: sc.state_contract || {},
            chapter_index: Number(sc.chapter_index) || Math.floor((order - 1) / 12) + 1,
            is_checkpoint: !!sc.is_checkpoint || (order - 1) % 12 === 0,
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

  const resumeMissingScenes = async () => {
    const target = Math.max(5, Math.min(120, Number(project.scene_count) || 50));
    const existingOrders = new Set(scenes.map((s) => Number(s.scene_order)));
    let order = Math.max(0, ...existingOrders) + 1;
    if (order > target) return;
    setAddingScenes(true); setError("");
    try {
      const choicesPer = Math.max(1, Math.min(6, Number(project.choices_per_scene) || 3));
      const branchCount = Math.max(2, Number(project.branch_count) || 4);
      const added = [];
      while (order <= target) {
        const count = Math.min(CHUNK, target - order + 1);
        setProgress(`Tiếp tục dàn cảnh ${order}–${order + count - 1}/${target} · giữ nguyên phần đã có...`);
        const prevSummary = [...scenes, ...added].slice(-6).map((s) => `${s.scene_order}. ${s.title}: ${(s.description || "").slice(0, 120)}`).join("\n");
        const chunk = await aiCall(buildPlanScenesChunkPrompt({ workshop: project.workshop, idea: project.idea, coreBlock: formatCoreBlock(meta), branchCount, choicesPerScene: choicesPer, startOrder: order, count, totalScenes: target, prevScenesSummary: prevSummary }), { jsonSchema: PLAN_SCENES_CHUNK_SCHEMA });
        const rows = chunk?.scenes || [];
        for (const sc of rows) {
          if (order > target || existingOrders.has(order)) { order++; continue; }
          const row = await createGamePlanScene({ project_id: project.id, scene_order: order, title: sc.title || `Cảnh ${order}`, description: sc.description || "", location: sc.location || "", characters: sc.characters || "", foreshadow: sc.foreshadow || "", state_contract: sc.state_contract || {}, chapter_index: Number(sc.chapter_index) || Math.floor((order - 1) / 12) + 1, is_checkpoint: !!sc.is_checkpoint || (order - 1) % 12 === 0, choices: sc.choices || [], is_branch_point: !!sc.is_branch_point, branch_index: sc.branch_index ?? null, status: "nháp" });
          added.push(row); existingOrders.add(order); order++;
        }
        setScenes([...scenes, ...added]);
        if (!rows.length) break;
      }
      setProgress(""); await load();
    } catch (e) { setError("Tạm dừng khi hết quota/lỗi mạng: " + (e?.message || "lỗi")); }
    finally { setAddingScenes(false); }
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

  const sceneIdFromFinding = (finding) => Number(finding?.sceneId)
    || Number(String(finding?.message || "").match(/cảnh\s+(\d+)/i)?.[1])
    || Number([...(finding?.route || [])].reverse().map((step) => String(step).match(/^C(\d+)$/)?.[1]).find(Boolean))
    || null;

  const repairFindingWithAI = async (finding) => {
    const sceneOrder = sceneIdFromFinding(finding);
    const scene = scenes.find((item) => Number(item.scene_order) === sceneOrder);
    if (!scene) { setError("Phát hiện này liên quan toàn dự án, không thể quy về một cảnh duy nhất."); return; }
    const key = `${finding.code || "issue"}-${sceneOrder}`;
    setRepairingFinding(key); setError("");
    try {
      const res = await aiCall(buildPlanSceneRevisionPrompt({
        workshop: project.workshop, idea: project.idea, coreBlock: formatCoreBlock(meta), scene,
        feedback: `Sửa đúng lỗi kiểm thử sau: ${finding.message}. Giữ nguyên cốt truyện và văn phong; chỉ thay những dữ liệu/lựa chọn cần thiết để lỗi biến mất, đồng thời đồng bộ state_contract.`,
      }), { jsonSchema: PLAN_SCENE_REVISION_SCHEMA, forceRefresh: true });
      await updateScene(scene.id, {
        title: res.title || scene.title, description: res.description || scene.description,
        location: res.location ?? scene.location, characters: res.characters ?? scene.characters,
        foreshadow: res.foreshadow ?? scene.foreshadow, choices: res.choices || scene.choices,
        state_contract: res.state_contract || scene.state_contract || {},
      });
      setRepairSummary(`AI đã sửa bộ khung cảnh ${sceneOrder} theo lỗi “${finding.message}”. Báo cáo đã được chạy lại.`);
    } finally { setRepairingFinding(""); }
  };

  const analyzeImportedScript = async () => {
    if (!isImported || !scenes.length) return;
    if (!importedAnalysisCalls) { setRepairSummary("Game Bible và scene contract đã đầy đủ; không cần gọi thêm AI."); return; }
    setAnalyzingImported(true); setError("");
    try {
      let core = meta;
      if (importedNeedsCore) {
        setProgress("Đang đọc toàn bộ kịch bản để lập Game Bible (1 lượt AI)...");
        core = await aiCall(buildImportedCorePrompt({
          workshop: project.workshop, title: project.title, genre: project.genre, scenes,
          endings: meta?.endings || [], playerName: project.player_name, mainQuest: project.main_quest,
        }), { jsonSchema: PLAN_CORE_SCHEMA });
      }
      const coreMeta = {
        ...meta,
        characters: core.characters || meta?.characters || [], settings: core.settings || meta?.settings || [],
        endings: meta?.endings?.length ? meta.endings : (core.endings || []),
        branches: meta?.branches?.length ? meta.branches : [{ name: "Kịch bản gốc", description: "Toàn bộ nội dung từ bản nhập." }],
        notes: core.notes || meta?.notes || "", invariants: core.invariants || [],
      };
      await patchProject({ player_name: core.player_name || project.player_name, player_desc: core.player_desc || project.player_desc, main_quest: core.main_quest || project.main_quest });
      await upsertGamePlanMeta(project.id, coreMeta);
      setMeta(coreMeta);

      const updated = [...scenes];
      const pendingScenes = importedMissingContracts;
      for (let index = 0; index < pendingScenes.length; index += CHUNK) {
        const chunk = pendingScenes.slice(index, index + CHUNK);
        setProgress(`Đang tạo scene contract còn thiếu ${index + 1}–${Math.min(index + CHUNK, pendingScenes.length)}/${pendingScenes.length}...`);
        const firstPosition = scenes.findIndex((scene) => scene.id === chunk[0]?.id);
        const result = await aiCall(buildImportedContractsPrompt({
          workshop: project.workshop, title: project.title, coreBlock: formatCoreBlock(coreMeta), scenes: chunk,
          previousScenes: scenes.slice(Math.max(0, firstPosition - 2), firstPosition),
        }), { jsonSchema: IMPORTED_CONTRACTS_SCHEMA });
        for (const contract of result?.scenes || []) {
          const position = updated.findIndex((scene) => Number(scene.scene_order) === Number(contract.scene_order));
          if (position < 0) continue;
          const original = updated[position];
          const patch = {
            location: contract.location ?? original.location, characters: contract.characters ?? original.characters,
            foreshadow: contract.foreshadow ?? original.foreshadow,
            state_contract: contract.state_contract || original.state_contract || {},
            chapter_index: Number(contract.chapter_index) || original.chapter_index || Math.floor(position / 12) + 1,
            is_checkpoint: !!contract.is_checkpoint || position === 0,
          };
          await updateGamePlanScene(original.id, patch);
          updated[position] = { ...original, ...patch };
        }
        setScenes([...updated]);
      }
      setProgress("");
      await load();
      setRepairSummary(`Đã hoàn thiện Game Bible và scene contract cho ${scenes.length} cảnh mà không thay nội dung gốc.`);
    } catch (e) {
      setError("Phân tích kịch bản nhập bị dừng: " + (e?.message || "lỗi") + ". Phần đã hoàn thành vẫn được giữ để tiếp tục sau.");
      setProgress("");
    } finally { setAnalyzingImported(false); }
  };

  const hasContent = !!meta && (meta.characters?.length || scenes.length);

  const saveCompilerSnapshot = async () => {
    if (!compilerReport) return;
    const snapshot = {
      game_bible: compilerReport.bible,
      scene_contracts: compilerReport.contracts,
      compiler_report: { version: 3, ok: compilerReport.ok && statefulReport.ok, publish_ready: phase3Report.publishReady, issues: compilerReport.issues, summary: compilerReport.summary, quality: qualityReport, stateful: { version: statefulReport.version, ok: statefulReport.ok, issues: statefulReport.issues, summary: statefulReport.summary }, phase3: phase3Report, compiled_at: new Date().toISOString() },
    };
    setMeta((current) => ({ ...current, ...snapshot }));
    await upsertGamePlanMeta(project.id, { ...meta, ...snapshot }).catch((e) => setError("Lưu kết quả compiler lỗi: " + e.message));
  };

  const approvePlan = async () => {
    if (!compilerReport?.ok || !statefulReport.ok) {
      setError(`Bộ khung còn ${compilerReport?.summary.errors || 0} lỗi logic. Hãy sửa các lỗi màu đỏ trước khi viết nhánh.`);
      return;
    }
    await saveCompilerSnapshot();
    await patchProject({ status: "plan" });
    onNext();
  };

  const repairGraph = async () => {
    setRepairing(true); setError(""); setRepairSummary("");
    try {
      const result = repairNarrativePlan({ scenes, meta });
      if (!result.changes.length) { setRepairSummary("Không có liên kết cấu trúc nào có thể sửa tự động an toàn."); return; }
      const originalByOrder = new Map(scenes.map((scene) => [Number(scene.scene_order), scene]));
      await Promise.all(result.scenes.map((scene) => {
        const original = originalByOrder.get(Number(scene.scene_order));
        if (!original?.id || JSON.stringify(original.choices || []) === JSON.stringify(scene.choices || [])) return Promise.resolve();
        return updateGamePlanScene(original.id, { choices: scene.choices || [] });
      }));
      setScenes(result.scenes);
      setRepairSummary(`Đã sửa ${result.changes.length} liên kết: ${result.changes.slice(0, 5).map((change) => `cảnh ${change.sceneId} → ${change.to}`).join("; ")}${result.changes.length > 5 ? "…" : ""}`);
    } catch (e) { setError("Tự sửa Story Graph lỗi: " + (e?.message || "lỗi")); }
    finally { setRepairing(false); }
  };

  const FindingFixButton = ({ finding }) => {
    const sceneOrder = sceneIdFromFinding(finding);
    if (!sceneOrder) return null;
    const key = `${finding.code || "issue"}-${sceneOrder}`;
    return (
      <button type="button" onClick={() => repairFindingWithAI(finding)} disabled={!!repairingFinding || analyzingImported} className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-primary/30 px-2 py-1 text-[10px] text-primary hover:bg-primary/10 disabled:opacity-50">
        {repairingFinding === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} AI sửa cảnh {sceneOrder}
      </button>
    );
  };

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
      {!!compilerReport && !!scenes.length && (
        <div className={`rounded-xl border p-3 text-xs ${compilerReport.ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"}`}>
          <div className="flex items-center gap-2 font-semibold">
            <ListChecks className="w-4 h-4" />
            Narrative compiler: {compilerReport.summary.reachableScenes}/{compilerReport.summary.scenes} cảnh tới được · {compilerReport.summary.reachableEndings}/{compilerReport.summary.endings} kết thúc được nối · {compilerReport.summary.errors} lỗi · {compilerReport.summary.warnings} cảnh báo
            <div className="ml-auto flex items-center gap-1.5">
              {!compilerReport.ok && <button type="button" onClick={repairGraph} disabled={repairing} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50">{repairing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />} Sửa liên kết an toàn</button>}
              <button type="button" onClick={() => setShowRoutes((value) => !value)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border hover:bg-muted"><PlayCircle className="w-3 h-3" /> {showRoutes ? "Đóng mô phỏng" : "Chạy thử tuyến"}</button>
              <button type="button" onClick={saveCompilerSnapshot} className="px-2.5 py-1.5 rounded-md border border-border hover:bg-muted">Lưu Game Bible & contract</button>
            </div>
          </div>
          <p className="mt-1 text-muted-foreground">Game Bible và scene contract là dữ liệu nội bộ; file xuất sang Xưởng Game vẫn giữ nguyên cú pháp cũ.</p>
          {repairSummary && <p className="mt-2 rounded-md bg-primary/10 text-primary px-2 py-1.5">{repairSummary}</p>}
          {showRoutes && (
            <div className="mt-3 border-t border-border pt-2">
              <div className="font-semibold mb-1.5">Preview {playRoutes.length} tuyến đại diện</div>
              <div className="grid md:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                {playRoutes.map((route, index) => (
                  <div key={index} className="rounded-md border border-border bg-background/60 p-2">
                    <div className={`font-medium ${route.status === "ending" ? "text-emerald-600" : "text-destructive"}`}>Tuyến {index + 1}: {route.ending}</div>
                    <div className="mt-1 text-muted-foreground leading-relaxed">{route.steps.map((step) => `C${step.sceneId}${step.choice ? ` [${step.choice}]` : ""}`).join(" → ")}</div>
                  </div>
                ))}
                {!playRoutes.length && <p className="text-muted-foreground">Chưa có cảnh để mô phỏng.</p>}
              </div>
            </div>
          )}
        </div>
      )}
      {!!scenes.length && (
        <details className={`rounded-xl border p-3 text-xs ${phase3Report.publishReady ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-400/40 bg-amber-500/5"}`}>
          <summary className="cursor-pointer font-semibold flex items-center gap-2">
            <ListChecks className="w-4 h-4" /> Phase 3 · {phase3Report.score}/100 · {phase3Report.summary.chapters} chương · phủ {phase3Report.coverage.scenePercent}% cảnh / {phase3Report.coverage.choicePercent}% lựa chọn
            <span className="ml-auto text-muted-foreground font-normal">{phase3Report.publishReady ? "Đủ điều kiện xuất bản" : "Mở báo cáo"}</span>
          </summary>
          <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
            <p className="text-muted-foreground">{phase3Report.summary.checkpoints} checkpoint · {phase3Report.regressionCases.length} regression case · {phase3Report.coverage.validEndings} ending hợp lệ.</p>
            {phase3Report.findings.slice(0, 40).map((item, index) => <div key={`${item.code}-${index}`} className="rounded-md border border-border bg-background/70 p-2"><span className={item.severity === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-400"}>{item.message}</span><FindingFixButton finding={item} /></div>)}
            {!phase3Report.findings.length && <p className="text-emerald-600">Không phát hiện lựa chọn giả, ending thiếu tuyến hoặc lỗ hổng coverage.</p>}
          </div>
        </details>
      )}
      {!!scenes.length && (
        <details className={`rounded-xl border p-3 text-xs ${statefulReport.ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"}`}>
          <summary className="cursor-pointer font-semibold flex items-center gap-2">
            <PlayCircle className="w-4 h-4" /> Phase 2 · Auto-play: {statefulReport.summary.validEndings}/{statefulReport.summary.endingsReached} ending · contract {statefulReport.summary.contractsDeclared}/{statefulReport.summary.totalContracts} · {statefulReport.summary.errors} lỗi · {statefulReport.summary.warnings} cảnh báo
            <span className="ml-auto text-muted-foreground font-normal">Mở báo cáo</span>
          </summary>
          <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
            {isImported && statefulReport.summary.contractsDeclared < statefulReport.summary.totalContracts && (
              <button type="button" onClick={analyzeImportedScript} disabled={analyzingImported} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
                {analyzingImported ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} Tạo phần còn thiếu bằng AI
              </button>
            )}
            {statefulReport.issues.slice(0, 40).map((item, index) => <div key={`${item.code}-${index}`} className="rounded-md border border-border bg-background/70 p-2"><span className={item.severity === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-400"}>{item.message}</span>{item.route?.length ? <p className="mt-1 text-muted-foreground">Tuyến: {item.route.join(" → ")}</p> : null}<FindingFixButton finding={item} /></div>)}
            {!statefulReport.issues.length && <p className="text-emerald-600">Không phát hiện mâu thuẫn state, kiến thức hoặc invariant trên các tuyến đã mô phỏng.</p>}
          </div>
        </details>
      )}
      {!!scenes.length && (
        <details className={`rounded-xl border p-3 text-xs ${qualityReport.score >= 85 ? "border-emerald-500/40 bg-emerald-500/5" : qualityReport.score >= 65 ? "border-amber-400/40 bg-amber-500/5" : "border-destructive/40 bg-destructive/5"}`}>
          <summary className="cursor-pointer font-semibold flex items-center gap-2">
            <span className="inline-flex items-center justify-center rounded-full w-8 h-8 bg-background border border-border text-sm">{qualityReport.score}</span>
            Continuity & chất lượng: {qualityReport.summary.label} · {qualityReport.summary.errors} lỗi · {qualityReport.summary.warnings} cảnh báo · {qualityReport.summary.notes} ghi chú
            <span className="ml-auto text-muted-foreground font-normal">Mở báo cáo</span>
          </summary>
          <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
            {qualityReport.findings.slice(0, 30).map((item, index) => (
              <div key={`${item.code}-${index}`} className="rounded-md border border-border bg-background/70 p-2">
                <div className="flex items-center gap-2">
                  <span className={`uppercase text-[9px] font-bold ${item.severity === "error" ? "text-destructive" : item.severity === "warning" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{item.severity}</span>
                  <span>{item.message}</span>
                </div>
                {item.suggestion && <p className="mt-1 text-muted-foreground">Gợi ý: {item.suggestion}</p>}
                <FindingFixButton finding={item} />
              </div>
            ))}
            {!qualityReport.findings.length && <p className="text-emerald-600">Không phát hiện vấn đề continuity ở cấp scene contract.</p>}
          </div>
        </details>
      )}

      {/* Luôn hiện ý tưởng đang dùng — để biết AI bám gì */}
      {isImported && (
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold text-sky-700 dark:text-sky-300">Kịch bản nhập từ TXT / nội dung dán</div>
            <button type="button" onClick={analyzeImportedScript} disabled={analyzingImported || generating} className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
              {analyzingImported ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {analyzingImported ? "Đang phân tích…" : importedAnalysisCalls ? `Hoàn thiện Game Bible & contract · ${importedAnalysisCalls} lượt` : "Game Bible & contract đã đầy đủ"}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Bản gốc được giữ nguyên. Nút hoàn thiện chỉ phân tích phần còn thiếu và có thể tiếp tục sau khi hết quota; không dựng lại cảnh. Sau đó mỗi lỗi Phase có thể sửa trực tiếp bằng AI. “Dựng lại toàn bộ bằng AI” mới thay dàn cảnh đã nhập.
          </p>
        </div>
      )}

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
              onClick={() => {
                if (!isImported || window.confirm("Dựng lại sẽ thay toàn bộ dàn cảnh đã nhập. Bản TXT gốc vẫn được lưu, nhưng các chỉnh sửa trong bộ khung sẽ bị thay. Tiếp tục?")) handleGenerate();
              }}
              disabled={generating || !ideaOk}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-primary/40 text-primary text-xs hover:bg-primary/10 disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {generating ? "Đang dựng lại..." : isImported ? "Dựng lại toàn bộ bằng AI" : "Dựng lại từ ý tưởng"}
            </button>
            <span className="text-xs text-muted-foreground">
              {scenes.length} cảnh · {branchPoints.length} điểm rẽ · {branches.length} nhánh
            </span>
            {scenes.length < Number(project.scene_count) && <button type="button" onClick={resumeMissingScenes} disabled={addingScenes || generating} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-emerald-600 text-white text-xs disabled:opacity-50"><PlayCircle className="w-3.5 h-3.5" /> Tiếp tục phần còn thiếu ({quotaEstimate.total} lượt dự kiến)</button>}
          </div>
          <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">Chế độ tiết kiệm: hôm nay đã gọi Gemini {usageToday.calls} lượt, cache tránh được {usageToday.cacheHits} lượt. Ghép kịch bản cuối tốn 0 lượt.</div>

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
              onClick={approvePlan}
              disabled={!compilerReport?.ok || !statefulReport.ok}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40"
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
      state_contract: res.state_contract || scene.state_contract || {},
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
            <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">Chương <input type="number" min={1} disabled={readOnly} value={scene.chapter_index || 1} onChange={(e) => onChange({ chapter_index: Math.max(1, Number(e.target.value) || 1) })} className="w-12 rounded-md border border-input bg-background px-1.5 py-0.5" /></label>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><input type="checkbox" disabled={readOnly} checked={!!scene.is_checkpoint} onChange={(e) => onChange({ is_checkpoint: e.target.checked })} /> Checkpoint</label>
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
