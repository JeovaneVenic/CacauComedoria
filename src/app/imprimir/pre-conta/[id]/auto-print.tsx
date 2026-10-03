"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { requestBill } from "@/features/orders/api"

interface AutoPrintProps {
  auto: boolean
  /** conta da mesa (para corrigir algo antes de cobrar) */
  backHref: string
  /** tela inicial do perfil (painel ou salão) */
  homeHref: string
  atendimentoId: string
  billRequested: boolean
  tableLabel: string
}

const btn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 44,
  padding: "0 20px",
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
  textDecoration: "none",
} as const

/**
 * Com ?auto=1 (aberto pelo botão "Imprimir pré-conta"), abre a impressão assim que o cupom carrega.
 * Sem o parâmetro, mostra os botões da tela: voltar, imprimir e finalizar.
 */
export function AutoPrint({ auto, backHref, homeHref, atendimentoId, billRequested, tableLabel }: AutoPrintProps) {
  const [finishing, setFinishing] = useState(false)

  useEffect(() => {
    if (!auto) return
    let cancelled = false
    // espera o logo e as fontes carregarem para a impressão sair completa (no máximo 3 s)
    const ready = Promise.all([
      document.fonts.ready,
      ...Array.from(document.images).map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))),
    ])
    const timeout = new Promise((r) => setTimeout(r, 3000))
    Promise.race([ready, timeout]).then(() => {
      if (!cancelled) setTimeout(() => window.print(), 100)
    })
    return () => {
      cancelled = true
    }
  }, [auto])

  /** Encerra a pré-conta: a mesa passa a "Aguardando pagamento" e volta para a tela inicial */
  async function finish() {
    setFinishing(true)
    if (!billRequested) {
      const result = await requestBill(atendimentoId)
      if (!result.ok) {
        setFinishing(false)
        toast.error(result.error)
        return
      }
    }
    toast.success(`Pré-conta da ${tableLabel} finalizada. Mesa aguardando pagamento.`)
    window.location.assign(homeHref)
  }

  if (auto) return null
  return (
    <div className="so-tela" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, margin: "16px 16px 0" }}>
      <a href={backHref} style={{ ...btn, border: "1px solid #c9c9c9", background: "#fff", color: "#333" }}>
        ← Voltar para a conta
      </a>
      <button type="button" onClick={() => window.print()} style={{ ...btn, border: "1px solid #b5461c", background: "#fff", color: "#b5461c" }}>
        Imprimir
      </button>
      <button type="button" onClick={finish} disabled={finishing} style={{ ...btn, border: 0, background: "#b5461c", color: "#fff", opacity: finishing ? 0.7 : 1 }}>
        {finishing ? "Finalizando…" : "✓ Finalizar"}
      </button>
    </div>
  )
}
