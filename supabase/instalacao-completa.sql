-- Instalação completa: migrações + dados de demonstração.
-- Cole tudo no SQL Editor do Supabase e clique em Run (uma única vez, em projeto novo).

-- ===================== 20260929000001_schema.sql =====================
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

-- ===================== 20260929000002_functions.sql =====================
-- =============================================================
-- Funções de negócio, gatilhos e regras do fluxo operacional.
-- Toda operação sensível passa por funções SECURITY DEFINER que
-- validam papel + restaurante no servidor (nunca só no frontend).
-- =============================================================

create schema if not exists privado;
grant usage on schema privado to authenticated, supabase_auth_admin;

-- ---------- Contexto do usuário ----------
create or replace function privado.restaurante_atual()
returns uuid language sql stable security definer set search_path = '' as $$
  select restaurante_id from public.usuarios where id = auth.uid() and ativo
$$;

create or replace function privado.papel_atual()
returns public.papel_usuario language sql stable security definer set search_path = '' as $$
  select papel from public.usuarios where id = auth.uid() and ativo
$$;

create or replace function privado.tem_papel(p_papeis public.papel_usuario[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.usuarios
    where id = auth.uid() and ativo and papel = any(p_papeis)
  )
$$;

-- Papéis com acesso administrativo completo
create or replace function privado.eh_gestao()
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.tem_papel(array['proprietario','gerente','administrador']::public.papel_usuario[])
$$;

-- Garante que o usuário está ativo e vinculado a um restaurante
create or replace function privado.exigir_restaurante()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  v := privado.restaurante_atual();
  if v is null then
    raise exception 'Você não possui permissão para realizar esta ação.' using errcode = '42501';
  end if;
  return v;
end $$;

create or replace function privado.formatar_brl(p numeric)
returns text language sql immutable as $$
  select 'R$ ' || replace(replace(replace(to_char(coalesce(p, 0), 'FM999G999G990D00'), ',', '#'), '.', ','), '#', '.')
$$;

create or replace function privado.rotulo_mesa(p_numero integer)
returns text language sql immutable as $$
  select 'mesa ' || lpad(p_numero::text, 2, '0')
$$;

-- ---------- Auditoria ----------
create or replace function privado.registrar_auditoria(
  p_restaurante_id uuid, p_acao text, p_entidade text, p_entidade_id text,
  p_descricao text, p_detalhes jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  select nome into v_nome from public.usuarios where id = auth.uid();
  insert into public.auditoria (restaurante_id, autor_id, autor_nome, acao, entidade, entidade_id, descricao, detalhes)
  values (p_restaurante_id, auth.uid(), coalesce(v_nome, 'Sistema'), p_acao, p_entidade, p_entidade_id,
          coalesce(v_nome, 'Sistema') || ' ' || p_descricao, coalesce(p_detalhes, '{}'::jsonb));
end $$;

-- Auditoria genérica de cadastros (criou / alterou / excluiu)
create or replace function privado.auditar_alteracao()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_linha jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_rotulo text := tg_argv[0];                       -- ex.: 'o produto'
  v_nome text := coalesce(v_linha->>'nome', v_linha->>'descricao', 'nº ' || (v_linha->>'numero'), '');
  v_verbo text := case tg_op when 'INSERT' then 'criou' when 'UPDATE' then 'alterou' else 'excluiu' end;
  v_acao text := case tg_op when 'INSERT' then 'criacao' when 'UPDATE' then 'alteracao' else 'exclusao' end;
  v_extra text := '';
  v_restaurante text := coalesce(v_linha->>'restaurante_id', case when tg_table_name = 'restaurantes' then v_linha->>'id' end);
begin
  if v_restaurante is null then
    return null;
  end if;
  if tg_table_name = 'despesas' then
    v_extra := ' de ' || privado.formatar_brl((v_linha->>'valor')::numeric);
  end if;
  perform privado.registrar_auditoria(
    v_restaurante::uuid,
    tg_table_name || '.' || v_acao,
    tg_table_name,
    v_linha->>'id',
    v_verbo || ' ' || v_rotulo || ' ' || v_nome || v_extra,
    case when tg_op = 'UPDATE' then jsonb_build_object('antes', to_jsonb(old), 'depois', to_jsonb(new))
         else jsonb_build_object('registro', v_linha) end
  );
  return null;
end $$;

-- ---------- Notificações ----------
create or replace function privado.notificar(
  p_restaurante_id uuid, p_papel_destino public.papel_usuario, p_usuario_destino uuid,
  p_tipo text, p_titulo text, p_mensagem text default null, p_dados jsonb default '{}'::jsonb
) returns void language sql security definer set search_path = '' as $$
  insert into public.notificacoes (restaurante_id, papel_destino, usuario_destino_id, tipo, titulo, mensagem, dados)
  values (p_restaurante_id, p_papel_destino, p_usuario_destino, p_tipo, p_titulo, p_mensagem, coalesce(p_dados, '{}'::jsonb));
$$;

-- ---------- Criação automática do perfil ----------
-- O restaurante e o papel vêm de app_metadata (não editável pelo usuário).
create or replace function privado.ao_criar_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.usuarios (id, restaurante_id, nome, email, papel)
  values (
    new.id,
    nullif(new.raw_app_meta_data->>'restaurante_id', '')::uuid,
    coalesce(nullif(new.raw_user_meta_data->>'nome', ''), split_part(new.email, '@', 1)),
    new.email,
    coalesce(nullif(new.raw_app_meta_data->>'papel', ''), 'garcom')::public.papel_usuario
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger ao_criar_usuario_auth
  after insert on auth.users
  for each row execute function privado.ao_criar_usuario();

-- ---------- Status da mesa (calculado a partir da operação) ----------
create or replace function privado.atualizar_status_mesa(p_mesa_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_atendimento public.atendimentos;
  v_status public.status_mesa;
begin
  select * into v_atendimento from public.atendimentos
   where mesa_id = p_mesa_id and status <> 'fechado'
   order by aberto_em desc limit 1;

  if v_atendimento.id is null then
    v_status := 'livre';
  elsif v_atendimento.status = 'conta_solicitada' then
    v_status := 'aguardando_pagamento';
  elsif exists (select 1 from public.pedidos where atendimento_id = v_atendimento.id and status = 'pronto') then
    v_status := 'pedido_pronto';
  elsif exists (select 1 from public.pedidos where atendimento_id = v_atendimento.id and status in ('novo','em_preparo')) then
    v_status := 'em_preparo';
  elsif exists (select 1 from public.pedidos where atendimento_id = v_atendimento.id and status in ('entregue','finalizado')) then
    v_status := 'ocupada';
  else
    v_status := 'aguardando_pedido';
  end if;

  update public.mesas
     set status = v_status, atendimento_atual_id = v_atendimento.id
   where id = p_mesa_id
     and (status is distinct from v_status or atendimento_atual_id is distinct from v_atendimento.id);
end $$;

-- ---------- Máquina de estados do pedido ----------
create or replace function privado.transicao_permitida(p_de public.status_pedido, p_para public.status_pedido)
returns boolean language sql immutable as $$
  select case p_de
    when 'aguardando_envio' then p_para in ('novo','cancelado')
    when 'novo'             then p_para in ('em_preparo','cancelado')
    when 'em_preparo'       then p_para in ('pronto','novo','cancelado')
    when 'pronto'           then p_para in ('entregue','em_preparo','cancelado')
    when 'entregue'         then p_para in ('finalizado','devolvido')
    else false
  end
$$;

create or replace function privado.rotulo_status_pedido(p public.status_pedido)
returns text language sql immutable as $$
  select replace(p::text, '_', ' ')
$$;

-- Horário de cada transição
create or replace function privado.pedidos_antes_status()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    case new.status
      when 'novo'       then new.enviado_em          := coalesce(new.enviado_em, now());
      when 'em_preparo' then new.preparo_iniciado_em := now();
      when 'pronto'     then new.pronto_em           := now();
      when 'entregue'   then new.entregue_em         := now();
      when 'finalizado' then new.finalizado_em       := now();
      when 'cancelado'  then new.cancelado_em        := now();
      else null;
    end case;
    -- reabertura: limpa os horários seguintes
    if new.status = 'novo' then new.preparo_iniciado_em := null; new.pronto_em := null; end if;
    if new.status = 'em_preparo' then new.pronto_em := null; end if;
  end if;
  return new;
end $$;

create trigger pedidos_antes_status
  before insert or update of status on public.pedidos
  for each row execute function privado.pedidos_antes_status();

-- Histórico, status da mesa, notificações e estoque
create or replace function privado.pedidos_depois_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_mesa integer;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;

  insert into public.historico_status_pedido (restaurante_id, pedido_id, status_anterior, status_novo, alterado_por)
  values (new.restaurante_id, new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());

  perform privado.atualizar_status_mesa(new.mesa_id);

  select numero into v_mesa from public.mesas where id = new.mesa_id;

  if new.status = 'novo' and (tg_op = 'INSERT' or old.status = 'aguardando_envio') then
    perform privado.notificar(new.restaurante_id, 'cozinha', null, 'pedido.novo',
      'Novo pedido recebido',
      'Pedido #' || new.numero || ' — Mesa ' || lpad(v_mesa::text, 2, '0'),
      jsonb_build_object('pedido_id', new.id, 'mesa_id', new.mesa_id));
  elsif new.status = 'pronto' then
    perform privado.notificar(new.restaurante_id, null, new.garcom_id, 'pedido.pronto',
      'Pedido #' || new.numero || ' está pronto',
      'Mesa ' || lpad(v_mesa::text, 2, '0'),
      jsonb_build_object('pedido_id', new.id, 'mesa_id', new.mesa_id));
  end if;

  if new.status = 'finalizado' then
    perform privado.baixar_estoque_do_pedido(new.id);
  end if;

  if tg_op = 'UPDATE' then
    perform privado.registrar_auditoria(new.restaurante_id, 'pedido.status', 'pedidos', new.id::text,
      case new.status
        when 'cancelado' then 'cancelou o pedido #' || new.numero
        else 'marcou o pedido #' || new.numero || ' como ' || privado.rotulo_status_pedido(new.status)
      end,
      jsonb_build_object('de', old.status, 'para', new.status, 'motivo', new.motivo_cancelamento));
  end if;
  return null;
end $$;

create trigger pedidos_depois_status
  after insert or update of status on public.pedidos
  for each row execute function privado.pedidos_depois_status();

-- Subtotal do pedido sempre calculado no banco
create or replace function privado.recalcular_subtotal()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_pedido uuid := coalesce(new.pedido_id, old.pedido_id);
begin
  update public.pedidos p
     set subtotal = coalesce((
       select sum(preco_unitario * quantidade) from public.itens_pedido
        where pedido_id = v_pedido and not cancelado), 0)
   where p.id = v_pedido;
  return null;
end $$;

create trigger itens_pedido_subtotal
  after insert or update or delete on public.itens_pedido
  for each row execute function privado.recalcular_subtotal();

-- Atendimentos alteram o status da mesa
create or replace function privado.atendimentos_depois()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform privado.atualizar_status_mesa(new.mesa_id);
  return null;
end $$;

create trigger atendimentos_depois
  after insert or update of status on public.atendimentos
  for each row execute function privado.atendimentos_depois();

-- ---------- Estoque ----------
create or replace function privado.baixar_estoque_do_pedido(p_pedido_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_restaurante uuid;
  r record;
begin
  select p.restaurante_id into v_restaurante
    from public.pedidos p join public.restaurantes rs on rs.id = p.restaurante_id
   where p.id = p_pedido_id and rs.baixa_estoque_automatica;
  if v_restaurante is null then return; end if;

  -- evita baixa duplicada
  if exists (select 1 from public.movimentacoes_estoque where pedido_id = p_pedido_id and tipo = 'consumo') then
    return;
  end if;

  for r in
    select pi.item_estoque_id, sum(pi.quantidade * ip.quantidade) as qtd
      from public.itens_pedido ip
      join public.produto_ingredientes pi on pi.produto_id = ip.produto_id
     where ip.pedido_id = p_pedido_id and not ip.cancelado
     group by pi.item_estoque_id
  loop
    insert into public.movimentacoes_estoque (restaurante_id, item_estoque_id, tipo, quantidade, motivo, pedido_id, criado_por)
    values (v_restaurante, r.item_estoque_id, 'consumo', -r.qtd, 'Baixa automática do pedido', p_pedido_id, auth.uid());
    update public.itens_estoque set quantidade = quantidade - r.qtd where id = r.item_estoque_id;
  end loop;
end $$;

-- Alerta de estoque baixo ao cruzar o mínimo
create or replace function privado.alerta_estoque_baixo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.quantidade < new.quantidade_minima and (old.quantidade >= old.quantidade_minima) then
    perform privado.notificar(new.restaurante_id, 'proprietario', null, 'estoque.baixo',
      'Estoque de ' || lower(new.nome) || ' está baixo',
      'Atual: ' || replace(trim_scale(new.quantidade)::text, '.', ',') || ' ' || new.unidade,
      jsonb_build_object('item_estoque_id', new.id));
  end if;
  return null;
end $$;

create trigger alerta_estoque_baixo
  after update of quantidade, quantidade_minima on public.itens_estoque
  for each row execute function privado.alerta_estoque_baixo();

-- Nova despesa notifica o proprietário
create or replace function privado.despesa_criada()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform privado.notificar(new.restaurante_id, 'proprietario', null, 'despesa.nova',
    'Nova despesa cadastrada', new.descricao || ' — ' || privado.formatar_brl(new.valor),
    jsonb_build_object('despesa_id', new.id));
  return null;
end $$;

create trigger despesa_criada
  after insert on public.despesas
  for each row execute function privado.despesa_criada();

-- Auditoria dos cadastros
create trigger auditar_produtos after insert or update or delete on public.produtos
  for each row execute function privado.auditar_alteracao('o produto');
create trigger auditar_categorias after insert or update or delete on public.categorias
  for each row execute function privado.auditar_alteracao('a categoria');
create trigger auditar_mesas after insert or delete on public.mesas
  for each row execute function privado.auditar_alteracao('a mesa');
create trigger auditar_despesas after insert or update or delete on public.despesas
  for each row execute function privado.auditar_alteracao('a despesa');
create trigger auditar_itens_estoque after insert or delete on public.itens_estoque
  for each row execute function privado.auditar_alteracao('o item de estoque');
create trigger auditar_fornecedores after insert or update or delete on public.fornecedores
  for each row execute function privado.auditar_alteracao('o fornecedor');
create trigger auditar_usuarios after update on public.usuarios
  for each row when (old.papel is distinct from new.papel or old.ativo is distinct from new.ativo
                     or old.nome is distinct from new.nome)
  execute function privado.auditar_alteracao('o usuário');
create trigger auditar_restaurantes after update on public.restaurantes
  for each row when (old.sequencia_pedido is not distinct from new.sequencia_pedido)
  execute function privado.auditar_alteracao('as configurações do restaurante');

-- =============================================================
-- Funções chamadas pelo aplicativo
-- =============================================================

-- Abre a mesa (garçom informa a quantidade de pessoas)
create or replace function public.abrir_mesa(p_mesa_id uuid, p_pessoas integer default 1)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_restaurante uuid := privado.exigir_restaurante();
  v_mesa public.mesas;
  v_atendimento uuid;
begin
  if not privado.tem_papel(array['proprietario','gerente','administrador','garcom','caixa']::public.papel_usuario[]) then
    raise exception 'Você não possui permissão para realizar esta ação.' using errcode = '42501';
  end if;

  select * into v_mesa from public.mesas
   where id = p_mesa_id and restaurante_id = v_restaurante and ativa for update;
  if v_mesa.id is null then
    raise exception 'Mesa não encontrada.' using errcode = 'P0002';
  end if;

  select id into v_atendimento from public.atendimentos
   where mesa_id = p_mesa_id and status <> 'fechado';
  if v_atendimento is not null then
    return v_atendimento;  -- já aberta: operação idempotente
  end if;

  insert into public.atendimentos (restaurante_id, mesa_id, garcom_id, pessoas, taxa_servico_percentual)
  select v_restaurante, p_mesa_id, auth.uid(), greatest(coalesce(p_pessoas, 1), 1), r.taxa_servico_percentual
    from public.restaurantes r where r.id = v_restaurante
  returning id into v_atendimento;

  perform privado.registrar_auditoria(v_restaurante, 'mesa.aberta', 'mesas', p_mesa_id::text,
    'abriu a ' || privado.rotulo_mesa(v_mesa.numero) || ' com ' || greatest(coalesce(p_pessoas,1),1) || ' pessoa(s)');
  return v_atendimento;
end $$;

-- Envia um pedido para a cozinha.
-- p_itens: [{ "produto_id": uuid, "quantidade": int, "observacao": text, "opcoes_ids": [uuid] }]
-- p_chave_idempotencia: gerada no tablet; reenvios devolvem o mesmo pedido.
create or replace function public.enviar_pedido(
  p_chave_idempotencia uuid,
  p_mesa_id uuid,
  p_itens jsonb,
  p_observacao text default null,
  p_pessoas integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_restaurante uuid := privado.exigir_restaurante();
  v_existente public.pedidos;
  v_atendimento uuid;
  v_mesa public.mesas;
  v_pedido_id uuid;
  v_numero integer;
  v_item jsonb;
  v_produto public.produtos;
  v_qtd integer;
  v_acrescimo numeric(10,2);
  v_item_id uuid;
  v_grupo record;
  v_total_opcoes integer;
  v_opcoes uuid[];
begin
  if not privado.tem_papel(array['proprietario','gerente','administrador','garcom','caixa']::public.papel_usuario[]) then
    raise exception 'Você não possui permissão para realizar esta ação.' using errcode = '42501';
  end if;

  -- Idempotência: pedido já recebido?
  select * into v_existente from public.pedidos
   where restaurante_id = v_restaurante and chave_idempotencia = p_chave_idempotencia;
  if v_existente.id is not null then
    return jsonb_build_object('pedido_id', v_existente.id, 'numero', v_existente.numero, 'duplicado', true);
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Adicione pelo menos um item ao pedido.' using errcode = '22023';
  end if;

  select * into v_mesa from public.mesas
   where id = p_mesa_id and restaurante_id = v_restaurante and ativa for update;
  if v_mesa.id is null then
    raise exception 'Mesa não encontrada.' using errcode = 'P0002';
  end if;

  -- Confere de novo após o bloqueio (dois envios simultâneos com a mesma chave)
  select * into v_existente from public.pedidos
   where restaurante_id = v_restaurante and chave_idempotencia = p_chave_idempotencia;
  if v_existente.id is not null then
    return jsonb_build_object('pedido_id', v_existente.id, 'numero', v_existente.numero, 'duplicado', true);
  end if;

  select id into v_atendimento from public.atendimentos
   where mesa_id = p_mesa_id and status <> 'fechado';
  if v_atendimento is null then
    v_atendimento := public.abrir_mesa(p_mesa_id, coalesce(p_pessoas, 1));
  else
    -- novo pedido depois de pedir a conta reabre o atendimento
    update public.atendimentos set status = 'aberto', conta_solicitada_em = null
     where id = v_atendimento and status = 'conta_solicitada';
  end if;

  update public.restaurantes set sequencia_pedido = sequencia_pedido + 1
   where id = v_restaurante returning sequencia_pedido into v_numero;

  insert into public.pedidos (restaurante_id, numero, chave_idempotencia, mesa_id, atendimento_id, garcom_id, status, observacao)
  values (v_restaurante, v_numero, p_chave_idempotencia, p_mesa_id, v_atendimento, auth.uid(), 'novo', nullif(trim(p_observacao), ''))
  returning id into v_pedido_id;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    select * into v_produto from public.produtos
     where id = (v_item->>'produto_id')::uuid and restaurante_id = v_restaurante;
    if v_produto.id is null or not v_produto.ativo then
      raise exception 'Este produto está indisponível: %', coalesce(v_produto.nome, 'item removido do cardápio')
        using errcode = 'P0001', hint = 'produto_indisponivel';
    end if;

    v_qtd := coalesce((v_item->>'quantidade')::integer, 1);
    if v_qtd < 1 or v_qtd > 99 then
      raise exception 'Quantidade inválida para %.', v_produto.nome using errcode = '22023';
    end if;

    select coalesce(array_agg(x::uuid), '{}') into v_opcoes
      from jsonb_array_elements_text(coalesce(v_item->'opcoes_ids', '[]'::jsonb)) x;

    -- As opções devem pertencer a grupos do produto e estar ativas
    select count(*), coalesce(sum(o.acrescimo), 0) into v_total_opcoes, v_acrescimo
      from public.opcoes o
      join public.produto_grupos_opcoes pg on pg.grupo_id = o.grupo_id and pg.produto_id = v_produto.id
     where o.id = any(v_opcoes) and o.ativa;
    if v_total_opcoes <> coalesce(array_length(v_opcoes, 1), 0) then
      raise exception 'Uma das opções de % está indisponível.', v_produto.nome using errcode = 'P0001', hint = 'opcao_indisponivel';
    end if;

    -- Respeita o mínimo e o máximo de escolhas de cada grupo
    for v_grupo in
      select g.nome, g.min_escolhas, g.max_escolhas,
             (select count(*) from public.opcoes o where o.grupo_id = g.id and o.id = any(v_opcoes)) as escolhidas
        from public.grupos_opcoes g
        join public.produto_grupos_opcoes pg on pg.grupo_id = g.id
       where pg.produto_id = v_produto.id
    loop
      if v_grupo.escolhidas < v_grupo.min_escolhas or v_grupo.escolhidas > v_grupo.max_escolhas then
        raise exception 'Escolha "%" de % corretamente.', v_grupo.nome, v_produto.nome using errcode = '22023';
      end if;
    end loop;

    insert into public.itens_pedido (restaurante_id, pedido_id, produto_id, produto_nome, preco_unitario, quantidade, observacao)
    values (v_restaurante, v_pedido_id, v_produto.id, v_produto.nome, v_produto.preco + v_acrescimo, v_qtd,
            nullif(trim(v_item->>'observacao'), ''))
    returning id into v_item_id;

    insert into public.itens_pedido_opcoes (restaurante_id, item_pedido_id, opcao_id, grupo_nome, opcao_nome, acrescimo)
    select v_restaurante, v_item_id, o.id, g.nome, o.nome, o.acrescimo
      from public.opcoes o
      join public.grupos_opcoes g on g.id = o.grupo_id
     where o.id = any(v_opcoes);
  end loop;

  perform privado.registrar_auditoria(v_restaurante, 'pedido.criado', 'pedidos', v_pedido_id::text,
    'criou o pedido #' || v_numero || ' na ' || privado.rotulo_mesa(v_mesa.numero));

  return jsonb_build_object('pedido_id', v_pedido_id, 'numero', v_numero, 'duplicado', false);
end $$;

-- Muda o status de um pedido respeitando a máquina de estados e o papel
create or replace function public.atualizar_status_pedido(
  p_pedido_id uuid, p_status public.status_pedido, p_motivo text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_restaurante uuid := privado.exigir_restaurante();
  v_pedido public.pedidos;
  v_papel public.papel_usuario := privado.papel_atual();
  v_gestao boolean := privado.eh_gestao();
begin
  select * into v_pedido from public.pedidos
   where id = p_pedido_id and restaurante_id = v_restaurante for update;
  if v_pedido.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if v_pedido.status = p_status then
    return;  -- idempotente
  end if;
  if not privado.transicao_permitida(v_pedido.status, p_status) then
    raise exception 'Não é possível mudar o pedido de "%" para "%".',
      privado.rotulo_status_pedido(v_pedido.status), privado.rotulo_status_pedido(p_status) using errcode = '22023';
  end if;

  -- Permissões por transição
  if p_status in ('cancelado', 'devolvido', 'finalizado') and not v_gestao then
    raise exception 'Você não possui permissão para realizar esta ação.' using errcode = '42501';
  end if;
  if p_status in ('em_preparo', 'pronto') or (p_status = 'novo' and v_pedido.status <> 'aguardando_envio') then
    if not (v_gestao or v_papel = 'cozinha') then
      raise exception 'Você não possui permissão para realizar esta ação.' using errcode = '42501';
    end if;
  end if;
  if p_status = 'entregue' and not (v_gestao or v_papel in ('cozinha','garcom','caixa')) then
    raise exception 'Você não possui permissão para realizar esta ação.' using errcode = '42501';
  end if;

  update public.pedidos
     set status = p_status,
         motivo_cancelamento = case when p_status in ('cancelado','devolvido') then nullif(trim(p_motivo), '') else motivo_cancelamento end
   where id = p_pedido_id;
end $$;

-- Cancela um item de um pedido já enviado (somente gestão)
create or replace function public.cancelar_item_pedido(p_item_id uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_restaurante uuid := privado.exigir_restaurante();
  v_item public.itens_pedido;
  v_pedido public.pedidos;
begin
  if not privado.eh_gestao() then
    raise exception 'Você não possui permissão para realizar esta ação.' using errcode = '42501';
  end if;
  select * into v_item from public.itens_pedido where id = p_item_id and restaurante_id = v_restaurante for update;
  if v_item.id is null then
    raise exception 'Item não encontrado.' using errcode = 'P0002';
  end if;
  select * into v_pedido from public.pedidos where id = v_item.pedido_id;
  if v_pedido.status in ('finalizado','cancelado','devolvido') then
    raise exception 'Não foi possível atualizar o pedido.' using errcode = '22023';
  end if;

  update public.itens_pedido set cancelado = true, cancelado_em = now(), cancelado_por = auth.uid()
   where id = p_item_id and not cancelado;

  perform privado.registrar_auditoria(v_restaurante, 'item_pedido.cancelado', 'itens_pedido', p_item_id::text,
    'cancelou o item ' || v_item.produto_nome || ' do pedido #' || v_pedido.numero,
    jsonb_build_object('motivo', p_motivo));

  -- todos os itens cancelados => pedido cancelado
  if not exists (select 1 from public.itens_pedido where pedido_id = v_pedido.id and not cancelado) then
    update public.pedidos set status = 'cancelado', motivo_cancelamento = coalesce(nullif(trim(p_motivo), ''), 'Todos os itens cancelados')
     where id = v_pedido.id;
  end if;
end $$;

-- Adiciona itens a um pedido existente (gestão)
create or replace function public.adicionar_itens_pedido(p_pedido_id uuid, p_itens jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_restaurante uuid := privado.exigir_restaurante();
  v_pedido public.pedidos;
  v_item jsonb;
  v_produto public.produtos;
  v_acrescimo numeric(10,2);
  v_item_id uuid;
  v_opcoes uuid[];
begin
  if not privado.eh_gestao() then
    raise exception 'Você não possui permissão para realizar esta ação.' using errcode = '42501';
  end if;
  select * into v_pedido from public.pedidos where id = p_pedido_id and restaurante_id = v_restaurante for update;
  if v_pedido.id is null or v_pedido.status in ('finalizado','cancelado','devolvido') then
    raise exception 'Não foi possível atualizar o pedido.' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    select * into v_produto from public.produtos
     where id = (v_item->>'produto_id')::uuid and restaurante_id = v_restaurante and ativo;
    if v_produto.id is null then
      raise exception 'Este produto está indisponível.' using errcode = 'P0001', hint = 'produto_indisponivel';
    end if;
    select coalesce(array_agg(x::uuid), '{}') into v_opcoes
      from jsonb_array_elements_text(coalesce(v_item->'opcoes_ids', '[]'::jsonb)) x;
    select coalesce(sum(o.acrescimo), 0) into v_acrescimo
      from public.opcoes o
      join public.produto_grupos_opcoes pg on pg.grupo_id = o.grupo_id and pg.produto_id = v_produto.id
     where o.id = any(v_opcoes);

    insert into public.itens_pedido (restaurante_id, pedido_id, produto_id, produto_nome, preco_unitario, quantidade, observacao)
    values (v_restaurante, p_pedido_id, v_produto.id, v_produto.nome, v_produto.preco + v_acrescimo,
            greatest(coalesce((v_item->>'quantidade')::integer, 1), 1), nullif(trim(v_item->>'observacao'), ''))
    returning id into v_item_id;

    insert into public.itens_pedido_opcoes (restaurante_id, item_pedido_id, opcao_id, grupo_nome, opcao_nome, acrescimo)
    select v_restaurante, v_item_id, o.id, g.nome, o.nome, o.acrescimo
      from public.opcoes o join public.grupos_opcoes g on g.id = o.grupo_id
      join public.produto_grupos_opcoes pg on pg.grupo_id = o.grupo_id and pg.produto_id = v_produto.id
     where o.id = any(v_opcoes);

    perform privado.registrar_auditoria(v_restaurante, 'item_pedido.adicionado', 'itens_pedido', v_item_id::text,
      'adicionou ' || v_produto.nome || ' ao pedido #' || v_pedido.numero);
  end loop;
end $$;

-- Garçom pede a conta
create or replace function public.solicitar_conta(p_atendimento_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_restaurante uuid := privado.exigir_restaurante();
  v_atendimento public.atendimentos;
  v_numero integer;
begin
  if not privado.tem_papel(array['proprietario','gerente','administrador','garcom','caixa']::public.papel_usuario[]) then
    raise exception 'Você não possui permissão para realizar esta ação.' using errcode = '42501';
  end if;
  select * into v_atendimento from public.atendimentos
   where id = p_atendimento_id and restaurante_id = v_restaurante and status = 'aberto' for update;
  if v_atendimento.id is null then
    return;  -- já solicitada ou fechada
  end if;
  update public.atendimentos set status = 'conta_solicitada', conta_solicitada_em = now() where id = p_atendimento_id;
  select numero into v_numero from public.mesas where id = v_atendimento.mesa_id;

  perform privado.notificar(v_restaurante, 'caixa', null, 'mesa.conta_solicitada',
    'Mesa ' || lpad(v_numero::text, 2, '0') || ' solicitou a conta', null,
    jsonb_build_object('mesa_id', v_atendimento.mesa_id, 'atendimento_id', p_atendimento_id));
  perform privado.registrar_auditoria(v_restaurante, 'mesa.conta_solicitada', 'atendimentos', p_atendimento_id::text,
    'solicitou a conta da ' || privado.rotulo_mesa(v_numero));
end $$;

-- Totais de um atendimento
create or replace function public.totais_atendimento(p_atendimento_id uuid)
returns table (subtotal numeric, servico numeric, desconto numeric, total numeric)
language sql stable security definer set search_path = '' as $$
  with a as (
    select at.* from public.atendimentos at
     where at.id = p_atendimento_id and at.restaurante_id = privado.restaurante_atual()
  ), sub as (
    select coalesce(sum(p.subtotal), 0) as v
      from public.pedidos p join a on a.id = p.atendimento_id
     where p.status not in ('cancelado','devolvido')
  )
  select sub.v,
         round(sub.v * a.taxa_servico_percentual / 100, 2),
         a.desconto,
         greatest(sub.v + round(sub.v * a.taxa_servico_percentual / 100, 2) - a.desconto, 0)
    from a, sub
$$;

-- Fecha a mesa registrando os pagamentos
-- p_pagamentos: [{ "forma": "pix", "valor": 76.78 }]
create or replace function public.fechar_mesa(
  p_atendimento_id uuid, p_pagamentos jsonb, p_desconto numeric default 0, p_sem_servico boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_restaurante uuid := privado.exigir_restaurante();
  v_atendimento public.atendimentos;
  v_permitido boolean;
  v_totais record;
  v_pago numeric(10,2);
  v_troco numeric(10,2);
  v_pag jsonb;
  v_valor numeric(10,2);
  v_numero integer;
begin
  select privado.eh_gestao() or privado.tem_papel(array['caixa']::public.papel_usuario[])
         or (privado.tem_papel(array['garcom']::public.papel_usuario[]) and r.garcom_pode_fechar_mesa)
    into v_permitido from public.restaurantes r where r.id = v_restaurante;
  if not v_permitido then
    raise exception 'Você não possui permissão para realizar esta ação.' using errcode = '42501';
  end if;

  select * into v_atendimento from public.atendimentos
   where id = p_atendimento_id and restaurante_id = v_restaurante and status <> 'fechado' for update;
  if v_atendimento.id is null then
    raise exception 'Esta mesa já foi fechada.' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.pedidos where atendimento_id = p_atendimento_id and status in ('novo','em_preparo')) then
    raise exception 'Ainda há pedidos em preparo nesta mesa.' using errcode = '22023';
  end if;

  update public.atendimentos
     set desconto = greatest(coalesce(p_desconto, 0), 0),
         taxa_servico_percentual = case when p_sem_servico then 0 else taxa_servico_percentual end
   where id = p_atendimento_id;

  select * into v_totais from public.totais_atendimento(p_atendimento_id);

  select coalesce(sum((p->>'valor')::numeric), 0) into v_pago from jsonb_array_elements(coalesce(p_pagamentos, '[]'::jsonb)) p;
  if v_totais.total > 0 and v_pago + 0.009 < v_totais.total then
    raise exception 'Valor pago (%) é menor que o total da conta (%).',
      privado.formatar_brl(v_pago), privado.formatar_brl(v_totais.total) using errcode = '22023';
  end if;

  -- Troco só é possível em dinheiro: registra o valor efetivamente recebido
  v_troco := greatest(v_pago - v_totais.total, 0);
  if v_troco > 0.009 and not exists (
      select 1 from jsonb_array_elements(p_pagamentos) p
       where p->>'forma' = 'dinheiro' and (p->>'valor')::numeric >= v_troco) then
    raise exception 'O valor pago passa do total. Troco só é possível em dinheiro.' using errcode = '22023';
  end if;

  for v_pag in select * from jsonb_array_elements(coalesce(p_pagamentos, '[]'::jsonb)) loop
    v_valor := (v_pag->>'valor')::numeric;
    if v_pag->>'forma' = 'dinheiro' and v_troco > 0 then
      v_valor := v_valor - v_troco;
      v_troco := 0;
    end if;
    if v_valor > 0 then
      insert into public.pagamentos (restaurante_id, atendimento_id, forma, valor, recebido_por)
      values (v_restaurante, p_atendimento_id, (v_pag->>'forma')::public.forma_pagamento, v_valor, auth.uid());
    end if;
  end loop;

  update public.pedidos set status = 'entregue' where atendimento_id = p_atendimento_id and status = 'pronto';
  update public.pedidos set status = 'finalizado' where atendimento_id = p_atendimento_id and status = 'entregue';

  update public.atendimentos set status = 'fechado', fechado_em = now(), fechado_por = auth.uid()
   where id = p_atendimento_id;

  select numero into v_numero from public.mesas where id = v_atendimento.mesa_id;
  perform privado.registrar_auditoria(v_restaurante, 'mesa.fechada', 'atendimentos', p_atendimento_id::text,
    'fechou a ' || privado.rotulo_mesa(v_numero) || ' — total ' || privado.formatar_brl(v_totais.total),
    jsonb_build_object('total', v_totais.total, 'pagamentos', p_pagamentos));

  return jsonb_build_object('total', v_totais.total, 'troco', greatest(v_pago - v_totais.total, 0));
end $$;

-- Usuário atualiza o próprio nome/telefone sem poder mudar o papel
create or replace function public.atualizar_meu_perfil(p_nome text, p_telefone text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.usuarios
     set nome = coalesce(nullif(trim(p_nome), ''), nome),
         telefone = nullif(trim(p_telefone), ''),
         visto_em = now()
   where id = auth.uid();
end $$;

grant execute on all functions in schema privado to authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.abrir_mesa(uuid, integer),
  public.enviar_pedido(uuid, uuid, jsonb, text, integer),
  public.atualizar_status_pedido(uuid, public.status_pedido, text),
  public.cancelar_item_pedido(uuid, text),
  public.adicionar_itens_pedido(uuid, jsonb),
  public.solicitar_conta(uuid),
  public.totais_atendimento(uuid),
  public.fechar_mesa(uuid, jsonb, numeric, boolean),
  public.atualizar_meu_perfil(text, text)
to authenticated;

-- ===================== 20260929000003_rls_realtime_storage.sql =====================
-- =============================================================
-- Row Level Security: isolamento por restaurante + controle por papel.
-- Regra geral:
--   * membros ativos leem dados operacionais do próprio restaurante;
--   * somente a gestão (proprietário/gerente/administrador) altera cadastros;
--   * financeiro, auditoria e estoque são exclusivos da gestão;
--   * pedidos e mesas mudam apenas pelas funções validadas no servidor.
-- =============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'restaurantes','usuarios','setores','mesas','atendimentos','categorias','produtos',
    'grupos_opcoes','opcoes','produto_grupos_opcoes','pedidos','itens_pedido',
    'itens_pedido_opcoes','historico_status_pedido','pagamentos','categorias_despesa','fornecedores',
    'despesas','itens_estoque','produto_ingredientes','movimentacoes_estoque','notificacoes','auditoria'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- Restaurante ----------
create policy "membros leem o restaurante" on public.restaurantes
  for select to authenticated using (id = (select privado.restaurante_atual()));
create policy "gestão atualiza o restaurante" on public.restaurantes
  for update to authenticated
  using (id = (select privado.restaurante_atual()) and (select privado.eh_gestao()))
  with check (id = (select privado.restaurante_atual()));

-- Colunas editáveis pela gestão (sequencia_pedido só muda pelas funções)
revoke update on public.restaurantes from authenticated;
grant update (nome, logo_url, endereco, telefone, horario_funcionamento, taxa_servico_percentual, moeda,
              fuso_horario, garcom_pode_fechar_mesa, baixa_estoque_automatica) on public.restaurantes to authenticated;

-- ---------- Usuários ----------
create policy "membros leem a equipe" on public.usuarios
  for select to authenticated
  using (id = auth.uid() or restaurante_id = (select privado.restaurante_atual()));
create policy "gestão atualiza a equipe" on public.usuarios
  for update to authenticated
  using (restaurante_id = (select privado.restaurante_atual()) and (select privado.eh_gestao()))
  with check (restaurante_id = (select privado.restaurante_atual()));
revoke update on public.usuarios from authenticated;
grant update (nome, telefone, papel, ativo, avatar_url) on public.usuarios to authenticated;
-- o cadastro de usuários acontece no servidor (chave secreta) — sem política de insert

-- ---------- Cadastros operacionais (leitura: todos; escrita: gestão) ----------
do $$
declare t text;
begin
  foreach t in array array[
    'setores','mesas','categorias','produtos','grupos_opcoes','opcoes','produto_grupos_opcoes'
  ] loop
    execute format($f$
      create policy "membros leem" on public.%1$I
        for select to authenticated
        using (restaurante_id = (select privado.restaurante_atual()));
      create policy "gestão insere" on public.%1$I
        for insert to authenticated
        with check (restaurante_id = (select privado.restaurante_atual()) and (select privado.eh_gestao()));
      create policy "gestão atualiza" on public.%1$I
        for update to authenticated
        using (restaurante_id = (select privado.restaurante_atual()) and (select privado.eh_gestao()))
        with check (restaurante_id = (select privado.restaurante_atual()));
      create policy "gestão exclui" on public.%1$I
        for delete to authenticated
        using (restaurante_id = (select privado.restaurante_atual()) and (select privado.eh_gestao()));
    $f$, t);
  end loop;
end $$;

-- ---------- Operação (leitura: todos; escrita: somente pelas funções) ----------
do $$
declare t text;
begin
  foreach t in array array[
    'atendimentos','pedidos','itens_pedido','itens_pedido_opcoes','historico_status_pedido'
  ] loop
    execute format($f$
      create policy "membros leem" on public.%1$I
        for select to authenticated
        using (restaurante_id = (select privado.restaurante_atual()));
    $f$, t);
  end loop;
end $$;

-- Gestão pode editar a observação do pedido diretamente...
create policy "gestão atualiza pedidos" on public.pedidos
  for update to authenticated
  using (restaurante_id = (select privado.restaurante_atual()) and (select privado.eh_gestao()))
  with check (restaurante_id = (select privado.restaurante_atual()));
-- ...mas status e valores só mudam pelas funções
revoke update on public.pedidos from authenticated;
grant update (observacao) on public.pedidos to authenticated;

-- ---------- Financeiro, estoque e auditoria (somente gestão) ----------
do $$
declare t text;
begin
  foreach t in array array[
    'pagamentos','categorias_despesa','fornecedores','despesas','itens_estoque','produto_ingredientes','movimentacoes_estoque'
  ] loop
    execute format($f$
      create policy "gestão lê" on public.%1$I
        for select to authenticated
        using (restaurante_id = (select privado.restaurante_atual()) and (select privado.eh_gestao()));
      create policy "gestão insere" on public.%1$I
        for insert to authenticated
        with check (restaurante_id = (select privado.restaurante_atual()) and (select privado.eh_gestao()));
      create policy "gestão atualiza" on public.%1$I
        for update to authenticated
        using (restaurante_id = (select privado.restaurante_atual()) and (select privado.eh_gestao()))
        with check (restaurante_id = (select privado.restaurante_atual()));
      create policy "gestão exclui" on public.%1$I
        for delete to authenticated
        using (restaurante_id = (select privado.restaurante_atual()) and (select privado.eh_gestao()));
    $f$, t);
  end loop;
end $$;

-- Pagamentos são registros contábeis: sem edição nem exclusão pela API
drop policy "gestão atualiza" on public.pagamentos;
drop policy "gestão exclui" on public.pagamentos;
drop policy "gestão insere" on public.pagamentos;
-- Movimentações de estoque não podem ser alteradas
drop policy "gestão atualiza" on public.movimentacoes_estoque;
drop policy "gestão exclui" on public.movimentacoes_estoque;

create policy "gestão lê auditoria" on public.auditoria
  for select to authenticated
  using (restaurante_id = (select privado.restaurante_atual()) and (select privado.eh_gestao()));

-- ---------- Notificações ----------
create policy "destinatários leem notificações" on public.notificacoes
  for select to authenticated
  using (
    restaurante_id = (select privado.restaurante_atual())
    and (
      (select privado.eh_gestao())
      or usuario_destino_id = auth.uid()
      or (usuario_destino_id is null and (papel_destino is null or papel_destino = (select privado.papel_atual())))
    )
  );
create policy "destinatários marcam como lida" on public.notificacoes
  for update to authenticated
  using (
    restaurante_id = (select privado.restaurante_atual())
    and ((select privado.eh_gestao()) or usuario_destino_id = auth.uid()
         or (usuario_destino_id is null and (papel_destino is null or papel_destino = (select privado.papel_atual()))))
  )
  with check (restaurante_id = (select privado.restaurante_atual()));
revoke update on public.notificacoes from authenticated;
grant update (lida_em) on public.notificacoes to authenticated;

-- visitantes sem login não acessam nada
revoke all on all tables in schema public from anon;

-- ---------- Visão do salão (respeita o RLS de quem consulta) ----------
create view public.visao_mesas with (security_invoker = true) as
select
  m.id, m.restaurante_id, m.numero, m.capacidade, m.formato, m.pos_x, m.pos_y, m.status, m.ativa,
  m.setor_id, s.nome as setor_nome,
  a.id as atendimento_id, a.pessoas, a.aberto_em, a.status as atendimento_status,
  a.garcom_id, u.nome as garcom_nome,
  coalesce((select sum(p.subtotal) from public.pedidos p
             where p.atendimento_id = a.id and p.status not in ('cancelado','devolvido')), 0) as subtotal
from public.mesas m
left join public.setores s on s.id = m.setor_id
left join public.atendimentos a on a.id = m.atendimento_atual_id
left join public.usuarios u on u.id = a.garcom_id;

grant select on public.visao_mesas to authenticated;

-- ---------- Tempo real ----------
-- O Realtime respeita o RLS: cada usuário só recebe eventos do próprio restaurante.
alter publication supabase_realtime add table
  public.mesas, public.atendimentos, public.pedidos, public.itens_pedido, public.notificacoes;

-- ---------- Armazenamento de arquivos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('imagens-produtos', 'imagens-produtos', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('logos', 'logos', true, 2097152, array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('comprovantes', 'comprovantes', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- O caminho sempre começa pelo restaurante_id: <restaurante_id>/arquivo.ext
create policy "gestão envia arquivos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('imagens-produtos','logos','comprovantes')
    and (storage.foldername(name))[1] = (select privado.restaurante_atual())::text
    and (select privado.eh_gestao())
  );
create policy "gestão altera arquivos" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('imagens-produtos','logos','comprovantes')
    and (storage.foldername(name))[1] = (select privado.restaurante_atual())::text
    and (select privado.eh_gestao())
  );
create policy "gestão remove arquivos" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('imagens-produtos','logos','comprovantes')
    and (storage.foldername(name))[1] = (select privado.restaurante_atual())::text
    and (select privado.eh_gestao())
  );
create policy "gestão lê comprovantes" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = (select privado.restaurante_atual())::text
    and (select privado.eh_gestao())
  );

-- ===================== 20260929000004_team_audit.sql =====================
-- Auditoria de eventos da equipe executados no servidor com a chave secreta
-- (cadastro de usuário e redefinição de senha), registrados em nome do gestor.
create or replace function public.registrar_evento_equipe(p_usuario_id uuid, p_evento text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_restaurante uuid := privado.exigir_restaurante();
  v_nome text;
begin
  if not privado.eh_gestao() then
    raise exception 'Você não possui permissão para realizar esta ação.' using errcode = '42501';
  end if;
  select nome into v_nome from public.usuarios where id = p_usuario_id and restaurante_id = v_restaurante;
  if v_nome is null then
    return;
  end if;
  perform privado.registrar_auditoria(v_restaurante, 'usuarios.' || p_evento, 'usuarios', p_usuario_id::text,
    case p_evento
      when 'cadastro' then 'cadastrou o usuário ' || v_nome
      when 'senha_redefinida' then 'redefiniu a senha de ' || v_nome
      else 'alterou o usuário ' || v_nome
    end);
end $$;

revoke execute on function public.registrar_evento_equipe(uuid, text) from public, anon;
grant execute on function public.registrar_evento_equipe(uuid, text) to authenticated;

-- ===================== 20261002000005_sincronizar_perfil.sql =====================
-- O Auth do Supabase grava o app_metadata (restaurante e papel) num UPDATE
-- logo após criar o usuário. Este gatilho completa o perfil quando isso acontece.
create or replace function privado.ao_atualizar_usuario_auth()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.usuarios u
     set restaurante_id = coalesce(u.restaurante_id, nullif(new.raw_app_meta_data->>'restaurante_id', '')::uuid),
         papel = coalesce(nullif(new.raw_app_meta_data->>'papel', '')::public.papel_usuario, u.papel),
         nome = coalesce(nullif(new.raw_user_meta_data->>'nome', ''), u.nome)
   where u.id = new.id;
  return new;
end $$;

drop trigger if exists ao_atualizar_usuario_auth on auth.users;
create trigger ao_atualizar_usuario_auth
  after update of raw_app_meta_data, raw_user_meta_data on auth.users
  for each row execute function privado.ao_atualizar_usuario_auth();

-- Corrige perfis já criados sem restaurante
update public.usuarios u
   set restaurante_id = nullif(a.raw_app_meta_data->>'restaurante_id', '')::uuid,
       papel = coalesce(nullif(a.raw_app_meta_data->>'papel', '')::public.papel_usuario, u.papel),
       nome = coalesce(nullif(a.raw_user_meta_data->>'nome', ''), u.nome)
  from auth.users a
 where a.id = u.id
   and u.restaurante_id is null
   and nullif(a.raw_app_meta_data->>'restaurante_id', '') is not null;

-- ===================== 20261002000006_dashboard.sql =====================
-- =============================================================
-- Fase 7: indicadores do dashboard (somente gestão)
-- + garante que as tabelas operacionais estão publicadas no Realtime.
-- =============================================================

-- ---------- Tempo real (idempotente) ----------
do $$
declare t text;
begin
  foreach t in array array['mesas','atendimentos','pedidos','itens_pedido','notificacoes','pagamentos','despesas'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- Métricas de um intervalo de datas (horário de Brasília) ----------
create or replace function privado.metricas_periodo(p_restaurante uuid, p_inicio date, p_fim date)
returns jsonb language sql stable security definer set search_path = '' as $$
  with limites as (
    select (p_inicio::timestamp at time zone 'America/Sao_Paulo') as de,
           ((p_fim + 1)::timestamp at time zone 'America/Sao_Paulo') as ate
  ),
  receita as (
    select coalesce(sum(pg.valor), 0) as v, count(distinct pg.atendimento_id) as mesas
      from public.pagamentos pg, limites l
     where pg.restaurante_id = p_restaurante and pg.criado_em >= l.de and pg.criado_em < l.ate
  ),
  pedidos as (
    select count(*) filter (where p.status not in ('cancelado','devolvido')) as validos,
           count(*) filter (where p.status in ('cancelado','devolvido')) as cancelados
      from public.pedidos p, limites l
     where p.restaurante_id = p_restaurante and p.criado_em >= l.de and p.criado_em < l.ate
  ),
  gastos as (
    select coalesce(sum(d.valor), 0) as v
      from public.despesas d
     where d.restaurante_id = p_restaurante and d.data between p_inicio and p_fim
  )
  select jsonb_build_object(
    'faturamento', r.v,
    'pedidos', p.validos,
    'cancelados', p.cancelados,
    'mesas_atendidas', r.mesas,
    'ticket_medio', case when p.validos > 0 then round(r.v / p.validos, 2) else 0 end,
    'despesas', g.v,
    'lucro', r.v - g.v
  )
  from receita r, pedidos p, gastos g
$$;

-- ---------- Resumo completo do dashboard ----------
create or replace function public.resumo_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_rid uuid := privado.exigir_restaurante();
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_semana date;
  v_mes date;
  v_dias int;
  v_serie jsonb;
  v_status jsonb;
  v_aberto numeric;
begin
  if not privado.eh_gestao() then
    raise exception 'Você não possui permissão para realizar esta ação.' using errcode = '42501';
  end if;

  v_semana := v_hoje - (extract(isodow from v_hoje)::int - 1);   -- segunda-feira
  v_mes := date_trunc('month', v_hoje)::date;
  v_dias := v_hoje - v_mes;                                       -- dias já corridos no mês

  -- faturamento x despesas dos últimos 14 dias
  select jsonb_agg(jsonb_build_object(
           'dia', d::date,
           'faturamento', (privado.metricas_periodo(v_rid, d::date, d::date)->>'faturamento')::numeric,
           'despesas', (privado.metricas_periodo(v_rid, d::date, d::date)->>'despesas')::numeric
         ) order by d)
    into v_serie
    from generate_series(v_hoje - 13, v_hoje, interval '1 day') d;

  -- pedidos de hoje por status + os que seguem em andamento de dias anteriores
  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) into v_status
    from (
      select p.status::text as status, count(*) as n
        from public.pedidos p
       where p.restaurante_id = v_rid
         and (p.criado_em >= (v_hoje::timestamp at time zone 'America/Sao_Paulo')
              or p.status in ('novo','em_preparo','pronto','entregue'))
       group by p.status
    ) s;

  -- consumo ainda não pago nas mesas abertas (com taxa de serviço)
  select coalesce(sum(p.subtotal * (1 + a.taxa_servico_percentual / 100)), 0) into v_aberto
    from public.pedidos p
    join public.atendimentos a on a.id = p.atendimento_id
   where p.restaurante_id = v_rid and a.status <> 'fechado' and p.status not in ('cancelado','devolvido');

  return jsonb_build_object(
    'hoje', v_hoje,
    'periodos', jsonb_build_object(
      'hoje', privado.metricas_periodo(v_rid, v_hoje, v_hoje),
      'ontem', privado.metricas_periodo(v_rid, v_hoje - 1, v_hoje - 1),
      'semana', privado.metricas_periodo(v_rid, v_semana, v_hoje),
      'semana_anterior', privado.metricas_periodo(v_rid, v_semana - 7, v_hoje - 7),
      'mes', privado.metricas_periodo(v_rid, v_mes, v_hoje),
      'mes_anterior', privado.metricas_periodo(v_rid, (v_mes - interval '1 month')::date, ((v_mes - interval '1 month')::date + v_dias))
    ),
    'serie_14_dias', coalesce(v_serie, '[]'::jsonb),
    'pedidos_status', v_status,
    'em_aberto', round(v_aberto, 2)
  );
end $$;

grant execute on function privado.metricas_periodo(uuid, date, date) to authenticated;
revoke execute on function public.resumo_dashboard() from public, anon;
grant execute on function public.resumo_dashboard() to authenticated;

-- ===================== 20261002000007_relatorios.sql =====================
-- =============================================================
-- Fase 9: relatórios agregados no banco (somente gestão).
-- Datas no horário de Brasília; período máximo de 1 ano.
-- =============================================================

create or replace function public.relatorio(p_inicio date, p_fim date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_rid uuid := privado.exigir_restaurante();
  v_de timestamptz;
  v_ate timestamptz;
  v_out jsonb;
begin
  if not privado.eh_gestao() then
    raise exception 'Você não possui permissão para realizar esta ação.' using errcode = '42501';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Escolha um período válido.' using errcode = '22023';
  end if;
  if p_fim - p_inicio > 366 then
    raise exception 'Escolha um período de até 1 ano.' using errcode = '22023';
  end if;

  v_de := p_inicio::timestamp at time zone 'America/Sao_Paulo';
  v_ate := (p_fim + 1)::timestamp at time zone 'America/Sao_Paulo';

  with
  ped as (   -- pedidos do período
    select p.*, (p.criado_em at time zone 'America/Sao_Paulo') as local
      from public.pedidos p
     where p.restaurante_id = v_rid and p.criado_em >= v_de and p.criado_em < v_ate
  ),
  validos as (select * from ped where status not in ('cancelado','devolvido')),
  itens as (   -- itens vendidos (sem cancelados)
    select i.produto_id, i.produto_nome, i.quantidade, i.preco_unitario * i.quantidade as receita
      from public.itens_pedido i join validos v on v.id = i.pedido_id
     where not i.cancelado
  ),
  pag as (
    select pg.*, (pg.criado_em at time zone 'America/Sao_Paulo')::date as dia
      from public.pagamentos pg
     where pg.restaurante_id = v_rid and pg.criado_em >= v_de and pg.criado_em < v_ate
  ),
  desp as (
    select d.*, c.nome as categoria, c.tipo
      from public.despesas d join public.categorias_despesa c on c.id = d.categoria_id
     where d.restaurante_id = v_rid and d.data between p_inicio and p_fim
  ),
  atend as (   -- mesas fechadas no período
    select a.* from public.atendimentos a
     where a.restaurante_id = v_rid and a.status = 'fechado' and a.fechado_em >= v_de and a.fechado_em < v_ate
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),

    'resumo', jsonb_build_object(
      'faturamento', (select coalesce(sum(valor), 0) from pag),
      'despesas', (select coalesce(sum(valor), 0) from desp),
      'pedidos', (select count(*) from validos),
      'cancelados', (select count(*) from ped where status in ('cancelado','devolvido')),
      'itens', (select coalesce(sum(quantidade), 0) from itens),
      'mesas_atendidas', (select count(*) from atend),
      'pessoas', (select coalesce(sum(pessoas), 0) from atend)
    ),

    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'dia', d::date,
               'faturamento', coalesce((select sum(valor) from pag where pag.dia = d::date), 0),
               'despesas', coalesce((select sum(valor) from desp where desp.data = d::date), 0),
               'pedidos', (select count(*) from validos where validos.local::date = d::date)
             ) order by d), '[]'::jsonb)
        from generate_series(p_inicio, p_fim, interval '1 day') d
    ),

    'por_hora', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'hora', h,
               'pedidos', (select count(*) from validos where extract(hour from validos.local) = h),
               'receita', coalesce((select sum(subtotal) from validos where extract(hour from validos.local) = h), 0)
             ) order by h), '[]'::jsonb)
        from generate_series(0, 23) h
    ),

    'produtos', (
      select coalesce(jsonb_agg(x order by x.receita desc), '[]'::jsonb) from (
        select it.produto_nome as nome, coalesce(c.nome, 'Sem categoria') as categoria,
               sum(it.quantidade) as quantidade, round(sum(it.receita), 2) as receita
          from itens it
          left join public.produtos pr on pr.id = it.produto_id
          left join public.categorias c on c.id = pr.categoria_id
         group by it.produto_nome, c.nome
         order by sum(it.receita) desc
         limit 100
      ) x
    ),

    'categorias', (
      select coalesce(jsonb_agg(x order by x.receita desc), '[]'::jsonb) from (
        select coalesce(c.nome, 'Sem categoria') as nome, sum(it.quantidade) as quantidade, round(sum(it.receita), 2) as receita
          from itens it
          left join public.produtos pr on pr.id = it.produto_id
          left join public.categorias c on c.id = pr.categoria_id
         group by c.nome
      ) x
    ),

    'garcons', (
      select coalesce(jsonb_agg(x order by x.receita desc), '[]'::jsonb) from (
        select coalesce(u.nome, 'Sem garçom') as nome,
               count(*) as pedidos,
               round(sum(v.subtotal), 2) as receita,
               round(sum(v.subtotal) / nullif(count(*), 0), 2) as ticket_medio,
               (select count(*) from atend a where a.garcom_id is not distinct from v.garcom_id) as mesas
          from validos v left join public.usuarios u on u.id = v.garcom_id
         group by v.garcom_id, u.nome
      ) x
    ),

    'mesas', (
      select coalesce(jsonb_agg(x order by x.numero), '[]'::jsonb) from (
        select m.numero,
               count(a.id) as atendimentos,
               coalesce(sum(a.pessoas), 0) as pessoas,
               round(coalesce(sum((select sum(pg.valor) from public.pagamentos pg where pg.atendimento_id = a.id)), 0), 2) as receita,
               round(avg(extract(epoch from (a.fechado_em - a.aberto_em)) / 60)) as permanencia_min
          from public.mesas m
          left join atend a on a.mesa_id = m.id
         where m.restaurante_id = v_rid
         group by m.numero
      ) x
    ),

    'pedidos', jsonb_build_object(
      'status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status::text, count(*) n from ped group by status) s),
      'preparo_medio_min', (select round(avg(extract(epoch from (pronto_em - preparo_iniciado_em)) / 60), 1) from validos where pronto_em is not null and preparo_iniciado_em is not null),
      'espera_media_min', (select round(avg(extract(epoch from (pronto_em - enviado_em)) / 60), 1) from validos where pronto_em is not null and enviado_em is not null),
      'motivos_cancelamento', (
        select coalesce(jsonb_agg(x), '[]'::jsonb) from (
          select coalesce(motivo_cancelamento, 'Sem motivo informado') as motivo, count(*) as n
            from ped where status in ('cancelado','devolvido') group by 1 order by 2 desc limit 10
        ) x
      )
    ),

    'formas_pagamento', (
      select coalesce(jsonb_agg(x order by x.valor desc), '[]'::jsonb) from (
        select forma::text, round(sum(valor), 2) as valor, count(*) as n from pag group by forma
      ) x
    ),

    'despesas_categoria', (
      select coalesce(jsonb_agg(x order by x.valor desc), '[]'::jsonb) from (
        select categoria as nome, tipo::text as tipo, round(sum(valor), 2) as valor, count(*) as n from desp group by categoria, tipo
      ) x
    )
  ) into v_out;

  return v_out;
end $$;

revoke execute on function public.relatorio(date, date) from public, anon;
grant execute on function public.relatorio(date, date) to authenticated;

-- ===================== 20261002000008_estoque.sql =====================
-- =============================================================
-- Fase 10: estoque.
--   * a quantidade só muda por movimentações (entrada, saída, ajuste,
--     consumo automático) — nunca por edição direta;
--   * custo médio ponderado nas entradas;
--   * ficha técnica do produto gravada de uma vez;
--   * resumo de movimentações por período.
-- =============================================================

-- ---------- Colunas editáveis (quantidade fica de fora) ----------
revoke insert, update on public.itens_estoque from authenticated;
grant insert (restaurante_id, fornecedor_id, nome, unidade, quantidade_minima, custo_unitario, ativo) on public.itens_estoque to authenticated;
grant update (fornecedor_id, nome, unidade, quantidade_minima, custo_unitario, ativo) on public.itens_estoque to authenticated;

-- Movimentações só entram pelas funções abaixo
revoke insert on public.movimentacoes_estoque from authenticated;
drop policy if exists "gestão insere" on public.movimentacoes_estoque;

-- Item só pode ser excluído se nunca foi movimentado (senão, desative)
drop policy if exists "gestão exclui" on public.itens_estoque;
create policy "gestão exclui" on public.itens_estoque
  for delete to authenticated
  using (
    restaurante_id = (select privado.restaurante_atual()) and (select privado.eh_gestao())
    and not exists (select 1 from public.movimentacoes_estoque m where m.item_estoque_id = itens_estoque.id)
  );

-- ---------- Movimentar estoque ----------
-- entrada: soma p_quantidade (recalcula o custo médio se p_custo_unitario vier)
-- saida:   subtrai p_quantidade (perda, vencimento, uso interno) — motivo obrigatório
-- ajuste:  p_quantidade é o total contado; registra a diferença
create or replace function public.movimentar_estoque(
  p_item_id uuid,
  p_tipo public.tipo_movimentacao,
  p_quantidade numeric,
  p_custo_unitario numeric default null,
  p_motivo text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_rid uuid := privado.exigir_restaurante();
  v_item public.itens_estoque;
  v_delta numeric;
  v_custo numeric;
  v_motivo text := nullif(trim(p_motivo), '');
  v_desc text;
begin
  if not privado.eh_gestao() then
    raise exception 'Você não possui permissão para realizar esta ação.' using errcode = '42501';
  end if;

  select * into v_item from public.itens_estoque
   where id = p_item_id and restaurante_id = v_rid for update;
  if v_item.id is null then
    raise exception 'Item de estoque não encontrado.' using errcode = 'P0002';
  end if;

  if p_quantidade is null or p_quantidade < 0 or (p_tipo <> 'ajuste' and p_quantidade = 0) then
    raise exception 'Informe uma quantidade válida.' using errcode = '22023';
  end if;
  if p_quantidade > 999999 then
    raise exception 'Quantidade muito alta.' using errcode = '22023';
  end if;
  if p_custo_unitario is not null and (p_custo_unitario < 0 or p_custo_unitario > 9999999) then
    raise exception 'Informe um custo válido.' using errcode = '22023';
  end if;
  if length(v_motivo) > 200 then
    raise exception 'O motivo deve ter no máximo 200 caracteres.' using errcode = '22023';
  end if;

  v_custo := v_item.custo_unitario;

  case p_tipo
    when 'entrada' then
      v_delta := p_quantidade;
      if p_custo_unitario is not null then
        v_custo := case when v_item.quantidade > 0
                        then round((v_item.quantidade * v_item.custo_unitario + p_quantidade * p_custo_unitario) / (v_item.quantidade + p_quantidade), 2)
                        else p_custo_unitario end;
      end if;
      v_motivo := coalesce(v_motivo, 'Entrada de mercadoria');
      v_desc := 'registrou entrada de ';
    when 'saida' then
      if v_motivo is null then
        raise exception 'Informe o motivo da saída.' using errcode = '22023';
      end if;
      if p_quantidade > v_item.quantidade then
        raise exception 'A saída é maior que o estoque atual. Use "Contagem" para corrigir o saldo.' using errcode = '22023';
      end if;
      v_delta := -p_quantidade;
      v_desc := 'registrou saída de ';
    when 'ajuste' then
      v_delta := p_quantidade - v_item.quantidade;
      if v_delta = 0 then
        raise exception 'A quantidade contada é igual à do sistema.' using errcode = '22023';
      end if;
      v_motivo := coalesce(v_motivo, 'Contagem de estoque');
      v_desc := 'ajustou o estoque de ';
    else
      raise exception 'Tipo de movimentação inválido.' using errcode = '22023';
  end case;

  insert into public.movimentacoes_estoque (restaurante_id, item_estoque_id, tipo, quantidade, custo_unitario, motivo, criado_por)
  values (v_rid, v_item.id, p_tipo, v_delta, coalesce(p_custo_unitario, v_item.custo_unitario), v_motivo, auth.uid());

  update public.itens_estoque
     set quantidade = quantidade + v_delta, custo_unitario = v_custo
   where id = v_item.id
  returning * into v_item;

  perform privado.registrar_auditoria(v_rid, 'estoque.' || p_tipo, 'itens_estoque', v_item.id::text,
    v_desc || v_item.nome || ' (' || case when v_delta > 0 then '+' else '' end
      || replace(trim_scale(v_delta)::text, '.', ',') || ' ' || v_item.unidade || ')',
    jsonb_build_object('tipo', p_tipo, 'quantidade', v_delta, 'saldo', v_item.quantidade, 'motivo', v_motivo));

  return to_jsonb(v_item);
end $$;

-- ---------- Ficha técnica ----------
-- p_itens: [{item_estoque_id, quantidade}] — substitui a ficha inteira
create or replace function public.definir_ficha_tecnica(p_produto_id uuid, p_itens jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_rid uuid := privado.exigir_restaurante();
  v_nome text;
  v_total integer;
begin
  if not privado.eh_gestao() then
    raise exception 'Você não possui permissão para realizar esta ação.' using errcode = '42501';
  end if;
  select nome into v_nome from public.produtos where id = p_produto_id and restaurante_id = v_rid;
  if v_nome is null then
    raise exception 'Produto não encontrado.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(coalesce(p_itens, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) > 50 then
    raise exception 'Lista de ingredientes inválida.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) x
     where (x->>'quantidade')::numeric is null or (x->>'quantidade')::numeric <= 0 or (x->>'quantidade')::numeric > 9999
  ) then
    raise exception 'Informe quantidades maiores que zero.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) x
     where not exists (select 1 from public.itens_estoque i where i.id = (x->>'item_estoque_id')::uuid and i.restaurante_id = v_rid)
  ) then
    raise exception 'Ingrediente não encontrado no estoque.' using errcode = '22023';
  end if;

  delete from public.produto_ingredientes where produto_id = p_produto_id;
  insert into public.produto_ingredientes (restaurante_id, produto_id, item_estoque_id, quantidade)
  select v_rid, p_produto_id, (x->>'item_estoque_id')::uuid, sum((x->>'quantidade')::numeric)
    from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) x
   group by (x->>'item_estoque_id')::uuid;
  get diagnostics v_total = row_count;

  perform privado.registrar_auditoria(v_rid, 'produtos.ficha_tecnica', 'produtos', p_produto_id::text,
    'atualizou a ficha técnica de ' || v_nome || ' (' || v_total || ' ingredientes)');
  return v_total;
end $$;

-- ---------- Resumo de movimentações no período ----------
create or replace function public.resumo_estoque(p_inicio date, p_fim date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_rid uuid := privado.exigir_restaurante();
  v_de timestamptz;
  v_ate timestamptz;
  v_out jsonb;
begin
  if not privado.eh_gestao() then
    raise exception 'Você não possui permissão para realizar esta ação.' using errcode = '42501';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio or p_fim - p_inicio > 366 then
    raise exception 'Escolha um período válido de até 1 ano.' using errcode = '22023';
  end if;
  v_de := p_inicio::timestamp at time zone 'America/Sao_Paulo';
  v_ate := (p_fim + 1)::timestamp at time zone 'America/Sao_Paulo';

  with mov as (
    select m.*, abs(m.quantidade) * coalesce(m.custo_unitario, i.custo_unitario) as valor
      from public.movimentacoes_estoque m join public.itens_estoque i on i.id = m.item_estoque_id
     where m.restaurante_id = v_rid and m.criado_em >= v_de and m.criado_em < v_ate
  )
  select jsonb_build_object(
    'totais', (
      select coalesce(jsonb_object_agg(tipo, jsonb_build_object('n', n, 'valor', valor)), '{}'::jsonb)
        from (select tipo::text, count(*) n, round(sum(valor), 2) valor from mov group by tipo) t
    ),
    'ajuste_liquido', (select coalesce(round(sum(quantidade * coalesce(custo_unitario, 0)), 2), 0) from mov where tipo = 'ajuste'),
    'por_item', (
      select coalesce(jsonb_agg(x order by x.valor_saida desc), '[]'::jsonb) from (
        select i.id, i.nome, i.unidade,
               coalesce(sum(m.quantidade) filter (where m.tipo = 'entrada'), 0) as entrada,
               coalesce(-sum(m.quantidade) filter (where m.tipo = 'consumo'), 0) as consumo,
               coalesce(-sum(m.quantidade) filter (where m.tipo = 'saida'), 0) as saida,
               coalesce(sum(m.quantidade) filter (where m.tipo = 'ajuste'), 0) as ajuste,
               round(coalesce(sum(m.valor) filter (where m.tipo in ('consumo', 'saida')), 0), 2) as valor_saida
          from mov m join public.itens_estoque i on i.id = m.item_estoque_id
         group by i.id, i.nome, i.unidade
      ) x
    )
  ) into v_out;
  return v_out;
end $$;

revoke execute on function public.movimentar_estoque(uuid, public.tipo_movimentacao, numeric, numeric, text) from public, anon;
revoke execute on function public.definir_ficha_tecnica(uuid, jsonb) from public, anon;
revoke execute on function public.resumo_estoque(date, date) from public, anon;
grant execute on function public.movimentar_estoque(uuid, public.tipo_movimentacao, numeric, numeric, text) to authenticated;
grant execute on function public.definir_ficha_tecnica(uuid, jsonb) to authenticated;
grant execute on function public.resumo_estoque(date, date) to authenticated;

notify pgrst, 'reload schema';

-- ===================== 20261003000009_auditoria.sql =====================
-- =============================================================
-- Fase 11: auditoria.
--   * categoria calculada para filtrar por área;
--   * índices para filtros por pessoa, área e período;
--   * registro imutável (ninguém altera nem apaga pela API);
--   * novos eventos: acessos (entrada/saída), edição de mesas,
--     setores e itens de estoque.
-- =============================================================

-- ---------- Categoria por área ----------
alter table public.auditoria
  add column if not exists categoria text generated always as (
    case split_part(acao, '.', 1)
      when 'pedido' then 'pedidos'
      when 'item_pedido' then 'pedidos'
      when 'mesa' then 'salao'
      when 'mesas' then 'salao'
      when 'setores' then 'salao'
      when 'produtos' then 'cardapio'
      when 'categorias' then 'cardapio'
      when 'despesas' then 'financeiro'
      when 'fornecedores' then 'financeiro'
      when 'estoque' then 'estoque'
      when 'itens_estoque' then 'estoque'
      when 'usuarios' then 'equipe'
      when 'acesso' then 'equipe'
      when 'restaurantes' then 'configuracoes'
      else 'outros'
    end
  ) stored;

create index if not exists auditoria_autor_idx on public.auditoria(restaurante_id, autor_id, criado_em desc);
create index if not exists auditoria_categoria_idx on public.auditoria(restaurante_id, categoria, criado_em desc);

-- ---------- Registro imutável ----------
revoke insert, update, delete, truncate on public.auditoria from anon, authenticated;

-- ---------- Acessos ----------
-- Chamado pelo app após entrar e antes de sair. Ignora repetições em menos de 1 minuto.
create or replace function public.registrar_acesso(p_evento text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_usuario public.usuarios;
begin
  if p_evento not in ('entrada', 'saida') then
    raise exception 'Evento inválido.' using errcode = '22023';
  end if;
  select * into v_usuario from public.usuarios where id = auth.uid() and restaurante_id is not null;
  if v_usuario.id is null then
    return;
  end if;
  if exists (
    select 1 from public.auditoria
     where restaurante_id = v_usuario.restaurante_id and autor_id = v_usuario.id
       and acao = 'acesso.' || p_evento and criado_em > now() - interval '1 minute'
  ) then
    return;
  end if;
  perform privado.registrar_auditoria(v_usuario.restaurante_id, 'acesso.' || p_evento, 'usuarios', v_usuario.id::text,
    case p_evento when 'entrada' then 'entrou no sistema' else 'saiu do sistema' end);
end $$;

revoke execute on function public.registrar_acesso(text) from public, anon;
grant execute on function public.registrar_acesso(text) to authenticated;

-- ---------- Mais cadastros auditados ----------
drop trigger if exists auditar_mesas_alteracao on public.mesas;
create trigger auditar_mesas_alteracao after update on public.mesas
  for each row when (
    (old.numero, old.capacidade, old.formato, old.setor_id, old.ativa)
      is distinct from (new.numero, new.capacidade, new.formato, new.setor_id, new.ativa)
  )
  execute function privado.auditar_alteracao('a mesa');

drop trigger if exists auditar_setores on public.setores;
create trigger auditar_setores after insert or update or delete on public.setores
  for each row execute function privado.auditar_alteracao('o setor');

-- quantidade muda por movimentação (já auditada); aqui só o cadastro
drop trigger if exists auditar_itens_estoque_alteracao on public.itens_estoque;
create trigger auditar_itens_estoque_alteracao after update on public.itens_estoque
  for each row when (
    (old.nome, old.unidade, old.quantidade_minima, old.custo_unitario, old.ativo, old.fornecedor_id)
      is distinct from (new.nome, new.unidade, new.quantidade_minima, new.custo_unitario, new.ativo, new.fornecedor_id)
  )
  execute function privado.auditar_alteracao('o item de estoque');

notify pgrst, 'reload schema';

-- ===================== 20261003000010_seguranca.sql =====================
-- =============================================================
-- Fase 13: segurança.
--   * Impede escalonamento de privilégio na equipe: ninguém muda a
--     própria função nem se desativa; a função "proprietário" não é
--     dada nem tirada pela API; só proprietário/administrador mexe
--     em gerentes. Vale para o app e para chamadas diretas à API.
--   * Remove permissões sobrando de visitantes (anon).
-- =============================================================

create or replace function privado.proteger_usuarios()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ator public.papel_usuario;
begin
  -- servidor com chave secreta / SQL Editor (sem usuário logado): confiável
  if v_uid is null then
    return new;
  end if;
  if new.papel is not distinct from old.papel and new.ativo is not distinct from old.ativo then
    return new;
  end if;

  if old.id = v_uid then
    raise exception 'Você não pode alterar a própria função nem desativar o próprio acesso.' using errcode = '42501';
  end if;
  if old.papel = 'proprietario' or new.papel = 'proprietario' then
    raise exception 'A função de proprietário não pode ser alterada por aqui.' using errcode = '42501';
  end if;

  select papel into v_ator from public.usuarios where id = v_uid and ativo;
  if (old.papel in ('gerente', 'administrador') or new.papel in ('gerente', 'administrador'))
     and v_ator is distinct from 'proprietario' and v_ator is distinct from 'administrador' then
    raise exception 'Somente o proprietário pode alterar gerentes.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists proteger_usuarios on public.usuarios;
create trigger proteger_usuarios
  before update of papel, ativo on public.usuarios
  for each row execute function privado.proteger_usuarios();

-- Visitantes (sem login) não têm nada a fazer nas tabelas e visões do app
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
-- funções criadas daqui em diante também nascem fechadas para visitantes
alter default privileges in schema public revoke execute on functions from anon, public;

notify pgrst, 'reload schema';

-- ===================== 20261003000011_desempenho.sql =====================
-- =============================================================
-- Fase 14: desempenho.
-- Índices para as consultas mais frequentes do app e para as
-- verificações de chave estrangeira (exclusões de cadastros).
-- "if not exists": pode rodar mais de uma vez.
-- =============================================================

-- Conta da mesa / fechamento / relatório de mesas
create index if not exists pagamentos_atendimento_idx on public.pagamentos(atendimento_id);

-- Tela "Pedidos" do garçom (pedidos dele, mais recentes primeiro)
create index if not exists pedidos_garcom_idx on public.pedidos(restaurante_id, garcom_id, criado_em desc);
create index if not exists pedidos_mesa_idx on public.pedidos(mesa_id);

-- Painel e relatórios: mesas fechadas no período
create index if not exists atendimentos_fechados_idx on public.atendimentos(restaurante_id, fechado_em desc) where status = 'fechado';

-- Estoque: movimentações do período e baixa automática por pedido
create index if not exists movimentacoes_estoque_periodo_idx on public.movimentacoes_estoque(restaurante_id, criado_em desc);
create index if not exists movimentacoes_estoque_pedido_idx on public.movimentacoes_estoque(pedido_id) where pedido_id is not null;

-- Sino: notificações endereçadas a uma pessoa
create index if not exists notificacoes_usuario_idx on public.notificacoes(usuario_destino_id, criado_em desc) where usuario_destino_id is not null;

-- Exclusões de cadastros (checagem de chave estrangeira sem varrer a tabela inteira)
create index if not exists itens_pedido_produto_fk_idx on public.itens_pedido(produto_id);
create index if not exists itens_pedido_opcoes_opcao_idx on public.itens_pedido_opcoes(opcao_id);
create index if not exists produto_grupos_opcoes_grupo_idx on public.produto_grupos_opcoes(grupo_id);
create index if not exists produto_ingredientes_item_idx on public.produto_ingredientes(item_estoque_id);
create index if not exists despesas_categoria_idx on public.despesas(categoria_id);
create index if not exists despesas_fornecedor_idx on public.despesas(fornecedor_id) where fornecedor_id is not null;
create index if not exists mesas_setor_idx on public.mesas(setor_id) where setor_id is not null;

-- Estatísticas atualizadas para o planejador usar os índices novos
analyze public.pagamentos, public.pedidos, public.atendimentos, public.movimentacoes_estoque, public.notificacoes, public.itens_pedido;

-- ===================== seed.sql =====================
-- =============================================================
-- Dados de demonstração — Restaurante do Cacau
--
-- Usuários de teste (senha de todos: Cacau@2026):
--   dono@example.com      Proprietária  (Marina Souza)
--   joao@example.com      Garçom        (João Pereira)
--   beatriz@example.com   Garçonete     (Beatriz Lima)
--   cozinha@example.com   Cozinha       (Roberto Santos)
--
-- Troque as senhas antes de usar em produção.
-- =============================================================

select setseed(0.42);

-- ---------- Restaurante ----------
insert into public.restaurantes (id, nome, slug, endereco, telefone, taxa_servico_percentual, horario_funcionamento, garcom_pode_fechar_mesa)
values (
  '11111111-1111-4111-8111-111111111111', 'Restaurante do Cacau', 'restaurante-do-cacau',
  'Rua do Cacau, 120 — Centro, Ilhéus - BA', '(73) 3231-0000', 10,
  '{"seg":"11:00-23:00","ter":"11:00-23:00","qua":"11:00-23:00","qui":"11:00-23:00","sex":"11:00-00:00","sab":"11:00-00:00","dom":"11:00-17:00"}',
  true
);

-- ---------- Usuários (auth + perfil criado pelo gatilho) ----------
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'dono@example.com',    'Marina Souza',   'proprietario'),
      ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'joao@example.com',    'João Pereira',   'garcom'),
      ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'beatriz@example.com', 'Beatriz Lima',   'garcom'),
      ('aaaaaaaa-0000-4000-8000-000000000004'::uuid, 'cozinha@example.com', 'Roberto Santos', 'cozinha')
    ) as t(id, email, nome, papel)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('Cacau@2026', extensions.gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'),
                         'restaurante_id', '11111111-1111-4111-8111-111111111111', 'papel', u.papel),
      jsonb_build_object('nome', u.nome),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now());
  end loop;
