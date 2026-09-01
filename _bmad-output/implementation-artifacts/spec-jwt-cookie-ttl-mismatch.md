---
title: 'Align the JWT lifetime with the auth cookie lifetime'
type: 'bugfix'
created: '2026-08-31'
status: 'done'
review_loop_iteration: 0
baseline_commit: '344319fd203f8e203ff5bdcf2d305eaea91f821c'
context: ['anash-server/AGENTS.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Both token mint sites sign `expiresIn: '3d'` while `setAuthCookie` sets `maxAge: 8h`, so every `anash_token` stays verifiable for 2.6 days after the browser has already dropped it. Nothing on the client reads the TTL, so the extra 2.6 days buy members nothing and serve only a replayed, captured token.

**Approach:** Make the session lifetime a single exported constant and collapse the sign-then-set-cookie pair into one helper in `utils/auth-cookie.ts`, so the token and the cookie cannot drift apart again. 8 hours becomes the one truth — the lifetime the cookie already promised.

## Boundaries & Constraints

**Always:** Both lifetimes derive from one constant — the JWT `expiresIn` and the cookie `maxAge` are never written as independent literals. Every mint site goes through the shared helper, per `anash-server/AGENTS.md`. Callers keep passing their own `secret` so current `JWT_SECRET` handling is unchanged. The JWT payload (`JwtParams`) is untouched.

**Ask First:** Changing the 8-hour value itself, or force-invalidating tokens already issued at 3 days.

**Never:** No server-side revocation, token store, `tokenVersion` column, or refresh flow — that goal is already recorded in `deferred-work.md`. Do not touch `middleware/auth.ts`, the 401-vs-403 split, or any client file, and do not fix the unrelated `JWT_SECRET!` assertion or the generic `Database error` handling.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Login mints a session | Correct password for a known member | Signed token where `exp - iat === 8*60*60`, and `Set-Cookie` carries `maxAge === 8*60*60*1000` | N/A |
| First password set via OTP | `updateUser` re-issues the cookie as `pwVerified` | Same TTL and same `maxAge` as login — the two mint sites agree | N/A |
| Degraded session | Wrong password, guest, or held-back password | Still an 8-hour session; existing role/`pwVerified` capping is untouched | N/A |
| No session minted | Login refuses non-numeric input | No `anash_token` cookie is set at all | Existing 400 response unchanged |
| Token already issued at 3 days | A live pre-change token arrives | Still accepted until its own `exp` — this change binds newly minted tokens only | N/A |

</frozen-after-approval>

## Code Map

- `anash-server/utils/auth-cookie.ts` -- where the fix lands. `setAuthCookie` (L10-17) is already the single cookie definition; the `maxAge` literal at L15 is one of the two values to unify.
- `anash-server/controllers/auth-controller.ts` -- mint site 1: the `issueToken` closure (L164-176) inside `login`, with `secret` read at L160.
- `anash-server/controllers/user-controller.ts` -- mint site 2 (L407-414), in the branch that re-issues the cookie once a first password is set.
- `anash-server/auth-flow.test.ts` -- `makeRes()` (L158-171): its `cookie(name, value)` at L167 **drops Express's third options argument**, so `maxAge` is unassertable until that signature is widened. `decodeCookie` (L179-180) is reusable as-is for TTL via `exp - iat`. Mint-site tests to extend: L332 (login happy path) and L597 (`updateUser` re-issue).
- `anash-server/middleware/auth.ts` -- read-only. Verifies via `jwt.verify` (L23) and holds no TTL knowledge, confirming nothing else needs to change.

## Tasks & Acceptance

**Execution:**
- [x] `anash-server/utils/auth-cookie.ts` -- export `SESSION_TTL_SECONDS = 8 * 60 * 60`, derive the cookie's `maxAge` from it, and add `issueAuthToken(res, params, secret)` that signs with `expiresIn: SESSION_TTL_SECONDS` then calls `setAuthCookie`. Keep `setAuthCookie` exported -- one helper owning both halves is what stops the values drifting again.
- [x] `anash-server/controllers/auth-controller.ts` -- replace the `jwt.sign` + `setAuthCookie` pair inside `issueToken` (L166-167) with `issueAuthToken(res, params, secret)`; drop the `jwt` import only if nothing else in the file uses it.
- [x] `anash-server/controllers/user-controller.ts` -- replace the `jwt.sign` + `setAuthCookie` pair (L407-414) with the same helper, passing `process.env.JWT_SECRET!` so the existing secret handling is preserved verbatim.
- [x] `anash-server/auth-flow.test.ts` -- widen `makeRes().cookie` to capture its options argument into a new `out.cookieOptions` field, leaving existing assertions working; then cover the matrix: TTL and `maxAge` on the login happy path (L332) and on the `updateUser` re-issue (L597), one degraded branch, and the no-cookie refusal (L230).

**Acceptance Criteria:**
- Given any code path that sets `anash_token`, when the cookie is written, then its `maxAge` in milliseconds equals the signed token's TTL in seconds times 1000.
- Given `npm test` in `anash-server/`, when the suite runs, then every pre-existing test still passes unchanged.

## Design Notes

The invariant is "the token and the cookie never disagree", and a shared constant alone does not enforce it — a future caller could still pass its own `expiresIn`. Routing both mint sites through one function makes the drift structurally impossible, which is why this is a helper and not just a constant.

```ts
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export function issueAuthToken(res: Response, params: JwtParams, secret: string): void {
    setAuthCookie(res, jwt.sign(params, secret, { expiresIn: SESSION_TTL_SECONDS }));
}
```

Tokens minted before this change keep their own 3-day `exp` and are not invalidated.

## Verification

**Commands:**
- `cd anash-server && npm test` -- expected: the full suite passes, including the new TTL and `maxAge` assertions. Per `AGENTS.md` this is the only gate and takes ~5s.
- `grep -rn "expiresIn\|maxAge" anash-server --include=*.ts | grep -v node_modules` -- expected: outside the test file, matches appear only in `utils/auth-cookie.ts`.

## Suggested Review Order

**The invariant itself**

- Start here: the one value both halves of the session now derive from.
  [`auth-cookie.ts:10`](../../anash-server/utils/auth-cookie.ts#L10)

- The helper that makes drift impossible by signing and setting in one step.
  [`auth-cookie.ts:39`](../../anash-server/utils/auth-cookie.ts#L39)

- The cookie's `maxAge`, now derived rather than hand-written.
  [`auth-cookie.ts:24`](../../anash-server/utils/auth-cookie.ts#L24)

**The two mint sites it replaced**

- Login: the sign-then-set pair collapsed into one call.
  [`auth-controller.ts:165`](../../anash-server/controllers/auth-controller.ts#L165)

- First-password re-issue: the second site, now provably agreeing with login.
  [`user-controller.ts:406`](../../anash-server/controllers/user-controller.ts#L406)

**What guards it**

- Asserts TTL, `maxAge`, and the three security flags at every mint site.
  [`auth-flow.test.ts:208`](../../anash-server/auth-flow.test.ts#L208)

- The capture that made the cookie's options assertable at all.
  [`auth-flow.test.ts:167`](../../anash-server/auth-flow.test.ts#L167)

- Both directions of expiry: an old token still works, an expired one does not.
  [`auth-flow.test.ts:403`](../../anash-server/auth-flow.test.ts#L403)

**Peripheral**

- Points future agents at `issueAuthToken`; placed outside the managed block deliberately.
  [`AGENTS.md:31`](../../anash-server/AGENTS.md#L31)
