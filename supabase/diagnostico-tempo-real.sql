-- Diagnóstico do tempo real: garante que as tabelas operacionais
-- estão publicadas para o Supabase Realtime e mostra o resultado.
-- Pode rodar quantas vezes quiser.

do $$
declare t text;
begin
  foreach t in array array['mesas','atendimentos','pedidos','itens_pedido','notificacoes'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice 'Tabela % adicionada ao tempo real', t;
    end if;
  end loop;
end $$;

-- Resultado: uma linha por tabela, todas com "sim"
select t.tabela,
       case when p.tablename is null then 'NÃO' else 'sim' end as publicada,
       case when has_table_privilege('authenticated', 'public.' || t.tabela, 'SELECT') then 'sim' else 'NÃO' end as leitura_liberada
  from unnest(array['mesas','atendimentos','pedidos','itens_pedido','notificacoes']) as t(tabela)
  left join pg_publication_tables p
    on p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = t.tabela
 order by t.tabela;
