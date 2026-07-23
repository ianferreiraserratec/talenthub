function getShortlists(filters) {
  filters = filters || {};
  var search = normalizeText_(filters.search || '');
  var status = String(filters.status || '').trim();
  var vagaId = String(filters.vaga_id || '').trim();
  var jobs = indexBy_('TH_VAGAS', 'vaga_id');
  var clients = indexBy_('TH_CLIENTES', 'cliente_id');
  var items = getSheetObjects_('TH_SHORTLIST_ITENS', { raw: true });
  var processes = getSheetObjects_('TH_PROCESSOS', { raw: true });

  var rows = getSheetObjects_('TH_SHORTLISTS', { raw: true }).filter(function (shortlist) {
    if (status && status !== 'Todos' && String(shortlist.status_shortlist || '') !== status) return false;
    if (vagaId && String(shortlist.vaga_id || '') !== vagaId) return false;
    var job = jobs[String(shortlist.vaga_id || '')] || {};
    var client = clients[String(shortlist.cliente_id || '')] || {};
    if (search && normalizeText_([
      shortlist.titulo_shortlist,
      job.titulo_vaga,
      client.nome_empresa,
      shortlist.status_shortlist
    ].join(' ')).indexOf(search) === -1) return false;
    return true;
  }).map(function (shortlist) {
    var shortlistId = String(shortlist.shortlist_id || '');
    var job = jobs[String(shortlist.vaga_id || '')] || {};
    var client = clients[String(shortlist.cliente_id || '')] || {};
    var shortlistItems = items.filter(function (item) { return String(item.shortlist_id || '') === shortlistId; });
    var processIds = {};
    shortlistItems.forEach(function (item) { processIds[String(item.processo_id || '')] = true; });
    var shortlistProcesses = processes.filter(function (process) { return !!processIds[String(process.processo_id || '')]; });
    return Object.assign({}, shortlist, {
      titulo_vaga: job.titulo_vaga || '',
      nome_empresa: client.nome_empresa || '',
      qtd_candidatos: shortlistItems.filter(function (item) { return String(item.status_item || '') !== 'Removido'; }).length,
      qtd_contratados: shortlistProcesses.filter(function (process) { return String(process.status_processo || '') === 'Contratado'; }).length,
      qtd_processos_ativos: shortlistProcesses.filter(function (process) { return isActiveProcessStatus_(process.status_processo); }).length
    });
  });
  rows.sort(function (a, b) { return String(b.criada_em || '').localeCompare(String(a.criada_em || '')); });
  return serializeForClient_(rows);
}

function getShortlistDetails(shortlistId) {
  var shortlist = getObjectById_('TH_SHORTLISTS', 'shortlist_id', shortlistId, { raw: true });
  if (!shortlist) throw new Error('Shortlist não encontrada: ' + shortlistId);
  var job = getObjectById_('TH_VAGAS', 'vaga_id', shortlist.vaga_id, { raw: true }) || {};
  var client = getObjectById_('TH_CLIENTES', 'cliente_id', shortlist.cliente_id, { raw: true }) || {};
  var talents = indexBy_('VW_TALENTOS_APTOS', 'pessoa_id');
  var processes = indexBy_('TH_PROCESSOS', 'processo_id');
  var hiresByProcess = {};
  getSheetObjects_('TH_CONTRATACOES', { raw: true }).forEach(function (hire) {
    hiresByProcess[String(hire.processo_id || '')] = hire;
  });

  var items = getSheetObjects_('TH_SHORTLIST_ITENS', { raw: true }).filter(function (item) {
    return String(item.shortlist_id || '') === String(shortlistId);
  }).map(function (item) {
    var talent = talents[String(item.pessoa_id || '')] || {};
    var process = processes[String(item.processo_id || '')] || {};
    return Object.assign({}, item, {
      nome: talent.nome || '',
      email: talent.email || talent.email_serratec || '',
      celular: talent.celular || '',
      cidade: talent.cidade || '',
      uf: talent.uf || '',
      area_interesse_principal: talent.area_interesse_principal || '',
      senioridade: talent.senioridade || '',
      principais_competencias: talent.principais_competencias || '',
      curriculo: talent.curriculo || '',
      linkedin: talent.linkedin || '',
      processo: Object.assign({}, process, {
        transicoes_permitidas: getAllowedProcessTransitions_(process.status_processo)
      }),
      contratacao: hiresByProcess[String(item.processo_id || '')] || null
    });
  });
  items.sort(function (a, b) { return Number(a.ordem_recomendacao || 0) - Number(b.ordem_recomendacao || 0); });
  return serializeForClient_({
    shortlist: Object.assign({}, shortlist, {
      transicoes_permitidas: getAllowedShortlistTransitions_(shortlist.status_shortlist)
    }),
    vaga: job,
    cliente: client,
    itens: items
  });
}

