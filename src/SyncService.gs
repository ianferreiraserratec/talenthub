function syncPessoas() {
  return withScriptLock_(function () {
    var result = syncSourceToCache_('PESSOAS');
    regenerateTalentView_();
    regenerateDashboard_();
    return result;
  });
}

function syncMatriculas() {
  return withScriptLock_(function () {
    var result = syncSourceToCache_('MATRICULAS');
    regenerateTalentView_();
    regenerateDashboard_();
    return result;
  });
}

function syncAll() {
  return withScriptLock_(function () {
    var pessoas = syncSourceToCache_('PESSOAS');
    var matriculas = syncSourceToCache_('MATRICULAS');
    var talentos = regenerateTalentView_();
    regenerateDashboard_();
    return { ok: true, pessoas: pessoas, matriculas: matriculas, talentos: talentos };
  });
}

function syncSourceToCache_(type) {
  var config = getConfigMap_();
  var cdpId = String(config.CDP_SPREADSHEET_ID || '').trim();
  if (!cdpId) throw new Error('CDP_SPREADSHEET_ID não configurado nas Script Properties.');
  var definition = type === 'PESSOAS'
    ? { source: config.ABA_CDP_PESSOAS || 'PESSOAS', target: 'TH_CACHE_PESSOAS', id: 'pessoa_id' }
    : { source: config.ABA_CDP_MATRICULAS || 'MATRICULAS', target: 'TH_CACHE_MATRICULAS', id: 'mtr_id' };
  var source = SpreadsheetApp.openById(cdpId).getSheetByName(definition.source);
  if (!source) throw new Error('Aba de origem não encontrada: ' + definition.source);
  var headers = getHeader_(source);
  var expected = getDatabaseSchema_()[definition.target].filter(function (header) { return header !== 'sync_em'; });
  assertRequiredHeaders_(headers, expected, definition.source);
  var values = source.getLastRow() > 1 ? source.getRange(2, 1, source.getLastRow() - 1, headers.length).getValues() : [];
  var rows = rowsToObjects_(headers, values);
  var unique = {};
  rows.forEach(function (row) {
    var id = String(row[definition.id] || '').trim();
    if (!id) return;
    var clean = {};
    expected.forEach(function (field) { clean[field] = row[field]; });
    clean.sync_em = nowIso_();
    unique[id] = clean;
  });
  var written = replaceSheetRows_(definition.target, Object.keys(unique).map(function (key) { return unique[key]; }));
  appendObject_('TH_SYNC_LOG', { sync_id: generateId_('SYN_'), tipo_sync: type, iniciado_em: nowIso_(), finalizado_em: nowIso_(), status: 'CONCLUIDO', total_linhas_lidas: rows.length, total_linhas_gravadas: written, mensagem: 'Sincronização concluída.', executado_por: currentUser_() });
  writeAuditLog_('SYNC', definition.target, type, '', '', 'ADMIN', written + ' linhas sincronizadas');
  return { ok: true, lidas: rows.length, gravadas: written };
}

function regenerateTalentView() { return withScriptLock_(regenerateTalentView_); }

function regenerateTalentView_() {
  var config = getConfigMap_();
  var validDays = Number(config.DIAS_CADASTRO_VALIDO || 90);
  var validTerm = normalizeText_(config.TERMO_STATUS_VALIDO || 'ATIVO');
  var terms = indexLatestBy_('TALENT_HUB_STATUS_TERMO', 'pessoa_id', 'atualizado_em');
  var profiles = indexBy_('TH_TALENTOS', 'pessoa_id');
  var indications = getSheetObjects_('TH_INDICACOES', { raw: true });
  var activeByPerson = {};
  indications.forEach(function (item) {
    if (['Em análise', 'Enviado', 'Entrevista'].indexOf(String(item.status_indicacao || '')) === -1) return;
    var id = String(item.pessoa_id || '');
    activeByPerson[id] = (activeByPerson[id] || 0) + 1;
  });
  var hiredByPerson = {};
  indications.forEach(function (item) { if (String(item.status_indicacao || '') === 'Contratado') hiredByPerson[String(item.pessoa_id || '')] = true; });
  var rows = getSheetObjects_('TH_CACHE_PESSOAS', { raw: true }).map(function (person) {
    var id = String(person.pessoa_id || '').trim();
    var term = terms[id] || {};
    var profile = profiles[id] || {};
    var current = isDateWithinDays_(person.atualizado_em, validDays);
    var apt = current && normalizeText_(term.status) === validTerm;
    var reason = apt ? '' : (current ? 'TERMO_INVALIDO' : 'CADASTRO_DESATUALIZADO');
    var status = !apt ? (current ? 'Inelegível' : 'Inativo') : hiredByPerson[id] ? 'Contratado' : activeByPerson[id] ? 'Em processo' : normalizeBoolean_(profile.disponivel_para_oportunidades) === false ? 'Inativo' : 'Disponível';
    return {
      pessoa_id: id, nome: person.nome, email: person.email, email_serratec: person.email_serratec,
      celular: person.celular, cidade: person.cidade, uf: person.uf, curso: person.curso,
      ult_formacao: person.ult_formacao, curriculo: profile.curriculo_alternativo_url || person.curriculo,
      atualizado_em: person.atualizado_em, cadastro_atualizado_90d: current ? 'SIM' : 'NAO',
      termo_status: term.status || '', apto_talent_hub: apt ? 'SIM' : 'NAO', motivo_nao_apto: reason,
      status_pool: status, disponivel_para_oportunidades: profile.disponivel_para_oportunidades,
      momento_profissional: profile.momento_profissional, area_interesse_principal: profile.area_interesse_principal,
      senioridade: profile.senioridade, tipo_contratacao_preferida: profile.tipo_contratacao_preferida,
      modalidade_preferida: profile.modalidade_preferida, regioes_interesse: profile.regioes_interesse,
      principais_competencias: profile.principais_competencias, processos_ativos: activeByPerson[id] || 0,
      observacoes_curadoria: profile.observacoes_curadoria
    };
  });
  replaceSheetRows_('VW_TALENTOS_APTOS', rows);
  return { ok: true, total: rows.length };
}

function indexBy_(sheetName, keyField) {
  var index = {};
  getSheetObjects_(sheetName, { raw: true }).forEach(function (row) { var key = String(row[keyField] || '').trim(); if (key) index[key] = row; });
  return index;
}

function indexLatestBy_(sheetName, keyField, dateField) {
  var index = {};
  getSheetObjects_(sheetName, { raw: true }).forEach(function (row) {
    var key = String(row[keyField] || '').trim();
    if (!key || (index[key] && String(index[key][dateField] || '') > String(row[dateField] || ''))) return;
    index[key] = row;
  });
  return index;
}

function getSyncStatus() {
  return serializeForClient_(getSheetObjects_('TH_SYNC_LOG', { raw: true }).sort(function (a, b) { return String(b.iniciado_em || '').localeCompare(String(a.iniciado_em || '')); }).slice(0, 10));
}