end $$;

-- ---------- Salão e mesas 01–04 ----------
insert into public.setores (restaurante_id, nome, ordem) values
  ('11111111-1111-4111-8111-111111111111', 'Salão principal', 1);

insert into public.mesas (restaurante_id, setor_id, numero, capacidade, formato, pos_x, pos_y)
select '11111111-1111-4111-8111-111111111111',
       (select id from public.setores where nome = 'Salão principal'),
       n,
       case when n = 4 then 6 when n = 3 then 2 else 4 end,
       case when n = 3 then 'redonda' when n = 4 then 'retangular' else 'quadrada' end,
       n - 1,
       0
from generate_series(1, 4) n;

-- ---------- Cardápio ----------
insert into public.categorias (restaurante_id, nome, icone, ordem) values
  ('11111111-1111-4111-8111-111111111111', 'Entradas', 'salad', 1),
  ('11111111-1111-4111-8111-111111111111', 'Pratos', 'utensils', 2),
  ('11111111-1111-4111-8111-111111111111', 'Hambúrgueres', 'beef', 3),
  ('11111111-1111-4111-8111-111111111111', 'Pizzas', 'pizza', 4),
  ('11111111-1111-4111-8111-111111111111', 'Bebidas', 'cup-soda', 5),
  ('11111111-1111-4111-8111-111111111111', 'Sobremesas', 'ice-cream-cone', 6);

