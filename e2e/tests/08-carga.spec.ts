import { test, expect, request as pwRequest } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { apiComo, liberarMesa, mesaPorNumero } from "../helpers/api"
import { estado, SENHA, SUPABASE_KEY, SUPABASE_URL, USUARIOS } from "../helpers/env"

// Carga: vários tablets lançando pedidos ao mesmo tempo na mesma mesa, o mesmo pedido reenviado
// em paralelo (não pode duplicar) e várias telas abertas juntas.
// Os pedidos de teste são cancelados ("Teste de carga") e a mesa fecha com total zero: não gera faturamento.

const MESA = 4
const TABLETS = 10
const PEDIDOS_POR_TABLET = 3

const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1]

async function tablet(email: string) {
  const c = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: SENHA })
  if (error) throw error
  return c
}

test("10 tablets enviando pedidos ao mesmo tempo, sem erro e sem duplicar", async ({ browserName }, testInfo) => {
  test.skip(browserName !== "chromium", "teste de carga roda uma vez só")
  test.setTimeout(180_000)
  const dono = await apiComo("dono")
  await liberarMesa(MESA)
  const mesa = await mesaPorNumero(MESA)
  const { data: coca } = await dono.from("produtos").select("id").eq("nome", "Coca-Cola").single()
  const item = [{ produto_id: coca!.id, quantidade: 1, observacao: null, opcoes_ids: [] }]

  const emails = [USUARIOS.garcom.email, process.env.E2E_GARCOM2_EMAIL ?? "beatriz@example.com"]
  const tablets = await Promise.all(Array.from({ length: TABLETS }, (_, i) => tablet(emails[i % emails.length])))

  try {
    await test.step(`${TABLETS} tablets × ${PEDIDOS_POR_TABLET} pedidos simultâneos`, async () => {
      const tempos: number[] = []
      const resultados = await Promise.all(
        tablets.flatMap((t) =>
          Array.from({ length: PEDIDOS_POR_TABLET }, async () => {
            const inicio = performance.now()
            const r = await t.rpc("enviar_pedido", { p_chave_idempotencia: crypto.randomUUID(), p_mesa_id: mesa.id, p_itens: item, p_observacao: "Teste de carga", p_pessoas: 2 })
            tempos.push(performance.now() - inicio)
            return r
          })
        )
      )
      const erros = resultados.filter((r) => r.error).map((r) => r.error!.message)
      expect(erros, erros.join("\n")).toEqual([])
      const numeros = resultados.map((r) => (r.data as { numero: number }).numero)
      expect(new Set(numeros).size, "números de pedido repetidos").toBe(TABLETS * PEDIDOS_POR_TABLET)
      testInfo.annotations.push({ type: "tempo", description: `pedidos: p95 ${Math.round(p95(tempos))} ms, máx ${Math.round(Math.max(...tempos))} ms` })
      expect(p95(tempos)).toBeLessThan(5_000)
    })

    await test.step("o mesmo pedido enviado 8 vezes em paralelo vira 1 pedido só", async () => {
      const chave = crypto.randomUUID()
      const resultados = await Promise.all(
        Array.from({ length: 8 }, (_, i) => tablets[i % tablets.length].rpc("enviar_pedido", { p_chave_idempotencia: chave, p_mesa_id: mesa.id, p_itens: item, p_observacao: "Teste de carga (repetido)", p_pessoas: 2 }))
      )
      const erros = resultados.filter((r) => r.error).map((r) => r.error!.message)
      expect(erros, erros.join("\n")).toEqual([])
      expect(new Set(resultados.map((r) => (r.data as { pedido_id: string }).pedido_id)).size).toBe(1)
      const { count } = await dono.from("pedidos").select("id", { count: "exact", head: true }).eq("chave_idempotencia", chave)
      expect(count).toBe(1)
    })

    await test.step("a mesa tem exatamente os pedidos esperados", async () => {
      const atual = await mesaPorNumero(MESA)
      const { count } = await dono.from("pedidos").select("id", { count: "exact", head: true }).eq("atendimento_id", atual.atendimento_id!)
      expect(count).toBe(TABLETS * PEDIDOS_POR_TABLET + 1)
    })

    await test.step("20 telas do salão abertas ao mesmo tempo", async () => {
      const ctx = await pwRequest.newContext({ baseURL: testInfo.project.use.baseURL, storageState: estado("garcom") })
      const tempos: number[] = []
      const status = await Promise.all(
        Array.from({ length: 20 }, async (_, i) => {
          const inicio = performance.now()
          const r = await ctx.get(i % 2 ? "/garcom" : "/garcom/pedidos")
          tempos.push(performance.now() - inicio)
          return r.status()
        })
      )
      await ctx.dispose()
      expect(status.every((s) => s === 200), `status: ${status.join(",")}`).toBe(true)
      testInfo.annotations.push({ type: "tempo", description: `telas: p95 ${Math.round(p95(tempos))} ms, máx ${Math.round(Math.max(...tempos))} ms` })
      expect(p95(tempos)).toBeLessThan(8_000)
    })
  } finally {
    // limpeza: cancela os pedidos de teste e fecha a mesa com total zero
    const atual = await mesaPorNumero(MESA)
    if (atual.atendimento_id) {
      const { data: pedidos } = await dono.from("pedidos").select("id, status").eq("atendimento_id", atual.atendimento_id)
      await Promise.all(
        (pedidos ?? [])
          .filter((p) => !["cancelado", "devolvido", "entregue", "finalizado"].includes(p.status))
          .map((p) => dono.rpc("atualizar_status_pedido", { p_pedido_id: p.id, p_status: "cancelado", p_motivo: "Teste de carga" }))
      )
      const { error } = await dono.rpc("fechar_mesa", { p_atendimento_id: atual.atendimento_id, p_pagamentos: [], p_desconto: 0, p_sem_servico: false })
      expect(error, error?.message).toBeNull()
    }
    expect((await mesaPorNumero(MESA)).status).toBe("livre")
    // "local": encerra só a sessão deste teste, sem derrubar o garçom nos outros aparelhos
    await Promise.all(tablets.map((t) => t.auth.signOut({ scope: "local" })))
  }
})
