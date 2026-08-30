---
title: 'A phone search term of one or two digits still returns nearly the whole directory'
type: 'bugfix'
created: '2026-08-30'
status: 'done'
baseline_commit: 'cc212168932873b1fa10ba4242f962b115b1eb96'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `getUserByPhoneNumber` accepts any non-empty needle, so a term that reduces to one or two
digits builds `LIKE '%0%'` or `LIKE '%1%'` and returns nearly every member record. `phoneSearchNeedle`
strips one leading zero, so `"00"` and `"97200"` both reduce to `"0"`; `normalizePhone` is a formatter,
so `"abc1"` reduces to `"1"`. All three pass the current `!needle` check.

**Approach:** Require a minimum of **3 digits** in the needle before a phone search may run. Enforce it
with a named predicate beside `phoneSearchNeedle` — the same formatter/validator split
`normalizePhone`/`isPlausiblePhone` already uses — rejected in the controller with a 400 and refused
again as a backstop in `phoneSearchCondition`. Surface the rejection in the directory UI so a too-short
term reads as a rejected search, not a blank screen.

## Boundaries & Constraints

**Always:**
- Measure the minimum on the **needle** (post country-code and trunk-zero reduction), not the raw input:
  `"0546"` reduces to `"546"` and sits exactly at the limit.
- One exported constant, read by the controller guard, the SQL backstop and the tests.
- `phoneSearchCondition` keeps throwing rather than returning a permissive predicate.
- Keep the 400 body shape and the existing `number.length > 20` / `match(/\d/)` pre-checks as they are.

**Ask First:**
- Changing how many leading zeros `phoneSearchNeedle` strips, or its contract for non-search callers.
- Any change to `phoneMatchCandidates`, `isPlausiblePhone`, or the auth/reset paths that use them.

**Never:**
- No controller-level test for `getUserByPhoneNumber`, no edits to `auth-flow.test.ts` — tracked
  separately in `deferred-work.md`.
- No refactor of the name/place fetch sites in `home.tsx`; only the phone path changes.
- No client-side phone normalization — the server stays the single source of truth for the rule.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Full number | `number=0546329221` | needle `546329221`, `LIKE '%546329221%'` over all 6 phone columns | N/A |
| Partial term | `number=054-632` | needle `54632`, search runs | N/A |
| Exactly at the limit | `number=0546` | needle `546`, search runs | N/A |
| One digit short | `number=054` | needle `54` — rejected, no query issued | 400 `{ message: 'Invalid phone number' }` |
| Double zero (reported leak) | `number=00` | needle `0` — rejected | 400, no `LIKE '%0%'` reaches the db |
| Country code + zeros (reported leak) | `number=97200` | needle `0` — rejected | 400 |
| Letters with one digit | `number=abc1` | needle `1` — rejected | 400 |
| No digits at all | `number=+972` | needle `''` — rejected (unchanged) | 400 |
| Backstop bypassed | `phoneSearchCondition('54')` called directly | throws, no predicate returned | `Error` naming the minimum |
| UI, rejected term | phone search returns 400 | results cleared, Hebrew message shown | no blank screen |

</frozen-after-approval>

## Code Map

- `anash-server/utils/phone.ts` — `phoneSearchNeedle` L61-64 reduces a term to national digits;
  `isPlausiblePhone` L73-75 is the validator-beside-formatter precedent to copy. Doc block L47-60 tells
  callers to reject only the empty string — it must point at the new predicate.
- `anash-server/utils/phone-sql.ts` — `phoneSearchCondition` L27-40; the backstop throw is L28-30.
- `anash-server/controllers/user-controller.ts` — `getUserByPhoneNumber` L158-188; guard to replace is
  `if (!needle)` L166-169. Imports already reach both util modules (L12-13).
- `anash-server/utils/phone.test.ts` — `phoneSearchNeedle` cases start L122.
- `anash-server/utils/phone-sql.test.ts` — L31-33 asserts the throw against `/non-empty needle/`; that
  message changes, so this test moves with it.
- `anash-client/src/routes/home.tsx` — `filterByPhone` L104-110 and the `type === 'phone'` branch of the
  mount effect (L46-47, L53-55) call `res.json()` unconditionally, so a 400 body lands in `items` as an
  object and `items.length` is `undefined` — neither results (L299) nor the empty state (L312) render.
