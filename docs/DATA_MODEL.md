# Modelo de dados

## Princípios

- `pessoa_id` referencia a base mestre do CDP em todas as tabelas de talentos.
- caches e visões não devem ser editados manualmente.
- IDs operacionais usam prefixos e UUIDs compactados.
- cabeçalhos são contratos: novas colunas entram ao fim e o setup não apaga dados.
- as duas abas de termo existentes são preservadas.

## Fonte e configuração

### `TH_CONFIG`

Chave `chave`. Campos: `chave`, `valor`, `descricao`, `atualizado_em`, `atualizado_por`. Mantém parâmetros de ambiente; Script Properties têm precedência.

### `TH_PARAMETROS`

Chave lógica `grupo + valor`. Campos: `grupo`, `valor`, `descricao`, `ordem`, `ativo`. Alimenta listas e validações.

### `TH_CACHE_PESSOAS`

Chave `pessoa_id`. Campos: `pessoa_id`, `nome`, `email`, `email_serratec`, `cpf`, `data_nascimento`, `celular`, `linkedin`, `nacionalidade`, `sit_migratoria`, `genero`, `cor_etnia`, `pcd_bol`, `ensino_medio`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `cep`, `ult_formacao`, `curso`, `faculdade`, `curriculo`, `link_atualizacao`, `atualizado_em`, `sync_em`.

### `TH_CACHE_MATRICULAS`

Chave `mtr_id`; FK `pessoa_id`. Campos: `mtr_id`, `pessoa_id`, `modalidade`, `ciclo`, `ciclo_cod`, `parceiro`, `status_curso`, `status_aluno`, `data_desistencia`, `motivo_desistencia`, `turma`, `classe`, `empresa_projeto`, `nome_projeto`, `time`, `sit_contratual`, `contratado_por`, `indicado_por`, `sync_em`.

### Abas de termo existentes

`TALENT_HUB_EVENTOS_TERMO`: `evento_id`, `pessoa_id`, `nome`, `cpf`, `email`, `tipo_evento`, `termo_versao`, `termo_url`, `evento_em`, `metodo_validacao`, `origem`.

`TALENT_HUB_STATUS_TERMO`: `pessoa_id`, `nome`, `cpf`, `email`, `status`, `termo_versao`, `termo_url`, `metodo_validacao`, `origem`, `atualizado_em`, `ultimo_evento_id`.

## Operação principal

### `TH_TALENTOS`

Chave/FK `pessoa_id`. Campos profissionais: `status_pool`, `disponivel_para_oportunidades`, `momento_profissional`, `empresa_atual`, `area_interesse_principal`, `areas_interesse_secundarias`, `senioridade`, `tipo_contratacao_preferida`, `modalidade_preferida`, `regioes_interesse`, `disponibilidade_inicio`, `pretensao_salarial_min`, `pretensao_salarial_max`, `principais_competencias`, `portfolio_url`, `curriculo_alternativo_url`, `aceita_exclusividade`, `data_entrada_pool`, `ultima_atualizacao_talent_hub`, `observacoes_curadoria`, `responsavel_curadoria`, `atualizado_por`, `atualizado_em`.

### `TH_CLIENTES`

Chave `cliente_id`. Campos: `nome_empresa`, `razao_social`, `cnpj`, `tipo_cliente`, `status_cliente`, `setor`, `porte`, `cidade`, `uf`, `site`, `linkedin_empresa`, `responsavel_comercial`, `data_primeiro_contato`, `data_fechamento`, `pacote_contratado`, `valor_pacote`, `qtd_vagas_contratadas`, `qtd_perfis_por_vaga`, `prazo_retorno_empresa_dias`, `observacoes` e metadados de criação/alteração.

### `TH_CLIENTE_CONTATOS`

Chave `contato_id`; FK `cliente_id`. Campos: `nome`, `cargo`, `area`, `email`, `telefone`, `contato_principal`, `observacoes`, `ativo` e metadados.

### `TH_VAGAS`

