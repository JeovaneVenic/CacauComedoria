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
