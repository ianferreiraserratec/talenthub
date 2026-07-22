'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = path.resolve(__dirname, '..', 'src');
const context = {
  console,
  Date,
  Object,
  Array,
  String,
  Number,
  Math,
  Utilities: { formatDate: date => date.toISOString() },
  Session: { getScriptTimeZone: () => 'America/Sao_Paulo' }
};
vm.createContext(context);
['Utils.gs', 'SyncService.gs', 'DashboardService.gs'].forEach(file => {
  vm.runInContext(fs.readFileSync(path.join(source, file), 'utf8'), context, { filename: file });
});

assert.strictEqual(context.normalizeText_('  JÚNIOR  '), 'junior');
assert.strictEqual(context.normalizeBoolean_('SIM'), true);
assert.strictEqual(context.normalizeBoolean_('não'), false);
assert.strictEqual(context.daysSince_('01/07/2026', new Date(2026, 6, 22)), 21);
assert.strictEqual(context.isDateWithinDays_('01/07/2026', 90, new Date(2026, 6, 22)), true);
assert.strictEqual(context.isDateWithinDays_('01/01/2026', 90, new Date(2026, 6, 22)), false);

assert.strictEqual(context.derivePoolStatus_(false, {}, [], false), 'Inelegível');
assert.strictEqual(context.derivePoolStatus_(true, {}, [], true), 'Contratado');
assert.strictEqual(context.derivePoolStatus_(true, {}, [{ status_processo: 'Bloqueado' }], false), 'Bloqueado');
assert.strictEqual(context.derivePoolStatus_(true, {}, [{ status_processo: 'Entrevista' }], false), 'Em processo');
assert.strictEqual(context.derivePoolStatus_(true, { status_pool: 'Carência' }, [], false), 'Carência');
assert.strictEqual(context.derivePoolStatus_(true, { disponivel_para_oportunidades: 'NÃO' }, [], false), 'Inativo');
assert.strictEqual(context.derivePoolStatus_(true, {}, [], false), 'Disponível');

assert.strictEqual(context.parseMoney_('R$ 8.500,50'), 8500.5);
assert.strictEqual(context.parseMoney_(12000), 12000);
assert.strictEqual(context.parseMoney_(''), null);

console.log('Regras centrais validadas com sucesso.');
