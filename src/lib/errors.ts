// Converte erros técnicos em mensagens amigáveis em português.

type MaybeError = { code?: string; message?: string; hint?: string; status?: number } | null | undefined

// Códigos lançados pelas funções do banco já trazem mensagem em português
const FRIENDLY_DB_CODES = new Set(["P0001", "P0002", "22023", "42501"])

export function friendlyError(error: unknown, fallback = "Algo deu errado. Tente novamente.") {
  const e = error as MaybeError
  if (!e) return fallback

  const message = e.message ?? ""

  if (e.code && FRIENDLY_DB_CODES.has(e.code) && message) return message
  if (e.code === "42501" || /row-level security|permission denied/i.test(message)) {
    return "Você não possui permissão para realizar esta ação."
  }
  if (e.code === "23505") return "Já existe um registro com esses dados."
  if (e.code === "23503") return "Este registro está em uso e não pode ser excluído."
  if (/Invalid login credentials/i.test(message)) return "E-mail ou senha incorretos."
  if (/Email not confirmed/i.test(message)) return "Confirme seu e-mail antes de entrar."
  if (/rate limit|too many/i.test(message)) return "Muitas tentativas. Aguarde alguns instantes."
  if (/Password should be at least/i.test(message)) return "A senha deve ter pelo menos 8 caracteres."
  if (/already (been )?registered|already exists/i.test(message)) return "Este e-mail já está cadastrado."
  if (/Failed to fetch|NetworkError|network|fetch failed/i.test(message)) {
    return "Não foi possível conectar. Verifique sua conexão."
  }
  return fallback
}