insert into public.produtos (restaurante_id, categoria_id, nome, descricao, preco, tempo_preparo_min, ordem)
select '11111111-1111-4111-8111-111111111111', c.id, p.nome, p.descricao, p.preco, p.preparo, p.ordem
from (values
  ('Entradas', 'Batata Frita', 'Porção crocante com sal e alecrim', 16.90, 10, 1),
  ('Entradas', 'Bolinho de Bacalhau', '6 unidades com limão', 29.90, 12, 2),
  ('Entradas', 'Pão de Alho', '4 unidades na brasa', 14.90, 8, 3),
  ('Entradas', 'Calabresa Acebolada', 'Com pão francês', 32.90, 12, 4),
  ('Entradas', 'Mandioca Frita', 'Com manteiga de garrafa', 18.90, 12, 5),
  ('Pratos', 'Picanha na Brasa', 'Arroz, farofa, vinagrete e fritas — serve 2', 89.90, 25, 1),
  ('Pratos', 'Filé à Parmegiana', 'Arroz e fritas', 64.90, 25, 2),
  ('Pratos', 'Frango Grelhado', 'Arroz, feijão e salada', 39.90, 20, 3),
  ('Pratos', 'Moqueca de Peixe', 'Com arroz e pirão — serve 2', 79.90, 30, 4),
  ('Pratos', 'Feijoada Completa', 'Arroz, couve, farofa e laranja', 54.90, 15, 5),
  ('Hambúrgueres', 'X-Burger', 'Blend 150 g, queijo e molho da casa', 24.90, 15, 1),
  ('Hambúrgueres', 'X-Bacon', 'Blend 150 g, queijo e bacon', 29.90, 15, 2),
  ('Hambúrgueres', 'X-Salada', 'Blend 150 g, queijo, alface e tomate', 26.90, 15, 3),
  ('Hambúrgueres', 'Cacau Burger', 'Blend 180 g, queijo coalho e geleia de cacau', 34.90, 18, 4),
  ('Pizzas', 'Pizza Mussarela', 'Grande, 8 fatias', 49.90, 20, 1),
  ('Pizzas', 'Pizza Calabresa', 'Grande, 8 fatias', 52.90, 20, 2),
  ('Pizzas', 'Pizza Portuguesa', 'Grande, 8 fatias', 56.90, 20, 3),
  ('Pizzas', 'Pizza Frango com Catupiry', 'Grande, 8 fatias', 58.90, 20, 4),
  ('Bebidas', 'Coca-Cola', 'Lata 350 ml', 6.00, 1, 1),
  ('Bebidas', 'Guaraná', 'Lata 350 ml', 6.00, 1, 2),
  ('Bebidas', 'Suco Natural', 'Laranja, limão ou maracujá — 400 ml', 8.00, 5, 3),
  ('Bebidas', 'Suco de Cacau', 'Polpa de cacau — 400 ml', 9.00, 5, 4),
  ('Bebidas', 'Água Mineral', '500 ml', 4.00, 1, 5),
  ('Bebidas', 'Cerveja Long Neck', '355 ml', 9.90, 1, 6),
  ('Bebidas', 'Caipirinha', 'Limão, cachaça artesanal', 16.90, 5, 7),
  ('Sobremesas', 'Pudim', 'Pudim de leite condensado', 9.90, 2, 1),
  ('Sobremesas', 'Mousse de Cacau', 'Chocolate 70% de Ilhéus', 12.90, 2, 2),
  ('Sobremesas', 'Petit Gâteau', 'Com sorvete de creme', 19.90, 12, 3),
  ('Sobremesas', 'Açaí 300 ml', 'Com granola e banana', 16.90, 5, 4)
) as p(categoria, nome, descricao, preco, preparo, ordem)
join public.categorias c on c.nome = p.categoria and c.restaurante_id = '11111111-1111-4111-8111-111111111111';

