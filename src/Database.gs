/**
 * Contrato físico do banco de dados em Google Sheets.
 * Novas colunas devem ser acrescentadas ao fim para preservar bases existentes.
 */
function getDatabaseSchema_() {
  return {
    TH_CONFIG: ['chave', 'valor', 'descricao', 'atualizado_em', 'atualizado_por'],
    TH_PARAMETROS: ['grupo', 'valor', 'descricao', 'ordem', 'ativo'],
    TH_CACHE_PESSOAS: [
      'pessoa_id', 'nome', 'email', 'email_serratec', 'cpf', 'data_nascimento', 'celular',
      'linkedin', 'nacionalidade', 'sit_migratoria', 'genero', 'cor_etnia', 'pcd_bol',
      'ensino_medio', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep',
      'ult_formacao', 'curso', 'faculdade', 'curriculo', 'link_atualizacao', 'atualizado_em', 'sync_em'
    ],
    TH_CACHE_MATRICULAS: [
      'mtr_id', 'pessoa_id', 'modalidade', 'ciclo', 'ciclo_cod', 'parceiro', 'status_curso',
      'status_aluno', 'data_desistencia', 'motivo_desistencia', 'turma', 'classe',
      'empresa_projeto', 'nome_projeto', 'time', 'sit_contratual', 'contratado_por',
      'indicado_por', 'sync_em'
    ],
    TALENT_HUB_EVENTOS_TERMO: [
      'evento_id', 'pessoa_id', 'nome', 'cpf', 'email', 'tipo_evento', 'termo_versao',
      'termo_url', 'evento_em', 'metodo_validacao', 'origem'
    ],
    TALENT_HUB_STATUS_TERMO: [
      'pessoa_id', 'nome', 'cpf', 'email', 'status', 'termo_versao', 'termo_url',
      'metodo_validacao', 'origem', 'atualizado_em', 'ultimo_evento_id'
    ],
    TH_TALENTOS: [
      'pessoa_id', 'status_pool', 'disponivel_para_oportunidades', 'momento_profissional',
      'empresa_atual', 'area_interesse_principal', 'areas_interesse_secundarias', 'senioridade',
      'tipo_contratacao_preferida', 'modalidade_preferida', 'regioes_interesse',
      'disponibilidade_inicio', 'pretensao_salarial_min', 'pretensao_salarial_max',
      'principais_competencias', 'portfolio_url', 'curriculo_alternativo_url', 'aceita_exclusividade',
      'data_entrada_pool', 'ultima_atualizacao_talent_hub', 'observacoes_curadoria',
      'responsavel_curadoria', 'atualizado_por', 'atualizado_em'
    ],
    TH_CLIENTES: [
      'cliente_id', 'nome_empresa', 'razao_social', 'cnpj', 'tipo_cliente', 'status_cliente',
      'setor', 'porte', 'cidade', 'uf', 'site', 'linkedin_empresa', 'responsavel_comercial',
      'data_primeiro_contato', 'data_fechamento', 'pacote_contratado', 'valor_pacote',
      'qtd_vagas_contratadas', 'qtd_perfis_por_vaga', 'prazo_retorno_empresa_dias',
      'observacoes', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por'
    ],
    TH_CLIENTE_CONTATOS: [
      'contato_id', 'cliente_id', 'nome', 'cargo', 'area', 'email', 'telefone',
      'contato_principal', 'observacoes', 'ativo', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por'
    ],
    TH_VAGAS: [
      'vaga_id', 'cliente_id', 'titulo_vaga', 'area_vaga', 'senioridade', 'qtd_posicoes',
      'tipo_contratacao', 'modalidade', 'cidade', 'uf', 'faixa_salarial_min', 'faixa_salarial_max',
      'data_briefing_recebido', 'prazo_envio_shortlist', 'status_vaga', 'responsavel_curadoria',
      'qtd_perfis_previstos', 'qtd_perfis_enviados', 'rodada_atual', 'requisitos_obrigatorios',
      'requisitos_desejaveis', 'descricao_vaga', 'observacoes_vaga', 'data_encerramento',
      'motivo_encerramento', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por'
    ],
    TH_VAGA_CRITERIOS: [
      'vaga_criterio_id', 'vaga_id', 'criterio_nome', 'campo_talento', 'tipo_regra', 'operador',
      'valor_esperado', 'peso_override', 'ativo', 'observacao', 'criado_em', 'criado_por',
      'atualizado_em', 'atualizado_por'
    ],
    TH_MATCHING_MODELOS: [
      'modelo_id', 'nome_modelo', 'descricao', 'ativo', 'versao', 'score_minimo_recomendado',
      'normalizar_para_100', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por'
    ],
    TH_MATCHING_MODELO_CRITERIOS: [
      'modelo_criterio_id', 'modelo_id', 'criterio_nome', 'campo_talento', 'campo_vaga',
      'tipo_comparacao', 'modo', 'peso', 'ativo', 'observacao'
    ],
    TH_MATCHING_RUNS: [
      'run_id', 'vaga_id', 'modelo_id', 'qtd_perfis_solicitados', 'executado_em', 'executado_por',
      'status_run', 'total_talentos_avaliados', 'total_talentos_aptos', 'total_talentos_eliminados',
      'total_recomendados', 'observacoes'
    ],
    TH_MATCHING_RESULTADOS: [
      'resultado_id', 'run_id', 'vaga_id', 'pessoa_id', 'score_total', 'score_area',
      'score_senioridade', 'score_skills', 'score_modalidade', 'score_localidade', 'score_salario',
      'score_diversidade', 'criterios_atendidos', 'criterios_nao_atendidos', 'criterios_exclusao',
      'justificativa', 'recomendado', 'ordem_ranking', 'status_resultado', 'criado_em',
      'score_formacao', 'score_escolaridade'
    ],
    TH_SHORTLISTS: [
      'shortlist_id', 'vaga_id', 'cliente_id', 'rodada', 'titulo_shortlist', 'status_shortlist',
      'criada_em', 'criada_por', 'enviada_em', 'enviada_por', 'qtd_candidatos', 'observacoes',
      'atualizado_em', 'atualizado_por'
    ],
    TH_SHORTLIST_ITENS: [
      'shortlist_item_id', 'shortlist_id', 'processo_id', 'vaga_id', 'cliente_id', 'pessoa_id',
      'ordem_recomendacao', 'score_total', 'justificativa_match', 'status_item',
      'observacao_curadoria', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por'
    ],
    TH_PROCESSOS: [
      'processo_id', 'vaga_id', 'cliente_id', 'pessoa_id', 'run_id', 'resultado_id', 'shortlist_id',
      'rodada', 'origem', 'status_processo', 'data_inclusao_processo', 'data_confirmacao_interesse',
      'data_bloqueio', 'data_limite_bloqueio', 'data_envio_empresa', 'data_retorno_empresa',
      'entrevista_realizada', 'data_entrevista', 'proposta_realizada', 'data_proposta',
      'resultado_final', 'data_resultado', 'motivo_recusa_ou_liberacao', 'data_liberacao',
      'observacoes_processo', 'responsavel', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por'
    ],
    TH_CONTRATACOES: [
      'contratacao_id', 'processo_id', 'vaga_id', 'cliente_id', 'pessoa_id', 'data_contratacao',
      'data_inicio_trabalho', 'tipo_contratacao', 'salario_contratacao', 'status_contratacao',
      'garantia_substituicao_ate', 'acompanhamento_3m_data', 'permanece_apos_3m',
      'acompanhamento_6m_data', 'permanece_apos_6m', 'fee_calculado', 'status_faturamento',
      'observacoes', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por'
    ],
    TH_BRIEFINGS_EXTERNOS: [
      'briefing_id', 'cliente_id', 'nome_empresa_informado', 'nome_contato', 'email_contato',
      'telefone_contato', 'titulo_vaga', 'area_vaga', 'senioridade', 'qtd_posicoes',
      'tipo_contratacao', 'modalidade', 'cidade', 'uf', 'faixa_salarial_min', 'faixa_salarial_max',
      'requisitos_obrigatorios', 'requisitos_desejaveis', 'descricao_vaga', 'observacoes',
      'status_briefing', 'recebido_em', 'convertido_em_vaga_id', 'validado_por', 'validado_em'
    ],
    TH_EVENTOS: [
      'evento_id', 'data_evento', 'tipo_evento', 'entidade', 'entidade_id', 'pessoa_id', 'vaga_id',
      'cliente_id', 'processo_id', 'shortlist_id', 'descricao_evento', 'status_anterior', 'status_novo',
      'responsavel', 'canal', 'observacoes'
    ],
    TH_AUDIT_LOGS: [
      'audit_id', 'data_evento', 'usuario', 'acao', 'entidade', 'entidade_id', 'campo_alterado',
      'valor_anterior', 'valor_novo', 'origem', 'observacao'
    ],
    TH_SYNC_LOG: [
      'sync_id', 'tipo_sync', 'iniciado_em', 'finalizado_em', 'status', 'total_linhas_lidas',
      'total_linhas_gravadas', 'mensagem', 'executado_por'
    ],
    VW_TALENTOS_APTOS: [
      'pessoa_id', 'nome', 'email', 'email_serratec', 'cpf', 'celular', 'cidade', 'uf', 'genero',
      'cor_etnia', 'pcd_bol', 'ensino_medio', 'ult_formacao', 'curso', 'faculdade', 'linkedin',
      'curriculo', 'atualizado_em', 'dias_desde_atualizacao', 'cadastro_atualizado_90d',
      'termo_status', 'termo_versao', 'termo_atualizado_em', 'apto_talent_hub', 'motivo_nao_apto',
      'status_pool', 'disponivel_para_oportunidades', 'momento_profissional',
      'area_interesse_principal', 'areas_interesse_secundarias', 'senioridade',
      'tipo_contratacao_preferida', 'modalidade_preferida', 'regioes_interesse',
      'pretensao_salarial_min', 'pretensao_salarial_max', 'principais_competencias',
      'processos_ativos', 'bloqueado_ate', 'data_nascimento', 'idade', 'faixa_etaria',
      'nacionalidade', 'sit_migratoria', 'escolaridade', 'formacoes_serratec',
      'modalidades_serratec', 'ciclos_serratec', 'parceiros_formacao_serratec',
      'qtd_formacoes_serratec_aprovadas', 'possui_formacao_serratec_aprovada',
      'curriculo_disponivel'
    ],
    VW_DASHBOARD: ['indicador', 'valor', 'grupo', 'descricao', 'atualizado_em']
  };
}

function getPrimaryKeys_() {
  return {
    TH_CONFIG: 'chave',
    TH_TALENTOS: 'pessoa_id',
    TH_CLIENTES: 'cliente_id',
    TH_CLIENTE_CONTATOS: 'contato_id',
    TH_VAGAS: 'vaga_id',
    TH_VAGA_CRITERIOS: 'vaga_criterio_id',
    TH_MATCHING_MODELOS: 'modelo_id',
    TH_MATCHING_MODELO_CRITERIOS: 'modelo_criterio_id',
    TH_MATCHING_RUNS: 'run_id',
    TH_MATCHING_RESULTADOS: 'resultado_id',
    TH_SHORTLISTS: 'shortlist_id',
    TH_SHORTLIST_ITENS: 'shortlist_item_id',
    TH_PROCESSOS: 'processo_id',
    TH_CONTRATACOES: 'contratacao_id',
    TH_BRIEFINGS_EXTERNOS: 'briefing_id',
    TH_EVENTOS: 'evento_id',
    TH_AUDIT_LOGS: 'audit_id',
    TH_SYNC_LOG: 'sync_id'
  };
}
