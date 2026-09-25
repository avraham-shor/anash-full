---
title: 'Record guest login attempts in the login audit trail'
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: '344319fd203f8e203ff5bdcf2d305eaea91f821c'
context: ['anash-server/AGENTS.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A login from a phone number matching no user is admitted as a "guest" and issued a session, but nothing is written to `user_logins` — `userId` is `NOT NULL` with an FK to `users`, and a guest attempt has no row it could point at. The owner-facing `/login-logs` audit trail therefore has zero record that these guest sessions were ever issued.

**Approach:** Make `user_logins.userId` nullable and add a `phoneNumber` column. A guest login now inserts a row with `userId: null` and the normalized phone number it was issued for; `/login-logs` left-joins `users` (instead of inner-joining) so these rows still appear, showing the phone number where a name would otherwise be.

## Boundaries & Constraints

**Always:** Every session-issuing branch of `login` (guest included) writes exactly one `user_logins` row. `phoneNumber` is populated only when `userId` is null — authenticated logins already have `users.fullName` via the join, so leave their `phoneNumber` null rather than duplicating it. Store the already-normalized local-format phone (`normalizePhone`'s output, e.g. `0546329221`), matching how phone columns are stored elsewhere. Schema changes go through `db/schema.ts` then `npm run db:generate`, per `anash-server/AGENTS.md` — never hand-edit a `drizzle/*.sql` file.

**Ask First:** N/A — the schema change and phone-storage approach were already confirmed with the human before this spec was drafted.

**Never:** Do not run `db:migrate` / `db:migrate:prod` against the live Railway database yourself — Railway's `preDeployCommand` already applies generated migrations on deploy (see commit `344319f`). Do not touch `middleware/auth.ts`, the wrong-password/held-back-password success semantics, or any revocation/session-store behavior. Do not add a "guest" badge or extra column client-side beyond showing the phone number in the existing name slot.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Unknown phone logs in as guest | `POST /login`, phone matches no user row | A `user_logins` row is inserted: `userId: null`, `phoneNumber: <normalized phone>`, `success: true`; guest session issued as before | N/A |
| Owner views `/login-logs` after a guest attempt | `GET /login-logs`, owner role | The guest row is present (left join, not dropped); `fullName` and `city` are `null` for it | N/A |
| Known phone logs in (any existing branch) | Phone matches a user row | `user_logins` row inserted exactly as before; `phoneNumber` left `null` | N/A |
| Client renders a guest row | `LoginLog` with `userId: null`, `phoneNumber` set | Name cell shows the phone number as plain text, not a broken `/users/undefined` link | N/A |

</frozen-after-approval>

## Code Map

- `anash-server/db/schema.ts` (L57-64) -- `userLogins` table: drop `.notNull()` from `userId` (L59); add `phoneNumber: text('phone_number')`.
- `anash-server/controllers/auth-controller.ts` (L179-196) -- `login`'s guest branch (L179-185) currently `return`s before `ip`/`ua` (L187-188) are computed and before `logLogin` exists; hoist `ip`/`ua` above the guest check and insert a `userLogins` row there too.
- `anash-server/controllers/auth-controller.ts` (L92-106) -- `getLoginLogs`: change `.innerJoin` to `.leftJoin` (L104); add `phoneNumber: userLogins.phoneNumber` to the select projection (L93-102).
- `anash-client/src/routes/login-logs.tsx` (L8-17, L186-190) -- `LoginLog` interface and the name-cell render; `userId`/`fullName` become nullable, add `phoneNumber`, branch the cell between the existing `Link` and plain phone text.
- `anash-server/auth-flow.test.ts` (L82-138 mock builder, L257-267 guest test) -- `from(userLogins)` (L110) currently forces select rows to `[]` unconditionally; extend it to serve a configurable fixture so `getLoginLogs` is testable. Update the guest-login test (L257, currently asserts `state.inserts.length === 0`) to assert the new insert shape instead.
- `anash-server/AGENTS.md` (L11) -- confirms schema changes go through `db/schema.ts` + `npm run db:generate`.

## Tasks & Acceptance

**Execution:**
- [x] `anash-server/db/schema.ts` -- make `userId` nullable, add `phoneNumber` column -- lets a guest row exist with no `users` FK target while still identifying the attempt.
- [x] Run `npm run db:generate` in `anash-server` -- produces the migration SQL; commit it alongside the schema change, do not hand-edit it.
- [x] `anash-server/controllers/auth-controller.ts` (`login`) -- hoist `ip`/`ua` above the guest early-return; insert into `userLogins` there (`userId: null, phoneNumber: phone, success: true`) before `issueToken` -- makes every session-issuing path write an audit row.
- [x] `anash-server/controllers/auth-controller.ts` (`getLoginLogs`) -- switch `innerJoin` to `leftJoin`, select `userLogins.phoneNumber` -- keeps guest rows in the result instead of silently excluding them.
- [x] `anash-client/src/routes/login-logs.tsx` -- widen `LoginLog.userId`/`fullName` to nullable, add `phoneNumber`, render the phone number (or `—`) in place of the name `Link` when `userId` is null -- avoids a broken `/users/undefined` link.
- [x] `anash-server/auth-flow.test.ts` -- extend the mock to serve configurable `userLogins` select rows; update the guest-login test for the new insert shape; add coverage for `getLoginLogs` returning a guest row (`phoneNumber` set, no `fullName`) alongside a normal row.

**Acceptance Criteria:**
- Given a login attempt whose phone matches no user, when the login completes, then a `user_logins` row exists with `userId` null and `phoneNumber` equal to the normalized phone.
- Given `/login-logs` is fetched by an owner after both a guest and an authenticated login, when the response is inspected, then both rows are present and the guest row's `fullName` is null while its `phoneNumber` is set.
- Given `npm test` in `anash-server`, when the suite runs, then it passes including the new/updated assertions.

## Spec Change Log

## Design Notes

A nullable `userId` plus a `phoneNumber` column keeps one table serving both identified and anonymous attempts, instead of a parallel guest-log table. `phoneNumber` only carries meaning when `userId` is null; populating it for authenticated rows too would just duplicate what the join to `users.fullName` already provides.

## Verification

**Commands:**
- `cd anash-server && npm test` -- expected: full suite passes, including the new guest-insert-shape and `getLoginLogs` assertions.
- `cd anash-server && npm run db:generate` -- expected: a new `drizzle/*.sql` migration reflecting the nullable `userId` and new `phone_number` column is generated and committed.

## Suggested Review Order

**Schema change**

- The invariant this whole story rests on: a guest row can now exist with no `users` FK target.
  [`schema.ts:59`](../../anash-server/db/schema.ts#L59)

- The new column that identifies a guest row when `userId` is null.
  [`schema.ts:60`](../../anash-server/db/schema.ts#L60)

- Generated migration -- drops `NOT NULL`, adds `phone_number`. Not hand-edited.
  [`0001_flowery_namorita.sql:1`](../../anash-server/drizzle/0001_flowery_namorita.sql#L1)

**Guest login now writes an audit row**

- `ip`/`ua` hoisted above the guest branch so both paths can use them.
  [`auth-controller.ts:180`](../../anash-server/controllers/auth-controller.ts#L180)

- The insert itself: `userId: null`, `phoneNumber` carries the normalized number instead.
  [`auth-controller.ts:194`](../../anash-server/controllers/auth-controller.ts#L194)

- Isolated in its own `try/catch` so a transient DB failure on the audit write can never turn a guest admission into a 500.
  [`auth-controller.ts:193`](../../anash-server/controllers/auth-controller.ts#L193)

**`/login-logs` keeps guest rows instead of dropping them**

- `innerJoin` → `leftJoin`: the one-line reason guest rows no longer vanish from the audit trail.
  [`auth-controller.ts:105`](../../anash-server/controllers/auth-controller.ts#L105)

- `phoneNumber` added to the projection so the client has something to show in place of a name.
  [`auth-controller.ts:96`](../../anash-server/controllers/auth-controller.ts#L96)

**Client renders a guest row without a broken link**

- Widened types make `userId`/`fullName` honestly nullable.
  [`login-logs.tsx:10`](../../anash-client/src/routes/login-logs.tsx#L10)

- The branch: a real `Link` when `userId` exists, plain phone text otherwise -- never `/users/undefined`.
  [`login-logs.tsx:188`](../../anash-client/src/routes/login-logs.tsx#L188)

- The phone number gets the same LTR treatment every other phone display in the app already uses.
  [`login-logs.tsx:193`](../../anash-client/src/routes/login-logs.tsx#L193)
  [`login-logs.module.css:250`](../../anash-client/src/routes/login-logs.module.css#L250)

**Tests**

- The guest-insert shape: `userId: null`, `phoneNumber` set, `success: true`.
  [`auth-flow.test.ts:288`](../../anash-server/auth-flow.test.ts#L288)

- Proves a DB failure on the audit write still lets the guest in.
  [`auth-flow.test.ts:313`](../../anash-server/auth-flow.test.ts#L313)

- Proves the left join keeps a guest row alongside a normal one, correctly shaped.
  [`auth-flow.test.ts:331`](../../anash-server/auth-flow.test.ts#L331)