function createShortlistFromResults(vagaId, resultIds, payload) {
  payload = payload || {};
  resultIds = Array.isArray(resultIds) ? resultIds.map(String).filter(Boolean) : [];
  if (!resultIds.length) throw new Error('Selecione pelo menos um talento para criar a shortlist.');
  var job;

  return withScriptLock_(function () {
    job = getObjectById_('TH_VAGAS', 'vaga_id', vagaId, { raw: true });
    if (!job) throw new Error('Vaga não encontrada: ' + vagaId);
    if (['Preenchida', 'Encerrada sem contratação', 'Cancelada'].indexOf(String(job.status_vaga || '')) !== -1) {
      throw new Error('Não é possível criar shortlist para uma vaga encerrada.');
    }
    var resultsById = indexBy_('TH_MATCHING_RESULTADOS', 'resultado_id');
    var selected = resultIds.map(function (id) {
      var result = resultsById[id];
      if (!result || String(result.vaga_id || '') !== String(vagaId)) {
        throw new Error('Resultado de matching inválido para esta vaga: ' + id);
      }
      if (String(result.status_resultado || '') === 'Selecionado para shortlist') {
        throw new Error('O talento ' + result.pessoa_id + ' já foi selecionado para uma shortlist.');
      }
      if (['Recomendado', 'Descartado'].indexOf(String(result.status_resultado || '')) === -1) {
        throw new Error('O resultado selecionado não está disponível para curadoria.');
      }
      return Object.assign({}, result, {
        _status_resultado_anterior: result.status_resultado
      });
    });
    var peopleSeen = {};
    selected.forEach(function (result) {
      var personId = String(result.pessoa_id || '');
      if (!personId || peopleSeen[personId]) throw new Error('A seleção contém talentos duplicados ou sem pessoa_id.');
      if (!valueIsBlank_(result.criterios_exclusao)) throw new Error('O talento ' + personId + ' foi eliminado por critério obrigatório e não pode entrar na shortlist.');
      peopleSeen[personId] = true;
    });
    var runIds = {};
    selected.forEach(function (result) { runIds[String(result.run_id || '')] = true; });
    if (Object.keys(runIds).length !== 1 || Object.keys(runIds)[0] === '') {
      throw new Error('Todos os talentos da shortlist devem vir da mesma execução de matchmaking.');
    }

    var selectedRunId = Object.keys(runIds)[0];
    var matchingRun = getObjectById_('TH_MATCHING_RUNS', 'run_id', selectedRunId, { raw: true });
    if (!matchingRun || String(matchingRun.vaga_id || '') !== String(vagaId) ||
      String(matchingRun.status_run || '') !== 'Concluído') {
      throw new Error('A execução de matchmaking não está concluída ou não pertence a esta vaga.');
    }

    var talentViews = indexBy_('VW_TALENTOS_APTOS', 'pessoa_id');
    var people = indexBy_('TH_CACHE_PESSOAS', 'pessoa_id');
    var terms = indexLatestBy_('TALENT_HUB_STATUS_TERMO', 'pessoa_id', 'atualizado_em');
    var config = getConfigMap_();
    var validDays = Number(config.DIAS_CADASTRO_VALIDO || 90);
    var validTerm = normalizeText_(config.TERMO_STATUS_VALIDO || 'ATIVO');
    var currentModel = getObjectById_('TH_MATCHING_MODELOS', 'modelo_id', matchingRun.modelo_id, { raw: true });
    if (!currentModel) throw new Error('O modelo usado na execução não está mais disponível.');
    var currentModelCriteria = getSheetObjects_('TH_MATCHING_MODELO_CRITERIOS', { raw: true }).filter(function (criterion) {
      return String(criterion.modelo_id || '') === String(matchingRun.modelo_id || '') &&
        normalizeBoolean_(criterion.ativo) !== false &&
        !isSensitiveMatchingField_(criterion.campo_talento);
    });
    var currentVacancyCriteria = getSheetObjects_('TH_VAGA_CRITERIOS', { raw: true }).filter(function (criterion) {
      return String(criterion.vaga_id || '') === String(vagaId) &&
        normalizeBoolean_(criterion.ativo) !== false;
    });
    selected.forEach(function (result) {
      var personId = String(result.pessoa_id || '');
      var person = people[personId];
      var term = terms[personId] || {};
      var talentView = talentViews[personId] || {};
      assertTalentReadyForShortlist_(personId, talentView, person, term, validTerm, validDays);
      var currentEvaluation = evaluateTalentForJob_(talentView, job, currentModelCriteria, currentVacancyCriteria, currentModel);
      if (currentEvaluation.eliminado) {
        throw new Error(
          'O talento ' + personId + ' não atende aos critérios eliminatórios atuais da vaga: ' +
          currentEvaluation.criterios_exclusao.join(', ') + '. Rode o matchmaking novamente.'
        );
      }
      result._current_evaluation = currentEvaluation;
      var blocking = getBlockingTalentEngagement_(result.pessoa_id);
      if (blocking) {
        throw new Error(
          'O talento ' + result.pessoa_id + ' não está mais disponível: ' + blocking.message +
          '. Atualize o banco de talentos e rode o matchmaking novamente.'
        );
      }
    });

    var now = nowIso_();
    var user = currentUser_();
    var shortlistId = generateId_('SHT_');
    var existingShortlists = getSheetObjects_('TH_SHORTLISTS', { raw: true }).filter(function (shortlist) {
      return String(shortlist.vaga_id || '') === String(vagaId);
    });
    var nextRound = existingShortlists.length
      ? Math.max.apply(null, existingShortlists.map(function (shortlist) { return Number(shortlist.rodada || 0); })) + 1
      : 1;
    var round = valueIsBlank_(payload.rodada) ? nextRound : Number(payload.rodada);
    if (!Number.isInteger(round) || round < 1) throw new Error('A rodada da shortlist deve ser um número inteiro positivo.');
    if (existingShortlists.some(function (shortlist) { return Number(shortlist.rodada) === round; })) {
      throw new Error('Já existe uma shortlist para a rodada ' + round + ' desta vaga.');
    }
    var shortlist = {
      shortlist_id: shortlistId,
      vaga_id: vagaId,
      cliente_id: job.cliente_id,
      rodada: round,
      titulo_shortlist: String(payload.titulo_shortlist || ('Shortlist — ' + job.titulo_vaga + ' — rodada ' + round)).trim(),
      status_shortlist: 'Em montagem',
      criada_em: now,
      criada_por: user,
      enviada_em: '',
      enviada_por: '',
      qtd_candidatos: selected.length,
      observacoes: payload.observacoes || '',
      atualizado_em: now,
      atualizado_por: user
    };

    var processRows = [];
    var itemRows = [];
    selected.forEach(function (result, index) {
      var currentEvaluation = result._current_evaluation || result;
      var processId = generateId_('PRO_');
      var process = {
        processo_id: processId,
        vaga_id: vagaId,
        cliente_id: job.cliente_id,
        pessoa_id: result.pessoa_id,
        run_id: result.run_id,
        resultado_id: result.resultado_id,
        shortlist_id: shortlistId,
        rodada: round,
        origem: String(result.recomendado || '') === 'SIM' ? 'Matchmaking' : 'Manual',
        status_processo: 'Pré-selecionado',
        data_inclusao_processo: now,
        responsavel: payload.responsavel || user,
        criado_em: now,
        criado_por: user,
        atualizado_em: now,
        atualizado_por: user
      };
      var item = {
        shortlist_item_id: generateId_('SHI_'),
        shortlist_id: shortlistId,
        processo_id: processId,
        vaga_id: vagaId,
        cliente_id: job.cliente_id,
        pessoa_id: result.pessoa_id,
        ordem_recomendacao: index + 1,
        score_total: currentEvaluation.score_total,
        justificativa_match: currentEvaluation.justificativa,
        status_item: 'Incluído',
        observacao_curadoria: '',
        criado_em: now,
        criado_por: user,
        atualizado_em: now,
        atualizado_por: user
      };
      processRows.push(process);
      itemRows.push(item);
    });
    try {
      appendObject_('TH_SHORTLISTS', shortlist);
      appendObjects_('TH_PROCESSOS', processRows);
      appendObjects_('TH_SHORTLIST_ITENS', itemRows);
      selected.forEach(function (result) {
        updateObjectById_('TH_MATCHING_RESULTADOS', 'resultado_id', result.resultado_id, { status_resultado: 'Selecionado para shortlist' });
      });
      updateObjectById_('TH_VAGAS', 'vaga_id', vagaId, {
        status_vaga: 'Em processo',
        rodada_atual: Math.max(Number(job.rodada_atual || 1), round),
        atualizado_em: now,
        atualizado_por: user
      });
    } catch (error) {
      var compensation = compensateShortlistCreation_(shortlist, processRows, itemRows, selected, error, now, user);
      var compensationMessage = compensation.ok
        ? ' A operação foi compensada.'
        : ' A compensação também falhou: ' + compensation.error + '.';
      throw new Error('Não foi possível concluir a shortlist.' + compensationMessage + ' Motivo: ' + error.message);
    }
    writeEntityAudit_('CREATE', 'SHORTLIST', shortlistId, {}, shortlist, 'WEB_APP');
    writeEvent_('Shortlist criada', 'SHORTLIST', shortlistId, {
      vaga_id: vagaId,
      cliente_id: job.cliente_id,
      shortlist_id: shortlistId
    }, selected.length + ' talentos incluídos');
    refreshOperationalViewsSafely_();
    return serializeForClient_({ shortlist: shortlist, processos: processRows, itens: itemRows });
  });
}

