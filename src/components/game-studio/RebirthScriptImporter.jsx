import React, { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Wand2, Loader2, AlertTriangle, Copy, Check, MessageSquarePlus, ListPlus, GitBranchPlus, FlagTriangleRight, ClipboardCheck, CheckCircle2 } from "lucide-react";
import { parseRebirthScript } from "@/lib/gameStudio/rebirthScriptParser";
import { generateRebirthScriptFromPrompt } from "@/lib/gameStudio/rebirthScriptWriter";
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
// ("Xưởng Offline"), SystemScriptImporter.jsx/systemScriptParser.js ("Xưởng
// Hệ Thống") hay PalaceScriptImporter.jsx/palaceScriptParser.js ("Xưởng Cung
// Đấu"), sửa file này không ảnh hưởng gì tới các xưởng đó.
// Dưới đây là KỊCH BẢN MẪU HOÀN CHỈNH, viết không dấu #/##/** như người dùng
// thường gõ, dán y vậy vẫn chạy — phủ đủ mọi cơ chế của xưởng này:
// Vốn (chỉ số sinh tử → niên đại làm giàu), Danh vọng, "→ Cơ hội:" (tin nội
// bộ/dự án), Cờ truyện (hợp đồng đã chốt), Vật phẩm (giấy tờ/nguyên liệu),
// và nhiều kết thúc khác nhau.
const CHEAT_SHEET = `Tay Trắng Trọng Sinh
Thể loại: Trọng Sinh Làm Giàu
Chỉ số sinh tử: Vốn < 5, Sức khỏe < 1
Chỉ số khởi đầu: Vốn = 50, Sức khỏe = 3, Danh vọng = 2
Thông báo thua cuộc: Phá Sản | Vốn cạn kiệt, nhà xưởng bị siết nợ. Nhưng trọng sinh một lần nữa...?
Thang thời đại: 1995 · Vốn mồ hôi = 0 (+0) | 1999 · Cổ phiếu vàng = 60 (+5) | 2003 · Đất vàng = 200 (+10) | 2007 · Đế chế = 600 (+20) | 2011 · Huyền thoại = 1500 (+35)

GIỚI THIỆU
→ Cơ hội: THOÁT KIẾP PHÁ SẢN | Năm 2011, công ty của bạn sắp sập. Một cơn ngất — và bạn tỉnh dậy ở năm 1995, khi trái tim bạn vẫn là một kẻ từng thấy tương lai.
Năm 1995, không một ai biết trước cuộc cách mạng công nghệ, cơn sốt đất, hay đỉnh cao cổ phiếu ngân hàng. Còn bạn — biết tất cả. Chỉ cần 50 đồng vốn mồ hôi, bạn sẽ xây lại cả một đế chế.

CẢNH 1 — Mùa cà phê đầu tiên
→ Cơ hội: CƠN SỐT CÀ PHÊ | Giá cà phê thế giới sắp tăng gấp ba sau vụ hạn hán, còn nguyên liệu trong nước đang rẻ như cho.
Trên phố nhỏ, bà Năm mở kho cà phê thô. Bạn nhớ rõ báo cáo thị trường năm 96 — lời to nếu kịp gom hàng.

A — Xuống toàn bộ vốn mua cà phê
→ Vốn +20
→ Cờ: ký được hợp đồng cà phê
→ Cơ hội: HỢP ĐỒNG CÀ PHÊ | Đã ký mua 10 tấn cà phê thô. Giá thế giới tăng, bạn lời gấp đôi.

B — Mua một nửa, giữ lại tiền đất
→ Vốn +5
→ Vật phẩm: Sổ ghi chép quy hoạch đất
→ Đến cảnh 2

C — Đi vay ngân hàng mua cả kho
→ Cần Danh vọng >= 2
→ Vốn +30
→ Cờ: ký được hợp đồng cà phê
→ Cơ hội: CÒNG LƯNG TRẢ NỢ | Vay nặng lãi để mua cả kho cà phê. Lời lớn, nhưng chỉ cần một cú lỡ nhịp là mất trắng.

CẢNH 2 — Cổ phiếu ngân hàng 1999
→ Cơ hội: CỔ PHIẾU NGÂN HÀNG | Thị trường chứng khoán vừa ra đời. Cổ phiếu ngân hàng Đông Á sắp bùng nổ gấp mười lần.
Trước cái bàn gỗ cũ kỹ của phòng giao dịch, bạn nhớ từng con số trong cuốn tài chính từng đọc.

A — Đổ tiền mua cổ phiếu Đông Á
→ Cần Vốn >= 60
→ Vốn +50
→ Cơ hội: CỔ PHIẾU BÙNG NỔ | Cổ phiếu Đông Á tăng 10 lần đúng như bạn dự đoán. Thị trường nhốn nháo gọi bạn là "thần đồng chứng khoán".

B — Mua rồi bán lướt sóng
→ Vốn +15
→ Danh vọng +3
→ Cơ hội: TIN ĐỒN NHÀ ĐẦU TƯ | Nhà đầu tư bắt đầu để mắt tới bạn.

C — Giữ tiền mặt chờ đất vàng
→ Vật phẩm: Sổ ghi chép quy hoạch đất
→ Đến cảnh 3

CẢNH 3 — Cơn sốt đất 2003
→ Cơ hội: ĐẤT VÀNG QUẬN 3 | Quy hoạch mở đường nội đô sắp công bố, giá đất Quận 3 sẽ tăng chóng mặt.
Ông Tám cần bán gấp lô đất mặt tiền. Bạn biết chính xác con phố này 10 năm sau sẽ là gì.

A — Cầm sổ quy hoạch mua cả lô đất
→ Cần vật phẩm: Sổ ghi chép quy hoạch đất
→ Vốn +200
→ Cờ: sở hữu lô đất Quận 3
→ Cơ hội: LÔ ĐẤT MẶT TIỀN | Giá lô đất tăng gấp 20 lần. Bạn thành người giàu có trong giới địa ốc.

B — Mua dùm ông Tám với giá thấp
→ Cần Vốn >= 200
→ Vốn +100
→ Danh vọng +5
→ Cờ: sở hữu lô đất Quận 3

C — Bỏ qua, ôm cổ phiếu cho tới 2007
→ Cờ: ôm cổ phiếu dài hạn
→ Đến cảnh 4

CẢNH 4 — Đỉnh cao 2007
→ Cơ hội: BONG BÓNG CHỨNG KHOÁN | Năm 2007, cổ phiếu đạt đỉnh lịch sử — nhưng cuối năm sẽ sụp đổ. Bạn phải thoát hàng đúng lúc.
Bàn tay bạn run run trên điện thoại bàn. Toàn bộ số tiền đang gấp mười lần ban đầu.

A — Rút toàn bộ tiền khỏi thị trường
→ Cần cờ: ôm cổ phiếu dài hạn
→ Vốn +300
→ Cơ hội: THOÁT HÀNG ĐÚNG LÚC | Bạn rút đúng trước đợt khủng hoảng. Người ta gọi bạn là thiên tài, kẻ khác gọi là ma may mắn.

B — Mua thêm đất dự án nghỉ dưỡng
→ Vốn +150
→ Cờ: sở hữu khu nghỉ dưỡng
→ Kết thúc de_che

C — Liều đánh gấp ba
→ Vốn -300
→ Kết thúc pha_san

KẾT THÚC de_che — Đế Chế Vĩ Đại [TRUE_END]
Từ 50 đồng vốn mồ hôi, bạn sở hữu đất vàng, cổ phiếu, khu nghỉ dưỡng — một đế chế tài chính trải khắp ba thập kỷ. Năm 2011, bạn nhìn lại, nụ cười nhẹ: lần này, không phá sản nữa.

KẾT THÚC pha_san — Tai Thỏ Về Tay Người [BAD_END]
Tham lam quá đà, bạn không thoát hàng kịp khủng hoảng. Vốn theo cổ phiếu bốc hơi, nhà xưởng bị siết nợ. Năm 2011, bạn lại đứng trước cửa công ty sắp sập — lần này, còn ai cho bạn trọng sinh lần nữa?`

