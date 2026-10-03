import { createBrowserClient } from "@supabase/ssr"
import { supabaseKey, supabaseUrl } from "@/lib/env"

let client: ReturnType<typeof createBrowserClient> | undefined

// Uma única instância no navegador (evita múltiplas conexões de Realtime)
export function createClient() {
  client ??= createBrowserClient(supabaseUrl, supabaseKey)
  return client
}
