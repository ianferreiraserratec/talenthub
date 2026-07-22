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
['Utils.gs', 'SyncService.gs', 'DashboardService.gs', 'MatchingService.gs', 'ProcessoService.gs'].forEach(file => {
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

assert.strictEqual(context.isActiveProcessStatus_('Entrevista'), true);
assert.strictEqual(context.isActiveProcessStatus_('Liberado'), false);
assert.strictEqual(context.isTerminalProcessStatus_('Contratado'), true);
assert.strictEqual(context.isTerminalProcessStatus_('Proposta'), false);

console.log('Regras centrais validadas com sucesso.');
