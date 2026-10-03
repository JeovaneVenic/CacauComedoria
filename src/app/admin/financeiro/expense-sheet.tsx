"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { FileText, Loader2, Paperclip, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Field } from "@/components/forms/field"
import { NativeSelect } from "@/components/forms/native-select"
import { ConfirmDialog } from "@/components/feedback/confirm-dialog"
import { deleteExpense, getReceiptUrl, saveExpense } from "@/features/finance/actions"
import { expenseSchema, type ExpenseInput } from "@/schemas/finance"
import { FORMAS_PAGAMENTO, FORMA_LABEL } from "@/schemas/common"
import { createClient } from "@/lib/supabase/client"
import { compressImage, toMoneyInput } from "@/lib/image"
import { friendlyError } from "@/lib/errors"
import { formatCurrency } from "@/lib/format"
import type { Expense, ExpenseCategory, ExpenseType, Supplier } from "@/services/finance"

export type ExpenseTarget = { mode: "create" } | { mode: "edit"; expense: Expense }

const GROUP_LABEL: Record<ExpenseType, string> = { fixa: "Fixas", variavel: "Variáveis", operacional: "Operacionais" }
const MAX_FILE = 10 * 1024 * 1024

interface ExpenseSheetProps {
  target: ExpenseTarget | null
  restaurantId: string
  today: string
  categories: ExpenseCategory[]
  suppliers: Supplier[]
  onClose: () => void
  onManageSuppliers: () => void
}

