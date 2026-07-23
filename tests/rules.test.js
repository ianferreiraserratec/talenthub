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
['Utils.gs', 'Validation.gs', 'SyncService.gs', 'DashboardService.gs', 'MatchingService.gs', 'ProcessoService.gs', 'ShortlistService.gs'].forEach(file => {
  vm.runInContext(fs.readFileSync(path.join(source, file), 'utf8'), context, { filename: file });
});

assert.strictEqual(context.normalizeText_('  JÚNIOR  '), 'junior');
assert.strictEqual(context.normalizeBoolean_('SIM'), true);
assert.strictEqual(context.normalizeBoolean_('não'), false);
assert.strictEqual(context.daysSince_('01/07/2026', new Date(2026, 6, 22)), 21);
assert.strictEqual(context.isDateWithinDays_('01/07/2026', 90, new Date(2026, 6, 22)), true);
assert.strictEqual(context.isDateWithinDays_('01/01/2026', 90, new Date(2026, 6, 22)), false);

assert.strictEqual(context.derivePoolStatus_(false, {}, [], false), 'Inelegível');
assert.strictEqual(
  context.derivePoolStatus_(false, {}, [], false, 'CADASTRO_DESATUALIZADO'),
  'Inativo'
);
assert.strictEqual(
  context.derivePoolStatus_(false, {}, [], false, 'TERMO_CANCELADO_OU_INEXISTENTE'),
  'Inelegível'
);
assert.strictEqual(
  context.derivePoolStatus_(false, {}, [{ status_processo: 'Entrevista' }], false, 'CADASTRO_DESATUALIZADO'),
  'Em processo'
);
assert.strictEqual(
  context.derivePoolStatus_(false, {}, [], true, 'CADASTRO_DESATUALIZADO'),
  'Contratado'
);
assert.strictEqual(context.derivePoolStatus_(true, {}, [], true), 'Contratado');
assert.strictEqual(context.derivePoolStatus_(true, {}, [{ status_processo: 'Bloqueado' }], false), 'Bloqueado');
assert.strictEqual(context.derivePoolStatus_(true, {}, [{ status_processo: 'Entrevista' }], false), 'Em processo');
assert.strictEqual(context.derivePoolStatus_(true, { status_pool: 'Carência' }, [], false), 'Carência');
assert.strictEqual(context.derivePoolStatus_(true, { disponivel_para_oportunidades: 'NÃO' }, [], false), 'Inativo');
assert.strictEqual(context.derivePoolStatus_(true, {}, [], false), 'Disponível');

assert.strictEqual(context.parseMoney_('R$ 8.500,50'), 8500.5);
assert.strictEqual(context.parseMoney_(12000), 12000);
assert.strictEqual(context.parseMoney_(''), null);

const job = {
  area_vaga: 'Dados',
  senioridade: 'Júnior',
  modalidade: 'Remoto',
  cidade: 'Petrópolis',
  uf: 'RJ',
  faixa_salarial_min: 3000,
  faixa_salarial_max: 4500,
  requisitos_obrigatorios: 'Python; SQL'
};
const talent = {
  pessoa_id: 'P_001',
  nome: 'Talento Teste',
  area_interesse_principal: 'Dados',
  senioridade: 'Júnior',
  modalidade_preferida: 'Remoto; Híbrido',
  regioes_interesse: 'Petrópolis; Rio de Janeiro',
  pretensao_salarial_min: 3500,
  pretensao_salarial_max: 5000,
  principais_competencias: 'Python; SQL; Power BI',
  genero: 'Feminino',
  pcd_bol: 'NÃO'
};
const modelCriteria = [
  { criterio_nome: 'Área', campo_talento: 'area_interesse_principal', campo_vaga: 'area_vaga', tipo_comparacao: 'igual', peso: 30 },
  { criterio_nome: 'Competências', campo_talento: 'principais_competencias', campo_vaga: 'requisitos_obrigatorios', tipo_comparacao: 'intersecao_lista', peso: 40 },
  { criterio_nome: 'Salário', campo_talento: 'pretensao_salarial_min/pretensao_salarial_max', campo_vaga: 'faixa_salarial_min/faixa_salarial_max', tipo_comparacao: 'salario_compativel', peso: 30 }
];

