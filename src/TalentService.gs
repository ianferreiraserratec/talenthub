function getTalentos(filters) {
  filters = filters || {};
  var search = normalizeText_(filters.search || '');
  var status = String(filters.status || '').trim();
  var page = Math.max(Number(filters.page || 1), 1);
  var pageSize = Math.min(Math.max(Number(filters.pageSize || 50), 1), 200);
  var rows = getSheetObjects_('VW_TALENTOS_APTOS', { raw: true });

  var filtered = rows.filter(function (row) {
    if (status && status !== 'Todos') {
      if (status === 'Cadastro vencido' && row.cadastro_atualizado_90d !== 'NAO') return false;
      else if (status === 'Termo cancelado' && row.termo_status !== 'CANCELADO') return false;
      else if (status === 'Aptos' && row.apto_talent_hub !== 'SIM') return false;
      else if (['Cadastro vencido', 'Termo cancelado', 'Aptos'].indexOf(status) === -1 && row.status_pool !== status) return false;
    }
    if (search) {
      var haystack = normalizeText_([
        row.nome, row.email, row.email_serratec, row.cpf, row.cidade, row.uf,
        row.area_interesse_principal, row.principais_competencias, row.curso,
        row.ult_formacao, row.senioridade
      ].join(' '));
      if (haystack.indexOf(search) === -1) return false;
    }
    return true;
  });

  filtered.sort(function (a, b) {
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
  });
  var offset = (page - 1) * pageSize;
  return serializeForClient_({
    items: filtered.slice(offset, offset + pageSize),
    total: filtered.length,
    page: page,
    pageSize: pageSize,
    totalPages: Math.max(Math.ceil(filtered.length / pageSize), 1)
  });
}

function getTalentoById(pessoaId) {
  var person = getObjectById_('VW_TALENTOS_APTOS', 'pessoa_id', pessoaId, { raw: true });
  if (!person) throw new Error('Talento não encontrado: ' + pessoaId);
  var operational = getObjectById_('TH_TALENTOS', 'pessoa_id', pessoaId, { raw: true }) || {};
  var registrations = getSheetObjects_('TH_CACHE_MATRICULAS', { raw: true }).filter(function (row) {
    return String(row.pessoa_id || '').trim() === String(pessoaId).trim();
  });
  var processes = getSheetObjects_('TH_PROCESSOS', { raw: true }).filter(function (row) {
    return String(row.pessoa_id || '').trim() === String(pessoaId).trim();
  });
  var hires = getSheetObjects_('TH_CONTRATACOES', { raw: true }).filter(function (row) {
    return String(row.pessoa_id || '').trim() === String(pessoaId).trim();
  });
  return serializeForClient_({
    pessoa: person,
    talentHub: operational,
    matriculas: registrations,
    processos: processes,
    contratacoes: hires
  });
}

function updateTalentoTalentHubData(payload) {
  payload = payload || {};
  requireFields_(payload, ['pessoa_id'], 'Talento');
  var pessoaId = String(payload.pessoa_id).trim();
  if (!getObjectById_('TH_CACHE_PESSOAS', 'pessoa_id', pessoaId, { raw: true })) {
    throw new Error('pessoa_id não existe no cache do CDP: ' + pessoaId);
  }

  var fields = getDatabaseSchema_().TH_TALENTOS;
  var clean = sanitizePayload_(payload, fields);
  var now = nowIso_();
  var user = currentUser_();
  clean.pessoa_id = pessoaId;
  clean.atualizado_em = now;
  clean.atualizado_por = user;

  return withScriptLock_(function () {
    var before = getObjectById_('TH_TALENTOS', 'pessoa_id', pessoaId, { raw: true });
    if (!before) {
      clean.data_entrada_pool = clean.data_entrada_pool || now;
      clean.ultima_atualizacao_talent_hub = clean.ultima_atualizacao_talent_hub || now;
      appendObject_('TH_TALENTOS', clean);
      writeEntityAudit_('CREATE', 'TALENTO', pessoaId, {}, clean, 'WEB_APP');
    } else {
      clean.ultima_atualizacao_talent_hub = now;
      var result = updateObjectById_('TH_TALENTOS', 'pessoa_id', pessoaId, clean, fields);
      writeEntityAudit_('UPDATE', 'TALENTO', pessoaId, result.before, result.after, 'WEB_APP');
    }
    writeEvent_('Talento atualizado', 'TALENTO', pessoaId, { pessoa_id: pessoaId }, 'Dados profissionais atualizados');
    regenerateTalentView_();
    regenerateDashboard_();
    return getTalentoById(pessoaId);
  });
}

function getParametros(grupos) {
  var requested = Array.isArray(grupos) ? grupos : [];
  var result = {};
  getSheetObjects_('TH_PARAMETROS', { raw: true }).forEach(function (row) {
    var group = String(row.grupo || '');
    if (requested.length && requested.indexOf(group) === -1) return;
    if (normalizeBoolean_(row.ativo) === false) return;
    if (!result[group]) result[group] = [];
    result[group].push({ valor: row.valor, descricao: row.descricao, ordem: Number(row.ordem || 0) });
  });
  Object.keys(result).forEach(function (group) {
    result[group].sort(function (a, b) { return a.ordem - b.ordem; });
  });
  return serializeForClient_(result);
}
