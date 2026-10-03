import { test, expect } from "@playwright/test"
import { mesaPorNumero } from "../helpers/api"
import { estado } from "../helpers/env"
import { semRolagemLateral, telaCarregou, vigiarErros, violacoesGraves } from "../helpers/pagina"

// Todas as telas de cada perfil: abrem sem erro, sem falha de servidor e sem violação de acessibilidade grave.

test.describe("Telas da gestão (proprietário)", () => {
  test.use({ storageState: estado("dono") })

  const telas = [
    ["/admin", "painel"],
    ["/admin/pedidos", "pedidos"],
    ["/admin/mesas", "mesas"],
    ["/admin/cardapio", "cardapio"],
    ["/admin/financeiro", "financeiro"],
    ["/admin/estoque", "estoque-itens"],
    ["/admin/estoque?aba=ficha", "estoque-ficha"],
    ["/admin/estoque?aba=movimentacoes", "estoque-movimentacoes"],
    ["/admin/relatorios?aba=vendas", "relatorios-vendas"],
    ["/admin/relatorios?aba=produtos", "relatorios-produtos"],
    ["/admin/relatorios?aba=equipe", "relatorios-equipe"],
    ["/admin/relatorios?aba=pedidos", "relatorios-pedidos"],
    ["/admin/relatorios?aba=despesas", "relatorios-despesas"],
    ["/admin/usuarios", "usuarios"],
    ["/admin/auditoria", "auditoria"],
    ["/admin/configuracoes", "configuracoes"],
  ] as const

  for (const [rota, nome] of telas) {
    test(`${nome} abre sem erros e é acessível`, async ({ page }, testInfo) => {
      const erros = vigiarErros(page)
      await page.goto(rota)
      await telaCarregou(page)
      await page.waitForLoadState("networkidle")
      expect(erros, erros.join("\n")).toEqual([])
      expect(await violacoesGraves(page, testInfo, nome)).toEqual([])
    })
  }
})

test.describe("Telas do salão (garçom)", () => {
  test.use({ storageState: estado("garcom") })

  test("todas abrem sem erros, acessíveis e cabem no celular e no tablet", async ({ page }, testInfo) => {
    const mesa = await mesaPorNumero(1)
    const telas = [
      ["/garcom", "mesas"],
      ["/garcom/pedidos", "meus-pedidos"],
      ["/garcom/conta", "contas"],
      ["/garcom/perfil", "perfil"],
      [`/garcom/mesa/${mesa.id}`, "mesa"],
      [`/garcom/mesa/${mesa.id}/pedido`, "novo-pedido"],
      [`/garcom/mesa/${mesa.id}/conta`, "conta-da-mesa"],
    ] as const
    const graves: string[] = []
    for (const [rota, nome] of telas) {
      await test.step(nome, async () => {
        const erros = vigiarErros(page)
        for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }]) {
          await page.setViewportSize(viewport)
          await page.goto(rota)
          await telaCarregou(page)
          await page.waitForLoadState("networkidle")
          await semRolagemLateral(page)
        }
        expect(erros, erros.join("\n")).toEqual([])
        graves.push(...(await violacoesGraves(page, testInfo, nome)))
      })
    }
    expect(graves, graves.join("\n")).toEqual([])
  })
})

test.describe("Tela da cozinha", () => {
  test.use({ storageState: estado("cozinha") })

  test("abre sem erros e é acessível", async ({ page }, testInfo) => {
    const erros = vigiarErros(page)
    await page.goto("/cozinha")
    await expect(page.getByRole("heading", { name: "Não foi possível carregar esta tela" })).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Novos" })).toBeVisible()
    await page.waitForLoadState("networkidle")
    expect(erros, erros.join("\n")).toEqual([])
    expect(await violacoesGraves(page, testInfo, "cozinha")).toEqual([])
  })
})

test.describe("Telas públicas", () => {
  test("login e recuperação de senha são acessíveis", async ({ page }, testInfo) => {
    const graves: string[] = []
    for (const [rota, nome] of [["/login", "login"], ["/esqueci-senha", "esqueci-senha"]] as const) {
      const erros = vigiarErros(page)
      await page.goto(rota)
      await expect(page.getByRole("heading").first()).toBeVisible()
      await expect(page.getByRole("button", { name: /Entrar|Enviar/ }).first()).toBeEnabled()
      expect(erros, erros.join("\n")).toEqual([])
      graves.push(...(await violacoesGraves(page, testInfo, nome)))
    }
    expect(graves, graves.join("\n")).toEqual([])
  })
})