function assertTalentReadyForShortlist_(personId, talentView, person, term, validTerm, validDays) {
  if (!person || normalizeText_((term || {}).status) !== validTerm ||
    !isDateWithinDays_(person.atualizado_em, validDays)) {
    throw new Error('O talento ' + personId + ' não está mais apto ao Talent Hub. Atualize a base e rode o matchmaking novamente.');
  }
  if (String((talentView || {}).status_pool || '') !== 'Disponível') {
    throw new Error('O talento ' + personId + ' não está mais disponível para uma nova oportunidade.');
  }
  return true;
}

function compensateShortlistCreation_(shortlist, processRows, itemRows, selectedResults, originalError, now, user) {
  var reason = 'Falha durante a criação da shortlist: ' + String((originalError || {}).message || originalError || 'erro desconhecido');
  var operationLogs = createOperationalLogBuffer_();
  try {
    var savedShortlist = getObjectById_('TH_SHORTLISTS', 'shortlist_id', shortlist.shortlist_id, { raw: true });
    if (savedShortlist) {
      updateObjectById_('TH_SHORTLISTS', 'shortlist_id', shortlist.shortlist_id, {
        status_shortlist: 'Cancelada',
        observacoes: reason,
        atualizado_em: now,
        atualizado_por: user
      });
    }
    (processRows || []).forEach(function (process) {
      if (!getObjectById_('TH_PROCESSOS', 'processo_id', process.processo_id, { raw: true })) return;
      updateObjectById_('TH_PROCESSOS', 'processo_id', process.processo_id, {
        status_processo: 'Liberado',
        resultado_final: 'Liberado',
        data_resultado: now,
        data_liberacao: now,
        motivo_recusa_ou_liberacao: reason,
        atualizado_em: now,
        atualizado_por: user
      });
    });
    (itemRows || []).forEach(function (item) {
      if (!getObjectById_('TH_SHORTLIST_ITENS', 'shortlist_item_id', item.shortlist_item_id, { raw: true })) return;
      updateObjectById_('TH_SHORTLIST_ITENS', 'shortlist_item_id', item.shortlist_item_id, {
        status_item: 'Removido',
        observacao_curadoria: reason,
        atualizado_em: now,
        atualizado_por: user
      });
    });
    (selectedResults || []).forEach(function (result) {
      var savedResult = getObjectById_('TH_MATCHING_RESULTADOS', 'resultado_id', result.resultado_id, { raw: true });
      if (savedResult && String(savedResult.status_resultado || '') === 'Selecionado para shortlist') {
        updateObjectById_('TH_MATCHING_RESULTADOS', 'resultado_id', result.resultado_id, {
          status_resultado: result._status_resultado_anterior || result.status_resultado
        });
      }
    });
    updateVacancyFromProcesses_(shortlist.vaga_id, now, user, operationLogs);
    flushOperationalLogs_(operationLogs);
    writeAuditLog_('UPDATE', 'SHORTLIST', shortlist.shortlist_id, 'status_shortlist', 'Em montagem', 'SISTEMA', reason, 'Cancelada');
    return { ok: true };
  } catch (compensationError) {
    writeAuditLog_('UPDATE', 'SHORTLIST', shortlist.shortlist_id, '', '', 'SISTEMA',
      reason + ' | Falha também na compensação: ' + compensationError.message);
    return { ok: false, error: compensationError.message };
  }
}

