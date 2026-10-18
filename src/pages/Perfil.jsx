import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleHelp, LayoutDashboard, LogOut, Plus, Settings } from 'lucide-react'
import { useStore } from '../store'
import { api, useApi } from '../api'
import { PERFIS } from '../data/constantes'
import Avatar from '../components/Avatar'
import FotoPerfil from '../components/FotoPerfil'
import { Campo, Confirmar, ErroCarga, Esqueleto, InputTelefone, ItemCard, Vazio } from '../components/ui'
import { erroTelefone, formatarTelefone } from '../utils/telefone'

export function Perfil() {
  const { user, setUser, isAdmin, sair, toast, toastErro } = useStore()
  const nav = useNavigate()
  const [aba, setAba] = useState('meus')
  const [confirmSair, setConfirmSair] = useState(false)
  const [editando, setEditando] = useState(false)
  const [dados, setDadosForm] = useState({ nome: user.nome, telefone: formatarTelefone(user.telefone) })
  const [senha, setSenha] = useState({ atual: '', nova: '' })
  const [erros, setErros] = useState({})
  const lista = useApi(aba === 'meus' ? '/itens?situacao=todas&dono=eu' : '/itens?situacao=todas&interesse=eu')

  async function salvarDados(e) {
    e.preventDefault()
    const erroTel = erroTelefone(dados.telefone)
    if (erroTel) { setErros({ telefone: erroTel }); document.getElementById('p-tel')?.focus(); return }
    try {
      const { usuario } = await api('/auth/perfil', { method: 'PATCH', body: dados })
      setUser(usuario); setErros({}); setEditando(false)
      toast('Dados atualizados.')
    } catch (err) { setErros({ [err.campo || 'nome']: err.message }) }
  }
  async function trocarSenha(e) {
    e.preventDefault()
    try {
      await api('/auth/senha', { method: 'PATCH', body: senha })
      setSenha({ atual: '', nova: '' }); setErros({}); setEditando(false)
      toast('Senha alterada com sucesso.')
    } catch (err) { setErros({ [err.campo || 'atual']: err.message }) }
  }

  return (
    <div className="page">
      <section className="card profile">
        <Avatar usuario={user} tamanho={72} />
        <div>
          <h1 className="h-md">{user.nome}</h1>
          <p className="muted">{user.email} · {PERFIS[user.perfil]}</p>
          {user.telefone && <p className="muted">WhatsApp: {formatarTelefone(user.telefone)}</p>}
          {!user.telefone && <p className="field-hint">Sem WhatsApp cadastrado — interessados só falam com você pelo chat.</p>}
        </div>
        <div className="profile-actions">
          {isAdmin && <Link to="/painel" className="btn btn-outline btn-sm"><LayoutDashboard size={16} aria-hidden="true" /> Painel</Link>}
          <button className="btn btn-outline btn-sm" onClick={() => setEditando(!editando)} aria-expanded={editando}><Settings size={16} aria-hidden="true" /> Minha conta</button>
          <button className="btn btn-ghost-danger btn-sm" onClick={() => setConfirmSair(true)}><LogOut size={16} aria-hidden="true" /> Sair</button>
        </div>
      </section>

      {editando && (
        <div className="account-forms">
          <section className="card form" aria-label="Foto de perfil">
            <h2 className="h-sm">Foto de perfil</h2>
            <FotoPerfil />
          </section>
          <form className="card form" onSubmit={salvarDados} noValidate>
            <h2 className="h-sm">Meus dados</h2>
            <Campo id="p-nome" label="Nome completo" erro={erros.nome}>
              <input id="p-nome" maxLength={120} value={dados.nome} onChange={(e) => setDadosForm({ ...dados, nome: e.target.value })} autoComplete="name" />
            </Campo>
            <Campo id="p-tel" label="WhatsApp (opcional)" erro={erros.telefone} dica="Aparece só para usuários logados.">
              <InputTelefone id="p-tel" valor={dados.telefone} onChange={(v) => setDadosForm({ ...dados, telefone: v })} aria-invalid={!!erros.telefone || undefined} aria-describedby={erros.telefone ? 'p-tel-erro' : undefined} />
            </Campo>
            <button className="btn btn-primary">Salvar dados</button>
          </form>
          <form className="card form" onSubmit={trocarSenha} noValidate>
            <h2 className="h-sm">Alterar senha</h2>
            <Campo id="s-atual" label="Senha atual" erro={erros.atual}>
              <input id="s-atual" type="password" value={senha.atual} onChange={(e) => setSenha({ ...senha, atual: e.target.value })} autoComplete="current-password" />
            </Campo>
            <Campo id="s-nova" label="Nova senha" erro={erros.nova} dica="Mínimo de 6 caracteres.">
              <input id="s-nova" type="password" maxLength={72} value={senha.nova} onChange={(e) => setSenha({ ...senha, nova: e.target.value })} autoComplete="new-password" />
            </Campo>
            <button className="btn btn-primary" disabled={!senha.atual || !senha.nova}>Alterar senha</button>
          </form>
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Meus itens">
        <button role="tab" aria-selected={aba === 'meus'} className={`tab-btn ${aba === 'meus' ? 'is-on' : ''}`} onClick={() => setAba('meus')}>Meus anúncios</button>
        <button role="tab" aria-selected={aba === 'int'} className={`tab-btn ${aba === 'int' ? 'is-on' : ''}`} onClick={() => setAba('int')}>Meus interesses</button>
      </div>

      {lista.erro ? <ErroCarga erro={lista.erro} onTentar={lista.recarregar} />
        : !lista.dados || lista.carregando ? <Esqueleto linhas={3} />
          : lista.dados.length ? <div className="grid">{lista.dados.map((i) => <ItemCard key={i.id} item={i} />)}</div> : (
            aba === 'meus'
              ? <Vazio titulo="Você ainda não publicou nada" texto="Tem um uniforme ou livro parado em casa? Ele pode ajudar outro estudante."><Link to="/novo" className="btn btn-primary"><Plus size={18} aria-hidden="true" /> Publicar item</Link></Vazio>
              : <Vazio titulo="Nenhum interesse ainda" texto="Toque em “Tenho interesse” em um item do mural para acompanhá-lo aqui."><Link to="/" className="btn btn-primary">Ver o mural</Link></Vazio>
          )}

      <Link to="/ajuda" className="link reset-link"><CircleHelp size={14} aria-hidden="true" /> Precisa de ajuda?</Link>

      <Confirmar aberto={confirmSair} onClose={() => setConfirmSair(false)} confirmar="Sair" titulo="Sair da conta?" texto="Você poderá entrar de novo quando quiser."
        onConfirm={async () => { await sair(); toast('Você saiu da conta.'); nav('/') }} />
    </div>
  )
}

export function Ajuda() {
  const perguntas = [
    ['Como doar ou trocar um material?', 'Entre na sua conta, toque no botão “+” (ou “Novo item” no computador), adicione fotos, escolha a categoria, o estado de conservação e se é doação ou troca. Depois é só publicar.'],
    ['O que significa “Tenho interesse”?', 'Avisa quem publicou que você quer o item. Você pode remover o interesse a qualquer momento e acompanhar tudo em Meu perfil › Meus interesses.'],
    ['Como combino a entrega?', 'Pelo chat interno (Conversas) ou, se a pessoa cadastrou um número, pelo WhatsApp. Itens marcados com “Retirada na secretaria” podem ser buscados na escola.'],
    ['O que quer dizer Disponível, Reservado e Entregue?', 'Disponível: aparece no mural. Reservado: alguém já combinou de buscar. Entregue: a doação ou troca foi concluída.'],
    ['Publiquei algo errado. E agora?', 'Abra o item e toque em “Editar”. Se remover sem querer, use o botão “Desfazer” que aparece no aviso logo em seguida.'],
    ['Quem modera os anúncios?', 'A secretaria da escola pode editar, alterar a situação ou remover anúncios inadequados, e suspender contas que usem a plataforma de forma indevida.'],
  ]
  return (
    <div className="page page-narrow">
      <h1>Ajuda</h1>
      <p className="muted">Respostas rápidas para as dúvidas mais comuns.</p>
      <ol className="steps">
        <li><b>Publique</b><span>Foto, categoria e estado do material.</span></li>
        <li><b>Converse</b><span>Pelo chat ou WhatsApp com quem tem interesse.</span></li>
        <li><b>Entregue</b><span>Na secretaria ou como combinarem.</span></li>
      </ol>
      <div className="faq">
        {perguntas.map(([q, r]) => <details key={q} className="card"><summary>{q}</summary><p>{r}</p></details>)}
      </div>
      <p className="muted small">Atalho: no computador, aperte <kbd>/</kbd> no mural para buscar.</p>
    </div>
  )
}

export function NaoEncontrada() {
  return (
    <div className="page">
      <Vazio titulo="Página não encontrada" texto="O endereço pode estar errado ou a página foi removida.">
        <Link to="/" className="btn btn-primary">Ir para o mural</Link>
      </Vazio>
    </div>
  )
}
