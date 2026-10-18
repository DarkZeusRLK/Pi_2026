import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link, useNavigate } from '../components/nav'
import { Eye, EyeOff, Recycle } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../api'
import FotoPerfil from '../components/FotoPerfil'
import { Campo, Chips, InputTelefone, Toasts } from '../components/ui'
import { erroTelefone } from '../utils/telefone'

function AuthShell({ children }) {
  return (
    <div className="auth">
      <aside className="auth-brand" aria-hidden="true">
        <div className="auth-brand-inner">
          <span className="logo-mark lg"><Recycle size={28} /></span>
          <p className="auth-quote">Transformando materiais sem uso em oportunidades para novos estudantes.</p>
          <ul className="auth-points">
            <li>Uniformes, livros, mochilas e papelaria</li>
            <li>Doe ou troque com a sua comunidade escolar</li>
            <li>Retirada combinada com a secretaria</li>
          </ul>
        </div>
      </aside>
      <section className="auth-panel">
        <div className="auth-card">{children}</div>
      </section>
      <Toasts />
    </div>
  )
}

function SenhaInput({ id, value, onChange, placeholder, invalido, describedBy, autoComplete }) {
  const [ver, setVer] = useState(false)
  return (
    <div className="input-wrap">
      <input
        id={id} type={ver ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} maxLength={72}
        aria-invalid={invalido || undefined} aria-describedby={describedBy} autoComplete={autoComplete}
      />
      <button type="button" className="input-icon" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'}>
        {ver ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}

export function Login() {
  const { setUser, toast } = useStore()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const voltar = params.get('voltar') || '/'
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erros, setErros] = useState({})
  const [enviando, setEnviando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    const em = email
    const se = senha
    const er = {}
    if (!em.trim()) er.email = 'Informe seu e-mail.'
    else if (!/^\S+@\S+\.\S+$/.test(em)) er.email = 'E-mail inválido. Exemplo: seu@gmail.com'
    if (!se) er.senha = 'Informe sua senha.'
    setErros(er)
    if (Object.keys(er).length) return
    setEnviando(true)
    try {
      const { usuario } = await api('/auth/login', { method: 'POST', body: { email: em, senha: se } })
      setUser(usuario)
      toast(`Bem-vindo(a), ${usuario.nome.split(' ')[0]}!`)
      nav(voltar, { replace: true })
    } catch (err) {
      setErros({ [err.campo || 'email']: err.message })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="auth-title">ReUse Escolar</h1>
      <p className="auth-sub">Troque e doe materiais com a sua escola.</p>
      <form onSubmit={entrar} noValidate className="form">
        <Campo id="email" label="E-mail" erro={erros.email}>
          <input id="email" type="email" inputMode="email" autoComplete="email" placeholder="seu@gmail.com" maxLength={160}
            value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!erros.email || undefined}
            aria-describedby={erros.email ? 'email-erro' : undefined} />
        </Campo>
        <Campo id="senha" label="Senha" erro={erros.senha}>
          <SenhaInput id="senha" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Sua senha"
            invalido={!!erros.senha} describedBy={erros.senha ? 'senha-erro' : undefined} autoComplete="current-password" />
        </Campo>
        <button className="btn btn-primary btn-block" type="submit" disabled={enviando}>{enviando ? <><span className="spinner" aria-hidden="true" /> Entrando...</> : 'Entrar'}</button>
        <Link className="btn btn-outline btn-block" to={`/cadastro${voltar !== '/' ? `?voltar=${voltar}` : ''}`}>Criar conta</Link>
      </form>
      <Link to="/" className="link-center">Ver o mural sem entrar</Link>
    </AuthShell>
  )
}

function forcaSenha(s) {
  let p = 0
  if (s.length >= 8) p++
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) p++
  if (/\d/.test(s)) p++
  if (/[^A-Za-z0-9]/.test(s)) p++
  return p
}

