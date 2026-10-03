import { z } from "zod"

/** Aceita "24,90", "24.90", "R$ 1.250,00" ou número */
export const moeda = (mensagem: string) =>
  z.preprocess((v) => {
    if (typeof v === "number") return v
    if (typeof v !== "string") return v
    const limpo = v.replace(/[R$\s]/g, "")
    if (!limpo) return undefined
    // com vírgula: ponto é separador de milhar
    const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo
    return Number(normal)
  }, z.number({ message: mensagem }).min(0, "O valor não pode ser negativo.").max(9_999_999, "Valor muito alto."))

export const FORMAS_PAGAMENTO = ["pix", "credito", "debito", "dinheiro", "vale", "outro"] as const
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]

export const FORMA_LABEL: Record<FormaPagamento, string> = {
  pix: "Pix",
  credito: "Crédito",
  debito: "Débito",
  dinheiro: "Dinheiro",
  vale: "Vale-refeição",
  outro: "Outro",
}
