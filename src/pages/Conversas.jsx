import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Link, useNavigate } from '../components/nav'
import {
  ArrowDown, ArrowLeft, Check, CheckCheck, CircleAlert, Clock, Download, File, FileSpreadsheet, FileText, ImagePlus,
  MessageCircle, Mic, Paperclip, RotateCcw, Send, Square, Trash2, X,
} from 'lucide-react'
import { hora, tempoRelativo, useStore } from '../store'
import { api, useApi } from '../api'
import { useAoReconectar, useCanal, useDebounce, usePresenca, useRealtime } from '../realtime'
import { enviarArquivo } from '../upload'
import {
  CATEGORIAS_ANEXO, DURACAO_MAX_AUDIO_SEG, categoriaDoMime, formatarDuracao, formatarTamanho, mimeBase, mimeDoArquivo,
} from '../utils/anexos'
import { comprimirImagem } from '../utils/imagem'
import Avatar from '../components/Avatar'
import AudioPlayer from '../components/AudioPlayer'
import Lightbox from '../components/Lightbox'
import { gravacaoDisponivel, useGravador } from '../components/useGravador'
import { Badge, Carregando, Contador, ErroCarga, Esqueleto, Thumb, Vazio } from '../components/ui'

const EXT_POR_MIME = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'application/pdf': 'pdf', 'application/msword': 'doc', 'text/plain': 'txt', 'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
  'audio/aac': 'aac', 'audio/x-m4a': 'm4a', 'audio/m4a': 'm4a', 'audio/mp3': 'mp3',
}

