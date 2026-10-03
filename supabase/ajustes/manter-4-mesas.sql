-- =============================================================
-- Deixa o salão só com as mesas 01 a 04.
-- As demais são desativadas (não excluídas): o histórico de vendas
-- delas continua nos relatórios. Atendimentos abertos nessas mesas
-- são encerrados e os pedidos em andamento são cancelados.
-- Pode rodar mais de uma vez sem problema.
-- =============================================================

begin;

-- 1. Pedidos ainda em andamento nas mesas que saem
update public.pedidos p
   set status = 'cancelado', motivo_cancelamento = 'Mesa desativada'
  from public.mesas m
 where m.id = p.mesa_id
   and m.numero > 4
   and p.status in ('aguardando_envio', 'novo', 'em_preparo', 'pronto');

-- 2. Atendimentos abertos nessas mesas
update public.atendimentos a
   set status = 'fechado', fechado_em = now()
  from public.mesas m
 where m.id = a.mesa_id
   and m.numero > 4
   and a.status <> 'fechado';

-- 3. Desativa as mesas 05 em diante e garante 01–04 ativas
update public.mesas set ativa = false, status = 'livre', atendimento_atual_id = null where numero > 4;
update public.mesas set ativa = true where numero <= 4;

commit;

-- Atualiza o cache da API do Supabase (funções novas aparecem na hora)
notify pgrst, 'reload schema';

-- Conferência: deve listar só as mesas 01–04
select numero, status, ativa from public.mesas where ativa order by numero;
