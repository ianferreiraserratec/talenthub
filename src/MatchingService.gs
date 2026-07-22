function getMatchingSetup(vagaId) {
  var jobs = getVagas({}).filter(function (job) {
    return ['Preenchida', 'Encerrada sem contratação', 'Cancelada'].indexOf(String(job.status_vaga || '')) === -1;
  });
  var models = getMatchingModels();
  var selectedJobId = String(vagaId || (jobs[0] && jobs[0].vaga_id) || '');
  var runs = getSheetObjects_('TH_MATCHING_RUNS', { raw: true }).filter(function (run) {
    return !selectedJobId || String(run.vaga_id || '') === selectedJobId;
  });
  runs.sort(function (a, b) { return String(b.executado_em || '').localeCompare(String(a.executado_em || '')); });
  return serializeForClient_({
    vagas: jobs,
    modelos: models,
    vaga_id: selectedJobId,
    criterios_vaga: selectedJobId ? getVagaCriterios(selectedJobId) : [],
    execucoes: runs.slice(0, 20),
    campos_talento: getMatchingTalentFields_(),
    tipos_regra: ['Exclusivo', 'Obrigatório', 'Prioritário', 'Desejável', 'Informativo'],
    operadores: ['igual', 'diferente', 'contem', 'nao_contem', 'intersecao_lista', 'maior_igual', 'menor_igual', 'entre', 'vazio', 'nao_vazio']
  });
}

function getMatchingTalentFields_() {
  return [
    ['area_interesse_principal', 'Área principal'],
    ['areas_interesse_secundarias', 'Áreas secundárias'],
    ['senioridade', 'Senioridade'],
    ['principais_competencias', 'Competências'],
    ['modalidade_preferida', 'Modalidade preferida'],
    ['tipo_contratacao_preferida', 'Tipo de contratação'],
    ['regioes_interesse', 'Regiões de interesse'],
    ['pretensao_salarial_min', 'Pretensão mínima'],
    ['pretensao_salarial_max', 'Pretensão máxima'],
    ['disponibilidade_inicio', 'Disponibilidade de início'],
    ['cidade', 'Cidade'],
    ['uf', 'UF'],
    ['genero', 'Gênero'],
    ['cor_etnia', 'Cor/etnia'],
    ['pcd_bol', 'Pessoa com deficiência'],
    ['ensino_medio', 'Ensino médio'],
    ['curso', 'Curso'],
    ['ult_formacao', 'Última formação']
  ].map(function (field) { return { valor: field[0], descricao: field[1] }; });
}

function getMatchingModels() {
  var criteria = getSheetObjects_('TH_MATCHING_MODELO_CRITERIOS', { raw: true });
  var models = getSheetObjects_('TH_MATCHING_MODELOS', { raw: true }).map(function (model) {
    var copy = Object.assign({}, model);
    copy.criterios = criteria.filter(function (criterion) {
      return String(criterion.modelo_id || '') === String(model.modelo_id || '');
    }).sort(function (a, b) {
      return String(a.modelo_criterio_id || '').localeCompare(String(b.modelo_criterio_id || ''));
    });
    return copy;
  });
  return serializeForClient_(models);
}

