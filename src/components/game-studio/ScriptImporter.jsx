import React, { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Wand2, Loader2, AlertTriangle, ListPlus, GitBranchPlus, FlagTriangleRight, ClipboardCheck, CheckCircle2 } from "lucide-react";
import { parseScript } from "@/lib/gameStudio/scriptParser";
import { generateScriptFromPrompt } from "@/lib/gameStudio/scriptWriter";
import { useToast } from "@/components/ui/use-toast";

// Chèn 1 đoạn cú pháp mẫu ngay tại vị trí con trỏ trong ô kịch bản — dùng cho
// các nút "+ Thêm ..." bên dưới. Nếu snippet có 1 đoạn trùng "placeholder",
// đoạn đó được BÔI ĐEN sẵn sau khi chèn để gõ đè lên ngay, không cần tự chọn.
function insertSnippetAtCursor({ textareaRef, script, setScript, snippet, placeholder }) {
  const el = textareaRef.current;
  // Luôn chèn tại VỊ TRÍ CUỐI của vùng chọn hiện tại — không đè lên phần đang
  // được bôi đen. Nếu chèn đè theo (start, end) như con trỏ chuột thật, bấm 2
  // nút chèn liên tiếp (chưa gõ gì) sẽ vô tình XÓA MẤT snippet vừa chèn trước
  // đó, vì placeholder của nó vẫn đang được tự động bôi đen chờ gõ đè.
  const pos = el ? el.selectionEnd : script.length;
  const before = script.slice(0, pos);
  const after = script.slice(pos);
  const leadingNl = before.length === 0 ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trailingNl = after.length === 0 ? "" : after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const insertion = leadingNl + snippet + trailingNl;
  setScript(before + insertion + after);
  requestAnimationFrame(() => {
    if (!el) return;
    el.focus();
    const idx = placeholder ? insertion.indexOf(placeholder) : -1;
    if (idx !== -1) {
      el.setSelectionRange(before.length + idx, before.length + idx + placeholder.length);
    } else {
      const pos = before.length + insertion.length;
      el.setSelectionRange(pos, pos);
    }
  });
}

// Dò vị trí (start, end) trong "script" ứng với 1 dòng cảnh báo, để bấm vào
// là nhảy tới + bôi đen đúng chỗ sai. Ưu tiên số dòng tường minh ("Dòng N:"
// — có ở các cảnh báo cú pháp); nếu không có (cảnh báo cấu trúc từ
// postprocess.js không biết số dòng gốc), thử tìm theo TÊN LỰA CHỌN được
// trích dẫn trong câu cảnh báo. Trả về null nếu không đoán được.
function resolveWarningPosition(script, warning) {
  const lineMatch = warning.match(/^Dòng (\d+):/);
  const lines = script.split("\n");
  if (lineMatch) {
    const lineNo = parseInt(lineMatch[1], 10);
    if (lineNo >= 1 && lineNo <= lines.length) {
      let offset = 0;
      for (let i = 0; i < lineNo - 1; i++) offset += lines[i].length + 1;
      return { start: offset, end: offset + lines[lineNo - 1].length };
    }
  }
  const choiceMatch = warning.match(/lựa chọn "([^"]+)"/);
  if (choiceMatch && choiceMatch[1] !== "(không có chữ)") {
    const idx = script.indexOf(choiceMatch[1]);
    if (idx !== -1) return { start: idx, end: idx + choiceMatch[1].length };
  }
  return null;
}

function jumpToWarning(textareaRef, script, warning) {
  const pos = resolveWarningPosition(script, warning);
  const el = textareaRef.current;
  if (!pos || !el) return false;
  el.focus();
  el.setSelectionRange(pos.start, pos.end);
  // setSelectionRange KHÔNG tự cuộn textarea tới chỗ chọn (khác input thường)
  // — phải tự tính cuộn tay, ước lượng theo số dòng xuống tới vị trí đó (đủ
  // dùng cho các dòng hiệu ứng ngắn hiếm khi bị wrap xuống dòng tiếp theo).
  const lineIndex = script.slice(0, pos.start).split("\n").length - 1;
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 18;
  const target = lineIndex * lineHeight - el.clientHeight / 2;
  el.scrollTop = Math.max(0, Math.min(target, el.scrollHeight - el.clientHeight));
  return true;
}

