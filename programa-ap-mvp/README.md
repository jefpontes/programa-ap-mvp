# Programa AP — MVP PWA

## Teste imediato no celular

A PWA precisa ser publicada em um endereço HTTPS para que o Service Worker funcione no celular.

### Opção gratuita recomendada: GitHub Pages

1. Crie uma conta gratuita em github.com.
2. Crie um repositório chamado `programa-ap-mvp`.
3. Envie todos os arquivos deste pacote, mantendo as pastas `icons`, `assets` e `vendor`.
4. No repositório, abra `Settings` > `Pages`.
5. Em `Build and deployment`, selecione `Deploy from a branch`.
6. Selecione a branch `main` e a pasta `/root`.
7. Salve e abra o endereço informado pelo GitHub Pages.

### Instalar no iPhone

1. Abra o endereço publicado usando o Safari.
2. Aguarde a tela inicial carregar completamente.
3. Toque em Compartilhar.
4. Toque em `Adicionar à Tela de Início`.
5. Confirme o nome `Programa AP`.
6. Abra o aplicativo pelo novo ícone.
7. Faça um cadastro simples.
8. Feche o aplicativo, ative o modo avião e abra novamente.
9. Confirme que a tela inicial e as consultorias salvas continuam disponíveis.

### Android

1. Abra o endereço no Chrome.
2. Abra o menu do navegador.
3. Toque em `Instalar aplicativo` ou `Adicionar à tela inicial`.
4. Depois da primeira abertura completa, teste em modo avião.

## Senha administrativa inicial

`1234`

Altere em Configurações antes do uso comercial.

## Teste funcional mínimo

1. Nova consultoria.
2. Cadastro do condomínio e foto da fachada.
3. Briefing.
4. Adicionar ambiente e foto.
5. Adicionar conjunto com condição geral.
6. Adicionar conjunto dividido em lotes.
7. Conferir bloqueio quando a soma dos lotes for diferente da quantidade total.
8. Abrir estimativa.
9. Abrir apresentação.
10. Usar Imprimir / PDF e escolher `Salvar como PDF`.
11. Registrar decisão.
12. Exportar backup JSON e resumo CSV.
13. Importar o JSON novamente.
14. Ativar modo avião e reabrir.

## Observação sobre PDF no celular

O botão `Imprimir / PDF` abre o recurso nativo do navegador. No iPhone, use a prévia de impressão e Compartilhar para salvar o PDF em Arquivos. No Android, selecione `Salvar como PDF`.
