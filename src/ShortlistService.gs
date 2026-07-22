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
      processo: process,
      contratacao: hiresByProcess[String(item.processo_id || '')] || null
    });
  });
  items.sort(function (a, b) { return Number(a.ordem_recomendacao || 0) - Number(b.ordem_recomendacao || 0); });
  return serializeForClient_({ shortlist: shortlist, vaga: job, cliente: client, itens: items });
}

function createShortlistFromResults(vagaId, resultIds, payload) {
  payload = payload || {};
  resultIds = Array.isArray(resultIds) ? resultIds.map(String).filter(Boolean) : [];
  if (!resultIds.length) throw new Error('Selecione pelo menos um talento para criar a shortlist.');
  var job = getObjectById_('TH_VAGAS', 'vaga_id', vagaId, { raw: true });
  if (!job) throw new Error('Vaga não encontrada: ' + vagaId);
  if (['Preenchida', 'Encerrada sem contratação', 'Cancelada'].indexOf(String(job.status_vaga || '')) !== -1) {
    throw new Error('Não é possível criar shortlist para uma vaga encerrada.');
  }

  return withScriptLock_(function () {
    var resultsById = indexBy_('TH_MATCHING_RESULTADOS', 'resultado_id');
    var selected = resultIds.map(function (id) {
      var result = resultsById[id];
      if (!result || String(result.vaga_id || '') !== String(vagaId)) {
        throw new Error('Resultado de matching inválido para esta vaga: ' + id);
      }
      if (String(result.status_resultado || '') === 'Selecionado para shortlist') {
        throw new Error('O talento ' + result.pessoa_id + ' já foi selecionado para uma shortlist.');
      }
      return result;
    });
    var peopleSeen = {};
    selected.forEach(function (result) {
      var personId = String(result.pessoa_id || '');
      if (!personId || peopleSeen[personId]) throw new Error('A seleção contém talentos duplicados ou sem pessoa_id.');
      peopleSeen[personId] = true;
    });

    var existingProcesses = getSheetObjects_('TH_PROCESSOS', { raw: true });
    selected.forEach(function (result) {
      var hasActiveDuplicate = existingProcesses.some(function (process) {
        return String(process.vaga_id || '') === String(vagaId) &&
          String(process.pessoa_id || '') === String(result.pessoa_id || '') &&
          isActiveProcessStatus_(process.status_processo);
      });
      if (hasActiveDuplicate) throw new Error('Já existe processo ativo desta pessoa para a vaga: ' + result.pessoa_id);
    });

    var now = nowIso_();
    var user = currentUser_();
    var shortlistId = generateId_('SHT_');
    var round = Number(payload.rodada || job.rodada_atual || 1);
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
    appendObject_('TH_SHORTLISTS', shortlist);

    var processRows = [];
    var itemRows = [];
    selected.forEach(function (result, index) {
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
        origem: 'Matchmaking',
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
        score_total: result.score_total,
        justificativa_match: result.justificativa,
        status_item: 'Incluído',
        observacao_curadoria: '',
        criado_em: now,
        criado_por: user,
        atualizado_em: now,
        atualizado_por: user
      };
      appendObject_('TH_PROCESSOS', process);
      appendObject_('TH_SHORTLIST_ITENS', item);
      updateObjectById_('TH_MATCHING_RESULTADOS', 'resultado_id', result.resultado_id, { status_resultado: 'Selecionado para shortlist' });
      processRows.push(process);
      itemRows.push(item);
    });

    updateObjectById_('TH_VAGAS', 'vaga_id', vagaId, {
      status_vaga: 'Em processo',
      rodada_atual: Math.max(Number(job.rodada_atual || 1), round),
      atualizado_em: now,
      atualizado_por: user
    });
    writeEntityAudit_('CREATE', 'SHORTLIST', shortlistId, {}, shortlist, 'WEB_APP');
    writeEvent_('Shortlist criada', 'SHORTLIST', shortlistId, {
      vaga_id: vagaId,
      cliente_id: job.cliente_id,
      shortlist_id: shortlistId
    }, selected.length + ' talentos incluídos');
    regenerateTalentView_();
    regenerateDashboard_();
    return serializeForClient_({ shortlist: shortlist, processos: processRows, itens: itemRows });
  });
}

