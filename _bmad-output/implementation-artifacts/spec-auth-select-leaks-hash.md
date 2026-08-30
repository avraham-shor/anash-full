---
title: 'Login and forgot-password pull every users column, hash included, on every request'
type: 'bugfix'
created: '2026-08-30'
status: 'done'
baseline_commit: 'eb096a9992d2b67b5ef7747f8fe864503ef6cb90'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `login` (L148-153) and `forgotPasswordSendOtp` (L240-245) each issue a bare `db.select().from(users)`, loading all 45 columns — bcrypt hash, both ID numbers, addresses, coordinates, every phone and email — into process memory. `login` reads 5 of them; `forgotPasswordSendOtp` reads 3. Neither row reaches a client, so this is over-fetching rather than a leak, but it is the widest possible read on the two hottest unauthenticated endpoints.

**Approach:** Shape both statements to the columns their branches actually read, in the inline style `resetPassword` (L292-297) already uses in the same file. The hash stays in both shapes — `bcrypt.compare` and the `!row.password` branch need it.

## Boundaries & Constraints

**Always:** Every response body, status code, cookie and `user_logins` row stays identical — a read-shape change only. Both shapes are hand-listed allowlists, so a column added to `db/schema.ts` never silently joins an unauthenticated read. `matchesPhone(phone)`, `orderBy(asc(users.id))` and `limit(1)` untouched on both.

**Ask First:** Extracting or exporting a shared column constant across the two sites. Any change to which account a broad phone match resolves to.

**Never:** Do not imitate `user-controller`'s `adminColumns` — it is schema-derived-minus-secrets, the opposite policy from these narrowing allowlists. Do not touch `matchesPhone`, `digitsOnly`, `resetPassword`'s already-shaped `users` select, or the bare selects on `verificationCodes` (`resetPassword` L304, `updateUser`) — different table, tracked separately. No client or schema changes.

## I/O & Edge-Case Matrix

Every row is **unchanged behavior**; the point of the matrix is that shaping must not perturb any branch.

| Scenario | Input / State | Expected Output / Behavior |
|----------|--------------|---------------------------|
| Correct password | known phone + right password | 200, real `role`, `pwVerified: true`, success row in `user_logins` |
| Held-back password | known phone, no `password` field | 200, capped at `role: 'user'`, `pwVerified: false`, success row |
| Wrong password / no hash | known phone + wrong password | 401 `סיסמה שגויה`, failure row, no cookie |
| Unknown number | phone matching no row | 200 guest token, nothing written to `user_logins` |
| Reset, no password on account | `password` NULL | 400 with `noPassword: true` |
| Reset, no email on account | `email1` NULL | 400, no OTP row written, no email sent |
| Reset, unknown number | no matching row | 400, existing message |
| Invalid phone (either route) | fails `isPlausiblePhone` | 400, no query issued |

</frozen-after-approval>

## Code Map

- `anash-server/controllers/auth-controller.ts` — the only source file changing. `login` L148-153 is the first bare select; its branches read exactly `id`, `email1`, `fullName`, `password`, `role` (L183-223). `forgotPasswordSendOtp` L240-245 is the second; its branches read `row` truthiness, `password`, `email1`, `id` (L247-270). `resetPassword` L292-297 is the in-file style precedent: an inline `{ id: users.id, password: users.password }` literal.
- `anash-server/auth-flow.test.ts` — the regression net, and a real one: the `builder` mock (L72-108) **projects** a shaped select to the requested keys (L84-85), so omitting a column a branch reads makes it `undefined` and the login tests at L242-288 fail. Two mock behaviors constrain the shapes: `keys === null` (bare select) yields the whole row, and keys exactly `['password']` route to `state.passwordRow` not `state.row` (L77-78) — both new shapes have 3+ keys, so neither trips it. `state.selectShapes` (L112-114) is what a new assertion reads; `assertElevatedRead` (L453-479) is the `getUserById` analogue to model it on.
- `anash-server/utils/email.ts` — `sendOtpEmail` is **not** mocked and builds a real Resend client at module scope. A `forgotPasswordSendOtp` test must return before L268; the `email1: null` branch (L255) does that after the select is recorded.
- `anash-server/db/schema.ts` — `users` L12-55. Tests enumerate columns via `getTableColumns(users)`, already imported at L33 of the test file. Read-only contrast for the **Never** clause: `user-controller.ts` L61-86 (`SECRET_USER_COLUMNS` / `adminColumns`).

## Tasks & Acceptance

**Execution:**
- [x] `anash-server/controllers/auth-controller.ts` — shape `login`'s select as `{ id, email1, fullName, password, role }` and `forgotPasswordSendOtp`'s as `{ id, email1, password }`, in `resetPassword`'s style. One short comment each: the list is what the branches below read, hand-listed rather than schema-derived on purpose.
- [x] `anash-server/auth-flow.test.ts` — add `forgotPasswordSendOtp` to the import at L122, then one test per route asserting it records exactly one `users` select shape, that the shape is non-null (a reverted bare select fails), and that its keys equal the expected set — cross-checked as a strict subset of `getTableColumns(users)` excluding `idNumber`, `wifeIdNumber`, `systemPhone1`, `systemPhone2`, `coordinates`. Drive `forgotPasswordSendOtp` with `email1: null` so it returns at L255 without reaching `sendOtpEmail`.

**Acceptance Criteria:**
- Given the existing suite, when `npm test` runs, then all 38 prior tests still pass — the login tests are the proof no read column was dropped, because the mock projects.
- Given either statement reverted to a bare `select()`, when `npm test` runs, then the new assertions fail rather than passing silently.

## Design Notes

Two inline shapes, not one shared constant: the sites read different sets (5 vs 3), `resetPassword` already carries its own inline shape, and a shared set would hand `forgotPasswordSendOtp` two columns it never reads — the thing being fixed. Widening is an **Ask First** item.

```ts
// The columns the branches below read. Hand-listed on purpose: a column added
// to db/schema.ts must not join an unauthenticated read on its own.
.select({
    id: users.id, email1: users.email1, fullName: users.fullName,
    password: users.password, role: users.role,
})
```

Not in scope and not made worse: both statements still scan `users` through `regexp_replace`. Already tracked in `deferred-work.md`; shaping the projection does not change the plan.

## Verification

**Commands:**
- `cd anash-server && npm test` — expected: 0 failures, total above the 38-test baseline.
- `cd anash-server && npx eslint .` — expected: 0 errors (baseline 0 errors / 12 `no-console` warnings; warnings must not grow).

## Suggested Review Order

**Select shaping — narrowing the two unauthenticated reads**

- Entry point: `login`'s bare select becomes a 5-column allowlist, mirroring `resetPassword`'s existing inline style below it.
  [`auth-controller.ts:153`](../../anash-server/controllers/auth-controller.ts#L153)

- Same narrowing on `forgotPasswordSendOtp`, down to the 3 columns its branches actually read.
  [`auth-controller.ts:250`](../../anash-server/controllers/auth-controller.ts#L250)

**Tests — the regression net**

- Asserts `login` selects exactly the expected 5 keys; reverting to a bare select fails this.
  [`auth-flow.test.ts:302`](../../anash-server/auth-flow.test.ts#L302)

- Same assertion for `forgotPasswordSendOtp`, driven through its `email1: null` branch to avoid the unmocked email client.
  [`auth-flow.test.ts:324`](../../anash-server/auth-flow.test.ts#L324)

- Import updated to pull in `forgotPasswordSendOtp` for the new test.
  [`auth-flow.test.ts:122`](../../anash-server/auth-flow.test.ts#L122)
