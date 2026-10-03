-- Auditoria de eventos da equipe executados no servidor com a chave secreta
-- (cadastro de usuário e redefinição de senha), registrados em nome do gestor.
create or replace function public.registrar_evento_equipe(p_usuario_id uuid, p_evento text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_restaurante uuid := privado.exigir_restaurante();
  v_nome text;
begin
  if not privado.eh_gestao() then
    raise exception 'Você não possui permissão para realizar esta ação.' using errcode = '42501';
  end if;
  select nome into v_nome from public.usuarios where id = p_usuario_id and restaurante_id = v_restaurante;
  if v_nome is null then
    return;
  end if;
  perform privado.registrar_auditoria(v_restaurante, 'usuarios.' || p_evento, 'usuarios', p_usuario_id::text,
    case p_evento
      when 'cadastro' then 'cadastrou o usuário ' || v_nome
      when 'senha_redefinida' then 'redefiniu a senha de ' || v_nome
      else 'alterou o usuário ' || v_nome
    end);
end $$;

revoke execute on function public.registrar_evento_equipe(uuid, text) from public, anon;
grant execute on function public.registrar_evento_equipe(uuid, text) to authenticated;
