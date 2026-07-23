'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = path.resolve(__dirname, '..', 'src');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFixture() {
  return {
    TH_CLIENTES: [{
      cliente_id: 'CLI_001',
      nome_empresa: 'Cliente teste',
      status_cliente: 'Ativo'
    }],
    TH_VAGAS: [{
      vaga_id: 'VAG_001',
      cliente_id: 'CLI_001',
      titulo_vaga: 'Analista',
      qtd_posicoes: 1,
      qtd_perfis_enviados: 0,
      status_vaga: 'Em processo'
    }],
    TH_PROCESSOS: [
      {
        processo_id: 'PRO_HIRED',
        vaga_id: 'VAG_001',
        cliente_id: 'CLI_001',
        pessoa_id: 'P_HIRED',
        shortlist_id: 'SHT_001',
        status_processo: 'Contratado'
      },
      {
        processo_id: 'PRO_ACTIVE',
        vaga_id: 'VAG_001',
        cliente_id: 'CLI_001',
        pessoa_id: 'P_ACTIVE',
        shortlist_id: 'SHT_001',
        status_processo: 'Entrevista',
        data_envio_empresa: '2026-07-20T10:00:00-03:00'
      },
      {
        processo_id: 'PRO_WAITING',
        vaga_id: 'VAG_001',
        cliente_id: 'CLI_001',
        pessoa_id: 'P_WAITING',
        shortlist_id: 'SHT_002',
        status_processo: 'Pré-selecionado'
      }
    ],
    TH_SHORTLISTS: [
      { shortlist_id: 'SHT_001', vaga_id: 'VAG_001', status_shortlist: 'Em análise pela empresa' },
      { shortlist_id: 'SHT_002', vaga_id: 'VAG_001', status_shortlist: 'Em montagem' }
    ],
    TH_SHORTLIST_ITENS: [
      { shortlist_item_id: 'SHI_HIRED', shortlist_id: 'SHT_001', vaga_id: 'VAG_001', processo_id: 'PRO_HIRED', status_item: 'Contratado' },
      { shortlist_item_id: 'SHI_ACTIVE', shortlist_id: 'SHT_001', vaga_id: 'VAG_001', processo_id: 'PRO_ACTIVE', status_item: 'Enviado' },
      { shortlist_item_id: 'SHI_WAITING', shortlist_id: 'SHT_002', vaga_id: 'VAG_001', processo_id: 'PRO_WAITING', status_item: 'Incluído' }
    ],
    TH_CONTRATACOES: [{
      contratacao_id: 'CON_001',
      processo_id: 'PRO_HIRED',
      vaga_id: 'VAG_001',
      pessoa_id: 'P_HIRED',
      status_contratacao: 'Em acompanhamento'
    }]
  };
}

