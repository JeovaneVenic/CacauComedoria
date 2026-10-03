import "server-only"

/**
 * Horário da renderização no servidor. O layout raiz é desenhado uma vez por requisição,
 * então ler o relógio aqui é seguro (não muda entre re-renderizações do mesmo HTML).
 */
export function horarioDoServidor() {
  return Date.now()
}
