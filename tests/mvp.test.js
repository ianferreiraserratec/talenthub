'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = path.resolve(__dirname, '..', 'src');
const service = fs.readFileSync(path.join(source, 'MvpService.gs'), 'utf8');
const dashboard = fs.readFileSync(path.join(source, 'DashboardService.gs'), 'utf8');
const audit = fs.readFileSync(path.join(source, 'AuditService.gs'), 'utf8');
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
assert.match(service, /mvpRefreshTalentStatus_/);
assert.match(service, /mvpSaveClientWithContact/);
assert.match(service, /clean\.qtd_posicoes < hired/);
assert.match(service, /indications\.length/);
assert.match(service, /hired < clean\.qtd_posicoes/);
assert.doesNotMatch(service.match(/function mvpCreateIndication[\s\S]*?function mvpUpdateIndication/)[0], /regenerateTalentView_|regenerateDashboard_/);
assert.doesNotMatch(service.match(/function mvpUpdateIndication[\s\S]*?function getAllowedIndicationTransitions_/)[0], /regenerateTalentView_|regenerateDashboard_/);
assert.doesNotMatch(ui, /Matchmaking|Integrações|Shortlist/);
assert.match(ui, /Audit Logs/);
assert.match(ui, /Contato principal/);
assert.match(ui, /loading-progress/);
assert.match(client, /menu-toggle/);
assert.match(client, /Promise\.all/);
assert.match(client, /class="primary-cell"/);
assert.match(client, /function formBusy/);
assert.match(client, /function tableBusy/);
assert.match(client, /loadingCount/);
assert.match(client, /mvpSaveClientWithContact/);
assert.match(dashboard, /function buildDashboardRows_/);
assert.match(dashboard.match(/function getDashboard[\s\S]*$/)[0], /buildDashboardRows_/);
assert.match(audit, /appendObjects_\('TH_AUDIT_LOGS', rows\)/);

function createState(job, indications, talents) {
  const state = {
    TH_VAGAS: [Object.assign({}, job)],
    TH_INDICACOES: indications.map(item => Object.assign({}, item)),
    VW_TALENTOS_APTOS: (talents || []).map(item => Object.assign({}, item))
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
  context.normalizeBoolean_ = value => {
    if (value === true || String(value || '').toUpperCase() === 'SIM') return true;
    if (value === false || String(value || '').toUpperCase() === 'NAO') return false;
    return null;
  };
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

state = createState(
  { vaga_id: 'V1', status_vaga: 'Em processo', qtd_posicoes: 1 },
  [{ indicacao_id: 'I1', vaga_id: 'V1', pessoa_id: 'P1', status_indicacao: 'Em análise' }],
  [{ pessoa_id: 'P1', apto_talent_hub: 'SIM', cadastro_atualizado_90d: 'SIM', disponivel_para_oportunidades: 'SIM', status_pool: 'Disponível', processos_ativos: 0 }]
);
context.mvpRefreshTalentStatus_('P1', state.TH_INDICACOES);
assert.strictEqual(state.VW_TALENTOS_APTOS[0].status_pool, 'Em processo');
assert.strictEqual(state.VW_TALENTOS_APTOS[0].processos_ativos, 1);

state.TH_INDICACOES[0].status_indicacao = 'Liberado';
context.mvpRefreshTalentStatus_('P1', state.TH_INDICACOES);
assert.strictEqual(state.VW_TALENTOS_APTOS[0].status_pool, 'Disponível');
assert.strictEqual(state.VW_TALENTOS_APTOS[0].processos_ativos, 0);

state.TH_INDICACOES[0].status_indicacao = 'Contratado';
context.mvpRefreshTalentStatus_('P1', state.TH_INDICACOES);
assert.strictEqual(state.VW_TALENTOS_APTOS[0].status_pool, 'Contratado');
console.log('Regras do MVP verificadas.');
