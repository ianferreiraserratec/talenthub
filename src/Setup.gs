function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Talent Hub')
    .addItem('Preparar banco do MVP', 'setupTalentHubDatabase')
    .addItem('Sincronizar dados da fonte', 'syncAll')
    .addToUi();
}

function setupTalentHubDatabase() {
  return withScriptLock_(function () {
    var spreadsheet = getOperationalSpreadsheet_();
    var schema = getDatabaseSchema_();
    var created = [];
    Object.keys(schema).forEach(function (name) {
      var result = ensureSheet_(spreadsheet, name, schema[name]);
      if (result.created) created.push(name);
    });
    seedConfig_(spreadsheet);
    seedParameters_();
    applyDataValidations_();
    formatManagedSheets_(spreadsheet, schema);
    clearRuntimeConfigCache_();
    regenerateTalentView_();
    regenerateDashboard_();
    writeAuditLog_('CREATE', 'DATABASE', spreadsheet.getId(), '', '', 'SETUP', 'Estrutura do MVP validada');
    return { ok: true, createdSheets: created, message: 'Banco do MVP preparado.' };
  });
}

function ensureSheet_(spreadsheet, name, headers) {
  var sheet = spreadsheet.getSheetByName(name);
  var created = false;
  if (!sheet) { sheet = spreadsheet.insertSheet(name); created = true; }
  var existing = getHeader_(sheet);
  if (!existing.some(function (value) { return value !== ''; })) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    var missing = headers.filter(function (header) { return existing.indexOf(header) === -1; });
    if (missing.length) sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }
  return { created: created };
}

function seedConfig_(spreadsheet) {
  var now = nowIso_();
  var rows = [
    ['CDP_SPREADSHEET_ID', '', 'ID da planilha-fonte; manter em Script Properties', now, currentUser_()],
    ['TH_SPREADSHEET_ID', spreadsheet.getId(), 'Planilha operacional do Talent Hub', now, currentUser_()],
    ['ABA_CDP_PESSOAS', 'PESSOAS', 'Aba de pessoas na planilha-fonte', now, currentUser_()],
    ['ABA_CDP_MATRICULAS', 'MATRICULAS', 'Aba de matrículas na planilha-fonte', now, currentUser_()],
    ['DIAS_CADASTRO_VALIDO', '90', 'Janela de validade do cadastro', now, currentUser_()],
    ['TERMO_STATUS_VALIDO', 'ATIVO', 'Status de termo válido', now, currentUser_()]
  ].map(function (row) { return { chave: row[0], valor: row[1], descricao: row[2], atualizado_em: row[3], atualizado_por: row[4] }; });
  upsertRowsByCompositeKey_('TH_CONFIG', rows, ['chave']);
}

function seedParameters_() {
  var values = {
    status_cliente: ['Prospect', 'Ativo', 'Inativo'],
    status_vaga: ['Rascunho', 'Aberta', 'Em processo', 'Preenchida', 'Encerrada', 'Cancelada'],
    status_indicacao: ['Em análise', 'Enviado', 'Entrevista', 'Contratado', 'Liberado'],
    senioridades: ['Estágio', 'Trainee', 'Júnior', 'Pleno', 'Sênior'],
    modalidades: ['Remoto', 'Híbrido', 'Presencial', 'A combinar'],
    tipos_contratacao: ['CLT', 'PJ', 'Estágio', 'Trainee', 'Freelancer', 'A combinar']
  };
  var rows = [];
  Object.keys(values).forEach(function (group) {
    values[group].forEach(function (value, index) {
      rows.push({ grupo: group, valor: value, descricao: '', ordem: index + 1, ativo: 'SIM' });
    });
  });
  upsertRowsByCompositeKey_('TH_PARAMETROS', rows, ['grupo', 'valor']);
}

function applyDataValidations_() {
  var definitions = [['TH_CLIENTES', 'status_cliente', 'status_cliente'], ['TH_VAGAS', 'status_vaga', 'status_vaga'], ['TH_INDICACOES', 'status_indicacao', 'status_indicacao']];
  var parameters = getSheetObjects_('TH_PARAMETROS', { raw: true });
  definitions.forEach(function (definition) {
    var values = parameters.filter(function (row) { return row.grupo === definition[2] && normalizeBoolean_(row.ativo) !== false; }).map(function (row) { return String(row.valor); });
    var sheet = getSheetOrThrow_(definition[0]);
    var column = getHeader_(sheet).indexOf(definition[1]);
    if (!values.length || column < 0 || sheet.getMaxRows() < 2) return;
    sheet.getRange(2, column + 1, sheet.getMaxRows() - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build());
  });
}

function formatManagedSheets_(spreadsheet, schema) {
  Object.keys(schema).forEach(function (name) {
    var sheet = spreadsheet.getSheetByName(name);
    if (!sheet) return;
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, schema[name].length).setBackground('#173b57').setFontColor('#ffffff').setFontWeight('bold');
  });
}
