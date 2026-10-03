-- =============================================================
-- Remove os setores do salão que não têm nenhuma mesa ativa
-- (ex.: Varanda, Área externa e VIP depois de ficar com 4 mesas).
-- Mesas desativadas desses setores ficam sem setor; o histórico continua.
-- =============================================================

-- Conferência antes: setores que serão removidos
select s.nome from public.setores s
 where not exists (select 1 from public.mesas m where m.setor_id = s.id and m.ativa);

delete from public.setores s
 where not exists (select 1 from public.mesas m where m.setor_id = s.id and m.ativa);

-- Conferência depois: setores que ficaram
select s.nome, count(m.id) as mesas_ativas
  from public.setores s left join public.mesas m on m.setor_id = s.id and m.ativa
 group by s.nome order by s.nome;
