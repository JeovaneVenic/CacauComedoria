import type { NextConfig } from "next"

// Fotos dos produtos e logos vêm do Storage público do Supabase deste projeto
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null
const isDev = process.env.NODE_ENV !== "production"

// Política de conteúdo: o navegador só carrega scripts, dados e imagens destas origens.
// 'unsafe-inline' em scripts é exigido pelos scripts de inicialização do Next sem nonce;
// a proteção principal vem de connect-src (dados só vão para o próprio app e o Supabase).
const supabaseOrigin = supabaseUrl?.origin ?? ""
const supabaseWs = supabaseUrl ? `wss://${supabaseUrl.host}` : ""
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}${isDev ? " ws: http://localhost:*" : ""}`,
  "media-src 'self' data:",
  "worker-src 'self'",
  "manifest-src 'self'",
  // iframe só do próprio sistema (impressão da pré-conta); nenhum outro site pode embutir o app
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // só o próprio sistema pode se embutir num iframe (proteção contra clickjacking)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // a câmera é usada só pelo seletor de arquivos (foto do comprovante/produto), que não precisa desta permissão
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  // só vale em HTTPS (na hospedagem); navegadores ignoram em http://localhost
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: supabaseUrl
      ? [
          {
            protocol: "https",
            hostname: supabaseUrl.hostname,
            port: "",
            pathname: "/storage/v1/object/public/**",
            search: "",
          },
        ]
      : [],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // o service worker nunca fica preso em cache: atualizações chegam na próxima abertura
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ]
  },
}

export default nextConfig
