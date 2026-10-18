import { useCallback } from 'react'
import { Link as RRLink, NavLink as RRNavLink, useNavigate as useRRNavigate } from 'react-router-dom'

// Troca de página com transição curta (View Transitions API). Onde não há suporte, ou com
// "reduzir movimento" ligado, navega na hora, sem animação.
export function comTransicao(fazer) {
  const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduzir) { fazer(); return }
  const t = document.startViewTransition(async () => {
    fazer()
    // espera o React desenhar a nova página antes do navegador tirar a "foto" final
    // (o limite de tempo evita travar se a aba estiver em segundo plano e o navegador pausar os quadros)
    await Promise.race([
      new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))),
      new Promise((ok) => setTimeout(ok, 150)),
    ])
  })
  // se a transição for cancelada, a navegação já aconteceu: não há o que tratar
  t.ready.catch(() => {})
  t.updateCallbackDone.catch(() => {})
  t.finished.catch(() => {})
}

export function useNavigate() {
  const nav = useRRNavigate()
  return useCallback((to, opcoes) => (typeof to === 'number' ? nav(to) : comTransicao(() => nav(to, opcoes))), [nav])
}

function interceptar(nav, props) {
  return (e) => {
    props.onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (props.target && props.target !== '_self') return
    e.preventDefault()
    comTransicao(() => nav(props.to, { replace: props.replace, state: props.state }))
  }
}

export function Link(props) {
  const nav = useRRNavigate()
  return <RRLink {...props} onClick={interceptar(nav, props)} />
}

export function NavLink(props) {
  const nav = useRRNavigate()
  return <RRNavLink {...props} onClick={interceptar(nav, props)} />
}
