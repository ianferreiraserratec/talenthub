/**
 * Configuração técnica do MVP. IDs e valores específicos do ambiente devem
 * ficar em Script Properties e não são editáveis pelo web app.
 */
var TH_OPERATIONAL_SPREADSHEET_CACHE_ = null;
var TH_OPERATIONAL_SPREADSHEET_ID_CACHE_ = '';
var TH_CONFIG_MAP_CACHE_ = null;
var TH_CONFIG_MAP_CACHE_AT_ = 0;

function getDefaultConfig_() {
  return {
    ABA_CDP_PESSOAS: 'PESSOAS',
    ABA_CDP_MATRICULAS: 'MATRICULAS',
    DIAS_CADASTRO_VALIDO: '90',
    TERMO_STATUS_VALIDO: 'ATIVO',
    TERMO_STATUS_INVALIDO: 'CANCELADO'
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
    'TERMO_STATUS_INVALIDO'
  ];
}

function getOperationalSpreadsheet_() {
  var spreadsheetId = String(
    PropertiesService.getScriptProperties().getProperty('TH_SPREADSHEET_ID') || ''
  ).trim();
  if (spreadsheetId) {
    if (TH_OPERATIONAL_SPREADSHEET_CACHE_ &&
      TH_OPERATIONAL_SPREADSHEET_ID_CACHE_ === spreadsheetId) {
      return TH_OPERATIONAL_SPREADSHEET_CACHE_;
    }
    TH_OPERATIONAL_SPREADSHEET_CACHE_ = SpreadsheetApp.openById(spreadsheetId);
    TH_OPERATIONAL_SPREADSHEET_ID_CACHE_ = spreadsheetId;
    return TH_OPERATIONAL_SPREADSHEET_CACHE_;
  }

  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    TH_OPERATIONAL_SPREADSHEET_CACHE_ = active;
    TH_OPERATIONAL_SPREADSHEET_ID_CACHE_ = active.getId();
    return active;
  }
  throw new Error('TH_SPREADSHEET_ID não configurado nas Script Properties.');
}

function getConfigMap_() {
  if (TH_CONFIG_MAP_CACHE_ && Date.now() - TH_CONFIG_MAP_CACHE_AT_ < 15000) {
    return Object.assign({}, TH_CONFIG_MAP_CACHE_);
  }
  var config = getDefaultConfig_();
  var properties = PropertiesService.getScriptProperties().getProperties();
  getAllowedConfigKeys_().forEach(function (key) {
    if (properties[key] !== undefined && String(properties[key]).trim() !== '') {
      config[key] = String(properties[key]).trim();
    }
  });

  try {
    var sheet = getOperationalSpreadsheet_().getSheetByName('TH_CONFIG');
    if (sheet && sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues()
        .forEach(function (row) {
          var key = String(row[0] || '').trim();
          var value = String(row[1] || '').trim();
          if (key && value && getAllowedConfigKeys_().indexOf(key) !== -1 &&
            !properties[key]) config[key] = value;
        });
    }
  } catch (error) {
    // O setup inicial pode ocorrer antes de TH_CONFIG existir.
  }

  TH_CONFIG_MAP_CACHE_ = Object.assign({}, config);
  TH_CONFIG_MAP_CACHE_AT_ = Date.now();
  return Object.assign({}, config);
}

function clearRuntimeConfigCache_() {
  TH_CONFIG_MAP_CACHE_ = null;
  TH_CONFIG_MAP_CACHE_AT_ = 0;
  TH_OPERATIONAL_SPREADSHEET_CACHE_ = null;
  TH_OPERATIONAL_SPREADSHEET_ID_CACHE_ = '';
}

function getConfigValue_(key, fallback) {
  var config = getConfigMap_();
  return Object.prototype.hasOwnProperty.call(config, key) ? config[key] : fallback;
}
