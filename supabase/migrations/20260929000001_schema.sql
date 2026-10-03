-- =============================================================
-- Restaurante do Cacau — esquema principal
-- Multi-restaurante: todo registro de negócio pertence a um restaurante_id.
-- =============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tipos ----------
create type public.papel_usuario as enum ('proprietario', 'gerente', 'garcom', 'cozinha', 'caixa', 'administrador');

create type public.status_mesa as enum (
  'livre',
  'ocupada',
  'aguardando_pedido',
  'em_preparo',
  'pedido_pronto',
  'aguardando_pagamento',
  'finalizada'
);

create type public.status_atendimento as enum ('aberto', 'conta_solicitada', 'fechado');

create type public.status_pedido as enum (
  'aguardando_envio',
  'novo',          -- enviado para a cozinha
  'em_preparo',
  'pronto',
  'entregue',
  'finalizado',
  'cancelado',
  'devolvido'
);

create type public.forma_pagamento as enum ('dinheiro', 'pix', 'credito', 'debito', 'vale', 'outro');
create type public.tipo_despesa as enum ('fixa', 'variavel', 'operacional');
create type public.tipo_movimentacao as enum ('entrada', 'saida', 'ajuste', 'consumo');

-- ---------- Utilitário atualizado_em ----------
create or replace function public.definir_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

-- ---------- Restaurantes ----------
create table public.restaurantes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  logo_url text,
  endereco text,
  telefone text,
  horario_funcionamento jsonb not null default '{}'::jsonb,
  taxa_servico_percentual numeric(5,2) not null default 10 check (taxa_servico_percentual between 0 and 100),
  moeda text not null default 'BRL',
  fuso_horario text not null default 'America/Sao_Paulo',
  garcom_pode_fechar_mesa boolean not null default false,
  baixa_estoque_automatica boolean not null default false,
  sequencia_pedido integer not null default 1000,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------- Usuários (perfil ligado ao auth.users) ----------
create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  restaurante_id uuid references public.restaurantes(id) on delete cascade,
  nome text not null,
  email text,
  telefone text,
  papel public.papel_usuario not null default 'garcom',
  ativo boolean not null default true,
  avatar_url text,
  visto_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index usuarios_restaurante_idx on public.usuarios(restaurante_id, papel);

-- ---------- Salão / Mesas ----------
create table public.setores (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (restaurante_id, nome)
);

create table public.mesas (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  setor_id uuid references public.setores(id) on delete set null,
  numero integer not null check (numero > 0),
  capacidade integer not null default 4 check (capacidade > 0),
  formato text not null default 'quadrada' check (formato in ('quadrada', 'redonda', 'retangular')),
  pos_x integer not null default 0,
  pos_y integer not null default 0,
  status public.status_mesa not null default 'livre',
  atendimento_atual_id uuid,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (restaurante_id, numero)
);
create index mesas_restaurante_idx on public.mesas(restaurante_id, numero);

-- Atendimento = período em que a mesa fica aberta (da chegada ao pagamento)
create table public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  garcom_id uuid references public.usuarios(id) on delete set null,
  pessoas integer not null default 1 check (pessoas > 0),
  status public.status_atendimento not null default 'aberto',
  taxa_servico_percentual numeric(5,2) not null default 10,
  desconto numeric(10,2) not null default 0,
  aberto_em timestamptz not null default now(),
  conta_solicitada_em timestamptz,
  fechado_em timestamptz,
  fechado_por uuid references public.usuarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index atendimentos_restaurante_idx on public.atendimentos(restaurante_id, status, aberto_em desc);
-- no máximo um atendimento aberto por mesa
create unique index atendimentos_um_aberto_por_mesa
  on public.atendimentos(mesa_id) where status <> 'fechado';

alter table public.mesas
  add constraint mesas_atendimento_atual_fk
  foreign key (atendimento_atual_id) references public.atendimentos(id) on delete set null;

-- ---------- Cardápio ----------
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  nome text not null,
  icone text,
  ordem integer not null default 0,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (restaurante_id, nome)
);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  categoria_id uuid not null references public.categorias(id) on delete restrict,
  nome text not null,
  descricao text,
  preco numeric(10,2) not null check (preco >= 0),
  imagem_url text,
  tempo_preparo_min integer not null default 10 check (tempo_preparo_min >= 0),
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index produtos_categoria_idx on public.produtos(restaurante_id, categoria_id, ordem);

-- Grupos de opções reutilizáveis (ex.: "Ponto da carne", "Adicionais")
create table public.grupos_opcoes (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  nome text not null,
  min_escolhas integer not null default 0 check (min_escolhas >= 0),
  max_escolhas integer not null default 1 check (max_escolhas >= 1),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (max_escolhas >= min_escolhas)
);

create table public.opcoes (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  grupo_id uuid not null references public.grupos_opcoes(id) on delete cascade,
  nome text not null,
  acrescimo numeric(10,2) not null default 0,
  ordem integer not null default 0,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index opcoes_grupo_idx on public.opcoes(grupo_id, ordem);

create table public.produto_grupos_opcoes (
  produto_id uuid not null references public.produtos(id) on delete cascade,
  grupo_id uuid not null references public.grupos_opcoes(id) on delete cascade,
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  ordem integer not null default 0,
  primary key (produto_id, grupo_id)
);

-- ---------- Pedidos ----------
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  numero integer not null,
  chave_idempotencia uuid not null,
  mesa_id uuid not null references public.mesas(id) on delete restrict,
  atendimento_id uuid not null references public.atendimentos(id) on delete restrict,
  garcom_id uuid references public.usuarios(id) on delete set null,
  status public.status_pedido not null default 'novo',
  observacao text,
  subtotal numeric(10,2) not null default 0,
  motivo_cancelamento text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  preparo_iniciado_em timestamptz,
  pronto_em timestamptz,
  entregue_em timestamptz,
  finalizado_em timestamptz,
  cancelado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  unique (restaurante_id, numero),
  unique (restaurante_id, chave_idempotencia)  -- nunca duplica um pedido reenviado
);
create index pedidos_status_idx on public.pedidos(restaurante_id, status, criado_em desc);
create index pedidos_atendimento_idx on public.pedidos(atendimento_id);
create index pedidos_criado_idx on public.pedidos(restaurante_id, criado_em desc);

