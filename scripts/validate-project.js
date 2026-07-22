'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src');
const files = fs.readdirSync(source);
const gsFiles = files.filter(file => file.endsWith('.gs'));
const htmlFiles = files.filter(file => file.endsWith('.html'));

const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };

for (const file of gsFiles) {
  const code = fs.readFileSync(path.join(source, file), 'utf8');
  try { new vm.Script(code, { filename: file }); }
  catch (error) { errors.push(`Sintaxe inválida em ${file}: ${error.message}`); }
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(source, file), 'utf8');
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try { new vm.Script(script[1], { filename: file }); }
    catch (error) { errors.push(`JavaScript inválido em ${file}: ${error.message}`); }
  }
}

const manifest = JSON.parse(fs.readFileSync(path.join(source, 'appsscript.json'), 'utf8'));
assert(manifest.runtimeVersion === 'V8', 'O runtime do Apps Script deve ser V8.');
assert(manifest.timeZone === 'America/Sao_Paulo', 'O fuso deve ser America/Sao_Paulo.');

const indexHtml = fs.readFileSync(path.join(source, 'Index.html'), 'utf8');
for (const match of indexHtml.matchAll(/include\('([^']+)'\)/g)) {
  assert(files.includes(`${match[1]}.html`), `Template incluído não existe: ${match[1]}.html`);
}

const allHtml = htmlFiles.map(file => fs.readFileSync(path.join(source, file), 'utf8')).join('\n');
assert(
  /document\.readyState\s*===\s*['"]loading['"]/.test(allHtml),
  'A inicialização do frontend deve considerar quando DOMContentLoaded já ocorreu.'
);
assert(
  !/\^https\?\:\\\/\\\//.test(allHtml),
  'Evite regex de protocolo com barras escapadas em HTML incluído pelo HtmlService.'
);
const ids = [...allHtml.matchAll(/(?:\s|<)id="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
assert(duplicateIds.length === 0, `IDs HTML duplicados: ${[...new Set(duplicateIds)].join(', ')}`);

const allGs = gsFiles.map(file => fs.readFileSync(path.join(source, file), 'utf8')).join('\n');
assert(
  !/XFrameOptionsMode\.SAMEORIGIN/.test(allGs),
  'XFrameOptionsMode.SAMEORIGIN não existe no HtmlService; use DEFAULT ou ALLOWALL.'
);
const requiredFunctions = [
  'doGet', 'include', 'createTemplateFromProjectFile_', 'createHtmlOutputFromProjectFile_',
  'setupTalentHubDatabase', 'syncAll', 'syncPessoas', 'syncMatriculas',
  'regenerateTalentView', 'regenerateDashboard', 'getTalentos', 'getTalentoById',
  'updateTalentoTalentHubData', 'getClientes', 'createCliente', 'updateCliente',
  'getVagas', 'createVaga', 'updateVaga', 'getVagaCriterios', 'saveVagaCriterios',
  'getMatchingSetup', 'getMatchingModels', 'saveMatchingModel', 'runMatching', 'getMatchingResults',
  'getShortlists', 'getShortlistDetails', 'createShortlistFromResults', 'updateShortlistStatus',
  'removeShortlistItem', 'getProcessoById', 'updateProcessoStatus', 'registrarContratacao',
  'getDashboard', 'getAuditLogs', 'getSyncStatus'
];
for (const functionName of requiredFunctions) {
  assert(new RegExp(`function\\s+${functionName}\\s*\\(`).test(allGs), `Função global ausente: ${functionName}`);
}

const schemaContext = {};
vm.createContext(schemaContext);
vm.runInContext(fs.readFileSync(path.join(source, 'Database.gs'), 'utf8'), schemaContext);
const schema = schemaContext.getDatabaseSchema_();
const requiredSheets = [
  'TH_CONFIG', 'TH_PARAMETROS', 'TH_CACHE_PESSOAS', 'TH_CACHE_MATRICULAS',
  'TALENT_HUB_EVENTOS_TERMO', 'TALENT_HUB_STATUS_TERMO', 'TH_TALENTOS', 'TH_CLIENTES',
  'TH_CLIENTE_CONTATOS', 'TH_VAGAS', 'TH_VAGA_CRITERIOS', 'TH_MATCHING_MODELOS',
  'TH_MATCHING_MODELO_CRITERIOS', 'TH_MATCHING_RUNS', 'TH_MATCHING_RESULTADOS',
  'TH_SHORTLISTS', 'TH_SHORTLIST_ITENS', 'TH_PROCESSOS', 'TH_CONTRATACOES',
  'TH_BRIEFINGS_EXTERNOS', 'TH_EVENTOS', 'TH_AUDIT_LOGS', 'TH_SYNC_LOG',
  'VW_TALENTOS_APTOS', 'VW_DASHBOARD'
];
for (const sheet of requiredSheets) {
  assert(Array.isArray(schema[sheet]), `Contrato da aba ausente: ${sheet}`);
  if (schema[sheet]) assert(new Set(schema[sheet]).size === schema[sheet].length, `Cabeçalhos duplicados em ${sheet}`);
}
assert(schema.TH_TALENTOS[0] === 'pessoa_id', 'TH_TALENTOS deve usar pessoa_id como primeira chave.');
assert(schema.VW_TALENTOS_APTOS.includes('apto_talent_hub'), 'A visão deve expor apto_talent_hub.');

function collectTextFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.clasp.json') return [];
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTextFiles(target);
    return /\.(?:gs|html|md|json|js|example)$/.test(entry.name) ? [target] : [];
  });
}
const repositoryText = collectTextFiles(root).map(file => fs.readFileSync(file, 'utf8')).join('\n');
const possibleGoogleIds = repositoryText.match(/\b1[A-Za-z0-9_-]{40,}\b/g) || [];
assert(possibleGoogleIds.length === 0, 'Possível ID real de planilha encontrado em arquivo versionado.');

if (errors.length) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Validação concluída: ${gsFiles.length} arquivos .gs, ${htmlFiles.length} templates e ${requiredSheets.length} abas.`);
