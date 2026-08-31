---
title: 'Login degrades a wrong password to a capped session instead of rejecting it'
type: 'feature'
created: '2026-08-31'
status: 'done'
baseline_commit: 'f5523675096cbc2c5fd0baf780a2d6bf510a43b1'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `login` already admits an unknown phone as a `guest` and a held-back password as a capped `user`, but a *wrong* password still returns 401 and locks the caller out entirely — the one remaining path where a member with a real account cannot get in at all.

**Approach:** Treat a wrong password exactly like an omitted one — degrade to role `user`, `pwVerified: false`, same as today's held-back-password path — but flag the response so the client can tell the member their password was wrong and show them how to fix it, instead of silently succeeding.

## Boundaries & Constraints

**Always:**
- `login` never returns 401 for a phone that matches a row. Wrong password → same degraded session as omitted password (`role: 'user'`, `pwVerified: false`), plus `passwordIncorrect: true` in the JSON body only (never in the JWT).
- A failed password attempt still writes `success: false` to `user_logins` — the caller is no longer locked out, but `/login-logs` must keep showing that an attempt on this account failed.
- Only a proven `bcrypt.compare` match unlocks the account's real role and `pwVerified: true`.
- The client does not auto-navigate away on `passwordIncorrect` — it tells the member what happened and lets them retry or use the existing "שכחתי סיסמה" flow, on the same page.

**Ask First:** none anticipated.

**Never:**
- Do not touch `forgotPasswordSendOtp` or `resetPassword` — both keep rejecting outright; an OTP round-trip already proves identity independently of the account password.
- Do not touch `login`'s existing ambiguous-multi-row-match handling (`orderBy(asc(users.id)).limit(1)`) — tracked separately in `deferred-work.md`, out of scope here.
- Do not persist the warning anywhere server-side; it is a one-time client hint for that single response.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Correct password | account has password, correct value | 200, real role, `pwVerified: true` — unchanged from today | N/A |
| Wrong password | account has password, wrong value | 200, `role: 'user'`, `pwVerified: false`, `passwordIncorrect: true` | logged as `success: false` |
| Omitted password | account has password, no password field | 200, `role: 'user'`, `pwVerified: false`, no `passwordIncorrect` flag — unchanged | logged as `success: true` |
| Password sent to a passwordless account | `row.password` is null, body has a password | same as "wrong password" above | logged as `success: false` |
| Unknown number | phone matches no row | 200, guest — unchanged | N/A |

</frozen-after-approval>

## Code Map

- `anash-server/controllers/auth-controller.ts` -- `login` (L129-235): the two `res.status(401).json({ message: 'סיסמה שגויה' })` branches (L208-220) are replaced by one degrade branch that reuses `issueToken`. `issueToken` (L162-173) needs an optional second `extra` param merged into the JSON body (never into `params`/the JWT).
- `anash-server/auth-flow.test.ts` -- `'row 4: a wrong password is still 401 and is logged as a failure'` (L290-304): rewrite to expect 200 + the degraded body + `passwordIncorrect: true` + a cookie now being set; `state.inserts[0].success` stays `false`. Add one case for a password submitted against a passwordless row taking the same branch.
- `anash-client/src/context/auth.tsx` -- `login()` (L50-63) and `AuthContextType.login` (L32): return `{ passwordIncorrect: boolean }` from the resolved response instead of `Promise<void>`.
- `anash-client/src/routes/login.tsx` -- `handleSubmit` (L14-26): on `passwordIncorrect`, show a warning and a "המשך לרשימה" button instead of navigating immediately; clear the password field so the member can retry on the same form. The existing "שכחתי סיסמה" button (L71-77) already covers the reset path.
- `anash-client/src/routes/login.module.css` -- add a `formWarning` style next to `.formError` (L110).
- Read-only: `anash-client/src/routes/forgot-password.tsx` L90 calls `login(phone, newPassword)` right after a successful reset, so `passwordIncorrect` is always `false` there — unaffected by the wider return type.

## Tasks & Acceptance

