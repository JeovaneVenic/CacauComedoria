"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { createClient } from "@/lib/supabase/server"
import { friendlyError } from "@/lib/errors"
import { validationError, type ActionResult } from "@/lib/action"
import { restaurantSchema, type RestaurantInput } from "@/schemas/restaurant"

export async function updateRestaurant(input: RestaurantInput): Promise<ActionResult> {
  const { restaurant } = await requireRole(MANAGER_ROLES)
  const parsed = restaurantSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const v = parsed.data

  // O logo só pode vir da pasta do próprio restaurante
  if (v.logo_url && !v.logo_url.includes(`/storage/v1/object/public/logos/${restaurant.id}/`)) {
    return { ok: false, error: "Envie o logo pelo botão de upload." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("restaurantes")
    .update({
      nome: v.nome,
      endereco: v.endereco || null,
      telefone: v.telefone || null,
      taxa_servico_percentual: v.taxa_servico_percentual,
      garcom_pode_fechar_mesa: v.garcom_pode_fechar_mesa,
      horario_funcionamento: Object.fromEntries(Object.entries(v.horario_funcionamento).filter(([, h]) => h)),
      logo_url: v.logo_url,
    })
    .eq("id", restaurant.id)
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível salvar as configurações.") }

  revalidatePath("/", "layout")
  return { ok: true }
}
