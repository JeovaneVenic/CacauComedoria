import { z } from "zod"

export const WEEK_DAYS = [
  { key: "seg", label: "Segunda" },
  { key: "ter", label: "Terça" },
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
] as const

const horario = z
  .string()
  .trim()
  .regex(/^$|^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/, "Use o formato 11:00-23:00 ou deixe vazio (fechado).")

// Campos com os mesmos nomes da tabela public.restaurantes
export const restaurantSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do restaurante.").max(80, "Use até 80 caracteres."),
  endereco: z.string().trim().max(200, "Use até 200 caracteres."),
  telefone: z.string().trim().max(20, "Use até 20 caracteres."),
  taxa_servico_percentual: z.coerce
    .number({ message: "Informe a taxa de serviço." })
    .min(0, "A taxa não pode ser negativa.")
    .max(30, "A taxa máxima é 30%."),
  garcom_pode_fechar_mesa: z.boolean(),
  horario_funcionamento: z.object(
    Object.fromEntries(WEEK_DAYS.map((d) => [d.key, horario])) as Record<(typeof WEEK_DAYS)[number]["key"], typeof horario>
  ),
  logo_url: z.string().url().nullable(),
})
export type RestaurantInput = z.infer<typeof restaurantSchema>
