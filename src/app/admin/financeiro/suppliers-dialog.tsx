"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Loader2, Pencil, Plus, Truck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/forms/field"
import { saveSupplier, setSupplierActive } from "@/features/finance/actions"
import { supplierSchema, type SupplierInput } from "@/schemas/finance"
import { cn } from "@/lib/utils"
import type { Supplier } from "@/services/finance"

const EMPTY: SupplierInput = { nome: "", documento: "", telefone: "", email: "", observacao: "" }

export function SuppliersDialog({ open, onOpenChange, suppliers }: { open: boolean; onOpenChange: (o: boolean) => void; suppliers: Supplier[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<SupplierInput | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function toggle(s: Supplier, ativo: boolean) {
    setBusyId(s.id)
    const result = await setSupplierActive(s.id, ativo)
    setBusyId(null)
    if (!result.ok) toast.error(result.error)
    else router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setEditing(null)
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-h-[90dvh] grid-cols-1 gap-5 overflow-y-auto p-6 sm:max-w-lg">
        {editing ? (
          <SupplierForm
            initial={editing}
            onDone={() => {
              setEditing(null)
              router.refresh()
            }}
            onBack={() => setEditing(null)}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Fornecedores</DialogTitle>
              <DialogDescription>Quem abastece o restaurante. Fornecedores desativados somem da lista de despesas.</DialogDescription>
            </DialogHeader>
            {suppliers.length === 0 ? (
              <div className="grid place-items-center gap-2 rounded-xl border border-dashed p-8 text-center">
                <Truck className="size-8 text-muted-foreground" aria-hidden />
                <p className="font-semibold">Nenhum fornecedor cadastrado.</p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-2">
                {suppliers.map((s) => (
                  <li key={s.id} className={cn("flex items-center gap-3 rounded-xl border p-3", !s.ativo && "bg-muted/50")}>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate font-semibold", !s.ativo && "text-muted-foreground")}>{s.nome}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[s.documento, s.telefone, s.email].filter(Boolean).join(" · ") || "Sem contato cadastrado"}
                      </span>
                    </span>
                    <Switch checked={s.ativo} disabled={busyId === s.id} onCheckedChange={(v) => toggle(s, v)} aria-label={`${s.nome} ativo`} />
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      className="size-10"
                      onClick={() =>
                        setEditing({
                          id: s.id,
                          nome: s.nome,
                          documento: s.documento ?? "",
                          telefone: s.telefone ?? "",
                          email: s.email ?? "",
                          observacao: s.observacao ?? "",
                        })
                      }
                      aria-label={`Editar ${s.nome}`}
                    >
                      <Pencil />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button className="h-12 font-semibold" onClick={() => setEditing(EMPTY)}>
              <Plus className="size-4" aria-hidden /> Novo fornecedor
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SupplierForm({ initial, onDone, onBack }: { initial: SupplierInput; onDone: () => void; onBack: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SupplierInput>({ resolver: zodResolver(supplierSchema), defaultValues: initial })

  async function onSubmit(values: SupplierInput) {
    const result = await saveSupplier(values)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(initial.id ? "Fornecedor atualizado." : "Fornecedor cadastrado.")
    onDone()
  }

  return (
    <>
      <DialogHeader>
        <button type="button" onClick={onBack} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Fornecedores
        </button>
        <DialogTitle className="text-xl font-bold">{initial.id ? `Editar ${initial.nome}` : "Novo fornecedor"}</DialogTitle>
      </DialogHeader>
      <form id="supplier-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
        <Field id="f-nome" label="Nome" error={errors.nome?.message}>
          <Input id="f-nome" className="h-12" placeholder="Ex.: Hortifruti Ilhéus" aria-invalid={!!errors.nome} {...register("nome")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="f-doc" label="CNPJ/CPF" error={errors.documento?.message}>
            <Input id="f-doc" className="h-12" inputMode="numeric" {...register("documento")} />
          </Field>
          <Field id="f-tel" label="Telefone" error={errors.telefone?.message}>
            <Input id="f-tel" className="h-12" type="tel" inputMode="tel" {...register("telefone")} />
          </Field>
        </div>
        <Field id="f-email" label="E-mail" error={errors.email?.message}>
          <Input id="f-email" className="h-12" type="email" {...register("email")} />
        </Field>
        <Field id="f-obs" label="Observação" error={errors.observacao?.message}>
          <Input id="f-obs" className="h-12" placeholder="Ex.: entrega às terças" {...register("observacao")} />
        </Field>
      </form>
      <div className="flex gap-2 border-t pt-4">
        <Button type="button" variant="outline" className="h-12 flex-1" onClick={onBack}>
          Voltar
        </Button>
        <Button type="submit" form="supplier-form" className="h-12 flex-[2] font-semibold" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Salvar fornecedor
        </Button>
      </div>
    </>
  )
}
