# HackerAI self-hosted (branch `selfhost`)

Runbook do deploy pessoal no Coolify:

- web: `https://hackerai.bolaxax.cloud`
- Convex self-hosted: `https://hackerai-convex.bolaxax.cloud`
- relay Centrifugo: `https://hackerai-relay.bolaxax.cloud`
- SaaS: Trigger.dev Cloud, WorkOS, Upstash, OpenRouter e AWS S3.
- Sem Stripe e sem sandbox em nuvem (E2B/MIOSA).

Nenhum segredo fica neste repositório. Gere-os localmente
(`openssl rand -hex 32`) e guarde-os num gerenciador de senhas.

## O que o fork muda

Cada mudança é ligada por uma variável de ambiente. Com as três sem valor, o
comportamento é exatamente o do upstream e os testes do upstream continuam
passando, então `git merge origin/main` continua simples.

| Variável                              | Valor     | Efeito                                                                                                                                                                                                                                                                           |
| ------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_FORCE_SUBSCRIPTION_TIER` | `ultra`   | Todo usuário logado vira Ultra, sem Stripe e sem entitlements do WorkOS (`lib/auth/entitlements.ts`). Ultra é só Agent, como o Ultra oficial: o modo Ask não aparece. Vazio, `free` ou valor desconhecido mantêm o upstream.                                                     |
| `NEXT_PUBLIC_DISABLE_CLOUD_SANDBOX`   | `true`    | O Agent roda só em computadores conectados pelo CLI `@hackerai/local` (via Centrifugo). A opção Cloud some do seletor, o envio fica bloqueado até haver um computador e nenhuma execução cai para E2B/MIOSA (`lib/sandbox/cloud-availability.ts`). Só o valor exato `true` liga. |
| `ULTRA_MONTHLY_LIMIT_USD`             | ex. `500` | Franquia mensal do Ultra em dólares. Padrão `200` (2.000.000 pontos por janela de 30 dias). Vazio, não numérico ou ≤ 0 volta ao padrão. O consumo cobrado é o custo bruto × 1,2, então `$X` cobre cerca de `$X/1,2` de OpenRouter e ferramentas.                                 |

Arquivos de deploy nesta pasta:

- `Dockerfile` e `Dockerfile.dockerignore`: imagem do web (Next.js) para o
  build pack Dockerfile do Coolify. O contexto de build é a raiz do repositório.
- `server.mjs`: servidor de produção. Faz o Next enxergar a origem pública;
  sem isso o redirect do `/callback` do WorkOS iria para `localhost:3000`.
  Drena conexões no `SIGTERM`.
- `convex.compose.yml`: backend e dashboard do Convex (SQLite num volume).
- `centrifugo.compose.yml`: relay do sandbox local, com a mesma configuração
  de `docker/centrifugo/config.json` mais a origem deste deploy.

> Configure essas variáveis só no Coolify, no Convex e no Trigger.dev. Não as
> coloque em `.env`, `.env.test*` ou `.env.local` do checkout: o Jest carrega
> `.env` e `.env.test*`, e os testes do upstream (que esperam Cloud e $200)
> quebrariam.

## DNS (Hostinger)

Na zona `bolaxax.cloud`, crie um registro **A** com nome `*` apontando para o
IP público do servidor Coolify (TTL 300). Se o servidor tiver IPv6, crie também
um **AAAA** `*`. O curinga cobre `hackerai`, `hackerai-convex`,
`hackerai-convex-site`, `hackerai-convex-dash` e `hackerai-relay`, e o Traefik
do Coolify emite um certificado Let's Encrypt por host. Confira com
`nslookup hackerai-relay.bolaxax.cloud`.

## Recursos no Coolify

Projeto HackerAI, ambiente production:

| Recurso           | Tipo                                                                              | Configuração                                                                         | Domínio(s)                                                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hackerai-convex` | Docker Compose Empty                                                              | colar `selfhost/convex.compose.yml`                                                  | backend: `https://hackerai-convex.bolaxax.cloud:3210,https://hackerai-convex-site.bolaxax.cloud:3211`; dashboard: `https://hackerai-convex-dash.bolaxax.cloud:6791` |
| `hackerai-relay`  | Docker Compose Empty                                                              | colar `selfhost/centrifugo.compose.yml` e definir `CENTRIFUGO_TOKEN_SECRET`          | `https://hackerai-relay.bolaxax.cloud:8000`                                                                                                                         |
| `hackerai-web`    | Application, build pack **Dockerfile**, Git `Bolaxax/hackerai`, branch `selfhost` | Base Directory `/`, Dockerfile Location `/selfhost/Dockerfile`, Ports Exposes `3000` | `https://hackerai.bolaxax.cloud`                                                                                                                                    |

