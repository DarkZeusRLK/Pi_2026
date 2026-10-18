import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  RotateCcw, WifiOff, Backpack, BookOpen, CircleAlert, CircleCheck, FileText, Info, NotebookPen, Paperclip, PencilRuler, Shirt, X,
} from 'lucide-react'
import { useStore } from '../store'

const ICONES = { Uniformes: Shirt, Mochilas: Backpack, Estojos: PencilRuler, Livros: BookOpen, Apostilas: FileText, Cadernos: NotebookPen, Papelaria: Paperclip }
const TONS = { Uniformes: 'mint', Mochilas: 'sky', Estojos: 'peach', Livros: 'sand', Apostilas: 'lilac', Cadernos: 'mint', Papelaria: 'sky' }

export function CategoriaIcone({ categoria, size = 20 }) {
  const I = ICONES[categoria] || Paperclip
  return <I size={size} aria-hidden="true" />
}

export function Thumb({ item, grande = false }) {
  const capa = item.capa || item.fotos?.[0]
  if (capa) {
    return <img className={`thumb ${grande ? 'thumb-lg' : ''}`} src={capa} alt={`Foto de ${item.titulo}`} loading="lazy" />
  }
  return (
    <div className={`thumb thumb-ph tone-${TONS[item.categoria] || 'mint'} ${grande ? 'thumb-lg' : ''}`} role="img" aria-label={`Sem foto — ${item.categoria}`}>
      <CategoriaIcone categoria={item.categoria} size={grande ? 56 : 28} />
      {grande && <span>Sem foto ainda</span>}
    </div>
  )
}

export function Badge({ children, tom }) {
  const auto = {
    'Doação': 'peach', 'Troca': 'lilac',
    'Disponível': 'green', 'Reservado': 'amber', 'Entregue': 'gray',
  }[children]
  return <span className={`badge badge-${tom || auto || 'mint'}`}>{children}</span>
}

export function ItemCard({ item }) {
  const indisponivel = item.status !== 'Disponível'
  return (
    <Link to={`/item/${item.id}`} className={`card item-card ${indisponivel ? 'is-muted' : ''}`}>
      <Thumb item={item} />
      <div className="item-card-body">
        <h3>{item.titulo}</h3>
        <div className="badges">
          <Badge tom="mint">{item.estado}</Badge>
          <Badge>{item.tipo}</Badge>
          {indisponivel && <Badge>{item.status}</Badge>}
        </div>
        <p className="meta">{item.categoria}{item.interessados > 0 && ` · ${item.interessados} interessado${item.interessados > 1 ? 's' : ''}`}</p>
      </div>
    </Link>
  )
}

export function Chips({ opcoes, valor, onChange, label, nome }) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {opcoes.map((o) => {
        const v = typeof o === 'string' ? o : o.valor
        const t = typeof o === 'string' ? o : o.texto
        return (
          <button
            type="button" key={v} role="radio" aria-checked={valor === v} name={nome}
            className={`chip ${valor === v ? 'is-on' : ''}`} onClick={() => onChange(v)}
          >{t}</button>
        )
      })}
    </div>
  )
}

export function Campo({ id, label, erro, dica, obrigatorio, children }) {
  return (
    <div className={`field ${erro ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}{obrigatorio && <span className="req" aria-hidden="true"> *</span>}</label>
      {children}
      {erro ? <p className="field-error" id={`${id}-erro`} role="alert"><CircleAlert size={14} aria-hidden="true" /> {erro}</p>
        : dica && <p className="field-hint" id={`${id}-dica`}>{dica}</p>}
    </div>
  )
}

export function Vazio({ icone: I = Info, titulo, texto, children }) {
  return (
    <div className="empty">
      <div className="empty-icon"><I size={28} aria-hidden="true" /></div>
      <h2>{titulo}</h2>
      {texto && <p>{texto}</p>}
      {children}
    </div>
  )
}

export function Confirmar({ aberto, titulo, texto, confirmar = 'Confirmar', perigo, onConfirm, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])
  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <h2>{titulo}</h2>
      <p>{texto}</p>
      <div className="dialog-actions">
        <button className="btn btn-ghost" onClick={onClose} autoFocus>Cancelar</button>
        <button className={`btn ${perigo ? 'btn-danger' : 'btn-primary'}`} onClick={() => { onConfirm(); onClose() }}>{confirmar}</button>
      </div>
    </dialog>
  )
}

export function Toasts() {
  const { toasts, fecharToast } = useStore()
  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tipo}`} role="status">
          {t.tipo === 'erro' ? <CircleAlert size={18} aria-hidden="true" /> : <CircleCheck size={18} aria-hidden="true" />}
          <span>{t.msg}</span>
          {t.acao && <button className="toast-action" onClick={() => { t.acao.fn(); fecharToast(t.id) }}>{t.acao.texto}</button>}
          <button className="icon-btn" aria-label="Fechar aviso" onClick={() => fecharToast(t.id)}><X size={16} /></button>
        </div>
      ))}
    </div>
  )
}

export function Esqueleto({ linhas = 6, tipo = 'grid' }) {
  return (
    <div className={tipo === 'grid' ? 'grid' : 'admin-list'} aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => <div key={i} className={`card skeleton skeleton-${tipo}`} />)}
    </div>
  )
}

export function ErroCarga({ erro, onTentar }) {
  return (
    <Vazio icone={WifiOff} titulo="Não foi possível carregar" texto={erro?.message}>
      {onTentar && <button className="btn btn-outline" onClick={() => onTentar()}><RotateCcw size={16} aria-hidden="true" /> Tentar de novo</button>}
    </Vazio>
  )
}

export function Carregando({ texto = 'Carregando...' }) {
  return <div className="loading" role="status"><span className="spinner" aria-hidden="true" /> {texto}</div>
}
