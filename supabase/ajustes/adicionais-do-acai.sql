-- =============================================================
-- Adicionais que fazem sentido para o açaí.
--   1. O grupo "Adicionais" (queijo, bacon, ovo...) passa a se chamar
--      "Adicionais do lanche", para não aparecer como opção do açaí.
--   2. Cria o grupo "Adicionais do açaí" e liga aos produtos de açaí.
-- Pode rodar mais de uma vez sem duplicar nada.
-- =============================================================

begin;

-- 1. nome claro para o grupo dos lanches
update public.grupos_opcoes set nome = 'Adicionais do lanche' where nome = 'Adicionais';

-- 2. grupo do açaí (um por restaurante que vende açaí): opcional, até 6 escolhas
insert into public.grupos_opcoes (restaurante_id, nome, min_escolhas, max_escolhas)
select distinct p.restaurante_id, 'Adicionais do açaí', 0, 6
  from public.produtos p
 where (p.nome ilike 'açaí%' or p.nome ilike 'Açaí%' or p.nome ilike 'acai%')
   and not exists (
     select 1 from public.grupos_opcoes g
      where g.restaurante_id = p.restaurante_id and g.nome = 'Adicionais do açaí'
   );

insert into public.opcoes (restaurante_id, grupo_id, nome, acrescimo, ordem)
select g.restaurante_id, g.id, o.nome, o.acrescimo, o.ordem
  from public.grupos_opcoes g
 cross join (values
   ('Leite condensado', 2.00, 1),
   ('Leite em pó', 2.00, 2),
   ('Paçoca', 2.00, 3),
   ('Granola extra', 2.00, 4),
   ('Banana extra', 2.00, 5),
   ('Mel', 2.00, 6),
   ('Morango', 3.00, 7),
   ('Creme de avelã', 4.00, 8)
 ) as o(nome, acrescimo, ordem)
 where g.nome = 'Adicionais do açaí'
   and not exists (select 1 from public.opcoes x where x.grupo_id = g.id and x.nome = o.nome);

-- 3. liga o grupo aos produtos de açaí
insert into public.produto_grupos_opcoes (restaurante_id, produto_id, grupo_id, ordem)
select p.restaurante_id, p.id, g.id, 1
  from public.produtos p
  join public.grupos_opcoes g on g.restaurante_id = p.restaurante_id and g.nome = 'Adicionais do açaí'
 where (p.nome ilike 'açaí%' or p.nome ilike 'Açaí%' or p.nome ilike 'acai%')
on conflict (produto_id, grupo_id) do nothing;

commit;

-- Conferência: grupos ligados ao açaí e suas opções
select p.nome as produto, g.nome as grupo, string_agg(o.nome || ' +R$ ' || o.acrescimo, ', ' order by o.ordem) as opcoes
  from public.produtos p
  join public.produto_grupos_opcoes pg on pg.produto_id = p.id
  join public.grupos_opcoes g on g.id = pg.grupo_id
  join public.opcoes o on o.grupo_id = g.id
 where p.nome ilike '%a_a_%'
 group by p.nome, g.nome;
