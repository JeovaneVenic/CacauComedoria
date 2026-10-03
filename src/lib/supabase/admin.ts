import "server-only"
import { createClient } from "@supabase/supabase-js"
import { supabaseUrl } from "@/lib/env"

// Cliente com service role: ignora RLS. Usar SOMENTE em Server Actions
// depois de confirmar o papel do usuário. Nunca importar em código do cliente.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !key) return null
  return createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
