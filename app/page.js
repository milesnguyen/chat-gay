'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cemjicquygwqfptpowhq.supabase.co'
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_oM2aO9hLAIhTSSbta4QqEQ_UaiNfIQv'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const USER_KEY = 'pink-chat-user-v2'

export default function Home() {
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)
  const [text, setText] = useState('')
  const [messages, setMessages] = useState([])
  const [online, setOnline] = useState([])
  const [channels, setChannels] = useState([])
  const [channelId, setChannelId] = useState('')
  const [file, setFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [typingUsers, setTypingUsers] = useState([])
  const [replyTo, setReplyTo] = useState(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [reactions, setReactions] = useState({})
  const [notificationPermission, setNotificationPermission] = useState('default')
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminLogged, setAdminLogged] = useState(false)
  const [adminPass, setAdminPass] = useState('')
  const [newChannel, setNewChannel] = useState('')
  const [blockName, setBlockName] = useState('')
  const [adminBusy, setAdminBusy] = useState(false)
  const [adminPasswordSession, setAdminPasswordSession] = useState('')
  const unreadRef = useRef(0)
  const channelRef = useRef(null)
  const bottomRef = useRef(null)
  const input = useRef(null)
  const typingTimer = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem(USER_KEY)
    if (saved) { setName(saved); setJoined(true) }
    if ('Notification' in window) setNotificationPermission(Notification.permission)
    loadChannels()
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

  useEffect(() => {
    if (!joined || !name.trim() || !channelId) return
    let active = true
    async function loadMessages() {
      const { data, error } = await supabase.from('messages').select('*').eq('channel_id', channelId).order('created_at', { ascending: true }).limit(200)
      if (!error && active) setMessages(data || [])
      const ids = (data || []).map(m => m.id)
      if (ids.length) {
        const { data: rx } = await supabase.from('message_reactions').select('*').in('message_id', ids)
        const grouped = {}
        ;(rx || []).forEach(r => { grouped[r.message_id] = [...(grouped[r.message_id] || []), r] })
        if (active) setReactions(grouped)
      } else if (active) setReactions({})
    }
    loadMessages()

    const realtime = supabase.channel(`pink-chat-${channelId}`, { config: { presence: { key: crypto.randomUUID() }, broadcast: { self: false } } })
    channelRef.current = realtime
    realtime
      .on('presence', { event: 'sync' }, () => {
        const state = realtime.presenceState()
        const all = Object.values(state).flat()
        setOnline([...new Set(all.map(x => x.name).filter(Boolean))])
        setTypingUsers([...new Set(all.filter(x => x.typing && x.name !== name).map(x => x.name))])
      })
      .on('presence', { event: 'join' }, () => {})
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.name === name) return
        setTypingUsers(prev => payload?.typing ? [...new Set([...prev, payload.name])] : prev.filter(x => x !== payload.name))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` }, payload => {
        setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
        notifyNewMessage(payload.new)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, payload => {
        setReactions(prev => ({ ...prev, [payload.new.message_id]: [...(prev[payload.new.message_id] || []).filter(r => !(r.name === payload.new.name && r.emoji === payload.new.emoji)), payload.new] }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, payload => {
        setReactions(prev => ({ ...prev, [payload.old.message_id]: (prev[payload.old.message_id] || []).filter(r => r.id !== payload.old.id) }))
      })
      .subscribe(async status => { if (status === 'SUBSCRIBED') await realtime.track({ name: name.trim(), online_at: new Date().toISOString(), typing: false }) })

    return () => { active = false; supabase.removeChannel(realtime); if (channelRef.current === realtime) channelRef.current = null }
  }, [joined, name, channelId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function join(e) {
    e.preventDefault(); const n = name.trim(); if (!n) return
    localStorage.setItem(USER_KEY, n); setName(n); setJoined(true)
    if (Notification.permission === 'default') enableNotifications()
  }

  async function send() {
    if (sending || (!text.trim() && !file) || !channelId) return
    setSending(true)
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
      if (error) throw error
      setText(''); setFile(null); setReplyTo(null); setShowEmoji(false); if (input.current) input.current.value = ''
    } catch (err) { alert('Gửi tin nhắn thất bại: ' + err.message) }
    finally { setSending(false) }
  }

  async function updateTyping(value) {
    setText(value)
    if (!channelRef.current) return
    clearTimeout(typingTimer.current)
    try { await channelRef.current.track({ name: name.trim(), online_at: new Date().toISOString(), typing: true }) } catch {}
    typingTimer.current = setTimeout(async () => {
      try { await channelRef.current.track({ name: name.trim(), online_at: new Date().toISOString(), typing: false }) } catch {}
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

  function chooseImage(e) {
    const f = e.target.files?.[0]; if (!f) return
    if (!f.type.startsWith('image/')) return alert('Chỉ chọn file ảnh.')
    if (f.size > 5 * 1024 * 1024) return alert('Ảnh tối đa 5MB.')
    setFile(f)
  }

  function logout() {
    localStorage.removeItem(USER_KEY); setJoined(false); setName(''); setMessages([]); unreadRef.current = 0; document.title = '💗 Pink Chat'
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

  async function blockUser(targetName = blockName) {
    const n = targetName.trim(); if (!n || !adminLogged) return
    if (!window.confirm(`Block ${n}?`)) return
    setAdminBusy(true)
    const { error } = await supabase.rpc('admin_block_user', { admin_name: 'Miles', admin_password: adminPasswordSession, user_name: n })
    setAdminBusy(false)
    if (error) return alert(error.message)
    setBlockName(''); alert(`Đã block ${n}. Người này sẽ không gửi được tin nhắn nữa.`)
  }

  if (!joined) return <main className="login"><div className="card"><div className="logo">💗</div><h1>Pink Chat</h1><p>Nhập tên để tham gia phòng chat</p><form onSubmit={join}><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Tên của bạn" maxLength={30}/><button>Vào chat</button></form></div></main>

  const currentChannel = channels.find(c => c.id === channelId)
  return <main className="app">
    <header><div><h1>💗 Pink Chat</h1><span>{currentChannel?.name || 'Phòng chat'} • Realtime</span></div><div className="header-actions"><button className="admin-btn" onClick={()=>setAdminOpen(true)}>⚙ Admin</button>{notificationPermission !== 'granted' && <button className="notify" onClick={enableNotifications}>🔔 Bật thông báo</button>}<button className="logout" onClick={logout}>Đổi tên</button></div></header>
    <section className="layout">
      <aside><h3>💬 Kênh chat</h3><div className="channels">{channels.map(c=><button key={c.id} className={c.id===channelId?'channel active':'channel'} onClick={()=>setChannelId(c.id)}># {c.name}</button>)}</div><h3 className="online-title">🟢 Người online <em>{online.length}</em></h3>{online.map((u,i)=><div className="user" key={u+i}><span className="user-name"><i/>{u}{u===name?' (Bạn)':''}</span>{adminLogged && u!==name && <button className="block-user-btn" title={`Block ${u}`} onClick={()=>blockUser(u)}>🚫 Block</button>}</div>)}{online.length===0&&<small>Đang kết nối...</small>}<div className="note">Tin nhắn được đồng bộ cho mọi người đang trong phòng.</div></aside>
      <div className="chat"><div className="messages">{messages.length===0&&<div className="empty">Chưa có tin nhắn. Hãy bắt đầu 💬</div>}{messages.map(m=><div className={'msg '+(m.name===name?'mine':'')} key={m.id}><div className="bubble"><b>{m.name}</b>{m.message&&<div className="msgtext">{m.message}</div>}{m.image_url&&<img src={m.image_url} alt="Ảnh"/>}<small>{new Date(m.created_at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</small></div></div>)}<div ref={bottomRef}/></div>
        <div className="composer">{file&&<div className="preview">📷 {file.name}<button onClick={()=>{setFile(null);if(input.current)input.current.value=''}}>×</button></div>}<div className="row"><label className="attach">📷<input ref={input} type="file" accept="image/*" onChange={chooseImage}/></label><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),send())} placeholder={`Nhắn trong #${currentChannel?.name || 'Chung'}...`}/><button disabled={sending} onClick={send}>{sending?'...':'Gửi'}</button></div></div>
      </div>
    </section>

    {adminOpen && <div className="modal-backdrop" onClick={()=>setAdminOpen(false)}><div className="admin-modal" onClick={e=>e.stopPropagation()}><div className="admin-head"><h2>⚙ Quản lý Admin</h2><button onClick={()=>setAdminOpen(false)}>×</button></div>{!adminLogged ? <form onSubmit={adminLogin}><p>Đăng nhập bằng tài khoản admin.</p><input value="Miles" readOnly/><input type="password" value={adminPass} onChange={e=>setAdminPass(e.target.value)} placeholder="Mật khẩu" autoFocus/><button disabled={adminBusy}>Đăng nhập</button></form> : <div className="admin-tools"><div><h3>➕ Tạo kênh mới</h3><div className="admin-row"><input value={newChannel} onChange={e=>setNewChannel(e.target.value)} placeholder="Tên kênh" maxLength={40}/><button disabled={adminBusy} onClick={createChannel}>Tạo</button></div></div><div className="admin-info">🚫 Muốn block spam, bấm <b>🚫 Block</b> ngay bên cạnh tên người trong danh sách online.</div><small>Admin: Miles</small></div>}</div></div>}
  </main>
}
