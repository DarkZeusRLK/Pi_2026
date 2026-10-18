import { useRef, useState } from 'react'
import { Camera, CircleAlert, RotateCcw, Trash2, X } from 'lucide-react'
import { api } from '../api'
import { useStore } from '../store'
import { enviarArquivo } from '../upload'
import Avatar from './Avatar'
import Recortador from './Recortador'
import { Confirmar } from './ui'

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp']

// Foto de perfil: escolher → enquadrar → enviar ao Vercel Blob → salvar no perfil. Também remove a foto (com confirmação).
export default function FotoPerfil({ aoSalvar, rotuloAdicionar = 'Adicionar foto', tamanho = 96 }) {
  const { user, setUser, toast, config } = useStore()
  const inputRef = useRef(null)
  const [arquivo, setArquivo] = useState(null)   // arquivo escolhido, aguardando o enquadramento
  const [pendente, setPendente] = useState(null) // foto já recortada (fica guardada para "Tentar de novo")
  const [progresso, setProgresso] = useState(null)
  const [erro, setErro] = useState('')
  const [removendo, setRemovendo] = useState(false)
  const [confirmarRemocao, setConfirmarRemocao] = useState(false)
  const cancelar = useRef(null)
  const enviando = progresso !== null
  const indisponivel = config.carregada && !config.upload

  function escolher(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!TIPOS_ACEITOS.includes(f.type)) return setErro('Use uma foto JPG, PNG ou WEBP.')
    setErro('')
    setArquivo(f)
  }

  async function enviar(blob) {
    setPendente(blob)
    setErro('')
    setProgresso(0)
    const ctl = new AbortController()
    cancelar.current = ctl
    let terminou = false // o SDK pode avisar o progresso depois do fim; sem isso a barra ficaria presa
    try {
      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
      const r = await enviarArquivo(`avatares/${user.id}/foto.${ext}`, blob, {
        carga: { tipo: 'avatar' }, contentType: blob.type, onProgresso: (pct) => { if (!terminou) setProgresso(pct) }, sinal: ctl.signal,
      })
      const { usuario } = await api('/auth/perfil', { method: 'PATCH', body: { avatarUrl: r.url } })
      setUser(usuario)
      setPendente(null)
      toast('Foto de perfil atualizada.')
      aoSalvar?.(usuario)
    } catch (e) {
      if (e.name === 'AbortError') setPendente(null)
      else setErro(e.message)
    } finally {
      terminou = true
      setProgresso(null)
      cancelar.current = null
    }
  }

  async function remover() {
    setRemovendo(true)
    try {
      const { usuario } = await api('/auth/perfil', { method: 'PATCH', body: { avatarUrl: null } })
      setUser(usuario)
      toast('Foto removida.')
    } catch (e) { setErro(e.message) } finally { setRemovendo(false) }
  }

  return (
    <div className="foto-perfil">
      <Avatar usuario={user} tamanho={tamanho} />
      <div className="foto-perfil-acoes">
        <div className="row-btns">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => inputRef.current.click()} disabled={enviando || removendo || indisponivel}>
            <Camera size={16} aria-hidden="true" /> {user.avatarUrl ? 'Trocar foto' : rotuloAdicionar}
          </button>
          {user.avatarUrl && (
            <button type="button" className="btn btn-ghost-danger btn-sm" onClick={() => setConfirmarRemocao(true)} disabled={enviando || removendo}>
              <Trash2 size={16} aria-hidden="true" /> Remover foto
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={escolher} />

        {indisponivel && <p className="field-hint">O envio de fotos está desativado no momento (armazenamento não configurado). Você pode continuar sem foto.</p>}
        {enviando && (
          <div className="progresso" role="status">
            <div className="progresso-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progresso} aria-label="Enviando foto">
              <span style={{ transform: `scaleX(${progresso / 100})` }} />
            </div>
            <span className="small muted">Enviando... {progresso}%</span>
            <button type="button" className="link small" onClick={() => cancelar.current?.abort()}><X size={12} aria-hidden="true" /> Cancelar</button>
          </div>
        )}
        {erro && !enviando && (
          <p className="field-error" role="alert">
            <CircleAlert size={14} aria-hidden="true" /> {erro}
            {pendente && <button type="button" className="link small" onClick={() => enviar(pendente)}><RotateCcw size={12} aria-hidden="true" /> Tentar de novo</button>}
          </p>
        )}
        <p className="field-hint">JPG, PNG ou WEBP. A foto ajuda outras pessoas a confiar em você.</p>
      </div>

      {arquivo && (
        <Recortador arquivo={arquivo}
          onCancelar={() => setArquivo(null)}
          onErro={(m) => { setArquivo(null); setErro(m) }}
          onConfirmar={(blob) => { setArquivo(null); enviar(blob) }} />
      )}
      <Confirmar aberto={confirmarRemocao} onClose={() => setConfirmarRemocao(false)} onConfirm={remover} perigo confirmar="Remover foto"
        titulo="Remover a foto de perfil?" texto="Suas iniciais aparecerão no lugar. Você pode adicionar outra foto quando quiser." />
    </div>
  )
}
