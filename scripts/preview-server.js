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
        { pessoa_id:'PES_001', nome:'Ana Martins', email:'ana@serratec.org', cidade:'Petrópolis', uf:'RJ', curso:'Residência em TIC/Software', faculdade:'Serratec', escolaridade:'Superior completo', formacoes_serratec:'Residência em Software · 2025.2', qtd_formacoes_serratec_aprovadas:1, area_interesse_principal:'Desenvolvimento de Software', senioridade:'Júnior', apto_talent_hub:'SIM', status_pool:'Disponível', cadastro_atualizado_90d:'SIM', termo_status:'ATIVO', principais_competencias:'Java, React, SQL', dias_desde_atualizacao:12, idade:26, faixa_etaria:'25 a 29', curriculo:'https://example.com/cv-ana', curriculo_disponivel:'SIM' },
        { pessoa_id:'PES_002', nome:'Bruno Almeida', email:'bruno@email.com', cidade:'Teresópolis', uf:'RJ', curso:'Residência em TIC/Software', escolaridade:'Superior cursando', formacoes_serratec:'Residência em Software · 2025.2', qtd_formacoes_serratec_aprovadas:1, area_interesse_principal:'Dados / BI / Analytics', senioridade:'Júnior', apto_talent_hub:'SIM', status_pool:'Em processo', cadastro_atualizado_90d:'SIM', termo_status:'ATIVO', principais_competencias:'Python, SQL, Power BI', dias_desde_atualizacao:32, curriculo_disponivel:'NAO' },
        { pessoa_id:'PES_003', nome:'Carla Souza', email:'carla@email.com', cidade:'Nova Friburgo', uf:'RJ', curso:'Residência em TIC/Software', area_interesse_principal:'QA / Testes', senioridade:'Júnior', apto_talent_hub:'NAO', motivo_nao_apto:'CADASTRO_DESATUALIZADO', status_pool:'Inativo', cadastro_atualizado_90d:'NAO', termo_status:'ATIVO', dias_desde_atualizacao:121 }
      ];
      const clients = [
        { cliente_id:'CLI_001', nome_empresa:'Tech Solutions', cidade:'Petrópolis', uf:'RJ', setor:'Tecnologia', porte:'Médio', status_cliente:'Ativo', vagas_abertas:2, colocacoes:1 },
        { cliente_id:'CLI_002', nome_empresa:'Serratec', cidade:'Petrópolis', uf:'RJ', setor:'Educação e tecnologia', porte:'Pequeno', status_cliente:'Ativo', vagas_abertas:1, colocacoes:0 }
      ];
      const jobs = [
        { vaga_id:'VAG_001', cliente_id:'CLI_001', nome_empresa:'Tech Solutions', titulo_vaga:'Desenvolvedor(a) Java Júnior', area_vaga:'Desenvolvimento de Software', senioridade:'Júnior', modalidade:'Híbrido', status_vaga:'Aberta', total_candidatos:8, total_shortlists:1, rodada_atual:1, faixa_salarial_min:3500, faixa_salarial_max:4800 },
        { vaga_id:'VAG_002', cliente_id:'CLI_002', nome_empresa:'Serratec', titulo_vaga:'Analista de Dados', area_vaga:'Dados / BI / Analytics', senioridade:'Júnior', modalidade:'Presencial', status_vaga:'Em processo', total_candidatos:5, faixa_salarial_min:4000, faixa_salarial_max:5500 }
      ];
      const matchingModel = { modelo_id:'MATCH_PADRAO_2026', nome_modelo:'Modelo profissional completo', descricao:'Pontuação por aderência profissional', ativo:'SIM', versao:'1.0', score_minimo_recomendado:60, normalizar_para_100:'SIM', criterios:[
        { modelo_criterio_id:'MCR_001', criterio_nome:'Área principal', campo_talento:'area_interesse_principal', campo_vaga:'area_vaga', tipo_comparacao:'igual', modo:'pontuacao', peso:30, ativo:'SIM' },
        { modelo_criterio_id:'MCR_002', criterio_nome:'Competências', campo_talento:'principais_competencias', campo_vaga:'requisitos_obrigatorios/requisitos_desejaveis', tipo_comparacao:'intersecao_lista', modo:'pontuacao', peso:40, ativo:'SIM' },
        { modelo_criterio_id:'MCR_003', criterio_nome:'Modalidade', campo_talento:'modalidade_preferida', campo_vaga:'modalidade', tipo_comparacao:'intersecao_lista', modo:'pontuacao', peso:20, ativo:'SIM' },
        { modelo_criterio_id:'MCR_004', criterio_nome:'Pretensão salarial', campo_talento:'pretensao_salarial_min/pretensao_salarial_max', campo_vaga:'faixa_salarial_min/faixa_salarial_max', tipo_comparacao:'salario_compativel', modo:'pontuacao', peso:10, ativo:'NAO' }
      ]};
      const operationalMatchingModel = { modelo_id:'MATCH_CDP_2026', nome_modelo:'Modelo operacional · dados atuais', descricao:'Localidade do CDP e critérios da vaga', ativo:'SIM', versao:'1.0', score_minimo_recomendado:60, normalizar_para_100:'SIM', criterios:[
        { modelo_criterio_id:'CRT_CDP_LOCALIDADE', criterio_nome:'Localidade atual', campo_talento:'cidade/uf', campo_vaga:'cidade/uf', tipo_comparacao:'intersecao_lista', modo:'pontuacao', peso:20, ativo:'SIM' }
      ]};
      let vacancyCriteria = [{ vaga_criterio_id:'CRT_001', vaga_id:'VAG_001', criterio_nome:'Prioridade para mulheres', campo_talento:'genero', tipo_regra:'Prioritário', operador:'igual', valor_esperado:'Feminino', peso_override:10, ativo:'SIM' }];
      const matchingRun = { run_id:'RUN_001', vaga_id:'VAG_001', modelo_id:'MATCH_PADRAO_2026', executado_em:new Date().toISOString(), executado_por:'equipe@serratec.org', status_run:'Concluído', total_talentos_avaliados:2, total_talentos_aptos:2, total_talentos_eliminados:0, total_recomendados:1 };
      const matchingResults = [
        { resultado_id:'RES_001', run_id:'RUN_001', vaga_id:'VAG_001', pessoa_id:'PES_001', nome:'Ana Martins', area_interesse_principal:'Desenvolvimento de Software', senioridade:'Júnior', cidade:'Petrópolis', uf:'RJ', score_total:92, justificativa:'Aderência de 92,0%. Atende: Área principal, Competências, Modalidade.', criterios_nao_atendidos:'', criterios_exclusao:'', recomendado:'SIM', ordem_ranking:1, status_resultado:'Recomendado' },
        { resultado_id:'RES_002', run_id:'RUN_001', vaga_id:'VAG_001', pessoa_id:'PES_002', nome:'Bruno Almeida', area_interesse_principal:'Dados / BI / Analytics', senioridade:'Júnior', cidade:'Teresópolis', uf:'RJ', score_total:55, justificativa:'Aderência de 55,0%. Atende: Competências, Modalidade.', criterios_nao_atendidos:'Área principal', criterios_exclusao:'', recomendado:'NAO', ordem_ranking:2, status_resultado:'Descartado' }
      ];
      let shortlists = [{ shortlist_id:'SHT_001', vaga_id:'VAG_001', cliente_id:'CLI_001', rodada:1, titulo_shortlist:'Shortlist — Desenvolvedor(a) Java Júnior — rodada 1', status_shortlist:'Em montagem', transicoes_permitidas:['Enviada','Cancelada'], criada_em:new Date().toISOString(), criada_por:'equipe@serratec.org', qtd_candidatos:2, nome_empresa:'Tech Solutions', titulo_vaga:'Desenvolvedor(a) Java Júnior', qtd_contratados:0, qtd_processos_ativos:2 }];
      let shortlistDetails = { shortlist:shortlists[0], vaga:jobs[0], cliente:clients[0], itens:[
        { shortlist_item_id:'SHI_001', shortlist_id:'SHT_001', processo_id:'PRO_001', pessoa_id:'PES_001', ordem_recomendacao:1, score_total:92, status_item:'Incluído', nome:'Ana Martins', area_interesse_principal:'Desenvolvimento de Software', senioridade:'Júnior', cidade:'Petrópolis', uf:'RJ', processo:{ processo_id:'PRO_001', status_processo:'Pré-selecionado', transicoes_permitidas:['Aguardando confirmação','Bloqueado','Enviado à empresa','Recusado pelo candidato','Liberado'], data_inclusao_processo:new Date().toISOString() } },
        { shortlist_item_id:'SHI_002', shortlist_id:'SHT_001', processo_id:'PRO_002', pessoa_id:'PES_002', ordem_recomendacao:2, score_total:67, status_item:'Incluído', nome:'Bruno Almeida', area_interesse_principal:'Dados / BI / Analytics', senioridade:'Júnior', cidade:'Teresópolis', uf:'RJ', processo:{ processo_id:'PRO_002', status_processo:'Aguardando confirmação', transicoes_permitidas:['Bloqueado','Enviado à empresa','Recusado pelo candidato','Liberado'], data_inclusao_processo:new Date().toISOString() } }
      ]};
      const metrics = { talentos_aptos:2, talentos_disponiveis:1, clientes_ativos:2, clientes_total:2, vagas_abertas:2, vagas_em_processo:1, contratacoes_total:1, contratacoes_ativas:1, massa_salarial_gerada:4200, massa_salarial_ativa:4200, talentos_cadastro_atualizado_90d:2, talentos_com_termo_ativo:3, talentos_em_processo:1, talentos_bloqueados:0, talentos_inativos:1, talentos_inelegiveis:0, processos_ativos:5, vagas_encerradas:0 };
      const params = { areas_interesse:[{valor:'Desenvolvimento de Software'},{valor:'Dados / BI / Analytics'},{valor:'QA / Testes'}], senioridades:[{valor:'Júnior'},{valor:'Pleno'},{valor:'Sênior'}], modalidades:[{valor:'Remoto'},{valor:'Híbrido'},{valor:'Presencial'}], tipos_contratacao:[{valor:'CLT'},{valor:'PJ'},{valor:'Estágio'}] };
      const methods = {
        getAppBootstrap: () => ({ initialized:true, version:'0.1.0-preview', user:'equipe@serratec.org', config:{ CDP_SPREADSHEET_ID:'configurado', TH_SPREADSHEET_ID:'configurado', ABA_CDP_PESSOAS:'PESSOAS', ABA_CDP_MATRICULAS:'MATRICULAS', DIAS_CADASTRO_VALIDO:90, TERMO_STATUS_VALIDO:'ATIVO' }, parametros:params, dashboard:{ metrics, atualizado_em:new Date().toISOString() } }),
        getParametros: () => params,
        getDashboard: () => ({ metrics, atualizado_em:new Date().toISOString() }),
        getTalentos: filters => ({ items: talents.filter(item => !filters.status || filters.status === 'Todos' || filters.status === 'Aptos' && item.apto_talent_hub === 'SIM' || item.status_pool === filters.status), total:talents.length, page:1, pageSize:100, totalPages:1 }),
        getTalentoById: id => ({ pessoa:talents.find(item => item.pessoa_id === id), talentHub:{ pessoa_id:id, disponivel_para_oportunidades:'SIM', aceita_exclusividade:'SIM' }, matriculas:[{ modalidade:'Residência', ciclo:'2025.2', status_aluno:'Aprovado' }], processos:[], contratacoes:[] }),
        getClientes: () => clients,
        getVagas: () => jobs,
        getMatchingSetup: vacancyId => ({ vagas:jobs, modelos:[matchingModel,operationalMatchingModel], vaga_id:vacancyId || 'VAG_001', criterios_vaga:vacancyCriteria.filter(item => item.vaga_id === (vacancyId || 'VAG_001')), execucoes:[matchingRun], campos_talento:[{valor:'formacoes_serratec',descricao:'Formações Serratec aprovadas',sensivel:'NAO'},{valor:'possui_formacao_serratec_aprovada',descricao:'Possui formação Serratec aprovada',sensivel:'NAO'},{valor:'escolaridade',descricao:'Escolaridade',sensivel:'NAO'},{valor:'curriculo_disponivel',descricao:'Currículo disponível',sensivel:'NAO'},{valor:'area_interesse_principal',descricao:'Área principal',sensivel:'NAO'},{valor:'senioridade',descricao:'Senioridade',sensivel:'NAO'},{valor:'principais_competencias',descricao:'Competências',sensivel:'NAO'},{valor:'modalidade_preferida',descricao:'Modalidade preferida',sensivel:'NAO'},{valor:'pretensao_salarial_min/pretensao_salarial_max',descricao:'Faixa de pretensão salarial',sensivel:'NAO'},{valor:'idade',descricao:'Idade',sensivel:'SIM'},{valor:'genero',descricao:'Gênero',sensivel:'SIM'},{valor:'pcd_bol',descricao:'Pessoa com deficiência',sensivel:'SIM'}], campos_vaga:[{valor:'area_vaga',descricao:'Área da vaga'},{valor:'senioridade',descricao:'Senioridade'},{valor:'modalidade',descricao:'Modalidade'},{valor:'requisitos_obrigatorios/requisitos_desejaveis',descricao:'Todos os requisitos mapeados'},{valor:'faixa_salarial_min/faixa_salarial_max',descricao:'Faixa salarial'}] }),
        getMatchingResults: () => ({ run:matchingRun, vaga:jobs[0], resultados:matchingResults }),
        runMatching: (_vagaId, _qtdPerfis, modeloId) => {
          matchingRun.status_run = 'Concluído';
          matchingRun.observacoes = '';
          matchingRun.executado_em = new Date().toISOString();
          matchingRun.modelo_id = modeloId || operationalMatchingModel.modelo_id;
          return { run:matchingRun, vaga:jobs[0], performance:{ total_ms:1250 }, resultados:matchingResults };
        },
        saveMatchingModel: payload => {
          Object.assign(matchingModel, payload);
          matchingRun.status_run = 'Cancelado';
          matchingRun.observacoes = 'Modelo de matching alterado. Execute uma nova análise.';
          return matchingModel;
        },
        saveVagaCriterios: (vagaId, criteria) => {
          vacancyCriteria = criteria.map(item => Object.assign({}, item, { vaga_id:vagaId }));
          if (matchingRun.vaga_id === vagaId) {
            matchingRun.status_run = 'Cancelado';
            matchingRun.observacoes = 'Critérios da vaga alterados. Execute uma nova análise.';
          }
          return vacancyCriteria;
        },
        createShortlistFromResults: () => ({ shortlist:shortlists[0], processos:[], itens:shortlistDetails.itens }),
        getShortlists: filters => shortlists.filter(item => !filters.status || filters.status === 'Todos' || item.status_shortlist === filters.status),
        getShortlistDetails: () => shortlistDetails,
        updateShortlistStatus: (_id, status) => {
          shortlistDetails.shortlist.status_shortlist = status;
          shortlistDetails.shortlist.transicoes_permitidas = status === 'Enviada'
            ? ['Em análise pela empresa','Concluída','Cancelada']
            : status === 'Em análise pela empresa'
              ? ['Concluída','Cancelada']
              : [];
          shortlists[0].status_shortlist = status;
          if (status === 'Enviada') shortlistDetails.itens.forEach(item => {
            item.processo.status_processo = 'Enviado à empresa';
            item.processo.transicoes_permitidas = ['Aguardando retorno','Entrevista','Proposta','Contratado','Recusado pela empresa','Recusado pelo candidato','Liberado'];
            item.processo.data_envio_empresa = new Date().toISOString();
          });
          if (status === 'Em análise pela empresa') shortlistDetails.itens.forEach(item => {
            if (item.processo.status_processo === 'Enviado à empresa') {
              item.processo.status_processo = 'Aguardando retorno';
              item.processo.transicoes_permitidas = ['Entrevista','Proposta','Contratado','Recusado pela empresa','Recusado pelo candidato','Liberado'];
            }
          });
          if (status === 'Cancelada') shortlistDetails.itens.forEach(item => {
            if (item.processo.status_processo !== 'Contratado') {
              item.processo.status_processo = 'Liberado';
              item.processo.transicoes_permitidas = [];
              item.status_item = 'Liberado';
            }
          });
          return shortlistDetails;
        },
        removeShortlistItem: (id, payload) => {
          const item = shortlistDetails.itens.find(row => row.shortlist_item_id === id);
          if (item) {
            item.processo.status_processo = 'Liberado';
            item.processo.transicoes_permitidas = [];
            item.status_item = 'Removido';
            item.observacao_curadoria = (payload || {}).motivo || '';
          }
          return shortlistDetails;
        },
        updateProcessoStatus: (id, status, payload) => {
          const item = shortlistDetails.itens.find(row => row.processo_id === id);
          if (item) {
            item.processo.status_processo = status;
            const transitions = {
              'Enviado à empresa':['Aguardando retorno','Entrevista','Proposta','Contratado','Recusado pela empresa','Recusado pelo candidato','Liberado'],
              'Aguardando retorno':['Entrevista','Proposta','Contratado','Recusado pela empresa','Recusado pelo candidato','Liberado'],
              Entrevista:['Aguardando retorno','Proposta','Contratado','Recusado pela empresa','Recusado pelo candidato','Liberado'],
              Proposta:['Contratado','Recusado pela empresa','Recusado pelo candidato','Liberado'],
              Contratado:['Substituído']
            };
            item.processo.transicoes_permitidas = transitions[status] || [];
            if (status === 'Contratado') {
              item.processo.resultado_final = 'Contratado';
              item.processo.data_resultado = new Date().toISOString();
              item.contratacao = Object.assign({ status_contratacao:'Em acompanhamento' }, payload || {});
            }
          }
          return item;
        },
        getRuntimeConfig: () => ({ CDP_SPREADSHEET_ID:'configurado', TH_SPREADSHEET_ID:'configurado', ABA_CDP_PESSOAS:'PESSOAS', ABA_CDP_MATRICULAS:'MATRICULAS', DIAS_CADASTRO_VALIDO:90, TERMO_STATUS_VALIDO:'ATIVO' }),
        getSyncStatus: () => ({
          latest:[{ iniciado_em:new Date().toISOString(), tipo_sync:'PESSOAS', status:'CONCLUIDO', total_linhas_lidas:486, total_linhas_gravadas:486, mensagem:'Sincronização concluída.' }],
          quality:{ pessoas_sincronizadas:486, pessoas_com_formacao_aprovada:312, formacoes_aprovadas:405, pessoas_com_curriculo:271 }
        }),
        getAuditLogs: () => [{ data_evento:new Date().toISOString(), usuario:'equipe@serratec.org', acao:'SYNC', entidade:'TH_CACHE_PESSOAS', entidade_id:'SYN_PREVIEW', observacao:'486 linhas sincronizadas', origem:'INTEGRACAO' }],
        saveRuntimeConfig: payload => payload,
        setupTalentHubDatabase: () => ({ message:'Banco preparado.' }),
        syncAll: () => ({ ok:true }), syncPessoas: () => ({ ok:true }), syncMatriculas: () => ({ ok:true }),
        regenerateTalentView: () => ({ ok:true }), regenerateDashboard: () => ({ ok:true }),
        createCliente: payload => {
          const row = Object.assign({ cliente_id:'CLI_PREVIEW_' + (clients.length + 1) }, payload);
          clients.push(row);
          return row;
        },
        updateCliente: (id,payload) => {
          const row = clients.find(item => item.cliente_id === id);
          if (row) Object.assign(row, payload);
          return row || payload;
        },
        createVaga: payload => {
          const row = Object.assign({ vaga_id:'VAG_PREVIEW_' + (jobs.length + 1), total_candidatos:0, total_shortlists:0 }, payload);
          row.nome_empresa = (clients.find(client => client.cliente_id === row.cliente_id) || {}).nome_empresa || '';
          jobs.push(row);
          return row;
        },
        updateVaga: (id,payload) => {
          const row = jobs.find(item => item.vaga_id === id);
          if (row) Object.assign(row, payload);
          return row || payload;
        },
        updateTalentoTalentHubData: payload => {
          const row = talents.find(item => item.pessoa_id === payload.pessoa_id);
          if (row) Object.assign(row, payload);
          return row || payload;
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
          }, 30);
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

server.listen(port, '127.0.0.1', () => console.log(`Talent Hub preview: http://127.0.0.1:${port}`));

module.exports = server;
