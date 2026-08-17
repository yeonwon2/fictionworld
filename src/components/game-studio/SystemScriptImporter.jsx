import React, { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Wand2, Loader2, AlertTriangle } from "lucide-react";
import { parseSystemScript } from "@/lib/gameStudio/systemScriptParser";
import { generateSystemScriptFromPrompt } from "@/lib/gameStudio/systemScriptWriter";
import { useToast } from "@/components/ui/use-toast";

// Xưởng RIÊNG BIỆT — không import gì từ ScriptImporter.jsx/scriptParser.js
// của "Xưởng Offline", sửa file này không ảnh hưởng gì tới xưởng đó.
const CHEAT_SHEET = `# Tên game
**Thể loại:** ...
**Chỉ số sinh tử:** Thiện cảm < 10        (tuỳ chọn — chỉ số này tụt dưới 10 là Game Over ngay)

## GIỚI THIỆU
→ Hệ thống: HỆ THỐNG SỐ 01 | Xin chào ký chủ! Chào mừng ký chủ đến với thế giới này...
Văn bản mở đầu.

## CẢNH 1 — Tên cảnh
→ Hệ thống: NHẮC NHỞ | Ký chủ hãy cẩn thận, tránh làm lệch cốt truyện.
Diễn biến của cảnh.

**A — Lựa chọn phạm luật hệ thống**
→ Thiện cảm -10
→ Hệ thống: CẢNH BÁO | Ký chủ đã làm lệch cốt truyện, bị phạt chích điện, trừ 10 thiện cảm!

**B — Lựa chọn đúng cốt truyện**
→ Thiện cảm +15
→ Hệ thống: PHẦN THƯỞNG | Ký chủ đã hoàn thành đúng cốt truyện! Thưởng 15 điểm thiện cảm.
→ Đến cảnh 2                  (số 2 PHẢI có "## CẢNH 2" thật ở dưới, không thì báo lỗi)

## CẢNH 2 — ...
...

## KẾT THÚC nhan_ket_thuc — Tên kết thúc [TRUE_END]
Văn bản kết thúc.

Ghi chú:
- "→ Hệ thống: <tiêu đề> | <nội dung>" đặt NGAY DƯỚI "## CẢNH N" (trước lựa
  chọn A) thì bật bảng thông báo khi VÀO cảnh; đặt BÊN TRONG 1 lựa chọn thì
  bật NGAY SAU KHI chọn (dùng cho phạt/thưởng). Mỗi cảnh/lựa chọn tối đa 1
  dòng này. Tiêu đề và nội dung cách nhau bằng dấu "|".
- Loại kết thúc trong [ ] CHỈ được 1 trong 4: TRUE_END / GOOD_END / NORMAL_END /
  BAD_END (bỏ qua [ ] thì mặc định NORMAL_END). Không có rẽ nhánh kiểu "Nếu...
  thì Đến..." trong 1 lựa chọn — muốn rẽ nhánh theo điều kiện, viết 2 lựa chọn
  riêng, mỗi cái khoá bằng "Cần cờ:"/"Cần không có cờ:" đối lập nhau.`;

export default function SystemScriptImporter({ gameData, setGameData, onGenerated }) {
  const [script, setScript] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState("idea");
  const [aiLength, setAiLength] = useState("medium");
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [producing, setProducing] = useState(false);
  const { toast } = useToast();

  const handleAIWrite = async () => {
    if (!aiInput.trim()) {
      toast({ variant: "destructive", title: "Thiếu nội dung", description: "Nhập ý tưởng hoặc dán nội dung chương truyện." });
      return;
    }
    setAiLoading(true);
    try {
      const text = await generateSystemScriptFromPrompt({ mode: aiMode, input: aiInput, length: aiLength });
      setScript(text);
      toast({ title: "AI đã viết xong kịch bản", description: "Kiểm tra/sửa lại bên dưới rồi bấm Sản Xuất Game." });
    } catch (e) {
      toast({ variant: "destructive", title: "Lỗi viết kịch bản", description: e.message || "Vui lòng thử lại." });
    } finally {
      setAiLoading(false);
    }
  };

  const handleProduce = () => {
    if (!script.trim()) {
      toast({ variant: "destructive", title: "Chưa có kịch bản", description: "Dán hoặc viết kịch bản trước." });
      return;
    }
    setProducing(true);
    try {
      const result = parseSystemScript(script, gameData.meta);
      setGameData(result);
      setWarnings(result.warnings || []);
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
    <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-3 border border-violet-500/20">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Bot size={16} className="text-violet-500" /> Xưởng Hệ Thống — Bảng thông báo, phạt &amp; thưởng
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Xưởng riêng dành cho thể loại "Hệ Thống" (trọng sinh/xuyên không có hệ thống dẫn dắt) — dán kịch bản theo cú pháp bên dưới (hoặc để AI viết giúp) để game tự bật bảng thông báo chào mừng, nhắc nhở giữa chừng, và phạt/thưởng ngay sau khi người chơi chọn. Hoàn toàn tách biệt với "Xưởng Thiết Kế" — dùng xưởng nào cũng không ảnh hưởng xưởng kia.
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
        <Label className="text-xs">Kịch bản</Label>
        <Textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={12}
          placeholder="Dán kịch bản viết tay vào đây, hoặc dùng nút 'Nhờ AI viết kịch bản giúp' ở trên..."
          className="font-mono text-xs"
        />
      </div>

      <Button onClick={handleProduce} disabled={producing} className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700">
        {producing ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Bot size={16} className="mr-2" />}
        {producing ? "Đang sản xuất..." : "Sản Xuất Game (Hệ Thống)"}
      </Button>

      {warnings.length > 0 && (
        <div className="text-[11px] rounded-lg p-2.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={12} /> {warnings.length} cảnh báo khi sản xuất:</div>
          <ul className="list-disc list-inside space-y-0.5">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
