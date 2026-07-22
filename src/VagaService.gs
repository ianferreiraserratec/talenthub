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
  validateVaga_(clean);

  return withScriptLock_(function () {
    var now = nowIso_();
    var user = currentUser_();
    clean.vaga_id = generateId_('VAG_');
    clean.status_vaga = clean.status_vaga || 'Rascunho';
    clean.qtd_posicoes = clean.qtd_posicoes || 1;
    clean.qtd_perfis_enviados = clean.qtd_perfis_enviados || 0;
    clean.rodada_atual = clean.rodada_atual || 1;
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
    var result = updateObjectById_('TH_VAGAS', 'vaga_id', vagaId, clean, allowed);
    writeEntityAudit_('UPDATE', 'VAGA', vagaId, result.before, result.after, 'WEB_APP');
    if (result.before.status_vaga !== result.after.status_vaga) {
      writeEvent_('Status da vaga alterado', 'VAGA', vagaId, { vaga_id: vagaId, cliente_id: result.after.cliente_id }, result.after.titulo_vaga, result.before.status_vaga, result.after.status_vaga);
    }
    regenerateDashboard_();
    return serializeForClient_(result.after);
  });
}

function validateVaga_(job) {
  if (job.status_vaga) assertEnum_(job.status_vaga, ['Rascunho', 'Briefing recebido', 'Validando pool', 'Aberta', 'Shortlist enviada', 'Em processo', 'Preenchida', 'Encerrada sem contratação', 'Cancelada'], 'status_vaga', true);
  ['qtd_posicoes', 'faixa_salarial_min', 'faixa_salarial_max', 'qtd_perfis_previstos'].forEach(function (field) {
    assertNonNegativeNumber_(job[field], field, true);
  });
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
    var all = getSheetObjects_('TH_VAGA_CRITERIOS', { raw: true }).filter(function (row) {
      return String(row.vaga_id || '') !== String(vagaId);
    });
    var now = nowIso_();
    var user = currentUser_();
    var newRows = criterios.map(function (criterion) {
      requireFields_(criterion, ['criterio_nome', 'campo_talento', 'tipo_regra', 'operador'], 'Critério');
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
    replaceSheetRows_('TH_VAGA_CRITERIOS', all.concat(newRows));
    writeAuditLog_('UPDATE', 'VAGA_CRITERIOS', vagaId, '', '', 'WEB_APP', newRows.length + ' critérios salvos');
    return serializeForClient_(newRows);
  });
}
