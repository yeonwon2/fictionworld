import React, { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Wand2, Loader2, AlertTriangle, Copy, ClipboardList, Check, MessageSquarePlus, ListPlus, GitBranchPlus, FlagTriangleRight, ClipboardCheck, CheckCircle2, Lightbulb } from "lucide-react";
import { parseRebirthScript } from "@/lib/gameStudio/rebirthScriptParser";
import { isSuggestionWarning, categorizeSuggestion, SUGGESTION_CATEGORIES } from "@/lib/gameStudio/postprocess";
import { verifyAndFixScript } from "@/lib/gameStudio/fixScriptWithAI";
import { generateRebirthScriptFromPrompt } from "@/lib/gameStudio/rebirthScriptWriter";
import { useToast } from "@/components/ui/use-toast";
import AiFixReview from "./AiFixReview";

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
// Dưới đây là KỊCH BẢN MẪU DẠNG CHUNG (giống Xưởng Công Lược) — chỉ để nắm CÚ
// PHÁP của xưởng này: Vốn (chỉ số sinh tử → niên đại làm giàu), Danh vọng,
// "→ Cơ hội:" (tin nội bộ/dự án), Cờ truyện (hợp đồng đã chốt), Vật phẩm
// (giấy tờ/nguyên liệu), và nhiều kết thúc khác nhau. Nội dung là CHỖ TRỐNG —
// gõ đè tên truyện, nhân vật, cảnh của BẠN vào để viết truyện MỚI, đừng chép
// theo đúng 1 cốt truyện duy nhất nào cả.
const CHEAT_SHEET = `Trọng Sinh — Tên truyện
Thể loại: ...
Chỉ số sinh tử: Vốn < 5, Sức khỏe < 1   (tuỳ chọn — tụt xuống ngưỡng là PHÁ SẢN/Game Over.
                                          Chỉ số ĐẦU TIÊN nên là "Vốn" vì niên đại làm giàu
                                          được tính từ nó. Khai nhiều chỉ số cách nhau dấu phẩy.)
Chỉ số khởi đầu: Vốn = 50, Sức khỏe = 3 (QUAN TRỌNG nếu có "Chỉ số sinh tử" ở trên — nếu
                                          không khai, chỉ số mặc định bắt đầu ở 0 và sẽ bị
                                          tính là "chết" ngay từ đầu game!)
Thông báo thua cuộc: Phá Sản | Vốn cạn kiệt, nhà xưởng bị siết nợ.
                                          (tuỳ chọn — đổi chữ hiện khi phá sản vì "Chỉ số
                                           sinh tử" ở trên, thay cho "GAME OVER" mặc định.
                                           Bỏ qua dòng này thì vẫn hiện chữ mặc định như cũ.)
Thang thời đại: 1995 · Mồ hôi = 0 (+0) | 1999 · Cổ phiếu vàng = 60 (+5) | 2003 · Đất vàng = 200 (+10) | 2007 · Đế chế = 600 (+20) | 2011 · Huyền thoại = 1500 (+35)
                                          (tuỳ chọn — mốc vốn để đế chế thăng niên đại, cách
                                           nhau dấu "|", thu nhập (+N) cộng MỘT LẦN khi thăng
                                           niên đại. Bỏ qua thì dùng mặc định.)

GIỚI THIỆU
→ Cơ hội: THOÁT KIẾP PHÁ SẢN | Lời chào mở đầu, mời người chơi bắt đầu.
Văn bản mở đầu — khởi nghiệp tay trắng, 1-2 đoạn, có thể có lời thoại trong ngoặc kép.

CẢNH 1 — Tên cảnh
→ Cơ hội: TÊN TIN NỘI BỘ | Tin nội bộ/dự án/phi vụ — sự kiện chung của thương trường.
                                       (tuỳ chọn — đặt NGAY DƯỚI dòng CẢNH thì bật bảng
                                        thông báo khi VÀO cảnh)
Diễn biến của cảnh — cơ hội làm giàu nhờ kiến thức tương lai.

A — Lời lựa chọn ngắn
→ Vốn +20
→ Cờ: ký được hợp đồng đầu tiên
→ Cơ hội: KẾT QUẢ PHI VỤ | Công bố kết quả ngay sau khi chọn (đặt BÊN TRONG lựa chọn).

B — Lời lựa chọn khác
→ Cần Vốn >= 40
→ Vốn -10
→ Vật phẩm: Giấy tờ đất nền
→ Đến cảnh 2

CẢNH 2 — Tên cảnh
Diễn biến của cảnh.

A — Lựa chọn táo bạo
→ Cần cờ: ký được hợp đồng đầu tiên
→ Vốn +300
→ Cơ hội: THĂNG NIÊN ĐẠI | Chạm mốc vốn, đế chế bước sang niên đại mới và thu thêm khoản tiền MỘT LẦN.

B — Lựa chọn an toàn
→ Cần vật phẩm: Giấy tờ đất nền
→ Vốn +50
→ Kết thúc truong_thanh

CẢNH 3 — Tên cảnh
→ Cơ hội: CƠN SỐT THỊ TRƯỜNG | Sự kiện bước ngoặt lớn của thập kỷ.
Diễn biến quyết định.

A — Liều đánh lớn
→ Cần Vốn >= 200
→ Vốn +500
→ Kết thúc de_che

B — Dừng lại đúng lúc
→ Vốn +100
→ Kết thúc an_yen

KẾT THÚC de_che — Đế Chế Vĩ Đại [TRUE_END]
Văn bản kết thúc.

KẾT THÚC truong_thanh — Trưởng Thành [GOOD_END]
Văn bản kết thúc.

KẾT THÚC an_yen — An Yên [NORMAL_END]
Văn bản kết thúc.

Ghi chú:
- Mỗi cảnh nên có 2-4 lựa chọn. Không ghi "→ Đến cảnh N"/"→ Kết thúc <nhãn>" thì tự sang CẢNH kế tiếp.
- "→ Cần Vốn >= N", "→ Cần cờ:", "→ Cần vật phẩm:" khoá lựa chọn nếu chưa đủ điều kiện — lựa chọn trước quyết định lựa chọn sau. Muốn rẽ nhánh theo điều kiện, viết 2 lựa chọn khoá "Cần cờ:"/"Cần không có cờ:" đối lập nhau.
- "→ Vốn +N/-N" là lời/lỗ tiền. "→ Danh vọng +N", "→ Sức khỏe +N"... là chỉ số phụ (tên tự do, hệ thống tự nhận).
- Loại kết thúc trong [ ] CHỈ được 1 trong 4: TRUE_END / GOOD_END / NORMAL_END / BAD_END.
- "→ Đến cảnh N"/"→ Kết thúc <nhãn>" CHỈ trỏ tới cảnh/kết thúc CÓ THẬT trong kịch bản.`;

