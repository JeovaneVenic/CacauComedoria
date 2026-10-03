import { test as setup, expect } from "@playwright/test"
import { estado, SENHA, USUARIOS, type Perfil } from "./helpers/env"

// Entra uma vez com cada perfil pela tela de login e guarda a sessão para os demais testes.
for (const perfil of Object.keys(USUARIOS) as Perfil[]) {
  setup(`entrar como ${perfil}`, async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("E-mail").fill(USUARIOS[perfil].email)
    await page.getByLabel("Senha", { exact: true }).fill(SENHA)
    await page.getByRole("button", { name: "Entrar" }).click()
    await expect(page).toHaveURL(USUARIOS[perfil].home)
    await page.context().storageState({ path: estado(perfil) })
  })
}
