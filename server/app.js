import express from 'express'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import { query, transaction } from './db.js'
import {
  carregarUsuario, emitirSessao, encerrarSessao, exigirAdmin, exigirLogin, usuarioPublico,
} from './auth.js'
import { erroTelefone, somenteDigitos } from '../src/utils/telefone.js'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '4mb' }))
app.use(cookieParser())
app.use(carregarUsuario)

const ESTADOS = ['Novo', 'Bom estado', 'Pouco uso', 'Com marcas']
const TIPOS = ['Doação', 'Troca']
const STATUS = ['Disponível', 'Reservado', 'Entregue']
const PERFIS_CADASTRO = ['responsavel', 'aluno', 'funcionario']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ACENTOS = ['áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc']

// Envolve rotas async para que erros caiam no tratador no final do arquivo
const r = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
const falha = (res, status, erro, campo) => res.status(status).json({ erro, campo })
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

// Valida :id antes de consultar o banco (evita erro de UUID inválido)
app.param('id', (req, res, next, id) => (UUID.test(id) ? next() : falha(res, 404, 'Não encontrado.')))

/* ============================== AUTENTICAÇÃO ============================== */

app.post('/api/auth/cadastro', r(async (req, res) => {
  const nome = texto(req.body.nome, 120)
  const email = texto(req.body.email, 160).toLowerCase()
  const senha = typeof req.body.senha === 'string' ? req.body.senha : ''
  const telefone = somenteDigitos(texto(req.body.telefone, 40))
  const perfil = PERFIS_CADASTRO.includes(req.body.perfil) ? req.body.perfil : 'responsavel'

  if (nome.split(/\s+/).length < 2) return falha(res, 400, 'Informe nome e sobrenome.', 'nome')
  if (!emailValido(email)) return falha(res, 400, 'E-mail inválido. Exemplo: seu@gmail.com', 'email')
  if (erroTelefone(telefone)) return falha(res, 400, erroTelefone(telefone), 'telefone')
  if (senha.length < 6) return falha(res, 400, 'A senha precisa ter pelo menos 6 caracteres.', 'senha')
  if (senha.length > 72) return falha(res, 400, 'A senha pode ter no máximo 72 caracteres.', 'senha')

  const existe = await query('SELECT 1 FROM usuarios WHERE email = $1', [email])
  if (existe.rowCount) return falha(res, 409, 'Já existe uma conta com este e-mail. Que tal entrar?', 'email')

  const hash = await bcrypt.hash(senha, 10)
  const { rows } = await query(
    'INSERT INTO usuarios (nome, email, senha_hash, telefone, perfil) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [nome, email, hash, telefone || null, perfil])
  emitirSessao(res, rows[0])
  res.status(201).json({ usuario: usuarioPublico(rows[0]) })
}))

app.post('/api/auth/login', r(async (req, res) => {
  const email = texto(req.body.email, 160).toLowerCase()
  const senha = typeof req.body.senha === 'string' ? req.body.senha : ''
  if (!emailValido(email)) return falha(res, 400, 'E-mail inválido. Exemplo: seu@gmail.com', 'email')
  if (!senha) return falha(res, 400, 'Informe sua senha.', 'senha')

  const { rows } = await query('SELECT * FROM usuarios WHERE email = $1', [email])
  const u = rows[0]
  if (!u) return falha(res, 401, 'Não encontramos uma conta com este e-mail.', 'email')
  if (!(await bcrypt.compare(senha, u.senha_hash))) return falha(res, 401, 'Senha incorreta. Confira e tente de novo.', 'senha')
  if (!u.ativo) return falha(res, 403, 'Esta conta foi suspensa pela secretaria.', 'email')
  emitirSessao(res, u)
  res.json({ usuario: usuarioPublico(u) })
}))

app.post('/api/auth/logout', (req, res) => {
  encerrarSessao(res)
  res.json({ ok: true })
})

app.get('/api/auth/me', (req, res) => {
  res.json({ usuario: usuarioPublico(req.usuario) })
})

app.patch('/api/auth/senha', exigirLogin, r(async (req, res) => {
  const { atual = '', nova = '' } = req.body
  if (!(await bcrypt.compare(String(atual), req.usuario.senha_hash))) return falha(res, 400, 'A senha atual está incorreta.', 'atual')
  if (String(nova).length < 6) return falha(res, 400, 'A nova senha precisa ter pelo menos 6 caracteres.', 'nova')
  if (String(nova).length > 72) return falha(res, 400, 'A nova senha pode ter no máximo 72 caracteres.', 'nova')
  await query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [await bcrypt.hash(String(nova), 10), req.usuario.id])
  res.json({ ok: true })
}))

