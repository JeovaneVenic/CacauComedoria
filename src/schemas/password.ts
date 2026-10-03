import { z } from "zod"

/** Senha de acesso: 8+ caracteres, com letras e números (máx. 72, limite do bcrypt do Supabase) */
export const senhaForte = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(72, "Use até 72 caracteres.")
  .refine((v) => /[A-Za-zÀ-ÿ]/.test(v) && /\d/.test(v), "Use letras e números na senha.")
