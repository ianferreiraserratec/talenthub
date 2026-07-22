function requireFields_(payload, fields, label) {
  var missing = (fields || []).filter(function (field) {
    return valueIsBlank_(payload && payload[field]);
  });
  if (missing.length) {
    throw new Error((label || 'Registro') + ': preencha ' + missing.join(', ') + '.');
  }
}

function sanitizePayload_(payload, allowedFields) {
  var sanitized = {};
  (allowedFields || []).forEach(function (field) {
    if (payload && Object.prototype.hasOwnProperty.call(payload, field)) {
      sanitized[field] = typeof payload[field] === 'string' ? payload[field].trim() : payload[field];
    }
  });
  return sanitized;
}

function assertEnum_(value, values, fieldName, allowBlank) {
  if (allowBlank && valueIsBlank_(value)) return;
  if (values.indexOf(value) === -1) {
    throw new Error((fieldName || 'Valor') + ' inválido: ' + value + '.');
  }
}

function assertNonNegativeNumber_(value, fieldName, allowBlank) {
  if (allowBlank && valueIsBlank_(value)) return;
  var number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error((fieldName || 'Valor') + ' deve ser um número maior ou igual a zero.');
  }
}
