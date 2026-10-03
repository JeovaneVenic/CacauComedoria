import { redirect } from "next/navigation"
import { getSessionContext } from "@/lib/auth"
import { homePathForRole } from "@/lib/roles"

// Encaminha cada papel para sua tela inicial
export default async function Home() {
  const ctx = await getSessionContext()
  if (!ctx) redirect("/login")
  redirect(homePathForRole(ctx.profile.papel))
}