export function Cadastro() {
  const { setUser, toast, config, user } = useStore()
  const [etapaFoto, setEtapaFoto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [f, setF] = useState({ nome: '', email: '', telefone: '', senha: '', perfil: 'responsavel' })
  const [erros, setErros] = useState({})
  const set = (k) => (e) => setF({ ...f, [k]: e.target ? e.target.value : e })
  const forca = forcaSenha(f.senha)
  const forcaTxt = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'][forca]

  async function enviar(e) {
    e.preventDefault()
    const er = {}
    if (f.nome.trim().split(' ').length < 2) er.nome = 'Informe nome e sobrenome.'
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = 'E-mail inválido. Exemplo: seu@gmail.com'
    if (erroTelefone(f.telefone)) er.telefone = erroTelefone(f.telefone)
    if (f.senha.length < 6) er.senha = 'A senha precisa ter pelo menos 6 caracteres.'
    setErros(er)
    if (Object.keys(er).length) {
      document.getElementById(Object.keys(er)[0])?.focus()
      return
    }
    setEnviando(true)
    try {
      const { usuario } = await api('/auth/cadastro', { method: 'POST', body: f })
      setUser(usuario)
      toast('Conta criada! Você já está conectado(a).')
      // etapa opcional: foto de perfil (só se o armazenamento estiver configurado)
      if (config.upload) setEtapaFoto(true)
      else nav(params.get('voltar') || '/', { replace: true })
    } catch (err) {
      setErros({ [err.campo || 'email']: err.message })
      document.getElementById(err.campo || 'email')?.focus()
    } finally {
      setEnviando(false)
    }
  }

  if (etapaFoto && user) {
    const concluir = () => nav(params.get('voltar') || '/', { replace: true })
    return (
      <AuthShell>
        <h1 className="auth-title">Quase lá!</h1>
        <p className="auth-sub">Uma foto ajuda outras pessoas a confiar em você na hora de combinar a troca. É opcional.</p>
        <FotoPerfil rotuloAdicionar="Adicionar foto agora" />
        <button className={`btn btn-block ${user.avatarUrl ? 'btn-primary' : 'btn-outline'}`} onClick={concluir}>
          {user.avatarUrl ? 'Continuar' : 'Fazer depois'}
        </button>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <Link to="/entrar" className="back-link">‹ Voltar</Link>
      <h1 className="auth-title">Criar conta</h1>
      <p className="auth-sub">Leva menos de um minuto.</p>
      <form onSubmit={enviar} noValidate className="form">
        <Campo id="nome" label="Nome completo" erro={erros.nome} obrigatorio>
          <input id="nome" autoComplete="name" placeholder="Seu nome" maxLength={120} value={f.nome} onChange={set('nome')} aria-invalid={!!erros.nome || undefined} />
        </Campo>
        <Campo id="email" label="E-mail" erro={erros.email} obrigatorio>
          <input id="email" type="email" inputMode="email" autoComplete="email" placeholder="seu@gmail.com" maxLength={160} value={f.email} onChange={set('email')} aria-invalid={!!erros.email || undefined} />
        </Campo>
        <Campo id="telefone" label="WhatsApp (opcional)" erro={erros.telefone} dica="Permite que interessados falem com você pelo WhatsApp.">
          <InputTelefone id="telefone" valor={f.telefone} onChange={set('telefone')} aria-invalid={!!erros.telefone || undefined} aria-describedby={erros.telefone ? 'telefone-erro' : undefined} />
        </Campo>
        <Campo id="senha" label="Senha" erro={erros.senha} obrigatorio>
          <SenhaInput id="senha" value={f.senha} onChange={set('senha')} placeholder="Crie uma senha forte" invalido={!!erros.senha} autoComplete="new-password" describedBy="forca" />
          {f.senha && (
            <div className="strength" id="forca" aria-live="polite">
              <div className="strength-bar"><span style={{ width: `${(forca / 4) * 100}%` }} data-nivel={forca} /></div>
              <small>Força: {forcaTxt}</small>
            </div>
          )}
        </Campo>
        <div className="field">
          <span className="label">Eu sou</span>
          <Chips label="Eu sou" valor={f.perfil} onChange={set('perfil')}
            opcoes={[{ valor: 'responsavel', texto: 'Pai/Responsável' }, { valor: 'aluno', texto: 'Aluno' }, { valor: 'funcionario', texto: 'Funcionário' }]} />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={enviando}>{enviando ? <><span className="spinner" aria-hidden="true" /> Criando...</> : 'Criar conta'}</button>
      </form>
      <Link to="/entrar" className="link-center">Já tenho uma conta</Link>
    </AuthShell>
  )
}
