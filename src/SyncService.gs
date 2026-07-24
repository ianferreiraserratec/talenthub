function syncPessoas() {
  return withScriptLock_(function () {
    var result = syncSourceToCache_('PESSOAS');
    regenerateTalentView_();
    regenerateDashboard_();
    return result;
  });
}

function syncMatriculas() {
  return withScriptLock_(function () {
    var result = syncSourceToCache_('MATRICULAS');
    regenerateTalentView_();
    regenerateDashboard_();
    return result;
  });
}

function syncAll() {
  return withScriptLock_(function () {
    var pessoas = syncSourceToCache_('PESSOAS');
    var matriculas = syncSourceToCache_('MATRICULAS');
    var talents = regenerateTalentView_();
    var dashboard = regenerateDashboard_();
    return {
      ok: true,
      message: 'Sincronização concluída.',
      pessoas: pessoas,
      matriculas: matriculas,
      talentos: talents,
      dashboard: dashboard
    };
  });
}

function syncSourceToCache_(type) {
  var startedAt = nowIso_();
  var syncId = generateId_('SYN_');
  var user = currentUser_();
  var config = getConfigMap_();
  var definitions = {
    PESSOAS: {
      sourceSheet: config.ABA_CDP_PESSOAS || 'PESSOAS',
      targetSheet: 'TH_CACHE_PESSOAS',
      idField: 'pessoa_id',
      sourceHeaders: getDatabaseSchema_().TH_CACHE_PESSOAS.filter(function (header) { return header !== 'sync_em'; })
    },
    MATRICULAS: {
      sourceSheet: config.ABA_CDP_MATRICULAS || 'MATRICULAS',
      targetSheet: 'TH_CACHE_MATRICULAS',
      idField: 'mtr_id',
      sourceHeaders: getDatabaseSchema_().TH_CACHE_MATRICULAS.filter(function (header) { return header !== 'sync_em'; })
    }
  };
  var definition = definitions[type];
  if (!definition) throw new Error('Tipo de sincronização inválido: ' + type);

  var log = {
    sync_id: syncId,
    tipo_sync: type,
    iniciado_em: startedAt,
    finalizado_em: '',
    status: 'EM_EXECUCAO',
    total_linhas_lidas: 0,
    total_linhas_gravadas: 0,
    mensagem: '',
    executado_por: user
  };
  appendObject_('TH_SYNC_LOG', log);

  try {
    var cdpId = String(config.CDP_SPREADSHEET_ID || '').trim();
    if (!cdpId) {
      throw new Error('CDP_SPREADSHEET_ID não configurado. Use a tela Integrações.');
    }
    var sourceSpreadsheet = SpreadsheetApp.openById(cdpId);
    var source = sourceSpreadsheet.getSheetByName(definition.sourceSheet);
    if (!source) throw new Error('Aba de origem não encontrada: ' + definition.sourceSheet);
    var sourceHeaders = getHeader_(source);
    assertRequiredHeaders_(sourceHeaders, definition.sourceHeaders, definition.sourceSheet);

    var rawRows = source.getLastRow() > 1
      ? source.getRange(2, 1, source.getLastRow() - 1, sourceHeaders.length).getValues()
      : [];
    var objects = rowsToObjects_(sourceHeaders, rawRows);
    var unique = {};
    var syncAt = nowIso_();
    objects.forEach(function (row) {
      var id = String(row[definition.idField] == null ? '' : row[definition.idField]).trim();
      if (!id) return;
      var clean = {};
      definition.sourceHeaders.forEach(function (header) { clean[header] = row[header]; });
      clean.sync_em = syncAt;
      unique[id] = clean;
    });
    var targetRows = Object.keys(unique).map(function (key) { return unique[key]; });
    var written = replaceSheetRows_(definition.targetSheet, targetRows);

    finalizeSyncLog_(syncId, {
      finalizado_em: nowIso_(), status: 'CONCLUIDO', total_linhas_lidas: objects.length,
      total_linhas_gravadas: written, mensagem: 'Sincronização concluída.'
    });
    writeAuditLog_('SYNC', definition.targetSheet, syncId, '', '', 'INTEGRACAO', written + ' linhas sincronizadas');
    writeEvent_('Base sincronizada', 'INTEGRACAO', syncId, {}, type + ': ' + written + ' registros sincronizados');
    return { ok: true, type: type, read: objects.length, written: written, syncId: syncId };
  } catch (error) {
    finalizeSyncLog_(syncId, {
      finalizado_em: nowIso_(), status: 'ERRO', mensagem: error.message
    });
    throw error;
  }
}

