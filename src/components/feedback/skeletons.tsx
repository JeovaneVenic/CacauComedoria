import { Skeleton } from "@/components/ui/skeleton"

export function TableGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div role="status" aria-label="Carregando mesas" className="grid gap-4">
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-28 rounded-lg" />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {Array.from({ length: count }, (_, i) => (
          <li key={i}>
            <Skeleton className="h-36 rounded-2xl" />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Carregando" className="mx-auto grid max-w-7xl gap-6">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <TableGridSkeleton count={10} />
    </div>
  )
}
