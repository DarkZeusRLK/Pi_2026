import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Heart, Package, PackageCheck, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { tempoRelativo, useStore } from '../store'
import { api, useApi } from '../api'
import { PERFIS, STATUS } from '../data/constantes'
import Avatar from '../components/Avatar'
import { formatarTelefone } from '../utils/telefone'
import { Badge, Confirmar, ErroCarga, Esqueleto, Thumb, Vazio } from '../components/ui'

export default function Painel() {
  const { user, toast, toastErro } = useStore()
  const [aba, setAba] = useState('itens')
  const [busca, setBusca] = useState('')
  const [buscaApi, setBuscaApi] = useState('')
  const [statusF, setStatusF] = useState('todas')
  const [remover, setRemover] = useState(null)
  const [novaCat, setNovaCat] = useState('')

  useEffect(() => { const t = setTimeout(() => setBuscaApi(busca.trim()), 350); return () => clearTimeout(t) }, [busca])

  const resumo = useApi('/admin/resumo')
  const itens = useApi(aba === 'itens' ? `/itens?situacao=${encodeURIComponent(statusF)}${buscaApi ? `&q=${encodeURIComponent(buscaApi)}` : ''}` : null)
  const usuarios = useApi(aba === 'usuarios' ? '/admin/usuarios' : null)
  const categorias = useApi(aba === 'categorias' ? '/categorias' : null)

  const atualizarTudo = () => { itens.recarregar(true); resumo.recarregar(true) }

  async function mudarStatus(i, status) {
    try {
      const novo = await api(`/itens/${i.id}/status`, { method: 'PATCH', body: { status } })
      itens.setDados((l) => l.map((x) => (x.id === i.id ? novo : x)))
      resumo.recarregar(true)
      toast(`“${i.titulo}” agora está ${status.toLowerCase()}.`)
    } catch (e) { toastErro(e) }
  }

  async function confirmarRemocao() {
    const alvo = remover
    try {
      await api(`/itens/${alvo.id}`, { method: 'DELETE' })
      atualizarTudo()
      toast(`“${alvo.titulo}” removido.`, {
        duracao: 7000,
        acao: { texto: 'Desfazer', fn: () => api(`/itens/${alvo.id}/restaurar`, { method: 'POST' }).then(atualizarTudo).catch(toastErro) },
      })
    } catch (e) { toastErro(e) }
  }

  async function alternarUsuario(u) {
    const alterar = (ativo) => api(`/admin/usuarios/${u.id}`, { method: 'PATCH', body: { ativo } })
      .then((novo) => usuarios.setDados((l) => l.map((x) => (x.id === u.id ? { ...x, ...novo } : x))))
    try {
      await alterar(!u.ativo)
      toast(u.ativo ? `${u.nome} foi suspenso(a).` : `${u.nome} foi reativado(a).`, { acao: { texto: 'Desfazer', fn: () => alterar(u.ativo).catch(toastErro) } })
    } catch (e) { toastErro(e) }
  }

  async function criarCategoria(e) {
    e.preventDefault()
    if (!novaCat.trim()) return
    try {
      const c = await api('/categorias', { method: 'POST', body: { nome: novaCat } })
      categorias.setDados((l) => [...l, c])
      setNovaCat('')
      toast(`Categoria “${c.nome}” criada.`)
    } catch (err) { toastErro(err) }
  }

  async function excluirCategoria(c) {
    try {
      await api(`/categorias/${c.id}`, { method: 'DELETE' })
      categorias.setDados((l) => l.filter((x) => x.id !== c.id))
      toast(`Categoria “${c.nome}” excluída.`)
    } catch (err) { toastErro(err) }
  }

  const r = resumo.dados
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Painel da Secretaria</h1>
          <p className="muted">Modere anúncios, acompanhe interessados e gerencie usuários.</p>
        </div>
        <Link to="/novo" className="btn btn-primary"><Plus size={18} aria-hidden="true" /> Novo item</Link>
      </div>

      <div className="stats" aria-busy={!r}>
        <div className="stat"><Package size={20} aria-hidden="true" /><b>{r?.disponiveis ?? '–'}</b><span>No mural</span></div>
        <div className="stat"><Heart size={20} aria-hidden="true" /><b>{r?.interessados ?? '–'}</b><span>Interessados</span></div>
        <div className="stat"><Clock size={20} aria-hidden="true" /><b>{r?.reservados ?? '–'}</b><span>Reservados</span></div>
        <div className="stat"><PackageCheck size={20} aria-hidden="true" /><b>{r?.entregues ?? '–'}</b><span>Entregues</span></div>
      </div>

      <div className="tabs" role="tablist" aria-label="Seções do painel">
        {[['itens', 'Anúncios'], ['usuarios', `Usuários${r ? ` (${r.usuarios})` : ''}`], ['categorias', 'Categorias']].map(([k, t]) => (
          <button key={k} role="tab" aria-selected={aba === k} className={`tab-btn ${aba === k ? 'is-on' : ''}`} onClick={() => setAba(k)}>{t}</button>
        ))}
      </div>

      {aba === 'itens' && (
        <>
          <div className="search-row">
            <div className="search">
              <Search size={18} aria-hidden="true" />
              <input type="search" maxLength={60} placeholder="Buscar anúncio" aria-label="Buscar anúncio" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <select aria-label="Filtrar por situação" value={statusF} onChange={(e) => setStatusF(e.target.value)} className="select-sm">
              <option value="todas">Todas</option>{STATUS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          {itens.erro ? <ErroCarga erro={itens.erro} onTentar={itens.recarregar} />
            : !itens.dados ? <Esqueleto linhas={4} tipo="lista" />
              : itens.dados.length ? (
                <ul className="admin-list">
                  {itens.dados.map((i) => (
                    <li key={i.id} className="card admin-row">
                      <Thumb item={i} />
                      <div className="admin-row-info">
                        <Link to={`/item/${i.id}`}><b>{i.titulo}</b></Link>
                        <small className="muted">{i.categoria} · {i.dono.nome} · {tempoRelativo(i.criadoEm)} · {i.interessados} interessado(s)</small>
                      </div>
                      <select aria-label={`Situação de ${i.titulo}`} value={i.status} className={`status-select st-${i.status}`} onChange={(e) => mudarStatus(i, e.target.value)}>
                        {STATUS.map((s) => <option key={s}>{s}</option>)}
                      </select>
                      <div className="admin-row-btns">
                        <Link to={`/editar/${i.id}`} className="btn btn-outline btn-sm"><Pencil size={16} aria-hidden="true" /> Editar</Link>
                        <button className="icon-btn danger" aria-label={`Remover ${i.titulo}`} title="Remover" onClick={() => setRemover(i)}><Trash2 size={18} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <Vazio titulo="Nenhum anúncio com esses filtros" />}
        </>
      )}

      {aba === 'usuarios' && (
        usuarios.erro ? <ErroCarga erro={usuarios.erro} onTentar={usuarios.recarregar} />
          : !usuarios.dados ? <Esqueleto linhas={4} tipo="lista" />
            : (
              <ul className="admin-list">
                {usuarios.dados.map((u) => (
                  <li key={u.id} className={`card admin-row ${u.ativo ? '' : 'is-muted'}`}>
                    <Avatar usuario={u} tamanho={44} />
                    <div className="admin-row-info">
                      <b>{u.nome}</b>
                      <small className="muted">{u.email}{u.telefone && ` · ${formatarTelefone(u.telefone)}`} · {PERFIS[u.perfil]} · {u.anuncios} anúncio(s)</small>
                    </div>
                    <Badge tom={u.ativo ? 'green' : 'gray'}>{u.ativo ? 'Ativo' : 'Suspenso'}</Badge>
                    <div className="admin-row-btns">
                      {u.id !== user.id && <button className="btn btn-outline btn-sm" onClick={() => alternarUsuario(u)}>{u.ativo ? 'Suspender' : 'Reativar'}</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )
      )}

      {aba === 'categorias' && (
        <>
          <form className="cat-form" onSubmit={criarCategoria}>
            <label htmlFor="nova-cat" className="sr-only">Nova categoria</label>
            <input id="nova-cat" placeholder="Nova categoria (ex: Calculadoras)" value={novaCat} onChange={(e) => setNovaCat(e.target.value)} maxLength={40} />
            <button className="btn btn-primary" disabled={!novaCat.trim()}><Plus size={18} aria-hidden="true" /> Adicionar</button>
          </form>
          {categorias.erro ? <ErroCarga erro={categorias.erro} onTentar={categorias.recarregar} />
            : !categorias.dados ? <Esqueleto linhas={4} tipo="lista" />
              : (
                <ul className="admin-list">
                  {categorias.dados.map((c) => (
                    <li key={c.id} className="card admin-row">
                      <span className="avatar" aria-hidden="true">{c.nome[0]}</span>
                      <div className="admin-row-info"><b>{c.nome}</b><small className="muted">{c.itens} item(ns)</small></div>
                      <div className="admin-row-btns">
                        <button className="icon-btn danger" aria-label={`Excluir categoria ${c.nome}`} title={c.itens ? 'Só é possível excluir categorias sem itens' : 'Excluir'}
                          disabled={c.itens > 0} onClick={() => excluirCategoria(c)}><Trash2 size={18} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
        </>
      )}

      <Confirmar aberto={!!remover} onClose={() => setRemover(null)} onConfirm={confirmarRemocao} perigo confirmar="Remover"
        titulo="Remover anúncio?" texto={remover ? `“${remover.titulo}” sairá do mural. Dá para desfazer logo em seguida.` : ''} />
    </div>
  )
}
