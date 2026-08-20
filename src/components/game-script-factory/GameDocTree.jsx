import React from "react";
import { Folder, FileText, Sparkles, Loader2, BookText, FolderOpen, Check, Gamepad2 } from "lucide-react";
import { GAME_SCRIPT_DOC_DEFS, GAME_TYPE_BY_KEY } from "@/lib/gameScriptFactory/prompts";

const ICONS = {
  quy_tac: BookText,
  the_gioi: FolderOpen,
  nhan_vat: FileText,
  tuyen: FileText,
  pha_do: FileText,
  flags: FileText,
  tom_tat: FileText,
};

// Cây tài liệu của Xưởng Kịch Bản Game — mô phỏng thư mục game: quy tắc, thế
// giới, nhân vật, tuyến, pha đo, flags, tóm tắt.
export default function GameDocTree({ gameType, docsByKey, activeKey, onSelect, onBootstrap, bootstrapping, hasContent }) {
  const type = GAME_TYPE_BY_KEY[gameType] || GAME_TYPE_BY_KEY["visual-novel"];
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-primary" />
          <span className="font-display font-semibold text-sm">Xưởng Kịch Bản Game</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Loại game: <span className="font-medium text-foreground">{type.emoji} {type.label}</span>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="text-[10px] font-semibold text-muted-foreground px-2 pt-1 pb-0.5 uppercase tracking-wide">
          Tài liệu kịch bản
        </div>
        <div className="space-y-0.5">
          {GAME_SCRIPT_DOC_DEFS.map((d) => {
            const Icon = ICONS[d.key] || FileText;
            const active = activeKey === d.key;
            const doc = docsByKey?.[d.key];
            const filled = !!doc?.content?.trim();
            return (
              <button
                key={d.key}
                onClick={() => onSelect(d.key)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition ${
                  active ? "bg-primary text-primary-foreground font-medium" : "text-foreground/80 hover:bg-muted"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 truncate">{d.title}</span>
                <span className="text-[9px] opacity-60 font-mono hidden lg:inline">{d.file.split("/").pop()}</span>
                {filled && <Check className="w-3 h-3 shrink-0 opacity-70" />}
              </button>
            );
          })}
        </div>

        <div className="text-[10px] font-semibold text-muted-foreground px-2 pt-3 pb-0.5 uppercase tracking-wide">
          Kịch bản
        </div>
        <div className="px-2.5 py-2 rounded-lg text-xs text-muted-foreground bg-muted/40">
          <div className="flex items-center gap-1.5">
            <Gamepad2 className="w-3.5 h-3.5" /> tuyến/ · scenes/
          </div>
          <p className="text-[10px] mt-1">Tuyến kịch bản lưu ở tab Tuyến; phân cảnh viết theo từng tuyến lưu ở tab Viết Kịch Bản.</p>
        </div>
      </div>

      <div className="p-3 border-t border-border">
        <button
          onClick={onBootstrap}
          disabled={bootstrapping}
          className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
            bootstrapping
              ? "bg-muted text-muted-foreground"
              : "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
          }`}
        >
          {bootstrapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {bootstrapping ? "Xưởng đang dựng bộ tài liệu..." : hasContent ? "Khởi tạo lại Xưởng" : "Khởi tạo Xưởng"}
        </button>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          AI dựng {GAME_SCRIPT_DOC_DEFS.length} tài liệu kịch bản theo loại game + ý tưởng.
        </p>
      </div>
    </div>
  );
}