function ListaConversas({ ativa, lista }) {
  const { dados, erro, carregando, recarregar } = lista
  if (erro) return <ErroCarga erro={erro} onTentar={recarregar} />
  if (carregando && !dados) return <Esqueleto linhas={3} tipo="lista" />
  if (!dados) return null
  if (!dados.length) {
    return (
      <Vazio icone={MessageCircle} titulo="Nenhuma conversa ainda" texto="Abra um item do mural e toque em “Conversar no chat”.">
        <Link to="/" className="btn btn-primary">Ver o mural</Link>
      </Vazio>
    )
  }
  return (
    <ul className="conv-list">
      {dados.map((c) => {
        const nl = ativa === c.id ? 0 : c.naoLidas
        return (
          <li key={c.id}>
            <Link to={`/conversas/${c.id}`} className={`conv ${ativa === c.id ? 'is-on' : ''} ${nl ? 'is-unread' : ''}`}>
              <span className="conv-avatar">
                <Thumb item={{ ...c.item, capa: c.item.capa }} />
                <Avatar usuario={c.outro} tamanho={28} className="conv-avatar-outro" />
              </span>
              <div className="conv-body">
                <div className="conv-top">
                  <b>{c.item.titulo}</b>
                  {c.ultima && <small>{tempoRelativo(c.ultima.em)}</small>}
                </div>
                <p className="conv-who">{c.outro.nome}</p>
                <p className="conv-last">{c.ultima ? `${c.ultima.minha ? 'Você: ' : ''}${c.ultima.texto}` : 'Nenhuma mensagem ainda'}</p>
              </div>
              {nl > 0 && <span className="dot-count" aria-label={`${nl} não lidas`}>{nl}</span>}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

// A lista se atualiza sozinha: ao vivo quando o tempo real está ligado, por polling quando não está
function useListaConversas() {
  const { user, tempoRealOk } = useStore()
  const lista = useApi('/conversas', { intervalo: tempoRealOk ? null : 15000 })
  const atualizar = useDebounce(() => lista.recarregar(true), 300)
  useCanal(user ? `usuario:${user.id}` : null, (evento) => { if (evento === 'nao-lidas') atualizar() })
  useAoReconectar(() => lista.recarregar(true))
  return lista
}

export function Conversas() {
  const lista = useListaConversas()
  return (
    <div className="page chat-layout">
      <section className="chat-side">
        <h1>Conversas</h1>
        <ListaConversas lista={lista} />
      </section>
      <section className="chat-main hide-mobile">
        <Vazio icone={MessageCircle} titulo="Selecione uma conversa" texto="Suas mensagens sobre os itens aparecem aqui." />
      </section>
    </div>
  )
}

const RAPIDAS = ['Ainda está disponível?', 'Posso retirar amanhã?', 'Obrigado(a)!']

// "Hoje", "Ontem" ou 12/10 (com o ano se for de outro ano)
function rotuloData(iso) {
  const d = new Date(iso)
  const hoje = new Date()
  const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((dia(hoje) - dia(d)) / 86400000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  const base = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return d.getFullYear() === hoje.getFullYear() ? base : `${base}/${d.getFullYear()}`
}

function duracaoDoArquivoAudio(arquivo) {
  return new Promise((ok) => {
    const url = URL.createObjectURL(arquivo)
    const a = new Audio()
    const fim = (v) => { URL.revokeObjectURL(url); ok(v) }
    const t = setTimeout(() => fim(null), 3000)
    a.preload = 'metadata'
    a.onloadedmetadata = () => { clearTimeout(t); fim(Number.isFinite(a.duration) ? Math.round(a.duration) : null) }
    a.onerror = () => { clearTimeout(t); fim(null) }
    a.src = url
  })
}

// Nome seguro para o caminho no Blob (o nome original do arquivo fica só no banco, mostrado como texto)
const slug = (nome) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'arquivo'

function IconeArquivo({ mime }) {
  const m = mimeBase(mime)
  if (m.includes('spreadsheet') || m === 'application/vnd.ms-excel') return <FileSpreadsheet size={26} aria-hidden="true" />
  if (m === 'application/pdf' || m.includes('word') || m === 'application/msword' || m === 'text/plain') return <FileText size={26} aria-hidden="true" />
  return <File size={26} aria-hidden="true" />
}

function EstadoEnvio({ m }) {
  if (!m.minha) return null
  if (m.pendente) return <Clock size={14} aria-label="Enviando" />
  return m.lida ? <CheckCheck size={14} aria-label="Lida" /> : <Check size={14} aria-label="Enviada" />
}

function Mensagem({ m, nomeOutro, novo, aoAmpliar, aoCarregarMidia, aoTentarDeNovo, aoDescartar }) {
  const a = m.anexo
  const enviando = m.pendente && m.status === 'enviando'
  const falhou = m.pendente && m.status === 'falhou'
  const quem = m.minha ? 'você' : nomeOutro
  return (
    <div className={`msg msg-${m.tipo} ${m.minha ? 'msg-me' : ''} ${novo ? 'msg-novo' : ''} ${falhou ? 'msg-falhou' : ''}`}>
      {m.tipo === 'imagem' && a && (
        <button type="button" className="msg-img" onClick={() => aoAmpliar({ src: a.url, alt: `Foto enviada por ${quem}` })}
          aria-label="Ampliar foto" disabled={m.pendente}>
          <img src={a.url} alt={`Foto enviada por ${quem}`} loading="lazy" onLoad={aoCarregarMidia} />
        </button>
      )}
      {m.tipo === 'arquivo' && a && (
        <div className="msg-arquivo">
          <span className="msg-arquivo-icone"><IconeArquivo mime={a.mime} /></span>
          <span className="msg-arquivo-info">
            <b className="msg-arquivo-nome">{a.nome}</b>
            <small>{formatarTamanho(a.tamanho)}</small>
          </span>
          {!m.pendente && (
            <a className="icon-btn msg-baixar" href={`${a.url}?download=1`} download={a.nome} target="_blank" rel="noopener noreferrer" aria-label={`Baixar ${a.nome}`}>
              <Download size={20} aria-hidden="true" />
            </a>
          )}
        </div>
      )}
      {m.tipo === 'audio' && a && <AudioPlayer src={a.url} duracao={a.duracao} rotulo={`áudio de ${quem}`} />}
      {m.texto && <p className="msg-texto">{m.texto}</p>}

      {enviando && m.tipo !== 'texto' && (
        <div className="msg-progresso">
          <div className="progresso-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.progresso || 0} aria-label="Enviando arquivo">
            <span style={{ transform: `scaleX(${(m.progresso || 0) / 100})` }} />
          </div>
          <button type="button" className="link" onClick={() => aoDescartar(m.idLocal)}>Cancelar</button>
        </div>
      )}
      {falhou && (
        <div className="msg-erro" role="alert">
          <CircleAlert size={14} aria-hidden="true" />
          <span>Falhou{m.erro ? ` (${m.erro})` : ''} —</span>
          <button type="button" className="link" onClick={() => aoTentarDeNovo(m.idLocal)}><RotateCcw size={12} aria-hidden="true" /> tentar de novo</button>
          <button type="button" className="icon-btn msg-descartar" onClick={() => aoDescartar(m.idLocal)} aria-label="Descartar mensagem"><X size={14} /></button>
        </div>
      )}
      <small>
        {enviando ? 'Enviando…' : hora(m.em)}
        <EstadoEnvio m={m} />
      </small>
    </div>
  )
}

export function Chat() {
  const { id } = useParams()
  const lista = useListaConversas()
  return <ChatAberto key={id} id={id} lista={lista} />
}

function ChatAberto({ id, lista }) {
  const nav = useNavigate()
  const { user, toast, atualizarNaoLidas, config, tempoRealOk } = useStore()
  const { conectado, publicarCliente } = useRealtime()
  const { dados: conv, setDados, erro, carregando, recarregar } = useApi(`/conversas/${id}`, { intervalo: tempoRealOk ? null : 4000 })
  const [texto, setTexto] = useState('')
  const [pendentes, setPendentes] = useState([])
  const [digitando, setDigitando] = useState(false)
  const [novas, setNovas] = useState(0)
  const [menuAberto, setMenuAberto] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [ampliada, setAmpliada] = useState(null)
  const listaRef = useRef(null)
  const grudado = useRef(true)         // a pessoa está no fim da conversa?
  const anterior = useRef(0)
  const vistos = useRef(new Set())     // ids já mostrados (só o que chega depois ganha animação de entrada)
  const carregouUmaVez = useRef(false)
  const pendRef = useRef([])
  const controladores = useRef({})
  const ultimoDigitando = useRef(0)
  const timerDigitando = useRef(null)
  const fotoRef = useRef(null)
  const docRef = useRef(null)
  const audioRef = useRef(null)
  const dragContador = useRef(0)

  const uploadLigado = config.upload
  const semUpload = config.carregada && !config.upload

  /* ---------- mensagens (servidor + pendentes) ---------- */
  const todas = useMemo(() => {
    if (!conv) return []
    const reais = conv.mensagens.map((m) => ({ ...m, minha: m.autorId === user.id }))
    const locais = pendentes.map((p) => ({
      id: p.idLocal, idLocal: p.idLocal, pendente: true, status: p.status, progresso: p.progresso, erro: p.erro, minha: true,
      tipo: p.tipo, texto: p.tipo === 'texto' ? p.texto : null, em: p.em, lida: false,
      anexo: p.tipo === 'texto' ? null : { url: p.previewUrl, nome: p.nome, mime: p.mime, tamanho: p.tamanho, duracao: p.duracao },
    }))
    return [...reais, ...locais]
  }, [conv, pendentes, user.id])

  const itensLista = useMemo(() => {
    const out = []
    let ultimoDia = null
    for (const m of todas) {
      const dia = new Date(m.em).toDateString()
      if (dia !== ultimoDia) { out.push({ separador: true, key: `d-${dia}`, rotulo: rotuloData(m.em) }); ultimoDia = dia }
      out.push(m)
    }
    return out
  }, [todas])

  const atualizarPend = useCallback((idLocal, patch) => {
    setPendentes((l) => { const n = l.map((p) => (p.idLocal === idLocal ? { ...p, ...patch } : p)); pendRef.current = n; return n })
  }, [])
  const removerPend = useCallback((idLocal) => {
    setPendentes((l) => {
      const alvo = l.find((p) => p.idLocal === idLocal)
      if (alvo?.previewUrl) setTimeout(() => URL.revokeObjectURL(alvo.previewUrl), 1000)
      const n = l.filter((p) => p.idLocal !== idLocal)
      pendRef.current = n
      return n
    })
  }, [])

  // Junta uma mensagem confirmada: tira a pendente e acrescenta a real (se ainda não estiver na lista)
  const receberMensagem = useCallback((msg) => {
    setDados((c) => {
      if (!c || c.mensagens.some((x) => x.id === msg.id)) return c
      return { ...c, mensagens: [...c.mensagens, msg] }
    })
    if (msg.idLocal) { vistos.current.add(msg.id); removerPend(msg.idLocal) }
  }, [setDados, removerPend])

  /* ---------- rolagem ---------- */
  const rolarAoFim = useCallback((suave = false) => {
    const el = listaRef.current
    if (!el) return
    const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top: el.scrollHeight, behavior: suave && !reduzido ? 'smooth' : 'auto' })
  }, [])

  const aoRolar = () => {
    const el = listaRef.current
    grudado.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (grudado.current) setNovas(0)
  }

  useLayoutEffect(() => {
    const n = todas.length
    if (!conv) return
    if (anterior.current === 0 && n > 0) {
      rolarAoFim(false)
    } else if (n > anterior.current) {
      if (grudado.current || todas[n - 1].minha) rolarAoFim(true)
      else { const chegaram = n - anterior.current; setNovas((c) => c + chegaram) }
    }
    anterior.current = n
  }, [todas.length, conv, rolarAoFim]) // eslint-disable-line

  useEffect(() => {
    if (!conv) return undefined
    if (!carregouUmaVez.current) { conv.mensagens.forEach((m) => vistos.current.add(m.id)); carregouUmaVez.current = true; return undefined }
    // depois de renderizar, o que já apareceu deixa de ser "novo"
    const t = setTimeout(() => conv.mensagens.forEach((m) => vistos.current.add(m.id)), 400)
    return () => clearTimeout(t)
  }, [conv])

  useEffect(() => { if (conv) atualizarNaoLidas() }, [conv?.mensagens.length]) // eslint-disable-line

  /* ---------- tempo real ---------- */
  const marcarLidas = useCallback(() => {
    if (document.visibilityState === 'visible') api(`/conversas/${id}/lidas`, { method: 'POST' }).catch(() => {})
  }, [id])

  useCanal(`conversa:${id}`, (evento, dados) => {
    if (evento === 'mensagem') {
      receberMensagem(dados)
      if (dados.autorId !== user.id) { setDigitando(false); marcarLidas() }
      lista.recarregar(true)
    }
    if (evento === 'lidas' && dados.por !== user.id) {
      setDados((c) => (c ? { ...c, mensagens: c.mensagens.map((m) => (m.autorId === user.id ? { ...m, lida: true } : m)) } : c))
    }
  })
  useCanal(`conversa:${id}:digitando`, (evento, dados) => {
    if (evento !== 'digitando' || dados.u === user.id) return
    setDigitando(true)
    clearTimeout(timerDigitando.current)
    timerDigitando.current = setTimeout(() => setDigitando(false), 3500)
  })
  useEffect(() => () => clearTimeout(timerDigitando.current), [])
  useAoReconectar(() => { recarregar(true); lista.recarregar(true) })
  useEffect(() => {
    const h = () => { if (document.visibilityState === 'visible' && conectado) marcarLidas() }
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [conectado, marcarLidas])

  const presentes = usePresenca(conectado ? `conversa:${id}` : null, user.id)
  const outroOnline = conv ? presentes.has(conv.outro.id) : false

  function aoDigitar(valor) {
    setTexto(valor)
    const agora = Date.now()
    if (conectado && valor && agora - ultimoDigitando.current > 2000) { // no máximo 1 aviso a cada 2 s
      ultimoDigitando.current = agora
      publicarCliente(`conversa:${id}:digitando`, 'digitando', { u: user.id })
    }
  }

  /* ---------- envio (otimista) ---------- */
  const executar = useCallback(async (p) => {
    atualizarPend(p.idLocal, { status: 'enviando', progresso: p.anexoEnviado ? 100 : 0, erro: undefined })
    try {
      let anexo = p.anexoEnviado
      if (p.tipo !== 'texto' && !anexo) {
        const ctl = new AbortController()
        controladores.current[p.idLocal] = ctl
        const ext = EXT_POR_MIME[p.mime] || 'bin'
        const base = slug(p.nome.replace(/\.[^.]+$/, ''))
        const r = await enviarArquivo(`anexos/${id}/${base}.${ext}`, p.arquivo, {
          carga: { tipo: 'chat', conversaId: id, categoria: p.tipo }, contentType: p.mime, sinal: ctl.signal,
          onProgresso: (pct) => { if (!p.terminou) atualizarPend(p.idLocal, { progresso: pct }) },
        })
        anexo = { url: r.url, nome: p.nome, mime: p.mime, tamanho: p.tamanho, duracao: p.duracao }
        atualizarPend(p.idLocal, { anexoEnviado: anexo }) // se só a gravação da mensagem falhar, não envia o arquivo de novo
        p.anexoEnviado = anexo
      }
      const msg = await api(`/conversas/${id}/mensagens`, {
        method: 'POST', body: { tipo: p.tipo, texto: p.tipo === 'texto' ? p.texto : undefined, anexo, idLocal: p.idLocal },
      })
      receberMensagem(msg)
      lista.recarregar(true)
    } catch (e) {
      if (e.name === 'AbortError') removerPend(p.idLocal)
      else atualizarPend(p.idLocal, { status: 'falhou', erro: e.message })
    } finally {
      p.terminou = true
      delete controladores.current[p.idLocal]
    }
  }, [id, atualizarPend, removerPend, receberMensagem, lista])

  const novoPendente = (base) => ({ idLocal: crypto.randomUUID(), em: new Date().toISOString(), status: 'enviando', progresso: 0, ...base })
  const adicionar = (p) => {
    setPendentes((l) => { const n = [...l, p]; pendRef.current = n; return n })
    executar(p)
  }

  function enviarTexto(e, t = texto) {
    e?.preventDefault()
    const limpo = t.trim()
    if (!limpo) return
    setTexto('')
    adicionar(novoPendente({ tipo: 'texto', texto: limpo }))
  }

  const tentarDeNovo = (idLocal) => { const p = pendRef.current.find((x) => x.idLocal === idLocal); if (p) executar(p) }
  const descartar = (idLocal) => {
    controladores.current[idLocal]?.abort()
    removerPend(idLocal)
  }

  async function processarArquivos(arquivos) {
    if (!uploadLigado) {
      toast('O envio de fotos, documentos e áudio está desativado no momento.', { tipo: 'erro' })
      return
    }
    for (const arq of arquivos) {
      const mime = mimeDoArquivo(arq)
      const cat = categoriaDoMime(mime)
      if (!cat) {
        toast(`“${arq.name}” não pode ser enviado. Use foto, PDF, Word, Excel, TXT ou áudio.`, { tipo: 'erro' })
        continue
      }
      const limite = cat === 'imagem' ? 25 * 1024 * 1024 : CATEGORIAS_ANEXO[cat].max // foto grande é reduzida antes de enviar
      if (arq.size > limite) {
        toast(`“${arq.name}” é grande demais (máx. ${formatarTamanho(CATEGORIAS_ANEXO[cat].max)}).`, { tipo: 'erro' })
        continue
      }
      try {
        if (cat === 'imagem') {
          const { blob, mime: m } = await comprimirImagem(arq)
          if (blob.size > CATEGORIAS_ANEXO.imagem.max) { toast('A foto ainda ficou grande demais. Tente outra.', { tipo: 'erro' }); continue }
          adicionar(novoPendente({ tipo: 'imagem', arquivo: blob, mime: m, nome: arq.name || 'foto', tamanho: blob.size, previewUrl: URL.createObjectURL(blob) }))
        } else if (cat === 'audio') {
          const duracao = await duracaoDoArquivoAudio(arq)
          adicionar(novoPendente({ tipo: 'audio', arquivo: arq, mime: mimeBase(mime), nome: arq.name || 'audio', tamanho: arq.size, duracao, previewUrl: URL.createObjectURL(arq) }))
        } else {
          adicionar(novoPendente({ tipo: 'arquivo', arquivo: arq, mime: mimeBase(mime), nome: arq.name, tamanho: arq.size }))
        }
      } catch {
        toast(`Não foi possível ler “${arq.name}”.`, { tipo: 'erro' })
      }
    }
  }

  const escolherArquivos = (e) => {
    const arquivos = [...e.target.files]
    e.target.value = ''
    setMenuAberto(false)
    if (arquivos.length) processarArquivos(arquivos)
  }
  // Ctrl+V com imagem copiada
  const aoColar = (e) => {
    const arquivos = [...(e.clipboardData?.files || [])]
    if (arquivos.length) { e.preventDefault(); processarArquivos(arquivos) }
  }
  // Arrastar e soltar
  const temArquivos = (e) => [...(e.dataTransfer?.types || [])].includes('Files')
  const aoEntrarArrasto = (e) => { if (temArquivos(e)) { e.preventDefault(); dragContador.current += 1; setArrastando(true) } }
  const aoSairArrasto = (e) => { if (temArquivos(e)) { dragContador.current = Math.max(0, dragContador.current - 1); if (!dragContador.current) setArrastando(false) } }
  const aoSoltar = (e) => {
    if (!temArquivos(e)) return
    e.preventDefault()
    dragContador.current = 0
    setArrastando(false)
    processarArquivos([...e.dataTransfer.files])
  }

  /* ---------- gravação de áudio ---------- */
  const gravador = useGravador({ onErro: (m) => toast(m, { tipo: 'erro', duracao: 8000 }) })
  function iniciarGravacao() {
    if (!uploadLigado) return toast('O envio de áudio está desativado no momento.', { tipo: 'erro' })
    return gravador.iniciar()
  }
  function enviarGravacao() {
    const r = gravador.consumir()
    if (!r) return
    const ext = EXT_POR_MIME[r.mime] || 'webm'
    adicionar(novoPendente({ tipo: 'audio', arquivo: r.blob, mime: r.mime, nome: `audio.${ext}`, tamanho: r.blob.size, duracao: r.duracao, previewUrl: r.url }))
  }

  useEffect(() => {
    if (!menuAberto) return undefined
    const fechar = (e) => { if (!e.target.closest?.('.anexo-menu-area')) setMenuAberto(false) }
    const esc = (e) => { if (e.key === 'Escape') setMenuAberto(false) }
    document.addEventListener('click', fechar)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('click', fechar); document.removeEventListener('keydown', esc) }
  }, [menuAberto])

  useEffect(() => () => { Object.values(controladores.current).forEach((c) => c.abort()) }, [])

  /* ---------- tela ---------- */
  let corpo
  if (carregando && !conv) corpo = <Carregando texto="Abrindo conversa..." />
  else if (erro?.status === 404) corpo = <Vazio titulo="Conversa não encontrada"><Link className="btn btn-primary" to="/conversas">Ver conversas</Link></Vazio>
  else if (erro && !conv) corpo = <ErroCarga erro={erro} onTentar={recarregar} />
  else if (conv) {
    const { item, outro } = conv
    const gravando = gravador.estado === 'gravando'
    const revisando = gravador.estado === 'revisao'
    corpo = (
      <>
        <header className="chat-head">
          <button className="icon-btn show-mobile" onClick={() => nav('/conversas')} aria-label="Voltar para conversas"><ArrowLeft size={20} /></button>
          <Avatar usuario={outro} tamanho={40} />
          <div className="chat-head-txt">
            {item ? <Link to={`/item/${item.id}`}><b>{item.titulo}</b></Link> : <b>Item removido</b>}
            <small>
              {outro?.nome}
              {digitando ? <span className="chat-status chat-status-digitando" role="status"> · digitando…</span>
                : outroOnline ? <span className="chat-status"> · <span className="online-ponto" aria-hidden="true" />online</span> : null}
              {item && <> · <Badge>{item.status}</Badge></>}
            </small>
          </div>
        </header>

        <div className="messages-wrap">
          <div ref={listaRef} className="messages" role="log" aria-live="polite" aria-label="Mensagens" onScroll={aoRolar}>
            {todas.length === 0 && <p className="hint-center">Comece a conversa. Seja educado(a) e combine a retirada.</p>}
            {itensLista.map((m) => (m.separador
              ? <div key={m.key} className="msg-data" role="separator"><span>{m.rotulo}</span></div>
              : <Mensagem key={m.idLocal || m.id} m={m} nomeOutro={outro?.nome} novo={carregouUmaVez.current && !vistos.current.has(m.id)}
                aoAmpliar={setAmpliada} aoCarregarMidia={() => { if (grudado.current) rolarAoFim(false) }}
                aoTentarDeNovo={tentarDeNovo} aoDescartar={descartar} />))}
          </div>
          {novas > 0 && (
            <button type="button" className="novas-btn" onClick={() => { rolarAoFim(false); grudado.current = true; setNovas(0) }}>
              <ArrowDown size={16} aria-hidden="true" /> novas mensagens{novas > 1 ? ` (${novas})` : ''}
            </button>
          )}
          {arrastando && <div className="solte-aqui" aria-hidden="true"><ImagePlus size={32} /> Solte para enviar</div>}
        </div>

        {semUpload && <p className="chat-aviso" role="note">O envio de fotos, documentos e áudio está desativado no momento (armazenamento não configurado). As mensagens de texto continuam funcionando.</p>}
        {todas.length < 2 && !gravando && !revisando && (
          <div className="quick">
            {RAPIDAS.map((r) => <button key={r} className="chip" onClick={() => enviarTexto(null, r)}>{r}</button>)}
          </div>
        )}

        <span className="sr-only" role="status">{gravando ? 'Gravando áudio' : revisando ? 'Áudio gravado, pronto para ouvir e enviar' : ''}</span>
        {gravando ? (
          <div className="composer composer-gravando">
            <button type="button" className="icon-btn composer-btn" onClick={gravador.cancelar} aria-label="Cancelar gravação"><Trash2 size={20} /></button>
            <div className="grav-info"><span className="grav-ponto" aria-hidden="true" /><b>{formatarDuracao(gravador.segundos)}</b><small>/ {formatarDuracao(DURACAO_MAX_AUDIO_SEG)}</small></div>
            <button type="button" className="btn btn-primary" onClick={gravador.parar}><Square size={16} aria-hidden="true" /> Parar</button>
          </div>
        ) : revisando ? (
          <div className="composer composer-revisao">
            <button type="button" className="icon-btn composer-btn" onClick={gravador.cancelar} aria-label="Descartar áudio"><Trash2 size={20} /></button>
            <AudioPlayer src={gravador.resultado.url} duracao={gravador.resultado.duracao} rotulo="áudio gravado" />
            <button type="button" className="btn btn-primary" onClick={enviarGravacao} aria-label="Enviar áudio"><Send size={18} aria-hidden="true" /><span className="hide-mobile">Enviar</span></button>
          </div>
        ) : (
          <form className="composer" onSubmit={enviarTexto} onPaste={aoColar}>
            <div className="anexo-menu-area">
              <button type="button" className="icon-btn composer-btn" aria-label="Anexar arquivo" aria-haspopup="menu" aria-expanded={menuAberto}
                onClick={() => setMenuAberto(!menuAberto)} disabled={semUpload} title={semUpload ? 'Envio de arquivos desativado' : 'Anexar'}>
                <Paperclip size={20} />
              </button>
              {menuAberto && (
                <div className="anexo-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => fotoRef.current.click()}><ImagePlus size={18} aria-hidden="true" /> Foto</button>
                  <button type="button" role="menuitem" onClick={() => docRef.current.click()}><FileText size={18} aria-hidden="true" /> Documento</button>
                  <button type="button" role="menuitem" onClick={() => audioRef.current.click()}><Mic size={18} aria-hidden="true" /> Arquivo de áudio</button>
                </div>
              )}
              <input ref={fotoRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={escolherArquivos} />
              <input ref={docRef} type="file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf,text/plain" multiple onChange={escolherArquivos} />
              <input ref={audioRef} type="file" accept="audio/*" hidden onChange={escolherArquivos} />
            </div>
            <label htmlFor="msg" className="sr-only">Mensagem</label>
            <input id="msg" placeholder="Escreva aqui..." value={texto} onChange={(e) => aoDigitar(e.target.value)} autoComplete="off" maxLength={500} aria-describedby="msg-contador" />
            {texto.length >= 400 && <Contador id="msg-contador" valor={texto} max={500} />}
            {texto.trim() ? (
              <button className="btn btn-primary" type="submit" aria-label="Enviar mensagem">
                <Send size={18} aria-hidden="true" /><span className="hide-mobile">Enviar</span>
              </button>
            ) : (
              <button className="btn btn-primary" type="button" onClick={iniciarGravacao} aria-label="Gravar áudio" disabled={semUpload || !gravacaoDisponivel()}
                title={!gravacaoDisponivel() ? 'Este navegador não grava áudio' : 'Gravar áudio'}>
                <Mic size={18} aria-hidden="true" />
              </button>
            )}
          </form>
        )}
        {ampliada && <Lightbox src={ampliada.src} alt={ampliada.alt} onClose={() => setAmpliada(null)} />}
      </>
    )
  }

  return (
    <div className="page chat-layout">
      <section className="chat-side hide-mobile">
        <h1>Conversas</h1>
        <ListaConversas ativa={id} lista={lista} />
      </section>
      <section className="chat-main chat-open" onDragEnter={aoEntrarArrasto} onDragOver={(e) => temArquivos(e) && e.preventDefault()}
        onDragLeave={aoSairArrasto} onDrop={aoSoltar}>{corpo}</section>
    </div>
  )
}
