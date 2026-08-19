import React, { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Heart, Wand2, Loader2, AlertTriangle, Copy, Check, ClipboardList, ImageIcon, UserPlus, ListPlus, GitBranchPlus, FlagTriangleRight, ClipboardCheck, CheckCircle2 } from "lucide-react";
import { parseNpcScript } from "@/lib/gameStudio/npcScriptParser";
import { verifyAndFixScript } from "@/lib/gameStudio/fixScriptWithAI";
import { generateNpcScriptFromPrompt } from "@/lib/gameStudio/npcScriptWriter";
import { useToast } from "@/components/ui/use-toast";
import FileUrlInput from "@/components/FileUrlInput";

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

// Xưởng RIÊNG BIỆT — không import gì từ ScriptImporter.jsx/SystemScriptImporter.jsx
// hay parser của 2 xưởng đó, sửa file này không ảnh hưởng gì tới 2 xưởng kia.
const CHEAT_SHEET = `KHÔNG CẦN gõ dấu #, ##, ** gì cả — hệ thống nhận diện qua TỪ KHOÁ (NHÂN VẬT,
CẢNH, KẾT THÚC, GIỚI THIỆU, chữ cái A/B/C...), có hay không có mấy dấu đó đều
đọc đúng như nhau.

Công lược — Tên truyện
Thể loại: ...
Chỉ số sinh tử: Thiện cảm < 10        (tuỳ chọn — ác cảm quá mức là thất bại)
Chỉ số khởi đầu: Thiện cảm = 20       (QUAN TRỌNG nếu có "Chỉ số sinh tử" ở
                                       trên — nếu không khai, mặc định bắt
                                       đầu ở 0 và sẽ bị tính là "chết" ngay!)
Thông báo thua cuộc: Bị Phế Truất | Nàng đã đánh mất tất cả, cả tính mạng lẫn ngôi vị.
                                      (tuỳ chọn — đổi chữ hiện khi chết vì
                                       "Chỉ số sinh tử" ở trên, thay cho
                                       "GAME OVER" mặc định. Bỏ qua dòng này
                                       thì vẫn hiện chữ mặc định như cũ.)

GIỚI THIỆU
Bạn muốn theo đuổi ai?                (văn bản hiện trên màn hình chọn nhân
                                       vật — bỏ qua thì tự dùng câu này)

NHÂN VẬT Thẩm Cố Uyên — Lạnh lùng · Khó gần
→ Ảnh: https://...                    (tuỳ chọn — ảnh đại diện trên thẻ chọn,
                                       đặt NGAY DƯỚI dòng NHÂN VẬT)

CẢNH 1 — Lần đầu gặp gỡ
Diễn biến của cảnh.

A — Chủ động bắt chuyện
→ Thiện cảm +5
→ Đến cảnh 2

B — Giữ khoảng cách
→ Thiện cảm -3
→ Đến cảnh 2

CẢNH 2 — Bắt đầu chú ý đến bạn
...

CẢNH 8 — Tỏ tình
Khoảnh khắc quyết định.

A — Nói lời yêu
→ Cần Thiện cảm >= 60
→ Kết thúc yeu

B — Chưa đủ can đảm / bị từ chối
→ Kết thúc chia_xa

KẾT THÚC yeu — Thành đôi [TRUE_END]
Văn bản kết thúc.

KẾT THÚC chia_xa — Chia xa [BAD_END]
Văn bản kết thúc.

NHÂN VẬT Minh Châu — Kiêu ngạo · Hay ghen
CẢNH 1 — ...                          (số cảnh TỰ RESET về 1 — mỗi nhân vật
...                                    là 1 tuyến hoàn toàn độc lập, "Đến cảnh
                                       N"/"Kết thúc <nhãn>" chỉ có hiệu lực
                                       TRONG PHẠM VI khối NHÂN VẬT đang viết)

Ghi chú:
- Người chơi chỉ thấy màn hình thẻ bài "Bạn muốn theo đuổi ai?" ở đầu game —
  chọn ai thì CHỈ tuyến của người đó chạy tiếp, không cần tính điểm những
  người còn lại.
- Nên dùng CHUNG tên chỉ số "Thiện cảm" cho mọi nhân vật (chỉ 1 tuyến chạy
  tại 1 thời điểm nên dùng chung 1 thang điểm là đủ).
- Loại kết thúc trong [ ] CHỈ được 1 trong 4: TRUE_END / GOOD_END / NORMAL_END
  / BAD_END (bỏ qua [ ] thì mặc định NORMAL_END).
- Không có rẽ nhánh kiểu "Nếu... thì Đến..." trong 1 lựa chọn — muốn rẽ
  nhánh theo điều kiện, viết 2 lựa chọn riêng, mỗi cái khoá bằng "Cần cờ:"/
  "Cần không có cờ:" hoặc "Cần Thiện cảm >= N" đối lập nhau.
- Vẫn có thể gõ #, ##, ### , ** như trước nếu bạn thích đọc có màu mè hơn.`;

