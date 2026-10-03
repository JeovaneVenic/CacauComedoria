"use server"

import { requireRole } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { resolvePeriod } from "@/lib/periods"
import type { ActionResult } from "@/lib/action"
import { getAuditForExport, type AuditEntry } from "@/services/audit"
import { isAuditCategory } from "./meta"

export async function exportAudit(params: { periodo?: string; de?: string; ate?: string; categoria?: string; autor?: string; q?: string }): Promise<ActionResult<AuditEntry[]>> {
  await requireRole(MANAGER_ROLES)
  try {
    const entries = await getAuditForExport({
      period: resolvePeriod(params.periodo ?? "7dias", params.de, params.ate),
      categoria: isAuditCategory(params.categoria) ? params.categoria : undefined,
      autor: params.autor,
      q: params.q,
      pagina: 1,
    })
    return { ok: true, data: entries }
  } catch {
    return { ok: false, error: "Não foi possível exportar a auditoria." }
  }
}
