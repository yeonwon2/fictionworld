import React, { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Wand2, Loader2, AlertTriangle, Copy, Check, MessageSquarePlus, ListPlus, GitBranchPlus, FlagTriangleRight, ClipboardCheck, CheckCircle2 } from "lucide-react";
import { parsePalaceScript } from "@/lib/gameStudio/palaceScriptParser";
import { generatePalaceScriptFromPrompt } from "@/lib/gameStudio/palaceScriptWriter";
import { useToast } from "@/components/ui/use-toast";

// Chèn 1 đoạn cú pháp mẫu ngay tại vị trí con trỏ trong ô kịch bản — dùng cho
// các nút "+ Thêm ..." bên dưới. Nếu snippet có 1 đoạn trùng "placeholder",
// đoạn đó được BÔI ĐEN sẵn sau khi chèn để gõ đè lên ngay, không cần tự chọn.
function insertSnippetAtCursor({ textareaRef, script, setScript, snippet, placeholder }) {
  const el = textareaRef.current;
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
  const lineIndex = script.slice(0, pos.start).split("\n").length - 1;
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 18;
  const target = lineIndex * lineHeight - el.clientHeight / 2;
  el.scrollTop = Math.max(0, Math.min(target, el.scrollHeight - el.clientHeight));
  return true;
}

