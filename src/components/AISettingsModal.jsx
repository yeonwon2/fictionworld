import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, EyeOff, Loader2, KeyRound, Check, Trash2 } from "lucide-react";
import {
  getCustomKey,
  setCustomKey,
  getCustomModel,
  setCustomModel,
  testGeminiConnection,
} from "@/lib/aiCall";
import { GEMINI_MODELS } from "@/lib/geminiModels";

const DEFAULT_MODEL_ID = "gemini-3.1-flash-lite";

export default function AISettingsModal({ open, onOpenChange }) {
  const [key, setKey] = useState(getCustomKey());
  const [model, setModel] = useState(getCustomModel());
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState({ type: "", text: "" });
  const [saved, setSaved] = useState(false);

  const save = () => {
    setCustomKey(key.trim());
    setCustomModel(model);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const clear = () => {
    setKey("");
    setCustomKey("");
    setTestMsg({ type: "", text: "" });
  };

  const test = async () => {
    setTesting(true);
    setTestMsg({ type: "", text: "" });
    try {
      await testGeminiConnection(key.trim(), model);
      setTestMsg({ type: "ok", text: "Kết nối thành công! API Key hợp lệ." });
    } catch (e) {
      setTestMsg({ type: "err", text: "Kết nối thất bại: " + (e?.message || "lỗi") });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" /> Quản lý AI API Key
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Google Gemini API Key</label>
            <div className="relative mt-1">
              <input
                type={show ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Nhập Google Gemini API Key của bạn"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 pr-9 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                title={show ? "Ẩn" : "Hiện"}
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full mt-1 rounded-md border border-input bg-transparent px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {GEMINI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.perMinute}/phút, {m.perDay}/ngày
                  {m.id === DEFAULT_MODEL_ID ? " (mặc định)" : ""}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Hạn mức theo trang aistudio.google.com/rate-limit — có thể đổi theo thời gian, kiểm
              tra lại trang đó nếu nghi ngờ hoặc gặp lỗi kết nối.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={test}
              disabled={testing || !key.trim()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-primary/50 text-primary text-sm font-medium hover:bg-primary/10 disabled:opacity-50 transition"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Kiểm tra kết nối
            </button>
            <button
              onClick={save}
              disabled={!key.trim()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
            >
              <Check className="w-4 h-4" /> Lưu
            </button>
            {key && (
              <button
                onClick={clear}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-muted-foreground text-sm hover:bg-muted hover:text-destructive transition"
              >
                <Trash2 className="w-4 h-4" /> Xóa key
              </button>
            )}
          </div>

          {testMsg.text && (
            <div
              className={`text-xs rounded-md px-3 py-2 ${
                testMsg.type === "ok"
                  ? "text-emerald-600 bg-emerald-500/10"
                  : "text-destructive bg-destructive/10"
              }`}
            >
              {testMsg.text}
            </div>
          )}
          {saved && (
            <div className="text-xs text-emerald-600 bg-emerald-500/10 rounded-md px-3 py-2 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Đã lưu cấu hình AI.
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            API Key lưu trong <b>localStorage</b> của trình duyệt, gửi thẳng tới Google AI Studio.
            Bắt buộc phải có key riêng (miễn phí tại aistudio.google.com/apikey) — không có key thì
            mọi tính năng AI sẽ báo lỗi.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}