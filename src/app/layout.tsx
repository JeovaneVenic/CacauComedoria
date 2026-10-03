import type { Metadata, Viewport } from "next"
import { Manrope } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ServiceWorkerRegister } from "@/components/pwa/service-worker"
import { NowProvider } from "@/components/providers/now-provider"
import { horarioDoServidor } from "@/components/providers/server-now"
import "./globals.css"

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Restaurante do Cacau",
    template: "%s · Restaurante do Cacau",
  },
  description: "Gestão do restaurante: mesas, pedidos, cozinha e financeiro em tempo real.",
  applicationName: "Restaurante do Cacau",
  appleWebApp: { capable: true, title: "Cacau", statusBarStyle: "default" },
}

export const viewport: Viewport = {
  themeColor: "#b5461c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NowProvider serverNow={horarioDoServidor()}>
          <TooltipProvider>{children}</TooltipProvider>
        </NowProvider>
        <Toaster position="top-center" richColors closeButton />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
