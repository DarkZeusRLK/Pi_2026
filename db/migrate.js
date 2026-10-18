// Cria as tabelas e, se o banco estiver vazio, insere categorias e dados de exemplo.
// Roda automaticamente no build do Vercel (npm run build) e pode ser executado à mão: npm run db:migrate
import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL
if (!url) {
  console.warn('\n⚠  DATABASE_URL não encontrada — pulando a criação das tabelas.')
  console.warn('   Conecte o banco Neon em Vercel › Storage e faça um novo deploy.\n')
  process.exit(0)
}

const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : true })
await client.connect()

try {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8')
  await client.query(schema)
  console.log('✓ Tabelas verificadas/criadas')

  const { rows } = await client.query('SELECT count(*)::int AS n FROM usuarios')
  if (rows[0].n > 0) {
    console.log('✓ Banco já possui dados — seed ignorado')
  } else {
    await seed()
    console.log('✓ Dados de exemplo inseridos')
  }
} finally {
  await client.end()
}

async function seed() {
  const CATS = ['Uniformes', 'Mochilas', 'Estojos', 'Livros', 'Apostilas', 'Cadernos', 'Papelaria']
  await client.query('BEGIN')
  for (const [i, nome] of CATS.entries()) {
    await client.query('INSERT INTO categorias (nome, ordem) VALUES ($1, $2) ON CONFLICT (nome) DO NOTHING', [nome, i])
  }
  const cat = Object.fromEntries((await client.query('SELECT id, nome FROM categorias')).rows.map((r) => [r.nome, r.id]))

  const senhaAdmin = process.env.ADMIN_SENHA || '123456'
  const demo = await bcrypt.hash('123456', 10)
  const users = [
    ['Secretaria', 'secretaria@escola.com', await bcrypt.hash(senhaAdmin, 10), '43999990000', 'admin'],
    ['Ana Souza', 'ana@gmail.com', demo, '43988887777', 'responsavel'],
    ['Lucas Pereira', 'lucas@gmail.com', demo, null, 'aluno'],
    ['Marta Lima', 'marta@escola.com', demo, '43977776666', 'funcionario'],
  ]
  const u = {}
  for (const [nome, email, hash, tel, perfil] of users) {
    const r = await client.query(
      'INSERT INTO usuarios (nome, email, senha_hash, telefone, perfil) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [nome, email, hash, tel, perfil])
    u[email.split('@')[0]] = r.rows[0].id
  }

  const itens = [
    ['Camiseta do colégio, tam. 10', 'Camiseta de manga curta, bem conservada. Sem bordado.', 'Uniformes', 'Doação', 'Bom estado', '10', 'Pequena marca no punho.', true, 'Disponível', 'secretaria', 1, ['ana']],
    ['Mochila azul', 'Mochila com dois compartimentos e bolso lateral para garrafa.', 'Mochilas', 'Doação', 'Pouco uso', '', '', true, 'Reservado', 'secretaria', 2, ['lucas', 'ana']],
    ['Estojo com 3 divisórias', 'Estojo grande, nunca usado. Troco por calculadora científica.', 'Estojos', 'Troca', 'Novo', '', '', false, 'Disponível', 'ana', 3, []],
    ['Livro infantil ilustrado', 'Livro de histórias para 1º e 2º ano.', 'Livros', 'Doação', 'Bom estado', '', '', true, 'Disponível', 'marta', 4, ['lucas']],
    ['Apostila de Matemática — 7º ano', 'Algumas páginas com anotações a lápis.', 'Apostilas', 'Doação', 'Com marcas', '', 'Anotações apagáveis.', false, 'Disponível', 'lucas', 5, []],
    ['Kit 5 cadernos universitários', 'Cadernos de 10 matérias, lacrados.', 'Cadernos', 'Doação', 'Novo', '', '', true, 'Disponível', 'secretaria', 6, ['ana', 'lucas']],
    ['Calça de moletom do uniforme, tam. 12', 'Troco por tamanho 14.', 'Uniformes', 'Troca', 'Bom estado', '12', '', true, 'Disponível', 'ana', 7, []],
    ['Régua, compasso e transferidor', 'Kit de geometria completo.', 'Papelaria', 'Doação', 'Pouco uso', '', '', true, 'Entregue', 'marta', 9, []],
    ['Dicionário de Português', 'Dicionário escolar atualizado com o novo acordo ortográfico.', 'Livros', 'Doação', 'Bom estado', '', '', true, 'Disponível', 'secretaria', 10, []],
    ['Mochila de rodinhas rosa', 'Rodinhas funcionando, um pequeno rasgo no bolso frontal.', 'Mochilas', 'Doação', 'Com marcas', '', 'Rasgo de 2 cm no bolso.', true, 'Disponível', 'marta', 12, []],
  ]
  const ids = []
  for (const [titulo, desc, c, tipo, estado, tam, obs, ret, status, dono, dias, interessados] of itens) {
    const r = await client.query(
      `INSERT INTO itens (titulo, descricao, categoria_id, tipo, estado_conservacao, tamanho, observacoes, retirada_secretaria, status, dono_id, criado_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now() - make_interval(days => $11)) RETURNING id`,
      [titulo, desc, cat[c], tipo, estado, tam, obs, ret, status, u[dono], dias])
    ids.push(r.rows[0].id)
    for (const quem of interessados) {
      await client.query('INSERT INTO interesses (item_id, usuario_id) VALUES ($1,$2)', [r.rows[0].id, u[quem]])
    }
  }

  const conversa = async (itemIdx, interessado, dono, msgs) => {
    const c = await client.query('INSERT INTO conversas (item_id, interessado_id, dono_id) VALUES ($1,$2,$3) RETURNING id', [ids[itemIdx], u[interessado], u[dono]])
    for (const [autor, texto, horas, lida] of msgs) {
      await client.query(
        `INSERT INTO mensagens (conversa_id, autor_id, conteudo, enviada_em, lida) VALUES ($1,$2,$3, now() - make_interval(hours => $4), $5)`,
        [c.rows[0].id, u[autor], texto, horas, lida])
    }
  }
  await conversa(0, 'ana', 'secretaria', [
    ['ana', 'Olá, a camiseta ainda está disponível?', 5, true],
    ['secretaria', 'Sim, pode retirar na secretaria até sexta.', 4, true],
    ['ana', 'Ótimo, passo amanhã. Obrigada!', 3, false],
  ])
  await conversa(1, 'lucas', 'secretaria', [
    ['lucas', 'Oi! Posso reservar a mochila azul?', 30, true],
    ['secretaria', 'Reservei para você. Retire até quarta.', 28, false],
  ])
  await client.query('COMMIT')
}
