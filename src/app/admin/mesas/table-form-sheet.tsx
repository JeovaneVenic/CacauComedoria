"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm, useWatch, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Field } from "@/components/forms/field"
import { NativeSelect } from "@/components/forms/native-select"
import { ConfirmDialog } from "@/components/feedback/confirm-dialog"
import { TableStatusBadge } from "@/features/tables/components/table-status-badge"
import { TABLE_STATUS, TABLE_STATUS_ORDER } from "@/features/tables/status"
import { deleteTable, saveTable, setTableStatus } from "@/features/tables/actions"
import { GRID_MAX, tableSchema, type TableInput } from "@/schemas/tables"
import { tableLabel } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { DiningTable, Section, TableStatus } from "@/types/domain"

export type TableFormTarget =
  | { mode: "create"; defaults: Omit<TableInput, "id"> }
  | { mode: "edit"; table: DiningTable }

const SHAPES = [
  { value: "quadrada", label: "Quadrada" },
  { value: "redonda", label: "Redonda" },
  { value: "retangular", label: "Retangular" },
] as const

export function TableFormSheet({
  target,
  sections,
  onClose,
}: {
  target: TableFormTarget | null
  sections: Section[]
  onClose: () => void
}) {
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [statusPending, startStatus] = useTransition()
  const editing = target?.mode === "edit" ? target.table : null

  const form = useForm<TableInput>({ resolver: zodResolver(tableSchema) as never })
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = form

  useEffect(() => {
    if (!target) return
    if (target.mode === "create") reset(target.defaults)
    else {
      const t = target.table
      reset({
        id: t.id,
        numero: t.numero,
        capacidade: t.capacidade,
        setor_id: t.setor_id,
        formato: t.formato,
        pos_x: t.pos_x,
        pos_y: t.pos_y,
        ativa: t.ativa,
      })
    }
  }, [target, reset])

  const posX = Number(useWatch({ control, name: "pos_x" }) ?? 0)
  const posY = Number(useWatch({ control, name: "pos_y" }) ?? 0)
  const move = (dx: number, dy: number) => {
    setValue("pos_x", Math.min(GRID_MAX, Math.max(0, posX + dx)), { shouldDirty: true })
    setValue("pos_y", Math.min(GRID_MAX, Math.max(0, posY + dy)), { shouldDirty: true })
  }

  async function onSubmit(values: TableInput) {
    const result = await saveTable({ ...values, setor_id: values.setor_id || null })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(editing ? "Mesa atualizada." : `${tableLabel(values.numero)} criada.`)
    onClose()
    router.refresh()
  }

  function changeStatus(status: TableStatus) {
    if (!editing) return
    startStatus(async () => {
      const result = await setTableStatus(editing.id, status)
      if (!result.ok) toast.error(result.error)
      else {
        toast.success(`Estado alterado para "${TABLE_STATUS[status].label}".`)
        router.refresh()
      }
    })
  }

  async function onDelete() {
    if (!editing) return
    const result = await deleteTable(editing.id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`${tableLabel(editing.numero)} excluída.`)
    setConfirmDelete(false)
    onClose()
    router.refresh()
  }

  return (
    <>
      <Sheet open={!!target} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b p-5">
            <SheetTitle className="text-xl font-extrabold">{editing ? `Editar ${tableLabel(editing.numero)}` : "Nova mesa"}</SheetTitle>
            <SheetDescription>Número, lugares, setor e posição na planta.</SheetDescription>
          </SheetHeader>

          <form id="table-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field id="numero" label="Número" error={errors.numero?.message}>
                <Input id="numero" type="numero" inputMode="numeric" className="h-12 text-lg font-bold" aria-invalid={!!errors.numero} {...register("numero")} />
              </Field>
              <Field id="capacidade" label="Lugares" error={errors.capacidade?.message}>
                <Input id="capacidade" type="numero" inputMode="numeric" className="h-12 text-lg" aria-invalid={!!errors.capacidade} {...register("capacidade")} />
              </Field>
            </div>

            <Field id="setor_id" label="Setor">
              <Controller
                control={control}
                name="setor_id"
                render={({ field }) => (
                  <NativeSelect id="setor_id" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)}>
                    <option value="">Sem setor</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              />
            </Field>

            <fieldset className="grid gap-1.5">
              <legend className="mb-1.5 text-sm font-semibold">Formato</legend>
              <Controller
                control={control}
                name="formato"
                render={({ field }) => (
                  <div role="radiogroup" className="grid grid-cols-3 gap-2">
                    {SHAPES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        role="radio"
                        aria-checked={field.value === s.value}
                        onClick={() => field.onChange(s.value)}
                        className={cn(
                          "h-12 rounded-lg border-2 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          field.value === s.value ? "border-primary bg-primary/10 text-primary" : "border-border"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              />
            </fieldset>

            <fieldset className="grid gap-2">
              <legend className="mb-1.5 text-sm font-semibold">Posição na planta</legend>
              <div className="flex items-center gap-4">
                <div className="grid grid-cols-3 gap-1" aria-label="Mover mesa">
                  <span />
                  <Button type="button" variant="outline" size="icon-lg" className="size-11" onClick={() => move(0, -1)} aria-label="Mover para cima">
                    <ArrowUp />
                  </Button>
                  <span />
                  <Button type="button" variant="outline" size="icon-lg" className="size-11" onClick={() => move(-1, 0)} aria-label="Mover para a esquerda">
                    <ArrowLeft />
                  </Button>
                  <span className="grid size-11 place-items-center rounded-lg bg-muted text-xs font-bold">
                    {posX + 1},{posY + 1}
                  </span>
                  <Button type="button" variant="outline" size="icon-lg" className="size-11" onClick={() => move(1, 0)} aria-label="Mover para a direita">
                    <ArrowRight />
                  </Button>
                  <span />
                  <Button type="button" variant="outline" size="icon-lg" className="size-11" onClick={() => move(0, 1)} aria-label="Mover para baixo">
                    <ArrowDown />
                  </Button>
                  <span />
                </div>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Coluna {posX + 1}, linha {posY + 1}
                </p>
              </div>
            </fieldset>

            <Controller
              control={control}
              name="ativa"
              render={({ field }) => (
                <label className="flex items-center justify-between gap-4 rounded-xl border p-4">
                  <span>
                    <span className="block font-semibold">Mesa ativa</span>
                    <span className="text-sm text-muted-foreground">Inativas não aparecem para os garçons.</span>
                  </span>
                  <Switch checked={!!field.value} onCheckedChange={field.onChange} aria-label="Mesa ativa" />
                </label>
              )}
            />
          </form>

          {editing && (
            <section aria-labelledby="estado-manual" className="grid gap-3 border-t p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 id="estado-manual" className="font-semibold">
                  Estado atual
                </h3>
                <TableStatusBadge status={editing.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                O estado muda sozinho com os pedidos. Use o ajuste manual só para corrigir uma mesa travada.
              </p>
              <NativeSelect
                aria-label="Alterar estado manualmente"
                value={editing.status}
                disabled={statusPending}
                onChange={(e) => changeStatus(e.target.value as TableStatus)}
              >
                {TABLE_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {TABLE_STATUS[s].label}
                  </option>
                ))}
              </NativeSelect>
            </section>
          )}

          <SheetFooter className="mt-auto flex-row gap-2 border-t p-4">
            {editing && (
              <Button type="button" variant="destructive" className="h-12" onClick={() => setConfirmDelete(true)} aria-label="Excluir mesa">
                <Trash2 className="size-4" aria-hidden />
              </Button>
            )}
            <Button type="button" variant="outline" className="h-12 flex-1" onClick={onClose}>
              Voltar
            </Button>
            <Button type="submit" form="table-form" className="h-12 flex-[2] font-semibold" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={editing ? `Tem certeza que deseja excluir a ${tableLabel(editing.numero)}?` : "Excluir mesa?"}
        description="Mesas com histórico de pedidos não podem ser excluídas — desative-as."
        onConfirm={onDelete}
      />
    </>
  )
}
