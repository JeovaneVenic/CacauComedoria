-- =============================================================
-- Dados de demonstração — Restaurante do Cacau
--
-- Usuários de teste (senha de todos: Cacau@2026):
--   dono@example.com      Proprietária  (Marina Souza)
--   joao@example.com      Garçom        (João Pereira)
--   beatriz@example.com   Garçonete     (Beatriz Lima)
--   cozinha@example.com   Cozinha       (Roberto Santos)
--
-- Troque as senhas antes de usar em produção.
-- =============================================================

select setseed(0.42);

-- ---------- Restaurante ----------
insert into public.restaurantes (id, nome, slug, endereco, telefone, taxa_servico_percentual, horario_funcionamento, garcom_pode_fechar_mesa)
values (
  '11111111-1111-4111-8111-111111111111', 'Restaurante do Cacau', 'restaurante-do-cacau',
  'Rua do Cacau, 120 — Centro, Ilhéus - BA', '(73) 3231-0000', 10,
  '{"seg":"11:00-23:00","ter":"11:00-23:00","qua":"11:00-23:00","qui":"11:00-23:00","sex":"11:00-00:00","sab":"11:00-00:00","dom":"11:00-17:00"}',
  true
);

-- ---------- Usuários (auth + perfil criado pelo gatilho) ----------
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'dono@example.com',    'Marina Souza',   'proprietario'),
      ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'joao@example.com',    'João Pereira',   'garcom'),
      ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'beatriz@example.com', 'Beatriz Lima',   'garcom'),
      ('aaaaaaaa-0000-4000-8000-000000000004'::uuid, 'cozinha@example.com', 'Roberto Santos', 'cozinha')
    ) as t(id, email, nome, papel)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('Cacau@2026', extensions.gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'),
                         'restaurante_id', '11111111-1111-4111-8111-111111111111', 'papel', u.papel),
      jsonb_build_object('nome', u.nome),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now());
  end loop;
end $$;

-- ---------- Salão e mesas 01–04 ----------
insert into public.setores (restaurante_id, nome, ordem) values
  ('11111111-1111-4111-8111-111111111111', 'Salão principal', 1);

insert into public.mesas (restaurante_id, setor_id, numero, capacidade, formato, pos_x, pos_y)
select '11111111-1111-4111-8111-111111111111',
       (select id from public.setores where nome = 'Salão principal'),
       n,
       case when n = 4 then 6 when n = 3 then 2 else 4 end,
       case when n = 3 then 'redonda' when n = 4 then 'retangular' else 'quadrada' end,
       n - 1,
       0
from generate_series(1, 4) n;

-- ---------- Cardápio ----------
insert into public.categorias (restaurante_id, nome, icone, ordem) values
  ('11111111-1111-4111-8111-111111111111', 'Entradas', 'salad', 1),
  ('11111111-1111-4111-8111-111111111111', 'Pratos', 'utensils', 2),
  ('11111111-1111-4111-8111-111111111111', 'Hambúrgueres', 'beef', 3),
  ('11111111-1111-4111-8111-111111111111', 'Pizzas', 'pizza', 4),
  ('11111111-1111-4111-8111-111111111111', 'Bebidas', 'cup-soda', 5),
  ('11111111-1111-4111-8111-111111111111', 'Sobremesas', 'ice-cream-cone', 6);

