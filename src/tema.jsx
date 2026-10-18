import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Chips } from './components/ui'

/* Tema: Claro / Escuro / Automático (segue o sistema). A escolha fica no localStorage e o
   script do index.html aplica o tema antes do React carregar (sem piscar). */

const CHAVE = 'reuse-tema'
const COR_BARRA = { claro: '#1F6B5A', escuro: '#12251f' } // mesma cor do token --bar-bg, para a barra do navegador no celular
const OPCOES = [
  { valor: 'claro', texto: 'Claro', icone: Sun },
  { valor: 'escuro', texto: 'Escuro', icone: Moon },
  { valor: 'auto', texto: 'Automático (sistema)', icone: Monitor },
]

const Ctx = createContext({ preferencia: 'auto', efetivo: 'claro', definir: () => {} })
export const useTema = () => useContext(Ctx)

function lerPreferencia() {
  try {
    const v = localStorage.getItem(CHAVE)
    return v === 'claro' || v === 'escuro' ? v : 'auto'
  } catch { return 'auto' }
}

const sistemaEscuro = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches

function aplicar(pref) {
  const efetivo = pref === 'escuro' || (pref === 'auto' && sistemaEscuro()) ? 'escuro' : 'claro'
  const el = document.documentElement
  el.setAttribute('data-theme', efetivo === 'escuro' ? 'dark' : 'light')
  el.setAttribute('data-tema', pref)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_BARRA[efetivo])
  return efetivo
}

export function TemaProvider({ children }) {
  const [preferencia, setPreferencia] = useState(lerPreferencia)
  const [efetivo, setEfetivo] = useState(() => aplicar(lerPreferencia()))

  useEffect(() => { setEfetivo(aplicar(preferencia)) }, [preferencia])
  // no modo automático acompanha o sistema em tempo real
  useEffect(() => {
    if (preferencia !== 'auto') return undefined
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const h = () => setEfetivo(aplicar('auto'))
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [preferencia])
  // várias abas abertas ficam em sincronia
  useEffect(() => {
    const h = (e) => { if (e.key === CHAVE) setPreferencia(lerPreferencia()) }
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  const definir = useCallback((pref) => {
    try { localStorage.setItem(CHAVE, pref) } catch { /* sem localStorage: vale só até recarregar */ }
    setPreferencia(pref)
  }, [])

  const valor = useMemo(() => ({ preferencia, efetivo, definir }), [preferencia, efetivo, definir])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

// Seletor compacto (ícone que abre um menu) para a barra do topo e telas de login
export function SeletorTema() {
  const { preferencia, definir } = useTema()
  const [aberto, setAberto] = useState(false)
  const area = useRef(null)
  const atual = OPCOES.find((o) => o.valor === preferencia)
  const Icone = atual.icone

  useEffect(() => {
    if (!aberto) return undefined
    const fora = (e) => { if (!area.current?.contains(e.target)) setAberto(false) }
    const tecla = (e) => { if (e.key === 'Escape') { setAberto(false); area.current?.querySelector('button')?.focus() } }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', tecla) }
  }, [aberto])

  return (
    <div className="tema-area" ref={area}>
      <button type="button" className="icon-btn tema-btn" aria-haspopup="menu" aria-expanded={aberto}
        aria-label={`Aparência: ${atual.texto}. Alterar`} title="Aparência" onClick={() => setAberto(!aberto)}>
        <Icone size={20} aria-hidden="true" />
      </button>
      {aberto && (
        <div className="tema-menu" role="menu" aria-label="Aparência">
          {OPCOES.map(({ valor, texto, icone: I }) => (
            <button key={valor} type="button" role="menuitemradio" aria-checked={preferencia === valor} className={preferencia === valor ? 'is-on' : ''}
              onClick={() => { definir(valor); setAberto(false) }}>
              <I size={18} aria-hidden="true" /> {texto}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Versão em chips para Meu perfil
export function SeletorTemaChips() {
  const { preferencia, definir } = useTema()
  return <Chips label="Aparência" valor={preferencia} onChange={definir} opcoes={OPCOES.map(({ valor, texto }) => ({ valor, texto }))} />
}
