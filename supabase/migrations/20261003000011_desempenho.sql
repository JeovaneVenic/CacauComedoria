-- =============================================================
-- Fase 14: desempenho.
-- Índices para as consultas mais frequentes do app e para as
-- verificações de chave estrangeira (exclusões de cadastros).
-- "if not exists": pode rodar mais de uma vez.
-- =============================================================

-- Conta da mesa / fechamento / relatório de mesas
create index if not exists pagamentos_atendimento_idx on public.pagamentos(atendimento_id);

-- Tela "Pedidos" do garçom (pedidos dele, mais recentes primeiro)
create index if not exists pedidos_garcom_idx on public.pedidos(restaurante_id, garcom_id, criado_em desc);
create index if not exists pedidos_mesa_idx on public.pedidos(mesa_id);

-- Painel e relatórios: mesas fechadas no período
create index if not exists atendimentos_fechados_idx on public.atendimentos(restaurante_id, fechado_em desc) where status = 'fechado';

-- Estoque: movimentações do período e baixa automática por pedido
create index if not exists movimentacoes_estoque_periodo_idx on public.movimentacoes_estoque(restaurante_id, criado_em desc);
create index if not exists movimentacoes_estoque_pedido_idx on public.movimentacoes_estoque(pedido_id) where pedido_id is not null;

-- Sino: notificações endereçadas a uma pessoa
create index if not exists notificacoes_usuario_idx on public.notificacoes(usuario_destino_id, criado_em desc) where usuario_destino_id is not null;

-- Exclusões de cadastros (checagem de chave estrangeira sem varrer a tabela inteira)
create index if not exists itens_pedido_produto_fk_idx on public.itens_pedido(produto_id);
create index if not exists itens_pedido_opcoes_opcao_idx on public.itens_pedido_opcoes(opcao_id);
create index if not exists produto_grupos_opcoes_grupo_idx on public.produto_grupos_opcoes(grupo_id);
create index if not exists produto_ingredientes_item_idx on public.produto_ingredientes(item_estoque_id);
create index if not exists despesas_categoria_idx on public.despesas(categoria_id);
create index if not exists despesas_fornecedor_idx on public.despesas(fornecedor_id) where fornecedor_id is not null;
create index if not exists mesas_setor_idx on public.mesas(setor_id) where setor_id is not null;

-- Estatísticas atualizadas para o planejador usar os índices novos
analyze public.pagamentos, public.pedidos, public.atendimentos, public.movimentacoes_estoque, public.notificacoes, public.itens_pedido;
