function writeAuditLog_(action, entity, entityId, field, oldValue, source, note, newValue) {
  try {
    appendObject_('TH_AUDIT_LOGS', {
      audit_id: generateId_('AUD_'),
      data_evento: nowIso_(),
      usuario: currentUser_(),
      acao: action,
      entidade: entity,
      entidade_id: entityId || '',
      campo_alterado: field || '',
      valor_anterior: oldValue == null ? '' : String(oldValue),
      valor_novo: newValue == null ? '' : String(newValue),
      origem: source || 'WEB_APP',
      observacao: note || ''
    });
  } catch (error) {
    console.error('Falha ao gravar audit log: ' + error.message);
  }
}

function writeEntityAudit_(action, entity, entityId, before, after, source) {
  before = before || {};
  after = after || {};
  if (action === 'CREATE') {
    writeAuditLog_(action, entity, entityId, '', '', source, 'Registro criado');
    return;
  }
  var fields = {};
  Object.keys(before).concat(Object.keys(after)).forEach(function (key) { fields[key] = true; });
  var changes = 0;
  Object.keys(fields).forEach(function (field) {
    if (field === 'atualizado_em' || field === 'atualizado_por') return;
    var oldValue = serializeForClient_(before[field]);
    var newValue = serializeForClient_(after[field]);
    if (String(oldValue == null ? '' : oldValue) !== String(newValue == null ? '' : newValue)) {
      writeAuditLog_(action, entity, entityId, field, oldValue, source, '', newValue);
      changes += 1;
    }
  });
  if (!changes) writeAuditLog_(action, entity, entityId, '', '', source, 'Nenhuma alteração material');
}

function writeEvent_(type, entity, entityId, context, description, oldStatus, newStatus, channel, notes) {
  context = context || {};
  try {
    appendObject_('TH_EVENTOS', {
      evento_id: generateId_('EVT_'),
      data_evento: nowIso_(),
      tipo_evento: type,
      entidade: entity,
      entidade_id: entityId || '',
      pessoa_id: context.pessoa_id || '',
      vaga_id: context.vaga_id || '',
      cliente_id: context.cliente_id || '',
      processo_id: context.processo_id || '',
      shortlist_id: context.shortlist_id || '',
      descricao_evento: description || '',
      status_anterior: oldStatus || '',
      status_novo: newStatus || '',
      responsavel: currentUser_(),
      canal: channel || 'Sistema',
      observacoes: notes || ''
    });
  } catch (error) {
    console.error('Falha ao gravar evento: ' + error.message);
  }
}

function getAuditLogs(filters) {
  filters = filters || {};
  var search = normalizeText_(filters.search || '');
  var action = String(filters.action || '').trim();
  var entity = String(filters.entity || '').trim();
  var dateFrom = parseDateValue_(filters.dateFrom);
  var dateTo = parseDateValue_(filters.dateTo);
  if (dateTo) dateTo.setHours(23, 59, 59, 999);
  var limit = Math.min(Math.max(Number(filters.limit || 100), 1), 500);
  var rows = getSheetObjects_('TH_AUDIT_LOGS', { raw: true }).filter(function (row) {
    if (action && row.acao !== action) return false;
    if (entity && row.entidade !== entity) return false;
    var eventDate = parseDateValue_(row.data_evento);
    if (dateFrom && (!eventDate || eventDate.getTime() < dateFrom.getTime())) return false;
    if (dateTo && (!eventDate || eventDate.getTime() > dateTo.getTime())) return false;
    if (search) {
      var haystack = normalizeText_([row.usuario, row.entidade, row.entidade_id, row.campo_alterado, row.observacao].join(' '));
      if (haystack.indexOf(search) === -1) return false;
    }
    return true;
  });
  rows.sort(function (a, b) {
    return String(b.data_evento || '').localeCompare(String(a.data_evento || ''));
  });
  return serializeForClient_(rows.slice(0, limit));
}
