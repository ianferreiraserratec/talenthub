'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = path.resolve(__dirname, '..', 'src');
const today = new Date().toISOString();
const state = {
  TH_VAGAS: [{
    vaga_id: 'VAG_001',
    cliente_id: 'CLI_001',
    titulo_vaga: 'Analista de Dados',
    status_vaga: 'Aberta',
    qtd_posicoes: 1,
    rodada_atual: 1,
    area_vaga: 'Dados'
  }],
  TH_MATCHING_RUNS: [
    { run_id: 'RUN_001', vaga_id: 'VAG_001', modelo_id: 'MOD_001', status_run: 'Concluído' },
    { run_id: 'RUN_002', vaga_id: 'VAG_001', modelo_id: 'MOD_001', status_run: 'Concluído' }
  ],
  TH_MATCHING_RESULTADOS: [
    { resultado_id: 'RES_001', run_id: 'RUN_001', vaga_id: 'VAG_001', pessoa_id: 'P_001', recomendado: 'SIM', status_resultado: 'Recomendado', score_total: 92 },
    { resultado_id: 'RES_002', run_id: 'RUN_001', vaga_id: 'VAG_001', pessoa_id: 'P_002', recomendado: 'NAO', status_resultado: 'Descartado', score_total: 55 },
    { resultado_id: 'RES_003', run_id: 'RUN_001', vaga_id: 'VAG_001', pessoa_id: 'P_003', recomendado: 'NAO', status_resultado: 'Descartado', criterios_exclusao: 'Critério eliminatório', score_total: 0 },
    { resultado_id: 'RES_004', run_id: 'RUN_001', vaga_id: 'VAG_001', pessoa_id: 'P_004', recomendado: 'SIM', status_resultado: 'Recomendado', score_total: 80 },
    { resultado_id: 'RES_005', run_id: 'RUN_002', vaga_id: 'VAG_001', pessoa_id: 'P_005', recomendado: 'SIM', status_resultado: 'Recomendado', score_total: 79 }
  ],
  VW_TALENTOS_APTOS: [],
  TH_CACHE_PESSOAS: [],
  TALENT_HUB_STATUS_TERMO: [],
  TH_MATCHING_MODELOS: [{
    modelo_id: 'MOD_001',
    ativo: 'SIM',
    normalizar_para_100: 'SIM',
    score_minimo_recomendado: 60
  }],
  TH_MATCHING_MODELO_CRITERIOS: [],
  TH_VAGA_CRITERIOS: [],
  TH_PROCESSOS: [],
  TH_CONTRATACOES: [],
  TH_SHORTLISTS: [],
  TH_SHORTLIST_ITENS: []
};

['P_001', 'P_002', 'P_003', 'P_004', 'P_005'].forEach(personId => {
  state.VW_TALENTOS_APTOS.push({
    pessoa_id: personId,
    apto_talent_hub: 'SIM',
    status_pool: 'Disponível',
    area_interesse_principal: 'Dados',
    pcd_bol: 'NAO'
  });
  state.TH_CACHE_PESSOAS.push({ pessoa_id: personId, atualizado_em: today });
  state.TALENT_HUB_STATUS_TERMO.push({ pessoa_id: personId, status: 'ATIVO', atualizado_em: today });
});

let idSequence = 0;
let failItemBatchOnce = false;
let failVacancyUpdateOnce = false;
const clone = value => JSON.parse(JSON.stringify(value));
const context = {
  console,
  Date,
  Object,
  Array,
  String,
  Number,
  Math,
  Utilities: {
    formatDate: date => date.toISOString(),
    getUuid: () => String(++idSequence).padStart(16, '0')
  },
  Session: {
    getScriptTimeZone: () => 'America/Sao_Paulo',
    getActiveUser: () => ({ getEmail: () => 'teste@serratec.org' })
  },
  LockService: {
    getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} })
  },
  getSheetObjects_: sheetName => state[sheetName] || [],
  getObjectById_: (sheetName, idField, idValue) =>
    (state[sheetName] || []).find(row => String(row[idField] || '') === String(idValue)) || null,
  appendObject_: (sheetName, row) => {
    if (!state[sheetName]) state[sheetName] = [];
    state[sheetName].push(clone(row));
    return row;
  },
  appendObjects_: (sheetName, rows) => {
    if (sheetName === 'TH_SHORTLIST_ITENS' && failItemBatchOnce) {
      failItemBatchOnce = false;
      throw new Error('falha simulada no lote de itens');
    }
    if (!state[sheetName]) state[sheetName] = [];
    rows.forEach(row => state[sheetName].push(clone(row)));
    return rows.length;
  },
  updateObjectById_: (sheetName, idField, idValue, patch) => {
    if (sheetName === 'TH_VAGAS' && failVacancyUpdateOnce) {
      failVacancyUpdateOnce = false;
      throw new Error('falha simulada ao atualizar a vaga');
    }
    const row = (state[sheetName] || []).find(item => String(item[idField] || '') === String(idValue));
    if (!row) throw new Error(`Registro não encontrado em ${sheetName}: ${idValue}`);
    const before = clone(row);
    Object.assign(row, patch);
    return { before, after: clone(row) };
  },
  deleteObjectById_: (sheetName, idField, idValue) => {
    const index = (state[sheetName] || []).findIndex(row => String(row[idField] || '') === String(idValue));
    if (index === -1) return null;
    return state[sheetName].splice(index, 1)[0];
  },
  getConfigMap_: () => ({ DIAS_CADASTRO_VALIDO: 90, TERMO_STATUS_VALIDO: 'ATIVO' }),
  indexBy_: (sheetName, keyField) => {
    const index = {};
    (state[sheetName] || []).forEach(row => { index[String(row[keyField] || '')] = row; });
    return index;
  },
  indexLatestBy_: (sheetName, keyField) => {
    const index = {};
    (state[sheetName] || []).forEach(row => { index[String(row[keyField] || '')] = row; });
    return index;
  },
  writeAuditLog_: () => {},
  writeEntityAudit_: () => {},
  writeEvent_: () => {},
  parseMoney_: value => {
    if (value === '' || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  },
  regenerateTalentView_: () => {},
  regenerateDashboard_: () => {}
};

