import React, { useState } from "react";
import { ArrowLeft, NotebookText, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

// "Sổ Tay Biên Kịch AI" — 5 prompt độc lập (1 cho mỗi xưởng) để người dùng
// copy dán cho AI NGOÀI (ChatGPT, Gemini...) viết hộ kịch bản, cho trường hợp
// không muốn/không dùng nút "Nhờ AI viết kịch bản giúp" sẵn có trong từng
// xưởng. Nội dung mỗi prompt lấy Y HỆT từ SYNTAX_GUIDE nội bộ của
// */ScriptWriter.js tương ứng (không phải bịa riêng) — đảm bảo khớp đúng cú
// pháp mà *ScriptParser.js thật sự đọc được. Có thêm mục "TỰ SOÁT LỖI" ở cuối
// mỗi prompt (không có trong SYNTAX_GUIDE nội bộ) vì AI ngoài viết 1 lần rồi
// dừng, không được app tự kiểm tra + tự sửa lại như khi dùng AI trong app.
const PROMPT_WORKSHOPS = [
  {
    id: "thietke",
    label: "Thiết Kế",
    color: "slate",
    title: "Xưởng Thiết Kế",
    desc: "Cốt truyện tự do, không giới hạn thể loại — dùng khi ý tưởng của bạn không khớp 4 khuôn còn lại.",
    scenes: "~10 cảnh",
    prompt: `Bạn là một biên kịch game nhập vai chuyên nghiệp. Từ ý tưởng/cảnh mở đầu sau, hãy sáng tác một kịch bản game nhập vai phân nhánh HOÀN CHỈNH khoảng 10 cảnh, nhiều kết thúc khác nhau.

Ý TƯỞNG CỦA TÔI:
"""
>>> DÁN Ý TƯỞNG / BỐI CẢNH / NHÂN VẬT CỦA BẠN VÀO ĐÂY <<<
"""

CÚ PHÁP BẮT BUỘC (tuân thủ CHÍNH XÁC, không thêm ký hiệu markdown khác):

# <Tên game>
**Thể loại:** <thể loại>
**Thông báo thua cuộc:** <tiêu đề> | <nội dung> (tuỳ chọn — chữ hiện khi thua cuộc, thay cho "GAME OVER" mặc định, viết đúng văn phong truyện)

## GIỚI THIỆU
<văn bản mở đầu, 1-2 đoạn>

## CẢNH 1 — <tên cảnh>
<văn bản diễn biến, 2-5 đoạn, có thể có lời thoại trong ngoặc kép>

**A — <lời lựa chọn ngắn>**
→ <Tên chỉ số> +<số>
→ <Tên chỉ số> -<số>
→ Cờ: <ten_co_khong_dau_khong_cach>
→ Cần cờ: <ten_co>
→ Cần không có cờ: <ten_co>
→ Vật phẩm: <tên vật phẩm>
→ Cần vật phẩm: <tên vật phẩm>
→ Cần <Tên chỉ số> >= <số>
→ Đến cảnh <số>
→ Kết thúc <nhan_ket_thuc>

**B — <lời lựa chọn khác>**
...(tương tự)

## CẢNH 2 — <tên cảnh>
...

## KẾT THÚC <nhan> — <tên kết thúc> [TRUE_END|GOOD_END|NORMAL_END|BAD_END]
<văn bản kết thúc>

QUY TẮC:
- LOGIC (QUAN TRỌNG): mạch truyện phải LIỀN MẠCH — mỗi "→ Đến cảnh N" phải hợp lý: cảnh đích PHẢI mở đầu bằng 1 câu nhắc lại tình huống vừa xảy ra ở cảnh trước, tuyệt đối không nhảy sang chuyện khác không liên quan.
- LOGIC: mọi "→ Cần vật phẩm: X" PHẢI có "→ Vật phẩm: X" (hoặc "→ Nhận Vật phẩm: X") cho ra vật phẩm đó ở MỘT CẢNH PHÍA TRƯỚC — đừng yêu cầu vật phẩm chưa từng xuất hiện.
- LOGIC: mọi "→ Cần cờ: X" PHẢI có "→ Cờ: X" tạo cờ đó ở phía trước; "→ Cần không có cờ: X" chỉ dùng khi cờ X chưa từng được tạo trên mọi nhánh dẫn tới lựa chọn đó.
- LOGIC: mọi "→ Cần <chỉ số> >= N" phải ĐẠT ĐƯỢC dựa trên "Chỉ số khởi đầu" cộng các lần tăng chỉ số ở các cảnh phía trước — đừng đặt ngưỡng cao hơn mức tối đa có thể đạt.
- Mỗi cảnh (trừ nếu là kết thúc) PHẢI có 2-4 lựa chọn.
- Mỗi lựa chọn PHẢI có ít nhất 1 dòng "→ <Tên chỉ số> +N/-N" (trừ khi cố ý là lựa chọn thuần rẽ nhánh không đổi điểm).
- Nếu lựa chọn không ghi "→ Đến cảnh N" hay "→ Kết thúc nhãn", nó TỰ ĐỘNG dẫn tới cảnh kế tiếp theo thứ tự — chỉ cần ghi rõ khi muốn rẽ nhánh khác thường hoặc dẫn tới kết thúc.
- PHẢI có ít nhất 1 khối "## KẾT THÚC" ở cuối, được một lựa chọn nào đó trỏ tới bằng "→ Kết thúc <nhãn>".
- "→ Đến cảnh N" CHỈ được dùng khi "## CẢNH N" THẬT SỰ tồn tại trong chính kịch bản đang viết — TUYỆT ĐỐI không bịa số cảnh chưa viết tới. "→ Kết thúc <nhãn>" cũng phải khớp Y HỆT một khối "## KẾT THÚC <nhãn>" có thật.
- Loại kết thúc trong [ ] CHỈ được là TRUE_END, GOOD_END, NORMAL_END, hoặc BAD_END.
- MỖI lựa chọn CHỈ được có ĐÚNG MỘT "→ Đến cảnh"/"→ Kết thúc" — TUYỆT ĐỐI không viết cú pháp điều kiện kiểu "→ Nếu có cờ X: Đến cảnh Y" trong 1 dòng. Muốn rẽ nhánh theo cờ/chỉ số, tách thành 2 lựa chọn RIÊNG, mỗi cái tự có "→ Đến cảnh"/"→ Kết thúc" riêng.
- Tên chỉ số đặt tự do, hệ thống tự nhận diện.
- Không dùng markdown khác ngoài **...** cho tiêu đề lựa chọn và # / ## cho tiêu đề.

── TỰ SOÁT LỖI (bắt buộc — làm bước này trước khi trả lời, ĐỪNG trả về bản nháp chưa soát) ──
Đọc lại toàn bộ bản nháp vừa viết, kiểm tra từng mục sau và tự sửa nếu sai:
1. Mọi "→ Đến cảnh N" — có khối "CẢNH N" thật ở dưới không? Không có thì sửa số hoặc xoá dòng.
2. Mọi "→ Kết thúc <nhãn>" — có khối "KẾT THÚC <nhãn>" khớp Y HỆT (kể cả hoa/thường, dấu cách) không?
3. Mọi "→ Cần vật phẩm: X" — có dòng "→ Vật phẩm: X" ở một cảnh PHÍA TRƯỚC không? Nếu không, thêm dòng đó vào 1 lựa chọn trước, hoặc xoá yêu cầu.
4. Mọi "→ Cần cờ: X" — có dòng "→ Cờ: X" ở phía trước không? Xử lý như mục 3.
5. Có vật phẩm/cờ nào được cấp ("→ Vật phẩm:"/"→ Cờ:") nhưng không nơi nào yêu cầu tới, và cũng không có ý nghĩa gì thêm không? Đó là vật phẩm/cờ THỪA — xoá dòng cấp đi.
6. Mọi cảnh (trừ GIỚI THIỆU) — có ÍT NHẤT 1 lựa chọn ở cảnh TRƯỚC trỏ vào nó (trực tiếp hoặc tự động sang cảnh kế tiếp) không? Cảnh không ai trỏ tới là "cảnh mồ côi" — nối lại hoặc xoá.
7. Mọi cảnh (trừ kết thúc) — có ÍT NHẤT 1 lựa chọn KHÔNG bị khoá điều kiện gì không? Nếu một cảnh có TẤT CẢ lựa chọn đều bị khoá, người chơi sẽ kẹt cứng — sửa lại.
8. Mọi "→ Cần <chỉ số> >= N" — cộng dồn hết các lần "+" của chỉ số đó từ đầu game tới TRƯỚC lựa chọn này, có đạt N không? Nếu không đạt được dù cộng hết, hạ ngưỡng xuống hoặc thêm điểm cộng ở cảnh trước.
Chỉ trả về bản kịch bản ĐÃ SỬA theo cú pháp trên — không thêm lời dẫn, không giải thích, không liệt kê lỗi đã sửa.`,
  },
  {
    id: "npc",
    label: "NPC (Công Lược)",
    color: "pink",
    title: "Xưởng NPC — Công Lược",
    desc: "Otome/dating sim — nhiều nhân vật để theo đuổi, mỗi người 1 tuyến truyện độc lập.",
    scenes: "~7 cảnh / nhân vật, ≥2 nhân vật",
    prompt: `Bạn là một biên kịch game otome/dating sim chuyên nghiệp, giỏi xây dựng nhiều tuyến tình cảm song song với tính cách nhân vật rõ nét. Từ ý tưởng/bối cảnh sau (kèm danh sách nhân vật muốn đưa vào làm đối tượng theo đuổi, nếu có), hãy sáng tác một kịch bản game "Công Lược" (otome/dating sim) HOÀN CHỈNH — mỗi nhân vật là 1 tuyến "NHÂN VẬT" độc lập khoảng 7 cảnh, đều có kết thúc thành đôi và kết thúc thất bại riêng.

Ý TƯỞNG CỦA TÔI:
"""
>>> DÁN Ý TƯỞNG / BỐI CẢNH + DANH SÁCH NHÂN VẬT MUỐN THEO ĐUỔI VÀO ĐÂY <<<
"""

CÚ PHÁP BẮT BUỘC (tuân thủ CHÍNH XÁC, không thêm ký hiệu markdown khác):

# Công lược — <Tên truyện>
**Thể loại:** <thể loại>
**Chỉ số sinh tử:** Thiện cảm < 10
**Chỉ số khởi đầu:** Thiện cảm = 20
**Thông báo thua cuộc:** <tiêu đề> | <nội dung> (tuỳ chọn — chữ hiện khi chết, thay cho "GAME OVER" mặc định, viết đúng văn phong truyện)

## GIỚI THIỆU
Bạn muốn theo đuổi ai?

## NHÂN VẬT <Tên nhân vật 1> — <2-4 từ mô tả tính cách>
### CẢNH 1 — <tên cảnh>
<văn bản diễn biến, 2-4 đoạn>

**A — <lời lựa chọn ngắn>**
→ Thiện cảm +5
→ Đến cảnh 2

**B — <lời lựa chọn khác>**
→ Thiện cảm -5
→ Đến cảnh 2

### CẢNH 2 — <tên cảnh>
...(tương tự, tiếp diễn theo mạch: gặp gỡ → để ý → chủ động tìm đến → sự kiện riêng → ghen tuông/thiện cảm → nhận ra tình cảm → biến cố lớn → tỏ tình)

### KẾT THÚC yeu — <tên kết thúc thành đôi> [TRUE_END]
<văn bản kết thúc — chỉ tới được nếu Thiện cảm đủ cao ở cảnh tỏ tình>

### KẾT THÚC chia_xa — <tên kết thúc chia xa> [BAD_END]
<văn bản kết thúc — nhánh khi Thiện cảm không đủ ở cảnh tỏ tình>

## NHÂN VẬT <Tên nhân vật 2> — <mô tả>
### CẢNH 1 — ...
...(một tuyến truyện ĐỘC LẬP hoàn toàn, số cảnh lại bắt đầu từ 1)

QUY TẮC:
- LOGIC (QUAN TRỌNG): mạch truyện phải LIỀN MẠCH — mỗi "→ Đến cảnh N" phải hợp lý: cảnh đích PHẢI mở đầu bằng 1 câu nhắc lại tình huống vừa xảy ra ở cảnh trước.
- LOGIC: mọi "→ Cần vật phẩm: X" PHẢI có "→ Vật phẩm: X" ở MỘT CẢNH PHÍA TRƯỚC — đừng yêu cầu vật phẩm chưa từng xuất hiện.
- LOGIC: mọi "→ Cần cờ: X" PHẢI có "→ Cờ: X" tạo cờ đó ở phía trước; "→ Cần không có cờ: X" chỉ dùng khi cờ X chưa từng được tạo trên mọi nhánh dẫn tới lựa chọn đó.
- LOGIC: mọi "→ Cần <chỉ số> >= N" phải ĐẠT ĐƯỢC dựa trên "Chỉ số khởi đầu" cộng các lần tăng chỉ số ở các cảnh phía trước.
- PHẢI có ít nhất 2 khối "## NHÂN VẬT" (nhiều "công lược đối tượng" để người chơi chọn).
- Mỗi nhân vật PHẢI có tối thiểu 5-8 cảnh đi theo mạch: gặp gỡ lần đầu → nhân vật bắt đầu chú ý → nhân vật chủ động tìm đến → 1 sự kiện đặc trưng → các lựa chọn tăng/giảm Thiện cảm rõ rệt → nhận ra tình cảm → 1 biến cố lớn thử thách mối quan hệ → cảnh tỏ tình.
- CẢNH TỎ TÌNH (cảnh cuối) PHẢI có ít nhất 2 lựa chọn: 1 lựa chọn khoá bằng "→ Cần Thiện cảm >= <ngưỡng cao>" dẫn tới kết thúc TRUE_END/GOOD_END (thành đôi), 1 lựa chọn KHÔNG khoá (hoặc khoá "Cần không có cờ") dẫn tới kết thúc BAD_END (thất bại).
- Mỗi lựa chọn PHẢI có ít nhất 1 dòng "→ Thiện cảm +N/-N" (trừ lựa chọn thuần rẽ nhánh không đổi điểm).
- Nếu lựa chọn không ghi "→ Đến cảnh N" hay "→ Kết thúc nhãn", nó TỰ ĐỘNG dẫn tới cảnh kế tiếp CỦA CÙNG NHÂN VẬT theo thứ tự.
- "→ Đến cảnh N" và "→ Kết thúc <nhãn>" CHỈ có hiệu lực TRONG PHẠM VI khối "## NHÂN VẬT" đang viết — không trỏ sang cảnh/kết thúc của nhân vật khác. TUYỆT ĐỐI không bịa số cảnh/nhãn kết thúc chưa viết tới.
- Loại kết thúc trong [ ] CHỈ được là TRUE_END, GOOD_END, NORMAL_END, hoặc BAD_END.
- MỖI lựa chọn CHỈ được có ĐÚNG MỘT "→ Đến cảnh"/"→ Kết thúc" — không viết cú pháp điều kiện kiểu "→ Nếu có cờ X: Đến cảnh Y" trong 1 dòng.
- Tên chỉ số nên thống nhất dùng "Thiện cảm" cho MỌI nhân vật (chung 1 thang điểm vì chỉ 1 tuyến chạy tại 1 thời điểm).
- Không dùng markdown khác ngoài **...** cho tiêu đề lựa chọn và #/##/### cho tiêu đề.

── TỰ SOÁT LỖI (bắt buộc — làm bước này trước khi trả lời, ĐỪNG trả về bản nháp chưa soát) ──
Đọc lại toàn bộ bản nháp vừa viết, kiểm tra từng mục sau và tự sửa nếu sai:
1. Mọi "→ Đến cảnh N" — có khối "CẢNH N" thật ở dưới không? Không có thì sửa số hoặc xoá dòng.
2. Mọi "→ Kết thúc <nhãn>" — có khối "KẾT THÚC <nhãn>" khớp Y HỆT (kể cả hoa/thường, dấu cách) không?
3. Mọi "→ Cần vật phẩm: X" — có dòng "→ Vật phẩm: X" ở một cảnh PHÍA TRƯỚC không? Nếu không, thêm dòng đó vào 1 lựa chọn trước, hoặc xoá yêu cầu.
4. Mọi "→ Cần cờ: X" — có dòng "→ Cờ: X" ở phía trước không? Xử lý như mục 3.
5. Có vật phẩm/cờ nào được cấp ("→ Vật phẩm:"/"→ Cờ:") nhưng không nơi nào yêu cầu tới, và cũng không có ý nghĩa gì thêm không? Đó là vật phẩm/cờ THỪA — xoá dòng cấp đi.
6. Mọi cảnh (trừ GIỚI THIỆU) — có ÍT NHẤT 1 lựa chọn ở cảnh TRƯỚC trỏ vào nó (trực tiếp hoặc tự động sang cảnh kế tiếp) không? Cảnh không ai trỏ tới là "cảnh mồ côi" — nối lại hoặc xoá.
7. Mọi cảnh (trừ kết thúc) — có ÍT NHẤT 1 lựa chọn KHÔNG bị khoá điều kiện gì không? Nếu một cảnh có TẤT CẢ lựa chọn đều bị khoá, người chơi sẽ kẹt cứng — sửa lại.
8. Mọi "→ Cần <chỉ số> >= N" — cộng dồn hết các lần "+" của chỉ số đó từ đầu game tới TRƯỚC lựa chọn này, có đạt N không? Nếu không đạt được dù cộng hết, hạ ngưỡng xuống hoặc thêm điểm cộng ở cảnh trước.
9. Mỗi khối "NHÂN VẬT" — "Đến cảnh"/"Kết thúc" bên trong nó có LỠ trỏ sang cảnh/kết thúc của NHÂN VẬT khác không? Nếu có, đó là lỗi nghiêm trọng — sửa lại đúng phạm vi.
Chỉ trả về bản kịch bản ĐÃ SỬA theo cú pháp trên — không thêm lời dẫn, không giải thích, không liệt kê lỗi đã sửa.`,
  },
  {
    id: "hethong",
    label: "Hệ Thống",
    color: "violet",
    title: "Xưởng Hệ Thống",
    desc: "Trọng sinh/xuyên không có hệ thống dẫn dắt, nhắc nhở, phạt/thưởng nhân vật chính.",
    scenes: "~10 cảnh",
    prompt: `Bạn là một biên kịch game nhập vai chuyên nghiệp, chuyên viết thể loại "Hệ Thống". Từ ý tưởng/cảnh mở đầu sau, hãy sáng tác một kịch bản game nhập vai phân nhánh thể loại "Hệ Thống" (có một hệ thống/AI dẫn dắt, nhắc nhở, phạt/thưởng nhân vật chính) HOÀN CHỈNH khoảng 10 cảnh, nhiều kết thúc khác nhau.

Ý TƯỞNG CỦA TÔI:
"""
>>> DÁN Ý TƯỞNG / BỐI CẢNH CỦA BẠN VÀO ĐÂY <<<
"""

CÚ PHÁP BẮT BUỘC (tuân thủ CHÍNH XÁC, không thêm ký hiệu markdown khác):

# <Tên game>
**Thể loại:** <thể loại>
**Chỉ số sinh tử:** <Tên chỉ số> < <ngưỡng>
**Chỉ số khởi đầu:** <Tên chỉ số (CÙNG TÊN với "Chỉ số sinh tử" ở trên)> = <giá trị cao hơn ngưỡng chết>
**Thông báo thua cuộc:** <tiêu đề> | <nội dung> (tuỳ chọn — chữ hiện khi chết, thay cho "GAME OVER" mặc định, viết đúng văn phong "hệ thống")

## GIỚI THIỆU
→ Hệ thống: <tiêu đề> | <lời chào của hệ thống, mời người chơi xác nhận để bắt đầu>
<văn bản mở đầu, 1-2 đoạn>

## CẢNH 1 — <tên cảnh>
→ Hệ thống: <tiêu đề> | <nội dung nhắc nhở, CHỈ dùng khi cảnh này thật sự cần hệ thống nhắc>
<văn bản diễn biến, 2-5 đoạn, có thể có lời thoại trong ngoặc kép>

**A — <lời lựa chọn ngắn>**
→ <Tên chỉ số> +<số>
→ Hệ thống: <tiêu đề> | <thông báo phần thưởng nếu lựa chọn này ĐÚNG cốt truyện hệ thống giao>

**B — <lời lựa chọn khác, phạm luật hệ thống>**
→ <Tên chỉ số> -<số>
→ Hệ thống: <tiêu đề> | <thông báo hình phạt cụ thể, nêu rõ lý do và mức phạt>

## CẢNH 2 — <tên cảnh>
...

## KẾT THÚC <nhan> — <tên kết thúc> [TRUE_END|GOOD_END|NORMAL_END|BAD_END]
<văn bản kết thúc>

QUY TẮC:
- LOGIC (QUAN TRỌNG): mạch truyện phải LIỀN MẠCH — mỗi "→ Đến cảnh N" phải hợp lý, cảnh đích PHẢI mở đầu bằng 1 câu nhắc lại tình huống vừa xảy ra.
- LOGIC: mọi "→ Cần vật phẩm: X" PHẢI có "→ Vật phẩm: X" ở MỘT CẢNH PHÍA TRƯỚC. LOGIC: mọi "→ Cần cờ: X" PHẢI có "→ Cờ: X" tạo cờ đó ở phía trước.
- LOGIC: mọi "→ Cần <chỉ số> >= N" phải ĐẠT ĐƯỢC dựa trên "Chỉ số khởi đầu" cộng các lần tăng chỉ số ở các cảnh phía trước.
- Chỉ số khai ở "Chỉ số sinh tử" PHẢI xuất hiện ở ít nhất 1 dòng "→ <chỉ số> +N/-N" nào đó trong kịch bản.
- BẮT BUỘC: nếu có khai "Chỉ số sinh tử", PHẢI khai kèm "Chỉ số khởi đầu" cho đúng chỉ số đó với giá trị RÕ RÀNG CAO HƠN ngưỡng chết — chỉ số không khai "Chỉ số khởi đầu" sẽ tự bắt đầu ở 0, nếu 0 đã ≤ ngưỡng chết thì nhân vật "chết" NGAY KHI VỪA VÀO GAME.
- Dòng "→ Hệ thống: ..." đặt NGAY DƯỚI "## CẢNH N" (trước lựa chọn A) thì bật khi VÀO cảnh; đặt BÊN TRONG 1 lựa chọn thì bật NGAY SAU KHI chọn. Mỗi cảnh/lựa chọn tối đa 1 dòng này — CHỈ dùng khi thật sự cần.
- Tiêu đề và nội dung của "→ Hệ thống: ..." cách nhau bằng " | " (có khoảng trắng 2 bên). Muốn xuống dòng trong nội dung thì gõ "\\n", KHÔNG xuống dòng thật.
- Mỗi cảnh (trừ kết thúc) PHẢI có 2-4 lựa chọn.
- Nếu lựa chọn không ghi "→ Đến cảnh N" hay "→ Kết thúc nhãn", nó TỰ ĐỘNG dẫn tới cảnh kế tiếp theo thứ tự.
- PHẢI có ít nhất 1 khối "## KẾT THÚC" ở cuối, được trỏ tới bằng "→ Kết thúc <nhãn>".
- "→ Đến cảnh N" CHỈ được dùng khi "## CẢNH N" THẬT SỰ tồn tại. "→ Kết thúc <nhãn>" phải khớp Y HỆT một khối "## KẾT THÚC <nhãn>" có thật.
- Loại kết thúc trong [ ] CHỈ được là TRUE_END, GOOD_END, NORMAL_END, hoặc BAD_END.
- MỖI lựa chọn CHỈ được có ĐÚNG MỘT "→ Đến cảnh"/"→ Kết thúc".
- Không dùng markdown khác ngoài **...** cho tiêu đề lựa chọn và # / ## cho tiêu đề.

── TỰ SOÁT LỖI (bắt buộc — làm bước này trước khi trả lời, ĐỪNG trả về bản nháp chưa soát) ──
Đọc lại toàn bộ bản nháp vừa viết, kiểm tra từng mục sau và tự sửa nếu sai:
1. Mọi "→ Đến cảnh N" — có khối "CẢNH N" thật ở dưới không? Không có thì sửa số hoặc xoá dòng.
2. Mọi "→ Kết thúc <nhãn>" — có khối "KẾT THÚC <nhãn>" khớp Y HỆT (kể cả hoa/thường, dấu cách) không?
3. Mọi "→ Cần vật phẩm: X" — có dòng "→ Vật phẩm: X" ở một cảnh PHÍA TRƯỚC không? Nếu không, thêm dòng đó vào 1 lựa chọn trước, hoặc xoá yêu cầu.
4. Mọi "→ Cần cờ: X" — có dòng "→ Cờ: X" ở phía trước không? Xử lý như mục 3.
5. Có vật phẩm/cờ nào được cấp ("→ Vật phẩm:"/"→ Cờ:") nhưng không nơi nào yêu cầu tới, và cũng không có ý nghĩa gì thêm không? Đó là vật phẩm/cờ THỪA — xoá dòng cấp đi.
6. Mọi cảnh (trừ GIỚI THIỆU) — có ÍT NHẤT 1 lựa chọn ở cảnh TRƯỚC trỏ vào nó (trực tiếp hoặc tự động sang cảnh kế tiếp) không? Cảnh không ai trỏ tới là "cảnh mồ côi" — nối lại hoặc xoá.
7. Mọi cảnh (trừ kết thúc) — có ÍT NHẤT 1 lựa chọn KHÔNG bị khoá điều kiện gì không? Nếu một cảnh có TẤT CẢ lựa chọn đều bị khoá, người chơi sẽ kẹt cứng — sửa lại.
8. Mọi "→ Cần <chỉ số> >= N" — cộng dồn hết các lần "+" của chỉ số đó từ đầu game tới TRƯỚC lựa chọn này, có đạt N không? Nếu không đạt được dù cộng hết, hạ ngưỡng xuống hoặc thêm điểm cộng ở cảnh trước.
9. Chỉ số khai ở "Chỉ số sinh tử" — Giá trị ở "Chỉ số khởi đầu" của đúng chỉ số đó có THỰC SỰ cao hơn ngưỡng chết không? Nếu chỉ số này không được khai "Chỉ số khởi đầu" nó sẽ mặc định = 0 và chết ngay từ đầu.
Chỉ trả về bản kịch bản ĐÃ SỬA theo cú pháp trên — không thêm lời dẫn, không giải thích, không liệt kê lỗi đã sửa.`,
  },
  {
    id: "cungdau",
    label: "Cung Đấu",
    color: "amber",
    title: "Xưởng Cung Đấu",
    desc: "Phi tần tranh sủng — Sủng Ái, phe phái, mưu kế, cấp bậc hậu cung tự thăng.",
    scenes: "~10 cảnh",
    prompt: `Bạn là một biên kịch game nhập vai chuyên nghiệp, chuyên viết thể loại "Cung Đấu". Từ ý tưởng/cảnh mở đầu sau, hãy sáng tác một kịch bản game nhập vai phân nhánh thể loại "Cung Đấu" HOÀN CHỈNH khoảng 10 cảnh, nhiều kết thúc khác nhau — nhân vật chính là phi tần, xoay quanh Sủng Ái của Hoàng thượng, mưu kế giữa các phi tần, phe phái trong cung.

Ý TƯỞNG CỦA TÔI:
"""
>>> DÁN Ý TƯỞNG / BỐI CẢNH CỦA BẠN VÀO ĐÂY <<<
"""

CÚ PHÁP BẮT BUỘC (tuân thủ CHÍNH XÁC, không thêm ký hiệu markdown khác):

# <Tên game>
**Thể loại:** <thể loại>
**Chỉ số sinh tử:** <Tên chỉ số> < <ngưỡng>
(NÊN là "Sủng Ái < 10" — chỉ số này tụt bằng/dưới ngưỡng là bị phế truất/Game Over. Khai nhiều cách nhau dấu phẩy, nhưng "Sủng Ái" phải là chỉ số ĐẦU TIÊN vì cấp bậc tần phi tính từ nó.)
**Chỉ số khởi đầu:** Sủng Ái = <giá trị CAO HƠN ngưỡng chết, vd 30> (chỉ số nào không khai sẽ bắt đầu ở 0 — nếu 0 đã ≤ ngưỡng chết thì "chết" NGAY KHI VỪA VÀO GAME.)
**Thông báo thua cuộc:** <tiêu đề> | <nội dung> (tuỳ chọn)
**Cấp bậc hậu cung:** <tên> / <tên> / <tên> (tuỳ chọn — từ thấp lên cao, cách nhau "/". Mỗi 15 điểm Sủng Ái trên mức khởi đầu thăng 1 cấp, tự động.)

## GIỚI THIỆU
→ Chỉ dụ: <tiêu đề> | <lời chào nhập cung, mời người chơi bắt đầu>
<văn bản mở đầu, 1-2 đoạn>

## CẢNH 1 — <tên cảnh>
→ Chỉ dụ: <tiêu đề> | <thông báo hoàng cung> (tuỳ chọn, CHỈ khi cần)
<văn bản diễn biến, 2-5 đoạn, có thể có lời thoại trong ngoặc kép>

**A — <lời lựa chọn ngắn>**
→ Sủng Ái +5
→ Hảo cảm Quý Phi +10
→ Cờ: đã hạ độc trong bát canh
→ Chỉ dụ: <tiêu đề> | <kết quả mưu kế — công bố ngay sau khi chọn>

**B — <lời lựa chọn khác>**
→ Sủng Ái -10
→ Hảo cảm Quý Phi -10
→ Cần hảo cảm Quý Phi >= 30
→ Cần cờ: đã hạ độc trong bát canh
→ Cần không có cờ: đã hạ độc trong bát canh
→ Cần vật phẩm: Bùa hộ mệnh
→ Vật phẩm: Bùa hộ mệnh
→ Đến cảnh 3

## CẢNH 2 — <tên cảnh>
...
## KẾT THÚC <nhan> — <tên kết thúc> [TRUE_END|GOOD_END|NORMAL_END|BAD_END]
<văn bản kết thúc>

QUY TẮC:
- LOGIC (QUAN TRỌNG): mạch truyện phải LIỀN MẠCH — mỗi "→ Đến cảnh N" phải hợp lý, cảnh đích PHẢI mở đầu bằng 1 câu nhắc lại tình huống vừa xảy ra.
- LOGIC: mọi "→ Cần vật phẩm: X" PHẢI có "→ Vật phẩm: X" ở MỘT CẢNH PHÍA TRƯỚC. LOGIC: mọi "→ Cần cờ: X" PHẢI có "→ Cờ: X" tạo cờ đó ở phía trước.
- LOGIC: mọi "→ Cần <chỉ số> >= N" (kể cả "Cần hảo cảm ... >= N") phải ĐẠT ĐƯỢC dựa trên các lần tăng ở các cảnh phía trước.
- Cấp bậc hậu cung TỰ ĐỘNG tăng/giảm theo Sủng Ái (mỗi 15 điểm trên mức khởi đầu thăng 1 cấp).
- "→ Hảo cảm <tên nhân vật> +N/-N" là mối quan hệ phe phái (Hoàng hậu, Quý Phi, Thái Hậu...), TÁCH BIỆT với Sủng Ái — mỗi người 1 thang điểm riêng.
- Dòng "→ Chỉ dụ: <tiêu đề> | <nội dung>" đặt NGAY DƯỚI "## CẢNH N" thì bật khi VÀO cảnh; đặt BÊN TRONG lựa chọn thì bật NGAY SAU KHI chọn. Tối đa 1 dòng này mỗi cảnh/lựa chọn. Xuống dòng trong nội dung thì gõ "\\n", KHÔNG xuống dòng thật.
- Mỗi cảnh (trừ kết thúc) PHẢI có 2-4 lựa chọn, và ÍT NHẤT 1 lựa chọn không bị khoá điều kiện gì (tránh kẹt cứng).
- Nếu lựa chọn không ghi "→ Đến cảnh N" hay "→ Kết thúc nhãn", nó TỰ ĐỘNG dẫn tới cảnh kế tiếp theo thứ tự.
- PHẢI có ít nhất 1 khối "## KẾT THÚC", được trỏ tới bằng "→ Kết thúc <nhãn>". "→ Đến cảnh N"/"→ Kết thúc <nhãn>" chỉ trỏ tới cảnh/kết thúc CÓ THẬT.
- Loại kết thúc trong [ ] CHỈ được là TRUE_END, GOOD_END, NORMAL_END, hoặc BAD_END.
- MỖI lựa chọn CHỈ được có ĐÚNG MỘT "→ Đến cảnh"/"→ Kết thúc".
- Không dùng markdown khác ngoài **...** cho tiêu đề lựa chọn và # / ## cho tiêu đề.
- Thể hiện đúng tinh thần cung đấu: mưu kế, phe phái, sủng ái, ngoại giao giữa các phi tần, chữ nghĩa cổ phong nhưng dễ hiểu.

── TỰ SOÁT LỖI (bắt buộc — làm bước này trước khi trả lời, ĐỪNG trả về bản nháp chưa soát) ──
Đọc lại toàn bộ bản nháp vừa viết, kiểm tra từng mục sau và tự sửa nếu sai:
1. Mọi "→ Đến cảnh N" — có khối "CẢNH N" thật ở dưới không? Không có thì sửa số hoặc xoá dòng.
2. Mọi "→ Kết thúc <nhãn>" — có khối "KẾT THÚC <nhãn>" khớp Y HỆT (kể cả hoa/thường, dấu cách) không?
3. Mọi "→ Cần vật phẩm: X" — có dòng "→ Vật phẩm: X" ở một cảnh PHÍA TRƯỚC không? Nếu không, thêm dòng đó vào 1 lựa chọn trước, hoặc xoá yêu cầu.
4. Mọi "→ Cần cờ: X" — có dòng "→ Cờ: X" ở phía trước không? Xử lý như mục 3.
5. Có vật phẩm/cờ nào được cấp ("→ Vật phẩm:"/"→ Cờ:") nhưng không nơi nào yêu cầu tới, và cũng không có ý nghĩa gì thêm không? Đó là vật phẩm/cờ THỪA — xoá dòng cấp đi.
6. Mọi cảnh (trừ GIỚI THIỆU) — có ÍT NHẤT 1 lựa chọn ở cảnh TRƯỚC trỏ vào nó (trực tiếp hoặc tự động sang cảnh kế tiếp) không? Cảnh không ai trỏ tới là "cảnh mồ côi" — nối lại hoặc xoá.
7. Mọi cảnh (trừ kết thúc) — có ÍT NHẤT 1 lựa chọn KHÔNG bị khoá điều kiện gì không? Nếu một cảnh có TẤT CẢ lựa chọn đều bị khoá, người chơi sẽ kẹt cứng — sửa lại.
8. Mọi "→ Cần <chỉ số> >= N" — cộng dồn hết các lần "+" của chỉ số đó từ đầu game tới TRƯỚC lựa chọn này, có đạt N không? Nếu không đạt được dù cộng hết, hạ ngưỡng xuống hoặc thêm điểm cộng ở cảnh trước.
9. Mỗi "Cần hảo cảm <tên> >= N" — CÓ ít nhất 1 lựa chọn "Hảo cảm <tên> +" ở PHÍA TRƯỚC dẫn tới đúng cảnh này (không phải nhánh khác) cộng đủ tới N không?
Chỉ trả về bản kịch bản ĐÃ SỬA theo cú pháp trên — không thêm lời dẫn, không giải thích, không liệt kê lỗi đã sửa.`,
  },
  {
    id: "trongsinh",
    label: "Trọng Sinh",
    color: "emerald",
    title: "Xưởng Trọng Sinh",
    desc: "Làm giàu nhờ kiến thức tương lai — Vốn, niên đại tự thăng, phi vụ đầu tư.",
    scenes: "~10 cảnh",
    prompt: `Bạn là một biên kịch game nhập vai chuyên nghiệp, chuyên viết thể loại "Trọng Sinh Làm Giàu". Từ ý tưởng/cảnh mở đầu sau, hãy sáng tác một kịch bản game nhập vai phân nhánh thể loại "Trọng Sinh Làm Giàu" HOÀN CHỈNH khoảng 10 cảnh, nhiều kết thúc khác nhau — nhân vật chính trọng sinh về quá khứ và dùng hiểu biết tương lai để khởi nghiệp, đầu tư, xây đế chế tài chính.

Ý TƯỞNG CỦA TÔI:
"""
>>> DÁN Ý TƯỞNG / BỐI CẢNH CỦA BẠN VÀO ĐÂY <<<
"""

CÚ PHÁP BẮT BUỘC (tuân thủ CHÍNH XÁC, không thêm ký hiệu markdown khác):

# <Tên game>
**Thể loại:** <thể loại>
**Chỉ số sinh tử:** <Tên chỉ số> < <ngưỡng>
(NÊN là "Vốn < 5" — chỉ số này tụt bằng/dưới ngưỡng là PHÁ SẢN/Game Over. "Vốn" phải là chỉ số ĐẦU TIÊN vì niên đại làm giàu tính từ nó. "Vốn" = số tiền/tài sản hiện có.)
**Chỉ số khởi đầu:** Vốn = <giá trị CAO HƠN ngưỡng chết, vd 50> (chỉ số nào không khai sẽ bắt đầu ở 0 — nếu 0 đã ≤ ngưỡng chết thì "chết" NGAY KHI VỪA VÀO GAME.)
**Thông báo thua cuộc:** <tiêu đề> | <nội dung> (tuỳ chọn)
**Thang thời đại:** <nhãn> = <mốc vốn> (+thu nhập) | ... (tuỳ chọn — bỏ qua thì dùng mặc định 1995=0(+0)/1999=60(+5)/2003=200(+10)/2007=600(+20)/2011=1500(+35).)

## GIỚI THIỆU
→ Cơ hội: <tiêu đề> | <lời chào mở đầu, mời người chơi bắt đầu>
<văn bản mở đầu, 1-2 đoạn>

## CẢNH 1 — <tên cảnh>
→ Cơ hội: <tiêu đề> | <tin nội bộ/dự án/phi vụ> (tuỳ chọn, CHỈ khi cần)
<văn bản diễn biến, 2-5 đoạn, có thể có lời thoại trong ngoặc kép>

**A — <lời lựa chọn ngắn>**
→ Vốn +10
→ Danh vọng +5
→ Cờ: ký được hợp đồng cà phê
→ Cơ hội: <tiêu đề> | <kết quả phi vụ — công bố ngay sau khi chọn>

**B — <lời lựa chọn khác>**
→ Vốn -20
→ Cần Vốn >= 40
→ Cần cờ: ký được hợp đồng cà phê
→ Cần không có cờ: ký được hợp đồng cà phê
→ Cần vật phẩm: Giấy tờ đất nền Quận 3
→ Vật phẩm: Giấy tờ đất nền Quận 3
→ Đến cảnh 3

## CẢNH 2 — <tên cảnh>
...
## KẾT THÚC <nhan> — <tên kết thúc> [TRUE_END|GOOD_END|NORMAL_END|BAD_END]
<văn bản kết thúc>

QUY TẮC:
- LOGIC (QUAN TRỌNG): mạch truyện phải LIỀN MẠCH — mỗi "→ Đến cảnh N" phải hợp lý, cảnh đích PHẢI mở đầu bằng 1 câu nhắc lại tình huống vừa xảy ra.
- LOGIC: mọi "→ Cần vật phẩm: X" PHẢI có "→ Vật phẩm: X" ở MỘT CẢNH PHÍA TRƯỚC. LOGIC: mọi "→ Cần cờ: X" PHẢI có "→ Cờ: X" tạo cờ đó ở phía trước.
- LOGIC: mọi "→ Cần Vốn >= N" phải ĐẠT ĐƯỢC dựa trên "Chỉ số khởi đầu" cộng các lần tăng ở các cảnh phía trước.
- Niên đại làm giàu TỰ ĐỘNG theo Vốn: chạm mốc vốn thì đế chế thăng niên đại và thu thêm tiền MỘT LẦN — "tiền đẻ ra tiền".
- "→ Vốn +N/-N" là lời/lỗ tiền — NHỚ trừ tiền khi làm ăn thất bại, để lỗ gần ngưỡng phá sản tạo kịch tính. Chỉ số phụ (Danh vọng, Sức khỏe...) tên tự do.
- "→ Cơ hội: <tiêu đề> | <nội dung>" đặt NGAY DƯỚI "## CẢNH N" thì bật khi VÀO cảnh; đặt BÊN TRONG lựa chọn thì bật NGAY SAU KHI chọn. Tối đa 1 dòng này mỗi cảnh/lựa chọn. Xuống dòng trong nội dung thì gõ "\\n", KHÔNG xuống dòng thật.
- Mỗi cảnh (trừ kết thúc) PHẢI có 2-4 lựa chọn, và ÍT NHẤT 1 lựa chọn không bị khoá điều kiện gì (tránh kẹt cứng).
- Nếu lựa chọn không ghi "→ Đến cảnh N" hay "→ Kết thúc nhãn", nó TỰ ĐỘNG dẫn tới cảnh kế tiếp theo thứ tự.
- PHẢI có ít nhất 1 khối "## KẾT THÚC", được trỏ tới bằng "→ Kết thúc <nhãn>". "→ Đến cảnh N"/"→ Kết thúc <nhãn>" chỉ trỏ tới cảnh/kết thúc CÓ THẬT.
- Loại kết thúc trong [ ] CHỈ được là TRUE_END, GOOD_END, NORMAL_END, hoặc BAD_END.
- MỖI lựa chọn CHỈ được có ĐÚNG MỘT "→ Đến cảnh"/"→ Kết thúc".
- Không dùng markdown khác ngoài **...** cho tiêu đề lựa chọn và # / ## cho tiêu đề.
- Thể hiện đúng tinh thần trọng sinh làm giàu: dùng kiến thức tương lai đi trước thời đại; khởi nghiệp tay trắng; chi tiết kinh doanh thực tế dễ hiểu; nhịp độ tiền lời/lỗ hấp dẫn.

── TỰ SOÁT LỖI (bắt buộc — làm bước này trước khi trả lời, ĐỪNG trả về bản nháp chưa soát) ──
Đọc lại toàn bộ bản nháp vừa viết, kiểm tra từng mục sau và tự sửa nếu sai:
1. Mọi "→ Đến cảnh N" — có khối "CẢNH N" thật ở dưới không? Không có thì sửa số hoặc xoá dòng.
2. Mọi "→ Kết thúc <nhãn>" — có khối "KẾT THÚC <nhãn>" khớp Y HỆT (kể cả hoa/thường, dấu cách) không?
3. Mọi "→ Cần vật phẩm: X" — có dòng "→ Vật phẩm: X" ở một cảnh PHÍA TRƯỚC không? Nếu không, thêm dòng đó vào 1 lựa chọn trước, hoặc xoá yêu cầu.
4. Mọi "→ Cần cờ: X" — có dòng "→ Cờ: X" ở phía trước không? Xử lý như mục 3.
5. Có vật phẩm/cờ nào được cấp ("→ Vật phẩm:"/"→ Cờ:") nhưng không nơi nào yêu cầu tới, và cũng không có ý nghĩa gì thêm không? Đó là vật phẩm/cờ THỪA — xoá dòng cấp đi.
6. Mọi cảnh (trừ GIỚI THIỆU) — có ÍT NHẤT 1 lựa chọn ở cảnh TRƯỚC trỏ vào nó (trực tiếp hoặc tự động sang cảnh kế tiếp) không? Cảnh không ai trỏ tới là "cảnh mồ côi" — nối lại hoặc xoá.
7. Mọi cảnh (trừ kết thúc) — có ÍT NHẤT 1 lựa chọn KHÔNG bị khoá điều kiện gì không? Nếu một cảnh có TẤT CẢ lựa chọn đều bị khoá, người chơi sẽ kẹt cứng — sửa lại.
8. Mọi "→ Cần <chỉ số> >= N" — cộng dồn hết các lần "+" của chỉ số đó từ đầu game tới TRƯỚC lựa chọn này, có đạt N không? Nếu không đạt được dù cộng hết, hạ ngưỡng xuống hoặc thêm điểm cộng ở cảnh trước.
9. Vốn có bao giờ tụt xuống ĐÚNG bằng hoặc dưới ngưỡng phá sản ở giữa game khi cộng dồn hết các lần "Vốn -N" trên MỘT đường đi cụ thể không (kể cả khi người chơi luôn chọn lựa chọn mất tiền)? Nếu có và không phải cố ý làm ending phá sản, cân nhắc lại mức trừ.
Chỉ trả về bản kịch bản ĐÃ SỬA theo cú pháp trên — không thêm lời dẫn, không giải thích, không liệt kê lỗi đã sửa.`,
  },
];

const COLOR_STYLES = {
  slate:   { border: "border-slate-500/20",   dot: "bg-slate-500",   chip: "border-slate-500/30" },
  pink:    { border: "border-pink-500/20",    dot: "bg-pink-500",    chip: "border-pink-500/30" },
  violet:  { border: "border-violet-500/20",  dot: "bg-violet-500",  chip: "border-violet-500/30" },
  amber:   { border: "border-amber-500/20",   dot: "bg-amber-500",   chip: "border-amber-500/30" },
  emerald: { border: "border-emerald-500/20", dot: "bg-emerald-500", chip: "border-emerald-500/30" },
};

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  return Promise.resolve();
}

