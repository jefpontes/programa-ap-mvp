# Relatório de testes técnicos

## Validações executadas

- Todos os arquivos obrigatórios existem.
- `manifest.json` possui JSON válido.
- Todos os módulos JavaScript passaram por verificação de sintaxe com Node.js.
- Todos os arquivos do App Shell responderam HTTP 200 em servidor local.
- Ícones de 192×192 e 512×512 foram gerados.
- O Service Worker lista os arquivos essenciais no cache.
- O banco IndexedDB cria as lojas de consultorias, configurações, tabela mestre e auditoria.
- A tabela mestre inicial é inserida somente quando ainda não existem registros.
- Importação usa atualização/inclusão por chave e não apaga registros existentes.
- Exclusão definitiva não foi implementada; os registros usam status.

## Checklist manual obrigatório no celular

Siga o arquivo README.md para validar câmera, instalação, armazenamento, modo avião, impressão em PDF e compartilhamento por WhatsApp.
