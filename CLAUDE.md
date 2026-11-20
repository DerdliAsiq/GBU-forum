# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` at the repo root holds a shorter, overlapping set of notes; keep the two consistent when changing commands or env vars. `README.md` is an unfilled template — don't rely on it (it even states the wrong API port).

## Commands

Run from the repo root. **pnpm only** — the root `preinstall` script exits with an error under npm/yarn and deletes their lockfiles.

```bash
pnpm install
pnpm run typecheck                                  # libs via `tsc --build`, then artifacts/** and scripts
pnpm run typecheck:libs                             # library project references only
pnpm run build                                      # typecheck, then `build` in every package (a type error blocks the build)
pnpm --filter @workspace/api-spec run codegen       # regenerate lib/api-client-react + lib/api-zod from openapi.yaml, then typecheck:libs
pnpm --filter @workspace/db run push                # push Drizzle schema to Postgres (dev only; needs DATABASE_URL)
pnpm --filter @workspace/api-server run dev         # esbuild bundle + start (needs PORT, DATABASE_URL)
pnpm --filter @workspace/forum run dev              # Vite dev server
```

There are **no tests and no linter** configured (only `prettier` is a root devDependency). Typecheck is the only automated check; to check one package: `pnpm --filter @workspace/api-server run typecheck`.

The `api-server` `dev` script uses `export NODE_ENV=...` and the root `preinstall` uses `sh -c`, so on Windows run pnpm from Git Bash (or another POSIX shell). Two more Windows traps: Git Bash rewrites `BASE_PATH=/` into `C:/Program Files/Git/` (set `MSYS_NO_PATHCONV=1`, but that breaks the pnpm shim, so then start Vite with `node ./node_modules/vite/bin/vite.js`); and `pnpm-workspace.yaml` `overrides` strip many non-Linux native binaries — don't re-add `@tailwindcss/oxide-win32-x64-msvc` there, or Tailwind silently generates no utility classes on Windows.