function PromptCard({ ws }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const styles = COLOR_STYLES[ws.color];

  const handleCopy = async () => {
    try {
      await copyText(ws.prompt);
      setCopied(true);
      toast({ title: "Đã copy prompt", description: "Dán vào AI ngoài, thay dòng ý tưởng, rồi gửi." });
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      toast({ variant: "destructive", title: "Không copy được", description: e.message || "Thử bôi đen thủ công." });
    }
  };

  return (
    <section className={cn("glass-card rounded-2xl p-4 sm:p-5 space-y-3 border", styles.border)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm">{ws.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{ws.desc}</p>
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0">{ws.scenes}</span>
      </div>

      <div className="rounded-lg border border-border overflow-hidden" style={{ background: "#16131e" }}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#a79cc7" }}>prompt.txt</span>
          <Button size="sm" onClick={handleCopy} className="h-7 px-2.5 text-xs">
            {copied ? <Check size={12} className="mr-1" /> : <Copy size={12} className="mr-1" />}
            {copied ? "Đã copy" : "Copy toàn bộ"}
          </Button>
        </div>
        <pre className="px-3 py-3 max-h-[420px] overflow-auto text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words" style={{ color: "#e9e4f4" }}>
          {ws.prompt}
        </pre>
      </div>

      <div className={cn("flex items-start gap-2 text-xs text-muted-foreground rounded-lg border p-2.5", styles.chip)}>
        <span aria-hidden="true">✎</span>
        <span>
          <strong className="text-foreground">Chỗ cần sửa duy nhất:</strong> dòng{" "}
          <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">{">>> DÁN Ý TƯỞNG... <<<"}</code>{" "}
          — thay bằng ý tưởng thật của bạn. Mọi dòng còn lại giữ nguyên.
        </span>
      </div>
    </section>
  );
}

export default function PromptHandbook({ onBack }) {
  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 glass-panel border-b">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground shrink-0" title="Quay lại thư viện">
            <ArrowLeft size={18} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-400 flex items-center justify-center shadow-lg shrink-0">
            <NotebookText size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base leading-tight truncate">Sổ Tay Biên Kịch AI</h1>
            <p className="text-[11px] text-muted-foreground leading-tight truncate">5 prompt chặt để dán cho AI ngoài (ChatGPT, Gemini...) viết hộ kịch bản</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-5 space-y-5">
        <div className="glass-card rounded-2xl p-4 sm:p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Bạn chỉ cần <strong className="text-foreground">copy trọn khối</strong>, dán cho AI ngoài, thay đúng 1 dòng ý tưởng, rồi dán kết quả vào ô kịch bản trong app.
          </p>
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <li className="rounded-lg border border-border p-3">
              <span className="font-display italic text-primary font-semibold">I.</span>
              <p className="mt-1 text-xs text-muted-foreground">Chọn đúng xưởng bên dưới, bấm <strong className="text-foreground">Copy toàn bộ</strong>.</p>
            </li>
            <li className="rounded-lg border border-border p-3">
              <span className="font-display italic text-primary font-semibold">II.</span>
              <p className="mt-1 text-xs text-muted-foreground">Dán vào AI ngoài, thay dòng <strong className="text-foreground">"Ý TƯỞNG CỦA TÔI"</strong> bằng ý tưởng thật, rồi gửi.</p>
            </li>
            <li className="rounded-lg border border-border p-3">
              <span className="font-display italic text-primary font-semibold">III.</span>
              <p className="mt-1 text-xs text-muted-foreground">Dán kết quả vào ô kịch bản trong app, bấm <strong className="text-foreground">Kiểm Tra Kịch Bản</strong> rồi <strong className="text-foreground">Sửa lỗi logic bằng AI</strong>.</p>
            </li>
          </ol>
        </div>

        <Tabs defaultValue="thietke">
          <TabsList className="flex flex-wrap h-auto gap-1.5 bg-transparent p-0 justify-start">
            {PROMPT_WORKSHOPS.map((ws) => {
              const styles = COLOR_STYLES[ws.color];
              return (
                <TabsTrigger
                  key={ws.id}
                  value={ws.id}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium gap-1.5 data-[state=active]:shadow-none"
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", styles.dot)} />
                  {ws.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {PROMPT_WORKSHOPS.map((ws) => (
            <TabsContent key={ws.id} value={ws.id} className="mt-4">
              <PromptCard ws={ws} />
            </TabsContent>
          ))}
        </Tabs>

        <p className="text-xs text-muted-foreground max-w-2xl">
          <strong className="text-foreground">Vì sao vẫn cần bước III?</strong> AI ngoài viết một lần rồi dừng, không ai kiểm tra lại. Bộ Kiểm Tra Kịch Bản trong app là bên duy nhất đọc được đúng cú pháp thật — luôn chạy qua đó trước khi Sản Xuất Game.
        </p>
      </main>
    </div>
  );
}
