"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, ListChecks, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/forms/field"
import { ConfirmDialog } from "@/components/feedback/confirm-dialog"
import { deleteModifierGroup, saveModifierGroup } from "@/features/menu/actions"
import { modifierGroupSchema, type ModifierGroupInput } from "@/schemas/menu"
import { toMoneyInput } from "@/lib/image"
import { formatCurrency } from "@/lib/format"
import type { ModifierGroup, ProductGroupLink } from "@/types/domain"

const EMPTY_GROUP: ModifierGroupInput = {
  nome: "",
  min_escolhas: 0,
  max_escolhas: 1,
  opcoes: [{ nome: "", acrescimo: "0,00", ativa: true }],
}

export function GroupsDialog({
  open,
  onOpenChange,
  groups,
  links,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: ModifierGroup[]
  links: ProductGroupLink[]
}) {
  const [editing, setEditing] = useState<ModifierGroupInput | null>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setEditing(null)
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-h-[90dvh] grid-cols-1 gap-5 overflow-y-auto p-6 sm:max-w-xl">
        {editing ? (
          <GroupEditor initial={editing} onDone={() => setEditing(null)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Opções de personalização</DialogTitle>
              <DialogDescription>
                Grupos reutilizáveis, como &quot;Ponto da carne&quot; ou &quot;Adicionais&quot;. Ligue os grupos aos produtos no cadastro de cada produto.
              </DialogDescription>
            </DialogHeader>
            {groups.length === 0 ? (
              <div className="grid place-items-center gap-2 rounded-xl border border-dashed p-8 text-center">
                <ListChecks className="size-8 text-muted-foreground" aria-hidden />
                <p className="font-semibold">Nenhum grupo de opções.</p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-2">
                {groups.map((g) => {
                  const used = links.filter((l) => l.grupo_id === g.id).length
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            id: g.id,
                            nome: g.nome,
                            min_escolhas: g.min_escolhas,
                            max_escolhas: g.max_escolhas,
                            opcoes: g.opcoes.map((o) => ({ id: o.id, nome: o.nome, acrescimo: toMoneyInput(o.acrescimo), ativa: o.ativa })),
                          })
                        }
                        className="flex w-full items-center gap-3 rounded-xl border p-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">
                            {g.nome}
                            <span className="ml-2 text-xs font-medium text-muted-foreground">
                              {g.min_escolhas > 0 ? "Obrigatório" : "Opcional"} · escolher até {g.max_escolhas}
                            </span>
                          </span>
                          <span className="block truncate text-sm text-muted-foreground">
                            {g.opcoes.map((o) => (o.acrescimo > 0 ? `${o.nome} (+${formatCurrency(o.acrescimo)})` : o.nome)).join(", ")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Usado em {used} {used === 1 ? "produto" : "produtos"}
                          </span>
                        </span>
                        <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <Button className="h-12 font-semibold" onClick={() => setEditing(EMPTY_GROUP)}>
              <Plus className="size-4" aria-hidden /> Novo grupo de opções
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function GroupEditor({ initial, onDone }: { initial: ModifierGroupInput; onDone: () => void }) {
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ModifierGroupInput>({ resolver: zodResolver(modifierGroupSchema) as never, defaultValues: initial })
  const { fields, append, remove } = useFieldArray({ control, name: "opcoes" })

  async function onSubmit(values: ModifierGroupInput) {
    const result = await saveModifierGroup(values)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(initial.id ? "Grupo atualizado." : "Grupo criado.")
    router.refresh()
    onDone()
  }

  return (
    <>
      <DialogHeader>
        <button type="button" onClick={onDone} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Grupos
        </button>
        <DialogTitle className="text-xl font-bold">{initial.id ? `Editar ${initial.nome}` : "Novo grupo de opções"}</DialogTitle>
        <DialogDescription>Ex.: Ponto da carne (obrigatório, escolher 1) ou Adicionais (opcional, até 4).</DialogDescription>
      </DialogHeader>

      <form id="group-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
        <Field id="grupo-nome" label="Nome do grupo" error={errors.nome?.message}>
          <Input id="grupo-nome" className="h-12" placeholder="Ex.: Ponto da carne" aria-invalid={!!errors.nome} {...register("nome")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="min" label="Mínimo de escolhas" hint="0 = opcional" error={errors.min_escolhas?.message}>
            <Input id="min" type="number" inputMode="numeric" className="h-12" {...register("min_escolhas")} />
          </Field>
          <Field id="max" label="Máximo de escolhas" error={errors.max_escolhas?.message}>
            <Input id="max" type="number" inputMode="numeric" className="h-12" {...register("max_escolhas")} />
          </Field>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-sm font-semibold">Opções</legend>
          {fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-[1fr_7rem_auto_auto] items-center gap-2">
              <Input
                className="h-11"
                placeholder="Nome (ex.: Bacon)"
                aria-label={`Nome da opção ${i + 1}`}
                aria-invalid={!!errors.opcoes?.[i]?.nome}
                {...register(`opcoes.${i}.nome`)}
              />
              <Input
                className="h-11"
                inputMode="decimal"
                placeholder="+ 0,00"
                aria-label={`Acréscimo da opção ${i + 1} em reais`}
                aria-invalid={!!errors.opcoes?.[i]?.acrescimo}
                {...register(`opcoes.${i}.acrescimo`)}
              />
              <Controller
                control={control}
                name={`opcoes.${i}.ativa`}
                render={({ field }) => (
                  <Switch checked={!!field.value} onCheckedChange={field.onChange} aria-label={`Opção ${i + 1} disponível`} />
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                className="size-10"
                onClick={() => remove(i)}
                disabled={fields.length === 1}
                aria-label={`Remover opção ${i + 1}`}
              >
                <X />
              </Button>
            </div>
          ))}
          {(errors.opcoes?.message || errors.opcoes?.root?.message) && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {errors.opcoes?.message ?? errors.opcoes?.root?.message}
            </p>
          )}
          {errors.opcoes?.some?.((o) => o?.nome || o?.acrescimo) && (
            <p role="alert" className="text-sm font-medium text-destructive">
              Confira o nome e o acréscimo de cada opção.
            </p>
          )}
          <Button type="button" variant="outline" className="h-11 w-fit" onClick={() => append({ nome: "", acrescimo: "0,00", ativa: true })}>
            <Plus className="size-4" aria-hidden /> Adicionar opção
          </Button>
          <p className="text-xs text-muted-foreground">O interruptor pausa uma opção que acabou (ex.: sem bacon hoje).</p>
        </fieldset>
      </form>

      <div className="flex gap-2 border-t pt-4">
        {initial.id && (
          <Button type="button" variant="destructive" className="h-12" onClick={() => setConfirmDelete(true)} aria-label="Excluir grupo">
            <Trash2 className="size-4" aria-hidden />
          </Button>
        )}
        <Button type="button" variant="outline" className="h-12 flex-1" onClick={onDone}>
          Voltar
        </Button>
        <Button type="submit" form="group-form" className="h-12 flex-[2] font-semibold" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Salvar grupo
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Tem certeza que deseja excluir o grupo ${initial.nome}?`}
        description="Ele será removido de todos os produtos. Pedidos antigos não são afetados."
        onConfirm={async () => {
          if (!initial.id) return
          const result = await deleteModifierGroup(initial.id)
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          toast.success("Grupo excluído.")
          setConfirmDelete(false)
          router.refresh()
          onDone()
        }}
      />
    </>
  )
}
