# Plano do MVP operacional — Talent Hub Serratec

## Decisão de produto

Este projeto não pretende reproduzir o protótipo acadêmico desenvolvido pelos residentes. Os artefatos desse projeto são referências de contexto e ajudam a identificar necessidades, mas não determinam arquitetura, interface, backlog ou critérios de aceite.

O produto que estamos construindo é um **back-office interno, funcional e escalável**, para a equipe do Serratec iniciar e profissionalizar a operação do Talent Hub.

O MVP deve permitir que a equipe responda, com uma única fonte operacional:

- quem está apto e disponível para oportunidades;
- quais empresas, contatos e vagas estão ativos;
- quais critérios foram usados em cada análise;
- quem foi considerado, selecionado, enviado, bloqueado, liberado ou contratado;
- qual é o estado atual de cada vaga e de cada pessoa no funil;
- quem alterou uma informação e quando;
- quais exceções exigem ação da equipe.

## Princípios

1. `pessoa_id` é a identidade única de todo talento.
2. `PESSOAS` e `MATRICULAS`, no CDP, continuam sendo as fontes oficiais.
3. Aptidão documental e situação operacional são conceitos separados.
4. O matching deve ser configurável, explicável e sujeito à curadoria humana.
5. Nenhuma transição importante pode deixar vaga, processo, shortlist e contratação em estados contraditórios.
6. Dados sensíveis só entram no matching quando a equipe os declara explicitamente no critério da vaga.
7. A interface deve ser clara e eficiente para uso interno. Recursos acadêmicos de demonstração — como alternância de tema, controles avançados de acessibilidade ou VLibras — não fazem parte do foco deste MVP.
8. O desenho deve permitir crescimento sem antecipar complexidades que ainda não geram valor operacional.

## Escopo do MVP

### Incluído

- sincronização de pessoas e matrículas do CDP;
- cálculo de aptidão por termo `ATIVO` e cadastro atualizado na janela configurada;
- camada profissional e disponibilidade do talento;
- clientes e respectivos contatos;
- vagas e critérios configuráveis;
- matching por regras e pesos editáveis, sem dependência de API externa;
- ranking explicável e seleção curatorial;
- shortlists e rodadas;
- processo pessoa–vaga, incluindo bloqueio, envio, retorno, entrevista, proposta, liberação e contratação;
- fechamento e reabertura coerentes da vaga;
- histórico operacional, auditoria e indicadores;
- execução interna em Google Apps Script, com Google Sheets como armazenamento operacional.

### Fora do MVP

- paridade visual ou funcional com o protótipo dos alunos;
- área autenticada para empresas ou candidatos;
- IA generativa ou análise semântica de currículos;
- disparos automáticos de e-mail e WhatsApp;
- faturamento completo;
- aplicação pública de vagas;
- portal externo de briefing como requisito para entrada em operação;
- recursos de demonstração acadêmica de acessibilidade;
- BI avançado e modelos preditivos.

Isso não impede evolução posterior. Apenas evita que itens não essenciais atrasem o início da operação.

## Estado atual

| Bloco | Situação | Observação |
|---|---|---|
| Estrutura de dados e setup | Implementado | Criação idempotente das abas, parâmetros e validações básicas |
| Sincronização CDP | Implementado | Pessoas e matrículas em lote, com logs |
| Aptidão e visão do pool | Implementado | Termo, janela cadastral e condição operacional separados |
| Talentos | Implementado | Consulta e edição apenas da camada Talent Hub |
| Clientes e contatos | Implementado | CRUD interno |
| Vagas e critérios | Implementado | CRUD, regras específicas e validações operacionais |
| Matching configurável | Implementado | Modelos, pesos, eliminatórios, bônus e justificativa |
| Shortlists e processos | Implementado | Criação, rodadas, transições e bloqueio |
| Contratações | Implementado | Registro, fechamento/liberação e substituição |
| Dashboard, eventos e auditoria | Implementado | Indicadores principais e rastreabilidade |
| Testes automatizados locais | Implementado | Regras e fluxos críticos sem acesso ao Google Sheets |
| Dados já disponíveis no matching | Implementado | Formações aprovadas, escolaridade, idade, demografia, localização e currículo derivados na visão |
| Desempenho e feedback de carregamento | Em validação real | Painel e Talentos melhoraram; execução do match recebeu escrita reduzida e telemetria de tempo |
| Validação ponta a ponta com dados reais | Pendente | Próximo portão de qualidade |
| Rotina operacional de entrada em produção | Pendente | Depende da homologação real |
| Escala, alertas e recuperação | Planejado | Após o MVP operar com estabilidade |
| Manual operacional completo | Planejado | Consolidar após estabilizar regras e exceções |

“Implementado” significa que o núcleo existe na branch `homologacao` e possui validação local. Não significa que o bloco já foi homologado com a planilha real.

