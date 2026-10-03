/* Service worker do Restaurante do Cacau.
 *
 * - Arquivos do app (/_next/static, ícones, fontes): guardados na primeira visita e servidos do aparelho.
 * - Telas (navegação): busca na rede; se a internet cair, mostra a última versão salva da tela
 *   ou a página "Sem conexão".
 * - Supabase e qualquer outro domínio: nunca passam por aqui (dados sempre ao vivo).
 * - Ao sair do sistema, as telas salvas são apagadas (outro usuário pode usar o aparelho).
 */

const VERSAO = "v1"
const ESTATICOS = `cacau-estaticos-${VERSAO}`
const TELAS = `cacau-telas-${VERSAO}`
const OFFLINE = "/offline.html"
const PRECACHE = [OFFLINE, "/icons/icone-192.png", "/icons/icone-512.png", "/brand/mascote.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(ESTATICOS)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("cacau-") && k !== ESTATICOS && k !== TELAS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("message", (event) => {
  if (event.data === "limpar-telas") event.waitUntil(caches.delete(TELAS))
})

function ehEstatico(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/__nextjs_font/") ||
    /\.(?:woff2?|png|jpg|jpeg|webp|avif|svg|ico)$/.test(url.pathname)
  )
}

async function primeiroCache(request) {
  const cache = await caches.open(ESTATICOS)
  const salvo = await cache.match(request)
  if (salvo) return salvo
  const resposta = await fetch(request)
  if (resposta.ok && resposta.type === "basic") cache.put(request, resposta.clone())
  return resposta
}

async function tela(request, url) {
  // sair / entrar: apaga as telas do usuário anterior
  if (url.pathname.startsWith("/auth/sair") || url.pathname === "/login") {
    await caches.delete(TELAS)
    try {
      return await fetch(request)
    } catch {
      return (await caches.match(OFFLINE)) ?? Response.error()
    }
  }
  try {
    const resposta = await fetch(request)
    // guarda só telas do app que abriram normalmente (sem redirecionamento para o login)
    if (resposta.ok && resposta.type === "basic" && !resposta.redirected && /^\/(garcom|cozinha|admin)(\/|$)/.test(url.pathname)) {
      const cache = await caches.open(TELAS)
      cache.put(url.pathname + url.search, resposta.clone())
    }
    return resposta
  } catch {
    const cache = await caches.open(TELAS)
    return (await cache.match(url.pathname + url.search)) ?? (await cache.match(url.pathname)) ?? (await caches.match(OFFLINE)) ?? Response.error()
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    event.respondWith(tela(request, url))
    return
  }
  if (ehEstatico(url)) {
    event.respondWith(primeiroCache(request))
  }
})
