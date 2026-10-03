import { z } from "zod"
import { senhaForte } from "./password"

const papel = z.enum(["garcom", "cozinha", "gerente"], { message: "Escolha uma função." })
const nome = z.string().trim().min(3, "Informe o nome completo.").max(80, "Use até 80 caracteres.")
const senha = senhaForte

export const createStaffSchema = z.object({
  nome,
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  senha,
  papel,
})
export type CreateStaffInput = z.infer<typeof createStaffSchema>

export const updateStaffSchema = z.object({
  id: z.string().uuid(),
  nome,
  papel,
})
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>

export const resetStaffPasswordSchema = z.object({
  id: z.string().uuid(),
  senha,
})
