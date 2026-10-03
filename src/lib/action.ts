import type { ZodError } from "zod"

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

export function validationError(error: ZodError): ActionResult<never> {
  return { ok: false, error: error.issues[0]?.message ?? "Verifique os dados informados." }
}
