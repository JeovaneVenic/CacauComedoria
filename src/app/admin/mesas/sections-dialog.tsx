"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/feedback/confirm-dialog"
import { deleteSection, saveSection } from "@/features/tables/actions"
import type { DiningTable, Section } from "@/types/domain"

export function SectionsDialog({
  open,
  onOpenChange,
  sections,
  tables,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sections: Section[]
  tables: DiningTable[]
}) {
  const router = useRouter()
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [busy, setBusy] = useState(false)
  const [toDelete, setToDelete] = useState<Section | null>(null)

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(true)
    const result = await fn()
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return false
    }
    toast.success(success)
    router.refresh()
    return true
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Setores</DialogTitle>
            <DialogDescription>Ex.: Salão principal, Varanda, Área externa, VIP.</DialogDescription>
          </DialogHeader>

          <ul className="grid gap-2">
            {sections.length === 0 && <li className="text-sm text-muted-foreground">Nenhum setor cadastrado.</li>}
            {sections.map((s) => {
              const count = tables.filter((t) => t.setor_id === s.id).length
              return (
                <li key={s.id} className="flex items-center gap-2 rounded-xl border p-2 pl-3">
                  {editingId === s.id ? (
                    <form
                      className="flex flex-1 items-center gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault()
                        if (await run(() => saveSection({ id: s.id, nome: editName }), "Setor renomeado.")) setEditingId(null)
                      }}
                    >
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-11" aria-label="Nome do setor" autoFocus />
                      <Button type="submit" size="icon-lg" className="size-11" disabled={busy} aria-label="Salvar nome">
                        <Check />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-lg" className="size-11" onClick={() => setEditingId(null)} aria-label="Cancelar">
                        <X />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <span className="flex-1 font-semibold">
                        {s.nome}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {count} {count === 1 ? "mesa" : "mesas"}
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className="size-11"
                        onClick={() => {
                          setEditingId(s.id)
                          setEditName(s.nome)
                        }}
                        aria-label={`Renomear ${s.nome}`}
                      >
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-lg" className="size-11 text-destructive" onClick={() => setToDelete(s)} aria-label={`Excluir ${s.nome}`}>
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>

          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              if (await run(() => saveSection({ nome: newName }), "Setor criado.")) setNewName("")
            }}
          >
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Novo setor" className="h-12" aria-label="Nome do novo setor" />
            <Button type="submit" className="h-12" disabled={busy || newName.trim().length < 2}>
              {busy ? <Loader2 className="animate-spin" /> : <Plus />} Adicionar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Tem certeza que deseja excluir o setor ${toDelete?.nome ?? ""}?`}
        description="As mesas deste setor continuam cadastradas, mas ficam sem setor."
        onConfirm={async () => {
          if (toDelete && (await run(() => deleteSection(toDelete.id), "Setor excluído."))) setToDelete(null)
        }}
      />
    </>
  )
}