const baseEvaluation = context.evaluateTalentForJob_(talent, job, modelCriteria, [], { normalizar_para_100: 'SIM' });
assert.strictEqual(baseEvaluation.eliminado, false);
assert.strictEqual(baseEvaluation.score_total, 100);
assert.strictEqual(baseEvaluation.score_diversidade, 0, 'Diversidade não deve pontuar sem critério explícito da vaga.');

const priorityEvaluation = context.evaluateTalentForJob_(talent, job, modelCriteria, [
  { criterio_nome: 'Prioridade para mulheres', campo_talento: 'genero', tipo_regra: 'Prioritário', operador: 'igual', valor_esperado: 'Feminino', peso_override: 20 }
], { normalizar_para_100: 'SIM' });
assert.strictEqual(priorityEvaluation.eliminado, false);
assert.strictEqual(priorityEvaluation.score_total, 100);
assert.strictEqual(priorityEvaluation.score_diversidade, 20);

const exclusiveEvaluation = context.evaluateTalentForJob_(talent, job, modelCriteria, [
  { criterio_nome: 'Exclusiva PcD', campo_talento: 'pcd_bol', tipo_regra: 'Exclusivo', operador: 'igual', valor_esperado: 'SIM' }
], { normalizar_para_100: 'SIM' });
assert.strictEqual(exclusiveEvaluation.eliminado, true);
assert.strictEqual(exclusiveEvaluation.score_total, 0);
assert.deepStrictEqual(Array.from(exclusiveEvaluation.criterios_exclusao), ['Exclusiva PcD']);
assert.strictEqual(context.evaluateVacancyCriterion_(
  { pcd_bol: true },
  { campo_talento: 'pcd_bol', operador: 'igual', valor_esperado: 'SIM' }
), true);
assert.strictEqual(context.evaluateVacancyCriterion_(
  { pcd_bol: false },
  { campo_talento: 'pcd_bol', operador: 'igual', valor_esperado: 'SIM' }
), false);
assert.strictEqual(context.evaluateVacancyCriterion_(
  { pretensao_salarial_min: '' },
  { campo_talento: 'pretensao_salarial_min', operador: 'maior_igual', valor_esperado: 3000 }
), false);
assert.strictEqual(context.evaluateVacancyCriterion_(
  { pretensao_salarial_min: 'não informado' },
  { campo_talento: 'pretensao_salarial_min', operador: 'menor_igual', valor_esperado: 5000 }
), false);
assert.strictEqual(context.evaluateVacancyCriterion_(
  { pretensao_salarial_min: 4000 },
  { campo_talento: 'pretensao_salarial_min', operador: 'maior_igual', valor_esperado: 'Infinity' }
), false);
assert.strictEqual(context.evaluateVacancyCriterion_(
  { pretensao_salarial_min: '' },
  { campo_talento: 'pretensao_salarial_min', operador: 'entre', valor_esperado: '3000;5000' }
), false);
assert.strictEqual(context.evaluateVacancyCriterion_(
  { pretensao_salarial_min: 4000 },
  { campo_talento: 'pretensao_salarial_min', operador: 'entre', valor_esperado: '3000;inválido' }
), false);
assert.strictEqual(context.evaluateVacancyCriterion_(
  { pretensao_salarial_min: 4000 },
  { campo_talento: 'pretensao_salarial_min', operador: 'entre', valor_esperado: '3000;5000' }
), true);

