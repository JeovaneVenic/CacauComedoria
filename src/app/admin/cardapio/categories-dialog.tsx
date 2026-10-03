"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/feedback/confirm-dialog"
import { deleteCategory, moveCategory, saveCategory } from "@/features/menu/actions"
import type { ActionResult } from "@/lib/action"
import type { Category, Product } from "@/types/domain"

export function CategoriesDialog({
  open,
  onOpenChange,
  categories,
  products,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  products: Product[]
}) {
  const router = useRouter()
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [busy, setBusy] = useState(false)
  const [toDelete, setToDelete] = useState<Category | null>(null)

  async function run(fn: () => Promise<ActionResult>, success?: string) {
    setBusy(true)
    const result = await fn()
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return false
    }
    if (success) toast.success(success)
    router.refresh()
    return true
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] grid-cols-1 gap-5 overflow-y-auto p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Categorias</DialogTitle>
            <DialogDescription>A ordem aqui é a ordem que o garçom vê no tablet.</DialogDescription>
          </DialogHeader>

          <ol className="grid grid-cols-1 gap-2">
            {categories.length === 0 && <li className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</li>}
            {categories.map((c, i) => {
              const count = products.filter((p) => p.categoria_id === c.id).length
              return (
                <li key={c.id} className="flex items-center gap-1 rounded-xl border p-2 pl-3">
                  {editingId === c.id ? (
                    <form
                      className="flex flex-1 items-center gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault()
                        if (await run(() => saveCategory({ id: c.id, nome: editName, ativa: c.ativa }), "Categoria renomeada.")) setEditingId(null)
                      }}
                    >
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-11" aria-label="Nome da categoria" autoFocus />
                      <Button type="submit" size="icon-lg" className="size-11" disabled={busy} aria-label="Salvar nome">
                        <Check />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-lg" className="size-11" onClick={() => setEditingId(null)} aria-label="Cancelar">
                        <X />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{c.nome}</span>
                        <span className="text-xs text-muted-foreground">
                          {count} {count === 1 ? "produto" : "produtos"}
                          {!c.ativa && " · oculta para o garçom"}
                        </span>
                      </span>
                      <Switch
                        checked={c.ativa}
                        disabled={busy}
                        onCheckedChange={(v) => run(() => saveCategory({ id: c.id, nome: c.nome, ativa: v }))}
                        aria-label={`${c.nome} visível para o garçom`}
                      />
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className="size-10"
                        disabled={busy || i === 0}
                        onClick={() => run(() => moveCategory(c.id, "up"))}
                        aria-label={`Subir ${c.nome}`}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className="size-10"
                        disabled={busy || i === categories.length - 1}
                        onClick={() => run(() => moveCategory(c.id, "down"))}
                        aria-label={`Descer ${c.nome}`}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className="size-10"
                        onClick={() => {
                          setEditingId(c.id)
                          setEditName(c.nome)
                        }}
                        aria-label={`Renomear ${c.nome}`}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className="size-10 text-destructive"
                        onClick={() => setToDelete(c)}
                        aria-label={`Excluir ${c.nome}`}
                      >
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </li>
              )
            })}
          </ol>

          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              if (await run(() => saveCategory({ nome: newName, ativa: true }), "Categoria criada.")) setNewName("")
            }}
          >
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nova categoria (ex.: Combos)" className="h-12" aria-label="Nome da nova categoria" />
            <Button type="submit" className="h-12" disabled={busy || newName.trim().length < 2}>
              {busy ? <Loader2 className="animate-spin" /> : <Plus />} Adicionar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Tem certeza que deseja excluir a categoria ${toDelete?.nome ?? ""}?`}
        description="Só é possível excluir categorias sem produtos."
        onConfirm={async () => {
          if (toDelete && (await run(() => deleteCategory(toDelete.id), "Categoria excluída."))) setToDelete(null)
        }}
      />
    </>
  )
}
