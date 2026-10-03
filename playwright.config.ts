import { readFileSync } from "node:fs"
import { defineConfig, devices } from "@playwright/test"
import { loadEnvConfig } from "@next/env"

// Variáveis do app (.env.local) + credenciais de teste (.env.e2e.local, fora do Git)
loadEnvConfig(process.cwd())
for (const line of readFileSync(".env.e2e.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3001"

/**
 * Testes de ponta a ponta do Cacau Comedoria.
 * Rodam no Chrome instalado na máquina (channel "chrome"), contra a versão de produção (npm run build && npm run start -- -p 3001).
 * Atenção: usam o banco Supabase configurado em .env.local (dados de demonstração).
 */
export default defineConfig({
  testDir: "./e2e/tests",
  // o fluxo completo usa o mesmo banco real: um teste por vez evita disputa pela mesma mesa
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "setup", testDir: "./e2e", testMatch: /auth\.setup\.ts/, use: { channel: "chrome" } },
    {
      // Chrome instalado: roda tudo (cadastros, impressão em PDF e carga só aqui)
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1366, height: 820 } },
      dependencies: ["setup"],
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1366, height: 820 } },
      testIgnore: /05-cadastros|07-impressao|08-carga/,
      dependencies: ["setup"],
    },
    {
      // Safari do iPad (o tablet do garçom), na horizontal
      name: "ipad-safari",
      use: { ...devices["iPad (gen 7) landscape"] },
      testIgnore: /05-cadastros|07-impressao|08-carga/,
      dependencies: ["setup"],
    },
    {
      // Safari do iPhone: telas, acesso e segurança (o fluxo completo usa tablet)
      name: "iphone-safari",
      use: { ...devices["iPhone 14"] },
      testIgnore: /04-fluxo-mesa|05-cadastros|06-teclado|07-impressao|08-carga/,
      dependencies: ["setup"],
    },
  ],
})