function updateShortlistStatus(shortlistId, newStatus, payload) {
  payload = payload || {};
  assertEnum_(newStatus, ['Em montagem', 'Enviada', 'Em análise pela empresa', 'Concluída', 'Cancelada'], 'status_shortlist', false);
  return withScriptLock_(function () {
    var shortlist = getObjectById_('TH_SHORTLISTS', 'shortlist_id', shortlistId, { raw: true });
    if (!shortlist) throw new Error('Shortlist não encontrada: ' + shortlistId);
    var now = nowIso_();
    var user = currentUser_();
    var patch = {
      status_shortlist: newStatus,
      observacoes: Object.prototype.hasOwnProperty.call(payload, 'observacoes') ? payload.observacoes : shortlist.observacoes,
      atualizado_em: now,
      atualizado_por: user
    };
    if (newStatus === 'Enviada' && valueIsBlank_(shortlist.enviada_em)) {
      patch.enviada_em = payload.enviada_em || now;
      patch.enviada_por = user;
    }
    var result = updateObjectById_('TH_SHORTLISTS', 'shortlist_id', shortlistId, patch);
    cascadeShortlistStatus_(shortlist, newStatus, payload, now, user);
    writeEntityAudit_('UPDATE', 'SHORTLIST', shortlistId, result.before, result.after, 'WEB_APP');
    writeEvent_('Status da shortlist alterado', 'SHORTLIST', shortlistId, {
      vaga_id: shortlist.vaga_id,
      cliente_id: shortlist.cliente_id,
      shortlist_id: shortlistId
    }, result.after.titulo_shortlist, result.before.status_shortlist, newStatus);
    regenerateTalentView_();
    regenerateDashboard_();
    return getShortlistDetails(shortlistId);
  });
}

function cascadeShortlistStatus_(shortlist, newStatus, payload, now, user) {
  var items = getSheetObjects_('TH_SHORTLIST_ITENS', { raw: true }).filter(function (item) {
    return String(item.shortlist_id || '') === String(shortlist.shortlist_id || '');
  });
  items.forEach(function (item) {
    var process = getObjectById_('TH_PROCESSOS', 'processo_id', item.processo_id, { raw: true });
    if (!process || isTerminalProcessStatus_(process.status_processo)) return;
    var processPatch = { atualizado_em: now, atualizado_por: user };
    var itemPatch = { atualizado_em: now, atualizado_por: user };
    if (newStatus === 'Enviada') {
      processPatch.status_processo = 'Enviado à empresa';
      processPatch.data_envio_empresa = payload.enviada_em || now;
      itemPatch.status_item = 'Enviado';
    } else if (newStatus === 'Em análise pela empresa') {
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
    if (processPatch.status_processo) updateObjectById_('TH_PROCESSOS', 'processo_id', process.processo_id, processPatch);
    if (itemPatch.status_item) updateObjectById_('TH_SHORTLIST_ITENS', 'shortlist_item_id', item.shortlist_item_id, itemPatch);
  });

  var jobStatus = '';
  if (newStatus === 'Enviada') jobStatus = 'Shortlist enviada';
  else if (newStatus === 'Em análise pela empresa') jobStatus = 'Em processo';
  if (jobStatus) {
    updateObjectById_('TH_VAGAS', 'vaga_id', shortlist.vaga_id, {
      status_vaga: jobStatus,
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
    var process = getObjectById_('TH_PROCESSOS', 'processo_id', item.processo_id, { raw: true });
    if (process && String(process.status_processo || '') === 'Contratado') {
      throw new Error('Um talento contratado não pode ser removido da shortlist.');
    }
    var now = nowIso_();
    var user = currentUser_();
    updateObjectById_('TH_SHORTLIST_ITENS', 'shortlist_item_id', shortlistItemId, {
      status_item: 'Removido',
      observacao_curadoria: payload.motivo || item.observacao_curadoria || '',
      atualizado_em: now,
      atualizado_por: user
    });
    if (process && !isTerminalProcessStatus_(process.status_processo)) {
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
    writeAuditLog_('UPDATE', 'SHORTLIST_ITEM', shortlistItemId, 'status_item', item.status_item, 'WEB_APP', payload.motivo || '', 'Removido');
    writeEvent_('Candidato liberado', 'PROCESSO', item.processo_id, item, payload.motivo || 'Removido da shortlist', process && process.status_processo, 'Liberado');
    regenerateTalentView_();
    regenerateDashboard_();
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