app.patch('/api/auth/perfil', exigirLogin, r(async (req, res) => {
  const nome = texto(req.body.nome, 120)
  const telefone = somenteDigitos(texto(req.body.telefone, 40))
  if (nome.split(/\s+/).length < 2) return falha(res, 400, 'Informe nome e sobrenome.', 'nome')
  if (erroTelefone(telefone)) return falha(res, 400, erroTelefone(telefone), 'telefone')
  const { rows } = await query('UPDATE usuarios SET nome = $1, telefone = $2 WHERE id = $3 RETURNING *', [nome, telefone || null, req.usuario.id])
  res.json({ usuario: usuarioPublico(rows[0]) })
}))

/* ============================== CATEGORIAS ============================== */

app.get('/api/categorias', r(async (_req, res) => {
  const { rows } = await query(`SELECT c.id, c.nome, count(i.id)::int AS itens
    FROM categorias c LEFT JOIN itens i ON i.categoria_id = c.id AND i.removido_em IS NULL
    GROUP BY c.id ORDER BY c.ordem, c.nome`)
  res.json(rows)
}))

app.post('/api/categorias', exigirAdmin, r(async (req, res) => {
  const nome = texto(req.body.nome, 40)
  if (nome.length < 2) return falha(res, 400, 'Informe o nome da categoria.', 'nome')
  const { rows } = await query(
    `INSERT INTO categorias (nome, ordem) VALUES ($1, (SELECT coalesce(max(ordem), 0) + 1 FROM categorias))
     ON CONFLICT (nome) DO NOTHING RETURNING id, nome`, [nome])
  if (!rows[0]) return falha(res, 409, 'Essa categoria já existe.', 'nome')
  res.status(201).json({ ...rows[0], itens: 0 })
}))

app.delete('/api/categorias/:catId', exigirAdmin, r(async (req, res) => {
  const id = Number(req.params.catId)
  const uso = await query('SELECT count(*)::int AS n FROM itens WHERE categoria_id = $1', [id])
  if (uso.rows[0].n > 0) return falha(res, 409, `Não é possível excluir: ${uso.rows[0].n} item(ns) usam esta categoria.`)
  await query('DELETE FROM categorias WHERE id = $1', [id])
  res.json({ ok: true })
}))

/* ================================ ITENS ================================ */

const SELECT_ITEM = `
  SELECT i.id, i.titulo, i.descricao, i.categoria_id, c.nome AS categoria, i.tipo, i.estado_conservacao,
         i.tamanho, i.observacoes, i.retirada_secretaria, i.status, i.criado_em, i.dono_id,
         u.nome AS dono_nome, u.perfil AS dono_perfil, u.telefone AS dono_telefone,
         (SELECT count(*)::int FROM interesses x WHERE x.item_id = i.id) AS interessados,
         (SELECT coalesce(array_agg(f.id ORDER BY f.ordem), '{}') FROM fotos f WHERE f.item_id = i.id) AS foto_ids,
         EXISTS (SELECT 1 FROM interesses x WHERE x.item_id = i.id AND x.usuario_id = $1::uuid) AS eu_interessado
  FROM itens i
  JOIN categorias c ON c.id = i.categoria_id
  JOIN usuarios u ON u.id = i.dono_id`

function serializarItem(row, usuario) {
  const fotos = (row.foto_ids || []).map((id) => `/api/fotos/${id}`)
  const souDono = usuario?.id === row.dono_id
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    categoriaId: row.categoria_id,
    categoria: row.categoria,
    tipo: row.tipo,
    estado: row.estado_conservacao,
    tamanho: row.tamanho,
    observacoes: row.observacoes,
    retiradaSecretaria: row.retirada_secretaria,
    status: row.status,
    criadoEm: row.criado_em,
    fotos,
    capa: fotos[0] || null,
    interessados: row.interessados,
    euInteressado: row.eu_interessado,
    souDono,
    podeGerenciar: souDono || usuario?.perfil === 'admin',
    dono: {
      id: row.dono_id,
      nome: row.dono_nome,
      perfil: row.dono_perfil,
      // telefone só aparece para quem está logado (privacidade)
      telefone: usuario ? row.dono_telefone : null,
      temWhatsapp: !!row.dono_telefone,
    },
  }
}

