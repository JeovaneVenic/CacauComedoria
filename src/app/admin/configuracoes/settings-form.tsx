"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ImageUp, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Field } from "@/components/forms/field"
import { LogoMark } from "@/components/brand/logo"
import { updateRestaurant } from "@/features/restaurant/actions"
import { restaurantSchema, WEEK_DAYS, type RestaurantInput } from "@/schemas/restaurant"
import { createClient } from "@/lib/supabase/client"
import { friendlyError } from "@/lib/errors"
import type { Restaurant } from "@/types/domain"

export function SettingsForm({ restaurant }: { restaurant: Restaurant }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<RestaurantInput>({
    resolver: zodResolver(restaurantSchema) as never,
    defaultValues: {
      nome: restaurant.nome,
      endereco: restaurant.endereco ?? "",
      telefone: restaurant.telefone ?? "",
      taxa_servico_percentual: Number(restaurant.taxa_servico_percentual),
      garcom_pode_fechar_mesa: restaurant.garcom_pode_fechar_mesa,
      horario_funcionamento: Object.fromEntries(WEEK_DAYS.map((d) => [d.key, restaurant.horario_funcionamento?.[d.key] ?? ""])) as RestaurantInput["horario_funcionamento"],
      logo_url: restaurant.logo_url,
    },
  })
  const logoUrl = useWatch({ control, name: "logo_url" })

  async function uploadLogo(file: File) {
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      toast.error("Use uma imagem PNG, JPG, WEBP ou SVG.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2 MB.")
      return
    }
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png"
    const path = `${restaurant.id}/logo-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true, contentType: file.type })
    setUploading(false)
    if (error) {
      toast.error(friendlyError(error, "Não foi possível enviar a imagem."))
      return
    }
    const { data } = supabase.storage.from("logos").getPublicUrl(path)
    setValue("logo_url", data.publicUrl, { shouldDirty: true })
  }

  async function onSubmit(values: RestaurantInput) {
    const result = await updateRestaurant(values)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Configurações salvas.")
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6">
      <section aria-labelledby="dados" className="grid gap-5 rounded-2xl border bg-card p-5">
        <h2 id="dados" className="text-lg font-bold">
          Restaurante
        </h2>

        <div className="flex items-center gap-4">
          {logoUrl ? (
            <Image src={logoUrl} alt="Logo atual" width={64} height={64} className="size-16 rounded-xl border object-contain" unoptimized />
          ) : (
            <LogoMark className="size-16" />
          )}
          <div className="grid gap-1">
            <Button type="button" variant="outline" className="h-11" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : <ImageUp className="size-4" aria-hidden />}
              {logoUrl ? "Trocar logo" : "Enviar logo"}
            </Button>
            <p className="text-xs text-muted-foreground">PNG, JPG, WEBP ou SVG até 2 MB.</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="sr-only"
            tabIndex={-1}
            aria-label="Arquivo do logo"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadLogo(file)
              e.target.value = ""
            }}
          />
        </div>

        <Field id="nome" label="Nome do restaurante" error={errors.nome?.message}>
          <Input id="nome" className="h-12" aria-invalid={!!errors.nome} {...register("nome")} />
        </Field>
        <Field id="endereco" label="Endereço" error={errors.endereco?.message}>
          <Input id="endereco" className="h-12" autoComplete="street-address" {...register("endereco")} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="telefone" label="Telefone" error={errors.telefone?.message}>
            <Input id="telefone" type="tel" inputMode="tel" className="h-12" placeholder="(73) 3231-0000" {...register("telefone")} />
          </Field>
          <Field id="currency" label="Moeda">
            <Input id="currency" className="h-12" value="Real brasileiro (R$)" readOnly disabled />
          </Field>
        </div>
      </section>

      <section aria-labelledby="operacao" className="grid gap-5 rounded-2xl border bg-card p-5">
        <h2 id="operacao" className="text-lg font-bold">
          Operação
        </h2>
        <Field
          id="taxa_servico_percentual"
          label="Taxa de serviço (%)"
          hint="Aplicada sobre o subtotal de cada mesa. Use 0 para não cobrar."
          error={errors.taxa_servico_percentual?.message}
          className="max-w-xs"
        >
          <Input id="taxa_servico_percentual" type="number" inputMode="decimal" step="0.5" className="h-12" {...register("taxa_servico_percentual")} />
        </Field>
        <Controller
          control={control}
          name="garcom_pode_fechar_mesa"
          render={({ field }) => (
            <label className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <span>
                <span className="block font-semibold">Garçons podem fechar a mesa</span>
                <span className="text-sm text-muted-foreground">Permite registrar o pagamento direto no tablet.</span>
              </span>
              <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Garçons podem fechar a mesa" />
            </label>
          )}
        />
      </section>

      <section aria-labelledby="horarios" className="grid gap-4 rounded-2xl border bg-card p-5">
        <div>
          <h2 id="horarios" className="text-lg font-bold">
            Horário de funcionamento
          </h2>
          <p className="text-sm text-muted-foreground">Formato 11:00-23:00. Deixe vazio nos dias fechados.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {WEEK_DAYS.map((d) => (
            <Field key={d.key} id={`h-${d.key}`} label={d.label} error={errors.horario_funcionamento?.[d.key]?.message}>
              <Input id={`h-${d.key}`} className="h-11" placeholder="Fechado" inputMode="numeric" {...register(`horario_funcionamento.${d.key}`)} />
            </Field>
          ))}
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border">
        <Button type="submit" className="h-12 min-w-40 font-semibold" disabled={isSubmitting || !isDirty}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Salvar alterações
        </Button>
      </div>
    </form>
  )
}