## Fluxo operacional-alvo

```text
CDP + status do termo
        ↓ sincronização
Pool consolidado e aptidão
        ↓
Cliente → Vaga → Critérios
                  ↓
            Matching explicável
                  ↓
          Curadoria e shortlist
                  ↓
     Processo pessoa–vaga por etapa
           ↙                 ↘
       liberação          contratação
           ↓                 ↓
      volta ao pool     vaga/indicadores
```

## Backlog próprio e priorizado

### P0 — Portão para começar a operar

1. Fechar a consistência transacional do funil.
2. Garantir que execuções antigas de matching não produzam decisões obsoletas.
3. Validar setup e sincronização com a planilha real.
4. Conferir amostras de aptidão:
   - termo ativo e cadastro válido;
   - termo cancelado ou inexistente;
   - cadastro vencido;
   - pessoa em processo cujo cadastro vence;
   - pessoa contratada.
5. Executar um cenário real completo em homologação:
   - criar cliente e contato;
   - criar vaga e critérios;
   - rodar matching;
   - montar shortlist;
   - registrar envio e movimentações;
   - contratar uma pessoa;
   - liberar as demais;
   - conferir vaga, pool, dashboard, eventos e auditoria.
6. Validar permissões do web app e acesso apenas pela equipe autorizada.
7. Criar checklist mínimo de operação e recuperação.

### P1 — Operação assistida

1. Sincronização diária agendada, mantendo também o botão manual.
2. Painel de pendências e exceções:
   - cadastro vencido;
   - termo inválido;
   - bloqueio próximo do limite;
   - empresa sem retorno;
   - vaga sem movimentação;
   - acompanhamento de contratação vencido.
3. Melhorar a gestão de contatos do cliente.
4. Exportar shortlist e visão operacional, começando por CSV.
5. Registrar datas-alvo e SLAs sem disparos automáticos.
6. Criar backup lógico e procedimento de restauração.
7. Paginação e filtros no backend para volumes maiores.

### P2 — Escala e governança

1. Perfis de acesso por função.
2. Índices/cache e testes de volume.
3. Observabilidade de falhas, tempo de execução e sincronizações.
4. Política de retenção e exposição de dados sensíveis.
5. Relatórios de impacto e qualidade do funil.
6. Rotina formal de revisão dos modelos e pesos de matching.
7. Manual operacional completo, incluindo papéis, SLAs e exceções.
8. Promoção controlada de `homologacao` para `main`.

### Depois do MVP

- formulário externo de briefing com validação interna;
- notificações e e-mails;
- acompanhamento de permanência em 3 e 6 meses;
- fee e faturamento;
- dashboards analíticos;
- integração semântica/IA como apoio adicional à curadoria;
- áreas externas para empresas ou talentos, se a operação demonstrar necessidade.

## Critério de aceite do MVP

O MVP está pronto para iniciar a operação quando:

1. a sincronização real for repetível e não corromper dados operacionais;
2. as contagens de aptidão forem reconciliadas com amostras conhecidas;
3. um processo completo puder ser executado sem edição manual das abas;
4. o sistema impedir estados contraditórios e duplicidade de vínculos ativos;
5. a equipe conseguir entender o motivo de cada score e de cada eliminação;
6. o fechamento, a liberação e a substituição refletirem corretamente no pool e na vaga;
7. eventos e auditoria permitirem reconstruir as decisões relevantes;
8. houver um procedimento claro para sincronizar, operar e recuperar o sistema;
9. os testes locais e o roteiro de homologação passarem;
10. a equipe responsável aprovar o uso da branch `homologacao` em cenário real controlado.

## Riscos que orientam o plano

| Risco | Tratamento no MVP |
|---|---|
| Cadastro ou termo desatualizado | Aptidão calculada, nunca inferida manualmente |
| Pessoa presa em exclusividade | Datas, status e painel de exceções |
| Matching discriminatório ou opaco | Critérios sensíveis explícitos e justificativa auditável |
| Estados divergentes entre abas | Locks, validações, transações compensatórias e testes de fluxo |
| Dados antigos gerando shortlist | Revalidação no momento da seleção |
| Lentidão do Apps Script | Operações em lote, cache e paginação progressiva |
| Mudança direta na planilha | Auditoria no app e orientação para operar pelo web app |
| Escopo acadêmico desviando o produto | Backlog próprio baseado na operação real |

## Próxima decisão

Antes de avançar, é preciso aprovar:

1. o recorte de MVP descrito neste documento;
2. a ordem P0 → P1 → P2;
3. a decisão de usar o protótipo e os documentos dos alunos apenas como referência.

Com a aprovação, o próximo trabalho é exclusivamente o **P0: homologação ponta a ponta e preparação para operação controlada**.
