import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { LogoFull } from "@/components/brand/logo"
import { getSessionContext } from "@/lib/auth"
import { RESTAURANT_NAME } from "@/lib/brand"
import { isSupabaseConfigured } from "@/lib/env"
import { homePathForRole } from "@/lib/roles"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Entrar" }

const NOTICES: Record<string, string> = {
  acesso: "Seu acesso não está ativo. Fale com o responsável pelo restaurante.",
  "link-invalido": "O link expirou ou já foi usado. Solicite um novo.",
  "senha-alterada": "Senha alterada. Entre com a nova senha.",
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { motivo } = await searchParams
  if (isSupabaseConfigured) {
    const ctx = await getSessionContext()
    if (ctx) redirect(homePathForRole(ctx.profile.papel))
  }
  const notice = typeof motivo === "string" ? NOTICES[motivo] : undefined

  return (
    <div className="grid gap-8">
      <div className="grid gap-4">
        <LogoFull className="w-32 lg:hidden" priority />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">Bem-vindo ao {RESTAURANT_NAME}</h1>
          <p className="mt-1 text-muted-foreground">Entre com seu e-mail e senha para começar o turno.</p>
        </div>
      </div>

      {notice && (
        <p role="status" className="rounded-xl border border-status-waiting/30 bg-status-waiting-soft px-4 py-3 text-sm font-medium text-status-waiting">
          {notice}
        </p>
      )}

      {isSupabaseConfigured ? (
        <LoginForm />
      ) : (
        <div role="alert" className="rounded-xl border bg-card p-5 text-sm">
          <p className="font-semibold">Configuração pendente</p>
          <p className="mt-1 text-muted-foreground">
            Conecte o banco de dados: preencha <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> no arquivo{" "}
            <code className="font-mono">.env.local</code> e reinicie o servidor.
          </p>
        </div>
      )}
    </div>
  )
}
