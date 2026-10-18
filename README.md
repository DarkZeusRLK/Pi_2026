# ReUse Escolar

Plataforma de troca e doação de materiais escolares — Projeto Integrador.

- **Front-end:** React + Vite (responsivo, baseado no protótipo do Figma e nas 10 heurísticas de Nielsen)
- **Back-end:** Node.js + Express rodando como função serverless do Vercel (`api/index.js`)
- **Banco de dados:** PostgreSQL (Neon, integrado ao Vercel — plano gratuito)
- **Login:** senha com hash bcrypt + sessão JWT em cookie `httpOnly`

> O slide de tecnologias cita MySQL. O Vercel não oferece MySQL integrado; o banco nativo e gratuito dele é Postgres (Neon). As tabelas são as mesmas do diagrama de classes e o SQL é padrão, então a modelagem continua valendo.

## Estrutura

```
api/index.js        → função serverless do Vercel (entrada da API)
server/app.js       → rotas da API (auth, itens, fotos, conversas, painel)
server/auth.js      → login, cookie JWT, permissões por perfil
server/db.js        → conexão com o Postgres
db/schema.sql       → tabelas (usuarios, categorias, itens, fotos, interesses, conversas, mensagens)
db/migrate.js       → cria as tabelas e insere dados de exemplo (roda sozinho no deploy)
src/                → telas React
```

## Publicar no Vercel (grátis) — passo a passo

1. **Suba o projeto para o GitHub** (repositório novo, privado ou público).
2. No [Vercel](https://vercel.com) → **Add New › Project** → importe o repositório. O preset **Vite** é detectado. Clique em **Deploy** (o primeiro deploy funciona, mas avisa que ainda não há banco).
3. **Crie o banco:** no projeto, aba **Storage** → **Create Database** → **Neon (Serverless Postgres)** → plano **Free** → região *São Paulo* se houver (ou a mais próxima) → **Create** → **Connect Project** marcando Production, Preview e Development.
   Isso cria sozinho as variáveis `DATABASE_URL` e `DATABASE_URL_UNPOOLED`.
4. **Variáveis recomendadas** (Settings › Environment Variables):
   - `JWT_SECRET` — um texto aleatório longo (ex.: gere em <https://generate-secret.vercel.app/64>)
   - `ADMIN_SENHA` — senha da conta `secretaria@escola.com` criada no primeiro deploy (se não definir, fica `123456`)
5. **Deployments › ⋯ › Redeploy.** No build aparecem as linhas `✓ Tabelas verificadas/criadas` e `✓ Dados de exemplo inseridos`. Pronto.

Cada novo deploy só verifica as tabelas; os dados não são apagados.

### Contas criadas no primeiro deploy

| E-mail | Senha | Perfil |
|---|---|---|
| secretaria@escola.com | `ADMIN_SENHA` ou 123456 | Secretaria (admin) |
| ana@gmail.com | 123456 | Pai/Responsável |
| lucas@gmail.com | 123456 | Aluno |
| marta@escola.com | 123456 | Funcionário |

⚠️ São contas de demonstração para a apresentação. Se o site for usado de verdade, troque a senha da secretaria (Meu perfil › Minha conta) e suspenda as contas de exemplo no Painel.

## Rodar no computador

1. Crie um banco grátis no [Neon](https://neon.tech) (ou use o mesmo do Vercel: Storage › Neon › `.env.local` tab).
2. Copie `.env.example` para `.env` e cole a `DATABASE_URL`.
3. Rode:

```bash
npm install
npm run db:migrate   # cria tabelas e dados de exemplo
npm run dev          # API em :3001 e site em http://localhost:5173
```

## API

| Método | Rota | Acesso |
|---|---|---|
| POST | `/api/auth/cadastro`, `/api/auth/login`, `/api/auth/logout` | público |
| GET | `/api/auth/me` | público |
| PATCH | `/api/auth/perfil`, `/api/auth/senha` | logado |
| GET | `/api/categorias` | público |
| POST/DELETE | `/api/categorias` | admin |
| GET | `/api/itens?q=&cat=&tipo=&estado=&situacao=` | público |
| GET | `/api/itens/:id` | público |
| POST | `/api/itens` | logado |
| PUT, PATCH `/status`, DELETE, POST `/restaurar` | `/api/itens/:id` | dono ou admin |
| POST | `/api/itens/:id/interesse` | logado |
| GET | `/api/itens/:id/interessados` | dono ou admin |
| GET | `/api/fotos/:id` | público |
| GET/POST | `/api/conversas`, `/api/conversas/:id`, `/api/conversas/:id/mensagens` | participantes |
| GET | `/api/notificacoes` | logado |
| GET/PATCH | `/api/admin/resumo`, `/api/admin/usuarios/:id` | admin |

Regras de segurança: senha nunca sai do servidor, telefone do anunciante só aparece para usuários logados, conta suspensa perde o acesso na hora, cada rota confere se o usuário é dono do item/participante da conversa, e todo SQL usa parâmetros (`$1, $2`) contra injeção.

## Heurísticas de Nielsen aplicadas

1. **Visibilidade do status** — avisos após cada ação, "Buscando...", esqueletos de carregamento, "Salvando...", badges Disponível/Reservado/Entregue, contador de não lidas, ✓/✓✓ no chat.
2. **Correspondência com o mundo real** — linguagem da escola (Mural, Secretaria, Doação, Troca, Retirada na secretaria), ícones por categoria.
3. **Controle e liberdade** — "Desfazer" ao remover item, interesse ou suspensão; Voltar e Cancelar em todas as telas; mural visível sem login.
4. **Consistência** — mesma paleta, chips e botões; mesma navegação no celular (barra inferior) e no desktop (menu superior).
5. **Prevenção de erros** — validação antes de enviar, campos obrigatórios marcados, confirmação antes de remover/sair, aviso ao sair com alterações não salvas, limite de fotos e tamanho.
6. **Reconhecer em vez de lembrar** — chips de categoria/estado, prévia do card ao publicar, respostas rápidas no chat, breadcrumb, filtros guardados na URL.
7. **Flexibilidade** — atalho `/` para buscar, filtros avançados recolhíveis, chat interno ou WhatsApp.
8. **Design minimalista** — cada card só com o essencial; filtros extras escondidos até serem pedidos.
9. **Recuperação de erros** — mensagens em português dizendo como corrigir, foco no campo com erro, "Tentar de novo" quando a conexão falha.
10. **Ajuda e documentação** — página Ajuda com passo a passo e FAQ, dicas abaixo dos campos.
