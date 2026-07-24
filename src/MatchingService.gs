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
    operadores: ['igual', 'diferente', 'contem', 'nao_contem', 'intersecao_lista', 'maior_igual', 'menor_igual', 'entre', 'vazio', 'nao_vazio'],
    campos_vaga: getMatchingJobFields_()
  });
}

function getMatchingJobContext(vagaId) {
  var selectedJobId = String(vagaId || '').trim();
  if (!selectedJobId) {
    return serializeForClient_({
      vaga_id: '',
      criterios_vaga: [],
      execucoes: []
    });
  }
  var runs = getSheetObjects_('TH_MATCHING_RUNS', { raw: true }).filter(function (run) {
    return String(run.vaga_id || '') === selectedJobId;
  });
  runs.sort(function (a, b) { return String(b.executado_em || '').localeCompare(String(a.executado_em || '')); });
  return serializeForClient_({
    vaga_id: selectedJobId,
    criterios_vaga: getVagaCriterios(selectedJobId),
    execucoes: runs.slice(0, 20)
  });
}

function getMatchingTalentFields_() {
  return [
    ['formacoes_serratec', 'Formações Serratec aprovadas', false],
    ['modalidades_serratec', 'Modalidades de formação Serratec', false],
    ['ciclos_serratec', 'Ciclos/turmas Serratec', false],
    ['parceiros_formacao_serratec', 'Parceiros das formações Serratec', false],
    ['qtd_formacoes_serratec_aprovadas', 'Quantidade de formações Serratec aprovadas', false],
    ['possui_formacao_serratec_aprovada', 'Possui formação Serratec aprovada', false],
    ['escolaridade', 'Escolaridade', false],
    ['ensino_medio', 'Situação do ensino médio', false],
    ['curso', 'Curso informado', false],
    ['faculdade', 'Instituição de ensino', false],
    ['area_interesse_principal', 'Área principal', false],
    ['areas_interesse_secundarias', 'Áreas secundárias', false],
    ['senioridade', 'Senioridade', false],
    ['principais_competencias', 'Competências', false],
    ['modalidade_preferida', 'Modalidade preferida', false],
    ['tipo_contratacao_preferida', 'Tipo de contratação', false],
    ['regioes_interesse', 'Regiões de interesse', false],
    ['pretensao_salarial_min', 'Pretensão mínima', false],
    ['pretensao_salarial_max', 'Pretensão máxima', false],
    ['pretensao_salarial_min/pretensao_salarial_max', 'Faixa de pretensão salarial', false],
    ['disponibilidade_inicio', 'Disponibilidade de início', false],
    ['cidade', 'Cidade', false],
    ['uf', 'UF', false],
    ['curriculo_disponivel', 'Currículo disponível', false],
    ['genero', 'Gênero', true],
    ['cor_etnia', 'Cor/etnia', true],
    ['pcd_bol', 'Pessoa com deficiência', true],
    ['idade', 'Idade', true],
    ['faixa_etaria', 'Faixa etária', true],
    ['nacionalidade', 'Nacionalidade', true],
    ['sit_migratoria', 'Situação migratória', true],
    ['ult_formacao', 'Última formação', false]
  ].map(function (field) { return { valor: field[0], descricao: field[1], sensivel: field[2] ? 'SIM' : 'NAO' }; });
}

