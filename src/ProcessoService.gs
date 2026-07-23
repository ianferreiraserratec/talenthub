function getProcessoById(processoId) {
  var process = getObjectById_('TH_PROCESSOS', 'processo_id', processoId, { raw: true });
  if (!process) throw new Error('Processo não encontrado: ' + processoId);
  return serializeForClient_({
    processo: process,
    transicoes_permitidas: getAllowedProcessTransitions_(process.status_processo),
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
    if (process.shortlist_id) {
      var relatedShortlist = getObjectById_('TH_SHORTLISTS', 'shortlist_id', process.shortlist_id, { raw: true });
      if (relatedShortlist &&
        ['Concluída', 'Cancelada'].indexOf(String(relatedShortlist.status_shortlist || '')) !== -1 &&
        String(process.status_processo || '') !== 'Contratado') {
        throw new Error('A shortlist está encerrada e este processo não pode mais ser alterado.');
      }
    }
    assertProcessTransitionAllowed_(process, newStatus);
    if (newStatus === 'Contratado') {
      var existingHire = getSheetObjects_('TH_CONTRATACOES', { raw: true }).some(function (hire) {
        return String(hire.processo_id || '') === String(processoId);
      });
      validateHirePayload_(payload.contratacao || payload, existingHire);
    }
    var now = nowIso_();
    var user = currentUser_();
    var patch = buildProcessStatusPatch_(process, newStatus, payload, now, user);
    var snapshot = captureVacancyOperationSnapshot_(process.vaga_id);
    var operationLogs = createOperationalLogBuffer_();
    var result;
    var hireMutation = null;
    try {
      result = updateObjectById_('TH_PROCESSOS', 'processo_id', processoId, patch);
      updateShortlistItemFromProcess_(processoId, newStatus, payload, now, user);
      if (newStatus === 'Contratado') {
        hireMutation = registerHireForProcess_(result.after, payload.contratacao || payload, now, user);
      }
      if (newStatus === 'Substituído') {
        hireMutation = deactivateHireForProcess_(result.after, now, user);
      }
      updateVacancyFromProcesses_(process.vaga_id, now, user, operationLogs);
    } catch (error) {
      var rollbackMessage = '';
      try {
        restoreVacancyOperationSnapshot_(snapshot);
        rollbackMessage = ' A operação foi revertida integralmente.';
      } catch (rollbackError) {
        rollbackMessage = ' A reversão também falhou: ' + rollbackError.message + '.';
      }
      writeAuditLog_('UPDATE', 'PROCESSO', processoId, 'status_processo', process.status_processo, 'SISTEMA',
        'Falha ao alterar para ' + newStatus + ': ' + error.message + rollbackMessage, process.status_processo);
      throw new Error('Não foi possível atualizar o processo.' + rollbackMessage + ' Motivo: ' + error.message);
    }

    flushOperationalLogs_(operationLogs);
    if (hireMutation) {
      writeEntityAudit_(hireMutation.created ? 'CREATE' : 'UPDATE', 'CONTRATACAO',
        hireMutation.after.contratacao_id, hireMutation.before || {}, hireMutation.after, 'WEB_APP');
      writeEvent_(newStatus === 'Substituído' ? 'Contratação substituída' : 'Candidato contratado',
        'CONTRATACAO', hireMutation.after.contratacao_id, result.after,
        newStatus === 'Substituído'
          ? 'Contratação marcada como substituída'
          : 'Contratação registrada para a vaga ' + process.vaga_id,
        hireMutation.before ? hireMutation.before.status_contratacao : '',
        hireMutation.after.status_contratacao);
    }
    writeEntityAudit_('UPDATE', 'PROCESSO', processoId, result.before, result.after, 'WEB_APP');
    writeEvent_(processEventForStatus_(newStatus), 'PROCESSO', processoId, result.after,
      payload.observacoes_processo || payload.motivo || ('Status alterado para ' + newStatus),
      result.before.status_processo, newStatus);
    refreshOperationalViewsSafely_();
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

function isBlockingProcessStatus_(status) {
  return isActiveProcessStatus_(status) || String(status || '') === 'Contratado';
}

function assertProcessTransitionAllowed_(process, newStatus) {
  var currentStatus = String(process.status_processo || '');
  if (!currentStatus || currentStatus === newStatus) return;
  var allowed = getAllowedProcessTransitions_(currentStatus);
  if (allowed.indexOf(newStatus) === -1) {
    var guidance = allowed.length
      ? 'Próximas etapas permitidas: ' + allowed.join(', ') + '.'
      : 'Crie um novo processo para uma nova oportunidade.';
    throw new Error('Transição inválida de ' + currentStatus + ' para ' + newStatus + '. ' + guidance);
  }
}

function getAllowedProcessTransitions_(status) {
  var transitions = {
    'Pré-selecionado': ['Aguardando confirmação', 'Bloqueado', 'Enviado à empresa', 'Recusado pelo candidato', 'Liberado'],
    'Aguardando confirmação': ['Bloqueado', 'Enviado à empresa', 'Recusado pelo candidato', 'Liberado'],
    'Bloqueado': ['Enviado à empresa', 'Recusado pelo candidato', 'Liberado'],
    'Enviado à empresa': ['Aguardando retorno', 'Entrevista', 'Proposta', 'Contratado', 'Recusado pela empresa', 'Recusado pelo candidato', 'Liberado'],
    'Aguardando retorno': ['Entrevista', 'Proposta', 'Contratado', 'Recusado pela empresa', 'Recusado pelo candidato', 'Liberado'],
    Entrevista: ['Aguardando retorno', 'Proposta', 'Contratado', 'Recusado pela empresa', 'Recusado pelo candidato', 'Liberado'],
    Proposta: ['Contratado', 'Recusado pela empresa', 'Recusado pelo candidato', 'Liberado'],
    Contratado: ['Substituído'],
    'Recusado pela empresa': [],
    'Recusado pelo candidato': [],
    Liberado: [],
    Substituído: []
  };
  return (transitions[String(status || '')] || []).slice();
}

function getBlockingTalentEngagement_(personId, excludedProcessId) {
  personId = String(personId || '').trim();
  excludedProcessId = String(excludedProcessId || '').trim();
  if (!personId) return { type: 'PESSOA_INVALIDA', message: 'pessoa_id inválido' };

  var hires = getSheetObjects_('TH_CONTRATACOES', { raw: true });
  var blockingProcess = getSheetObjects_('TH_PROCESSOS', { raw: true }).filter(function (process) {
    if (String(process.pessoa_id || '') !== personId ||
      String(process.processo_id || '') === excludedProcessId) return false;
    if (isActiveProcessStatus_(process.status_processo)) return true;
    if (String(process.status_processo || '') !== 'Contratado') return false;
    var relatedHire = hires.filter(function (hire) {
      return String(hire.processo_id || '') === String(process.processo_id || '');
    })[0];
    return !relatedHire || ['Ativa', 'Em acompanhamento'].indexOf(String(relatedHire.status_contratacao || '')) !== -1;
  })[0];
  if (blockingProcess) {
    return {
      type: String(blockingProcess.status_processo || '') === 'Contratado' ? 'CONTRATADO' : 'PROCESSO_ATIVO',
      process_id: blockingProcess.processo_id,
      vaga_id: blockingProcess.vaga_id,
      message: String(blockingProcess.status_processo || '') === 'Contratado'
        ? 'já existe uma contratação registrada'
        : 'já existe um processo ativo na vaga ' + String(blockingProcess.vaga_id || '')
    };
  }

  var activeHire = hires.filter(function (hire) {
    return String(hire.pessoa_id || '') === personId &&
      ['Ativa', 'Em acompanhamento'].indexOf(String(hire.status_contratacao || '')) !== -1 &&
      String(hire.processo_id || '') !== excludedProcessId;
  })[0];
  if (activeHire) {
    return {
      type: 'CONTRATACAO_ATIVA',
      contratacao_id: activeHire.contratacao_id,
      vaga_id: activeHire.vaga_id,
      message: 'já existe uma contratação ativa'
    };
  }
  return null;
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
    var blockingDays = Math.ceil((limit.getTime() - start.getTime()) / 86400000);
    if (blockingDays < 0) throw new Error('A data limite do bloqueio não pode ser anterior ao início.');
    if (blockingDays > 30) throw new Error('O bloqueio não pode ultrapassar 30 dias.');
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
    patch.data_resultado = payload.data_resultado || payload.data_contratacao ||
      (payload.contratacao && payload.contratacao.data_contratacao) || now;
    patch.data_retorno_empresa = payload.data_retorno_empresa || process.data_retorno_empresa || now;
  }
  if (['Recusado pela empresa', 'Recusado pelo candidato', 'Liberado', 'Substituído'].indexOf(newStatus) !== -1) {
    patch.resultado_final = newStatus;
    patch.data_resultado = newStatus === 'Substituído' ? now : (payload.data_resultado || now);
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
  if (!item) return null;
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
  if (!itemStatus) return null;
  return updateObjectById_('TH_SHORTLIST_ITENS', 'shortlist_item_id', item.shortlist_item_id, {
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
  Object.keys(clean).forEach(function (field) {
    if (valueIsBlank_(clean[field])) delete clean[field];
  });
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
    return { before: updated.before, after: updated.after, created: false };
  }
  clean.contratacao_id = generateId_('CON_');
  clean.criado_em = now;
  clean.criado_por = user;
  appendObject_('TH_CONTRATACOES', clean);
  return { before: null, after: clean, created: true };
}

function validateHirePayload_(payload, allowClosedStatus) {
  payload = payload || {};
  if (valueIsBlank_(payload.data_contratacao)) {
    throw new Error('Informe a data da contratação antes de concluir o processo.');
  }
  if (!parseDateValue_(payload.data_contratacao)) throw new Error('A data da contratação é inválida.');
  assertNonNegativeNumber_(payload.salario_contratacao, 'salario_contratacao', true);
  if (!valueIsBlank_(payload.status_contratacao)) {
    assertEnum_(payload.status_contratacao, [
      'Ativa', 'Encerrada antes de 3 meses', 'Encerrada após 3 meses', 'Substituída', 'Em acompanhamento'
    ], 'status_contratacao', true);
    if (String(payload.status_contratacao || '') === 'Substituída') {
      throw new Error('Use a transição do processo para Substituído; esse status não pode ser definido diretamente na contratação.');
    }
    if (!allowClosedStatus && ['Ativa', 'Em acompanhamento'].indexOf(String(payload.status_contratacao || '')) === -1) {
      throw new Error('Uma nova contratação deve iniciar como Ativa ou Em acompanhamento.');
    }
  }
}

function deactivateHireForProcess_(process, now, user) {
  var hire = getSheetObjects_('TH_CONTRATACOES', { raw: true }).filter(function (row) {
    return String(row.processo_id || '') === String(process.processo_id || '');
  })[0];
  if (!hire) return null;
  if (String(hire.status_contratacao || '') === 'Substituída') {
    return { before: hire, after: hire, created: false };
  }
  var result = updateObjectById_('TH_CONTRATACOES', 'contratacao_id', hire.contratacao_id, {
    status_contratacao: 'Substituída',
    atualizado_em: now,
    atualizado_por: user
  });
  return { before: result.before, after: result.after, created: false };
}

function captureVacancyOperationSnapshot_(vagaId) {
  vagaId = String(vagaId || '');
  var processes = getSheetObjects_('TH_PROCESSOS', { raw: true }).filter(function (process) {
    return String(process.vaga_id || '') === vagaId;
  });
  var processIds = {};
  processes.forEach(function (process) { processIds[String(process.processo_id || '')] = true; });
  return {
    vaga_id: vagaId,
    vacancy: cloneSnapshotRow_(getObjectById_('TH_VAGAS', 'vaga_id', vagaId, { raw: true })),
    processes: processes.map(cloneSnapshotRow_),
    shortlists: getSheetObjects_('TH_SHORTLISTS', { raw: true }).filter(function (shortlist) {
      return String(shortlist.vaga_id || '') === vagaId;
    }).map(cloneSnapshotRow_),
    items: getSheetObjects_('TH_SHORTLIST_ITENS', { raw: true }).filter(function (item) {
      return String(item.vaga_id || '') === vagaId || !!processIds[String(item.processo_id || '')];
    }).map(cloneSnapshotRow_),
    hires: getSheetObjects_('TH_CONTRATACOES', { raw: true }).filter(function (hire) {
      return String(hire.vaga_id || '') === vagaId || !!processIds[String(hire.processo_id || '')];
    }).map(cloneSnapshotRow_)
  };
}

function cloneSnapshotRow_(row) {
  if (!row) return null;
  var copy = {};
  Object.keys(row).forEach(function (field) {
    var value = row[field];
    if (Object.prototype.toString.call(value) === '[object Date]') copy[field] = new Date(value.getTime());
    else if (Array.isArray(value)) copy[field] = value.slice();
    else copy[field] = value;
  });
  return copy;
}

function restoreVacancyOperationSnapshot_(snapshot) {
  if (!snapshot || !snapshot.vaga_id) throw new Error('Snapshot operacional inválido.');
  restoreSnapshotRows_('TH_VAGAS', 'vaga_id', snapshot.vacancy ? [snapshot.vacancy] : []);
  restoreSnapshotRows_('TH_PROCESSOS', 'processo_id', snapshot.processes || []);
  restoreSnapshotRows_('TH_SHORTLISTS', 'shortlist_id', snapshot.shortlists || []);
  restoreSnapshotRows_('TH_SHORTLIST_ITENS', 'shortlist_item_id', snapshot.items || []);

  var expectedHireIds = {};
  (snapshot.hires || []).forEach(function (hire) {
    expectedHireIds[String(hire.contratacao_id || '')] = true;
  });
  getSheetObjects_('TH_CONTRATACOES', { raw: true }).filter(function (hire) {
    return String(hire.vaga_id || '') === String(snapshot.vaga_id || '');
  }).forEach(function (hire) {
    if (!expectedHireIds[String(hire.contratacao_id || '')]) {
      deleteObjectById_('TH_CONTRATACOES', 'contratacao_id', hire.contratacao_id);
    }
  });
  restoreSnapshotRows_('TH_CONTRATACOES', 'contratacao_id', snapshot.hires || []);
  return true;
}

function restoreSnapshotRows_(sheetName, idField, rows) {
  (rows || []).forEach(function (row) {
    var id = row[idField];
    if (getObjectById_(sheetName, idField, id, { raw: true })) {
      updateObjectById_(sheetName, idField, id, row);
    } else {
      appendObject_(sheetName, row);
    }
  });
}

function createOperationalLogBuffer_() {
  return [];
}

function queueOperationalAudit_(buffer, action, entity, entityId, field, oldValue, source, note, newValue) {
  if (!Array.isArray(buffer)) {
    writeAuditLog_(action, entity, entityId, field, oldValue, source, note, newValue);
    return;
  }
  buffer.push({
    type: 'audit',
    args: [action, entity, entityId, field, oldValue, source, note, newValue]
  });
}

function queueOperationalEvent_(buffer, type, entity, entityId, context, description, oldStatus, newStatus, channel, notes) {
  if (!Array.isArray(buffer)) {
    writeEvent_(type, entity, entityId, context, description, oldStatus, newStatus, channel, notes);
    return;
  }
  buffer.push({
    type: 'event',
    args: [type, entity, entityId, context, description, oldStatus, newStatus, channel, notes]
  });
}

function flushOperationalLogs_(buffer) {
  (buffer || []).forEach(function (entry) {
    if (entry.type === 'audit') writeAuditLog_.apply(null, entry.args || []);
    else if (entry.type === 'event') writeEvent_.apply(null, entry.args || []);
  });
  if (Array.isArray(buffer)) buffer.length = 0;
}

function refreshOperationalViewsSafely_() {
  try {
    regenerateTalentView_();
  } catch (error) {
    console.error('Falha ao atualizar a visão de talentos: ' + error.message);
  }
  try {
    regenerateDashboard_();
  } catch (error) {
    console.error('Falha ao atualizar o dashboard: ' + error.message);
  }
}

function updateVacancyFromProcesses_(vagaId, now, user, operationLogs) {
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
    status = 'Em processo';
  } else if (String(job.status_vaga || '') === 'Preenchida' ||
    ['Em processo', 'Shortlist enviada'].indexOf(String(job.status_vaga || '')) !== -1) {
    status = 'Aberta';
    if (String(job.status_vaga || '') === 'Preenchida') {
      patch.data_encerramento = '';
      patch.motivo_encerramento = '';
    }
  }
  patch.status_vaga = status;
  patch.qtd_perfis_enviados = countSentProfilesForJob_(vagaId);
  var result = updateObjectById_('TH_VAGAS', 'vaga_id', vagaId, patch);
  if (String(result.before.status_vaga || '') !== String(result.after.status_vaga || '')) {
    queueOperationalAudit_(operationLogs, 'UPDATE', 'VAGA', vagaId, 'status_vaga', result.before.status_vaga, 'SISTEMA',
      'Status recalculado a partir dos processos', result.after.status_vaga);
    queueOperationalEvent_(operationLogs, 'Status da vaga alterado', 'VAGA', vagaId, {
      vaga_id: vagaId,
      cliente_id: result.after.cliente_id
    }, 'Status recalculado a partir dos processos', result.before.status_vaga, result.after.status_vaga);
  }
  if (status === 'Preenchida') {
    closeVacancyProcesses_(vagaId, status, patch.motivo_encerramento, now, user, operationLogs);
  }
}

function closeVacancyProcesses_(vagaId, vacancyStatus, reason, now, user, operationLogs) {
  now = now || nowIso_();
  user = user || currentUser_();
  reason = reason || (vacancyStatus === 'Cancelada' ? 'Vaga cancelada' : 'Vaga encerrada');
  var released = 0;
  var shortlistIds = {};
  var processes = getSheetObjects_('TH_PROCESSOS', { raw: true }).filter(function (process) {
    return String(process.vaga_id || '') === String(vagaId);
  });

  processes.forEach(function (process) {
    if (process.shortlist_id) shortlistIds[String(process.shortlist_id)] = true;
    if (!isActiveProcessStatus_(process.status_processo)) return;
    var beforeStatus = String(process.status_processo || '');
    updateObjectById_('TH_PROCESSOS', 'processo_id', process.processo_id, {
      status_processo: 'Liberado',
      resultado_final: 'Liberado',
      data_resultado: now,
      data_liberacao: now,
      motivo_recusa_ou_liberacao: reason,
      atualizado_em: now,
      atualizado_por: user
    });
    updateShortlistItemFromProcess_(process.processo_id, 'Liberado', { observacao_curadoria: reason }, now, user);
    queueOperationalAudit_(operationLogs, 'UPDATE', 'PROCESSO', process.processo_id, 'status_processo', beforeStatus, 'SISTEMA', reason, 'Liberado');
    queueOperationalEvent_(operationLogs, 'Candidato liberado', 'PROCESSO', process.processo_id, process, reason, beforeStatus, 'Liberado');
    released += 1;
  });

  var shortlistStatus = vacancyStatus === 'Cancelada' ? 'Cancelada' : 'Concluída';
  Object.keys(shortlistIds).forEach(function (shortlistId) {
    var shortlist = getObjectById_('TH_SHORTLISTS', 'shortlist_id', shortlistId, { raw: true });
    if (!shortlist || ['Concluída', 'Cancelada'].indexOf(String(shortlist.status_shortlist || '')) !== -1) return;
    updateObjectById_('TH_SHORTLISTS', 'shortlist_id', shortlistId, {
      status_shortlist: shortlistStatus,
      atualizado_em: now,
      atualizado_por: user
    });
    queueOperationalAudit_(operationLogs, 'UPDATE', 'SHORTLIST', shortlistId, 'status_shortlist', shortlist.status_shortlist, 'SISTEMA', reason, shortlistStatus);
  });

  return { released: released, shortlists_updated: Object.keys(shortlistIds).length };
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
