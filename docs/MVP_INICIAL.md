# MVP inicial — Talent Hub Serratec

## Objetivo

Disponibilizar um back-office interno simples para que a equipe opere o
Talent Hub sem editar diretamente as abas operacionais. O aplicativo é a porta
de entrada para consultar dados, manter cadastros e registrar o andamento de
uma indicação.

Esta versão privilegia previsibilidade e regras claras. Automação, modelos de
score e integrações visíveis ficam para versões posteriores.

## Fluxo que entra na primeira versão

```text
Sincronização administrativa
          ↓
Banco de talentos aptos e disponíveis
          ↓
Cliente → vaga aberta → indicação manual de talento
          ↓
Em análise → enviado → entrevista → contratado ou liberado
```

## Telas do aplicativo

1. **Visão geral** — contagens essenciais: talentos aptos/disponíveis,
   clientes ativos, vagas abertas e indicações em andamento.
2. **Talentos** — consulta do pool e edição somente dos dados profissionais e
   de disponibilidade do Talent Hub. Dados pessoais e de formação continuam
   somente leitura, pois vêm da fonte central.
3. **Clientes** — cadastro de empresas e contatos.
4. **Vagas** — cadastro e acompanhamento de vagas, sem critérios de score.
5. **Indicações** — seleção manual de um talento para uma vaga e atualização
   do seu andamento.
6. **Audit Logs** — consulta das alterações feitas pelo aplicativo.

## O que não entra

- aba de Integrações e edição de configurações técnicas no web app;
- matchmaking, score, pesos, critérios automáticos e ranking;
- shortlists e rodadas de matching;
- processos avançados, bloqueios, substituições, acompanhamento de garantia e
  faturamento;
- dashboards analíticos, alertas e exportações;
- portais, formulários ou comunicações externas.

A preparação do banco e a sincronização com a fonte central continuam como
rotinas administrativas do Apps Script. Credenciais e identificadores de
planilha permanecem em Script Properties, fora da interface operacional.

## Regras de negócio mínimas

1. `pessoa_id` é a identidade do talento e não pode ser alterada pelo app.
2. Apenas talento com termo válido, cadastro dentro da janela de validade e
   disponibilidade habilitada pode receber indicação.
3. Uma vaga deve pertencer a um cliente existente e só pode receber indicações
   quando estiver aberta.
4. Não pode haver duas indicações ativas para a mesma combinação de talento e
   vaga.
5. A indicação nasce como **Em análise**. As únicas transições são:
   **Em análise → Enviado → Entrevista → Contratado** ou **Liberado**;
   **Em análise** e **Enviado** também podem ser liberados.
6. Ao iniciar uma indicação válida, o talento passa a **Em processo**. Ao
   liberar a indicação, volta a **Disponível** se continuar apto. Ao contratar,
   passa a **Contratado** e a vaga é atualizada conforme o número de posições.
   Quando todas as posições forem preenchidas, as demais indicações ativas da
   vaga são liberadas automaticamente.
7. Toda criação, edição e mudança de status feita pelo app gera Audit Log.

## Ordem de implementação

1. Reduzir o contrato de dados e o setup às abas necessárias, preservando as
   abas legadas existentes sem apagá-las.
2. Substituir o funil de matching/shortlist/processo pelo serviço único de
   indicações manuais e suas validações.
3. Remover da navegação, bootstrap e scripts da interface as telas de
   integrações, matching e shortlist; manter Audit Logs.
4. Simplificar dashboard, formulários e textos para refletirem somente o fluxo
   acima.
5. Reescrever os testes para as regras do MVP e validar sintaxe, manifesto e
   fluxo completo localmente.

## Critério de aceite

Uma pessoa da equipe consegue, sem editar abas: consultar um talento,
atualizar sua disponibilidade, cadastrar cliente e vaga, fazer uma indicação
manual, movê-la pelos estados permitidos e consultar o registro de auditoria.