Ajustes do `hackerai-web`:

- O health check (`GET /robots.txt` na porta 3000) já está no Dockerfile.
- Em Advanced, desligue **Gzip compression**: as respostas em stream não podem
  ficar em buffer.
- Use 1 réplica. O build precisa de 6 a 8 GB de RAM (`BUILD_NODE_MEMORY_MB`,
  padrão 6144); com menos RAM, reduza o valor e adicione swap. A imagem final
  tem cerca de 3 GB, porque leva o `node_modules` completo.
- Desligue o **auto deploy** no push. A ordem de atualização é Convex, depois
  Trigger.dev, depois web (veja "Sincronizar com o upstream").
- Toda variável nova (inclusive as coladas no Developer view) nasce com
  **Build time** = "Available during build". Deixe assim só as `NEXT_PUBLIC_*`
  e `BUILD_NODE_MEMORY_MB`; em todas as outras escolha "Not available during
  build". Variáveis de build viram `--build-arg` e ficam nos metadados da
  imagem (`docker history`), então nenhum segredo pode ficar nelas.
- Em **Build secrets** (página Environment Variables), mantenha "Standard build
  arguments". Com "Docker BuildKit secrets" o Coolify passa tudo só como
  `--secret`, os `ARG` do Dockerfile chegam vazios e o build falha na checagem
  das `NEXT_PUBLIC_*`.

O dashboard do Convex é público e protegido só pela admin key. Se preferir,
deixe-o sem domínio e use apenas a CLI.

## Variáveis por alvo

No `hackerai-web`, Web build = **Build time** "Available during build" e Web
runtime = **Runtime** "Available in the container"; coluna vazia = a opção "Not
available" correspondente. Convex = env do deployment (`convex env set` ou
dashboard). Trigger = Production → Environment Variables do projeto no
Trigger.dev.

| Variável                                                                                  | Web build | Web runtime | Convex                 | Trigger  | Valor                                                     |
| ----------------------------------------------------------------------------------------- | --------- | ----------- | ---------------------- | -------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`                                                                  | ✔         | ✔           |                        | ✔        | `https://hackerai-convex.bolaxax.cloud`                   |
| `NEXT_PUBLIC_BASE_URL`                                                                    | ✔         | ✔           |                        |          | `https://hackerai.bolaxax.cloud`                          |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI`                                                         | ✔         | ✔           |                        |          | `https://hackerai.bolaxax.cloud/callback`                 |
| `NEXT_PUBLIC_FORCE_SUBSCRIPTION_TIER`                                                     | ✔         | ✔           | ✔                      | opcional | `ultra`                                                   |
| `NEXT_PUBLIC_DISABLE_CLOUD_SANDBOX`                                                       | ✔         | ✔           |                        | ✔        | `true`                                                    |
| `ULTRA_MONTHLY_LIMIT_USD`                                                                 |           | ✔           | ✔                      | ✔        | opcional; o mesmo valor nos três                          |
| `BUILD_NODE_MEMORY_MB`                                                                    | opcional  |             |                        |          | `6144`                                                    |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`                                     | opcional  | opcional    |                        | opcional | sem definir = PostHog desligado                           |
| `WORKOS_CLIENT_ID`                                                                        |           | ✔           | ✔ (antes do 1º deploy) |          | dashboard do WorkOS                                       |
| `WORKOS_AUTH_DOMAIN`                                                                      |           |             | ✔ (antes do 1º deploy) |          | `api.workos.com`                                          |
| `WORKOS_API_KEY`                                                                          |           | ✔           | ✔                      |          | `sk_...`                                                  |
| `WORKOS_COOKIE_PASSWORD`                                                                  |           | ✔           |                        |          | 32+ caracteres aleatórios                                 |
| `ACCOUNT_IDENTITY_HMAC_SECRET`                                                            |           | ✔           |                        |          | aleatório; sem ele toda requisição autenticada falha      |
| `CONVEX_SERVICE_ROLE_KEY`                                                                 |           | ✔           | ✔                      | ✔        | aleatório, igual nos três                                 |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                      |           | ✔           | ✔                      | ✔        | Upstash                                                   |
| `OPENROUTER_API_KEY`                                                                      |           | ✔           |                        | ✔        | OpenRouter                                                |
| `TRIGGER_SECRET_KEY`                                                                      |           | ✔           |                        |          | `tr_prod_...`                                             |
| `TRIGGER_VERSION`                                                                         |           | ✔           |                        |          | versão impressa pelo último `trigger deploy`              |
| `CENTRIFUGO_TOKEN_SECRET`                                                                 |           | ✔           | ✔                      | ✔        | aleatório; o mesmo no `hackerai-relay`                    |
| `CENTRIFUGO_WS_URL`                                                                       |           | ✔           | ✔                      | ✔        | `wss://hackerai-relay.bolaxax.cloud/connection/websocket` |
| `AWS_S3_ACCESS_KEY_ID`, `AWS_S3_SECRET_ACCESS_KEY`, `AWS_S3_REGION`, `AWS_S3_BUCKET_NAME` |           | ✔           | ✔                      | ✔        | bucket e usuário IAM (veja "AWS S3")                      |
| `S3_REGIONAL_STORAGE_ENABLED`                                                             |           |             | ✔                      |          | `false`                                                   |

