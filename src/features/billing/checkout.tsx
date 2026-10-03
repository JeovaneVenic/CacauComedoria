"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, Banknote, CreditCard, Loader2, QrCode, Receipt, Wallet, X, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ConfirmDialog } from "@/components/feedback/confirm-dialog"
import { closeTable, requestBill, type Payment } from "@/features/orders/api"
import { formatCurrency, tableLabel } from "@/lib/format"
import { toMoneyInput } from "@/lib/image"
import { cn } from "@/lib/utils"
import type { OrderRow } from "@/services/orders"
import { PrintPreBillButton } from "./print-pre-bill-button"

const METHODS: { id: Payment["forma"]; label: string; icon: LucideIcon }[] = [
  { id: "pix", label: "Pix", icon: QrCode },
  { id: "credito", label: "Crédito", icon: CreditCard },
  { id: "debito", label: "Débito", icon: Wallet },
  { id: "dinheiro", label: "Dinheiro", icon: Banknote },
]

const METHOD_LABEL = Object.fromEntries(METHODS.map((m) => [m.id, m.label])) as Record<Payment["forma"], string>

function parseMoney(v: string) {
  const clean = v.replace(/[R$\s]/g, "")
  const n = Number(clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0
}

const round = (n: number) => Math.round(n * 100) / 100

interface CheckoutProps {
  mesaId: string
  atendimentoId: string
  tableNumber: number
  orders: OrderRow[]
  serviceFeePercent: number
  billRequested: boolean
  canClose: boolean
  backHref: string
}

export function Checkout({ mesaId, atendimentoId, tableNumber, orders, serviceFeePercent, billRequested, canClose, backHref }: CheckoutProps) {
  const router = useRouter()
  const [noService, setNoService] = useState(false)
  const [discountText, setDiscountText] = useState("")
  const [payments, setPayments] = useState<{ key: string; forma: Payment["forma"]; valor: string }[]>([])
  const [confirming, setConfirming] = useState(false)
  const [requesting, setRequesting] = useState(false)

  const valid = orders.filter((o) => o.status !== "cancelado" && o.status !== "devolvido")
  const inKitchen = valid.filter((o) => o.status === "novo" || o.status === "em_preparo")
  const subtotal = round(valid.reduce((s, o) => s + o.subtotal, 0))
  const service = noService ? 0 : round((subtotal * serviceFeePercent) / 100)
  const discount = Math.min(parseMoney(discountText), subtotal + service)
  const total = round(Math.max(subtotal + service - discount, 0))
  const paid = round(payments.reduce((s, p) => s + parseMoney(p.valor), 0))
  const remaining = round(total - paid)
  const cash = round(payments.filter((p) => p.forma === "dinheiro").reduce((s, p) => s + parseMoney(p.valor), 0))
  const change = remaining < 0 ? -remaining : 0
  const changeOk = change === 0 || cash >= change
  const ready = canClose && inKitchen.length === 0 && remaining <= 0.009 && changeOk && (total === 0 || payments.length > 0)

  function addPayment(forma: Payment["forma"]) {
    setPayments((list) => [...list, { key: crypto.randomUUID(), forma, valor: toMoneyInput(Math.max(remaining, 0)) }])
  }

  async function askBill() {
    setRequesting(true)
    const result = await requestBill(atendimentoId)
    setRequesting(false)
    if (!result.ok) toast.error(result.error)
    else {
      toast.success(`Conta da ${tableLabel(tableNumber)} solicitada.`)
      router.refresh()
    }
  }

  async function finish() {
    const result = await closeTable(
      atendimentoId,
      payments.map((p) => ({ forma: p.forma, valor: parseMoney(p.valor) })).filter((p) => p.valor > 0),
      discount,
      noService
    )
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    const troco = result.data?.troco ?? 0
    toast.success(`${tableLabel(tableNumber)} fechada${troco > 0 ? ` · troco ${formatCurrency(troco)}` : ""}.`)
    setConfirming(false)
    router.push(backHref)
    router.refresh()
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <Link href={backHref} className="inline-flex h-11 w-fit items-center gap-2 pr-3 font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-5" aria-hidden /> Voltar
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Conta · {tableLabel(tableNumber)}</h1>
          <p className="text-muted-foreground">
            {valid.length} {valid.length === 1 ? "pedido" : "pedidos"}
            {billRequested && " · conta solicitada"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {valid.length > 0 && <PrintPreBillButton mesaId={mesaId} semServico={noService} />}
          {!billRequested && (
            <Button variant="outline" className="h-12" onClick={askBill} disabled={requesting}>
              {requesting ? <Loader2 className="animate-spin" /> : <Receipt className="size-5" aria-hidden />} Pedir a conta
            </Button>
          )}
        </div>
      </header>

      {inKitchen.length > 0 && (
        <p role="alert" className="flex gap-2 rounded-xl border border-status-preparing/40 bg-status-preparing-soft p-4 text-sm font-semibold text-status-preparing">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          {inKitchen.length === 1 ? "Ainda há 1 pedido" : `Ainda há ${inKitchen.length} pedidos`} na cozinha (
          {inKitchen.map((o) => `#${o.numero}`).join(", ")}). A mesa só pode ser fechada depois que tudo estiver pronto.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Itens consumidos */}
        <section aria-labelledby="consumo" className="rounded-2xl border bg-card">
          <h2 id="consumo" className="border-b p-4 text-lg font-bold">
            Consumo
          </h2>
          {valid.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">Nenhum consumo nesta mesa.</p>
          ) : (
            <ul className="divide-y">
              {valid.flatMap((o) =>
                o.itens_pedido
                  .filter((i) => !i.cancelado)
                  .map((i) => (
                    <li key={i.id} className="flex justify-between gap-3 px-4 py-3">
                      <span>
                        <span className="font-semibold">
                          {i.quantidade}x {i.produto_nome}
                        </span>
                        {i.itens_pedido_opcoes.length > 0 && (
                          <span className="block text-sm text-muted-foreground">{i.itens_pedido_opcoes.map((m) => m.opcao_nome).join(" · ")}</span>
                        )}
                      </span>
                      <span className="tabular-nums">{formatCurrency(i.quantidade * i.preco_unitario)}</span>
                    </li>
                  ))
              )}
            </ul>
          )}
        </section>

        {/* Fechamento */}
        <section aria-labelledby="pagamento" className="grid content-start gap-4 rounded-2xl border bg-card p-4">
          <h2 id="pagamento" className="text-lg font-bold">
            Pagamento
          </h2>

          <dl className="grid gap-1.5 text-base">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{formatCurrency(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Serviço ({noService ? 0 : serviceFeePercent}%)</dt>
              <dd className="tabular-nums">{formatCurrency(service)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-status-free">
                <dt>Desconto</dt>
                <dd className="tabular-nums">− {formatCurrency(discount)}</dd>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t pt-2 text-2xl font-extrabold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatCurrency(total)}</dd>
            </div>
          </dl>

          <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm font-semibold">
            Retirar taxa de serviço
            <Switch checked={noService} onCheckedChange={setNoService} disabled={!canClose} aria-label="Retirar taxa de serviço" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Desconto (R$)
            <Input
              value={discountText}
              onChange={(e) => setDiscountText(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="h-12 text-base"
              disabled={!canClose}
            />
          </label>

          {canClose ? (
            <>
              <div className="grid gap-2">
                <span className="text-sm font-semibold">Adicionar forma de pagamento</span>
                <div className="grid grid-cols-2 gap-2">
                  {METHODS.map((m) => (
                    <Button key={m.id} variant="outline" className="h-14 justify-start text-base" onClick={() => addPayment(m.id)}>
                      <m.icon className="size-5" aria-hidden /> {m.label}
                    </Button>
                  ))}
                </div>
              </div>

              {payments.length > 0 && (
                <ul className="grid gap-2">
                  {payments.map((p) => (
                    <li key={p.key} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 text-sm font-bold">{METHOD_LABEL[p.forma]}</span>
                      <Input
                        value={p.valor}
                        onChange={(e) => setPayments((list) => list.map((x) => (x.key === p.key ? { ...x, valor: e.target.value } : x)))}
                        inputMode="decimal"
                        aria-label={`Valor em ${METHOD_LABEL[p.forma]}`}
                        className="h-12 text-lg font-bold"
                      />
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className="size-11"
                        onClick={() => setPayments((list) => list.filter((x) => x.key !== p.key))}
                        aria-label={`Remover pagamento em ${METHOD_LABEL[p.forma]}`}
                      >
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div
                role="status"
                className={cn(
                  "rounded-xl p-3 text-center text-lg font-extrabold",
                  remaining > 0.009 ? "bg-status-waiting-soft text-status-waiting" : changeOk ? "bg-status-free-soft text-status-free" : "bg-destructive/10 text-destructive"
                )}
              >
                {remaining > 0.009
                  ? `Falta ${formatCurrency(remaining)}`
                  : change > 0
                    ? changeOk
                      ? `Troco ${formatCurrency(change)}`
                      : "Valor acima do total: troco só em dinheiro"
                    : "Valor completo"}
              </div>

              <Button className="h-16 text-lg font-extrabold uppercase" disabled={!ready} onClick={() => setConfirming(true)}>
                Fechar conta
              </Button>
            </>
          ) : (
            <p className="rounded-xl bg-muted p-4 text-sm">
              O fechamento é feito pelo caixa ou pela gerência. Toque em <strong>Pedir a conta</strong> para avisá-los.
            </p>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        destructive={false}
        title={`Fechar a ${tableLabel(tableNumber)} em ${formatCurrency(total)}?`}
        description={`Pagamento: ${payments.map((p) => `${METHOD_LABEL[p.forma]} ${formatCurrency(parseMoney(p.valor))}`).join(" + ") || "sem valor"}${change > 0 ? ` · troco ${formatCurrency(change)}` : ""}. A mesa ficará livre.`}
        confirmLabel="Fechar conta"
        onConfirm={finish}
      />
    </div>
  )
}
