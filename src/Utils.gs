function nowIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Sao_Paulo', "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function currentUser_() {
  try {
    return Session.getActiveUser().getEmail() || 'usuario_nao_identificado';
  } catch (error) {
    return 'usuario_nao_identificado';
  }
}

function generateId_(prefix) {
  return prefix + Utilities.getUuid().replace(/-/g, '').substring(0, 16).toUpperCase();
}

function normalizeText_(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeBoolean_(value) {
  var normalized = normalizeText_(value);
  if (value === true || ['sim', 'true', '1', 'ativo'].indexOf(normalized) !== -1) return true;
  if (value === false || ['nao', 'false', '0', 'inativo'].indexOf(normalized) !== -1) return false;
  return null;
}

function parseDateValue_(value) {
  if (!value && value !== 0) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  if (typeof value === 'number') {
    // Número serial do Google Sheets/Excel (epoch 1899-12-30).
    var serialDate = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return isNaN(serialDate.getTime()) ? null : serialDate;
  }

  var text = String(value).trim();
  if (!text) return null;

  var brazilian = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (brazilian) {
    var brDate = new Date(
      Number(brazilian[3]),
      Number(brazilian[2]) - 1,
      Number(brazilian[1]),
      Number(brazilian[4] || 0),
      Number(brazilian[5] || 0),
      Number(brazilian[6] || 0)
    );
    return isNaN(brDate.getTime()) ? null : brDate;
  }

  var parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function daysSince_(value, referenceDate) {
  var date = parseDateValue_(value);
  if (!date) return null;
  var reference = referenceDate || new Date();
  var startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  var startReference = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  return Math.floor((startReference.getTime() - startDate.getTime()) / 86400000);
}

function isDateWithinDays_(value, days, referenceDate) {
  var difference = daysSince_(value, referenceDate);
  return difference !== null && difference >= 0 && difference <= Number(days);
}

function serializeForClient_(value) {
  if (value == null) return value;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || 'America/Sao_Paulo', "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  if (Array.isArray(value)) {
    return value.map(serializeForClient_);
  }
  if (typeof value === 'object') {
    var output = {};
    Object.keys(value).forEach(function (key) {
      output[key] = serializeForClient_(value[key]);
    });
    return output;
  }
  return value;
}

function splitList_(value) {
  if (Array.isArray(value)) return value.map(normalizeText_).filter(Boolean);
  return String(value == null ? '' : value)
    .split(/[;,|\n]+/)
    .map(normalizeText_)
    .filter(Boolean);
}

function valueIsBlank_(value) {
  return value === null || typeof value === 'undefined' || String(value).trim() === '';
}

function withScriptLock_(callback) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}
