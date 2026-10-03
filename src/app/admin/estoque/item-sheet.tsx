"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Field } from "@/components/forms/field"
import { NativeSelect } from "@/components/forms/native-select"
import { ConfirmDialog } from "@/components/feedback/confirm-dialog"
import { deleteStockItem, saveStockItem } from "@/features/inventory/actions"
import { toQtyInput } from "@/features/inventory/format"
import { stockItemSchema, UNIDADES, UNIDADE_LABEL, type StockItemInput } from "@/schemas/inventory"
import { toMoneyInput } from "@/lib/image"
import type { StockItem } from "@/services/inventory"

export type ItemTarget = { mode: "create" } | { mode: "edit"; item: StockItem }

export function ItemSheet({ target, suppliers, onClose }: { target: ItemTarget | null; suppliers: { id: string; nome: string; ativo: boolean }[]; onClose: () => void }) {
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const editing = target?.mode === "edit" ? target.item : null

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StockItemInput>({ resolver: zodResolver(stockItemSchema) as never })

  useEffect(() => {
    if (!target) return
    if (target.mode === "create") {
      reset({ nome: "", unidade: "kg", quantidade_minima: "", custo_unitario: "", fornecedor_id: null, ativo: true, quantidade_inicial: "" })
    } else {
      const i = target.item
      reset({
        id: i.id,
        nome: i.nome,
        unidade: i.unidade,
        quantidade_minima: toQtyInput(i.quantidade_minima),
        custo_unitario: toMoneyInput(i.custo_unitario),
        fornecedor_id: i.fornecedor_id,
        ativo: i.ativo,
      })
    }
  }, [target, reset])

  async function onSubmit(values: StockItemInput) {
    const result = await saveStockItem(values)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(editing ? "Item atualizado." : "Item cadastrado.")
    onClose()
    router.refresh()
  }

  async function onDelete() {
    if (!editing) return
    const result = await deleteStockItem(editing.id)
    setConfirmDelete(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Item excluído.")
    onClose()
    router.refresh()
  }

  const visibleSuppliers = suppliers.filter((s) => s.ativo || s.id === editing?.fornecedor_id)

  return (
    <>
      <Sheet open={!!target} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          <SheetHeader className="border-b p-5">
            <SheetTitle className="text-xl font-extrabold">{editing ? `Editar ${editing.nome}` : "Novo item de estoque"}</SheetTitle>
            <SheetDescription>
              {editing ? "Para mudar a quantidade, use Entrada, Saída ou Contagem na lista." : "Ingredientes, bebidas e embalagens que o restaurante compra."}
            </SheetDescription>
          </SheetHeader>

          <form id="item-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 p-5">
            <Field id="nome" label="Nome" error={errors.nome?.message}>
              <Input id="nome" className="h-12 text-base" placeholder="Ex.: Queijo mussarela" aria-invalid={!!errors.nome} {...register("nome")} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field id="unidade" label="Unidade" error={errors.unidade?.message}>
                <NativeSelect id="unidade" {...register("unidade")}>
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {UNIDADE_LABEL[u]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="custo_unitario" label="Custo por unidade (R$)" error={errors.custo_unitario?.message}>
                <Input id="custo_unitario" inputMode="decimal" placeholder="0,00" className="h-12" aria-invalid={!!errors.custo_unitario} {...register("custo_unitario")} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {!editing && (
                <Field id="quantidade_inicial" label="Quantidade atual" hint="Opcional." error={errors.quantidade_inicial?.message}>
                  <Input id="quantidade_inicial" inputMode="decimal" placeholder="0" className="h-12" aria-invalid={!!errors.quantidade_inicial} {...register("quantidade_inicial")} />
                </Field>
              )}
              <Field id="quantidade_minima" label="Estoque mínimo" hint="Abaixo disso, você recebe um alerta." error={errors.quantidade_minima?.message}>
                <Input id="quantidade_minima" inputMode="decimal" placeholder="0" className="h-12" aria-invalid={!!errors.quantidade_minima} {...register("quantidade_minima")} />
              </Field>
            </div>

            <Controller
              control={control}
              name="fornecedor_id"
              render={({ field }) => (
                <Field id="fornecedor_id" label="Fornecedor" hint="Cadastre fornecedores no Financeiro.">
                  <NativeSelect id="fornecedor_id" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)}>
                    <option value="">Nenhum</option>
                    {visibleSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
            />

            {editing && (
              <Controller
                control={control}
                name="ativo"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-3 rounded-xl border p-4">
                    <span>
                      <span className="block font-semibold">Item ativo</span>
                      <span className="text-sm text-muted-foreground">Itens desativados saem da lista e da ficha técnica, mas o histórico fica.</span>
                    </span>
                    <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />
            )}
          </form>

          <SheetFooter className="mt-auto flex-row gap-2 border-t p-4">
            {editing && (
              <Button type="button" variant="destructive" className="h-12" onClick={() => setConfirmDelete(true)} aria-label="Excluir item">
                <Trash2 className="size-4" aria-hidden />
              </Button>
            )}
            <Button type="button" variant="outline" className="h-12 flex-1" onClick={onClose}>
              Voltar
            </Button>
            <Button type="submit" form="item-form" className="h-12 flex-[2] font-semibold" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Salvar item
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Tem certeza que deseja excluir este item?"
        description="Só é possível excluir itens que nunca tiveram movimentação. Nos demais casos, desative o item."
        onConfirm={onDelete}
      />
    </>
  )
}
