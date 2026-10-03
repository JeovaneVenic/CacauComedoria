// Perfis de teste (usuários de demonstração do supabase/seed.sql)
export type Perfil = "dono" | "garcom" | "cozinha"

export const USUARIOS: Record<Perfil, { email: string; home: RegExp }> = {
  dono: { email: process.env.E2E_DONO_EMAIL ?? "", home: /\/admin$/ },
  garcom: { email: process.env.E2E_GARCOM_EMAIL ?? "", home: /\/garcom$/ },
  cozinha: { email: process.env.E2E_COZINHA_EMAIL ?? "", home: /\/cozinha$/ },
}

export const SENHA = process.env.E2E_SENHA ?? ""
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

/** Sessão salva de cada perfil (gerada pelo auth.setup.ts) */
export const estado = (perfil: Perfil) => `e2e/.auth/${perfil}.json`
