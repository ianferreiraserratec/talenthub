function regenerateDashboard() {
  return withScriptLock_(regenerateDashboard_);
}

function regenerateDashboard_() {
  var talents = getSheetObjects_('VW_TALENTOS_APTOS', { raw: true });
  var terms = getSheetObjects_('TALENT_HUB_STATUS_TERMO', { raw: true });
  var clients = getSheetObjects_('TH_CLIENTES', { raw: true });
  var jobs = getSheetObjects_('TH_VAGAS', { raw: true });
  var shortlists = getSheetObjects_('TH_SHORTLISTS', { raw: true });
  var processes = getSheetObjects_('TH_PROCESSOS', { raw: true });
  var hires = getSheetObjects_('TH_CONTRATACOES', { raw: true });
  var activeProcessStatuses = ['Pré-selecionado', 'Aguardando confirmação', 'Bloqueado', 'Enviado à empresa', 'Aguardando retorno', 'Entrevista', 'Proposta'];
  var activeHires = hires.filter(function (hire) {
    return ['Ativa', 'Em acompanhamento'].indexOf(String(hire.status_contratacao || '')) !== -1;
  });
  var salaries = hires.map(function (hire) { return parseMoney_(hire.salario_contratacao); }).filter(function (value) { return value !== null; });
  var activeSalaries = activeHires.map(function (hire) { return parseMoney_(hire.salario_contratacao); }).filter(function (value) { return value !== null; });
  var timestamp = nowIso_();

  var definitions = [
    ['talentos_total_cache', talents.length, 'Talentos', 'Pessoas sincronizadas do CDP'],
    ['talentos_com_termo_ativo', countBy_(terms, 'status', 'ATIVO'), 'Talentos', 'Termos ativos'],
    ['talentos_com_termo_cancelado', countBy_(terms, 'status', 'CANCELADO'), 'Talentos', 'Termos cancelados'],
    ['talentos_cadastro_atualizado_90d', countBy_(talents, 'cadastro_atualizado_90d', 'SIM'), 'Talentos', 'Cadastros válidos'],
    ['talentos_aptos', countBy_(talents, 'apto_talent_hub', 'SIM'), 'Talentos', 'Talentos aptos'],
    ['talentos_disponiveis', countBy_(talents, 'status_pool', 'Disponível'), 'Talentos', 'Talentos disponíveis'],
    ['talentos_em_processo', countBy_(talents, 'status_pool', 'Em processo'), 'Talentos', 'Talentos em processo'],
    ['talentos_bloqueados', countBy_(talents, 'status_pool', 'Bloqueado'), 'Talentos', 'Talentos bloqueados'],
    ['talentos_inativos', countBy_(talents, 'status_pool', 'Inativo'), 'Talentos', 'Talentos temporariamente fora do pool'],
    ['talentos_inelegiveis', countBy_(talents, 'status_pool', 'Inelegível'), 'Talentos', 'Talentos inelegíveis'],
    ['talentos_com_formacao_serratec_aprovada', countBy_(talents, 'possui_formacao_serratec_aprovada', 'SIM'), 'Qualidade da base', 'Pessoas com ao menos uma formação Serratec aprovada'],
    ['total_formacoes_serratec_aprovadas', talents.reduce(function (sum, talent) { return sum + Number(talent.qtd_formacoes_serratec_aprovadas || 0); }, 0), 'Qualidade da base', 'Matrículas Serratec aprovadas consolidadas'],
    ['talentos_com_curriculo', countBy_(talents, 'curriculo_disponivel', 'SIM'), 'Qualidade da base', 'Pessoas com currículo disponível'],
    ['clientes_total', clients.length, 'Clientes', 'Clientes cadastrados'],
    ['clientes_ativos', countBy_(clients, 'status_cliente', 'Ativo'), 'Clientes', 'Clientes ativos'],
    ['vagas_abertas', jobs.filter(function (job) { return ['Aberta', 'Validando pool', 'Shortlist enviada'].indexOf(job.status_vaga) !== -1; }).length, 'Vagas', 'Vagas abertas'],
    ['vagas_em_processo', countBy_(jobs, 'status_vaga', 'Em processo'), 'Vagas', 'Vagas em processo'],
    ['vagas_encerradas', jobs.filter(function (job) { return ['Preenchida', 'Encerrada sem contratação', 'Cancelada'].indexOf(job.status_vaga) !== -1; }).length, 'Vagas', 'Vagas encerradas'],
    ['shortlists_total', shortlists.length, 'Processos', 'Shortlists criadas'],
    ['shortlists_enviadas', shortlists.filter(function (row) { return ['Enviada', 'Em análise pela empresa', 'Concluída'].indexOf(row.status_shortlist) !== -1; }).length, 'Processos', 'Shortlists enviadas'],
    ['processos_ativos', processes.filter(function (row) { return activeProcessStatuses.indexOf(row.status_processo) !== -1; }).length, 'Processos', 'Processos ativos'],
    ['perfis_enviados', processes.filter(function (row) { return !valueIsBlank_(row.data_envio_empresa) || ['Enviado à empresa', 'Aguardando retorno', 'Entrevista', 'Proposta', 'Contratado'].indexOf(row.status_processo) !== -1; }).length, 'Processos', 'Perfis enviados'],
    ['contratacoes_total', hires.length, 'Impacto', 'Contratações registradas'],
    ['contratacoes_ativas', activeHires.length, 'Impacto', 'Contratações ativas ou em acompanhamento'],
    ['salario_medio_contratacoes', salaries.length ? salaries.reduce(function (sum, value) { return sum + value; }, 0) / salaries.length : 0, 'Impacto', 'Salário médio'],
    ['massa_salarial_gerada', salaries.reduce(function (sum, value) { return sum + value; }, 0), 'Impacto', 'Soma histórica dos salários mensais registrados'],
    ['massa_salarial_ativa', activeSalaries.reduce(function (sum, value) { return sum + value; }, 0), 'Impacto', 'Massa salarial mensal ativa estimada']
  ];
  var rows = definitions.map(function (definition) {
    return { indicador: definition[0], valor: definition[1], grupo: definition[2], descricao: definition[3], atualizado_em: timestamp };
  });
  replaceSheetRows_('VW_DASHBOARD', rows);
  return { ok: true, total: rows.length, atualizado_em: timestamp };
}

