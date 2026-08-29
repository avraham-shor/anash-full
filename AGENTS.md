<!-- bmad:context -->
<!-- Verified 2026-08-30 against 49dc8d3. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## anash

Hebrew community directory for Anash (Chabad) members — search and manage member records. Two independently built and deployed packages, each with its own README, manifest, and agent instructions: `anash-server/` (Express + TypeScript + Postgres on Railway) and `anash-client/` (React 19 + React Router 7 SPA on Vercel). Specs and recorded technical debt live in `_bmad-output/implementation-artifacts/`.

## Policy

- Never commit or push unless explicitly asked — make the edits and stop.
- Never log member personal data (names, phones, ID numbers, addresses, emails), secrets, OTP codes, or tokens. Debug with user ids, or mask as `anash-server/utils/email.ts` does.

## Where things are

- Server rules: `anash-server/AGENTS.md`
- Client rules: `anash-client/AGENTS.md`

## Running and verifying

- No CI exists — nothing runs on push or PR. `anash-server` has a test suite and `anash-client` has none; each package's block says what to run.

<!-- /bmad:context -->
