---
name: storybook-design-pr
description: Use quando a mudança tocar arquivo de story, playground ou protótipo (`*.stories.*`) e for virar Pull Request — qualquer alteração de cor, espaçamento, tipografia, layout ou texto visível. Produz o card que avisa o designer e um corpo de PR com o porquê e o antes/depois. Abrir a PR sozinha não avisa ninguém. Não use em mudança só de lógica, sem efeito visual.
author: devfellowship
tags: [design, pull-request, storybook, handoff]
---

# Mudança de design → Pull Request

## Visão geral

Toda mudança visual gera dois documentos que dizem a mesma coisa para leitores
diferentes: o **corpo da PR**, que o revisor lê, e o **card**, que é como o designer
descobre que existe trabalho pra ele. Você escreve os dois, e escreve o mesmo "por
quê" nos dois.

**Princípio central:** o corpo da PR é o documento. PR sem corpo vira card vazio, e
card vazio vira pergunta no canal do time três dias depois.

Quem faz a mudança é quem melhor sabe explicar o porquê. Se você é o agente que
acabou de editar o componente, você é a única parte do sistema que tem esse contexto —
ninguém depois de você consegue recuperá-lo a partir do diff.

## Quando usar

- Alterou arquivo de playground, protótipo ou `*.stories.*`
- Mudou cor, espaçamento, tipografia, layout ou texto visível
- Criou componente ou variante nova

**Não usar** quando a mudança é só de lógica sem efeito visual — não há o que o
designer revisar, e o formato aqui vira ruído.

## 🔴 Abrir a PR não avisa ninguém — o card é seu

**Não conte com a PR para criar o card.** O aviso ao designer sai do **estado do
card** — ele dispara quando uma task entra na etapa de design —, não do evento de
abertura da PR.

O motivo importa pra você: design acontece **antes** de existir código. Um aviso
amarrado à PR silencia justamente o começo do trabalho, e não enxerga nada que
nasça fora do GitHub — card aberto à mão, por MCP ou por outro serviço.

Consequência direta: **se você abrir a PR e não criar o card, o designer não fica
sabendo de nada.** Nada falha, nada avisa. A PR fica verde e o trabalho some.

O que você faz:

1. **Crie o card primeiro**, com `create_task` do MCP, na etapa `design` (ainda é
   exploração) ou `decision` (é proposta esperando alguém bater o martelo). Siga a
   skill `criacao-de-task`. Preencha os links do pacote de contexto (PR, Storybook,
   playground, arquivos) — é o que faz o card se explicar sozinho.
2. **Escolha a epic com atenção.** O canal para onde o aviso vai é uma propriedade
   da epic, não da task, e o comportamento é fail-closed: epic sem canal
   configurado → o card nasce e ninguém é avisado, em silêncio. Não invente epic;
   pergunte qual usar.
3. Abra a PR e referencie o card no corpo.

O CI segue publicando um Storybook exclusivo da PR num endereço derivado do número
dela — isso não mudou, e é o link que o designer abre.

> **Não afirme que o designer foi avisado sem verificar.** Card criado em epic sem
> canal não gera mensagem nenhuma e não devolve erro. Confirme que o card existe,
> que está na etapa de design e que a epic tem canal. Dizer "pronto, já avisei"
> sem checar é exatamente como o trabalho se perde.

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

Use o mesmo texto no nome do card — é ele que aparece no canal do time.

- Bom: `Destaca o card da pergunta ativa durante o fluxo`
- Ruim: `Atualiza MentorFlowLab.stories.tsx`

## Checklist antes de abrir

- [ ] Card criado na etapa de design, numa epic que tem canal configurado
- [ ] Corpo preenchido com "Por quê" real, não o resumo do diff
- [ ] Cada mudança visual listada em uma linha
- [ ] Print do "antes" anexado; o "depois" entra quando o preview subir (Regra 3)
- [ ] Título descreve o efeito percebido
- [ ] Só arquivos que você pretendia tocar estão no diff

## Onde ficam os valores concretos

Caminho do playground, endereço do Storybook publicado e template da URL de preview
são específicos de cada repositório. Eles vivem no `CLAUDE.md` do próprio
repositório, não aqui — esta skill descreve o método, o repositório descreve os
endereços.

O canal de notificação **não** é um deles: ele é propriedade da epic, não do
repositório, porque a mesma epic atravessa repositórios e porque escolher canal é
decisão humana — um canal errado expõe trabalho interno a quem não devia ver. Se
você não sabe em qual epic abrir o card, pergunte. Chutar a epic é escolher o canal
errado ou o silêncio.

Se você não encontrar esses valores no repositório em que está, pergunte antes de
abrir a PR: sem eles o card nasce sem os links que justificam a existência dele.