async function buscarItem(id, usuario) {
  const { rows } = await query(`${SELECT_ITEM} WHERE i.id = $2 AND i.removido_em IS NULL`, [usuario?.id || null, id])
  return rows[0] ? serializarItem(rows[0], usuario) : null
}

// GET /api/itens?q=&cat=&tipo=&estado=&situacao=Disponível|Reservado|Entregue|todas&dono=eu&interesse=eu
app.get('/api/itens', r(async (req, res) => {
  const p = [req.usuario?.id || null]
  const where = ['i.removido_em IS NULL']
  const add = (sql, v) => { p.push(v); where.push(sql.replace('?', `$${p.length}`)) }

  const q = texto(req.query.q, 60).toLowerCase()
  if (q) add(`translate(lower(i.titulo || ' ' || i.descricao || ' ' || c.nome), '${ACENTOS[0]}', '${ACENTOS[1]}') LIKE ?`,
    `%${q.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[%_]/g, '')}%`)
  if (req.query.cat && req.query.cat !== 'Todos') add('c.nome = ?', String(req.query.cat))
  if (TIPOS.includes(req.query.tipo)) add('i.tipo = ?', req.query.tipo)
  if (ESTADOS.includes(req.query.estado)) add('i.estado_conservacao = ?', req.query.estado)
  const situacao = req.query.situacao || 'Disponível'
  if (STATUS.includes(situacao)) add('i.status = ?', situacao)

  if (req.query.dono === 'eu' || req.query.interesse === 'eu') {
    if (!req.usuario) return falha(res, 401, 'Entre na sua conta para continuar.')
    if (req.query.dono === 'eu') add('i.dono_id = ?', req.usuario.id)
    else add('EXISTS (SELECT 1 FROM interesses x WHERE x.item_id = i.id AND x.usuario_id = ?)', req.usuario.id)
  }

  const { rows } = await query(`${SELECT_ITEM} WHERE ${where.join(' AND ')} ORDER BY i.criado_em DESC LIMIT 200`, p)
  res.json(rows.map((x) => serializarItem(x, req.usuario)))
}))

app.get('/api/itens/:id', r(async (req, res) => {
  const item = await buscarItem(req.params.id, req.usuario)
  if (!item) return falha(res, 404, 'Item não encontrado. Ele pode ter sido removido.')
  res.json(item)
}))

const FOTO_DATAURL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/
const FOTO_EXISTENTE = /^\/api\/fotos\/([0-9a-f-]{36})$/i

async function validarItem(body) {
  const d = {
    titulo: texto(body.titulo, 60),
    descricao: texto(body.descricao, 400),
    categoriaId: Number(body.categoriaId),
    tipo: body.tipo,
    estado: body.estado,
    tamanho: texto(body.tamanho, 20),
    observacoes: texto(body.observacoes, 140),
    retiradaSecretaria: body.retiradaSecretaria !== false,
  }
  if (d.titulo.length < 3) return { erro: 'Dê um nome ao item (mínimo 3 letras).', campo: 'titulo' }
  const cat = await query('SELECT 1 FROM categorias WHERE id = $1', [d.categoriaId || 0])
  if (!cat.rowCount) return { erro: 'Escolha uma categoria.', campo: 'categoria' }
  if (!ESTADOS.includes(d.estado)) return { erro: 'Informe o estado de conservação.', campo: 'estado' }
  if (!TIPOS.includes(d.tipo)) return { erro: 'Escolha Doação ou Troca.', campo: 'tipo' }

  const fotos = Array.isArray(body.fotos) ? body.fotos.slice(0, 4) : []
  d.fotos = []
  for (const f of fotos) {
    const nova = typeof f === 'string' && f.match(FOTO_DATAURL)
    const velha = typeof f === 'string' && f.match(FOTO_EXISTENTE)
    if (nova) {
      const dados = Buffer.from(nova[2], 'base64')
      if (dados.length > 1_500_000) return { erro: 'Uma das fotos é grande demais (máx. 1,5 MB).', campo: 'fotos' }
      d.fotos.push({ mime: nova[1], dados })
    } else if (velha) {
      d.fotos.push({ id: velha[1] })
    } else {
      return { erro: 'Formato de foto inválido. Use JPG, PNG ou WEBP.', campo: 'fotos' }
    }
  }
  return { dados: d }
}

