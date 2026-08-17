import React, { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Wand2, Loader2, AlertTriangle } from "lucide-react";
import { parseScript } from "@/lib/gameStudio/scriptParser";
import { generateScriptFromPrompt } from "@/lib/gameStudio/scriptWriter";
import { useToast } from "@/components/ui/use-toast";

const CHEAT_SHEET = `# Tên game
**Thể loại:** ...
**Chỉ số sinh tử:** Thiện cảm < 10      (tuỳ chọn — chỉ số này tụt dưới 10 là Game Over ngay)

## GIỚI THIỆU
→ Hệ thống: HỆ THỐNG SỐ 01 | Xin chào ký chủ! ...   (tuỳ chọn — bảng thông báo bật khi vào game)
Văn bản mở đầu.

## CẢNH 1 — Tên cảnh
→ Hệ thống: NHẮC NHỞ | Nội dung nhắc nhở...   (tuỳ chọn — bảng thông báo bật khi VÀO cảnh này)
Diễn biến của cảnh.

**A — Lời lựa chọn**
→ Tên chỉ số +5
→ Cờ: ten_co
→ Cần cờ: ten_co              (khoá nếu CHƯA có cờ)
→ Cần không có cờ: ten_co     (khoá nếu ĐÃ có cờ — dùng làm nhánh "else")
→ Cần vật phẩm: tên vật phẩm
→ Đến cảnh 2                  (số 2 PHẢI có "## CẢNH 2" thật ở dưới, không thì báo lỗi)
→ Kết thúc nhan_ket_thuc       (nhãn PHẢI khớp y hệt "## KẾT THÚC nhan_ket_thuc" ở dưới)

**B — Lựa chọn phạm quy (ví dụ phạt)**
→ Thiện cảm -10
→ Hệ thống: CẢNH BÁO | Ký chủ đã làm lệch cốt truyện, bị phạt chích điện, trừ 10 thiện cảm!
     (đặt "→ Hệ thống: ..." NGAY TRONG 1 lựa chọn để bảng thông báo bật lên
     NGAY SAU KHI chọn — dùng cho phạt/thưởng. Tiêu đề và nội dung cách nhau
     bằng dấu " | ". Mỗi cảnh/lựa chọn chỉ nên có 1 dòng "→ Hệ thống")

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
  const { toast } = useToast();

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
        <Label className="text-xs">Kịch bản</Label>
        <Textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={12}
          placeholder="Dán kịch bản viết tay vào đây, hoặc dùng nút 'Nhờ AI viết kịch bản giúp' ở trên..."
          className="font-mono text-xs"
        />
      </div>

      <Button onClick={handleProduce} disabled={producing} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
        {producing ? <Loader2 size={16} className="mr-2 animate-spin" /> : <FileText size={16} className="mr-2" />}
        {producing ? "Đang sản xuất..." : "Sản Xuất Game (Offline)"}
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
