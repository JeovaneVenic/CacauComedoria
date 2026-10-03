# Cacau Comedoria — Sistema de gestão de restaurante

Sistema web (PWA) para operar e administrar um restaurante de salão: o garçom lança o pedido no tablet, a cozinha recebe na hora, a gestão acompanha mesas, vendas, despesas e estoque em tempo real. Toda a interface é em português do Brasil.

## Público-alvo

Restaurantes, bares, lanchonetes e comedorias **de pequeno e médio porte com atendimento à mesa**, que hoje trabalham com comanda de papel ou planilha e querem organizar o salão, a cozinha e o caixa num só lugar, usando tablets e celulares que já têm.

## Quem faz o quê

Cada pessoa entra com o próprio e-mail e senha e cai direto na tela do seu perfil. As permissões são conferidas no servidor **e** no banco de dados: trocar o endereço no navegador ou chamar a API diretamente não libera nada além do que o perfil pode fazer.

### Proprietário (dono)

Tela inicial: **Painel** (`/admin`), com menu lateral para todas as áreas.

- **Acompanha o dia:** faturamento, pedidos, ticket médio, despesas e lucro estimado comparados com o dia, a semana e o mês anteriores, e o salão ao vivo.
- **Pedidos:** vê todos os pedidos, **cancela pedidos e itens** (com motivo), registra devoluções e adiciona itens a pedidos já enviados.
- **Mesas e salão:** cadastra setores e mesas, muda lugares e posição, ativa e desativa mesas.
- **Cardápio:** categorias, produtos (preço, foto, tempo de preparo), adicionais e disponibilidade.
- **Conta:** fecha a conta de qualquer mesa (taxa de serviço, desconto, várias formas de pagamento, troco) e **imprime a pré-conta**.
- **Financeiro:** lança despesas com comprovante, cadastra fornecedores e vê receitas e lucro.
- **Relatórios:** vendas, produtos, garçons, mesas, horários de pico, cancelamentos e despesas, com exportação CSV.
- **Estoque:** insumos, entradas, saídas, contagens, ficha técnica dos pratos e baixa automática.
- **Equipe:** cadastra garçons, cozinha e **gerentes**; edita, desativa e redefine senhas; vê o histórico de cada pessoa.
- **Auditoria:** consulta quem fez o quê, quando e o que mudou (não é possível apagar nem alterar os registros).
- **Configurações:** dados do restaurante, taxa de serviço, horário e se o garçom pode fechar a mesa.
- **Notificações:** conta solicitada, estoque baixo e novas despesas.

### Gerente

Mesma tela e mesmos acessos do proprietário (painel, pedidos, cardápio, financeiro, relatórios, estoque, auditoria e configurações), com estes limites na **equipe**:

- cadastra, edita, desativa e redefine a senha **somente** de garçons e cozinha;
- **não** cria, promove, rebaixa nem desativa outros gerentes;
- **não** altera nada do proprietário (nem a senha);
- ninguém, nem o proprietário, muda a própria função ou desativa o próprio acesso.

### Garçom

Tela inicial: **Mesas** (`/garcom`), pensada para tablet e celular, com menu inferior: Mesas, Pedidos, Conta e Perfil.

- **Mesas:** vê o salão inteiro em tempo real e filtra "minhas mesas"; **abre mesa** informando o número de pessoas.
- **Lança pedidos:** cardápio com busca, adicionais e observações; o carrinho fica salvo no aparelho e o envio nunca duplica.
- **Sem internet:** o pedido entra numa fila no aparelho e é enviado sozinho quando a conexão volta.
- **Acompanha o preparo:** recebe aviso quando o pedido fica pronto e marca como **entregue**.
- **Pede a conta** da mesa, o que avisa o caixa.
- **Fecha a conta** somente se o proprietário ligar a opção "garçom pode fechar mesa" em Configurações.
- **Não pode:** cancelar pedidos ou itens, ver financeiro, relatórios, estoque, cardápio administrativo, equipe ou auditoria.

### Cozinha

Tela única: **Cozinha** (`/cozinha`), em fundo escuro para monitor ou tablet na parede.

- recebe cada pedido novo com **alarme alto** e lembrete de pedidos parados;
- avança o pedido com um toque: **novo → em preparo → pronto** (o garçom é avisado na hora);
- pode marcar como entregue quando a própria cozinha leva o prato;
- **não pode:** lançar ou cancelar pedidos, abrir ou fechar mesas, nem ver valores do financeiro.

### Caixa

Perfil previsto para quem fica no **computador do caixa** (com a impressora). Usa as telas do salão (`/garcom`) com estes poderes:

- recebe a notificação **"Mesa solicitou a conta"**;
- **imprime a pré-conta** e **fecha a conta** de qualquer mesa, mesmo com a opção do garçom desligada;
- abre mesas e lança pedidos como o garçom.

> Nesta versão, o perfil **Caixa** (e o **Administrador**, que tem os mesmos acessos do proprietário) ainda não aparecem na lista da tela Usuários; quem atende o caixa pode usar um usuário **Gerente** ou **Proprietário**.

## Impressão da nota (pré-conta)

O sistema imprime a **pré-conta**, uma nota de balcão para o cliente conferir **quanto deu a conta** antes de pagar. **Não é nota fiscal:** o próprio cupom traz "Não é documento fiscal". Para emitir NFC-e (cupom fiscal eletrônico) é preciso integrar um emissor junto à Sefaz, com o certificado digital da empresa. Isso não faz parte desta versão.

