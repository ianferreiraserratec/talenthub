'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const source = path.resolve(__dirname, '..', 'src');
const service = fs.readFileSync(path.join(source, 'MvpService.gs'), 'utf8');
const ui = fs.readFileSync(path.join(source, 'Mvp.html'), 'utf8');

assert.match(service, /Somente talentos aptos e disponíveis podem ser indicados/);
assert.match(service, /Já existe uma indicação ativa desse talento para esta vaga/);
assert.match(service, /'Em análise': \['Enviado', 'Liberado'\]/);
assert.match(service, /Entrevista: \['Contratado', 'Liberado'\]/);
assert.match(service, /mvpRefreshJobAfterHire_/);
assert.doesNotMatch(ui, /Matchmaking|Integrações|Shortlist/);
assert.match(ui, /Audit Logs/);
console.log('Regras do MVP verificadas.');
