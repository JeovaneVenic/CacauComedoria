import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Recebe o link do e-mail de recuperação de senha
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get("code")
  const tokenHash = params.get("token_hash")
  const type = params.get("type") as EmailOtpType | null
  // só caminhos internos: "//site.com" ou "/\site.com" levariam para outro domínio
  const rawNext = params.get("next") ?? ""
  const next = /^\/(?![/\\])/.test(rawNext) ? rawNext : "/redefinir-senha"

  const supabase = await createClient()
  let ok = false
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error
  }

  const url = new URL(ok ? next : "/login", request.url)
  if (!ok) url.searchParams.set("motivo", "link-invalido")
  return NextResponse.redirect(url)
}
