# Pink Chat - LiveKit livestream FIX v2

Livestream uses LiveKit Cloud for media and Supabase Realtime Presence only to announce the active host.

Important fixes:
- Users do NOT keep a LiveKit viewer connection open when nobody is live.
- Starting a live never creates two LiveKit connections with the same identity.
- Host presence is announced only after the host successfully connects and publishes camera/mic.
- Viewers discover an already-running live through Supabase Presence and then connect to LiveKit.
- When the host leaves, viewers automatically disconnect from the LiveKit room.
- Host viewer count comes from the LiveKit room participant list.

Vercel environment variables:
- LIVEKIT_URL
- LIVEKIT_API_KEY
- LIVEKIT_API_SECRET

Do not expose LIVEKIT_API_SECRET in frontend code.