const state = createFixture();
let failHireAppend = false;
let failUpdate = null;
const auditLogs = [];
const events = [];
const context = {
  console,
  Date,
  Object,
  Array,
  String,
  Number,
  Math,
  Utilities: { formatDate: date => date.toISOString().slice(0, 10) },
  Session: { getScriptTimeZone: () => 'America/Sao_Paulo' },
  nowIso_: () => '2026-07-23T12:00:00-03:00',
  currentUser_: () => 'teste@serratec.org',
  serializeForClient_: clone,
  valueIsBlank_: value => value === '' || value === null || value === undefined,
  parseDateValue_: value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  },
  assertEnum_: () => {},
  withScriptLock_: callback => callback(),
  regenerateTalentView_: () => {},
  regenerateDashboard_: () => {},
  invalidateMatchingRuns_: () => [],
  getSheetObjects_: sheetName => state[sheetName] || [],
  getObjectById_: (sheetName, idField, idValue) =>
    (state[sheetName] || []).find(row => String(row[idField] || '') === String(idValue)) || null,
  updateObjectById_: (sheetName, idField, idValue, patch) => {
    if (typeof failUpdate === 'function' && failUpdate(sheetName, idValue, patch)) {
      throw new Error(`falha simulada em ${sheetName}`);
    }
    const row = (state[sheetName] || []).find(item => String(item[idField] || '') === String(idValue));
    if (!row) throw new Error(`Registro não encontrado em ${sheetName}: ${idValue}`);
    const before = clone(row);
    Object.assign(row, patch);
    return { before, after: clone(row) };
  },
  appendObject_: (sheetName, row) => {
    if (sheetName === 'TH_CONTRATACOES' && failHireAppend) throw new Error('falha simulada de gravação');
    if (!state[sheetName]) state[sheetName] = [];
    state[sheetName].push(clone(row));
  },
  deleteObjectById_: (sheetName, idField, idValue) => {
    const index = (state[sheetName] || []).findIndex(row => String(row[idField] || '') === String(idValue));
    if (index === -1) return null;
    return state[sheetName].splice(index, 1)[0];
  },
  writeAuditLog_: (action, entity, entityId, field, oldValue, source, note, newValue) => {
    auditLogs.push({ action, entity, entityId, field, oldValue, source, note, newValue });
  },
  writeEntityAudit_: () => {},
  writeEvent_: (type, entity, entityId, related, description, oldStatus, newStatus) => {
    events.push({ type, entity, entityId, related, description, oldStatus, newStatus });
  },
  getDatabaseSchema_: () => ({
    TH_CONTRATACOES: [],
    TH_VAGAS: [
      'vaga_id', 'cliente_id', 'titulo_vaga', 'qtd_posicoes', 'qtd_perfis_enviados',
      'status_vaga', 'motivo_encerramento', 'data_encerramento', 'atualizado_em', 'atualizado_por'
    ]
  }),
  sanitizePayload_: value => clone(value),
  requireFields_: () => {},
  assertNonNegativeNumber_: () => {},
  generateId_: prefix => `${prefix}TEST`
};

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(source, 'ProcessoService.gs'), 'utf8'), context, {
  filename: 'ProcessoService.gs'
});
vm.runInContext(fs.readFileSync(path.join(source, 'VagaService.gs'), 'utf8'), context, {
  filename: 'VagaService.gs'
});
vm.runInContext(fs.readFileSync(path.join(source, 'ShortlistService.gs'), 'utf8'), context, {
  filename: 'ShortlistService.gs'
});
context.countSentProfilesForJob_ = vagaId => state.TH_PROCESSOS.filter(process =>
  String(process.vaga_id) === String(vagaId) &&
  (
    !context.valueIsBlank_(process.data_envio_empresa) ||
    ['Enviado à empresa', 'Aguardando retorno', 'Entrevista', 'Proposta', 'Contratado'].includes(process.status_processo)
  )
).length;

const activeBlock = context.getBlockingTalentEngagement_('P_ACTIVE');
assert.strictEqual(activeBlock.type, 'PROCESSO_ATIVO');
assert.strictEqual(activeBlock.process_id, 'PRO_ACTIVE');

const hiredBlock = context.getBlockingTalentEngagement_('P_HIRED');
assert.strictEqual(hiredBlock.type, 'CONTRATADO');
state.TH_CONTRATACOES[0].status_contratacao = 'Encerrada após 3 meses';
assert.strictEqual(
  context.getBlockingTalentEngagement_('P_HIRED'),
  null,
  'Uma contratação encerrada não deve bloquear novas oportunidades para sempre.'
);
state.TH_CONTRATACOES[0].status_contratacao = 'Em acompanhamento';

assert.throws(
  () => context.validateVagaOperationalUpdate_(
    state.TH_VAGAS[0],
    Object.assign({}, state.TH_VAGAS[0], { cliente_id: 'CLI_002' })
  ),
  /cliente da vaga/
);
assert.throws(
  () => context.validateVagaOperationalUpdate_(
    state.TH_VAGAS[0],
    Object.assign({}, state.TH_VAGAS[0], { qtd_posicoes: 2, status_vaga: 'Preenchida' })
  ),
  /Registre as contratações/
);
assert.throws(
  () => context.validateVagaOperationalUpdate_(
    state.TH_VAGAS[0],
    Object.assign({}, state.TH_VAGAS[0], { status_vaga: 'Encerrada sem contratação' })
  ),
  /deve ser encerrada como Preenchida/
);

