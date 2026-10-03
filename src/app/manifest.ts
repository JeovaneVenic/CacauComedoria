import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Restaurante do Cacau",
    short_name: "Cacau",
    description: "Mesas, pedidos, cozinha e financeiro do restaurante.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f6f6f7",
    theme_color: "#b5461c",
    categories: ["business", "food"],
    icons: [
      { src: "/icons/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mesas", url: "/garcom", icons: [{ src: "/icons/icone-192.png", sizes: "192x192" }] },
      { name: "Cozinha", url: "/cozinha", icons: [{ src: "/icons/icone-192.png", sizes: "192x192" }] },
    ],
  }
}