function getDashboard() {
  var rows = getSheetObjects_('VW_DASHBOARD', { raw: true });
  var present = {};
  rows.forEach(function (row) { present[String(row.indicador || '')] = true; });
  var requiredIndicators = [
    'talentos_aptos',
    'talentos_disponiveis',
    'talentos_inativos',
    'clientes_ativos',
    'vagas_abertas',
    'contratacoes_ativas',
    'massa_salarial_ativa'
  ];
  if (!rows.length || requiredIndicators.some(function (indicator) { return !present[indicator]; })) {
    regenerateDashboard_();
    rows = getSheetObjects_('VW_DASHBOARD', { raw: true });
  }
  var metrics = {};
  rows.forEach(function (row) { metrics[row.indicador] = row.valor; });
  return serializeForClient_({ metrics: metrics, items: rows, atualizado_em: rows.length ? rows[0].atualizado_em : '' });
}

function countBy_(rows, field, expected) {
  return rows.filter(function (row) { return String(row[field] || '') === String(expected); }).length;
}

function parseMoney_(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  var text = String(value == null ? '' : value).trim();
  if (!text) return null;
  text = text.replace(/R\$/gi, '').replace(/\s/g, '');
  if (text.indexOf(',') !== -1) text = text.replace(/\./g, '').replace(',', '.');
  var number = Number(text);
  return Number.isFinite(number) ? number : null;
}
