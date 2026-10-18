-- ReUse Escolar — esquema do banco (PostgreSQL)
-- Baseado no diagrama de classes: Usuario, Item, Interesse, Conversa, Mensagem, Categoria e Foto.
-- Pode ser executado várias vezes sem apagar dados (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS usuarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  senha_hash    VARCHAR(100) NOT NULL,
  telefone      VARCHAR(20),
  perfil        VARCHAR(20)  NOT NULL DEFAULT 'responsavel'
                CHECK (perfil IN ('responsavel', 'aluno', 'funcionario', 'admin')),
  ativo         BOOLEAN      NOT NULL DEFAULT TRUE,
  data_cadastro TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categorias (
  id    SERIAL PRIMARY KEY,
  nome  VARCHAR(40) NOT NULL UNIQUE,
  ordem INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS itens (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo              VARCHAR(60)  NOT NULL,
  descricao           VARCHAR(400) NOT NULL DEFAULT '',
  categoria_id        INT          NOT NULL REFERENCES categorias(id),
  tipo                VARCHAR(10)  NOT NULL CHECK (tipo IN ('Doação', 'Troca')),
  estado_conservacao  VARCHAR(20)  NOT NULL CHECK (estado_conservacao IN ('Novo', 'Bom estado', 'Pouco uso', 'Com marcas')),
  tamanho             VARCHAR(20)  NOT NULL DEFAULT '',
  observacoes         VARCHAR(140) NOT NULL DEFAULT '',
  retirada_secretaria BOOLEAN      NOT NULL DEFAULT TRUE,
  status              VARCHAR(12)  NOT NULL DEFAULT 'Disponível' CHECK (status IN ('Disponível', 'Reservado', 'Entregue')),
  dono_id             UUID         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  atualizado_em       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  removido_em         TIMESTAMPTZ               -- remoção lógica (permite "Desfazer")
);
CREATE INDEX IF NOT EXISTS idx_itens_listagem ON itens (status, criado_em DESC) WHERE removido_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_itens_dono ON itens (dono_id);

CREATE TABLE IF NOT EXISTS fotos (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES itens(id) ON DELETE CASCADE,
  ordem   INT  NOT NULL DEFAULT 0,
  mime    VARCHAR(30) NOT NULL,
  dados   BYTEA NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fotos_item ON fotos (item_id, ordem);

CREATE TABLE IF NOT EXISTS interesses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID NOT NULL REFERENCES itens(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  mensagem   VARCHAR(400),
  status     VARCHAR(12) NOT NULL DEFAULT 'Pendente',
  data       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS conversas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        UUID NOT NULL REFERENCES itens(id) ON DELETE CASCADE,
  interessado_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  dono_id        UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  iniciada_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, interessado_id)
);

CREATE TABLE IF NOT EXISTS mensagens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  autor_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  conteudo    VARCHAR(500) NOT NULL,
  enviada_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  lida        BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON mensagens (conversa_id, enviada_em);

-- Etapa 2: foto de perfil (URL do Vercel Blob)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar_url TEXT;
