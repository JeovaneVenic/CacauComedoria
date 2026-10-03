"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { CheckCircle2, Download, Share } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function subscribeStandalone(cb: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)")
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)

/** Cartão "Instalar app": usa o convite do navegador (Android/Chrome/Edge) ou explica o passo no iPhone/iPad. */
export function InstallAppCard() {
  const installed = useSyncExternalStore(subscribeStandalone, isStandalone, () => false)
  const ios = useSyncExternalStore(() => () => {}, isIOS, () => false)
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setPromptEvent(null)
      toast.success("App instalado. Abra pelo ícone na tela inicial.")
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  async function install() {
    if (!promptEvent) return
    await promptEvent.prompt()
    await promptEvent.userChoice
    setPromptEvent(null)
  }

  return (
    <section aria-labelledby="instalar-app" className="grid gap-3 rounded-2xl border bg-card p-4">
      <div>
        <h2 id="instalar-app" className="font-bold">
          App no aparelho
        </h2>
        <p className="text-sm text-muted-foreground">Abre em tela cheia pelo ícone e continua funcionando quando a internet oscila.</p>
      </div>
      {installed ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-status-free">
          <CheckCircle2 className="size-4" aria-hidden /> Você está usando o app instalado.
        </p>
      ) : promptEvent ? (
        <Button className="h-12 font-semibold" onClick={install}>
          <Download className="size-4" aria-hidden /> Instalar app
        </Button>
      ) : ios ? (
        <p className="flex items-start gap-2 text-sm">
          <Share className="mt-0.5 size-4 shrink-0" aria-hidden />
          No Safari, toque em Compartilhar e depois em &quot;Adicionar à Tela de Início&quot;.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          No Chrome ou Edge, use o menu do navegador e escolha &quot;Instalar app&quot; ou &quot;Adicionar à tela inicial&quot;.
        </p>
      )}
    </section>
  )
}
