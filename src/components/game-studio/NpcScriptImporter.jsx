import React, { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, Wand2, Loader2, AlertTriangle, Copy, Check, ImageIcon } from "lucide-react";
import { parseNpcScript } from "@/lib/gameStudio/npcScriptParser";
import { generateNpcScriptFromPrompt } from "@/lib/gameStudio/npcScriptWriter";
import { useToast } from "@/components/ui/use-toast";
import FileUrlInput from "@/components/FileUrlInput";

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
  const [cheatSheetCopied, setCheatSheetCopied] = useState(false);
  const { toast } = useToast();

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

  const handleProduce = () => {
    if (!script.trim()) {
      toast({ variant: "destructive", title: "Chưa có kịch bản", description: "Dán hoặc viết kịch bản trước." });
      return;
    }
    setProducing(true);
    try {
      const result = parseNpcScript(script, gameData.meta);
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
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Kịch bản</Label>
        <Textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={14}
          placeholder="Dán kịch bản viết tay vào đây, hoặc dùng nút 'Nhờ AI viết kịch bản giúp' ở trên..."
          className="font-mono text-xs"
        />
      </div>

      <Button onClick={handleProduce} disabled={producing} className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700">
        {producing ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Heart size={16} className="mr-2" />}
        {producing ? "Đang sản xuất..." : "Sản Xuất Game (Công Lược)"}
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
