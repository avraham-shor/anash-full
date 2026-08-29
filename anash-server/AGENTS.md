<!-- bmad:context -->
<!-- Verified 2026-08-30 against 49dc8d3. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## anash-server

REST API for the Anash directory. Repo-wide rules: `../AGENTS.md`.

## Policy

- Never put member data under `public/` — `app.ts` mounts `express.static('public')` ahead of every auth check, so anything there downloads without a token. Seed data goes in `seed/`.
- Never edit `migrate-*.js` — one-off imports that already ran. Schema changes go through `db/schema.ts`, then `npm run db:generate`.

## Running and verifying

- Run `npm test` before finishing any server change — it is the only gate and takes ~5s. It substitutes a fake db through `mock.module`, so it never reaches Railway.
- `npm run dev` connects to the live Railway Postgres; there is no local database. Every write, and every `npm run db:migrate`, touches **real member data**.

## Conventions that differ from defaults

- Relative imports carry an explicit `.ts` extension (`import db from '../db.ts'`); `tsconfig.json` sets `allowImportingTsExtensions` and `tsx` runs the sources directly. Omitting it fails at runtime for anything but an erased `import type`.
- Auth is a JWT in an `anash_token` cookie read by `middleware/auth.ts`, not an `Authorization: Bearer` header; mint it only through `setAuthCookie` (`utils/auth-cookie.ts`), since two controllers issue tokens.
- `/api/users/*` is authenticated at the mount in `app.ts`; `/api/auth/*` is not — a new auth route must add `verifyToken` itself.
- Phone input goes through `utils/phone.ts`: `normalizePhone` to store, `phoneMatchCandidates` to match, and `isPlausiblePhone` to reject non-numeric input before querying. Columns hold Israeli local form (`0546329221`), never `+972`.

## Known pitfalls

- In a new test, reach a controller through `await import()` after `mock.module`. A static import is hoisted above the mock and loads the real Railway pool and a keyless Resend client, which throws at module scope.

<!-- /bmad:context -->
