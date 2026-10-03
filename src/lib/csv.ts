// Exportação CSV no formato que o Excel em português abre direto:
// separador ";", vírgula decimal e BOM UTF-8 para os acentos.

export type CsvValue = string | number | null | undefined

const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2, useGrouping: false })

// texto começando com = + - @ (ou tab/enter) vira fórmula no Excel (injeção de CSV)
const FORMULA = /^[=+\-@\t\r]/

function cell(v: CsvValue) {
  if (v === null || v === undefined) return ""
  const s = typeof v === "number" ? num.format(v) : FORMULA.test(v) ? `'${v}` : v
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: string[], rows: CsvValue[][]) {
  return [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n")
}

export function downloadCsv(filename: string, header: string[], rows: CsvValue[][]) {
  const blob = new Blob(["﻿", toCsv(header, rows)], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