const CHEAT_SHEET_NOTES = `CÁCH DÙNG:
- Mỗi lựa chọn nên có 1 dòng "→ Đến cảnh N" hoặc "→ Kết thúc <nhãn>". Bỏ qua thì
  tự sang CẢNH kế tiếp. Trong bản mẫu, chọn B ở CẢNH 2 sẽ đi thẳng tới CẢNH 3 —
  còn chọn C ở CẢNH 1 thì MẤT cơ hội lấy "Sổ ghi chép quy hoạch đất".
- "→ Cần Vốn >= N", "→ Cần cờ:", "→ Cần vật phẩm:", "→ Cần Danh vọng >= N" khoá
  lựa chọn nếu chưa đủ điều kiện — lựa chọn trước quyết định lựa chọn sau.
- "→ Cơ hội: TIÊU ĐỀ | Nội dung" bật bảng thông báo tin nội bộ/phi vụ. NIÊN ĐẠI
  làm giàu tự tính từ Vốn (chạm mốc "1999 · Cổ phiếu vàng = 60" thì đế chế thăng
  niên đại và cộng thêm khoản thu nhập một lần: "tiền đẻ ra tiền").
- "→ Vốn -N" là lỗ vốn — đừng ngại làm lỗ sát ngưỡng phá sản ("Vốn < 5") để căng
  thẳng đúng chất chốn thương trường.`


export default function RebirthScriptImporter({ gameData, setGameData, onGenerated }) {
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
    { label: "Cơ hội", icon: MessageSquarePlus, snippet: "→ Cơ hội: Tiêu đề | Nội dung tin nội bộ / phi vụ", placeholder: "Tiêu đề" },
    { label: "Cảnh mới", icon: ListPlus, snippet: "CẢNH X — Tên cảnh\nDiễn biến của cảnh.", placeholder: "X" },
    { label: "Lựa chọn", icon: GitBranchPlus, snippet: "A — Lời lựa chọn\n→ Vốn +10\n→ Cờ: ký được hợp đồng\n→ Đến cảnh X", placeholder: "Lời lựa chọn" },
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
      const text = await generateRebirthScriptFromPrompt({ mode: aiMode, input: aiInput, length: aiLength });
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
      const result = parseRebirthScript(script, gameData.meta);
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
      const result = parseRebirthScript(script, gameData.meta);
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
    <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-3 border border-emerald-500/20">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Bot size={16} className="text-emerald-500" /> Xưởng Trọng Sinh Làm Giàu — vốn, phi vụ &amp; đế chế
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Xưởng riêng dành cho thể loại "Trọng Sinh Làm Giàu" — dán kịch bản theo cú pháp bên dưới (hoặc để AI viết giúp) để game tự tính NIÊN ĐẠI LÀM GIÀU từ Vốn (chạm mốc vốn là "tiền đẻ ra tiền"), tự hiện bảng "Cơ Hội" tin nội bộ/phi vụ, và tự cộng/trừ tiền lời lỗ. Hoàn toàn tách biệt với "Xưởng Thiết Kế", "Xưởng Hệ Thống" và "Xưởng Cung Đấu" — dùng xưởng nào cũng không ảnh hưởng xưởng kia.
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
        <Button onClick={handleProduce} disabled={producing} className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
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
