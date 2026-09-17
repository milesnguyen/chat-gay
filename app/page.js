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
  const [file, setFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState('default')
  const unreadRef = useRef(0)
  const channelRef = useRef(null)
  const bottomRef = useRef(null)
  const input = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem(USER_KEY)
    if (saved) { setName(saved); setJoined(true) }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission)
    }
  }, [])

  async function enableNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Trình duyệt này không hỗ trợ thông báo.')
      return
    }
    try {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
    } catch {}
  }

  function playNotificationSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12)
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.2)
      setTimeout(() => ctx.close(), 300)
    } catch {}
  }

  function notifyNewMessage(message) {
    if (!message || message.name === name) return

    unreadRef.current += 1
    document.title = `(${unreadRef.current}) 💗 Pink Chat`
    playNotificationSound()

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const body = message.image_url
        ? `${message.name}: ${message.message || '📷 Đã gửi một hình ảnh'}`
        : `${message.name}: ${message.message || ''}`
      const notification = new Notification('💗 Tin nhắn mới - Pink Chat', {
        body: body.slice(0, 120),
        icon: '/favicon.ico',
        tag: 'pink-chat-message'
      })
      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    }
  }

  useEffect(() => {
    const resetUnread = () => {
      unreadRef.current = 0
      document.title = '💗 Pink Chat'
    }
    window.addEventListener('focus', resetUnread)
    return () => window.removeEventListener('focus', resetUnread)
  }, [])

  useEffect(() => {
    if (!joined || !name.trim()) return
    let active = true

    async function loadMessages() {
      const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(200)
      if (!error && active) setMessages(data || [])
    }
    loadMessages()

    const channel = supabase.channel('pink-chat-room', {
      config: { presence: { key: crypto.randomUUID() } }
    })
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const people = Object.values(state).flat().map(x => x.name).filter(Boolean)
        setOnline([...new Set(people)])
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
        notifyNewMessage(payload.new)
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name: name.trim(), online_at: new Date().toISOString() })
        }
      })

    return () => {
      active = false
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [joined, name])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function join(e) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    localStorage.setItem(USER_KEY, n)
    setName(n)
    setJoined(true)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      enableNotifications()
    }
  }

  async function send() {
    if (sending || (!text.trim() && !file)) return
    setSending(true)
    try {
      let image_url = null
      if (file) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('images').upload(path, file, { contentType: file.type, upsert: false })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('images').getPublicUrl(path)
        image_url = data.publicUrl
      }

      const { error } = await supabase.from('messages').insert({
        name: name.trim(),
        message: text.trim() || null,
        image_url
      })
      if (error) throw error
      setText('')
      setFile(null)
      if (input.current) input.current.value = ''
    } catch (err) {
      alert('Gửi tin nhắn thất bại: ' + err.message)
    } finally { setSending(false) }
  }

  function chooseImage(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) return alert('Chỉ chọn file ảnh.')
    if (f.size > 5 * 1024 * 1024) return alert('Ảnh tối đa 5MB.')
    setFile(f)
  }

  function logout() {
    localStorage.removeItem(USER_KEY)
    setJoined(false)
    setName('')
    setMessages([])
    unreadRef.current = 0
    document.title = '💗 Pink Chat'
    if (channelRef.current) supabase.removeChannel(channelRef.current)
  }

  if (!joined) return <main className="login"><div className="card"><div className="logo">💗</div><h1>Pink Chat</h1><p>Nhập tên để tham gia phòng chat</p><form onSubmit={join}><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Tên của bạn" maxLength={30}/><button>Vào chat</button></form></div></main>

  return <main className="app">
    <header><div><h1>💗 Pink Chat</h1><span>Phòng chat chung • Realtime</span></div><div className="header-actions">{notificationPermission !== 'granted' && <button className="notify" onClick={enableNotifications}>🔔 Bật thông báo</button>}<button className="logout" onClick={logout}>Đổi tên</button></div></header>
    <section className="layout">
      <aside><h3>🟢 Người online <em>{online.length}</em></h3>{online.map((u,i)=><div className="user" key={u+i}><i/>{u}{u===name?' (Bạn)':''}</div>)}{online.length===0&&<small>Đang kết nối...</small>}<div className="note">Tin nhắn được đồng bộ cho mọi người đang trong phòng.</div></aside>
      <div className="chat"><div className="messages">{messages.length===0&&<div className="empty">Chưa có tin nhắn. Hãy bắt đầu 💬</div>}{messages.map(m=><div className={'msg '+(m.name===name?'mine':'')} key={m.id}><div className="bubble"><b>{m.name}</b>{m.message&&<div className="msgtext">{m.message}</div>}{m.image_url&&<img src={m.image_url} alt="Ảnh"/>}<small>{new Date(m.created_at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</small></div></div>)}<div ref={bottomRef}/></div>
        <div className="composer">{file&&<div className="preview">📷 {file.name}<button onClick={()=>{setFile(null);if(input.current)input.current.value=''}}>×</button></div>}<div className="row"><label className="attach">📷<input ref={input} type="file" accept="image/*" onChange={chooseImage}/></label><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),send())} placeholder="Nhập tin nhắn..."/><button disabled={sending} onClick={send}>{sending?'...':'Gửi'}</button></div></div>
      </div>
    </section>
  </main>
}