function finalizeSyncLog_(syncId, patch) {
  try {
    updateObjectById_('TH_SYNC_LOG', 'sync_id', syncId, patch);
  } catch (error) {
    console.error('Falha ao finalizar log de sync: ' + error.message);
  }
}

function regenerateTalentView() {
  return withScriptLock_(regenerateTalentView_);
}

function regenerateTalentView_() {
  var config = getConfigMap_();
  var validDays = Number(config.DIAS_CADASTRO_VALIDO || 90);
  var validTerm = normalizeText_(config.TERMO_STATUS_VALIDO || 'ATIVO');
  var people = getSheetObjects_('TH_CACHE_PESSOAS', { raw: true });
  var terms = indexLatestBy_('TALENT_HUB_STATUS_TERMO', 'pessoa_id', 'atualizado_em');
  var talents = indexBy_('TH_TALENTOS', 'pessoa_id');
  var approvedEnrollmentsByPerson = indexApprovedEnrollmentsByPerson_(
    getSheetObjects_('TH_CACHE_MATRICULAS', { raw: true })
  );
  var processes = getSheetObjects_('TH_PROCESSOS', { raw: true });
  var hires = getSheetObjects_('TH_CONTRATACOES', { raw: true });
  var activeProcessStatuses = ['Pré-selecionado', 'Aguardando confirmação', 'Bloqueado', 'Enviado à empresa', 'Aguardando retorno', 'Entrevista', 'Proposta'];
  var processesByPerson = {};
  processes.forEach(function (process) {
    if (activeProcessStatuses.indexOf(String(process.status_processo || '')) === -1) return;
    var id = String(process.pessoa_id || '').trim();
    if (!id) return;
    if (!processesByPerson[id]) processesByPerson[id] = [];
    processesByPerson[id].push(process);
  });
  var activeHireByPerson = {};
  hires.forEach(function (hire) {
    if (['Ativa', 'Em acompanhamento'].indexOf(String(hire.status_contratacao || '')) !== -1) {
      activeHireByPerson[String(hire.pessoa_id || '').trim()] = true;
    }
  });

  var viewRows = people.map(function (person) {
    var personId = String(person.pessoa_id || '').trim();
    var term = terms[personId] || {};
    var talent = talents[personId] || {};
    var approvedEnrollments = approvedEnrollmentsByPerson[personId] || [];
    var personProcesses = processesByPerson[personId] || [];
    var updatedWithinWindow = isDateWithinDays_(person.atualizado_em, validDays);
    var termActive = normalizeText_(term.status) === validTerm;
    var apt = termActive && updatedWithinWindow;
    var reason = '';
    if (!termActive) reason = 'TERMO_CANCELADO_OU_INEXISTENTE';
    else if (!updatedWithinWindow) reason = 'CADASTRO_DESATUALIZADO';

    var statusPool = derivePoolStatus_(apt, talent, personProcesses, !!activeHireByPerson[personId], reason);
    var blockedUntil = personProcesses.filter(function (process) {
      return process.status_processo === 'Bloqueado' && process.data_limite_bloqueio;
    }).map(function (process) { return process.data_limite_bloqueio; }).sort().pop() || '';
    var age = calculateAge_(person.data_nascimento);
    var enrollmentLabels = uniqueDisplayValues_(approvedEnrollments.map(function (enrollment) {
      return [
        enrollment.modalidade,
        enrollment.ciclo || enrollment.turma,
        enrollment.parceiro
      ].filter(function (value) { return !valueIsBlank_(value); }).join(' · ');
    }));
    var enrollmentModalities = uniqueDisplayValues_(approvedEnrollments.map(function (enrollment) {
      return enrollment.modalidade;
    }));
    var enrollmentCycles = uniqueDisplayValues_(approvedEnrollments.map(function (enrollment) {
      return enrollment.ciclo || enrollment.turma;
    }));
    var enrollmentPartners = uniqueDisplayValues_(approvedEnrollments.map(function (enrollment) {
      return enrollment.parceiro;
    }));

    return {
      pessoa_id: personId,
      nome: person.nome,
      email: person.email,
      email_serratec: person.email_serratec,
      cpf: person.cpf,
      celular: person.celular,
      cidade: person.cidade,
      uf: person.uf,
      genero: person.genero,
      cor_etnia: person.cor_etnia,
      pcd_bol: person.pcd_bol,
      ensino_medio: person.ensino_medio,
      ult_formacao: person.ult_formacao,
      curso: person.curso,
      faculdade: person.faculdade,
      linkedin: person.linkedin,
      curriculo: talent.curriculo_alternativo_url || person.curriculo,
      atualizado_em: person.atualizado_em,
      dias_desde_atualizacao: daysSince_(person.atualizado_em),
      cadastro_atualizado_90d: updatedWithinWindow ? 'SIM' : 'NAO',
      termo_status: term.status || '',
      termo_versao: term.termo_versao || '',
      termo_atualizado_em: term.atualizado_em || '',
      apto_talent_hub: apt ? 'SIM' : 'NAO',
      motivo_nao_apto: reason,
      status_pool: statusPool,
      disponivel_para_oportunidades: talent.disponivel_para_oportunidades,
      momento_profissional: talent.momento_profissional,
      area_interesse_principal: talent.area_interesse_principal,
      areas_interesse_secundarias: talent.areas_interesse_secundarias,
      senioridade: talent.senioridade,
      tipo_contratacao_preferida: talent.tipo_contratacao_preferida,
      modalidade_preferida: talent.modalidade_preferida,
      regioes_interesse: talent.regioes_interesse,
      pretensao_salarial_min: talent.pretensao_salarial_min,
      pretensao_salarial_max: talent.pretensao_salarial_max,
      principais_competencias: talent.principais_competencias,
      processos_ativos: personProcesses.length,
      bloqueado_ate: blockedUntil,
      data_nascimento: person.data_nascimento,
      idade: age === null ? '' : age,
      faixa_etaria: age === null ? '' : ageRangeLabel_(age),
      nacionalidade: person.nacionalidade,
      sit_migratoria: person.sit_migratoria,
      escolaridade: uniqueDisplayValues_([
        person.ult_formacao,
        person.ensino_medio,
        person.curso,
        person.faculdade
      ]).join(' · '),
      formacoes_serratec: enrollmentLabels.join('; '),
      modalidades_serratec: enrollmentModalities.join('; '),
      ciclos_serratec: enrollmentCycles.join('; '),
      parceiros_formacao_serratec: enrollmentPartners.join('; '),
      qtd_formacoes_serratec_aprovadas: approvedEnrollments.length,
      possui_formacao_serratec_aprovada: approvedEnrollments.length ? 'SIM' : 'NAO',
      curriculo_disponivel: valueIsBlank_(person.curriculo) && valueIsBlank_(talent.curriculo_alternativo_url) ? 'NAO' : 'SIM'
    };
  });

  replaceSheetRows_('VW_TALENTOS_APTOS', viewRows);
  writeAuditLog_('UPDATE', 'VW_TALENTOS_APTOS', 'VIEW', '', '', 'SISTEMA', viewRows.length + ' talentos consolidados');
  return { ok: true, total: viewRows.length };
}

