/**
 * Contrato físico do MVP inicial. As abas da versão anterior não são apagadas
 * pelo setup; apenas deixam de ser gerenciadas pelo aplicativo.
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
    TALENT_HUB_STATUS_TERMO: [
      'pessoa_id', 'nome', 'cpf', 'email', 'status', 'termo_versao', 'termo_url',
      'metodo_validacao', 'origem', 'atualizado_em', 'ultimo_evento_id'
    ],
    TH_TALENTOS: [
      'pessoa_id', 'disponivel_para_oportunidades', 'momento_profissional',
      'area_interesse_principal', 'senioridade', 'tipo_contratacao_preferida',
      'modalidade_preferida', 'regioes_interesse', 'disponibilidade_inicio',
      'pretensao_salarial_min', 'pretensao_salarial_max', 'principais_competencias',
      'portfolio_url', 'curriculo_alternativo_url', 'observacoes_curadoria',
      'atualizado_por', 'atualizado_em'
    ],
    TH_CLIENTES: [
      'cliente_id', 'nome_empresa', 'cnpj', 'status_cliente', 'setor', 'cidade', 'uf',
      'site', 'responsavel_comercial', 'observacoes', 'criado_em', 'criado_por',
      'atualizado_em', 'atualizado_por'
    ],
    TH_CLIENTE_CONTATOS: [
      'contato_id', 'cliente_id', 'nome', 'cargo', 'email', 'telefone',
      'contato_principal', 'ativo', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por'
    ],
    TH_VAGAS: [
      'vaga_id', 'cliente_id', 'titulo_vaga', 'area_vaga', 'senioridade', 'qtd_posicoes',
      'tipo_contratacao', 'modalidade', 'cidade', 'uf', 'faixa_salarial_min',
      'faixa_salarial_max', 'status_vaga', 'responsavel_curadoria', 'descricao_vaga',
      'observacoes_vaga', 'data_encerramento', 'motivo_encerramento', 'criado_em',
      'criado_por', 'atualizado_em', 'atualizado_por'
    ],
    TH_INDICACOES: [
      'indicacao_id', 'vaga_id', 'cliente_id', 'pessoa_id', 'status_indicacao',
      'observacoes', 'criado_em', 'criado_por', 'enviado_em', 'entrevista_em',
      'resultado_em', 'atualizado_em', 'atualizado_por'
    ],
    TH_AUDIT_LOGS: [
      'audit_id', 'data_evento', 'usuario', 'acao', 'entidade', 'entidade_id',
      'campo_alterado', 'valor_anterior', 'valor_novo', 'origem', 'observacao'
    ],
    TH_SYNC_LOG: [
      'sync_id', 'tipo_sync', 'iniciado_em', 'finalizado_em', 'status', 'total_linhas_lidas',
      'total_linhas_gravadas', 'mensagem', 'executado_por'
    ],
    VW_TALENTOS_APTOS: [
      'pessoa_id', 'nome', 'email', 'email_serratec', 'celular', 'cidade', 'uf', 'curso',
      'ult_formacao', 'curriculo', 'atualizado_em', 'cadastro_atualizado_90d',
      'termo_status', 'apto_talent_hub', 'motivo_nao_apto', 'status_pool',
      'disponivel_para_oportunidades', 'momento_profissional', 'area_interesse_principal',
      'senioridade', 'tipo_contratacao_preferida', 'modalidade_preferida',
      'regioes_interesse', 'principais_competencias', 'processos_ativos'
    ],
    VW_DASHBOARD: ['indicador', 'valor', 'grupo', 'descricao', 'atualizado_em']
  };
}

function getPrimaryKeys_() {
  return {
    TH_CONFIG: 'chave', TH_TALENTOS: 'pessoa_id', TH_CLIENTES: 'cliente_id',
    TH_CLIENTE_CONTATOS: 'contato_id', TH_VAGAS: 'vaga_id', TH_INDICACOES: 'indicacao_id',
    TH_AUDIT_LOGS: 'audit_id', TH_SYNC_LOG: 'sync_id'
  };
}