insert into public.produtos (restaurante_id, categoria_id, nome, descricao, preco, tempo_preparo_min, ordem)
select '11111111-1111-4111-8111-111111111111', c.id, p.nome, p.descricao, p.preco, p.preparo, p.ordem
from (values
  ('Entradas', 'Batata Frita', 'Porção crocante com sal e alecrim', 16.90, 10, 1),
  ('Entradas', 'Bolinho de Bacalhau', '6 unidades com limão', 29.90, 12, 2),
  ('Entradas', 'Pão de Alho', '4 unidades na brasa', 14.90, 8, 3),
  ('Entradas', 'Calabresa Acebolada', 'Com pão francês', 32.90, 12, 4),
  ('Entradas', 'Mandioca Frita', 'Com manteiga de garrafa', 18.90, 12, 5),
  ('Pratos', 'Picanha na Brasa', 'Arroz, farofa, vinagrete e fritas — serve 2', 89.90, 25, 1),
  ('Pratos', 'Filé à Parmegiana', 'Arroz e fritas', 64.90, 25, 2),
  ('Pratos', 'Frango Grelhado', 'Arroz, feijão e salada', 39.90, 20, 3),
  ('Pratos', 'Moqueca de Peixe', 'Com arroz e pirão — serve 2', 79.90, 30, 4),
  ('Pratos', 'Feijoada Completa', 'Arroz, couve, farofa e laranja', 54.90, 15, 5),
  ('Hambúrgueres', 'X-Burger', 'Blend 150 g, queijo e molho da casa', 24.90, 15, 1),
  ('Hambúrgueres', 'X-Bacon', 'Blend 150 g, queijo e bacon', 29.90, 15, 2),
  ('Hambúrgueres', 'X-Salada', 'Blend 150 g, queijo, alface e tomate', 26.90, 15, 3),
  ('Hambúrgueres', 'Cacau Burger', 'Blend 180 g, queijo coalho e geleia de cacau', 34.90, 18, 4),
  ('Pizzas', 'Pizza Mussarela', 'Grande, 8 fatias', 49.90, 20, 1),
  ('Pizzas', 'Pizza Calabresa', 'Grande, 8 fatias', 52.90, 20, 2),
  ('Pizzas', 'Pizza Portuguesa', 'Grande, 8 fatias', 56.90, 20, 3),
  ('Pizzas', 'Pizza Frango com Catupiry', 'Grande, 8 fatias', 58.90, 20, 4),
  ('Bebidas', 'Coca-Cola', 'Lata 350 ml', 6.00, 1, 1),
  ('Bebidas', 'Guaraná', 'Lata 350 ml', 6.00, 1, 2),
  ('Bebidas', 'Suco Natural', 'Laranja, limão ou maracujá — 400 ml', 8.00, 5, 3),
  ('Bebidas', 'Suco de Cacau', 'Polpa de cacau — 400 ml', 9.00, 5, 4),
  ('Bebidas', 'Água Mineral', '500 ml', 4.00, 1, 5),
  ('Bebidas', 'Cerveja Long Neck', '355 ml', 9.90, 1, 6),
  ('Bebidas', 'Caipirinha', 'Limão, cachaça artesanal', 16.90, 5, 7),
  ('Sobremesas', 'Pudim', 'Pudim de leite condensado', 9.90, 2, 1),
  ('Sobremesas', 'Mousse de Cacau', 'Chocolate 70% de Ilhéus', 12.90, 2, 2),
  ('Sobremesas', 'Petit Gâteau', 'Com sorvete de creme', 19.90, 12, 3),
  ('Sobremesas', 'Açaí 300 ml', 'Com granola e banana', 16.90, 5, 4)
) as p(categoria, nome, descricao, preco, preparo, ordem)
join public.categorias c on c.nome = p.categoria and c.restaurante_id = '11111111-1111-4111-8111-111111111111';

-- Pausa um item para demonstrar "indisponível"
update public.produtos set ativo = false where nome = 'Moqueca de Peixe';

-- ---------- Opções dos produtos ----------
insert into public.grupos_opcoes (restaurante_id, nome, min_escolhas, max_escolhas) values
  ('11111111-1111-4111-8111-111111111111', 'Ponto da carne', 1, 1),
  ('11111111-1111-4111-8111-111111111111', 'Adicionais do lanche', 0, 4),
  ('11111111-1111-4111-8111-111111111111', 'Adicionais do açaí', 0, 6),
  ('11111111-1111-4111-8111-111111111111', 'Borda', 0, 1),
  ('11111111-1111-4111-8111-111111111111', 'Sabor do suco', 1, 1);

