-- =============================================================
-- REMOVE a primeira versão (nomes em inglês) do banco.
-- Rode UMA vez no SQL Editor, ANTES do arquivo instalacao-completa.sql.
-- Apaga somente objetos do sistema e os 4 usuários de demonstração.
-- =============================================================

-- Gatilho que criava perfis a partir do auth.users
drop trigger if exists on_auth_user_created on auth.users;

-- Políticas de arquivos
drop policy if exists "gestão envia imagens" on storage.objects;
drop policy if exists "gestão altera imagens" on storage.objects;
drop policy if exists "gestão remove imagens" on storage.objects;
drop policy if exists "gestão lê comprovantes" on storage.objects;

-- Visão, tabelas (o CASCADE remove gatilhos, políticas e chaves) e tipos
drop view if exists public.table_overview;
drop table if exists
  public.audit_logs, public.notifications, public.inventory_movements, public.product_ingredients,
  public.inventory_items, public.expenses, public.suppliers, public.expense_categories, public.payments,
  public.order_status_history, public.order_item_modifiers, public.order_items, public.orders,
  public.product_modifier_groups, public.modifier_options, public.modifier_groups, public.products,
  public.categories, public.table_sessions, public.dining_tables, public.sections, public.profiles,
  public.restaurants
cascade;

drop function if exists
  public.open_table(uuid, integer),
  public.submit_order(uuid, uuid, jsonb, text, integer),
  public.update_order_status(uuid, public.order_status, text),
  public.cancel_order_item(uuid, text),
  public.add_order_items(uuid, jsonb),
  public.request_bill(uuid),
  public.session_totals(uuid),
  public.close_table_session(uuid, jsonb, numeric, boolean),
  public.update_my_profile(text, text),
  public.log_team_event(uuid, text),
  public.set_updated_at()
cascade;

drop schema if exists private cascade;

drop type if exists
  public.app_role, public.table_status, public.session_status, public.order_status,
  public.payment_method, public.expense_type, public.movement_type
cascade;

-- Usuários de demonstração (serão recriados pela instalação nova)
delete from auth.users where id in (
  'aaaaaaaa-0000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000002',
  'aaaaaaaa-0000-4000-8000-000000000003',
  'aaaaaaaa-0000-4000-8000-000000000004'
);
