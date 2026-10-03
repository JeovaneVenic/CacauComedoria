"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { friendlyError } from "@/lib/errors"
import { validationError, type ActionResult } from "@/lib/action"
import {
  createStaffSchema,
  resetStaffPasswordSchema,
  updateStaffSchema,
  type CreateStaffInput,
  type UpdateStaffInput,
} from "@/schemas/users"
import type { AppRole } from "@/types/domain"

const NO_ADMIN_KEY =
  "Para criar usuários, configure SUPABASE_SERVICE_ROLE_KEY no servidor (arquivo .env.local)."

/** Só o proprietário cria ou promove gerentes */
function canAssign(actorRole: AppRole, role: AppRole) {
  return role !== "gerente" || actorRole === "proprietario" || actorRole === "administrador"
}

/**
 * Quem pode mexer em quem (mesma regra do gatilho privado.proteger_usuarios no banco):
 * ninguém mexe na proprietária nem em si mesmo; gerentes só são geridos por proprietário/administrador.
 */
function canManage(actor: { id: string; papel: AppRole }, target: { id: string; papel: AppRole }) {
  if (target.id === actor.id || target.papel === "proprietario") return false
  if (target.papel === "gerente" || target.papel === "administrador") return actor.papel === "proprietario" || actor.papel === "administrador"
  return true
}

/** Busca o membro garantindo que é do mesmo restaurante (RLS) */
async function getMember(id: string) {
  const supabase = await createClient()
  const { data } = await supabase.from("usuarios").select("id, papel, nome").eq("id", id).maybeSingle()
  return data as { id: string; papel: AppRole; nome: string } | null
}

export async function createStaff(input: CreateStaffInput): Promise<ActionResult> {
  const { profile, restaurant } = await requireRole(MANAGER_ROLES)
  const parsed = createStaffSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const values = parsed.data
  if (!canAssign(profile.papel, values.papel)) {
    return { ok: false, error: "Somente o proprietário pode cadastrar gerentes." }
  }

  const admin = createAdminClient()
  if (!admin) return { ok: false, error: NO_ADMIN_KEY }

  // restaurante e papel vão em app_metadata (o usuário não consegue alterar);
  // o gatilho privado.ao_criar_usuario cria o perfil a partir daí.
  const { data: created, error } = await admin.auth.admin.createUser({
    email: values.email,
    password: values.senha,
    email_confirm: true,
    app_metadata: { restaurante_id: restaurant.id, papel: values.papel },
    user_metadata: { nome: values.nome },
  })
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível criar o usuário.") }

  // O Auth grava o app_metadata depois do INSERT; garante o perfil completo aqui também
  const { error: profileError } = await admin
    .from("usuarios")
    .upsert({ id: created.user.id, restaurante_id: restaurant.id, papel: values.papel, nome: values.nome, email: values.email })
  if (profileError) return { ok: false, error: friendlyError(profileError, "Usuário criado, mas o perfil não foi salvo.") }

  await logTeamEvent(created.user.id, "cadastro")

  revalidatePath("/admin/usuarios")
  return { ok: true }
}

export async function updateStaff(input: UpdateStaffInput): Promise<ActionResult> {
  const { profile } = await requireRole(MANAGER_ROLES)
  const parsed = updateStaffSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { id, nome, papel } = parsed.data

  const member = await getMember(id)
  if (!member) return { ok: false, error: "Usuário não encontrado." }
  const supabase = await createClient()
  if (member.papel === "proprietario") {
    // o proprietário só altera o próprio nome aqui
    if (id !== profile.id) return { ok: false, error: "Você não possui permissão para realizar esta ação." }
    const { error } = await supabase.from("usuarios").update({ nome }).eq("id", id)
    if (error) return { ok: false, error: friendlyError(error) }
  } else if (id === profile.id) {
    // a própria função não muda por aqui; só o nome
    const { error } = await supabase.from("usuarios").update({ nome }).eq("id", id)
    if (error) return { ok: false, error: friendlyError(error) }
  } else {
    if (!canManage(profile, member) || !canAssign(profile.papel, papel)) {
      return { ok: false, error: "Somente o proprietário pode alterar gerentes." }
    }
    const { error } = await supabase.from("usuarios").update({ nome, papel }).eq("id", id)
    if (error) return { ok: false, error: friendlyError(error, "Não foi possível atualizar o usuário.") }
    // mantém o app_metadata coerente para futuros acessos
    await createAdminClient()?.auth.admin.updateUserById(id, { app_metadata: { papel } })
  }

  revalidatePath("/admin/usuarios")
  return { ok: true }
}

export async function setStaffActive(id: string, ativo: boolean): Promise<ActionResult> {
  const { profile } = await requireRole(MANAGER_ROLES)
  if (typeof ativo !== "boolean") return { ok: false, error: "Verifique os dados informados." }
  if (id === profile.id) return { ok: false, error: "Você não pode desativar o próprio acesso." }
  const member = await getMember(id)
  if (!member) return { ok: false, error: "Usuário não encontrado." }
  if (member.papel === "proprietario") return { ok: false, error: "O proprietário não pode ser desativado." }
  if (!canManage(profile, member)) return { ok: false, error: "Somente o proprietário pode alterar gerentes." }

  const supabase = await createClient()
  const { error } = await supabase.from("usuarios").update({ ativo }).eq("id", id)
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível atualizar o usuário.") }

  // Bloqueia também o login e derruba sessões abertas
  const admin = createAdminClient()
  if (admin) {
    await admin.auth.admin.updateUserById(id, { ban_duration: ativo ? "none" : "876000h" })
  }

  revalidatePath("/admin/usuarios")
  return { ok: true }
}

export async function resetStaffPassword(id: string, senha: string): Promise<ActionResult> {
  const { profile } = await requireRole(MANAGER_ROLES)
  const parsed = resetStaffPasswordSchema.safeParse({ id, senha })
  if (!parsed.success) return validationError(parsed.error)
  const member = await getMember(id)
  if (!member) return { ok: false, error: "Usuário não encontrado." }
  // a chave secreta ignora as regras do banco: a permissão é conferida aqui
  if (!canManage(profile, member)) return { ok: false, error: "Você não possui permissão para redefinir a senha desta pessoa." }

  const admin = createAdminClient()
  if (!admin) return { ok: false, error: NO_ADMIN_KEY }
  const { error } = await admin.auth.admin.updateUserById(id, { password: parsed.data.senha })
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível redefinir a senha.") }

  await logTeamEvent(id, "senha_redefinida")
  return { ok: true }
}

/** Registra na auditoria em nome de quem executou (não bloqueia a ação) */
async function logTeamEvent(userId: string, evento: "cadastro" | "senha_redefinida") {
  const supabase = await createClient()
  await supabase.rpc("registrar_evento_equipe", { p_usuario_id: userId, p_evento: evento })
}