-- Pausa um item para demonstrar "indisponível"
update public.produtos set ativo = false where nome = 'Moqueca de Peixe';

-- ---------- Opções dos produtos ----------
insert into public.grupos_opcoes (restaurante_id, nome, min_escolhas, max_escolhas) values
  ('11111111-1111-4111-8111-111111111111', 'Ponto da carne', 1, 1),
  ('11111111-1111-4111-8111-111111111111', 'Adicionais do lanche', 0, 4),
  ('11111111-1111-4111-8111-111111111111', 'Adicionais do açaí', 0, 6),
  ('11111111-1111-4111-8111-111111111111', 'Borda', 0, 1),
  ('11111111-1111-4111-8111-111111111111', 'Sabor do suco', 1, 1);

insert into public.opcoes (restaurante_id, grupo_id, nome, acrescimo, ordem)
select '11111111-1111-4111-8111-111111111111', g.id, o.nome, o.acrescimo, o.ordem
from (values
  ('Ponto da carne', 'Mal passado', 0, 1), ('Ponto da carne', 'Ao ponto', 0, 2), ('Ponto da carne', 'Bem passado', 0, 3),
  ('Adicionais do lanche', 'Queijo', 3.00, 1), ('Adicionais do lanche', 'Bacon', 4.00, 2), ('Adicionais do lanche', 'Ovo', 2.50, 3),
  ('Adicionais do lanche', 'Cebola caramelizada', 2.00, 4),
  ('Adicionais do açaí', 'Leite condensado', 2.00, 1), ('Adicionais do açaí', 'Leite em pó', 2.00, 2),
  ('Adicionais do açaí', 'Paçoca', 2.00, 3), ('Adicionais do açaí', 'Granola extra', 2.00, 4),
  ('Adicionais do açaí', 'Banana extra', 2.00, 5), ('Adicionais do açaí', 'Mel', 2.00, 6),
  ('Adicionais do açaí', 'Morango', 3.00, 7), ('Adicionais do açaí', 'Creme de avelã', 4.00, 8),
  ('Borda', 'Catupiry', 8.00, 1), ('Borda', 'Cheddar', 8.00, 2),
  ('Sabor do suco', 'Laranja', 0, 1), ('Sabor do suco', 'Limão', 0, 2), ('Sabor do suco', 'Maracujá', 0, 3)
) as o(grupo, nome, acrescimo, ordem)
join public.grupos_opcoes g on g.nome = o.grupo;

