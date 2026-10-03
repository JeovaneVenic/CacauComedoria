"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { createClient } from "@/lib/supabase/server"
import { friendlyError } from "@/lib/errors"
import { validationError, type ActionResult } from "@/lib/action"
import { expenseSchema, supplierSchema, type ExpenseInput, type SupplierInput } from "@/schemas/finance"

// Toda ação confere o papel no servidor; o RLS do banco confere de novo.

const BUCKET = "comprovantes"

function refresh() {
  revalidatePath("/admin/financeiro")
  revalidatePath("/admin")
}

export async function saveExpense(input: ExpenseInput): Promise<ActionResult> {
  const { profile, restaurant } = await requireRole(MANAGER_ROLES)
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { id, ...v } = parsed.data

  // o comprovante só pode estar na pasta do próprio restaurante
  if (v.comprovante_caminho && !v.comprovante_caminho.startsWith(`${restaurant.id}/`)) {
    return { ok: false, error: "Envie o comprovante pelo botão de anexo." }
  }

  const row = { ...v, observacao: v.observacao || null }
  const supabase = await createClient()
  let oldReceipt: string | null = null

  if (id) {
    const { data: current } = await supabase.from("despesas").select("comprovante_caminho").eq("id", id).maybeSingle()
    oldReceipt = current?.comprovante_caminho ?? null
    const { error } = await supabase.from("despesas").update(row).eq("id", id)
    if (error) return { ok: false, error: friendlyError(error, "Não foi possível salvar a despesa.") }
  } else {
    const { error } = await supabase.from("despesas").insert({ ...row, restaurante_id: restaurant.id, criado_por: profile.id })
    if (error) return { ok: false, error: friendlyError(error, "Não foi possível salvar a despesa.") }
  }

  // remove o arquivo substituído
  if (oldReceipt && oldReceipt !== v.comprovante_caminho) await supabase.storage.from(BUCKET).remove([oldReceipt])

  refresh()
  return { ok: true }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  await requireRole(MANAGER_ROLES)
  const supabase = await createClient()
  const { data: current } = await supabase.from("despesas").select("comprovante_caminho").eq("id", id).maybeSingle()
  const { error } = await supabase.from("despesas").delete().eq("id", id)
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível excluir a despesa.") }
  if (current?.comprovante_caminho) await supabase.storage.from(BUCKET).remove([current.comprovante_caminho])
  refresh()
  return { ok: true }
}

/** Link temporário (5 min) para abrir o comprovante: o bucket é privado */
export async function getReceiptUrl(path: string): Promise<ActionResult<string>> {
  const { restaurant } = await requireRole(MANAGER_ROLES)
  if (!path.startsWith(`${restaurant.id}/`)) return { ok: false, error: "Comprovante não encontrado." }
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300)
  if (error || !data) return { ok: false, error: "Não foi possível abrir o comprovante." }
  return { ok: true, data: data.signedUrl }
}

export async function saveSupplier(input: SupplierInput): Promise<ActionResult<{ id: string }>> {
  const { restaurant } = await requireRole(MANAGER_ROLES)
  const parsed = supplierSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { id, ...v } = parsed.data
  const row = {
    nome: v.nome,
    documento: v.documento || null,
    telefone: v.telefone || null,
    email: v.email || null,
    observacao: v.observacao || null,
  }
  const supabase = await createClient()
  if (id) {
    const { error } = await supabase.from("fornecedores").update(row).eq("id", id)
    if (error) return { ok: false, error: friendlyError(error, "Não foi possível salvar o fornecedor.") }
    refresh()
    return { ok: true, data: { id } }
  }
  const { data, error } = await supabase.from("fornecedores").insert({ ...row, restaurante_id: restaurant.id }).select("id").single()
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível salvar o fornecedor.") }
  refresh()
  return { ok: true, data: { id: data.id } }
}

export async function setSupplierActive(id: string, ativo: boolean): Promise<ActionResult> {
  await requireRole(MANAGER_ROLES)
  const supabase = await createClient()
  const { error } = await supabase.from("fornecedores").update({ ativo }).eq("id", id)
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível atualizar o fornecedor.") }
  refresh()
  return { ok: true }
}