function saveMatchingModel(payload, criterios) {
  payload = payload || {};
  criterios = Array.isArray(criterios) ? criterios : [];
  requireFields_(payload, ['modelo_id', 'nome_modelo'], 'Modelo de matching');
  assertNonNegativeNumber_(payload.score_minimo_recomendado, 'score_minimo_recomendado', true);

  return withScriptLock_(function () {
    var modelId = String(payload.modelo_id).trim();
    var modelFields = getDatabaseSchema_().TH_MATCHING_MODELOS;
    var cleanModel = sanitizePayload_(payload, modelFields);
    var now = nowIso_();
    var user = currentUser_();
    var before = getObjectById_('TH_MATCHING_MODELOS', 'modelo_id', modelId, { raw: true });
    cleanModel.modelo_id = modelId;
    cleanModel.ativo = valueIsBlank_(cleanModel.ativo) ? 'SIM' : cleanModel.ativo;
    cleanModel.normalizar_para_100 = valueIsBlank_(cleanModel.normalizar_para_100) ? 'SIM' : cleanModel.normalizar_para_100;
    cleanModel.atualizado_em = now;
    cleanModel.atualizado_por = user;
    if (before) {
      updateObjectById_('TH_MATCHING_MODELOS', 'modelo_id', modelId, cleanModel, modelFields);
    } else {
      cleanModel.criado_em = now;
      cleanModel.criado_por = user;
      appendObject_('TH_MATCHING_MODELOS', cleanModel);
    }

    var otherCriteria = getSheetObjects_('TH_MATCHING_MODELO_CRITERIOS', { raw: true }).filter(function (criterion) {
      return String(criterion.modelo_id || '') !== modelId;
    });
    var cleanCriteria = criterios.map(function (criterion, index) {
      requireFields_(criterion, ['criterio_nome', 'campo_talento', 'campo_vaga', 'tipo_comparacao'], 'Critério do modelo');
      assertNonNegativeNumber_(criterion.peso, 'peso', false);
      return {
        modelo_criterio_id: criterion.modelo_criterio_id || generateId_('MCR_'),
        modelo_id: modelId,
        criterio_nome: String(criterion.criterio_nome).trim(),
        campo_talento: String(criterion.campo_talento).trim(),
        campo_vaga: String(criterion.campo_vaga).trim(),
        tipo_comparacao: String(criterion.tipo_comparacao).trim(),
        modo: criterion.modo || 'pontuacao',
        peso: Number(criterion.peso || 0),
        ativo: valueIsBlank_(criterion.ativo) ? 'SIM' : criterion.ativo,
        observacao: criterion.observacao || '',
        ordem: index + 1
      };
    });
    replaceSheetRows_('TH_MATCHING_MODELO_CRITERIOS', otherCriteria.concat(cleanCriteria));
    writeEntityAudit_(before ? 'UPDATE' : 'CREATE', 'MATCHING_MODELO', modelId, before || {}, cleanModel, 'WEB_APP');
    return serializeForClient_({ modelo: cleanModel, criterios: cleanCriteria });
  });
}