insert into public.produto_grupos_opcoes (restaurante_id, produto_id, grupo_id, ordem)
select '11111111-1111-4111-8111-111111111111', p.id, g.id, case g.nome when 'Ponto da carne' then 1 else 2 end
from public.produtos p
join public.grupos_opcoes g on
     (p.nome in ('X-Burger','X-Bacon','X-Salada','Cacau Burger') and g.nome in ('Ponto da carne','Adicionais do lanche'))
  or (p.nome = 'Açaí 300 ml' and g.nome = 'Adicionais do açaí')
  or (p.nome = 'Picanha na Brasa' and g.nome = 'Ponto da carne')
  or (p.nome like 'Pizza %' and g.nome = 'Borda')
  or (p.nome = 'Suco Natural' and g.nome = 'Sabor do suco');

-- ---------- Financeiro ----------
insert into public.categorias_despesa (restaurante_id, nome, tipo)
select '11111111-1111-4111-8111-111111111111', n, t::public.tipo_despesa
from (values
  ('Alimentos','variavel'), ('Bebidas','variavel'), ('Fornecedores','variavel'), ('Funcionários','fixa'),
  ('Aluguel','fixa'), ('Energia','fixa'), ('Água','fixa'), ('Internet','fixa'), ('Gás','operacional'),
  ('Manutenção','operacional'), ('Limpeza','operacional'), ('Marketing','operacional'), ('Impostos','fixa'),
  ('Equipamentos','operacional'), ('Outros','variavel')
) as e(n, t);

