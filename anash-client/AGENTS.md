<!-- bmad:context -->
<!-- Verified 2026-08-30 against 49dc8d3. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## anash-client

React Router 7 SPA for the Anash directory. Repo-wide rules: `../AGENTS.md`.

## Running and verifying

- `npm run dev` proxies `/api` to `http://localhost:3000`, so start `anash-server` first or every request 404s.
- `npm run lint` reports 4 pre-existing `react-hooks/set-state-in-effect` errors in `home.tsx`, `login-logs.tsx` and `$id.details.tsx` — leave them; rewriting those effects is its own change.

## Conventions that differ from defaults

- Routes are declared explicitly in `src/routes.ts`; the `users+/` directory name is cosmetic, not file-based routing.
- Every API `fetch` needs `credentials: 'include'` — the JWT lives in an httpOnly cookie, not in `localStorage`. Read auth state from `useAuth()` (`src/context/auth.tsx`).

## Known pitfalls

- `.env` and `.env.production` are tracked but dead — nothing reads `import.meta.env.VITE_*`. API URLs are relative in `src/config.ts` and rewritten to Railway by `vercel.json`; wiring the env vars back in broke the Vercel build before.
- `src/entry.client.tsx` calls `createRoot(document)` rather than `hydrateRoot` on purpose — `hydrateRoot` crashes with React #418 here.
- The live deploy is Vercel; `npm run deploy` (gh-pages) is a leftover — do not run it. `build/` is tracked, so `npm run build` churns ~29 files into the diff; `git checkout -- build` after.

<!-- /bmad:context -->