**O que sai no cupom (bobina de 80 mm):** logo, nome, endereço e telefone do restaurante; mesa, data e hora, garçom, horário de abertura e número de pessoas; itens (iguais agrupados) com adicionais e observações; subtotal, taxa de serviço (opcional) e **TOTAL** em destaque; valor por pessoa.

**Onde imprimir:**

1. Na tela de conta da mesa, toque em **"Imprimir pré-conta"**:
   - proprietário/gerente: **Painel → Salão agora → toque na mesa → Conta e fechamento** (`/admin/conta/<mesa>`), ou pela notificação "Mesa solicitou a conta";
   - caixa/garçom: **Mesas → mesa → Conta** (`/garcom/mesa/<mesa>/conta`).
2. A impressão sai na impressora do **computador em que o botão foi tocado**. Por isso, use o computador do caixa, onde a térmica está ligada por USB.
3. Se a taxa de serviço for desligada na tela, o cupom sai sem ela.

**Configurar o computador do caixa (uma vez só):**

1. Instale o driver da impressora térmica no Windows e deixe-a como **impressora padrão**.
2. Na primeira impressão, na janela do Chrome, escolha **Margens: nenhuma** e desmarque **Cabeçalhos e rodapés**. O Chrome lembra dessas escolhas.
3. Para imprimir **direto, sem a janela de impressão**, abra o sistema por um atalho do Chrome com a opção `--kiosk-printing` (feche todas as janelas do Chrome antes):
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing https://ENDERECO-DO-SISTEMA/garcom
   ```

Para conferir o cupom na tela, abra `/imprimir/pre-conta/<mesa>` direto no navegador; ali há um botão "Imprimir".

## Funcionalidades

- **Salão e mesas:** mapa por setores, status em tempo real (livre, aguardando pedido, em preparo, pedido pronto, aguardando pagamento) e tempo de ocupação.
- **Pedidos do garçom:** cardápio por categoria com busca, adicionais e observações, carrinho salvo no aparelho e envio que **nunca duplica** (chave de idempotência).
- **Modo offline:** sem internet, o pedido fica numa fila no tablet e é enviado sozinho quando a conexão volta; telas já visitadas abrem mesmo offline. Pode ser instalado como app.
- **Cozinha (KDS):** fila por chegada, alarme alto para pedido novo, lembrete de pedidos parados e tempos de preparo.
- **Conta e pagamento:** taxa de serviço, desconto, divisão em várias formas de pagamento (Pix, crédito, débito e dinheiro) e troco.
- **Pré-conta impressa:** nota de balcão com o logo e o total da mesa, em impressora térmica de 80 mm (veja [Impressão da nota](#impressão-da-nota-pré-conta)).
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

## Testes automáticos (QA)

Suíte de ponta a ponta com [Playwright](https://playwright.dev) e [axe-core](https://github.com/dequelabs/axe-core), escrita seguindo as práticas do [qa-skills](https://github.com/petrkindlmann/qa-skills) (planejamento por risco, Playwright, acessibilidade e segurança). Roda no Chrome instalado no computador.

| Arquivo | O que verifica |
|---|---|
| `01-acesso` | Login (senha errada, campos vazios, saída), bloqueio de telas por perfil e **permissões direto na API** (visitante, garçom, auditoria imutável) |
| `02-seguranca` | Cabeçalhos de segurança, service worker, manifesto do app, redirecionamento aberto e página 404 |
| `03-telas` | **Todas as telas** de cada perfil abrem sem erro de console nem falha de servidor, passam na varredura de **acessibilidade WCAG 2.2 AA** (zero violações sérias/críticas) e as do garçom cabem no celular e no tablet |
| `04-fluxo-mesa` | Fluxo completo com garçom, cozinha e dono ao mesmo tempo: abrir mesa → açaí com adicionais → **pedido sem internet** (fila, sem duplicar) → cozinha prepara → entrega → conta (R$ 35,09) → **pré-conta impressa** → Finalizar → fechar em Pix → mesa livre → auditoria |

Os casos de teste, os resultados de cada rodada e os defeitos encontrados e resolvidos estão em [docs/qa/casos-de-teste.md](docs/qa/casos-de-teste.md).

Como rodar:

1. Crie `.env.e2e.local` (não vai para o Git) com `E2E_BASE_URL`, `E2E_DONO_EMAIL`, `E2E_GARCOM_EMAIL`, `E2E_COZINHA_EMAIL` e `E2E_SENHA` (usuários de demonstração do `seed.sql`).
2. Gere e suba a versão de produção: `npm run build` e `npm run start -- -p 3001`.
3. Rode `npm run test:e2e` (ou `npm run test:e2e:ver` para assistir no navegador). O relatório fica em `playwright-report/`.

> Os testes usam o banco configurado no `.env.local` e registram vendas de teste na mesa 04 (que termina livre). Use um projeto Supabase de testes ou os dados de demonstração — nunca o banco do restaurante em operação.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção |
| `npm run lint` | Verificação de código (ESLint) |
| `npm run typecheck` | Verificação de tipos (TypeScript) |
| `npm run test:e2e` | Testes de ponta a ponta (Playwright) contra a versão de produção |
| `npm run test:e2e:ver` | Os mesmos testes, com o navegador visível |
