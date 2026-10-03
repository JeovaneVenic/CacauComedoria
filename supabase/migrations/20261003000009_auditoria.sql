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
