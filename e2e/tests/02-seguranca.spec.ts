import { test, expect } from "@playwright/test"

// Configuração de segurança (OWASP A02), redirecionamento aberto e erros tratados (A10).

test("cabeçalhos de segurança em todas as respostas", async ({ request }) => {
  for (const rota of ["/login", "/manifest.webmanifest"]) {
    const r = await request.get(rota)
    const h = r.headers()
    expect(h["x-frame-options"], rota).toBe("SAMEORIGIN")
    expect(h["x-content-type-options"], rota).toBe("nosniff")
    expect(h["referrer-policy"], rota).toBe("strict-origin-when-cross-origin")
    expect(h["content-security-policy"], rota).toContain("frame-ancestors 'self'")
    expect(h["content-security-policy"], rota).toContain("object-src 'none'")
    expect(h["x-powered-by"], rota).toBeUndefined()
  }
})

test("service worker nunca fica preso em cache", async ({ request }) => {
  const r = await request.get("/sw.js")
  expect(r.status()).toBe(200)
  expect(r.headers()["cache-control"]).toContain("no-store")
})

test("manifesto do app instalável é válido", async ({ request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json()
  expect(m.name).toBeTruthy()
  expect(m.display).toBe("standalone")
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true)
  for (const icon of m.icons) expect((await request.get(icon.src)).status(), icon.src).toBe(200)
})

test("link de recuperação não redireciona para outro site", async ({ page }) => {
  for (const destino of ["//exemplo-malicioso.com", "/\\exemplo-malicioso.com", "https://exemplo-malicioso.com"]) {
    await page.goto(`/auth/confirm?code=invalido&next=${encodeURIComponent(destino)}`)
    // continua no próprio sistema (tela de login com aviso de link inválido)
    await expect(page, destino).toHaveURL(/^http:\/\/localhost:\d+\/login/)
  }
})

test.describe("logado", () => {
  test.use({ storageState: "e2e/.auth/dono.json" })
  test("endereço inexistente mostra página 404 amigável", async ({ page }) => {
    const r = await page.goto("/pagina-que-nao-existe")
    expect(r?.status()).toBe(404)
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible()
  })
})