Local run that works on Windows (API reads the root `.env` via Node's `--env-file`; Vite does not read the root `.env`, so pass its vars inline):

```bash
cd artifacts/api-server && node ./build.mjs && PORT=5001 node --env-file=../../.env ./dist/index.mjs
cd artifacts/forum && MSYS_NO_PATHCONV=1 PORT=3000 BASE_PATH=/ VITE_API_URL=http://localhost:5001 node ./node_modules/vite/bin/vite.js --config vite.config.ts
```

### Environment

- API server: `PORT` (required, no default — `src/index.ts` throws), `DATABASE_URL` (required — `lib/db/src/index.ts` throws on import), `ADMIN_USERNAME` / `ADMIN_PASSWORD` (seeded on startup; if either is unset no admin is created — there is deliberately no fallback), `CORS_ORIGINS` (comma-separated browser origins allowed to call with cookies; unset = localhost only), `TRUST_PROXY` (set to `1` behind Render's proxy; leave unset when reached directly), `CLIENT_IP_HEADER` (on Render set to `cf-connecting-ip`: Render sits behind Cloudflare, so `req.ip` is a proxy address and, without this, every visitor shares one rate-limit bucket). The first rate-limited request logs a "Client IP source" line (no addresses) to verify this.
- Forum (Vite): `PORT` and `BASE_PATH` fall back to `3000` and `/`. `BASE_PATH` feeds both Vite's `base` and the wouter router base (`import.meta.env.BASE_URL` in `App.tsx`).
- `render.yaml` documents the Render deploy: **one web service** that builds both apps; the API serves `artifacts/forum/dist/public` (override with `FRONTEND_DIR`) with an SPA fallback for every non-`/api` GET. Leave `VITE_API_URL` and `CORS_ORIGINS` unset in that setup — everything is same-origin. The database is Supabase, not a Render Postgres.

## Architecture

pnpm monorepo: `artifacts/*` are deployable apps, `lib/*` are shared workspace packages (the `scripts` workspace entry points at a directory that does not exist; `lib/integrations/*` likewise).

### API contract pipeline (the part that spans many files)

`lib/api-spec/openapi.yaml` is the source of truth. `codegen` (Orval) emits two packages, both with `clean: true` (output dirs are wiped — never hand-edit):

- `@workspace/api-client-react` — react-query hooks (`useListPosts`, `useCreateReply`, …) that call `/api/...` through the custom mutator `lib/api-client-react/src/custom-fetch.ts`. `custom-fetch.ts` is hand-written and is *not* regenerated.
- `@workspace/api-zod` — Zod schemas (`CreatePostBody`, `GetCurrentAuthUserResponse`, …) used by the Express handlers to validate request bodies and parse responses.

`openapi.yaml` `info.title` must remain `"Api"` (Orval derives generated file/import names from it; `orval.config.ts` also forces it).

**The spec has drifted from the code.** It still describes Replit-era `/login`, `/callback` and `/mobile-auth/*` (no handlers exist), and it lacks `/auth/local-login`, `/auth/register`, `/profile`, and `/admin/users/:id/toggle-ban`, which the server implements and the frontend calls with raw `fetch`. If you add an endpoint, decide whether it goes through the spec + codegen or follows that raw-fetch precedent.

### API server (`artifacts/api-server`)

Express 5, bundled by `build.mjs` (esbuild → single ESM file `dist/index.mjs`; native/unbundleable deps are in the `external` list; pino needs `esbuild-plugin-pino`). Request flow in `src/app.ts`: pino-http → CORS (`credentials: true, origin: true`) → cookie-parser → JSON → **`authMiddleware`** → `/api` router.

- **Auth is custom session+cookie.** `lib/auth.ts` stores sessions in the `sessions` table (cookie `sid`, 7-day TTL; a `Authorization: Bearer <sid>` header is also accepted). `authMiddleware` loads the session, re-reads the user row on every request (so `isAdmin`/`isBanned` changes take effect immediately, and banned users are logged out), then populates `req.user` and `req.isAuthenticated()` (type-augmented in the middleware file).
- `POST /auth/local-login` is the one login for every account (admins included); `POST /auth/register` creates non-admin users, with name/password rules shared with `PUT /profile` in `src/lib/userValidation.ts`. The frontend has a single `/giris` login/register page; there is no separate admin login, and `/admin` renders the normal 404 for non-admins. The session cookie is always set with `secure: true`.
- The admin account is synced from `ADMIN_USERNAME`/`ADMIN_PASSWORD` on every startup (password re-hashed if it changed, `isAdmin` forced on). Local and Render share one Supabase database, so they must use the same `ADMIN_PASSWORD` or whichever started last wins.
- **Authorization is per-route**: `requireAdmin` is defined locally in `routes/admin.ts` and is not shared. Note that admin-only category/post/reply mutations (`POST/PUT/DELETE /categories`, `PATCH/DELETE /posts/:id`, `DELETE /replies/:id`) live in `admin.ts`, not in `categories.ts`/`posts.ts`/`replies.ts`. `POST /posts` and `POST /posts/:id/replies` both require a signed-in account; nothing is anonymous. Rows store `author_id` (FK → users, `ON DELETE SET NULL`) plus an `author_name` username snapshot; every read returns `coalesce(users.username, author_name)` via a left join, so the shown name is always the author's *current* username. Any `authorName` in request bodies is ignored (the OpenAPI field is now vestigial).
- **Abuse controls** (`src/lib/rateLimit.ts`, in-memory, per process): login is limited per IP and per IP+username, with a dummy bcrypt compare for unknown users so timing doesn't reveal usernames; register counts only *created* accounts per IP (5/hour, plus a loose 30 attempts/15 min) so typos don't lock people out; `POST /posts` and `POST /posts/:id/replies` are limited per IP. Anonymous `authorName`s that impersonate staff are rejected by `src/lib/authorName.ts` (admins exempt). Logout `returnTo` only accepts plain same-site paths.
- **Views** (`src/lib/postViews.ts`): `GET /posts/:id` counts a view only the first time a viewer opens that topic on a given day, via an insert into `post_views` (PK post+viewer+day, `ON CONFLICT DO NOTHING`). Viewer key is `u:<user id>` or `a:<HMAC(IP)>` keyed by `VIEW_HASH_SALT` (falls back to `DATABASE_URL`) — raw IPs are never stored; rows older than yesterday are pruned opportunistically.
- Denormalized counters (`categories.postCount`, `posts.replyCount`, `posts.viewCount`, `posts.lastReplyAt`) are maintained by hand in route handlers — keep them in sync when adding create/delete paths.
- Handlers convert `Date` columns to ISO strings by hand before `res.json`; errors are `{ error: string }` with Azerbaijani messages on the auth routes.

### Database (`lib/db`)

Drizzle ORM over `pg`. Schema in `src/schema/` (`auth`, `categories`, `posts`, `replies`), re-exported from `src/index.ts` together with `db` and `pool`. Keep `sessions` and `users` tables even though Replit Auth is gone — the custom auth uses both. There are no migration files; the workflow is `drizzle-kit push`.

The database is hosted on **Supabase** (project MCP server in `.mcp.json`). Its tables were originally hand-created in the dashboard and later aligned to the Drizzle schema (including constraint/index names) by a Supabase migration `align_schema_with_drizzle`; keep the two in sync — change `lib/db/src/schema` first. RLS is enabled on every public table (a Supabase event trigger turns it on for new tables) with no policies: the app connects as the table owner and bypasses RLS, while Supabase's public REST API stays locked out. Don't add policies or disable RLS casually. For connecting from IPv4 networks, use the Supabase **Session pooler** connection string, not the IPv6-only direct host.

### Frontend (`artifacts/forum`)

React 19 + Vite + Tailwind 4 + wouter + shadcn/Radix (`src/components/ui/*` is the stock component set; `@` → `src`). Routes are declared in `src/App.tsx`; everything except `/admin-login` renders inside `ForumLayout`. Data fetching uses the generated react-query hooks; auth state comes from the hand-rolled `useAuth` in `src/lib/auth.ts`, not from a provider. `lib/replit-auth-web` is dead code.

**API base URL:** `src/lib/api.ts` reads `VITE_API_URL` (build-time; empty = same-origin relative `/api/...`). `main.tsx` calls `configureApi()` → `setBaseUrl()` for the generated hooks, and `customFetch` then sends `credentials: "include"` whenever a base URL is set. Endpoints that are not in the OpenAPI spec must go through `apiFetch()` from the same file — never a bare `fetch("/api/...")`. `vite.config.ts` has no dev proxy, so for local dev either set `VITE_API_URL=http://localhost:<api port>` or serve both behind one origin.

**Split-origin deployments are not supported as-is:** the session cookie is `SameSite=Lax`, which is not sent on cross-site `fetch`, so login only works when the SPA and API share an origin (the single-service deploy above, or localhost dev). A split deploy would need `SameSite=None; Secure` (in `routes/auth.ts` and `lib/auth.ts` `clearSession`) plus `CORS_ORIGINS` — never loosen CORS back to reflecting any origin while cookies are `None`.

### TypeScript layout

`tsconfig.base.json` is shared (`customConditions: ["workspace"]`, `moduleResolution: bundler`). The root `tsconfig.json` only references `lib/db`, `lib/api-client-react`, `lib/api-zod`; the apps typecheck separately with `tsc --noEmit` through their own `typecheck` scripts, which is why `pnpm run typecheck` does libs first. `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440`, so very new package releases will be refused at install time.
