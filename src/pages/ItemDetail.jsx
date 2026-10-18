import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Link, useNavigate } from '../components/nav'
import { ArrowLeft, Heart, MessageCircle, Pencil, Phone, Store, Trash2, Users } from 'lucide-react'
import { tempoRelativo, useStore } from '../store'
import { api, useApi } from '../api'
import { useAoReconectar, useCanal, useDebounce } from '../realtime'
import { PERFIS, STATUS } from '../data/constantes'
import Avatar from '../components/Avatar'
import { Badge, Carregando, Confirmar, ErroCarga, Thumb, Vazio } from '../components/ui'

// Um interessado na lista do dono: quem é, há quanto tempo, e botões para conversar no chat ou no WhatsApp
function CartaoInteressado({ pessoa, titulo, mostrarAcoes, ocupado, bloqueado, aoConversar }) {
  const primeiroNome = pessoa.nome.split(' ')[0]
  const jaTemConversa = !!pessoa.conversaId
  const zap = pessoa.telefone && `https://wa.me/55${pessoa.telefone}?text=${encodeURIComponent(`Olá, ${primeiroNome}! Vi seu interesse em "${titulo}" no ReUse Escolar.`)}`
  return (
    <li className="interessado-card">
      <div className="interessado-info">
        <Avatar usuario={pessoa} tamanho={40} />
        <div className="interessado-txt">
          <b className="interessado-nome">{pessoa.nome}</b>
          <small className="muted">{PERFIS[pessoa.perfil]} · interesse {tempoRelativo(pessoa.data)}</small>
        </div>
      </div>
      {mostrarAcoes && (
        <div className="interessado-acoes">
          <button type="button" className="btn btn-primary interessado-conversar" onClick={aoConversar} disabled={bloqueado}
            aria-label={`${jaTemConversa ? 'Abrir conversa com' : 'Conversar com'} ${pessoa.nome}`}>
            {ocupado ? <><span className="spinner" aria-hidden="true" /> Abrindo...</>
              : <><MessageCircle size={18} aria-hidden="true" /> {jaTemConversa ? 'Abrir conversa' : 'Conversar'}</>}
          </button>
          {zap && (
            <a className="btn btn-outline btn-icone" href={zap} target="_blank" rel="noreferrer"
              aria-label={`Chamar ${pessoa.nome} no WhatsApp`} title={`Chamar ${primeiroNome} no WhatsApp`}>
              <Phone size={18} aria-hidden="true" />
            </a>
          )}
        </div>
      )}
    </li>
  )
}

