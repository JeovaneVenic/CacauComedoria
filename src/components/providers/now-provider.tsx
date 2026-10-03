"use client"

import { createContext } from "react"

/**
 * Horário em que o servidor desenhou a página. Os relógios (useNow) começam por ele para que o
 * HTML do servidor e a primeira renderização no navegador sejam idênticos (sem erro de hidratação
 * quando a virada de minuto cai entre os dois); logo depois passam à hora real do aparelho.
 */
export const ServerNowContext = createContext<number | null>(null)

export function NowProvider({ serverNow, children }: { serverNow: number; children: React.ReactNode }) {
  return <ServerNowContext.Provider value={serverNow}>{children}</ServerNowContext.Provider>
}
