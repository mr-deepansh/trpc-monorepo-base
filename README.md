# Enterprise Monorepo — tRPC / Next.js / Express

> **Audience:** SDE-3 · Staff · Principal Engineers  
> This document assumes fluency with TypeScript, monorepo tooling, and distributed systems. It focuses on architectural intent, contract boundaries, and extension points rather than beginner setup.

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

This repository implements a **full-stack TypeScript monorepo** using Turborepo. The system is structured around a clear separation of concerns:

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

**Key architectural invariants:**

- All inter-process communication goes through tRPC. No raw REST calls between `web` and `api`.
- Business logic lives exclusively in `packages/modules/*-service`. Apps are thin shells.
- The `packages/database` package is the single source of truth for schema and migrations. No ad-hoc SQL elsewhere.
- Observability (tracing, metrics) is instrumented at the tRPC middleware layer — not scattered across handlers.

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
│   ├── trpc/                  # Shared tRPC router definition, context, middleware
│   ├── logger/                # Structured logger (Pino), tRPC middleware integration
│   ├── observability/         # OpenTelemetry setup, health checks, metrics
│   ├── eslint-config/         # Shared ESLint rule sets
│   └── typescript-config/     # Shared tsconfig presets
├── infra/
│   ├── docker-compose.yml     # PostgreSQL + optional services
│   └── otel-config.yaml       # OpenTelemetry Collector configuration
└── turbo.json                 # Task pipeline definition
```

---

## Technical Stack & Design Decisions

| Layer           | Technology              | Rationale                                                                |
| --------------- | ----------------------- | ------------------------------------------------------------------------ |
| API Framework   | Express + tRPC          | Type-safe RPC without code generation; schema lives in TypeScript        |
| Frontend        | Next.js 14 (App Router) | Server Components + tRPC server-side calls reduce client bundle          |
| ORM             | Drizzle ORM             | SQL-first, zero runtime overhead, excellent TypeScript inference         |
| Database        | PostgreSQL              | Battle-tested; Drizzle Studio for local introspection                    |
| Logging         | Pino                    | Structured JSON logs; low-overhead; tRPC middleware integration          |
| Telemetry       | OpenTelemetry (OTEL)    | Vendor-neutral traces/metrics; collector-based export                    |
| Build           | Turborepo               | Incremental builds with remote caching; task graph aware of package deps |
| Package Manager | pnpm                    | Strict node_modules, workspace protocol, faster installs                 |

---

## Package Contracts & Dependency Graph

Understanding the dependency graph is critical before modifying shared packages — changes propagate downstream.

```
apps/api  ──────────────────────────────────────────────┐
  └─► packages/trpc (server)                            │
        └─► packages/modules/auth-service               │
              └─► packages/database                     │
              └─► packages/logger                       │
        └─► packages/observability                      │
        └─► packages/logger                             │
                                                        │
apps/web  ──────────────────────────────────────────────┘
  └─► packages/trpc (client)
  └─► packages/logger
