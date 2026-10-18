import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CircleAlert, ImagePlus, X } from 'lucide-react'
import { comprimirImagem, useStore } from '../store'
import { api, useApi } from '../api'
import { ESTADOS, TIPOS } from '../data/constantes'
import { Campo, Carregando, Chips, ErroCarga, ItemCard } from '../components/ui'

const VAZIO = { titulo: '', categoriaId: '', estado: 'Bom estado', tipo: 'Doação', tamanho: '', descricao: '', observacoes: '', retiradaSecretaria: true, fotos: [] }
const MAX_FOTOS = 4

export default function ItemForm() {
  const { id } = useParams()
  const existente = useApi(id ? `/itens/${id}` : null)
  if (!id) return <Formulario />
  if (existente.erro) return <div className="page"><ErroCarga erro={existente.erro} onTentar={existente.recarregar} /></div>
  if (!existente.dados) return <Carregando texto="Carregando item..." />
  if (!existente.dados.podeGerenciar) return <div className="page"><ErroCarga erro={{ message: 'Só quem publicou ou a secretaria pode editar este item.' }} /></div>
  return <Formulario existente={existente.dados} />
}

function Formulario({ existente }) {
  const id = existente?.id
  const nav = useNavigate()
  const { toast, toastErro } = useStore()
  const { dados: categorias } = useApi('/categorias')
  const [f, setF] = useState(() => (existente ? { ...VAZIO, ...existente } : VAZIO))
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState({})
  const [carregando, setCarregando] = useState(false)
  const [sujo, setSujo] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!sujo) return
    const h = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [sujo])

  const set = (k) => (v) => { setF((x) => ({ ...x, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v })); setSujo(true) }

  async function addFotos(e) {
    const files = [...e.target.files].slice(0, MAX_FOTOS - f.fotos.length)
    e.target.value = ''
    if (!files.length) return
    const invalidos = files.filter((x) => !x.type.startsWith('image/'))
    if (invalidos.length) return toast('Escolha apenas arquivos de imagem (JPG, PNG...).', { tipo: 'erro' })
    setCarregando(true)
    try {
      const novas = await Promise.all(files.map((x) => comprimirImagem(x)))
      setF((x) => ({ ...x, fotos: [...x.fotos, ...novas] }))
      setSujo(true)
    } catch {
      toast('Não foi possível ler uma das imagens.', { tipo: 'erro' })
    } finally { setCarregando(false) }
  }

  async function salvar(e) {
    e.preventDefault()
    const er = {}
    if (f.titulo.trim().length < 3) er.titulo = 'Dê um nome ao item (mínimo 3 letras).'
    if (!f.categoriaId) er.categoria = 'Escolha uma categoria.'
    if (!f.estado) er.estado = 'Informe o estado de conservação.'
    setErros(er)
    if (Object.keys(er).length) {
      document.getElementById(Object.keys(er)[0])?.focus()
      return
    }
    const corpo = {
      titulo: f.titulo, descricao: f.descricao, categoriaId: Number(f.categoriaId), tipo: f.tipo, estado: f.estado,
      tamanho: f.tamanho, observacoes: f.observacoes, retiradaSecretaria: f.retiradaSecretaria, fotos: f.fotos,
    }
    setSalvando(true)
    try {
      const salvo = await api(existente ? `/itens/${id}` : '/itens', { method: existente ? 'PUT' : 'POST', body: corpo })
      setSujo(false)
      toast(existente ? 'Alterações salvas.' : 'Item publicado no mural!')
      nav(`/item/${salvo.id}`, { replace: true })
    } catch (err) {
      if (err.campo) setErros({ [err.campo]: err.message })
      toastErro(err)
    } finally {
      setSalvando(false)
    }
  }

  const nomeCat = categorias?.find((c) => String(c.id) === String(f.categoriaId))?.nome
  const preview = { ...f, id: 'preview', interessados: 0, status: 'Disponível', capa: f.fotos[0], titulo: f.titulo || 'Nome do item', categoria: nomeCat || 'Papelaria' }
  const nErros = Object.keys(erros).length

  return (
    <div className="page">
      <button className="back-link" onClick={() => nav(-1)}><ArrowLeft size={18} aria-hidden="true" /> Voltar</button>
      <h1>{existente ? 'Editar item' : 'Novo item'}</h1>
      <p className="muted">Campos com <span className="req">*</span> são obrigatórios.</p>

      <div className="form-layout">
        <form className="card form" onSubmit={salvar} noValidate>
          {nErros > 0 && (
            <div className="banner banner-danger" role="alert">
              <CircleAlert size={18} aria-hidden="true" /> Corrija {nErros === 1 ? 'o campo destacado' : `os ${nErros} campos destacados`} para publicar.
            </div>
          )}

          <div className="field">
            <span className="label">Fotos <small className="muted">({f.fotos.length}/{MAX_FOTOS})</small></span>
            <div className="photos">
              {f.fotos.map((src, i) => (
                <div className="photo" key={i}>
                  <img src={src} alt={`Foto ${i + 1}`} />
                  <button type="button" className="photo-x" aria-label={`Remover foto ${i + 1}`}
                    onClick={() => { setF((x) => ({ ...x, fotos: x.fotos.filter((_, j) => j !== i) })); setSujo(true) }}><X size={14} /></button>
                </div>
              ))}
              {f.fotos.length < MAX_FOTOS && (
                <button type="button" className="photo-add" onClick={() => fileRef.current.click()} disabled={carregando}>
                  <ImagePlus size={24} aria-hidden="true" />
                  <span>{carregando ? 'Carregando...' : 'Adicionar fotos'}</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={addFotos} />
            {erros.fotos && <p className="field-error" role="alert"><CircleAlert size={14} aria-hidden="true" /> {erros.fotos}</p>}
            <p className="field-hint">Fotos reais ajudam a evitar mal-entendidos sobre o estado do item.</p>
          </div>

          <Campo id="titulo" label="Nome do item" erro={erros.titulo} obrigatorio>
            <input id="titulo" placeholder="Ex: Mochila azul" value={f.titulo} onChange={set('titulo')} maxLength={60} aria-invalid={!!erros.titulo || undefined} />
          </Campo>

          <div className="two-cols">
            <Campo id="categoria" label="Categoria" erro={erros.categoria} obrigatorio>
              <select id="categoria" value={f.categoriaId} onChange={set('categoriaId')} aria-invalid={!!erros.categoria || undefined}>
                <option value="">{categorias ? 'Escolher categoria' : 'Carregando...'}</option>
                {(categorias || []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>
            <Campo id="tamanho" label="Tamanho" dica="Para uniformes e mochilas.">
              <input id="tamanho" placeholder="Ex: 12, P, M" value={f.tamanho} onChange={set('tamanho')} maxLength={20} />
            </Campo>
          </div>

          <div className={`field ${erros.estado ? 'has-error' : ''}`}>
            <span className="label" id="estado">Estado de conservação <span className="req">*</span></span>
            <Chips label="Estado de conservação" valor={f.estado} onChange={set('estado')} opcoes={ESTADOS} />
          </div>

          <div className="field">
            <span className="label">Tipo</span>
            <Chips label="Tipo" valor={f.tipo} onChange={set('tipo')} opcoes={TIPOS} />
            {f.tipo === 'Troca' && <p className="field-hint">Diga na descrição o que você aceita em troca.</p>}
          </div>

          <Campo id="descricao" label="Descrição">
            <textarea id="descricao" rows={3} placeholder="Conte como é o item" value={f.descricao} onChange={set('descricao')} maxLength={400} />
          </Campo>
          <Campo id="observacoes" label="Observações" dica="Rasgos, bordados, nome escrito, marcas de uso.">
            <input id="observacoes" placeholder="Rasgos, bordados, tamanho" value={f.observacoes} onChange={set('observacoes')} maxLength={140} />
          </Campo>

          <label className="switch">
            <input type="checkbox" checked={f.retiradaSecretaria} onChange={set('retiradaSecretaria')} />
            <span className="switch-ui" aria-hidden="true" /> Disponível para retirada na secretaria
          </label>

          <div className="row-btns end">
            <Link to={existente ? `/item/${id}` : '/'} className="btn btn-ghost">Cancelar</Link>
            <button className="btn btn-primary" type="submit" disabled={carregando || salvando}>
              {salvando ? <><span className="spinner" aria-hidden="true" /> Salvando...</> : existente ? 'Salvar alterações' : 'Publicar'}
            </button>
          </div>
        </form>

        <aside className="preview hide-mobile" aria-label="Pré-visualização">
          <p className="label">Como vai aparecer no mural</p>
          <div className="preview-card"><ItemCard item={preview} /></div>
        </aside>
      </div>
    </div>
  )
}
