var TH_SHEET_HEADER_CACHE_ = {};

function getSheetOrThrow_(sheetName) {
  var sheet = getOperationalSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Aba não encontrada: ' + sheetName + '. Execute setupTalentHubDatabase().');
  }
  return sheet;
}

function getHeader_(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return [];
  var cacheKey = sheet.getName();
  var cached = TH_SHEET_HEADER_CACHE_[cacheKey];
  if (cached && cached.lastColumn === lastColumn) return cached.headers.slice();
  var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function (item) {
    return String(item || '').trim();
  });
  TH_SHEET_HEADER_CACHE_[cacheKey] = { lastColumn: lastColumn, headers: headers.slice() };
  return headers;
}

function assertRequiredHeaders_(headers, required, sourceName) {
  var missing = required.filter(function (header) {
    return headers.indexOf(header) === -1;
  });
  if (missing.length) {
    throw new Error(sourceName + ' não possui os cabeçalhos obrigatórios: ' + missing.join(', '));
  }
}

function rowsToObjects_(headers, rows) {
  return rows.map(function (row) {
    var object = {};
    headers.forEach(function (header, index) {
      if (header) object[header] = row[index];
    });
    return object;
  });
}

function objectToRow_(headers, object) {
  return headers.map(function (header) {
    var value = Object.prototype.hasOwnProperty.call(object, header) ? object[header] : '';
    return value == null ? '' : value;
  });
}

function getSheetObjects_(sheetName, options) {
  options = options || {};
  var sheet = getSheetOrThrow_(sheetName);
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow <= 1 || lastColumn < 1) return [];
  var values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  var headers = values.shift().map(function (item) { return String(item || '').trim(); });
  TH_SHEET_HEADER_CACHE_[sheetName] = { lastColumn: lastColumn, headers: headers.slice() };
  if (!headers.some(function (header) { return header !== ''; })) return [];
  var rows = values;
  var objects = rowsToObjects_(headers, rows).filter(function (row) {
    return headers.some(function (header) { return !valueIsBlank_(row[header]); });
  });
  return options.raw ? objects : serializeForClient_(objects);
}

function getObjectById_(sheetName, idField, idValue, options) {
  var normalizedId = String(idValue == null ? '' : idValue).trim();
  var rows = getSheetObjects_(sheetName, options || { raw: true });
  for (var index = 0; index < rows.length; index += 1) {
    if (String(rows[index][idField] == null ? '' : rows[index][idField]).trim() === normalizedId) {
      return (options && options.raw) ? rows[index] : serializeForClient_(rows[index]);
    }
  }
  return null;
}

function appendObject_(sheetName, object) {
  var sheet = getSheetOrThrow_(sheetName);
  var headers = getHeader_(sheet);
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([
    objectToRow_(headers, object)
  ]);
  return serializeForClient_(object);
}

function appendObjects_(sheetName, objects) {
  objects = Array.isArray(objects) ? objects : [];
  if (!objects.length) return 0;
  var sheet = getSheetOrThrow_(sheetName);
  var headers = getHeader_(sheet);
  var matrix = objects.map(function (object) { return objectToRow_(headers, object); });
  sheet.getRange(sheet.getLastRow() + 1, 1, matrix.length, headers.length).setValues(matrix);
  return matrix.length;
}

function updateObjectById_(sheetName, idField, idValue, patch, allowedFields) {
  var sheet = getSheetOrThrow_(sheetName);
  var headers = getHeader_(sheet);
  var idColumn = headers.indexOf(idField);
  if (idColumn === -1) throw new Error('Chave ' + idField + ' não existe em ' + sheetName + '.');
  if (sheet.getLastRow() <= 1) throw new Error('Registro não encontrado: ' + idValue);

  var idValues = sheet.getRange(2, idColumn + 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  var rowNumber = -1;
  for (var index = 0; index < idValues.length; index += 1) {
    if (String(idValues[index][0]).trim() === String(idValue).trim()) {
      rowNumber = index + 2;
      break;
    }
  }
  if (rowNumber === -1) throw new Error('Registro não encontrado: ' + idValue);

  var current = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  var before = rowsToObjects_(headers, [current])[0];
  var allow = allowedFields || headers;
  Object.keys(patch || {}).forEach(function (key) {
    var column = headers.indexOf(key);
    if (column !== -1 && allow.indexOf(key) !== -1 && key !== idField) {
      current[column] = patch[key] == null ? '' : patch[key];
    }
  });
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([current]);
  return { before: before, after: rowsToObjects_(headers, [current])[0] };
}

function deleteObjectById_(sheetName, idField, idValue) {
  var sheet = getSheetOrThrow_(sheetName);
  var headers = getHeader_(sheet);
  var idColumn = headers.indexOf(idField);
  if (idColumn === -1) throw new Error('Chave ' + idField + ' não existe em ' + sheetName + '.');
  if (sheet.getLastRow() <= 1) return null;

  var idValues = sheet.getRange(2, idColumn + 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (var index = 0; index < idValues.length; index += 1) {
    if (String(idValues[index][0]).trim() !== String(idValue).trim()) continue;
    var rowNumber = index + 2;
    var before = rowsToObjects_(headers, [sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0]])[0];
    sheet.deleteRow(rowNumber);
    return before;
  }
  return null;
}

function upsertObject_(sheetName, idField, object) {
  var existing = getObjectById_(sheetName, idField, object[idField], { raw: true });
  if (existing) {
    return updateObjectById_(sheetName, idField, object[idField], object).after;
  }
  appendObject_(sheetName, object);
  return object;
}

function replaceSheetRows_(sheetName, rows) {
  var sheet = getSheetOrThrow_(sheetName);
  var headers = getHeader_(sheet);
  var matrix = (rows || []).map(function (row) { return objectToRow_(headers, row); });

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), headers.length)).clearContent();
  }
  if (matrix.length) {
    sheet.getRange(2, 1, matrix.length, headers.length).setValues(matrix);
  }
  return matrix.length;
}

function upsertRowsByCompositeKey_(sheetName, rows, keyFields) {
  var existing = getSheetObjects_(sheetName, { raw: true });
  var existingKeys = {};
  existing.forEach(function (row) {
    existingKeys[keyFields.map(function (field) { return String(row[field] || ''); }).join('||')] = true;
  });
  var newRows = rows.filter(function (row) {
    var key = keyFields.map(function (field) { return String(row[field] || ''); }).join('||');
    if (existingKeys[key]) return false;
    existingKeys[key] = true;
    return true;
  });
  if (!newRows.length) return 0;

  var sheet = getSheetOrThrow_(sheetName);
  var headers = getHeader_(sheet);
  var matrix = newRows.map(function (row) { return objectToRow_(headers, row); });
  sheet.getRange(sheet.getLastRow() + 1, 1, matrix.length, headers.length).setValues(matrix);
  return matrix.length;
}
