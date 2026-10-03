import type { Metadata } from "next"
import { requireRoleWith } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { createClient } from "@/lib/supabase/server"
import type { Profile } from "@/types/domain"
import { TeamManager } from "./team-manager"

export const metadata: Metadata = { title: "Usuários" }

async function getTeam() {
  const supabase = await createClient()
  const { data } = await supabase.from("usuarios").select("*").order("ativo", { ascending: false }).order("nome")
  return (data ?? []) as Profile[]
}

export default async function UsersPage() {
  const { profile, data: members } = await requireRoleWith(MANAGER_ROLES, getTeam)
  const adminKeyConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY)

  return <TeamManager members={members} currentUserId={profile.id} currentRole={profile.papel} adminKeyConfigured={adminKeyConfigured} />
}