function updateShortlistStatus(shortlistId, newStatus, payload) {
  payload = payload || {};
  assertEnum_(newStatus, ['Em montagem', 'Enviada', 'Em análise pela empresa', 'Concluída', 'Cancelada'], 'status_shortlist', false);
  return withScriptLock_(function () {
    var shortlist = getObjectById_('TH_SHORTLISTS', 'shortlist_id', shortlistId, { raw: true });
    if (!shortlist) throw new Error('Shortlist não encontrada: ' + shortlistId);
    assertShortlistTransitionAllowed_(shortlist.status_shortlist, newStatus);
    var shortlistProcesses = getSheetObjects_('TH_PROCESSOS', { raw: true }).filter(function (process) {
      return String(process.shortlist_id || '') === String(shortlistId);
    });
    assertShortlistClosureAllowed_(newStatus, shortlistProcesses);
    var now = nowIso_();
    var user = currentUser_();
    var patch = {
      status_shortlist: newStatus,
      observacoes: Object.prototype.hasOwnProperty.call(payload, 'observacoes') ? payload.observacoes : shortlist.observacoes,
      atualizado_em: now,
      atualizado_por: user
    };
    if (['Enviada', 'Em análise pela empresa'].indexOf(newStatus) !== -1 && valueIsBlank_(shortlist.enviada_em)) {
      patch.enviada_em = payload.enviada_em || now;
      patch.enviada_por = user;
    }
    var snapshot = captureVacancyOperationSnapshot_(shortlist.vaga_id);
    var operationLogs = createOperationalLogBuffer_();
    var result;
    try {
      result = updateObjectById_('TH_SHORTLISTS', 'shortlist_id', shortlistId, patch);
      cascadeShortlistStatus_(result.after, newStatus, payload, now, user, operationLogs);
      if (['Concluída', 'Cancelada'].indexOf(newStatus) !== -1) {
        updateVacancyFromProcesses_(shortlist.vaga_id, now, user, operationLogs);
      }
    } catch (error) {
      var rollbackMessage = '';
      try {
        restoreVacancyOperationSnapshot_(snapshot);
        rollbackMessage = ' A operação foi revertida integralmente.';
      } catch (rollbackError) {
        rollbackMessage = ' A reversão também falhou: ' + rollbackError.message + '.';
      }
      writeAuditLog_('UPDATE', 'SHORTLIST', shortlistId, 'status_shortlist', shortlist.status_shortlist, 'SISTEMA',
        'Falha ao alterar para ' + newStatus + ': ' + error.message + rollbackMessage, shortlist.status_shortlist);
      throw new Error('Não foi possível atualizar a shortlist.' + rollbackMessage + ' Motivo: ' + error.message);
    }
    flushOperationalLogs_(operationLogs);
    writeEntityAudit_('UPDATE', 'SHORTLIST', shortlistId, result.before, result.after, 'WEB_APP');
    writeEvent_('Status da shortlist alterado', 'SHORTLIST', shortlistId, {
      vaga_id: shortlist.vaga_id,
      cliente_id: shortlist.cliente_id,
      shortlist_id: shortlistId
    }, result.after.titulo_shortlist, result.before.status_shortlist, newStatus);
    refreshOperationalViewsSafely_();
    return getShortlistDetails(shortlistId);
  });
}