insert into public.fornecedores (restaurante_id, nome, documento, telefone) values
  ('11111111-1111-4111-8111-111111111111', 'Distribuidora Bahia Alimentos', '12.345.678/0001-90', '(73) 3222-1000'),
  ('11111111-1111-4111-8111-111111111111', 'Bebidas Recôncavo', '23.456.789/0001-01', '(73) 3222-2000'),
  ('11111111-1111-4111-8111-111111111111', 'Hortifruti Ilhéus', '34.567.890/0001-12', '(73) 3222-3000'),
  ('11111111-1111-4111-8111-111111111111', 'Açougue Boi Nobre', '45.678.901/0001-23', '(73) 3222-4000');

-- ---------- Estoque ----------
insert into public.itens_estoque (restaurante_id, fornecedor_id, nome, unidade, quantidade, quantidade_minima, custo_unitario)
select '11111111-1111-4111-8111-111111111111', (select id from public.fornecedores where nome = i.forn), i.nome, i.unidade, i.qtd, i.minimo, i.custo
from (values
  ('Queijo Mussarela', 'kg', 12, 5, 42.90, 'Distribuidora Bahia Alimentos'),
  ('Blend bovino', 'kg', 8, 4, 48.00, 'Açougue Boi Nobre'),
  ('Picanha', 'kg', 6, 3, 79.90, 'Açougue Boi Nobre'),
  ('Pão de hambúrguer', 'un', 40, 30, 1.20, 'Distribuidora Bahia Alimentos'),
  ('Bacon', 'kg', 3, 2, 39.90, 'Açougue Boi Nobre'),
  ('Batata congelada', 'kg', 4, 10, 18.50, 'Distribuidora Bahia Alimentos'),
  ('Coca-Cola lata', 'un', 96, 48, 3.10, 'Bebidas Recôncavo'),
  ('Polpa de cacau', 'kg', 1.5, 2, 28.00, 'Hortifruti Ilhéus'),
  ('Chocolate 70%', 'kg', 3, 1, 89.00, 'Distribuidora Bahia Alimentos'),
  ('Tomate', 'kg', 7, 3, 7.90, 'Hortifruti Ilhéus')
) as i(nome, unidade, qtd, minimo, custo, forn);

