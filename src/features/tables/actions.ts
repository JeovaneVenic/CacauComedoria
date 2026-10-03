"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { createClient } from "@/lib/supabase/server"
import { friendlyError } from "@/lib/errors"
import { validationError, type ActionResult } from "@/lib/action"
import { sectionSchema, tableSchema, tableStatusSchema, type SectionInput, type TableInput } from "@/schemas/tables"
import type { TableStatus } from "@/types/domain"

// Toda ação confere o papel no servidor; o RLS do banco confere de novo.

function refresh() {
  revalidatePath("/admin/mesas")
  revalidatePath("/admin")
  revalidatePath("/garcom")
}

export async function saveTable(input: TableInput): Promise<ActionResult> {
  const { restaurant } = await requireRole(MANAGER_ROLES)
  const parsed = tableSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { id, ...values } = parsed.data
  const supabase = await createClient()

  // Duas mesas ativas não podem ocupar a mesma posição no mesmo setor
  if (values.ativa) {
    let clash = supabase
      .from("mesas")
      .select("numero")
      .eq("ativa", true)
      .eq("pos_x", values.pos_x)
      .eq("pos_y", values.pos_y)
    clash = values.setor_id ? clash.eq("setor_id", values.setor_id) : clash.is("setor_id", null)
    if (id) clash = clash.neq("id", id)
    const { data: taken } = await clash.limit(1)
    if (taken?.length) {
      return { ok: false, error: `A mesa ${String(taken[0].numero).padStart(2, "0")} já está nessa posição.` }
    }
  }

  const { error } = id
    ? await supabase.from("mesas").update(values).eq("id", id)
    : await supabase.from("mesas").insert({ ...values, restaurante_id: restaurant.id })

  if (error) {
    if (error.code === "23505") return { ok: false, error: `Já existe a mesa ${values.numero}.` }
    return { ok: false, error: friendlyError(error, "Não foi possível salvar a mesa.") }
  }
  refresh()
  return { ok: true }
}

export async function deleteTable(id: string): Promise<ActionResult> {
  await requireRole(MANAGER_ROLES)
  const supabase = await createClient()
  const { data: table } = await supabase.from("mesas").select("status").eq("id", id).maybeSingle()
  if (table && table.status !== "livre") {
    return { ok: false, error: "Feche a mesa antes de excluí-la." }
  }
  const { error } = await supabase.from("mesas").delete().eq("id", id)
  if (error) {
    if (error.code === "23503") {
      return { ok: false, error: "Esta mesa tem histórico de pedidos. Desative-a em vez de excluir." }
    }
    return { ok: false, error: friendlyError(error, "Não foi possível excluir a mesa.") }
  }
  refresh()
  return { ok: true }
}

/** Ajuste manual do estado (ex.: liberar uma mesa travada) */
export async function setTableStatus(id: string, status: TableStatus): Promise<ActionResult> {
  await requireRole(MANAGER_ROLES)
  const parsed = tableStatusSchema.safeParse(status)
  if (!parsed.success) return { ok: false, error: "Estado inválido." }
  const supabase = await createClient()
  const { error } = await supabase.from("mesas").update({ status: parsed.data }).eq("id", id)
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível atualizar a mesa.") }
  refresh()
  return { ok: true }
}

export async function saveSection(input: SectionInput): Promise<ActionResult> {
  const { restaurant } = await requireRole(MANAGER_ROLES)
  const parsed = sectionSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const supabase = await createClient()
  const { id, nome } = parsed.data

  let error
  if (id) {
    ;({ error } = await supabase.from("setores").update({ nome }).eq("id", id))
  } else {
    const { count } = await supabase.from("setores").select("id", { count: "exact", head: true })
    ;({ error } = await supabase
      .from("setores")
      .insert({ nome, restaurante_id: restaurant.id, ordem: (count ?? 0) + 1 }))
  }
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe um setor com esse nome." }
    return { ok: false, error: friendlyError(error, "Não foi possível salvar o setor.") }
  }
  refresh()
  return { ok: true }
}

export async function deleteSection(id: string): Promise<ActionResult> {
  await requireRole(MANAGER_ROLES)
  const supabase = await createClient()
  // as mesas do setor ficam "sem setor" (on delete set null)
  const { error } = await supabase.from("setores").delete().eq("id", id)
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível excluir o setor.") }
  refresh()
  return { ok: true }
}
