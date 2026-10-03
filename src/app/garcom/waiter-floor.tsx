"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LiveFloor } from "@/features/tables/components/live-floor"
import { useLiveTables } from "@/features/tables/hooks/use-live-tables"
import { OpenTableDialog } from "@/features/tables/components/open-table-dialog"
import { createClient } from "@/lib/supabase/client"
import { friendlyError } from "@/lib/errors"
import { tableLabel } from "@/lib/format"
import type { Section, TableOverview } from "@/types/domain"

interface WaiterFloorProps {
  restaurantId: string
  userId: string
  tables: TableOverview[]
  sections: Section[]
}

export function WaiterFloor({ restaurantId, userId, tables, sections }: WaiterFloorProps) {
  const router = useRouter()
  const [opening, setOpening] = useState<TableOverview | null>(null)
  const live = useLiveTables(restaurantId, tables)

  function handleSelect(table: TableOverview) {
    if (table.status === "livre") setOpening(table)
    else router.push(`/garcom/mesa/${table.id}`)
  }

  async function openTable(table: TableOverview, guests: number) {
    const { error } = await createClient().rpc("abrir_mesa", { p_mesa_id: table.id, p_pessoas: guests })
    if (error) {
      toast.error(friendlyError(error, "Não foi possível abrir a mesa."))
      return
    }
    toast.success(`${tableLabel(table.numero)} aberta`)
    setOpening(null)
    // mesa aberta: direto para o lançamento do pedido
    router.push(`/garcom/mesa/${table.id}/pedido`)
  }

  return (
    <>
      <LiveFloor
        tables={live.tables}
        state={live.state}
        sections={sections}
        currentUserId={userId}
        onSelect={handleSelect}
        showMine
      />
      <OpenTableDialog table={opening} onOpenChange={(open) => !open && setOpening(null)} onConfirm={openTable} />
    </>
  )
}
