"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { History, KeyRound, Loader2, Pencil, Plus, UserCheck, UserX, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/forms/field"
import { NativeSelect } from "@/components/forms/native-select"
import { ConfirmDialog } from "@/components/feedback/confirm-dialog"
import { PageHeader } from "@/components/layout/page-header"
import { createStaff, resetStaffPassword, setStaffActive, updateStaff } from "@/features/users/actions"
import { createStaffSchema, updateStaffSchema, type CreateStaffInput, type UpdateStaffInput } from "@/schemas/users"
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/roles"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { AppRole, Profile } from "@/types/domain"

interface TeamManagerProps {
  members: Profile[]
  currentUserId: string
  currentRole: AppRole
  adminKeyConfigured: boolean
}

export function TeamManager({ members, currentUserId, currentRole, adminKeyConfigured }: TeamManagerProps) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [resetting, setResetting] = useState<Profile | null>(null)
  const [toggling, setToggling] = useState<Profile | null>(null)
  const roles = ASSIGNABLE_ROLES.filter((r) => r !== "gerente" || currentRole === "proprietario" || currentRole === "administrador")

  const activeCount = members.filter((m) => m.ativo).length

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Usuários"
        description={`${activeCount} ${activeCount === 1 ? "pessoa ativa" : "pessoas ativas"} na equipe.`}
        actions={
          <Button className="h-11 font-semibold" onClick={() => setCreating(true)} disabled={!adminKeyConfigured}>
            <Plus className="size-4" aria-hidden /> Novo usuário
          </Button>
        }
      />

      {!adminKeyConfigured && (
        <p role="status" className="mb-4 rounded-xl border border-status-waiting/30 bg-status-waiting-soft px-4 py-3 text-sm font-medium text-status-waiting">
          Para criar usuários e redefinir senhas, configure a chave <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> no
          arquivo <code className="font-mono">.env.local</code> do servidor.
        </p>
      )}

      {members.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed p-10 text-center">
          <Users className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-semibold">Nenhum usuário cadastrado.</p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {members.map((m) => {
            const isSelf = m.id === currentUserId
            const isOwner = m.papel === "proprietario"
            // mesma regra do servidor: gerentes só são geridos pelo proprietário
            const manageable =
              !isSelf && !isOwner && (!(m.papel === "gerente" || m.papel === "administrador") || currentRole === "proprietario" || currentRole === "administrador")
            return (
              <li
                key={m.id}
                className={cn("flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4", !m.ativo && "bg-muted/50")}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-12 shrink-0 place-items-center rounded-full font-bold",
                    m.ativo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {m.nome
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p: string) => p[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">
                    {m.nome}
                    {isSelf && <span className="ml-2 text-sm font-medium text-muted-foreground">(você)</span>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{m.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground uppercase">
                    {ROLE_LABELS[m.papel]}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase",
                      m.ativo ? "bg-status-free-soft text-status-free" : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {m.ativo ? <UserCheck className="size-3.5" aria-hidden /> : <UserX className="size-3.5" aria-hidden />}
                    {m.ativo ? "Ativo" : "Desativado"}
                  </span>
                </div>
                <p className="hidden text-sm text-muted-foreground md:block">Desde {formatDate(m.criado_em)}</p>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="size-11"
                    render={<Link href={`/admin/auditoria?autor=${m.id}`} />}
                    nativeButton={false}
                    aria-label={`Atividades de ${m.nome}`}
                  >
                    <History />
                  </Button>
                  {(isSelf || manageable) && (
                    <Button variant="ghost" size="icon-lg" className="size-11" onClick={() => setEditing(m)} aria-label={`Editar ${m.nome}`}>
                      <Pencil />
                    </Button>
                  )}
                  {manageable && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className="size-11"
                        onClick={() => setResetting(m)}
                        disabled={!adminKeyConfigured}
                        aria-label={`Redefinir senha de ${m.nome}`}
                      >
                        <KeyRound />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className={cn("size-11", m.ativo && "text-destructive")}
                        onClick={() => setToggling(m)}
                        aria-label={m.ativo ? `Desativar ${m.nome}` : `Reativar ${m.nome}`}
                      >
                        {m.ativo ? <UserX /> : <UserCheck />}
                      </Button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <CreateStaffDialog
        open={creating}
        onOpenChange={setCreating}
        roles={roles}
        onDone={() => {
          setCreating(false)
          router.refresh()
        }}
      />
      <EditStaffDialog
        member={editing}
        roles={roles}
        currentUserId={currentUserId}
        onClose={() => setEditing(null)}
        onDone={() => {
          setEditing(null)
          router.refresh()
        }}
      />
      <ResetPasswordDialog member={resetting} onClose={() => setResetting(null)} />
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={
          toggling?.ativo
            ? `Tem certeza que deseja desativar ${toggling.nome}?`
            : `Reativar ${toggling?.nome ?? ""}?`
        }
        description={toggling?.ativo ? "A pessoa perde o acesso imediatamente. O histórico de pedidos é mantido." : undefined}
        destructive={!!toggling?.ativo}
        onConfirm={async () => {
          if (!toggling) return
          const result = await setStaffActive(toggling.id, !toggling.ativo)
          if (!result.ok) toast.error(result.error)
          else {
            toast.success(toggling.ativo ? "Usuário desativado." : "Usuário reativado.")
            setToggling(null)
            router.refresh()
          }
        }}
      />
    </div>
  )
}

function RoleOptions({ roles }: { roles: AppRole[] }) {
  return (
    <>
      {roles.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </>
  )
}

function CreateStaffDialog({
  open,
  onOpenChange,
  roles,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: AppRole[]
  onDone: () => void
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStaffInput>({ resolver: zodResolver(createStaffSchema), defaultValues: { papel: "garcom" } })

  async function onSubmit(values: CreateStaffInput) {
    const result = await createStaff(values)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`${values.nome} cadastrado. Informe a senha provisória pessoalmente.`)
    reset({ papel: "garcom" })
    onDone()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Novo usuário</DialogTitle>
          <DialogDescription>A pessoa entra com este e-mail e a senha provisória.</DialogDescription>
        </DialogHeader>
        <form id="create-staff" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
          <Field id="nome" label="Nome completo" error={errors.nome?.message}>
            <Input id="nome" className="h-12" autoComplete="off" aria-invalid={!!errors.nome} {...register("nome")} />
          </Field>
          <Field id="new-email" label="E-mail" error={errors.email?.message}>
            <Input id="new-email" type="email" className="h-12" autoComplete="off" aria-invalid={!!errors.email} {...register("email")} />
          </Field>
          <Field id="new-password" label="Senha provisória" hint="Mínimo de 8 caracteres." error={errors.senha?.message}>
            <Input id="new-password" type="password" className="h-12" autoComplete="new-password" aria-invalid={!!errors.senha} {...register("senha")} />
          </Field>
          <Field id="role" label="Função" error={errors.papel?.message}>
            <NativeSelect id="role" {...register("papel")}>
              <RoleOptions roles={roles} />
            </NativeSelect>
          </Field>
        </form>
        <DialogFooter className="-mx-6 -mb-6 p-4">
          <Button variant="outline" className="h-12" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button type="submit" form="create-staff" className="h-12 font-semibold" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditStaffDialog({
  member,
  roles,
  currentUserId,
  onClose,
  onDone,
}: {
  member: Profile | null
  currentUserId: string
  roles: AppRole[]
  onClose: () => void
  onDone: () => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateStaffInput>({
    resolver: zodResolver(updateStaffSchema),
    values: member
      ? { id: member.id, nome: member.nome, papel: (member.papel === "proprietario" ? "gerente" : member.papel) as UpdateStaffInput["papel"] }
      : undefined,
  })
  // a função da proprietária e a da própria pessoa não mudam por aqui
  const isOwner = member?.papel === "proprietario" || member?.id === currentUserId

  async function onSubmit(values: UpdateStaffInput) {
    const result = await updateStaff(values)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Usuário atualizado.")
    onDone()
  }

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Editar usuário</DialogTitle>
          <DialogDescription>{member?.email}</DialogDescription>
        </DialogHeader>
        <form id="edit-staff" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
          <Field id="edit-name" label="Nome completo" error={errors.nome?.message}>
            <Input id="edit-name" className="h-12" aria-invalid={!!errors.nome} {...register("nome")} />
          </Field>
          {isOwner ? (
            <input type="hidden" {...register("papel")} />
          ) : (
            <Field id="edit-role" label="Função" error={errors.papel?.message}>
              <NativeSelect id="edit-role" {...register("papel")}>
                <RoleOptions roles={roles.includes(member?.papel as AppRole) || !member ? roles : [...roles, member.papel]} />
              </NativeSelect>
            </Field>
          )}
        </form>
        <DialogFooter className="-mx-6 -mb-6 p-4">
          <Button variant="outline" className="h-12" onClick={onClose}>
            Voltar
          </Button>
          <Button type="submit" form="edit-staff" className="h-12 font-semibold" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ member, onClose }: { member: Profile | null; onClose: () => void }) {
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!member) return
    setBusy(true)
    setError(null)
    const result = await resetStaffPassword(member.id, password)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success(`Senha de ${member.nome} redefinida.`)
    setPassword("")
    onClose()
  }

  return (
    <Dialog
      open={!!member}
      onOpenChange={(o) => {
        if (!o) {
          setPassword("")
          setError(null)
          onClose()
        }
      }}
    >
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Redefinir senha</DialogTitle>
          <DialogDescription>Nova senha provisória para {member?.nome}.</DialogDescription>
        </DialogHeader>
        <form id="reset-password" onSubmit={submit} noValidate>
          <Field id="reset-pass" label="Nova senha" hint="Mínimo de 8 caracteres." error={error ?? undefined}>
            <Input
              id="reset-pass"
              type="password"
              className="h-12"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!error}
            />
          </Field>
        </form>
        <DialogFooter className="-mx-6 -mb-6 p-4">
          <Button variant="outline" className="h-12" onClick={onClose}>
            Voltar
          </Button>
          <Button type="submit" form="reset-password" className="h-12 font-semibold" disabled={busy || password.length < 8}>
            {busy && <Loader2 className="animate-spin" />}
            Redefinir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