function runMatching(vagaId, qtdPerfis, modeloId) {
  var requested = Math.min(Math.max(Number(qtdPerfis || 5), 1), 100);
  var job = getObjectById_('TH_VAGAS', 'vaga_id', vagaId, { raw: true });
  if (!job) throw new Error('Vaga não encontrada: ' + vagaId);
  if (['Preenchida', 'Encerrada sem contratação', 'Cancelada'].indexOf(String(job.status_vaga || '')) !== -1) {
    throw new Error('Não é possível executar matchmaking para uma vaga encerrada.');
  }

  var config = getConfigMap_();
  var selectedModelId = String(modeloId || config.MATCHING_MODELO_PADRAO || '').trim();
  var model = getObjectById_('TH_MATCHING_MODELOS', 'modelo_id', selectedModelId, { raw: true });
  if (!model) throw new Error('Modelo de matching não encontrado: ' + selectedModelId);
  var modelCriteria = getSheetObjects_('TH_MATCHING_MODELO_CRITERIOS', { raw: true }).filter(function (criterion) {
    return String(criterion.modelo_id || '') === selectedModelId && normalizeBoolean_(criterion.ativo) !== false;
  });
  var vacancyCriteria = getSheetObjects_('TH_VAGA_CRITERIOS', { raw: true }).filter(function (criterion) {
    return String(criterion.vaga_id || '') === String(vagaId) && normalizeBoolean_(criterion.ativo) !== false;
  });
  var aptTalents = getSheetObjects_('VW_TALENTOS_APTOS', { raw: true }).filter(function (talent) {
    return String(talent.apto_talent_hub || '') === 'SIM';
  });
  var eligibleTalents = aptTalents.filter(function (talent) {
    return String(talent.status_pool || '') === 'Disponível';
  });

  return withScriptLock_(function () {
    var runId = generateId_('RUN_');
    var now = nowIso_();
    var user = currentUser_();
    var run = {
      run_id: runId,
      vaga_id: vagaId,
      modelo_id: selectedModelId,
      qtd_perfis_solicitados: requested,
      executado_em: now,
      executado_por: user,
      status_run: 'Em execução',
      total_talentos_avaliados: eligibleTalents.length,
      total_talentos_aptos: aptTalents.length,
      total_talentos_eliminados: 0,
      total_recomendados: 0,
      observacoes: aptTalents.length - eligibleTalents.length + ' talentos aptos indisponíveis não avaliados.'
    };
    appendObject_('TH_MATCHING_RUNS', run);

    try {
      var evaluated = eligibleTalents.map(function (talent) {
        return evaluateTalentForJob_(talent, job, modelCriteria, vacancyCriteria, model);
      });
      evaluated.sort(function (a, b) {
        if (a.eliminado !== b.eliminado) return a.eliminado ? 1 : -1;
        if (b.score_total !== a.score_total) return b.score_total - a.score_total;
        return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
      });

      var minimumScore = Number(model.score_minimo_recomendado || 0);
      var recommendedCount = 0;
      var resultRows = evaluated.map(function (evaluation, index) {
        var recommended = !evaluation.eliminado && recommendedCount < requested && evaluation.score_total >= minimumScore;
        if (recommended) recommendedCount += 1;
        return {
          resultado_id: generateId_('RES_'),
          run_id: runId,
          vaga_id: vagaId,
          pessoa_id: evaluation.pessoa_id,
          score_total: evaluation.score_total,
          score_area: evaluation.score_area,
          score_senioridade: evaluation.score_senioridade,
          score_skills: evaluation.score_skills,
          score_modalidade: evaluation.score_modalidade,
          score_localidade: evaluation.score_localidade,
          score_salario: evaluation.score_salario,
          score_diversidade: evaluation.score_diversidade,
          criterios_atendidos: evaluation.criterios_atendidos.join(' | '),
          criterios_nao_atendidos: evaluation.criterios_nao_atendidos.join(' | '),
          criterios_exclusao: evaluation.criterios_exclusao.join(' | '),
          justificativa: evaluation.justificativa,
          recomendado: recommended ? 'SIM' : 'NAO',
          ordem_ranking: index + 1,
          status_resultado: recommended ? 'Recomendado' : 'Descartado',
          criado_em: now
        };
      });
      if (resultRows.length) {
        var resultSheet = getSheetOrThrow_('TH_MATCHING_RESULTADOS');
        var resultHeaders = getHeader_(resultSheet);
        var resultMatrix = resultRows.map(function (row) { return objectToRow_(resultHeaders, row); });
        resultSheet.getRange(resultSheet.getLastRow() + 1, 1, resultMatrix.length, resultHeaders.length).setValues(resultMatrix);
      }

      var eliminatedCount = evaluated.filter(function (item) { return item.eliminado; }).length;
      updateObjectById_('TH_MATCHING_RUNS', 'run_id', runId, {
        status_run: 'Concluído',
        total_talentos_eliminados: eliminatedCount,
        total_recomendados: recommendedCount
      });
      writeAuditLog_('MATCH', 'VAGA', vagaId, '', '', 'WEB_APP', eligibleTalents.length + ' talentos avaliados; ' + recommendedCount + ' recomendados');
      writeEvent_('Matchmaking executado', 'VAGA', vagaId, { vaga_id: vagaId, cliente_id: job.cliente_id }, recommendedCount + ' talentos recomendados');
      return getMatchingResults(runId);
    } catch (error) {
      updateObjectById_('TH_MATCHING_RUNS', 'run_id', runId, { status_run: 'Erro', observacoes: error.message });
      throw error;
    }
  });
}

function getMatchingResults(runId) {
  var run = getObjectById_('TH_MATCHING_RUNS', 'run_id', runId, { raw: true });
  if (!run) throw new Error('Execução de matching não encontrada: ' + runId);
  var talents = indexBy_('VW_TALENTOS_APTOS', 'pessoa_id');
  var results = getSheetObjects_('TH_MATCHING_RESULTADOS', { raw: true }).filter(function (result) {
    return String(result.run_id || '') === String(runId);
  }).map(function (result) {
    var talent = talents[String(result.pessoa_id || '')] || {};
    return Object.assign({}, result, {
      nome: talent.nome || '',
      email: talent.email || talent.email_serratec || '',
      cidade: talent.cidade || '',
      uf: talent.uf || '',
      area_interesse_principal: talent.area_interesse_principal || '',
      senioridade: talent.senioridade || '',
      principais_competencias: talent.principais_competencias || '',
      status_pool: talent.status_pool || ''
    });
  });
  results.sort(function (a, b) { return Number(a.ordem_ranking || 0) - Number(b.ordem_ranking || 0); });
  return serializeForClient_({
    run: run,
    vaga: getObjectById_('TH_VAGAS', 'vaga_id', run.vaga_id, { raw: true }),
    resultados: results
  });
}

