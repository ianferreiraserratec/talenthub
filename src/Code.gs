function doGet() {
  var template = HtmlService.createTemplateFromFile('Index');
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
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getAppBootstrap() {
  var state = getDatabaseState_();
  return serializeForClient_({
    appName: 'Talent Hub Serratec',
    version: '0.1.0-homologacao',
    user: currentUser_(),
    initialized: state.initialized,
    missingSheets: state.missingSheets,
    config: getRuntimeConfig()
  });
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
