"use client"

import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/forms/field"
import { useHydrated } from "@/hooks/use-hydrated"
import { createClient } from "@/lib/supabase/client"
import { friendlyError } from "@/lib/errors"
import { loginSchema, type LoginInput } from "@/schemas/auth"
import { clearLoginFailures, loginWaitMs, registerLoginFailure, watchLoginWait } from "@/features/auth/login-throttle"

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const hydrated = useHydrated()
  // segundos de espera após várias senhas erradas (contagem regressiva na tela)
  const [waitSeconds, setWaitSeconds] = useState(0)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginInput) {
    setFormError(null)
    const pending = loginWaitMs()
    if (pending > 0) {
      watchLoginWait(setWaitSeconds)
      return
    }
    const { error } = await createClient().auth.signInWithPassword(values)
    if (error) {
      setFormError(friendlyError(error, "Não foi possível entrar. Tente novamente."))
      // só senha errada conta (falha de rede não)
      if (error.status === 400 || /Invalid login credentials/i.test(error.message)) {
        const wait = registerLoginFailure()
        if (wait > 0) watchLoginWait(setWaitSeconds)
      }
      return
    }
    clearLoginFailures()
    const supabase = createClient()
    // registro de acesso na auditoria (não impede a entrada se falhar)
    await supabase.rpc("registrar_acesso", { p_evento: "entrada" }).then(() => undefined, () => undefined)
    // Navegação completa: descarta páginas guardadas de quando não havia sessão
    // (com router.replace o cache antigo de "/" mandava de volta ao login).
    // A página inicial redireciona conforme o papel (dono → painel, garçom → mesas).
    window.location.replace("/")
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <Field id="email" label="E-mail" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="seu@email.com"
          className="h-12 text-base"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-erro" : undefined}
          {...register("email")}
        />
      </Field>

      <Field id="password" label="Senha" error={errors.password?.message}>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="h-12 pr-12 text-base"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-erro" : undefined}
            {...register("password")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </Field>

      {waitSeconds > 0 && (
        <p role="status" className="rounded-lg bg-status-preparing-soft px-3 py-2.5 text-sm font-medium text-status-preparing">
          Muitas tentativas com senha errada. Aguarde {waitSeconds >= 60 ? `${Math.floor(waitSeconds / 60)} min ${waitSeconds % 60} s` : `${waitSeconds} s`} para tentar de novo, ou use &quot;Esqueci minha senha&quot;.
        </p>
      )}

      {formError && waitSeconds === 0 && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting || !hydrated || waitSeconds > 0} className="h-12 text-base font-semibold">
        {isSubmitting && <Loader2 className="animate-spin" />}
        {isSubmitting ? "Entrando…" : "Entrar"}
      </Button>

      <Link
        href="/esqueci-senha"
        className="justify-self-center rounded-md px-2 py-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        Esqueci minha senha
      </Link>
    </form>
  )
}
