function getVagas(filters) {
  filters = filters || {};
  var search = normalizeText_(filters.search || '');
  var status = String(filters.status || '').trim();
  var clients = indexBy_('TH_CLIENTES', 'cliente_id');
  var processes = getSheetObjects_('TH_PROCESSOS', { raw: true });
  var shortlists = getSheetObjects_('TH_SHORTLISTS', { raw: true });
  var rows = getSheetObjects_('TH_VAGAS', { raw: true }).filter(function (job) {
    if (status && status !== 'Todos' && job.status_vaga !== status) return false;
    var client = clients[String(job.cliente_id || '')] || {};
    if (search && normalizeText_([job.titulo_vaga, job.area_vaga, job.cidade, job.uf, client.nome_empresa].join(' ')).indexOf(search) === -1) return false;
    return true;
  }).map(function (job) {
    var id = String(job.vaga_id || '');
    var client = clients[String(job.cliente_id || '')] || {};
    job.nome_empresa = client.nome_empresa || '';
    job.total_candidatos = processes.filter(function (process) { return String(process.vaga_id || '') === id; }).length;
    job.total_shortlists = shortlists.filter(function (shortlist) { return String(shortlist.vaga_id || '') === id; }).length;
    return job;
  });
  rows.sort(function (a, b) { return String(b.criado_em || '').localeCompare(String(a.criado_em || '')); });
  return serializeForClient_(rows);
}

function getVagaById(vagaId) {
  var job = getObjectById_('TH_VAGAS', 'vaga_id', vagaId, { raw: true });
  if (!job) throw new Error('Vaga não encontrada: ' + vagaId);
  return serializeForClient_({
    vaga: job,
    cliente: getObjectById_('TH_CLIENTES', 'cliente_id', job.cliente_id, { raw: true }),
    criterios: getVagaCriterios(vagaId),
    processos: getSheetObjects_('TH_PROCESSOS', { raw: true }).filter(function (row) { return String(row.vaga_id || '') === String(vagaId); }),
    shortlists: getSheetObjects_('TH_SHORTLISTS', { raw: true }).filter(function (row) { return String(row.vaga_id || '') === String(vagaId); })
  });
}

function createVaga(payload) {
  payload = payload || {};
  requireFields_(payload, ['cliente_id', 'titulo_vaga'], 'Vaga');
  if (!getObjectById_('TH_CLIENTES', 'cliente_id', payload.cliente_id, { raw: true })) throw new Error('Cliente não encontrado.');
  var allowed = getDatabaseSchema_().TH_VAGAS;
  var clean = sanitizePayload_(payload, allowed);
  clean.status_vaga = clean.status_vaga || 'Rascunho';
  clean.qtd_posicoes = valueIsBlank_(clean.qtd_posicoes) ? 1 : clean.qtd_posicoes;
  clean.qtd_perfis_enviados = valueIsBlank_(clean.qtd_perfis_enviados) ? 0 : clean.qtd_perfis_enviados;
  clean.rodada_atual = valueIsBlank_(clean.rodada_atual) ? 1 : clean.rodada_atual;
  validateVaga_(clean);
  validateVagaCreation_(clean);

  return withScriptLock_(function () {
    var now = nowIso_();
    var user = currentUser_();
    clean.vaga_id = generateId_('VAG_');
    clean.criado_em = now;
    clean.criado_por = user;
    clean.atualizado_em = now;
    clean.atualizado_por = user;
    appendObject_('TH_VAGAS', clean);
    writeEntityAudit_('CREATE', 'VAGA', clean.vaga_id, {}, clean, 'WEB_APP');
    writeEvent_('Vaga criada', 'VAGA', clean.vaga_id, { vaga_id: clean.vaga_id, cliente_id: clean.cliente_id }, clean.titulo_vaga);
    regenerateDashboard_();
    return serializeForClient_(clean);
  });
}

