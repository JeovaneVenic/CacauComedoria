export const TIMEZONE = "America/Sao_Paulo"

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric" })
const timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" })
const hourFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, hour: "numeric", hourCycle: "h23" })

/** R$ 1.250,00 — o Intl usa espaço não separável; normalizamos para espaço comum. */
export function formatCurrency(value: number | string | null | undefined) {
  return brl.format(Number(value ?? 0)).replace(/ /g, " ")
}

/** DD/MM/AAAA */
export function formatDate(value: string | Date) {
  return dateFmt.format(new Date(value))
}

/** HH:mm */
export function formatTime(value: string | Date) {
  return timeFmt.format(new Date(value))
}

export function formatDateTime(value: string | Date) {
  return `${formatDate(value)} ${formatTime(value)}`
}

/** "há 12 min", "há 1 h 05 min" */
export function formatElapsed(from: string | Date, now: Date = new Date()) {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / 60000))
  if (minutes < 1) return "agora"
  if (minutes < 60) return `há ${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `há ${h} h ${String(m).padStart(2, "0")} min` : `há ${h} h`
}

export function greeting(now: Date = new Date()) {
  const hour = Number(hourFmt.format(now))
  if (hour < 12) return "Bom dia"
  if (hour < 18) return "Boa tarde"
  return "Boa noite"
}

export function tableLabel(number: number) {
  return `Mesa ${String(number).padStart(2, "0")}`
}

export function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}

/** Início do dia de hoje em São Paulo, em ISO (o Brasil não tem horário de verão desde 2019) */
export function startOfTodaySP(now: Date = new Date()) {
  const [d, m, y] = dateFmt.format(now).split("/")
  return new Date(`${y}-${m}-${d}T00:00:00-03:00`).toISOString()
}

/** Minutos entre dois instantes: "12 min", "1 h 05 min" */
export function formatDuration(from: string | Date, to: string | Date = new Date()) {
  const minutes = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000))
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${String(m).padStart(2, "0")} min` : `${h} h`
}