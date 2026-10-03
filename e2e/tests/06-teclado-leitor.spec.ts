import { test, expect, type Page } from "@playwright/test"
import { mesaPorNumero } from "../helpers/api"
import { estado, SENHA, USUARIOS } from "../helpers/env"

// Uso só pelo teclado e estrutura lida por leitores de tela (complementa a varredura axe do 03-telas).
// Não substitui um teste manual com NVDA/VoiceOver.

/** Tecla Tab até o foco chegar no elemento que satisfaz a condição (máx. 40 toques) */
async function tabAte(page: Page, alvo: (el: { label: string; id: string; tag: string; texto: string }) => boolean, descricao: string) {
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab")
    const atual = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      return { label: el?.getAttribute("aria-label") ?? "", id: el?.id ?? "", tag: el?.tagName ?? "", texto: (el?.textContent ?? "").trim().slice(0, 80) }
    })
    if (alvo(atual)) return
  }
  throw new Error(`o foco nunca chegou em: ${descricao}`)
}

/** O elemento focado tem indicação visual de foco (anel ou contorno) */
async function focoVisivel(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement
    const s = getComputedStyle(el)
    return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow !== "none" && s.boxShadow !== "")
  })
}

test("login completo só pelo teclado", async ({ page }) => {
  await page.goto("/login")
  await tabAte(page, (e) => e.id === "email", "campo E-mail")
  expect(await focoVisivel(page)).toBe(true)
  await page.keyboard.type(USUARIOS.garcom.email)
  await tabAte(page, (e) => e.id === "password", "campo Senha")
  await page.keyboard.type(SENHA)
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(USUARIOS.garcom.home)
})

test.describe("garçom", () => {
  test.use({ storageState: estado("garcom") })

  test("montar pedido com adicionais só pelo teclado; Esc fecha e o foco volta", async ({ page }) => {
    const mesa = await mesaPorNumero(1)
    await page.goto(`/garcom/mesa/${mesa.id}/pedido`)
    await tabAte(page, (e) => e.label === "Buscar no cardápio", "busca do cardápio")
    expect(await focoVisivel(page)).toBe(true)
    await page.keyboard.type("Açaí")
    await tabAte(page, (e) => e.label.startsWith("Açaí 300 ml"), "produto Açaí")
    expect(await focoVisivel(page)).toBe(true)
    await page.keyboard.press("Enter")

    const modal = page.getByRole("dialog", { name: "Açaí 300 ml" })
    await expect(modal).toBeVisible()
    // o foco entra na janela (não fica perdido atrás dela)
    expect(await modal.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    await tabAte(page, (e) => e.texto.startsWith("Leite condensado"), "opção Leite condensado")
    await page.keyboard.press("Space")
    await expect(modal.getByRole("checkbox", { name: /Leite condensado/ })).toHaveAttribute("aria-checked", "true")

    await page.keyboard.press("Escape")
    await expect(modal).toBeHidden()
    // o foco volta ao produto quando a animação de fechar termina
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? ""), { message: "o foco deve voltar para o produto ao fechar a janela" })
      .toMatch(/^Açaí 300 ml/)
  })

  test("estrutura para leitor de tela: uma região principal, um título, botões com nome", async ({ page }) => {
    for (const rota of ["/garcom", "/garcom/pedidos", "/garcom/perfil"]) {
      await page.goto(rota)
      await expect(page.getByRole("main"), rota).toHaveCount(1)
      await expect(page.getByRole("heading", { level: 1 }), rota).toHaveCount(1)
      const semNome = await page.getByRole("button").evaluateAll((bs) =>
        bs.filter((b) => (b as HTMLElement).offsetParent && !(b.getAttribute("aria-label") || b.textContent?.trim() || b.getAttribute("title"))).length
      )
      expect(semNome, `${rota}: botões sem nome`).toBe(0)
    }
    // a navegação inferior é identificável
    await page.goto("/garcom")
    await expect(page.getByRole("navigation").first()).toBeVisible()
  })
})

test.describe("gestão", () => {
  test.use({ storageState: estado("dono") })

  test("menu lateral navegável pelo teclado com foco visível", async ({ page, isMobile }) => {
    test.skip(isMobile, "no tablet/celular o menu fica recolhido atrás de um botão")
    await page.goto("/admin")
    await tabAte(page, (e) => e.texto === "Financeiro", "link Financeiro do menu")
    expect(await focoVisivel(page)).toBe(true)
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(/\/admin\/financeiro$/)
    await expect(page.getByRole("heading", { level: 1, name: "Financeiro" })).toBeVisible()
  })

  test("erros de formulário são anunciados (role=alert) e o campo fica marcado como inválido", async ({ page }) => {
    await page.goto("/admin/financeiro")
    await page.getByRole("button", { name: "Nova despesa" }).click()
    const painel = page.getByRole("dialog", { name: "Nova despesa" })
    await painel.getByRole("button", { name: "Salvar" }).click()
    await expect(painel.getByRole("alert").first()).toBeVisible()
    await expect(painel.getByLabel("Descrição")).toHaveAttribute("aria-invalid", "true")
    await page.keyboard.press("Escape")
    await expect(painel).toBeHidden()
  })

  test("avisos de sucesso e erro chegam ao leitor de tela (região viva)", async ({ page }) => {
    await page.goto("/admin")
    // o Sonner mantém uma região com aria-live para anunciar os avisos
    await expect(page.locator("section[aria-live], [aria-live='polite']").first()).toBeAttached()
  })
})
