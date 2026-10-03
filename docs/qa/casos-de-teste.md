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

### Rodada 2 — cobertura ampliada (cadastros, navegadores, teclado, impressão e carga)

Novos arquivos: `05-cadastros`, `06-teclado-leitor`, `07-impressao`, `08-carga` e os navegadores **iPad (Safari/WebKit)** e **iPhone 14 (Safari/WebKit)** além do Chrome. Total: **171 testes** na matriz.

| Rodada | Chrome | iPad (Safari) | iPhone (Safari) | Observação |
|---|---|---|---|---|
| 1ª (novos arquivos, só Chrome) | 14 ✔ / 6 ✘ | — | — | DEF-08, DEF-09 e DEF-10 encontrados; 4 ajustes de teste |
| 2ª (só Chrome) | 19 ✔ / 1 ✘ | — | — | suspeita de foco perdido ao fechar janelas — **descartada** (era o teste lendo antes da animação terminar; conferido com os componentes originais) |
| 3ª (matriz) | 51 ✔ / 1 ✘ | 14 ✔ / 27 ✘ | 12 ✔ / 22 ✘ | DEF-11 (Safari não carregava o app) e DEF-12 (hidratação na Cozinha) |
| 4ª (telas com relógio, 5 repetições) | 23 ✔ / 0 ✘ | — | — | DEF-12 confirmado como resolvido |
| 5ª (matriz) | **52 ✔ / 0 ✘** | 34 ✔ / 7 ✘ | 29 ✔ / 5 ✘ | DEF-13 e DEF-14 (Estoque no tablet/celular) e ajustes de teste para o Safari |
| 6ª (matriz) | 49 ✔ / 3 ✘ | 35 ✔ / 6 ✘ | 32 ✔ / 2 ✘ | regressão no próprio teste: a espera "até as animações terminarem" (AJ-12) nunca acabava nas telas com o indicador "Ao vivo" (AJ-14); casos de tempo do Safari |
| 7ª (matriz) | 51 ✔ / 1 ✘ | 39 ✔ / 1 ✘ | **34 ✔ / 0 ✘** | fila offline levou mais de 15 s para reenviar (MEL-01); navegação interrompida no iPad |
| 8ª (matriz) | **52 ✔ / 0 ✘** | 39 ✔ / 1 ✘ | **34 ✔ / 0 ✘** | só a navegação para a auditoria no fluxo do iPad (AJ-15) |
| 9ª (fluxo do iPad, 3 repetições) | — | **3 ✔ / 0 ✘** | — | AJ-15 e AJ-16 aplicados |

**Resultado final:** Chrome 52/52, iPhone 34/34 e iPad 40/40 (o fluxo completo confirmado em 3 repetições seguidas; o teste de menu pelo teclado é pulado de propósito no iPad, ver AJ-13).

**Melhoria feita durante a rodada:**

| ID | Onde | Antes | Depois | Arquivo |
|---|---|---|---|---|
| MEL-01 | Fila de pedidos sem internet | Ao voltar a conexão, tentava enviar uma vez; se essa tentativa falhasse (rede ainda estabilizando), o próximo envio só acontecia 15 s depois | Tenta na hora e de novo 3 s depois (além das tentativas a cada 15 s); sem duplicar, pela mesma chave do pedido | `src/features/orders/components/order-outbox.tsx` |

**Firefox:** não foi testado neste computador. O Windows bloqueia a execução do Firefox de testes do Playwright (`spawn UNKNOWN` ao iniciar o executável, que está íntegro). Liberar exige mudar uma configuração de segurança do Windows, decisão do dono do computador.

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

#### Rodada 2

