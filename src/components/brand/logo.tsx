import Image from "next/image"
import { cn } from "@/lib/utils"
import mascote from "../../../public/brand/mascote.png"
import logoCompleta from "../../../public/brand/logo-cacau-comedoria.png"

/** Ícone da marca: mascote da Cacau Comedoria num quadro com a tinta suave da marca */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-accent ring-1 ring-black/5", className)}>
      <Image src={mascote} alt="" sizes="64px" className="size-[88%] object-contain" priority />
    </span>
  )
}

/** Logo completa (mascote + "Cacau Comedoria") */
export function LogoFull({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src={logoCompleta}
      alt="Cacau Comedoria"
      sizes="(min-width: 1024px) 220px, 160px"
      className={cn("h-auto w-40 object-contain", className)}
      priority={priority}
    />
  )
}

export function Logo({ name, className }: { name: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark />
      <span className="font-heading text-lg leading-tight font-bold tracking-tight">{name}</span>
    </div>
  )
}