insert into public.opcoes (restaurante_id, grupo_id, nome, acrescimo, ordem)
select '11111111-1111-4111-8111-111111111111', g.id, o.nome, o.acrescimo, o.ordem
from (values
  ('Ponto da carne', 'Mal passado', 0, 1), ('Ponto da carne', 'Ao ponto', 0, 2), ('Ponto da carne', 'Bem passado', 0, 3),
  ('Adicionais do lanche', 'Queijo', 3.00, 1), ('Adicionais do lanche', 'Bacon', 4.00, 2), ('Adicionais do lanche', 'Ovo', 2.50, 3),
  ('Adicionais do lanche', 'Cebola caramelizada', 2.00, 4),
  ('Adicionais do açaí', 'Leite condensado', 2.00, 1), ('Adicionais do açaí', 'Leite em pó', 2.00, 2),
  ('Adicionais do açaí', 'Paçoca', 2.00, 3), ('Adicionais do açaí', 'Granola extra', 2.00, 4),
  ('Adicionais do açaí', 'Banana extra', 2.00, 5), ('Adicionais do açaí', 'Mel', 2.00, 6),
  ('Adicionais do açaí', 'Morango', 3.00, 7), ('Adicionais do açaí', 'Creme de avelã', 4.00, 8),
  ('Borda', 'Catupiry', 8.00, 1), ('Borda', 'Cheddar', 8.00, 2),
  ('Sabor do suco', 'Laranja', 0, 1), ('Sabor do suco', 'Limão', 0, 2), ('Sabor do suco', 'Maracujá', 0, 3)
) as o(grupo, nome, acrescimo, ordem)
join public.grupos_opcoes g on g.nome = o.grupo;

insert into public.produto_grupos_opcoes (restaurante_id, produto_id, grupo_id, ordem)
select '11111111-1111-4111-8111-111111111111', p.id, g.id, case g.nome when 'Ponto da carne' then 1 else 2 end
from public.produtos p
join public.grupos_opcoes g on
     (p.nome in ('X-Burger','X-Bacon','X-Salada','Cacau Burger') and g.nome in ('Ponto da carne','Adicionais do lanche'))
  or (p.nome = 'Açaí 300 ml' and g.nome = 'Adicionais do açaí')
  or (p.nome = 'Picanha na Brasa' and g.nome = 'Ponto da carne')
  or (p.nome like 'Pizza %' and g.nome = 'Borda')
  or (p.nome = 'Suco Natural' and g.nome = 'Sabor do suco');

-- ---------- Financeiro ----------
insert into public.categorias_despesa (restaurante_id, nome, tipo)
select '11111111-1111-4111-8111-111111111111', n, t::public.tipo_despesa
from (values
  ('Alimentos','variavel'), ('Bebidas','variavel'), ('Fornecedores','variavel'), ('Funcionários','fixa'),
  ('Aluguel','fixa'), ('Energia','fixa'), ('Água','fixa'), ('Internet','fixa'), ('Gás','operacional'),
  ('Manutenção','operacional'), ('Limpeza','operacional'), ('Marketing','operacional'), ('Impostos','fixa'),
  ('Equipamentos','operacional'), ('Outros','variavel')
) as e(n, t);

insert into public.fornecedores (restaurante_id, nome, documento, telefone) values
  ('11111111-1111-4111-8111-111111111111', 'Distribuidora Bahia Alimentos', '12.345.678/0001-90', '(73) 3222-1000'),
  ('11111111-1111-4111-8111-111111111111', 'Bebidas Recôncavo', '23.456.789/0001-01', '(73) 3222-2000'),
  ('11111111-1111-4111-8111-111111111111', 'Hortifruti Ilhéus', '34.567.890/0001-12', '(73) 3222-3000'),
  ('11111111-1111-4111-8111-111111111111', 'Açougue Boi Nobre', '45.678.901/0001-23', '(73) 3222-4000');

