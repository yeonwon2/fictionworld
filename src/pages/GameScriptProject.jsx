import React, { useEffect, useState } from "react";
import { Clapperboard, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useStory } from "@/lib/StoryContext";
import { buildDirectionBlock } from "@/lib/directionUtils";
import {
  listGameScriptProjects,
  createGameScriptProject,
  deleteGameScriptProject,
} from "@/lib/worldcrud";
import { WORKSHOPS, WORKSHOP_LIST } from "@/lib/gameScriptProject/syntaxGuide";
import ProjectWizard from "@/components/game-script-project/ProjectWizard";

// Xưởng Kịch Bản Game — luồng wizard mới:
//   Ý tưởng (loại game + thể loại + số cảnh + số lựa chọn)
//   → AI gợi ý bộ khung (nhân vật/bối cảnh/dàn cảnh/lựa chọn/kết thúc)
//   → duyệt/chỉnh sửa → viết 4 nhánh truyện (bản thảo) → chốt
//   → xuất kịch bản chuẩn form đúng cú pháp xưởng game → copy đem sản xuất.
export default function GameScriptProject() {
  const { currentStory, currentStoryId, ready } = useStory();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newWorkshop, setNewWorkshop] = useState("studio");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const list = (await listGameScriptProjects(currentStoryId)) || [];
      setProjects(list);
      if (activeId && !list.some((p) => p.id === activeId)) setActiveId(null);
    } catch (e) {
      setError("Không tải được dự án kịch bản: " + (e?.message || "lỗi"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready) load();
     
  }, [ready, currentStoryId]);

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      const row = await createGameScriptProject({
        story_id: currentStoryId,
        workshop: newWorkshop,
        title: newTitle.trim() || `Dự Án ${WORKSHOPS[newWorkshop]?.label || ""} mới`,
        idea: "",
        genre: "",
        scene_count: 50,
        choices_per_scene: 3,
        branch_count: 4,
        status: "idea",
      });
      await load();
      setActiveId(row.id);
      setShowCreate(false);
      setNewTitle("");
    } catch (e) {
      setError("Không tạo được dự án: " + (e?.message || "lỗi"));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Xoá dự án kịch bản này? Toàn bộ bộ khung, nhánh và nội dung sẽ bị xoá. Không thể hoàn tác.")) return;
    try {
      await deleteGameScriptProject(id);
      if (activeId === id) setActiveId(null);
      await load();
    } catch (err) {
      setError("Không xoá được dự án: " + (err?.message || "lỗi"));
    }
  };

  if (!ready) {
    return (
      <div className="p-10 max-w-[1400px] mx-auto">
        <div className="text-center text-muted-foreground py-20 text-sm">Đang tải bộ truyện...</div>
      </div>
    );
  }

  if (activeId) {
    return <ProjectWizard projectId={activeId} storyName={currentStory?.name} directionBlock={buildDirectionBlock(currentStory?.direction)} onBack={() => setActiveId(null)} onChanged={load} />;
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <header className="mb-5">
        <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <Clapperboard className="w-6 h-6 text-primary" /> Xưởng Kịch Bản Game
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Dán <b>ý tưởng đầy đủ</b> (nguồn duy nhất) → AI phát triển bộ khung (đúng tên nhân vật/tuyến/hệ thống trong ý tưởng)
          → duyệt → viết nhánh → xuất <b>kịch bản chuẩn form</b> đúng cú pháp 5 xưởng game → copy dán vào Xưởng Game.
        </p>
      </header>

      {error && <div className="mb-3 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>}

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-base">Dự án kịch bản</h2>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Dự án mới
        </button>
      </div>

      {showCreate && (
        <div className="mb-5 rounded-2xl border border-border bg-card p-4 space-y-3">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">Chọn loại game (xưởng sản xuất — cú pháp kịch bản sẽ khác nhau)</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {WORKSHOP_LIST.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setNewWorkshop(w.id)}
                  className={`text-left rounded-xl border p-3 transition ${
                    newWorkshop === w.id ? "border-primary/60 bg-primary/10" : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="text-sm font-semibold">{w.label}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{w.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Tên dự án (VD: Kịch bản Nữ Hiệp Phương Tây)"
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted">Huỷ</button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {creating ? "Đang tạo..." : "Tạo dự án"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Đang tải dự án...
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
          Chưa có dự án kịch bản nào. Bấm "Dự án mới" để bắt đầu.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const w = WORKSHOPS[p.workshop] || WORKSHOPS.studio;
            return (
              <button
                key={p.id}
                onClick={() => setActiveId(p.id)}
                className="text-left rounded-2xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/40 transition group relative"
              >
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">{w.label}</span>
                  <span className="text-[10px] text-muted-foreground">{w.short}</span>
                </div>
                <h3 className="font-display font-semibold text-base mt-2 pr-6 truncate">{p.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {p.scene_count} cảnh · {p.branch_count} nhánh · {p.choices_per_scene} lựa chọn/cảnh
                </p>
                {p.player_name && <p className="text-[11px] text-muted-foreground mt-1 truncate">🎮 {p.player_name}</p>}
                {p.main_quest && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">🎯 {p.main_quest}</p>}
                <p className="text-[11px] text-muted-foreground mt-2 capitalize">Trạng thái: {p.status}</p>
                <span
                  onClick={(e) => handleDelete(e, p.id)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition"
                  title="Xoá dự án"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
