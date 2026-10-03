import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { Category, ModifierGroup, Product, ProductGroupLink } from "@/types/domain"

export interface MenuData {
  categories: Category[]
  products: Product[]
  groups: ModifierGroup[]
  links: ProductGroupLink[]
}

/** Cardápio completo do restaurante (o RLS limita ao restaurante do usuário) */
export async function getMenu(): Promise<MenuData> {
  const supabase = await createClient()
  const [categories, products, groups, links] = await Promise.all([
    supabase.from("categorias").select("*").order("ordem").order("nome"),
    supabase.from("produtos").select("*").order("ordem").order("nome"),
    supabase.from("grupos_opcoes").select("*, opcoes(*)").order("nome"),
    supabase.from("produto_grupos_opcoes").select("produto_id, grupo_id, ordem"),
  ])
  const error = categories.error ?? products.error ?? groups.error ?? links.error
  if (error) throw error

  return {
    categories: categories.data as Category[],
    products: (products.data as Product[]).map((p) => ({ ...p, preco: Number(p.preco) })),
    groups: (groups.data as ModifierGroup[]).map((g) => ({
      ...g,
      opcoes: [...g.opcoes]
        .map((o) => ({ ...o, acrescimo: Number(o.acrescimo) }))
        .sort((a, b) => a.ordem - b.ordem),
    })),
    links: links.data as ProductGroupLink[],
  }
}
