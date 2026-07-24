function getMvpBootstrap() {
  var state = getDatabaseState_();
  return serializeForClient_({ initialized: state.initialized, missingSheets: state.missingSheets, user: currentUser_(), dashboard: state.initialized ? getDashboard() : null });
}

function mvpGetTalents(filters) {
  filters = filters || {};
  var search = normalizeText_(filters.search || '');
  var status = String(filters.status || 'Todos');
  var rows = getSheetObjects_('VW_TALENTOS_APTOS', { raw: true }).filter(function (row) {
    if (status !== 'Todos' && String(row.status_pool || '') !== status) return false;
    return !search || normalizeText_([row.nome, row.email, row.cidade, row.curso, row.area_interesse_principal, row.principais_competencias].join(' ')).indexOf(search) !== -1;
  }).sort(function (a, b) { return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'); });
  return serializeForClient_(rows);
}

function mvpSaveTalent(payload) {
  payload = payload || {};
  requireFields_(payload, ['pessoa_id'], 'Talento');
  var id = String(payload.pessoa_id).trim();
  if (!getObjectById_('TH_CACHE_PESSOAS', 'pessoa_id', id, { raw: true })) throw new Error('Talento não encontrado na base sincronizada.');
  var fields = getDatabaseSchema_().TH_TALENTOS;
  var clean = sanitizePayload_(payload, fields);
  clean.pessoa_id = id; clean.atualizado_em = nowIso_(); clean.atualizado_por = currentUser_();
  return withScriptLock_(function () {
    var before = getObjectById_('TH_TALENTOS', 'pessoa_id', id, { raw: true });
    if (before) { var result = updateObjectById_('TH_TALENTOS', 'pessoa_id', id, clean); writeEntityAudit_('UPDATE', 'TALENTO', id, result.before, result.after, 'WEB_APP'); }
    else { appendObject_('TH_TALENTOS', clean); writeEntityAudit_('CREATE', 'TALENTO', id, {}, clean, 'WEB_APP'); }
    regenerateTalentView_(); regenerateDashboard_();
    return { ok: true };
  });
}

function mvpGetClients() {
  var jobs = getSheetObjects_('TH_VAGAS', { raw: true });
  var contacts = getSheetObjects_('TH_CLIENTE_CONTATOS', { raw: true });
  return serializeForClient_(getSheetObjects_('TH_CLIENTES', { raw: true }).map(function (client) {
    var id = String(client.cliente_id || '');
    var copy = Object.assign({}, client);
    copy.vagas_abertas = jobs.filter(function (job) { return String(job.cliente_id || '') === id && ['Aberta', 'Em processo'].indexOf(String(job.status_vaga || '')) !== -1; }).length;
    copy.contato_principal = contacts.filter(function (contact) { return String(contact.cliente_id || '') === id && normalizeBoolean_(contact.contato_principal) === true; })[0] || null;
    return copy;
  }));
}

function mvpSaveClient(payload) {
  payload = payload || {}; requireFields_(payload, ['nome_empresa'], 'Cliente');
  var fields = getDatabaseSchema_().TH_CLIENTES;
  var clean = sanitizePayload_(payload, fields); clean.atualizado_em = nowIso_(); clean.atualizado_por = currentUser_(); clean.status_cliente = clean.status_cliente || 'Prospect';
  assertEnum_(clean.status_cliente, ['Prospect', 'Ativo', 'Inativo'], 'status_cliente', false);
  return withScriptLock_(function () {
    if (clean.cliente_id) {
      var result = updateObjectById_('TH_CLIENTES', 'cliente_id', clean.cliente_id, clean); writeEntityAudit_('UPDATE', 'CLIENTE', clean.cliente_id, result.before, result.after, 'WEB_APP');
    } else {
      clean.cliente_id = generateId_('CLI_'); clean.criado_em = clean.atualizado_em; clean.criado_por = clean.atualizado_por; appendObject_('TH_CLIENTES', clean); writeEntityAudit_('CREATE', 'CLIENTE', clean.cliente_id, {}, clean, 'WEB_APP');
    }
    regenerateDashboard_(); return serializeForClient_(clean);
  });
}

function mvpSaveContact(clienteId, payload) {
  if (!getObjectById_('TH_CLIENTES', 'cliente_id', clienteId, { raw: true })) throw new Error('Cliente não encontrado.');
  payload = payload || {}; requireFields_(payload, ['nome'], 'Contato');
  var clean = sanitizePayload_(payload, getDatabaseSchema_().TH_CLIENTE_CONTATOS); clean.cliente_id = clienteId; clean.atualizado_em = nowIso_(); clean.atualizado_por = currentUser_();
  if (clean.contato_id) return updateObjectById_('TH_CLIENTE_CONTATOS', 'contato_id', clean.contato_id, clean).after;
  clean.contato_id = generateId_('CTO_'); clean.criado_em = clean.atualizado_em; clean.criado_por = clean.atualizado_por; clean.ativo = clean.ativo || 'SIM'; appendObject_('TH_CLIENTE_CONTATOS', clean); writeEntityAudit_('CREATE', 'CONTATO', clean.contato_id, {}, clean, 'WEB_APP'); return clean;
}

function mvpGetJobs() {
  var clients = indexBy_('TH_CLIENTES', 'cliente_id');
  var indications = getSheetObjects_('TH_INDICACOES', { raw: true });
  return serializeForClient_(getSheetObjects_('TH_VAGAS', { raw: true }).map(function (job) {
    var copy = Object.assign({}, job); copy.nome_empresa = (clients[String(job.cliente_id || '')] || {}).nome_empresa || '';
    copy.indicacoes_ativas = indications.filter(function (item) { return String(item.vaga_id || '') === String(job.vaga_id || '') && ['Em análise', 'Enviado', 'Entrevista'].indexOf(String(item.status_indicacao || '')) !== -1; }).length;
    return copy;
  }));
}

function mvpSaveJob(payload) {
  payload = payload || {}; requireFields_(payload, ['cliente_id', 'titulo_vaga'], 'Vaga');
  if (!getObjectById_('TH_CLIENTES', 'cliente_id', payload.cliente_id, { raw: true })) throw new Error('Cliente não encontrado.');
  var clean = sanitizePayload_(payload, getDatabaseSchema_().TH_VAGAS);
  clean.qtd_posicoes = Number(clean.qtd_posicoes || 1); if (clean.qtd_posicoes < 1) throw new Error('Informe ao menos uma posição.');
  clean.status_vaga = clean.status_vaga || 'Rascunho'; assertEnum_(clean.status_vaga, ['Rascunho', 'Aberta', 'Em processo', 'Preenchida', 'Encerrada', 'Cancelada'], 'status_vaga', false);
  clean.atualizado_em = nowIso_(); clean.atualizado_por = currentUser_();
  return withScriptLock_(function () {
    if (clean.vaga_id) { var result = updateObjectById_('TH_VAGAS', 'vaga_id', clean.vaga_id, clean); writeEntityAudit_('UPDATE', 'VAGA', clean.vaga_id, result.before, result.after, 'WEB_APP'); }
    else { clean.vaga_id = generateId_('VAG_'); clean.criado_em = clean.atualizado_em; clean.criado_por = clean.atualizado_por; appendObject_('TH_VAGAS', clean); writeEntityAudit_('CREATE', 'VAGA', clean.vaga_id, {}, clean, 'WEB_APP'); }
    regenerateDashboard_(); return serializeForClient_(clean);
  });
}

function mvpGetIndications() {
  var talents = indexBy_('VW_TALENTOS_APTOS', 'pessoa_id'); var jobs = indexBy_('TH_VAGAS', 'vaga_id'); var clients = indexBy_('TH_CLIENTES', 'cliente_id');
  return serializeForClient_(getSheetObjects_('TH_INDICACOES', { raw: true }).map(function (item) {
    var copy = Object.assign({}, item); copy.nome_talento = (talents[String(item.pessoa_id || '')] || {}).nome || ''; copy.titulo_vaga = (jobs[String(item.vaga_id || '')] || {}).titulo_vaga || ''; copy.nome_empresa = (clients[String(item.cliente_id || '')] || {}).nome_empresa || ''; return copy;
  }).sort(function (a, b) { return String(b.criado_em || '').localeCompare(String(a.criado_em || '')); }));
}

function mvpCreateIndication(payload) {
  payload = payload || {}; requireFields_(payload, ['vaga_id', 'pessoa_id'], 'Indicação');
  return withScriptLock_(function () {
    var job = getObjectById_('TH_VAGAS', 'vaga_id', payload.vaga_id, { raw: true });
    var talent = getObjectById_('VW_TALENTOS_APTOS', 'pessoa_id', payload.pessoa_id, { raw: true });
    if (!job || !talent) throw new Error('Vaga ou talento não encontrado.');
    if (['Aberta', 'Em processo'].indexOf(String(job.status_vaga || '')) === -1) throw new Error('A vaga precisa estar aberta para receber indicação.');
    if (String(talent.apto_talent_hub || '') !== 'SIM' || String(talent.status_pool || '') !== 'Disponível') throw new Error('Somente talentos aptos e disponíveis podem ser indicados.');
    var duplicate = getSheetObjects_('TH_INDICACOES', { raw: true }).some(function (item) { return String(item.vaga_id || '') === String(job.vaga_id) && String(item.pessoa_id || '') === String(talent.pessoa_id) && ['Em análise', 'Enviado', 'Entrevista'].indexOf(String(item.status_indicacao || '')) !== -1; });
    if (duplicate) throw new Error('Já existe uma indicação ativa desse talento para esta vaga.');
    var now = nowIso_(); var row = { indicacao_id: generateId_('IND_'), vaga_id: job.vaga_id, cliente_id: job.cliente_id, pessoa_id: talent.pessoa_id, status_indicacao: 'Em análise', observacoes: payload.observacoes || '', criado_em: now, criado_por: currentUser_(), atualizado_em: now, atualizado_por: currentUser_() };
    appendObject_('TH_INDICACOES', row); updateObjectById_('TH_VAGAS', 'vaga_id', job.vaga_id, { status_vaga: 'Em processo', atualizado_em: now, atualizado_por: currentUser_() }); writeEntityAudit_('CREATE', 'INDICACAO', row.indicacao_id, {}, row, 'WEB_APP'); regenerateTalentView_(); regenerateDashboard_(); return serializeForClient_(row);
  });
}

function mvpUpdateIndication(indicacaoId, newStatus, observacoes) {
  var transitions = { 'Em análise': ['Enviado', 'Liberado'], Enviado: ['Entrevista', 'Liberado'], Entrevista: ['Contratado', 'Liberado'], Contratado: [], Liberado: [] };
  return withScriptLock_(function () {
    var row = getObjectById_('TH_INDICACOES', 'indicacao_id', indicacaoId, { raw: true }); if (!row) throw new Error('Indicação não encontrada.');
    if ((transitions[String(row.status_indicacao || '')] || []).indexOf(newStatus) === -1) throw new Error('Transição de status não permitida.');
    var now = nowIso_(); var patch = { status_indicacao: newStatus, observacoes: observacoes == null ? row.observacoes : observacoes, atualizado_em: now, atualizado_por: currentUser_() };
    if (newStatus === 'Enviado') patch.enviado_em = now; if (newStatus === 'Entrevista') patch.entrevista_em = now; if (['Contratado', 'Liberado'].indexOf(newStatus) !== -1) patch.resultado_em = now;
    var result = updateObjectById_('TH_INDICACOES', 'indicacao_id', indicacaoId, patch); writeEntityAudit_('UPDATE', 'INDICACAO', indicacaoId, result.before, result.after, 'WEB_APP');
    if (newStatus === 'Contratado') mvpRefreshJobAfterHire_(row.vaga_id, now);
    regenerateTalentView_(); regenerateDashboard_(); return serializeForClient_(result.after);
  });
}

function mvpRefreshJobAfterHire_(vagaId, now) {
  var job = getObjectById_('TH_VAGAS', 'vaga_id', vagaId, { raw: true }); if (!job) return;
  var hired = getSheetObjects_('TH_INDICACOES', { raw: true }).filter(function (item) { return String(item.vaga_id || '') === String(vagaId) && String(item.status_indicacao || '') === 'Contratado'; }).length;
  if (hired < Number(job.qtd_posicoes || 1)) return;
  updateObjectById_('TH_VAGAS', 'vaga_id', vagaId, { status_vaga: 'Preenchida', data_encerramento: now, atualizado_em: now, atualizado_por: currentUser_() });
  getSheetObjects_('TH_INDICACOES', { raw: true }).filter(function (item) {
    return String(item.vaga_id || '') === String(vagaId) && ['Em análise', 'Enviado', 'Entrevista'].indexOf(String(item.status_indicacao || '')) !== -1;
  }).forEach(function (item) {
    var result = updateObjectById_('TH_INDICACOES', 'indicacao_id', item.indicacao_id, {
      status_indicacao: 'Liberado', resultado_em: now, atualizado_em: now, atualizado_por: currentUser_(),
      observacoes: [item.observacoes, 'Liberado automaticamente: vaga preenchida.'].filter(Boolean).join('\n')
    });
    writeEntityAudit_('UPDATE', 'INDICACAO', item.indicacao_id, result.before, result.after, 'SISTEMA');
  });
}