function indexApprovedEnrollmentsByPerson_(enrollments) {
  var index = {};
  (enrollments || []).forEach(function (enrollment) {
    if (!isApprovedEnrollment_(enrollment)) return;
    var personId = String(enrollment.pessoa_id || '').trim();
    if (!personId) return;
    if (!index[personId]) index[personId] = [];
    index[personId].push(enrollment);
  });
  return index;
}

function isApprovedEnrollment_(enrollment) {
  var studentStatus = normalizeText_(enrollment && enrollment.status_aluno);
  var courseStatus = normalizeText_(enrollment && enrollment.status_curso);
  var approvedPattern = /(aprov|concluid|certificad)/;
  if (approvedPattern.test(studentStatus)) return true;
  return !studentStatus && approvedPattern.test(courseStatus);
}

function uniqueDisplayValues_(values) {
  var seen = {};
  return (values || []).filter(function (value) {
    var display = String(value == null ? '' : value).trim();
    var normalized = normalizeText_(display);
    if (!normalized || seen[normalized]) return false;
    seen[normalized] = true;
    return true;
  }).map(function (value) { return String(value).trim(); });
}

function calculateAge_(birthDate, referenceDate) {
  var birth = parseDateValue_(birthDate);
  if (!birth) return null;
  var reference = referenceDate || new Date();
  var age = reference.getFullYear() - birth.getFullYear();
  var beforeBirthday = reference.getMonth() < birth.getMonth() ||
    (reference.getMonth() === birth.getMonth() && reference.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

function ageRangeLabel_(age) {
  var number = Number(age);
  if (!Number.isFinite(number)) return '';
  if (number < 18) return 'Menor de 18';
  if (number <= 24) return '18 a 24';
  if (number <= 29) return '25 a 29';
  if (number <= 39) return '30 a 39';
  if (number <= 49) return '40 a 49';
  return '50 ou mais';
}

function derivePoolStatus_(apt, talent, processes, hasActiveHire, notAptReason) {
  if (hasActiveHire) return 'Contratado';
  if (processes.some(function (process) { return process.status_processo === 'Bloqueado'; })) return 'Bloqueado';
  if (processes.length) return 'Em processo';
  if (!apt) return notAptReason === 'CADASTRO_DESATUALIZADO' ? 'Inativo' : 'Inelegível';
  if (String(talent.status_pool || '') === 'Carência') return 'Carência';
  if (normalizeBoolean_(talent.disponivel_para_oportunidades) === false || String(talent.status_pool || '') === 'Inativo') return 'Inativo';
  return 'Disponível';
}

function indexBy_(sheetName, keyField) {
  var index = {};
  getSheetObjects_(sheetName, { raw: true }).forEach(function (row) {
    var key = String(row[keyField] == null ? '' : row[keyField]).trim();
    if (key) index[key] = row;
  });
  return index;
}

function indexLatestBy_(sheetName, keyField, dateField) {
  var index = {};
  getSheetObjects_(sheetName, { raw: true }).forEach(function (row) {
    var key = String(row[keyField] == null ? '' : row[keyField]).trim();
    if (!key) return;
    if (!index[key]) {
      index[key] = row;
      return;
    }
    var currentDate = parseDateValue_(index[key][dateField]);
    var candidateDate = parseDateValue_(row[dateField]);
    if (candidateDate && (!currentDate || candidateDate.getTime() >= currentDate.getTime())) index[key] = row;
  });
  return index;
}

function getSyncStatus() {
  var rows = getSheetObjects_('TH_SYNC_LOG', { raw: true });
  rows.sort(function (a, b) { return String(b.iniciado_em || '').localeCompare(String(a.iniciado_em || '')); });
  var dashboard = getDashboard();
  var metrics = dashboard.metrics || {};
  return serializeForClient_({
    latest: rows.slice(0, 20),
    quality: {
      pessoas_sincronizadas: metrics.talentos_total_cache || 0,
      pessoas_com_formacao_aprovada: metrics.talentos_com_formacao_serratec_aprovada || 0,
      formacoes_aprovadas: metrics.total_formacoes_serratec_aprovadas || 0,
      pessoas_com_curriculo: metrics.talentos_com_curriculo || 0
    }
  });
}