Opcionais, no web runtime e no Trigger: `PAID_DAILY_FREE_ALLOWANCE_COST_LIMIT_USD`
(franquia diária só do modelo Auto depois do limite mensal; padrão 0.25),
`PERPLEXITY_API_KEY` e `JINA_API_KEY` (busca e leitura de páginas),
`OPENAI_API_KEY` (moderação). Só no web: `WORKOS_WEBHOOK_SECRET`, `REDIS_URL`.

Nunca defina `VERCEL`, `VERCEL_ENV`, `E2B_API_KEY`, `MIOSA_API_KEY`,
`STRIPE_*`, `CONVEX_DEPLOYMENT` nem `CONVEX_DEPLOY_KEY`. `NODE_ENV=production`
e `PORT=3000` já vêm do Dockerfile.

Quando uma mudança vale:

- `NEXT_PUBLIC_*` são embutidas no bundle pelo `next build`: mudar exige
  **Redeploy** (rebuild) do web, não só restart. As de runtime pedem restart.
- No Trigger.dev tudo é lido em runtime: novas execuções já pegam o valor.
- No Convex, `convex env set` vale na hora, sem novo deploy.

## Primeira instalação

Antes: crie Upstash, OpenRouter, S3, a configuração do WorkOS e o projeto no
Trigger.dev (seções abaixo) e gere os segredos aleatórios.

Crie um arquivo fora do repositório, por exemplo
`%USERPROFILE%\.hackerai\convex-selfhosted.env`, com:

```
CONVEX_SELF_HOSTED_URL=https://hackerai-convex.bolaxax.cloud
CONVEX_SELF_HOSTED_ADMIN_KEY=<admin key>
```

Passe sempre `--env-file <arquivo>` para a CLI do Convex. Assim ela usa o
self-hosted e ignora o `.env.local` do checkout.

1. **Convex no ar.** Crie o `hackerai-convex`, defina os domínios e faça o
   deploy. `curl https://hackerai-convex.bolaxax.cloud/version` deve dar 200.
2. **Admin key.** No terminal do container `backend` (Coolify), rode
   `./generate_admin_key.sh` e guarde a chave. Ela também abre o dashboard.
3. **Env do Convex.** Primeiro `WORKOS_CLIENT_ID` e `WORKOS_AUTH_DOMAIN`
   (o `convex/auth.config.ts` é avaliado no deploy), depois o resto da coluna
   Convex, pelo dashboard (Settings → Environment Variables) ou com
   `corepack pnpm exec convex env set NOME valor --env-file <arquivo>`.
4. **Funções.** Num checkout do `selfhost` no mesmo commit que vai para o web:
   `corepack pnpm install --frozen-lockfile` e
   `corepack pnpm exec convex deploy --env-file <arquivo>`. Descarte qualquer
   diff em `convex/_generated`.
5. **Centrifugo.** Crie o `hackerai-relay`, defina `CENTRIFUGO_TOKEN_SECRET` e o
   domínio e faça o deploy. Este comando deve imprimir `400`, que é o
   Centrifugo pedindo upgrade para WebSocket (404 ou 502 indicam erro no proxy):
   `curl -s -o /dev/null -w '%{http_code}' https://hackerai-relay.bolaxax.cloud/connection/websocket`
