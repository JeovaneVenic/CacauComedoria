# Casos de teste e defeitos resolvidos — Cacau Comedoria

Relatório da rodada de QA de 03/10/2026, feita com a suíte de ponta a ponta em `e2e/` (Playwright + axe-core), seguindo as práticas do [qa-skills](https://github.com/petrkindlmann/qa-skills): `risk-based-testing`, `playwright-automation`, `accessibility-testing`, `security-testing` e `test-case-management`.

## Resultado

| Rodada | Passaram | Falharam | Observação |
|---|---|---|---|
| 1ª | 17 | 21 | 7 defeitos do sistema e 4 ajustes de teste encontrados |
| 2ª (após correções) | 37 | 1 | 1 corrida no próprio teste (entrega com clique duplo) |
| 3ª (só o fluxo da mesa) | 3 | 1 | adicionais fora de ordem na pré-conta (DEF-07) |
| 4ª e 5ª (estabilidade) | **38** | **0** | duas rodadas seguidas sem falha |

**Ambiente:** versão de produção (`npm run build` + `npm run start -- -p 3001`), Google Chrome 1366×820 (garçom também em 390×844 e 820×1180), banco Supabase com os dados de demonstração, usuários `dono`, `joao` (garçom) e `cozinha` do `supabase/seed.sql`.

---

## Defeitos encontrados e resolvidos

| ID | Gravidade | Onde | O que estava errado | Causa | Correção | Arquivo | Verificado por |
|---|---|---|---|---|---|---|---|
| DEF-01 | Média | Menu lateral de todas as 16 telas da gestão | Nome do usuário no rodapé do menu com contraste 4,4:1 (mínimo WCAG AA: 4,5:1) | Texto em `sidebar-foreground` com 70% de opacidade | Cor `muted-foreground` (5,9:1) | `src/app/admin/admin-nav.tsx` | CT-T01 a CT-T16 |
| DEF-02 | Média | Usuários (selo "Desativado") | Texto vermelho sobre fundo vermelho claro numa linha cinza abaixo de 4,5:1 | Vermelho de alerta do tema claro (`#c62828`) claro demais para fundos tingidos | Vermelho de alerta passa a `#b42318` (6,6:1 no branco) | `src/app/globals.css` | CT-T14 |
| DEF-03 | Média | Cozinha (selo de pedido atrasado) | Texto branco sobre vermelho claro do tema escuro: 2,9:1 | Combinação `bg-destructive text-white` no tema escuro | Texto escuro (`text-background`), como os outros selos | `src/app/cozinha/kitchen-display.tsx` | CT-T18 |
| DEF-04 | Média | Painel; Relatórios › Vendas e Pedidos | Gráfico escondido de leitores de tela (`aria-hidden`) mas com elemento focável pelo teclado | Recharts 3 ativa por padrão uma camada de foco no gráfico | `accessibilityLayer={false}`; os dados continuam na tabela acessível ao lado do gráfico | `src/app/admin/revenue-chart.tsx`, `src/app/admin/relatorios/report-charts.tsx` | CT-T01, CT-T09, CT-T12 |
| DEF-05 | Média | Relatórios › Produtos e Equipe e mesas | Tabelas com rolagem própria não podiam ser roladas pelo teclado | Contêiner rolável sem foco | Contêiner recebe foco (`tabIndex=0`), papel de região com nome e anel de foco visível | `src/app/admin/relatorios/reports-view.tsx` | CT-T10, CT-T11 |
| DEF-06 | Baixa | Garçom › Novo pedido | Tela sem título principal (h1) para leitores de tela | Cabeçalho só com link e busca | Título "Novo pedido · Mesa NN" visível para leitores de tela | `src/app/garcom/mesa/[id]/pedido/order-builder.tsx` | CT-T17 |
| DEF-07 | Baixa | Pré-conta, cozinha, conta e detalhes do pedido | Adicionais em ordem aleatória (cupom mostrava "Morango, Leite condensado"; o garçom tinha escolhido na ordem do cardápio) | O banco não garante a ordem dos adicionais gravados no pedido | Adicionais ordenados pela ordem do cardápio em todas as telas; cupom usa o mesmo separador " · " | `src/services/orders.ts`, `src/app/imprimir/pre-conta/[id]/page.tsx` | CT-F01 (passo 7) |

### Ajustes feitos nos testes (não eram defeitos do sistema)

| ID | Teste | Problema no teste | Ajuste |
|---|---|---|---|
| AJ-01 | CT-A01 | Localizava "o aviso da tela" e encontrava dois (o segundo é o anunciador de rotas do Next.js, vazio) | Procura o aviso pelo texto |
| AJ-02 | CT-S05 | Abria um endereço inexistente sem login e era levado (corretamente) para a tela de entrada | Roda logado como dono |
| AJ-03 | CT-F01 | Esperava os adicionais separados por vírgula; o sistema usa " · " | Expectativa corrigida |
| AJ-04 | CT-F01 | Clicava "Marcar como entregue" duas vezes seguidas, antes da tela atualizar | Espera a tela atualizar após cada entrega |

---

## Casos de teste

Todos automatizados. Status final: **todos aprovados** (rodadas 4 e 5).

### Entrada no sistema — `e2e/tests/01-acesso.spec.ts`

| ID | Título | Pré-condição | Passos | Resultado esperado | Dados |
|---|---|---|---|---|---|
| CT-A01 | Login — senha errada — mensagem clara | Sem sessão | 1. Abrir `/login` 2. Preencher e-mail do garçom e senha errada 3. Tocar "Entrar" | Aviso "E-mail ou senha incorretos."; continua em `/login` | senha `senha-errada-123` |
| CT-A02 | Login — campos vazios — validação | Sem sessão | 1. Abrir `/login` 2. Tocar "Entrar" | "Informe seu e-mail." e "Informe sua senha." visíveis | — |
| CT-A03 | Telas internas — sem login — vão para o login | Sem sessão | Abrir `/admin`, `/garcom`, `/cozinha`, `/admin/financeiro` e `/imprimir/pre-conta/<id>` | Todas terminam em `/login` | — |
| CT-A04 | Sair — encerra a sessão | Logado como cozinha | 1. Abrir `/auth/sair` 2. Abrir `/cozinha` | Volta para `/login` nas duas | usuário cozinha |
| CT-P01 | Garçom — telas da gestão e cozinha — bloqueadas | Logado como garçom | Abrir `/admin`, `/admin/financeiro`, `/admin/usuarios`, `/admin/auditoria`, `/admin/estoque`, `/cozinha` | Todas terminam em `/garcom` | — |
| CT-P02 | Cozinha — salão e gestão — bloqueados | Logado como cozinha | Abrir `/garcom`, `/admin`, `/admin/relatorios` | Todas terminam em `/cozinha` | — |
| CT-API01 | API — visitante sem login — não lê nem executa | Cliente sem sessão | Ler `pedidos`, `pagamentos`, `usuarios`, `despesas`, `auditoria`; executar `relatorio` | Nenhuma linha retornada; `relatorio` recusado | — |
| CT-API02 | API — garçom — sem financeiro, auditoria e relatórios | Sessão do garçom | Ler `despesas`, `pagamentos`, `auditoria`, `movimentacoes_estoque`; executar `relatorio` | Zero linhas; `relatorio` recusado com "permissão" | — |
| CT-API03 | API — garçom — não muda a própria função nem cancela pedido | Sessão do garçom | 1. Tentar `papel = gerente` no próprio usuário 2. Tentar cancelar um pedido | Função continua "garcom"; cancelamento recusado | — |
| CT-API04 | API — auditoria — imutável até para o dono | Sessão do dono | Tentar apagar e alterar um registro da auditoria | Registro continua igual | descrição "adulterado" |

### Segurança — `e2e/tests/02-seguranca.spec.ts`

| ID | Título | Passos | Resultado esperado |
|---|---|---|---|
| CT-S01 | Cabeçalhos de segurança | Ler cabeçalhos de `/login` e `/manifest.webmanifest` | `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, CSP com `frame-ancestors 'self'` e `object-src 'none'`, sem `X-Powered-By` |
| CT-S02 | Service worker sem cache preso | Ler `/sw.js` | Status 200 e `Cache-Control` com `no-store` |
| CT-S03 | Manifesto do app instalável | Ler `/manifest.webmanifest` e cada ícone | Nome preenchido, `display: standalone`, ícone `maskable`, todos os ícones com status 200 |
| CT-S04 | Recuperação de senha — sem redirecionamento externo | Abrir `/auth/confirm?code=invalido&next=` com `//exemplo-malicioso.com`, `/\exemplo-malicioso.com` e `https://exemplo-malicioso.com` | Termina em `http://localhost:…/login` nos três |
| CT-S05 | Endereço inexistente — 404 amigável | Logado como dono, abrir `/pagina-que-nao-existe` | Status 404 e título "Página não encontrada" |

### Telas — `e2e/tests/03-telas.spec.ts`

Cada caso: abrir a tela → título principal visível → nenhum erro no console, nenhuma exceção, nenhuma resposta 5xx → varredura axe (WCAG 2.0/2.1/2.2 A e AA) com **zero violações sérias ou críticas**.

| ID | Perfil | Tela | Rota |
|---|---|---|---|
| CT-T01 | Dono | Painel | `/admin` |
| CT-T02 | Dono | Pedidos | `/admin/pedidos` |
| CT-T03 | Dono | Mesas | `/admin/mesas` |
| CT-T04 | Dono | Cardápio | `/admin/cardapio` |
| CT-T05 | Dono | Financeiro | `/admin/financeiro` |
| CT-T06 | Dono | Estoque › Itens | `/admin/estoque` |
| CT-T07 | Dono | Estoque › Ficha técnica | `/admin/estoque?aba=ficha` |
| CT-T08 | Dono | Estoque › Movimentações | `/admin/estoque?aba=movimentacoes` |
| CT-T09 | Dono | Relatórios › Vendas | `/admin/relatorios?aba=vendas` |
| CT-T10 | Dono | Relatórios › Produtos | `/admin/relatorios?aba=produtos` |
| CT-T11 | Dono | Relatórios › Equipe e mesas | `/admin/relatorios?aba=equipe` |
| CT-T12 | Dono | Relatórios › Pedidos | `/admin/relatorios?aba=pedidos` |
| CT-T13 | Dono | Relatórios › Despesas | `/admin/relatorios?aba=despesas` |
| CT-T14 | Dono | Usuários | `/admin/usuarios` |
| CT-T15 | Dono | Auditoria | `/admin/auditoria` |
| CT-T16 | Dono | Configurações | `/admin/configuracoes` |
| CT-T17 | Garçom | Mesas, Meus pedidos, Contas, Perfil, Mesa, Novo pedido e Conta da mesa — cada uma em **390×844 (celular)** e **820×1180 (tablet)**, sem rolagem lateral | `/garcom/…` |
| CT-T18 | Cozinha | Painel da cozinha (coluna "Novos" visível) | `/cozinha` |
| CT-T19 | Público | Login e Esqueci minha senha | `/login`, `/esqueci-senha` |

### Fluxo completo de uma mesa — `e2e/tests/04-fluxo-mesa.spec.ts`

**CT-F01 — Mesa do pedido ao pagamento, com os três perfis ao mesmo tempo**

Pré-condição: mesa 04 livre (o teste fecha pela API qualquer atendimento aberto nela). Três janelas: garçom (tablet 1180×820), cozinha e dono.

Dados: Açaí 300 ml R$ 16,90 + Leite condensado R$ 2,00 + Morango R$ 3,00; Coca-Cola R$ 6,00; Água Mineral R$ 4,00. Subtotal R$ 31,90 + serviço 10% R$ 3,19 = **R$ 35,09**.

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Garçom toca "Mesa 04, Livre", escolhe 2 pessoas e "Abrir mesa" | Vai para a tela de novo pedido da mesa 04 |
| 2 | Busca "Açaí", marca Leite condensado e Morango | O açaí não oferece "Bacon"; botão mostra "Adicionar ao pedido · R$ 21,90" |
| 3 | Adiciona Coca-Cola e toca "Enviar para cozinha" | Resumo mostra "Leite condensado · Morango"; aviso "Pedido #N enviado para a cozinha" |
| 4 | Sem internet: adiciona Água Mineral e envia | Faixa "1 pedido guardado no aparelho…" |
| 5 | Internet volta | Aviso "Pedido #N da Mesa 04 enviado para a cozinha"; a mesa tem **exatamente 2 pedidos** (não duplicou) |
| 6 | Cozinha: em cada pedido, "Iniciar preparo" e depois "Marcar como pronto" | Cartão passa para Em preparo e depois para Prontos |
| 7 | Garçom: "Marcar como entregue" em cada pedido | Nenhum botão de entregar restante |
| 8 | Dono abre "Conta · Mesa 04" | Total R$ 35,09 |
| 9 | Dono abre a pré-conta `/imprimir/pre-conta/<mesa>` | Logo carregado; "PRÉ-CONTA", "Não é documento fiscal", "1x Açaí 300 ml", "Leite condensado · Morango", "1x Coca-Cola", "1x Água Mineral", 31,90, 3,19 e R$ 35,09; "Voltar para a conta" aponta para a conta da mesa |
| 10 | Toca "✓ Finalizar" | Volta ao painel; mesa 04 "Aguardando pagamento" |
| 11 | Na conta: "Pix", "Fechar conta" e confirmar | Confirmação mostra R$ 35,09; aviso "Mesa 04 fechada"; mesa volta a "livre" |
| 12 | Auditoria de hoje, busca "fechou a mesa 04" | Registro "fechou a mesa 04 — total R$ 35,09" |
| 13 | Ao final | Nenhum erro de console, exceção ou 5xx nas três janelas |

---

## Fora do escopo desta rodada

- Firefox, Safari e iPhone/iPad (só Chrome foi testado).
- Impressão em impressora térmica física (testado o cupom na tela, não o papel).
- Carga com vários tablets e muitos pedidos simultâneos.
- Teste manual com leitor de tela (NVDA/VoiceOver) e navegação completa só por teclado.
- Telas de cadastro com formulários (criar produto, despesa, usuário, item de estoque) foram verificadas nas fases de desenvolvimento, mas ainda não têm caso automatizado.

## Como reproduzir

Veja a seção "Testes automáticos (QA)" do `README.md`: `npm run build`, `npm run start -- -p 3001` e `npm run test:e2e` (ou `npm run test:e2e:ver` para assistir).
