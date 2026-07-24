'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '..', 'src');
const port = Number(process.env.TALENT_HUB_PREVIEW_PORT || 4173);

function render() {
  let html = fs.readFileSync(path.join(source, 'Index.html'), 'utf8');
  html = html.replace(/<\?=\s*appName\s*\?>/g, 'Talent Hub Serratec');
  html = html.replace(/<\?!=\s*include\('([^']+)'\);?\s*\?>/g, (_, name) =>
    fs.readFileSync(path.join(source, `${name}.html`), 'utf8')
  );
  return html.replace('</body>', `${mockRuntime()}\n</body>`);
}

function mockRuntime() {
  return `<script>
    (() => {
      const talents = [
        { pessoa_id:'PES_001', nome:'Ana Martins', email:'ana@serratec.org', cidade:'Petrópolis', uf:'RJ', curso:'Residência em Software', area_interesse_principal:'Desenvolvimento de Software', principais_competencias:'Java, React, SQL', apto_talent_hub:'SIM', status_pool:'Disponível', disponivel_para_oportunidades:'SIM' },
        { pessoa_id:'PES_002', nome:'Bruno Almeida', email:'bruno@email.com', cidade:'Teresópolis', uf:'RJ', curso:'Residência em Dados', area_interesse_principal:'Dados', principais_competencias:'Python, SQL, Power BI', apto_talent_hub:'SIM', status_pool:'Disponível', disponivel_para_oportunidades:'SIM' },
        { pessoa_id:'PES_003', nome:'Carla Souza', email:'carla@email.com', cidade:'Nova Friburgo', uf:'RJ', curso:'Residência em Software', area_interesse_principal:'QA', apto_talent_hub:'NAO', status_pool:'Inativo', disponivel_para_oportunidades:'NAO' }
      ];
      const clients = [
        { cliente_id:'CLI_001', nome_empresa:'Tech Solutions', cnpj:'00.000.000/0001-00', cidade:'Petrópolis', uf:'RJ', status_cliente:'Ativo', vagas_abertas:1, contato_principal:{ contato_id:'CTO_001', nome:'Marina Lima', cargo:'RH', email:'marina@example.com', telefone:'(24) 99999-0000' } }
      ];
      const jobs = [
        { vaga_id:'VAG_001', cliente_id:'CLI_001', nome_empresa:'Tech Solutions', titulo_vaga:'Desenvolvedor(a) Júnior', area_vaga:'Desenvolvimento de Software', qtd_posicoes:1, status_vaga:'Aberta', indicacoes_ativas:0 }
      ];
      const indications = [];
      const audit = [{ data_evento:new Date().toISOString(), usuario:'equipe@serratec.org', acao:'SYNC', entidade:'TH_CACHE_PESSOAS', observacao:'3 linhas sincronizadas' }];

      const dashboard = () => ({ metrics:{
        talentos_aptos:talents.filter(item => item.apto_talent_hub === 'SIM').length,
        talentos_disponiveis:talents.filter(item => item.status_pool === 'Disponível').length,
        clientes_ativos:clients.filter(item => item.status_cliente === 'Ativo').length,
        vagas_abertas:jobs.filter(item => ['Aberta','Em processo'].includes(item.status_vaga)).length,
        indicacoes_ativas:indications.filter(item => ['Em análise','Enviado','Entrevista'].includes(item.status_indicacao)).length,
        contratacoes:indications.filter(item => item.status_indicacao === 'Contratado').length
      }, atualizado_em:new Date().toISOString() });

      const methods = {
        getMvpBootstrap: () => ({ initialized:true, user:'equipe@serratec.org', dashboard:dashboard() }),
        getDashboard: dashboard,
        mvpGetTalents: filters => {
          const search = String(filters.search || '').toLowerCase();
          const status = filters.status || 'Todos';
          const pageSize = Number(filters.pageSize || 50);
          let rows = talents.filter(item => (status === 'Todos' || item.status_pool === status) && (!search || [item.nome,item.email,item.curso,item.area_interesse_principal,item.principais_competencias].join(' ').toLowerCase().includes(search)));
          const totalPages = Math.max(Math.ceil(rows.length / pageSize), 1);
          const page = Math.min(Math.max(Number(filters.page || 1), 1), totalPages);
          return { items:rows.slice((page - 1) * pageSize, page * pageSize), total:rows.length, page, pageSize, totalPages };
        },
        mvpGetAvailableTalents: () => talents.filter(item => item.apto_talent_hub === 'SIM' && item.status_pool === 'Disponível').map(item => ({ pessoa_id:item.pessoa_id, nome:item.nome, area_interesse_principal:item.area_interesse_principal })),
        mvpGetClients: () => clients,
        mvpGetJobs: () => jobs,
        mvpGetIndications: () => indications,
        getAuditLogs: () => audit,
        mvpSaveTalent: payload => { Object.assign(talents.find(item => item.pessoa_id === payload.pessoa_id), payload); return {ok:true}; },
        mvpSaveClient: payload => {
          let row = clients.find(item => item.cliente_id === payload.cliente_id);
          if (row) Object.assign(row, payload);
          else { row = Object.assign({cliente_id:'CLI_' + (clients.length + 1), vagas_abertas:0}, payload); clients.push(row); }
          return row;
        },
        mvpSaveContact: (clienteId, payload) => {
          const client = clients.find(item => item.cliente_id === clienteId);
          client.contato_principal = Object.assign({contato_id:payload.contato_id || 'CTO_' + clienteId}, payload);
          return client.contato_principal;
        },
        mvpSaveJob: payload => {
          let row = jobs.find(item => item.vaga_id === payload.vaga_id);
          if (row) Object.assign(row, payload);
          else {
            row = Object.assign({vaga_id:'VAG_' + (jobs.length + 1), indicacoes_ativas:0}, payload);
            row.nome_empresa = (clients.find(item => item.cliente_id === row.cliente_id) || {}).nome_empresa || '';
            jobs.push(row);
          }
          return row;
        },
        mvpCreateIndication: payload => {
          const job = jobs.find(item => item.vaga_id === payload.vaga_id);
          const talent = talents.find(item => item.pessoa_id === payload.pessoa_id);
          const row = Object.assign({ indicacao_id:'IND_' + (indications.length + 1), cliente_id:job.cliente_id, status_indicacao:'Em análise', criado_em:new Date().toISOString(), atualizado_em:new Date().toISOString(), nome_talento:talent.nome, titulo_vaga:job.titulo_vaga, nome_empresa:job.nome_empresa }, payload);
          indications.push(row); job.status_vaga = 'Em processo'; job.indicacoes_ativas += 1; talent.status_pool = 'Em processo'; return row;
        },
        mvpUpdateIndication: (id, status, observations) => {
          const row = indications.find(item => item.indicacao_id === id);
          row.status_indicacao = status; row.observacoes = observations; row.atualizado_em = new Date().toISOString(); return row;
        }
      };

      const createRunner = state => {
        const handlers = Object.assign({ success:() => {}, failure:() => {} }, state || {});
        return new Proxy({}, { get(_target, property) {
          if (property === 'withSuccessHandler') return callback => createRunner(Object.assign({}, handlers, { success:callback }));
          if (property === 'withFailureHandler') return callback => createRunner(Object.assign({}, handlers, { failure:callback }));
          return (...args) => setTimeout(() => {
            try {
              if (typeof methods[property] !== 'function') throw new Error('Método mock ausente: ' + String(property));
              handlers.success(methods[property](...args));
            } catch (error) { handlers.failure(error); }
          }, 20);
        }});
      };
      window.google = { script:{} };
      Object.defineProperty(window.google.script, 'run', { get:() => createRunner() });
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

server.listen(port, '127.0.0.1', () =>
  console.log(`Talent Hub preview: http://127.0.0.1:${port}`)
);

module.exports = server;
