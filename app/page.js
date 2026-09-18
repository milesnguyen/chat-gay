'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Room, RoomEvent, Track } from 'livekit-client'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cemjicquygwqfptpowhq.supabase.co'
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_oM2aO9hLAIhTSSbta4QqEQ_UaiNfIQv'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const USER_KEY = 'pink-chat-user-v2'
const SESSION_KEY = 'pink-chat-session-v1'

function avatarFor(userName) {
  const seed = encodeURIComponent(String(userName || 'user').trim().toLowerCase())
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}`
}

export default function Home() {
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [text, setText] = useState('')
  const [messages, setMessages] = useState([])
  const [online, setOnline] = useState([])
  const presenceRef = useRef(null)
  const [channels, setChannels] = useState([])
  const [channelId, setChannelId] = useState('')
  const [file, setFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [typingUsers, setTypingUsers] = useState([])
  const [replyTo, setReplyTo] = useState(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showStickers, setShowStickers] = useState(false)
  const [reactions, setReactions] = useState({})
  const [notificationPermission, setNotificationPermission] = useState('default')
  const [adminOpen, setAdminOpen] = useState(false)
  const [viewImage, setViewImage] = useState(null)
  const [adminLogged, setAdminLogged] = useState(false)
  const [adminPass, setAdminPass] = useState('')
  const [newChannel, setNewChannel] = useState('')
  const [blockName, setBlockName] = useState('')
  const [adminBusy, setAdminBusy] = useState(false)
  const [adminPasswordSession, setAdminPasswordSession] = useState('')
  const [blockedUsers, setBlockedUsers] = useState([])
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [unreadByChannel, setUnreadByChannel] = useState({})
  const [newMessageCount, setNewMessageCount] = useState(0)
  const [sendError, setSendError] = useState('')
  const [live, setLive] = useState(null)
  const [liveError, setLiveError] = useState('')
  const [isHostingLive, setIsHostingLive] = useState(false)
  const [liveViewers, setLiveViewers] = useState(0)
  const [liveMuted, setLiveMuted] = useState(false)
  const [liveCameraOff, setLiveCameraOff] = useState(false)
  const [livePlaybackBlocked, setLivePlaybackBlocked] = useState(false)
  const [liveAudioBlocked, setLiveAudioBlocked] = useState(false)
  const liveRoomRef = useRef(null)
  const liveClientIdRef = useRef(null)
  const liveSignalRef = useRef(null)
  const liveSignalReadyRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteVideoTrackRef = useRef(null)
  const liveAudioElementsRef = useRef([])
  const unreadRef = useRef(0)
  const channelRef = useRef(null)
  const bottomRef = useRef(null)
  const messagesBoxRef = useRef(null)
  const shouldScrollBottomRef = useRef(true)
  const input = useRef(null)
  const fileInput = useRef(null)
  const typingTimer = useRef(null)
  const channelIdRef = useRef('')
  const firstLoadRef = useRef(true)
  const mountedRef = useRef(false)
  const isHostingLiveRef = useRef(false)
  const liveRef = useRef(null)

  useEffect(() => { isHostingLiveRef.current = isHostingLive }, [isHostingLive])
  useEffect(() => { liveRef.current = live }, [live])

  useEffect(() => {
    if (localVideoRef.current) {
      const pub = liveRoomRef.current?.localParticipant?.getTrackPublication(Track.Source.Camera)
      const track = pub?.track
      if (track) track.attach(localVideoRef.current)
    }
  }, [isHostingLive])

  function getLiveClientId() {
    if (!liveClientIdRef.current) {
      try {
        liveClientIdRef.current = crypto.randomUUID()
      } catch {
        liveClientIdRef.current = `u-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      }
    }
    return liveClientIdRef.current
  }

  function detachLiveTracks() {
    try { liveRoomRef.current?.localParticipant?.trackPublications?.forEach(p => p.track?.detach()) } catch {}
    try { remoteVideoTrackRef.current?.detach?.() } catch {}
    try { remoteVideoRef.current?.srcObject && (remoteVideoRef.current.srcObject = null) } catch {}
    try { liveAudioElementsRef.current.forEach(el => { try { el.pause?.(); el.remove?.() } catch {} }) } catch {}
    liveAudioElementsRef.current = []
  }

  async function tryPlayLiveVideo() {
    const video = isHostingLiveRef.current ? localVideoRef.current : remoteVideoRef.current
    if (!video) return false
    try {
      video.setAttribute('playsinline', '')
      video.setAttribute('webkit-playsinline', '')
      video.muted = isHostingLiveRef.current
      await video.play()
      setLivePlaybackBlocked(false)
      return true
    } catch {
      setLivePlaybackBlocked(true)
      return false
    }
  }

  async function enableLivePlayback() {
    const room = liveRoomRef.current
    try {
      if (room && !room.canPlaybackAudio) {
        try { await room.startAudio() } catch {}
      }
      setLiveAudioBlocked(false)
    } catch {}
    await tryPlayLiveVideo()
  }

  useEffect(() => {
    const saved = localStorage.getItem(USER_KEY)
    const session = localStorage.getItem(SESSION_KEY)
    if (saved && session) {
      supabase.rpc('validate_chat_session', { p_token: session }).then(({data}) => {
        if (data?.username) { setName(data.username); setAuthUsername(data.username); setJoined(true) }
        else { localStorage.removeItem(USER_KEY); localStorage.removeItem(SESSION_KEY) }
      })
    }
    if ('Notification' in window) setNotificationPermission(Notification.permission)
    mountedRef.current = true
    try { setUnreadByChannel(JSON.parse(localStorage.getItem('pink-chat-unread-v1') || '{}')) } catch {}
    loadChannels()
    return () => { mountedRef.current = false }
  }, [])

  async function loadChannels() {
    const { data, error } = await supabase.from('chat_channels').select('*').order('created_at', { ascending: true })
    if (!error && data?.length) {
      setChannels(data)
      setChannelId(current => current || data[0].id)
    }
  }

  async function enableNotifications() {
    if (!('Notification' in window)) return alert('Trình duyệt này không hỗ trợ thông báo.')
    try { setNotificationPermission(await Notification.requestPermission()) } catch {}
  }

  function playNotificationSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      const ctx = new AudioContext(), osc = ctx.createOscillator(), gain = ctx.createGain()
      osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12)
      gain.gain.setValueAtTime(0.0001, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01); gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.2); setTimeout(() => ctx.close(), 300)
    } catch {}
  }

  function notifyNewMessage(message) {
    if (!message || message.name === name) return
    const cid = String(message.channel_id || '')
    const active = cid === String(channelIdRef.current)
    const box = messagesBoxRef.current
    const nearBottom = box ? box.scrollHeight - box.scrollTop - box.clientHeight < 120 : true
    if (!active || !nearBottom) {
      setUnreadByChannel(prev => { const next = {...prev, [cid]: (prev[cid] || 0) + 1}; localStorage.setItem('pink-chat-unread-v1', JSON.stringify(next)); return next })
      if (active) setNewMessageCount(v => v + 1)
    }
    unreadRef.current += 1; document.title = `(${unreadRef.current}) 💗 Pink Chat`; playNotificationSound()
    if (Notification.permission === 'granted') {
      const body = message.image_url ? `${message.name}: ${message.message || '📷 Đã gửi một hình ảnh'}` : `${message.name}: ${message.message || ''}`
      const notification = new Notification('💗 Tin nhắn mới - Pink Chat', { body: body.slice(0, 120), icon: '/favicon.ico', tag: 'pink-chat-message' })
      notification.onclick = () => { window.focus(); notification.close() }
    }
  }

  useEffect(() => {
    const resetUnread = () => { unreadRef.current = 0; document.title = '💗 Pink Chat' }
    window.addEventListener('focus', resetUnread)
    return () => window.removeEventListener('focus', resetUnread)
  }, [])

  // Global presence: danh sách người online không bị mất khi đổi kênh.
  useEffect(() => {
    if (!joined || !name.trim()) {
      setOnline([])
      return
    }
    const presence = supabase.channel('pink-chat-online', {
      config: { presence: { key: name.trim().toLowerCase() } }
    })
    presenceRef.current = presence
    presence
      .on('presence', { event: 'sync' }, () => {
        const state = presence.presenceState()
        const all = Object.values(state).flat()
        setOnline([...new Set(all.map(x => x.name).filter(Boolean))])
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await presence.track({ name: name.trim(), online_at: new Date().toISOString() })
        }
      })

    return () => {
      if (presenceRef.current === presence) presenceRef.current = null
      supabase.removeChannel(presence)
      setOnline([])
    }
  }, [joined, name])

  // Load the selected channel once. Realtime handles new messages; no polling that can fight the user's scroll.
  useEffect(() => {
    channelIdRef.current = channelId
    if (!joined || !name.trim() || !channelId) return
    let active = true

    setMessages([])
    setReactions({})
    setTypingUsers([])
    setNewMessageCount(0)
    setUnreadByChannel(prev => { if (!prev[channelId]) return prev; const next={...prev}; delete next[channelId]; localStorage.setItem('pink-chat-unread-v1', JSON.stringify(next)); return next })
    shouldScrollBottomRef.current = true
    firstLoadRef.current = true

    async function loadMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(200)
      if (!active) return
      if (!error) {
        setMessages(data || [])
        const ids = (data || []).map(m => m.id)
        if (ids.length) {
          const { data: rx } = await supabase.from('message_reactions').select('*').in('message_id', ids)
          if (active) {
            const grouped = {}
            ;(rx || []).forEach(r => { grouped[r.message_id] = [...(grouped[r.message_id] || []), r] })
            setReactions(grouped)
          }
        }
        requestAnimationFrame(() => {
          const box = messagesBoxRef.current
          if (box) box.scrollTop = box.scrollHeight
          shouldScrollBottomRef.current = true
          firstLoadRef.current = false
        })
      }
    }
    loadMessages()
    return () => { active = false }
  }, [joined, name, channelId])

  // One stable Realtime connection for the whole chat. Switching channels does not reconnect it.
  useEffect(() => {
    if (!joined || !name.trim()) return
    setConnectionStatus('connecting')
    const realtime = supabase.channel('pink-chat-realtime-v5')
    const handleMessage = payload => {
      const msg = payload.new
      if (!msg || String(msg.channel_id) !== String(channelIdRef.current)) return
      // Quyết định có tự cuộn hay không TRƯỚC khi thêm tin mới.
      // Nếu người dùng đang đọc tin cũ thì tuyệt đối không kéo họ xuống.
      const shouldAutoScroll = shouldScrollBottomRef.current || firstLoadRef.current
      setMessages(prev => {
        if (prev.some(m => String(m.id) === String(msg.id))) return prev
        return [...prev, msg]
      })
      if (shouldAutoScroll) {
        // Chờ React render xong message rồi mới cuộn, tránh scroll trước khi
        // scrollHeight được cập nhật khiến tin mới không xuống tới cuối.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const box = messagesBoxRef.current
            if (!box) return
            box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' })
            shouldScrollBottomRef.current = true
          })
        })
      }
      notifyNewMessage(msg)
    }
    realtime
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, handleMessage)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
        const deleted = payload.old
        if (!deleted?.id) return
        setMessages(prev => prev.filter(m => String(m.id) !== String(deleted.id)))
        setReactions(prev => { const next = {...prev}; delete next[deleted.id]; return next })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, payload => {
        const r = payload.new
        setReactions(prev => ({ ...prev, [r.message_id]: [...(prev[r.message_id] || []).filter(x => !(String(x.id) === String(r.id))), r] }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, payload => {
        const r = payload.old
        setReactions(prev => ({ ...prev, [r.message_id]: (prev[r.message_id] || []).filter(x => String(x.id) !== String(r.id)) }))
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') setConnectionStatus('connected')
        else if (['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)) setConnectionStatus('disconnected')
      })
    return () => { supabase.removeChannel(realtime); setConnectionStatus('disconnected') }
  }, [joined, name])

  // LiveKit server-side livestream. Presence is used only to announce whether
  // a host is live. This avoids every chat user holding a LiveKit connection
  // when nobody is streaming and, importantly, avoids duplicate identities
  // when a viewer becomes the host.
  useEffect(() => {
    if (!joined || !name.trim() || !channelId) return
    let cancelled = false
    const roomName = `pink-chat-${channelId}`
    const signalName = `pink-chat-live-${channelId}`
    let signal = null

    const disconnectLiveRoom = async () => {
      const room = liveRoomRef.current
      if (!room) return
      try { await room.disconnect() } catch {}
      if (liveRoomRef.current === room) liveRoomRef.current = null
      remoteVideoTrackRef.current = null
      try { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null } catch {}
    }

    const attachRemoteTrack = (track) => {
      if (track.kind !== Track.Kind.Video) return
      remoteVideoTrackRef.current = track
      if (remoteVideoRef.current && !isHostingLiveRef.current) {
        try {
          track.attach(remoteVideoRef.current)
          remoteVideoRef.current.muted = false
          remoteVideoRef.current.setAttribute('playsinline', '')
          remoteVideoRef.current.setAttribute('webkit-playsinline', '')
          remoteVideoRef.current.play().then(() => setLivePlaybackBlocked(false)).catch(() => setLivePlaybackBlocked(true))
        } catch {
          setLivePlaybackBlocked(true)
        }
      }
    }

    const connectAsViewer = async (host) => {
      if (cancelled || isHostingLiveRef.current || !host) return
      const existing = liveRoomRef.current
      if (existing) return
      setLiveError('')
      try {
        const res = await fetch('/api/livekit-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            identity: getLiveClientId(),
            name: name.trim(),
            host: false
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Không thể lấy token livestream.')

        const room = new Room({ adaptiveStream: true, dynacast: true })
        liveRoomRef.current = room
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (participant?.identity === host.hostId && track.kind === Track.Kind.Video) attachRemoteTrack(track)
          if (participant?.identity === host.hostId && track.kind === Track.Kind.Audio) {
            try {
              const els = track.attach() || []
              const list = Array.isArray(els) ? els : [els]
              list.filter(Boolean).forEach(el => {
                el.autoplay = true
                el.playsInline = true
                el.setAttribute('playsinline', '')
                document.body.appendChild(el)
                liveAudioElementsRef.current.push(el)
                el.play().then(() => setLiveAudioBlocked(false)).catch(() => setLiveAudioBlocked(true))
              })
            } catch {
              setLiveAudioBlocked(true)
            }
          }
        })
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          try { track.detach() } catch {}
          if (remoteVideoTrackRef.current === track) remoteVideoTrackRef.current = null
        })
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          if (participant?.identity === host.hostId && !isHostingLiveRef.current) {
            setLive(null)
            setLiveError('')
            disconnectLiveRoom()
          }
        })
        room.on(RoomEvent.MediaDevicesError, (error) => {
          console.warn('Viewer media error:', error)
        })
        room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          if (!room.canPlaybackAudio && !isHostingLiveRef.current) setLiveAudioBlocked(true)
        })
        room.on(RoomEvent.Disconnected, (reason) => {
          if (!cancelled && !isHostingLiveRef.current && liveRoomRef.current === room) {
            // A normal cleanup is not an error. Other disconnect reasons are
            // surfaced so the user can see why the viewer was disconnected.
            const text = String(reason || '')
            if (text && !/CLIENT_INITIATED|ClientInitiated/i.test(text)) {
              setLiveError(`Livestream mất kết nối (${text}).`)
            }
            liveRoomRef.current = null
          }
        })

        await room.connect(data.url, data.token)
        if (cancelled || isHostingLiveRef.current) {
          await room.disconnect()
          if (liveRoomRef.current === room) liveRoomRef.current = null
          return
        }

        // A host may already be publishing when we join, so attach any
        // currently subscribed camera track as well as handling future tracks.
        const remoteHost = room.getParticipantByIdentity(host.hostId)
        const pub = remoteHost?.getTrackPublication(Track.Source.Camera)
        if (pub?.track) attachRemoteTrack(pub.track)
        const micPub = remoteHost?.getTrackPublication(Track.Source.Microphone)
        if (micPub?.track) {
          try {
            const els = micPub.track.attach() || []
            const list = Array.isArray(els) ? els : [els]
            list.filter(Boolean).forEach(el => {
              el.autoplay = true
              el.playsInline = true
              el.setAttribute('playsinline', '')
              document.body.appendChild(el)
              liveAudioElementsRef.current.push(el)
              el.play().then(() => setLiveAudioBlocked(false)).catch(() => setLiveAudioBlocked(true))
            })
          } catch {
            setLiveAudioBlocked(true)
          }
        }
        try { await room.startAudio() } catch {}
      } catch (err) {
        if (!cancelled && !isHostingLiveRef.current) {
          setLiveError(err.message || 'Không thể kết nối livestream.')
        }
        if (liveRoomRef.current) {
          try { await liveRoomRef.current.disconnect() } catch {}
          liveRoomRef.current = null
        }
      }
    }

    const syncLivePresence = async () => {
      if (!signal || cancelled) return
      const state = signal.presenceState()
      const hosts = Object.values(state)
        .flat()
        .filter(item => item?.role === 'host' && item?.hostId)
      const host = hosts[0] || null

      if (host) {
        setLive({
          hostId: host.hostId,
          hostName: host.hostName || 'Đang livestream',
          startedAt: host.startedAt || new Date().toISOString()
        })
        if (!isHostingLiveRef.current) await connectAsViewer(host)
      } else if (!isHostingLiveRef.current) {
        setLive(null)
        setLiveError('')
        await disconnectLiveRoom()
      }
    }

    signal = supabase.channel(signalName, {
      config: { presence: { key: getLiveClientId() } }
    })
    liveSignalRef.current = signal
    let resolveSignalReady
    let rejectSignalReady
    liveSignalReadyRef.current = new Promise((resolve, reject) => {
      resolveSignalReady = resolve
      rejectSignalReady = reject
    })
    signal
      .on('presence', { event: 'sync' }, syncLivePresence)
      .on('presence', { event: 'join' }, syncLivePresence)
      .on('presence', { event: 'leave' }, syncLivePresence)
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          resolveSignalReady?.(signal)
          syncLivePresence()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          rejectSignalReady?.(new Error('Không thể kết nối tín hiệu livestream.'))
        }
      })

    const previousSignal = liveSignalRef.current
    return () => {
      cancelled = true
      if (previousSignal) {
        try { previousSignal.untrack() } catch {}
        try { supabase.removeChannel(previousSignal) } catch {}
      }
      if (liveSignalRef.current === previousSignal) liveSignalRef.current = null
      liveSignalReadyRef.current = null
      disconnectLiveRoom()
      setLive(null)
      setLiveViewers(0)
      setLiveError('')
      setLivePlaybackBlocked(false)
      setLiveAudioBlocked(false)
      setIsHostingLive(false)
      isHostingLiveRef.current = false
      setLiveMuted(false)
      setLiveCameraOff(false)
    }
  }, [joined, name, channelId])

  useEffect(() => {
    const track = remoteVideoTrackRef.current
    if (track && remoteVideoRef.current && !isHostingLive) {
      try { track.attach(remoteVideoRef.current) } catch {}
    }
  }, [live, isHostingLive])

  async function getLiveKitToken(host) {
    const res = await fetch('/api/livekit-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: `pink-chat-${channelId}`,
        identity: getLiveClientId(),
        name: name.trim(),
        host
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Không thể lấy token livestream.')
    return data
  }

  async function startLive() {
    if (!channelId || isHostingLive) return
    setLiveError('')
    let hostRoom = null
    try {
      // Never keep a viewer room open while becoming the host. The old
      // implementation could create two LiveKit connections with the same
      // identity, causing LiveKit to disconnect one of them.
      if (liveRoomRef.current) {
        try { await liveRoomRef.current.disconnect() } catch {}
        liveRoomRef.current = null
      }

      const data = await getLiveKitToken(true)
      hostRoom = new Room({ adaptiveStream: true, dynacast: true })
      liveRoomRef.current = hostRoom
      hostRoom.on(RoomEvent.ParticipantConnected, () => {
        setLiveViewers(hostRoom.remoteParticipants.size)
      })
      hostRoom.on(RoomEvent.ParticipantDisconnected, () => {
        setLiveViewers(hostRoom.remoteParticipants.size)
      })
      hostRoom.on(RoomEvent.MediaDevicesError, (error) => {
        const message = String(error?.message || error || '')
        if (/permission|denied|notallowed/i.test(message)) {
          setLiveError('Điện thoại chưa cho phép Camera/Micro. Hãy bấm Cho phép khi trình duyệt hỏi quyền.')
        } else if (/notfound|device/i.test(message)) {
          setLiveError('Không tìm thấy camera hoặc micro trên thiết bị.')
        } else {
          setLiveError(`Camera/Micro lỗi: ${message || 'không xác định'}`)
        }
      })
      hostRoom.on(RoomEvent.Disconnected, (reason) => {
        if (isHostingLiveRef.current && String(reason || '').match(/DUPLICATE|REMOVED|ROOM_DELETED|JOIN_FAILURE/i)) {
          setLiveError(`Livestream bị ngắt (${reason}).`)
        }
      })

      await hostRoom.connect(data.url, data.token)
      await hostRoom.localParticipant.setCameraEnabled(true)
      await hostRoom.localParticipant.setMicrophoneEnabled(true)

      setLiveAudioBlocked(false)
      setLivePlaybackBlocked(false)
      setLive({ hostId: getLiveClientId(), hostName: name.trim(), startedAt: new Date().toISOString() })
      setIsHostingLive(true)
      isHostingLiveRef.current = true
      setLiveMuted(false)
      setLiveCameraOff(false)
      setLiveViewers(hostRoom.remoteParticipants.size)

      const pub = hostRoom.localParticipant.getTrackPublication(Track.Source.Camera)
      if (pub?.track && localVideoRef.current) {
        pub.track.attach(localVideoRef.current)
        localVideoRef.current.muted = true
        localVideoRef.current.setAttribute('playsinline', '')
        localVideoRef.current.setAttribute('webkit-playsinline', '')
        try { await localVideoRef.current.play() } catch {}
      }

      // Announce the live only after the host has successfully connected and
      // published media. Viewers can then join the same room without racing
      // the host connection.
      const signal = liveSignalRef.current
      if (signal) {
        try {
          if (liveSignalReadyRef.current) await liveSignalReadyRef.current
          await signal.track({
            role: 'host',
            hostId: getLiveClientId(),
            hostName: name.trim(),
            startedAt: new Date().toISOString()
          })
        } catch (presenceError) {
          console.warn('Live presence track failed:', presenceError)
        }
      }
    } catch (err) {
      try { await hostRoom?.disconnect() } catch {}
      if (liveRoomRef.current === hostRoom) liveRoomRef.current = null
      setLiveError(err.message || 'Không thể bắt đầu livestream.')
      setLive(null)
      setIsHostingLive(false)
      isHostingLiveRef.current = false
      setLiveViewers(0)
    }
  }

  async function stopLive() {
    const room = liveRoomRef.current
    if (!room || !isHostingLive) return
    try {
      const signal = liveSignalRef.current
      if (signal) await signal.untrack()
    } catch {}
    try { await room.localParticipant.setCameraEnabled(false) } catch {}
    try { await room.localParticipant.setMicrophoneEnabled(false) } catch {}
    detachLiveTracks()
    try { await room.disconnect() } catch {}
    if (liveRoomRef.current === room) liveRoomRef.current = null
    setIsHostingLive(false)
    isHostingLiveRef.current = false
    setLive(null)
    setLiveViewers(0)
    setLiveMuted(false)
    setLiveCameraOff(false)
    setLiveError('')
    setLivePlaybackBlocked(false)
    setLiveAudioBlocked(false)
  }

  function toggleLiveMute() {
    const next = !liveMuted
    liveRoomRef.current?.localParticipant?.setMicrophoneEnabled(!next)
    setLiveMuted(next)
  }

  function toggleLiveCamera() {
    const next = !liveCameraOff
    liveRoomRef.current?.localParticipant?.setCameraEnabled(!next)
    setLiveCameraOff(next)
  }

  // Typing indicator uses broadcast only; it is isolated per room.
  useEffect(() => {
    if (!joined || !name.trim() || !channelId) return
    const typingChannel = supabase.channel(`pink-chat-typing-${channelId}`, { config: { broadcast: { self: false } } })
    channelRef.current = typingChannel
    typingChannel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload?.name || payload.name === name) return
        setTypingUsers(prev => payload.typing ? [...new Set([...prev, payload.name])] : prev.filter(x => x !== payload.name))
      })
      .subscribe()
    return () => {
      if (channelRef.current === typingChannel) channelRef.current = null
      clearTimeout(typingTimer.current)
      setTypingUsers([])
      supabase.removeChannel(typingChannel)
    }
  }, [joined, name, channelId])

  async function sendSticker(sticker) {
    if (sending || !channelId || !sticker) return
    setSending(true); setSendError('')
    try {
      const { error } = await supabase.from('messages').insert({
        name: name.trim(), message: null, image_url: null,
        sticker_url: sticker.url, message_type: 'sticker',
        channel_id: channelId, reply_to: replyTo?.id || null
      })
      if (error) throw error
      setReplyTo(null); setShowStickers(false); setShowEmoji(false)
    } catch (err) {
      setSendError(err.message || 'Gửi sticker thất bại.')
    } finally { setSending(false) }
  }

  async function send() {
    if (sending || (!text.trim() && !file) || !channelId) return
    setSending(true); setSendError('')
    try {
      let image_url = null
      if (file) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('images').upload(path, file, { contentType: file.type, upsert: false })
        if (uploadError) throw uploadError
        image_url = supabase.storage.from('images').getPublicUrl(path).data.publicUrl
      }
      const { error } = await supabase.from('messages').insert({
        name: name.trim(), message: text.trim() || null, image_url,
        channel_id: channelId, reply_to: replyTo?.id || null
      })
      if (error) {
        if (String(error.message || '').includes('USER_BLOCKED')) throw new Error('Bạn đã bị block và không thể gửi tin nhắn.')
        throw error
      }
      setText(''); setFile(null); setReplyTo(null); setShowEmoji(false)
      if (fileInput.current) fileInput.current.value = ''
    } catch (err) {
      setSendError(err.message || 'Gửi tin nhắn thất bại.')
    } finally { setSending(false) }
  }

  async function retrySend() {
    if (!text.trim() && !file) return
    setSendError('')
    await send()
  }

  async function updateTyping(value) {
    setText(value)
    if (!channelRef.current) return
    clearTimeout(typingTimer.current)
    try { await channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { name: name.trim(), typing: true } }) } catch {}
    typingTimer.current = setTimeout(async () => {
      try { await channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { name: name.trim(), typing: false } }) } catch {}
    }, 1200)
  }

  function addEmoji(emoji) { setText(v => v + emoji); setShowEmoji(false); input.current?.focus() }

  async function toggleReaction(messageId, emoji) {
    const existing = (reactions[messageId] || []).find(r => r.name === name && r.emoji === emoji)
    if (existing) {
      const { error } = await supabase.from('message_reactions').delete().eq('id', existing.id)
      if (!error) setReactions(prev => ({ ...prev, [messageId]: (prev[messageId] || []).filter(r => r.id !== existing.id) }))
    } else {
      const { data, error } = await supabase.from('message_reactions').insert({ message_id: messageId, name: name.trim(), emoji }).select().single()
      if (!error && data) setReactions(prev => ({ ...prev, [messageId]: [...(prev[messageId] || []), data] }))
    }
  }

  function startReply(message) { setReplyTo(message); input.current?.focus() }

  function handlePaste(e) {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find(item => item.type.startsWith('image/'))
    if (!imageItem) return
    const pastedFile = imageItem.getAsFile()
    if (!pastedFile) return
    e.preventDefault()
    if (pastedFile.size > 5 * 1024 * 1024) return alert('Ảnh tối đa 5MB.')
    const ext = pastedFile.type.split('/')[1] || 'png'
    const imageFile = new File([pastedFile], `pasted-${Date.now()}.${ext}`, { type: pastedFile.type })
    setFile(imageFile)
  }

  function chooseImage(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) return alert('Chỉ chọn file ảnh.')
    if (f.size > 5 * 1024 * 1024) return alert('Ảnh tối đa 5MB.')
    setFile(f)
  }

  function handleMessagesScroll(e) {
    const el = e.currentTarget
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    shouldScrollBottomRef.current = atBottom
    if (atBottom) setNewMessageCount(0)
    firstLoadRef.current = false
  }

  function jumpToLatest() {
    const box = messagesBoxRef.current
    if (!box) return
    box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' })
    shouldScrollBottomRef.current = true
    setNewMessageCount(0)
  }

  function logout() {
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(SESSION_KEY)
    setJoined(false); setName(''); setAuthUsername(''); setAuthPassword(''); setAuthMode('login')
    try { liveRoomRef.current?.disconnect() } catch {}
    liveRoomRef.current = null
    setLive(null); setIsHostingLive(false); isHostingLiveRef.current = false
  }

  async function submitAuth(e) {
    e.preventDefault()
    const username = authUsername.trim()
    const password = authPassword
    setAuthError('')
    if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) return setAuthError('Tên đăng nhập 3–30 ký tự, chỉ dùng chữ, số và _.')
    if (password.length < 6) return setAuthError('Mật khẩu phải có ít nhất 6 ký tự.')
    setAuthBusy(true)
    try {
      const rpc = authMode === 'register' ? 'register_chat_account' : 'login_chat_account'
      const { data, error } = await supabase.rpc(rpc, { p_username: username, p_password: password })
      if (error) throw error
      if (!data?.username || !data?.session_token) throw new Error('Đăng nhập thất bại.')
      localStorage.setItem(USER_KEY, data.username)
      localStorage.setItem(SESSION_KEY, data.session_token)
      setName(data.username); setJoined(true); setAuthPassword(''); setAuthError(''); setConnectionStatus('connecting')
      if ('Notification' in window && Notification.permission === 'default') enableNotifications()
    } catch (err) { setAuthError(err.message || 'Không thể kết nối tài khoản.') }
    finally { setAuthBusy(false) }
  }

  async function adminLogin(e) {
    e.preventDefault()
    if (!adminPass) return
    setAdminBusy(true)
    const { data, error } = await supabase.rpc('admin_verify', { admin_name: 'Miles', admin_password: adminPass })
    setAdminBusy(false)
    if (error || !data) return alert('Sai mật khẩu admin.')
    setAdminLogged(true); setAdminPasswordSession(adminPass); setAdminPass('')
    const { data: blocked } = await supabase.rpc('admin_list_blocked_users', { admin_name: 'Miles', admin_password: adminPass })
    setBlockedUsers(blocked || [])
    alert('Đăng nhập admin thành công.')
  }

  async function createChannel() {
    const n = newChannel.trim(); if (!n || !adminLogged) return
    setAdminBusy(true)
    const { data, error } = await supabase.rpc('admin_create_channel', { admin_name: 'Miles', admin_password: adminPasswordSession, channel_name: n })
    setAdminBusy(false)
    if (error) return alert(error.message)
    setNewChannel(''); await loadChannels(); if (data?.id) setChannelId(data.id); alert('Đã tạo kênh mới.')
  }

  async function loadBlockedUsers() {
    if (!adminLogged) return
    const { data, error } = await supabase.rpc('admin_list_blocked_users', { admin_name: 'Miles', admin_password: adminPasswordSession })
    if (!error) setBlockedUsers(data || [])
  }

  async function unblockUser(targetName) {
    const n = String(targetName || '').trim(); if (!n || !adminLogged) return
    if (!window.confirm(`Bỏ block ${n}?`)) return
    setAdminBusy(true)
    const { error } = await supabase.rpc('admin_unblock_user', { admin_name: 'Miles', admin_password: adminPasswordSession, user_name: n })
    setAdminBusy(false)
    if (error) return alert(error.message)
    await loadBlockedUsers()
    alert(`Đã bỏ block ${n}.`)
  }

  async function deleteMessage(messageId) {
    if (!adminLogged || !messageId || adminBusy) return
    if (!window.confirm('Xóa tin nhắn này?')) return
    setAdminBusy(true)
    try {
      const { data, error } = await supabase.rpc('admin_delete_message', {
        admin_name: 'Miles',
        admin_password: adminPasswordSession,
        message_id: String(messageId)
      })
      if (error) throw error
      if (data !== true) throw new Error('Admin chưa có quyền xóa tin. Hãy chạy sticker_patch.sql trong Supabase.')
      setMessages(prev => prev.filter(m => String(m.id) !== String(messageId)))
      setReactions(prev => { const next = {...prev}; delete next[messageId]; return next })
    } catch (err) {
      alert(`Xóa tin thất bại: ${err.message || err}`)
    } finally {
      setAdminBusy(false)
    }
  }

  async function deleteChannel(channel) {
    if (!adminLogged || !channel) return
    if (channel.name === 'Chung') return alert('Không thể xóa kênh Chung.')
    if (!window.confirm(`Xóa kênh #${channel.name} và toàn bộ tin nhắn trong kênh?`)) return
    setAdminBusy(true)
    const { error } = await supabase.rpc('admin_delete_channel', { admin_name: 'Miles', admin_password: adminPasswordSession, channel_id: channel.id })
    setAdminBusy(false)
    if (error) return alert(error.message)
    await loadChannels()
    alert(`Đã xóa kênh #${channel.name}.`)
  }

  async function blockUser(targetName = blockName) {
    const n = targetName.trim(); if (!n || !adminLogged) return
    if (!window.confirm(`Block ${n}?`)) return
    setAdminBusy(true)
    const { error } = await supabase.rpc('admin_block_user', { admin_name: 'Miles', admin_password: adminPasswordSession, user_name: n })
    setAdminBusy(false)
    if (error) return alert(error.message)
    setBlockName(''); alert(`Đã block ${n}. Người này sẽ không gửi được tin nhắn nữa.`)
  }

  useEffect(() => {
    if (!viewImage) return
    const onKey = e => { if (e.key === 'Escape') setViewImage(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewImage])

  if (!joined) return <main className="login"><div className="card"><div className="logo">💗</div><h1>Pink Chat</h1><p>{authMode==='register'?'Tạo tài khoản mới':'Đăng nhập tài khoản'}</p><form onSubmit={submitAuth}><input autoFocus value={authUsername} onChange={e=>setAuthUsername(e.target.value)} placeholder="Tên đăng nhập" maxLength={30}/><input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="Mật khẩu (tối thiểu 6 ký tự)" maxLength={72}/>{authError&&<div className="auth-error">⚠️ {authError}</div>}<button disabled={authBusy}>{authBusy?'Đang xử lý...':authMode==='register'?'Tạo tài khoản':'Đăng nhập'}</button></form><button className="auth-switch" onClick={()=>{setAuthMode(v=>v==='login'?'register':'login');setAuthError('')}}>{authMode==='login'?'Chưa có tài khoản? Tạo tài khoản':'Đã có tài khoản? Đăng nhập'}</button></div></main>

  const currentChannel = channels.find(c => c.id === channelId)
  return <main className="app">
    <header><div><h1>💗 Pink Chat</h1><span>{currentChannel?.name || 'Phòng chat'} • <i className={`connection-dot ${connectionStatus}`}></i>{connectionStatus==='connected'?'Đã kết nối':connectionStatus==='connecting'?'Đang kết nối...':'Mất kết nối'}</span></div><div className="header-actions"><button className="admin-btn" onClick={()=>setAdminOpen(true)}>⚙ Admin</button>{notificationPermission !== 'granted' && <button className="notify" onClick={enableNotifications}>🔔 Bật thông báo</button>}<button className="logout" onClick={logout}>Đổi tên</button></div></header>
    <section className="layout">
      <aside><h3>💬 Kênh chat</h3><div className="channels">{channels.map(c=><div className="channel-row" key={c.id}><button className={c.id===channelId?'channel active':'channel'} onClick={()=>setChannelId(c.id)}># {c.name}{unreadByChannel[String(c.id)] ? <em className="unread-badge">{unreadByChannel[String(c.id)] > 99 ? '99+' : unreadByChannel[String(c.id)]}</em> : null}</button>{adminLogged && c.name!=='Chung' && <button className="channel-delete" title="Xóa kênh" onClick={()=>deleteChannel(c)}>×</button>}</div>)}</div><h3 className="online-title">🟢 Người online <em>{online.length}</em></h3>{online.map((u,i)=><div className="user" key={u+i}><span className="user-name"><img className="avatar avatar-sm" src={avatarFor(u)} alt=""/><i/>{u}{u===name?' (Bạn)':''}</span>{adminLogged && u!==name && <button className="block-user-btn" title={`Block ${u}`} onClick={()=>blockUser(u)}>🚫 Block</button>}</div>)}{online.length===0&&<small>Đang kết nối...</small>}<div className="note">Tin nhắn được đồng bộ cho mọi người đang trong phòng.</div></aside>
      <div className="chat">{(live || isHostingLive) && <div className="live-panel"><div className="live-panel-head"><div><b>🔴 LIVE</b><span>{isHostingLive ? `Bạn đang livestream • ${liveViewers} người xem` : `${live?.hostName || "Đang livestream"} đang phát`}</span></div><div className="live-actions">{isHostingLive ? <><button onClick={toggleLiveMute}>{liveMuted ? "🔇 Bật mic" : "🎤 Tắt mic"}</button><button onClick={toggleLiveCamera}>{liveCameraOff ? "📷 Bật cam" : "🚫 Tắt cam"}</button><button className="live-stop" onClick={stopLive}>⏹ Kết thúc</button></> : <span className="live-viewers">👁️ Đang xem</span>}</div></div><div className="live-video-wrap">{isHostingLive ? <video ref={localVideoRef} autoPlay muted playsInline webkit-playsinline="true" className="live-video"/> : <video ref={remoteVideoRef} autoPlay playsInline webkit-playsinline="true" className="live-video"/>}{!isHostingLive && (livePlaybackBlocked || liveAudioBlocked) && <button className="live-play-btn" onClick={enableLivePlayback}>▶️ Chạm để xem livestream</button>}{liveError&&<div className="live-error">⚠️ {liveError}</div>}</div></div>}{!live && !isHostingLive && <button className="start-live-btn" onClick={startLive}>🔴 Livestream</button>}<div className="messages" ref={messagesBoxRef} onScroll={handleMessagesScroll}>{newMessageCount>0&&<button className="new-message-pill" onClick={jumpToLatest}>↓ {newMessageCount} tin nhắn mới</button>}{messages.length===0&&<div className="empty">Chưa có tin nhắn. Hãy bắt đầu 💬</div>}{messages.map(m=>{
          const parent=m.reply_to ? messages.find(x=>String(x.id)===String(m.reply_to)) : null
          const rx=reactions[m.id]||[]
          const counts=rx.reduce((a,r)=>(a[r.emoji]=(a[r.emoji]||0)+1,a),{})
          return <div className={'msg '+(m.name===name?'mine':'')} key={m.id}><img className="avatar avatar-msg" src={avatarFor(m.name)} alt=""/><div className="bubble">
            <b>{m.name}</b>
            {parent&&<div className="reply-preview"><strong>{parent.name}</strong>: {parent.message||'📷 Hình ảnh'}</div>}
            {m.message&&<div className="msgtext">{m.message}</div>}
            {m.image_url&&<img className="chat-image" src={m.image_url} alt="Ảnh" onClick={()=>setViewImage(m.image_url)} title="Bấm để xem ảnh"/>}
            {m.message_type==='sticker'&&m.sticker_url&&<img className="chat-sticker" src={m.sticker_url} alt="Sticker" onClick={()=>setViewImage(m.sticker_url)} title="Bấm để xem sticker"/>}
            <small>{new Date(m.created_at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</small>
            {Object.entries(counts).length>0&&<div className="reaction-list">{Object.entries(counts).map(([emoji,count])=>{
              const reactors=[...new Set(rx.filter(r=>r.emoji===emoji).map(r=>r.name).filter(Boolean))]
              return <div className="reaction-wrap" key={emoji}>
                <button className={'reaction '+(rx.some(r=>r.name===name&&r.emoji===emoji)?'active':'')} onClick={()=>toggleReaction(m.id,emoji)} aria-label={`${emoji} ${count} người`}>{emoji} {count}</button>
                <div className="reaction-tooltip">{reactors.map((n,i)=><div key={n+i}><b>{n}</b> <span>{emoji}</span></div>)}</div>
              </div>
            })}</div>}
            <div className="msg-actions"><button onClick={()=>startReply(m)}>↩️ Reply</button>{adminLogged&&<button className="admin-delete" onClick={()=>deleteMessage(m.id)}>🗑 Xóa</button>}<button onClick={()=>toggleReaction(m.id,'❤️')}>❤️</button><button onClick={()=>toggleReaction(m.id,'😂')}>😂</button><button onClick={()=>toggleReaction(m.id,'👍')}>👍</button></div>
          </div></div>
        })}<div ref={bottomRef}/></div>
        <div className="composer">{sendError&&<div className="send-error">⚠️ {sendError} <button onClick={retrySend}>Thử lại</button></div>}{typingUsers.length>0&&<div className="typing">✍️ {typingUsers.join(', ')} đang nhập...</div>}{replyTo&&<div className="replying">↩️ Đang trả lời <b>{replyTo.name}</b>: {replyTo.message||'📷 Hình ảnh'}<button onClick={()=>setReplyTo(null)}>×</button></div>}{file&&<div className="preview">📷 {file.name}<button onClick={()=>{setFile(null);if(fileInput.current)fileInput.current.value='' }}>×</button></div>}<div className="row"><label className="attach">📷<input ref={fileInput} type="file" accept="image/*" onChange={chooseImage}/></label><div className="sticker-wrap"><button className="sticker-btn" onClick={()=>setShowStickers(v=>!v)}>🎟️</button>{showStickers&&<div className="sticker-picker"><div className="sticker-title">Sticker động</div><div className="sticker-grid">{[
              ['haha','😂','HAHA'],['love','🥰','LOVE'],['cry','😭','HUHU'],['angry','😡','GRR'],['wow','😮','WOW'],['ok','👍','OK'],['fire','🔥','HOT'],['heart','❤️','LOVE']
            ].map(([id,emoji,label])=><button key={id} onClick={()=>sendSticker({id,url:`/stickers/${id}.svg`})}><img src={`/stickers/${id}.svg`} alt={label}/></button>)}</div></div>}</div><div className="emoji-wrap"><button className="emoji-btn" onClick={()=>setShowEmoji(v=>!v)}>😀</button>{showEmoji&&<div className="emoji-picker">{['😀','😂','😍','🥰','😎','😮','😢','😡','👍','👎','❤️','🔥','🎉','👏','🙏','💯','🤣','😘'].map(e=><button key={e} onClick={()=>addEmoji(e)}>{e}</button>)}</div>}</div><input ref={input} value={text} onPaste={handlePaste} onChange={e=>updateTyping(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),send())} placeholder={`Nhắn trong #${currentChannel?.name || 'Chung'}...`}/><button disabled={sending} onClick={send}>{sending?'...':'Gửi'}</button></div></div>
      </div>
    </section>

    {viewImage && <div className="image-lightbox" onClick={()=>setViewImage(null)}><button className="image-lightbox-close" onClick={()=>setViewImage(null)} aria-label="Đóng">×</button><img src={viewImage} alt="Xem ảnh" onClick={e=>e.stopPropagation()}/></div>}

    {adminOpen && <div className="modal-backdrop" onClick={()=>setAdminOpen(false)}><div className="admin-modal" onClick={e=>e.stopPropagation()}><div className="admin-head"><h2>⚙ Quản lý Admin</h2><button onClick={()=>setAdminOpen(false)}>×</button></div>{!adminLogged ? <form onSubmit={adminLogin}><p>Đăng nhập bằng tài khoản admin.</p><input value="Miles" readOnly/><input type="password" value={adminPass} onChange={e=>setAdminPass(e.target.value)} placeholder="Mật khẩu" autoFocus/><button disabled={adminBusy}>Đăng nhập</button></form> : <div className="admin-tools"><div><h3>➕ Tạo kênh mới</h3><div className="admin-row"><input value={newChannel} onChange={e=>setNewChannel(e.target.value)} placeholder="Tên kênh" maxLength={40}/><button disabled={adminBusy} onClick={createChannel}>Tạo</button></div></div><div><h3>🚫 Quản lý người bị block</h3>{blockedUsers.length===0?<div className="admin-empty">Chưa có ai bị block.</div>:<div className="blocked-list">{blockedUsers.map((u,i)=>{const n=typeof u==='string'?u:(u.name||u.user_name||'');return <div className="blocked-item" key={n+i}><span>🚫 {n}</span><button disabled={adminBusy} onClick={()=>unblockUser(n)}>Bỏ block</button></div>})}</div>}</div><div className="admin-info">Quyền admin: tạo/xóa kênh, block/bỏ block người dùng và xóa tin nhắn.</div><small>Admin: Miles</small></div>}</div></div>}
  </main>
}
