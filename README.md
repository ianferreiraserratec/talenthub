# Talent Hub Serratec

Web app interno para a equipe do Serratec operar o pool de talentos, clientes e vagas do Talent Hub. A aplicação roda em Google Apps Script, usa HtmlService no frontend e Google Sheets como banco operacional.

## Direcionamento atual

O desenvolvimento ativo acontece na branch `mvp-inicial`, com um recorte
operacional menor: talentos, clientes, vagas, indicações manuais e auditoria.
O contrato completo desse recorte está em [docs/MVP_INICIAL.md](docs/MVP_INICIAL.md).

O código abaixo descreve o escopo mais amplo que existia em `homologacao` e
será progressivamente substituído na branch do MVP.

## Estado anterior (homologação)

O núcleo operacional está implementado na branch `homologacao`:

- criação idempotente das 25 abas gerenciadas;
- preservação das abas existentes de eventos e status do termo;
- sincronização em lote de `PESSOAS` e `MATRICULAS` a partir do CDP;
- aptidão por `pessoa_id`, termo `ATIVO` e cadastro atualizado na janela configurada;
- visão consolidada e filtros do banco de talentos;
- edição da camada profissional do Talent Hub sem alterar a base mestre;
- clientes, contatos, vagas e critérios configuráveis;
- matching explicável por regras, sem dependência de API externa;
- shortlists, processos, bloqueios, liberações, contratações e substituições;
- dashboard, histórico de sincronização, eventos e audit logs;
- testes locais das regras e dos fluxos críticos.

O próximo portão é a homologação ponta a ponta com dados reais. O recorte do produto, o estado de cada bloco e o backlog próprio estão em [docs/MVP_ROADMAP.md](docs/MVP_ROADMAP.md).

## Configuração rápida

1. Crie ou abra um projeto no Google Apps Script.
2. Envie o conteúdo de `src/` com Clasp ou copie os arquivos pelo editor.
3. Defina a Script Property `TH_SPREADSHEET_ID` com o ID da planilha operacional.
4. Publique uma versão de homologação com acesso restrito ao domínio.
5. Abra **Integrações**, informe `CDP_SPREADSHEET_ID` e confirme os nomes das abas.
6. Execute **Preparar banco de dados**.
7. Execute **Sincronizar tudo**.

Os IDs reais não ficam versionados. Use Script Properties ou a tela interna de Integrações.

## Desenvolvimento local

```bash
npm test
```

Os testes não acessam Google Sheets. Eles validam sintaxe, manifesto, contratos das abas, templates, regras e fluxos operacionais simulados.

## Branches

- `homologacao`: desenvolvimento e validação no Apps Script de homologação;
- `mvp-inicial`: versão mínima em simplificação, partindo de `homologacao`;
- `main`: versão estável, promovida por pull request.

Consulte [docs/MVP_ROADMAP.md](docs/MVP_ROADMAP.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), [docs/DATA_MODEL.md](docs/DATA_MODEL.md) e [docs/OPERATING_RULES_DRAFT.md](docs/OPERATING_RULES_DRAFT.md).
