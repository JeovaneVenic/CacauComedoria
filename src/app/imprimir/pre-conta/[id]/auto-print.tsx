"use client"

import { useEffect } from "react"

/**
 * Com ?auto=1 (aberto pelo botão "Imprimir pré-conta"), abre a impressão assim que o cupom carrega.
 * Sem o parâmetro, mostra um botão para imprimir manualmente (útil para conferir o cupom na tela).
 */
export function AutoPrint({ auto }: { auto: boolean }) {
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

  if (auto) return null
  return (
    <div className="so-tela" style={{ textAlign: "center", marginTop: 16 }}>
      <button
        type="button"
        onClick={() => window.print()}
        style={{ height: 44, padding: "0 20px", borderRadius: 10, border: 0, background: "#b5461c", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
      >
        Imprimir
      </button>
    </div>
  )
}
