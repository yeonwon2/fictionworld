# Fiction World

Sổ tay quản lý thế giới truyện (nhân vật, địa danh, mối quan hệ, dòng thời gian) có hỗ trợ AI sáng tác. Chạy trên Supabase (database + auth + storage) — không còn phụ thuộc backend Base44.

## Cài đặt

1. `npm install`
2. Tạo project Supabase (gói Free) tại [supabase.com](https://supabase.com), lấy `Project URL` + `anon public key` ở **Settings → API**.
3. Dán toàn bộ nội dung [`supabase/migration.sql`](supabase/migration.sql) vào **Supabase Dashboard → SQL Editor** và chạy (tạo schema, RLS, storage bucket).
4. Sao chép `.env.local.example` thành `.env.local`, điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.

## Chạy local

```bash
npm run dev
```

Mở URL mà Vite in ra. Vào `/register` để tạo tài khoản đầu tiên — tài khoản này tự động có quyền admin.

Sau khi có tài khoản, nên vào **Supabase Dashboard → Authentication → Providers → Email** và tắt "Allow new users to sign up" để không ai khác tự đăng ký được (app hiện không có luồng mời/duyệt riêng).

## AI sáng tác

Tính năng "Sáng Tác AI" cần mỗi người dùng tự nhập Gemini API Key riêng (miễn phí tại [Google AI Studio](https://aistudio.google.com/apikey)) ở **Cài đặt AI** trong app — không có key dùng chung phía backend.

## Xưởng Viết Truyện

Trang `/xuong-viet-truyen` — workspace mô hình "xưởng" kiểu tác giả web-novel Trung Quốc:

- **Bộ Tài Liệu (bible sống)**: 8 tài liệu Markdown mỗi bộ truyện (quy tắc viết, thế giới quan, nhân vật, quan hệ & xưng hô, đại cương, phục bút, timeline, tóm tắt hiện tại) — lưu ở bảng `writer_docs`. Đây là "trí nhớ dài hạn" của AI: thay vì nhồi cả cuốn sách vào prompt, AI chỉ cần đọc bible được nén/gọn.
- **Khởi tạo Xưởng**: AI dựng đủ 8 tài liệu từ ý tưởng + dữ liệu Sổ Tay Thế Giới hiện có.
- **Viết Chương**: viết chương bám sát toàn bộ bible, lưu vào bảng `chapters`.
- **Cập Nhật Bible**: sau mỗi chương, AI đọc chương + bible → đề xuất cập nhật timeline / tóm tắt hiện tại / phục bút / trạng thái nhân vật / quan hệ; tác giả duyệt từng tài liệu rồi lưu.
- **Team AI**: 6 thành viên đóng vai (Tổng biên tập, Thiết lập sư, Quản lý nhân vật, Phục bút quản lý, Biên tập nhất quán, Trợ lý tác giả) — mỗi người một hội thoại riêng, đều đọc bible.

Nếu bạn đã có database Supabase từ trước: bảng `writer_docs` là bảng MỚI — hãy chạy lại `supabase/migration.sql` trong SQL Editor (an toàn, dùng `IF NOT EXISTS`).

## Xưởng Kịch Bản Game

Trang `/xuong-kich-ban-game` — luồng wizard viết kịch bản game theo đúng "quy ước trình bày" của từng xưởng sản xuất game (để dán thẳng vào Xưởng Game là chạy được):

1. **Ý tưởng** — nhập loại game (xưởng sản xuất: Thiết Kế / Hệ Thống / NPC / Cung Đấu / Trọng Sinh Làm Giàu), thể loại, số cảnh (VD 50), số lựa chọn/cảnh, số nhánh, **nhân vật người chơi nhập vai** và **nhiệm vụ chính**.
2. **Bộ khung & duyệt** — AI gợi ý nhân vật (bắt đầu bằng nhân vật nhập vai), bối cảnh, dàn cảnh (kèm lựa chọn + đích nhánh), kết thúc dự kiến; bạn duyệt/chỉnh sửa từng mục và đánh dấu điểm rẽ nhánh. Mọi cảnh đều đẩy mạch về nhiệm vụ chính.
3. **Các tuyến trên một Story Graph chung** — AI viết bản thảo theo từng tuyến nhưng luôn đọc toàn bộ Game Bible, graph và handoff từ cảnh trước. Cảnh chung chỉ được viết một lần; nhân vật không được biết trước thông tin, quan hệ/vật phẩm/cờ không tự nhảy trạng thái. Bạn phải duyệt đủ mọi scene contract trước khi xuất.
4. **Kịch bản chuẩn form** — AI chuyển thể chính bản thảo đã duyệt thành từng phân cảnh theo **đúng cú pháp parser** của xưởng đã chọn (`## CẢNH N`, `**A —**`, `→ Chỉ số`, `→ Cờ`, `→ Vật phẩm`, `→ Đến cảnh`, `→ Kết thúc [LOẠI]`, và riêng `→ Hệ thống:` / `→ Chỉ dụ:` / `→ Cơ hội:` / `→ Ảnh:` tuỳ xưởng). Mỗi kịch bản mở đầu bằng khối `## GIỚI THIỆU` nêu rõ nhân vật nhập vai + nhiệm vụ chính → bạn copy dán vào Xưởng Game tương ứng để sản xuất.

Trước khi viết nhánh, **Narrative Compiler** dựng Game Bible + scene contract nội bộ và kiểm tra reachability, đích thiếu, dead-end/vòng lặp kín, ending mồ côi, cùng tính khả thi cơ bản của vật phẩm, cờ và chỉ số. Nếu còn lỗi chặn, wizard không cho duyệt bộ khung. Màn hình compiler có thể sửa tự động các liên kết graph an toàn và mô phỏng tối đa 24 tuyến đại diện tới ending/ngõ cụt/vòng lặp. **Continuity Checker** chấm điểm 0–100 và báo cảnh thiếu mục đích/bối cảnh/cast, nhân vật chưa có trong Bible, nhiệm vụ chính bị bỏ quên, phục bút chưa payoff và nhánh chưa được dùng. Các cấu trúc nội bộ này không thay đổi format Markdown xuất ra nên kịch bản cũ vẫn tương thích.

**Phase 2 Stateful Compiler** lưu `state_contract` cho từng cảnh (`requires`, `reveals`, `forbids`, `handoff`) và `invariants` cho toàn game. Auto-play phân biệt trạng thái vật phẩm, cờ, chỉ số và kiến thức; chặn cảnh/ending xảy ra khi chưa đủ điều kiện, phát hiện tiết lộ sớm và handoff không nhất quán. Trạng thái tương đương được hợp nhất để vẫn kiểm tra được graph lớn mà không làm thay đổi format Markdown cũ.

**Phase 3 Publishing Gate** chia graph theo chương/checkpoint, đo coverage cảnh/lựa chọn/ending, sinh regression case, phát hiện lựa chọn giả và ending thiếu tuyến hợp lệ. Nút copy bản cuối chỉ mở khi parser không còn lỗi chặn và cổng xuất bản đạt mức coverage tối thiểu.

**Phase 4 Gemini Free-tier Saver** ưu tiên toàn bộ compiler/repair/coverage chạy cục bộ, cache phản hồi AI giống hệt trong 7 ngày, hiển thị số lượt đã gọi và số lượt cache tiết kiệm. Dàn cảnh có thể tiếp tục từ lô còn thiếu sau lỗi mạng/hết quota; viết nhánh bỏ qua cảnh đã có; bước ghép kịch bản cuối được biên dịch hoàn toàn trên máy và tốn 0 lượt Gemini.

### Bảng mới (luồng wizard)

- `game_script_projects` — dự án kịch bản (loại game, ý tưởng, thông số, trạng thái).
- `game_plan_meta` — bộ khung: nhân vật, bối cảnh, kết thúc, nhánh (jsonb).
- `game_plan_scenes` — dàn cảnh tổng (mô tả, lựa chọn, điểm rẽ nhánh).
- `game_plan_branches` — các nhánh truyện.
- `game_plan_scene_content` — bản thảo văn xuôi + kịch bản chuẩn form theo từng cảnh/nhánh.

`game_plan_meta` có thêm `game_bible`, `scene_contracts`, `compiler_report`, `invariants` (jsonb); `game_plan_scenes` có thêm `state_contract` (jsonb), `chapter_index` và `is_checkpoint`. Với database đã tồn tại, chạy lại `supabase/migration.sql` hoặc các file SQL Phase 2/3 để thêm cột bằng `ADD COLUMN IF NOT EXISTS`.

## Trải nghiệm chơi game

Màn **Trải Nghiệm Game** tự lưu tiến trình riêng theo từng game trên thiết bị, cho phép tiếp tục/chơi lại từ poster mở đầu, hiển thị tiến độ cảnh đã khám phá và trạng thái lưu. Người chơi có thể dùng phím `1`–`9` để chọn đáp án, `Space`/`Enter` để hiện ngay phần chữ đang chạy và bật toàn màn hình. File HTML độc lập vẫn lưu tiến trình bằng `localStorage` và chạy offline.

Nếu bạn đã có database từ trước: chạy lại `supabase/migration.sql` trong SQL Editor để tạo các bảng mới (an toàn, dùng `IF NOT EXISTS`).

## Cấu trúc dữ liệu

Xem `supabase/migration.sql` để biết schema đầy đủ (15 bảng + RLS + storage bucket `fictionworld-media`). `base44/entities/*.jsonc` chỉ còn là tài liệu tham khảo mô tả field, không được app đọc lúc chạy.

### Sơ đồ tư duy trong Xưởng Game

Sau khi sản xuất từ kịch bản ở bất kỳ xưởng nào, ứng dụng mở **Sơ Đồ Tư Duy** để duyệt toàn bộ cảnh và lựa chọn. Sơ đồ dùng trực tiếp dữ liệu game, không lấy mẫu tuyến hoặc tự nối lại nhánh. Cảnh chung, vòng quay lại, nhánh xúc xắc, kết thúc và cảnh chưa nối từ mở đầu đều hiện trên cùng sơ đồ. Dùng tìm kiếm, thu phóng và nút Toàn cảnh để di chuyển.

Mỗi cảnh/lựa chọn có nút **Sửa** và **Hỏi AI**. Cửa sổ sửa chỉ hiện thông tin đang dùng của đúng ô được chọn, có nút Lưu thay đổi / Hủy và mục Thêm thông tin thu gọn. Sau khi bấm Lưu thay đổi, game được tự lưu; Hỏi AI chỉ gửi cảnh đang chọn và các cảnh liền kề khi bấm Lấy gợi ý, dùng cấu hình AI hiện có. Bản đề xuất phải được tác giả duyệt trước khi thay văn bản; liên kết và điều kiện chỉ thay khi sửa trực tiếp.

**Tạo lại game từ sơ đồ** kiểm tra liên kết, lưu đúng dữ liệu đã sửa và mở lượt chơi mới. Không phân tích lại bản văn bản gốc, không làm mất điều kiện/chỉ số/vật phẩm. Kịch bản gốc vẫn được giữ để tham khảo và có cảnh báo khi đã cũ; nhập lại nó sẽ yêu cầu xác nhận vì sẽ thay thế sửa đổi trên sơ đồ. Sơ đồ không chứng minh mọi điều kiện đều khả thi: dùng **Kiểm Tra Toàn Diện** để kiểm tra sâu hơn. Không cần thay đổi schema Supabase.

Trong tab Sơ Đồ Tư Duy, mở **QA kịch bản** để chạy lại bộ Kiểm Tra Toàn Diện trên dữ liệu đã sửa. Bấm nội dung lỗi hoặc nút **Xem cảnh/lựa chọn** để thu gọn báo cáo, di chuyển và tô sáng ô liên quan; thông báo lỗi được giữ ngay trên sơ đồ. Lỗi nhiều vị trí có nút xem từng ô, lỗi tổng thể không đoán vị trí. Sau khi lưu sửa, báo cáo cũ được đánh dấu và khóa thao tác theo lỗi cũ cho đến khi chạy lại QA. Kiểm tra AI vẫn chỉ chạy khi chủ động bấm, dùng cấu hình AI hiện có.

**Đi từng tuyến từ đầu** cho phép duyệt kịch bản từng bước như chơi trên sơ đồ: bấm lựa chọn ngay trong ô cuối, xem riêng các cảnh/lựa chọn đã đi qua, quay lại hoặc bấm một bước cũ để đổi nhánh. Mỗi ô có **Xem tuyến từ đây** để bắt đầu từ một cảnh/lựa chọn cụ thể (ví dụ 1A rồi 2B), không giả định lịch sử trước đó. Vòng quay lại được vẽ thành các lần ghé thăm riêng theo thứ tự. Đây là chế độ duyệt nội dung theo cấu trúc: điều kiện vẫn hiện để đối chiếu nhưng không mô phỏng chỉ số/vật phẩm, và tác giả tự chọn kết quả vận may/trận đấu. Sửa dữ liệu sẽ đưa tuyến về dẫn truyện để tránh dùng liên kết cũ; QA chuyển về toàn bộ sơ đồ khi định vị lỗi. Chế độ này không thay đổi tiến trình chơi thật hoặc cắt bỏ dữ liệu game.

Khi mở một tuyến, các nhánh có thể đi tiếp hiện ngay bằng ô nét đứt nối bên phải. Chọn bằng nút **Chọn nhánh này** trên ô hoặc **Đi tiếp** trong bảng phía trên sơ đồ. Các nút đi tiếp nằm riêng khỏi phần văn bản cuộn, nên không bị khuất khi cảnh có nội dung dài.

### Viết game trực tiếp bằng sơ đồ AI

Trong `/xuong-game`, mở một game → **Xưởng → Xưởng Kịch Bản Sơ Đồ AI**.

- Chọn mẫu Thiết kế / Hệ thống / NPC / Cung đấu / Trọng sinh làm giàu, hoặc bắt đầu từ một ô lời dẫn. Thay mẫu cần xác nhận vì thay các cảnh và bộ điểm hiện tại.
- Nhập ý tưởng, để AI đề xuất bối cảnh thống nhất và bộ điểm, rồi duyệt. Cung đấu có phẩm cấp, trọng sinh có vốn và mốc thời đại; mẫu NPC có thẻ nhân vật ở cảnh chọn tuyến; hệ thống hỗ trợ thông báo hệ thống.
- Thêm chuỗi cảnh, kết thúc; nút **Thiết kế** trên cảnh cho phép thêm/xóa lựa chọn và nối tới bất kỳ cảnh nào (hội tụ hoặc vòng lặp đều được). Xóa cảnh giữ các liên kết nguồn để QA chỉ ra chỗ cần sửa.
- Chọn nhiều ô hoặc **AI viết ô**. Chọn cảnh bao gồm các lựa chọn của cảnh; chọn riêng lựa chọn không sửa cảnh. AI dùng cấu hình AI hiện tại, đọc toàn bộ dữ liệu kịch bản và viết nhóm tối đa 4 phạm vi mỗi lượt. Giới hạn ngữ cảnh 240.000 ký tự báo lỗi rõ ràng, không âm thầm cắt cảnh.
- Kết quả AI luôn qua bước duyệt. AI chỉ được cập nhật nội dung, điểm lựa chọn và các trường trình bày riêng của thể loại; không được đổi cấu trúc. Đề xuất nhánh chỉ hiển thị để tác giả tự sửa. Kết quả cũ không được áp dụng nếu dữ liệu đã thay đổi trong khi chờ.
- Dùng QA và xem từng tuyến ngay dưới sơ đồ. **Tạo lại game từ sơ đồ** yêu cầu hết ô trống, đã duyệt thiết lập và không có lỗi liên kết; dùng thẳng dữ liệu cảnh, không đọc lại kịch bản văn bản.

Bản nháp lưu trong `games.meta.aiWorkshop` và `games.nodes`, dùng cơ chế tự lưu sẵn có; không cần thay schema. Hoàn tác trong xưởng chỉ giữ thao tác gần nhất trong phiên hiện tại. AI không đảm bảo tuyệt đối tính nhất quán hoặc cân bằng — cần duyệt nội dung và QA trước khi xuất bản.

### Thông báo và chơi thử tuyến từ sơ đồ

- Ô có `systemPopup` hiển thị tiêu đề, nội dung, thời điểm bật (vào cảnh / chọn lựa chọn) và nút **Sửa thông báo** ngay trong sơ đồ, kể cả khi xem riêng tuyến. Không tạo thêm cảnh giả.
- Chọn **Đi từng tuyến từ đầu**, đi theo các lựa chọn cần kiểm tra, rồi bấm **Chơi thử riêng tuyến này**. Xưởng mở chính `GamePlayer`, giữ nguyên cả game và luật chơi, chỉ khóa lựa chọn ngoài tuyến. Điểm số, cờ, vật phẩm, xúc xắc và chiến đấu vẫn chạy thật.
- Tuyến bắt đầu giữa truyện không được chạy với trạng thái giả định: cần chọn từ lời dẫn. Tuyến thử có thể kết thúc ở bất kỳ cảnh đã chọn nào, không nhất thiết tới kết thúc truyện.
- Lượt thử dùng bản chụp dữ liệu trong bộ nhớ, không đọc/ghi tiến trình chơi đã lưu và không sửa game. Có nút quay lại sơ đồ (giữ tuyến) hoặc chạy lại từ đầu. Báo riêng trường hợp đến cuối tuyến, bị điều kiện chặn, game over hoặc kết quả thực tế rẽ sang nhánh khác; không ép kết quả xúc xắc.
- Thông báo ở lựa chọn và cảnh đích được xếp hàng để không che mất nhau; thông báo ở cảnh kết thúc cũng được hiển thị. Đi lại vòng lặp vào cùng cảnh vẫn xử lý hiệu ứng vào cảnh.

### Dựng cảnh ngay trên sơ đồ AI

Trong xưởng sơ đồ AI, mỗi ô cảnh và đáp án có **+ Thêm cảnh** và **Nối cảnh có sẵn**. Tạo cảnh mới cho phép chọn số đáp án trống (mặc định 4), hoặc tạo kết thúc; chọn những đáp án nguồn sẽ dẫn tới cảnh mới. Các đáp án chưa nối được chọn sẵn, đường đã nối chỉ đổi khi tác giả chọn rõ. Từ một đáp án, thao tác chỉ ảnh hưởng đáp án đó. Có thể nối nhiều đáp án vào cùng cảnh, quay về cảnh trước hoặc tạo vòng lặp; kết quả xúc xắc/chiến đấu được nối theo đích thực tế. Sơ đồ chuyển đến cảnh đích sau thao tác. Công cụ thêm hàng loạt được thu gọn trong mục nâng cao; thanh chọn và viết AI nằm ngay sát sơ đồ.

### Chèn cảnh hệ quả sau đáp án

Bấm **Thêm → Chèn hệ quả của đáp án này…** trên một ô đáp án (có ở sơ đồ thường và sơ đồ AI). Xưởng chèn một cảnh chơi thật vào đúng đường đó: **1A → Hệ quả → Tiếp tục → đích cũ**. Nhánh khác và điểm/điều kiện/vật phẩm/cờ của đáp án nguồn giữ nguyên; nút Tiếp tục mặc định không cộng/trừ điểm. Có thể nhập nội dung ngay hoặc để AI viết sau, sửa tên cảnh phụ, và chèn nhiều cảnh phụ liên tiếp. Với xúc xắc, chọn riêng kết quả cần chèn. Nếu đích cũ chưa tồn tại, để chưa nối hoặc chọn một cảnh có sẵn. Chèn hệ quả luôn chỉ tạo đúng một cảnh phụ, không tự sinh thêm cảnh phía sau. Nội dung hệ quả còn trống phải được viết trước khi tạo lại game. Thao tác lưu bằng cơ chế tự lưu hiện có, không đọc lại văn bản kịch bản.

### Menu Thêm và nối nhiều đáp án vào một cảnh

Các thao tác tạo cảnh, nối tới cảnh có sẵn và chèn hệ quả được gom vào **Thêm** trên từng ô. Tại một ô cảnh đích, chọn **Thêm → Nối nhiều đáp án vào ô này** để chọn cả nhóm đáp án của nhiều cảnh (hoặc chọn lẻ), rồi nối một lần. Cho phép nguồn trước/sau hoặc chính cảnh đích; có tìm kiếm, cảnh báo đổi đích cũ, và kiểm tra dữ liệu có thay đổi trong lúc chọn hay không. Không sửa điểm, nội dung hoặc điều kiện của đáp án.

Đích để trống không còn sinh ô “Chưa chọn đích”; thay vào đó hiện nhãn “Chưa nối” trên đáp án. QA vẫn báo lỗi và chặn tạo game chưa nối xong. Tham chiếu tới một ID cảnh đã bị xóa/không tồn tại vẫn được hiển thị là lỗi “Thiếu cảnh” để sửa liên kết thật.


### Sao chép và dán nhóm cảnh

Đánh dấu **Chọn ô** ở các cảnh chính và cảnh hệ quả cần lấy (đáp án được sao chép cùng cảnh), chọn **Sao chép / Dán → Sao chép nhóm đã chọn**, rồi **Dán nhóm đã sao chép**. Có thể dán 1–30 nhóm/lần, tối đa 600 cảnh, giữ văn bản hoặc để trống cho AI viết mới. Đường nối nội bộ dùng mã mới; đường ngoài nhóm mặc định ngắt để tránh quay về bản gốc. Chọn **Nối các nhóm thành một chuỗi liên tiếp**, cảnh đầu nhóm, đáp án ra và đích sau nhóm cuối nếu muốn nhân một mẫu đến kết thúc. Sau khi dán, nối truyện gốc vào ô đầu nhóm bằng menu Thêm. Các cảnh mới được chọn sẵn cho AI; Hoàn tác khôi phục thao tác dán. Bản sao chép nằm trong bộ nhớ của xưởng hiện tại, không dùng clipboard hệ điều hành và không giữ sau khi tải lại trang. Luật điểm, điều kiện, cờ và vật phẩm được giữ nguyên khi sao chép, cần rà soát cho đoạn truyện mới.

AI được gửi riêng vai trò cảnh hệ quả, các quyết định/kết quả dẫn vào và đích đi tiếp. Thứ tự viết ưu tiên cảnh nguồn trước hệ quả, chia tối đa 4 phạm vi/lượt. Nút Tiếp tục mặc định được đánh dấu để AI không tự thêm phần thưởng hay chi phí lặp lại. Đây là ràng buộc dữ liệu và hướng dẫn ngữ cảnh, không phải bảo đảm tuyệt đối chất lượng cốt truyện: vẫn cần duyệt và QA.

### Thêm cảnh độc lập và nhập nhánh nhanh

Menu **Thêm** ngay trên ô phân biệt **Cảnh chính mới…**, **Cảnh phụ mới…** và **Chèn hệ quả của đáp án này…**. Tạo cảnh chính/phụ chỉ tạo một cảnh với 0–12 đáp án theo số đã nhập; không kế thừa vai trò hệ quả của cảnh nguồn. Cảnh chưa có đáp án được thêm nút chuyển cảnh (Bắt đầu ở dẫn truyện, Tiếp tục ở cảnh khác). **Thêm đáp án vào cảnh này…** chỉ bổ sung đáp án trống, giữ nguyên đáp án cũ và không tạo cảnh.

Để nhập bốn cảnh hệ quả về một cảnh chính mới: tích **Chọn ô** ở bốn cảnh, mở **Thêm → Tạo cảnh chung để nhập các nhánh…** trên một ô đã chọn, đặt số đáp án của cảnh chung rồi bấm tạo. Có thể chọn thêm/bớt các đường vào ngay trong cửa sổ này; không bắt buộc chọn trước trên sơ đồ. Thao tác tạo đúng một cảnh và nối toàn bộ các đường đã chọn vào đó, không đổi điểm/điều kiện của đáp án nguồn. Những đường đang có đích khác sẽ có cảnh báo trước khi lưu.

### Kiểm soát điểm và kết thúc HE/BE

Trong sơ đồ thường hoặc sơ đồ AI, mở **Điểm số, HE/BE và điều kiện kết thúc**. **Chế độ điểm & lời báo thua** cho phép chọn chỉ tích lũy điểm (tắt toàn bộ ngưỡng sinh tồn, AI không được bật lại qua bước đề xuất) hoặc chọn từng chỉ số có ngưỡng thua dưới. Có thể sửa tiêu đề/nội dung thua do ngưỡng điểm hoặc chiến đấu; lời kết BE nằm ở ô BE riêng. Chế độ tích lũy không vô hiệu hóa cơ chế thua trận nếu game có chiến đấu.

Danh sách HE/BE/NE/TE hiển thị các đường thực tế dẫn vào từng kết thúc. **Đặt điều kiện vào kết thúc** sửa trực tiếp điểm tối thiểu/tối đa, cờ bắt buộc có/chưa có và vật phẩm cần có trên từng đáp án. Tất cả điều kiện được xét đồng thời, trước hiệu ứng của đáp án, dùng chung trong player, QA và chơi thử. Các điều kiện hảo cảm NPC nâng cao được giữ nguyên và sửa bằng trình sửa ô hiện có. Trên bất kỳ ô đáp án nào cũng có **Thêm → Điều kiện mở đáp án…**. Đường xúc xắc/chiến đấu được đánh dấu riêng, không giả định điều kiện trên một đường thường sẽ kiểm soát các đường đó.

Đây là kết thúc theo lựa chọn tại điểm chốt tác giả thiết kế, không phải tự động xếp hạng HE/BE toàn cục. Nhiều đáp án đủ điều kiện thì người chơi chọn; tai tiếng vượt ngưỡng không tự cắt truyện giữa cảnh. Cần thiết kế nhánh BE riêng và đường dự phòng phù hợp. Bảng rà soát báo đường vào chưa có điều kiện, kết thúc chưa nối và cảnh mà mọi đáp án đều bị ràng buộc; dùng QA để kiểm tra khả năng đạt điểm và nguy cơ kẹt. Thêm kết thúc chỉ tạo một ô riêng, không tự nối/xóa cảnh. Những ngưỡng minh họa trong giao diện không tự áp vào dữ liệu.

Trong mục kiểm soát kết thúc, **Mẫu xét kết thúc theo điểm · Chạy thử** mở danh sách kết thúc có thể thêm/xóa. Mỗi nhánh có tên riêng, loại hiển thị HE/BE/NE/TE và mốc điểm nguyên; nhiều kết thúc có thể cùng loại hiển thị. Số nhánh không bị cố định ở ba. Một nhánh nhận phần điểm thấp nhất, các nhánh khác được sắp theo mốc và tự nhận phần điểm đến trước mốc kế tiếp; mốc trùng bị chặn. Chơi thử từng nhánh bằng player thật, không lưu tiến độ hoặc sửa điểm game. Nút tạo thêm đúng một cảnh xét điểm và số ô kết thúc đã thiết kế, giữ nguyên các cảnh/đường nối hiện tại. Sau đó tác giả nối hệ quả cuối vào cảnh xét điểm. Mẫu phân loại theo một chỉ số; điều kiện nhiều chỉ số/cờ/sự kiện sửa trên đáp án sau khi tạo và cần QA lại. Lời kết mẫu cần được viết lại theo truyện.

### Chuyển thẳng tới ending

Mẫu xét điểm mới gắn `automaticEnding` trên ô chốt. Game tính xong hiệu ứng đáp án trước đó, xét các điều kiện hiện có rồi chuyển thẳng tới duy nhất một ending hợp lệ, không hiển thị lời xét điểm hoặc yêu cầu chọn thêm. Ô chốt vẫn có trên sơ đồ; với ô cũ, mở **Thêm → Tự xét điểm → chuyển thẳng ending**. Ô này chỉ được có đường trực tiếp tới ending và điều kiện, không được có phần thưởng/chi phí hoặc sự kiện. Nếu không có hoặc nhiều ending cùng hợp lệ, player báo lỗi cấu hình thay vì tự chọn bừa. History vẫn ghi ô xử lý để chơi thử tuyến phát hiện đi sai nhánh, nhưng bộ đếm hiển thị không tính ô ẩn. AI bỏ qua ô xét điểm ẩn; chọn các ô ending để AI viết lời kết theo bối cảnh, các đường đi và điều kiện, rồi duyệt. Không có lượt AI nào tự chạy khi tạo mẫu.
