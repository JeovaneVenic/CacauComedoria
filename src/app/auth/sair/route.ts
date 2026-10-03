import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

async function signOut(request: NextRequest) {
  const supabase = await createClient()
  // registra a saída na auditoria antes de encerrar a sessão (falha não impede a saída)
  await supabase.rpc("registrar_acesso", { p_evento: "saida" }).then(() => undefined, () => undefined)
  await supabase.auth.signOut()
  const url = new URL("/login", request.url)
  const motivo = request.nextUrl.searchParams.get("motivo")
  if (motivo) url.searchParams.set("motivo", motivo)
  return NextResponse.redirect(url, { status: 303 })
}

export const GET = signOut
export const POST = signOut
