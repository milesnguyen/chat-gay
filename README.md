# Pink Chat

## Livestream bằng LiveKit

Bản này dùng LiveKit Cloud thay cho WebRTC P2P cũ. Mỗi kênh chat dùng một LiveKit room riêng.

### 1. Cài package
```bash
npm install
```

### 2. Vercel Environment Variables
Thêm các biến:
```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
```
`LIVEKIT_API_SECRET` chỉ được đặt ở server/Vercel, không đưa vào `NEXT_PUBLIC_*`.

### 3. LiveKit Cloud
Tạo project tại LiveKit Cloud và lấy URL/API Key/API Secret.

### 4. Deploy
Redeploy trên Vercel sau khi thêm Environment Variables.

Người phát được cấp quyền publish camera/microphone; người xem chỉ được subscribe. Token được tạo tại `/api/livekit-token`.