const CHEAT_SHEET = `# Tên game
**Thể loại:** ...
**Thông báo thua cuộc:** Tiêu đề | Nội dung (tuỳ chọn — chữ hiện khi thua cuộc,
                                             thay cho "GAME OVER" mặc định. Chỉ
                                             có tác dụng nếu bạn tự đặt 1 chỉ số
                                             là "Sinh tử" trong Cấu hình chung.)

## GIỚI THIỆU
Văn bản mở đầu.

## CẢNH 1 — Tên cảnh
Diễn biến của cảnh.

**A — Lời lựa chọn**
→ Tên chỉ số +5
→ Cờ: ten_co
→ Cần cờ: ten_co              (khoá nếu CHƯA có cờ)
→ Cần không có cờ: ten_co     (khoá nếu ĐÃ có cờ — dùng làm nhánh "else")
→ Cần vật phẩm: tên vật phẩm
→ Đến cảnh 2                  (số 2 PHẢI có "## CẢNH 2" thật ở dưới, không thì báo lỗi)
→ Kết thúc nhan_ket_thuc       (nhãn PHẢI khớp y hệt "## KẾT THÚC nhan_ket_thuc" ở dưới)

## CẢNH 2 — ...
...

## KẾT THÚC nhan_ket_thuc — Tên kết thúc [TRUE_END]
Văn bản kết thúc.

Loại kết thúc trong [ ] CHỈ được 1 trong 4: TRUE_END / GOOD_END / NORMAL_END /
BAD_END (bỏ qua [ ] thì mặc định NORMAL_END). Không có rẽ nhánh kiểu "Nếu... thì
Đến..." trong 1 lựa chọn — muốn rẽ nhánh theo điều kiện, viết 2 lựa chọn riêng,
mỗi cái khoá bằng "Cần cờ:"/"Cần không có cờ:" đối lập nhau.`;

