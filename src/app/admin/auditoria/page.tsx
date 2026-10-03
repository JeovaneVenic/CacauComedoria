import type { Metadata } from "next"
import { AlertTriangle } from "lucide-react"
import { requireRoleWith } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { resolvePeriod, todaySP } from "@/lib/periods"
import { PageHeader } from "@/components/layout/page-header"
import { PeriodFilter } from "@/components/forms/period-filter"
import { isAuditCategory } from "@/features/audit/meta"
import { getAudit } from "@/services/audit"
import { AuditView } from "./audit-view"

export const metadata: Metadata = { title: "Auditoria" }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function AuditPage({ searchParams }: PageProps<"/admin/auditoria">) {
  const sp = await searchParams
  const periodo = one(sp.periodo) ?? "7dias"
  const period = resolvePeriod(periodo, one(sp.de), one(sp.ate))
  const categoria = isAuditCategory(one(sp.categoria)) ? (one(sp.categoria) as Parameters<typeof getAudit>[0]["categoria"]) : undefined
  const autor = one(sp.autor) || undefined
  const q = one(sp.q)?.slice(0, 80) || undefined
  const pagina = Math.max(1, Math.min(1000, Number(one(sp.pagina)) || 1))
  const { data } = await requireRoleWith(MANAGER_ROLES, () => getAudit({ period, categoria, autor, q, pagina }))
  const person = autor ? data.people.find((p) => p.id === autor) : undefined

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={person ? `Atividades de ${person.nome}` : "Auditoria"}
        description={`Quem fez o quê no sistema · ${period.label}`}
      />
      <div className="mb-4">
        <PeriodFilter key={`${period.inicio}:${period.fim}`} basePath="/admin/auditoria" period={period} today={todaySP()} preserve={["categoria", "autor", "q"]} />
      </div>
      {data.missing ? (
        <p role="alert" className="flex gap-2 rounded-xl border border-status-preparing/40 bg-status-preparing-soft p-4 text-sm font-medium text-status-preparing">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          A auditoria precisa de uma atualização no banco: rode o arquivo supabase/migrations/20261003000009_auditoria.sql no SQL Editor do Supabase.
        </p>
      ) : (
        <AuditView
          key={`${period.inicio}:${period.fim}:${categoria}:${autor}:${q}:${pagina}`}
          entries={data.entries}
          total={data.total}
          people={data.people}
          page={pagina}
          filters={{ periodo: period.key, de: period.inicio, ate: period.fim, categoria, autor, q }}
        />
      )}
    </div>
  )
}
