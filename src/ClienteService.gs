function getClientes(filters) {
  filters = filters || {};
  var search = normalizeText_(filters.search || '');
  var status = String(filters.status || '').trim();
  var vagas = getSheetObjects_('TH_VAGAS', { raw: true });
  var hires = getSheetObjects_('TH_CONTRATACOES', { raw: true });
  var contacts = getSheetObjects_('TH_CLIENTE_CONTATOS', { raw: true });

  var clients = getSheetObjects_('TH_CLIENTES', { raw: true }).filter(function (client) {
    if (status && status !== 'Todos' && client.status_cliente !== status) return false;
    if (search && normalizeText_([client.nome_empresa, client.razao_social, client.cnpj, client.setor, client.cidade].join(' ')).indexOf(search) === -1) return false;
    return true;
  }).map(function (client) {
    var id = String(client.cliente_id || '');
    client.vagas_abertas = vagas.filter(function (vaga) {
      return String(vaga.cliente_id || '') === id && ['Aberta', 'Em processo', 'Shortlist enviada', 'Validando pool'].indexOf(vaga.status_vaga) !== -1;
    }).length;
    client.colocacoes = hires.filter(function (hire) { return String(hire.cliente_id || '') === id; }).length;
    client.contato_principal = contacts.filter(function (contact) {
      return String(contact.cliente_id || '') === id && normalizeBoolean_(contact.contato_principal) === true;
    })[0] || null;
    return client;
  });
  clients.sort(function (a, b) { return String(a.nome_empresa || '').localeCompare(String(b.nome_empresa || ''), 'pt-BR'); });
  return serializeForClient_(clients);
}

function getClienteById(clienteId) {
  var client = getObjectById_('TH_CLIENTES', 'cliente_id', clienteId, { raw: true });
  if (!client) throw new Error('Cliente não encontrado: ' + clienteId);
  var contacts = getSheetObjects_('TH_CLIENTE_CONTATOS', { raw: true }).filter(function (row) {
    return String(row.cliente_id || '') === String(clienteId);
  });
  var jobs = getSheetObjects_('TH_VAGAS', { raw: true }).filter(function (row) {
    return String(row.cliente_id || '') === String(clienteId);
  });
  return serializeForClient_({ cliente: client, contatos: contacts, vagas: jobs });
}

function createCliente(payload) {
  payload = payload || {};
  requireFields_(payload, ['nome_empresa'], 'Cliente');
  var allowed = getDatabaseSchema_().TH_CLIENTES;
  var clean = sanitizePayload_(payload, allowed);
  validateCliente_(clean);

  return withScriptLock_(function () {
    assertUniqueCnpj_('', clean.cnpj);
    var now = nowIso_();
    var user = currentUser_();
    clean.cliente_id = generateId_('CLI_');
    clean.status_cliente = clean.status_cliente || 'Prospect';
    clean.criado_em = now;
    clean.criado_por = user;
    clean.atualizado_em = now;
    clean.atualizado_por = user;
    appendObject_('TH_CLIENTES', clean);
    writeEntityAudit_('CREATE', 'CLIENTE', clean.cliente_id, {}, clean, 'WEB_APP');
    writeEvent_('Cliente criado', 'CLIENTE', clean.cliente_id, { cliente_id: clean.cliente_id }, clean.nome_empresa);
    regenerateDashboard_();
    return serializeForClient_(clean);
  });
}

function updateCliente(clienteId, payload) {
  payload = payload || {};
  requireFields_({ cliente_id: clienteId, nome_empresa: payload.nome_empresa }, ['cliente_id', 'nome_empresa'], 'Cliente');
  var allowed = getDatabaseSchema_().TH_CLIENTES.filter(function (field) {
    return ['cliente_id', 'criado_em', 'criado_por'].indexOf(field) === -1;
  });
  var clean = sanitizePayload_(payload, allowed);
  validateCliente_(clean);

  return withScriptLock_(function () {
    assertUniqueCnpj_(clienteId, clean.cnpj);
    clean.atualizado_em = nowIso_();
    clean.atualizado_por = currentUser_();
    var result = updateObjectById_('TH_CLIENTES', 'cliente_id', clienteId, clean, allowed);
    writeEntityAudit_('UPDATE', 'CLIENTE', clienteId, result.before, result.after, 'WEB_APP');
    regenerateDashboard_();
    return serializeForClient_(result.after);
  });
}

function validateCliente_(client) {
  if (client.status_cliente) assertEnum_(client.status_cliente, ['Prospect', 'Em negociação', 'Ativo', 'Inativo', 'Encerrado'], 'status_cliente', true);
  ['valor_pacote', 'qtd_vagas_contratadas', 'qtd_perfis_por_vaga', 'prazo_retorno_empresa_dias'].forEach(function (field) {
    assertNonNegativeNumber_(client[field], field, true);
  });
}

function assertUniqueCnpj_(currentClientId, cnpj) {
  var normalized = String(cnpj || '').replace(/\D/g, '');
  if (!normalized) return;
  var duplicate = getSheetObjects_('TH_CLIENTES', { raw: true }).some(function (client) {
    return String(client.cliente_id || '') !== String(currentClientId || '') &&
      String(client.cnpj || '').replace(/\D/g, '') === normalized;
  });
  if (duplicate) throw new Error('Já existe um cliente cadastrado com este CNPJ.');
}

function saveClienteContato(clienteId, payload) {
  requireFields_({ cliente_id: clienteId, nome: payload && payload.nome }, ['cliente_id', 'nome'], 'Contato');
  if (!getObjectById_('TH_CLIENTES', 'cliente_id', clienteId, { raw: true })) throw new Error('Cliente não encontrado.');
  var allowed = getDatabaseSchema_().TH_CLIENTE_CONTATOS;
  var clean = sanitizePayload_(payload, allowed);
  return withScriptLock_(function () {
    var now = nowIso_();
    var user = currentUser_();
    clean.cliente_id = clienteId;
    clean.atualizado_em = now;
    clean.atualizado_por = user;
    if (clean.contato_id) {
      var result = updateObjectById_('TH_CLIENTE_CONTATOS', 'contato_id', clean.contato_id, clean, allowed);
      writeEntityAudit_('UPDATE', 'CONTATO_CLIENTE', clean.contato_id, result.before, result.after, 'WEB_APP');
      return serializeForClient_(result.after);
    }
    clean.contato_id = generateId_('CTO_');
    clean.ativo = valueIsBlank_(clean.ativo) ? 'SIM' : clean.ativo;
    clean.criado_em = now;
    clean.criado_por = user;
    appendObject_('TH_CLIENTE_CONTATOS', clean);
    writeEntityAudit_('CREATE', 'CONTATO_CLIENTE', clean.contato_id, {}, clean, 'WEB_APP');
    return serializeForClient_(clean);
  });
}