async function salvarFotos(client, itemId, fotos) {
  const manter = fotos.filter((f) => f.id).map((f) => f.id)
  await client.query('DELETE FROM fotos WHERE item_id = $1 AND NOT (id = ANY($2::uuid[]))', [itemId, manter])
  for (const [ordem, f] of fotos.entries()) {
    if (f.id) await client.query('UPDATE fotos SET ordem = $1 WHERE id = $2 AND item_id = $3', [ordem, f.id, itemId])
    else await client.query('INSERT INTO fotos (item_id, ordem, mime, dados) VALUES ($1,$2,$3,$4)', [itemId, ordem, f.mime, f.dados])
  }
}

app.post('/api/itens', exigirLogin, r(async (req, res) => {
  const v = await validarItem(req.body)
  if (v.erro) return falha(res, 400, v.erro, v.campo)
  const d = v.dados
  const id = await transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO itens (titulo, descricao, categoria_id, tipo, estado_conservacao, tamanho, observacoes, retirada_secretaria, dono_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [d.titulo, d.descricao, d.categoriaId, d.tipo, d.estado, d.tamanho, d.observacoes, d.retiradaSecretaria, req.usuario.id])
    await salvarFotos(client, rows[0].id, d.fotos)
    return rows[0].id
  })
  res.status(201).json(await buscarItem(id, req.usuario))
}))

async function exigirGerencia(req, res) {
  const { rows } = await query('SELECT dono_id FROM itens WHERE id = $1', [req.params.id])
  if (!rows[0]) { falha(res, 404, 'Item não encontrado.'); return false }
  if (rows[0].dono_id !== req.usuario.id && req.usuario.perfil !== 'admin') {
    falha(res, 403, 'Só quem publicou ou a secretaria pode alterar este item.'); return false
  }
  return true
}

app.put('/api/itens/:id', exigirLogin, r(async (req, res) => {
  if (!(await exigirGerencia(req, res))) return
  const v = await validarItem(req.body)
  if (v.erro) return falha(res, 400, v.erro, v.campo)
  const d = v.dados
  await transaction(async (client) => {
    await client.query(
      `UPDATE itens SET titulo=$1, descricao=$2, categoria_id=$3, tipo=$4, estado_conservacao=$5, tamanho=$6,
         observacoes=$7, retirada_secretaria=$8, atualizado_em=now() WHERE id=$9`,
      [d.titulo, d.descricao, d.categoriaId, d.tipo, d.estado, d.tamanho, d.observacoes, d.retiradaSecretaria, req.params.id])
    await salvarFotos(client, req.params.id, d.fotos)
  })
  res.json(await buscarItem(req.params.id, req.usuario))
}))

app.patch('/api/itens/:id/status', exigirLogin, r(async (req, res) => {
  if (!STATUS.includes(req.body.status)) return falha(res, 400, 'Situação inválida.')
  if (!(await exigirGerencia(req, res))) return
  await query('UPDATE itens SET status = $1, atualizado_em = now() WHERE id = $2', [req.body.status, req.params.id])
  res.json(await buscarItem(req.params.id, req.usuario))
}))

// Remoção lógica: o item some do mural mas pode ser restaurado ("Desfazer")
app.delete('/api/itens/:id', exigirLogin, r(async (req, res) => {
  if (!(await exigirGerencia(req, res))) return
  await query('UPDATE itens SET removido_em = now() WHERE id = $1', [req.params.id])
  res.json({ ok: true })
}))

app.post('/api/itens/:id/restaurar', exigirLogin, r(async (req, res) => {
  if (!(await exigirGerencia(req, res))) return
  await query('UPDATE itens SET removido_em = NULL WHERE id = $1', [req.params.id])
  res.json(await buscarItem(req.params.id, req.usuario))
}))

