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