Chave `vaga_id`; FK `cliente_id`. Campos: `titulo_vaga`, `area_vaga`, `senioridade`, `qtd_posicoes`, `tipo_contratacao`, `modalidade`, `cidade`, `uf`, `faixa_salarial_min`, `faixa_salarial_max`, `data_briefing_recebido`, `prazo_envio_shortlist`, `status_vaga`, `responsavel_curadoria`, `qtd_perfis_previstos`, `qtd_perfis_enviados`, `rodada_atual`, `requisitos_obrigatorios`, `requisitos_desejaveis`, `descricao_vaga`, `observacoes_vaga`, `data_encerramento`, `motivo_encerramento` e metadados.

### `TH_VAGA_CRITERIOS`

Chave `vaga_criterio_id`; FK `vaga_id`. Campos: `criterio_nome`, `campo_talento`, `tipo_regra`, `operador`, `valor_esperado`, `peso_override`, `ativo`, `observacao` e metadados.

## Matchmaking

- `TH_MATCHING_MODELOS`: `modelo_id`, `nome_modelo`, `descricao`, `ativo`, `versao`, `score_minimo_recomendado`, `normalizar_para_100` e metadados.
- `TH_MATCHING_MODELO_CRITERIOS`: `modelo_criterio_id`, `modelo_id`, `criterio_nome`, `campo_talento`, `campo_vaga`, `tipo_comparacao`, `modo`, `peso`, `ativo`, `observacao`.
- `TH_MATCHING_RUNS`: `run_id`, `vaga_id`, `modelo_id`, `qtd_perfis_solicitados`, `executado_em`, `executado_por`, `status_run`, totais avaliados/aptos/eliminados/recomendados e `observacoes`.
- `TH_MATCHING_RESULTADOS`: `resultado_id`, `run_id`, `vaga_id`, `pessoa_id`, scores por dimensão, critérios atendidos/não atendidos/exclusão, `justificativa`, `recomendado`, `ordem_ranking`, `status_resultado`, `criado_em`.

## Funil e impacto

- `TH_SHORTLISTS`: `shortlist_id`, `vaga_id`, `cliente_id`, `rodada`, `titulo_shortlist`, `status_shortlist`, datas/usuários de criação e envio, `qtd_candidatos`, `observacoes` e metadados.
- `TH_SHORTLIST_ITENS`: `shortlist_item_id`, `shortlist_id`, `processo_id`, `vaga_id`, `cliente_id`, `pessoa_id`, `ordem_recomendacao`, `score_total`, `justificativa_match`, `status_item`, `observacao_curadoria` e metadados.
- `TH_PROCESSOS`: `processo_id`, FKs de vaga/cliente/pessoa/run/resultado/shortlist, `rodada`, `origem`, `status_processo`, datas de confirmação/bloqueio/envio/retorno/entrevista/proposta/resultado/liberação, flags, motivos, observações, responsável e metadados.
- `TH_CONTRATACOES`: `contratacao_id`, FKs de processo/vaga/cliente/pessoa, datas de contratação/início/acompanhamentos, tipo/salário/status, garantia, permanência, fee, faturamento, observações e metadados.
- `TH_BRIEFINGS_EXTERNOS`: `briefing_id`, dados de empresa/contato/vaga, requisitos, descrição, status de validação, recebimento e vínculo com a vaga convertida.

## Rastreabilidade e visões

- `TH_EVENTOS`: evento operacional, contexto por IDs, descrição, transição de status, responsável, canal e observações.
- `TH_AUDIT_LOGS`: `audit_id`, data, usuário, ação, entidade/ID, campo, valores anterior/novo, origem e observação.
- `TH_SYNC_LOG`: `sync_id`, tipo, início/fim, status, contagens, mensagem e executor.
- `VW_TALENTOS_APTOS`: junção materializada de pessoa, termo, camada profissional, aptidão e processos ativos. É a fonte da tela Talentos.
- `VW_DASHBOARD`: pares `indicador/valor` agrupados, descritos e datados. É a fonte dos cards.

O contrato exato e executável de todos os cabeçalhos está em `src/Database.gs`; este arquivo é a referência humana.