vm.createContext(context);
['Utils.gs', 'Validation.gs', 'MatchingService.gs', 'ProcessoService.gs', 'ShortlistService.gs'].forEach(file => {
  vm.runInContext(fs.readFileSync(path.join(source, file), 'utf8'), context, { filename: file });
});
context.nowIso_ = () => '2026-07-23T12:00:00-03:00';
context.currentUser_ = () => 'teste@serratec.org';
context.generateId_ = prefix => `${prefix}${String(++idSequence).padStart(4, '0')}`;

const created = context.createShortlistFromResults('VAG_001', ['RES_001', 'RES_002'], { rodada: 1 });
assert.strictEqual(created.shortlist.status_shortlist, 'Em montagem');
assert.strictEqual(created.processos.length, 2);
assert.strictEqual(created.processos[0].origem, 'Matchmaking');
assert.strictEqual(created.processos[1].origem, 'Manual');
assert.strictEqual(created.itens[0].score_total, 0, 'A shortlist deve persistir o score recalculado, não o score histórico do run.');
assert.match(created.itens[0].justificativa_match, /Aderência de 0,0%/);
assert.strictEqual(created.itens[1].score_total, 0, 'A seleção curatorial abaixo do corte também deve usar a avaliação corrente.');
assert.strictEqual(state.TH_MATCHING_RESULTADOS.find(row => row.resultado_id === 'RES_001').status_resultado, 'Selecionado para shortlist');
assert.strictEqual(state.TH_MATCHING_RESULTADOS.find(row => row.resultado_id === 'RES_002').status_resultado, 'Selecionado para shortlist');

assert.throws(
  () => context.createShortlistFromResults('VAG_001', ['RES_004'], { rodada: 1 }),
  /Já existe uma shortlist/
);
assert.throws(
  () => context.createShortlistFromResults('VAG_001', ['RES_004', 'RES_005'], { rodada: 2 }),
  /mesma execução/
);
assert.throws(
  () => context.createShortlistFromResults('VAG_001', ['RES_003'], { rodada: 2 }),
  /eliminado por critério/
);

state.TH_VAGA_CRITERIOS.push({
  vaga_criterio_id: 'CRT_001',
  vaga_id: 'VAG_001',
  criterio_nome: 'Vaga exclusiva para PcD',
  campo_talento: 'pcd_bol',
  tipo_regra: 'Exclusivo',
  operador: 'igual',
  valor_esperado: 'SIM',
  ativo: 'SIM'
});
assert.throws(
  () => context.createShortlistFromResults('VAG_001', ['RES_004'], { rodada: 2 }),
  /critérios eliminatórios atuais/
);
state.TH_VAGA_CRITERIOS.length = 0;

failItemBatchOnce = true;
assert.throws(
  () => context.createShortlistFromResults('VAG_001', ['RES_004'], { rodada: 2 }),
  /operação foi compensada/
);
const compensatedShortlist = state.TH_SHORTLISTS.find(row => Number(row.rodada) === 2);
const compensatedProcess = state.TH_PROCESSOS.find(row => row.resultado_id === 'RES_004');
assert.strictEqual(compensatedShortlist.status_shortlist, 'Cancelada');
assert.strictEqual(compensatedProcess.status_processo, 'Liberado');
assert.strictEqual(state.TH_MATCHING_RESULTADOS.find(row => row.resultado_id === 'RES_004').status_resultado, 'Recomendado');

failVacancyUpdateOnce = true;
assert.throws(
  () => context.createShortlistFromResults('VAG_001', ['RES_005'], { rodada: 3 }),
  /operação foi compensada/
);
assert.strictEqual(
  state.TH_MATCHING_RESULTADOS.find(row => row.resultado_id === 'RES_005').status_resultado,
  'Recomendado'
);
assert.strictEqual(
  state.TH_SHORTLISTS.find(row => Number(row.rodada) === 3).status_shortlist,
  'Cancelada'
);

console.log('Criação e compensação de shortlist validadas com sucesso.');
