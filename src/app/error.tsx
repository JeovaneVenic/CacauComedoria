"use client"

import { useEffect } from "react"
import { RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="grid min-h-[60dvh] place-items-center p-6 text-center">
      <div className="grid justify-items-center gap-3">
        <h1 className="text-2xl font-bold">Não foi possível carregar esta tela</h1>
        <p className="max-w-sm text-muted-foreground">Verifique sua conexão e tente novamente. Se o problema continuar, avise o responsável.</p>
        <Button onClick={reset} className="mt-2 h-12 px-6 font-semibold">
          <RotateCw className="size-4" aria-hidden /> Tentar novamente
        </Button>
      </div>
    </main>
  )
}
