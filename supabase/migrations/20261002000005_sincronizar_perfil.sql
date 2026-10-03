-- O Auth do Supabase grava o app_metadata (restaurante e papel) num UPDATE
-- logo após criar o usuário. Este gatilho completa o perfil quando isso acontece.
create or replace function privado.ao_atualizar_usuario_auth()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.usuarios u
     set restaurante_id = coalesce(u.restaurante_id, nullif(new.raw_app_meta_data->>'restaurante_id', '')::uuid),
         papel = coalesce(nullif(new.raw_app_meta_data->>'papel', '')::public.papel_usuario, u.papel),
         nome = coalesce(nullif(new.raw_user_meta_data->>'nome', ''), u.nome)
   where u.id = new.id;
  return new;
end $$;

drop trigger if exists ao_atualizar_usuario_auth on auth.users;
create trigger ao_atualizar_usuario_auth
  after update of raw_app_meta_data, raw_user_meta_data on auth.users
  for each row execute function privado.ao_atualizar_usuario_auth();

-- Corrige perfis já criados sem restaurante
update public.usuarios u
   set restaurante_id = nullif(a.raw_app_meta_data->>'restaurante_id', '')::uuid,
       papel = coalesce(nullif(a.raw_app_meta_data->>'papel', '')::public.papel_usuario, u.papel),
       nome = coalesce(nullif(a.raw_user_meta_data->>'nome', ''), u.nome)
  from auth.users a
 where a.id = u.id
   and u.restaurante_id is null
   and nullif(a.raw_app_meta_data->>'restaurante_id', '') is not null;
