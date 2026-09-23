# DFL Skills (público)

```
npx skills add devfellowship/skills
```

Registro público de skills da DevFellowship. Skills internas/ops ficam no registro
privado `devfellowship/internal-skills` e não são publicadas aqui.

## Como este registro é construído

Cada entrada declara em qual das duas trilhas ela está:

| Skill | Trilha | Origem | Licença |
|---|---|---|---|
| `storybook-design-pr` | Autoria | DevFellowship | MIT (LICENSE) |
| `test-driven-development` | Curadoria | [obra/superpowers](https://github.com/obra/superpowers) | MIT © 2025 Jesse Vincent (NOTICE) |

**Autoria** = escrito pela DFL, coberto pelo `LICENSE` da raiz.
**Curadoria** = escrito por terceiro, redistribuído sem mudança de sentido, sob a
licença de origem, com atribuição no `NOTICE`.

## O que é publicado

`.claude-plugin/marketplace.json` é a **fonte de verdade** do que vai para
`skills.devfellowship.com`. O `scripts/ingest.ts` itera a lista `plugins` — ele não
varre o diretório.

A divergência falha o CI nas duas direções:

- entrada declarada no manifesto sem pasta correspondente → erro;
- pasta em `skills/` com `SKILL.md` que ninguém declarou → erro.

Ou seja: criar a pasta não publica. Declarar sem criar não passa. Remover é tirar do
manifesto **e** apagar a pasta, no mesmo commit.

Remover **despublica**: o lote vai com `prune: true`, então o registro apaga a linha de
qualquer slug que este manifesto não declara mais. Isso não era verdade até 2026-09-04 —
a linha ficava, e continuava servindo o corpo da skill a partir do commit fixado na
ingestão. Confirme mesmo assim:

```
curl -s https://skills.devfellowship.com/api/v1/skills | jq '.skills[].skill'
```

## Dono e revisão

Toda skill tem **um dono**: o handle do GitHub no `author:` dela. Uma mudança na
skill só entra com aprovação do dono ou de alguém do time
**`devfellowship/core`** (quem mantém o registro). Aprovação de outra pessoa não
conta.

| O quê | Dono |
|---|---|
| `skills/<slug>/` | o `author:` do frontmatter do `SKILL.md` |
| sem `author:`, ou `author: devfellowship` | o time core |
| skill nova, `.claude-plugin/marketplace.json` e todo o resto | o time core |

O `marketplace.json` fica com o core porque é ele que publica: tirar uma entrada
despublica a skill.

### Como isso é garantido

1. `scripts/codeowners.ts` transforma cada `author:` numa linha do
   `.github/CODEOWNERS`. Cada linha nomeia o dono **e** o core.
2. Um ruleset do repositório na `main` exige **revisão de code owner**. Um PR que
   mexe na sua skill espera você (ou o core), não importa quem mais aprovou.
3. O CI falha quando o arquivo commitado difere do gerador, quando um `author:`
   não é handle do GitHub e quando o GitHub recusa um dono — por exemplo, alguém
   sem acesso de escrita aqui.

O GitHub lê o CODEOWNERS da **branch de destino**, não do PR. Por isso:

- **Skill nova passa pelo core.** Ela ainda não tem linha. O core confere se o
  `author:` é quem abriu o PR.
- **Tomar a skill de alguém exige a aprovação dessa pessoa.** Um PR que troca o
  `author:` continua sendo do dono atual até entrar.
- **Editar o CODEOWNERS na mão não adianta.** O arquivo é do core, e o CI o
  regenera a partir dos `author:`.

**O que isso não cobre:** quem tem acesso de escrita consegue rodar workflow a
partir de uma branch própria, e o segredo de ingestão ainda é segredo comum do
repositório. Esse caminho escreve no registro sem revisão. Até o segredo ir
para um environment restrito à `main`, dê acesso de escrita só a quem você
confiaria o registro inteiro.

PR de fork, de fora da organização, é bem-vindo. Ele entra quando o dono da
skill, ou o core, aprova.

## Contribuindo

- **`description` é gatilho, não resumo.** O agente sempre enxerga `name` +
  `description` e só carrega o corpo quando julga relevante. Escreva *quando usar* e
  *quando não usar*, não o que a skill contém.
- **Corpo curto.** Material extra vai em arquivo ao lado do `SKILL.md`, carregado sob
  demanda.
- **Não referencie skill que não está neste registro.** Link para skill do registro
  privado vira instrução morta para quem instalar daqui.
- **Nada interno no texto**: hostname interno, id de canal, nome de repositório
  privado, nome de pessoa do time. Este repositório é público e o histórico do git
  também.
- **`author:` é o seu handle do GitHub.** Ele define quem aprova mudanças na
  skill (veja "Dono e revisão"). Rode `bun scripts/codeowners.ts --write`
  e commite o `.github/CODEOWNERS` no mesmo PR.
- **Redistribuindo material de terceiro?** Adicione a atribuição no `NOTICE` no mesmo
  PR — antes de o conteúdo entrar.
