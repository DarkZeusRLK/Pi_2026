import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from './api'

/* Estado global: usuário logado, avisos (toasts) e contador de mensagens não lidas. */

const Ctx = createContext(null)

export function StoreProvider({ children }) {
  const [user, setUser] = useState(null)
  const [carregandoSessao, setCarregandoSessao] = useState(true)
  const [naoLidas, setNaoLidas] = useState(0)
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const toast = useCallback((msg, opts = {}) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t.slice(-2), { id, msg, tipo: opts.tipo || 'ok', acao: opts.acao }])
    timers.current[id] = setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duracao || 4500)
  }, [])
  const fecharToast = useCallback((id) => {
    clearTimeout(timers.current[id])
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])
  const toastErro = useCallback((e) => toast(e.message || String(e), { tipo: 'erro' }), [toast])

  useEffect(() => {
    api('/auth/me').then((d) => setUser(d.usuario)).catch(() => {}).finally(() => setCarregandoSessao(false))
  }, [])

  const atualizarNaoLidas = useCallback(() => {
    if (!user) return setNaoLidas(0)
    api('/notificacoes').then((d) => setNaoLidas(d.naoLidas)).catch(() => {})
  }, [user])

  useEffect(() => {
    atualizarNaoLidas()
    if (!user) return
    const t = setInterval(() => { if (document.visibilityState === 'visible') atualizarNaoLidas() }, 20000)
    return () => clearInterval(t)
  }, [user, atualizarNaoLidas])

  const sair = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
  }, [])

  const value = {
    user, setUser, carregandoSessao, isAdmin: user?.perfil === 'admin', sair,
    naoLidas, atualizarNaoLidas, toast, toastErro, toasts, fecharToast,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)

export function tempoRelativo(data) {
  const ts = new Date(data).getTime()
  const min = Math.round((Date.now() - ts) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  if (d === 1) return 'ontem'
  if (d < 30) return `há ${d} dias`
  return new Date(ts).toLocaleDateString('pt-BR')
}

export function hora(data) {
  return new Date(data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Reduz a foto no navegador antes de enviar (economiza banco e deixa o envio rápido)
export async function comprimirImagem(file, max = 1000, q = 0.72) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const escala = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * escala)
    c.height = Math.round(img.height * escala)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', q)
  } finally {
    URL.revokeObjectURL(url)
  }
}
