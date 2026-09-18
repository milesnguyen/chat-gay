import { NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'

export async function POST(request) {
  try {
    const { roomName, identity, name, host } = await request.json()

    if (!roomName || !identity) {
      return NextResponse.json({ error: 'Thiếu thông tin phòng livestream.' }, { status: 400 })
    }

    if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET || !process.env.LIVEKIT_URL) {
      return NextResponse.json({ error: 'Chưa cấu hình LIVEKIT_URL, LIVEKIT_API_KEY và LIVEKIT_API_SECRET trên Vercel.' }, { status: 500 })
    }

    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: String(identity),
        name: String(name || identity),
        ttl: '6h',
      }
    )

    token.addGrant({
      roomJoin: true,
      room: String(roomName),
      canPublish: Boolean(host),
      canSubscribe: true,
      canPublishData: false,
    })

    return NextResponse.json({
      token: await token.toJwt(),
      url: process.env.LIVEKIT_URL,
    })
  } catch (error) {
    console.error('LiveKit token error:', error)
    return NextResponse.json({ error: 'Không thể tạo token livestream.' }, { status: 500 })
  }
}
