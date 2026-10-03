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