export function ExpenseSheet({ target, restaurantId, today, categories, suppliers, onClose, onManageSuppliers }: ExpenseSheetProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const editing = target?.mode === "edit" ? target.expense : null

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseInput>({ resolver: zodResolver(expenseSchema) as never })
  const receipt = useWatch({ control, name: "comprovante_caminho" })

  useEffect(() => {
    if (!target) return
    if (target.mode === "create") {
      reset({
        descricao: "",
        categoria_id: "",
        valor: "",
        data: today,
        forma_pagamento: "pix",
        fornecedor_id: null,
        observacao: "",
        comprovante_caminho: null,
      })
    } else {
      const e = target.expense
      reset({
        id: e.id,
        descricao: e.descricao,
        categoria_id: e.categoria_id,
        valor: toMoneyInput(e.valor),
        data: e.data,
        forma_pagamento: e.forma_pagamento,
        fornecedor_id: e.fornecedor_id,
        observacao: e.observacao ?? "",
        comprovante_caminho: e.comprovante_caminho,
      })
    }
  }, [target, today, reset])

  async function upload(file: File) {
    const isPdf = file.type === "application/pdf"
    if (!isPdf && !file.type.startsWith("image/")) {
      toast.error("Envie uma foto ou um PDF do comprovante.")
      return
    }
    if (file.size > MAX_FILE) {
      toast.error("O arquivo deve ter no máximo 10 MB.")
      return
    }
    setUploading(true)
    try {
      // fotos são reduzidas antes do envio; PDF vai como está
      const body = isPdf ? file : await compressImage(file, 1600, 0.85)
      const path = `${restaurantId}/${new Date().getFullYear()}/${crypto.randomUUID()}.${isPdf ? "pdf" : "webp"}`
      const { error } = await createClient()
        .storage.from("comprovantes")
        .upload(path, body, { contentType: isPdf ? "application/pdf" : "image/webp" })
      if (error) {
        toast.error(friendlyError(error, "Não foi possível enviar o comprovante."))
        return
      }
      setValue("comprovante_caminho", path, { shouldDirty: true })
      toast.success("Comprovante anexado.")
    } catch {
      toast.error("Não foi possível ler este arquivo.")
    } finally {
      setUploading(false)
    }
  }

  async function openReceipt() {
    if (!receipt) return
    const result = await getReceiptUrl(receipt)
    if (result.ok && result.data) window.open(result.data, "_blank", "noopener")
    else toast.error(result.ok ? "Não foi possível abrir o comprovante." : result.error)
  }

  async function onSubmit(values: ExpenseInput) {
    const result = await saveExpense({ ...values, fornecedor_id: values.fornecedor_id || null })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(editing ? "Despesa atualizada." : "Despesa lançada.")
    onClose()
    router.refresh()
  }

  async function onDelete() {
    if (!editing) return
    const result = await deleteExpense(editing.id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Despesa excluída.")
    setConfirmDelete(false)
    onClose()
    router.refresh()
  }

  const activeSuppliers = suppliers.filter((s) => s.ativo || s.id === editing?.fornecedor_id)

  return (
    <>
      <Sheet open={!!target} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          <SheetHeader className="border-b p-5">
            <SheetTitle className="text-xl font-extrabold">{editing ? "Editar despesa" : "Nova despesa"}</SheetTitle>
            <SheetDescription>
              {editing?.autor ? `Lançada por ${editing.autor.nome}.` : "Registre contas, compras e pagamentos do restaurante."}
            </SheetDescription>
          </SheetHeader>

          <form id="expense-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 p-5">
            <Field id="descricao" label="Descrição" error={errors.descricao?.message}>
              <Input id="descricao" className="h-12 text-base" placeholder="Ex.: Conta de energia de setembro" aria-invalid={!!errors.descricao} {...register("descricao")} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field id="valor" label="Valor (R$)" error={errors.valor?.message}>
                <Input id="valor" inputMode="decimal" placeholder="0,00" className="h-12 text-lg font-bold" aria-invalid={!!errors.valor} {...register("valor")} />
              </Field>
              <Field id="data" label="Data" error={errors.data?.message}>
                <Input id="data" type="date" max={today} className="h-12" aria-invalid={!!errors.data} {...register("data")} />
              </Field>
            </div>

            <Field id="categoria_id" label="Categoria" error={errors.categoria_id?.message}>
              <NativeSelect id="categoria_id" aria-invalid={!!errors.categoria_id} {...register("categoria_id")}>
                <option value="">Escolha a categoria</option>
                {(Object.keys(GROUP_LABEL) as ExpenseType[]).map((t) => (
                  <optgroup key={t} label={GROUP_LABEL[t]}>
                    {categories
                      .filter((c) => c.tipo === t)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </NativeSelect>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field id="forma_pagamento" label="Forma de pagamento" error={errors.forma_pagamento?.message}>
                <NativeSelect id="forma_pagamento" {...register("forma_pagamento")}>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <option key={f} value={f}>
                      {FORMA_LABEL[f]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Controller
                control={control}
                name="fornecedor_id"
                render={({ field }) => (
                  <Field id="fornecedor_id" label="Fornecedor">
                    <NativeSelect
                      id="fornecedor_id"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        if (e.target.value === "__novo") {
                          onManageSuppliers()
                          return
                        }
                        field.onChange(e.target.value || null)
                      }}
                    >
                      <option value="">Nenhum</option>
                      {activeSuppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                      <option value="__novo">+ Cadastrar fornecedor</option>
                    </NativeSelect>
                  </Field>
                )}
              />
            </div>

            <Field id="observacao" label="Observação" hint="Opcional." error={errors.observacao?.message}>
              <Textarea id="observacao" rows={2} placeholder="Ex.: nota fiscal 1234, vencimento dia 10" {...register("observacao")} />
            </Field>

            <div className="grid gap-2">
              <span className="text-sm font-semibold">Comprovante</span>
              {receipt ? (
                <div className="flex items-center gap-2 rounded-xl border p-3">
                  <FileText className="size-5 text-muted-foreground" aria-hidden />
                  <button type="button" onClick={openReceipt} className="flex-1 truncate text-left text-sm font-semibold text-primary underline-offset-4 hover:underline">
                    Abrir comprovante anexado
                  </button>
                  <Button type="button" variant="ghost" size="icon-lg" className="size-9" onClick={() => setValue("comprovante_caminho", null, { shouldDirty: true })} aria-label="Remover comprovante">
                    <X />
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="h-12 justify-start" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="animate-spin" /> : <Paperclip className="size-4" aria-hidden />}
                  {uploading ? "Enviando…" : "Anexar foto ou PDF"}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Guardado em pasta privada: só a gestão consegue abrir.</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className="sr-only"
                tabIndex={-1}
                aria-label="Arquivo do comprovante"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) upload(file)
                  e.target.value = ""
                }}
              />
            </div>
          </form>

          <SheetFooter className="mt-auto flex-row gap-2 border-t p-4">
            {editing && (
              <Button type="button" variant="destructive" className="h-12" onClick={() => setConfirmDelete(true)} aria-label="Excluir despesa">
                <Trash2 className="size-4" aria-hidden />
              </Button>
            )}
            <Button type="button" variant="outline" className="h-12 flex-1" onClick={onClose}>
              Voltar
            </Button>
            <Button type="submit" form="expense-form" className="h-12 flex-[2] font-semibold" disabled={isSubmitting || uploading}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Tem certeza que deseja excluir esta despesa?"
        description={editing ? `${editing.descricao} · ${formatCurrency(editing.valor)}. O comprovante anexado também será apagado.` : undefined}
        onConfirm={onDelete}
      />
    </>
  )
}
