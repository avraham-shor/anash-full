---
title: 'Stop getUserById returning the bcrypt password hash to admin clients'
type: 'bugfix'
created: '2026-08-30'
status: 'done'
baseline_commit: '49dc8d3d8a94ddedf61025912dcb273fafca2be8'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `getUserById` takes a bare `db.select()` for `admin` and `owner` callers, so `GET /api/users/:id` returns the whole `users` row — including `password`, the bcrypt hash. Every member's hash reaches the browser of anyone holding an elevated role, where it sits in DevTools, in memory, and in anything that caches the response. The guest and member branches of the same function already shape their columns, and the repo's own test file names `password` among the columns a caller must never select; the admin branch is the only read that ignores that rule.

**Approach:** Give the admin branch a column set derived from the schema minus `password`, so the hash is never fetched rather than fetched and hoped-over. Everything else keeps flowing to admins unchanged, and a column added to `db/schema.ts` later still reaches them without touching this function.

## Boundaries & Constraints

**Always:**
- The admin column set is *derived* from the schema (`getTableColumns(users)` minus `password`), never hand-listed — a hand-listed set silently drops future columns from the admin view.
- Apart from `password`, the admin response is unchanged: same field names and values, `role` / `idNumber` / `wifeIdNumber` / `systemPhone1` / `systemPhone2` all still present.
- Role tests stay allowlists (`role === 'admin' || role === 'owner'`), never negations.
- Never log member personal data, and never log the hash — not even masked.

**Ask First:**
- Adding `hasPassword` to the admin branch. It is deliberately absent, and `$id.details.tsx` documents that absence as load-bearing for its edit gate.
- Any `db/schema.ts` change or migration.
- Connecting to the live Railway Postgres (`npm run dev` reaches real member data).

**Never:**
- Do not touch the member / own-record branch: `memberColumns`, the `{ password }` lookup that derives `hasPassword`, or `minColumns`.
- Do not narrow the internal bare `select()` calls in `auth-controller.ts` or `updateUser` — over-fetching, not a leak; recorded in `deferred-work.md`.
- No change to who may call `GET /api/users/:id`, to `middleware/auth.ts`, or to the route table.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Elevated read | `GET /api/users/:id`, role `admin` or `owner` | 200 with every `users` column except `password` — `idNumber`, `wifeIdNumber`, `systemPhone1/2` and `role` all included | N/A |
| Hash never fetched | any elevated read | The shape handed to drizzle carries no `password` key, so the hash never leaves Postgres | N/A |
| Admin reads own record | `:id` is the caller, role `admin` | Same admin shape; `hasPassword` still absent, edit-gate behaviour unchanged | N/A |
| Member reads own record | role `user`, own id | Unchanged: `memberColumns` plus `hasPassword` | N/A |
| Guest read | role `guest` | Unchanged: `memberColumns` only, no PII block | N/A |
| Schema grows a column | a column is added to `db/schema.ts` | Appears in the admin response with no edit to `getUserById` | N/A |

</frozen-after-approval>

## Code Map

- `anash-server/controllers/user-controller.ts` -- `getUserById` L72. The leak is the bare `db.select()` at **L78** in the `isAdmin` branch. `minColumns` (L14) and `memberColumns` (L30) are the shaping pattern this branch must join. The own-record `{ password }` lookup at **L84** reads the hash on purpose to derive `hasPassword` — leave it. `updateUser`'s bare select (L316) queries `verificationCodes`, not `users`: out of scope.
- `anash-server/db/schema.ts` -- `users` L12, `password` L53. Read-only. `getTableColumns` is available in the installed drizzle-orm (0.45.2).
- `anash-server/auth-flow.test.ts` -- the db mock records every select shape into `state.selectShapes` (L107); `PII_COLUMNS` (L152) already names `password`. **L436 `row 8 contrast: an admin read does take the full-row branch` asserts `state.selectShapes[0] === undefined`** — it pins the bug and must be inverted, not deleted. The mock's `isPasswordLookup` (L77) only diverts a shape whose *single* key is `password`, so a multi-key admin shape still resolves to `state.row`: no harness change needed.
- `anash-client/src/models/user.ts` -- the `User` type never declared `password` (L35 marks `hasPassword` own-record only). Read-only evidence that no client consumer breaks.
- `anash-client/src/components/card.tsx` -- admin block at L138 renders `idNumber`, `wifeIdNumber`, `systemPhone1/2`. Read-only: those must still arrive.
- `anash-client/src/routes/users+/$id.details.tsx` -- L32 comment and the L34 `canEdit` gate depend on `hasPassword` being absent for admins. Read-only: do not make it present.

## Tasks & Acceptance

