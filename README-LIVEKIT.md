# Pink Chat - LiveKit

## Vercel Environment Variables
Add these in the project Production environment:

- `LIVEKIT_URL` = your LiveKit WebSocket URL (`wss://...livekit.cloud`)
- `LIVEKIT_API_KEY` = your LiveKit API key
- `LIVEKIT_API_SECRET` = your LiveKit API secret

Never put `LIVEKIT_API_SECRET` in client-side code.

## Livestream
- Users join the LiveKit room as viewers first.
- Starting a live requests a host token with `canPublish: true` and host metadata.
- Viewers detect the host through LiveKit participant metadata and subscribe to camera/audio tracks.
- The host's token carries `pink-chat-host` metadata at join time, so no client-side metadata permission is required.