function getMatchingJobFields_() {
  return [
    ['area_vaga', 'Área da vaga'],
    ['senioridade', 'Senioridade'],
    ['modalidade', 'Modalidade'],
    ['tipo_contratacao', 'Tipo de contratação'],
    ['cidade', 'Cidade'],
    ['uf', 'UF'],
    ['cidade/uf', 'Cidade e UF'],
    ['faixa_salarial_min/faixa_salarial_max', 'Faixa salarial'],
    ['requisitos_obrigatorios', 'Requisitos obrigatórios mapeados'],
    ['requisitos_desejaveis', 'Requisitos desejáveis mapeados'],
    ['requisitos_obrigatorios/requisitos_desejaveis', 'Todos os requisitos mapeados']
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

function invalidateMatchingRuns_(predicate, reason) {
  if (typeof predicate !== 'function') {
    throw new Error('Predicado inválido para cancelamento de execuções de matching.');
  }
  var cancellationReason = String(reason || 'Configuração do matching alterada. Execute uma nova análise.').trim();
  var candidates = getSheetObjects_('TH_MATCHING_RUNS', { raw: true }).filter(function (run) {
    return String(run.status_run || '') === 'Concluído' && predicate(run);
  });
  var updated = [];

  try {
    candidates.forEach(function (run) {
      updateObjectById_('TH_MATCHING_RUNS', 'run_id', run.run_id, {
        status_run: 'Cancelado',
        observacoes: cancellationReason
      });
      updated.push(run);
    });
  } catch (error) {
    var rollbackFailures = [];
    updated.slice().reverse().forEach(function (run) {
      try {
        updateObjectById_('TH_MATCHING_RUNS', 'run_id', run.run_id, run);
      } catch (rollbackError) {
        rollbackFailures.push(String(run.run_id || '') + ': ' + rollbackError.message);
      }
    });
    var rollbackMessage = rollbackFailures.length
      ? ' A reversão das execuções também falhou: ' + rollbackFailures.join('; ') + '.'
      : '';
    throw new Error('Não foi possível invalidar as execuções anteriores de matching.' +
      rollbackMessage + ' Motivo: ' + error.message);
  }

  return {
    total_invalidado: updated.length,
    runs_anteriores: updated
  };
}

function saveMatchingModel(payload, criterios) {
  payload = payload || {};
  criterios = Array.isArray(criterios) ? criterios : [];
  requireFields_(payload, ['modelo_id', 'nome_modelo'], 'Modelo de matching');
  assertNonNegativeNumber_(payload.score_minimo_recomendado, 'score_minimo_recomendado', true);
  if (normalizeBoolean_(payload.normalizar_para_100) !== false && Number(payload.score_minimo_recomendado || 0) > 100) {
    throw new Error('score_minimo_recomendado não pode ultrapassar 100 em um modelo normalizado.');
  }
  var allowedTalentFields = getMatchingTalentFields_().map(function (field) { return field.valor; });
  var allowedJobFields = getMatchingJobFields_().map(function (field) { return field.valor; });
  criterios.forEach(function (criterion) {
    requireFields_(criterion, ['criterio_nome', 'campo_talento', 'campo_vaga', 'tipo_comparacao'], 'Critério do modelo');
    assertNonNegativeNumber_(criterion.peso, 'peso', false);
    if (!isMappedMatchingExpression_(criterion.campo_talento, allowedTalentFields)) {
      throw new Error('Campo de talento não mapeado para o matching: ' + criterion.campo_talento);
    }
    if (!isMappedMatchingExpression_(criterion.campo_vaga, allowedJobFields)) {
      throw new Error('Campo da vaga não mapeado para o matching: ' + criterion.campo_vaga);
    }
    if (isSensitiveMatchingField_(criterion.campo_talento)) {
      throw new Error('Dados sensíveis não podem fazer parte do modelo-base. Configure "' + criterion.criterio_nome + '" como critério explícito da vaga.');
    }
  });

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
    var allCriteriaBefore = getSheetObjects_('TH_MATCHING_MODELO_CRITERIOS', { raw: true });
    var otherCriteria = allCriteriaBefore.filter(function (criterion) {
      return String(criterion.modelo_id || '') !== modelId;
    });
    var modelRunsBefore = getSheetObjects_('TH_MATCHING_RUNS', { raw: true }).filter(function (run) {
      return String(run.modelo_id || '') === modelId && String(run.status_run || '') === 'Concluído';
    });
    var invalidationAttempted = false;
    var cleanCriteria = criterios.map(function (criterion, index) {
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
    try {
      if (before) {
        updateObjectById_('TH_MATCHING_MODELOS', 'modelo_id', modelId, cleanModel, modelFields);
      } else {
        cleanModel.criado_em = now;
        cleanModel.criado_por = user;
        appendObject_('TH_MATCHING_MODELOS', cleanModel);
      }
      replaceSheetRows_('TH_MATCHING_MODELO_CRITERIOS', otherCriteria.concat(cleanCriteria));
      invalidationAttempted = true;
      invalidateMatchingRuns_(function (run) {
        return String(run.modelo_id || '') === modelId;
      }, 'Modelo de matching alterado. Execute uma nova análise antes de gerar uma shortlist.');
    } catch (error) {
      var rollbackFailures = [];
      try {
        if (before) updateObjectById_('TH_MATCHING_MODELOS', 'modelo_id', modelId, before);
        else deleteObjectById_('TH_MATCHING_MODELOS', 'modelo_id', modelId);
        replaceSheetRows_('TH_MATCHING_MODELO_CRITERIOS', allCriteriaBefore);
      } catch (rollbackError) {
        rollbackFailures.push(rollbackError.message);
      }
      if (invalidationAttempted) {
        modelRunsBefore.forEach(function (run) {
          try {
            updateObjectById_('TH_MATCHING_RUNS', 'run_id', run.run_id, run);
          } catch (runRollbackError) {
            rollbackFailures.push('execução ' + run.run_id + ': ' + runRollbackError.message);
          }
        });
      }
      var rollbackMessage = rollbackFailures.length
        ? ' A reversão também falhou: ' + rollbackFailures.join('; ') + '.'
        : '';
      throw new Error('Não foi possível salvar o modelo de matching.' + rollbackMessage + ' Motivo: ' + error.message);
    }
    writeEntityAudit_(before ? 'UPDATE' : 'CREATE', 'MATCHING_MODELO', modelId, before || {}, cleanModel, 'WEB_APP');
    return serializeForClient_({ modelo: cleanModel, criterios: cleanCriteria });
  });
}

function isMappedMatchingExpression_(expression, allowedFields) {
  var text = String(expression || '').trim();
  if (!text) return false;
  if ((allowedFields || []).indexOf(text) !== -1) return true;
  var parts = text.split('/').map(function (part) { return part.trim(); }).filter(Boolean);
  return parts.length > 1 && parts.every(function (part) {
    return (allowedFields || []).indexOf(part) !== -1;
  });
}

function runMatching(vagaId, qtdPerfis, modeloId) {
  var requestedNumber = Number(qtdPerfis || 5);
  if (!Number.isFinite(requestedNumber)) throw new Error('Quantidade de perfis inválida.');
  var requested = Math.min(Math.max(Math.floor(requestedNumber), 1), 100);

  var config = getConfigMap_();
  var selectedModelId = String(modeloId || config.MATCHING_MODELO_PADRAO || '').trim();
  var job;
  var model;
  var modelCriteria;
  var vacancyCriteria;
  var aptTalents;
  var eligibleTalents;

  return withScriptLock_(function () {
    job = getObjectById_('TH_VAGAS', 'vaga_id', vagaId, { raw: true });
    if (!job) throw new Error('Vaga não encontrada: ' + vagaId);
    if (['Preenchida', 'Encerrada sem contratação', 'Cancelada'].indexOf(String(job.status_vaga || '')) !== -1) {
      throw new Error('Não é possível executar matchmaking para uma vaga encerrada.');
    }
    model = getObjectById_('TH_MATCHING_MODELOS', 'modelo_id', selectedModelId, { raw: true });
    if (!model) throw new Error('Modelo de matching não encontrado: ' + selectedModelId);
    if (normalizeBoolean_(model.ativo) === false) {
      throw new Error('O modelo de matching selecionado está inativo. Reative-o antes de executar uma nova análise.');
    }
    modelCriteria = getSheetObjects_('TH_MATCHING_MODELO_CRITERIOS', { raw: true }).filter(function (criterion) {
      return String(criterion.modelo_id || '') === selectedModelId &&
        normalizeBoolean_(criterion.ativo) !== false &&
        !isSensitiveMatchingField_(criterion.campo_talento);
    });
    vacancyCriteria = getSheetObjects_('TH_VAGA_CRITERIOS', { raw: true }).filter(function (criterion) {
      return String(criterion.vaga_id || '') === String(vagaId) && normalizeBoolean_(criterion.ativo) !== false;
    });
    aptTalents = getSheetObjects_('VW_TALENTOS_APTOS', { raw: true }).filter(function (talent) {
      return String(talent.apto_talent_hub || '') === 'SIM';
    });
    eligibleTalents = aptTalents.filter(function (talent) {
      return String(talent.status_pool || '') === 'Disponível';
    });

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
          score_formacao: evaluation.score_formacao,
          score_escolaridade: evaluation.score_escolaridade,
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
      var runUpdate = {
        status_run: 'Concluído',
        total_talentos_eliminados: eliminatedCount,
        total_recomendados: recommendedCount
      };
      updateObjectById_('TH_MATCHING_RUNS', 'run_id', runId, runUpdate);
      writeAuditLog_('MATCH', 'VAGA', vagaId, '', '', 'WEB_APP', eligibleTalents.length + ' talentos avaliados; ' + recommendedCount + ' recomendados');
      writeEvent_('Matchmaking executado', 'VAGA', vagaId, { vaga_id: vagaId, cliente_id: job.cliente_id }, recommendedCount + ' talentos recomendados');
      var eligibleById = {};
      eligibleTalents.forEach(function (talent) {
        eligibleById[String(talent.pessoa_id || '')] = talent;
      });
      return serializeForClient_({
        run: Object.assign({}, run, runUpdate),
        vaga: job,
        resultados: resultRows.map(function (result) {
          return decorateMatchingResult_(result, eligibleById[String(result.pessoa_id || '')] || {});
        })
      });
    } catch (error) {
      updateObjectById_('TH_MATCHING_RUNS', 'run_id', runId, { status_run: 'Erro', observacoes: error.message });
      throw error;
    }
  });
}

function getMatchingResults(runId) {
  var run = getObjectById_('TH_MATCHING_RUNS', 'run_id', runId, { raw: true });
  if (!run) throw new Error('Execução de matching não encontrada: ' + runId);
  var job = getObjectById_('TH_VAGAS', 'vaga_id', run.vaga_id, { raw: true });
  var jobShortlists = getSheetObjects_('TH_SHORTLISTS', { raw: true }).filter(function (shortlist) {
    return String(shortlist.vaga_id || '') === String(run.vaga_id || '');
  });
  if (job) {
    job.total_shortlists = jobShortlists.length;
    if (jobShortlists.length) {
      job.rodada_atual = Math.max.apply(null, jobShortlists.map(function (shortlist) {
        return Number(shortlist.rodada || 0);
      }));
    }
  }
  var talents = indexBy_('VW_TALENTOS_APTOS', 'pessoa_id');
  var results = getSheetObjects_('TH_MATCHING_RESULTADOS', { raw: true }).filter(function (result) {
    return String(result.run_id || '') === String(runId);
  }).map(function (result) {
    return decorateMatchingResult_(result, talents[String(result.pessoa_id || '')] || {});
  });
  results.sort(function (a, b) { return Number(a.ordem_ranking || 0) - Number(b.ordem_ranking || 0); });
  return serializeForClient_({
    run: run,
    vaga: job,
    resultados: results
  });
}

function decorateMatchingResult_(result, talent) {
  return Object.assign({}, result, {
    nome: talent.nome || '',
    email: talent.email || talent.email_serratec || '',
    cidade: talent.cidade || '',
    uf: talent.uf || '',
    area_interesse_principal: talent.area_interesse_principal || '',
    senioridade: talent.senioridade || '',
    principais_competencias: talent.principais_competencias || '',
    status_pool: talent.status_pool || '',
    formacoes_serratec: talent.formacoes_serratec || '',
    escolaridade: talent.escolaridade || '',
    idade: talent.idade || '',
    faixa_etaria: talent.faixa_etaria || '',
    curriculo: talent.curriculo || '',
    curriculo_disponivel: talent.curriculo_disponivel || ''
  });
}

function evaluateTalentForJob_(talent, job, modelCriteria, vacancyCriteria, model) {
  var attended = [];
  var missed = [];
  var exclusions = [];
  var totalWeight = 0;
  var earned = 0;
  var categoryScores = {
    area: 0,
    senioridade: 0,
    skills: 0,
    modalidade: 0,
    localidade: 0,
    salario: 0,
    diversidade: 0,
    formacao: 0,
    escolaridade: 0
  };

  (modelCriteria || []).forEach(function (criterion) {
    var weight = Math.max(Number(criterion.peso || 0), 0);
    var comparison = compareModelCriterion_(talent, job, criterion);
    if (comparison.applicable === false) return;
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
  var scoreLabel = normalize
    ? 'Aderência de ' + totalScore.toFixed(1).replace('.', ',') + '%. '
    : 'Pontuação de ' + totalScore.toFixed(1).replace('.', ',') + '. ';
  var justification = exclusions.length
    ? 'Eliminado por critério obrigatório: ' + exclusions.join(', ') + '.'
    : scoreLabel + (attended.length ? 'Atende: ' + attended.slice(0, 5).join(', ') + '.' : 'Nenhum critério pontuado.');

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
    score_formacao: categoryTotal('formacao'),
    score_escolaridade: categoryTotal('escolaridade'),
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
  if (valueIsBlank_(jobValue)) return { applicable: false, matched: false, ratio: 0 };
  if (type === 'intersecao_lista') {
    var talentList = splitList_(talentValue);
    var jobList = splitList_(jobValue);
    if (!jobList.length) return { applicable: false, matched: false, ratio: 0 };
    if (!talentList.length) return { applicable: true, matched: false, ratio: 0 };
    var intersection = jobList.filter(function (expected) {
      return talentList.some(function (actual) { return actual === expected || actual.indexOf(expected) !== -1 || expected.indexOf(actual) !== -1; });
    });
    var ratio = Math.min(intersection.length / Math.max(jobList.length, 1), 1);
    if (String(criterion.campo_vaga || '') === 'cidade/uf' && intersection.length) ratio = 1;
    return { applicable: true, matched: intersection.length > 0, ratio: ratio };
  }
  var left = normalizeText_(talentValue);
  var right = normalizeText_(jobValue);
  if (!right) return { applicable: false, matched: false, ratio: 0 };
  if (!left) return { applicable: true, matched: false, ratio: 0 };
  if (type === 'contem') return { applicable: true, matched: left.indexOf(right) !== -1, ratio: left.indexOf(right) !== -1 ? 1 : 0 };
  var equal = left === right;
  return { applicable: true, matched: equal, ratio: equal ? 1 : 0 };
}

function compareSalaryRanges_(talent, job) {
  var talentMin = parseMoney_(talent.pretensao_salarial_min);
  var talentMax = parseMoney_(talent.pretensao_salarial_max);
  var jobMin = parseMoney_(job.faixa_salarial_min);
  var jobMax = parseMoney_(job.faixa_salarial_max);
  if (jobMin === null && jobMax === null) return { applicable: false, matched: false, ratio: 0 };
  if (talentMin === null && talentMax === null) return { applicable: true, matched: false, ratio: 0 };
  var effectiveTalentMin = talentMin === null ? 0 : talentMin;
  var effectiveTalentMax = talentMax === null ? Number.MAX_SAFE_INTEGER : talentMax;
  var effectiveJobMin = jobMin === null ? 0 : jobMin;
  var effectiveJobMax = jobMax === null ? Number.MAX_SAFE_INTEGER : jobMax;
  var overlap = effectiveTalentMin <= effectiveJobMax && effectiveJobMin <= effectiveTalentMax;
  return { applicable: true, matched: overlap, ratio: overlap ? 1 : 0 };
}

function resolveMatchingField_(record, expression) {
  var fields = String(expression || '').split('/').map(function (field) { return field.trim(); }).filter(Boolean);
  if (!fields.length) return '';
  return fields.map(function (field) { return record[field]; }).filter(function (value) { return !valueIsBlank_(value); }).join(', ');
}

function matchingCategory_(field, name) {
  var value = normalizeText_(String(field || '') + ' ' + String(name || '')).replace(/_/g, ' ');
  if (/(genero|etnia|pcd|divers)/.test(value)) return 'diversidade';
  if (/(formacao serratec|formacoes serratec|modalidades serratec|ciclos serratec|parceiros formacao serratec)/.test(value)) return 'formacao';
  if (/(escolaridade|ensino medio|curso informado|instituicao de ensino|faculdade)/.test(value)) return 'escolaridade';
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
  var actualBoolean = normalizeBoolean_(actual);
  var expectedBoolean = normalizeBoolean_(expected);
  if (operator === 'vazio') return valueIsBlank_(actual);
  if (operator === 'nao_vazio') return !valueIsBlank_(actual);
  if (['igual', 'diferente'].indexOf(operator) !== -1 &&
    actualBoolean !== null && expectedBoolean !== null) {
    return operator === 'igual' ? actualBoolean === expectedBoolean : actualBoolean !== expectedBoolean;
  }
  if (operator === 'igual') return left === right;
  if (operator === 'diferente') return left !== right;
  if (operator === 'contem') return !!right && left.indexOf(right) !== -1;
  if (operator === 'nao_contem') return !right || left.indexOf(right) === -1;
  if (operator === 'intersecao_lista') {
    var actualList = splitList_(actual);
    var expectedList = splitList_(expected);
    return expectedList.some(function (item) { return actualList.indexOf(item) !== -1; });
  }
  if (operator === 'maior_igual' || operator === 'menor_igual') {
    if (valueIsBlank_(actual) || valueIsBlank_(expected)) return false;
    var actualNumber = Number(actual);
    var expectedNumber = Number(expected);
    if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) return false;
    return operator === 'maior_igual'
      ? actualNumber >= expectedNumber
      : actualNumber <= expectedNumber;
  }
  if (operator === 'entre') {
    if (valueIsBlank_(actual) || valueIsBlank_(expected)) return false;
    var actualBetween = Number(actual);
    var bounds = splitList_(expected).map(Number);
    if (!Number.isFinite(actualBetween) || bounds.length < 2 ||
      !Number.isFinite(bounds[0]) || !Number.isFinite(bounds[1])) {
      return false;
    }
    return actualBetween >= Math.min(bounds[0], bounds[1]) && actualBetween <= Math.max(bounds[0], bounds[1]);
  }
  return false;
}

function isSensitiveMatchingField_(field) {
  var sensitive = [
    'genero', 'cor_etnia', 'pcd_bol', 'data_nascimento', 'idade',
    'faixa_etaria', 'nacionalidade', 'sit_migratoria'
  ];
  return String(field || '').split('/').some(function (part) {
    return sensitive.indexOf(normalizeText_(part)) !== -1;
  });
}