**Execution:**
- [x] `anash-server/controllers/auth-controller.ts` -- widen `issueToken` with an optional extra-fields param; replace `login`'s two 401 branches with one degrade branch (`role: 'user'`, `pwVerified: false`, logs `success: false`, responds with `passwordIncorrect: true`) -- removes `login`'s last lockout path.
- [x] `anash-server/auth-flow.test.ts` -- rewrite the "row 4" test for the new 200/degraded/flagged shape; add a passwordless-account-plus-submitted-password case on the same branch.
- [x] `anash-client/src/context/auth.tsx` -- `login()` returns `{ passwordIncorrect }`; update the exported type.
- [x] `anash-client/src/routes/login.tsx` -- branch on `passwordIncorrect`: show the warning + continue button, skip the auto-navigate, clear the password field.
- [x] `anash-client/src/routes/login.module.css` -- add the `formWarning` style.

**Acceptance Criteria:**
- Given an account with a password, when the wrong password is submitted, then the response is 200 with `role: 'user'`, `pwVerified: false`, `passwordIncorrect: true`, and `user_logins` records `success: false`.
- Given that same response, when the client receives it, then the member is not auto-navigated away; they see the warning and can retry the form or use "שכחתי סיסמה".
- Given a correct password or an omitted one, when `login` runs, then behavior (status, role, `pwVerified`, navigation, absence of the warning) is unchanged from today.

## Design Notes

Wrong password deliberately still logs `success: false`, unlike the held-back-password path's `success: true`: the session outcome (role, `pwVerified`) is identical either way, but `/login-logs` exists specifically to show owners that an attempt on a real account failed, and that signal would otherwise disappear the moment lockout does.

`issueToken`'s extra param is response-only scaffolding for a one-time client hint -- it must never be spread into `params` (the JWT payload), only into the second `res.json` call.

## Verification

**Commands:**
- `cd anash-server && npm test` -- expected: 66 tests, 66 pass, 0 fail (65 today, net +1: one rewritten, one added).
- `cd anash-server && npx tsc --noEmit` -- expected: unchanged, exactly the one pre-existing `tsconfig.json(5,25): error TS5107` line.
- `cd anash-server && npx eslint .` -- expected: unchanged baseline of 12 problems (0 errors, 12 warnings).
- `cd anash-client && npx tsc --noEmit` -- expected: no output.
- `cd anash-client && npm run lint` -- expected: unchanged baseline of 6 problems (4 errors, 2 warnings).

**Manual checks (if no CLI):**
- At `/login`, submit a real member's phone with a wrong password: expect to stay on the page with the warning visible and a working "המשך לרשימה" button; retrying with the correct password must then navigate in with the real role.

## Suggested Review Order

**The degrade branch**

- Start here: the merged condition that removes `login`'s last lockout path and folds a wrong password into the same session shape as an omitted one.
  [`auth-controller.ts:219`](../../anash-server/controllers/auth-controller.ts#L219)

- `issueToken`'s new `extra` param carries the one-time hint into the JSON body only, never into the signed JWT.
  [`auth-controller.ts:165`](../../anash-server/controllers/auth-controller.ts#L165)

**Client identity contract**

- The widened return type every caller of `login()` must now account for.
  [`auth.tsx:63`](../../anash-client/src/context/auth.tsx#L63)

- The primary consumer: stays on the page, warns, and offers a subordinate way through instead of auto-navigating.
  [`login.tsx:21`](../../anash-client/src/routes/login.tsx#L21)

- The second consumer of the same contract, fixed during review: a reset-then-login that resolves degraded now falls back like any other login failure instead of silently succeeding.
  [`forgot-password.tsx:90`](../../anash-client/src/routes/forgot-password.tsx#L90)

**Peripherals**

- `btnGhost` keeps "המשך לרשימה" visually subordinate to the real submit button, added during review.
  [`login.module.css:211`](../../anash-client/src/routes/login.module.css#L211)

- Rewritten to prove the degrade branch instead of the old 401.
  [`auth-flow.test.ts:290`](../../anash-server/auth-flow.test.ts#L290)

- New coverage for a password submitted against a passwordless row, the other input that reaches this branch.
  [`auth-flow.test.ts:313`](../../anash-server/auth-flow.test.ts#L313)
