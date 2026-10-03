import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { homePathForRole } from "@/lib/roles"
import type { AppRole, Profile, Restaurant } from "@/types/domain"

export interface SessionContext {
  profile: Profile
  restaurant: Restaurant
}

/** Perfil + restaurante do usuário logado (memoizado por requisição). */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) return null

  // perfil + restaurante numa única ida ao banco (cada ida custa ~300 ms até o Supabase)
  const { data } = await supabase
    .from("usuarios")
    .select("*, restaurante:restaurantes(*)")
    .eq("id", userId)
    .maybeSingle<Profile & { restaurante: Restaurant | null }>()
  if (!data?.restaurante_id || !data.ativo || !data.restaurante) return null

  const { restaurante: restaurant, ...profile } = data
  return { profile, restaurant }
})

/**
 * Garante no servidor que o usuário tem um dos papéis exigidos.
 * Quem não tem permissão volta para a própria tela inicial, então trocar a
 * URL manualmente não dá acesso a nada. O RLS do banco é a segunda barreira.
 */
export async function requireRole(roles: AppRole[]): Promise<SessionContext> {
  const ctx = await getSessionContext()
  if (!ctx) redirect("/auth/sair?motivo=acesso")
  if (!roles.includes(ctx.profile.papel)) redirect(homePathForRole(ctx.profile.papel))
  return ctx
}

/**
 * Confere o papel E carrega os dados da página ao mesmo tempo (uma ida ao banco a menos por tela).
 * Seguro porque os dados já são protegidos pelo RLS: quem não tem permissão é redirecionado antes
 * de qualquer dado ser usado, e um erro da carga só aparece para quem tem acesso.
 */
export async function requireRoleWith<T>(roles: AppRole[], load: () => Promise<T>): Promise<SessionContext & { data: T }> {
  const pending = load().then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error })
  )
  const ctx = await requireRole(roles)
  const result = await pending
  if (!result.ok) throw result.error
  return { ...ctx, data: result.value }
}
