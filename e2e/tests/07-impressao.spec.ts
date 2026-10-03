import { test, expect } from "@playwright/test"
import { mesaPorNumero } from "../helpers/api"
import { estado } from "../helpers/env"

// Pré-conta na bobina de 80 mm: o que realmente vai para a impressora (modo de impressão + PDF no tamanho do papel).
// Não substitui a impressão numa térmica física.

test.use({ storageState: estado("dono") })

test("cupom cabe na bobina de 80 mm, sem cortes e sem os botões da tela", async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== "chromium", "geração de PDF só existe no Chromium/Chrome")
  // mesa com pedidos abertos
  let mesa = await mesaPorNumero(1)
  if (!mesa.atendimento_id) mesa = await mesaPorNumero(2)
  test.skip(!mesa.atendimento_id, "nenhuma mesa aberta com pedidos para imprimir")

  await page.goto(`/imprimir/pre-conta/${mesa.id}`)
  const cupom = page.locator("main.cupom")
  await expect(cupom).toContainText("PRÉ-CONTA")
  expect(await cupom.getByRole("img").first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)

  // o AutoPrint ajusta a página ao tamanho do cupom
  await expect.poll(() => page.evaluate(() => document.getElementById("pagina-cupom")?.textContent ?? "")).toContain("80mm")
  await page.emulateMedia({ media: "print" })
  // botões da tela não saem no papel
  await expect(page.getByRole("button", { name: "Imprimir" })).toBeHidden()
  await expect(page.getByRole("link", { name: /Voltar para a conta/ })).toBeHidden()

  // área útil da bobina de 80 mm ≈ 72 mm; nada pode passar disso
  const medidas = await cupom.evaluate((el) => {
    const mm = (px: number) => (px * 25.4) / 96
    const transborda = [...el.querySelectorAll("*")].filter((n) => (n as HTMLElement).scrollWidth > (n as HTMLElement).clientWidth + 1 && getComputedStyle(n).overflow === "visible" && (n as HTMLElement).clientWidth > 0).length
    return { larguraMm: mm(el.getBoundingClientRect().width), conteudoMm: mm(el.scrollWidth), transborda }
  })
  expect(medidas.larguraMm).toBeLessThanOrEqual(72.5)
  expect(medidas.conteudoMm).toBeLessThanOrEqual(72.5)
  expect(medidas.transborda, "elementos com texto passando da largura").toBe(0)

  // PDF no tamanho definido pela própria página (@page 80 mm)
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true })
  await testInfo.attach("pre-conta.pdf", { body: pdf, contentType: "application/pdf" })
  const caixa = pdf.toString("latin1").match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/)
  expect(caixa, "PDF sem MediaBox").not.toBeNull()
  const larguraMm = (Number(caixa![1]) * 25.4) / 72
  expect(larguraMm).toBeGreaterThan(79)
  expect(larguraMm).toBeLessThan(81)
})
