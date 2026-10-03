import { test, expect, type Page } from "@playwright/test"
import { apiComo, liberarMesa, mesaPorNumero } from "../helpers/api"
import { estado } from "../helpers/env"
import { vigiarErros } from "../helpers/pagina"

// Fluxo crítico de ponta a ponta, com os três perfis ao mesmo tempo (cada um na sua janela):
// garçom abre a mesa e lança pedidos (inclusive sem internet) → cozinha prepara → garçom entrega →
// dono confere a conta, imprime a pré-conta, finaliza e fecha em Pix → mesa volta a ficar livre.
//
// Valores do cardápio de demonstração: Açaí 16,90 (+ leite condensado 2,00 + morango 3,00),
// Coca-Cola 6,00 e Água Mineral 4,00 → subtotal 31,90 + 10% de serviço 3,19 = 35,09.

const MESA = 4
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ")

test.describe.configure({ mode: "serial" })

test("fluxo completo de uma mesa, do pedido ao pagamento", async ({ browser }) => {
  test.setTimeout(240_000)

  await test.step("preparação: mesa 04 livre", async () => {
    const mesa = await liberarMesa(MESA)
    expect(mesa.status).toBe("livre")
  })

  const abrir = async (perfil: "dono" | "garcom" | "cozinha", viewport = { width: 1280, height: 860 }) => {
    const ctx = await browser.newContext({ storageState: estado(perfil), viewport, locale: "pt-BR", timezoneId: "America/Sao_Paulo" })
    const page = await ctx.newPage()
    return { ctx, page, erros: vigiarErros(page) }
  }
  const garcom = await abrir("garcom", { width: 1180, height: 820 }) // tablet na horizontal
  const cozinha = await abrir("cozinha")
  const dono = await abrir("dono")
  const mesa = await mesaPorNumero(MESA)
  const toast = (page: Page, texto: string | RegExp) => expect(page.locator("[data-sonner-toast]").filter({ hasText: texto }).first()).toBeVisible()

  const numerosPedidos: number[] = []

  await test.step("garçom abre a mesa 04 para 2 pessoas", async () => {
    const page = garcom.page
    await page.goto("/garcom")
    await page.getByRole("button", { name: /^Mesa 04, Livre/ }).filter({ visible: true }).first().click()
    const dialogo = page.getByRole("dialog", { name: "Abrir Mesa 04" })
    await expect(dialogo).toBeVisible()
    await dialogo.getByRole("radio", { name: "2", exact: true }).click()
    await dialogo.getByRole("button", { name: "Abrir mesa" }).click()
    await expect(page).toHaveURL(new RegExp(`/garcom/mesa/${mesa.id}/pedido$`))
  })

  await test.step("garçom lança açaí com adicionais e uma Coca-Cola", async () => {
    const page = garcom.page
    const busca = page.getByRole("searchbox", { name: "Buscar no cardápio" }).or(page.getByLabel("Buscar no cardápio"))
    await busca.fill("Açaí")
    await page.getByRole("button", { name: /^Açaí 300 ml, R\$ 16,90, personalizar/ }).click()
    const modal = page.getByRole("dialog", { name: "Açaí 300 ml" })
    await modal.getByRole("checkbox", { name: /Leite condensado/ }).click()
    await modal.getByRole("checkbox", { name: /Morango/ }).click()
    // adicionais de lanche não podem aparecer no açaí
    await expect(modal.getByText("Bacon")).toHaveCount(0)
    await modal.getByRole("button", { name: /Adicionar ao pedido · R\$ 21,90/ }).click()

    await busca.fill("Coca")
    await page.getByRole("button", { name: /^Coca-Cola, R\$ 6,00, adicionar/ }).click()

    const resumo = page.getByRole("region", { name: "Pedido atual" }).filter({ visible: true })
    await expect(resumo.getByText("Leite condensado · Morango")).toBeVisible()
    await resumo.getByRole("button", { name: "Enviar para cozinha" }).click()
    await toast(page, /Pedido #\d+ enviado para a cozinha/)
    const texto = await page.locator("[data-sonner-toast]").filter({ hasText: /Pedido #\d+/ }).first().textContent()
    numerosPedidos.push(Number(texto!.match(/#(\d+)/)![1]))
    await expect(page).toHaveURL(new RegExp(`/garcom/mesa/${mesa.id}$`))
  })

  await test.step("sem internet: pedido vai para a fila e sai sozinho ao voltar a conexão (sem duplicar)", async () => {
    const page = garcom.page
    await page.goto(`/garcom/mesa/${mesa.id}/pedido`)
    await garcom.ctx.setOffline(true)
    await expect(page.getByRole("alert").filter({ hasText: "Sem conexão" }).first()).toBeVisible()
    await page.getByLabel("Buscar no cardápio").fill("Água")
    await page.getByRole("button", { name: /^Água Mineral, R\$ 4,00, adicionar/ }).click()
    await page.getByRole("region", { name: "Pedido atual" }).filter({ visible: true }).getByRole("button", { name: "Enviar para cozinha" }).click()
    await expect(page.getByText("1 pedido guardado no aparelho", { exact: false })).toBeVisible()

    await garcom.ctx.setOffline(false)
    await toast(page, /Pedido #\d+ da Mesa 04 enviado para a cozinha/)
    const texto = await page.locator("[data-sonner-toast]").filter({ hasText: /da Mesa 04 enviado/ }).first().textContent()
    numerosPedidos.push(Number(texto!.match(/#(\d+)/)![1]))

    // exatamente 2 pedidos na mesa (o da fila não duplicou)
    const api = await apiComo("dono")
    const atual = await mesaPorNumero(MESA)
    const { data } = await api.from("pedidos").select("numero").eq("atendimento_id", atual.atendimento_id!)
    expect((data ?? []).map((p) => p.numero).sort()).toEqual([...numerosPedidos].sort())
  })

  await test.step("cozinha recebe os pedidos e prepara", async () => {
    const page = cozinha.page
    await page.goto("/cozinha")
    for (const numero of numerosPedidos) {
      const cartao = page.getByLabel(new RegExp(`^Pedido ${numero}, Mesa 04`))
      await expect(cartao).toBeVisible()
      await cartao.getByRole("button", { name: "Iniciar preparo" }).click()
      await expect(cartao.getByRole("button", { name: "Marcar como pronto" })).toBeVisible()
      await cartao.getByRole("button", { name: "Marcar como pronto" }).click()
      await expect(cartao.getByRole("button", { name: "Finalizar" })).toBeVisible()
    }
  })

  await test.step("garçom vê os pedidos prontos e entrega", async () => {
    const page = garcom.page
    await page.goto(`/garcom/mesa/${mesa.id}`)
    const entregar = page.getByRole("button", { name: "Marcar como entregue" })
    await expect(entregar).toHaveCount(numerosPedidos.length)
    for (let restantes = numerosPedidos.length; restantes > 0; restantes--) {
      await entregar.first().click()
      // espera a tela atualizar (um botão a menos) antes de entregar o próximo
      await expect(entregar).toHaveCount(restantes - 1)
    }
  })

  await test.step("dono confere a conta: subtotal, serviço e total", async () => {
    const page = dono.page
    await page.goto(`/admin/conta/${mesa.id}`)
    await expect(page.getByRole("heading", { name: "Conta · Mesa 04" })).toBeVisible()
    await expect(page.getByText(brl(35.09)).first()).toBeVisible()
  })

  await test.step("pré-conta para impressão: logo, itens e total corretos", async () => {
    const page = dono.page
    await page.goto(`/imprimir/pre-conta/${mesa.id}`)
    const cupom = page.locator("main.cupom")
    await expect(cupom.getByRole("img", { name: /Restaurante|Cacau/ })).toBeVisible()
    expect(await cupom.getByRole("img").first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    await expect(cupom).toContainText("PRÉ-CONTA")
    await expect(cupom).toContainText("Não é documento fiscal")
    await expect(cupom).toContainText("1x Açaí 300 ml")
    await expect(cupom).toContainText("Leite condensado · Morango")
    await expect(cupom).toContainText("1x Coca-Cola")
    await expect(cupom).toContainText("1x Água Mineral")
    await expect(cupom).toContainText("31,90")
    await expect(cupom).toContainText("3,19")
    await expect(cupom).toContainText(brl(35.09))
    await expect(page.getByRole("link", { name: /Voltar para a conta/ })).toHaveAttribute("href", `/admin/conta/${mesa.id}`)
  })

  await test.step("Finalizar: mesa aguardando pagamento e volta ao painel", async () => {
    const page = dono.page
    await page.getByRole("button", { name: /Finalizar/ }).click()
    await expect(page).toHaveURL(/\/admin$/)
    expect((await mesaPorNumero(MESA)).status).toBe("aguardando_pagamento")
  })

  await test.step("dono fecha a conta em Pix e a mesa fica livre", async () => {
    const page = dono.page
    await page.goto(`/admin/conta/${mesa.id}`)
    await page.getByRole("button", { name: "Pix", exact: true }).click()
    await expect(page.getByRole("status").filter({ hasText: "Valor completo" })).toBeVisible()
    await page.getByRole("button", { name: "Fechar conta" }).click()
    const confirmar = page.getByRole("alertdialog")
    await expect(confirmar).toContainText(brl(35.09))
    await confirmar.getByRole("button", { name: "Fechar conta" }).click()
    await toast(page, /Mesa 04 fechada/)
    await expect.poll(async () => (await mesaPorNumero(MESA)).status).toBe("livre")
  })

  await test.step("auditoria registrou o fechamento com o valor", async () => {
    const page = dono.page
    await page.goto("/admin/auditoria?periodo=hoje&q=fechou%20a%20mesa%2004")
    await expect(page.getByText(`fechou a mesa 04 — total ${brl(35.09)}`).first()).toBeVisible()
  })

  for (const [quem, sessao] of [["garçom", garcom], ["cozinha", cozinha], ["dono", dono]] as const) {
    expect(sessao.erros, `erros na janela do ${quem}:\n${sessao.erros.join("\n")}`).toEqual([])
    await sessao.ctx.close()
  }
})
