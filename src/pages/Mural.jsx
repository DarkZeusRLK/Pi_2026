import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowUp, PackageSearch, Search, SlidersHorizontal, X } from 'lucide-react'
import { useStore } from '../store'
import { api, useApi } from '../api'
import { useAoReconectar, useCanal } from '../realtime'
import { ESTADOS } from '../data/constantes'
import { Chips, ErroCarga, Esqueleto, ItemCard, Vazio } from '../components/ui'

const semAcento = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// O item recém-chegado combina com a busca e os filtros que a pessoa está usando agora?
function combinaFiltros(item, { busca, cat, tipo, estado, soDisp }) {
  if (soDisp && item.status !== 'Disponível') return false
  if (cat !== 'Todos' && item.categoria !== cat) return false
  if (tipo !== 'Todos' && item.tipo !== tipo) return false
  if (estado !== 'Todos' && item.estado !== estado) return false
  if (busca && !semAcento(`${item.titulo} ${item.descricao} ${item.categoria}`).includes(semAcento(busca))) return false
  return true
}

export default function Mural() {
  const { user, tempoRealOk } = useStore()
  const [params, setParams] = useSearchParams()
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const busca = params.get('q') || ''
  const [buscaDigitada, setBuscaDigitada] = useState(busca)
  const cat = params.get('cat') || 'Todos'
  const tipo = params.get('tipo') || 'Todos'
  const estado = params.get('estado') || 'Todos'
  const soDisp = params.get('disp') !== '0'
  const inputRef = useRef(null)

  const setP = (k, v, padrao) => {
    setParams((atual) => {
      const p = new URLSearchParams(atual)
      if (v === padrao || v === '') p.delete(k); else p.set(k, v)
      return p
    }, { replace: true })
  }

  // Espera o usuário parar de digitar antes de buscar no servidor
  useEffect(() => {
    const t = setTimeout(() => { if (buscaDigitada !== busca) setP('q', buscaDigitada.trim(), '') }, 350)
    return () => clearTimeout(t)
  }, [buscaDigitada]) // eslint-disable-line
  useEffect(() => { setBuscaDigitada(busca) }, [busca])

  // Atalho "/" para focar a busca (flexibilidade para usuários experientes)
  useEffect(() => {
    const h = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault(); inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const qs = new URLSearchParams()
  if (busca) qs.set('q', busca)
  if (cat !== 'Todos') qs.set('cat', cat)
  if (tipo !== 'Todos') qs.set('tipo', tipo)
  if (estado !== 'Todos') qs.set('estado', estado)
  qs.set('situacao', soDisp ? 'Disponível' : 'todas')
  const { dados: lista, setDados, erro, carregando, recarregar } = useApi(`/itens?${qs}`)
  const { dados: categorias } = useApi('/categorias')

  const filtrosAtivos = (tipo !== 'Todos') + (estado !== 'Todos') + (!soDisp)
  const algumFiltro = busca || cat !== 'Todos' || filtrosAtivos > 0
  /* ---------- mural ao vivo ---------- */
  const [anim, setAnim] = useState({})   // id → 'entrando' | 'saindo'
  const [fila, setFila] = useState([])   // anúncios novos esperando a pessoa voltar ao topo
  const [aviso, setAviso] = useState('')
  const listaRef = useRef(lista)
  const filtrosRef = useRef({})
  const filaRef = useRef(fila)
  listaRef.current = lista
  filaRef.current = fila
  filtrosRef.current = { busca, cat, tipo, estado, soDisp }

  const marcarAnim = (id, tipoAnim, ms) => {
    setAnim((a) => ({ ...a, [id]: tipoAnim }))
    setTimeout(() => setAnim((a) => { const { [id]: _, ...resto } = a; return resto }), ms)
  }
  const inserir = useCallback((itens) => {
    setDados((l) => [...itens, ...(l || []).filter((x) => !itens.some((n) => n.id === x.id))])
    itens.forEach((i) => marcarAnim(i.id, 'entrando', 400))
    setAviso(itens.length === 1 ? `Novo anúncio: ${itens[0].titulo}` : `${itens.length} novos anúncios`)
  }, [setDados])
  const remover = useCallback((id) => {
    setFila((q) => q.filter((x) => x.id !== id))
    if (!listaRef.current?.some((x) => x.id === id)) return
    setAnim((a) => ({ ...a, [id]: 'saindo' }))
    setTimeout(() => {
      setDados((l) => (l || []).filter((x) => x.id !== id))
      setAnim((a) => { const { [id]: _, ...resto } = a; return resto })
    }, 200)
  }, [setDados])

  const reconciliar = useCallback(async (id) => {
    let item = null
    try { item = await api(`/itens/${id}`) } catch (e) { if (e.status !== 404) return }
    if (!item || !combinaFiltros(item, filtrosRef.current)) return remover(id)
    if (listaRef.current?.some((x) => x.id === id)) {
      setDados((l) => l.map((x) => (x.id === id ? item : x))) // atualiza o card no lugar
    } else if (filaRef.current.some((x) => x.id === id)) {
      setFila((q) => q.map((x) => (x.id === id ? item : x)))
    } else if (window.scrollY < 120) {
      inserir([item])                       // entra no topo com animação
    } else {
      setFila((q) => [item, ...q])          // a pessoa já rolou: não empurra o conteúdo
    }
  }, [inserir, remover, setDados])

  useCanal('mural', (evento, dados) => {
    if (!lista) return
    if (evento === 'item:removido') remover(dados.id)
    else reconciliar(dados.id)
  })
  useAoReconectar(() => recarregar(true))

  const mostrarFila = () => {
    window.scrollTo({ top: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    inserir(filaRef.current)
    setFila([])
  }
  // voltou ao topo por conta própria: insere o que estava esperando
  useEffect(() => {
    if (!fila.length) return undefined
    const h = () => { if (window.scrollY < 40) { inserir(filaRef.current); setFila([]) } }
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [fila.length, inserir])

  const limpar = () => { setBuscaDigitada(''); setParams({}, { replace: true }) }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Mural</h1>
          <p className="muted">{user ? `Olá, ${user.nome.split(' ')[0]}! ` : ''}Materiais doados e para troca na sua escola.</p>
        </div>
      </div>

      <div className="search-row">
        <div className="search">
          <Search size={18} aria-hidden="true" />
          <input ref={inputRef} type="search" maxLength={60} placeholder="Buscar: camiseta, mochila..." aria-label="Buscar materiais"
            value={buscaDigitada} onChange={(e) => setBuscaDigitada(e.target.value)} />
          {buscaDigitada ? <button className="icon-btn" aria-label="Limpar busca" onClick={() => { setBuscaDigitada(''); setP('q', '', '') }}><X size={16} /></button>
            : <kbd className="hide-mobile" title="Atalho">/</kbd>}
        </div>
        <button className={`btn btn-outline filter-btn ${filtrosAbertos ? 'is-on' : ''}`} aria-expanded={filtrosAbertos} aria-controls="filtros"
          onClick={() => setFiltrosAbertos(!filtrosAbertos)}>
          <SlidersHorizontal size={18} aria-hidden="true" /> <span>Filtros</span>
          {filtrosAtivos > 0 && <span className="dot-count">{filtrosAtivos}</span>}
        </button>
      </div>

      <div className="chips-scroll">
        <Chips label="Categoria" valor={cat} onChange={(v) => setP('cat', v, 'Todos')}
          opcoes={['Todos', ...(categorias || []).map((c) => c.nome)]} />
      </div>

      {filtrosAbertos && (
        <section id="filtros" className="card filters" aria-label="Filtros">
          <div>
            <span className="label">Tipo</span>
            <Chips label="Tipo" valor={tipo} onChange={(v) => setP('tipo', v, 'Todos')} opcoes={['Todos', 'Doação', 'Troca']} />
          </div>
          <div>
            <span className="label">Estado de conservação</span>
            <Chips label="Estado" valor={estado} onChange={(v) => setP('estado', v, 'Todos')} opcoes={['Todos', ...ESTADOS]} />
          </div>
          <label className="switch">
            <input type="checkbox" checked={soDisp} onChange={(e) => setP('disp', e.target.checked ? '1' : '0', '1')} />
            <span className="switch-ui" aria-hidden="true" /> Mostrar só itens disponíveis
          </label>
        </section>
      )}

      <div className="result-bar" aria-live="polite">
        <span>{carregando ? 'Buscando...' : lista ? `${lista.length} ${lista.length === 1 ? 'item encontrado' : 'itens encontrados'}` : ''}</span>
        {algumFiltro && <button className="link" onClick={limpar}>Limpar filtros</button>}
      </div>

      <div className="sr-only" role="status" aria-live="polite">{aviso}</div>
      {fila.length > 0 && (
        <button type="button" className="pilula-novos" onClick={mostrarFila}>
          <ArrowUp size={16} aria-hidden="true" /> {fila.length} {fila.length === 1 ? 'novo anúncio' : 'novos anúncios'}
        </button>
      )}

      {erro ? <ErroCarga erro={erro} onTentar={recarregar} />
        : carregando && !lista ? <Esqueleto />
          : lista?.length ? (
            <div className="grid" style={{ opacity: carregando ? 0.6 : 1 }}>{lista.map((i) => <ItemCard key={i.id} item={i} animacao={anim[i.id]} />)}</div>
          ) : (
            <Vazio icone={PackageSearch} titulo="Nenhum material encontrado"
              texto={busca ? `Não achamos nada para “${busca}”. Tente outra palavra ou remova filtros.` : 'Tente remover alguns filtros.'}>
              {algumFiltro && <button className="btn btn-outline" onClick={limpar}>Limpar busca e filtros</button>}
            </Vazio>
          )}
    </div>
  )
}