const CHEAT_SHEET_NOTES = `CÁCH DÙNG:
- Đây là MẪU CÚ PHÁP, không phải 1 truyện hoàn chỉnh — thay mọi chữ "Tên truyện",
  "Tên cảnh", "Diễn biến của cảnh", "Văn bản kết thúc" bằng nội dung của bạn.
- Mỗi lựa chọn nên có 1 dòng "→ Đến cảnh N" hoặc "→ Kết thúc <nhãn>". Bỏ qua thì
  tự sang CẢNH kế tiếp. Có thể bỏ "→ Đến cảnh 2" ở lựa chọn A của CẢNH 1 để xem
  cách cảnh tự nối tiếp nhau.
- "→ Cần Vốn >= N", "→ Cần cờ:", "→ Cần vật phẩm:" khoá lựa chọn nếu chưa đủ điều
  kiện — lựa chọn trước quyết định lựa chọn sau.
- "→ Cơ hội: TIÊU ĐỀ | Nội dung" bật bảng thông báo tin nội bộ/phi vụ. NIÊN ĐẠI
  làm giàu tự tính từ Vốn (chạm mốc "1999 · Cổ phiếu vàng = 60" thì đế chế thăng
  niên đại và cộng thêm khoản thu nhập một lần: "tiền đẻ ra tiền").
- "→ Vốn -N" là lỗ vốn — đừng ngại làm lỗ sát ngưỡng phá sản ("Vốn < 5") để căng
  thẳng đúng chất chốn thương trường.`;


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
  const [selectedErrors, setSelectedErrors] = useState(new Set());
  const [aiFixPreview, setAiFixPreview] = useState(null);
  const textareaRef = useRef(null);
  const { toast } = useToast();

  const toggleError = (w) => {
    setSelectedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w); else next.add(w);
      return next;
    });
  };

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
      const allWarnings = result.warnings || [];
      const blockingCount = allWarnings.filter((w) => !isSuggestionWarning(w)).length;
      const suggestionCount = allWarnings.length - blockingCount;
      setWarnings(allWarnings);
      setChecked(true);
      if (blockingCount > 0) {
        toast({ variant: "destructive", title: `Tìm thấy ${blockingCount} lỗi`, description: `Xem chi tiết bên dưới rồi sửa lại trong ô kịch bản.${suggestionCount ? ` (kèm ${suggestionCount} gợi ý cải thiện)` : ""}` });
      } else if (suggestionCount > 0) {
        toast({ title: "Không có lỗi chặn đường chơi", description: `Kịch bản sẵn sàng để sản xuất — có ${suggestionCount} gợi ý cải thiện, xem bên dưới.` });
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

  
  
  const handleAIFix = async () => {
    if (!script.trim()) { toast({ variant: "destructive", title: "Chưa có kịch bản", description: "Viết hoặc dán kịch bản trước." }); return; }
    let parseWarnings;
    try {
      parseWarnings = parseRebirthScript(script, gameData.meta).warnings || [];
    } catch (e) {
      toast({ variant: "destructive", title: "Kịch bản có lỗi cú pháp", description: e.message || "Sửa lỗi cú pháp trước, rồi bấm Kiểm Tra." });
      return;
    }
    const blockingList = parseWarnings.filter((w) => !isSuggestionWarning(w));
    if (blockingList.length === 0) { toast({ title: "Không có lỗi logic", description: "Kịch bản đã sạch, không cần sửa." }); return; }
    const chosen = blockingList.filter((w) => selectedErrors.has(w));
    const focusWarnings = chosen.length > 0 ? chosen : undefined;
    setAiLoading(true);
    try {
      const report = await verifyAndFixScript({
        cheatSheet: CHEAT_SHEET,
        parseFn: (txt) => parseRebirthScript(txt, gameData.meta),
        script,
        maxRounds: 3,
        focusWarnings,
      });
      if (report.script === script) {
        toast({ variant: "destructive", title: "AI không sửa được", description: "Không tìm được cách sửa an toàn cho lỗi đã chọn — sửa tay theo cảnh báo bên dưới." });
      } else {
        setAiFixPreview({ before: script, after: report.script, explanations: report.explanations, stillHasErrors: !report.clean });
        toast({ title: focusWarnings ? `AI đã sửa ${chosen.length} lỗi đã chọn` : "AI đã đề xuất bản sửa", description: "Xem trước diff bên dưới rồi bấm Áp dụng." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Lỗi sửa kịch bản", description: e.message || "Thử lại." });
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiFix = () => {
    if (!aiFixPreview) return;
    const nextScript = aiFixPreview.after;
    setScript(nextScript);
    try {
      setWarnings(parseRebirthScript(nextScript, gameData.meta).warnings || []);
      setChecked(true);
    } catch { /* lỗi cú pháp nghiêm trọng — để nút Kiểm Tra báo lại */ }
    setSelectedErrors(new Set());
    setAiFixPreview(null);
  };

  const discardAiFix = () => setAiFixPreview(null);



  const handleAIWriteVerified = async () => {
    if (!aiInput.trim()) { toast({ variant: "destructive", title: "Thiếu nội dung", description: "Nhập ý tưởng hoặc dán nội dung chương truyện." }); return; }
    setAiLoading(true);
    try {
      const draft = await generateRebirthScriptFromPrompt({ mode: aiMode, input: aiInput, length: aiLength });
      setScript(draft);
      const report = await verifyAndFixScript({
        cheatSheet: CHEAT_SHEET,
        parseFn: (txt) => parseRebirthScript(txt, gameData.meta),
        script: draft,
        maxRounds: 3,
      });
      setScript(report.script);
      setWarnings(report.warnings || []);
      setChecked(true);
      if (report.clean) {
        toast({ title: "Kịch bản chuẩn hoàn tất", description: report.rounds > 0 ? `Đã tự sửa ${report.rounds} lượt. 0 lỗi — sẵn sàng Sản Xuất Game.` : "0 lỗi ngay từ đầu — sẵn sàng Sản Xuất Game." });
      } else {
        toast({ variant: "destructive", title: "Vẫn còn lỗi sau khi sửa", description: `Còn ${report.warnings.length} lỗi — xem bên dưới và sửa tay hoặc bấm "Sửa lỗi logic bằng AI".` });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Lỗi viết kịch bản", description: e.message || "Thử lại." });
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
      const result = parseRebirthScript(script, gameData.meta);
      result.meta = { ...(result.meta || {}), sourceScript: script };
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
  const loadFromSaved = () => {
    const saved = gameData?.meta?.sourceScript;
    if (!saved) {
      toast({ variant: "destructive", title: "Chưa có kịch bản gốc", description: "Sản xuất 1 kịch bản trước (game sẽ lưu bản gốc), hoặc dán kịch bản rồi bấm Sản Xuất Game." });
      return;
    }
    setScript(saved);
    setChecked(false);
    toast({ title: "Đã lấy lại kịch bản gốc", description: "Kịch bản văn bản đã được dán vào ô bên dưới để chỉnh sửa." });
  };

  const copyScript = async () => {
    const text = gameData?.meta?.sourceScript || script;
    if (!text) { toast({ variant: "destructive", title: "Chưa có kịch bản", description: "Viết hoặc dán kịch bản trước." }); return; }
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Đã sao chép kịch bản", description: "Kịch bản dạng văn bản đã vào clipboard." });
    } catch (err) {
      toast({ variant: "destructive", title: "Không sao chép được", description: err.message });
    }
  };

  const blockingWarnings = warnings.filter((w) => !isSuggestionWarning(w));
  const suggestionWarnings = warnings.filter(isSuggestionWarning);

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
                    <SelectItem value="xl">Siêu dài (~60 cảnh)</SelectItem>
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
            <Button size="sm" onClick={handleAIWriteVerified} disabled={aiLoading} variant="outline" className="w-full">
              {aiLoading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <CheckCircle2 size={14} className="mr-1.5" />}
              {aiLoading ? "Đang viết & tự sửa lỗi..." : "Viết Kịch Bản Chuẩn (tự kiểm tra & sửa đến khi hết lỗi)"}
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
          
            <button
              type="button"
              onClick={loadFromSaved}
              disabled={!gameData?.meta?.sourceScript}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
              title="Lấy lại kịch bản văn bản đã dùng để sản xuất game hiện tại, để chỉnh sửa tiếp"
            >
              <ClipboardList size={12} /> Lấy lại kịch bản
            </button>
            <button
              type="button"
              onClick={copyScript}
              disabled={!gameData?.meta?.sourceScript && !script}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
              title="Sao chép toàn bộ kịch bản văn bản ra clipboard"
            >
              <Copy size={12} /> Sao chép kịch bản
            </button></div>
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

      
      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleAIFix} disabled={aiLoading} variant="outline" className="px-3">
          {aiLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Wand2 size={16} className="mr-2" />}
          {aiLoading ? "AI đang sửa..." : selectedErrors.size > 0 ? `Sửa ${selectedErrors.size} lỗi đã chọn bằng AI` : "Sửa lỗi logic bằng AI"}
        </Button>
        <Button onClick={handleCheck} disabled={checking} variant="outline" className="flex-1">
          {checking ? <Loader2 size={16} className="mr-2 animate-spin" /> : <ClipboardCheck size={16} className="mr-2" />}
          {checking ? "Đang kiểm tra..." : "Kiểm Tra Kịch Bản"}
        </Button>
        <Button onClick={handleProduce} disabled={producing} className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
          {producing ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Bot size={16} className="mr-2" />}
          {producing ? "Đang sản xuất..." : "Sản Xuất Game"}
        </Button>
      </div>

      {checked && blockingWarnings.length === 0 && (
        <div className="text-[11px] rounded-lg p-2.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-semibold">
          <CheckCircle2 size={12} /> Không có lỗi chặn đường chơi — kịch bản sẵn sàng để sản xuất.
        </div>
      )}

      {blockingWarnings.length > 0 && (
        <div className="text-[11px] rounded-lg p-2.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 space-y-1">
          <div className="flex items-center justify-between gap-2 flex-wrap font-semibold">
            <span className="flex items-center gap-1.5"><AlertTriangle size={12} /> {blockingWarnings.length} lỗi — tick chọn lỗi muốn AI sửa (bỏ trống = sửa tất cả), hoặc bấm vào chữ để nhảy tới + bôi đen đúng chỗ sai:</span>
            {selectedErrors.size > 0 && (
              <button type="button" onClick={() => setSelectedErrors(new Set())} className="underline decoration-dotted font-normal">Bỏ chọn tất cả</button>
            )}
          </div>
          <ul className="space-y-0.5">
            {blockingWarnings.map((w, i) => {
              const clickable = resolveWarningPosition(script, w) !== null;
              return (
                <li key={i} className="flex items-start gap-1.5">
                  <input type="checkbox" className="mt-0.5" checked={selectedErrors.has(w)} onChange={() => toggleError(w)} />
                  {clickable ? (
                    <button type="button" onClick={() => jumpToWarning(textareaRef, script, w)} className="text-left underline decoration-dotted decoration-amber-500/50 hover:decoration-solid hover:text-amber-800 dark:hover:text-amber-300">
                      {w}
                    </button>
                  ) : <span>{w}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {aiFixPreview && (
        <AiFixReview
          before={aiFixPreview.before}
          after={aiFixPreview.after}
          explanations={aiFixPreview.explanations}
          stillHasErrors={aiFixPreview.stillHasErrors}
          onApply={applyAiFix}
          onDiscard={discardAiFix}
        />
      )}

      {suggestionWarnings.length > 0 && (
        <div className="text-[11px] rounded-lg p-2.5 bg-sky-500/10 text-sky-700 dark:text-sky-400 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold"><Lightbulb size={12} /> {suggestionWarnings.length} gợi ý cải thiện (không chặn chơi được, không bắt buộc sửa) — bấm mở từng nhóm:</div>
          {Object.entries(SUGGESTION_CATEGORIES).map(([key, meta]) => {
            const items = suggestionWarnings.filter((w) => categorizeSuggestion(w) === key);
            if (items.length === 0) return null;
            return (
              <details key={key} className="rounded-md border border-sky-500/20 bg-background/40">
                <summary className="cursor-pointer select-none px-2 py-1.5 font-medium">{items.length} {meta.label}</summary>
                <div className="px-2 pb-2 space-y-1.5">
                  <p className="italic text-sky-700/80 dark:text-sky-400/80">{meta.hint}</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {items.map((w, i) => {
                      const text = w.replace(/^\[GỢI Ý\]\s*/, "");
                      const clickable = resolveWarningPosition(script, w) !== null;
                      return (
                        <li key={i}>
                          {clickable ? (
                            <button type="button" onClick={() => jumpToWarning(textareaRef, script, w)} className="text-left underline decoration-dotted decoration-sky-500/50 hover:decoration-solid hover:text-sky-800 dark:hover:text-sky-300">
                              {text}
                            </button>
                          ) : text}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
