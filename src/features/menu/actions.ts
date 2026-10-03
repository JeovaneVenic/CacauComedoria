"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { createClient } from "@/lib/supabase/server"
import { friendlyError } from "@/lib/errors"
import { validationError, type ActionResult } from "@/lib/action"
import {
  categorySchema,
  modifierGroupSchema,
  productSchema,
  type CategoryInput,
  type ModifierGroupInput,
  type ProductInput,
} from "@/schemas/menu"

// Toda ação confere o papel no servidor; o RLS do banco confere de novo.

const BUCKET = "imagens-produtos"

function refresh() {
  revalidatePath("/admin/cardapio")
}

/** Caminho do arquivo no bucket a partir da URL pública */
function storagePath(url: string | null) {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const i = url?.indexOf(marker) ?? -1
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null
}

// ---------- Categorias ----------

export async function saveCategory(input: CategoryInput): Promise<ActionResult> {
  const { restaurant } = await requireRole(MANAGER_ROLES)
  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { id, ...values } = parsed.data
  const supabase = await createClient()

  let error
  if (id) {
    ;({ error } = await supabase.from("categorias").update(values).eq("id", id))
  } else {
    const { data: last } = await supabase.from("categorias").select("ordem").order("ordem", { ascending: false }).limit(1)
    ;({ error } = await supabase
      .from("categorias")
      .insert({ ...values, restaurante_id: restaurant.id, ordem: (last?.[0]?.ordem ?? 0) + 1 }))
  }
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe uma categoria com esse nome." }
    return { ok: false, error: friendlyError(error, "Não foi possível salvar a categoria.") }
  }
  refresh()
  return { ok: true }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireRole(MANAGER_ROLES)
  const supabase = await createClient()
  const { count } = await supabase.from("produtos").select("id", { count: "exact", head: true }).eq("categoria_id", id)
  if (count) {
    return { ok: false, error: `Esta categoria tem ${count} produto(s). Mova ou exclua os produtos antes.` }
  }
  const { error } = await supabase.from("categorias").delete().eq("id", id)
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível excluir a categoria.") }
  refresh()
  return { ok: true }
}

/** Troca a posição com a categoria vizinha (para cima ou para baixo) */
export async function moveCategory(id: string, direction: "up" | "down"): Promise<ActionResult> {
  await requireRole(MANAGER_ROLES)
  const supabase = await createClient()
  const { data } = await supabase.from("categorias").select("id, ordem").order("ordem").order("nome")
  const list = data ?? []
  const index = list.findIndex((c) => c.id === id)
  const neighbor = list[direction === "up" ? index - 1 : index + 1]
  if (index < 0 || !neighbor) return { ok: true }

  // renumera para evitar empates de ordem
  const reordered = [...list]
  reordered[index] = neighbor
  reordered[direction === "up" ? index - 1 : index + 1] = list[index]
  const results = await Promise.all(
    reordered.map((c, i) => supabase.from("categorias").update({ ordem: i + 1 }).eq("id", c.id))
  )
  const error = results.find((r) => r.error)?.error
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível reordenar.") }
  refresh()
  return { ok: true }
}

// ---------- Produtos ----------

export async function saveProduct(input: ProductInput): Promise<ActionResult> {
  const { restaurant } = await requireRole(MANAGER_ROLES)
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { id, grupos_ids, ...values } = parsed.data

  // A foto só pode vir da pasta do próprio restaurante
  if (values.imagem_url && !storagePath(values.imagem_url)?.startsWith(`${restaurant.id}/`)) {
    return { ok: false, error: "Envie a foto pelo botão de upload." }
  }

  const supabase = await createClient()
  let productId = id
  let oldImage: string | null = null

  if (id) {
    const { data: current } = await supabase.from("produtos").select("imagem_url").eq("id", id).maybeSingle()
    oldImage = current?.imagem_url ?? null
    const { error } = await supabase
      .from("produtos")
      .update({ ...values, descricao: values.descricao || null })
      .eq("id", id)
    if (error) return { ok: false, error: friendlyError(error, "Não foi possível salvar o produto.") }
  } else {
    const { data: last } = await supabase
      .from("produtos")
      .select("ordem")
      .eq("categoria_id", values.categoria_id)
      .order("ordem", { ascending: false })
      .limit(1)
    const { data, error } = await supabase
      .from("produtos")
      .insert({
        ...values,
        descricao: values.descricao || null,
        restaurante_id: restaurant.id,
        ordem: (last?.[0]?.ordem ?? 0) + 1,
      })
      .select("id")
      .single()
    if (error) return { ok: false, error: friendlyError(error, "Não foi possível salvar o produto.") }
    productId = data.id
  }

  // Sincroniza os grupos de opções do produto
  const { data: links } = await supabase.from("produto_grupos_opcoes").select("grupo_id").eq("produto_id", productId!)
  const current = new Set((links ?? []).map((l) => l.grupo_id))
  const wanted = new Set(grupos_ids)
  const toRemove = [...current].filter((g) => !wanted.has(g))
  const toAdd = grupos_ids.filter((g) => !current.has(g))
  if (toRemove.length) {
    const { error } = await supabase
      .from("produto_grupos_opcoes")
      .delete()
      .eq("produto_id", productId!)
      .in("grupo_id", toRemove)
    if (error) return { ok: false, error: friendlyError(error, "Produto salvo, mas as opções não foram atualizadas.") }
  }
  if (toAdd.length) {
    const { error } = await supabase.from("produto_grupos_opcoes").insert(
      toAdd.map((grupo_id) => ({ produto_id: productId!, grupo_id, restaurante_id: restaurant.id, ordem: grupos_ids.indexOf(grupo_id) }))
    )
    if (error) return { ok: false, error: friendlyError(error, "Produto salvo, mas as opções não foram atualizadas.") }
  }

  // Remove a foto antiga substituída
  const oldPath = storagePath(oldImage)
  if (oldPath && oldImage !== values.imagem_url) {
    await supabase.storage.from(BUCKET).remove([oldPath])
  }

  refresh()
  return { ok: true }
}

