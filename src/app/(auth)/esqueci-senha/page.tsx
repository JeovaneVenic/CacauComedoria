"use client"

import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Loader2, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/forms/field"
import { useHydrated } from "@/hooks/use-hydrated"
import { createClient } from "@/lib/supabase/client"
import { friendlyError } from "@/lib/errors"
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/schemas/auth"

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const hydrated = useHydrated()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) })

  async function onSubmit({ email }: ForgotPasswordInput) {
    setFormError(null)
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/redefinir-senha`,
    })
    if (error) {
      setFormError(friendlyError(error, "Não foi possível enviar o e-mail. Tente novamente."))
      return
    }
    setSentTo(email)
  }

  return (
    <div className="grid gap-8">
      <Link href="/login" className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar para o login
      </Link>

      {sentTo ? (
        <div role="status" className="grid gap-3">
          <MailCheck className="size-10 text-status-free" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">Verifique seu e-mail</h1>
          <p className="text-muted-foreground">
            Se <strong className="text-foreground">{sentTo}</strong> estiver cadastrado, você receberá um link para criar
            uma nova senha.
          </p>
        </div>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Esqueci minha senha</h1>
            <p className="mt-1 text-muted-foreground">Informe seu e-mail e enviaremos um link para redefinir a senha.</p>
          </div>
          <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
            <Field id="email" label="E-mail" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="h-12 text-base"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-erro" : undefined}
                {...register("email")}
              />
            </Field>
            {formError && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive">
                {formError}
              </p>
            )}
            <Button type="submit" disabled={isSubmitting || !hydrated} className="h-12 text-base font-semibold">
              {isSubmitting && <Loader2 className="animate-spin" />}
              Enviar link
            </Button>
          </form>
        </>
      )}
    </div>
  )
}
