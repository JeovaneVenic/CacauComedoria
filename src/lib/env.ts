// Variáveis públicas do Supabase. A chave "publishable"/"anon" é segura no
// navegador porque todo acesso é protegido por RLS no banco.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)
