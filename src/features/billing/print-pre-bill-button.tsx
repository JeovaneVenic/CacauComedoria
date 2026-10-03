"use client"

import { useState } from "react"
import { Loader2, Printer } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

/**
 * Imprime a pré-conta na impressora do computador (térmica 80 mm instalada no Windows).
 * Carrega o cupom num iframe invisível e imprime só ele, sem sair da tela da conta.
 * No Chrome aberto com --kiosk-printing, sai direto na impressora padrão, sem a janela de impressão.
 */
export function PrintPreBillButton({ mesaId, semServico }: { mesaId: string; semServico: boolean }) {
  const [busy, setBusy] = useState(false)

  function print() {
    if (busy) return
    setBusy(true)
    document.getElementById("cupom-impressao")?.remove()
    const frame = document.createElement("iframe")
    frame.id = "cupom-impressao"
    frame.title = "Pré-conta para impressão"
    frame.setAttribute("aria-hidden", "true")
    Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0", visibility: "hidden" })
    frame.src = `/imprimir/pre-conta/${mesaId}?auto=1${semServico ? "&servico=0" : ""}`

    const done = () => {
      setBusy(false)
      // remove depois que a impressão terminar (ou após 1 min, se o evento não vier)
      setTimeout(() => frame.remove(), 60_000)
    }
    frame.onload = () => {
      const win = frame.contentWindow
      if (!win || !win.location.pathname.startsWith("/imprimir/")) {
        toast.error("Não foi possível preparar a pré-conta. Verifique se a sessão continua ativa.")
        frame.remove()
        setBusy(false)
        return
      }
      win.addEventListener("afterprint", () => frame.remove(), { once: true })
      done()
    }
    frame.onerror = () => {
      toast.error("Não foi possível preparar a pré-conta.")
      frame.remove()
      setBusy(false)
    }
    document.body.appendChild(frame)
  }

  return (
    <Button variant="outline" className="h-12" onClick={print} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <Printer className="size-5" aria-hidden />} Imprimir pré-conta
    </Button>
  )
}
