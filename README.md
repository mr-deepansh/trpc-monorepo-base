# Enterprise Monorepo — tRPC / Next.js / Express

> **Audience:** SDE-3 · Staff · Principal Engineers
> Assumes fluency with TypeScript, monorepo tooling, and distributed systems. Covers architectural intent, contract boundaries, and extension points. Not a getting-started guide.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Repository Structure](#repository-structure)
- [Technical Stack & Design Decisions](#technical-stack--design-decisions)
- [Package Contracts & Dependency Graph](#package-contracts--dependency-graph)
- [Local Development](#local-development)
- [Environment Configuration](#environment-configuration)
- [tRPC Layer: Server & Client Patterns](#trpc-layer-server--client-patterns)
- [OpenAPI & REST Layer](#openapi--rest-layer)
- [Database Layer](#database-layer)
- [Observability & Telemetry](#observability--telemetry)
- [Authentication Architecture](#authentication-architecture)
- [Module System (DDD Boundaries)](#module-system-ddd-boundaries)
- [Build Pipeline & Caching](#build-pipeline--caching)
- [Extending the System](#extending-the-system)
- [Code Quality Guardrails](#code-quality-guardrails)
- [Service URLs](#service-urls)

---

## Architecture Overview

Full-stack TypeScript monorepo on Turborepo. The topology is intentionally boring — one API process, one frontend, one database. Complexity lives in the type system and module boundaries, not in infrastructure.

```
┌─────────────────────────────────────────────────────────────┐
│                        apps/web (Next.js)                   │
│         React UI  ──►  tRPC Client  ──►  Server Components  │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP / tRPC over Express
┌────────────────────────────▼────────────────────────────────┐
│                      apps/api (Express)                     │
│      tRPC Router  ──►  Service Modules  ──►  DB Layer       │
└────────────────────────────┬────────────────────────────────┘
                             │ Drizzle ORM
┌────────────────────────────▼────────────────────────────────┐
│                  PostgreSQL  (localhost:5432)                │
└─────────────────────────────────────────────────────────────┘
```

**Non-negotiable invariants — violating these breaks the contract:**

- All `web` → `api` communication goes through tRPC. No raw `fetch` calls to the API from the frontend. If you need a one-off REST endpoint for an external consumer, expose it via `trpc-to-openapi` — don't add a parallel Express route.
- Business logic lives exclusively in `packages/modules/*-service`. Apps are thin shells: they mount routers, configure middleware, and boot the process. Nothing else.
- `packages/database` is the single source of truth for schema and migrations. No inline SQL, no `pg` client instantiation outside this package.
- Observability is instrumented at the tRPC middleware layer. Don't add `console.log` or manual span creation inside procedure handlers — the middleware already captures procedure path, input shape, duration, and error codes.

---

## Repository Structure

```
.
├── apps/
│   ├── api/                   # Express server — mounts tRPC router, runs migrations
│   └── web/                   # Next.js 14 — App Router, tRPC client, shadcn/ui
├── packages/
│   ├── database/              # Drizzle ORM schema, migrations, DB client
│   ├── modules/
│   │   ├── auth-service/      # Authentication domain (login, register, OAuth)
│   │   └── user-service/      # User domain (profile, preferences)
│   ├── trpc/                  # Shared router definition, context, middleware
│   ├── logger/                # Structured logger (Pino) + tRPC middleware
│   ├── observability/         # OpenTelemetry bootstrap, health checks, metrics
│   ├── eslint-config/         # Shared ESLint rule sets
│   └── typescript-config/     # Shared tsconfig presets
├── infra/
│   ├── docker-compose.yml     # PostgreSQL + optional services
│   └── otel-config.yaml       # OpenTelemetry Collector configuration
└── turbo.json                 # Task pipeline definition
```

---

## Technical Stack & Design Decisions

Every choice here was made deliberately. Before proposing a swap, understand the tradeoff being accepted.

| Layer           | Technology              | Why this, not something else                                                                                      |
| --------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| API Framework   | Express + tRPC          | Type-safe RPC with zero codegen. The schema is the contract — no proto files, no OpenAPI-first generation.        |
| Frontend        | Next.js 14 (App Router) | Server Components + server-side tRPC callers eliminate redundant client fetches. RSC is load-bearing here.        |
| ORM             | Drizzle ORM             | SQL-first. You write SQL-shaped code; Drizzle gives you types. No magic, no N+1 surprises hidden behind abstractions. |
| Database        | PostgreSQL              | No exotic features in use. Chosen for operational maturity and Drizzle Studio support for local introspection.    |
| Logging         | Pino                    | Lowest-overhead structured logger in the Node ecosystem. JSON output, tRPC middleware integration built-in.       |
| Telemetry       | OpenTelemetry (OTEL)    | Vendor-neutral. Swap the exporter config without touching application code.                                       |
| Build           | Turborepo               | Task graph is aware of the package dependency graph. Incremental builds and remote caching are first-class.       |
| Package Manager | pnpm                    | Strict `node_modules` prevents phantom dependency bugs. Workspace protocol keeps internal package versions pinned. |

---

## Package Contracts & Dependency Graph

Understand this before touching any shared package. A change to `packages/database` schema propagates to every consumer in the graph.

```
apps/api
  └─► packages/trpc (server)
        └─► packages/modules/auth-service
              └─► packages/database
              └─► packages/logger
        └─► packages/observability
        └─► packages/logger

apps/web
  └─► packages/trpc (client)
  └─► packages/logger
```

**Hard rules:**

- `packages/database` has no upstream imports. It knows nothing about modules or business logic. If you find yourself wanting to add a service call here, the abstraction is wrong.
- `packages/trpc` exports two distinct entry points: `@repo/trpc/server` and `@repo/trpc/client`. The server entry point contains request context with DB and session references — it must never land in a client bundle. The bundler won't catch this for you; the import discipline is yours.
- Module packages are domain-isolated. Cross-domain calls go through tRPC routes, not direct imports. This is what keeps bounded contexts from collapsing into a distributed monolith.

---

## Local Development

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Docker (for PostgreSQL)

### First-time Setup

```bash
pnpm install
docker-compose -f infra/docker-compose.yml up -d
cp .env.example .env          # fill in values — see Environment Configuration
pnpm --filter @repo/database db:migrate
turbo dev
```

### Selective Development

```bash
turbo dev --filter=api        # API + its package deps only
turbo dev --filter=web        # web app only
turbo build --filter=...@repo/database  # package + all downstream consumers
```

`...packageName` is Turborepo filter syntax for "this package and everything that depends on it." Use it when modifying shared packages to verify you haven't broken consumers before pushing.

---

## Environment Configuration

Root `.env` is the primary config surface. Per-app `.env` files in `apps/api` and `apps/web` are loaded by their respective processes and take precedence for app-specific variables.

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dev"

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID="<your-client-id>"
GOOGLE_OAUTH_CLIENT_SECRET="<your-client-secret>"
GOOGLE_OAUTH_REDIRECT_URI="http://localhost:3000/api/auth/callback/google"

# API
NEXT_PUBLIC_API_URL="http://localhost:8000/trpc"
PORT="8000"
BASE_URL="http://localhost:8000"

# Logging
NODE_ENV="development"
LOGGER_LEVEL="debug"    # trace | debug | info | warn | error | fatal | silent
```

Environment schemas are validated at startup via typed parsers (`apps/api/src/env.ts`, `apps/web/env.js`). Missing or malformed variables cause a hard crash at boot. This is intentional — silent misconfiguration in production is worse than a failed deploy.

---

## tRPC Layer: Server & Client Patterns

### Router Definition (`packages/trpc/server/`)

```
server/
├── trpc.ts          # tRPC initializer, procedure builders
├── context.ts       # Request context (db, session, logger)
├── schema.ts        # Shared Zod schemas
└── routes/
    ├── auth/        # Authentication procedures
    └── health/      # Health check procedures
```

**Adding a new route:**

1. Create `packages/trpc/server/routes/<domain>/route.ts`
2. Build the router using `router()` and `publicProcedure` / `protectedProcedure` from `trpc.ts`
3. Register it in `packages/trpc/server/index.ts`
4. Types propagate to the client automatically — no codegen, no manual type sync

**Procedure types:**

- `publicProcedure` — unauthenticated. No session required.
- `protectedProcedure` — session required. Throws `UNAUTHORIZED` if absent. Use this as the default for anything touching user data.

### Client Usage (`apps/web/trpc/`)

Two client variants, each with a distinct use case:

- `trpc/server.ts` — Direct caller for React Server Components and `generateStaticParams`. No network round-trip; runs in the same process. **Prefer this wherever possible.**
- `trpc/client.ts` — React hooks (`useQuery`, `useMutation`) for `"use client"` components. Use only when you need reactivity or client-side state.

Mixing these up is a common mistake. Using the hooks client in a Server Component adds an unnecessary network hop. Using the server caller in a Client Component will fail at runtime.

---

## OpenAPI & REST Layer

The REST interface is generated automatically from the tRPC router via [`trpc-to-openapi`](https://github.com/jlalmes/trpc-to-openapi). There is no separate REST implementation — both transports execute identical business logic.

```
tRPC Router (source of truth)
        │
        ├──► /trpc/*       tRPC wire protocol  (apps/web)
        │
        └──► /api/*        REST via trpc-to-openapi  (external consumers)
                │
                └──► /openapi.json   Live OpenAPI 3.0 spec
                └──► /docs           Scalar interactive UI (dev only)
```

The spec at `/openapi.json` is generated at startup from live router introspection. It is always current — no build step, no drift.

### Endpoints

| Endpoint          | Method | URL                                  | Notes                                 |
| ----------------- | ------ | ------------------------------------ | ------------------------------------- |
| Root ping         | `GET`  | `http://localhost:8000/`             | Liveness check, returns `{ message }` |
| Health check      | `GET`  | `http://localhost:8000/health`       | Returns `{ healthy: true }`           |
| OpenAPI spec      | `GET`  | `http://localhost:8000/openapi.json` | Live OpenAPI 3.0 JSON                 |
| API docs (Scalar) | `GET`  | `http://localhost:8000/docs`         | Interactive explorer — dev only       |
| REST API          | `*`    | `http://localhost:8000/api/*`        | REST routes via `trpc-to-openapi`     |
| tRPC              | `POST` | `http://localhost:8000/trpc/*`       | tRPC wire protocol                    |

> `/docs` and the permissive CORS policy (`origin: "*"`) are only mounted when `NODE_ENV !== "prod"`. The REST API itself remains available in production.

### Annotating a Procedure for OpenAPI

Only procedures with a `.meta({ openapi: { ... } })` block appear in the generated spec. Omitting it keeps the procedure tRPC-only.

```typescript
export const authRouter = router({
  getSupportedAuthenticationProviders: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/supported-providers"), // → /authentication/supported-providers
        tags: ["Authentication"],
      },
    })
    .input(zodUndefinedModel)
    .output(z.readonly(z.array(getAuthenticationMethodOutputSchema)))
    .query(async () => getAuthenticationMethods()),
});
```

**Conventions — these are enforced, not suggestions:**

- Paths via `generatePath(prefix)(suffix)` in `packages/trpc/server/utils/path-generator.ts`. Never hardcode path strings.
- `input` must be an explicit Zod schema. Use `zodUndefinedModel` for no-input procedures — do not omit the field; `trpc-to-openapi` requires it.
- `output` must be an explicit Zod schema. `z.any()` will produce a useless spec entry and will be rejected in review.
- `tags` must match an existing tag group. Use the `TAGS` constant pattern within a domain to prevent tag drift.

### Current REST Routes

| Tag            | Method | Path                                      | Procedure                                  |
| -------------- | ------ | ----------------------------------------- | ------------------------------------------ |
| Authentication | `GET`  | `/api/authentication/supported-providers` | `auth.getSupportedAuthenticationProviders` |

---

## Database Layer

Schema definition lives in `packages/database/schema.ts`, which re-exports models from `packages/database/models/`.

```bash
pnpm --filter @repo/database db:generate   # generate migration after schema changes
pnpm --filter @repo/database db:migrate    # apply pending migrations
pnpm --filter @repo/database db:studio     # open Drizzle Studio
```

Migrations are stored in `packages/database/drizzle/` and committed to source control. Never edit a generated migration file — if you need to correct a migration, generate a new one. Editing history breaks the migration chain for every environment that has already applied it.

All DB access goes through the client exported from `packages/database/index.ts`. Direct `pg` connections or raw connection strings elsewhere are not permitted.

---

## Observability & Telemetry

`packages/observability` initializes the OpenTelemetry SDK. It **must** be the first import in `apps/api/src/index.ts`. OTEL instruments modules at import time — anything imported before the SDK initializes will not be traced.

```
observability/
├── src/otel/otel.ts       # SDK bootstrap (tracer, meter providers)
├── src/tracing/           # Trace exporters, span configuration
├── src/metrics/           # Custom metric definitions
└── src/health/            # Health check endpoint handlers
```

The `packages/logger/src/trpc.ts` middleware creates a span per tRPC procedure call and attaches procedure path, input shape, duration, and error codes automatically. You should not need to create spans manually inside procedure handlers.

For local trace pipeline testing, start the OTEL Collector via `infra/otel.compose.yml` alongside the database.

---

## Authentication Architecture

Self-contained module at `packages/modules/auth-service/`. Nothing outside this module should know how authentication works internally.

```
auth-service/
├── application/           # Use cases: login, register, forgot-password, get-auth-methods
├── contracts/             # DTOs and input validation schemas
├── infrastructure/
│   ├── providers/         # OAuth provider adapters (Google, extensible)
│   └── repositories/      # DB access — UserRepository
└── index.ts               # Public API surface — the only import path consumers should use
```

Application layer: pure business logic, no I/O. Infrastructure layer: all I/O (DB queries, OAuth HTTP calls). This split makes the application layer unit-testable without mocking a database.

**Adding an OAuth provider:**

1. Create an adapter in `infrastructure/providers/` implementing the provider interface
2. Register it in `application/get-authentication-methods.ts`
3. Add and validate the required env vars in `env.ts`

---

## Module System (DDD Boundaries)

Each `packages/modules/<domain>-service/` directory is a bounded context. Its public API is defined exclusively by `index.ts`. Internal paths are implementation details.

```typescript
// ✅ Correct
import { loginUser } from "@repo/modules/auth-service";

// ❌ Wrong — bypasses the module boundary, couples you to internal structure
import { loginUser } from "@repo/modules/auth-service/application/login";
```

This isn't just style. Importing internal paths means a refactor inside the module can break consumers without any change to the public contract. The boundary is the contract.

**Adding a new domain:**

1. Create `packages/modules/<domain>-service/` mirroring `auth-service` structure: `application/`, `contracts/`, `infrastructure/`, `index.ts`
2. Add `package.json` with name `@repo/modules/<domain>-service`
3. Confirm it's covered by the glob in `pnpm-workspace.yaml` (or add it explicitly)
4. Add tRPC routes in `packages/trpc/server/routes/<domain>/`

---

## Build Pipeline & Caching

`turbo.json` defines the task dependency graph. Turborepo will not run a task until all declared upstream dependencies have completed successfully.

| Task         | Depends On                                   | Cached |
| ------------ | -------------------------------------------- | ------ |
| `build`      | `^build` (all package deps must build first) | Yes    |
| `dev`        | —                                            | No     |
| `lint`       | `^lint`                                      | Yes    |
| `test`       | `^build`                                     | Yes    |
| `db:migrate` | —                                            | No     |

**Remote caching** via Vercel is mandatory for CI at scale. Without it, every CI run is a cold build. With it, unchanged packages are fetched from cache in seconds.

```bash
turbo login   # one-time auth
turbo link    # link repo to remote cache
```

**Generating the file tree:**

```bash
find . -type d \( -name node_modules -o -name dist -o -name build \
  -o -name .next -o -name .turbo -o -name .git \) \
  -prune -o -print > structure.txt
```

---

## Extending the System

### Adding a New Package

```bash
mkdir -p packages/<name>/src
```

Minimal `package.json`:

```json
{
  "name": "@repo/<name>",
  "version": "0.0.1",
  "main": "./index.ts",
  "exports": { ".": "./index.ts" },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*"
  }
}
```

Extend the appropriate tsconfig: `typescript-config/node.json` for Node packages, `typescript-config/nextjs.json` for Next.js packages.

### Adding a New App

```bash
pnpx create-next-app apps/<name> --typescript
# Update package.json to reference workspace tsconfig and eslint-config
```

---

## Code Quality Guardrails

**ESLint** — shared configs in `packages/eslint-config/`:

- `base.js` — all TypeScript packages
- `next.js` — Next.js apps (extends base)
- `react-internal.js` — shared React component libraries

**TypeScript** — strict mode across all packages via `packages/typescript-config/base.json`. `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `strictNullChecks` are all active. Do not weaken these settings. If a type is hard to satisfy, the design probably needs revisiting — not the compiler settings.

**Formatting** — Prettier at `prettier.config.js`. Enforced in CI. Run `pnpm format` locally before pushing.

**Pre-commit** — configure `lint-staged` + `husky` if not already on your branch. Catching lint and format violations pre-commit is cheaper than a CI failure.

---

## Service URLs

| Service           | URL                                  | Notes                                                              |
| ----------------- | ------------------------------------ | ------------------------------------------------------------------ |
| Web App           | `http://localhost:3000`              | Next.js frontend                                                   |
| API Root          | `http://localhost:8000/`             | Liveness ping — `{ message: "trpcProject is up and running..." }`  |
| API Health        | `http://localhost:8000/health`       | `{ healthy: true }` — use for readiness probes                     |
| OpenAPI Spec      | `http://localhost:8000/openapi.json` | Live OpenAPI 3.0 JSON — regenerated from router at startup         |
| API Docs (Scalar) | `http://localhost:8000/docs`         | Interactive explorer — dev only (`NODE_ENV !== "prod"`)            |
| REST API          | `http://localhost:8000/api/*`        | REST interface via `trpc-to-openapi`                               |
| tRPC Endpoint     | `http://localhost:8000/trpc/*`       | tRPC wire protocol — used by `apps/web`                            |
| Drizzle Studio    | `https://local.drizzle.studio`       | Local DB browser (requires `pnpm db:studio`)                       |
| PostgreSQL        | `localhost:5432/dev`                 | Direct connection                                                  |

---

## Useful References

- [Turborepo — Task Configuration](https://turborepo.com/docs/crafting-your-repository/running-tasks)
- [Turborepo — Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching)
- [tRPC — Server-Side Rendering](https://trpc.io/docs/client/nextjs/server-side-helpers)
- [trpc-to-openapi — Procedure Annotation](https://github.com/jlalmes/trpc-to-openapi)
- [Scalar — API Reference UI](https://scalar.com/docs)
- [Drizzle ORM — Migrations](https://orm.drizzle.team/docs/migrations)
- [OpenTelemetry — Node.js SDK](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)
- [pnpm — Workspaces](https://pnpm.io/workspaces)