```

**Hard rules:**

- `packages/database` must never import from `packages/modules/*`. Data models are defined here; business logic lives upstream.
- `packages/trpc` exports two distinct entry points: `@repo/trpc/server` and `@repo/trpc/client`. Never import server-side context into client bundles.
- Module packages (`auth-service`, `user-service`) are domain-isolated. Cross-module calls go through tRPC routes, not direct imports.

---

## Local Development

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Docker (for PostgreSQL)

### First-time Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure
docker-compose -f infra/docker-compose.yml up -d

# 3. Configure environment
cp .env.example .env
# Edit .env — see Environment Configuration below

# 4. Run database migrations
pnpm --filter @repo/database db:migrate

# 5. Start all services
turbo dev
```

### Selective Development

```bash
# Run only the API (and its package dependencies)
turbo dev --filter=api

# Run only the web app
turbo dev --filter=web

# Build a single package and its dependents
turbo build --filter=...@repo/database
```

> `...packageName` is Turborepo filter syntax meaning "this package and everything that depends on it." Use it when making changes to shared packages to verify you haven't broken consumers.

---

## Environment Configuration

Copy `.env.example` to `.env` at the repo root. Per-app `.env` files in `apps/api` and `apps/web` are loaded by their respective processes.

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dev"

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID="your-client-id"
GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
GOOGLE_OAUTH_REDIRECT_URI="http://localhost:3000/api/auth/callback/google"

# API
NEXT_PUBLIC_API_URL="http://localhost:8000/trpc"
PORT="8000"
BASE_URL="http://localhost:8000"

# Logging
NODE_ENV="development"
LOGGER_LEVEL="debug"            # debug | info | warn | error
```

Environment schemas are validated at startup using typed env parsers (`apps/api/src/env.ts`, `apps/web/env.js`). Invalid or missing variables cause a hard crash at boot — intentionally, to prevent silent misconfiguration in production.

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
2. Export a router using the `router()` and `publicProcedure` / `protectedProcedure` builders from `trpc.ts`
3. Register it in `packages/trpc/server/index.ts`
4. Types propagate automatically to the client — no codegen step required

**Procedure types:**

- `publicProcedure` — unauthenticated, available to all callers
- `protectedProcedure` — requires valid session in context; throws `UNAUTHORIZED` otherwise

### Client Usage (`apps/web/trpc/`)

The web app exposes two tRPC client variants:

- `trpc/client.ts` — React hooks (`useQuery`, `useMutation`) for Client Components
- `trpc/server.ts` — Direct server-side caller for React Server Components and `generateStaticParams`

Use the server caller in Server Components to avoid unnecessary round-trips. Use the React hooks client only in `"use client"` components.

---

## OpenAPI & REST Layer

The API server exposes a parallel **REST interface** alongside tRPC, generated automatically from the same router using [`trpc-to-openapi`](https://github.com/jlalmes/trpc-to-openapi). Both transports share identical business logic — there is no duplication.

### How it works

```
tRPC Router (source of truth)
        │
        ├──► /trpc/*          tRPC wire protocol  (used by apps/web)
        │
        └──► /api/*           REST via trpc-to-openapi  (used by external consumers)
                │
                └──► /openapi.json   Live OpenAPI 3.0 spec
                └──► /docs           Scalar interactive UI
```

`generateOpenApiDocument` introspects `serverRouter` at startup and produces a spec from procedure metadata. The spec is served live — it always reflects the current router state without a build step.

### Endpoints

| Endpoint          | Method | URL                                  | Notes                                 |
| ----------------- | ------ | ------------------------------------ | ------------------------------------- |
| Root ping         | `GET`  | `http://localhost:8000/`             | Liveness check, returns `{ message }` |
| Health check      | `GET`  | `http://localhost:8000/health`       | Returns `{ healthy: true }`           |
| OpenAPI spec      | `GET`  | `http://localhost:8000/openapi.json` | Live OpenAPI 3.0 JSON document        |
| API docs (Scalar) | `GET`  | `http://localhost:8000/docs`         | Interactive API explorer (dev only)   |
| REST API          | `*`    | `http://localhost:8000/api/*`        | REST routes via `trpc-to-openapi`     |
| tRPC              | `POST` | `http://localhost:8000/trpc/*`       | tRPC wire protocol                    |

> `/docs` and the permissive CORS policy (`origin: "*"`) are only mounted when `NODE_ENV !== "prod"`. In production, the REST API remains available but the documentation UI is disabled.

### OpenAPI Document Metadata

Defined in `apps/api/src/server.ts`:

```typescript
const openApiDocument = generateOpenApiDocument(serverRouter, {
  title: "trpcProject OpenAPI",
  version: "1.0.0",
  baseUrl: env.BASE_URL.concat("/api"), // e.g. http://localhost:8000/api
});
```

| Field    | Value                     |
| -------- | ------------------------- |
| Title    | `trpcProject OpenAPI`     |
| Version  | `1.0.0`                   |
| Base URL | `{BASE_URL}/api`          |
| Spec URL | `{BASE_URL}/openapi.json` |
| Docs UI  | `{BASE_URL}/docs`         |

### Annotating a Procedure for OpenAPI

Only procedures with a `.meta({ openapi: { ... } })` block are included in the generated spec. Procedures without it remain tRPC-only.

```typescript
// packages/trpc/server/routes/auth/route.ts
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

**Conventions:**

- Paths are generated via `generatePath(prefix)(suffix)` in `packages/trpc/server/utils/path-generator.ts`. Always use this utility — never hardcode path strings.
- `tags` must be a string array matching an existing tag group. Use the `TAGS` constant pattern shown above to keep tags consistent within a domain.
- `input` must be a Zod schema. Use `zodUndefinedModel` (re-exported from `schema.ts`) for procedures with no input — do not omit the field.
- `output` must be a Zod schema. `trpc-to-openapi` uses it to generate the response shape in the spec.

### Current REST Routes

| Tag            | Method | Path                                      | Procedure                                  |
| -------------- | ------ | ----------------------------------------- | ------------------------------------------ |
| Authentication | `GET`  | `/api/authentication/supported-providers` | `auth.getSupportedAuthenticationProviders` |

### Adding a New REST-Exposed Procedure

1. Define `.meta({ openapi: { method, path, tags } })` on the procedure
2. Ensure `.input()` and `.output()` use explicit Zod schemas (no `z.any()`, no omissions)
3. Use `generatePath` for the path — base path is the domain prefix (e.g. `/authentication`, `/users`)
4. Restart the API server — the spec at `/openapi.json` updates automatically

---

## Database Layer

**Schema definition:** `packages/database/schema.ts` → re-exports models from `packages/database/models/`

**Migration workflow:**

```bash
# Generate a migration after schema changes
pnpm --filter @repo/database db:generate

# Apply pending migrations
pnpm --filter @repo/database db:migrate

# Open Drizzle Studio (visual DB browser)
pnpm --filter @repo/database db:studio
```

> Migrations are stored in `packages/database/drizzle/` and committed to source control. Never modify generated migration files — create a new migration instead.

**Access pattern:** All database access goes through the client exported from `packages/database/index.ts`. Raw `pg` or direct connection strings elsewhere are not permitted.

---

## Observability & Telemetry

The `packages/observability` package initializes OpenTelemetry at process startup. It must be imported before any other module in `apps/api/src/index.ts` to ensure instrumentation is active for all downstream imports.

```
observability/
├── src/otel/otel.ts       # OTEL SDK bootstrap (tracer, meter providers)
├── src/tracing/           # Trace exporters, span configuration
├── src/metrics/           # Custom metric definitions
└── src/health/            # Health check endpoint handlers
```

**tRPC tracing:** The `packages/logger/src/trpc.ts` middleware automatically creates spans for every tRPC procedure call, attaching procedure path, input shape, and error codes to the span.

**Local telemetry:** The OTEL Collector is configured in `infra/otel-config.yaml`. Start it alongside the database via `infra/otel.compose.yml` when testing trace pipelines locally.

---

## Authentication Architecture

Authentication is implemented as a self-contained module at `packages/modules/auth-service/`.

```
auth-service/
├── application/           # Use cases (login, register, forgot-password, get-auth-methods)
├── contracts/             # DTOs and input validation schemas
├── infrastructure/
│   ├── providers/         # OAuth provider adapters (Google, extensible)
│   └── repositories/      # DB access — UserRepository
└── index.ts               # Public API surface
```

**Design pattern:** Follows a lightweight application/infrastructure split. Application layer contains pure business logic. Infrastructure layer contains all I/O (DB queries, HTTP calls to OAuth providers).

**Adding an OAuth provider:**

1. Create a new adapter in `infrastructure/providers/`
2. Implement the provider interface
3. Register the provider in `application/get-authentication-methods.ts`
4. Add the corresponding environment variables and validate in `env.ts`

---

## Module System (DDD Boundaries)

Each subdirectory of `packages/modules/` is a bounded context. The public API of a module is defined exclusively by its `index.ts` exports. Do not import from internal paths of another module.

```typescript
// ✅ Correct — import from module's public API
import { loginUser } from "@repo/modules/auth-service";

// ❌ Wrong — bypasses module boundary
import { loginUser } from "@repo/modules/auth-service/application/login";
```

When a new domain is needed:

1. Create `packages/modules/<domain>-service/`
2. Mirror the `auth-service` structure: `application/`, `contracts/`, `infrastructure/`, `index.ts`
3. Add `package.json` with the `@repo/modules/<domain>-service` name
4. Register in `pnpm-workspace.yaml` if not already covered by the glob
5. Add tRPC routes in `packages/trpc/server/routes/<domain>/`

---

## Build Pipeline & Caching

`turbo.json` defines the task dependency graph. Key tasks:

| Task         | Depends On                                   | Cache |
| ------------ | -------------------------------------------- | ----- |
| `build`      | `^build` (all package deps must build first) | Yes   |
| `dev`        | —                                            | No    |
| `lint`       | `^lint`                                      | Yes   |
| `test`       | `^build`                                     | Yes   |
| `db:migrate` | —                                            | No    |

**Remote Caching** with Vercel is strongly recommended for CI environments. Without it, every CI run rebuilds unchanged packages.

```bash
# Authenticate (one-time)
turbo login

# Link this repo to remote cache
turbo link
```

Once linked, `turbo build` skips packages whose inputs haven't changed, fetching outputs from the remote cache instead. This brings cold CI builds from minutes to seconds for unchanged packages.

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
# Create package directory
mkdir -p packages/<name>/src

# Minimal package.json
{
  "name": "@repo/<name>",
  "version": "0.0.1",
  "main": "./index.ts",
  "exports": { ".": "./index.ts" },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*"
  }
}

# Extend appropriate tsconfig
# node packages → typescript-config/node.json
# Next.js packages → typescript-config/nextjs.json
```

### Adding a New App

```bash
# Next.js
pnpx create-next-app apps/<name> --typescript

# Update apps/<name>/package.json to use workspace tsconfig and eslint-config
```

---

## Code Quality Guardrails

**ESLint:** Shared configs in `packages/eslint-config/`. Three profiles:

- `base.js` — all TypeScript packages
- `next.js` — Next.js apps (extends base + next-specific rules)
- `react-internal.js` — shared React component libraries

**TypeScript:** Strict mode is enabled across all packages via `packages/typescript-config/base.json`. `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `strictNullChecks` are all active. Do not weaken these settings without team consensus.

**Formatting:** Prettier config at `prettier.config.js`. Enforced in CI. Run `pnpm format` to apply.

**Pre-commit:** Configure `lint-staged` + `husky` if not already present on your branch to catch lint and format violations before they reach CI.

---

## Service URLs

| Service           | URL                                  | Notes                                                             |
| ----------------- | ------------------------------------ | ----------------------------------------------------------------- |
| Web App           | `http://localhost:3000`              | Next.js frontend                                                  |
| API Root          | `http://localhost:8000/`             | Liveness ping — `{ message: "trpcProject is up and running..." }` |
| API Health        | `http://localhost:8000/health`       | `{ healthy: true }` — use for readiness probes                    |
| OpenAPI Spec      | `http://localhost:8000/openapi.json` | Live OpenAPI 3.0 JSON — regenerated from router at startup        |
| API Docs (Scalar) | `http://localhost:8000/docs`         | Interactive explorer — **dev only** (`NODE_ENV !== "prod"`)       |
| REST API          | `http://localhost:8000/api/*`        | REST interface via `trpc-to-openapi`                              |
| tRPC Endpoint     | `http://localhost:8000/trpc/*`       | tRPC wire protocol — used by `apps/web`                           |
| Drizzle Studio    | `https://local.drizzle.studio`       | Local DB browser (requires `pnpm db:studio`)                      |
| PostgreSQL        | `localhost:5432/dev`                 | Direct connection                                                 |

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
