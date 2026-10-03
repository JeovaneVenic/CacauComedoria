"use client"

import { useState } from "react"
import { LayoutGrid, Plus, Settings2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/page-header"
import { TABLE_STATUS } from "@/features/tables/status"
import { cn } from "@/lib/utils"
import type { DiningTable, Section } from "@/types/domain"
import { TableFormSheet, type TableFormTarget } from "./table-form-sheet"
import { SectionsDialog } from "./sections-dialog"

const CELL = "minmax(5.5rem, 1fr)"

export function FloorEditor({ tables, sections }: { tables: DiningTable[]; sections: Section[] }) {
  const [target, setTarget] = useState<TableFormTarget | null>(null)
  const [sectionsOpen, setSectionsOpen] = useState(false)

  const groups = [
    ...sections.map((s) => ({ id: s.id as string | null, nome: s.nome })),
    ...(tables.some((t) => !t.setor_id) ? [{ id: null, nome: "Sem setor" }] : []),
  ]

  function newTable(sectionId: string | null) {
    const inSection = tables.filter((t) => t.setor_id === sectionId && t.ativa)
    // primeira posição livre, varrendo linha por linha
    let pos = { x: 0, y: 0 }
    outer: for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 6; x++) {
        if (!inSection.some((t) => t.pos_x === x && t.pos_y === y)) {
          pos = { x, y }
          break outer
        }
      }
    }
    setTarget({
      mode: "create",
      defaults: {
        numero: Math.max(0, ...tables.map((t) => t.numero)) + 1,
        capacidade: 4,
        setor_id: sectionId,
        formato: "quadrada",
        pos_x: pos.x,
        pos_y: pos.y,
        ativa: true,
      },
    })
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Mesas"
        description={`${tables.filter((t) => t.ativa).length} mesas ativas em ${sections.length} setores. Toque em uma mesa para editar.`}
        actions={
          <>
            <Button variant="outline" className="h-11" onClick={() => setSectionsOpen(true)}>
              <Settings2 className="size-4" aria-hidden /> Setores
            </Button>
            <Button className="h-11 font-semibold" onClick={() => newTable(sections[0]?.id ?? null)}>
              <Plus className="size-4" aria-hidden /> Nova mesa
            </Button>
          </>
        }
      />

      {groups.length === 0 && tables.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-2xl border border-dashed p-12 text-center">
          <LayoutGrid className="size-10 text-muted-foreground" aria-hidden />
          <p className="text-lg font-semibold">Nenhuma mesa cadastrada.</p>
          <p className="text-muted-foreground">Crie um setor (ex.: Salão principal) e adicione as mesas.</p>
          <div className="flex gap-2">
            <Button variant="outline" className="h-11" onClick={() => setSectionsOpen(true)}>
              Criar setor
            </Button>
            <Button className="h-11" onClick={() => newTable(null)}>
              Criar mesa
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          {groups.map((group) => {
            const items = tables.filter((t) => t.setor_id === group.id)
            const cols = Math.max(4, ...items.map((t) => t.pos_x + (t.formato === "retangular" ? 2 : 1)))
            const rows = Math.max(1, ...items.map((t) => t.pos_y + 1))
            return (
              <section key={group.id ?? "none"} aria-labelledby={`setor-${group.id ?? "none"}`} className="rounded-2xl border bg-card">
                <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
                  <h2 id={`setor-${group.id ?? "none"}`} className="font-bold">
                    {group.nome}
                    <span className="ml-2 text-sm font-medium text-muted-foreground">
                      {items.length} {items.length === 1 ? "mesa" : "mesas"}
                    </span>
                  </h2>
                  <Button variant="ghost" className="h-10" onClick={() => newTable(group.id)}>
                    <Plus className="size-4" aria-hidden /> Adicionar
                  </Button>
                </header>
                <div className="overflow-x-auto p-4">
                  {/* planta: cada mesa ocupa a célula (pos_x, pos_y) da grade do setor */}
                  <div
                    className="grid gap-3 rounded-xl bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:16px_16px] p-3"
                    style={{ gridTemplateColumns: `repeat(${cols}, ${CELL})`, gridTemplateRows: `repeat(${rows}, 6.5rem)` }}
                  >
                    {items.map((t) => (
                      <FloorTable key={t.id} table={t} onClick={() => setTarget({ mode: "edit", table: t })} />
                    ))}
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      )}

      <TableFormSheet target={target} sections={sections} onClose={() => setTarget(null)} />
      <SectionsDialog open={sectionsOpen} onOpenChange={setSectionsOpen} sections={sections} tables={tables} />
    </div>
  )
}

function FloorTable({ table, onClick }: { table: DiningTable; onClick: () => void }) {
  const s = TABLE_STATUS[table.status]
  const Icon = s.icon
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Editar mesa ${table.numero}, ${table.capacidade} lugares, ${s.label}${table.ativa ? "" : ", inativa"}`}
      style={{
        gridColumn: `${table.pos_x + 1} / span ${table.formato === "retangular" ? 2 : 1}`,
        gridRow: table.pos_y + 1,
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-1 border-2 p-2 text-center transition-[transform,box-shadow] outline-none hover:shadow-md focus-visible:ring-4 focus-visible:ring-ring/50 ativa:scale-[0.97]",
        table.formato === "redonda" ? "aspect-square justify-self-center rounded-full" : "rounded-xl",
        s.card,
        !table.ativa && "border-dashed opacity-50"
      )}
    >
      <span className="text-2xl leading-none font-extrabold">{String(table.numero).padStart(2, "0")}</span>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="size-3" aria-hidden />
        {table.capacidade}
      </span>
      <span className="inline-flex items-center gap-1 text-[0.65rem] font-bold uppercase">
        <Icon className="size-3" aria-hidden />
        {table.ativa ? s.label : "Inativa"}
      </span>
    </button>
  )
}
