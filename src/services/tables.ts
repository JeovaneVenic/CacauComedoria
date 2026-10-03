import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { DiningTable, Section, TableOverview } from "@/types/domain"

export async function getTableOverview() {
  const supabase = await createClient()
  const { data, error } = await supabase.from("visao_mesas").select("*").eq("ativa", true).order("numero")
  if (error) throw error
  return (data ?? []) as TableOverview[]
}

export async function getSections() {
  const supabase = await createClient()
  const { data, error } = await supabase.from("setores").select("*").order("ordem").order("nome")
  if (error) throw error
  return (data ?? []) as Section[]
}

export async function getAllTables() {
  const supabase = await createClient()
  const { data, error } = await supabase.from("mesas").select("*").order("numero")
  if (error) throw error
  return (data ?? []) as DiningTable[]
}

export async function getTableWithSession(tableId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from("visao_mesas").select("*").eq("id", tableId).maybeSingle()
  return data as TableOverview | null
}