-- ---------- Estoque ----------
insert into public.itens_estoque (restaurante_id, fornecedor_id, nome, unidade, quantidade, quantidade_minima, custo_unitario)
select '11111111-1111-4111-8111-111111111111', (select id from public.fornecedores where nome = i.forn), i.nome, i.unidade, i.qtd, i.minimo, i.custo
from (values
  ('Queijo Mussarela', 'kg', 12, 5, 42.90, 'Distribuidora Bahia Alimentos'),
  ('Blend bovino', 'kg', 8, 4, 48.00, 'Açougue Boi Nobre'),
  ('Picanha', 'kg', 6, 3, 79.90, 'Açougue Boi Nobre'),
  ('Pão de hambúrguer', 'un', 40, 30, 1.20, 'Distribuidora Bahia Alimentos'),
  ('Bacon', 'kg', 3, 2, 39.90, 'Açougue Boi Nobre'),
  ('Batata congelada', 'kg', 4, 10, 18.50, 'Distribuidora Bahia Alimentos'),
  ('Coca-Cola lata', 'un', 96, 48, 3.10, 'Bebidas Recôncavo'),
  ('Polpa de cacau', 'kg', 1.5, 2, 28.00, 'Hortifruti Ilhéus'),
  ('Chocolate 70%', 'kg', 3, 1, 89.00, 'Distribuidora Bahia Alimentos'),
  ('Tomate', 'kg', 7, 3, 7.90, 'Hortifruti Ilhéus')
) as i(nome, unidade, qtd, minimo, custo, forn);

insert into public.produto_ingredientes (restaurante_id, produto_id, item_estoque_id, quantidade)
select '11111111-1111-4111-8111-111111111111', p.id, ie.id, x.qtd
from (values
  ('X-Burger','Pão de hambúrguer',1), ('X-Burger','Blend bovino',0.15), ('X-Burger','Queijo Mussarela',0.03),
  ('X-Bacon','Pão de hambúrguer',1), ('X-Bacon','Blend bovino',0.15), ('X-Bacon','Bacon',0.04),
  ('X-Salada','Pão de hambúrguer',1), ('X-Salada','Blend bovino',0.15), ('X-Salada','Tomate',0.05),
  ('Cacau Burger','Pão de hambúrguer',1), ('Cacau Burger','Blend bovino',0.18),
  ('Batata Frita','Batata congelada',0.3), ('Picanha na Brasa','Picanha',0.6),
  ('Pizza Mussarela','Queijo Mussarela',0.35), ('Coca-Cola','Coca-Cola lata',1),
  ('Suco de Cacau','Polpa de cacau',0.15), ('Mousse de Cacau','Chocolate 70%',0.06)
) as x(prod, item, qtd)
join public.produtos p on p.nome = x.prod
join public.itens_estoque ie on ie.nome = x.item;

-- Entrada inicial de cada item (histórico de movimentações)
insert into public.movimentacoes_estoque (restaurante_id, item_estoque_id, tipo, quantidade, custo_unitario, motivo, criado_por, criado_em)
select restaurante_id, id, 'entrada', quantidade, custo_unitario, 'Estoque inicial', 'aaaaaaaa-0000-4000-8000-000000000001', now() - interval '7 days'
  from public.itens_estoque;

-- =============================================================
-- Pedidos de demonstração
-- =============================================================

-- Cria um pedido com itens (produtos e opções pelo nome)
create or replace function pg_temp.criar_pedido(
  p_mesa integer, p_atendimento uuid, p_garcom uuid,
  p_status public.status_pedido, p_quando timestamptz, p_itens jsonb, p_observacao text default null
) returns uuid language plpgsql as $$
declare
  v_restaurante uuid := '11111111-1111-4111-8111-111111111111';
  v_mesa uuid;
  v_pedido uuid;
  v_numero integer;
  v_item jsonb;
  v_produto public.produtos;
  v_acrescimo numeric;
  v_item_id uuid;
  v_etapa integer := case p_status when 'novo' then 1 when 'em_preparo' then 2 when 'pronto' then 3
                                   when 'entregue' then 4 when 'finalizado' then 5 else 1 end;
  v_preparo integer := 0;