// Liga/desliga o interesse do usuário logado no item
app.post('/api/itens/:id/interesse', exigirLogin, r(async (req, res) => {
  const item = await buscarItem(req.params.id, req.usuario)
  if (!item) return falha(res, 404, 'Item não encontrado.')
  if (item.souDono) return falha(res, 400, 'Você não pode demonstrar interesse no seu próprio item.')
  if (item.euInteressado) {
    await query('DELETE FROM interesses WHERE item_id = $1 AND usuario_id = $2', [req.params.id, req.usuario.id])
  } else {
    if (item.status === 'Entregue') return falha(res, 400, 'Este item já foi entregue.')
    await query('INSERT INTO interesses (item_id, usuario_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, req.usuario.id])
  }
  res.json(await buscarItem(req.params.id, req.usuario))
}))

app.get('/api/itens/:id/interessados', exigirLogin, r(async (req, res) => {
  if (!(await exigirGerencia(req, res))) return
  const { rows } = await query(
    `SELECT u.id, u.nome, u.perfil, x.data FROM interesses x JOIN usuarios u ON u.id = x.usuario_id
     WHERE x.item_id = $1 ORDER BY x.data`, [req.params.id])
  res.json(rows)
}))

/* ================================ FOTOS ================================ */

app.get('/api/fotos/:id', r(async (req, res) => {
  const { rows } = await query('SELECT mime, dados FROM fotos WHERE id = $1', [req.params.id])
  if (!rows[0]) return res.status(404).end()
  res.set('Content-Type', rows[0].mime)
  res.set('Cache-Control', 'public, max-age=31536000, immutable') // cada foto tem id próprio e nunca muda
  res.send(rows[0].dados)
}))

/* ============================== CONVERSAS ============================== */

app.get('/api/conversas', exigirLogin, r(async (req, res) => {
  const { rows } = await query(`
    SELECT c.id, c.item_id, i.titulo, i.status, i.categoria_id, cat.nome AS categoria,
           (SELECT f.id FROM fotos f WHERE f.item_id = i.id ORDER BY f.ordem LIMIT 1) AS capa_id,
           o.id AS outro_id, o.nome AS outro_nome,
           m.conteudo AS ultima, m.autor_id AS ultima_autor, m.enviada_em AS ultima_em,
           (SELECT count(*)::int FROM mensagens x WHERE x.conversa_id = c.id AND x.autor_id <> $1 AND NOT x.lida) AS nao_lidas
    FROM conversas c
    JOIN itens i ON i.id = c.item_id
    JOIN categorias cat ON cat.id = i.categoria_id
    JOIN usuarios o ON o.id = CASE WHEN c.dono_id = $1 THEN c.interessado_id ELSE c.dono_id END
    LEFT JOIN LATERAL (SELECT * FROM mensagens WHERE conversa_id = c.id ORDER BY enviada_em DESC LIMIT 1) m ON TRUE
    WHERE $1 IN (c.dono_id, c.interessado_id)
    ORDER BY coalesce(m.enviada_em, c.iniciada_em) DESC`, [req.usuario.id])
  res.json(rows.map((x) => ({
    id: x.id,
    item: { id: x.item_id, titulo: x.titulo, status: x.status, categoria: x.categoria, capa: x.capa_id ? `/api/fotos/${x.capa_id}` : null },
    outro: { id: x.outro_id, nome: x.outro_nome },
    ultima: x.ultima ? { texto: x.ultima, minha: x.ultima_autor === req.usuario.id, em: x.ultima_em } : null,
    naoLidas: x.nao_lidas,
  })))
}))

// Abre (ou reaproveita) a conversa do usuário logado sobre um item
app.post('/api/conversas', exigirLogin, r(async (req, res) => {
  const itemId = String(req.body.itemId || '')
  if (!UUID.test(itemId)) return falha(res, 400, 'Item inválido.')
  const { rows: it } = await query('SELECT dono_id FROM itens WHERE id = $1 AND removido_em IS NULL', [itemId])
  if (!it[0]) return falha(res, 404, 'Item não encontrado.')
  if (it[0].dono_id === req.usuario.id) return falha(res, 400, 'Este item é seu. As conversas aparecem quando alguém te chamar.')
  const { rows } = await query(
    `INSERT INTO conversas (item_id, interessado_id, dono_id) VALUES ($1,$2,$3)
     ON CONFLICT (item_id, interessado_id) DO UPDATE SET item_id = EXCLUDED.item_id RETURNING id`,
    [itemId, req.usuario.id, it[0].dono_id])
  res.json({ id: rows[0].id })
}))

async function minhaConversa(req, res) {
  const { rows } = await query('SELECT * FROM conversas WHERE id = $1 AND $2 IN (dono_id, interessado_id)', [req.params.id, req.usuario.id])
  if (!rows[0]) falha(res, 404, 'Conversa não encontrada.')
  return rows[0]
}

// Retorna a conversa com as mensagens e marca como lidas as recebidas
app.get('/api/conversas/:id', exigirLogin, r(async (req, res) => {
  const c = await minhaConversa(req, res)
  if (!c) return
  await query('UPDATE mensagens SET lida = TRUE WHERE conversa_id = $1 AND autor_id <> $2 AND NOT lida', [c.id, req.usuario.id])
  const outroId = c.dono_id === req.usuario.id ? c.interessado_id : c.dono_id
  const [item, outro, msgs] = await Promise.all([
    buscarItem(c.item_id, req.usuario),
    query('SELECT id, nome, perfil FROM usuarios WHERE id = $1', [outroId]),
    query('SELECT id, autor_id, conteudo, enviada_em, lida FROM mensagens WHERE conversa_id = $1 ORDER BY enviada_em', [c.id]),
  ])
  res.json({
    id: c.id,
    item,
    outro: outro.rows[0],
    mensagens: msgs.rows.map((m) => ({ id: m.id, texto: m.conteudo, em: m.enviada_em, lida: m.lida, minha: m.autor_id === req.usuario.id })),
  })
}))

app.post('/api/conversas/:id/mensagens', exigirLogin, r(async (req, res) => {
  const c = await minhaConversa(req, res)
  if (!c) return
  const conteudo = texto(req.body.texto, 500)
  if (!conteudo) return falha(res, 400, 'Escreva uma mensagem.')
  const { rows } = await query(
    'INSERT INTO mensagens (conversa_id, autor_id, conteudo) VALUES ($1,$2,$3) RETURNING id, conteudo, enviada_em, lida',
    [c.id, req.usuario.id, conteudo])
  const m = rows[0]
  res.status(201).json({ id: m.id, texto: m.conteudo, em: m.enviada_em, lida: m.lida, minha: true })
}))

app.get('/api/notificacoes', r(async (req, res) => {
  if (!req.usuario) return res.json({ naoLidas: 0 })
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM mensagens m JOIN conversas c ON c.id = m.conversa_id
     WHERE $1 IN (c.dono_id, c.interessado_id) AND m.autor_id <> $1 AND NOT m.lida`, [req.usuario.id])
  res.json({ naoLidas: rows[0].n })
}))

/* ============================ PAINEL (ADMIN) ============================ */

app.get('/api/admin/resumo', exigirAdmin, r(async (_req, res) => {
  const { rows } = await query(`
    SELECT
      count(*) FILTER (WHERE status = 'Disponível')::int AS disponiveis,
      count(*) FILTER (WHERE status = 'Reservado')::int AS reservados,
      count(*) FILTER (WHERE status = 'Entregue')::int AS entregues,
      (SELECT count(*)::int FROM interesses x JOIN itens j ON j.id = x.item_id WHERE j.removido_em IS NULL) AS interessados,
      (SELECT count(*)::int FROM usuarios) AS usuarios
    FROM itens WHERE removido_em IS NULL`)
  res.json(rows[0])
}))

app.get('/api/admin/usuarios', exigirAdmin, r(async (_req, res) => {
  const { rows } = await query(`
    SELECT u.id, u.nome, u.email, u.telefone, u.perfil, u.ativo, u.data_cadastro,
           (SELECT count(*)::int FROM itens i WHERE i.dono_id = u.id AND i.removido_em IS NULL) AS anuncios
    FROM usuarios u ORDER BY u.data_cadastro DESC`)
  res.json(rows)
}))

app.patch('/api/admin/usuarios/:id', exigirAdmin, r(async (req, res) => {
  if (req.params.id === req.usuario.id) return falha(res, 400, 'Você não pode alterar a sua própria conta por aqui.')
  const sets = []
  const p = []
  if (typeof req.body.ativo === 'boolean') { p.push(req.body.ativo); sets.push(`ativo = $${p.length}`) }
  if ([...PERFIS_CADASTRO, 'admin'].includes(req.body.perfil)) { p.push(req.body.perfil); sets.push(`perfil = $${p.length}`) }
  if (!sets.length) return falha(res, 400, 'Nada para alterar.')
  p.push(req.params.id)
  const { rows } = await query(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = $${p.length} RETURNING id, nome, email, telefone, perfil, ativo, data_cadastro`, p)
  if (!rows[0]) return falha(res, 404, 'Usuário não encontrado.')
  res.json(rows[0])
}))

/* ============================ ERROS E 404 ============================ */

app.use('/api', (_req, res) => falha(res, 404, 'Rota da API não encontrada.'))

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return falha(res, 413, 'Envio grande demais. Use fotos menores ou menos fotos.')
  console.error(err)
  const semBanco = /DATABASE_URL|ECONNREFUSED|ENOTFOUND|password authentication/i.test(err.message)
  falha(res, 500, semBanco
    ? 'Não foi possível conectar ao banco de dados. Verifique a configuração no Vercel.'
    : 'Algo deu errado no servidor. Tente de novo em instantes.')
})

export default app
