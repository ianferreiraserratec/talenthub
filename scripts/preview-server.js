'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '..', 'src');
const port = Number(process.env.TALENT_HUB_PREVIEW_PORT || 4173);

function render() {
  let html = fs.readFileSync(path.join(source, 'Index.html'), 'utf8');
  html = html.replace(/<\?=\s*appName\s*\?>/g, 'Talent Hub Serratec');
  html = html.replace(/<\?!=\s*include\('([^']+)'\);?\s*\?>/g, (_, name) => {
    return fs.readFileSync(path.join(source, `${name}.html`), 'utf8');
  });
  return html.replace('</body>', `${mockRuntime()}\n</body>`);
}

function mockRuntime() {
  return `<script>
    (() => {
      const talents = [
        { pessoa_id:'PES_001', nome:'Ana Martins', email:'ana@serratec.org', cidade:'Petrópolis', uf:'RJ', curso:'Residência em TIC/Software', faculdade:'Serratec', area_interesse_principal:'Desenvolvimento de Software', senioridade:'Júnior', apto_talent_hub:'SIM', status_pool:'Disponível', cadastro_atualizado_90d:'SIM', termo_status:'ATIVO', principais_competencias:'Java, React, SQL', dias_desde_atualizacao:12 },
        { pessoa_id:'PES_002', nome:'Bruno Almeida', email:'bruno@email.com', cidade:'Teresópolis', uf:'RJ', curso:'Residência em TIC/Software', area_interesse_principal:'Dados / BI / Analytics', senioridade:'Júnior', apto_talent_hub:'SIM', status_pool:'Em processo', cadastro_atualizado_90d:'SIM', termo_status:'ATIVO', principais_competencias:'Python, SQL, Power BI', dias_desde_atualizacao:32 },
        { pessoa_id:'PES_003', nome:'Carla Souza', email:'carla@email.com', cidade:'Nova Friburgo', uf:'RJ', curso:'Residência em TIC/Software', area_interesse_principal:'QA / Testes', senioridade:'Júnior', apto_talent_hub:'NAO', motivo_nao_apto:'CADASTRO_DESATUALIZADO', status_pool:'Inelegível', cadastro_atualizado_90d:'NAO', termo_status:'ATIVO', dias_desde_atualizacao:121 }
      ];
      const clients = [
        { cliente_id:'CLI_001', nome_empresa:'Tech Solutions', cidade:'Petrópolis', uf:'RJ', setor:'Tecnologia', porte:'Médio', status_cliente:'Ativo', vagas_abertas:2, colocacoes:1 },
        { cliente_id:'CLI_002', nome_empresa:'Serratec', cidade:'Petrópolis', uf:'RJ', setor:'Educação e tecnologia', porte:'Pequeno', status_cliente:'Ativo', vagas_abertas:1, colocacoes:0 }
      ];
      const jobs = [
        { vaga_id:'VAG_001', cliente_id:'CLI_001', nome_empresa:'Tech Solutions', titulo_vaga:'Desenvolvedor(a) Java Júnior', area_vaga:'Desenvolvimento de Software', senioridade:'Júnior', modalidade:'Híbrido', status_vaga:'Aberta', total_candidatos:8, faixa_salarial_min:3500, faixa_salarial_max:4800 },
        { vaga_id:'VAG_002', cliente_id:'CLI_002', nome_empresa:'Serratec', titulo_vaga:'Analista de Dados', area_vaga:'Dados / BI / Analytics', senioridade:'Júnior', modalidade:'Presencial', status_vaga:'Em processo', total_candidatos:5, faixa_salarial_min:4000, faixa_salarial_max:5500 }
      ];
      const metrics = { talentos_aptos:2, talentos_disponiveis:1, clientes_ativos:2, clientes_total:2, vagas_abertas:2, vagas_em_processo:1, contratacoes_total:1, massa_salarial_gerada:4200, talentos_cadastro_atualizado_90d:2, talentos_com_termo_ativo:3, talentos_em_processo:1, talentos_bloqueados:0, talentos_inelegiveis:1, processos_ativos:5, vagas_encerradas:0 };
      const methods = {
        getAppBootstrap: () => ({ initialized:true, version:'0.1.0-preview', user:'equipe@serratec.org', config:{ CDP_SPREADSHEET_ID:'configurado', TH_SPREADSHEET_ID:'configurado', ABA_CDP_PESSOAS:'PESSOAS', ABA_CDP_MATRICULAS:'MATRICULAS', DIAS_CADASTRO_VALIDO:90, TERMO_STATUS_VALIDO:'ATIVO' } }),
        getParametros: () => ({ areas_interesse:[{valor:'Desenvolvimento de Software'},{valor:'Dados / BI / Analytics'},{valor:'QA / Testes'}], senioridades:[{valor:'Júnior'},{valor:'Pleno'},{valor:'Sênior'}], modalidades:[{valor:'Remoto'},{valor:'Híbrido'},{valor:'Presencial'}], tipos_contratacao:[{valor:'CLT'},{valor:'PJ'},{valor:'Estágio'}] }),
        getDashboard: () => ({ metrics, atualizado_em:new Date().toISOString() }),
        getTalentos: filters => ({ items: talents.filter(item => !filters.status || filters.status === 'Todos' || filters.status === 'Aptos' && item.apto_talent_hub === 'SIM' || item.status_pool === filters.status), total:talents.length, page:1, pageSize:100, totalPages:1 }),
        getTalentoById: id => ({ pessoa:talents.find(item => item.pessoa_id === id), talentHub:{ pessoa_id:id, disponivel_para_oportunidades:'SIM', aceita_exclusividade:'SIM' }, matriculas:[{ modalidade:'Residência', ciclo:'2025.2', status_aluno:'Aprovado' }], processos:[], contratacoes:[] }),
        getClientes: () => clients,
        getVagas: () => jobs,
        getRuntimeConfig: () => ({ CDP_SPREADSHEET_ID:'configurado', TH_SPREADSHEET_ID:'configurado', ABA_CDP_PESSOAS:'PESSOAS', ABA_CDP_MATRICULAS:'MATRICULAS', DIAS_CADASTRO_VALIDO:90, TERMO_STATUS_VALIDO:'ATIVO' }),
        getSyncStatus: () => ({ latest:[{ iniciado_em:new Date().toISOString(), tipo_sync:'PESSOAS', status:'CONCLUIDO', total_linhas_lidas:486, total_linhas_gravadas:486, mensagem:'Sincronização concluída.' }] }),
        getAuditLogs: () => [{ data_evento:new Date().toISOString(), usuario:'equipe@serratec.org', acao:'SYNC', entidade:'TH_CACHE_PESSOAS', entidade_id:'SYN_PREVIEW', observacao:'486 linhas sincronizadas', origem:'INTEGRACAO' }],
        saveRuntimeConfig: payload => payload,
        setupTalentHubDatabase: () => ({ message:'Banco preparado.' }),
        syncAll: () => ({ ok:true }), syncPessoas: () => ({ ok:true }), syncMatriculas: () => ({ ok:true }),
        regenerateTalentView: () => ({ ok:true }), regenerateDashboard: () => ({ ok:true }),
        createCliente: payload => payload, updateCliente: (_id,payload) => payload,
        createVaga: payload => payload, updateVaga: (_id,payload) => payload,
        updateTalentoTalentHubData: payload => payload
      };
      let success = () => {}, failure = () => {};
      const runner = new Proxy({}, { get(_target, property) {
        if (property === 'withSuccessHandler') return callback => { success = callback; return runner; };
        if (property === 'withFailureHandler') return callback => { failure = callback; return runner; };
        return (...args) => setTimeout(() => { try { success(methods[property](...args)); } catch (error) { failure(error); } }, 30);
      }});
      window.google = { script:{ run:runner } };
    })();
  </script>`;
}

const server = http.createServer((request, response) => {
  if (request.url !== '/' && request.url !== '/index.html') {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' });
  response.end(render());
});

server.listen(port, '127.0.0.1', () => console.log(`Talent Hub preview: http://127.0.0.1:${port}`));