begin
  select id into v_mesa from public.mesas where restaurante_id = v_restaurante and numero = p_mesa;
  update public.restaurantes set sequencia_pedido = sequencia_pedido + 1 where id = v_restaurante returning sequencia_pedido into v_numero;

  insert into public.pedidos (restaurante_id, numero, chave_idempotencia, mesa_id, atendimento_id, garcom_id, status, observacao, criado_em)
  values (v_restaurante, v_numero, gen_random_uuid(), v_mesa, p_atendimento, p_garcom, p_status, p_observacao, p_quando)
  returning id into v_pedido;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    select * into v_produto from public.produtos where restaurante_id = v_restaurante and nome = v_item->>'p';
    -- só vale a opção que pertence a um grupo do produto
    select coalesce(sum(o.acrescimo), 0) into v_acrescimo
      from public.opcoes o join public.produto_grupos_opcoes pg on pg.grupo_id = o.grupo_id and pg.produto_id = v_produto.id
     where o.nome in (select jsonb_array_elements_text(coalesce(v_item->'o', '[]'::jsonb)));
    insert into public.itens_pedido (restaurante_id, pedido_id, produto_id, produto_nome, preco_unitario, quantidade, observacao, criado_em)
    values (v_restaurante, v_pedido, v_produto.id, v_produto.nome, v_produto.preco + v_acrescimo, coalesce((v_item->>'q')::int, 1), v_item->>'n', p_quando)
    returning id into v_item_id;
    insert into public.itens_pedido_opcoes (restaurante_id, item_pedido_id, opcao_id, grupo_nome, opcao_nome, acrescimo)
    select v_restaurante, v_item_id, o.id, g.nome, o.nome, o.acrescimo
      from public.opcoes o join public.grupos_opcoes g on g.id = o.grupo_id
      join public.produto_grupos_opcoes pg on pg.grupo_id = o.grupo_id and pg.produto_id = v_produto.id
     where o.nome in (select jsonb_array_elements_text(coalesce(v_item->'o', '[]'::jsonb)));
    v_preparo := greatest(v_preparo, v_produto.tempo_preparo_min);
  end loop;

  -- horários realistas (alterar só os horários não dispara os gatilhos de status)
  update public.pedidos set
    enviado_em          = p_quando + interval '1 minute',
    preparo_iniciado_em = case when v_etapa >= 2 then p_quando + interval '2 minutes' end,
    pronto_em           = case when v_etapa >= 3 then p_quando + make_interval(mins => 2 + v_preparo) end,
    entregue_em         = case when v_etapa >= 4 then p_quando + make_interval(mins => 5 + v_preparo) end,
    finalizado_em       = null
  where id = v_pedido;
  return v_pedido;
end $$;

-- Histórico de 30 dias (mesas já fechadas e pagas)
do $$
declare
  v_restaurante uuid := '11111111-1111-4111-8111-111111111111';
  v_garcons uuid[] := array['aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000003']::uuid[];
  v_pratos text[] := array[
    'Batata Frita','Bolinho de Bacalhau','Pão de Alho','Calabresa Acebolada','Mandioca Frita',
    'Picanha na Brasa','Filé à Parmegiana','Frango Grelhado','Feijoada Completa',
    'X-Burger','X-Bacon','X-Salada','Cacau Burger','X-Burger','Cacau Burger',
    'Pizza Mussarela','Pizza Calabresa','Pizza Portuguesa','Pizza Frango com Catupiry',
    'Pudim','Mousse de Cacau','Petit Gâteau','Açaí 300 ml','Mousse de Cacau'];
  v_bebidas text[] := array['Coca-Cola','Guaraná','Suco de Cacau','Água Mineral','Cerveja Long Neck','Caipirinha','Coca-Cola','Cerveja Long Neck'];
  v_formas public.forma_pagamento[] := array['pix','pix','credito','debito','dinheiro','credito']::public.forma_pagamento[];
  v_dia integer;
  v_qtd_atendimentos integer;
  v_abertura timestamptz;
  v_fechamento timestamptz;
  v_mesa integer;
  v_atendimento uuid;
  v_garcom uuid;
  v_itens jsonb;
  v_total numeric;
  i integer;
  k integer;
  v_pedido uuid;
  v_dia_semana integer;
