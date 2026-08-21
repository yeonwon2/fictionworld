import React, { useState } from "react";
import { Loader2, ArrowRight, Sparkles } from "lucide-react";
import { WORKSHOPS, WORKSHOP_LIST } from "@/lib/gameScriptProject/syntaxGuide";

const GENRES = [
  "Tiên Hiệp / Tu Tiên", "Huyền Huyễn", "Võ Hiệp / Giang Hồ", "Ngôn Tình / Cổ Đại",
  "Fantasy / Kỳ Ảo", "Dark Fantasy / Ma Pháp", "Cyberpunk / Tương Lai", "Khoa Học Viễn Tưởng",
  "Steampunk / Cơ Khí", "Trinh Thám / Án Mạng", "Kinh Dị / Tâm Linh", "Hậu Tận Thế",
  "Lịch Sử / Cổ Đại", "Tâm Lý / Đời Thường", "Học Đường", "Doanh Nhân / Trọng Sinh",
];

// Bước 1 — nhập ý tưởng + thông số (loại game, thể loại, số cảnh, số lựa chọn, số nhánh).
export default function IdeaStep({ project, updateField, patchProject, onNext, storyName }) {
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    setSaving(true);
    try {
      await patchProject({ status: "idea" });
      onNext();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-base">1. Ý Tưởng & Thông Số</h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Chọn loại game (xưởng sản xuất — quyết định cú pháp kịch bản cuối), nhập ý tưởng và các thông số.
        </p>

        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2">Loại game (xưởng sản xuất)</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {WORKSHOP_LIST.map((w) => (
              <button
                key={w.id}
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
          />
        </label>

        <label className="block text-xs text-muted-foreground">
          Thể loại
          <select
            value={project.genre || ""}
            onChange={(e) => updateField("genre", e.target.value)}
            className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">(chọn thể loại)</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-muted-foreground">
          Ý tưởng / bối cảnh
          <textarea
            value={project.idea || ""}
            onChange={(e) => updateField("idea", e.target.value)}
            rows={5}
            placeholder={`VD: Nữ hiệp mất ký ức ở thế giới ${WORKSHOPS[project.workshop]?.label || ""}, phải tìm lại danh tính qua các thành bang, có 1 âm mưu lớn phía sau...`}
            className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y"
          />
        </label>

        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block text-xs text-muted-foreground">
            Số cảnh (dàn tổng)
            <input
              type="number"
              min={5}
              max={200}
              value={project.scene_count ?? 50}
              onChange={(e) => updateField("scene_count", Math.max(5, Math.min(200, Number(e.target.value) || 50)))}
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
            Số nhánh truyện
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

        <label className="block text-xs text-muted-foreground">
          Ghi chú thêm (tuỳ chọn)
          <textarea
            value={project.notes || ""}
            onChange={(e) => updateField("notes", e.target.value)}
            rows={2}
            placeholder="Tông, mức độ trưởng thành, ràng buộc, điều muốn tránh..."
            className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y"
          />
        </label>
      </div>

      <div className="flex items-center justify-end">
        <button
          onClick={handleNext}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          Tiếp tục: AI gợi ý bộ khung
        </button>
      </div>
    </div>
  );
}
