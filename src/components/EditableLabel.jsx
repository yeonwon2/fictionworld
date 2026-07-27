import React, { useState } from "react";
import { Pencil, Check, X } from "lucide-react";

// Nhãn trường có bút chì cho phép đổi tên trực tiếp.
export default function EditableLabel({ label, onRename, className = "" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);

  function start() {
    setDraft(label);
    setEditing(true);
  }
  function commit() {
    setEditing(false);
    if ((draft || "").trim() !== (label || "")) onRename?.(draft);
  }
  function cancel() {
    setEditing(false);
    setDraft(label);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          onBlur={commit}
          className="h-7 px-2 text-sm font-medium rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring w-44"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={commit}
          className="text-primary hover:text-primary/80"
          title="Xác nhận"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancel}
          className="text-muted-foreground hover:text-foreground"
          title="Hủy"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span className="text-sm font-medium leading-5">{label}</span>
      <button
        type="button"
        onClick={start}
        className="text-muted-foreground/60 hover:text-primary transition"
        title="Đổi tên trường"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}