function evaluateTalentForJob_(talent, job, modelCriteria, vacancyCriteria, model) {
  var attended = [];
  var missed = [];
  var exclusions = [];
  var totalWeight = 0;
  var earned = 0;
  var categoryScores = { area: 0, senioridade: 0, skills: 0, modalidade: 0, localidade: 0, salario: 0, diversidade: 0 };

  (modelCriteria || []).forEach(function (criterion) {
    var weight = Math.max(Number(criterion.peso || 0), 0);
    var comparison = compareModelCriterion_(talent, job, criterion);
    totalWeight += weight;
    earned += weight * comparison.ratio;
    var category = matchingCategory_(criterion.campo_talento, criterion.criterio_nome);
    categoryScores[category] = (categoryScores[category] || 0) + weight * comparison.ratio;
    if (comparison.matched) attended.push(criterion.criterio_nome);
    else missed.push(criterion.criterio_nome);
  });

  (vacancyCriteria || []).forEach(function (criterion) {
    var match = evaluateVacancyCriterion_(talent, criterion);
    var type = String(criterion.tipo_regra || 'Informativo');
    var label = criterion.criterio_nome || criterion.campo_talento;
    if (match) attended.push(label);
    else missed.push(label);
    if (['Exclusivo', 'Obrigatório'].indexOf(type) !== -1 && !match) exclusions.push(label);
    if (['Prioritário', 'Desejável'].indexOf(type) !== -1) {
      var bonus = Math.max(Number(criterion.peso_override || (type === 'Prioritário' ? 10 : 5)), 0);
      totalWeight += bonus;
      if (match) {
        earned += bonus;
        var bonusCategory = matchingCategory_(criterion.campo_talento, criterion.criterio_nome);
        categoryScores[bonusCategory] = (categoryScores[bonusCategory] || 0) + bonus;
      }
    }
  });

  var normalize = normalizeBoolean_(model.normalizar_para_100) !== false;
  var totalScore = totalWeight > 0 ? (normalize ? earned / totalWeight * 100 : earned) : 0;
  totalScore = Math.round(totalScore * 100) / 100;
  var categoryTotal = function (key) { return Math.round(Number(categoryScores[key] || 0) * 100) / 100; };
  var justification = exclusions.length
    ? 'Eliminado por critério obrigatório: ' + exclusions.join(', ') + '.'
    : 'Aderência de ' + totalScore.toFixed(1).replace('.', ',') + '%. ' + (attended.length ? 'Atende: ' + attended.slice(0, 5).join(', ') + '.' : 'Nenhum critério pontuado.');

  return {
    pessoa_id: talent.pessoa_id,
    nome: talent.nome,
    eliminado: exclusions.length > 0,
    score_total: exclusions.length ? 0 : totalScore,
    score_area: categoryTotal('area'),
    score_senioridade: categoryTotal('senioridade'),
    score_skills: categoryTotal('skills'),
    score_modalidade: categoryTotal('modalidade'),
    score_localidade: categoryTotal('localidade'),
    score_salario: categoryTotal('salario'),
    score_diversidade: categoryTotal('diversidade'),
    criterios_atendidos: attended,
    criterios_nao_atendidos: missed,
    criterios_exclusao: exclusions,
    justificativa: justification
  };
}

