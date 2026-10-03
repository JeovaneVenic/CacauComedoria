"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { createClient } from "@/lib/supabase/server"
import { friendlyError } from "@/lib/errors"
import { validationError, type ActionResult } from "@/lib/action"
import { movementSchema, recipeSchema, stockItemSchema, type MovementInput, type RecipeInput, type StockItemInput } from "@/schemas/inventory"

// A quantidade em estoque só muda pela função movimentar_estoque (o banco não deixa editar direto).

function refresh() {
  revalidatePath("/admin/estoque")
}

export async function saveStockItem(input: StockItemInput): Promise<ActionResult> {
  const { restaurant } = await requireRole(MANAGER_ROLES)
  const parsed = stockItemSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { id, quantidade_inicial, ...v } = parsed.data
  const supabase = await createClient()

  if (id) {
    const { error } = await supabase.from("itens_estoque").update(v).eq("id", id)
    if (error) return { ok: false, error: friendlyError(error, "Não foi possível salvar o item.") }
  } else {
    const { data, error } = await supabase.from("itens_estoque").insert({ ...v, restaurante_id: restaurant.id }).select("id").single()
    if (error) return { ok: false, error: friendlyError(error, "Não foi possível salvar o item.") }
    if (typeof quantidade_inicial === "number" && quantidade_inicial > 0) {
      const { error: movError } = await supabase.rpc("movimentar_estoque", {
        p_item_id: data.id,
        p_tipo: "entrada",
        p_quantidade: quantidade_inicial,
        p_custo_unitario: v.custo_unitario,
        p_motivo: "Estoque inicial",
      })
      if (movError) return { ok: false, error: friendlyError(movError, "O item foi criado, mas não foi possível registrar a quantidade inicial.") }
    }
  }
  refresh()
  return { ok: true }
}

export async function deleteStockItem(id: string): Promise<ActionResult> {
  await requireRole(MANAGER_ROLES)
  const supabase = await createClient()
  const { data, error } = await supabase.from("itens_estoque").delete().eq("id", id).select("id")
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível excluir o item.") }
  // o RLS só deixa excluir itens que nunca foram movimentados
  if (!data?.length) return { ok: false, error: "Este item já tem movimentações. Desative-o em vez de excluir." }
  refresh()
  return { ok: true }
}

export async function moveStock(input: MovementInput): Promise<ActionResult> {
  await requireRole(MANAGER_ROLES)
  const parsed = movementSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.rpc("movimentar_estoque", {
    p_item_id: v.item_id,
    p_tipo: v.tipo,
    p_quantidade: v.quantidade,
    p_custo_unitario: typeof v.custo_unitario === "number" ? v.custo_unitario : null,
    p_motivo: v.motivo || null,
  })
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível registrar a movimentação.") }
  refresh()
  return { ok: true }
}

export async function saveRecipe(input: RecipeInput): Promise<ActionResult> {
  await requireRole(MANAGER_ROLES)
  const parsed = recipeSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const supabase = await createClient()
  const { error } = await supabase.rpc("definir_ficha_tecnica", { p_produto_id: parsed.data.produto_id, p_itens: parsed.data.itens })
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível salvar a ficha técnica.") }
  refresh()
  return { ok: true }
}

export async function setAutoDeduction(enabled: boolean): Promise<ActionResult> {
  const { restaurant } = await requireRole(MANAGER_ROLES)
  const supabase = await createClient()
  const { error } = await supabase.from("restaurantes").update({ baixa_estoque_automatica: enabled }).eq("id", restaurant.id)
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível alterar a configuração.") }
  refresh()
  revalidatePath("/admin/configuracoes")
  return { ok: true }
}