// Xưởng RIÊNG BIỆT — không import gì từ ScriptImporter.jsx/scriptParser.js
// ("Xưởng Offline") hay SystemScriptImporter.jsx/systemScriptParser.js
// ("Xưởng Hệ Thống"), sửa file này không ảnh hưởng gì tới các xưởng đó.
// Dưới đây là KỊCH BẢN MẪU HOÀN CHỈNH, viết không dấu #/##/** như người dùng
// thường gõ, dán y vậy vẫn chạy — phủ đủ mọi cơ chế của xưởng này:
// Sủng Ái (chỉ số sinh tử → cấp bậc tần phi), Thế Lực, Hảo cảm phe phái,
// Cờ truyện (mưu kế), Vật phẩm (chứng cứ), "→ Chỉ dụ:" (bảng thông báo hoàng
// cung), thăng chức, và nhiều kết thúc khác nhau.
const CHEAT_SHEET = `Mộng Hoa Cung
Thể loại: Cung Đấu
Chỉ số sinh tử: Sủng Ái < 10, Thế Lực < 5
Chỉ số khởi đầu: Sủng Ái = 30, Thế Lực = 8
Thông báo thua cuộc: Bị Phế Truất | Thất sủng quá mức, nàng bị đày vào lãnh cung. Số phận khép lại.
Cấp bậc hậu cung: Thường Tại / Quý Nhân / Tần / Quý Tần / Phi / Quý Phi / Hoàng Quý Phi / Hoàng Hậu

GIỚI THIỆU
→ Chỉ dụ: CHIẾU VÀO CUNG | Hoàng thượng triệu tân tú Tô Mộc Lan nhập cung, ban cho tước vị Thường Tại.
Đêm đầu nhập cung, ta — Tô Mộc Lan, con gái một vị quan nhỏ — bước vào hậu cung hoa lệ mà tối tăm này. Nơi đây mỗi bước chân đều là một canh bạc.

CẢNH 1 — Triệu kiến buổi sớm
→ Chỉ dụ: TRIỀU TÂN | Sáng sớm, các phi tần phải đến Cung Khôn Ninh vấn an Thái Hậu.
Tại Cung Khôn Ninh, Thái Hậu ngồi cao trên kiệu, ánh mắt dò xét từng người. Bên trái là Hoàng hậu Ôn Như Kiều, bên phải là Quý Phi Lâm Nguyệt Linh — hai thế lực lớn nhất hậu cung.

A — Cúi đầu kính cẩn, không nói nhiều
→ Hảo cảm Thái Hậu +10
→ Hảo cảm Hoàng hậu +10
→ Đến cảnh 2

B — Khéo léo khen ánh trăng đêm qua
→ Sủng Ái +5
→ Hảo cảm Quý Phi +10
→ Hảo cảm Thái Hậu -5
→ Chỉ dụ: ÁNH MẮT CỦA THÁI HẬU | Thái Hậu nhíu mày. Quá lộng lời chưa hẳn là hay, người khẽ nói: "Tân tú còn trẻ, biết thân biết phận là hơn."
→ Đến cảnh 3

C — Đứng im quan sát, ghi nhớ mọi thứ
→ Thế Lực +5
→ Cờ: đã nắm được thói quen của Quý Phi
→ Đến cảnh 2

CẢNH 2 — Bữa tiệc của Quý Phi
→ Chỉ dụ: YẾN TIỆC | Quý Phi Lâm Nguyệt Linh mở tiệc thưởng hoa tại Ngự Hoa Viên, mời toàn bộ phi tần.
Rượu thơm hoa nở, Quý Phi mỉm cười nhưng ánh mắt lại lạnh lùng. Giữa tiệc, nàng ta cố ý làm vấp cái ly rượu, khiến áo Hoàng hậu ướt đẫm — rồi nhìn về phía ta.

A — Vờ ngây thơ đứng dậy dâng khăn cho Hoàng hậu
→ Hảo cảm Hoàng hậu +10
→ Hảo cảm Quý Phi -10
→ Đến cảnh 3

B — Thuận nước đẩy thuyền, đổ lỗi cho một cung nữ
→ Sủng Ái -5
→ Thế Lực -3
→ Hảo cảm Thái Hậu -5
→ Đến cảnh 3

C — Đứng dậy bảo vệ cung nữ vô tội
→ Cần hảo cảm Hoàng hậu >= 10
→ Hảo cảm Hoàng hậu +15
→ Hảo cảm Quý Phi -15
→ Vật phẩm: Lòng trung thành của cung nữ Tiểu Hạnh
→ Chỉ dụ: TIẾNG ĐỒN | Chuyện nàng bảo vệ cung nữ lan khắp hậu cung. Người kính nể, kẻ thù ghét.
→ Đến cảnh 3

CẢNH 3 — Mưu kế của Quý Phi
→ Chỉ dụ: TỐ GIÁN | Quý Phi sai người tố cáo ta hạ độc Quý Tần, nhét "chứng cứ" vào cung điện của ta.
Quý Tần trúng độc nằm liệt giường. Chỉ huy sứ mang theo một vỏ bọc độc dược tìm thấy trong khuê phòng của ta, đòi đưa ta vào đại lao.

A — Bình tĩnh xin tra xét, chỉ vào vết tích lạ
→ Cần cờ: đã nắm được thói quen của Quý Phi
→ Hảo cảm Thái Hậu +10
→ Cờ: đã lật tẩy âm mưu hạ độc
→ Đến cảnh 4

B — Khóc lóc cầu xin Hoàng thượng minh oan
→ Sủng Ái -10
→ Hảo cảm Hoàng hậu +5
→ Đến cảnh 4

C — Đưa chứng cứ do Tiểu Hạnh tìm ra
→ Cần vật phẩm: Lòng trung thành của cung nữ Tiểu Hạnh
→ Sủng Ái +15
→ Hảo cảm Thái Hậu +10
→ Cờ: đã lật tẩy âm mưu hạ độc
→ Chỉ dụ: PHONG HẬU | Sủng Ái vượt ngưỡng, Hoàng thượng thăng ta lên bậc Phi. Ngự Hoa Viên đổi màu, kẻ thù căm hận, người thân mừng rỡ.
→ Đến cảnh 4

CẢNH 4 — Cạnh tranh ngôi Hậu
Thái Hậu niên cao đã muốn lập người kế ngôi Hậu. Hoàng hậu Ôn Như Kiều ngày càng nghi kỵ ta; Quý Phi thì đã bị giam vào lãnh cung sau vụ hạ độc. Giờ chỉ còn ta và Hoàng hậu trên bàn cân.

A — Lựa chọn lợi dụng điểm yếu của Hoàng hậu
→ Cần hảo cảm Hoàng hậu <= 10
→ Hảo cảm Hoàng hậu -20
→ Sủng Ái +20
→ Kết thúc ngai_vang

B — Chủ động gặp Hoàng hậu giảng hoà, cùng chống lại kẻ ngoài
→ Cần hảo cảm Hoàng hậu >= 20
→ Hảo cảm Hoàng hậu +20
→ Sủng Ái +10
→ Kết thúc song_toan

C — Liều lĩnh tố cáo cả Hoàng hậu lẫn Quý Phi trước mặt Hoàng thượng
→ Sủng Ái -25
→ Thế Lực -8
→ Kết thúc lao_nguc

KẾT THÚC ngai_vang — Một Mình Trên Cao [GOOD_END]
Sủng ái của Hoàng thượng khiến mọi đối thủ phải khuất phục. Ta được phong làm Hoàng Hậu, nhưng đêm đó cũng không có ai để cùng trò chuyện. Ngôi vị cao nhất hậu cung, hóa ra lại lạnh lẽo nhất.

KẾT THÚC song_toan — Nhiều Kẻ Sống Sót [TRUE_END]
Hoàng hậu và ta cùng nhau bày mưu, dẹp tan mọi phe phái. Hoàng thượng thấy được tài trí lẫn nhau của hai người, phong ta làm Hoàng Hậu, Hoàng hậu cũ làm Hoàng Quý Phi. Hậu cung lần đầu yên bình — kẻ sống sót không chỉ có một.

KẾT THÚC lao_nguc — Lãnh Cung [BAD_END]
Mọi âm mưu bị phanh phui, ta mất hết sủng ái lẫn thế lực. Đêm khuya, cánh cửa lãnh cung đóng sầm lại sau lưng. Ta nghe tiếng người cười nhạo ngoài tường cao.`

