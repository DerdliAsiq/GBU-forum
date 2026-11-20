# GBU-forum

Forum app monorepo (pnpm workspaces, Node 24, TypeScript 5.9). Default branch: `main`. Replit'ten bağımsız olarak Render'a deploy edilebilir.

## Install
- Use **pnpm only**. The root `preinstall` script errors unless the npm user agent is `pnpm/` and deletes `package-lock.json` / `yarn.lock`.
- `pnpm install`

## Commands (run from repo root)
- `pnpm run typecheck` — full typecheck (workspace libs via `tsc --build`, then `artifacts/**` + `scripts` if present)
- `pnpm run typecheck:libs` — typecheck library project references only (`tsc --build`)
- `pnpm run build` — `typecheck`, then `pnpm -r --if-present run build` for every package
- `pnpm --filter @workspace/api-server run dev` — build (`build.mjs` → esbuild) + start the API server (requires `PORT`)
- `pnpm --filter @workspace/api-server run start` — run built server: `node --enable-source-maps ./dist/index.mjs`
- `pnpm --filter @workspace/forum run dev` — Vite dev server (requires `PORT` and `BASE_PATH`)
- `pnpm --filter @workspace/forum run build` — Vite build to `dist/public`
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks (`lib/api-client-react`) and Zod schemas (`lib/api-zod`) from `lib/api-spec/openapi.yaml`, then typecheck libs
- `pnpm --filter @workspace/db run push` — push Drizzle schema to Postgres (dev only; requires `DATABASE_URL`)
- `pnpm --filter @workspace/db run push-force` — force push schema

## Required env vars
- `DATABASE_URL` — Postgres connection string (`lib/db/drizzle.config.ts` throws if missing)
- `PORT` — required by `api-server` (`src/index.ts`) and `forum` (`vite.config.ts`); **no default**
- `BASE_PATH` — required by `forum` vite config; **no default**
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — seed admin user on startup (no defaults: if either is unset, no admin is created)
- `ISSUER_URL` — defaults to `https://replit.com/oidc`; auth reads `REPL_ID` (legacy Replit OIDC, removed)

## Package boundaries
- `artifacts/api-server` (`@workspace/api-server`): Express 5 API. Entry `src/index.ts` (requires `PORT`, seeds an admin user on start). Bundled with esbuild via `build.mjs` to `dist/index.mjs`; CJS-only/native deps externalized.
- `artifacts/forum` (`@workspace/forum`): React 19 + Vite SPA. Entry `src/main.tsx` / `src/App.tsx`; path alias `@` → `src`.
- `lib/db` (`@workspace/db`): Drizzle ORM schema under `src/schema/`: `auth` (sessions + users), `categories`, `posts`, `replies`.
- `lib/api-spec` (`@workspace/api-spec`): OpenAPI 3.1 spec `openapi.yaml` + Orval config.
- `lib/api-zod` (`@workspace/api-zod`): generated Zod schemas (`src/generated/types`).
- `lib/api-client-react` (`@workspace/api-client-react`): generated react-query client (`src/generated`).
- `lib/replit-auth-web` — **kullanılmıyor**, Replit OIDC kaldırıldı.

## Gotchas (agent-relevant)
- **OpenAPI title is frozen**: `openapi.yaml` `info.title` must stay `"Api"` — Orval derives generated import paths from it.
- **Don't drop `sessions` / `users` tables**: marked mandatory for Replit Auth in `lib/db/src/schema/auth.ts`.
- **Don't edit generated files by hand**: `lib/api-client-react/src/generated`, `lib/api-zod/src/generated/types`, and `artifacts/api-server/dist` are regenerated — re-run `codegen` / `build` instead.
- **Build order matters**: `pnpm run build` runs typecheck first; a type error blocks the build.
- **No tests exist**: no `*.test.*` / `*.spec.*` files and no test runner configured.
- **`scripts` workspace entry** is declared in `pnpm-workspace.yaml` but no package exists there yet.
- **README.md is mostly placeholder** ("Populate as you build"); do not trust unverified claims in it.
- **Replit OIDC auth removed**: `@workspace/replit-auth-web` kaldırıldı. Kimlik doğrulama artık basit session + cookie tabanlı (`/api/auth/local-login`, `/api/auth/register`, `/api/logout`). Frontend `useAuth` hook'u `src/lib/auth.ts`'da.
- **`vite.config.ts`**: `@replit/*` eklentileri kaldırıldı. `PORT` ve `BASE_PATH` build sırasında default değere düşer (`3000` ve `/`).
- **Render**: `render.yaml` iki servis (API + Frontend) ve PostgreSQL veritabanı tanımlar. `.env.example` gerekli env değişkenlerini listeler.
- **`.replit`**: `scripts/post-merge.sh` referansı var ama dosya yok. Render'da kullanılmaz.

## Pointers
- Root `package.json` scripts, `pnpm-workspace.yaml` (catalog + overrides), `tsconfig.base.json`
- `lib/api-spec/openapi.yaml` (source of truth for API contracts)
- `lib/db/src/schema/` (source of truth for DB schema)
- `render.yaml` (Render deploy tanımı)