function updateVaga(vagaId, payload) {
  payload = payload || {};
  requireFields_({ vaga_id: vagaId, cliente_id: payload.cliente_id, titulo_vaga: payload.titulo_vaga }, ['vaga_id', 'cliente_id', 'titulo_vaga'], 'Vaga');
  if (!getObjectById_('TH_CLIENTES', 'cliente_id', payload.cliente_id, { raw: true })) throw new Error('Cliente não encontrado.');
  var allowed = getDatabaseSchema_().TH_VAGAS.filter(function (field) {
    return ['vaga_id', 'criado_em', 'criado_por'].indexOf(field) === -1;
  });
  var clean = sanitizePayload_(payload, allowed);
  validateVaga_(clean);

  return withScriptLock_(function () {
    clean.atualizado_em = nowIso_();
    clean.atualizado_por = currentUser_();
    var before = getObjectById_('TH_VAGAS', 'vaga_id', vagaId, { raw: true });
    if (!before) throw new Error('Vaga não encontrada: ' + vagaId);
    validateVagaOperationalUpdate_(before, Object.assign({}, before, clean));
    var snapshot = captureVacancyOperationSnapshot_(vagaId);
    var operationLogs = createOperationalLogBuffer_();
    var result;
    try {
      result = updateObjectById_('TH_VAGAS', 'vaga_id', vagaId, clean, allowed);
      if (['Preenchida', 'Encerrada sem contratação', 'Cancelada'].indexOf(String(result.after.status_vaga || '')) !== -1) {
        closeVacancyProcesses_(
          vagaId,
          result.after.status_vaga,
          result.after.motivo_encerramento || ('Vaga ' + String(result.after.status_vaga || '').toLowerCase()),
          clean.atualizado_em,
          clean.atualizado_por,
          operationLogs
        );
      }
      updateVacancyFromProcesses_(vagaId, clean.atualizado_em, clean.atualizado_por, operationLogs);
      invalidateMatchingRuns_(function (run) {
        return String(run.vaga_id || '') === String(vagaId);
      }, 'Dados da vaga alterados. Execute o matchmaking novamente.');
    } catch (error) {
      var rollbackMessage = '';
      try {
        restoreVacancyOperationSnapshot_(snapshot);
        rollbackMessage = ' A operação foi revertida integralmente.';
      } catch (rollbackError) {
        rollbackMessage = ' A reversão também falhou: ' + rollbackError.message + '.';
      }
      writeAuditLog_('UPDATE', 'VAGA', vagaId, '', '', 'SISTEMA',
        'Falha ao atualizar a vaga: ' + error.message + rollbackMessage);
      throw new Error('Não foi possível atualizar a vaga.' + rollbackMessage + ' Motivo: ' + error.message);
    }
    flushOperationalLogs_(operationLogs);
    var after = getObjectById_('TH_VAGAS', 'vaga_id', vagaId, { raw: true }) || result.after;
    writeEntityAudit_('UPDATE', 'VAGA', vagaId, result.before, after, 'WEB_APP');
    if (result.before.status_vaga !== result.after.status_vaga) {
      writeEvent_('Status da vaga alterado', 'VAGA', vagaId, { vaga_id: vagaId, cliente_id: after.cliente_id }, after.titulo_vaga, result.before.status_vaga, after.status_vaga);
    }
    refreshOperationalViewsSafely_();
    return serializeForClient_(after);
  });
}

function validateVagaCreation_(job) {
  var initialStatuses = ['Rascunho', 'Briefing recebido', 'Validando pool', 'Aberta'];
  if (initialStatuses.indexOf(String(job.status_vaga || '')) === -1) {
    throw new Error('Uma nova vaga só pode iniciar como Rascunho, Briefing recebido, Validando pool ou Aberta.');
  }
  if (Number(job.qtd_perfis_enviados || 0) !== 0) {
    throw new Error('Uma nova vaga não pode iniciar com perfis enviados.');
  }
  var initialRound = valueIsBlank_(job.rodada_atual) ? 1 : Number(job.rodada_atual);
  if (!isFinite(initialRound) || initialRound !== 1) {
    throw new Error('Uma nova vaga deve iniciar na primeira rodada.');
  }
  if (!valueIsBlank_(job.data_encerramento) || !valueIsBlank_(job.motivo_encerramento)) {
    throw new Error('Uma nova vaga não pode iniciar com dados de encerramento.');
  }
}

function validateVagaOperationalUpdate_(before, after) {
  var processes = getSheetObjects_('TH_PROCESSOS', { raw: true }).filter(function (process) {
    return String(process.vaga_id || '') === String(before.vaga_id || '');
  });
  var shortlists = getSheetObjects_('TH_SHORTLISTS', { raw: true }).filter(function (shortlist) {
    return String(shortlist.vaga_id || '') === String(before.vaga_id || '');
  });
  if (String(before.cliente_id || '') !== String(after.cliente_id || '') && (processes.length || shortlists.length)) {
    throw new Error('O cliente da vaga não pode ser alterado depois que o funil foi iniciado.');
  }

  var hired = processes.filter(function (process) {
    return String(process.status_processo || '') === 'Contratado';
  }).length;
  var positions = Math.max(Number(after.qtd_posicoes || 1), 1);
  if (positions < hired) {
    throw new Error('A quantidade de posições não pode ser menor que o total de candidatos já contratados.');
  }
  if (String(after.status_vaga || '') === 'Preenchida' && hired < positions) {
    throw new Error('Registre as contratações nos processos antes de marcar a vaga como Preenchida.');
  }
  if (['Encerrada sem contratação', 'Cancelada'].indexOf(String(after.status_vaga || '')) !== -1 && hired > 0) {
    throw new Error('Uma vaga com contratação registrada deve ser encerrada como Preenchida.');
  }

  var terminalStatuses = ['Preenchida', 'Encerrada sem contratação', 'Cancelada'];
  if (terminalStatuses.indexOf(String(before.status_vaga || '')) !== -1 &&
    terminalStatuses.indexOf(String(after.status_vaga || '')) === -1) {
    throw new Error('Uma vaga encerrada não pode ser reaberta manualmente. Crie uma nova vaga ou registre uma substituição no processo contratado.');
  }
}

