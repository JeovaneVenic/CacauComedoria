-- =============================================================
-- Fase 13: segurança.
--   * Impede escalonamento de privilégio na equipe: ninguém muda a
--     própria função nem se desativa; a função "proprietário" não é
--     dada nem tirada pela API; só proprietário/administrador mexe
--     em gerentes. Vale para o app e para chamadas diretas à API.
--   * Remove permissões sobrando de visitantes (anon).
-- =============================================================

create or replace function privado.proteger_usuarios()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ator public.papel_usuario;
begin
  -- servidor com chave secreta / SQL Editor (sem usuário logado): confiável
  if v_uid is null then
    return new;
  end if;
  if new.papel is not distinct from old.papel and new.ativo is not distinct from old.ativo then
    return new;
  end if;

  if old.id = v_uid then
    raise exception 'Você não pode alterar a própria função nem desativar o próprio acesso.' using errcode = '42501';
  end if;
  if old.papel = 'proprietario' or new.papel = 'proprietario' then
    raise exception 'A função de proprietário não pode ser alterada por aqui.' using errcode = '42501';
  end if;

  select papel into v_ator from public.usuarios where id = v_uid and ativo;
  if (old.papel in ('gerente', 'administrador') or new.papel in ('gerente', 'administrador'))
     and v_ator is distinct from 'proprietario' and v_ator is distinct from 'administrador' then
    raise exception 'Somente o proprietário pode alterar gerentes.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists proteger_usuarios on public.usuarios;
create trigger proteger_usuarios
  before update of papel, ativo on public.usuarios
  for each row execute function privado.proteger_usuarios();

-- Visitantes (sem login) não têm nada a fazer nas tabelas e visões do app
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
-- funções criadas daqui em diante também nascem fechadas para visitantes
alter default privileges in schema public revoke execute on functions from anon, public;

notify pgrst, 'reload schema';