insert into public.produto_ingredientes (restaurante_id, produto_id, item_estoque_id, quantidade)
select '11111111-1111-4111-8111-111111111111', p.id, ie.id, x.qtd
from (values
  ('X-Burger','Pão de hambúrguer',1), ('X-Burger','Blend bovino',0.15), ('X-Burger','Queijo Mussarela',0.03),
  ('X-Bacon','Pão de hambúrguer',1), ('X-Bacon','Blend bovino',0.15), ('X-Bacon','Bacon',0.04),
  ('X-Salada','Pão de hambúrguer',1), ('X-Salada','Blend bovino',0.15), ('X-Salada','Tomate',0.05),
  ('Cacau Burger','Pão de hambúrguer',1), ('Cacau Burger','Blend bovino',0.18),
  ('Batata Frita','Batata congelada',0.3), ('Picanha na Brasa','Picanha',0.6),
  ('Pizza Mussarela','Queijo Mussarela',0.35), ('Coca-Cola','Coca-Cola lata',1),
  ('Suco de Cacau','Polpa de cacau',0.15), ('Mousse de Cacau','Chocolate 70%',0.06)
) as x(prod, item, qtd)
join public.produtos p on p.nome = x.prod
join public.itens_estoque ie on ie.nome = x.item;

-- Entrada inicial de cada item (histórico de movimentações)
insert into public.movimentacoes_estoque (restaurante_id, item_estoque_id, tipo, quantidade, custo_unitario, motivo, criado_por, criado_em)
select restaurante_id, id, 'entrada', quantidade, custo_unitario, 'Estoque inicial', 'aaaaaaaa-0000-4000-8000-000000000001', now() - interval '7 days'
  from public.itens_estoque;

-- =============================================================
-- Pedidos de demonstração
-- =============================================================

-- Cria um pedido com itens (produtos e opções pelo nome)
create or replace function pg_temp.criar_pedido(
  p_mesa integer, p_atendimento uuid, p_garcom uuid,
  p_status public.status_pedido, p_quando timestamptz, p_itens jsonb, p_observacao text default null
) returns uuid language plpgsql as $$
declare
  v_restaurante uuid := '11111111-1111-4111-8111-111111111111';
  v_mesa uuid;
  v_pedido uuid;
  v_numero integer;
  v_item jsonb;
  v_produto public.produtos;
  v_acrescimo numeric;
  v_item_id uuid;
  v_etapa integer := case p_status when 'novo' then 1 when 'em_preparo' then 2 when 'pronto' then 3
                                   when 'entregue' then 4 when 'finalizado' then 5 else 1 end;
  v_preparo integer := 0;
