// Xưởng Game Pro — PRO 1: màn hình bắt đầu lập kế hoạch.
//
// Hiện khi game Pro CHƯA có Bản thiết kế (storyBlueprint.gamePlan trống).
// Chỉ 1 ô ý tưởng lớn + 1 lựa chọn ngắn/dài + tuỳ chọn thêm (ẩn mặc định) —
// không phải wizard nhiều bước. "Tự thiết kế" bỏ qua AI, vào thẳng tab Soạn
// hiện có của PRO 0.
import React, { useState } from "react";
import { Sparkles, PenLine, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/use-toast";
import { generateGamePlanWithEpisodes } from "@/lib/gameStudioPro/plannerAI";
import { applyTemplate, TEMPLATE_IDS } from "@/lib/gameStudioPro/templateRegistry.js";
import TemplatePicker from "./TemplatePicker";

const IDEA_PLACEHOLDER = `Tôi muốn làm một game hậu cung dài tập.
Nhân vật chính bắt đầu là cung nữ mới nhập cung...
Tôi muốn có sủng ái, uy tín, chức vị...
Có những lựa chọn sai có thể chết ngay...`;

export default function PlannerIntro({ storyBlueprint, onChange, onGenerated, onSkip, proDoc, onProDocChange }) {
  // Ý tưởng/tuỳ chọn đọc/ghi THẲNG vào storyBlueprint (qua onChange) thay vì
  // state cục bộ — trước đây chỉ được ghi vào proDoc SAU KHI "Lập kế hoạch
  // với AI" chạy xong, nên gõ/dán ý tưởng dài rồi thoát ra (chưa kịp bấm lập
  // kế hoạch) làm mất trắng, không được autosave như mọi ô nhập liệu khác
  // trong Xưởng Game Pro (xem markDirty() ở GameStudioPro.jsx).
  const idea = storyBlueprint?.idea || "";
  const settings = storyBlueprint?.settings || {};
  const gameLength = settings.gameLength || "long";
  const genre = settings.genre || "";
  const estimatedEpisodes = settings.estimatedEpisodes || "";
  const episodeLength = settings.episodeLength || "";
  const style = settings.style || "";
  const branchiness = settings.branchiness || "";
  const [showOptions, setShowOptions] = useState(false);
  const [templateId, setTemplateId] = useState(settings.templateId || proDoc?.templateId || TEMPLATE_IDS.BLANK);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const { toast } = useToast();

  function patch(fields) {
    onChange({ ...(storyBlueprint || {}), ...fields });
  }
  function patchSettings(fields) {
    patch({ settings: { ...settings, ...fields } });
  }

  // PRO 6 (mục 22): áp template ĐỘC LẬP với việc có gọi AI lập kế hoạch hay
  // không — template chỉ seed registry/mechanics (globalState/mechanics),
  // storyBlueprint (Ý tưởng/Game Plan/các Tập) hoàn toàn không bị đụng tới dù
  // đi đường AI hay "Tự thiết kế".
  function applyChosenTemplate() {
    if (!proDoc || !onProDocChange || templateId === TEMPLATE_IDS.BLANK) return;
    onProDocChange(applyTemplate(proDoc, templateId));
  }

  async function handleGenerate() {
    if (!idea.trim()) {
      toast({ variant: "destructive", title: "Chưa có ý tưởng", description: "Hãy mô tả game bạn muốn làm trước đã." });
      return;
    }
    const genSettings = {
      genre: genre.trim(),
      gameLength,
      estimatedEpisodes: estimatedEpisodes ? Number(estimatedEpisodes) : null,
      episodeLength: episodeLength.trim(),
      style: style.trim(),
      branchiness: branchiness.trim(),
      templateId,
    };
    applyChosenTemplate();
    setGenerating(true);
    setProgress("Đang lập Kế hoạch Game...");
    try {
      const blueprint = await generateGamePlanWithEpisodes(idea, genSettings, {
        onProgress: (p) => {
          if (p.stage === "gameplan") setProgress("Đang lập Kế hoạch Game...");
          else setProgress(`Đang lập kế hoạch Tập ${p.index + 1}/${p.total}: ${p.title || ""}`);
        },
      });
      onGenerated(blueprint);
    } catch (e) {
      toast({ variant: "destructive", title: "Không lập được kế hoạch", description: e.message });
    } finally {
      setGenerating(false);
      setProgress("");
    }
  }

  function handleSkip() {
    applyChosenTemplate();
    onSkip();
  }

  return (
    <div className="space-y-4">
      <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-2">
        <Label>Chọn kiểu game</Label>
        <p className="text-[11px] text-muted-foreground">Chỉ đề xuất chỉ số/cơ chế khởi đầu — không phải giao diện/theme, không bắt buộc dùng đúng.</p>
        <TemplatePicker proDoc={proDoc} selectedId={templateId} onSelect={setTemplateId} />
      </section>

      <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-2">
        <Label>Mô tả game bạn muốn làm</Label>
        <Textarea
          rows={8}
          placeholder={IDEA_PLACEHOLDER}
          value={idea}
          onChange={(e) => patch({ idea: e.target.value })}
          disabled={generating}
        />
        <p className="text-[11px] text-muted-foreground">
          Viết tự nhiên bằng tiếng Việt — không cần biết cú pháp hay cấu trúc kỹ thuật.
        </p>
      </section>

      <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-3">
        <Label>Độ dài game</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={gameLength === "short" ? "default" : "outline"}
            onClick={() => patchSettings({ gameLength: "short" })}
            disabled={generating}
          >
            Game ngắn
          </Button>
          <Button
            type="button"
            variant={gameLength === "long" ? "default" : "outline"}
            onClick={() => patchSettings({ gameLength: "long" })}
            disabled={generating}
          >
            Game dài nhiều tập
          </Button>
        </div>

        <Collapsible open={showOptions} onOpenChange={setShowOptions}>
          <CollapsibleTrigger asChild>
            <button type="button" className="flex min-h-10 items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOptions ? "rotate-180" : ""}`} />
              Tuỳ chọn thêm (không bắt buộc)
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Thể loại</Label>
              <Input value={genre} onChange={(e) => patchSettings({ genre: e.target.value })} disabled={generating} placeholder="VD: hậu cung, tu tiên..." />
            </div>
            {gameLength === "long" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Số tập dự kiến</Label>
                <Input
                  type="number"
                  min="1"
                  value={estimatedEpisodes}
                  onChange={(e) => patchSettings({ estimatedEpisodes: e.target.value })}
                  disabled={generating}
                  placeholder="VD: 8"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Độ dài mỗi tập</Label>
              <Input value={episodeLength} onChange={(e) => patchSettings({ episodeLength: e.target.value })} disabled={generating} placeholder="VD: vừa phải" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phong cách</Label>
              <Input value={style} onChange={(e) => patchSettings({ style: e.target.value })} disabled={generating} placeholder="VD: kịch tính, nhẹ nhàng..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mức độ phân nhánh</Label>
              <Input value={branchiness} onChange={(e) => patchSettings({ branchiness: e.target.value })} disabled={generating} placeholder="VD: nhiều nhánh rẽ" />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>

      <div className="flex flex-wrap gap-2 items-center">
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
          Lập kế hoạch với AI
        </Button>
        <Button type="button" variant="outline" onClick={handleSkip} disabled={generating}>
          <PenLine className="w-4 h-4 mr-1.5" /> Tự thiết kế (bỏ qua kế hoạch)
        </Button>
        {generating && progress && <span className="text-xs text-muted-foreground">{progress}</span>}
      </div>
    </div>
  );
}
