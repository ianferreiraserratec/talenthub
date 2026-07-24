'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = path.resolve(__dirname, '..', 'src');
const service = fs.readFileSync(path.join(source, 'MvpService.gs'), 'utf8');
const ui = fs.readFileSync(path.join(source, 'Mvp.html'), 'utf8');
const client = fs.readFileSync(path.join(source, 'MvpScripts.html'), 'utf8');

const context = {};
vm.createContext(context);
vm.runInContext(service, context, { filename: 'MvpService.gs' });

assert.deepStrictEqual(
  Array.from(context.getAllowedIndicationTransitions_('Em análise')),
  ['Enviado', 'Liberado']
);
assert.deepStrictEqual(
  Array.from(context.getAllowedIndicationTransitions_('Entrevista')),
  ['Contratado', 'Liberado']
);
assert.deepStrictEqual(
  Array.from(context.getAllowedIndicationTransitions_('Contratado')),
  []
);
assert.match(service, /mvpRefreshJobStatus_/);
assert.match(service, /mvpReleaseActiveIndications_/);
assert.match(service, /pageSize/);
assert.match(service, /mvpGetAvailableTalents/);
assert.match(service, /clean\.qtd_posicoes < hired/);
assert.match(service, /indications\.length/);
assert.match(service, /hired < clean\.qtd_posicoes/);
assert.doesNotMatch(ui, /Matchmaking|Integrações|Shortlist/);
assert.match(ui, /Audit Logs/);
assert.match(ui, /Contato principal/);
assert.match(client, /menu-toggle/);
assert.match(client, /Promise\.all/);

function createState(job, indications) {
  const state = {
    TH_VAGAS: [Object.assign({}, job)],
    TH_INDICACOES: indications.map(item => Object.assign({}, item))
  };
  context.getSheetObjects_ = name => state[name].map(row => Object.assign({}, row));
  context.getObjectById_ = (name, field, id) => {
    const row = state[name].find(item => String(item[field]) === String(id));
    return row ? Object.assign({}, row) : null;
  };
  context.updateObjectById_ = (name, field, id, patch) => {
    const index = state[name].findIndex(item => String(item[field]) === String(id));
    const before = Object.assign({}, state[name][index]);
    state[name][index] = Object.assign({}, state[name][index], patch);
    return { before, after: Object.assign({}, state[name][index]) };
  };
  context.currentUser_ = () => 'tester@serratec.org';
  context.writeEntityAudit_ = () => {};
  return state;
}

let state = createState(
  { vaga_id: 'V1', status_vaga: 'Em processo', qtd_posicoes: 1 },
  []
);
context.mvpRefreshJobStatus_('V1', '2026-07-24T12:00:00Z');
assert.strictEqual(state.TH_VAGAS[0].status_vaga, 'Aberta');

state = createState(
  { vaga_id: 'V1', status_vaga: 'Aberta', qtd_posicoes: 1 },
  [{ indicacao_id: 'I1', vaga_id: 'V1', status_indicacao: 'Em análise' }]
);
context.mvpRefreshJobStatus_('V1', '2026-07-24T12:00:00Z');
assert.strictEqual(state.TH_VAGAS[0].status_vaga, 'Em processo');

state = createState(
  { vaga_id: 'V1', status_vaga: 'Em processo', qtd_posicoes: 1 },
  [
    { indicacao_id: 'I1', vaga_id: 'V1', status_indicacao: 'Contratado' },
    { indicacao_id: 'I2', vaga_id: 'V1', status_indicacao: 'Entrevista', observacoes: '' }
  ]
);
context.mvpRefreshJobStatus_('V1', '2026-07-24T12:00:00Z');
assert.strictEqual(state.TH_VAGAS[0].status_vaga, 'Preenchida');
assert.strictEqual(state.TH_INDICACOES[1].status_indicacao, 'Liberado');
console.log('Regras do MVP verificadas.');