function getAllowedShortlistTransitions_(status) {
  var transitions = {
    'Em montagem': ['Enviada', 'Cancelada'],
    Enviada: ['Em análise pela empresa', 'Concluída', 'Cancelada'],
    'Em análise pela empresa': ['Concluída', 'Cancelada'],
    Concluída: [],
    Cancelada: []
  };
  return (transitions[String(status || '')] || []).slice();
}

function assertShortlistTransitionAllowed_(currentStatus, newStatus) {
  currentStatus = String(currentStatus || '');
  if (currentStatus === newStatus) return;
  var allowed = getAllowedShortlistTransitions_(currentStatus);
  if (allowed.indexOf(newStatus) === -1) {
    var guidance = allowed.length ? 'Próximos estados permitidos: ' + allowed.join(', ') + '.' : 'A shortlist já está encerrada.';
    throw new Error('Transição inválida de ' + currentStatus + ' para ' + newStatus + '. ' + guidance);
  }
}

function assertShortlistClosureAllowed_(newStatus, processes) {
  processes = processes || [];
  if (newStatus === 'Cancelada' && processes.some(function (process) {
    return String(process.status_processo || '') === 'Contratado';
  })) {
    throw new Error('Uma shortlist com contratação registrada deve ser concluída, não cancelada.');
  }
  if (newStatus === 'Concluída' && processes.some(function (process) {
    return isActiveProcessStatus_(process.status_processo);
  })) {
    throw new Error('Resolva ou libere todos os processos ativos antes de concluir a shortlist.');
  }
}