6. **Trigger.dev.** Preencha a coluna Trigger em Production → Environment
   Variables. Depois, do mesmo checkout (PowerShell):

   ```
   $env:TRIGGER_PROJECT_ID = "proj_..."
   corepack pnpm exec trigger login
   corepack pnpm exec trigger deploy
   ```

   Anote a versão impressa (por exemplo `20261007.1`).

7. **TRIGGER_VERSION.** Coloque essa versão em `TRIGGER_VERSION` no
   `hackerai-web`. O SDK fixa toda execução Agent nessa versão, não só as com
   aprovação: uma versão errada ou ausente quebra o Agent.
8. **Web.** Crie o `hackerai-web`, cadastre as variáveis (com o Build time de
   cada uma como na tabela) e faça o deploy. O build falha logo no início se faltar
   alguma `NEXT_PUBLIC_*` obrigatória.

Verificação:

- `curl -sI https://hackerai.bolaxax.cloud/callback` deve mostrar
  `location: https://hackerai.bolaxax.cloud/login`. Se aparecer
  `localhost:3000`, o `server.mjs` não está em uso.
- Faça login pelo WorkOS: a UI mostra Ultra, só Agent, e o seletor de sandbox
  mostra "Choose a computer" ou o seu computador.
- Envie um arquivo pequeno (testa S3 e CORS).
- Conecte o CLI (veja "Sandbox local"), mande uma mensagem e confira a run no
  dashboard do Trigger.dev (tag `sub_ultra`). Teste também um modo com
  aprovação ("Approve for me").
- No dashboard do Convex devem aparecer linhas em `chats` e `messages`. Não
  existe tabela `users`: os usuários ficam no WorkOS.
- No terminal do container web, `curl -sS https://hackerai-convex.bolaxax.cloud/version`
  e o `curl` do relay acima devem funcionar. Se funcionam de fora mas não de
  dentro, o servidor não faz hairpin NAT: aponte esses nomes para o próprio
  servidor (override de DNS ou hosts).

## WorkOS

No ambiente cujas chaves você usa:

- **Redirects:** adicione `https://hackerai.bolaxax.cloud/callback` e torne-o
  o padrão.
- **Sign-in endpoint** (login iniciado pelo WorkOS):
  `https://hackerai.bolaxax.cloud/login`.
- **Sign-out redirect:** `https://hackerai.bolaxax.cloud/` (o `/logout` chama
  `signOut()` sem `returnTo`).
- **Restrinja o cadastro:** desligue o sign-up público ou use convites ou
  allowlist. Todo usuário vira Ultra e gasta o seu OpenRouter.
- **Allowed web origins (CORS):** `https://hackerai.bolaxax.cloud`. O widget
  de Settings → Security chama a API do WorkOS pelo navegador.
- Opcional: webhook `https://hackerai.bolaxax.cloud/api/workos/webhook`, com o
  segredo em `WORKOS_WEBHOOK_SECRET`.
- Não adicione `/api/auth/desktop-callback`: o app desktop não usa self-host.

## AWS S3

- Bucket privado (Block all public access ligado), na região de
  `AWS_S3_REGION`.
- Usuário IAM só com `s3:GetObject`, `s3:PutObject` e `s3:DeleteObject` em
  `arn:aws:s3:::<bucket>/*`.
- CORS do bucket. O navegador envia arquivos direto para URLs pré-assinadas
  com `PUT`:

```json
[
  {
    "AllowedOrigins": ["https://hackerai.bolaxax.cloud"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

## Upstash

Crie um banco Redis (o plano free basta) e copie a REST URL e o token para o
web, o Trigger.dev e o Convex. É obrigatório: em produção, sem Upstash toda
requisição Ultra falha com "Rate limiting service is not configured".

## OpenRouter

Crie uma API key, de preferência com limite de crédito, e use-a em
`OPENROUTER_API_KEY` no web e no Trigger.dev.

## Sandbox local (CLI)

1. Em Settings → Remote Control, gere um token. A UI mostra o comando já com
   `--convex-url https://hackerai-convex.bolaxax.cloud`.
2. A UI usa `@latest`. Troque pela versão do commit implantado, que é o campo
   `version` de `packages/local/package.json` (hoje `0.8.6`):

   ```
   npx @hackerai/local@0.8.6 --token hsb_... --convex-url https://hackerai-convex.bolaxax.cloud --name "Kali VM"
   ```

3. Com o CLI conectado, o seletor escolhe o computador sozinho. Essa escolha
   automática não fica salva entre recargas; escolher manualmente salva no
   navegador. Sem computador conectado, o Agent mostra "Your computer is
   disconnected" e não envia.

