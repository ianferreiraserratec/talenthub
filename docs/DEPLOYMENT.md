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

## Sincronizar com Google Apps Script GitHub Assistant

A extensão preserva a pasta do repositório no nome dos arquivos do Apps Script, por exemplo `src/Code.gs` e `src/Index.html`. O carregador em `Code.gs` aceita tanto esse formato quanto arquivos enviados pelo Clasp com `rootDir: src`.

Ao puxar uma correção:

1. selecione a branch `homologacao`;
2. revise o diff antes de sobrescrever o projeto;
3. salve o projeto no Drive;
4. atualize a implantação de teste `/dev` com `F5`;
5. confirme que o rodapé deixou de mostrar `Carregando…` e passou a exibir a versão do app.

Se o HTML aparecer, mas nenhum botão responder, valide primeiro a sintaxe do JavaScript efetivamente servido. Arquivos HTML incluídos pelo `HtmlService` podem sofrer transformação de conteúdo; evite regex de URL com barras escapadas dentro desses templates e prefira `new URL()` para validar protocolos.

## Publicar o web app

No editor do Apps Script:

1. selecione **Implantar → Nova implantação**;
2. escolha **Aplicativo da Web**;
3. execute como o usuário responsável pela implantação;
4. permita acesso apenas ao domínio;
5. valide setup, sincronização, Talentos, Clientes e Vagas;
6. registre a versão implantada no PR de promoção.

Durante a homologação, prefira a URL `/dev`, que usa o código salvo mais recente e dispensa criar uma nova versão a cada ajuste. A URL `/exec` continua representando uma implantação versionada.

## Promoção para produção

1. rode `npm test` em `homologacao`;
2. teste o fluxo completo na planilha de homologação;
3. abra PR de `homologacao` para `main`;
4. após aprovação, atualize o Apps Script de produção com a `main`;
5. confira as Script Properties de produção antes de sincronizar;
6. crie uma nova implantação versionada.

Nunca copie `.clasp.json`, tokens ou credenciais para o repositório.