begin
  select id into v_mesa from public.mesas where restaurante_id = v_restaurante and numero = p_mesa;
  update public.restaurantes set sequencia_pedido = sequencia_pedido + 1 where id = v_restaurante returning sequencia_pedido into v_numero;

  insert into public.pedidos (restaurante_id, numero, chave_idempotencia, mesa_id, atendimento_id, garcom_id, status, observacao, criado_em)
  values (v_restaurante, v_numero, gen_random_uuid(), v_mesa, p_atendimento, p_garcom, p_status, p_observacao, p_quando)
  returning id into v_pedido;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    select * into v_produto from public.produtos where restaurante_id = v_restaurante and nome = v_item->>'p';
    -- só vale a opção que pertence a um grupo do produto
    select coalesce(sum(o.acrescimo), 0) into v_acrescimo
      from public.opcoes o join public.produto_grupos_opcoes pg on pg.grupo_id = o.grupo_id and pg.produto_id = v_produto.id
     where o.nome in (select jsonb_array_elements_text(coalesce(v_item->'o', '[]'::jsonb)));
    insert into public.itens_pedido (restaurante_id, pedido_id, produto_id, produto_nome, preco_unitario, quantidade, observacao, criado_em)
    values (v_restaurante, v_pedido, v_produto.id, v_produto.nome, v_produto.preco + v_acrescimo, coalesce((v_item->>'q')::int, 1), v_item->>'n', p_quando)
    returning id into v_item_id;
    insert into public.itens_pedido_opcoes (restaurante_id, item_pedido_id, opcao_id, grupo_nome, opcao_nome, acrescimo)
    select v_restaurante, v_item_id, o.id, g.nome, o.nome, o.acrescimo
      from public.opcoes o join public.grupos_opcoes g on g.id = o.grupo_id
      join public.produto_grupos_opcoes pg on pg.grupo_id = o.grupo_id and pg.produto_id = v_produto.id
     where o.nome in (select jsonb_array_elements_text(coalesce(v_item->'o', '[]'::jsonb)));
    v_preparo := greatest(v_preparo, v_produto.tempo_preparo_min);
  end loop;

  -- horários realistas (alterar só os horários não dispara os gatilhos de status)
  update public.pedidos set
    enviado_em          = p_quando + interval '1 minute',
    preparo_iniciado_em = case when v_etapa >= 2 then p_quando + interval '2 minutes' end,
    pronto_em           = case when v_etapa >= 3 then p_quando + make_interval(mins => 2 + v_preparo) end,
    entregue_em         = case when v_etapa >= 4 then p_quando + make_interval(mins => 5 + v_preparo) end,
    finalizado_em       = null
  where id = v_pedido;
  return v_pedido;
end $$;

-- Histórico de 30 dias (mesas já fechadas e pagas)
do $$
declare
  v_restaurante uuid := '11111111-1111-4111-8111-111111111111';
  v_garcons uuid[] := array['aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000003']::uuid[];
  v_pratos text[] := array[
    'Batata Frita','Bolinho de Bacalhau','Pão de Alho','Calabresa Acebolada','Mandioca Frita',
    'Picanha na Brasa','Filé à Parmegiana','Frango Grelhado','Feijoada Completa',
    'X-Burger','X-Bacon','X-Salada','Cacau Burger','X-Burger','Cacau Burger',
    'Pizza Mussarela','Pizza Calabresa','Pizza Portuguesa','Pizza Frango com Catupiry',
    'Pudim','Mousse de Cacau','Petit Gâteau','Açaí 300 ml','Mousse de Cacau'];
  v_bebidas text[] := array['Coca-Cola','Guaraná','Suco de Cacau','Água Mineral','Cerveja Long Neck','Caipirinha','Coca-Cola','Cerveja Long Neck'];
  v_formas public.forma_pagamento[] := array['pix','pix','credito','debito','dinheiro','credito']::public.forma_pagamento[];
  v_dia integer;
  v_qtd_atendimentos integer;
  v_abertura timestamptz;
  v_fechamento timestamptz;
  v_mesa integer;
  v_atendimento uuid;
  v_garcom uuid;
  v_itens jsonb;
  v_total numeric;
  i integer;
  k integer;
  v_pedido uuid;
  v_dia_semana integer;
begin
  for v_dia in reverse 30..0 loop
    v_dia_semana := extract(dow from (now() at time zone 'America/Sao_Paulo')::date - v_dia);
    v_qtd_atendimentos := 5 + floor(random() * 4)::int + case when v_dia_semana in (5, 6) then 4 when v_dia_semana = 0 then 2 else 0 end;
    for i in 1..v_qtd_atendimentos loop
      -- 40% no almoço, 60% no jantar
      v_abertura := (((now() at time zone 'America/Sao_Paulo')::date - v_dia)
                  + case when random() < 0.4 then time '11:30' + random() * interval '3 hours'
                         else time '18:30' + random() * interval '4 hours' end)
                at time zone 'America/Sao_Paulo';
      v_fechamento := v_abertura + interval '45 minutes' + random() * interval '50 minutes';
      continue when v_fechamento > now() - interval '30 minutes';

      v_mesa := 1 + floor(random() * 4)::int;
      v_garcom := v_garcons[1 + floor(random() * 2)::int];

      insert into public.atendimentos (restaurante_id, mesa_id, garcom_id, pessoas, status, aberto_em, fechado_em, fechado_por, taxa_servico_percentual)
      select v_restaurante, m.id, v_garcom, 1 + floor(random() * 5)::int, 'fechado', v_abertura, v_fechamento, v_garcom, 10
        from public.mesas m where m.restaurante_id = v_restaurante and m.numero = v_mesa
      returning id into v_atendimento;

      -- 1 ou 2 rodadas de pedido
      for k in 1..(1 + (random() < 0.35)::int) loop
        v_itens := '[]'::jsonb;
        for j in 1..(1 + floor(random() * 3)::int) loop
          v_itens := v_itens || jsonb_build_object('p', v_pratos[1 + floor(random() * array_length(v_pratos, 1))::int],
                                                   'q', 1 + (random() < 0.3)::int,
                                                   'o', case when random() < 0.5 then '["Ao ponto"]'::jsonb else '[]'::jsonb end);
        end loop;
        v_itens := v_itens || jsonb_build_object('p', v_bebidas[1 + floor(random() * array_length(v_bebidas, 1))::int],
                                                 'q', 1 + floor(random() * 3)::int);
        v_pedido := pg_temp.criar_pedido(v_mesa, v_atendimento, v_garcom, 'entregue',
                                         v_abertura + make_interval(mins => 3 + (k - 1) * 25), v_itens);
      end loop;

      update public.pedidos set status = 'finalizado' where atendimento_id = v_atendimento;
      update public.pedidos set finalizado_em = v_fechamento where atendimento_id = v_atendimento;

      -- ~3% de pedidos cancelados para os relatórios
      if random() < 0.03 then
        update public.pedidos set status = 'cancelado', motivo_cancelamento = 'Cliente desistiu' where id = v_pedido;
        update public.pedidos set cancelado_em = v_abertura + interval '10 minutes' where id = v_pedido;
      end if;

      select round(coalesce(sum(subtotal), 0) * 1.10, 2) into v_total
        from public.pedidos where atendimento_id = v_atendimento and status = 'finalizado';
      if v_total > 0 then
        insert into public.pagamentos (restaurante_id, atendimento_id, forma, valor, recebido_por, criado_em)
        values (v_restaurante, v_atendimento, v_formas[1 + floor(random() * array_length(v_formas, 1))::int], v_total, v_garcom, v_fechamento);
      end if;
    end loop;
  end loop;
end $$;

-- ---------- Operação ao vivo (mesas 01–04) ----------
do $$
declare
  v_restaurante uuid := '11111111-1111-4111-8111-111111111111';
  v_joao uuid := 'aaaaaaaa-0000-4000-8000-000000000002';
  v_bia uuid := 'aaaaaaaa-0000-4000-8000-000000000003';
  a uuid;
begin
  -- Mesa 01: um pedido entregue e outro em preparo
  insert into public.atendimentos (restaurante_id, mesa_id, garcom_id, pessoas, aberto_em)
  select v_restaurante, id, v_joao, 4, now() - interval '40 minutes' from public.mesas where numero = 1 returning id into a;
  perform pg_temp.criar_pedido(1, a, v_joao, 'entregue', now() - interval '38 minutes',
    '[{"p":"Bolinho de Bacalhau","q":1},{"p":"Cerveja Long Neck","q":4}]');
  perform pg_temp.criar_pedido(1, a, v_joao, 'em_preparo', now() - interval '8 minutes',
    '[{"p":"Filé à Parmegiana","q":2},{"p":"Frango Grelhado","q":1}]');

  -- Mesa 02: pedido pronto
  insert into public.atendimentos (restaurante_id, mesa_id, garcom_id, pessoas, aberto_em)
  select v_restaurante, id, v_bia, 2, now() - interval '35 minutes' from public.mesas where numero = 2 returning id into a;
  perform pg_temp.criar_pedido(2, a, v_bia, 'pronto', now() - interval '25 minutes',
    '[{"p":"Pizza Calabresa","q":1,"o":["Catupiry"]},{"p":"Guaraná","q":2}]');

  -- Mesa 03: aguardando pagamento
  insert into public.atendimentos (restaurante_id, mesa_id, garcom_id, pessoas, aberto_em)
  select v_restaurante, id, v_joao, 2, now() - interval '70 minutes' from public.mesas where numero = 3 returning id into a;
  perform pg_temp.criar_pedido(3, a, v_joao, 'entregue', now() - interval '65 minutes',
    '[{"p":"Feijoada Completa","q":2},{"p":"Caipirinha","q":2},{"p":"Mousse de Cacau","q":2}]');
  update public.atendimentos set status = 'conta_solicitada', conta_solicitada_em = now() - interval '3 minutes' where id = a;

  -- Mesa 04 fica livre para testar a abertura de mesa
end $$;

-- Recalcula o status de todas as mesas
select privado.atualizar_status_mesa(id) from public.mesas;

-- Histórico de status coerente com os horários
delete from public.historico_status_pedido;
insert into public.historico_status_pedido (restaurante_id, pedido_id, status_anterior, status_novo, alterado_por, alterado_em)
select p.restaurante_id, p.id, x.de::public.status_pedido, x.para::public.status_pedido, p.garcom_id, x.em
from public.pedidos p
cross join lateral (values
  (null, 'novo', p.enviado_em), ('novo', 'em_preparo', p.preparo_iniciado_em), ('em_preparo', 'pronto', p.pronto_em),
  ('pronto', 'entregue', p.entregue_em), ('entregue', 'finalizado', p.finalizado_em), ('novo', 'cancelado', p.cancelado_em)
) as x(de, para, em)
where x.em is not null;

-- ---------- Despesas dos últimos 30 dias ----------
insert into public.despesas (restaurante_id, categoria_id, fornecedor_id, descricao, valor, data, forma_pagamento, criado_por)
select '11111111-1111-4111-8111-111111111111',
       (select id from public.categorias_despesa where nome = e.cat),
       (select id from public.fornecedores where nome = e.forn),
       e.descricao, e.valor, (now() at time zone 'America/Sao_Paulo')::date - e.dias_atras, e.forma::public.forma_pagamento,
       'aaaaaaaa-0000-4000-8000-000000000001'
from (values
  ('Aluguel', null, 'Aluguel do mês', 4500.00, 25, 'pix'),
  ('Energia', null, 'Conta de energia', 980.40, 20, 'pix'),
  ('Água', null, 'Conta de água', 318.70, 20, 'pix'),
  ('Internet', null, 'Internet fibra', 149.90, 18, 'credito'),
  ('Funcionários', null, 'Folha de pagamento — equipe', 12400.00, 26, 'pix'),
  ('Impostos', null, 'Simples Nacional', 1850.00, 10, 'pix'),
  ('Marketing', null, 'Impulsionamento Instagram', 350.00, 7, 'credito'),
  ('Manutenção', null, 'Manutenção da coifa', 420.00, 12, 'dinheiro'),
  ('Equipamentos', null, 'Liquidificador industrial', 689.00, 15, 'credito'),
  ('Limpeza', null, 'Produtos de limpeza', 236.50, 5, 'debito'),
  ('Gás', null, 'Botijões P45', 740.00, 0, 'pix')
) as e(cat, forn, descricao, valor, dias_atras, forma);

-- Compras recorrentes com fornecedores
insert into public.despesas (restaurante_id, categoria_id, fornecedor_id, descricao, valor, data, forma_pagamento, criado_por)
select '11111111-1111-4111-8111-111111111111',
       (select id from public.categorias_despesa where nome = c.cat),
       (select id from public.fornecedores where nome = c.forn),
       c.descricao, round((c.base + random() * c.base * 0.4)::numeric, 2),
       (now() at time zone 'America/Sao_Paulo')::date - d, 'pix',
       'aaaaaaaa-0000-4000-8000-000000000001'
from generate_series(1, 29, 3) d
cross join (values
  ('Alimentos', 'Açougue Boi Nobre', 'Compra de carnes', 780),
  ('Alimentos', 'Hortifruti Ilhéus', 'Hortifruti da semana', 260),
  ('Bebidas', 'Bebidas Recôncavo', 'Reposição de bebidas', 540),
  ('Fornecedores', 'Distribuidora Bahia Alimentos', 'Secos e frios', 610)
) as c(cat, forn, descricao, base);

-- Limpa notificações e auditoria geradas pela carga e cria exemplos realistas
delete from public.notificacoes where tipo in ('despesa.nova', 'estoque.baixo');
delete from public.auditoria;

insert into public.auditoria (restaurante_id, autor_id, autor_nome, acao, entidade, entidade_id, descricao, criado_em)
select '11111111-1111-4111-8111-111111111111', a.autor::uuid, a.nome, a.acao, a.entidade, null, a.descricao, now() - a.ha
from (values
  ('aaaaaaaa-0000-4000-8000-000000000002', 'João Pereira', 'pedido.criado', 'pedidos', 'João Pereira criou um pedido na mesa 01', interval '12 minutes'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'Roberto Santos', 'pedido.status', 'pedidos', 'Roberto Santos marcou um pedido da mesa 02 como pronto', interval '14 minutes'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Marina Souza', 'despesas.criacao', 'despesas', 'Marina Souza criou a despesa Botijões P45 de R$ 740,00', interval '2 hours'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Marina Souza', 'produtos.alteracao', 'produtos', 'Marina Souza alterou o produto Moqueca de Peixe', interval '3 hours')
) as a(autor, nome, acao, entidade, descricao, ha);

insert into public.notificacoes (restaurante_id, papel_destino, tipo, titulo, mensagem, criado_em)
values ('11111111-1111-4111-8111-111111111111', 'proprietario', 'estoque.baixo', 'Estoque de batata congelada está baixo', 'Atual: 4 kg', now() - interval '1 hour');