const vacancyCountBeforeInvalidCreations = state.TH_VAGAS.length;
['Shortlist enviada', 'Em processo', 'Preenchida', 'Encerrada sem contratação', 'Cancelada'].forEach(status => {
  assert.throws(
    () => context.createVaga({
      cliente_id: 'CLI_001',
      titulo_vaga: 'Vaga inválida',
      status_vaga: status
    }),
    /nova vaga só pode iniciar/
  );
});
assert.strictEqual(
  state.TH_VAGAS.length,
  vacancyCountBeforeInvalidCreations,
  'Status incompatível com uma vaga nova não pode gerar registro.'
);
assert.doesNotThrow(() => context.validateVagaCreation_({
  status_vaga: 'Aberta',
  qtd_perfis_enviados: 0,
  rodada_atual: 1
}));
assert.throws(
  () => context.validateVagaCreation_({
    status_vaga: 'Aberta',
    qtd_perfis_enviados: 1,
    rodada_atual: 1
  }),
  /perfis enviados/
);
assert.throws(
  () => context.validateVagaCreation_({
    status_vaga: 'Aberta',
    qtd_perfis_enviados: 0,
    rodada_atual: 0
  }),
  /primeira rodada/
);

state.TH_PROCESSOS.push({
  processo_id: 'PRO_FAIL',
  vaga_id: 'VAG_001',
  cliente_id: 'CLI_001',
  pessoa_id: 'P_FAIL',
  shortlist_id: 'SHT_002',
  status_processo: 'Proposta'
});
state.TH_SHORTLIST_ITENS.push({
  shortlist_item_id: 'SHI_FAIL',
  shortlist_id: 'SHT_002',
  vaga_id: 'VAG_001',
  processo_id: 'PRO_FAIL',
  status_item: 'Enviado'
});
failHireAppend = true;
assert.throws(
  () => context.updateProcessoStatus('PRO_FAIL', 'Contratado', { data_contratacao: '2026-07-23' }),
  /revertida integralmente/
);
failHireAppend = false;
assert.strictEqual(
  state.TH_PROCESSOS.find(row => row.processo_id === 'PRO_FAIL').status_processo,
  'Proposta'
);
assert.strictEqual(
  state.TH_SHORTLIST_ITENS.find(row => row.processo_id === 'PRO_FAIL').status_item,
  'Enviado'
);
state.TH_PROCESSOS = state.TH_PROCESSOS.filter(row => row.processo_id !== 'PRO_FAIL');
state.TH_SHORTLIST_ITENS = state.TH_SHORTLIST_ITENS.filter(row => row.processo_id !== 'PRO_FAIL');

state.TH_PROCESSOS.push({
  processo_id: 'PRO_ITEM_FAIL',
  vaga_id: 'VAG_001',
  cliente_id: 'CLI_001',
  pessoa_id: 'P_ITEM_FAIL',
  shortlist_id: 'SHT_002',
  status_processo: 'Proposta'
});
state.TH_SHORTLIST_ITENS.push({
  shortlist_item_id: 'SHI_ITEM_FAIL',
  shortlist_id: 'SHT_002',
  vaga_id: 'VAG_001',
  processo_id: 'PRO_ITEM_FAIL',
  status_item: 'Enviado'
});
let itemFailureRaised = false;
failUpdate = (sheetName, idValue) => {
  if (!itemFailureRaised && sheetName === 'TH_SHORTLIST_ITENS' && String(idValue) === 'SHI_ITEM_FAIL') {
    itemFailureRaised = true;
    return true;
  }
  return false;
};
assert.throws(
  () => context.updateProcessoStatus('PRO_ITEM_FAIL', 'Contratado', { data_contratacao: '2026-07-23' }),
  /revertida integralmente/
);
failUpdate = null;
assert.strictEqual(
  state.TH_PROCESSOS.find(row => row.processo_id === 'PRO_ITEM_FAIL').status_processo,
  'Proposta'
);
assert.strictEqual(
  state.TH_SHORTLIST_ITENS.find(row => row.processo_id === 'PRO_ITEM_FAIL').status_item,
  'Enviado'
);
assert.strictEqual(
  state.TH_CONTRATACOES.some(row => row.processo_id === 'PRO_ITEM_FAIL'),
  false
);
state.TH_PROCESSOS = state.TH_PROCESSOS.filter(row => row.processo_id !== 'PRO_ITEM_FAIL');
state.TH_SHORTLIST_ITENS = state.TH_SHORTLIST_ITENS.filter(row => row.processo_id !== 'PRO_ITEM_FAIL');

