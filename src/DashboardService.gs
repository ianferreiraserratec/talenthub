function regenerateDashboard() { return withScriptLock_(regenerateDashboard_); }

function regenerateDashboard_() {
  var talents = getSheetObjects_('VW_TALENTOS_APTOS', { raw: true });
  var clients = getSheetObjects_('TH_CLIENTES', { raw: true });
  var jobs = getSheetObjects_('TH_VAGAS', { raw: true });
  var indications = getSheetObjects_('TH_INDICACOES', { raw: true });
  var now = nowIso_();
  var values = [
    ['talentos_total', talents.length, 'Talentos', 'Pessoas disponíveis na base'],
    ['talentos_aptos', countBy_(talents, 'apto_talent_hub', 'SIM'), 'Talentos', 'Talentos com cadastro e termo válidos'],
    ['talentos_disponiveis', countBy_(talents, 'status_pool', 'Disponível'), 'Talentos', 'Talentos disponíveis para indicação'],
    ['clientes_ativos', countBy_(clients, 'status_cliente', 'Ativo'), 'Clientes', 'Clientes ativos'],
    ['vagas_abertas', jobs.filter(function (job) { return ['Aberta', 'Em processo'].indexOf(String(job.status_vaga || '')) !== -1; }).length, 'Vagas', 'Vagas recebendo indicações'],
    ['indicacoes_ativas', indications.filter(function (item) { return ['Em análise', 'Enviado', 'Entrevista'].indexOf(String(item.status_indicacao || '')) !== -1; }).length, 'Indicações', 'Indicações em andamento'],
    ['contratacoes', countBy_(indications, 'status_indicacao', 'Contratado'), 'Indicações', 'Contratações registradas']
  ];
  replaceSheetRows_('VW_DASHBOARD', values.map(function (item) { return { indicador: item[0], valor: item[1], grupo: item[2], descricao: item[3], atualizado_em: now }; }));
  return { ok: true };
}

function getDashboard() {
  var rows = getSheetObjects_('VW_DASHBOARD', { raw: true });
  if (!rows.length) { regenerateDashboard_(); rows = getSheetObjects_('VW_DASHBOARD', { raw: true }); }
  var metrics = {};
  rows.forEach(function (row) { metrics[row.indicador] = row.valor; });
  return serializeForClient_({ metrics: metrics, items: rows, atualizado_em: rows.length ? rows[0].atualizado_em : '' });
}

function countBy_(rows, field, expected) { return (rows || []).filter(function (row) { return String(row[field] || '') === String(expected); }).length; }