function validateVaga_(job) {
  if (job.status_vaga) assertEnum_(job.status_vaga, ['Rascunho', 'Briefing recebido', 'Validando pool', 'Aberta', 'Shortlist enviada', 'Em processo', 'Preenchida', 'Encerrada sem contratação', 'Cancelada'], 'status_vaga', true);
  ['qtd_posicoes', 'faixa_salarial_min', 'faixa_salarial_max', 'qtd_perfis_previstos'].forEach(function (field) {
    assertNonNegativeNumber_(job[field], field, true);
  });
  if (!valueIsBlank_(job.qtd_posicoes) && Number(job.qtd_posicoes) < 1) {
    throw new Error('A quantidade de posições deve ser pelo menos 1.');
  }
  if (!valueIsBlank_(job.faixa_salarial_min) && !valueIsBlank_(job.faixa_salarial_max) && Number(job.faixa_salarial_min) > Number(job.faixa_salarial_max)) {
    throw new Error('A faixa salarial mínima não pode ser maior que a máxima.');
  }
}

function getVagaCriterios(vagaId) {
  return serializeForClient_(getSheetObjects_('TH_VAGA_CRITERIOS', { raw: true }).filter(function (row) {
    return String(row.vaga_id || '') === String(vagaId);
  }));
}

function saveVagaCriterios(vagaId, criterios) {
  if (!getObjectById_('TH_VAGAS', 'vaga_id', vagaId, { raw: true })) throw new Error('Vaga não encontrada.');
  criterios = Array.isArray(criterios) ? criterios : [];
  return withScriptLock_(function () {
    var allBefore = getSheetObjects_('TH_VAGA_CRITERIOS', { raw: true });
    var all = allBefore.filter(function (row) {
      return String(row.vaga_id || '') !== String(vagaId);
    });
    var now = nowIso_();
    var user = currentUser_();
    var allowedFields = {};
    getMatchingTalentFields_().forEach(function (field) { allowedFields[String(field.valor || '')] = true; });
    var allowedTypes = ['Exclusivo', 'Obrigatório', 'Prioritário', 'Desejável', 'Informativo'];
    var allowedOperators = ['igual', 'diferente', 'contem', 'nao_contem', 'intersecao_lista', 'maior_igual', 'menor_igual', 'entre', 'vazio', 'nao_vazio'];
    var newRows = criterios.map(function (criterion) {
      requireFields_(criterion, ['criterio_nome', 'campo_talento', 'tipo_regra', 'operador'], 'Critério');
      if (!allowedFields[String(criterion.campo_talento || '')]) {
        throw new Error('Campo de talento não permitido no matching: ' + criterion.campo_talento);
      }
      assertEnum_(criterion.tipo_regra, allowedTypes, 'tipo_regra', false);
      assertEnum_(criterion.operador, allowedOperators, 'operador', false);
      assertNonNegativeNumber_(criterion.peso_override, 'peso_override', true);
      return {
        vaga_criterio_id: criterion.vaga_criterio_id || generateId_('CRT_'),
        vaga_id: vagaId,
        criterio_nome: criterion.criterio_nome,
        campo_talento: criterion.campo_talento,
        tipo_regra: criterion.tipo_regra,
        operador: criterion.operador,
        valor_esperado: criterion.valor_esperado || '',
        peso_override: criterion.peso_override || '',
        ativo: valueIsBlank_(criterion.ativo) ? 'SIM' : criterion.ativo,
        observacao: criterion.observacao || '',
        criado_em: criterion.criado_em || now,
        criado_por: criterion.criado_por || user,
        atualizado_em: now,
        atualizado_por: user
      };
    });
    try {
      replaceSheetRows_('TH_VAGA_CRITERIOS', all.concat(newRows));
      invalidateMatchingRuns_(function (run) {
        return String(run.vaga_id || '') === String(vagaId);
      }, 'Critérios da vaga alterados. Execute o matchmaking novamente.');
    } catch (error) {
      var rollbackMessage = '';
      try {
        replaceSheetRows_('TH_VAGA_CRITERIOS', allBefore);
        rollbackMessage = ' A operação foi revertida.';
      } catch (rollbackError) {
        rollbackMessage = ' A reversão também falhou: ' + rollbackError.message + '.';
      }
      throw new Error('Não foi possível salvar os critérios da vaga.' + rollbackMessage + ' Motivo: ' + error.message);
    }
    writeAuditLog_('UPDATE', 'VAGA_CRITERIOS', vagaId, '', '', 'WEB_APP', newRows.length + ' critérios salvos');
    return serializeForClient_(newRows);
  });
}