let substitutionFailureRaised = false;
failUpdate = (sheetName, idValue, patch) => {
  if (!substitutionFailureRaised &&
    sheetName === 'TH_CONTRATACOES' &&
    String(idValue) === 'CON_001' &&
    patch.status_contratacao === 'Substituída') {
    substitutionFailureRaised = true;
    return true;
  }
  return false;
};
assert.throws(
  () => context.updateProcessoStatus('PRO_HIRED', 'Substituído', {}),
  /revertida integralmente/
);
failUpdate = null;
assert.strictEqual(
  state.TH_PROCESSOS.find(row => row.processo_id === 'PRO_HIRED').status_processo,
  'Contratado'
);
assert.strictEqual(state.TH_CONTRATACOES[0].status_contratacao, 'Em acompanhamento');

state.TH_PROCESSOS.push({
  processo_id: 'PRO_WAITING_2',
  vaga_id: 'VAG_001',
  cliente_id: 'CLI_001',
  pessoa_id: 'P_WAITING_2',
  shortlist_id: 'SHT_002',
  status_processo: 'Pré-selecionado'
});
state.TH_SHORTLIST_ITENS.push({
  shortlist_item_id: 'SHI_WAITING_2',
  shortlist_id: 'SHT_002',
  vaga_id: 'VAG_001',
  processo_id: 'PRO_WAITING_2',
  status_item: 'Incluído'
});
let cascadeFailureRaised = false;
const auditsBeforeCascadeFailure = auditLogs.length;
const eventsBeforeCascadeFailure = events.length;
failUpdate = (sheetName, idValue, patch) => {
  if (!cascadeFailureRaised &&
    sheetName === 'TH_PROCESSOS' &&
    String(idValue) === 'PRO_WAITING_2' &&
    patch.status_processo === 'Enviado à empresa') {
    cascadeFailureRaised = true;
    return true;
  }
  return false;
};
assert.throws(
  () => context.updateShortlistStatus('SHT_002', 'Enviada', {}),
  /revertida integralmente/
);
failUpdate = null;
assert.strictEqual(
  state.TH_SHORTLISTS.find(row => row.shortlist_id === 'SHT_002').status_shortlist,
  'Em montagem'
);
assert.strictEqual(
  state.TH_PROCESSOS.find(row => row.processo_id === 'PRO_WAITING').status_processo,
  'Pré-selecionado'
);
assert.strictEqual(
  state.TH_PROCESSOS.find(row => row.processo_id === 'PRO_WAITING_2').status_processo,
  'Pré-selecionado'
);
assert.strictEqual(
  state.TH_SHORTLIST_ITENS.find(row => row.processo_id === 'PRO_WAITING').status_item,
  'Incluído'
);
assert.strictEqual(events.length, eventsBeforeCascadeFailure, 'Eventos de uma cascata revertida não podem ser persistidos.');
assert.strictEqual(
  auditLogs.slice(auditsBeforeCascadeFailure).some(log => log.newValue === 'Enviado à empresa'),
  false,
  'Audit logs não podem afirmar uma transição revertida.'
);

