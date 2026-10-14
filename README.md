# الموقع الرسمي للشيخ عبد الرحمن النحوي — Official Website

Arabic-first digital library and official site. Next.js (App Router) · TypeScript · Tailwind CSS 4 ·
PostgreSQL · Drizzle ORM.

> **Current status: Phase 1 of 8 (Foundation) complete.** See [Status](#status).

## Requirements

- Node.js 22+ and npm
- PostgreSQL 15+ (local or hosted). A hosted database is **not** provided; you must create one.

## Local setup

```bash
npm install
cp .env.example .env.local     # Next.js reads this
cp .env.example .env           # the db scripts read this (dotenv)
# edit DATABASE_URL in both files

npm run db:migrate             # applies ./drizzle/*.sql
npm run db:seed                # roles, permissions, content types, settings, empty page shells
npm run dev                    # http://localhost:3000
```

Quality checks:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Project layout

```
src/app/                 routes (public site; admin arrives in Phase 4)
src/components/          shared UI (Phase 2+)
src/lib/db/schema.ts     the whole database schema
src/lib/db/seed-reference.ts   idempotent reference data (no scholarly content)
src/lib/auth/permissions.ts    permission catalogue + default role mapping
src/lib/search/arabic.ts       Arabic normalisation for search
src/lib/env.ts           validated environment variables
src/lib/{storage,validation}/  reserved for Phases 4–5
drizzle/                 generated SQL migrations (commit these)
scripts/                 migrate + seed scripts
tests/                   Vitest tests (run against the real migrations)
```

## Key design decisions

- **ORM:** Drizzle only. Change the schema in `schema.ts`, then `npm run db:generate`, review the SQL, commit.
- **Approval is separate from publication.** `approval_status` (draft / in_review / approved) vs
  `publication_status` (unpublished / published / archived). A database CHECK constraint makes it
  impossible to publish unapproved content. Mandatory review is the setting
  `workflow.require_review` (off in v1).
- **Safe deletes.** Categories, tags, content types and roles that are in use cannot be deleted
  (`ON DELETE RESTRICT`).
- **Arabic search.** `content_items.search_text` stores normalised text (hamza, diacritics, tatweel,
  ya/alef-maqsura, ta-marbuta, digits). Original text is untouched. A GIN index on
  `to_tsvector('simple', search_text)` backs the search; queries must be normalised with the same function.
- **No invented content.** Seed data contains only structure. Static pages (about, privacy, terms,
  copyright) are created empty and unpublished. `is_sample` marks development sample data, which must
  never reach production.
- **No default admin account.** The first administrator is created by a one-time script (Phase 4).

## Status

| Area | State |
| --- | --- |
| Next.js 16 + TS strict + Tailwind 4, RTL root layout, self-hosted IBM Plex Sans Arabic | Done, builds |
| Schema + migration (20 tables) | Done; verified on in-process PostgreSQL (PGlite) |
| Reference seed, permissions catalogue, Arabic normalisation | Done, tested |
| Tests | 37 passing (schema constraints, permissions, Arabic search) |
| `db:migrate` / `db:seed` against a **real PostgreSQL server** | Written, **not yet run** here (no server available) — run once on your machine |
| Public pages, search UI, admin, auth, uploads, SEO | Phases 2–8, not started |

## Deployment

Not yet documented — completed in Phase 8 (production database, env vars, backups, first admin,
pre-launch checklist).