function cascadeShortlistStatus_(shortlist, newStatus, payload, now, user, operationLogs) {
  var items = getSheetObjects_('TH_SHORTLIST_ITENS', { raw: true }).filter(function (item) {
    return String(item.shortlist_id || '') === String(shortlist.shortlist_id || '');
  });
  items.forEach(function (item) {
    var process = getObjectById_('TH_PROCESSOS', 'processo_id', item.processo_id, { raw: true });
    if (!process || isTerminalProcessStatus_(process.status_processo)) return;
    var processPatch = { atualizado_em: now, atualizado_por: user };
    var itemPatch = { atualizado_em: now, atualizado_por: user };
    var currentStatus = String(process.status_processo || '');
    var beforeStatus = currentStatus;
    if (newStatus === 'Enviada' && ['Pré-selecionado', 'Aguardando confirmação', 'Bloqueado'].indexOf(currentStatus) !== -1) {
      processPatch.status_processo = 'Enviado à empresa';
      processPatch.data_envio_empresa = payload.enviada_em || now;
      itemPatch.status_item = 'Enviado';
    } else if (newStatus === 'Em análise pela empresa' && ['Pré-selecionado', 'Aguardando confirmação', 'Bloqueado', 'Enviado à empresa'].indexOf(currentStatus) !== -1) {
      processPatch.status_processo = 'Aguardando retorno';
      if (valueIsBlank_(process.data_envio_empresa)) processPatch.data_envio_empresa = shortlist.enviada_em || now;
      itemPatch.status_item = 'Enviado';
    } else if (newStatus === 'Cancelada') {
      processPatch.status_processo = 'Liberado';
      processPatch.resultado_final = 'Liberado';
      processPatch.data_resultado = now;
      processPatch.data_liberacao = now;
      processPatch.motivo_recusa_ou_liberacao = payload.motivo || 'Shortlist cancelada';
      itemPatch.status_item = 'Liberado';
    }
    if (processPatch.status_processo) {
      updateObjectById_('TH_PROCESSOS', 'processo_id', process.processo_id, processPatch);
      queueOperationalAudit_(operationLogs, 'UPDATE', 'PROCESSO', process.processo_id, 'status_processo', beforeStatus, 'WEB_APP', 'Atualização em lote pela shortlist ' + shortlist.shortlist_id, processPatch.status_processo);
      queueOperationalEvent_(operationLogs, 'Status do processo alterado', 'PROCESSO', process.processo_id, process,
        'Atualização em lote pela shortlist ' + shortlist.shortlist_id, beforeStatus, processPatch.status_processo);
    }
    if (itemPatch.status_item) updateObjectById_('TH_SHORTLIST_ITENS', 'shortlist_item_id', item.shortlist_item_id, itemPatch);
  });

  var jobStatus = '';
  if (newStatus === 'Enviada') jobStatus = 'Shortlist enviada';
  else if (newStatus === 'Em análise pela empresa') jobStatus = 'Em processo';
  if (jobStatus) {
    updateObjectById_('TH_VAGAS', 'vaga_id', shortlist.vaga_id, {
      status_vaga: jobStatus,
      qtd_perfis_enviados: countSentProfilesForJob_(shortlist.vaga_id),
      atualizado_em: now,
      atualizado_por: user
    });
  }
}

