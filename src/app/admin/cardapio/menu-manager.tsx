"use client"

import { useMemo, useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { BookOpen, Clock, ImageOff, ListChecks, Plus, Search, Tags } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { PageHeader } from "@/components/layout/page-header"
import { setProductActive } from "@/features/menu/actions"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { MenuData } from "@/services/menu"
import type { Product } from "@/types/domain"
import { ProductSheet, type ProductTarget } from "./product-sheet"
import { CategoriesDialog } from "./categories-dialog"
import { GroupsDialog } from "./groups-dialog"

export function MenuManager({ restaurantId, categories, products, groups, links }: MenuData & { restaurantId: string }) {
  const router = useRouter()
  const [category, setCategory] = useState<string>("all")
  const [query, setQuery] = useState("")
  const [target, setTarget] = useState<ProductTarget | null>(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.nome])), [categories])
  const groupCount = useMemo(() => {
    const m = new Map<string, number>()
    links.forEach((l) => m.set(l.produto_id, (m.get(l.produto_id) ?? 0) + 1))
    return m
  }, [links])

  const categoryOrder = useMemo(() => new Map(categories.map((c, i) => [c.id, i])), [categories])
  const normalized = query.trim().toLocaleLowerCase("pt-BR")
  const visible = products
    .filter(
      (p) =>
        (category === "all" || p.categoria_id === category) &&
        (!normalized || p.nome.toLocaleLowerCase("pt-BR").includes(normalized))
    )
    // mesma ordem que o garçom vê: categoria, depois a posição do produto
    .sort((a, b) => (categoryOrder.get(a.categoria_id) ?? 0) - (categoryOrder.get(b.categoria_id) ?? 0) || a.ordem - b.ordem)
  const unavailable = products.filter((p) => !p.ativo).length

  function toggle(product: Product, ativo: boolean) {
    setPendingId(product.id)
    startTransition(async () => {
      const result = await setProductActive(product.id, ativo)
      setPendingId(null)
      if (!result.ok) toast.error(result.error)
      else {
        toast.success(ativo ? `${product.nome} disponível.` : `${product.nome} marcado como indisponível.`)
        router.refresh()
      }
    })
  }

  function newProduct() {
    if (categories.length === 0) {
      toast.error("Crie uma categoria antes de cadastrar produtos.")
      setCategoriesOpen(true)
      return
    }
    setTarget({ mode: "create", categoryId: category !== "all" ? category : categories[0].id })
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Cardápio"
        description={`${products.length} produtos em ${categories.length} categorias${unavailable ? ` · ${unavailable} indisponível(is)` : ""}.`}
        actions={
          <>
            <Button variant="outline" className="h-11" onClick={() => setCategoriesOpen(true)}>
              <Tags className="size-4" aria-hidden /> Categorias
            </Button>
            <Button variant="outline" className="h-11" onClick={() => setGroupsOpen(true)}>
              <ListChecks className="size-4" aria-hidden /> Opções
            </Button>
            <Button className="h-11 font-semibold" onClick={newProduct}>
              <Plus className="size-4" aria-hidden /> Novo produto
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto"
            aria-label="Buscar produto"
            className="h-12 pl-10 text-base"
          />
        </div>
        <div role="tablist" aria-label="Categorias" className="flex gap-2 overflow-x-auto pb-1">
          {[{ id: "all", nome: "Todos" }, ...categories].map((c) => {
            const count = c.id === "all" ? products.length : products.filter((p) => p.categoria_id === c.id).length
            const active = category === c.id
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(c.id)}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted"
                )}
              >
                {c.nome}
                <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-background/20" : "bg-muted")}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {products.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-2xl border border-dashed p-12 text-center">
          <BookOpen className="size-10 text-muted-foreground" aria-hidden />
          <p className="text-lg font-semibold">Nenhum produto cadastrado.</p>
          <p className="text-muted-foreground">Comece pelas categorias (ex.: Pratos, Bebidas) e depois cadastre os produtos.</p>
          <Button className="h-11" onClick={newProduct}>
            <Plus className="size-4" aria-hidden /> Cadastrar produto
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed p-10 text-center">
          <p className="font-semibold">Nenhum produto encontrado.</p>
          <p className="text-sm text-muted-foreground">Mude a categoria ou o texto da busca.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => (
            <li key={p.id} className={cn("flex flex-col overflow-hidden rounded-2xl border bg-card", !p.ativo && "bg-muted/50")}>
              <button
                type="button"
                onClick={() => setTarget({ mode: "edit", product: p })}
                className="group flex flex-1 flex-col text-left outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
                aria-label={`Editar ${p.nome}, ${formatCurrency(p.preco)}${p.ativo ? "" : ", indisponível"}`}
              >
                <div className="relative aspect-[4/3] w-full bg-muted">
                  {p.imagem_url ? (
                    <Image
                      src={p.imagem_url}
                      alt=""
                      fill
                      sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className={cn("object-cover transition-transform group-hover:scale-[1.02]", !p.ativo && "grayscale")}
                    />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-muted-foreground">
                      <ImageOff className="size-8" aria-hidden />
                    </span>
                  )}
                  {!p.ativo && (
                    <span className="absolute top-2 left-2 rounded-full bg-destructive px-2.5 py-1 text-xs font-bold text-white uppercase">
                      Indisponível
                    </span>
                  )}
                </div>
                <div className="grid flex-1 gap-1 p-4">
                  <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {categoryName.get(p.categoria_id)}
                  </span>
                  <span className="leading-snug font-bold">{p.nome}</span>
                  {p.descricao && <span className="line-clamp-2 text-sm text-muted-foreground">{p.descricao}</span>}
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-1 pt-2">
                    <span className="text-lg font-extrabold whitespace-nowrap tabular-nums">{formatCurrency(p.preco)}</span>
                    <span className="flex items-center gap-2 text-xs whitespace-nowrap text-muted-foreground">
                      {(groupCount.get(p.id) ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <ListChecks className="size-3.5" aria-hidden />
                          {groupCount.get(p.id)} {groupCount.get(p.id) === 1 ? "opção" : "opções"}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" aria-hidden />
                        {p.tempo_preparo_min} min
                      </span>
                    </span>
                  </div>
                </div>
              </button>
              <label className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm font-semibold">
                {p.ativo ? "Disponível" : "Indisponível"}
                <Switch
                  checked={p.ativo}
                  disabled={pendingId === p.id}
                  onCheckedChange={(v) => toggle(p, v)}
                  aria-label={`${p.nome} disponível`}
                />
              </label>
            </li>
          ))}
        </ul>
      )}

      <ProductSheet
        target={target}
        restaurantId={restaurantId}
        categories={categories}
        groups={groups}
        links={links}
        onClose={() => setTarget(null)}
      />
      <CategoriesDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} categories={categories} products={products} />
      <GroupsDialog open={groupsOpen} onOpenChange={setGroupsOpen} groups={groups} links={links} />
    </div>
  )
}