- Read-only: `anash-server/AGENTS.md` L23 documents the `utils/phone.ts` contract.

## Tasks & Acceptance

**Execution:**
- [x] `anash-server/utils/phone.ts` -- export `PHONE_SEARCH_MIN_DIGITS = 3` and
      `isSearchableNeedle(needle: string): boolean`; correct `phoneSearchNeedle`'s doc block to name it as
      the check callers must run -- the reducer stays a pure reducer, the rule lives in one predicate.
- [x] `anash-server/utils/phone-sql.ts` -- tighten `phoneSearchCondition`'s guard from `!needle` to the
      shared predicate, with an error message naming the minimum -- the backstop must cover the same rule
      it is protecting, not just the empty case.
- [x] `anash-server/controllers/user-controller.ts` -- replace the `!needle` guard in
      `getUserByPhoneNumber` with the predicate -- the request is rejected before any db call.
- [x] `anash-server/utils/phone.test.ts` -- cover every needle row of the I/O matrix through
      `isSearchableNeedle(phoneSearchNeedle(input))`, including `"00"`, `"97200"`, `"abc1"`, `"054"` and
      the `"0546"` boundary -- these are the exact inputs that leak today.
- [x] `anash-server/utils/phone-sql.test.ts` -- retarget the throw test at the new message and add a
      too-short needle case -- proves the backstop refuses what the controller refuses.
- [x] `anash-client/src/routes/home.tsx` -- in the phone search path only, treat a non-ok response as an
      empty result plus a Hebrew message rendered where results would be -- a rejected term must not read
      as a blank screen.

**Acceptance Criteria:**
- Given any term the directory UI can send, when the needle holds fewer than `PHONE_SEARCH_MIN_DIGITS`
  digits, then no `db.select` runs for that request.
- Given the threshold has to change, when `PHONE_SEARCH_MIN_DIGITS` is edited, then the controller guard,
  the SQL backstop and the error text all follow from that one edit.
- Given a member searches a real number or fragment of 3+ digits, when the search runs, then the result
  set is identical to today's.

## Verification

**Commands:**
- `cd anash-server && npm test` -- expected: all tests pass, including the new threshold cases.
- `cd anash-server && npm run lint` -- expected: no new errors versus the baseline (the config reports
  pre-existing `no-undef` noise for `console`; compare counts, do not expect a clean run).
- `cd anash-client && npm run lint && npm run build` -- expected: both succeed.

**Manual checks (if no CLI):**
- In the running client, a phone search for `00` shows the rejection message and no result cards; a search
  for a real number still returns its rows.

## Suggested Review Order

**The rule**

- The single shared threshold and predicate every enforcement point below reads from.
  [`phone.ts:73-81`](../../anash-server/utils/phone.ts#L73-L81)

**Enforcement points**

- Controller rejects a too-short term with 400 before any `db.select` runs.
  [`user-controller.ts:166`](../../anash-server/controllers/user-controller.ts#L166)

- SQL-level backstop throws if a caller ever skips the controller's check.
  [`phone-sql.ts:31-32`](../../anash-server/utils/phone-sql.ts#L31-L32)

**Client rejection handling**

- Non-ok response clears results and shows a Hebrew message instead of a blank screen.
  [`home.tsx:44-60`](../../anash-client/src/routes/home.tsx#L44-L60)

- Network/parse failure gets the same treatment so loading never hangs forever.
  [`home.tsx:64-68`](../../anash-client/src/routes/home.tsx#L64-L68)

- Both phone-search call sites wire the response and error handlers.
  [`home.tsx:77-81`](../../anash-client/src/routes/home.tsx#L77-L81)
  [`home.tsx:143-144`](../../anash-client/src/routes/home.tsx#L143-L144)

- Rejected-search state renders as a distinct block from the plain empty-results state.
  [`home.tsx:351-358`](../../anash-client/src/routes/home.tsx#L351-L358)

**Tests**

- Every I/O matrix needle case, including both reported leaks (`"00"`, `"97200"`) and the `"abc1"`/boundary cases.
  [`phone.test.ts:174-215`](../../anash-server/utils/phone.test.ts#L174-L215)

- Backstop throws for the same short needles the controller already rejects.
  [`phone-sql.test.ts:35-40`](../../anash-server/utils/phone-sql.test.ts#L35-L40)