function removeShortlistItem(shortlistItemId, payload) {
  payload = payload || {};
  return withScriptLock_(function () {
    var item = getObjectById_('TH_SHORTLIST_ITENS', 'shortlist_item_id', shortlistItemId, { raw: true });
    if (!item) throw new Error('Item de shortlist não encontrado: ' + shortlistItemId);
    var shortlist = getObjectById_('TH_SHORTLISTS', 'shortlist_id', item.shortlist_id, { raw: true });
    if (!shortlist) throw new Error('Shortlist não encontrada para o item: ' + shortlistItemId);
    if (['Concluída', 'Cancelada'].indexOf(String(shortlist.status_shortlist || '')) !== -1) {
      throw new Error('Uma shortlist concluída ou cancelada não pode mais ser alterada.');
    }
    if (['Removido', 'Liberado', 'Substituído', 'Contratado'].indexOf(String(item.status_item || '')) !== -1) {
      throw new Error('Este item já está em um estado final e não pode ser removido.');
    }
    var process = getObjectById_('TH_PROCESSOS', 'processo_id', item.processo_id, { raw: true });
    if (process && isTerminalProcessStatus_(process.status_processo)) {
      throw new Error('Um processo encerrado não pode ser removido da shortlist.');
    }
    var now = nowIso_();
    var user = currentUser_();
    var snapshot = captureVacancyOperationSnapshot_(item.vaga_id);
    var operationLogs = createOperationalLogBuffer_();
    try {
      updateObjectById_('TH_SHORTLIST_ITENS', 'shortlist_item_id', shortlistItemId, {
        status_item: 'Removido',
        observacao_curadoria: payload.motivo || item.observacao_curadoria || '',
        atualizado_em: now,
        atualizado_por: user
      });
      if (process) {
        updateObjectById_('TH_PROCESSOS', 'processo_id', process.processo_id, {
          status_processo: 'Liberado',
          resultado_final: 'Liberado',
          data_resultado: now,
          data_liberacao: now,
          motivo_recusa_ou_liberacao: payload.motivo || 'Removido da shortlist',
          atualizado_em: now,
          atualizado_por: user
        });
      }
      recalculateShortlistCount_(item.shortlist_id, now, user);
      updateVacancyFromProcesses_(item.vaga_id, now, user, operationLogs);
    } catch (error) {
      var rollbackMessage = '';
      try {
        restoreVacancyOperationSnapshot_(snapshot);
        rollbackMessage = ' A operação foi revertida integralmente.';
      } catch (rollbackError) {
        rollbackMessage = ' A reversão também falhou: ' + rollbackError.message + '.';
      }
      writeAuditLog_('UPDATE', 'SHORTLIST_ITEM', shortlistItemId, 'status_item', item.status_item, 'SISTEMA',
        'Falha ao remover candidato: ' + error.message + rollbackMessage, item.status_item);
      throw new Error('Não foi possível remover o candidato da shortlist.' + rollbackMessage + ' Motivo: ' + error.message);
    }
    flushOperationalLogs_(operationLogs);
    writeAuditLog_('UPDATE', 'SHORTLIST_ITEM', shortlistItemId, 'status_item', item.status_item, 'WEB_APP', payload.motivo || '', 'Removido');
    writeEvent_('Candidato liberado', 'PROCESSO', item.processo_id, item, payload.motivo || 'Removido da shortlist', process && process.status_processo, 'Liberado');
    refreshOperationalViewsSafely_();
    return getShortlistDetails(item.shortlist_id);
  });
}

function recalculateShortlistCount_(shortlistId, now, user) {
  var count = getSheetObjects_('TH_SHORTLIST_ITENS', { raw: true }).filter(function (item) {
    return String(item.shortlist_id || '') === String(shortlistId) && String(item.status_item || '') !== 'Removido';
  }).length;
  updateObjectById_('TH_SHORTLISTS', 'shortlist_id', shortlistId, {
    qtd_candidatos: count,
    atualizado_em: now || nowIso_(),
    atualizado_por: user || currentUser_()
  });
  return count;
}

function countSentProfilesForJob_(vagaId) {
  return getSheetObjects_('TH_PROCESSOS', { raw: true }).filter(function (process) {
    if (String(process.vaga_id || '') !== String(vagaId)) return false;
    return !valueIsBlank_(process.data_envio_empresa) ||
      ['Enviado à empresa', 'Aguardando retorno', 'Entrevista', 'Proposta', 'Contratado'].indexOf(String(process.status_processo || '')) !== -1;
  }).length;
}
