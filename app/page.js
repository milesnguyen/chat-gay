'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cemjicquygwqfptpowhq.supabase.co'
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_oM2aO9hLAIhTSSbta4QqEQ_UaiNfIQv'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const USER_KEY = 'pink-chat-user-v2'

function avatarFor(userName) {
  const seed = encodeURIComponent(String(userName || 'user').trim().toLowerCase())
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}`
}

export default function Home() {
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)
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
  const [remoteStream, setRemoteStream] = useState(null)
  const [liveMuted, setLiveMuted] = useState(false)
  const [liveCameraOff, setLiveCameraOff] = useState(false)
  const liveSignalRef = useRef(null)
  const liveClientIdRef = useRef(null)
  const liveStreamRef = useRef(null)
  const livePeersRef = useRef(new Map())
  const liveViewerPeerRef = useRef(null)
  const liveHostRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
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

  function getLiveClientId() {
    if (!liveClientIdRef.current) {
      liveClientIdRef.current = `${name.trim().toLowerCase()}-${crypto.randomUUID()}`
    }
    return liveClientIdRef.current
  }

  function stopLiveStream() {
    liveStreamRef.current?.getTracks().forEach(t => t.stop())
    liveStreamRef.current = null
    if (localVideoRef.current) localVideoRef.current.srcObject = null
  }

  function closeLivePeers() {
    livePeersRef.current.forEach(pc => pc.close())
    livePeersRef.current.clear()
    liveViewerPeerRef.current?.close()
    liveViewerPeerRef.current = null
    setRemoteStream(null)
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
  }

  useEffect(() => {
    const saved = localStorage.getItem(USER_KEY)
    if (saved) { setName(saved); setJoined(true) }
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

  // WebRTC P2P live: Supabase Broadcast chỉ làm signaling, video đi trực tiếp giữa các máy.
  useEffect(() => {
    if (!joined || !name.trim() || !channelId) return
    const clientId = getLiveClientId()
    const signal = supabase.channel(`pink-chat-live-${channelId}`, { config: { broadcast: { self: false } } })
    liveSignalRef.current = signal
    let alive = true

    const sendSignal = payload => signal.send({ type: 'broadcast', event: 'live-signal', payload }).catch(() => {})

    const makeHostPeer = async viewerId => {
      const stream = liveStreamRef.current
      if (!stream) return
      const old = livePeersRef.current.get(viewerId)
      old?.close()
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
      livePeersRef.current.set(viewerId, pc)
      stream.getTracks().forEach(track => pc.addTrack(track, stream))
      pc.onicecandidate = e => e.candidate && sendSignal({ type:'ice', from:clientId, to:viewerId, candidate:e.candidate })
      pc.onconnectionstatechange = () => {
        if (['failed','closed','disconnected'].includes(pc.connectionState)) {
          pc.close(); livePeersRef.current.delete(viewerId); setLiveViewers(livePeersRef.current.size)
        }
      }
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await sendSignal({ type:'offer', from:clientId, to:viewerId, offer:pc.localDescription })
      setLiveViewers(livePeersRef.current.size)
    }

    const handleSignal = async ({ payload }) => {
      if (!alive || !payload || payload.to && payload.to !== clientId) return
      try {
        if (payload.type === 'live-start') {
          setLive({ hostId: payload.from, hostName: payload.hostName, startedAt: payload.startedAt })
          setLiveError('')
          if (payload.from !== clientId && !isHostingLive) {
            await sendSignal({ type:'viewer-join', from:clientId, to:payload.from })
          }
          return
        }
        if (payload.type === 'live-end') {
          setLive(null); setIsHostingLive(false); setLiveViewers(0); closeLivePeers(); stopLiveStream();
          return
        }
        if (payload.type === 'viewer-join' && isHostingLive && payload.to === clientId) {
          await makeHostPeer(payload.from)
          return
        }
        if (payload.type === 'offer' && payload.to === clientId && !isHostingLive) {
          liveHostRef.current = payload.from
          const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
          liveViewerPeerRef.current = pc
          pc.onicecandidate = e => e.candidate && sendSignal({ type:'ice', from:clientId, to:payload.from, candidate:e.candidate })
          pc.ontrack = e => { const stream = e.streams[0]; setRemoteStream(stream); if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream }
          pc.onconnectionstatechange = () => {
            if (['failed','closed','disconnected'].includes(pc.connectionState)) { setRemoteStream(null); setLiveError('Kết nối livestream bị gián đoạn.') }
          }
          await pc.setRemoteDescription(payload.offer)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          await sendSignal({ type:'answer', from:clientId, to:payload.from, answer:pc.localDescription })
          return
        }
        if (payload.type === 'answer' && payload.to === clientId && isHostingLive) {
          const pc = livePeersRef.current.get(payload.from)
          if (pc) await pc.setRemoteDescription(payload.answer)
          return
        }
        if (payload.type === 'ice' && payload.to === clientId && payload.candidate) {
          const pc = isHostingLive ? livePeersRef.current.get(payload.from) : liveViewerPeerRef.current
          if (pc) await pc.addIceCandidate(payload.candidate)
        }
      } catch (err) {
        console.error('WebRTC signaling error', err)
        setLiveError('Không thể kết nối livestream. Hãy thử vào lại live.')
      }
    }

    signal.on('broadcast', { event: 'live-signal' }, handleSignal).subscribe(async status => {
      if (status !== 'SUBSCRIBED') return
      // Host vừa đổi kênh/reload vẫn có thể công bố trạng thái live.
      if (isHostingLive && liveStreamRef.current) {
        await sendSignal({ type:'live-start', from:clientId, hostName:name.trim(), startedAt:live?.startedAt || new Date().toISOString() })
      }
    })

    return () => {
      alive = false
      if (liveSignalRef.current === signal) liveSignalRef.current = null
      supabase.removeChannel(signal)
      if (!isHostingLive) { liveViewerPeerRef.current?.close(); liveViewerPeerRef.current = null; setRemoteStream(null) }
    }
  }, [joined, name, channelId, isHostingLive])

  async function startLive() {
    if (!channelId || isHostingLive) return
    setLiveError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Trình duyệt không hỗ trợ Camera/Microphone.')
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      liveStreamRef.current = stream
      if (localVideoRef.current) localVideoRef.current.srcObject = stream
      const startedAt = new Date().toISOString()
      const info = { hostId:getLiveClientId(), hostName:name.trim(), startedAt }
      setLive(info); setIsHostingLive(true); setLiveViewers(0)
      setTimeout(() => liveSignalRef.current?.send({ type:'broadcast', event:'live-signal', payload:{ type:'live-start', from:getLiveClientId(), hostName:name.trim(), startedAt } }), 100)
    } catch (err) { setLiveError(err.message || 'Không thể mở camera/microphone.') }
  }

  async function stopLive() {
    if (!isHostingLive) return
    await liveSignalRef.current?.send({ type:'broadcast', event:'live-signal', payload:{ type:'live-end', from:getLiveClientId(), to:null } })
    closeLivePeers(); stopLiveStream(); setIsHostingLive(false); setLive(null); setLiveViewers(0)
  }

  function toggleLiveMute() {
    const next = !liveMuted
    liveStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next })
    setLiveMuted(next)
  }

  function toggleLiveCamera() {
    const next = !liveCameraOff
    liveStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !next })
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

  function join(e) {
    e.preventDefault(); const n = name.trim(); if (!n) return
    localStorage.setItem(USER_KEY, n); setName(n); setJoined(true); setConnectionStatus('connecting')
    if (Notification.permission === 'default') enableNotifications()
  }

  async function sendSticker(sticker) {
    if (sending || !channelId || !sticker) return
    setSending(true)
    try {
      const { error } = await supabase.from('messages').insert({
        name: name.trim(), message: null, image_url: null, sticker_url: sticker.url, message_type: 'sticker', channel_id: channelId, reply_to: replyTo?.id || null
      })
      if (error) throw error
      setReplyTo(null); setShowStickers(false); setShowEmoji(false)
    } catch (err) { alert(err.message || 'Gửi sticker thất bại.') }
    finally { setSending(false) }
  }

  async function send() {
    if (sending || (!text.trim() && !file) || !channelId) return
    setSending(true)
    setSendError('')
    try {
      let image_url = null
      if (file) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('images').upload(path, file, { contentType: file.type, upsert: false })
        if (uploadError) throw uploadError
        image_url = supabase.storage.from('images').getPublicUrl(path).data.publicUrl
      }
      const { error } = await supabase.from('messages').insert({ name: name.trim(), message: text.trim() || null, image_url, channel_id: channelId, reply_to: replyTo?.id || null })
      if (error) {
        if (String(error.message || '').includes('USER_BLOCKED')) {
          throw new Error('Bạn đã bị block và không thể gửi tin nhắn.')
        }
        throw error
      }
      setText(''); setFile(null); setReplyTo(null); setShowEmoji(false); if (fileInput.current) fileInput.current.value = ''
    } catch (err) { setSendError(err.message || 'Gửi tin nhắn thất bại.') }
    finally { setSending(false) }
  }

  async function retrySend() {
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
      await supabase.from('message_reactions').delete().eq('id', existing.id)
      setReactions(prev => ({ ...prev, [messageId]: (prev[messageId] || []).filter(r => r.id !== existing.id) }))
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
    const fileName = `pasted-${Date.now()}.${ext}`
    const imageFile = new File([pastedFile], fileName, { type: pastedFile.type })
    setFile(imageFile)
  }

  function chooseImage(e) {
    const f = e.target.files?.[0]; if (!f) return
    if (!f.type.startsWith('image/')) return alert('Chỉ chọn file ảnh.')
    if (f.size > 5 * 1024 * 1024) return alert('Ảnh tối đa 5MB.')
    setFile(f)
  }

  function logout() {
    localStorage.removeItem(USER_KEY); setJoined(false); setName(''); setMessages([]); setUnreadByChannel({}); localStorage.removeItem('pink-chat-unread-v1'); unreadRef.current = 0; document.title = '💗 Pink Chat'
    if (channelRef.current) supabase.removeChannel(channelRef.current)
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

  if (!joined) return <main className="login"><div className="card"><div className="logo">💗</div><h1>Pink Chat</h1><p>Nhập tên để tham gia phòng chat</p><form onSubmit={join}><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Tên của bạn" maxLength={30}/><button>Vào chat</button></form></div></main>

  const currentChannel = channels.find(c => c.id === channelId)
  return <main className="app">
    <header><div><h1>💗 Pink Chat</h1><span>{currentChannel?.name || 'Phòng chat'} • <i className={`connection-dot ${connectionStatus}`}></i>{connectionStatus==='connected'?'Đã kết nối':connectionStatus==='connecting'?'Đang kết nối...':'Mất kết nối'}</span></div><div className="header-actions"><button className="admin-btn" onClick={()=>setAdminOpen(true)}>⚙ Admin</button>{notificationPermission !== 'granted' && <button className="notify" onClick={enableNotifications}>🔔 Bật thông báo</button>}<button className="logout" onClick={logout}>Đổi tên</button></div></header>
    <section className="layout">
      <aside><h3>💬 Kênh chat</h3><div className="channels">{channels.map(c=><div className="channel-row" key={c.id}><button className={c.id===channelId?'channel active':'channel'} onClick={()=>setChannelId(c.id)}># {c.name}{unreadByChannel[String(c.id)] ? <em className="unread-badge">{unreadByChannel[String(c.id)] > 99 ? '99+' : unreadByChannel[String(c.id)]}</em> : null}</button>{adminLogged && c.name!=='Chung' && <button className="channel-delete" title="Xóa kênh" onClick={()=>deleteChannel(c)}>×</button>}</div>)}</div><h3 className="online-title">🟢 Người online <em>{online.length}</em></h3>{online.map((u,i)=><div className="user" key={u+i}><span className="user-name"><img className="avatar avatar-sm" src={avatarFor(u)} alt=""/><i/>{u}{u===name?' (Bạn)':''}</span>{adminLogged && u!==name && <button className="block-user-btn" title={`Block ${u}`} onClick={()=>blockUser(u)}>🚫 Block</button>}</div>)}{online.length===0&&<small>Đang kết nối...</small>}<div className="note">Tin nhắn được đồng bộ cho mọi người đang trong phòng.</div></aside>
      <div className="chat">{(live || isHostingLive) && <div className="live-panel"><div className="live-panel-head"><div><b>🔴 LIVE</b><span>{isHostingLive ? `Bạn đang livestream • ${liveViewers} người xem` : `${live?.hostName || "Đang livestream"} đang phát`}</span></div><div className="live-actions">{isHostingLive ? <><button onClick={toggleLiveMute}>{liveMuted ? "🔇 Bật mic" : "🎤 Tắt mic"}</button><button onClick={toggleLiveCamera}>{liveCameraOff ? "📷 Bật cam" : "🚫 Tắt cam"}</button><button className="live-stop" onClick={stopLive}>⏹ Kết thúc</button></> : <span className="live-viewers">👁️ Đang xem</span>}</div></div><div className="live-video-wrap">{isHostingLive ? <video ref={localVideoRef} autoPlay muted playsInline className="live-video"/> : remoteStream ? <video ref={remoteVideoRef} autoPlay playsInline className="live-video"/> : <div className="live-wait">Đang kết nối tới livestream...</div>}{liveError&&<div className="live-error">⚠️ {liveError}</div>}</div></div>}{!live && !isHostingLive && <button className="start-live-btn" onClick={startLive}>🔴 Livestream</button>}<div className="messages" ref={messagesBoxRef} onScroll={handleMessagesScroll}>{newMessageCount>0&&<button className="new-message-pill" onClick={jumpToLatest}>↓ {newMessageCount} tin nhắn mới</button>}{messages.length===0&&<div className="empty">Chưa có tin nhắn. Hãy bắt đầu 💬</div>}{messages.map(m=>{
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
            {Object.entries(counts).length>0&&<div>{Object.entries(counts).map(([emoji,count])=><button className={'reaction '+(rx.some(r=>r.name===name&&r.emoji===emoji)?'active':'')} key={emoji} onClick={()=>toggleReaction(m.id,emoji)}>{emoji} {count}</button>)}</div>}
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
