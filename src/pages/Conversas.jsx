import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, CheckCheck, MessageCircle, Send } from 'lucide-react'
import { hora, tempoRelativo, useStore } from '../store'
import { api, useApi } from '../api'
import { Badge, Carregando, Contador, ErroCarga, Esqueleto, Thumb, Vazio } from '../components/ui'

function ListaConversas({ ativa, lista }) {
  const { dados, erro, carregando, recarregar } = lista
  if (erro) return <ErroCarga erro={erro} onTentar={recarregar} />
  if (carregando && !dados) return <Esqueleto linhas={3} tipo="lista" />
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
              <Thumb item={{ ...c.item, capa: c.item.capa }} />
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

export function Conversas() {
  const lista = useApi('/conversas', { intervalo: 15000 })
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

export function Chat() {
  const { id } = useParams()
  const nav = useNavigate()
  const { toastErro, atualizarNaoLidas } = useStore()
  const lista = useApi('/conversas', { intervalo: 15000 })
  const { dados: conv, setDados, erro, carregando, recarregar } = useApi(`/conversas/${id}`, { intervalo: 4000 })
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const fimRef = useRef(null)
  const qtd = conv?.mensagens.length

  useEffect(() => { fimRef.current?.scrollIntoView({ block: 'end' }) }, [qtd])
  useEffect(() => { if (conv) atualizarNaoLidas() }, [qtd]) // eslint-disable-line

  async function enviar(e, t = texto) {
    e?.preventDefault()
    if (!t.trim() || enviando) return
    setEnviando(true)
    try {
      const msg = await api(`/conversas/${id}/mensagens`, { method: 'POST', body: { texto: t } })
      setDados((c) => ({ ...c, mensagens: [...c.mensagens, msg] }))
      setTexto('')
      lista.recarregar(true)
    } catch (err) { toastErro(err) } finally { setEnviando(false) }
  }

  let corpo
  if (carregando && !conv) corpo = <Carregando texto="Abrindo conversa..." />
  else if (erro?.status === 404) corpo = <Vazio titulo="Conversa não encontrada"><Link className="btn btn-primary" to="/conversas">Ver conversas</Link></Vazio>
  else if (erro) corpo = <ErroCarga erro={erro} onTentar={recarregar} />
  else {
    const { item, outro } = conv
    corpo = (
      <>
        <header className="chat-head">
          <button className="icon-btn show-mobile" onClick={() => nav('/conversas')} aria-label="Voltar para conversas"><ArrowLeft size={20} /></button>
          {item && <Thumb item={item} />}
          <div className="chat-head-txt">
            {item ? <Link to={`/item/${item.id}`}><b>{item.titulo}</b></Link> : <b>Item removido</b>}
            <small>{outro?.nome}{item && <> · <Badge>{item.status}</Badge></>}</small>
          </div>
        </header>

        <div className="messages" role="log" aria-live="polite" aria-label="Mensagens">
          {conv.mensagens.length === 0 && <p className="hint-center">Comece a conversa. Seja educado(a) e combine a retirada.</p>}
          {conv.mensagens.map((m) => (
            <div key={m.id} className={`msg ${m.minha ? 'msg-me' : ''}`}>
              <p>{m.texto}</p>
              <small>
                {hora(m.em)}
                {m.minha && (m.lida ? <CheckCheck size={14} aria-label="Lida" /> : <Check size={14} aria-label="Enviada" />)}
              </small>
            </div>
          ))}
          <div ref={fimRef} />
        </div>

        {conv.mensagens.length < 2 && (
          <div className="quick">
            {RAPIDAS.map((r) => <button key={r} className="chip" onClick={() => enviar(null, r)} disabled={enviando}>{r}</button>)}
          </div>
        )}
        <form className="composer" onSubmit={enviar}>
          <label htmlFor="msg" className="sr-only">Mensagem</label>
          <input id="msg" placeholder="Escreva aqui..." value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" maxLength={500} aria-describedby="msg-contador" />
          {texto.length >= 400 && <Contador id="msg-contador" valor={texto} max={500} />}
          <button className="btn btn-primary" type="submit" disabled={!texto.trim() || enviando} aria-label="Enviar mensagem">
            <Send size={18} aria-hidden="true" /><span className="hide-mobile">{enviando ? 'Enviando...' : 'Enviar'}</span>
          </button>
        </form>
      </>
    )
  }

  return (
    <div className="page chat-layout">
      <section className="chat-side hide-mobile">
        <h1>Conversas</h1>
        <ListaConversas ativa={id} lista={lista} />
      </section>
      <section className="chat-main chat-open">{corpo}</section>
    </div>
  )
}
