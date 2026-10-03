import { BookOpen, ClipboardList, LayoutGrid, Package, Settings, ShieldCheck, Users, Wallet, type LucideIcon } from "lucide-react"

export const AUDIT_PAGE_SIZE = 50

export const AUDIT_CATEGORIES = ["pedidos", "salao", "cardapio", "financeiro", "estoque", "equipe", "configuracoes", "outros"] as const
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]

export const AUDIT_CATEGORY: Record<AuditCategory, { label: string; icon: LucideIcon }> = {
  pedidos: { label: "Pedidos", icon: ClipboardList },
  salao: { label: "Salão e contas", icon: LayoutGrid },
  cardapio: { label: "Cardápio", icon: BookOpen },
  financeiro: { label: "Financeiro", icon: Wallet },
  estoque: { label: "Estoque", icon: Package },
  equipe: { label: "Equipe e acessos", icon: Users },
  configuracoes: { label: "Configurações", icon: Settings },
  outros: { label: "Outros", icon: ShieldCheck },
}

export function isAuditCategory(v: unknown): v is AuditCategory {
  return typeof v === "string" && (AUDIT_CATEGORIES as readonly string[]).includes(v)
}

// ---------- Detalhes legíveis ----------

const FIELD_LABEL: Record<string, string> = {
  nome: "Nome",
  descricao: "Descrição",
  preco: "Preço",
  valor: "Valor",
  ativo: "Ativo",
  ativa: "Ativa",
  capacidade: "Lugares",
  formato: "Formato",
  numero: "Número",
  setor_id: "Setor",
  categoria_id: "Categoria",
  fornecedor_id: "Fornecedor",
  imagem_url: "Foto",
  tempo_preparo_min: "Tempo de preparo (min)",
  ordem: "Ordem",
  icone: "Ícone",
  unidade: "Unidade",
  quantidade_minima: "Estoque mínimo",
  custo_unitario: "Custo",
  papel: "Função",
  telefone: "Telefone",
  email: "E-mail",
  documento: "CNPJ/CPF",
  observacao: "Observação",
  data: "Data",
  forma_pagamento: "Forma de pagamento",
  comprovante_caminho: "Comprovante",
  endereco: "Endereço",
  logo_url: "Logo",
  horario_funcionamento: "Horário",
  taxa_servico_percentual: "Taxa de serviço (%)",
  garcom_pode_fechar_mesa: "Garçom pode fechar mesa",
  baixa_estoque_automatica: "Baixa automática de estoque",
  avatar_url: "Foto do perfil",
}

const IGNORED = new Set(["id", "restaurante_id", "criado_em", "atualizado_em", "criado_por", "status", "atendimento_atual_id", "pos_x", "pos_y", "sequencia_pedido"])
const MONEY = new Set(["preco", "valor", "custo_unitario", "total", "desconto"])
const FORMA: Record<string, string> = { pix: "Pix", credito: "Crédito", debito: "Débito", dinheiro: "Dinheiro", vale: "Vale-refeição", outro: "Outro" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

function show(key: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—"
  if (typeof v === "boolean") return v ? "Sim" : "Não"
  if (MONEY.has(key) && !Number.isNaN(Number(v))) return brl.format(Number(v))
  if (typeof v === "string" && UUID.test(v)) return "outro registro"
  if (key.endsWith("_url") || key === "comprovante_caminho") return "arquivo"
  if (typeof v === "object") return "alterado"
  const s = String(v)
  return s.length > 60 ? `${s.slice(0, 57)}…` : s
}

const EXTRA_LABEL: Record<string, string> = {
  motivo: "Motivo",
  saldo: "Saldo depois",
  quantidade: "Quantidade",
  total: "Total",
  pagamentos: "Pagamentos",
  desconto: "Desconto",
  pessoas: "Pessoas",
  itens: "Itens",
}

/** Linhas "campo: antes → depois" ou "campo: valor" para exibir ao abrir o registro */
export function auditDetails(detalhes: Record<string, unknown> | null): { label: string; value: string }[] {
  if (!detalhes) return []
  const antes = detalhes.antes as Record<string, unknown> | undefined
  const depois = detalhes.depois as Record<string, unknown> | undefined
  if (antes && depois) {
    return Object.keys(depois)
      .filter((k) => !IGNORED.has(k) && JSON.stringify(antes[k]) !== JSON.stringify(depois[k]))
      .map((k) => ({ label: FIELD_LABEL[k] ?? k.replace(/_/g, " "), value: `${show(k, antes[k])} → ${show(k, depois[k])}` }))
  }
  const rows = Object.entries(detalhes)
    .filter(([k, v]) => k in EXTRA_LABEL && v !== null && v !== undefined && typeof v !== "object")
    .map(([k, v]) => ({ label: EXTRA_LABEL[k], value: show(k, v) }))
  // fechamento de conta: [{forma, valor}]
  if (Array.isArray(detalhes.pagamentos)) {
    const pags = (detalhes.pagamentos as { forma?: string; valor?: unknown }[])
      .map((p) => `${FORMA[p.forma ?? ""] ?? p.forma} ${brl.format(Number(p.valor ?? 0))}`)
      .join(", ")
    if (pags) rows.push({ label: "Pagamentos", value: pags })
  }
  return rows
}