begin
  for v_dia in reverse 30..0 loop
    v_dia_semana := extract(dow from (now() at time zone 'America/Sao_Paulo')::date - v_dia);
    v_qtd_atendimentos := 5 + floor(random() * 4)::int + case when v_dia_semana in (5, 6) then 4 when v_dia_semana = 0 then 2 else 0 end;
    for i in 1..v_qtd_atendimentos loop
      -- 40% no almoço, 60% no jantar
      v_abertura := (((now() at time zone 'America/Sao_Paulo')::date - v_dia)
                  + case when random() < 0.4 then time '11:30' + random() * interval '3 hours'
                         else time '18:30' + random() * interval '4 hours' end)
                at time zone 'America/Sao_Paulo';
      v_fechamento := v_abertura + interval '45 minutes' + random() * interval '50 minutes';
      continue when v_fechamento > now() - interval '30 minutes';

      v_mesa := 1 + floor(random() * 4)::int;
      v_garcom := v_garcons[1 + floor(random() * 2)::int];

      insert into public.atendimentos (restaurante_id, mesa_id, garcom_id, pessoas, status, aberto_em, fechado_em, fechado_por, taxa_servico_percentual)
      select v_restaurante, m.id, v_garcom, 1 + floor(random() * 5)::int, 'fechado', v_abertura, v_fechamento, v_garcom, 10
        from public.mesas m where m.restaurante_id = v_restaurante and m.numero = v_mesa
      returning id into v_atendimento;

      -- 1 ou 2 rodadas de pedido
      for k in 1..(1 + (random() < 0.35)::int) loop
        v_itens := '[]'::jsonb;
        for j in 1..(1 + floor(random() * 3)::int) loop
          v_itens := v_itens || jsonb_build_object('p', v_pratos[1 + floor(random() * array_length(v_pratos, 1))::int],
                                                   'q', 1 + (random() < 0.3)::int,
                                                   'o', case when random() < 0.5 then '["Ao ponto"]'::jsonb else '[]'::jsonb end);
        end loop;
        v_itens := v_itens || jsonb_build_object('p', v_bebidas[1 + floor(random() * array_length(v_bebidas, 1))::int],
                                                 'q', 1 + floor(random() * 3)::int);
        v_pedido := pg_temp.criar_pedido(v_mesa, v_atendimento, v_garcom, 'entregue',
                                         v_abertura + make_interval(mins => 3 + (k - 1) * 25), v_itens);
      end loop;

      update public.pedidos set status = 'finalizado' where atendimento_id = v_atendimento;
      update public.pedidos set finalizado_em = v_fechamento where atendimento_id = v_atendimento;

      -- ~3% de pedidos cancelados para os relatórios
      if random() < 0.03 then
        update public.pedidos set status = 'cancelado', motivo_cancelamento = 'Cliente desistiu' where id = v_pedido;
        update public.pedidos set cancelado_em = v_abertura + interval '10 minutes' where id = v_pedido;
      end if;

      select round(coalesce(sum(subtotal), 0) * 1.10, 2) into v_total
        from public.pedidos where atendimento_id = v_atendimento and status = 'finalizado';
      if v_total > 0 then
        insert into public.pagamentos (restaurante_id, atendimento_id, forma, valor, recebido_por, criado_em)
        values (v_restaurante, v_atendimento, v_formas[1 + floor(random() * array_length(v_formas, 1))::int], v_total, v_garcom, v_fechamento);
      end if;
    end loop;
  end loop;