assert.strictEqual(context.isActiveProcessStatus_('Entrevista'), true);
assert.strictEqual(context.isActiveProcessStatus_('Liberado'), false);
assert.strictEqual(context.isTerminalProcessStatus_('Contratado'), true);
assert.strictEqual(context.isTerminalProcessStatus_('Proposta'), false);
assert.strictEqual(context.isBlockingProcessStatus_('Proposta'), true);
assert.strictEqual(context.isBlockingProcessStatus_('Contratado'), true);
assert.strictEqual(context.isBlockingProcessStatus_('Substituído'), false);
assert.doesNotThrow(() => context.assertProcessTransitionAllowed_({ status_processo: 'Proposta' }, 'Contratado'));
assert.doesNotThrow(() => context.assertProcessTransitionAllowed_({ status_processo: 'Contratado' }, 'Substituído'));
assert.throws(
  () => context.assertProcessTransitionAllowed_({ status_processo: 'Contratado' }, 'Entrevista'),
  /Transição inválida/
);
assert.throws(
  () => context.assertProcessTransitionAllowed_({ status_processo: 'Liberado' }, 'Pré-selecionado'),
  /Transição inválida/
);
assert.deepStrictEqual(
  Array.from(context.getAllowedProcessTransitions_('Proposta')),
  ['Contratado', 'Recusado pela empresa', 'Recusado pelo candidato', 'Liberado']
);
assert.deepStrictEqual(
  Array.from(context.getAllowedShortlistTransitions_('Em montagem')),
  ['Enviada', 'Cancelada']
);
assert.doesNotThrow(() => context.assertShortlistTransitionAllowed_('Enviada', 'Em análise pela empresa'));
assert.throws(
  () => context.assertShortlistTransitionAllowed_('Cancelada', 'Enviada'),
  /Transição inválida/
);
assert.throws(
  () => context.assertShortlistClosureAllowed_('Cancelada', [{ status_processo: 'Contratado' }]),
  /deve ser concluída/
);
assert.throws(
  () => context.assertShortlistClosureAllowed_('Concluída', [{ status_processo: 'Entrevista' }]),
  /processos ativos/
);
assert.doesNotThrow(() => context.assertShortlistClosureAllowed_(
  'Concluída',
  [{ status_processo: 'Contratado' }, { status_processo: 'Liberado' }]
));
assert.doesNotThrow(() => context.assertTalentReadyForShortlist_(
  'P_001',
  { status_pool: 'Disponível' },
  { atualizado_em: new Date().toISOString() },
  { status: 'ATIVO' },
  'ativo',
  90
));
assert.throws(() => context.assertTalentReadyForShortlist_(
  'P_001',
  { status_pool: 'Disponível' },
  { atualizado_em: '2000-01-01' },
  { status: 'ATIVO' },
  'ativo',
  90
), /não está mais apto/);
assert.throws(() => context.assertTalentReadyForShortlist_(
  'P_001',
  { status_pool: 'Inativo' },
  { atualizado_em: new Date().toISOString() },
  { status: 'ATIVO' },
  'ativo',
  90
), /não está mais disponível/);
assert.doesNotThrow(() => context.validateHirePayload_({
  data_contratacao: '2026-07-23',
  salario_contratacao: 4500,
  status_contratacao: 'Em acompanhamento'
}));
assert.throws(() => context.validateHirePayload_({
  data_contratacao: '2026-07-23',
  status_contratacao: 'Substituída'
}, false), /não pode ser definido diretamente/);
assert.doesNotThrow(() => context.validateHirePayload_({
  data_contratacao: '2026-07-23',
  status_contratacao: 'Encerrada após 3 meses'
}, true));
assert.throws(() => context.validateHirePayload_({ salario_contratacao: 4500 }), /data da contratação/);
assert.strictEqual(context.isSensitiveMatchingField_('genero'), true);
assert.strictEqual(context.isSensitiveMatchingField_('cor_etnia'), true);
assert.strictEqual(context.isSensitiveMatchingField_('pcd_bol'), true);
assert.strictEqual(context.isSensitiveMatchingField_('genero/pcd_bol'), true);
assert.strictEqual(context.isSensitiveMatchingField_('senioridade'), false);
assert.throws(() => context.saveMatchingModel({
  modelo_id: 'MOD_TESTE',
  nome_modelo: 'Modelo inválido',
  normalizar_para_100: 'SIM',
  score_minimo_recomendado: 60
}, [{
  criterio_nome: 'Campo sensível composto',
  campo_talento: 'genero/pcd_bol',
  campo_vaga: 'area_vaga',
  tipo_comparacao: 'igual',
  peso: 10
}]), /Dados sensíveis/);
assert.strictEqual(
  Array.from(context.getMatchingTalentFields_()).some(field =>
    field.valor === 'pretensao_salarial_min/pretensao_salarial_max'
  ),
  true
);

