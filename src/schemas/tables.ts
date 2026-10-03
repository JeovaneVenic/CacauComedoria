import { z } from "zod"

export const GRID_MAX = 11 // posições 0–11 (12 colunas/linhas por setor)

// Campos com os mesmos nomes da tabela public.mesas
export const tableSchema = z.object({
  id: z.string().uuid().optional(),
  numero: z.coerce
    .number({ message: "Informe o número da mesa." })
    .int("Use um número inteiro.")
    .min(1, "O número deve ser maior que zero.")
    .max(999, "Use um número até 999."),
  capacidade: z.coerce
    .number({ message: "Informe a capacidade." })
    .int("Use um número inteiro.")
    .min(1, "A mesa precisa de pelo menos 1 lugar.")
    .max(50, "Capacidade máxima: 50 lugares."),
  setor_id: z.string().uuid().nullable(),
  formato: z.enum(["quadrada", "redonda", "retangular"]),
  pos_x: z.coerce.number().int().min(0).max(GRID_MAX),
  pos_y: z.coerce.number().int().min(0).max(GRID_MAX),
  ativa: z.boolean(),
})
export type TableInput = z.infer<typeof tableSchema>

export const sectionSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2, "Dê um nome ao setor.").max(40, "Use até 40 caracteres."),
})
export type SectionInput = z.infer<typeof sectionSchema>

export const tableStatusSchema = z.enum([
  "livre",
  "ocupada",
  "aguardando_pedido",
  "em_preparo",
  "pedido_pronto",
  "aguardando_pagamento",
  "finalizada",
])
