import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { query } from './db.js'

const COOKIE = 'reuse_token'
const DURACAO_DIAS = 7

// Use JWT_SECRET nas variáveis de ambiente do Vercel. Se não existir, deriva uma chave
// da URL do banco (que já é secreta) para o site não quebrar no primeiro deploy.
function segredo() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  const base = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'dev-local'
  return crypto.createHash('sha256').update(`reuse-escolar:${base}`).digest('hex')
}

export function emitirSessao(res, usuario) {
  const token = jwt.sign({ sub: usuario.id }, segredo(), { expiresIn: `${DURACAO_DIAS}d` })
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' || !!process.env.VERCEL,
    maxAge: DURACAO_DIAS * 24 * 3600 * 1000,
    path: '/',
  })
}

export function encerrarSessao(res) {
  res.clearCookie(COOKIE, { path: '/' })
}

export const usuarioPublico = (u) => u && ({
  id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, perfil: u.perfil, ativo: u.ativo,
})

// Lê o cookie em toda requisição e carrega o usuário (ou null)
export async function carregarUsuario(req, _res, next) {
  req.usuario = null
  const token = req.cookies?.[COOKIE]
  if (!token) return next()
  try {
    const { sub } = jwt.verify(token, segredo())
    const { rows } = await query('SELECT * FROM usuarios WHERE id = $1', [sub])
    if (rows[0]?.ativo) req.usuario = rows[0]
  } catch { /* token inválido ou expirado: segue como visitante */ }
  next()
}

export function exigirLogin(req, res, next) {
  if (!req.usuario) return res.status(401).json({ erro: 'Entre na sua conta para continuar.' })
  next()
}

export function exigirAdmin(req, res, next) {
  if (!req.usuario) return res.status(401).json({ erro: 'Entre na sua conta para continuar.' })
  if (req.usuario.perfil !== 'admin') return res.status(403).json({ erro: 'Acesso exclusivo da secretaria.' })
  next()
}
