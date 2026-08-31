---
title: 'Refuse ambiguous phone matches in password reset instead of guessing an account'
type: 'bugfix'
created: '2026-08-31'
status: 'done'
baseline_commit: '6fdf37eb81fc55ac526d0901343122e36b31a322'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `matchesPhone`'s digits-only predicate can match more than one `users` row (e.g. two members whose `husband_mobile`/`wife_mobile` normalize to the same digits). `forgotPasswordSendOtp` and `resetPassword` both run `.orderBy(asc(users.id)).limit(1)` over that predicate, so on an ambiguous match the OTP is emailed to whichever row's `id` sorts first — not necessarily the account the requester owns — and the password write in `resetPassword` lands on that same arbitrary row.

**Approach:** Detect when the phone predicate matches more than one row and refuse, using the exact same response the endpoint already gives for zero matches — instead of silently picking one via ordering.

## Boundaries & Constraints

**Always:**
- Both endpoints must be able to tell "0 matches", "1 match" and "2+ matches" apart before doing anything else (sending an OTP, reading a verification code, or writing a password).
- An ambiguous match (2+ rows) gets the exact status and body the endpoint already returns for zero matches — no distinct message, so a caller cannot tell "no account" apart from "number shared by several accounts".
- `matchesPhone` (`auth-controller.ts`) is reused unchanged; only how its result count is handled changes.

**Ask First:** none anticipated — no schema or migration change is needed.

**Never:**
- Do not add a DB uniqueness constraint or migration on `husband_mobile`/`wife_mobile`.
- Do not change `login`'s multi-match handling (it deliberately picks a deterministic first row today; that is existing, accepted behavior and out of scope for this fix).
- Do not widen which columns authenticate a phone (still `husband_mobile`/`wife_mobile` only).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Single match, has password + email | `forgotPasswordSendOtp`, phone matches exactly 1 row | 200, OTP row inserted, email sent — unchanged from today | N/A |
| No match | `forgotPasswordSendOtp` or `resetPassword`, phone matches 0 rows | existing 400 "לא נמצא חשבון..." response | N/A |
| Ambiguous match | `forgotPasswordSendOtp`, phone matches 2+ rows | same 400 body/status as the no-match case | no `verificationCodes` insert, no email sent |
| Ambiguous match | `resetPassword`, phone matches 2+ rows | same 400 body/status as its existing no-account-with-password case | no `verificationCodes` read, no password update |
| Single match, no password on account | `resetPassword`, phone matches exactly 1 row, `row.password` null | existing 400 "לחשבון זה אין סיסמה..." — unchanged | N/A |

</frozen-after-approval>

## Code Map

- `anash-server/controllers/auth-controller.ts` -- `forgotPasswordSendOtp` (L237-283) and `resetPassword` (L285-339): each does `.where(matchesPhone(phone)).orderBy(asc(users.id)).limit(1)` then destructures `const [row] = ...`. Change both to fetch up to 2 rows (`.limit(2)`, no need to remove `orderBy`) and branch on the result length instead of trusting the first element.
- `anash-server/auth-flow.test.ts` -- mock db harness: `state.row` (L38-52) and `rowsForUsers()` (L75-86) yield exactly one fixed row per table. Needs a way to yield 2 rows for the `users` table on demand (e.g. an added `state.rows` array checked before `state.row`) without changing behavior for every existing single-row test.

## Tasks & Acceptance

**Execution:**
- [x] `anash-server/controllers/auth-controller.ts` -- `forgotPasswordSendOtp`: fetch matching rows without collapsing to one via `limit(1)`; if the result is not exactly one row, take the existing not-found branch -- closes the OTP-to-wrong-account path.
- [x] `anash-server/controllers/auth-controller.ts` -- `resetPassword`: same fetch-and-count change; anything other than exactly one row takes the existing not-found/no-password branch -- closes the reset-wrong-account path.
- [x] `anash-server/auth-flow.test.ts` -- extend the users-table mock to yield more than one row on demand; add a test per endpoint proving a 2-row match returns the identical status/body as the 0-row case, plus a regression test that a 1-row match is unaffected.

**Acceptance Criteria:**
- Given two rows whose phone columns both match the submitted number, when `forgotPasswordSendOtp` runs, then no OTP is generated or emailed and the response is byte-identical (status + body) to its zero-match response.
- Given the same ambiguous match, when `resetPassword` runs with any OTP and new password, then no `verificationCodes` row is read and no password is updated, and the response is identical to its existing no-account-with-password response.
- Given exactly one row matches, when either endpoint runs, then behavior is unchanged from today.

## Design Notes

`limit(2)` rather than an unlimited fetch: the phone predicate already narrows to a handful of rows at most, and the endpoint only needs to distinguish "exactly one" from "more than one" — two rows is enough evidence, no need to pull every match.

Returning the *same* response for "0 matches" and "2+ matches" is deliberate: a distinct "this number is ambiguous" message would let a caller enumerate which phone numbers are shared across accounts, which is itself a small information leak worth avoiding for free.

## Verification

**Commands:**
- `cd anash-server && npm test` -- expected: all tests pass, 0 fail (59 today, plus the new ambiguous-match tests).
- `cd anash-server && npx tsc --noEmit` -- expected: exactly the one pre-existing `tsconfig.json(5,25): error TS5107` line, nothing else.
- `cd anash-server && npx eslint .` -- expected: unchanged from the current baseline of 12 problems (0 errors, 12 warnings).

**Manual checks (if no CLI):**
- None -- fully covered by the automated suite above.

## Suggested Review Order

**The ambiguous-match fix**

- Fetches up to 2 rows instead of 1, so ambiguity can be detected before any side effect.
  [`auth-controller.ts:251`](../../anash-server/controllers/auth-controller.ts#L251)

- Refuses on anything but exactly one match, reusing the zero-match response verbatim.
  [`auth-controller.ts:258`](../../anash-server/controllers/auth-controller.ts#L258)

- Same fix mirrored in resetPassword, folded into its existing no-password branch.
  [`auth-controller.ts:319`](../../anash-server/controllers/auth-controller.ts#L319)

**Verifying the fix**

- Proves an ambiguous match is byte-identical to a true zero-match response.
  [`auth-flow.test.ts:410`](../../anash-server/auth-flow.test.ts#L410)

- Same proof for resetPassword, plus that no OTP row or password write happens.
  [`auth-flow.test.ts:442`](../../anash-server/auth-flow.test.ts#L442)

- Regression test confirming the single-match path is untouched by the fix.
  [`auth-flow.test.ts:430`](../../anash-server/auth-flow.test.ts#L430)

**Closing coverage gaps surfaced by review**

- `sendOtpEmail` is mocked for the first time, unblocking a real success-path test.
  [`auth-flow.test.ts:145`](../../anash-server/auth-flow.test.ts#L145)

- The success path itself, previously untested end-to-end.
  [`auth-flow.test.ts:385`](../../anash-server/auth-flow.test.ts#L385)

- resetPassword's null-password branch -- the one matrix row with zero prior coverage.
  [`auth-flow.test.ts:467`](../../anash-server/auth-flow.test.ts#L467)
