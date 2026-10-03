"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/forms/field"
import { useHydrated } from "@/hooks/use-hydrated"
import { createClient } from "@/lib/supabase/client"
import { friendlyError } from "@/lib/errors"
import { resetPasswordSchema, type ResetPasswordInput } from "@/schemas/auth"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const hydrated = useHydrated()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) })

  async function onSubmit({ password }: ResetPasswordInput) {
    setFormError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setFormError(friendlyError(error, "Não foi possível alterar a senha. Solicite um novo link."))
      return
    }
    await supabase.auth.signOut()
    router.replace("/login?motivo=senha-alterada")
  }

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Criar nova senha</h1>
        <p className="mt-1 text-muted-foreground">Use pelo menos 8 caracteres.</p>
      </div>
      <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
        <Field id="password" label="Nova senha" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            className="h-12 text-base"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-erro" : undefined}
            {...register("password")}
          />
        </Field>
        <Field id="confirm" label="Confirmar senha" error={errors.confirm?.message}>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            className="h-12 text-base"
            aria-invalid={!!errors.confirm}
            aria-describedby={errors.confirm ? "confirm-erro" : undefined}
            {...register("confirm")}
          />
        </Field>
        {formError && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting || !hydrated} className="h-12 text-base font-semibold">
          {isSubmitting && <Loader2 className="animate-spin" />}
          Salvar nova senha
        </Button>
      </form>
    </div>
  )
}
