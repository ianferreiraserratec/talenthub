/**
 * Configuração de runtime do Talent Hub.
 *
 * Valores sensíveis ou específicos do ambiente devem ser gravados nas
 * Script Properties. A aba TH_CONFIG funciona como alternativa administrável.
 */
function getDefaultConfig_() {
  return {
    ABA_CDP_PESSOAS: 'PESSOAS',
    ABA_CDP_MATRICULAS: 'MATRICULAS',
    DIAS_CADASTRO_VALIDO: '90',
    TERMO_STATUS_VALIDO: 'ATIVO',
    TERMO_STATUS_INVALIDO: 'CANCELADO',
    MATCHING_MODELO_PADRAO: 'MATCH_PADRAO_2026'
  };
}

function getAllowedConfigKeys_() {
  return [
    'CDP_SPREADSHEET_ID',
    'TH_SPREADSHEET_ID',
    'ABA_CDP_PESSOAS',
    'ABA_CDP_MATRICULAS',
    'DIAS_CADASTRO_VALIDO',
    'TERMO_STATUS_VALIDO',
    'TERMO_STATUS_INVALIDO',
    'MATCHING_MODELO_PADRAO'
  ];
}

function getOperationalSpreadsheet_() {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty('TH_SPREADSHEET_ID');
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId.trim());
  }

  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    return active;
  }

  throw new Error(
    'TH_SPREADSHEET_ID não configurado. Defina a Script Property antes de usar o web app.'
  );
}

function getConfigMap_() {
  var config = getDefaultConfig_();
  var scriptProperties = PropertiesService.getScriptProperties().getProperties();
  Object.keys(scriptProperties).forEach(function (key) {
    if (getAllowedConfigKeys_().indexOf(key) !== -1 && scriptProperties[key] !== '') {
      config[key] = scriptProperties[key];
    }
  });

  try {
    var spreadsheet = getOperationalSpreadsheet_();
    var sheet = spreadsheet.getSheetByName('TH_CONFIG');
    if (sheet && sheet.getLastRow() > 1) {
      var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues();
      values.forEach(function (row) {
        var key = String(row[0] || '').trim();
        var value = String(row[1] || '').trim();
        if (key && value && getAllowedConfigKeys_().indexOf(key) !== -1 && !scriptProperties[key]) {
          config[key] = value;
        }
      });
    }
  } catch (error) {
    // A configuração inicial pode acontecer antes da criação de TH_CONFIG.
  }

  return config;
}

function getConfigValue_(key, fallback) {
  var config = getConfigMap_();
  return Object.prototype.hasOwnProperty.call(config, key) ? config[key] : fallback;
}

function getRuntimeConfig() {
  var config = getConfigMap_();
  var spreadsheet = null;
  try {
    spreadsheet = getOperationalSpreadsheet_();
  } catch (error) {
    // A tela de configuração ainda deve abrir quando a planilha não foi definida.
  }

  return serializeForClient_({
    CDP_SPREADSHEET_ID: config.CDP_SPREADSHEET_ID || '',
    TH_SPREADSHEET_ID: config.TH_SPREADSHEET_ID || (spreadsheet ? spreadsheet.getId() : ''),
    ABA_CDP_PESSOAS: config.ABA_CDP_PESSOAS,
    ABA_CDP_MATRICULAS: config.ABA_CDP_MATRICULAS,
    DIAS_CADASTRO_VALIDO: Number(config.DIAS_CADASTRO_VALIDO || 90),
    TERMO_STATUS_VALIDO: config.TERMO_STATUS_VALIDO,
    TERMO_STATUS_INVALIDO: config.TERMO_STATUS_INVALIDO,
    MATCHING_MODELO_PADRAO: config.MATCHING_MODELO_PADRAO
  });
}

function saveRuntimeConfig(payload) {
  payload = payload || {};
  var allowed = getAllowedConfigKeys_();
  var clean = {};

  allowed.forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      clean[key] = String(payload[key] == null ? '' : payload[key]).trim();
    }
  });

  if (clean.DIAS_CADASTRO_VALIDO) {
    var days = Number(clean.DIAS_CADASTRO_VALIDO);
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      throw new Error('DIAS_CADASTRO_VALIDO deve ser um número entre 1 e 3650.');
    }
  }

  PropertiesService.getScriptProperties().setProperties(clean, false);
  writeAuditLog_('UPDATE', 'CONFIG', 'RUNTIME', '', '', 'WEB_APP', 'Configuração atualizada');
  return getRuntimeConfig();
}