## Limite mensal

- Use o mesmo `ULTRA_MONTHLY_LIMIT_USD` no web, no Trigger.dev e no Convex.
  Qualquer um deles corta o saldo guardado para o próprio limite, então o menor
  valor vence.
- Aumentar o valor não recarrega baldes existentes antes da próxima recarga de
  30 dias; até lá o card de uso mostra o novo limite com "usado" inflado. Para
  aplicar na hora, depois de definir o valor nos três, use o console do Upstash:
  - reset completo, com nova janela de 30 dias:
    `DEL usage:monthly:<userId>:ultra`
  - mantendo o consumo do ciclo:
    `HINCRBYFLOAT usage:monthly:<userId>:ultra tokens <(novo - antigo) × 10000>`
    (de 200 para 500: `3000000`)
  - para achar as chaves: `SCAN 0 MATCH usage:monthly:*:ultra`
- Diminuir o valor corta o saldo na hora.
- Um valor inválido (por exemplo `$500`) volta para $200 sem aviso. Depois de
  mudar, confira o total no card de uso.

## Sincronizar com o upstream

`origin` é `hackerai-tech/hackerai` e `fork` é `Bolaxax/hackerai`:

```
git fetch origin
git switch selfhost
git merge origin/main
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm exec jest lib/auth lib/rate-limit lib/api/__tests__/chat-stream-helpers-free-gates.test.ts lib/ai/tools/utils/__tests__/hybrid-sandbox-manager.test.ts convex/__tests__/fileActions.upload-policy.test.ts app/contexts/__tests__/GlobalState.agent-default.test.tsx app/components/__tests__/SandboxSelector.test.tsx app/hooks/__tests__/useSelectedComputerConnection.test.tsx
git push fork selfhost
```

Antes de publicar, procure variáveis novas no diff do merge
(`.env.local.example` e leituras de `process.env`). Os conflitos devem ser
poucos e pequenos. Se o upstream mudar a linha `ultra` de `MONTHLY_CREDITS` em
`lib/rate-limit/token-bucket.ts`, mantenha o getter e atualize
`ULTRA_MONTHLY_CREDITS`.

Publique sempre na ordem e no mesmo commit:

1. `corepack pnpm exec convex deploy --env-file <arquivo>`
2. `corepack pnpm exec trigger deploy`
3. a nova versão em `TRIGGER_VERSION` no `hackerai-web`
4. Redeploy do `hackerai-web`

Execuções Agent em andamento durante a troca podem ter aprovações negadas
(`authorization_mismatch`). Pare-as e comece de novo.

## Backups

Os dados do Convex (SQLite) ficam no volume `convex-data`, que o Coolify não
copia. Exporte com frequência e sempre antes de atualizar as imagens do Convex:

```
corepack pnpm exec convex export --env-file <arquivo> --include-file-storage --path backup-AAAA-MM-DD.zip
```

Para restaurar:
`corepack pnpm exec convex import --env-file <arquivo> --replace-all <zip>`.
Guarde também o `INSTANCE_SECRET` (gerado pelo Coolify no `hackerai-convex`) e
a admin key. Os arquivos dos usuários ficam no S3; ligue o versionamento do
bucket se quiser histórico.

## Limitações conhecidas

- O app desktop (Tauri) não funciona com self-host: a URL e a CSP apontam para
  `hackerai.co`. Use o CLI `@hackerai/local`.
- Sem modo Ask: o Ultra é só Agent, e toda mensagem vira uma run no
  Trigger.dev.
- Sem sandbox Cloud: sem computador conectado, o Agent não envia.
- A UI de cobrança não leva a lugar nenhum. A conta mostra "HackerAI Ultra" sem
  data de renovação; Manage, Extra Usage e upgrade mostram erros. Não há Extra
  Usage (exige Stripe): depois do limite mensal só resta a franquia diária do
  modelo Auto (`PAID_DAILY_FREE_ALLOWANCE_COST_LIMIT_USD`).
- Recursos de Team continuam bloqueados.
- SEO, `robots.txt` e sitemap apontam para `hackerai.co`.
- As runs do Trigger.dev são pedidas em `us-east-1`.
- O armazenamento é de 10 GB por usuário (fixo no código).
- Os crons do `vercel.json` não rodam; nenhum é necessário sem Stripe. Os crons
  do Convex rodam sozinhos no backend.
