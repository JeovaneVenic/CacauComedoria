import { expect, type Page, type TestInfo } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

/** Registra erros do console, exceções e respostas 5xx enquanto o teste navega */
export function vigiarErros(page: Page) {
  const erros: string[] = []
  page.on("console", (m) => {
    if (m.type() !== "error") return
    const t = m.text()
    // o Chrome registra no console a resposta 4xx esperada de um teste (ex.: 404 de propósito)
    if (/Failed to load resource: the server responded with a status of 404/.test(t)) return
    // falhas de rede provocadas de propósito no teste sem internet
    // (no Safari: "Load failed" e "WebKit encountered an internal error")
    if (/ERR_INTERNET_DISCONNECTED|Failed to fetch|NetworkError|Load failed|WebKit encountered an internal error/.test(t)) return
    // Safari: requisições que ele mesmo cancela ao trocar de página (prefetch, tempo real) aparecem como erro
    if (/due to access control checks|WebSocket is closed before the connection is established/.test(t)) return
    erros.push(`console: ${t}`)
  })
  page.on("pageerror", (e) => {
    if (/due to access control checks/.test(e.message)) return
    erros.push(`exceção: ${e.message}`)
  })
  page.on("response", (r) => {
    if (r.status() >= 500) erros.push(`HTTP ${r.status()}: ${r.url()}`)
  })
  return erros
}

/** A tela abriu de verdade: título visível e não caiu na página de erro */
export async function telaCarregou(page: Page) {
  await expect(page.getByRole("heading", { name: "Não foi possível carregar esta tela" })).toHaveCount(0)
  await expect(page.locator("h1").first()).toBeVisible()
}

/** Varredura de acessibilidade (WCAG 2.2 A/AA). Retorna só o que for sério ou crítico. */
export async function violacoesGraves(page: Page, testInfo: TestInfo, nome: string) {
  // espera transições terminarem (cores no meio de uma animação dão contraste falso)
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity)
  )
  const resultado = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze()
  await testInfo.attach(`axe-${nome}.json`, { body: JSON.stringify(resultado.violations, null, 2), contentType: "application/json" })
  return resultado.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${nome}: [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length}x: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")})`)
}

/**
 * Abre um endereço tolerando que um redirecionamento (esperado) interrompa a navegação —
 * o Safari reporta isso como erro. Quem chama confere o endereço final.
 */
export async function irPara(page: Page, url: string) {
  try {
    await page.goto(url, { waitUntil: "commit" })
  } catch (e) {
    if (!/interrupted by another navigation|Frame load interrupted/.test(String(e))) throw e
  }
}

/** Nada vaza para os lados (sem rolagem horizontal) */
export async function semRolagemLateral(page: Page) {
  const { scroll, largura } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, largura: document.documentElement.clientWidth }))
  expect(scroll, `largura do conteúdo ${scroll}px > tela ${largura}px`).toBeLessThanOrEqual(largura + 1)
}
