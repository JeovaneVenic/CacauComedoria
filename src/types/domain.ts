// Tipos de domínio espelhando o esquema em supabase/migrations (nomes do banco em português).

export type AppRole = "proprietario" | "gerente" | "garcom" | "cozinha" | "caixa" | "administrador"

export type TableStatus =
  | "livre"
  | "ocupada"
  | "aguardando_pedido"
  | "em_preparo"
  | "pedido_pronto"
  | "aguardando_pagamento"
  | "finalizada"

export type TableShape = "quadrada" | "redonda" | "retangular"

export type SessionStatus = "aberto" | "conta_solicitada" | "fechado"

export type OrderStatus =
  | "aguardando_envio"
  | "novo"
  | "em_preparo"
  | "pronto"
  | "entregue"
  | "finalizado"
  | "cancelado"
  | "devolvido"

/** public.restaurantes */
export interface Restaurant {
  id: string
  nome: string
  slug: string
  logo_url: string | null
  endereco: string | null
  telefone: string | null
  horario_funcionamento: Record<string, string>
  taxa_servico_percentual: number
  moeda: string
  fuso_horario: string
  garcom_pode_fechar_mesa: boolean
  baixa_estoque_automatica: boolean
}

/** public.usuarios */
export interface Profile {
  id: string
  restaurante_id: string | null
  nome: string
  email: string | null
  telefone: string | null
  papel: AppRole
  ativo: boolean
  avatar_url: string | null
  criado_em: string
}

/** public.setores */
export interface Section {
  id: string
  restaurante_id: string
  nome: string
  ordem: number
}

/** public.mesas */
export interface DiningTable {
  id: string
  restaurante_id: string
  setor_id: string | null
  numero: number
  capacidade: number
  formato: TableShape
  pos_x: number
  pos_y: number
  status: TableStatus
  ativa: boolean
}

/** Linha da visão public.visao_mesas */
export interface TableOverview {
  id: string
  restaurante_id: string
  numero: number
  capacidade: number
  formato: TableShape
  pos_x: number
  pos_y: number
  status: TableStatus
  ativa: boolean
  setor_id: string | null
  setor_nome: string | null
  atendimento_id: string | null
  pessoas: number | null
  aberto_em: string | null
  atendimento_status: SessionStatus | null
  garcom_id: string | null
  garcom_nome: string | null
  subtotal: number
}

/** public.categorias */
export interface Category {
  id: string
  restaurante_id: string
  nome: string
  icone: string | null
  ordem: number
  ativa: boolean
}

/** public.produtos */
export interface Product {
  id: string
  restaurante_id: string
  categoria_id: string
  nome: string
  descricao: string | null
  preco: number
  imagem_url: string | null
  tempo_preparo_min: number
  ativo: boolean
  ordem: number
}

/** public.opcoes */
export interface ModifierOption {
  id: string
  grupo_id: string
  nome: string
  acrescimo: number
  ordem: number
  ativa: boolean
}

/** public.grupos_opcoes (com as opções) */
export interface ModifierGroup {
  id: string
  restaurante_id: string
  nome: string
  min_escolhas: number
  max_escolhas: number
  opcoes: ModifierOption[]
}

/** public.produto_grupos_opcoes */
export interface ProductGroupLink {
  produto_id: string
  grupo_id: string
  ordem: number
}