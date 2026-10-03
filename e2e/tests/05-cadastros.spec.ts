import { test, expect, type Page } from "@playwright/test"
import { apiComo } from "../helpers/api"
import { estado } from "../helpers/env"
import { vigiarErros } from "../helpers/pagina"

// Formulários de cadastro da gestão: criar, validar, editar e excluir/desativar.
// Todo registro de teste começa com "QA " e é removido no fim (ou reaproveitado, quando o sistema
// não permite excluir: item de estoque com movimentação e usuário, que ficam desativados).

test.use({ storageState: estado("dono") })

const aviso = (page: Page, texto: string | RegExp) => expect(page.locator("[data-sonner-toast]").filter({ hasText: texto }).first()).toBeVisible()

test.beforeAll(async () => {
  // restos de rodadas interrompidas
  const api = await apiComo("dono")
  await api.from("produtos").delete().like("nome", "QA %")
  await api.from("categorias").delete().like("nome", "QA %")
  await api.from("despesas").delete().like("descricao", "QA %")
  await api.from("fornecedores").delete().like("nome", "QA %")
  await api.from("grupos_opcoes").delete().like("nome", "QA %")
  await api.from("mesas").delete().eq("numero", 99)
})

test("categoria do cardápio: criar, renomear e excluir", async ({ page }) => {
  const erros = vigiarErros(page)
  await page.goto("/admin/cardapio")
  await page.getByRole("button", { name: "Categorias" }).click()
  const dialogo = page.getByRole("dialog", { name: "Categorias" })
  await dialogo.getByLabel("Nome da nova categoria").fill("QA Categoria")
  await dialogo.getByRole("button", { name: "Adicionar" }).click()
  await aviso(page, "Categoria criada.")

  await dialogo.getByRole("button", { name: "Renomear QA Categoria" }).click()
  await dialogo.getByLabel("Nome da categoria").fill("QA Categoria 2")
  await dialogo.getByRole("button", { name: "Salvar nome" }).click()
  await aviso(page, "Categoria renomeada.")

  await dialogo.getByRole("button", { name: "Excluir QA Categoria 2" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click()
  await aviso(page, "Categoria excluída.")
  await expect(dialogo.getByText("QA Categoria 2")).toHaveCount(0)
  expect(erros, erros.join("\n")).toEqual([])
})

test("produto: validar, cadastrar com adicionais, editar preço, indisponível e excluir", async ({ page }) => {
  const erros = vigiarErros(page)
  await page.goto("/admin/cardapio")
  await page.getByRole("button", { name: "Novo produto" }).click()
  const painel = page.getByRole("dialog", { name: "Novo produto" })

  await test.step("validação: sem nome e sem preço não salva", async () => {
    await painel.getByRole("button", { name: "Salvar" }).click()
    await expect(painel.getByRole("alert").first()).toBeVisible()
    await expect(painel).toBeVisible()
  })

  await test.step("cadastrar", async () => {
    await painel.getByLabel("Nome").fill("QA Produto Teste")
    await painel.getByLabel("Descrição curta").fill("Produto criado pelo teste automático")
    await painel.getByLabel("Preço (R$)").fill("12,50")
    await painel.getByLabel("Preparo (min)").fill("5")
    await painel.getByLabel("Categoria").selectOption({ label: "Sobremesas" })
    await painel.getByRole("checkbox", { name: /Adicionais do açaí/ }).click()
    await painel.getByRole("button", { name: "Salvar" }).click()
    await aviso(page, "Produto cadastrado.")
  })

  const editar = page.getByRole("button", { name: /^Editar QA Produto Teste, R\$ 12,50/ }).filter({ visible: true }).first()
  await expect(editar).toBeVisible()

  await test.step("editar preço e conferir os adicionais ligados", async () => {
    await editar.click()
    const edicao = page.getByRole("dialog", { name: "Editar QA Produto Teste" })
    await expect(edicao.getByRole("checkbox", { name: /Adicionais do açaí/ })).toBeChecked()
    await edicao.getByLabel("Preço (R$)").fill("13,90")
    await edicao.getByRole("button", { name: "Salvar" }).click()
    await aviso(page, "Produto atualizado.")
    await expect(page.getByRole("button", { name: /^Editar QA Produto Teste, R\$ 13,90/ }).filter({ visible: true }).first()).toBeVisible()
  })

  await test.step("marcar como indisponível", async () => {
    await page.getByRole("switch", { name: "QA Produto Teste disponível" }).filter({ visible: true }).first().click()
    await aviso(page, "QA Produto Teste marcado como indisponível.")
  })

  await test.step("excluir", async () => {
    await page.getByRole("button", { name: /^Editar QA Produto Teste/ }).filter({ visible: true }).first().click()
    await page.getByRole("dialog", { name: "Editar QA Produto Teste" }).getByRole("button", { name: "Excluir produto" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click()
    await aviso(page, "QA Produto Teste excluído.")
    await expect(page.getByRole("button", { name: /^Editar QA Produto Teste/ })).toHaveCount(0)
  })
  expect(erros, erros.join("\n")).toEqual([])
})

test("grupo de adicionais: criar, incluir opção, remover opção e excluir", async ({ page }) => {
  const erros = vigiarErros(page)
  await page.goto("/admin/cardapio")
  await page.getByRole("button", { name: "Opções" }).click()
  await page.getByRole("button", { name: "Novo grupo de opções" }).click()
  const dialogo = page.getByRole("dialog", { name: "Novo grupo de opções" })
  await dialogo.getByLabel("Nome do grupo").fill("QA Coberturas")
  await dialogo.getByLabel("Nome da opção 1").fill("Calda de chocolate")
  await dialogo.getByLabel("Acréscimo da opção 1 em reais").fill("1,50")
  await dialogo.getByRole("button", { name: "Adicionar opção" }).click()
  await dialogo.getByLabel("Nome da opção 2").fill("Calda de morango")
  await dialogo.getByLabel("Acréscimo da opção 2 em reais").fill("1,50")
  await dialogo.getByRole("button", { name: "Salvar grupo" }).click()
  await aviso(page, "Grupo criado.")

  await page.getByRole("button", { name: /QA Coberturas/ }).first().click()
  const edicao = page.getByRole("dialog", { name: "Editar QA Coberturas" })
  await edicao.getByRole("button", { name: "Remover opção 2" }).click()
  await edicao.getByRole("button", { name: "Salvar grupo" }).click()
  await aviso(page, "Grupo atualizado.")
  await expect(page.getByText("Calda de morango")).toHaveCount(0)

  await page.getByRole("button", { name: /QA Coberturas/ }).first().click()
  await page.getByRole("dialog", { name: "Editar QA Coberturas" }).getByRole("button", { name: "Excluir grupo" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click()
  await aviso(page, "Grupo excluído.")
  expect(erros, erros.join("\n")).toEqual([])
})

test("despesa: validar, lançar, editar e excluir", async ({ page }) => {
  const erros = vigiarErros(page)
  await page.goto("/admin/financeiro")
  await page.getByRole("button", { name: "Nova despesa" }).click()
  const painel = page.getByRole("dialog", { name: "Nova despesa" })

  await painel.getByLabel("Descrição").fill("QA Despesa teste")
  await painel.getByLabel("Valor (R$)").fill("abc")
  await painel.getByRole("button", { name: "Salvar" }).click()
  await expect(painel.getByRole("alert").first()).toBeVisible()

  await painel.getByLabel("Valor (R$)").fill("1,23")
  await painel.getByLabel("Categoria").selectOption({ label: "Outros" })
  await painel.getByRole("button", { name: "Salvar" }).click()
  await aviso(page, "Despesa lançada.")

  await page.getByRole("button", { name: /QA Despesa teste/ }).first().click()
  const edicao = page.getByRole("dialog", { name: "Editar despesa" })
  await edicao.getByLabel("Valor (R$)").fill("2,34")
  await edicao.getByRole("button", { name: "Salvar" }).click()
  await aviso(page, "Despesa atualizada.")
  await expect(page.getByRole("row").filter({ hasText: "QA Despesa teste" }).getByText("R$ 2,34")).toBeVisible()

  await page.getByRole("button", { name: /QA Despesa teste/ }).first().click()
  await page.getByRole("dialog", { name: "Editar despesa" }).getByRole("button", { name: "Excluir despesa" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click()
  await aviso(page, "Despesa excluída.")
  await expect(page.getByRole("button", { name: /QA Despesa teste/ })).toHaveCount(0)
  expect(erros, erros.join("\n")).toEqual([])
})

test("fornecedor: validar, cadastrar e desativar", async ({ page }) => {
  const erros = vigiarErros(page)
  await page.goto("/admin/financeiro")
  await page.getByRole("button", { name: "Fornecedores" }).click()
  await page.getByRole("button", { name: "Novo fornecedor" }).click()
  const dialogo = page.getByRole("dialog", { name: "Novo fornecedor" })
  await dialogo.getByLabel("Nome").fill("QA Fornecedor Teste")
  await dialogo.getByLabel("E-mail").fill("email-invalido")
  await dialogo.getByRole("button", { name: "Salvar fornecedor" }).click()
  await expect(dialogo.getByText("Informe um e-mail válido.")).toBeVisible()
  await dialogo.getByLabel("E-mail").fill("qa@fornecedor.example.com")
  await dialogo.getByLabel("Telefone").fill("(73) 99999-0000")
  await dialogo.getByRole("button", { name: "Salvar fornecedor" }).click()
  await aviso(page, "Fornecedor cadastrado.")

  const chave = page.getByRole("switch", { name: "QA Fornecedor Teste ativo" })
  await chave.click()
  await expect(chave).toHaveAttribute("aria-checked", "false")
  expect(erros, erros.join("\n")).toEqual([])
  const api = await apiComo("dono")
  await api.from("fornecedores").delete().like("nome", "QA %")
})

test("mesa: criar, editar lugares e excluir", async ({ page }) => {
  const erros = vigiarErros(page)
  await page.goto("/admin/mesas")
  await page.getByRole("button", { name: "Nova mesa" }).click()
  const painel = page.getByRole("dialog", { name: "Nova mesa" })
  await painel.getByLabel("Número").fill("99")
  await painel.getByLabel("Lugares").fill("2")
  await painel.getByRole("button", { name: "Salvar" }).click()
  await aviso(page, "Mesa 99 criada.")

  await page.getByRole("button", { name: /^Editar mesa 99, 2 lugares/ }).click()
  const edicao = page.getByRole("dialog", { name: "Editar Mesa 99" })
  await edicao.getByLabel("Lugares").fill("3")
  await edicao.getByRole("button", { name: "Salvar" }).click()
  await aviso(page, "Mesa atualizada.")

  await page.getByRole("button", { name: /^Editar mesa 99, 3 lugares/ }).click()
  await page.getByRole("dialog", { name: "Editar Mesa 99" }).getByRole("button", { name: "Excluir mesa" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click()
  await aviso(page, "Mesa 99 excluída.")
  await expect(page.getByRole("button", { name: /^Editar mesa 99/ })).toHaveCount(0)
  expect(erros, erros.join("\n")).toEqual([])
})

test("item de estoque: cadastrar com saldo, entrada, saída, contagem e desativar", async ({ page }) => {
  const erros = vigiarErros(page)
  const api = await apiComo("dono")
  const nome = "QA Item Teste"
  // item com movimentação não pode ser excluído: reaproveita o da rodada anterior
  const { data: existente } = await api.from("itens_estoque").select("id").eq("nome", nome).maybeSingle()
  if (existente) await api.from("itens_estoque").update({ ativo: true }).eq("id", existente.id)

  await page.goto("/admin/estoque")
  if (!existente) {
    await page.getByRole("button", { name: "Novo item" }).click()
    const painel = page.getByRole("dialog", { name: "Novo item de estoque" })
    await painel.getByLabel("Nome").fill(nome)
    await painel.getByLabel("Unidade", { exact: true }).selectOption("kg")
    await painel.getByLabel("Custo por unidade (R$)").fill("10,00")
    await painel.getByLabel("Quantidade atual").fill("2")
    await painel.getByLabel("Estoque mínimo").fill("1")
    await painel.getByRole("button", { name: "Salvar item" }).click()
    await aviso(page, "Item cadastrado.")
  }

  const linha = page.getByRole("listitem").filter({ hasText: nome })
  await linha.getByRole("button", { name: "Entrada" }).click()
  let dialogo = page.getByRole("dialog", { name: `Entrada de ${nome}` })
  await dialogo.getByLabel(/Quantidade recebida/).fill("1")
  await dialogo.getByRole("button", { name: "Registrar entrada" }).click()
  await aviso(page, "Entrada registrada.")

  await linha.getByRole("button", { name: "Saída" }).click()
  dialogo = page.getByRole("dialog", { name: `Saída de ${nome}` })
  await dialogo.getByLabel(/Quantidade que saiu/).fill("0,5")
  await dialogo.getByRole("button", { name: "Registrar saída" }).click()
  await expect(dialogo.getByText(/Informe o motivo da saída/)).toBeVisible()
  await dialogo.getByRole("button", { name: "Vencido" }).click()
  await dialogo.getByRole("button", { name: "Registrar saída" }).click()
  await aviso(page, "Saída registrada.")

  await linha.getByRole("button", { name: "Contagem" }).click()
  dialogo = page.getByRole("dialog", { name: `Contagem de ${nome}` })
  await dialogo.getByLabel(/Quantidade contada/).fill("2")
  await dialogo.getByRole("button", { name: "Salvar contagem" }).click()
  await aviso(page, "Contagem salva.")
  await expect(linha.getByText("2 kg").first()).toBeVisible()

  await linha.getByRole("button", { name: `Editar ${nome}` }).click()
  const edicao = page.getByRole("dialog", { name: `Editar ${nome}` })
  await edicao.getByRole("switch").first().click()
  await edicao.getByRole("button", { name: "Salvar item" }).click()
  await aviso(page, "Item atualizado.")
  expect(erros, erros.join("\n")).toEqual([])
})

test("configurações: alterar telefone e restaurar", async ({ page }) => {
  const erros = vigiarErros(page)
  await page.goto("/admin/configuracoes")
  const telefone = page.getByLabel("Telefone")
  const original = await telefone.inputValue()
  await telefone.fill("(73) 3231-0001")
  await page.getByRole("button", { name: "Salvar alterações" }).click()
  await aviso(page, "Configurações salvas.")
  await page.reload()
  await expect(page.getByLabel("Telefone")).toHaveValue("(73) 3231-0001")
  await page.getByLabel("Telefone").fill(original)
  await page.getByRole("button", { name: "Salvar alterações" }).click()
  await aviso(page, "Configurações salvas.")
  expect(erros, erros.join("\n")).toEqual([])
})

test("usuário: cadastrar, mudar função, redefinir senha, entrar e desativar", async ({ page, browser }) => {
  test.setTimeout(120_000)
  const erros = vigiarErros(page)
  const email = "qa-garcom@example.com"
  const senha1 = `Qa${Date.now() % 100000}a1`
  const senha2 = `Qa${(Date.now() + 7) % 100000}b2`
  const api = await apiComo("dono")
  const { data: existente } = await api.from("usuarios").select("id, ativo").eq("email", email).maybeSingle()

  await page.goto("/admin/usuarios")
  if (!existente) {
    await page.getByRole("button", { name: "Novo usuário" }).click()
    const dialogo = page.getByRole("dialog", { name: "Novo usuário" })
    await dialogo.getByLabel("Nome completo").fill("QA Garçom Teste")
    await dialogo.getByLabel("E-mail").fill(email)
    await dialogo.getByLabel("Senha provisória").fill("curta")
    await dialogo.getByRole("button", { name: "Cadastrar" }).click()
    await expect(dialogo.getByRole("alert").first()).toBeVisible()
    await dialogo.getByLabel("Senha provisória").fill(senha1)
    await dialogo.getByLabel("Função").selectOption("garcom")
    await dialogo.getByRole("button", { name: "Cadastrar" }).click()
    await aviso(page, "QA Garçom Teste cadastrado.")
  } else if (!existente.ativo) {
    await page.getByRole("button", { name: "Reativar QA Garçom Teste" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click()
    await aviso(page, "Usuário reativado.")
  }

  await page.getByRole("button", { name: "Editar QA Garçom Teste" }).click()
  const edicao = page.getByRole("dialog", { name: "Editar usuário" })
  await edicao.getByLabel("Função").selectOption("cozinha")
  await edicao.getByRole("button", { name: "Salvar" }).click()
  await aviso(page, "Usuário atualizado.")

  await page.getByRole("button", { name: "Redefinir senha de QA Garçom Teste" }).click()
  const reset = page.getByRole("dialog", { name: "Redefinir senha" })
  await reset.getByLabel("Nova senha").fill(senha2)
  await reset.getByRole("button", { name: "Redefinir" }).click()
  await aviso(page, "Senha de QA Garçom Teste redefinida.")

  await test.step("a pessoa entra com a senha nova e cai na tela da nova função", async () => {
    // janela sem a sessão do dono (o test.use do arquivo valeria aqui também)
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const p = await ctx.newPage()
    await p.goto("/login")
    await p.getByLabel("E-mail").fill(email)
    await p.getByLabel("Senha", { exact: true }).fill(senha2)
    await p.getByRole("button", { name: "Entrar" }).click()
    await expect(p).toHaveURL(/\/cozinha$/)
    await ctx.close()
  })

  await page.getByRole("button", { name: "Desativar QA Garçom Teste" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click()
  await aviso(page, "Usuário desativado.")

  await test.step("desativado não consegue mais entrar", async () => {
    // janela sem a sessão do dono (o test.use do arquivo valeria aqui também)
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const p = await ctx.newPage()
    await p.goto("/login")
    await p.getByLabel("E-mail").fill(email)
    await p.getByLabel("Senha", { exact: true }).fill(senha2)
    await p.getByRole("button", { name: "Entrar" }).click()
    await expect(p.getByRole("alert").filter({ hasText: "Seu acesso está desativado." })).toBeVisible()
    await expect(p).toHaveURL(/\/login/)
    await ctx.close()
  })
  expect(erros, erros.join("\n")).toEqual([])
})