function compareModelCriterion_(talent, job, criterion) {
  var type = String(criterion.tipo_comparacao || 'igual');
  if (type === 'salario_compativel') return compareSalaryRanges_(talent, job);
  var talentValue = resolveMatchingField_(talent, criterion.campo_talento);
  var jobValue = resolveMatchingField_(job, criterion.campo_vaga);
  if (type === 'intersecao_lista') {
    var talentList = splitList_(talentValue);
    var jobList = splitList_(jobValue);
    if (!talentList.length || !jobList.length) return { matched: false, ratio: 0 };
    var intersection = jobList.filter(function (expected) {
      return talentList.some(function (actual) { return actual === expected || actual.indexOf(expected) !== -1 || expected.indexOf(actual) !== -1; });
    });
    var ratio = Math.min(intersection.length / Math.max(jobList.length, 1), 1);
    if (String(criterion.campo_vaga || '') === 'cidade/uf' && intersection.length) ratio = 1;
    return { matched: intersection.length > 0, ratio: ratio };
  }
  var left = normalizeText_(talentValue);
  var right = normalizeText_(jobValue);
  if (!left || !right) return { matched: false, ratio: 0 };
  if (type === 'contem') return { matched: left.indexOf(right) !== -1, ratio: left.indexOf(right) !== -1 ? 1 : 0 };
  var equal = left === right;
  return { matched: equal, ratio: equal ? 1 : 0 };
}

function compareSalaryRanges_(talent, job) {
  var talentMin = parseMoney_(talent.pretensao_salarial_min);
  var talentMax = parseMoney_(talent.pretensao_salarial_max);
  var jobMin = parseMoney_(job.faixa_salarial_min);
  var jobMax = parseMoney_(job.faixa_salarial_max);
  if (talentMin === null && talentMax === null) return { matched: false, ratio: 0 };
  if (jobMin === null && jobMax === null) return { matched: false, ratio: 0 };
  var effectiveTalentMin = talentMin === null ? 0 : talentMin;
  var effectiveTalentMax = talentMax === null ? Number.MAX_SAFE_INTEGER : talentMax;
  var effectiveJobMin = jobMin === null ? 0 : jobMin;
  var effectiveJobMax = jobMax === null ? Number.MAX_SAFE_INTEGER : jobMax;
  var overlap = effectiveTalentMin <= effectiveJobMax && effectiveJobMin <= effectiveTalentMax;
  return { matched: overlap, ratio: overlap ? 1 : 0 };
}

function resolveMatchingField_(record, expression) {
  var fields = String(expression || '').split('/').map(function (field) { return field.trim(); }).filter(Boolean);
  if (!fields.length) return '';
  return fields.map(function (field) { return record[field]; }).filter(function (value) { return !valueIsBlank_(value); }).join(', ');
}

function matchingCategory_(field, name) {
  var value = normalizeText_(String(field || '') + ' ' + String(name || ''));
  if (/(genero|etnia|pcd|divers)/.test(value)) return 'diversidade';
  if (/(compet|skill|requisito)/.test(value)) return 'skills';
  if (/(senior)/.test(value)) return 'senioridade';
  if (/(modalidade)/.test(value)) return 'modalidade';
  if (/(cidade|uf|regiao|local)/.test(value)) return 'localidade';
  if (/(salario|pretensao)/.test(value)) return 'salario';
  return 'area';
}

function evaluateVacancyCriterion_(talent, criterion) {
  var actual = resolveMatchingField_(talent, criterion.campo_talento);
  var expected = criterion.valor_esperado;
  var operator = String(criterion.operador || 'igual');
  var left = normalizeText_(actual);
  var right = normalizeText_(expected);
  if (operator === 'vazio') return valueIsBlank_(actual);
  if (operator === 'nao_vazio') return !valueIsBlank_(actual);
  if (operator === 'igual') return left === right;
  if (operator === 'diferente') return left !== right;
  if (operator === 'contem') return !!right && left.indexOf(right) !== -1;
  if (operator === 'nao_contem') return !right || left.indexOf(right) === -1;
  if (operator === 'intersecao_lista') {
    var actualList = splitList_(actual);
    var expectedList = splitList_(expected);
    return expectedList.some(function (item) { return actualList.indexOf(item) !== -1; });
  }
  if (operator === 'maior_igual') return Number(actual) >= Number(expected);
  if (operator === 'menor_igual') return Number(actual) <= Number(expected);
  if (operator === 'entre') {
    var bounds = splitList_(expected).map(Number);
    return bounds.length >= 2 && Number(actual) >= Math.min(bounds[0], bounds[1]) && Number(actual) <= Math.max(bounds[0], bounds[1]);
  }
  return false;
}
