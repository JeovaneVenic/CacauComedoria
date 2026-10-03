"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PERIOD_LABELS, type PeriodKey, type ResolvedPeriod } from "@/lib/periods"
import { cn } from "@/lib/utils"

const QUICK: PeriodKey[] = ["hoje", "ontem", "7dias", "mes", "mes_passado"]

/** Atalhos de período + intervalo personalizado; grava o filtro na URL (?periodo=&de=&ate=). */
export function PeriodFilter({ basePath, period, today, preserve = [] }: { basePath: string; period: ResolvedPeriod; today: string; preserve?: string[] }) {
  const router = useRouter()
  const current = useSearchParams()
  const [from, setFrom] = useState(period.inicio)
  const [to, setTo] = useState(period.fim)

  function go(key: PeriodKey, de?: string, ate?: string) {
    const params = new URLSearchParams()
    for (const p of preserve) {
      const v = current.get(p)
      if (v) params.set(p, v)
    }
    params.set("periodo", key)
    if (de && ate) {
      params.set("de", de)
      params.set("ate", ate)
    }
    router.push(`${basePath}?${params}`)
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div role="tablist" aria-label="Período" className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
        {QUICK.map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={period.key === k}
            onClick={() => go(k)}
            className={cn(
              "h-10 rounded-lg px-3 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              period.key === k ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {PERIOD_LABELS[k]}
          </button>
        ))}
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (from && to) go("personalizado", from, to)
        }}
      >
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          De
          <Input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className="h-10" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          Até
          <Input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className="h-10" />
        </label>
        <Button type="submit" variant={period.key === "personalizado" ? "default" : "outline"} className="h-10">
          Aplicar
        </Button>
      </form>
    </div>
  )
}
