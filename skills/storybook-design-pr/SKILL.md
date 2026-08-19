---
name: storybook-design-pr
description: Use quando a mudança tocar arquivo de story, playground ou protótipo (`*.stories.*`) e for virar Pull Request — qualquer alteração de cor, espaçamento, tipografia, layout ou texto visível. Produz um corpo de PR com o porquê e o antes/depois. Não use em mudança só de lógica, sem efeito visual.
author: devfellowship
tags: [design, pull-request, storybook, handoff]
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

## O que a automação faz — quando está ligada

Alguns repositórios têm uma esteira que transforma a PR em task. **Ela não é
universal e pode não estar ativa no repositório em que você está.** Quando está:

1. Você abre a PR.
2. O CI publica um Storybook exclusivo daquela PR, num endereço derivado do
   número dela.
3. Um webhook lê a lista de arquivos tocados. Se algum bate com o caminho do
   playground configurado, cria a task e avisa o canal do time.
4. O corpo da PR é copiado para o campo "Por quê" da task.

O passo 3, quando existe, é comparação de caminho de arquivo — sem modelo no
meio. Não tocou o playground, não nasce task.

> **Não afirme que a task nasceu sem verificar.** Confirme que a esteira está
> descrita no `CLAUDE.md` do repositório e que a task apareceu de fato. Se não
> apareceu, avise que ela precisa ser criada à mão — dizer "pronto, já virou
> task" sem checar é como o trabalho se perde.

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

**Se você é o agente:** não existe API pública de upload de anexo no GitHub, e
arrastar arquivo é gesto de interface. Você não consegue anexar a imagem sozinho.
Suba o arquivo para um host acessível e referencie por URL, ou entregue os prints
ao humano com a instrução de arrastá-los na caixa de comentário. O que você não
pode fazer é inventar a URL ou deixar o `<img>` apontando para o vazio.

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
- [ ] Print do "antes" anexado; o "depois" entra quando o preview subir (Regra 3)
- [ ] Título descreve o efeito percebido
- [ ] Só arquivos que você pretendia tocar estão no diff

## Onde ficam os valores concretos

Caminho do playground, endereço do Storybook publicado, template da URL de preview
e canal de notificação são específicos de cada repositório. Eles vivem no
`CLAUDE.md` do próprio repositório, não aqui — esta skill descreve o método, o
repositório descreve os endereços.

Se você não encontrar esses valores no repositório em que está, pergunte antes de
abrir a PR: sem eles a automação pode não estar habilitada e a task não vai nascer.
