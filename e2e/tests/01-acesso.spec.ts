import { test, expect } from "@playwright/test"
import { apiComo } from "../helpers/api"
import { estado, SENHA, USUARIOS } from "../helpers/env"

// Autenticação e controle de acesso (OWASP A01 / A07): cada perfil só chega ao que lhe cabe,
// pela tela e pela API direta.

test.describe("Entrada no sistema", () => {
  test("senha errada mostra mensagem clara e não entra", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("E-mail").fill(USUARIOS.garcom.email)
    await page.getByLabel("Senha", { exact: true }).fill("senha-errada-123")
    await page.getByRole("button", { name: "Entrar" }).click()
    await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos." })).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test("campos vazios são validados antes de enviar", async ({ page }) => {
    await page.goto("/login")
    await page.getByRole("button", { name: "Entrar" }).click()
    await expect(page.getByText("Informe seu e-mail.")).toBeVisible()
    await expect(page.getByText("Informe sua senha.")).toBeVisible()
  })

  test("sem login, as telas internas levam ao login", async ({ page }) => {
    for (const rota of ["/admin", "/garcom", "/cozinha", "/admin/financeiro", "/imprimir/pre-conta/00000000-0000-4000-8000-000000000000"]) {
      // o redirecionamento pode acontecer durante o carregamento (interrompe o "load")
        await page.goto(rota, { waitUntil: "commit" })
      await expect(page, `rota ${rota}`).toHaveURL(/\/login/)
    }
  })

  test("sair encerra a sessão", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("E-mail").fill(USUARIOS.cozinha.email)
    await page.getByLabel("Senha", { exact: true }).fill(SENHA)
    await page.getByRole("button", { name: "Entrar" }).click()
    await expect(page).toHaveURL(USUARIOS.cozinha.home)
    await page.goto("/auth/sair")
    await expect(page).toHaveURL(/\/login/)
    await page.goto("/cozinha")
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe("Permissões por perfil (tela)", () => {
  test.describe("garçom", () => {
    test.use({ storageState: estado("garcom") })
    test("não acessa gestão nem cozinha", async ({ page }) => {
      for (const rota of ["/admin", "/admin/financeiro", "/admin/usuarios", "/admin/auditoria", "/admin/estoque", "/cozinha"]) {
        // o redirecionamento pode acontecer durante o carregamento (interrompe o "load")
        await page.goto(rota, { waitUntil: "commit" })
        await expect(page, `rota ${rota}`).toHaveURL(/\/garcom$/)
      }
    })
  })

  test.describe("cozinha", () => {
    test.use({ storageState: estado("cozinha") })
    test("não acessa salão nem gestão", async ({ page }) => {
      for (const rota of ["/garcom", "/admin", "/admin/relatorios"]) {
        // o redirecionamento pode acontecer durante o carregamento (interrompe o "load")
        await page.goto(rota, { waitUntil: "commit" })
        await expect(page, `rota ${rota}`).toHaveURL(/\/cozinha$/)
      }
    })
  })
})

test.describe("Permissões por perfil (API direta)", () => {
  test("visitante sem login não lê nem executa nada", async () => {
    const anon = await apiComo("anonimo")
    for (const tabela of ["pedidos", "pagamentos", "usuarios", "despesas", "auditoria"]) {
      const { data, error } = await anon.from(tabela).select("*").limit(1)
      expect(error !== null || (data ?? []).length === 0, `anônimo leu ${tabela}`).toBe(true)
    }
    const { error } = await anon.rpc("relatorio", { p_inicio: "2026-01-01", p_fim: "2026-01-31" })
    expect(error, "anônimo executou relatorio").not.toBeNull()
  })

  test("garçom não vê financeiro, auditoria nem relatórios", async () => {
    const garcom = await apiComo("garcom")
    for (const tabela of ["despesas", "pagamentos", "auditoria", "movimentacoes_estoque"]) {
      const { data } = await garcom.from(tabela).select("id").limit(1)
      expect(data ?? [], `garçom leu ${tabela}`).toHaveLength(0)
    }
    const { error } = await garcom.rpc("relatorio", { p_inicio: "2026-01-01", p_fim: "2026-01-31" })
    expect(error?.message).toContain("permissão")
  })

  test("garçom não muda a própria função nem cancela pedidos", async () => {
    const garcom = await apiComo("garcom")
    const { data: eu } = await garcom.auth.getUser()
    const { error } = await garcom.from("usuarios").update({ papel: "gerente" }).eq("id", eu.user!.id).select()
    // sem permissão de atualizar a equipe: erro ou nenhuma linha alterada
    const { data: perfil } = await garcom.from("usuarios").select("papel").eq("id", eu.user!.id).single()
    expect(perfil?.papel, `erro: ${error?.message}`).toBe("garcom")

    const { data: pedido } = await garcom.from("pedidos").select("id").limit(1).maybeSingle()
    if (pedido) {
      const { error: e } = await garcom.rpc("atualizar_status_pedido", { p_pedido_id: pedido.id, p_status: "cancelado", p_motivo: "teste" })
      expect(e).not.toBeNull()
    }
  })

  test("auditoria não pode ser apagada nem alterada, nem pelo dono", async () => {
    const dono = await apiComo("dono")
    const { data: antes } = await dono.from("auditoria").select("id").order("id").limit(1).single()
    const del = await dono.from("auditoria").delete().eq("id", antes!.id).select()
    const upd = await dono.from("auditoria").update({ descricao: "adulterado" }).eq("id", antes!.id).select()
    expect(del.error ?? (del.data?.length === 0 ? "ok" : null)).not.toBeNull()
    expect(upd.error ?? (upd.data?.length === 0 ? "ok" : null)).not.toBeNull()
    const { data: depois } = await dono.from("auditoria").select("id, descricao").eq("id", antes!.id).single()
    expect(depois?.descricao).not.toBe("adulterado")
  })
})
