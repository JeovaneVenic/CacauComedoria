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
