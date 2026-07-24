'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src');
const files = fs.readdirSync(source);
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };

files.filter(file => /\.(gs|html)$/.test(file)).forEach(file => {
  const text = fs.readFileSync(path.join(source, file), 'utf8');
  const parts = file.endsWith('.gs') ? [text] : [...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  parts.forEach(code => { try { new vm.Script(code, { filename: file }); } catch (error) { errors.push(`Sintaxe inválida em ${file}: ${error.message}`); } });
});

const manifest = JSON.parse(fs.readFileSync(path.join(source, 'appsscript.json'), 'utf8'));
assert(manifest.runtimeVersion === 'V8', 'O runtime do Apps Script deve ser V8.');
assert(manifest.timeZone === 'America/Sao_Paulo', 'O fuso deve ser America/Sao_Paulo.');
const index = fs.readFileSync(path.join(source, 'Index.html'), 'utf8');
for (const match of index.matchAll(/include\('([^']+)'\)/g)) assert(files.includes(`${match[1]}.html`), `Template incluído não existe: ${match[1]}.html`);
assert(!/data-route="integracoes"|data-route="matchmaking"|data-route="shortlists"/.test(index), 'A navegação do MVP não deve expor integrações, matching ou shortlists.');
assert(/data-route="audit"/.test(index), 'Audit Logs devem permanecer visíveis.');
const services = files.filter(file => file.endsWith('.gs')).map(file => fs.readFileSync(path.join(source, file), 'utf8')).join('\n');
['getMvpBootstrap', 'mvpGetTalents', 'mvpGetAvailableTalents', 'mvpSaveTalent', 'mvpSaveClient', 'mvpSaveJob', 'mvpCreateIndication', 'mvpUpdateIndication'].forEach(name => assert(new RegExp(`function\\s+${name}\\s*\\(`).test(services), `Serviço do MVP ausente: ${name}`));
const schemaContext = {}; vm.createContext(schemaContext); vm.runInContext(fs.readFileSync(path.join(source, 'Database.gs'), 'utf8'), schemaContext);
const schema = schemaContext.getDatabaseSchema_();
['TH_CACHE_PESSOAS', 'TH_TALENTOS', 'TH_CLIENTES', 'TH_VAGAS', 'TH_INDICACOES', 'TH_AUDIT_LOGS', 'VW_TALENTOS_APTOS'].forEach(name => assert(Array.isArray(schema[name]), `Contrato da aba ausente: ${name}`));
assert(!schema.TH_MATCHING_RUNS && !schema.TH_SHORTLISTS && !schema.TH_PROCESSOS, 'O contrato do MVP não deve incluir matching, shortlists ou processos antigos.');
if (errors.length) { console.error(errors.map(error => `- ${error}`).join('\n')); process.exit(1); }
console.log(`Validação do MVP concluída: ${files.length} arquivos de origem.`);
