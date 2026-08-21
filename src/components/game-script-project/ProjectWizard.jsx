import React, { useEffect, useState } from "react";
import { ArrowLeft, Lightbulb, ListTree, GitBranch, FileCheck2, Loader2, Save } from "lucide-react";
import { getGameScriptProject, updateGameScriptProject } from "@/lib/worldcrud";
import { WORKSHOPS } from "@/lib/gameScriptProject/syntaxGuide";
import IdeaStep from "./steps/IdeaStep";
import PlanStep from "./steps/PlanStep";
import BranchStep from "./steps/BranchStep";
import FinalStep from "./steps/FinalStep";

const STEPS = [
  { id: "idea", label: "Ý Tưởng", icon: Lightbulb },
  { id: "plan", label: "Bộ Khung & Duyệt", icon: ListTree },
  { id: "branch", label: "4 Nhánh Truyện", icon: GitBranch },
  { id: "final", label: "Kịch Bản Chuẩn Form", icon: FileCheck2 },
];

function stepIndex(id) {
  return STEPS.findIndex((s) => s.id === id);
}

// Điều hướng wizard giữa các bước, quản lý trạng thái project (status).
export default function ProjectWizard({ projectId, storyName, directionBlock, onBack, onChanged }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState("idea");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const p = await getGameScriptProject(projectId);
      setProject(p);
      // Bước hợp lệ hiện tại theo trạng thái dữ liệu (ưu tiên tiến trình đã có).
      if (p?.status === "final") setStep("final");
      else if (p?.status === "branch" || p?.status === "review") setStep("branch");
      else if (p?.status === "plan") setStep("plan");
      else setStep("idea");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
     
  }, [projectId]);

  const patchProject = async (patch) => {
    setSaving(true);
    try {
      const row = await updateGameScriptProject(projectId, patch);
      setProject((p) => ({ ...p, ...row }));
      onChanged?.();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key, value) => setProject((p) => ({ ...p, [key]: value }));

  const goto = (id) => setStep(id);

  if (loading || !project) {
    return (
      <div className="p-10 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-20 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Đang tải dự án...
        </div>
      </div>
    );
  }

  const workshop = WORKSHOPS[project.workshop] || WORKSHOPS.studio;
  const cur = stepIndex(step);

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="Quay lại danh sách dự án">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-display text-xl md:text-2xl font-semibold flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{workshop.label}</span>
            <span className="truncate">{project.title}</span>
          </h1>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} tự lưu
          </span>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Luồng: Ý tưởng → Bộ khung & duyệt → Viết 4 nhánh → Kịch bản chuẩn form (cú pháp {workshop.label}).
        </p>
      </header>

      {/* Thanh bước */}
      <div className="flex items-center gap-1 flex-wrap mb-5">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = step === s.id;
          const done = i < cur;
          return (
            <button
              key={s.id}
              onClick={() => goto(s.id)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
                active ? "bg-primary text-primary-foreground shadow-sm" : done ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-card border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {s.label}
              {i < STEPS.length - 1 && <span className="opacity-30">→</span>}
            </button>
          );
        })}
      </div>

      {step === "idea" && (
        <IdeaStep
          project={project}
          updateField={updateField}
          patchProject={patchProject}
          onNext={() => goto("plan")}
          storyName={storyName}
        />
      )}

      {step === "plan" && (
        <PlanStep
          project={project}
          patchProject={patchProject}
          directionBlock={directionBlock}
          onBack={() => goto("idea")}
          onNext={() => goto("branch")}
        />
      )}

      {step === "branch" && (
        <BranchStep
          project={project}
          patchProject={patchProject}
          directionBlock={directionBlock}
          onBack={() => goto("plan")}
          onNext={() => goto("final")}
        />
      )}

      {step === "final" && (
        <FinalStep
          project={project}
          patchProject={patchProject}
          onBack={() => goto("branch")}
        />
      )}
    </div>
  );
}
