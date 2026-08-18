---
name: storybook-design-pr
description: Use quando uma mudança visual virar Pull Request — designer ou agente alterando componente, protótipo ou story de Storybook. Garante que a PR carregue o porquê, o print antes/depois e o link do preview, para que a automação consiga gerar a task sem intervenção humana.
---

# Mudança de design → Pull Request

## Visão geral

A Pull Request é lida por duas audiências: um humano que revisa e uma automação que
transforma a PR em task. As duas leem o **mesmo corpo de texto**.

**Princípio central:** o corpo da PR é o documento. PR sem corpo vira task vazia, e
task vazia vira pergunta no canal do time três dias depois.

Quem faz a mudança é quem melhor sabe explicar o porquê. Se você é o agente que
acabou de editar o componente, você é a única parte do sistema que tem esse contexto —
ninguém depois de você consegue recuperá-lo a partir do diff.

## Quando usar

- Alterou arquivo de playground, protótipo ou `*.stories.*`
- Mudou cor, espaçamento, tipografia, layout ou texto visível
- Criou componente ou variante nova

**Não usar** quando a mudança é só de lógica sem efeito visual — nesse caso a
automação de design não dispara e o formato aqui é ruído.

## O que acontece sozinho

1. Você abre a PR.
2. O CI publica um Storybook **exclusivo daquela PR**, num endereço derivado do
   número dela.
3. Um webhook lê a lista de arquivos tocados. Se algum bate com o caminho do
   playground, cria a task e avisa o canal do time.
4. O corpo da PR é copiado para o campo "Por quê" da task.

O passo 3 é determinístico — comparação de caminho de arquivo, sem modelo no meio.
Não tocou o playground, não nasce task. Isso é intencional: essa parte não pode falhar.

## Regra 1 — o corpo da PR não é opcional

Escreva sempre neste formato:

```markdown
## Por quê
Motivo da mudança: o problema observado ou o pedido que originou.
NÃO descreva o diff aqui — o diff já está na aba de arquivos.

## O que mudou visualmente
- Uma linha por alteração perceptível a olho nu.

## Antes / Depois
| Antes | Depois |
|---|---|
| <img src="URL_ANTES" width="420"> | <img src="URL_DEPOIS" width="420"> |
```

"Por quê" é a única seção que não pode ser reconstruída depois. Priorize-a.

## Regra 2 — print, nunca só link

Dois links lado a lado não são um diff. Quem revisa não vai abrir duas abas e
comparar dezenas de cards para achar o que mudou. Anexe imagem.

Ao capturar:

- Fotografe **o elemento**, não a página inteira. Use o seletor de teste do
  componente alterado.
- Mesmo viewport e mesmo device scale factor nas duas capturas, senão a diferença
  de tamanho polui a comparação.
- Aguarde animação e carregamento de fonte antes do disparo.
- Se a story exigir interação para chegar ao estado alterado, reproduza a mesma
  sequência nas duas versões.

Suba as imagens e embuta no markdown, ou arraste os arquivos direto na caixa de
comentário — a maioria dos hosts de Git hospeda o anexo sozinha.

## Regra 3 — o preview não existe no instante em que a PR abre

O endereço do preview é previsível a partir do número da PR, mas o conteúdo só
aparece quando o build termina. Se for anexar o print do "depois", **espere o
deploy concluir** e então edite o corpo ou adicione um comentário. Não anexe
imagem de página em branco.

Isso significa que o print costuma ser um segundo movimento, não parte da abertura.

## Regra 4 — o título descreve o efeito, não o arquivo

O título vira o nome da task e é o que aparece no canal do time.

- Bom: `Destaca o card da pergunta ativa durante o fluxo`
- Ruim: `Atualiza MentorFlowLab.stories.tsx`

## Checklist antes de abrir

- [ ] Corpo preenchido com "Por quê" real, não o resumo do diff
- [ ] Cada mudança visual listada em uma linha
- [ ] Print antes e depois anexado (ou comentário de follow-up planejado)
- [ ] Título descreve o efeito percebido
- [ ] Só arquivos que você pretendia tocar estão no diff

## Onde ficam os valores concretos

Caminho do playground, endereço do Storybook publicado, template da URL de preview
e canal de notificação são específicos de cada repositório. Eles vivem no
`CLAUDE.md` do próprio repositório, não aqui — esta skill descreve o método, o
repositório descreve os endereços.

Se você não encontrar esses valores no repositório em que está, pergunte antes de
abrir a PR: sem eles a automação pode não estar habilitada e a task não vai nascer.