end $$;

-- ---------- Operação ao vivo (mesas 01–04) ----------
do $$
declare
  v_restaurante uuid := '11111111-1111-4111-8111-111111111111';
  v_joao uuid := 'aaaaaaaa-0000-4000-8000-000000000002';
  v_bia uuid := 'aaaaaaaa-0000-4000-8000-000000000003';
  a uuid;
begin
  -- Mesa 01: um pedido entregue e outro em preparo
  insert into public.atendimentos (restaurante_id, mesa_id, garcom_id, pessoas, aberto_em)
  select v_restaurante, id, v_joao, 4, now() - interval '40 minutes' from public.mesas where numero = 1 returning id into a;
  perform pg_temp.criar_pedido(1, a, v_joao, 'entregue', now() - interval '38 minutes',
    '[{"p":"Bolinho de Bacalhau","q":1},{"p":"Cerveja Long Neck","q":4}]');
  perform pg_temp.criar_pedido(1, a, v_joao, 'em_preparo', now() - interval '8 minutes',
    '[{"p":"Filé à Parmegiana","q":2},{"p":"Frango Grelhado","q":1}]');

  -- Mesa 02: pedido pronto
  insert into public.atendimentos (restaurante_id, mesa_id, garcom_id, pessoas, aberto_em)
  select v_restaurante, id, v_bia, 2, now() - interval '35 minutes' from public.mesas where numero = 2 returning id into a;
  perform pg_temp.criar_pedido(2, a, v_bia, 'pronto', now() - interval '25 minutes',
    '[{"p":"Pizza Calabresa","q":1,"o":["Catupiry"]},{"p":"Guaraná","q":2}]');

  -- Mesa 03: aguardando pagamento
  insert into public.atendimentos (restaurante_id, mesa_id, garcom_id, pessoas, aberto_em)
  select v_restaurante, id, v_joao, 2, now() - interval '70 minutes' from public.mesas where numero = 3 returning id into a;
  perform pg_temp.criar_pedido(3, a, v_joao, 'entregue', now() - interval '65 minutes',
    '[{"p":"Feijoada Completa","q":2},{"p":"Caipirinha","q":2},{"p":"Mousse de Cacau","q":2}]');
  update public.atendimentos set status = 'conta_solicitada', conta_solicitada_em = now() - interval '3 minutes' where id = a;

  -- Mesa 04 fica livre para testar a abertura de mesa
end $$;

-- Recalcula o status de todas as mesas
select privado.atualizar_status_mesa(id) from public.mesas;

-- Histórico de status coerente com os horários
delete from public.historico_status_pedido;
insert into public.historico_status_pedido (restaurante_id, pedido_id, status_anterior, status_novo, alterado_por, alterado_em)
select p.restaurante_id, p.id, x.de::public.status_pedido, x.para::public.status_pedido, p.garcom_id, x.em
from public.pedidos p
cross join lateral (values
  (null, 'novo', p.enviado_em), ('novo', 'em_preparo', p.preparo_iniciado_em), ('em_preparo', 'pronto', p.pronto_em),
  ('pronto', 'entregue', p.entregue_em), ('entregue', 'finalizado', p.finalizado_em), ('novo', 'cancelado', p.cancelado_em)
) as x(de, para, em)
where x.em is not null;

-- ---------- Despesas dos últimos 30 dias ----------
insert into public.despesas (restaurante_id, categoria_id, fornecedor_id, descricao, valor, data, forma_pagamento, criado_por)
select '11111111-1111-4111-8111-111111111111',
       (select id from public.categorias_despesa where nome = e.cat),
       (select id from public.fornecedores where nome = e.forn),
       e.descricao, e.valor, (now() at time zone 'America/Sao_Paulo')::date - e.dias_atras, e.forma::public.forma_pagamento,
       'aaaaaaaa-0000-4000-8000-000000000001'
