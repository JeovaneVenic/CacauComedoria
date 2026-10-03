import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="grid justify-items-center gap-3">
        <p className="text-6xl font-extrabold text-primary">404</p>
        <h1 className="text-2xl font-bold">Página não encontrada</h1>
        <p className="text-muted-foreground">O endereço pode ter mudado ou o item foi removido.</p>
        <Link href="/" className={cn(buttonVariants(), "mt-2 h-12 px-6 font-semibold")}>
          Voltar ao início
        </Link>
      </div>
    </main>
  )
}
