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