export default function ScriptImporter({ gameData, setGameData, onGenerated }) {
  const [script, setScript] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState("idea");
  const [aiLength, setAiLength] = useState("medium");
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [producing, setProducing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const textareaRef = useRef(null);
  const { toast } = useToast();

  const insertSnippet = (snippet, placeholder) => insertSnippetAtCursor({ textareaRef, script, setScript, snippet, placeholder });

  const SNIPPETS = [
    { label: "Cảnh mới", icon: ListPlus, snippet: "CẢNH X — Tên cảnh\nDiễn biến của cảnh.", placeholder: "X" },
    { label: "Lựa chọn", icon: GitBranchPlus, snippet: "A — Lời lựa chọn\n→ Tên chỉ số +5\n→ Đến cảnh X", placeholder: "Lời lựa chọn" },
    { label: "Kết thúc", icon: FlagTriangleRight, snippet: "KẾT THÚC nhan_ket_thuc — Tên kết thúc [TRUE_END]\nVăn bản kết thúc.", placeholder: "nhan_ket_thuc" },
  ];

  const handleAIWrite = async () => {
    if (!aiInput.trim()) {
      toast({ variant: "destructive", title: "Thiếu nội dung", description: "Nhập ý tưởng hoặc dán nội dung chương truyện." });
      return;
    }
    setAiLoading(true);
    try {
      const text = await generateScriptFromPrompt({ mode: aiMode, input: aiInput, length: aiLength });
      setScript(text);
      toast({ title: "AI đã viết xong kịch bản", description: "Kiểm tra/sửa lại bên dưới rồi bấm Sản Xuất Game." });
    } catch (e) {
      toast({ variant: "destructive", title: "Lỗi viết kịch bản", description: e.message || "Vui lòng thử lại." });
    } finally {
      setAiLoading(false);
    }
  };

  // Kiểm tra QA — chạy CÙNG 1 hàm phân tích kịch bản như lúc sản xuất thật,
  // nhưng KHÔNG ghi đè gameData — chỉ để xem trước danh sách lỗi/cảnh báo và
  // sửa ngay trong ô kịch bản, không cần sản xuất thật rồi mới biết chỗ sai.
  const handleCheck = () => {
    if (!script.trim()) {
      toast({ variant: "destructive", title: "Chưa có kịch bản", description: "Dán hoặc viết kịch bản trước." });
      return;
    }
    setChecking(true);
    try {
      const result = parseScript(script, gameData.meta);
      setWarnings(result.warnings || []);
      setChecked(true);
      if (result.warnings?.length) {
        toast({ variant: "destructive", title: `Tìm thấy ${result.warnings.length} lỗi/cảnh báo`, description: "Xem chi tiết bên dưới rồi sửa lại trong ô kịch bản." });
      } else {
        toast({ title: "Không phát hiện lỗi nào!", description: "Kịch bản sẵn sàng để sản xuất." });
      }
    } catch (e) {
      setWarnings([]);
      setChecked(true);
      toast({ variant: "destructive", title: "Kịch bản có lỗi nghiêm trọng", description: e.message || "Kiểm tra lại cú pháp kịch bản." });
    } finally {
      setChecking(false);
    }
  };

  const handleProduce = () => {
    if (!script.trim()) {
      toast({ variant: "destructive", title: "Chưa có kịch bản", description: "Dán hoặc viết kịch bản trước." });
      return;
    }
    setProducing(true);
    try {
      const result = parseScript(script, gameData.meta);
      setGameData(result);
      setWarnings(result.warnings || []);
      setChecked(true);
      onGenerated && onGenerated(result);
      toast({
        title: "Sản xuất thành công!",
        description: `Đã tạo ${Object.keys(result.nodes || {}).length} phân cảnh từ kịch bản.${result.warnings?.length ? ` (${result.warnings.length} cảnh báo, xem bên dưới)` : ""}`,
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Không sản xuất được", description: e.message || "Kiểm tra lại cú pháp kịch bản." });
    } finally {
      setProducing(false);
    }
  };

  return (
    <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-2"><FileText size={16} /> Xưởng Offline — Sản xuất từ kịch bản viết sẵn</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Dán kịch bản đã viết theo đúng cú pháp bên dưới (hoặc để AI viết giúp), hệ thống sẽ sản xuất game trực tiếp — không cần gọi AI, luôn ra đúng những gì bạn đã viết. Quên "#" hay "**" cũng không sao — hệ thống nhận diện qua từ khoá ("CẢNH", "KẾT THÚC", "GIỚI THIỆU"...), không bắt buộc phải có ký hiệu markdown.
      </p>

      <details className="text-xs rounded-lg border border-border">
        <summary className="cursor-pointer px-3 py-2 font-medium select-none">Xem cú pháp mẫu</summary>
        <pre className="px-3 pb-3 whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">{CHEAT_SHEET}</pre>
      </details>

      <div className="rounded-lg border border-border">
        <button
          type="button"
          onClick={() => setAiOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium"
        >
          <Wand2 size={14} /> {aiOpen ? "Ẩn" : "Nhờ AI viết kịch bản giúp"}
        </button>
        {aiOpen && (
          <div className="px-3 pb-3 space-y-2.5">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-[11px]">Nguồn</Label>
                <Select value={aiMode} onValueChange={setAiMode}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="idea">Ý tưởng / cảnh ngắn</SelectItem>
                    <SelectItem value="chapter">Nội dung chương truyện</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-36 space-y-1">
                <Label className="text-[11px]">Độ dài</Label>
                <Select value={aiLength} onValueChange={setAiLength}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Ngắn (~6 cảnh)</SelectItem>
                    <SelectItem value="medium">Trung bình (~10 cảnh)</SelectItem>
                    <SelectItem value="long">Dài (~14 cảnh)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              rows={5}
              placeholder={aiMode === "chapter" ? "Dán nội dung chương truyện muốn chuyển thể..." : "Mô tả ý tưởng / cảnh mở đầu bạn muốn..."}
              className="text-xs"
            />
            <Button size="sm" onClick={handleAIWrite} disabled={aiLoading} className="w-full">
              {aiLoading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Wand2 size={14} className="mr-1.5" />}
              {aiLoading ? "AI đang viết..." : "Viết kịch bản bằng AI"}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label className="text-xs">Kịch bản</Label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {SNIPPETS.map(({ label, icon: Icon, snippet, placeholder }) => (
              <button
                key={label}
                type="button"
                onClick={() => insertSnippet(snippet, placeholder)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition"
                title={`Chèn "${label}" vào vị trí con trỏ`}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">Đặt con trỏ vào chỗ muốn chèn trong kịch bản rồi bấm nút tương ứng ở trên — phần cần điền sẽ được bôi đen sẵn để gõ đè lên.</p>
        <Textarea
          ref={textareaRef}
          value={script}
          onChange={(e) => { setScript(e.target.value); setChecked(false); }}
          rows={12}
          placeholder="Dán kịch bản viết tay vào đây, hoặc dùng nút 'Nhờ AI viết kịch bản giúp' ở trên..."
          className="font-mono text-xs"
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={handleCheck} disabled={checking} variant="outline" className="flex-1">
          {checking ? <Loader2 size={16} className="mr-2 animate-spin" /> : <ClipboardCheck size={16} className="mr-2" />}
          {checking ? "Đang kiểm tra..." : "Kiểm Tra Kịch Bản"}
        </Button>
        <Button onClick={handleProduce} disabled={producing} className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
          {producing ? <Loader2 size={16} className="mr-2 animate-spin" /> : <FileText size={16} className="mr-2" />}
          {producing ? "Đang sản xuất..." : "Sản Xuất Game"}
        </Button>
      </div>

      {checked && warnings.length === 0 && (
        <div className="text-[11px] rounded-lg p-2.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-semibold">
          <CheckCircle2 size={12} /> Không phát hiện lỗi nào — kịch bản sẵn sàng để sản xuất.
        </div>
      )}

      {warnings.length > 0 && (
        <div className="text-[11px] rounded-lg p-2.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={12} /> {warnings.length} lỗi/cảnh báo — bấm vào 1 dòng để nhảy tới + bôi đen đúng chỗ sai trong ô kịch bản:</div>
          <ul className="list-disc list-inside space-y-0.5">
            {warnings.map((w, i) => {
              const clickable = resolveWarningPosition(script, w) !== null;
              return (
                <li key={i}>
                  {clickable ? (
                    <button type="button" onClick={() => jumpToWarning(textareaRef, script, w)} className="text-left underline decoration-dotted decoration-amber-500/50 hover:decoration-solid hover:text-amber-800 dark:hover:text-amber-300">
                      {w}
                    </button>
                  ) : w}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
