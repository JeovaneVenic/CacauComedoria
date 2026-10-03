import type { Metadata } from "next"
import { requireRoleWith } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { getAllTables, getSections } from "@/services/tables"
import { FloorEditor } from "./floor-editor"

export const metadata: Metadata = { title: "Mesas" }

export default async function AdminTablesPage() {
  const {
    data: [tables, sections],
  } = await requireRoleWith(MANAGER_ROLES, () => Promise.all([getAllTables(), getSections()]))
  return <FloorEditor tables={tables} sections={sections} />
}
