// Espera progressiva após senhas erradas neste aparelho.
// É uma camada de conforto/atrito: o limite real de tentativas é aplicado
// pelo Supabase Auth no servidor (por IP), e esta conta não substitui aquele.

const KEY = "cacau-login-espera"
const FREE_ATTEMPTS = 5
const BASE_MS = 30_000
const MAX_MS = 5 * 60_000

interface State {
  falhas: number
  ate: number
}

function read(): State {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as State | null
    return v && typeof v.falhas === "number" && typeof v.ate === "number" ? v : { falhas: 0, ate: 0 }
  } catch {
    return { falhas: 0, ate: 0 }
  }
}

function write(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // modo privado: a espera vale só enquanto a página estiver aberta
  }
}

/** Milissegundos que ainda faltam para poder tentar de novo (0 = liberado) */
export function loginWaitMs(now = Date.now()) {
  return Math.max(0, read().ate - now)
}

/** Registra uma senha errada; devolve a espera imposta (0 se ainda há tentativas livres) */
export function registerLoginFailure(now = Date.now()) {
  const s = read()
  const falhas = s.falhas + 1
  const wait = falhas < FREE_ATTEMPTS ? 0 : Math.min(MAX_MS, BASE_MS * 2 ** (falhas - FREE_ATTEMPTS))
  write({ falhas, ate: now + wait })
  return wait
}

export function clearLoginFailures() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nada a limpar
  }
}

let countdown: ReturnType<typeof setInterval> | null = null
let onVisible: (() => void) | null = null

function stop() {
  if (countdown) clearInterval(countdown)
  if (onVisible) document.removeEventListener("visibilitychange", onVisible)
  countdown = null
  onVisible = null
}

/** Avisa a cada segundo quantos segundos faltam, até liberar (0) */
export function watchLoginWait(onTick: (seconds: number) => void) {
  stop()
  const tick = () => {
    const left = Math.ceil(loginWaitMs() / 1000)
    onTick(left)
    if (left <= 0) stop()
  }
  tick()
  if (loginWaitMs() <= 0) return
  countdown = setInterval(tick, 1000)
  // abas em segundo plano têm o relógio desacelerado: ao voltar, atualiza na hora
  onVisible = () => document.visibilityState === "visible" && tick()
  document.addEventListener("visibilitychange", onVisible)
}
