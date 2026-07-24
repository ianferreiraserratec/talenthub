function doGet() {
  var template = createTemplateFromProjectFile_('Index');
  template.appName = 'Talent Hub Serratec';
  return template.evaluate()
    .setTitle('Talent Hub Serratec')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(filename) {
  var allowed = [
    'Styles', 'Scripts', 'Components', 'Dashboard', 'Talentos', 'Clientes',
    'Vagas', 'Matchmaking', 'Shortlists', 'Integracoes', 'AuditLogs'
  ];
  if (allowed.indexOf(filename) === -1) throw new Error('Template não permitido: ' + filename);
  return createHtmlOutputFromProjectFile_(filename).getContent();
}

/**
 * Resolve arquivos HTML tanto em projetos enviados com `rootDir: src` pelo
 * clasp quanto em projetos sincronizados pelo GitHub Assistant, que preserva
 * o prefixo `src/` no nome dos arquivos dentro do Apps Script.
 */
function createTemplateFromProjectFile_(filename) {
  try {
    return HtmlService.createTemplateFromFile(filename);
  } catch (error) {
    return HtmlService.createTemplateFromFile('src/' + filename);
  }
}

function createHtmlOutputFromProjectFile_(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename);
  } catch (error) {
    return HtmlService.createHtmlOutputFromFile('src/' + filename);
  }
}

function getAppBootstrap() {
  var state = getDatabaseState_();
  var payload = {
    appName: 'Talent Hub Serratec',
    version: '0.1.0-homologacao',
    user: currentUser_(),
    initialized: state.initialized,
    missingSheets: state.missingSheets,
    config: getRuntimeConfig()
  };
  if (state.initialized) {
    payload.parametros = getParametros(['areas_interesse', 'senioridades', 'modalidades', 'tipos_contratacao']);
    payload.dashboard = getDashboard();
  }
  return serializeForClient_(payload);
}

function getDatabaseState_() {
  try {
    var spreadsheet = getOperationalSpreadsheet_();
    var schema = getDatabaseSchema_();
    var missing = Object.keys(schema).filter(function (sheetName) {
      return !spreadsheet.getSheetByName(sheetName);
    });
    return { initialized: missing.length === 0, missingSheets: missing };
  } catch (error) {
    return { initialized: false, missingSheets: Object.keys(getDatabaseSchema_()), error: error.message };
  }
}

function healthCheck() {
  var state = getDatabaseState_();
  return {
    ok: state.initialized,
    timestamp: nowIso_(),
    user: currentUser_(),
    missingSheets: state.missingSheets
  };
}
