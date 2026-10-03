import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireRoleWith } from "@/lib/auth"
import { FLOOR_ROLES, isManager } from "@/lib/roles"
import { getCheckoutData } from "@/services/billing"
import { tableLabel } from "@/lib/format"
import { AutoPrint } from "./auto-print"

export const metadata: Metadata = { title: "Pré-conta" }

// Cupom de pré-conta para impressora térmica de 80 mm (área útil ~72 mm, ~42 caracteres por linha).
// Aberto num iframe invisível pelo botão "Imprimir pré-conta"; também pode ser aberto direto para conferir.

const num = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })
const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })

interface Line {
  nome: string
  opcoes: string
  quantidade: number
  total: number
}

export default async function PreBillPage({ params, searchParams }: PageProps<"/imprimir/pre-conta/[id]">) {
  const { id } = await params
  const sp = await searchParams
  const {
    profile,
    restaurant,
    data: { table, checkout },
  } = await requireRoleWith(FLOOR_ROLES, () => getCheckoutData(id))
  if (!table || !checkout) notFound()

  // mesmos itens iguais (produto + opções + observação) somados numa linha só
  const lines = new Map<string, Line>()
  for (const order of checkout.orders) {
    if (order.status === "cancelado" || order.status === "devolvido") continue
    for (const item of order.itens_pedido) {
      if (item.cancelado) continue
      const opcoes = [...item.itens_pedido_opcoes.map((o) => o.opcao_nome), item.observacao].filter(Boolean).join(" · ")
      const key = `${item.produto_nome}|${opcoes}|${item.preco_unitario}`
      const line = lines.get(key) ?? { nome: item.produto_nome, opcoes, quantidade: 0, total: 0 }
      line.quantidade += item.quantidade
      line.total = Math.round((line.total + item.quantidade * item.preco_unitario) * 100) / 100
      lines.set(key, line)
    }
  }
  const items = [...lines.values()]
  const subtotal = Math.round(items.reduce((s, l) => s + l.total, 0) * 100) / 100
  const semServico = sp.servico === "0"
  const servico = semServico ? 0 : Math.round(subtotal * checkout.serviceFeePercent) / 100
  const total = Math.round((subtotal + servico) * 100) / 100
  const pessoas = table.pessoas && table.pessoas > 1 ? table.pessoas : null

  return (
    <>
      <style>{`
        /* "80mm auto" é inválido em CSS e faria o navegador ignorar a regra (página Carta/A4 encolhida na bobina).
           Altura provisória; o tamanho exato é calculado pelo AutoPrint a partir do cupom. */
        @page { size: 80mm 297mm; margin: 0; }
        html, body { background: #fff !important; color: #000 !important; }
        .cupom { width: 72mm; margin: 0 auto; padding: 3mm 0 6mm; font: 12px/1.35 "Segoe UI", Arial, sans-serif; color: #000; }
        .cupom * { color: #000 !important; }
        .linha { display: flex; justify-content: space-between; gap: 2mm; }
        .linha > :last-child { white-space: nowrap; font-variant-numeric: tabular-nums; }
        .sep { border: 0; border-top: 1px dashed #000; margin: 2mm 0; }
        @media screen { body { padding: 16px 0; background: #e5e5e5 !important; } .cupom { background: #fff; padding: 4mm; box-shadow: 0 1px 4px rgba(0,0,0,.2); } }
        @media print { .so-tela { display: none !important; } }
      `}</style>
      <main className="cupom">
        <div style={{ textAlign: "center" }}>
          {/* logo em preto e branco de alto contraste (térmica só imprime preto); logo próprio enviado nas configurações vira cinza */}
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem simples para impressão, sem otimização */}
          <img
            src={restaurant.logo_url ?? "/brand/logo-cupom.png"}
            alt={restaurant.nome}
            style={{ display: "block", width: "32mm", height: "auto", margin: "0 auto 2mm", filter: restaurant.logo_url ? "grayscale(1) contrast(1.3)" : undefined }}
          />
          <div style={{ fontSize: 16, fontWeight: 800 }}>{restaurant.nome}</div>
          {restaurant.endereco && <div>{restaurant.endereco}</div>}
          {restaurant.telefone && <div>Tel.: {restaurant.telefone}</div>}
        </div>
        <hr className="sep" />
        <div style={{ textAlign: "center", fontWeight: 800, fontSize: 14 }}>PRÉ-CONTA</div>
        <div style={{ textAlign: "center", fontSize: 11 }}>Não é documento fiscal</div>
        <hr className="sep" />
        <div className="linha">
          <strong style={{ fontSize: 14 }}>{tableLabel(table.numero)}</strong>
          <span>{dataHora.format(new Date())}</span>
        </div>
        {table.garcom_nome && <div>Garçom: {table.garcom_nome}</div>}
        <div>
          {table.aberto_em && `Aberta às ${hora.format(new Date(table.aberto_em))}`}
          {table.pessoas ? ` · ${table.pessoas} ${table.pessoas === 1 ? "pessoa" : "pessoas"}` : ""}
        </div>
        <hr className="sep" />
        <div className="linha" style={{ fontWeight: 700 }}>
          <span>Qtd  Item</span>
          <span>Valor</span>
        </div>
        {items.length === 0 && <div>Nenhum item lançado.</div>}
        {items.map((l, i) => (
          <div key={i} style={{ marginTop: "1mm" }}>
            <div className="linha">
              <span>
                {l.quantidade}x {l.nome}
              </span>
              <span>{num.format(l.total)}</span>
            </div>
            {l.opcoes && <div style={{ paddingLeft: "4mm", fontSize: 11 }}>{l.opcoes}</div>}
          </div>
        ))}
        <hr className="sep" />
        <div className="linha">
          <span>Subtotal</span>
          <span>{num.format(subtotal)}</span>
        </div>
        {!semServico && checkout.serviceFeePercent > 0 && (
          <div className="linha">
            <span>Serviço ({num.format(checkout.serviceFeePercent).replace(",00", "")}%) opcional</span>
            <span>{num.format(servico)}</span>
          </div>
        )}
        <div className="linha" style={{ fontSize: 18, fontWeight: 800, marginTop: "1mm" }}>
          <span>TOTAL</span>
          <span>{brl.format(total)}</span>
        </div>
        {pessoas && (
          <div className="linha">
            <span>Por pessoa ({pessoas})</span>
            <span>{brl.format(Math.round((total / pessoas) * 100) / 100)}</span>
          </div>
        )}
        <hr className="sep" />
        <div style={{ textAlign: "center" }}>Confira os itens antes de pagar.</div>
        <div style={{ textAlign: "center", fontWeight: 700 }}>Obrigado pela preferência!</div>
      </main>
      <AutoPrint
        auto={sp.auto === "1"}
        backHref={isManager(profile.papel) ? `/admin/conta/${id}` : `/garcom/mesa/${id}/conta`}
        homeHref={isManager(profile.papel) ? "/admin" : "/garcom"}
        atendimentoId={checkout.atendimentoId}
        billRequested={checkout.billRequested}
        tableLabel={tableLabel(table.numero)}
      />
    </>
  )
}
