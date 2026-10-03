# Cacau Comedoria — Sistema de gestão de restaurante

Sistema web (PWA) para operar e administrar um restaurante de salão: o garçom lança o pedido no tablet, a cozinha recebe na hora, a gestão acompanha mesas, vendas, despesas e estoque em tempo real. Toda a interface é em português do Brasil.

## Público-alvo

Restaurantes, bares, lanchonetes e comedorias **de pequeno e médio porte com atendimento à mesa**, que hoje trabalham com comanda de papel ou planilha e querem organizar o salão, a cozinha e o caixa num só lugar, usando tablets e celulares que já têm.

Dentro do restaurante, o sistema atende quatro perfis:

| Perfil | Para quem | O que faz no sistema |
|---|---|---|
| **Proprietário / gerente** | Dono e gestão | Painel do dia, financeiro, relatórios, estoque, cardápio, mesas, equipe e auditoria |
| **Garçom** | Equipe de salão | Abre mesas, lança pedidos no tablet (inclusive sem internet), acompanha o preparo, solicita e fecha a conta |
| **Cozinha** | Cozinheiros e copa | Painel escuro com a fila de pedidos, alerta sonoro e avanço do preparo com um toque |
| **Caixa / administrador** | Perfis extras | Previstos no modelo de permissões para crescer com o restaurante |

## Funcionalidades

- **Salão e mesas:** mapa por setores, status em tempo real (livre, aguardando pedido, em preparo, pedido pronto, aguardando pagamento) e tempo de ocupação.
- **Pedidos do garçom:** cardápio por categoria com busca, adicionais e observações, carrinho salvo no aparelho e envio que **nunca duplica** (chave de idempotência).
- **Modo offline:** sem internet, o pedido fica numa fila no tablet e é enviado sozinho quando a conexão volta; telas já visitadas abrem mesmo offline. Pode ser instalado como app.
- **Cozinha (KDS):** fila por chegada, alarme alto para pedido novo, lembrete de pedidos parados e tempos de preparo.
- **Conta e pagamento:** taxa de serviço, desconto, divisão em várias formas de pagamento (Pix, crédito, débito, dinheiro, vale) e troco.
- **Cardápio:** categorias, produtos com foto, grupos de opções/adicionais e disponibilidade.
- **Financeiro:** receitas, despesas por categoria e fornecedor, comprovantes em pasta privada e lucro estimado.
- **Relatórios:** vendas por dia e por hora, produtos e categorias mais vendidos, desempenho por garçom e por mesa, tempos de preparo, cancelamentos e despesas — com exportação CSV para o Excel.
- **Estoque:** insumos com estoque mínimo, entradas com custo médio, saídas com motivo, contagens, ficha técnica dos pratos (custo e margem) e baixa automática opcional ao finalizar pedidos.
- **Auditoria:** registro imutável de quem fez o quê (pedidos, contas, cardápio, financeiro, estoque, equipe e acessos), com o "antes → depois" de cada alteração.
- **Notificações:** pedido pronto para o garçom, conta solicitada, estoque baixo e novas despesas.

## Tecnologias

- [Next.js](https://nextjs.org) 16 (App Router, Server Actions), React 19 e TypeScript
- [Supabase](https://supabase.com): PostgreSQL, Auth, Realtime e Storage
- Tailwind CSS 4, componentes shadcn/ui (Base UI) e ícones Lucide
- Zustand (carrinho e fila offline), React Hook Form + Zod (formulários e validação) e Recharts (gráficos)

## Segurança

- **Regras no banco (RLS)** em todas as tabelas: cada restaurante só enxerga os próprios dados e cada perfil só faz o que lhe cabe, mesmo chamando a API diretamente.
- Operações sensíveis (pedido, fechamento de conta, estoque) passam por **funções no banco** que validam perfil, valores e transições de status.
- Proteção contra escalonamento de privilégio na equipe, auditoria que ninguém consegue alterar, cabeçalhos de segurança (CSP, anti-iframe) e espera progressiva após senhas erradas.
- A chave secreta do Supabase fica **só no servidor** e nunca vai para o navegador nem para o repositório.

## Como rodar

Pré-requisitos: Node.js 20+ e um projeto no Supabase (de preferência na região São Paulo).

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie o banco: no **SQL Editor** do Supabase, rode `supabase/instalacao-completa.sql` (todas as migrações + dados de demonstração). Em um banco já existente, rode apenas as migrações novas de `supabase/migrations/`, em ordem.
3. Copie `.env.example` para `.env.local` e preencha a URL e as chaves do seu projeto (Supabase → Project Settings → API).
4. Inicie:
   ```bash
   npm run dev
   ```
   Acesse http://localhost:3000. Os usuários de demonstração estão no cabeçalho de `supabase/seed.sql` — **troque as senhas antes de usar de verdade**.

Para produção: `npm run build` e `npm run start` (o modo offline/PWA só é ativado na versão de produção e exige HTTPS na hospedagem).

## Estrutura

```
src/
  app/           telas: admin (gestão), garcom, cozinha, login
  features/      regras por área: pedidos, mesas, cardápio, financeiro, estoque, auditoria…
  services/      consultas ao banco feitas no servidor
  components/    interface compartilhada (layout, formulários, PWA)
  lib/ hooks/ stores/ schemas/
supabase/
  migrations/    esquema, funções, permissões (RLS), relatórios, estoque, auditoria, segurança e índices
  seed.sql       dados de demonstração (4 mesas, cardápio e 30 dias de histórico)
  ajustes/       scripts pontuais para bancos já em uso
public/          ícones do app, service worker e página offline
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção |
| `npm run lint` | Verificação de código (ESLint) |
| `npm run typecheck` | Verificação de tipos (TypeScript) |