export async function setProductActive(id: string, ativo: boolean): Promise<ActionResult> {
  await requireRole(MANAGER_ROLES)
  const supabase = await createClient()
  const { error } = await supabase.from("produtos").update({ ativo }).eq("id", id)
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível atualizar o produto.") }
  refresh()
  return { ok: true }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireRole(MANAGER_ROLES)
  const supabase = await createClient()
  const { data: product } = await supabase.from("produtos").select("imagem_url").eq("id", id).maybeSingle()
  // pedidos antigos guardam nome e preço, então o histórico continua correto
  const { error } = await supabase.from("produtos").delete().eq("id", id)
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível excluir o produto.") }
  const path = storagePath(product?.imagem_url ?? null)
  if (path) await supabase.storage.from(BUCKET).remove([path])
  refresh()
  return { ok: true }
}

// ---------- Grupos de opções ----------

export async function saveModifierGroup(input: ModifierGroupInput): Promise<ActionResult> {
  const { restaurant } = await requireRole(MANAGER_ROLES)
  const parsed = modifierGroupSchema.safeParse(input)
  if (!parsed.success) return validationError(parsed.error)
  const { id, opcoes, ...values } = parsed.data
  const supabase = await createClient()

  let groupId = id
  if (id) {
    const { error } = await supabase.from("grupos_opcoes").update(values).eq("id", id)
    if (error) return { ok: false, error: friendlyError(error, "Não foi possível salvar o grupo.") }
  } else {
    const { data, error } = await supabase
      .from("grupos_opcoes")
      .insert({ ...values, restaurante_id: restaurant.id })
      .select("id")
      .single()
    if (error) return { ok: false, error: friendlyError(error, "Não foi possível salvar o grupo.") }
    groupId = data.id
  }

  // Opções: atualiza as existentes, cria as novas e remove as apagadas
  const { data: existing } = await supabase.from("opcoes").select("id").eq("grupo_id", groupId!)
  const keep = new Set(opcoes.filter((o) => o.id).map((o) => o.id))
  const removed = (existing ?? []).map((o) => o.id).filter((oid) => !keep.has(oid))
  if (removed.length) {
    const { error } = await supabase.from("opcoes").delete().in("id", removed)
    if (error) return { ok: false, error: friendlyError(error, "Não foi possível atualizar as opções.") }
  }
  const results = await Promise.all(
    opcoes.map((o, ordem) => {
      const row = { nome: o.nome, acrescimo: o.acrescimo, ativa: o.ativa, ordem }
      return o.id
        ? supabase.from("opcoes").update(row).eq("id", o.id)
        : supabase.from("opcoes").insert({ ...row, grupo_id: groupId!, restaurante_id: restaurant.id })
    })
  )
  const error = results.find((r) => r.error)?.error
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível atualizar as opções.") }

  refresh()
  return { ok: true }
}

export async function deleteModifierGroup(id: string): Promise<ActionResult> {
  await requireRole(MANAGER_ROLES)
  const supabase = await createClient()
  // os vínculos com produtos e as opções saem junto (on delete cascade)
  const { error } = await supabase.from("grupos_opcoes").delete().eq("id", id)
  if (error) return { ok: false, error: friendlyError(error, "Não foi possível excluir o grupo.") }
  refresh()
  return { ok: true }
}