create table public.itens_pedido (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  produto_nome text not null,             -- cópia do nome no momento do pedido
  preco_unitario numeric(10,2) not null,  -- cópia do preço, já com as opções
  quantidade integer not null check (quantidade > 0),
  observacao text,
  cancelado boolean not null default false,
  cancelado_em timestamptz,
  cancelado_por uuid references public.usuarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index itens_pedido_pedido_idx on public.itens_pedido(pedido_id);
create index itens_pedido_produto_idx on public.itens_pedido(restaurante_id, produto_id);

create table public.itens_pedido_opcoes (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  item_pedido_id uuid not null references public.itens_pedido(id) on delete cascade,
  opcao_id uuid references public.opcoes(id) on delete set null,
  grupo_nome text not null,
  opcao_nome text not null,
  acrescimo numeric(10,2) not null default 0
);
create index itens_pedido_opcoes_item_idx on public.itens_pedido_opcoes(item_pedido_id);

create table public.historico_status_pedido (
  id bigint generated always as identity primary key,
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  status_anterior public.status_pedido,
  status_novo public.status_pedido not null,
  alterado_por uuid references public.usuarios(id) on delete set null,
  alterado_em timestamptz not null default now()
);
create index historico_status_pedido_idx on public.historico_status_pedido(pedido_id, alterado_em);

-- ---------- Pagamentos ----------
create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  atendimento_id uuid not null references public.atendimentos(id) on delete restrict,
  forma public.forma_pagamento not null,
  valor numeric(10,2) not null check (valor > 0),
  recebido_por uuid references public.usuarios(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index pagamentos_restaurante_idx on public.pagamentos(restaurante_id, criado_em desc);

-- ---------- Financeiro ----------
create table public.categorias_despesa (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  nome text not null,
  tipo public.tipo_despesa not null default 'variavel',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (restaurante_id, nome)
);

create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  nome text not null,
  documento text,
  telefone text,
  email text,
  observacao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.despesas (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  categoria_id uuid not null references public.categorias_despesa(id) on delete restrict,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  descricao text not null,
  valor numeric(12,2) not null check (valor > 0),
  data date not null default (now() at time zone 'America/Sao_Paulo')::date,
  forma_pagamento public.forma_pagamento not null default 'pix',
  observacao text,
  comprovante_caminho text,
  criado_por uuid references public.usuarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index despesas_data_idx on public.despesas(restaurante_id, data desc);

-- ---------- Estoque ----------
create table public.itens_estoque (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  nome text not null,
  unidade text not null default 'un',   -- kg, g, l, ml, un
  quantidade numeric(12,3) not null default 0,
  quantidade_minima numeric(12,3) not null default 0,
  custo_unitario numeric(10,2) not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (restaurante_id, nome)
);

create table public.produto_ingredientes (
  produto_id uuid not null references public.produtos(id) on delete cascade,
  item_estoque_id uuid not null references public.itens_estoque(id) on delete cascade,
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  quantidade numeric(12,3) not null check (quantidade > 0),
  primary key (produto_id, item_estoque_id)
);

create table public.movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  item_estoque_id uuid not null references public.itens_estoque(id) on delete cascade,
  tipo public.tipo_movimentacao not null,
  quantidade numeric(12,3) not null,
  custo_unitario numeric(10,2),
  motivo text,
  pedido_id uuid references public.pedidos(id) on delete set null,
  criado_por uuid references public.usuarios(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index movimentacoes_estoque_item_idx on public.movimentacoes_estoque(item_estoque_id, criado_em desc);

-- ---------- Notificações ----------
create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  papel_destino public.papel_usuario,     -- null = todos
  usuario_destino_id uuid references public.usuarios(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  mensagem text,
  dados jsonb not null default '{}'::jsonb,
  lida_em timestamptz,
  criado_em timestamptz not null default now()
);
create index notificacoes_restaurante_idx on public.notificacoes(restaurante_id, criado_em desc);

-- ---------- Auditoria ----------
create table public.auditoria (
  id bigint generated always as identity primary key,
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  autor_id uuid references public.usuarios(id) on delete set null,
  autor_nome text,
  acao text not null,          -- ex.: pedido.criado, despesas.exclusao
  entidade text not null,      -- ex.: pedidos, despesas
  entidade_id text,
  descricao text not null,     -- frase para exibição
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index auditoria_restaurante_idx on public.auditoria(restaurante_id, criado_em desc);

-- ---------- Gatilhos atualizado_em ----------
do $$
declare t text;
begin
  foreach t in array array[
    'restaurantes','usuarios','setores','mesas','atendimentos','categorias','produtos',
    'grupos_opcoes','opcoes','pedidos','itens_pedido','categorias_despesa','fornecedores',
    'despesas','itens_estoque'
  ] loop
    execute format('create trigger %I_atualizado_em before update on public.%I
                    for each row execute function public.definir_atualizado_em()', t, t);
  end loop;
end $$;
