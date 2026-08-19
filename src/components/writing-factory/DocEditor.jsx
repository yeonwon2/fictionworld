import React, { useEffect, useRef, useState } from "react";
import { Wand2, Loader2, Save, CheckCircle2, Eye, Pencil, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { DOC_DEFS_BY_KEY } from "@/lib/writingFactory/prompts";

// Trình soạn thảo một tài liệu bible: xem / soạn Markdown + hành động AI
// (sinh lại, rà soát) theo vai chuyên môn của tài liệu đó.
export default function DocEditor({ doc, onSave, saving, onAIGenerate, busy }) {
  const def = DOC_DEFS_BY_KEY[doc?.doc_key] || {};
  const [mode, setMode] = useState("edit"); // "edit" | "preview"
  const [draft, setDraft] = useState(doc?.content || "");
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const prevIdRef = useRef(doc?.id);
  const lastServerRef = useRef(doc?.content || "");

  // Đồng bộ bản nháp với server: đổi tài liệu thì reset hẳn; cùng tài liệu mà
  // nội dung server đổi (AI soạn xong / lưu xong) thì cập nhật, NHƯNG không
  // ghi đè nếu tác giả đang gõ dở mà server chưa đổi (giữ bản nháp).
  useEffect(() => {
    const server = doc?.content || "";
    if (prevIdRef.current !== doc?.id) {
      prevIdRef.current = doc?.id;
      lastServerRef.current = server;
      setDraft(server);
      setNote("");
      setNoteOpen(false);
      return;
    }
    if (server !== lastServerRef.current) {
      setDraft((d) => (d === lastServerRef.current ? server : d));
      lastServerRef.current = server;
    }
  }, [doc?.id, doc?.content]);

  const dirty = (doc?.content || "") !== draft;

  const handleSave = async () => {
    await onSave(draft);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1500);
  };

  const handleAIGenerate = async () => {
    await onAIGenerate(draft, note);
    setNote("");
    setNoteOpen(false);
  };

  if (!doc) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Chọn một tài liệu trong cây bên trái.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border bg-card overflow-hidden">
      {/* Thanh tiêu đề */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="min-w-0 flex-1">
          <div className="font-display font-semibold text-sm truncate">{def.title}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {def.file} · vai trò: {def.role}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border text-xs hover:bg-muted"
          >
            {mode === "edit" ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            {mode === "edit" ? "Xem trước" : "Soạn"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Lưu
          </button>
        </div>
      </div>

      {/* Trạng thái lưu */}
      {savedTick && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px]">
          <CheckCircle2 className="w-3.5 h-3.5" /> Đã lưu.
        </div>
      )}

      {/* Vùng nội dung */}
      <div className="flex-1 min-h-0">
        {mode === "edit" ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Soạn nội dung tài liệu ${def.title} tại đây (Markdown)...`}
            className="w-full h-full min-h-[380px] resize-none px-4 py-3 text-sm leading-6 bg-card focus:outline-none font-body"
          />
        ) : (
          <div className="h-full overflow-y-auto px-4 py-3 text-sm leading-relaxed text-foreground/90 [&_a]:text-primary [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:font-display [&_h1]:text-lg [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h2]:font-display [&_h2]:text-base [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:font-display [&_h3]:text-sm [&_h3]:mt-2.5 [&_h3]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_table]:w-full [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded-md [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded">
            {draft.trim() ? (
              <ReactMarkdown>{draft}</ReactMarkdown>
            ) : (
              <p className="text-sm text-muted-foreground italic">Tài liệu đang trống.</p>
            )}
          </div>
        )}
      </div>

      {/* Thanh AI */}
      <div className="px-4 py-2.5 border-t border-border bg-muted/20">
        {noteOpen ? (
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary shrink-0" />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`Góp ý cho ${def.role} (VD: bỏ yếu tố A, nhấn mạnh B)...`}
              className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
            />
            <button
              onClick={handleAIGenerate}
              disabled={busy}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              Gửi
            </button>
            <button onClick={() => setNoteOpen(false)} className="p-1 text-muted-foreground hover:bg-muted rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] text-muted-foreground">
              Để {def.role} ({def.role}) làm việc với tài liệu này:
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setNoteOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-primary/40 text-primary text-[11px] hover:bg-primary/10"
              >
                <Wand2 className="w-3.5 h-3.5" /> Góp ý
              </button>
              <button
                onClick={() => onAIGenerate(draft, "")}
                disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {(doc?.content || "").trim() ? "Viết lại bằng AI" : "Soạn bằng AI"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}