export default function NpcScriptImporter({ gameData, setGameData, onGenerated }) {
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
    { label: "Nhân vật mới", icon: UserPlus, snippet: "NHÂN VẬT Tên nhân vật — Mô tả ngắn\n\nCẢNH 1 — Tên cảnh\nDiễn biến của cảnh.", placeholder: "Tên nhân vật" },
    { label: "Cảnh mới", icon: ListPlus, snippet: "CẢNH X — Tên cảnh\nDiễn biến của cảnh.", placeholder: "X" },
    { label: "Lựa chọn", icon: GitBranchPlus, snippet: "A — Lời lựa chọn\n→ Thiện cảm +5\n→ Đến cảnh X", placeholder: "Lời lựa chọn" },
    { label: "Kết thúc", icon: FlagTriangleRight, snippet: "KẾT THÚC nhan_ket_thuc — Tên kết thúc [TRUE_END]\nVăn bản kết thúc.", placeholder: "nhan_ket_thuc" },
  ];

  // Danh sách nhân vật đã sản xuất — đọc thẳng từ lựa chọn trên start_node
  // (mỗi nhân vật = 1 lựa chọn kèm npcCard). Đổi ảnh ở đây ghi thẳng vào
  // gameData, không cần sửa lại kịch bản mỗi lần muốn đổi ảnh.
  const npcChoices = (gameData?.nodes?.start_node?.choices || [])
    .map((c, idx) => ({ idx, npcCard: c.npcCard }))
    .filter((c) => c.npcCard);

  const updateNpcImage = (idx, url) => {
    const startNode = gameData.nodes.start_node;
    const choices = startNode.choices.map((c, i) => (i === idx ? { ...c, npcCard: { ...c.npcCard, image: url } } : c));
    setGameData({ ...gameData, nodes: { ...gameData.nodes, start_node: { ...startNode, choices } } });
  };

  const copyCheatSheet = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(CHEAT_SHEET);
      setCheatSheetCopied(true);
      setTimeout(() => setCheatSheetCopied(false), 1500);
      toast({ title: "Đã sao chép cú pháp mẫu" });
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
      const text = await generateNpcScriptFromPrompt({ mode: aiMode, input: aiInput, length: aiLength });
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
      const result = parseNpcScript(script, gameData.meta);
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

  
  
  const handleAIFix = async () => {
    if (!script.trim()) { toast({ variant: "destructive", title: "Chưa có kịch bản", description: "Viết hoặc dán kịch bản trước." }); return; }
    let parseWarnings;
    try {
      parseWarnings = parseNpcScript(script, gameData.meta).warnings || [];
    } catch (e) {
      toast({ variant: "destructive", title: "Kịch bản có lỗi cú pháp", description: e.message || "Sửa lỗi cú pháp trước, rồi bấm Kiểm Tra." });
      return;
    }
    if (parseWarnings.length === 0) { toast({ title: "Không có lỗi logic", description: "Kịch bản đã sạch, không cần sửa." }); return; }
    setAiLoading(true);
    try {
      const report = await verifyAndFixScript({
        cheatSheet: CHEAT_SHEET,
        parseFn: (txt) => parseNpcScript(txt, gameData.meta),
        script,
        maxRounds: 3,
      });
      setScript(report.script);
      setWarnings(report.warnings || []);
      setChecked(true);
      if (report.clean) {
        toast({ title: "AI đã sửa sạch", description: report.improved ? `Đã tự sửa ${report.rounds} lượt. 0 lỗi — sẵn sàng Sản Xuất Game.` : "0 lỗi — sẵn sàng Sản Xuất Game." });
      } else if (report.improved) {
        toast({ variant: "destructive", title: "Đã giảm bớt lỗi", description: `Còn ${report.warnings.length} lỗi (từ ${parseWarnings.length} ban đầu) — xem cảnh báo bên dưới và sửa tay.` });
      } else {
        toast({ variant: "destructive", title: "AI không sửa được tốt hơn", description: "Hệ thống giữ nguyên bản gốc (không tệ hơn). Sửa tay theo các cảnh báo bên dưới, hoặc bấm Kiểm Tra để xem chi tiết." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Lỗi sửa kịch bản", description: e.message || "Thử lại." });
    } finally {
      setAiLoading(false);
    }
  };



  const handleAIWriteVerified = async () => {
    if (!aiInput.trim()) { toast({ variant: "destructive", title: "Thiếu nội dung", description: "Nhập ý tưởng hoặc dán nội dung chương truyện." }); return; }
    setAiLoading(true);
    try {
      const draft = await generateNpcScriptFromPrompt({ mode: aiMode, input: aiInput, length: aiLength });
      setScript(draft);
      const report = await verifyAndFixScript({
        cheatSheet: CHEAT_SHEET,
        parseFn: (txt) => parseNpcScript(txt, gameData.meta),
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
      const result = parseNpcScript(script, gameData.meta);
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


  return (
    <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-3 border border-pink-500/20">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Heart size={16} className="text-pink-500" /> Xưởng NPC — Công lược nhiều tuyến nhân vật
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Xưởng riêng dành cho thể loại "Công Lược" (otome/dating sim) — khai nhiều khối "NHÂN VẬT" trong CÙNG 1 kịch bản, mỗi nhân vật là 1 tuyến truyện độc lập. Người chơi thấy màn hình thẻ bài "Bạn muốn theo đuổi ai?" ở đầu game, chọn ai thì chỉ tuyến của người đó chạy tiếp. Hoàn toàn tách biệt với "Xưởng Thiết Kế"/"Xưởng Hệ Thống" — dùng xưởng nào cũng không ảnh hưởng xưởng kia.
      </p>

      {npcChoices.length > 0 && (
        <section className="rounded-lg border border-pink-500/30 bg-pink-500/5 p-3 space-y-3">
          <Label className="text-xs font-semibold flex items-center gap-1.5"><ImageIcon size={13} className="text-pink-500" /> Ảnh đại diện từng nhân vật</Label>
          <p className="text-[11px] text-muted-foreground">
            Đổi ảnh trực tiếp ở đây (tải lên hoặc dán URL) — không cần sửa lại kịch bản mỗi lần muốn đổi ảnh.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {npcChoices.map(({ idx, npcCard }) => (
              <div key={idx} className="rounded-lg border border-border bg-background/50 p-2.5 space-y-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{npcCard.name}</div>
                  {npcCard.tagline && <div className="text-[11px] text-muted-foreground truncate">{npcCard.tagline}</div>}
                </div>
                <FileUrlInput value={npcCard.image || ""} onChange={(url) => updateNpcImage(idx, url)} preview />
              </div>
            ))}
          </div>
        </section>
      )}

      <details className="text-xs rounded-lg border border-border">
        <summary className="cursor-pointer px-3 py-2 font-medium select-none flex items-center justify-between gap-2">
          <span>Xem cú pháp mẫu</span>
          <button
            type="button"
            onClick={copyCheatSheet}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-normal text-muted-foreground hover:text-foreground hover:bg-accent transition shrink-0"
            title="Sao chép cú pháp mẫu để gửi cho AI"
          >
            {cheatSheetCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            {cheatSheetCopied ? "Đã sao chép" : "Sao chép"}
          </button>
        </summary>
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
                    <SelectItem value="idea">Ý tưởng + danh sách nhân vật</SelectItem>
                    <SelectItem value="chapter">Nội dung chương truyện</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-36 space-y-1">
                <Label className="text-[11px]">Độ dài mỗi tuyến</Label>
                <Select value={aiLength} onValueChange={setAiLength}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Ngắn (~5 cảnh)</SelectItem>
                    <SelectItem value="medium">Trung bình (~7 cảnh)</SelectItem>
                    <SelectItem value="long">Dài (~9 cảnh)</SelectItem>
                    <SelectItem value="xl">Siêu dài (~40 cảnh / tuyến)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              rows={5}
              placeholder={aiMode === "chapter" ? "Dán nội dung chương truyện muốn chuyển thể..." : "Mô tả bối cảnh + danh sách nhân vật muốn đưa vào làm đối tượng theo đuổi..."}
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
          rows={14}
          placeholder="Dán kịch bản viết tay vào đây, hoặc dùng nút 'Nhờ AI viết kịch bản giúp' ở trên..."
          className="font-mono text-xs"
        />
      </div>

      
      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleAIFix} disabled={aiLoading} variant="outline" className="px-3">
          {aiLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Wand2 size={16} className="mr-2" />}
          {aiLoading ? "AI đang sửa..." : "Sửa lỗi logic bằng AI"}
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
