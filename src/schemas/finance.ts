import { z } from "zod"
import { FORMAS_PAGAMENTO, moeda } from "./common"

export const expenseSchema = z.object({
  id: z.string().uuid().optional(),
  descricao: z.string().trim().min(2, "Descreva a despesa (ex.: Conta de energia).").max(120, "Use até 120 caracteres."),
  categoria_id: z.string().uuid({ message: "Escolha uma categoria." }),
  valor: moeda("Informe o valor.").refine((v) => v > 0, "O valor deve ser maior que zero."),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
  forma_pagamento: z.enum(FORMAS_PAGAMENTO, { message: "Escolha a forma de pagamento." }),
  fornecedor_id: z.string().uuid().nullable(),
  observacao: z.string().trim().max(300, "Use até 300 caracteres."),
  comprovante_caminho: z.string().nullable(),
})
export type ExpenseInput = z.input<typeof expenseSchema>

export const supplierSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2, "Informe o nome do fornecedor.").max(80, "Use até 80 caracteres."),
  documento: z.string().trim().max(20, "Use até 20 caracteres."),
  telefone: z.string().trim().max(20, "Use até 20 caracteres."),
  email: z.union([z.literal(""), z.string().trim().email("Informe um e-mail válido.")]),
  observacao: z.string().trim().max(200, "Use até 200 caracteres."),
})
export type SupplierInput = z.infer<typeof supplierSchema>
