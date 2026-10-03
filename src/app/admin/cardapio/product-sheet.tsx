"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ImageUp, Loader2, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Field } from "@/components/forms/field"
import { NativeSelect } from "@/components/forms/native-select"
import { ConfirmDialog } from "@/components/feedback/confirm-dialog"
import { deleteProduct, saveProduct } from "@/features/menu/actions"
import { productSchema, type ProductInput } from "@/schemas/menu"
import { createClient } from "@/lib/supabase/client"
import { compressImage, toMoneyInput } from "@/lib/image"
import { friendlyError } from "@/lib/errors"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Category, ModifierGroup, Product, ProductGroupLink } from "@/types/domain"

export type ProductTarget = { mode: "create"; categoryId: string } | { mode: "edit"; product: Product }

interface ProductSheetProps {
  target: ProductTarget | null
  restaurantId: string
  categories: Category[]
  groups: ModifierGroup[]
  links: ProductGroupLink[]
  onClose: () => void
}

export function ProductSheet({ target, restaurantId, categories, groups, links, onClose }: ProductSheetProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const editing = target?.mode === "edit" ? target.product : null

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProductInput>({ resolver: zodResolver(productSchema) as never })
  const imageUrl = useWatch({ control, name: "imagem_url" })

  useEffect(() => {
    if (!target) return
    if (target.mode === "create") {
      reset({
        categoria_id: target.categoryId,
        nome: "",
        descricao: "",
        preco: "",
        tempo_preparo_min: 10,
        ativo: true,
        imagem_url: null,
        grupos_ids: [],
      })
    } else {
      const p = target.product
      reset({
        id: p.id,
        categoria_id: p.categoria_id,
        nome: p.nome,
        descricao: p.descricao ?? "",
        preco: toMoneyInput(p.preco),
        tempo_preparo_min: p.tempo_preparo_min,
        ativo: p.ativo,
        imagem_url: p.imagem_url,
        grupos_ids: links.filter((l) => l.produto_id === p.id).sort((a, b) => a.ordem - b.ordem).map((l) => l.grupo_id),
      })
    }
  }, [target, links, reset])

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.")
      return
    }
    setUploading(true)
    try {
      const blob = await compressImage(file)
      const path = `${restaurantId}/${crypto.randomUUID()}.webp`
      const supabase = createClient()
      const { error } = await supabase.storage
        .from("imagens-produtos")
        .upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" })
      if (error) {
        toast.error(friendlyError(error, "Não foi possível enviar a foto."))
        return
      }
      setValue("imagem_url", supabase.storage.from("imagens-produtos").getPublicUrl(path).data.publicUrl, { shouldDirty: true })
    } catch {
      toast.error("Não foi possível ler esta imagem. Tente outra foto.")
    } finally {
      setUploading(false)
    }
  }

  async function onSubmit(values: ProductInput) {
    const result = await saveProduct(values)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(editing ? "Produto atualizado." : "Produto cadastrado.")
    onClose()
    router.refresh()
  }

  async function onDelete() {
    if (!editing) return
    const result = await deleteProduct(editing.id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`${editing.nome} excluído.`)
    setConfirmDelete(false)
    onClose()
    router.refresh()
  }

  return (
    <>
      <Sheet open={!!target} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          <SheetHeader className="border-b p-5">
            <SheetTitle className="text-xl font-extrabold">{editing ? `Editar ${editing.nome}` : "Novo produto"}</SheetTitle>
            <SheetDescription>Foto, preço, categoria e opções de personalização.</SheetDescription>
          </SheetHeader>

          <form id="product-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 p-5">
            {/* Foto */}
            <div className="grid gap-2">
              <span className="text-sm font-semibold">Foto</span>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted">
                {imageUrl ? (
                  <>
                    <Image src={imageUrl} alt="Foto do produto" fill sizes="(min-width: 640px) 32rem, 100vw" className="object-cover" />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-lg"
                      className="absolute top-2 right-2 size-10 shadow"
                      onClick={() => setValue("imagem_url", null, { shouldDirty: true })}
                      aria-label="Remover foto"
                    >
                      <X />
                    </Button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 grid place-items-center gap-1 text-muted-foreground outline-none hover:bg-muted/70 focus-visible:ring-4 focus-visible:ring-ring/50"
                  >
                    <span className="grid justify-items-center gap-1">
                      {uploading ? <Loader2 className="size-8 animate-spin" aria-hidden /> : <ImageUp className="size-8" aria-hidden />}
                      <span className="text-sm font-semibold">{uploading ? "Enviando foto…" : "Adicionar foto"}</span>
                    </span>
                  </button>
                )}
              </div>
              {imageUrl && (
                <Button type="button" variant="outline" className="h-10 w-fit" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="animate-spin" /> : <ImageUp className="size-4" aria-hidden />} Trocar foto
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                aria-label="Arquivo da foto"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) upload(file)
                  e.target.value = ""
                }}
              />
            </div>

            <Field id="nome" label="Nome" error={errors.nome?.message}>
              <Input id="nome" className="h-12 text-base" placeholder="Ex.: X-Burger" aria-invalid={!!errors.nome} {...register("nome")} />
            </Field>

            <Field id="descricao" label="Descrição curta" hint="Aparece no cartão do garçom. Opcional." error={errors.descricao?.message}>
              <Textarea id="descricao" rows={2} placeholder="Ex.: Blend 150 g, queijo e molho da casa" {...register("descricao")} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field id="preco" label="Preço (R$)" error={errors.preco?.message}>
                <Input id="preco" inputMode="decimal" placeholder="0,00" className="h-12 text-lg font-bold" aria-invalid={!!errors.preco} {...register("preco")} />
              </Field>
              <Field id="tempo_preparo_min" label="Preparo (min)" error={errors.tempo_preparo_min?.message}>
                <Input id="tempo_preparo_min" type="number" inputMode="numeric" className="h-12 text-lg" {...register("tempo_preparo_min")} />
              </Field>
            </div>

            <Field id="categoria_id" label="Categoria" error={errors.categoria_id?.message}>
              <NativeSelect id="categoria_id" {...register("categoria_id")}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Controller
              control={control}
              name="grupos_ids"
              render={({ field }) => (
                <fieldset className="grid gap-2">
                  <legend className="mb-1.5 text-sm font-semibold">Opções de personalização</legend>
                  {groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum grupo de opções criado. Use o botão &quot;Opções&quot; do cardápio para criar (ex.: Ponto da carne).
                    </p>
                  ) : (
                    groups.map((g) => {
                      const checked = (field.value ?? []).includes(g.id)
                      return (
                        <label
                          key={g.id}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors",
                            checked ? "border-primary bg-primary/5" : "border-border"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 size-5 accent-[var(--primary)]"
                            checked={checked}
                            onChange={(e) =>
                              field.onChange(
                                e.target.checked ? [...(field.value ?? []), g.id] : (field.value ?? []).filter((id) => id !== g.id)
                              )
                            }
                          />
                          <span className="grid gap-0.5">
                            <span className="font-semibold">
                              {g.nome}
                              <span className="ml-2 text-xs font-medium text-muted-foreground">
                                {g.min_escolhas > 0 ? "Obrigatório" : "Opcional"} · até {g.max_escolhas}
                              </span>
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {g.opcoes
                                .map((o) => (Number(o.acrescimo) > 0 ? `${o.nome} (+${formatCurrency(o.acrescimo)})` : o.nome))
                                .join(", ")}
                            </span>
                          </span>
                        </label>
                      )
                    })
                  )}
                </fieldset>
              )}
            />

            <Controller
              control={control}
              name="ativo"
              render={({ field }) => (
                <label className="flex items-center justify-between gap-4 rounded-xl border p-4">
                  <span>
                    <span className="block font-semibold">Disponível para venda</span>
                    <span className="text-sm text-muted-foreground">Desligue quando acabar; o garçom vê como indisponível.</span>
                  </span>
                  <Switch checked={!!field.value} onCheckedChange={field.onChange} aria-label="Disponível para venda" />
                </label>
              )}
            />
          </form>

          <SheetFooter className="mt-auto flex-row gap-2 border-t p-4">
            {editing && (
              <Button type="button" variant="destructive" className="h-12" onClick={() => setConfirmDelete(true)} aria-label="Excluir produto">
                <Trash2 className="size-4" aria-hidden />
              </Button>
            )}
            <Button type="button" variant="outline" className="h-12 flex-1" onClick={onClose}>
              Voltar
            </Button>
            <Button type="submit" form="product-form" className="h-12 flex-[2] font-semibold" disabled={isSubmitting || uploading}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Tem certeza que deseja excluir ${editing?.nome ?? "este produto"}?`}
        description="Os pedidos antigos continuam com o nome e o preço registrados. Para pausar a venda, prefira marcar como indisponível."
        onConfirm={onDelete}
      />
    </>
  )
}
