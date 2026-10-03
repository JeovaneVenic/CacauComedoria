import type { AppRole } from "@/types/domain"

export const MANAGER_ROLES: AppRole[] = ["proprietario", "gerente", "administrador"]
export const FLOOR_ROLES: AppRole[] = ["garcom", "caixa", ...MANAGER_ROLES]
export const KITCHEN_ROLES: AppRole[] = ["cozinha", ...MANAGER_ROLES]

export const ROLE_LABELS: Record<AppRole, string> = {
  proprietario: "Proprietário",
  gerente: "Gerente",
  administrador: "Administrador",
  garcom: "Garçom",
  cozinha: "Cozinha",
  caixa: "Caixa",
}

/** Papéis que o proprietário pode atribuir nesta versão */
export const ASSIGNABLE_ROLES: AppRole[] = ["garcom", "cozinha", "gerente"]

export function isManager(role: AppRole | null | undefined) {
  return !!role && MANAGER_ROLES.includes(role)
}

/** Tela inicial após o login, de acordo com o papel */
export function homePathForRole(role: AppRole) {
  if (isManager(role)) return "/admin"
  if (role === "cozinha") return "/cozinha"
  return "/garcom"
}