from (values
  ('Aluguel', null, 'Aluguel do mês', 4500.00, 25, 'pix'),
  ('Energia', null, 'Conta de energia', 980.40, 20, 'pix'),
  ('Água', null, 'Conta de água', 318.70, 20, 'pix'),
  ('Internet', null, 'Internet fibra', 149.90, 18, 'credito'),
  ('Funcionários', null, 'Folha de pagamento — equipe', 12400.00, 26, 'pix'),
  ('Impostos', null, 'Simples Nacional', 1850.00, 10, 'pix'),
  ('Marketing', null, 'Impulsionamento Instagram', 350.00, 7, 'credito'),
  ('Manutenção', null, 'Manutenção da coifa', 420.00, 12, 'dinheiro'),
  ('Equipamentos', null, 'Liquidificador industrial', 689.00, 15, 'credito'),
  ('Limpeza', null, 'Produtos de limpeza', 236.50, 5, 'debito'),
  ('Gás', null, 'Botijões P45', 740.00, 0, 'pix')
) as e(cat, forn, descricao, valor, dias_atras, forma);

-- Compras recorrentes com fornecedores
insert into public.despesas (restaurante_id, categoria_id, fornecedor_id, descricao, valor, data, forma_pagamento, criado_por)
select '11111111-1111-4111-8111-111111111111',
       (select id from public.categorias_despesa where nome = c.cat),
       (select id from public.fornecedores where nome = c.forn),
       c.descricao, round((c.base + random() * c.base * 0.4)::numeric, 2),
       (now() at time zone 'America/Sao_Paulo')::date - d, 'pix',
       'aaaaaaaa-0000-4000-8000-000000000001'
from generate_series(1, 29, 3) d
cross join (values
  ('Alimentos', 'Açougue Boi Nobre', 'Compra de carnes', 780),
  ('Alimentos', 'Hortifruti Ilhéus', 'Hortifruti da semana', 260),
  ('Bebidas', 'Bebidas Recôncavo', 'Reposição de bebidas', 540),
  ('Fornecedores', 'Distribuidora Bahia Alimentos', 'Secos e frios', 610)
) as c(cat, forn, descricao, base);

-- Limpa notificações e auditoria geradas pela carga e cria exemplos realistas
delete from public.notificacoes where tipo in ('despesa.nova', 'estoque.baixo');
delete from public.auditoria;

insert into public.auditoria (restaurante_id, autor_id, autor_nome, acao, entidade, entidade_id, descricao, criado_em)
select '11111111-1111-4111-8111-111111111111', a.autor::uuid, a.nome, a.acao, a.entidade, null, a.descricao, now() - a.ha
from (values
  ('aaaaaaaa-0000-4000-8000-000000000002', 'João Pereira', 'pedido.criado', 'pedidos', 'João Pereira criou um pedido na mesa 01', interval '12 minutes'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'Roberto Santos', 'pedido.status', 'pedidos', 'Roberto Santos marcou um pedido da mesa 02 como pronto', interval '14 minutes'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Marina Souza', 'despesas.criacao', 'despesas', 'Marina Souza criou a despesa Botijões P45 de R$ 740,00', interval '2 hours'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Marina Souza', 'produtos.alteracao', 'produtos', 'Marina Souza alterou o produto Moqueca de Peixe', interval '3 hours')
) as a(autor, nome, acao, entidade, descricao, ha);

insert into public.notificacoes (restaurante_id, papel_destino, tipo, titulo, mensagem, criado_em)
values ('11111111-1111-4111-8111-111111111111', 'proprietario', 'estoque.baixo', 'Estoque de batata congelada está baixo', 'Atual: 4 kg', now() - interval '1 hour');
