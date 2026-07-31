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

## Cấu trúc dữ liệu

Xem `supabase/migration.sql` để biết schema đầy đủ (8 bảng + RLS + storage bucket `fictionworld-media`). `base44/entities/*.jsonc` chỉ còn là tài liệu tham khảo mô tả field, không được app đọc lúc chạy.
