"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/forms/field"
import { moveStock } from "@/features/inventory/actions"
import { formatQty } from "@/features/inventory/format"
import { movementSchema, type MovementInput, type TipoMovimento } from "@/schemas/inventory"
import { formatCurrency } from "@/lib/format"
import type { StockItem } from "@/services/inventory"

export type MovementTarget = { item: StockItem; tipo: TipoMovimento }

const COPY: Record<TipoMovimento, { title: string; description: string; qty: string; submit: string; done: string }> = {
  entrada: {
    title: "Entrada de",
    description: "Mercadoria que chegou. O custo informado atualiza o custo médio do item.",
    qty: "Quantidade recebida",
    submit: "Registrar entrada",
    done: "Entrada registrada.",
  },
  saida: {
    title: "Saída de",
    description: "Perdas, vencimentos, quebras ou uso fora dos pedidos.",
    qty: "Quantidade que saiu",
    submit: "Registrar saída",
    done: "Saída registrada.",
  },
  ajuste: {
    title: "Contagem de",
    description: "Conte o que existe de fato. O sistema registra a diferença em relação ao saldo atual.",
    qty: "Quantidade contada",
    submit: "Salvar contagem",
    done: "Contagem salva.",
  },
}

const MOTIVOS_SAIDA = ["Vencido", "Estragou", "Quebra", "Uso interno", "Doação"]

function parse(v: unknown) {
  if (typeof v !== "string" || !v.trim()) return null
  const n = Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v)
  return Number.isFinite(n) ? n : null
}

export function MovementDialog({ target, onClose }: { target: MovementTarget | null; onClose: () => void }) {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MovementInput>({ resolver: zodResolver(movementSchema) as never })
  const typed = parse(useWatch({ control, name: "quantidade" }))

  useEffect(() => {
    if (target) reset({ item_id: target.item.id, tipo: target.tipo, quantidade: "", custo_unitario: "", motivo: "" })
  }, [target, reset])

  if (!target) return <Dialog open={false} />
  const { item, tipo } = target
  const copy = COPY[tipo]

  let preview: number | null = null
  if (typed !== null) preview = tipo === "entrada" ? item.quantidade + typed : tipo === "saida" ? item.quantidade - typed : typed
  const diff = tipo === "ajuste" && typed !== null ? typed - item.quantidade : null

  async function onSubmit(values: MovementInput) {
    const result = await moveStock(values)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(copy.done)
    onClose()
    router.refresh()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] grid-cols-1 gap-5 overflow-y-auto p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {copy.title} {item.nome}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <p className="rounded-xl bg-muted px-4 py-3 text-sm">
          Saldo atual: <strong className="tabular-nums">{formatQty(item.quantidade, item.unidade)}</strong>
          {preview !== null && (
            <>
              {" "}
              → depois: <strong className={preview < 0 ? "text-destructive" : undefined}>{formatQty(preview, item.unidade)}</strong>
            </>
          )}
          {diff !== null && diff !== 0 && (
            <span className="block text-muted-foreground">
              Diferença de {diff > 0 ? "+" : ""}
              {formatQty(diff, item.unidade)} ({formatCurrency(Math.abs(diff) * item.custo_unitario)} a preço de custo)
            </span>
          )}
        </p>

        <form id="movement-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
          <div className={tipo === "entrada" ? "grid grid-cols-2 gap-3" : "grid"}>
            <Field id="mov-qtd" label={`${copy.qty} (${item.unidade})`} error={errors.quantidade?.message}>
              <Input id="mov-qtd" inputMode="decimal" autoFocus placeholder="0" className="h-12 text-lg font-bold" aria-invalid={!!errors.quantidade} {...register("quantidade")} />
            </Field>
            {tipo === "entrada" && (
              <Field id="mov-custo" label={`Custo por ${item.unidade} (R$)`} hint={`Atual: ${formatCurrency(item.custo_unitario)}`} error={errors.custo_unitario?.message}>
                <Input id="mov-custo" inputMode="decimal" placeholder="0,00" className="h-12" aria-invalid={!!errors.custo_unitario} {...register("custo_unitario")} />
              </Field>
            )}
          </div>
          <Field id="mov-motivo" label={tipo === "saida" ? "Motivo" : "Observação"} hint={tipo === "saida" ? undefined : "Opcional. Ex.: nota fiscal 1234."} error={errors.motivo?.message}>
            <Input id="mov-motivo" className="h-12" aria-invalid={!!errors.motivo} {...register("motivo")} />
          </Field>
          {tipo === "saida" && (
            <div className="flex flex-wrap gap-2" aria-label="Motivos comuns">
              {MOTIVOS_SAIDA.map((m) => (
                <Button key={m} type="button" variant="outline" size="sm" className="h-9 rounded-full" onClick={() => setValue("motivo", m, { shouldValidate: true })}>
                  {m}
                </Button>
              ))}
            </div>
          )}
        </form>

        <div className="flex gap-2 border-t pt-4">
          <Button type="button" variant="outline" className="h-12 flex-1" onClick={onClose}>
            Voltar
          </Button>
          <Button type="submit" form="movement-form" className="h-12 flex-[2] font-semibold" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {copy.submit}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
