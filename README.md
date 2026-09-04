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
- **Redistribuindo material de terceiro?** Adicione a atribuição no `NOTICE` no mesmo
  PR — antes de o conteúdo entrar.