state.TH_VAGAS.push({
  vaga_id: 'VAG_TX',
  cliente_id: 'CLI_001',
  titulo_vaga: 'Vaga transacional',
  qtd_posicoes: 1,
  status_vaga: 'Em processo'
});
state.TH_PROCESSOS.push({
  processo_id: 'PRO_TX',
  vaga_id: 'VAG_TX',
  cliente_id: 'CLI_001',
  pessoa_id: 'P_TX',
  shortlist_id: 'SHT_TX',
  status_processo: 'Entrevista'
});
state.TH_SHORTLISTS.push({
  shortlist_id: 'SHT_TX',
  vaga_id: 'VAG_TX',
  cliente_id: 'CLI_001',
  status_shortlist: 'Em análise pela empresa'
});
state.TH_SHORTLIST_ITENS.push({
  shortlist_item_id: 'SHI_TX',
  shortlist_id: 'SHT_TX',
  vaga_id: 'VAG_TX',
  processo_id: 'PRO_TX',
  status_item: 'Enviado'
});
let vacancyClosureFailureRaised = false;
failUpdate = (sheetName, idValue, patch) => {
  if (!vacancyClosureFailureRaised &&
    sheetName === 'TH_PROCESSOS' &&
    String(idValue) === 'PRO_TX' &&
    patch.status_processo === 'Liberado') {
    vacancyClosureFailureRaised = true;
    return true;
  }
  return false;
};
assert.throws(
  () => context.updateVaga('VAG_TX', {
    cliente_id: 'CLI_001',
    titulo_vaga: 'Vaga transacional',
    qtd_posicoes: 1,
    status_vaga: 'Cancelada',
    motivo_encerramento: 'Teste de rollback'
  }),
  /revertida integralmente/
);
failUpdate = null;
assert.strictEqual(state.TH_VAGAS.find(row => row.vaga_id === 'VAG_TX').status_vaga, 'Em processo');
assert.strictEqual(state.TH_PROCESSOS.find(row => row.processo_id === 'PRO_TX').status_processo, 'Entrevista');
assert.strictEqual(state.TH_SHORTLISTS.find(row => row.shortlist_id === 'SHT_TX').status_shortlist, 'Em análise pela empresa');

let removeFailureRaised = false;
failUpdate = (sheetName, idValue, patch) => {
  if (!removeFailureRaised &&
    sheetName === 'TH_PROCESSOS' &&
    String(idValue) === 'PRO_WAITING_2' &&
    patch.status_processo === 'Liberado') {
    removeFailureRaised = true;
    return true;
  }
  return false;
};
assert.throws(
  () => context.removeShortlistItem('SHI_WAITING_2', { motivo: 'Teste de rollback' }),
  /revertida integralmente/
);
failUpdate = null;
assert.strictEqual(
  state.TH_SHORTLIST_ITENS.find(row => row.shortlist_item_id === 'SHI_WAITING_2').status_item,
  'Incluído'
);
assert.strictEqual(
  state.TH_PROCESSOS.find(row => row.processo_id === 'PRO_WAITING_2').status_processo,
  'Pré-selecionado'
);

context.updateVacancyFromProcesses_('VAG_001', context.nowIso_(), context.currentUser_());

assert.strictEqual(state.TH_VAGAS[0].status_vaga, 'Preenchida');
assert.strictEqual(state.TH_PROCESSOS.find(row => row.processo_id === 'PRO_HIRED').status_processo, 'Contratado');
assert.strictEqual(state.TH_PROCESSOS.find(row => row.processo_id === 'PRO_ACTIVE').status_processo, 'Liberado');
assert.strictEqual(state.TH_PROCESSOS.find(row => row.processo_id === 'PRO_WAITING').status_processo, 'Liberado');
assert.strictEqual(state.TH_PROCESSOS.find(row => row.processo_id === 'PRO_WAITING_2').status_processo, 'Liberado');
assert.strictEqual(state.TH_SHORTLIST_ITENS.find(row => row.processo_id === 'PRO_ACTIVE').status_item, 'Liberado');
assert.strictEqual(state.TH_SHORTLISTS[0].status_shortlist, 'Concluída');
assert.strictEqual(state.TH_SHORTLISTS[1].status_shortlist, 'Concluída');
assert.throws(
  () => context.removeShortlistItem('SHI_WAITING_2', { motivo: 'Alteração indevida' }),
  /concluída ou cancelada/
);

context.updateProcessoStatus('PRO_HIRED', 'Substituído', {});
assert.strictEqual(state.TH_CONTRATACOES[0].status_contratacao, 'Substituída');
assert.strictEqual(
  state.TH_PROCESSOS.find(row => row.processo_id === 'PRO_HIRED').status_processo,
  'Substituído'
);
assert.strictEqual(
  state.TH_SHORTLIST_ITENS.find(row => row.processo_id === 'PRO_HIRED').status_item,
  'Substituído'
);
assert.strictEqual(context.getBlockingTalentEngagement_('P_HIRED'), null);
assert.strictEqual(state.TH_VAGAS[0].status_vaga, 'Aberta');
assert.strictEqual(state.TH_VAGAS[0].data_encerramento, '');

console.log('Fluxo operacional crítico validado com sucesso.');
