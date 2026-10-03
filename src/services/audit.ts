import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { ResolvedPeriod } from "@/lib/periods"
import { AUDIT_PAGE_SIZE, type AuditCategory } from "@/features/audit/meta"

export interface AuditEntry {
  id: number
  autor_id: string | null
  autor_nome: string | null
  acao: string
  categoria: AuditCategory
  entidade: string
  descricao: string
  detalhes: Record<string, unknown>
  criado_em: string
}

export interface AuditFilters {
  period: ResolvedPeriod
  categoria?: AuditCategory
  autor?: string
  q?: string
  pagina: number
}

const UUID = /^[0-9a-f-]{36}$/i

/** Monta a consulta filtrada (RLS: só a gestão lê a auditoria). */
async function query(f: AuditFilters, from: number, to: number, withCount: boolean) {
  const supabase = await createClient()
  let q = supabase
    .from("auditoria")
    .select("id, autor_id, autor_nome, acao, categoria, entidade, descricao, detalhes, criado_em", withCount ? { count: "exact" } : undefined)
    .gte("criado_em", f.period.de)
    .lt("criado_em", f.period.ate)
  if (f.categoria) q = q.eq("categoria", f.categoria)
  if (f.autor && UUID.test(f.autor)) q = q.eq("autor_id", f.autor)
  const term = f.q?.replace(/[%_\\*,()]/g, " ").trim()
  if (term) q = q.ilike("descricao", `%${term}%`)
  return q.order("criado_em", { ascending: false }).order("id", { ascending: false }).range(from, to)
}

export async function getAudit(f: AuditFilters) {
  const supabase = await createClient()
  const from = (f.pagina - 1) * AUDIT_PAGE_SIZE
  const [result, people] = await Promise.all([
    query(f, from, from + AUDIT_PAGE_SIZE - 1, true),
    supabase.from("usuarios").select("id, nome, papel").order("nome"),
  ])
  if (people.error) throw people.error
  // 42703: coluna categoria ainda não existe (migração 009 pendente)
  if (result.error?.code === "42703") return { missing: true as const, entries: [], total: 0, people: people.data ?? [] }
  if (result.error) throw result.error
  return { missing: false as const, entries: (result.data ?? []) as AuditEntry[], total: result.count ?? 0, people: people.data ?? [] }
}

/** Até 5.000 registros para exportação */
export async function getAuditForExport(f: AuditFilters) {
  const { data, error } = await query(f, 0, 4999, false)
  if (error) throw error
  return (data ?? []) as AuditEntry[]
}
