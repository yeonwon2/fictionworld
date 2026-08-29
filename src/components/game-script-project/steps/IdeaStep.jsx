import React, { useState } from "react";
import { Loader2, ArrowRight, Sparkles } from "lucide-react";
import { WORKSHOP_LIST } from "@/lib/gameScriptProject/syntaxGuide";

// Bước 1 — dán ý tưởng đầy đủ (nguồn duy nhất) + chọn xưởng + thông số.
export default function IdeaStep({ project, updateField, patchProject, onNext }) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const payloadFromProject = () => ({
    workshop: project.workshop,
    title: project.title,
    idea: project.idea,
    genre: project.genre,
    scene_count: project.scene_count,
    choices_per_scene: project.choices_per_scene,
    branch_count: project.branch_count,
    notes: project.notes,
    player_name: project.player_name,
    player_desc: project.player_desc,
    main_quest: project.main_quest,
  });

  const handleNext = async () => {
    setErr("");
    if (!String(project.idea || "").trim()) {
      setErr("Hãy dán / nhập Ý TƯỞNG đầy đủ trước — đây là nguồn duy nhất để AI phát triển kịch bản.");
      return;
    }
    setSaving(true);
    try {
      await patchProject({ ...payloadFromProject(), status: "idea" });
      onNext();
    } catch (e) {
      setErr("Không lưu được ý tưởng: " + (e?.message || "lỗi"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-base">1. Ý Tưởng — nguồn duy nhất</h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Dán toàn bộ ý tưởng (nhân vật, tuyến, hệ thống, chỉ số, twist, ending...). AI <b>chỉ phát triển từ đây</b>, không được bịa thế giới khác.
          Tên nhân vật / nhiệm vụ có thể để trống — AI sẽ trích từ ý tưởng.
        </p>

        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2">Loại game (xưởng sản xuất — cú pháp kịch bản cuối)</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {WORKSHOP_LIST.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => updateField("workshop", w.id)}
                className={`text-left rounded-xl border p-3 transition ${
                  project.workshop === w.id ? "border-primary/60 bg-primary/10" : "border-border hover:bg-muted"
                }`}
              >
                <div className="text-sm font-semibold">{w.label}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{w.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <label className="block text-xs text-muted-foreground">
          Tên game
          <input
            value={project.title || ""}
            onChange={(e) => updateField("title", e.target.value)}
            className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            placeholder="Nhập tên riêng của dự án"
          />
        </label>

        <label className="block text-xs text-muted-foreground">
          Ý tưởng đầy đủ <span className="text-destructive">*</span>
          <textarea
            value={project.idea || ""}
            onChange={(e) => updateField("idea", e.target.value)}
            rows={16}
            placeholder="Dán toàn bộ ý tưởng ở đây: bối cảnh, hệ thống, nhân vật nhập vai, 4 tuyến, gameplay, chỉ số, twist, ending..."
            className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y font-sans leading-relaxed min-h-[280px]"
          />
          <span className="text-[10px] text-muted-foreground">{(project.idea || "").length} ký tự</span>
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-xs text-muted-foreground">
            Nhân vật nhập vai (tuỳ chọn — để trống AI trích từ ý tưởng)
            <input
              value={project.player_name || ""}
              onChange={(e) => updateField("player_name", e.target.value)}
              placeholder="Tên nhân vật trong ý tưởng"
              className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Nhiệm vụ chính (tuỳ chọn)
            <input
              value={project.main_quest || ""}
              onChange={(e) => updateField("main_quest", e.target.value)}
              placeholder="Mục tiêu trung tâm của nhân vật"
              className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block text-xs text-muted-foreground">
          Lai lịch ngắn (tuỳ chọn)
          <input
            value={project.player_desc || ""}
            onChange={(e) => updateField("player_desc", e.target.value)}
            className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
        </label>

        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block text-xs text-muted-foreground">
            Số cảnh
            <input
              type="number"
              min={5}
              max={120}
              value={project.scene_count ?? 50}
              onChange={(e) => updateField("scene_count", Math.max(5, Math.min(120, Number(e.target.value) || 50)))}
              className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Lựa chọn / cảnh
            <input
              type="number"
              min={1}
              max={6}
              value={project.choices_per_scene ?? 3}
              onChange={(e) => updateField("choices_per_scene", Math.max(1, Math.min(6, Number(e.target.value) || 3)))}
              className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Số nhánh
            <input
              type="number"
              min={2}
              max={6}
              value={project.branch_count ?? 4}
              onChange={(e) => updateField("branch_count", Math.max(2, Math.min(6, Number(e.target.value) || 4)))}
              className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      {err && <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{err}</div>}

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleNext}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          Lưu ý tưởng → AI phát triển bộ khung
        </button>
      </div>
    </div>
  );
}
