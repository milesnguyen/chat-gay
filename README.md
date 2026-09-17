# Pink Chat Realtime

## 1. Supabase
Mở SQL Editor trong project Supabase và chạy toàn bộ file `schema.sql`.

## 2. Environment
Tạo `.env.local` từ `.env.local.example` và điền Publishable key.

## 3. Vercel
Trong Vercel Project Settings > Environment Variables, thêm:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

Sau đó redeploy.


### Thông báo tin nhắn mới
Web hỗ trợ thông báo trình duyệt, âm thanh báo tin và số tin chưa đọc trên tiêu đề tab. Người dùng cần cấp quyền thông báo cho trình duyệt.
