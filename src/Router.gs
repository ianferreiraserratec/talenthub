/**
 * Fachada opcional para integrações futuras. A interface atual usa as funções
 * de serviço diretamente via google.script.run para manter respostas simples.
 */
function apiGetReferenceData() {
  return {
    parametros: getParametros([]),
    config: getRuntimeConfig(),
    sync: getSyncStatus()
  };
}