**Execution:**
- [x] `anash-server/controllers/user-controller.ts` -- import `getTableColumns` from `drizzle-orm`, define `adminColumns` beside `memberColumns` as every `users` column minus `password`, pass it to the select at L78 -- the hash is then never fetched and the branch matches the other two.
- [x] `anash-server/auth-flow.test.ts` -- invert the L436 test: assert the admin select shape exists, contains `idNumber`, `systemPhone1` and `role`, and does **not** contain `password`; assert the response body carries no `password` key -- the old assertion encodes the bug as intended behaviour and would fail the fix.

**Acceptance Criteria:**
- Given the `users` schema gains a column, when an admin reads a record, then it appears in the response with no edit to `getUserById`.
- Given an admin session, when it reads any record, then no query in that flow selects `password` from `users`.
- Given the full suite, when `npm test` runs, then everything passes with no change beyond the inverted admin-branch assertion.

## Spec Change Log

- Design Notes anticipated an eslint check on the `_password` name. The repo enables both
  `no-unused-vars` (via `js.configs.recommended`) and `@typescript-eslint/no-unused-vars` and
  configures only `argsIgnorePattern`, so neither ignores rest siblings and no `_` name is
  accepted for a module-scope binding.

- Adversarial review then replaced the rest-spread entirely. It was fail-open in two directions:
  renaming `password` in `db/schema.ts` would make the subtraction a silent no-op and ship the
  hash, and a future secret column would join the elevated view unnoticed. The derivation is now
  a named `SECRET_USER_COLUMNS` set subtracted from `getTableColumns(users)`, guarded by a
  module-load check that every name in the set is a real column -- a rename now throws at boot
  instead of leaking. This removed the unused binding, so the eslint-disable was dropped.
  The exclusion stays derived, so the "schema grows a column" acceptance criterion still holds.

## Design Notes

Deriving the set rather than listing it is the point: a hand-written list of 40-odd columns rots the moment someone adds one to `db/schema.ts`, and it fails silently — admins quietly stop seeing a field. Destructuring `password` out of `getTableColumns` inverts that risk, making the exclusion explicit and everything else automatic.

```ts
import { eq, asc, and, or, like, notInArray, gt, isNull, lt, getTableColumns } from 'drizzle-orm';

// Every users column except the bcrypt hash. Derived, so a new schema column reaches
// admins automatically while `password` stays excluded by construction.
const { password: _password, ...adminColumns } = getTableColumns(users);
```

Check the eslint unused-vars ignore pattern before settling on the `_password` name — the binding is intentionally unused.

## Verification

**Commands:**
- `cd anash-server && npm test` -- expected: whole suite passes, including the inverted admin-branch test.
- `cd anash-server && npx tsc --noEmit` -- expected: no *new* type errors. This command does not come back clean at baseline (a pre-existing TS5107 on `moduleResolution: node10`, plus TS2571s in the test file), so compare counts against a stashed baseline rather than expecting zero.
- `cd anash-server && npx eslint controllers/user-controller.ts auth-flow.test.ts` -- expected: no *new* problems. Not clean at baseline either: the flat config declares no Node globals, so every `console.error` is a `no-undef` error. Compare counts against the baseline.

**Manual checks (if no CLI):**
- Grep the diff for `db.select().from(users)` inside `getUserById` -- expected: gone, with no other call site changed.

## Suggested Review Order

**The exclusion, and why it cannot quietly stop working**

- Start here: the one-line statement of what an elevated caller must never receive.
  [`user-controller.ts:62`](../../anash-server/controllers/user-controller.ts#L62)

- The fail-closed guard. A rename in `db/schema.ts` throws at boot instead of shipping the hash.
  [`user-controller.ts:69`](../../anash-server/controllers/user-controller.ts#L69)

- The derivation itself: whole schema minus the secrets, so new columns need no edit here.
  [`user-controller.ts:83`](../../anash-server/controllers/user-controller.ts#L83)

- The actual fix -- one argument, where a bare `select()` used to pull the whole row.
  [`user-controller.ts:110`](../../anash-server/controllers/user-controller.ts#L110)

**The proof**

- The harness change that makes every body assertion real: the mock now projects columns.
  [`auth-flow.test.ts:81`](../../anash-server/auth-flow.test.ts#L81)

- Shared assertion: one query only, so a later hash lookup on this branch cannot hide.
  [`auth-flow.test.ts:456`](../../anash-server/auth-flow.test.ts#L456)

- Non-vacuous now -- the fixture carries a real hash for the projection to drop.
  [`auth-flow.test.ts:479`](../../anash-server/auth-flow.test.ts#L479)

- Both elevated roles and both read shapes (someone else's record, and the caller's own).
  [`auth-flow.test.ts:482`](../../anash-server/auth-flow.test.ts#L482)

