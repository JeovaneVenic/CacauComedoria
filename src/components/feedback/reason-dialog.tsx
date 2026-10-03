"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface ReasonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  placeholder?: string
  onConfirm: (reason: string) => Promise<boolean | void> | boolean | void
}

/** Confirmação de ação perigosa com motivo opcional (fica na auditoria) */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  placeholder = "Motivo (opcional)",
  onConfirm,
}: ReasonDialogProps) {
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    const done = await onConfirm(reason.trim())
    setBusy(false)
    if (done !== false) setReason("")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setReason("")
        onOpenChange(o)
      }}
    >
      <DialogContent className="gap-4 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} rows={2} maxLength={200} aria-label="Motivo" />
        <DialogFooter className="-mx-6 -mb-6 p-4">
          <Button variant="outline" className="h-11 min-w-28" onClick={() => onOpenChange(false)} disabled={busy}>
            Voltar
          </Button>
          <Button variant="destructive" className="h-11 min-w-28 font-semibold" onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
