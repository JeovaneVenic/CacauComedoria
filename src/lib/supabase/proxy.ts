import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "@/lib/env"

const PUBLIC_PATHS = ["/login", "/esqueci-senha", "/redefinir-senha", "/auth", "/offline"]

// Renova a sessão a cada requisição e faz o redirecionamento otimista.
// A autorização de verdade acontece nos layouts (servidor) e no RLS do banco.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  if (!isSupabaseConfigured) return response

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const isAuthenticated = Boolean(data?.claims)
  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))

  if (!isAuthenticated && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return response
}
