# Pink Chat – Core Smooth Update

Bản này nâng cấp phần lõi chat:
- Realtime connection status: Đã kết nối / Đang kết nối / Mất kết nối.
- Không polling, không reconnect realtime khi đổi kênh.
- Unread count theo từng kênh, lưu localStorage.
- Nút “↓ X tin nhắn mới” khi đang đọc tin cũ.
- Tin mới chỉ tự cuộn khi người dùng đang gần cuối chat.
- Gửi tin lỗi có nút “Thử lại”.
- Giữ nguyên avatar, sticker, image viewer, reply, reaction và quyền admin.

## Supabase
Chạy phần SQL bổ sung ở cuối `schema.sql` nếu đang dùng RPC xóa tin cũ. Phần patch mới làm RPC `admin_delete_message` nhận ID dạng text để tương thích cả UUID và BIGINT.

Không cần chạy lại toàn bộ schema nếu database hiện tại đã hoạt động; chỉ chạy phần `FIX: Admin delete...` ở cuối file.
