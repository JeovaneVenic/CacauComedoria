export const REPORT_TABS = [
  { id: "vendas", label: "Vendas" },
  { id: "produtos", label: "Produtos" },
  { id: "equipe", label: "Equipe e mesas" },
  { id: "pedidos", label: "Pedidos" },
  { id: "despesas", label: "Despesas" },
] as const

export type ReportTab = (typeof REPORT_TABS)[number]["id"]
