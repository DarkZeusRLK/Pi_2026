import { NavLink, Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CircleHelp, House, LayoutDashboard, LogIn, MessageCircle, Plus, Recycle, User } from 'lucide-react'
import { useStore } from '../store'
import { Carregando, Toasts, Vazio } from './ui'

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="ReUse Escolar — ir para o mural">
      <span className="logo-mark"><Recycle size={18} aria-hidden="true" /></span>
      <span>ReUse <b>Escolar</b></span>
    </Link>
  )
}

export default function Layout() {
  const { user, isAdmin, naoLidas } = useStore()
  const nav = useNavigate()

  const links = [
    { to: '/', label: 'Mural', icon: House, end: true },
    { to: '/conversas', label: 'Conversas', icon: MessageCircle, badge: naoLidas },
    ...(isAdmin ? [{ to: '/painel', label: 'Painel', icon: LayoutDashboard }] : []),
    { to: '/perfil', label: 'Meu perfil', icon: User },
  ]

  return (
    <div className="app">
      <a href="#conteudo" className="skip">Pular para o conteúdo</a>

      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <nav className="topnav" aria-label="Principal">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className="topnav-link">
                <l.icon size={18} aria-hidden="true" /> {l.label}
                {l.badge > 0 && <span className="dot-count" aria-label={`${l.badge} não lidas`}>{l.badge}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-actions">
            <Link to="/ajuda" className="icon-btn" aria-label="Ajuda" title="Ajuda"><CircleHelp size={20} /></Link>
            {user ? (
              <button className="btn btn-primary btn-sm hide-mobile" onClick={() => nav('/novo')}>
                <Plus size={18} aria-hidden="true" /> Novo item
              </button>
            ) : (
              <Link to="/entrar" className="btn btn-primary btn-sm"><LogIn size={18} aria-hidden="true" /> Entrar</Link>
            )}
          </div>
        </div>
      </header>

      <main id="conteudo" className="main" tabIndex={-1}>
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Navegação inferior">
        {links.slice(0, 2).map((l) => <Tab key={l.to} {...l} />)}
        <Link to={user ? '/novo' : '/entrar?voltar=/novo'} className="tab-fab" aria-label="Publicar novo item">
          <Plus size={26} aria-hidden="true" />
        </Link>
        {links.slice(2).map((l) => <Tab key={l.to} {...l} />)}      </nav>

      <Toasts />
    </div>
  )
}

function Tab({ to, label, icon: I, end, badge }) {
  return (
    <NavLink to={to} end={end} className="tab">
      <span className="tab-icon">
        <I size={22} aria-hidden="true" />
        {badge > 0 && <span className="dot-count" aria-label={`${badge} não lidas`}>{badge}</span>}
      </span>
      <span>{label}</span>
    </NavLink>
  )
}

// Protege telas que exigem login: espera a sessão carregar e manda para /entrar se necessário
export function Privada({ children, admin = false }) {
  const { user, isAdmin, carregandoSessao } = useStore()
  const loc = useLocation()
  if (carregandoSessao) return <Carregando />
  if (!user) return <Navigate to={`/entrar?voltar=${encodeURIComponent(loc.pathname)}`} replace />
  if (admin && !isAdmin) {
    return (
      <div className="page">
        <Vazio titulo="Acesso restrito" texto="Esta área é exclusiva da secretaria."><Link className="btn btn-primary" to="/">Voltar ao mural</Link></Vazio>
      </div>
    )
  }
  return children
}
