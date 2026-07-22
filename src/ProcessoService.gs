function getProcessoById(processoId) {
  var process = getObjectById_('TH_PROCESSOS', 'processo_id', processoId, { raw: true });
  if (!process) throw new Error('Processo não encontrado: ' + processoId);
  return serializeForClient_({
    processo: process,
    talento: getObjectById_('VW_TALENTOS_APTOS', 'pessoa_id', process.pessoa_id, { raw: true }),
    vaga: getObjectById_('TH_VAGAS', 'vaga_id', process.vaga_id, { raw: true }),
    cliente: getObjectById_('TH_CLIENTES', 'cliente_id', process.cliente_id, { raw: true }),
    contratacao: getSheetObjects_('TH_CONTRATACOES', { raw: true }).filter(function (hire) {
      return String(hire.processo_id || '') === String(processoId);
    })[0] || null
  });
}

function updateProcessoStatus(processoId, newStatus, payload) {
  payload = payload || {};
  assertEnum_(newStatus, getProcessStatusValues_(), 'status_processo', false);
  return withScriptLock_(function () {
    var process = getObjectById_('TH_PROCESSOS', 'processo_id', processoId, { raw: true });
    if (!process) throw new Error('Processo não encontrado: ' + processoId);
    var now = nowIso_();
    var user = currentUser_();
    var patch = buildProcessStatusPatch_(process, newStatus, payload, now, user);
    var result = updateObjectById_('TH_PROCESSOS', 'processo_id', processoId, patch);
    updateShortlistItemFromProcess_(processoId, newStatus, payload, now, user);
    if (newStatus === 'Contratado') registerHireForProcess_(result.after, payload.contratacao || payload, now, user);
    updateVacancyFromProcesses_(process.vaga_id, now, user);
    writeEntityAudit_('UPDATE', 'PROCESSO', processoId, result.before, result.after, 'WEB_APP');
    writeEvent_(processEventForStatus_(newStatus), 'PROCESSO', processoId, result.after,
      payload.observacoes_processo || payload.motivo || ('Status alterado para ' + newStatus),
      result.before.status_processo, newStatus);
    regenerateTalentView_();
    regenerateDashboard_();
    return getProcessoById(processoId);
  });
}

function registrarContratacao(processoId, payload) {
  payload = payload || {};
  return updateProcessoStatus(processoId, 'Contratado', { contratacao: payload, observacoes_processo: payload.observacoes || '' });
}

function getProcessStatusValues_() {
  return [
    'Pré-selecionado', 'Aguardando confirmação', 'Bloqueado', 'Enviado à empresa',
    'Aguardando retorno', 'Entrevista', 'Proposta', 'Contratado', 'Recusado pela empresa',
    'Recusado pelo candidato', 'Liberado', 'Substituído'
  ];
}

function isActiveProcessStatus_(status) {
  return ['Pré-selecionado', 'Aguardando confirmação', 'Bloqueado', 'Enviado à empresa', 'Aguardando retorno', 'Entrevista', 'Proposta'].indexOf(String(status || '')) !== -1;
}

function isTerminalProcessStatus_(status) {
  return ['Contratado', 'Recusado pela empresa', 'Recusado pelo candidato', 'Liberado', 'Substituído'].indexOf(String(status || '')) !== -1;
}

function buildProcessStatusPatch_(process, newStatus, payload, now, user) {
  var patch = {
    status_processo: newStatus,
    observacoes_processo: Object.prototype.hasOwnProperty.call(payload, 'observacoes_processo') ? payload.observacoes_processo : process.observacoes_processo,
    responsavel: payload.responsavel || process.responsavel || user,
    atualizado_em: now,
    atualizado_por: user
  };
  if (newStatus === 'Aguardando confirmação' && valueIsBlank_(process.data_confirmacao_interesse)) {
    patch.data_confirmacao_interesse = '';
  }
  if (newStatus === 'Bloqueado') {
    var start = parseDateValue_(payload.data_bloqueio) || parseDateValue_(process.data_bloqueio) || new Date();
    var limit = parseDateValue_(payload.data_limite_bloqueio) || new Date(start.getTime());
    if (!payload.data_limite_bloqueio) limit.setDate(limit.getDate() + 30);
    patch.data_confirmacao_interesse = payload.data_confirmacao_interesse || process.data_confirmacao_interesse || now;
    patch.data_bloqueio = payload.data_bloqueio || dateIso_(start);
    patch.data_limite_bloqueio = payload.data_limite_bloqueio || dateIso_(limit);
  }
  if (newStatus === 'Enviado à empresa') patch.data_envio_empresa = payload.data_envio_empresa || process.data_envio_empresa || now;
  if (newStatus === 'Aguardando retorno') {
    patch.data_envio_empresa = payload.data_envio_empresa || process.data_envio_empresa || now;
  }
  if (newStatus === 'Entrevista') {
    patch.entrevista_realizada = 'SIM';
    patch.data_entrevista = payload.data_entrevista || now;
    patch.data_retorno_empresa = payload.data_retorno_empresa || process.data_retorno_empresa || now;
  }
  if (newStatus === 'Proposta') {
    patch.proposta_realizada = 'SIM';
    patch.data_proposta = payload.data_proposta || now;
    patch.data_retorno_empresa = payload.data_retorno_empresa || process.data_retorno_empresa || now;
  }
  if (newStatus === 'Contratado') {
    patch.resultado_final = 'Contratado';
    patch.data_resultado = payload.data_resultado || (payload.contratacao && payload.contratacao.data_contratacao) || now;
    patch.data_retorno_empresa = payload.data_retorno_empresa || process.data_retorno_empresa || now;
  }
  if (['Recusado pela empresa', 'Recusado pelo candidato', 'Liberado', 'Substituído'].indexOf(newStatus) !== -1) {
    patch.resultado_final = newStatus;
    patch.data_resultado = payload.data_resultado || now;
    patch.motivo_recusa_ou_liberacao = payload.motivo || payload.motivo_recusa_ou_liberacao || '';
    patch.data_liberacao = payload.data_liberacao || now;
    if (newStatus === 'Recusado pela empresa') patch.data_retorno_empresa = payload.data_retorno_empresa || process.data_retorno_empresa || now;
  }
  return patch;
}

