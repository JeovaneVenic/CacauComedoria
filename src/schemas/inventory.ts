import { z } from "zod"
import { moeda } from "./common"

export const UNIDADES = ["kg", "g", "l", "ml", "un", "cx", "pct"] as const
export type Unidade = (typeof UNIDADES)[number]

export const UNIDADE_LABEL: Record<Unidade, string> = {
  kg: "Quilo (kg)",
  g: "Grama (g)",
  l: "Litro (l)",
  ml: "Mililitro (ml)",
  un: "Unidade (un)",
  cx: "Caixa (cx)",
  pct: "Pacote (pct)",
}

/** Aceita "1,5", "1.5" ou número; até 3 casas decimais */
export const quantidade = (mensagem: string) =>
  z.preprocess((v) => {
    if (typeof v === "number") return v
    if (typeof v !== "string") return v
    const limpo = v.replace(/\s/g, "")
    if (!limpo) return undefined
    const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo
    return Number(normal)
  }, z.number({ message: mensagem }).min(0, "A quantidade não pode ser negativa.").max(999_999, "Quantidade muito alta.").transform((n) => Math.round(n * 1000) / 1000))

export const stockItemSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2, "Informe o nome do item (ex.: Queijo mussarela).").max(80, "Use até 80 caracteres."),
  unidade: z.enum(UNIDADES, { message: "Escolha a unidade." }),
  quantidade_minima: quantidade("Informe o estoque mínimo (0 se não houver)."),
  custo_unitario: moeda("Informe o custo (0 se não souber)."),
  fornecedor_id: z.string().uuid().nullable(),
  ativo: z.boolean(),
  /** só no cadastro: saldo inicial registrado como entrada */
  quantidade_inicial: z.union([z.literal(""), quantidade("Informe a quantidade inicial.")]).optional(),
})
export type StockItemInput = z.input<typeof stockItemSchema>

export const TIPOS_MOVIMENTO = ["entrada", "saida", "ajuste"] as const
export type TipoMovimento = (typeof TIPOS_MOVIMENTO)[number]

export const movementSchema = z
  .object({
    item_id: z.string().uuid(),
    tipo: z.enum(TIPOS_MOVIMENTO),
    quantidade: quantidade("Informe a quantidade."),
    custo_unitario: z.union([z.literal(""), moeda("Informe o custo.")]).optional(),
    motivo: z.string().trim().max(200, "Use até 200 caracteres."),
  })
  .refine((v) => v.tipo === "ajuste" || v.quantidade > 0, { message: "A quantidade deve ser maior que zero.", path: ["quantidade"] })
  .refine((v) => v.tipo !== "saida" || v.motivo.length >= 2, { message: "Informe o motivo da saída (ex.: vencido, quebra).", path: ["motivo"] })
export type MovementInput = z.input<typeof movementSchema>

export const recipeSchema = z.object({
  produto_id: z.string().uuid(),
  itens: z
    .array(
      z.object({
        item_estoque_id: z.string().uuid({ message: "Escolha o ingrediente." }),
        quantidade: quantidade("Informe a quantidade.").refine((n) => n > 0, "A quantidade deve ser maior que zero."),
      })
    )
    .max(50, "Use até 50 ingredientes."),
})
export type RecipeInput = z.input<typeof recipeSchema>
