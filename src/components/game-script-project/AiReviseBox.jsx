import React, { useState } from "react";
import { Loader2, MessageSquarePlus, Sparkles } from "lucide-react";

// Widget dùng chung: mọi nội dung AI tạo ra (mục cốt lõi, 1 cảnh trong dàn
// cảnh, bản thảo 1 nhánh, kịch bản 1 cảnh cuối cùng...) đều gắn kèm ô này để
// tác giả gõ góp ý rồi nhờ AI sửa lại đúng phần đó — không phải sửa tay JSON,
// cũng không phải viết lại từ đầu.
export default function AiReviseBox({ onRevise, label = "Nhờ AI sửa theo góp ý", placeholder = "VD: đổi kết thúc bi kịch hơn, thêm 1 twist ở giữa..." }) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!feedback.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onRevise(feedback.trim());
      setFeedback("");
      setOpen(false);
    } catch (e) {
      setError(e?.message || "Sửa lỗi.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
      >
        <MessageSquarePlus className="w-3 h-3" /> {label}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-1.5">
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder={placeholder}
        rows={2}
        autoFocus
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs resize-y"
      />
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => { setOpen(false); setError(""); }} className="px-2.5 py-1 rounded-md text-[11px] text-muted-foreground hover:bg-muted">
          Huỷ
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !feedback.trim()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-medium disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} {busy ? "Đang sửa..." : "Sửa"}
        </button>
      </div>
    </div>
  );
}
