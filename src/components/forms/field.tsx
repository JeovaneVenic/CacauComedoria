import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface FieldProps {
  id: string
  label: string
  error?: string
  hint?: string
  className?: string
  children: React.ReactNode
}

/** Rótulo + campo + mensagem de erro acessível (aria-describedby = `${id}-erro`) */
export function Field({ id, label, error, hint, className, children }: FieldProps) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      {children}
      {hint && !error && (
        <p id={`${id}-dica`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-erro`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
