import React, { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { importExistingScript } from "@/lib/gameScriptProject/importScript";
import { realParseCheck } from "@/lib/gameScriptProject/parserBridge";
import { WORKSHOPS, WORKSHOP_LIST } from "@/lib/gameScriptProject/syntaxGuide";

export default function ImportScriptDialog({ importing, onCancel, onImport }) {
  const [workshop, setWorkshop] = useState("studio");
  const [script, setScript] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const parsed = useMemo(() => {
    if (!script.trim()) return null;
    try { return importExistingScript(script); }
    catch (e) { return { error: e?.message || "Không đọc được kịch bản." }; }
  }, [script]);
  const parserReport = useMemo(() => {
    if (!parsed || parsed.error) return null;
    try { return realParseCheck(workshop, script); }
    catch (e) { return { ok: false, blocking: [e?.message || "Parser không đọc được kịch bản."], suggestions: [] }; }
  }, [parsed, script, workshop]);

  const readFile = async (file) => {
    if (!file) return;
    setError("");
    if (!/\.txt$/i.test(file.name) && file.type && file.type !== "text/plain") {
      setError("Hãy chọn file văn bản .txt.");
      return;
    }
    try {
      setScript(await file.text());
      setFileName(file.name);
    } catch {
      setError("Không đọc được file này.");
    }
  };

  const submit = async () => {
    if (!parsed || parsed.error) { setError(parsed?.error || "Hãy chọn file TXT hoặc dán kịch bản."); return; }
    setError("");
    try { await onImport({ workshop, parsed, source: script, fileName }); }
    catch (e) { setError(e?.message || "Nhập kịch bản thất bại."); }
  };

  return (
    <div className="mb-5 rounded-2xl border border-primary/30 bg-card p-4 space-y-4">
      <div>
        <h3 className="font-display font-semibold flex items-center gap-2"><Upload className="w-4 h-4 text-primary" /> Nhập kịch bản có sẵn</h3>
        <p className="text-xs text-muted-foreground mt-1">Chọn file TXT hoặc dán toàn bộ kịch bản. Việc đọc cảnh và kiểm tra parser chạy tại máy, không tốn lượt AI.</p>
      </div>

      <div>
        <div className="text-xs font-semibold text-muted-foreground mb-2">Kịch bản này dùng cú pháp xưởng nào?</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {WORKSHOP_LIST.map((item) => (
            <button key={item.id} type="button" onClick={() => setWorkshop(item.id)} className={`text-left rounded-xl border p-3 ${workshop === item.id ? "border-primary/60 bg-primary/10" : "border-border hover:bg-muted"}`}>
              <div className="text-sm font-semibold">{item.label}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted"><FileText className="w-4 h-4" /> Đọc file TXT</button>
        {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
      </div>

      <textarea value={script} onChange={(e) => { setScript(e.target.value); setFileName(""); }} rows={12} placeholder="Hoặc dán toàn bộ kịch bản vào đây…" className="w-full rounded-xl border border-input bg-transparent px-3 py-3 text-sm font-mono resize-y" />

      {parsed && !parsed.error && (
        <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs space-y-2">
          <div className="font-semibold">{parsed.title}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            <span>{WORKSHOPS[workshop]?.label}</span><span>{parsed.scenes.length} cảnh</span><span>{parsed.endings.length} kết thúc</span><span>{parsed.chapters} hồi/chương</span><span>tối đa {parsed.maxChoices} lựa chọn/cảnh</span>
          </div>
          {parserReport?.ok ? (
            <div className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> Parser không có lỗi chặn.</div>
          ) : (
            <div className="flex items-start gap-1.5 text-amber-600"><AlertTriangle className="w-3.5 h-3.5 mt-0.5" /> <span>{parserReport?.blocking?.length || 0} lỗi parser sẽ được đưa vào dự án để bạn sửa.</span></div>
          )}
          {!!parserReport?.suggestions?.length && <div className="text-amber-600">{parserReport.suggestions.length} gợi ý chất lượng, gồm vật phẩm/cờ mồ côi hoặc điều kiện thừa.</div>}
        </div>
      )}
      {(error || parsed?.error) && <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error || parsed.error}</div>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={importing} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50">Huỷ</button>
        <button type="button" onClick={submit} disabled={importing || !parsed || !!parsed.error} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
          {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {importing ? "Đang nhập…" : "Tạo dự án và kiểm tra"}
        </button>
      </div>
    </div>
  );
}

