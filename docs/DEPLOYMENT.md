# Implantação e fluxo Git

## Branches oficiais

- `homologacao`: todo desenvolvimento, correção e teste integrado;
- `main`: versão estável que pode ser publicada em produção.

O fluxo esperado é `homologacao` → validação no Apps Script de homologação → pull request → `main` → Apps Script de produção.

## Preparar o projeto Apps Script

1. Crie um projeto standalone ou vinculado à planilha operacional.
2. Nas propriedades do script, crie `TH_SPREADSHEET_ID` com o ID da planilha do Talent Hub.
3. Restrinja o web app ao domínio do Serratec. O manifesto já declara acesso `DOMAIN`, mas a configuração final deve ser conferida no diálogo de implantação.
4. Execute `setupTalentHubDatabase()` uma vez pelo editor ou use **Integrações → Preparar banco de dados**.
5. Na tela Integrações, configure `CDP_SPREADSHEET_ID`, `PESSOAS`, `MATRICULAS` e a janela de 90 dias.
6. Autorize o acesso às duas planilhas quando solicitado.
7. Execute **Sincronizar tudo**.

## Enviar com Clasp

Copie `.clasp.json.example` para `.clasp.json`, substitua o `scriptId` pelo projeto de homologação e mantenha `rootDir` como `src`.

```bash
clasp login
clasp push
clasp open
```

O arquivo `.clasp.json` é ignorado pelo Git para evitar misturar IDs de homologação e produção. Use um arquivo local distinto em cada ambiente.

## Publicar o web app

No editor do Apps Script:

1. selecione **Implantar → Nova implantação**;
2. escolha **Aplicativo da Web**;
3. execute como o usuário responsável pela implantação;
4. permita acesso apenas ao domínio;
5. valide setup, sincronização, Talentos, Clientes e Vagas;
6. registre a versão implantada no PR de promoção.

## Promoção para produção

1. rode `npm test` em `homologacao`;
2. teste o fluxo completo na planilha de homologação;
3. abra PR de `homologacao` para `main`;
4. após aprovação, atualize o Apps Script de produção com a `main`;
5. confira as Script Properties de produção antes de sincronizar;
6. crie uma nova implantação versionada.

Nunca copie `.clasp.json`, tokens ou credenciais para o repositório.
