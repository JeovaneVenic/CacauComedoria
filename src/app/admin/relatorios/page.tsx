import type { Metadata } from "next"
import { AlertTriangle } from "lucide-react"
import { requireRoleWith } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { resolvePeriod, todaySP } from "@/lib/periods"
import { PageHeader } from "@/components/layout/page-header"
import { PeriodFilter } from "@/components/forms/period-filter"
import { getReport } from "@/services/reports"
import { ReportsView } from "./reports-view"
import { REPORT_TABS, type ReportTab } from "./tabs"

export const metadata: Metadata = { title: "Relatórios" }

export default async function ReportsPage({ searchParams }: PageProps<"/admin/relatorios">) {
  const { periodo, de, ate, aba } = await searchParams
  const period = resolvePeriod(periodo, de, ate)
  const tab: ReportTab = REPORT_TABS.some((t) => t.id === aba) ? (aba as ReportTab) : "vendas"
  const { data: report } = await requireRoleWith(MANAGER_ROLES, () => getReport(period))

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Relatórios" description={`Desempenho do restaurante · ${period.label}`} />
      <div className="mb-6">
        <PeriodFilter key={`${period.inicio}:${period.fim}`} basePath="/admin/relatorios" period={period} today={todaySP()} preserve={["aba"]} />
      </div>

      {report.status === "ok" ? (
        <ReportsView key={`${period.inicio}:${period.fim}`} data={report.data} period={period} initialTab={tab} />
      ) : (
        <p role="alert" className="flex gap-2 rounded-xl border border-status-preparing/40 bg-status-preparing-soft p-4 text-sm font-medium text-status-preparing">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          {report.status === "missing"
            ? "Os relatórios precisam de uma atualização no banco: rode o arquivo supabase/migrations/20261002000007_relatorios.sql no SQL Editor do Supabase."
            : report.message}
        </p>
      )}
    </div>
  )
}
