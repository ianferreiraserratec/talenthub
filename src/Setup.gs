function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Talent Hub')
    .addItem('Preparar banco de dados', 'setupTalentHubDatabase')
    .addSeparator()
    .addItem('Sincronizar tudo', 'syncAll')
    .addItem('Regenerar visão de talentos', 'regenerateTalentView')
    .addItem('Regenerar dashboard', 'regenerateDashboard')
    .addToUi();
}

function setupTalentHubDatabase() {
  return withScriptLock_(function () {
    var spreadsheet = getOperationalSpreadsheet_();
    var schema = getDatabaseSchema_();
    var created = [];
    var updated = [];

    Object.keys(schema).forEach(function (sheetName) {
      var result = ensureSheet_(spreadsheet, sheetName, schema[sheetName]);
      if (result.created) created.push(sheetName);
      if (result.columnsAdded.length) updated.push(sheetName + ': +' + result.columnsAdded.join(', '));
    });

    seedConfig_(spreadsheet);
    seedParameters_();
    seedMatchingModel_();
    applyDataValidations_();
    formatManagedSheets_(spreadsheet, schema);

    writeAuditLog_('CREATE', 'DATABASE', spreadsheet.getId(), '', '', 'SETUP', 'Estrutura validada');

    return {
      ok: true,
      message: 'Banco de dados preparado com sucesso.',
      createdSheets: created,
      updatedSheets: updated,
      spreadsheetId: spreadsheet.getId()
    };
  });
}

function ensureSheet_(spreadsheet, sheetName, expectedHeaders) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  var created = false;
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    created = true;
  }

  if (sheet.getMaxColumns() < expectedHeaders.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), expectedHeaders.length - sheet.getMaxColumns());
  }

  var existingHeaders = getHeader_(sheet);
  var hasAnyHeader = existingHeaders.some(function (header) { return header !== ''; });
  var added = [];

  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    added = expectedHeaders.slice();
  } else {
    expectedHeaders.forEach(function (header) {
      if (existingHeaders.indexOf(header) === -1) {
        existingHeaders.push(header);
        added.push(header);
      }
    });
    if (added.length) {
      if (sheet.getMaxColumns() < existingHeaders.length) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), existingHeaders.length - sheet.getMaxColumns());
      }
      sheet.getRange(1, 1, 1, existingHeaders.length).setValues([existingHeaders]);
    }
  }

  return { created: created, columnsAdded: added };
}

function seedConfig_(spreadsheet) {
  var now = nowIso_();
  var user = currentUser_();
  var rows = [
    { chave: 'CDP_SPREADSHEET_ID', valor: '', descricao: 'ID da planilha central CDP / Comunidade', atualizado_em: now, atualizado_por: user },
    { chave: 'TH_SPREADSHEET_ID', valor: spreadsheet.getId(), descricao: 'ID da planilha operacional Talent Hub', atualizado_em: now, atualizado_por: user },
    { chave: 'ABA_CDP_PESSOAS', valor: 'PESSOAS', descricao: 'Nome da aba de pessoas no CDP', atualizado_em: now, atualizado_por: user },
    { chave: 'ABA_CDP_MATRICULAS', valor: 'MATRICULAS', descricao: 'Nome da aba de matrículas no CDP', atualizado_em: now, atualizado_por: user },
    { chave: 'DIAS_CADASTRO_VALIDO', valor: '90', descricao: 'Janela de validade do cadastro', atualizado_em: now, atualizado_por: user },
    { chave: 'TERMO_STATUS_VALIDO', valor: 'ATIVO', descricao: 'Status que representa termo válido', atualizado_em: now, atualizado_por: user },
    { chave: 'TERMO_STATUS_INVALIDO', valor: 'CANCELADO', descricao: 'Status que representa termo inválido', atualizado_em: now, atualizado_por: user },
    { chave: 'MATCHING_MODELO_PADRAO', valor: 'MATCH_PADRAO_2026', descricao: 'Modelo padrão de matchmaking', atualizado_em: now, atualizado_por: user }
  ];
  upsertRowsByCompositeKey_('TH_CONFIG', rows, ['chave']);
}

function seedParameters_() {
  var definitions = {
    status_pool: ['Disponível', 'Em processo', 'Bloqueado', 'Contratado', 'Inativo', 'Inelegível', 'Carência'],
    status_cliente: ['Prospect', 'Em negociação', 'Ativo', 'Inativo', 'Encerrado'],
    status_vaga: ['Rascunho', 'Briefing recebido', 'Validando pool', 'Aberta', 'Shortlist enviada', 'Em processo', 'Preenchida', 'Encerrada sem contratação', 'Cancelada'],
    status_processo: ['Pré-selecionado', 'Aguardando confirmação', 'Bloqueado', 'Enviado à empresa', 'Aguardando retorno', 'Entrevista', 'Proposta', 'Contratado', 'Recusado pela empresa', 'Recusado pelo candidato', 'Liberado', 'Substituído'],
    status_shortlist: ['Em montagem', 'Enviada', 'Em análise pela empresa', 'Concluída', 'Cancelada'],
    status_item_shortlist: ['Incluído', 'Enviado', 'Removido', 'Substituído', 'Contratado', 'Liberado'],
    status_contratacao: ['Ativa', 'Encerrada antes de 3 meses', 'Encerrada após 3 meses', 'Substituída', 'Em acompanhamento'],
    areas_interesse: ['Desenvolvimento de Software', 'Dados / BI / Analytics', 'Produto', 'UX/UI Design', 'Agilidade / Projetos', 'QA / Testes', 'Infraestrutura / Cloud / DevOps', 'Cibersegurança', 'Suporte / Service Desk', 'Comercial em tecnologia'],
    senioridades: ['Estágio', 'Trainee', 'Júnior', 'Pleno', 'Sênior', 'Não informado'],
    modalidades: ['Remoto', 'Híbrido', 'Presencial', 'A combinar'],
    tipos_contratacao: ['CLT', 'PJ', 'Estágio', 'Trainee', 'Freelancer', 'A combinar'],
    tipos_regra_match: ['Exclusivo', 'Obrigatório', 'Prioritário', 'Desejável', 'Informativo'],
    operadores_match: ['igual', 'diferente', 'contem', 'nao_contem', 'intersecao_lista', 'maior_igual', 'menor_igual', 'entre', 'vazio', 'nao_vazio'],
    motivos_encerramento_vaga: ['Vaga preenchida', 'Cancelada pelo cliente', 'Sem perfis aderentes', 'Prazo encerrado', 'Outro'],
    motivos_liberacao: ['Recusa da empresa', 'Recusa do talento', 'Prazo de bloqueio encerrado', 'Vaga cancelada', 'Substituição', 'Outro'],
    responsaveis: []
  };
  var rows = [];
  Object.keys(definitions).forEach(function (group) {
    definitions[group].forEach(function (value, index) {
      rows.push({ grupo: group, valor: value, descricao: '', ordem: index + 1, ativo: 'SIM' });
    });
  });
  upsertRowsByCompositeKey_('TH_PARAMETROS', rows, ['grupo', 'valor']);
}

