import { Skeleton } from "@/components/ui/skeleton"
import { TableGridSkeleton } from "@/components/feedback/skeletons"

export default function Loading() {
  return (
    <div className="mx-auto grid max-w-7xl gap-5">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <TableGridSkeleton />
    </div>
  )
}
