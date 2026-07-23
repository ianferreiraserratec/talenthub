# Regras operacionais — rascunho

Este documento registra as regras efetivamente implementadas no núcleo do MVP. A documentação operacional detalhada, com papéis, SLAs e exceções, será consolidada após a homologação ponta a ponta.

## Identidade do talento

`pessoa_id` é a única chave central para pessoas. Dados de identidade e contato vêm do CDP e não são recriados em `TH_TALENTOS`. A equipe edita apenas a camada profissional específica do Talent Hub.

## Aptidão

Uma pessoa está apta quando:

1. existe em `TH_CACHE_PESSOAS`, após sincronização do CDP;
2. possui status `ATIVO` em `TALENT_HUB_STATUS_TERMO`;
3. `PESSOAS.atualizado_em` está entre a data atual e os últimos `DIAS_CADASTRO_VALIDO` dias, inicialmente 90.

Motivos de não aptidão:

- `TERMO_CANCELADO_OU_INEXISTENTE`;
- `CADASTRO_DESATUALIZADO`;
- `PESSOA_NAO_ENCONTRADA` para consultas fora do cache.

Datas futuras não são aceitas como atualização válida. Termo ausente é tratado como inválido.

## Status do pool

O status exibido na visão consolidada segue esta precedência:

1. contratação `Ativa` ou `Em acompanhamento` → `Contratado`;
2. processo ativo `Bloqueado` → `Bloqueado`;
3. outro processo ativo → `Em processo`;
4. pessoa documentalmente não apta → `Inelegível`;
5. marcação manual de carência → `Carência`;
6. indisponibilidade explícita ou status manual inativo → `Inativo`;
7. cadastro vencido, sem vínculo operacional ativo → `Inativo`;
8. caso contrário → `Disponível`.

A aptidão continua sendo falsa quando o termo ou o cadastro deixam de ser válidos. A precedência operacional apenas impede que uma contratação ou um processo em andamento desapareça da gestão. A pessoa não volta a ser indicada para novas vagas enquanto não recuperar a aptidão.

Processos ativos: `Pré-selecionado`, `Aguardando confirmação`, `Bloqueado`, `Enviado à empresa`, `Aguardando retorno`, `Entrevista` e `Proposta`.

## Sincronização

- `PESSOAS` e `MATRICULAS` são lidas em lote da planilha CDP;
- os caches locais são substituídos somente após a origem ser lida e seus cabeçalhos validados;
- linhas sem a chave principal são ignoradas;
- chaves duplicadas na origem preservam a última ocorrência lida;
- cada execução gera registro em `TH_SYNC_LOG` e audit log;
- sincronizar pessoas regenera aptidão e dashboard; sincronizar tudo também atualiza matrículas.

## Clientes e vagas

- cliente exige `nome_empresa` e não permite duplicidade de CNPJ normalizado;
- vaga exige `cliente_id` válido e `titulo_vaga`;
- salário mínimo não pode ultrapassar salário máximo;
- toda criação/alteração recebe usuário e timestamps e gera auditoria;
- dados pessoais do CDP nunca são alterados por esses CRUDs.

## Bloqueio

Ao mover um processo para `Bloqueado`, o sistema registra a data de início e, quando o limite não for informado, calcula 30 dias. Uma pessoa não pode manter simultaneamente outro vínculo operacional incompatível.

## Matchmaking

O MVP usa regras configuráveis e explicáveis, sem API externa. Critérios `Exclusivo` e `Obrigatório` eliminam; `Prioritário` e `Desejável` pontuam; `Informativo` apenas aparece na justificativa. Dados sensíveis só participam quando declarados explicitamente na vaga. Alterar vaga, critérios ou modelo invalida execuções concluídas que ficaram obsoletas.

## Shortlist, processo e contratação

A geração de shortlist cria, na mesma operação protegida por lock, `TH_SHORTLISTS`, `TH_SHORTLIST_ITENS` e `TH_PROCESSOS`. Antes de incluir uma pessoa, o sistema revalida aptidão, disponibilidade e critérios eliminatórios.

As mudanças de processo respeitam uma máquina de estados. Contratação cria ou atualiza `TH_CONTRATACOES`, fecha a vaga quando a quantidade de posições é atendida e libera os demais processos ativos. Substituição encerra a contratação correspondente e reabre a vaga de forma controlada.

Operações compostas usam validações e compensação para evitar que falhas intermediárias deixem abas em estados contraditórios.