const CHEAT_SHEET_NOTES = `CÁCH DÙNG:
- Mỗi lựa chọn nên có 1 dòng "→ Đến cảnh N" hoặc "→ Kết thúc <nhãn>". Bỏ qua thì
  tự sang CẢNH kế tiếp. Trong bản mẫu, chọn B ở CẢNH 1 sẽ BỎ QUA CẢNH 2 — đó là
  rẽ nhánh cảnh thật (mất luôn cơ hội lấy vật phẩm "Lòng trung thành...").
- "→ Cần hảo cảm <tên> >= N" / "<= N", "→ Cần cờ:", "→ Cần vật phẩm:" khoá lựa
  chọn nếu chưa đủ điều kiện — chính là chỗ lựa chọn trước quyết định lựa chọn sau.
- "→ Chỉ dụ: TIÊU ĐỀ | Nội dung" bật bảng thông báo hoàng cung. Cấp bậc tần phi
  tự tính từ Sủng Ái (mỗi 15 điểm trên ngưỡng sống thăng 1 cấp).`


export default function PalaceScriptImporter({ gameData, setGameData, onGenerated }) {
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
  const [cheatSheetCopied, setCheatSheetCopied] = useState(false);
  const textareaRef = useRef(null);
  const { toast } = useToast();

  const insertSnippet = (snippet, placeholder) => insertSnippetAtCursor({ textareaRef, script, setScript, snippet, placeholder });

  const SNIPPETS = [
    { label: "Chỉ dụ", icon: MessageSquarePlus, snippet: "→ Chỉ dụ: Tiêu đề | Nội dung thông báo hoàng cung", placeholder: "Tiêu đề" },
    { label: "Cảnh mới", icon: ListPlus, snippet: "CẢNH X — Tên cảnh\nDiễn biến của cảnh.", placeholder: "X" },
    { label: "Lựa chọn", icon: GitBranchPlus, snippet: "A — Lời lựa chọn\n→ Sủng Ái +5\n→ Hảo cảm Quý Phi +5\n→ Đến cảnh X", placeholder: "Lời lựa chọn" },
    { label: "Kết thúc", icon: FlagTriangleRight, snippet: "KẾT THÚC nhan_ket_thuc — Tên kết thúc [TRUE_END]\nVăn bản kết thúc.", placeholder: "nhan_ket_thuc" },
  ];

  const copyCheatSheet = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(CHEAT_SHEET);
      setCheatSheetCopied(true);
      setTimeout(() => setCheatSheetCopied(false), 1500);
      toast({ title: "Đã sao chép kịch bản mẫu" });
    } catch (err) {
      toast({ variant: "destructive", title: "Không sao chép được", description: err.message });
    }
  };

  const handleAIWrite = async () => {
    if (!aiInput.trim()) {
      toast({ variant: "destructive", title: "Thiếu nội dung", description: "Nhập ý tưởng hoặc dán nội dung chương truyện." });
      return;
    }
    setAiLoading(true);
    try {
      const text = await generatePalaceScriptFromPrompt({ mode: aiMode, input: aiInput, length: aiLength });
      setScript(text);
      toast({ title: "AI đã viết xong kịch bản", description: "Kiểm tra/sửa lại bên dưới rồi bấm Sản Xuất Game." });
    } catch (e) {
      toast({ variant: "destructive", title: "Lỗi viết kịch bản", description: e.message || "Vui lòng thử lại." });
    } finally {
      setAiLoading(false);
    }
  };

  const handleCheck = () => {
    if (!script.trim()) {
      toast({ variant: "destructive", title: "Chưa có kịch bản", description: "Dán hoặc viết kịch bản trước." });
      return;
    }
    setChecking(true);
    try {
      const result = parsePalaceScript(script, gameData.meta);
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
      const result = parsePalaceScript(script, gameData.meta);
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
    <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-3 border border-amber-500/20">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Bot size={16} className="text-amber-500" /> Xưởng Cung Đấu — Sủng Ái, mưu kế &amp; phe phái
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Xưởng riêng dành cho thể loại "Cung Đấu" — dán kịch bản theo cú pháp bên dưới (hoặc để AI viết giúp) để game tự tính CẤP BẬC TẦN PHI từ Sủng Ái, tự hiện bảng "Chỉ Dụ" hoàng cung, và tự cộng/trừ hảo cảm giữa các phi tần. Hoàn toàn tách biệt với "Xưởng Thiết Kế" và "Xưởng Hệ Thống" — dùng xưởng nào cũng không ảnh hưởng xưởng kia.
      </p>

      <details className="text-xs rounded-lg border border-border">
        <summary className="cursor-pointer px-3 py-2 font-medium select-none flex items-center justify-between gap-2">
          <span>Xem kịch bản mẫu (đầy đủ)</span>
          <button
            type="button"
            onClick={copyCheatSheet}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-normal text-muted-foreground hover:text-foreground hover:bg-accent transition shrink-0"
            title="Sao chép kịch bản mẫu để gửi cho AI"
          >
            {cheatSheetCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            {cheatSheetCopied ? "Đã sao chép" : "Sao chép"}
          </button>
        </summary>
        <pre className="px-3 pb-3 whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">{CHEAT_SHEET}</pre>
        <pre className="px-3 pb-3 whitespace-pre-wrap font-mono text-[11px] text-muted-foreground border-t border-border">{CHEAT_SHEET_NOTES}</pre>
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
          placeholder="Dán kịch bản viết tay vào đây (hoặc bấm 'Xem kịch bản mẫu' → 'Sao chép' → dán thử), hoặc dùng nút 'Nhờ AI viết kịch bản giúp' ở trên..."
          className="font-mono text-xs"
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={handleCheck} disabled={checking} variant="outline" className="flex-1">
          {checking ? <Loader2 size={16} className="mr-2 animate-spin" /> : <ClipboardCheck size={16} className="mr-2" />}
          {checking ? "Đang kiểm tra..." : "Kiểm Tra Kịch Bản"}
        </Button>
        <Button onClick={handleProduce} disabled={producing} className="flex-1 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700">
          {producing ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Bot size={16} className="mr-2" />}
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
