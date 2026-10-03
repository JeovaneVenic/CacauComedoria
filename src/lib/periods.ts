// Períodos de consulta em datas de São Paulo (AAAA-MM-DD).
// O Brasil não tem horário de verão desde 2019: o fuso é sempre -03:00.

export type PeriodKey = "hoje" | "ontem" | "7dias" | "mes" | "mes_passado" | "personalizado"

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  "7dias": "Últimos 7 dias",
  mes: "Este mês",
  mes_passado: "Mês passado",
  personalizado: "Personalizado",
}

export interface ResolvedPeriod {
  key: PeriodKey
  inicio: string
  fim: string
  /** instantes ISO para filtrar colunas timestamptz: [de, ate) */
  de: string
  ate: string
  label: string
}

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
const br = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" })

export function todaySP(now = new Date()) {
  return ymd.format(now)
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))

export function formatYmd(date: string) {
  return br.format(new Date(`${date}T12:00:00Z`))
}

export function resolvePeriod(key: unknown, from?: unknown, to?: unknown): ResolvedPeriod {
  const today = todaySP()
  const [y, m] = today.split("-").map(Number)
  const firstOfMonth = `${y}-${String(m).padStart(2, "0")}-01`
  let k: PeriodKey = (Object.keys(PERIOD_LABELS) as PeriodKey[]).includes(key as PeriodKey) ? (key as PeriodKey) : "mes"
  let inicio = firstOfMonth
  let fim = today

  if (k === "hoje") inicio = today
  else if (k === "ontem") inicio = fim = addDays(today, -1)
  else if (k === "7dias") inicio = addDays(today, -6)
  else if (k === "mes_passado") {
    fim = addDays(firstOfMonth, -1)
    inicio = `${fim.slice(0, 7)}-01`
  } else if (k === "personalizado") {
    if (isDate(from) && isDate(to)) {
      inicio = from <= to ? from : to
      fim = from <= to ? to : from
    } else k = "mes"
  }

  return {
    key: k,
    inicio,
    fim,
    de: new Date(`${inicio}T00:00:00-03:00`).toISOString(),
    ate: new Date(`${addDays(fim, 1)}T00:00:00-03:00`).toISOString(),
    label: inicio === fim ? formatYmd(inicio) : `${formatYmd(inicio)} a ${formatYmd(fim)}`,
  }
}
