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

## Cấu trúc dữ liệu

Xem `supabase/migration.sql` để biết schema đầy đủ (8 bảng + RLS + storage bucket `fictionworld-media`). `base44/entities/*.jsonc` chỉ còn là tài liệu tham khảo mô tả field, không được app đọc lúc chạy.