(function testMatchingRunInvalidationAndModelTransaction() {
  const mockedNames = [
    'withScriptLock_', 'getDatabaseSchema_', 'sanitizePayload_', 'nowIso_', 'currentUser_',
    'generateId_', 'getObjectById_', 'getSheetObjects_', 'updateObjectById_', 'appendObject_',
    'deleteObjectById_', 'replaceSheetRows_', 'writeEntityAudit_', 'serializeForClient_'
  ];
  const originals = {};
  mockedNames.forEach(name => { originals[name] = context[name]; });

  let models = [{
    modelo_id: 'MOD_ATOMICO',
    nome_modelo: 'Modelo original',
    ativo: 'SIM',
    normalizar_para_100: 'SIM',
    score_minimo_recomendado: 60,
    atualizado_em: '',
    atualizado_por: ''
  }];
  let criteria = [{
    modelo_criterio_id: 'MCR_ORIGINAL',
    modelo_id: 'MOD_ATOMICO',
    criterio_nome: 'Área original',
    campo_talento: 'area_interesse_principal',
    campo_vaga: 'area_vaga',
    tipo_comparacao: 'igual',
    modo: 'pontuacao',
    peso: 100,
    ativo: 'SIM'
  }];
  let runs = [
    { run_id: 'RUN_A', modelo_id: 'MOD_ATOMICO', status_run: 'Concluído', observacoes: 'original A' },
    { run_id: 'RUN_B', modelo_id: 'MOD_ATOMICO', status_run: 'Concluído', observacoes: 'original B' },
    { run_id: 'RUN_OUTRO', modelo_id: 'MOD_OUTRO', status_run: 'Concluído', observacoes: 'não alterar' },
    { run_id: 'RUN_CANCELADO', modelo_id: 'MOD_ATOMICO', status_run: 'Cancelado', observacoes: 'já cancelado' }
  ];
  let failRunBOnce = false;
  let auditCount = 0;

  try {
    context.withScriptLock_ = callback => callback();
    context.getDatabaseSchema_ = () => ({
      TH_MATCHING_MODELOS: [
        'modelo_id', 'nome_modelo', 'descricao', 'ativo', 'versao',
        'score_minimo_recomendado', 'normalizar_para_100', 'criado_em',
        'criado_por', 'atualizado_em', 'atualizado_por'
      ]
    });
    context.sanitizePayload_ = (payload, allowed) => allowed.reduce((clean, field) => {
      if (Object.prototype.hasOwnProperty.call(payload, field)) clean[field] = payload[field];
      return clean;
    }, {});
    context.nowIso_ = () => '2026-07-23T12:00:00.000Z';
    context.currentUser_ = () => 'teste@serratec.org';
    context.generateId_ = prefix => prefix + 'NOVO';
    context.serializeForClient_ = value => value;
    context.getObjectById_ = (sheetName, idField, idValue) => {
      const sourceRows = sheetName === 'TH_MATCHING_MODELOS' ? models : [];
      const found = sourceRows.find(row => String(row[idField]) === String(idValue));
      return found ? { ...found } : null;
    };
    context.getSheetObjects_ = sheetName => {
      if (sheetName === 'TH_MATCHING_MODELO_CRITERIOS') return criteria.map(row => ({ ...row }));
      if (sheetName === 'TH_MATCHING_RUNS') return runs.map(row => ({ ...row }));
      return [];
    };
    context.updateObjectById_ = (sheetName, idField, idValue, patch) => {
      const sourceRows = sheetName === 'TH_MATCHING_MODELOS' ? models :
        sheetName === 'TH_MATCHING_RUNS' ? runs : [];
      const row = sourceRows.find(item => String(item[idField]) === String(idValue));
      if (!row) throw new Error('Registro não encontrado: ' + idValue);
      if (sheetName === 'TH_MATCHING_RUNS' && idValue === 'RUN_B' &&
        patch.status_run === 'Cancelado' && failRunBOnce) {
        failRunBOnce = false;
        throw new Error('falha injetada na segunda execução');
      }
      const before = { ...row };
      Object.assign(row, patch);
      return { before, after: { ...row } };
    };
    context.appendObject_ = (sheetName, row) => {
      if (sheetName === 'TH_MATCHING_MODELOS') models.push({ ...row });
      return row;
    };
    context.deleteObjectById_ = (sheetName, idField, idValue) => {
      if (sheetName !== 'TH_MATCHING_MODELOS') return null;
      const index = models.findIndex(row => String(row[idField]) === String(idValue));
      return index === -1 ? null : models.splice(index, 1)[0];
    };
    context.replaceSheetRows_ = (sheetName, rows) => {
      if (sheetName === 'TH_MATCHING_MODELO_CRITERIOS') criteria = rows.map(row => ({ ...row }));
      return rows.length;
    };
    context.writeEntityAudit_ = () => { auditCount += 1; };

    const invalidation = context.invalidateMatchingRuns_(
      run => run.run_id === 'RUN_A',
      'Configuração alterada'
    );
    assert.strictEqual(invalidation.total_invalidado, 1);
    assert.strictEqual(runs.find(run => run.run_id === 'RUN_A').status_run, 'Cancelado');
    assert.strictEqual(runs.find(run => run.run_id === 'RUN_A').observacoes, 'Configuração alterada');
    runs.find(run => run.run_id === 'RUN_A').status_run = 'Concluído';
    runs.find(run => run.run_id === 'RUN_A').observacoes = 'original A';

    failRunBOnce = true;
    assert.throws(
      () => context.invalidateMatchingRuns_(run => run.modelo_id === 'MOD_ATOMICO', 'invalidar'),
      /Não foi possível invalidar/
    );
    assert.strictEqual(runs.find(run => run.run_id === 'RUN_A').status_run, 'Concluído');
    assert.strictEqual(runs.find(run => run.run_id === 'RUN_A').observacoes, 'original A');
    assert.strictEqual(runs.find(run => run.run_id === 'RUN_B').status_run, 'Concluído');

    const originalModel = { ...models[0] };
    const originalCriteria = criteria.map(row => ({ ...row }));
    failRunBOnce = true;
    assert.throws(() => context.saveMatchingModel({
      modelo_id: 'MOD_ATOMICO',
      nome_modelo: 'Modelo alterado',
      ativo: 'SIM',
      normalizar_para_100: 'SIM',
      score_minimo_recomendado: 70
    }, [{
      criterio_nome: 'Senioridade',
      campo_talento: 'senioridade',
      campo_vaga: 'senioridade',
      tipo_comparacao: 'igual',
      peso: 100,
      ativo: 'SIM'
    }]), /Não foi possível salvar o modelo/);
    assert.deepStrictEqual(models[0], originalModel);
    assert.deepStrictEqual(criteria, originalCriteria);
    assert.strictEqual(runs.find(run => run.run_id === 'RUN_A').status_run, 'Concluído');
    assert.strictEqual(runs.find(run => run.run_id === 'RUN_A').observacoes, 'original A');
    assert.strictEqual(runs.find(run => run.run_id === 'RUN_B').status_run, 'Concluído');
    assert.strictEqual(runs.find(run => run.run_id === 'RUN_B').observacoes, 'original B');
    assert.strictEqual(auditCount, 0);

    context.saveMatchingModel({
      modelo_id: 'MOD_ATOMICO',
      nome_modelo: 'Modelo alterado',
      ativo: 'SIM',
      normalizar_para_100: 'SIM',
      score_minimo_recomendado: 70
    }, [{
      criterio_nome: 'Senioridade',
      campo_talento: 'senioridade',
      campo_vaga: 'senioridade',
      tipo_comparacao: 'igual',
      peso: 100,
      ativo: 'SIM'
    }]);
    assert.strictEqual(models[0].nome_modelo, 'Modelo alterado');
    assert.strictEqual(criteria.length, 1);
    assert.strictEqual(criteria[0].criterio_nome, 'Senioridade');
    assert.strictEqual(runs.find(run => run.run_id === 'RUN_A').status_run, 'Cancelado');
    assert.strictEqual(runs.find(run => run.run_id === 'RUN_B').status_run, 'Cancelado');
    assert.strictEqual(runs.find(run => run.run_id === 'RUN_OUTRO').status_run, 'Concluído');
    assert.strictEqual(runs.find(run => run.run_id === 'RUN_CANCELADO').observacoes, 'já cancelado');
    assert.strictEqual(auditCount, 1);
  } finally {
    mockedNames.forEach(name => { context[name] = originals[name]; });
  }
}());

console.log('Regras centrais validadas com sucesso.');