function seedMatchingModel_() {
  var now = nowIso_();
  var user = currentUser_();
  upsertRowsByCompositeKey_('TH_MATCHING_MODELOS', [{
    modelo_id: 'MATCH_PADRAO_2026',
    nome_modelo: 'Modelo padrão Talent Hub',
    descricao: 'Modelo inicial de pontuação por aderência entre vaga e talento',
    ativo: 'SIM',
    versao: '1.0',
    score_minimo_recomendado: 60,
    normalizar_para_100: 'SIM',
    criado_em: now,
    criado_por: user,
    atualizado_em: now,
    atualizado_por: user
  }], ['modelo_id']);

  var criteria = [
    ['CRT_AREA', 'Área principal', 'area_interesse_principal', 'area_vaga', 'igual', 20],
    ['CRT_SENIORIDADE', 'Senioridade', 'senioridade', 'senioridade', 'igual', 15],
    ['CRT_MODALIDADE', 'Modalidade', 'modalidade_preferida', 'modalidade', 'intersecao_lista', 15],
    ['CRT_LOCALIDADE', 'Localidade', 'regioes_interesse', 'cidade/uf', 'intersecao_lista', 10],
    ['CRT_CONTRATACAO', 'Tipo de contratação', 'tipo_contratacao_preferida', 'tipo_contratacao', 'intersecao_lista', 10],
    ['CRT_SALARIO', 'Pretensão salarial', 'pretensao_salarial_min/pretensao_salarial_max', 'faixa_salarial_min/faixa_salarial_max', 'salario_compativel', 10],
    ['CRT_SKILLS', 'Competências', 'principais_competencias', 'requisitos_obrigatorios/requisitos_desejaveis', 'intersecao_lista', 20]
  ].map(function (item) {
    return {
      modelo_criterio_id: item[0], modelo_id: 'MATCH_PADRAO_2026', criterio_nome: item[1],
      campo_talento: item[2], campo_vaga: item[3], tipo_comparacao: item[4],
      modo: 'pontuacao', peso: item[5], ativo: 'SIM', observacao: ''
    };
  });
  upsertRowsByCompositeKey_('TH_MATCHING_MODELO_CRITERIOS', criteria, ['modelo_criterio_id']);
}

function applyDataValidations_() {
  var validations = [
    ['TH_TALENTOS', 'status_pool', 'status_pool'],
    ['TH_CLIENTES', 'status_cliente', 'status_cliente'],
    ['TH_VAGAS', 'status_vaga', 'status_vaga'],
    ['TH_VAGAS', 'senioridade', 'senioridades'],
    ['TH_VAGAS', 'modalidade', 'modalidades'],
    ['TH_VAGAS', 'tipo_contratacao', 'tipos_contratacao'],
    ['TH_VAGA_CRITERIOS', 'tipo_regra', 'tipos_regra_match'],
    ['TH_VAGA_CRITERIOS', 'operador', 'operadores_match'],
    ['TH_PROCESSOS', 'status_processo', 'status_processo'],
    ['TH_SHORTLISTS', 'status_shortlist', 'status_shortlist'],
    ['TH_SHORTLIST_ITENS', 'status_item', 'status_item_shortlist'],
    ['TH_CONTRATACOES', 'status_contratacao', 'status_contratacao']
  ];
  var parameters = getSheetObjects_('TH_PARAMETROS', { raw: true });
  validations.forEach(function (definition) {
    var values = parameters.filter(function (row) {
      return row.grupo === definition[2] && normalizeBoolean_(row.ativo) !== false;
    }).map(function (row) { return String(row.valor); });
    if (!values.length) return;
    var sheet = getSheetOrThrow_(definition[0]);
    var headers = getHeader_(sheet);
    var column = headers.indexOf(definition[1]);
    if (column === -1 || sheet.getMaxRows() < 2) return;
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
    sheet.getRange(2, column + 1, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
  });
}

function formatManagedSheets_(spreadsheet, schema) {
  Object.keys(schema).forEach(function (sheetName) {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return;
    var lastColumn = Math.max(sheet.getLastColumn(), schema[sheetName].length);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, lastColumn)
      .setBackground('#173b57')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setWrap(true);
    sheet.setRowHeight(1, 32);
  });
}