| ID | Gravidade | Onde | O que estava errado | Causa | Correção | Arquivo | Verificado por |
|---|---|---|---|---|---|---|---|
| DEF-08 | Média | Tela de entrada | Pessoa desativada via "Não foi possível entrar. Tente novamente." e tentava de novo à toa | A resposta "User is banned" do Supabase não tinha tradução | Mensagem "Seu acesso está desativado. Fale com o responsável pelo restaurante." | `src/lib/errors.ts` | CT-C08 |
| DEF-09 | Alta | Pré-conta impressa | Página montada em tamanho Carta (215,9 mm) e encolhida na bobina de 80 mm (texto minúsculo) | `@page { size: 80mm auto }` é inválido em CSS e o navegador descartava a regra | Página de 80 mm com a altura medida do próprio cupom (sem papel em branco) | `src/app/imprimir/pre-conta/[id]/page.tsx`, `auto-print.tsx` | CT-I01 |
| DEF-10 | Média | Mesas › Nova mesa | Mesa nova criada na mesma posição de uma mesa desativada; impossível clicar para editar | A posição livre ignorava as mesas desativadas, que continuam desenhadas no salão | Posição livre considera todas as mesas do setor | `src/app/admin/mesas/floor-editor.tsx` | CT-C05 |
| DEF-11 | Alta | Todo o sistema no **Safari (iPhone/iPad)** acessado por `http://` | Botões não respondiam e nada funcionava: o app nunca "ligava" | A política de segurança tinha `upgrade-insecure-requests`; o Safari aplica até em `localhost` e IPs da rede local e buscava os arquivos em `https://` inexistente | Diretiva removida (o HTTPS em produção vem da hospedagem + HSTS) | `next.config.ts` | CT-X (iPad e iPhone) |
| DEF-12 | Baixa | Cozinha (e telas com relógio: salão, pedidos, notificações) | Erro de hidratação do React (#418) e tela redesenhada inteira no navegador quando a virada de minuto caía entre servidor e navegador | Cada lado usava o próprio relógio na primeira renderização | O layout envia o horário da renderização no servidor; os relógios começam por ele e logo passam à hora do aparelho | `src/hooks/use-now.ts`, `src/components/providers/*`, `src/app/layout.tsx` | CT-T18 (5 repetições) |
| DEF-13 | Média | Estoque no tablet/celular (Safari) | Chaves "Baixa automática" e "Só produtos sem ficha" sem nome para leitores de tela | Rótulo associado ao campo escondido, não ao controle | `aria-label` nas duas chaves | `src/app/admin/estoque/inventory-view.tsx` | CT-T06 a CT-T08 (iPad e iPhone) |
| DEF-14 | Baixa | Estoque › Movimentações no celular | Tabela com rolagem lateral não podia ser rolada pelo teclado | Contêiner rolável sem foco | Contêiner com foco, papel de região e anel de foco | `src/app/admin/estoque/inventory-view.tsx` | CT-T08 (iPhone) |

### Ajustes feitos nos testes (não eram defeitos do sistema)

| ID | Teste | Problema no teste | Ajuste |
|---|---|---|---|
| AJ-01 | CT-A01 | Localizava "o aviso da tela" e encontrava dois (o segundo é o anunciador de rotas do Next.js, vazio) | Procura o aviso pelo texto |
| AJ-02 | CT-S05 | Abria um endereço inexistente sem login e era levado (corretamente) para a tela de entrada | Roda logado como dono |
| AJ-03 | CT-F01 | Esperava os adicionais separados por vírgula; o sistema usa " · " | Expectativa corrigida |
| AJ-04 | CT-F01 | Clicava "Marcar como entregue" duas vezes seguidas, antes da tela atualizar | Espera a tela atualizar após cada entrega |
| AJ-05 | CT-C02 | Conferia uma caixa de seleção nativa como se fosse um componente com `aria-checked` | Usa a verificação de "marcado" do navegador |
| AJ-06 | CT-C06 | O rótulo "Unidade" também casava com "Custo por **unidade**" | Busca pelo rótulo exato |
| AJ-07 | CT-C08 | A janela que deveria entrar como o usuário de teste herdava a sessão do dono | Janela aberta sem sessão |
| AJ-08 | CT-K02 | Lia o foco antes de a animação de fechar terminar | Espera o foco voltar ao produto (sem tempo fixo) |
| AJ-09 | CT-F01 | O aviso "pedido enviado" após voltar a internet podia ficar empilhado sob outros avisos | Confere no banco que o pedido da fila chegou e que a faixa da fila sumiu |
| AJ-10 | CT-P01/P02 (Safari) | O redirecionamento por perfil acontece durante o carregamento e interrompia a navegação do teste | Navega até o primeiro byte e então confere o endereço final |
| AJ-11 | Telas (Safari) | O Safari registra como erro requisições que ele mesmo cancela ao trocar de página ("access control checks") | Essas mensagens específicas são ignoradas |
| AJ-12 | CT-T19 (iPad) | A varredura pegou o botão "Entrar" no meio da animação de desativado para ativo (contraste falso) | Espera as animações terminarem antes da varredura |
| AJ-13 | CT-K04 (iPad) | No tablet o menu da gestão fica recolhido atrás de um botão | Teste de menu pelo teclado roda só no computador |
| AJ-14 | Telas (todas) | A espera de AJ-12 aguardava também animações infinitas (indicador "Ao vivo"), e as telas estouravam o tempo | Ignora animações infinitas |
| AJ-15 | CT-F01 (iPad) | Após fechar a conta, o sistema volta sozinho ao painel e interrompia a próxima navegação do teste | A navegação é repetida se for interrompida |
| AJ-16 | CT-F01 (iPad) | No modo sem internet, o Safari registra as falhas de rede como "Load failed" e "WebKit encountered an internal error" | Tratadas como esperadas, iguais ao "Failed to fetch" do Chrome |
| AJ-17 | CT-F01 | O teste esperava o pedido da fila por 15 s, exatamente o intervalo de reenvio | Espera até 30 s (e o sistema ganhou MEL-01) |

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

### Cadastros — `e2e/tests/05-cadastros.spec.ts` (Chrome)

Registros de teste começam com "QA " e são removidos ao final; item de estoque com movimentação e usuário não podem ser excluídos pelo sistema, então ficam **desativados** e são reaproveitados na rodada seguinte.

| ID | Título | Passos principais | Resultado esperado |
|---|---|---|---|
| CT-C01 | Categoria do cardápio | Criar "QA Categoria" → renomear → excluir | Avisos "Categoria criada.", "Categoria renomeada.", "Categoria excluída."; some da lista |
| CT-C02 | Produto | Salvar vazio (validação) → cadastrar "QA Produto Teste" R$ 12,50 em Sobremesas com "Adicionais do açaí" → editar para R$ 13,90 → marcar indisponível → excluir | Erro de validação visível; grupo ligado continua marcado; preço novo na lista; "marcado como indisponível"; "excluído" |
| CT-C03 | Grupo de adicionais | Criar "QA Coberturas" com 2 opções → remover a 2ª → excluir o grupo | "Grupo criado.", "Grupo atualizado." (opção removida some), "Grupo excluído." |
| CT-C04 | Despesa | Valor "abc" (validação) → lançar R$ 1,23 em Outros → editar para R$ 2,34 → excluir | Erro visível; "Despesa lançada."; linha mostra R$ 2,34; "Despesa excluída." |
| CT-C05 | Mesa | Criar mesa 99 com 2 lugares → editar para 3 → excluir | "Mesa 99 criada.", "Mesa atualizada.", "Mesa 99 excluída." (falhava com DEF-10) |
| CT-C06 | Item de estoque | Cadastrar "QA Item Teste" (2 kg, mínimo 1) → entrada 1 → saída 0,5 sem motivo (bloqueada) e com "Vencido" → contagem 2 → desativar | Avisos de cada movimento; saldo final "2 kg"; "Item atualizado." |
| CT-C07 | Configurações | Alterar telefone → recarregar → restaurar | Valor novo persiste após recarregar; original restaurado |
| CT-C08 | Usuário | Senha curta (validação) → cadastrar "QA Garçom Teste" → mudar para Cozinha → redefinir senha → entrar com a nova → desativar → tentar entrar | Pessoa entra e cai em `/cozinha`; após desativar, "Seu acesso está desativado." (DEF-08) |

### Teclado e leitor de tela — `e2e/tests/06-teclado-leitor.spec.ts`

| ID | Título | Resultado esperado |
|---|---|---|
| CT-K01 | Login só pelo teclado (Tab até os campos, Enter para entrar) | Foco visível em cada campo; entra na tela do garçom |
| CT-K02 | Pedido com adicionais só pelo teclado | Tab até a busca e o produto; Enter abre a janela com o foco dentro dela; Espaço marca "Leite condensado"; Esc fecha e o foco volta ao produto |
| CT-K03 | Estrutura das telas do garçom | Uma região principal, um título h1 e nenhum botão sem nome em Mesas, Meus pedidos e Perfil; navegação identificável |
| CT-K04 | Menu lateral da gestão pelo teclado (computador) | Foco visível; Enter abre o Financeiro |
| CT-K05 | Erros de formulário anunciados | Mensagem com `role=alert` e campo com `aria-invalid=true` |
| CT-K06 | Avisos anunciados | Região viva (`aria-live`) presente para os avisos |

### Impressão — `e2e/tests/07-impressao.spec.ts` (Chrome)

| ID | Título | Resultado esperado |
|---|---|---|
| CT-I01 | Pré-conta na bobina de 80 mm | Logo carregado; botões da tela escondidos na impressão; nada passa de 72 mm de largura útil; **PDF com 80 mm de largura** (falhava com DEF-09: 215,9 mm) |

### Carga — `e2e/tests/08-carga.spec.ts` (Chrome)

| ID | Título | Resultado esperado |
|---|---|---|
| CT-L01 | 10 tablets × 3 pedidos ao mesmo tempo na mesma mesa | 30 pedidos, nenhum erro, nenhum número repetido; 95% respondidos em menos de 5 s |
| CT-L02 | O mesmo pedido enviado 8 vezes em paralelo | 1 pedido só no banco |
| CT-L03 | 20 telas do salão abertas ao mesmo tempo | Todas com status 200; 95% em menos de 8 s |

Limpeza: os pedidos de carga são cancelados com o motivo "Teste de carga" e a mesa 04 fecha com total zero (não gera faturamento). Os cancelamentos aparecem nos relatórios do dia.

### Navegadores — matriz em `playwright.config.ts`

| ID | Navegador | O que roda |
|---|---|---|
| CT-X01 | Chrome (computador) | Todos os arquivos |
| CT-X02 | iPad (Safari/WebKit, horizontal) | Acesso, segurança, telas, fluxo completo da mesa e teclado |
| CT-X03 | iPhone 14 (Safari/WebKit) | Acesso, segurança e telas |
| — | Firefox | Configurado, mas bloqueado pelo Windows neste computador (ver Resultado) |

## Fora do escopo

- **Firefox:** configurado na suíte, mas o Windows deste computador bloqueia o navegador de testes.
- **Impressão física:** o cupom foi validado no modo de impressão e em PDF de 80 mm; falta imprimir na térmica de verdade.
- **Leitor de tela real:** a estrutura (títulos, regiões, nomes, foco, avisos) é verificada automaticamente, mas um teste manual com NVDA ou VoiceOver continua recomendado.
- **Safari real:** o WebKit do Playwright reproduz o motor do Safari, mas não substitui um iPhone/iPad físico.
- **Carga maior:** testados 10 tablets simultâneos; não foi feito teste de resistência por horas.

## Como reproduzir

Veja a seção "Testes automáticos (QA)" do `README.md`: `npm run build`, `npm run start -- -p 3001` e `npm run test:e2e` (ou `npm run test:e2e:ver` para assistir).