function updateShortlistItemFromProcess_(processoId, newStatus, payload, now, user) {
  var item = getSheetObjects_('TH_SHORTLIST_ITENS', { raw: true }).filter(function (row) {
    return String(row.processo_id || '') === String(processoId);
  })[0];
  if (!item) return;
  var statusMap = {
    'Enviado à empresa': 'Enviado',
    'Aguardando retorno': 'Enviado',
    Entrevista: 'Enviado',
    Proposta: 'Enviado',
    Contratado: 'Contratado',
    'Recusado pela empresa': 'Liberado',
    'Recusado pelo candidato': 'Liberado',
    Liberado: 'Liberado',
    Substituído: 'Substituído'
  };
  var itemStatus = statusMap[newStatus];
  if (!itemStatus) return;
  updateObjectById_('TH_SHORTLIST_ITENS', 'shortlist_item_id', item.shortlist_item_id, {
    status_item: itemStatus,
    observacao_curadoria: Object.prototype.hasOwnProperty.call(payload, 'observacao_curadoria') ? payload.observacao_curadoria : item.observacao_curadoria,
    atualizado_em: now,
    atualizado_por: user
  });
}

function registerHireForProcess_(process, payload, now, user) {
  payload = payload || {};
  var existing = getSheetObjects_('TH_CONTRATACOES', { raw: true }).filter(function (hire) {
    return String(hire.processo_id || '') === String(process.processo_id || '');
  })[0];
  var clean = sanitizePayload_(payload, getDatabaseSchema_().TH_CONTRATACOES);
  assertNonNegativeNumber_(clean.salario_contratacao, 'salario_contratacao', true);
  clean.processo_id = process.processo_id;
  clean.vaga_id = process.vaga_id;
  clean.cliente_id = process.cliente_id;
  clean.pessoa_id = process.pessoa_id;
  clean.data_contratacao = clean.data_contratacao || now;
  clean.status_contratacao = clean.status_contratacao || 'Em acompanhamento';
  clean.atualizado_em = now;
  clean.atualizado_por = user;
  if (existing) {
    var updated = updateObjectById_('TH_CONTRATACOES', 'contratacao_id', existing.contratacao_id, clean);
    writeEntityAudit_('UPDATE', 'CONTRATACAO', existing.contratacao_id, updated.before, updated.after, 'WEB_APP');
    return updated.after;
  }
  clean.contratacao_id = generateId_('CON_');
  clean.criado_em = now;
  clean.criado_por = user;
  appendObject_('TH_CONTRATACOES', clean);
  writeEntityAudit_('CREATE', 'CONTRATACAO', clean.contratacao_id, {}, clean, 'WEB_APP');
  writeEvent_('Candidato contratado', 'CONTRATACAO', clean.contratacao_id, process,
    'Contratação registrada para a vaga ' + process.vaga_id, process.status_processo, 'Contratado');
  return clean;
}

function updateVacancyFromProcesses_(vagaId, now, user) {
  var job = getObjectById_('TH_VAGAS', 'vaga_id', vagaId, { raw: true });
  if (!job) return;
  var processes = getSheetObjects_('TH_PROCESSOS', { raw: true }).filter(function (process) {
    return String(process.vaga_id || '') === String(vagaId);
  });
  var hired = processes.filter(function (process) { return String(process.status_processo || '') === 'Contratado'; }).length;
  var positions = Math.max(Number(job.qtd_posicoes || 1), 1);
  var status = job.status_vaga;
  var patch = { atualizado_em: now, atualizado_por: user };
  if (hired >= positions) {
    status = 'Preenchida';
    patch.data_encerramento = job.data_encerramento || now;
    patch.motivo_encerramento = job.motivo_encerramento || 'Posições preenchidas';
  } else if (processes.some(function (process) { return isActiveProcessStatus_(process.status_processo); })) {
    status = processes.some(function (process) { return !valueIsBlank_(process.data_envio_empresa); }) ? 'Em processo' : 'Em processo';
  }
  patch.status_vaga = status;
  updateObjectById_('TH_VAGAS', 'vaga_id', vagaId, patch);
}

function processEventForStatus_(status) {
  var map = {
    Bloqueado: 'Candidato bloqueado',
    Liberado: 'Candidato liberado',
    Contratado: 'Candidato contratado',
    Entrevista: 'Entrevista registrada',
    Proposta: 'Proposta registrada',
    'Enviado à empresa': 'Candidato enviado'
  };
  return map[status] || 'Status do processo alterado';
}

function dateIso_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'America/Sao_Paulo', 'yyyy-MM-dd');
}
