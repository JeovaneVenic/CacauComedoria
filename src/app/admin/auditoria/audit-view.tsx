"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronLeft, ChevronRight, Download, Loader2, Search, ShieldCheck, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/forms/native-select"
import { exportAudit } from "@/features/audit/actions"
import { AUDIT_CATEGORIES, AUDIT_CATEGORY, AUDIT_PAGE_SIZE, auditDetails, type AuditCategory } from "@/features/audit/meta"
import { downloadCsv } from "@/lib/csv"
import { ROLE_LABELS } from "@/lib/roles"
import { cn } from "@/lib/utils"
import type { AuditEntry } from "@/services/audit"
import type { AppRole } from "@/types/domain"

const dayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" })
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
const fullFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" })

interface Filters {
  periodo: string
  de: string
  ate: string
  categoria?: AuditCategory
  autor?: string
  q?: string
}

interface Props {
  entries: AuditEntry[]
  total: number
  people: { id: string; nome: string; papel: AppRole }[]
  page: number
  filters: Filters
}

export function AuditView({ entries, total, people, page, filters }: Props) {
  const router = useRouter()
  const [q, setQ] = useState(filters.q ?? "")
  const [open, setOpen] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE))

  function go(patch: Partial<Filters> & { pagina?: number }) {
    const next = { ...filters, ...patch }
    const params = new URLSearchParams({ periodo: next.periodo })
    if (next.periodo === "personalizado") {
      params.set("de", next.de)
      params.set("ate", next.ate)
    }
    if (next.categoria) params.set("categoria", next.categoria)
    if (next.autor) params.set("autor", next.autor)
    if (next.q) params.set("q", next.q)
    if (patch.pagina && patch.pagina > 1) params.set("pagina", String(patch.pagina))
    router.push(`/admin/auditoria?${params}`)
  }

  async function onExport() {
    setExporting(true)
    const r = await exportAudit(filters)
    setExporting(false)
    if (!r.ok || !r.data) return toast.error(r.ok ? "Nada para exportar." : r.error)
    downloadCsv(
      `auditoria-${filters.de}-a-${filters.ate}`,
      ["Data e hora", "Pessoa", "Área", "Ação", "Descrição", "Detalhes"],
      r.data.map((e) => [
        fullFmt.format(new Date(e.criado_em)),
        e.autor_nome ?? "Sistema",
        AUDIT_CATEGORY[e.categoria]?.label ?? e.categoria,
        e.acao,
        e.descricao,
        auditDetails(e.detalhes)
          .map((d) => `${d.label}: ${d.value}`)
          .join(" | "),
      ])
    )
    if (r.data.length === 5000) toast.info("Exportados os 5.000 registros mais recentes. Use um período menor para o restante.")
  }

  // agrupa por dia
  const groups: { key: string; label: string; items: AuditEntry[] }[] = []
  for (const e of entries) {
    const d = new Date(e.criado_em)
    const key = dayKey.format(d)
    let g = groups.at(-1)
    if (!g || g.key !== key) {
      const label = dayFmt.format(d)
      g = { key, label: label.charAt(0).toUpperCase() + label.slice(1), items: [] }
      groups.push(g)
    }
    g.items.push(e)
  }

  const hasFilters = !!(filters.categoria || filters.autor || filters.q)

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-44 flex-1 gap-1 text-xs font-semibold text-muted-foreground sm:flex-none">
          Área
          <NativeSelect value={filters.categoria ?? ""} onChange={(e) => go({ categoria: (e.target.value || undefined) as AuditCategory | undefined })} className="h-10 text-sm">
            <option value="">Todas as áreas</option>
            {AUDIT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {AUDIT_CATEGORY[c].label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid min-w-44 flex-1 gap-1 text-xs font-semibold text-muted-foreground sm:flex-none">
          Pessoa
          <NativeSelect value={filters.autor ?? ""} onChange={(e) => go({ autor: e.target.value || undefined })} className="h-10 text-sm">
            <option value="">Toda a equipe</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({ROLE_LABELS[p.papel]})
              </option>
            ))}
          </NativeSelect>
        </label>
        <form
          className="flex min-w-56 flex-[2] items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            go({ q: q.trim() || undefined })
          }}
        >
          <label className="grid flex-1 gap-1 text-xs font-semibold text-muted-foreground">
            Buscar
            <span className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: pedido #120, picanha, mesa 03" className="h-10 pl-9" maxLength={80} />
            </span>
          </label>
          <Button type="submit" variant="outline" className="h-10">
            Buscar
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" role="status">
          {total === 0 ? "Nenhum registro" : `${total.toLocaleString("pt-BR")} ${total === 1 ? "registro" : "registros"}`}
          {hasFilters && (
            <button type="button" onClick={() => go({ categoria: undefined, autor: undefined, q: undefined })} className="ml-3 inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              <X className="size-3.5" aria-hidden /> Limpar filtros
            </button>
          )}
        </p>
        <Button variant="outline" className="h-10" onClick={onExport} disabled={exporting || total === 0}>
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" aria-hidden />}
          Exportar CSV
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed p-10 text-center">
          <ShieldCheck className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-semibold">Nenhuma atividade encontrada.</p>
          <p className="text-sm text-muted-foreground">{hasFilters ? "Tente outro filtro ou um período maior." : "Escolha um período maior."}</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-label={g.label} className="grid gap-2">
            <h2 className="sticky top-0 z-10 bg-background/95 py-1 text-sm font-bold backdrop-blur">{g.label}</h2>
            <ol className="overflow-hidden rounded-2xl border bg-card">
              {g.items.map((e) => {
                const cat = AUDIT_CATEGORY[e.categoria] ?? AUDIT_CATEGORY.outros
                const details = auditDetails(e.detalhes)
                const expanded = open === e.id
                return (
                  <li key={e.id} className="border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setOpen(expanded ? null : e.id)}
                      aria-expanded={details.length ? expanded : undefined}
                      disabled={!details.length}
                      className="flex w-full items-start gap-3 p-3 text-left outline-none enabled:hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                    >
                      <span className="w-12 shrink-0 pt-0.5 text-sm font-semibold text-muted-foreground tabular-nums">{timeFmt.format(new Date(e.criado_em))}</span>
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground" title={cat.label}>
                        <cat.icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm">{e.descricao}</span>
                        <span className="text-xs text-muted-foreground">{cat.label}</span>
                      </span>
                      {details.length > 0 && <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden />}
                    </button>
                    {expanded && (
                      <dl className="grid gap-1 border-t bg-muted/30 px-4 py-3 pl-[7.25rem] text-sm max-sm:pl-4">
                        {details.map((d) => (
                          <div key={d.label} className="flex flex-wrap gap-x-2">
                            <dt className="font-semibold">{d.label}:</dt>
                            <dd className="text-muted-foreground">{d.value}</dd>
                          </div>
                        ))}
                        <div className="flex flex-wrap gap-x-2 pt-1 text-xs text-muted-foreground">
                          <dt>Registrado em</dt>
                          <dd>{fullFmt.format(new Date(e.criado_em))}</dd>
                        </div>
                      </dl>
                    )}
                  </li>
                )
              })}
            </ol>
          </section>
        ))
      )}

      {pages > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-center gap-3">
          <Button variant="outline" className="h-10" disabled={page <= 1} onClick={() => go({ pagina: page - 1 })}>
            <ChevronLeft className="size-4" aria-hidden /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {pages}
          </span>
          <Button variant="outline" className="h-10" disabled={page >= pages} onClick={() => go({ pagina: page + 1 })}>
            Próxima <ChevronRight className="size-4" aria-hidden />
          </Button>
        </nav>
      )}
    </div>
  )
}
