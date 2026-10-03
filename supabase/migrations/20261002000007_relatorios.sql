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