export default function ItemDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user, toast, toastErro } = useStore()
  const { dados: item, setDados: setItem, erro, carregando, recarregar } = useApi(`/itens/${id}`)
  const [fotoAtiva, setFotoAtiva] = useState(0)
  const [confirmar, setConfirmar] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [verInteressados, setVerInteressados] = useState(false)
  const interessados = useApi(verInteressados ? `/itens/${id}/interessados` : null)
  const [pulsar, setPulsar] = useState(false)
  const [chamando, setChamando] = useState(null) // id da pessoa cuja conversa está sendo aberta

  // mudanças neste item (status, edição, interesse, remoção) aparecem sem F5
  const atualizarAoVivo = useDebounce(() => { recarregar(true); if (verInteressados) interessados.recarregar(true) }, 250)
  useCanal('mural', (evento, dados) => { if (dados.id === id) atualizarAoVivo() })
  useAoReconectar(() => recarregar(true))

  if (carregando && !item) return <Carregando texto="Carregando item..." />
  if (erro?.status === 404) {
    return (
      <div className="page">
        <Vazio titulo="Item não encontrado" texto="Ele pode ter sido removido ou já foi entregue.">
          <Link to="/" className="btn btn-primary">Voltar ao mural</Link>
        </Vazio>
      </div>
    )
  }
  if (erro) return <div className="page"><ErroCarga erro={erro} onTentar={recarregar} /></div>

  const disponivel = item.status === 'Disponível'
  const exigirLogin = () => nav(`/entrar?voltar=${encodeURIComponent(`/item/${id}`)}`)

  async function interesse() {
    if (!user) return exigirLogin()
    setOcupado(true)
    try {
      const novo = await api(`/itens/${id}/interesse`, { method: 'POST' })
      setItem(novo)
      if (novo.euInteressado) setPulsar(true) // o coração "pulsa" ao marcar
      toast(novo.euInteressado ? 'Interesse registrado! Quem publicou verá seu nome.' : 'Interesse removido.', {
        acao: { texto: 'Desfazer', fn: () => api(`/itens/${id}/interesse`, { method: 'POST' }).then(setItem).catch(toastErro) },
      })
    } catch (e) { toastErro(e) } finally { setOcupado(false) }
  }

  // Dono chama um interessado: abre (ou reaproveita) a conversa e vai direto para o chat dela
  async function chamar(pessoa) {
    setChamando(pessoa.id)
    try {
      const { id: conv } = await api('/conversas', { method: 'POST', body: { itemId: id, usuarioId: pessoa.id } })
      nav(`/conversas/${conv}`)
    } catch (e) {
      toastErro(e)
      setChamando(null)
    }
  }

  async function conversar() {
    if (!user) return exigirLogin()
    try {
      const { id: conv } = await api('/conversas', { method: 'POST', body: { itemId: id } })
      nav(`/conversas/${conv}`)
    } catch (e) { toastErro(e) }
  }

  async function mudarStatus(status) {
    try {
      setItem(await api(`/itens/${id}/status`, { method: 'PATCH', body: { status } }))
      toast(`Situação alterada para “${status}”.`)
    } catch (e) { toastErro(e) }
  }

  async function remover() {
    try {
      await api(`/itens/${id}`, { method: 'DELETE' })
      toast('Item removido do mural.', {
        duracao: 7000,
        acao: { texto: 'Desfazer', fn: () => api(`/itens/${id}/restaurar`, { method: 'POST' }).then(() => { toast('Item restaurado.'); nav(`/item/${id}`) }).catch(toastErro) },
      })
      nav('/', { replace: true })
    } catch (e) { toastErro(e) }
  }

  const wpp = item.dono.telefone && `https://wa.me/55${item.dono.telefone}?text=${encodeURIComponent(`Olá! Vi no ReUse Escolar o item "${item.titulo}". Ainda está disponível?`)}`

  return (
    <div className="page page-narrow-lg">
      <div className="crumbs">
        <button className="back-link" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))}>
          <ArrowLeft size={18} aria-hidden="true" /> Voltar
        </button>
        <nav aria-label="Você está em" className="breadcrumb hide-mobile">
          <Link to="/">Mural</Link> › <Link to={`/?cat=${encodeURIComponent(item.categoria)}`}>{item.categoria}</Link> › <span aria-current="page">{item.titulo}</span>
        </nav>
      </div>

      <div className="detail">
        <div className="detail-media">
          {item.fotos.length ? (
            <>
              <img className="thumb thumb-lg" src={item.fotos[Math.min(fotoAtiva, item.fotos.length - 1)]} alt={`Foto ${fotoAtiva + 1} de ${item.titulo}`} />
              {item.fotos.length > 1 && (
                <div className="mini-thumbs">
                  {item.fotos.map((f, i) => (
                    <button key={f} className={i === fotoAtiva ? 'is-on' : ''} onClick={() => setFotoAtiva(i)} aria-label={`Ver foto ${i + 1}`}>
                      <img src={f} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : <Thumb item={item} grande />}
        </div>

        <div className="detail-info">
          {!disponivel && (
            <div className={`banner banner-${item.status === 'Reservado' ? 'amber' : 'gray'}`} role="status">
              {item.status === 'Reservado' ? 'Este item está reservado. Você ainda pode demonstrar interesse caso ele volte ao mural.' : 'Este item já foi entregue.'}
            </div>
          )}
          <h1 className="detail-title">{item.titulo}</h1>
          <div className="badges">
            <Badge tom="mint">{item.estado}</Badge>
            <Badge>{item.tipo}</Badge>
            <Badge>{item.status}</Badge>
          </div>
          {item.descricao && <p className="detail-desc">{item.descricao}</p>}

          <dl className="specs">
            <div><dt>Categoria</dt><dd>{item.categoria}</dd></div>
            {item.tamanho && <div><dt>Tamanho</dt><dd>{item.tamanho}</dd></div>}
            {item.observacoes && <div><dt>Observação</dt><dd>{item.observacoes}</dd></div>}
            <div><dt>Retirada na secretaria</dt><dd>{item.retiradaSecretaria ? 'Sim' : 'Não — combinar pelo chat'}</dd></div>
            <div><dt>Publicado</dt><dd>{tempoRelativo(item.criadoEm)}</dd></div>
            <div><dt>Interessados</dt><dd>{item.interessados}</dd></div>
          </dl>

          <section className="card publicado-por" aria-label="Publicado por">
            <Avatar usuario={item.dono} tamanho={52} />
            <div>
              <p className="muted small">Publicado por</p>
              <p className="publicado-nome">{item.dono.nome}</p>
              <p className="muted small">{PERFIS[item.dono.perfil]} · membro desde {new Date(item.dono.membroDesde).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
            </div>
          </section>

          {!item.souDono && item.status !== 'Entregue' && (
            <div className="actions-stack">
              <button className={`btn btn-block ${item.euInteressado ? 'btn-outline' : 'btn-primary'}`} onClick={interesse} aria-pressed={item.euInteressado} disabled={ocupado}>
                <Heart size={18} aria-hidden="true" fill={item.euInteressado ? 'currentColor' : 'none'} className={pulsar && item.euInteressado ? 'heart-pulsa' : ''} onAnimationEnd={() => setPulsar(false)} />
                {item.euInteressado ? 'Você tem interesse · remover' : 'Tenho interesse'}
              </button>
              <button className="btn btn-outline btn-block" onClick={conversar}>
                <MessageCircle size={18} aria-hidden="true" /> Conversar no chat
              </button>
              {item.dono.temWhatsapp && (
                wpp
                  ? <a className="btn btn-outline btn-block" href={wpp} target="_blank" rel="noreferrer"><Phone size={18} aria-hidden="true" /> Conversar pelo WhatsApp</a>
                  : <button className="btn btn-outline btn-block" onClick={exigirLogin}><Phone size={18} aria-hidden="true" /> Conversar pelo WhatsApp</button>
              )}
              {!user && <p className="hint-center">Entre na sua conta para demonstrar interesse ou conversar.</p>}
            </div>
          )}

          {item.podeGerenciar && (
            <section className="card manage" aria-label="Gerenciar item">
              <h2 className="h-sm"><Store size={16} aria-hidden="true" /> {item.souDono ? 'Este item é seu' : 'Moderação'}</h2>
              <label className="label" htmlFor="status">Situação</label>
              <select id="status" value={item.status} onChange={(e) => mudarStatus(e.target.value)}>
                {STATUS.map((s) => <option key={s}>{s}</option>)}
              </select>
              {item.interessados > 0 && (
                <>
                  <button className="link" onClick={() => setVerInteressados(!verInteressados)} aria-expanded={verInteressados}>
                    <Users size={14} aria-hidden="true" /> {verInteressados ? 'Ocultar' : 'Ver'} quem tem interesse ({item.interessados})
                  </button>
                  {verInteressados && (interessados.dados ? (
                    <ul className="interessados-lista">
                      {interessados.dados.map((p) => (
                        <CartaoInteressado key={p.id} pessoa={p} titulo={item.titulo} mostrarAcoes={item.souDono}
                          ocupado={chamando === p.id} bloqueado={!!chamando} aoConversar={() => chamar(p)} />
                      ))}
                    </ul>
                  ) : <small className="muted">Carregando...</small>)}
                </>
              )}
              <div className="row-btns">
                <Link to={`/editar/${id}`} className="btn btn-outline"><Pencil size={16} aria-hidden="true" /> Editar</Link>
                <button className="btn btn-ghost-danger" onClick={() => setConfirmar(true)}><Trash2 size={16} aria-hidden="true" /> Remover</button>
              </div>
            </section>
          )}
        </div>
      </div>

      <Confirmar aberto={confirmar} onClose={() => setConfirmar(false)} onConfirm={remover} perigo confirmar="Remover item"
        titulo="Remover este item?" texto={`“${item.titulo}” sairá do mural. Você poderá desfazer logo em seguida.`} />
    </div>
  )
}
