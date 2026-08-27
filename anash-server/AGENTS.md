<!-- bmad:context -->
<!-- Verified 2026-08-27 against 73c7a50. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## anash-server

REST API for the Anash directory. Repo-wide rules: `../AGENTS.md`.

## Policy

- Never put member data under `public/` — `app.ts` mounts `express.static('public')` ahead of every auth check, so anything there downloads without a token. Seed data goes in `seed/`.
- Never edit `migrate-*.js` — one-off imports that already ran. Schema changes go through `db/schema.ts`, then `npm run db:generate`.

## Running and verifying

- `npm run dev` connects to the live Railway Postgres; there is no local database. Every write, and every `npm run db:migrate`, touches **real member data**.

## Conventions that differ from defaults

- Relative imports carry an explicit `.ts` extension (`import db from '../db.ts'`); `tsconfig.json` sets `allowImportingTsExtensions` and `tsx` runs the sources directly. Omitting it fails at runtime for anything but an erased `import type`.
- Auth is a JWT in an `anash_token` cookie read by `middleware/auth.ts`, not an `Authorization: Bearer` header.
- `/api/users/*` is authenticated at the mount in `app.ts`; `/api/auth/*` is not — a new auth route must add `verifyToken` itself.
- Query phone columns through `normalizePhone` (`utils/phone.ts`); they store Israeli local form (`0546329221`), never `+972`.

<!-- /bmad:context -->
