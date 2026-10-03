import { z } from "zod"
import { moeda } from "./common"

export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2, "Dê um nome à categoria.").max(40, "Use até 40 caracteres."),
  ativa: z.boolean(),
})
export type CategoryInput = z.infer<typeof categorySchema>

export const productSchema = z.object({
  id: z.string().uuid().optional(),
  categoria_id: z.string().uuid({ message: "Escolha uma categoria." }),
  nome: z.string().trim().min(2, "Informe o nome do produto.").max(80, "Use até 80 caracteres."),
  descricao: z.string().trim().max(200, "Use até 200 caracteres."),
  preco: moeda("Informe o preço."),
  tempo_preparo_min: z.coerce
    .number({ message: "Informe o tempo de preparo." })
    .int("Use minutos inteiros.")
    .min(0, "O tempo não pode ser negativo.")
    .max(240, "Use no máximo 240 minutos."),
  ativo: z.boolean(),
  imagem_url: z.string().url().nullable(),
  grupos_ids: z.array(z.string().uuid()),
})
export type ProductInput = z.input<typeof productSchema>
export type ProductValues = z.output<typeof productSchema>

export const modifierGroupSchema = z
  .object({
    id: z.string().uuid().optional(),
    nome: z.string().trim().min(2, "Dê um nome ao grupo (ex.: Ponto da carne).").max(40, "Use até 40 caracteres."),
    min_escolhas: z.coerce.number().int().min(0, "O mínimo não pode ser negativo."),
    max_escolhas: z.coerce.number().int().min(1, "O máximo deve ser pelo menos 1."),
    opcoes: z
      .array(
        z.object({
          id: z.string().uuid().optional(),
          nome: z.string().trim().min(1, "Dê um nome a cada opção.").max(40, "Use até 40 caracteres."),
          acrescimo: moeda("Informe o acréscimo (0 se não houver)."),
          ativa: z.boolean(),
        })
      )
      .min(1, "Adicione pelo menos uma opção."),
  })
  .refine((g) => g.max_escolhas >= g.min_escolhas, {
    message: "O máximo de escolhas não pode ser menor que o mínimo.",
    path: ["max_escolhas"],
  })
  .refine((g) => g.min_escolhas <= g.opcoes.filter((o) => o.ativa).length, {
    message: "O mínimo de escolhas é maior que o número de opções ativas.",
    path: ["min_escolhas"],
  })
export type ModifierGroupInput = z.input<typeof modifierGroupSchema>
